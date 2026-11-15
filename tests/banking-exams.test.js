import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';
import { escape } from '../scripts/seo.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exams = JSON.parse(read('presets/exams.json'));
const hi = JSON.parse(read('presets/hi.json'));
const research = JSON.parse(read('research/round5-banking-pdf.json'));
const pages = generatePages(exams, read('index.html'), hi);
const ids = ['ibps-rrb-officer-scale-i', 'ibps-rrb-office-assistant', 'rbi-assistant', 'rbi-office-attendant', 'nabard-grade-a', 'sebi-grade-a', 'niacl-ao', 'niacl-assistant', 'idbi-jam', 'sbi-apprentice'];
const skipped = ['rbi-assistant', 'rbi-office-attendant'];
const spec = (width, height, kbMin, kbMax, dpi = null) => ({ dimensions: width ? { width, height } : null, kbMin, kbMax, format: 'image/jpeg', dpi, ...(width ? { preferred: true } : {}) });

for (const id of ids.filter(id => !skipped.includes(id))) {
  it(id + ' preserves verified upload limits and generates bilingual pages', () => {
    const exam = exams.find(exam => exam.id === id);
    const source = research.exams.find(exam => exam.id === id);
    const assistant = id === 'niacl-assistant';
    expect(exam.verified).toBe(true);
    expect(exam.verifiedOn).toBe('2026-10-25');
    expect(exam.sourceUrl).toBe(source.sourceUrl);
    expect(exam.photo).toEqual(spec(200, 230, 20, 50));
    expect(exam.signature).toEqual(spec(140, 60, 10, 20));
    expect(exam.thumb).toEqual(assistant ? spec(null, null, 10, 20) : spec(240, 240, 20, 50, 200));
    expect(exam.declaration).toEqual(assistant ? spec(null, null, 20, 50) : spec(800, 400, 50, 100, 200));
    expect(hi.examNotes[id]).toMatch(/[\u0900-\u097f]/);
    expect(hi.examNotes[id]).not.toContain('?');
    for (const prefix of ['', '/hi']) {
      const route = prefix + '/exam/' + id + '/';
      const html = pages.get(route + 'index.html');
      expect([...html.matchAll(/name="mode" value="([^"]+)"/g)].map(match => match[1])).toEqual(['photo', 'signature', 'thumb', 'declaration']);
      expect(html).toContain(escape(prefix ? hi.examNotes[id] : exam.notes));
      expect(pages.get(prefix + '/exam/index.html')).toContain('./' + id + '/');
      expect(discoveryFiles(pages).sitemap).toContain('https://nouploads.in' + route);
    }
    if (assistant) {
      expect(exam.notes).toContain('No separate pixel dimensions');
    } else {
      expect(exam.notes).toContain('separate live photo');
    }
  });
}

it('does not publish RBI entries whose official sources could not be checked', () => {
  for (const id of skipped) {
    expect(exams.some(exam => exam.id === id)).toBe(false);
    expect([...pages.keys()].some(path => path.includes('/' + id + '/'))).toBe(false);
  }
});

it('includes every verified banking entry', () => {
  expect(exams.filter(exam => ids.includes(exam.id)).map(exam => exam.id).sort()).toEqual(ids.filter(id => !skipped.includes(id)).sort());
});
