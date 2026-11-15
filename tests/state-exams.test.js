import { generalPages } from '../scripts/general-pages.mjs';
import { pdfPages } from '../scripts/pdf-pages.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { outputDimensions } from '../src/exam-spec';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exams = JSON.parse(read('presets/exams.json'));
const hi = JSON.parse(read('presets/hi.json'));
const pages = new Map([...generatePages(exams, read('index.html'), hi), ...toolPages(Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)])), hi)]);
for (const [path, html] of generalPages(read('index.html'), hi)) pages.set(path, html);
for (const [path, html] of pdfPages(read('pdf-unlock.html'), hi)) pages.set(path, html);

const expected = {
  'bihar-police': [[null, null, 15, 25, 'JPG/JPEG/GIF', null], [null, null, 15, 25, 'JPG/JPEG/GIF', null]],
  'uppsc-pcs': [[null, [5, 6], null, 50, null, 200], [null, [6, 3], null, 30, null, 200]],
  'tnpsc-group-4': [[[130, 170], [3.5, 4.5], 20, 50, 'JPG', 200], [[230, 75], [6, 2], 10, 20, 'JPG', null]],
  'tn-tet': [[null, null, 40, 60, 'JPG/JPEG/PNG', null], [null, null, 20, 40, 'JPG/JPEG/PNG', null]],
  'wb-police': [[[138, 177], [3.5, 4.5], 10, 50, 'JPG', null], [[350, 63], [9.2, 1.7], 5, 20, 'JPG', null]],
  'gujarat-police': [[null, null, null, 15, 'JPG', null], [null, null, null, 15, 'JPG', null]],
  'gujarat-tet-1': [[null, [3.6, 5], null, 10, 'JPG', null], [null, [7.5, 2.5], null, 10, 'JPG', null]]
};

it('preserves the original fourteen presets apart from reviewed notes and exam dates', () => {
  expect(createHash('sha256').update(JSON.stringify(exams.slice(0, 14).map(({ notes, examDates, ...exam }) => exam))).digest('hex')).toBe('c1ed9c869c4e952923d18908d3be462f9b534d4b552f5ac74c1abf0a95d8004b');
});

for (const [id, uploads] of Object.entries(expected)) it(id + ' uses only supplied requirements and declared languages', () => {
  const exam = exams.find(exam => exam.id === id);
  expect(exam.verified).toBe(true);
  expect(exam.verifiedOn).toBe(id === 'gujarat-tet-1' ? '2026-10-25' : '2026-10-15');
  expect(exam.sourceUrl).toMatch(/^https:\/\//);
  expect(exam.notes).toContain('Notification:');
  expect(exam.state).toBeTruthy();
  expect(['photo', 'signature'].map(mode => {
    const spec = exam[mode];
    expect(spec.minDimensions).toBeUndefined();
    expect(spec.maxDimensions).toBeUndefined();
    expect(spec.preferred).toBeUndefined();
    return [spec.dimensions ? Object.values(spec.dimensions) : null, spec.dimensionsCm ? Object.values(spec.dimensionsCm) : null, spec.kbMin, spec.kbMax, spec.format, spec.dpi];
  })).toEqual(uploads);
  const bilingual = ['bihar-police', 'uppsc-pcs'].includes(id);
  expect(exam.languages).toEqual(bilingual ? ['en', 'hi'] : ['en']);
  expect(pages.has('/hi/exam/' + id + '/index.html')).toBe(bilingual);
  expect(pages.get('/hi/exam/index.html').includes('./' + id + '/')).toBe(bilingual);
  if (bilingual) {
    expect(hi.examNotes[id]).toMatch(/[\u0900-\u097f]/);
    expect(hi.examNotes[id]).not.toContain('?');
  }
  for (const mode of ['photo', 'signature']) if (!exam[mode].dimensions) {
    expect(outputDimensions(exam[mode], { width: 800, height: 400 }, 1000)).toEqual({ width: 1000, height: 500 });
    expect(pages.get('/exam/' + id + '/index.html')).not.toContain('id="output-size" hidden');
  }
});

it('keeps Gujarat TET-I verified against the corrected official PDF and its dated evidence', () => {
  const exam = exams.find(exam => exam.id === 'gujarat-tet-1');
  const research = JSON.parse(read('research/gujarat-tet-2026-10.json'));
  const unverified = JSON.parse(read('presets/unverified-exams.json'));
  expect(unverified.some(exam => exam.id === 'gujarat-tet-1')).toBe(false);
  expect(research.outcome).toBe('official-copy-found');
  expect(exam.sourceUrl).toBe(research.sourceUrl);
  expect(new URL(exam.sourceUrl).hostname).toBe('sebexam.org');
  expect(decodeURIComponent(new URL(exam.sourceUrl).pathname)).toBe('/AdvertiseFiles/2025/શિક્ષક યોગ્યતા કસોટી-i (tet-i)-2025 જાહેરનામું_102025.pdf');
  expect(exam.verifiedOn).toBe(research.checkedOn);
  expect(research.urlsChecked.find(source => source.url === exam.sourceUrl).httpStatus).toBe(200);
  expect(research.dates.effectiveApplicationWindow).toEqual({ opens: '2025-10-28', closes: '2025-11-18' });
  expect(exam.notes).toContain('JPG, no larger than 10 KB each');
  expect(exam.notes).toContain('28 October-18 November 2025');
  expect(exam.notes).toContain('20 November 2025');
  expect(hi.examNotes[exam.id]).toContain('10 KB');
  expect(hi.examNotes[exam.id]).toContain('18 नवंबर 2025');
  expect(hi.examNotes[exam.id]).not.toContain('?');
  expect(pages.get('/exam/' + exam.id + '/index.html')).toContain(exam.sourceUrl);
});

it('resolves every internal navigation and alternate, including English-only pages', () => {
  for (const [path, html] of pages) for (const match of html.matchAll(/<(?:a|link)\b[^>]*href="([^"]+)"/g)) {
    if (match[1].startsWith('#')) continue;
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://nouploads.in' + path);
    if (url.origin !== 'https://nouploads.in' || /\.[a-z]+$/.test(url.pathname) && !url.pathname.endsWith('.html')) continue;
    const target = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname.endsWith('/pdf-unlock') ? url.pathname + '.html' : url.pathname;
    expect(pages.has(target), path + ' -> ' + target).toBe(true);
  }
  const sitemap = discoveryFiles(pages).sitemap;
  for (const exam of exams.filter(exam => exam.languages?.length === 1)) expect(sitemap).not.toContain('/hi/exam/' + exam.id + '/');
});

it('groups state cards and displays cm specifications without inferred pixels', () => {
  const hub = pages.get('/exam/index.html');
  expect(hub).toContain('<h2>National exams</h2>');
  expect(hub).toContain('<h2>State exams</h2>');
  for (const exam of exams.filter(exam => exam.state)) expect(hub).toContain('<p>' + exam.state + '</p>');
  for (const id of ['uppsc-pcs', 'gujarat-tet-1']) {
    const html = pages.get('/exam/' + id + '/index.html');
    for (const mode of ['photo', 'signature']) {
      const cm = exams.find(exam => exam.id === id)[mode].dimensionsCm;
      expect(html).toContain(cm.width + 'x' + cm.height + ' cm');
    }
    expect(html).toContain('No pixel size is stated');
  }
});
