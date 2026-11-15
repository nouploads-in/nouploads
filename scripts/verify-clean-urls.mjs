import assert from 'node:assert/strict';
import { localChrome } from './chrome-local.mjs';

const browser = await localChrome('dist', { cleanUrls: true });
const errors = [];
browser.on('Log.entryAdded', event => { if (event.entry.level === 'error') errors.push(event.entry.text); });
try {
  await browser.send('Log.enable');
  await browser.send('Page.navigate', { url: browser.origin + '/' });
  await browser.wait('document.readyState === "complete" && !!navigator.serviceWorker.controller');
  const paths = ['/exam/ibps-po/', '/hi/exam/ibps-po/', '/pdf-unlock', '/hi/pdf-unlock', '/photo-resizer/', '/hi/', '/pdf-password/aadhaar/', '/exam/'];
  for (const path of paths) {
    await browser.send('Page.navigate', { url: browser.origin + path });
    await browser.wait('location.pathname === ' + JSON.stringify(path) + ' && document.readyState === "complete"');
    assert.ok(await browser.evaluate('!!document.querySelector("h1")'), path);
    assert.ok(await browser.evaluate('location.protocol !== "chrome-error:"'), path);
    assert.ok(await browser.evaluate('!!navigator.serviceWorker.controller'), path);
  }
  assert.deepEqual(errors.filter(text => !/404/.test(text)), []);
  console.log('Clean-URL host: every page navigates under the active service worker (' + paths.length + ' routes).');
} finally { await browser.close(); }
