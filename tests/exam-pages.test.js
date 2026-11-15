import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const presets = JSON.parse(read('presets/exams.json'));
const hi = JSON.parse(read('presets/hi.json'));
const template = read('index.html');
const pages = generatePages(presets, template, hi);

describe('static exam pages', () => {
  it('uses Hindi SEO names only for the specified exams and language, with existing name fallbacks', () => {
    const { seoNames, ...withoutSeoNames } = hi;
    const fallbackPages = generatePages(presets, template, withoutSeoNames);
    const title = html => html.match(/<title>(.*?)<\/title>/)[1];
    expect(seoNames).toEqual({ 'rrb-station-master': 'RRB स्टेशन मास्टर' });
    for (const [path, html] of pages) {
      if (path === '/hi/exam/rrb-station-master/index.html') {
        expect(title(html)).toMatch(/^RRB स्टेशन मास्टर /);
        expect(title(fallbackPages.get(path))).toMatch(/^RRB Station Master /);
      } else {
        expect(title(html), path).toBe(title(fallbackPages.get(path)));
      }
    }
    for (const exam of presets.filter(exam => (exam.languages ?? ['en', 'hi']).includes('hi'))) {
      expect(title(fallbackPages.get('/hi/exam/' + exam.id + '/index.html')).startsWith((exam.seoName ?? exam.name) + ' '), exam.id).toBe(true);
    }
  });
  it('generates every English exam, every Hindi exam and two indexes', () => {
    expect(presets.length).toBeGreaterThan(0);
    expect(pages.size).toBe(presets.length + presets.filter(exam => (exam.languages ?? ['en', 'hi']).includes('hi')).length + 2);
    for (const prefix of ['/exam/', '/hi/exam/']) {
      expect(pages.has(prefix + 'index.html')).toBe(true);
      for (const exam of presets) expect(pages.has(prefix + exam.id + '/index.html')).toBe(prefix === '/exam/' || (exam.languages ?? ['en', 'hi']).includes('hi'));
    }
  });
  for (const exam of presets) for (const lang of (exam.languages ?? ['en', 'hi'])) {
    const prefix = lang === 'hi' ? '/hi' : '';
    const route = prefix + '/exam/' + exam.id + '/';
    it(exam.id + ' ' + lang + ' has symmetric alternates, canonical, date and source', () => {
      const html = pages.get(route + 'index.html');
      expect(html).toContain('<html lang="' + lang + '">');
      expect(html).toContain('rel="canonical" href="https://nouploads.in' + route + '"');
      for (const language of (exam.languages ?? ['en', 'hi'])) {
        const alternate = (language === 'hi' ? '/hi' : '') + '/exam/' + exam.id + '/';
        const tag = 'hreflang="' + language + '" href="https://nouploads.in' + alternate + '"';
        expect(html).toContain(tag);
        expect(pages.get(alternate + 'index.html')).toContain('hreflang="' + lang + '" href="https://nouploads.in' + route + '"');
      }
      expect(html).toContain((lang === 'hi' ? hi.verified : 'Source checked') + ': ' + exam.verifiedOn);
      expect(html).toContain('href="' + exam.sourceUrl.replaceAll('&', '&amp;') + '"');
      expect(html).toContain('data-exam="' + exam.id + '"');
      expect(html).toContain('src="/src/main.ts"');
      expect(html).toContain('<table>');
      expect(html).toContain('<h1>' + exam.name);
      expect(html).toContain('name="description"');
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
      expect(JSON.parse(ld)['@type']).toBe('FAQPage');
      expect(JSON.parse(ld).mainEntity).toHaveLength(3);
      expect(html).toContain('sha256-' + createHash('sha256').update(ld).digest('base64'));
      expect(html).toContain('connect-src &#39;self&#39;');
      expect(html).not.toContain('script-src &#39;self&#39; &#39;unsafe-inline&#39;');
    });
  }
  it('shows provenance and symmetric alternates on both indexes', () => {
    for (const prefix of ['', '/hi']) {
      const html = pages.get(prefix + '/exam/index.html');
      for (const exam of presets.filter(exam => prefix !== '/hi' || (exam.languages ?? ['en', 'hi']).includes('hi'))) {
        expect(html).toContain(exam.verifiedOn);
        expect(html).toContain(exam.sourceUrl.replaceAll('&', '&amp;'));
        expect(html).toContain('./' + exam.id + '/');
      }
      expect(html).toContain('hreflang="en" href="https://nouploads.in/exam/"');
      expect(html).toContain('hreflang="hi" href="https://nouploads.in/hi/exam/"');
    }
  });
  it('omits unverified exams from routes, indexes and sitemap', () => {
    const pending = { ...presets[0], id: 'unverified-exam', name: 'Unverified exam', verified: false };
    const output = generatePages([...presets, pending], template, hi);
    expect(output.size).toBe(pages.size);
    expect([...output.values()].join('')).not.toContain(pending.id);
    expect(discoveryFiles(output).sitemap).not.toContain(pending.id);
    expect(generatePages([{ ...presets[0], verified: false }], template, hi).size).toBe(2);
  });
  it('makes preferred dimensions and missing requirements explicit', () => {
    expect(pages.get('/exam/ibps-po/index.html')).toContain('Preferred, not mandatory');
    expect(pages.get('/exam/jee-main/index.html')).toContain('600 px long side');
    expect(pages.get('/hi/exam/jee-main/index.html')).toContain(hi.choose);
    const gate = pages.get('/exam/gate-2027/index.html');
    for (const size of ['200x260', '530x690', '250x80', '580x180']) expect(gate).toContain(size);
    expect(gate).not.toContain('No KB limit was found for the signature.');
  });
  it('uses the photo policy for a photo-only exam with minimum dimensions', () => {
    const exam = {
      id: 'photo-only-exam',
      name: 'Photo-only exam',
      verified: true,
      verifiedOn: '2026-10-25',
      sourceUrl: 'https://example.com/photo-only-exam',
      notes: '',
      photo: {
        minDimensions: { width: 200, height: 260 },
        kbMin: null,
        kbMax: 200,
        format: 'image/jpeg',
        dpi: null,
      },
    };
    const output = generatePages([exam], template, hi);
    for (const prefix of ['', '/hi']) {
      const html = output.get(prefix + '/exam/' + exam.id + '/index.html');
      const faq = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      expect(faq.mainEntity[0].acceptedAnswer.text).toBe(prefix ? hi.target : 'This tool targets the minimum dimensions.');
    }
  });
  it('includes all generated routes in the sitemap and declares it in robots', () => {
    const { sitemap, robots } = discoveryFiles(pages);
    for (const path of pages.keys()) expect(sitemap).toContain('https://nouploads.in' + path.replace(/index.html$/, ''));
    expect(robots).toContain('Sitemap: https://nouploads.in/sitemap.xml');
  });
});


it('validates optional application windows and keeps generated pages identical', () => {
  const expected = {
    'rrb-ntpc': { closes: '2026-11-13' },
    'rrb-station-master': { opens: '2026-10-27', closes: '2026-11-25' },
    'sbi-so': { closes: '2026-11-09' },
    'upsc-civil-services': { opens: '2027-01-13', closes: '2027-02-02' }
  };
  expect(Object.fromEntries(presets.filter(exam => exam.window).map(exam => [exam.id, exam.window]))).toEqual(expected);
  for (const exam of presets.filter(exam => exam.window)) {
    expect(Object.keys(exam.window).every(key => ['opens', 'closes'].includes(key))).toBe(true);
    expect(exam.window.closes).toBeTruthy();
    for (const date of Object.values(exam.window)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(date).toISOString().slice(0, 10)).toBe(date);
    }
    if (exam.window.opens) expect(exam.window.opens <= exam.window.closes).toBe(true);
  }
  const withoutWindows = presets.map(({ window, ...exam }) => exam);
  expect(generatePages(withoutWindows, template, hi)).toEqual(pages);
});
