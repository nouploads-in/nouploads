import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { infoPages, info } from '../scripts/info-pages.mjs';
import { infoLinks } from '../scripts/page-shell.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { auditSeo } from '../scripts/audit-seo.mjs';
import { auditCopy } from '../scripts/audit-copy.mjs';
import { auditLanguages } from '../scripts/audit-languages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hi = JSON.parse(read('presets/hi.json'));
const pages = infoPages(read('index.html'), hi);

it('generates privacy and about pages in both languages that pass the metadata, copy and language audits', () => {
  expect([...pages.keys()].sort()).toEqual(['/about/index.html', '/hi/about/index.html', '/hi/privacy/index.html', '/privacy/index.html']);
  auditSeo(pages);
  auditCopy(pages);
  auditLanguages(pages, []);
});

it('keeps info pages free of tool runtimes and wasm permissions', () => {
  for (const [path, html] of pages) {
    expect(html, path).not.toContain('/src/main.ts');
    expect(html, path).not.toContain('/src/pdf-main.ts');
    expect(html, path).not.toContain('data-tool=');
    expect(html, path).not.toContain('wasm-unsafe-eval');
    expect(html, path).toContain('src="/src/pwa.ts"');
    expect(html, path).toContain('href="mailto:contact@nouploads.in"');
    expect(html, path).not.toMatch(/\{(?:repo|email)\}/);
  }
});

it('links both info pages from every footer in the page language without duplicating on regeneration', () => {
  expect(infoLinks('en')).toBe('<a data-info-link href="/privacy/">Privacy policy</a><a data-info-link href="/about/">About</a>');
  expect(infoLinks('hi')).toContain('href="/hi/privacy/">' + info.labels.hi.privacy + '<');
  const templates = Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)]));
  const once = toolPages(templates, hi);
  const twice = toolPages(Object.fromEntries(Object.keys(templates).map(path => [path, once.get(path)])), hi);
  for (const [path, html] of [...pages, ...once, ...twice]) {
    expect(html.match(/data-info-link/g), path).toHaveLength(info.pages.length);
    expect(html, path).toContain(infoLinks(path.startsWith('/hi/') ? 'hi' : 'en'));
  }
});
