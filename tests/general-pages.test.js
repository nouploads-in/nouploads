import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generalPages, generalTools } from '../scripts/general-pages.mjs';
import { generalSpec } from '../src/general';
import { auditSeo } from '../scripts/audit-seo.mjs';
import { auditLanguages } from '../scripts/audit-languages.mjs';
import { discoveryFiles } from '../scripts/exam-pages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hi = JSON.parse(read('presets/hi.json'));
const pages = generalPages(read('index.html'), hi);

it('audits ten substantial bilingual pages with symmetric SEO and language links', () => {
  expect(pages.size).toBe(10);
  auditSeo(pages);
  auditLanguages(pages, []);
  for (const [path, html] of pages) {
    const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(data.map(item => item['@type'])).toEqual(['FAQPage', 'WebApplication', 'BreadcrumbList']);
    expect(data[0].mainEntity).toHaveLength(5);
    expect(html.match(/<li>/g).length).toBeGreaterThanOrEqual(3);
    expect(discoveryFiles(pages).sitemap).toContain('https://nouploads.in' + path.replace('index.html', ''));
    const root = path.startsWith('/hi/') ? '/hi' : '';
    for (const href of ['/', '/exam/', '/pdf-unlock', ...generalTools.map(tool => '/' + tool.id + '/')]) expect(html).toContain('href="' + root + href + '"');
  }
});

it('publishes distinct mode defaults and controls without exam requirements', () => {
  const policy = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replaceAll('&#39;', "'").replace(/ 'sha256-[^']+'/g, '');
  for (const config of generalTools) for (const root of ['', '/hi']) {
    const html = pages.get(root + '/' + config.id + '/index.html');
    expect(policy(html)).toBe(policy(read('index.html')));
    expect(html).toContain('data-general="' + config.id + '"');
    expect(html).not.toContain('data-exam=');
    expect(html).toContain('id="general-max" type="number" min="1" max="25600" step="any" value="' + (config.kbMax ?? '') + '" autocomplete="off"' + (config.kbRequired ? ' required' : '') + '>');
    expect(html.includes('id="general-width"')).toBe(config.pixels);
    expect(html.includes('class="crop-controls" hidden')).toBe(!config.crop);
    for (const kb of [20, 50, 100, 200, 500]) expect(html).toContain('data-kb="' + kb + '"');
    for (const ratio of ['1:1', '4:5', '3:4', '4:3', '16:9', '35:45']) expect(html).toContain(ratio);
  }
});

it('allows crop-only full quality while requiring a valid compression ceiling', () => {
  expect(generalSpec('', false)).toMatchObject({ kbMax: null, kbMin: null, dimensions: null });
  for (const max of ['', '0', '-1', 'Infinity', 'NaN', '25601']) expect(() => generalSpec(max, true)).toThrow();
  expect(generalSpec('50', true, '640', '480')).toMatchObject({ kbMax: 50, dimensions: { width: 640, height: 480 } });
  for (const pair of [['100', ''], ['', '100'], ['1.5', '100'], ['4097', '100']]) expect(() => generalSpec('50', true, ...pair)).toThrow();
});
