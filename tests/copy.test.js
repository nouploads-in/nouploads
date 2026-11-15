import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generatePages } from '../scripts/exam-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { generalPages } from '../scripts/general-pages.mjs';
import { pdfPages } from '../scripts/pdf-pages.mjs';
import { auditCopy } from '../scripts/audit-copy.mjs';
import { REPO_URL, repositoryLink } from '../scripts/page-shell.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hi = JSON.parse(read('presets/hi.json'));
const exams = JSON.parse(read('presets/exams.json'));
const pages = new Map([
  ...generatePages(exams, read('index.html'), hi, undefined, JSON.parse(read('presets/unverified-exams.json'))),
  ...toolPages(Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)])), hi),
  ...generalPages(read('index.html'), hi),
  ...pdfPages(read('pdf-unlock.html'), hi)
]);

it('rejects internal copy, broken separators and Hindi glossary or KB-title drift on every generated page', () => {
  auditCopy(pages);
  for (const exam of exams.filter(exam => (exam.languages ?? ['en', 'hi']).includes('hi'))) {
    for (const root of ['', '/hi']) expect(pages.get(root + '/exam/' + exam.id + '/index.html').match(/<title>([^<]+)<\/title>/)[1]).toContain('KB');
  }
});

it('detects each prohibited regression', () => {
  for (const bad of ['supplied research', 'URL pending', 'repo-url-pending', 'nouploads ? Local tools']) {
    expect(() => auditCopy(new Map([['/index.html', '<title>Tool</title><p>' + bad + '</p>']]))).toThrow();
  }
  expect(() => auditCopy(new Map([['/hi/index.html', '<title>मुफ्त</title>']]))).toThrow();
  expect(() => auditCopy(new Map([['/index.html', '<title>Tool KB</title>'], ['/hi/index.html', '<title>टूल</title>']]))).toThrow();
});

it('renders the public source link on every page with translated footer labels', () => {
  expect(repositoryLink('en', hi, null)).toBe('');
  expect(repositoryLink('hi', hi, null)).toBe('');
  expect(repositoryLink('en', hi, 'https://example.test/repo')).toContain('href="https://example.test/repo"');
  expect(REPO_URL).toBe('https://github.com/nouploads-in/nouploads');
  expect(hi.translations['Source code']).toBe('सोर्स कोड');
  for (const [path, html] of pages) {
    expect(html).toContain(repositoryLink(path.startsWith('/hi/') ? 'hi' : 'en', hi));
  }
});
