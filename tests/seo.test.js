import { generalPages } from '../scripts/general-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';
import { auditSeo } from '../scripts/audit-seo.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const presets = JSON.parse(read('presets/exams.json'));
const pages = generatePages(presets, read('index.html'), JSON.parse(read('presets/hi.json')));
for (const [path, html] of toolPages(Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)])), JSON.parse(read('presets/hi.json')))) pages.set(path, html);

for (const [path, html] of generalPages(read('index.html'), JSON.parse(read('presets/hi.json')))) pages.set(path, html);

it('audits metadata, headings, language, structured data, CSP and symmetric alternates on every page', () => {
  auditSeo(pages);
});

it('includes dated bilingual sitemap pairs and all indexable pages, excluding the 404', () => {
  const generated = pages;
  const indexablePages = [...generated].filter(([path]) => !path.endsWith('/404.html'));
  const alternateCount = indexablePages.reduce((count, [, html]) => count + [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].length, 0);
  const { sitemap } = discoveryFiles(generated, 'https://nouploads.in', '2026-10-16');
  expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  expect([...sitemap.matchAll(/<url>/g)]).toHaveLength(indexablePages.length);
  expect([...sitemap.matchAll(/<lastmod>/g)]).toHaveLength(indexablePages.length);
  expect([...sitemap.matchAll(/<xhtml:link/g)]).toHaveLength(alternateCount);
  expect(sitemap).not.toContain('404.html');
  for (const block of sitemap.matchAll(/<url>(.*?)<\/url>/g)) {
    const exam = presets.find(value => block[1].includes('/exam/' + value.id + '/'));
    expect(block[1]).toContain('<lastmod>' + (exam?.verifiedOn ?? '2026-10-16') + '</lastmod>');
    for (const alternate of block[1].matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
      expect(sitemap).toContain('<loc>' + alternate[2] + '</loc>');
      const alternatePath = new URL(alternate[2]).pathname;
      const target = pages.get(alternatePath.endsWith('.html') ? alternatePath : alternatePath.endsWith('/pdf-unlock') ? alternatePath + '.html' : alternatePath + 'index.html');
      expect(target).toContain('hreflang="' + alternate[1] + '" href="' + alternate[2] + '"');
    }
  }
});

it('links tools, hubs and all sibling exams in static HTML and keeps the 404 noindex', () => {
  for (const path of ['/index.html', '/pdf-unlock.html', '/404.html']) {
    expect(pages.get(path)).toContain('href="/exam/"');
    expect(pages.get(path)).toContain('href="/pdf-unlock"');
  }
  for (const lang of ['', '/hi']) for (const exam of presets.filter(exam => !lang || (exam.languages ?? ['en', 'hi']).includes('hi'))) {
    const html = pages.get(lang + '/exam/' + exam.id + '/index.html');
    for (const sibling of presets.filter(value => value.id !== exam.id && (!lang || (value.languages ?? ['en', 'hi']).includes('hi')))) expect(html).toContain('href="' + lang + '/exam/' + sibling.id + '/"');
  }
  expect(read('404.html')).toContain('name="robots" content="noindex"');
  expect(read('vite.config.ts')).toContain("'404.html'");
});
