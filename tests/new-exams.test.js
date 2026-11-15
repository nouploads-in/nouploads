import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { escape } from '../scripts/seo.mjs';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exams = JSON.parse(read('presets/exams.json'));
const hi = JSON.parse(read('presets/hi.json'));
const pages = generatePages(exams, read('index.html'), hi);
const spec = (width, height, kbMin, kbMax, dpi = null, preferred = false) => ({ dimensions: width ? { width, height } : null, kbMin, kbMax, format: 'image/jpeg', dpi, ...(preferred ? { preferred: true } : {}) });
const banking = { photo: spec(200, 230, 20, 50, null, true), signature: spec(140, 60, 10, 20, null, true), thumb: spec(240, 240, 20, 50, 200), declaration: spec(800, 400, 50, 100, 200) };
const upsc = {
  photo: spec(null, null, 20, 200),
  signature: { ...spec(null, null, 20, 100), minDimensions: { width: 350, height: 350 }, maxDimensions: { width: 500, height: 500 }, target: { width: 400, height: 500 }, layout: 'triple' }
};
const upscWindows = {
  'nda-na': ['NDA & NA (I) 2027', '02.12.2026', '22.12.2026'],
  'cds': ['CDS (I) 2027', '02.12.2026', '22.12.2026'],
  'upsc-capf': ['CAPF (ACs) 2027', '17.02.2027', '09.03.2027'],
  'upsc-ese': ['ESE (Prelims) 2027', '16.09.2026', '06.10.2026']
};
it('stores the tentative revised NTA calendar without changing generated pages', () => {
  const schedule = (label, dates) => ({ label, dates, tentative: true, sourceUrl: 'https://nta.ac.in/Download/Notice/ExamcalendarRevised.pdf' });
  expect(Object.fromEntries(exams.filter(exam => exam.examDates).map(exam => [exam.id, exam.examDates]))).toEqual({
    'ugc-net': [schedule('December 2026 cycle', ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18', '2026-12-21'])],
    'csir-net': [schedule('December 2026 cycle', ['2026-12-19', '2026-12-22', '2026-12-27'])],
    'nift': [schedule('NIFT Entrance Examination 2027', ['2027-01-10'])],
    'jee-main': [
      schedule('Session 1 (January 2027)', ['2027-01-20', '2027-01-21', '2027-01-22', '2027-01-23', '2027-01-24', '2027-01-28']),
      schedule('Session 2 (April 2027)', ['2027-04-02', '2027-04-03', '2027-04-04', '2027-04-05', '2027-04-06', '2027-04-07'])
    ]
  });
  const withoutExamDates = exams.map(({ examDates, ...exam }) => exam);
  const previousPages = generatePages(withoutExamDates, read('index.html'), hi);
  expect(pages).toEqual(previousPages);
  expect(discoveryFiles(pages)).toEqual(discoveryFiles(previousPages));
});
const expected = {
  'nda-na': upsc,
  'cds': upsc,
  'upsc-capf': upsc,
  'upsc-ese': upsc,
  'ibps-clerk': banking,
  'sbi-clerk': banking,
  'rbi-grade-b': { ...banking, thumb: spec(null, null, 20, 50, 200), declaration: spec(null, null, 50, 100) },
  'ugc-net': { photo: spec(null, null, 10, 200), signature: spec(null, null, 4, 30) },
  'ssc-cgl': { signature: spec(null, null, 10, 20) },
  'ssc-chsl': { signature: spec(null, null, 10, 20) },
  'ssc-gd': { signature: spec(null, null, 10, 20) },
  'rrb-ntpc': { signature: { ...spec(null, null, 30, 49, 100), minDimensions: { width: 140, height: 60 } } },
  'sbi-so': { photo: spec(200, 230, 20, 50, 200, true), signature: spec(140, 60, 10, 20, 200, true) },
  'csir-net': { photo: spec(null, null, 10, 200), signature: spec(null, null, 10, 50) },
  'nift': { photo: spec(null, null, 10, 200), signature: spec(null, null, 10, 50) }
};

for (const [id, uploads] of Object.entries(expected)) {
  it(id + ' retains exactly the supplied upload requirements and translated notes', () => {
    const exam = exams.find(exam => exam.id === id);
    expect(exam.verified).toBe(true);
    expect(exam.verifiedOn).toBe(['rrb-ntpc', 'sbi-so', 'csir-net', 'nift', ...Object.keys(upscWindows)].includes(id) ? '2026-10-25' : '2026-10-15');
    expect(Object.fromEntries(['photo', 'signature', 'thumb', 'declaration'].filter(key => exam[key]).map(key => [key, exam[key]]))).toEqual(uploads);
    expect(hi.examNotes[id]).toMatch(/[\u0900-\u097f]/);
    expect(hi.examNotes[id]).not.toContain('??');
    for (const lang of ['en', 'hi']) {
      const html = pages.get((lang === 'hi' ? '/hi' : '') + '/exam/' + id + '/index.html');
      const modes = [...html.matchAll(/name="mode" value="([^"]+)"/g)].map(match => match[1]);
      expect(modes).toEqual(Object.keys(uploads));
      expect(html).toContain('value="' + (exam.photo ? 'photo' : 'signature') + '" checked');
      expect(html).toContain(escape(lang === 'hi' ? hi.examNotes[id] : exam.notes));
    }
  });
}

it('retains the official sources and discovers the new verified exams', () => {
  const sources = {
    ...Object.fromEntries(Object.keys(upscWindows).map(id => [id, 'https://upsconline.nic.in/caf/assets/PDF/instruction-photo-signature-upload-upsc.pdf'])),
    'rrb-ntpc': 'https://www.rrbapply.gov.in/assets/forms/CEN_06_2026_NTPC_G.pdf',
    'sbi-so': 'https://sbi.bank.in/documents/77530/57941334/17102026_Detail_ADV_CRPD_SCO_2026-27_30.pdf/226b6572-e6bd-2b73-f266-dc7db9b282bd?t=1792240760461',
    'csir-net': 'https://cdnbbsr.s3waas.gov.in/s3efdf562ce2fb0ad460fd8e9d33e57f57/uploads/2026/10/202610071407707951.pdf',
    'nift': 'https://www.nift.ac.in/sites/default/files/2026-10/Information%20Bulletin%20-NIFTEE%202027%20-16.10.2026.pdf'
  };
  const { sitemap } = discoveryFiles(pages);
  for (const [id, source] of Object.entries(sources)) {
    expect(exams.find(exam => exam.id === id).sourceUrl).toBe(source);
    for (const prefix of ['', '/hi']) {
      expect(sitemap).toContain('<loc>https://nouploads.in' + prefix + '/exam/' + id + '/</loc><lastmod>2026-10-25</lastmod>');
    }
  }
});

it('reuses the UPSC portal specs and renders the official 2027 application windows in both languages', () => {
  const civilServices = exams.find(exam => exam.id === 'upsc-civil-services');
  for (const [id, [label, start, end]] of Object.entries(upscWindows)) {
    const exam = exams.find(exam => exam.id === id);
    expect(exam.photo).toEqual(civilServices.photo);
    expect(exam.signature).toEqual(civilServices.signature);
    expect(exam.notes).toContain(label + ' applications: ' + start + ' to ' + end);
    for (const prefix of ['', '/hi']) {
      const html = pages.get(prefix + '/exam/' + id + '/index.html');
      expect(html).toContain(start);
      expect(html).toContain(end);
    }
  }
});

it('renders RRB minimum-only dimensions and live photo guidance without a fabricated maximum', () => {
  const en = pages.get('/exam/rrb-ntpc/index.html');
  expect(en).toContain('<title>RRB NTPC signature size 30-49 KB: resize yours here</title>');
  expect(en).toContain('Photo is captured live by webcam or phone');
  for (const prefix of ['', '/hi']) {
    const html = pages.get(prefix + '/exam/rrb-ntpc/index.html');
    for (const text of ['140x60 px', '30-49 KB', '06.11.2026', '13.11.2026']) expect(html).toContain(text);
    expect(html).not.toContain('value="photo"');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain(prefix ? hi.noLimit : 'No KB limit was found for the signature.');
    expect(html).not.toContain((prefix ? hi.maximum : 'Maximum') + ' 140x60 px');
  }
});

it('generates signature-only Station Master pages with translated guidance and discovery links', () => {
  const id = 'rrb-station-master';
  const exam = exams.find(exam => exam.id === id);
  const research = JSON.parse(read('research/rrb-station-master-2026-10.json'));
  expect(exam.verified).toBe(true);
  expect(exam.verifiedOn).toBe('2026-11-02');
  expect(exam.sourceUrl).toBe('https://rrb.indianrailways.gov.in/-/image/1793016771817CEN_08_2026_StationMaster.pdf/examsDocuments');
  expect(exam.watchUrl).toBe('https://www.pib.gov.in/PressReleasePage.aspx?PRID=2329071&reg=3&lang=1');
  expect(exam.signature).toEqual(exams.find(exam => exam.id === 'rrb-ntpc').signature);
  expect(['photo', 'thumb', 'declaration'].filter(key => exam[key])).toEqual([]);
  expect(research.sourceUrl).toBe(exam.sourceUrl);
  expect(research.watchUrl).toBe(exam.watchUrl);
  expect(research.dates.applicationWindow).toEqual(exam.window);
  expect(research.uploadEvidence.signature.paragraph).toBe('16.6(a)');
  expect(research.uploadEvidence.photo.paragraph).toBe('16.5');
  expect(hi.examNotes[id]).toMatch(/[\u0900-\u097f]/);
  const { sitemap } = discoveryFiles(pages);
  for (const prefix of ['', '/hi']) {
    const route = prefix + '/exam/' + id + '/';
    const html = pages.get(route + 'index.html');
    expect([...html.matchAll(/name="mode" value="([^"]+)"/g)].map(match => match[1])).toEqual(['signature']);
    expect(html).toContain('value="signature" checked');
    expect(html).toContain(escape(prefix ? hi.examNotes[id] : exam.notes));
    for (const text of ['140x60 px', '30-49 KB', '100 DPI', 'JPG/JPEG', '1,265', '27.10.2026', '25.11.2026', '23:59', '27.11.2026', '28.11.2026', '07.12.2026']) expect(html).toContain(text);
    expect(html).not.toContain((prefix ? hi.maximum : 'Maximum') + ' 140x60 px');
    expect(html).not.toContain('undefined');
    expect(html).toContain('rel="canonical" href="https://nouploads.in' + route + '"');
    for (const [lang, alternate] of [['en', ''], ['hi', '/hi']]) {
      expect(html).toContain('hreflang="' + lang + '" href="https://nouploads.in' + alternate + '/exam/' + id + '/"');
    }
    expect(pages.get(prefix + '/exam/index.html')).toContain('./' + id + '/');
    expect(pages.get(prefix + '/exam/rrb-ntpc/index.html')).toContain('href="' + route + '"');
    expect(html).toContain('href="' + prefix + '/exam/rrb-ntpc/"');
    expect(sitemap).toContain('<loc>https://nouploads.in' + route + '</loc><lastmod>2026-11-02</lastmod>');
  }
  expect(exam).not.toHaveProperty('seoName');
  const englishTitle = 'RRB Station Master signature size 30-49 KB resizer';
  const hindiTitle = 'RRB स्टेशन मास्टर हस्ताक्षर आकार 30-49 KB: यहीं बदलें';
  expect(englishTitle).toHaveLength(50);
  expect(hindiTitle.length).toBeLessThanOrEqual(60);
  expect(pages.get('/exam/' + id + '/index.html')).toContain('<title>' + englishTitle + '</title>');
  expect(pages.get('/hi/exam/' + id + '/index.html')).toContain('<title>' + hindiTitle + '</title>');
});

it('explains live photos, dated bulletins and ambiguous SSC dimensions without inventing pixels', () => {
  const page = id => pages.get('/exam/' + id + '/index.html');
  expect(page('sbi-clerk')).toContain('separate live photo');
  expect(page('rbi-grade-b')).toContain('closed in June 2026');
  expect(page('ugc-net')).toContain('June 2025');
  expect(page('ugc-net')).toContain('2026 bulletin');
  expect(page('ugc-net')).toContain('80% face visible, white background');
  for (const id of ['ssc-cgl', 'ssc-chsl', 'ssc-gd']) {
    expect(page(id)).toContain('captured live by webcam or mobile');
    expect(page(id)).toContain('about 6.0 cm x 2.0 cm');
    expect(page(id)).toContain('Only the 10-20 KB range is enforced');
    expect(page(id)).toContain('id="output-size"');
    expect(page(id)).not.toContain('id="output-size" hidden');
    expect(page(id)).toContain('<title>' + exams.find(exam => exam.id === id).name + ' signature size 10-20 KB: resize yours here</title>');
  }
  for (const id of ['ssc-cgl', 'ssc-chsl']) {
    expect(page(id)).toContain('about 4.0 cm x 2.0 cm');
    expect(page(id)).toContain('does not say which governs');
  }
});
