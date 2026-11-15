import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';
import { auditSeo } from '../scripts/audit-seo.mjs';
import { auditLanguages } from '../scripts/audit-languages.mjs';
import { escape } from '../scripts/seo.mjs';
import { customSpec } from '../src/exam-spec';
import { fitJpeg } from '../src/compress';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const verified = JSON.parse(read('presets/exams.json'));
const exams = JSON.parse(read('presets/unverified-exams.json'));
const hi = JSON.parse(read('presets/hi.json'));
const baseline = generatePages(verified, read('index.html'), hi);
const pages = generatePages(verified, read('index.html'), hi, undefined, exams);

it('publishes promoted and newly covered exams as verified in both languages', () => {
  for (const id of ['rrb-ntpc', 'sbi-so', 'csir-net', 'nift', 'nda-na', 'cds', 'upsc-capf', 'upsc-ese']) {
    expect(exams.some(exam => exam.id === id)).toBe(false);
    expect(verified.filter(exam => exam.id === id && exam.verified)).toHaveLength(1);
    for (const prefix of ['', '/hi']) {
      const html = pages.get(prefix + '/exam/' + id + '/index.html');
      expect(html).toContain('class="spec-table"');
      expect(html).not.toContain('class="unverified-badge"');
      expect(html).not.toContain('data-custom-limits="true"');
      expect(pages.get(prefix + '/exam/index.html')).toContain('href="./' + id + '/"');
    }
  }
});

it('audits all routes, metadata, CSP hashes and symmetric languages', () => {
  auditSeo(pages);
  auditLanguages(pages, [...verified, ...exams].flatMap(exam => [escape(exam.name), escape(exam.body ?? '')]));
  for (const exam of verified) for (const lang of exam.languages ?? ['en', 'hi']) {
    const route = (lang === 'hi' ? '/hi' : '') + '/exam/' + exam.id + '/index.html';
    expect(pages.get(route)).toBe(baseline.get(route));
  }
});

it('uses only structured identity fields and excludes verified, empty and duplicate entries', () => {
  expect(new Set(exams.map(exam => exam.id)).size).toBe(exams.length);
  expect(new Set(exams.map(exam => exam.state + exam.name.toLowerCase())).size).toBe(exams.length);
  const belt = ['National', 'Uttar Pradesh', 'Bihar', 'Rajasthan', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Uttarakhand', 'Haryana', 'Delhi', 'Himachal Pradesh'];
  for (const exam of exams) {
    expect(Object.keys(exam).sort()).toEqual(['id', 'name', 'state', 'body', 'officialSiteUrl', 'languages'].sort());
    expect(exam.officialSiteUrl).toMatch(/^https:\/\//);
    expect(verified.some(value => value.id === exam.id || value.name.toLowerCase() === exam.name.toLowerCase())).toBe(false);
    expect(exam.languages).toEqual(belt.includes(exam.state) ? ['en', 'hi'] : ['en']);
  }
});

it('lists and discovers every unverified page without publishing numeric upload requirements', () => {
  const sitemap = discoveryFiles(pages).sitemap;
  for (const exam of exams) for (const lang of exam.languages) {
    const root = lang === 'hi' ? '/hi' : '';
    const route = root + '/exam/' + exam.id + '/';
    const html = pages.get(route + 'index.html');
    expect(html).toContain('class="unverified-badge"');
    expect(html).toContain(lang === 'hi' ? 'असत्यापित' : 'Unverified');
    expect(html).toContain('href="' + escape(exam.officialSiteUrl) + '" target="_blank" rel="noopener noreferrer external"');
    expect(html).toContain('data-custom-limits="true"');
    const visible = html.replace(/<head>[\s\S]*?<\/head>/, '').replace(/<[^>]*>/g, ' ');
    expect(visible).not.toMatch(/\d+(?:[.,]\d+)?\s*(?:KB|px)/);
    expect(html).not.toContain('class="spec-table"');
    expect(html).toContain('id="custom-max" type="number" step="any" min="0" autocomplete="off" required');
    expect(sitemap).toContain('https://nouploads.in' + route);
    expect(pages.get(root + '/exam/index.html')).toContain('href="' + route + '"');
    if (!exam.languages.includes('hi')) expect(pages.has('/hi/exam/' + exam.id + '/index.html')).toBe(false);
  }
});

const values = { min: '10', max: '50', width: '', height: '', unit: 'px', dpi: '' };
it('validates custom limits, dimensions, cm conversions and empty required fields', () => {
  expect(customSpec(values).dimensions).toBeNull();
  expect(customSpec({ ...values, max: '10' }).kbMax).toBe(10);
  expect(customSpec({ ...values, width: '2.54', height: '5.08', unit: 'cm', dpi: '100' }).dimensions).toEqual({ width: 100, height: 200 });
  for (const change of [{ min: '' }, { max: '' }, { max: '9' }, { min: '-1' }, { max: 'Infinity' }, { max: '25601' }, { width: '3' }, { width: '2', height: '0' }, { width: '4097', height: '1' }, { width: '1.5', height: '1' }, { width: '1', height: '1', unit: 'cm', dpi: '' }]) expect(() => customSpec({ ...values, ...change })).toThrow();
});

it('uses the shared compressor for custom limits and warns on an unattainable equal range', async () => {
  const spec = customSpec({ ...values, max: '10' });
  const result = await fitJpeg(async () => new Blob([new Uint8Array(1000)], { type: 'image/jpeg' }), spec.kbMin * 1024, spec.kbMax * 1024);
  expect(result.belowMinimum).toBe(true);
});
