import { generalPages } from '../scripts/general-pages.mjs';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generatePages } from '../scripts/exam-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { auditLanguages } from '../scripts/audit-languages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hi = JSON.parse(read('presets/hi.json'));
const exams = JSON.parse(read('presets/exams.json'));
const tools = toolPages(Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)])), hi);
const pages = new Map([...generatePages(exams, read('index.html'), hi), ...tools]);

for (const [path, html] of generalPages(read('index.html'), hi)) pages.set(path, html);

it('pairs every page, resolves equivalent switchers and rejects English UI on Hindi pages', () => {
  auditLanguages(pages, exams.map(exam => exam.name));
});

it('preserves banking advertisement codes in Hindi notes', () => {
  expect(hi.examNotes['nabard-grade-a']).toContain('विज्ञापन 05/Grade A/2025-26');
  expect(hi.examNotes['idbi-jam']).toContain('विज्ञापन 7/2025-26');
});

it.each([
  ['nabard-grade-a', 'Advertisement 05/Grade A/2025-26'],
  ['idbi-jam', 'Advertisement 7/2025-26'],
  ['niacl-assistant', 'Assistant Recruitment Exercise 2024 (application crosses into 2025)']
])('rejects untranslated recruitment prose in %s Hindi notes', (id, prose) => {
  const path = '/hi/exam/' + id + '/index.html';
  const untranslated = new Map(pages);
  untranslated.set(path, pages.get(path).replace('id="preset-note">', 'id="preset-note">' + prose + ' '));
  expect(() => auditLanguages(untranslated, exams.map(exam => exam.name))).toThrow(path + ': untranslated visible text');
});

it('keeps every runtime translation in the reviewable Hindi table', () => {
  for (const path of ['main', 'pdf-main', 'exam-spec', 'compress', 'signature', 'pwa', 'shell', 'general']) {
    const source = read('src/' + path + '.ts');
    for (const match of source.matchAll(/tr\('([^']+)'\)/g)) {
      expect(hi.translations, path + ': ' + match[1]).toHaveProperty(match[1]);
      expect(hi.translations[match[1]]).toMatch(/[\u0900-\u097f]/);
    }
  }
});

it('preserves tool CSP directives, changing only structured data hashes', () => {
  const policy = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/'sha256-[^']+'/g, '');
  for (const path of ['/index.html', '/pdf-unlock.html', '/404.html']) expect(policy(tools.get('/hi' + path))).toBe(policy(tools.get(path)));
});

it('separates the language control and marks exactly one primary destination on every applicable page', () => {
  for (const [path, html] of pages) {
    const header = html.match(/<header>([\s\S]*?)<\/header>/)[1];
    const navs = [...header.matchAll(/<nav class="primary-nav"[^>]*>([\s\S]*?)<\/nav>/g)];
    expect(navs, path).toHaveLength(1);
    const nav = navs[0][1];
    expect(nav, path).not.toContain('data-language-switch');
    expect(nav.match(/<a\b/g), path).toHaveLength(3);
    const root = path.startsWith('/hi/') ? '/hi' : '';
    const route = path.slice(root.length).replace(/index.html$/, '');
    const current = [...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    expect(current, path).toHaveLength(route === '/404.html' ? 0 : 1);
    if (current.length) expect(current[0][0], path).toContain('href="' + root + (route.startsWith('/exam/') ? '/exam/' : html.includes('data-general=') ? '/' : route.replace('/pdf-unlock.html', '/pdf-unlock')) + '"');
    const control = header.match(/<div class="language-switch"[^>]*>([\s\S]*?)<\/div>/);
    expect(control, path).not.toBeNull();
    expect(header.replace(navs[0][0], ''), path).toContain(control[0]);
    const bilingual = !exams.some(exam => path === '/exam/' + exam.id + '/index.html' && exam.languages?.length === 1);
    expect(control[1].match(/data-language-switch/g) ?? [], path).toHaveLength(bilingual ? 1 : 0);
    if (bilingual) expect(control[1], path).toContain('>EN<');
    if (bilingual) expect(control[1], path).toContain('>हिंदी<');
    expect(control[1], path).toContain('class="selected" lang="' + (root ? 'hi' : 'en') + '"');
  }
});
