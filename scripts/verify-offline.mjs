import { auditLanguages } from './audit-languages.mjs';
import { auditCopy } from './audit-copy.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { localChrome } from './chrome-local.mjs';
import { create, tinyPdf } from './pdf-fixture.mjs';
import { auditSeo } from './audit-seo.mjs';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes:true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(directory + '/' + entry.name) : [directory + '/' + entry.name]))).flat();
}
const generalTools = JSON.parse(await readFile('presets/general-tools.json', 'utf8'));
const files = await walk('dist');
const htmlPages = new Map(await Promise.all(files.filter(path => path.endsWith('.html')).map(async path => ['/' + path.slice(5), await readFile(path, 'utf8')])));
auditSeo(htmlPages);
auditCopy(htmlPages);
const unverified = JSON.parse(await readFile('presets/unverified-exams.json', 'utf8'));
const properNames = [...JSON.parse(await readFile('presets/exams.json', 'utf8')), ...unverified].flatMap(exam => [exam.name, exam.body ?? '']).map(name => name.replaceAll('&', '&amp;'));
properNames.push(...JSON.parse(await readFile('presets/hi.json', 'utf8')).pdfPages.literalTokens);
auditLanguages(htmlPages, properNames);
async function dependencies(path, seen = new Set()) {
  if (seen.has(path)) return '';
  seen.add(path);
  const content = await readFile('dist' + path, 'utf8');
  const references = [...content.matchAll(/["']((?:\.{1,2}\/|\/assets\/)[^"']+\.(?:js|css))["']/g)].map(match => new URL(match[1], 'https://nouploads.in' + path).pathname);
  return content + (await Promise.all(references.map(reference => dependencies(reference, seen)))).join('');
}
for (const [path, html] of htmlPages) if (html.includes('data-tool="pdf"')) assert.doesNotMatch(await dependencies(path), /cropper-container/i);
for (const path of [...htmlPages.keys()].filter(path => htmlPages.get(path).includes('data-general=') || path === '/index.html' || path === '/hi/index.html' || /\/exam\/[^/]+\/index.html$/.test(path))) assert.doesNotMatch(await dependencies(path), /qpdf|\.wasm/i);
console.log('Built SEO audit: all ' + htmlPages.size + ' HTML pages passed. No Cropper on PDF or qpdf/wasm in resizer dependencies.');
for (const path of files.filter(path => path.endsWith('.html'))) {
  const html = await readFile(path, 'utf8');
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replaceAll('&#39;', "'");
  assert.equal(policy.match(/(?:^|;)\s*connect-src ([^;]+)/)[1], "'self'");
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/\bsrc=/.test(script[1])) assert.ok(policy.includes("'sha256-" + createHash('sha256').update(script[2]).digest('base64') + "'"));
  }
  for (const tag of html.matchAll(/<(?:script|link)\b([^>]*)>/g)) {
    if (/\brel="(?:canonical|alternate)"/.test(tag[1])) continue;
    for (const attribute of tag[1].matchAll(/\b(?:src|href)="([^"]+)"/g)) assert.equal(new URL(attribute[1], 'http://localhost/' + path.slice(5)).origin, 'http://localhost');
  }
}
const qpdf = await create();
qpdf.FS.writeFile('/in.pdf', tinyPdf());
assert.equal(qpdf.callMain(['--encrypt','user','owner','256','--','/in.pdf','/enc.pdf']),0);
const encrypted = Buffer.from(qpdf.FS.readFile('/enc.pdf')).toString('base64');
const addedExams = JSON.parse(await readFile('presets/exams.json', 'utf8')).slice(7);
const hindiStrings = JSON.parse(await readFile('presets/hi.json', 'utf8')).translations;
const browser = await localChrome('dist');
const errors = [];
const missingResponses = [];
let checkingMissingPage = false;
const external = [];
const cacheResponses = [];
browser.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
browser.on('Log.entryAdded', event => {
  if (event.entry.level !== 'error') return;
  if (checkingMissingPage && ['/missing-page', '/hi/missing-page', '/exam/cat/', '/hi/exam/cat/'].map(path => browser.origin + path).includes(event.entry.url) && event.entry.text === 'Failed to load resource: the server responded with a status of 404 ()') return;
  errors.push(event.entry.text);
});
browser.on('Network.requestWillBeSent', event => { if (/^https?:/.test(event.request.url) && !event.request.url.startsWith(browser.origin + '/')) external.push(event.request.url); });
browser.on('Network.responseReceived', event => {
  if (event.response.fromServiceWorker) cacheResponses.push(event.response.url);
  if (event.response.url === browser.origin + '/missing-page') missingResponses.push(event.response);
});
try {
  await browser.send('Log.enable');
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__outputBlobs = new Map(); const create = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { const url = create(blob); window.__outputBlobs.set(url, blob); return url; };' });
  await browser.navigate('/');
  await browser.wait('!!navigator.serviceWorker?.controller');
  const cached = await browser.evaluate('(async () => { const names = await caches.keys(); return (await (await caches.open(names[0])).keys()).map(request => new URL(request.url).pathname).sort(); })()');
  assert.ok(cached.includes('/404.html'));
  assert.ok(cached.includes('/share.png'));
  assert.deepEqual(cached, files.filter(path => path !== 'dist/_headers' && !htmlPages.get('/' + path.slice(5))?.includes('data-custom-limits="true"')).map(path => '/' + path.slice(5)).sort());
  const originalWorker = await readFile('dist/sw.js', 'utf8');
  const originalCache = await browser.evaluate('(async () => (await caches.keys()).find(name => name.startsWith("noupload-")))()');
  browser.setResponse('/sw.js', originalWorker.replace(originalCache, originalCache + '-update-test'));
  await browser.evaluate('(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); })()');
  await browser.wait('!!document.getElementById("pwa-update")');
  assert.ok(await browser.evaluate('(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)()'));
  assert.ok((await browser.evaluate('caches.keys()')).includes(originalCache));
  await browser.send('Page.navigate', { url:'about:blank' });
  await browser.wait('location.href === "about:blank"');
  await new Promise(resolve => setTimeout(resolve, 300));
  await browser.navigate('/');
  await browser.wait('(async () => !(await navigator.serviceWorker.getRegistration()).waiting && !!navigator.serviceWorker.controller)()');
  assert.ok(!(await browser.evaluate('caches.keys()')).includes(originalCache));
  console.log('Update lifecycle passed: waiting notice, no forced activation, old cache removed after last client leaves.');
  const secondCache = await browser.evaluate('(async () => (await caches.keys()).find(name => name.startsWith("noupload-")))()');
  browser.setResponse('/sw.js', originalWorker.replace(originalCache, originalCache + '-reload-test'));
  await browser.evaluate('(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); })()');
  await browser.wait('!!document.querySelector("#pwa-update button")');
  await browser.evaluate('document.querySelector("#pwa-update button").click()');
  await browser.wait('(async () => !(await navigator.serviceWorker.getRegistration())?.waiting && (await caches.keys()).includes(' + JSON.stringify(originalCache + '-reload-test') + ') && !(await caches.keys()).includes(' + JSON.stringify(secondCache) + ') && !document.getElementById("pwa-update"))()');
  console.log('Update reload passed: Reload activates the waiting worker and loads the new version in the same tab.');
  const manifest = await browser.send('Page.getAppManifest');
  assert.equal(manifest.errors.length,0);
  assert.equal(JSON.parse(manifest.data).name,'nouploads');
  const installability = await browser.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors, []);
  for (const route of ['/exam/cat/', '/hi/exam/cat/']) {
    await browser.navigate(route);
    await browser.wait('!!document.querySelector("#custom-max")');
    assert.equal(await browser.evaluate('document.getElementById("custom-max").value'), '');
    for (const mode of ['photo', 'signature']) {
      await browser.evaluate('document.querySelector("input[value=' + mode + ']").click()');
      await browser.evaluate('(async () => { const canvas=document.createElement("canvas"); canvas.width=600; canvas.height=800; const context=canvas.getContext("2d"); context.fillStyle="#567890"; context.fillRect(0,0,600,800); const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png")); const transfer=new DataTransfer(); transfer.items.add(new File([blob],"custom.png",{type:"image/png"})); const input=document.getElementById("file"); input.files=transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); })()');
      await browser.wait('!document.getElementById("generate").disabled');
      await browser.evaluate('document.getElementById("generate").click()');
      await browser.wait('!!document.getElementById("status").textContent');
      assert.equal(await browser.evaluate('document.getElementById("result").hidden'), true);
      await browser.evaluate('(() => { for (const [key,value] of Object.entries({min:"1",max:"50",width:"2.54",height:"5.08",unit:"cm",dpi:"100"})) { const input=document.getElementById("custom-"+key); input.value=value; input.dispatchEvent(new Event("input",{bubbles:true})); } })()');
      assert.equal(await browser.evaluate('document.getElementById("custom-error").textContent'), '');
      await browser.evaluate('document.getElementById("generate").click()');
      await browser.wait('!document.getElementById("result").hidden');
      const result = await browser.evaluate('(async () => {const blob=window.__outputBlobs.get(document.getElementById("download").href);const image=await createImageBitmap(blob);return {width:image.width,height:image.height,size:blob.size};})()');
      assert.equal(result.width, 100);
      assert.equal(result.height, 200);
      assert.ok(result.size < 50 * 1024);
      await browser.evaluate('document.getElementById("custom-max").value="0";document.getElementById("custom-max").dispatchEvent(new Event("input",{bubbles:true}))');
      assert.equal(await browser.evaluate('document.getElementById("result").hidden'), true);
      assert.ok(await browser.evaluate('!!document.getElementById("custom-error").textContent'));
    }
    await browser.send('Page.reload', { ignoreCache: true });
    await browser.wait('!!document.getElementById("custom-max")');
    assert.equal(await browser.evaluate('document.getElementById("custom-max").value'), '');
  }
  console.log('Custom limits passed: English/Hindi, both image modes, required limits, cm/DPI output, invalidation and no saved limits.');
  await browser.navigate('/');
  await browser.send('Network.setCacheDisabled', { cacheDisabled:true });
  await browser.send('Network.emulateNetworkConditions', { offline:true, latency:0, downloadThroughput:0, uploadThroughput:0 });
  await browser.stopServer();
  for (const path of ['/', '/hi/', '/hi/pdf-unlock.html', '/hi/pdf-unlock', '/hi/404.html', '/exam/ibps-po/', '/hi/exam/ibps-po/', '/pdf-unlock.html', '/pdf-unlock', '/exam/', '/hi/exam/', '/unlock-pdf/', '/hi/unlock-pdf/', '/pdf-password/aadhaar/', '/hi/pdf-password/aadhaar/', ...addedExams.flatMap(exam => (exam.languages ?? ['en', 'hi']).map(lang => (lang === 'hi' ? '/hi' : '') + '/exam/' + exam.id + '/'))]) {
    await browser.navigate(path);
    await browser.send('Page.reload', { ignoreCache:false });
    await browser.wait('document.readyState === "complete" && !!navigator.serviceWorker.controller');
    assert.ok(await browser.evaluate('!!document.querySelector("footer [data-offline-status]")'));
    if (['/pdf-unlock.html', '/hi/pdf-unlock.html', '/unlock-pdf/', '/hi/unlock-pdf/', '/pdf-password/aadhaar/', '/hi/pdf-password/aadhaar/'].includes(path)) {
      await browser.evaluate('(() => { const bytes = Uint8Array.from(atob(' + JSON.stringify(encrypted) + '), char => char.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], "encrypted.pdf", {type:"application/pdf"})); const input = document.getElementById("file"); input.files = transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); })()');
      await browser.wait('!document.getElementById("unlock-form").hidden');
      if (path.startsWith('/hi/')) {
        await browser.evaluate('document.getElementById("password").value = "incorrect"; document.getElementById("unlock-form").requestSubmit()');
        await browser.wait('!document.getElementById("unlock").disabled');
        assert.equal(await browser.evaluate('document.getElementById("status").textContent'), hindiStrings['Wrong password. Enter the PDF password again to retry.']);
        assert.equal(await browser.evaluate('document.getElementById("password").value'), '');
      }
      await browser.evaluate('document.getElementById("password").value = "user"; document.getElementById("unlock-form").requestSubmit()');
      await browser.wait('!document.getElementById("result").hidden');
      assert.equal(await browser.evaluate('document.getElementById("password").value'),'');
      const output = await browser.evaluate('(async () => { const bytes = new Uint8Array(await window.__outputBlobs.get(document.getElementById("download").href).arrayBuffer()); return Array.from(bytes); })()');
      const check = await create();
      check.FS.writeFile('/out.pdf', new Uint8Array(output));
      assert.equal(check.callMain(['--check','/out.pdf']),0);
      assert.equal(check.callMain(['--is-encrypted','/out.pdf']),2);
      console.log('Offline PDF unlock: valid unencrypted PDF, ' + output.length + ' bytes');
      if (path.startsWith('/hi/')) {
        assert.equal(await browser.evaluate('document.getElementById("status").textContent'), hindiStrings['Unlocked PDF ready. The password has been cleared.']);
        for (const id of ['before', 'after']) assert.ok((await browser.evaluate('document.getElementById(' + JSON.stringify(id) + ').textContent')).includes(hindiStrings.bytes));
        const plain = Buffer.from(tinyPdf()).toString('base64');
        await browser.evaluate('(() => { const bytes = Uint8Array.from(atob(' + JSON.stringify(plain) + '), char => char.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], "plain.pdf", {type:"application/pdf"})); const input = document.getElementById("file"); input.files = transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); })()');
        await browser.wait('document.getElementById("status").textContent === ' + JSON.stringify(hindiStrings['This PDF is not encrypted. It does not need password removal.']));
        console.log('Hindi PDF messages passed: wrong password, cleared password, success, before/after sizes and unencrypted file.');
      }

    } else if (path.includes('/exam/') && !path.endsWith('/exam/') || path === '/' || path === '/hi/') {
      const exam = addedExams.find(exam => path.includes('/' + exam.id + '/'));
      const modes = exam ? ['photo', 'signature', 'thumb', 'declaration'].filter(mode => exam[mode]) : ['photo'];
      for (const mode of modes) {
        if (exam) {
          if (mode === modes[0]) assert.equal(await browser.evaluate('document.querySelector("input[name=mode]:checked").value'), modes[0]);
          await browser.evaluate('document.querySelector("input[value=' + mode + ']").click()');
        }
        await browser.evaluate('(async () => { const canvas = document.createElement("canvas"); canvas.width=600; canvas.height=800; const context=canvas.getContext("2d"); const gradient=context.createLinearGradient(0,0,600,800); gradient.addColorStop(0,"#173c35"); gradient.addColorStop(1,"#f7f8f3"); context.fillStyle=gradient; context.fillRect(0,0,600,800); const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png")); const transfer=new DataTransfer(); transfer.items.add(new File([blob],"fixture.png",{type:"image/png"})); const input=document.getElementById("file"); input.files=transfer.files; input.dispatchEvent(new Event("change",{bubbles:true})); })()');
        await browser.wait('!document.getElementById("generate").disabled');
        await browser.evaluate('document.getElementById("generate").click()');
        await browser.wait('!document.getElementById("result").hidden');
        const output = await browser.evaluate('(async () => { const blob=window.__outputBlobs.get(document.getElementById("download").href); const image=await createImageBitmap(blob); const bytes = new Uint8Array(await blob.arrayBuffer()); return {width:image.width,height:image.height,bytes:blob.size,dpi:Array.from(bytes.slice(13,18))}; })()');
        const spec = exam?.[mode];
        if (!spec || spec.dimensions) {
          assert.equal(output.width, spec?.dimensions.width ?? 200);
          assert.equal(output.height, spec?.dimensions.height ?? 230);
        } else if (spec.target ?? spec.minDimensions) {
          assert.equal(output.width, (spec.target ?? spec.minDimensions).width);
          assert.equal(output.height, (spec.target ?? spec.minDimensions).height);
        } else assert.equal(Math.max(output.width, output.height), 600);
        assert.ok(output.bytes > 0 && output.bytes < (spec?.kbMax ?? 50) * 1024);
        if (spec?.dpi) assert.deepEqual(output.dpi, [1, 0, spec.dpi, 0, spec.dpi]);
        if (spec?.dimensionsCm && !spec.dimensions) {
          const ratio = spec.dimensionsCm.width / spec.dimensionsCm.height;
          assert.ok(Math.abs(output.width - output.height * ratio) <= 1);
          assert.equal(await browser.evaluate('document.getElementById("output-size").hidden'), false);
          assert.ok((await browser.evaluate('document.getElementById("dimensions").textContent')).includes(path.startsWith('/hi/') ? '\u0938\u0947\u092e\u0940' : 'cm'));
        }
        if (exam?.state) assert.equal(await browser.evaluate('document.getElementById("preset-note").textContent'), path.startsWith('/hi/') ? JSON.parse(await readFile('presets/hi.json', 'utf8')).examNotes[exam.id] : exam.notes);
        if (exam) assert.equal(await browser.evaluate('document.getElementById("signature-settings").hidden'), mode !== 'signature');
        console.log('Offline resize ' + path + ' ' + mode + ': ' + JSON.stringify(output));
      }
    }
    assert.ok(cacheResponses.includes(browser.origin + path));
    console.log('Offline reload passed: ' + path);
  }
  for (const config of generalTools) for (const root of ['', '/hi']) {
    const route = root + '/' + config.id + '/';
    await browser.navigate(route);
    await browser.send('Page.reload', { ignoreCache: false });
    await browser.wait('document.readyState === "complete" && !!navigator.serviceWorker.controller');
    assert.ok(cached.includes(route + 'index.html'));
    assert.equal(await browser.evaluate('document.querySelector("input[name=mode]:checked").value'), config.mode);
    assert.equal(await browser.evaluate('document.getElementById("general-max").value'), String(config.kbMax ?? ''));
    assert.equal(await browser.evaluate('document.getElementById("general-max").required'), config.kbRequired);
    for (const kb of [20, 50, 100, 200, 500]) {
      await browser.evaluate('document.querySelectorAll("[data-kb]")[' + [20,50,100,200,500].indexOf(kb) + '].click()');
      assert.equal(await browser.evaluate('document.getElementById("general-max").value'), String(kb));
    }
    await browser.evaluate('(async () => { const canvas=document.createElement("canvas"); canvas.width=600; canvas.height=800; const context=canvas.getContext("2d"); const pixels=context.createImageData(600,800); let seed=42; for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255;} context.putImageData(pixels,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png")); const transfer=new DataTransfer(); transfer.items.add(new File([blob],"general-fixture.png",{type:"image/png"}));const input=document.getElementById("file"); input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await browser.wait('!document.getElementById("generate").disabled');
    if (config.id === 'crop-photo') {
      await browser.evaluate('document.getElementById("general-max").value="";document.getElementById("general-max").dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("aspect-ratio").value="1";document.getElementById("aspect-ratio").dispatchEvent(new Event("change"));document.getElementById("rotate").click()');
      await new Promise(resolve => setTimeout(resolve, 150));
    } else await browser.evaluate('document.querySelectorAll("[data-kb]")[1].click()');
    if (!config.crop) assert.equal(await browser.evaluate('!!document.querySelector(".cropper-container")'), false);
    await browser.evaluate('document.getElementById("generate").click()');
    await browser.wait('!document.getElementById("result").hidden');
    const output = await browser.evaluate('(async()=>{const blob=window.__outputBlobs.get(document.getElementById("download").href);const image=await createImageBitmap(blob);return {type:blob.type,bytes:blob.size,width:image.width,height:image.height,magic:Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,2))};})()');
    assert.equal(output.type, 'image/jpeg');
    assert.deepEqual(output.magic, [255,216]);
    assert.ok(output.bytes > 0);
    if (config.id === 'crop-photo') { assert.equal(output.width, output.height); assert.ok(output.bytes > 50 * 1024); }
    else assert.ok(output.bytes < 50 * 1024);
    if (!config.crop) { assert.equal(output.width,600); assert.equal(output.height,800); }
    assert.ok((await browser.evaluate('document.getElementById("result-info").textContent')).includes(root ? hindiStrings.Before : 'Before'));
    await browser.evaluate('document.querySelectorAll("[data-kb]")[2].click()');
    assert.equal(await browser.evaluate('document.getElementById("result").hidden'), true);
    console.log('Offline general export ' + route + ': ' + JSON.stringify(output));
  }
  await mkdir('research/screens', { recursive: true });
  for (const width of [1280, 390]) for (const route of ['/crop-photo/', '/compress-photo/', '/', '/unlock-pdf/', '/pdf-password/aadhaar/']) {
    await browser.send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width===390});
    await browser.navigate(route);
    await browser.wait('!!document.querySelector(".workspace")');
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth > window.innerWidth'), false);
    const layout = await browser.send('Page.getLayoutMetrics');
    const shot = await browser.send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip:{x:0,y:0,width,height:Math.ceil(layout.cssContentSize.height),scale:1} });
    await writeFile('research/screens/' + (route.startsWith('/pdf-password/') ? 'pdf-password-aadhaar' : route === '/unlock-pdf/' ? 'unlock-pdf' : 'general-' + (route === '/' ? 'home' : route.split('/')[1])) + '-' + width + '.png', Buffer.from(shot.data,'base64'));
  }
  checkingMissingPage = true;
  for (const route of ['/exam/cat/', '/hi/exam/cat/']) {
    await browser.navigate(route);
    assert.equal(await browser.evaluate('document.querySelector("h1").textContent'), route.startsWith('/hi/') ? hindiStrings['Page not found'] : 'Page not found');
    assert.equal(await browser.evaluate('document.querySelector("meta[name=robots]").content'), 'noindex');
  }
  assert.equal(await browser.evaluate('(async () => {const cache=await caches.open((await caches.keys()).find(name=>name.startsWith("noupload-")));return !!(await cache.match("/exam/cat/index.html"));})()'), false);
  console.log('Unverified pages use the offline 404 fallback and are never runtime cached.');
  await browser.navigate('/missing-page');
  assert.equal(missingResponses.at(-1).status, 404);
  assert.equal(missingResponses.at(-1).fromServiceWorker, true);
  assert.equal(await browser.evaluate('document.querySelector("h1").textContent'), 'Page not found');
  assert.equal(await browser.evaluate('document.querySelector("meta[name=robots]").content'), 'noindex');
  console.log('Offline missing navigation: styled noindex 404 served from precache.');
  await browser.navigate('/hi/missing-page');
  assert.equal(await browser.evaluate('document.querySelector("h1").textContent'), hindiStrings['Page not found']);
  assert.equal(await browser.evaluate('document.documentElement.lang'), 'hi');
  assert.deepEqual(external,[]);
  assert.deepEqual(errors,[]);
  console.log('Built CSP audit: ' + htmlPages.size + ' HTML pages. Manifest valid. All ' + cached.length + ' precached files verified. No external requests or browser/CSP errors.');
} finally { await browser.close(); }
