import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { localChrome } from './chrome-local.mjs';

const directory = 'research/screens';
await mkdir(directory, { recursive: true });
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(directory + '/' + entry.name) : [directory + '/' + entry.name]))).flat();
const paths = (await walk('dist')).filter(path => path.endsWith('.html')).map(path => '/' + path.slice(5));
const captures = new Map([['/index.html', 'home-en'], ['/hi/index.html', 'home-hi'], ['/pdf-unlock.html', 'pdf-unlock'], ['/exam/ibps-po/index.html', 'exam-ibps-po'], ['/exam/index.html', 'exam-hub']]);
const browser = await localChrome('dist');
const report = [];
try {
  for (const width of [1280, 390]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    for (const path of paths) {
      await browser.navigate(path);
      await browser.evaluate('document.fonts.ready');
      const metrics = await browser.evaluate(`(() => {
        const nav = document.querySelector('.primary-nav');
        const switcher = document.querySelector('.language-switch');
        const file = document.getElementById('file');
        const style = getComputedStyle(document.body);
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          clientWidth: document.documentElement.clientWidth,
          bodySize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight),
          separateLanguage: !nav.contains(switcher) && !!switcher.querySelector('[data-language-switch]'),
          currentLinks: nav.querySelectorAll('[aria-current="page"]').length,
          navTargets: [...nav.querySelectorAll('a')].every(a => a.getBoundingClientRect().height >= 44 && parseFloat(getComputedStyle(a).fontSize) >= 16),
          smallText: [...document.querySelectorAll('small,.hint,.verification,footer,.preset p,.specs dt,.specs dd,label')].filter(el => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.outerHTML),
          accessibleFile: !file || (file.getBoundingClientRect().width === 1 && !!document.querySelector('label.file-picker[for="file"]')),
          actionBelowSpecs: !document.getElementById('generate') || document.getElementById('generate').getBoundingClientRect().top >= document.querySelector('.result-panel .specs').getBoundingClientRect().bottom,
          inlineStyles: document.querySelectorAll('[style]').length
        };
      })()`);
      assert.ok(metrics.pageWidth <= metrics.clientWidth, path + ': horizontal page overflow at ' + width);
      assert.equal(metrics.bodySize, 17);
      assert.equal(metrics.lineHeight, 27.2);
      assert.equal(metrics.separateLanguage, true);
      assert.equal(metrics.currentLinks, path.endsWith('/404.html') ? 0 : 1);
      assert.equal(metrics.navTargets, true);
      assert.deepEqual(metrics.smallText, []);
      assert.equal(metrics.accessibleFile, true);
      assert.equal(metrics.inlineStyles, 0);
      assert.equal(metrics.actionBelowSpecs, true, path + ': action overlaps specifications');
      report.push({ path, width, ...metrics });
      if (captures.has(path)) {
        const { cssContentSize } = await browser.send('Page.getLayoutMetrics');
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(cssContentSize.height), scale: 1 } });
        const file = directory + '/' + captures.get(path) + '-' + width + '.png';
        await writeFile(file, Buffer.from(shot.data, 'base64'));
        console.log(file);
      }
    }
  }
  await writeFile(directory + '/layout-audit.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Layout audit passed for all ' + report.length + ' page/viewport combinations.');
} finally { await browser.close(); }

