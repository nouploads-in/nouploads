import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pdfPages, pdfDocuments, pdfResearch, pdfRoutes } from '../scripts/pdf-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { generalPages } from '../scripts/general-pages.mjs';
import { infoPages } from '../scripts/info-pages.mjs';
import { generatePages, discoveryFiles } from '../scripts/exam-pages.mjs';
import { auditSeo } from '../scripts/audit-seo.mjs';
import { auditLanguages } from '../scripts/audit-languages.mjs';
import { escape } from '../scripts/seo.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const hi = JSON.parse(read('presets/hi.json'));
const template = read('pdf-unlock.html');
const pages = pdfPages(template, hi);

it.each([
  ['/pdf-password/cdsl-cas/index.html',
    'CDSL CAS PDF password: unlock it here, no upload',
    'CDSL CAS PDF password: your PAN in capitals (ABCDE1234F)',
    "Unlock your CDSL CAS PDF here: type the first holder's PAN in capitals once and save a copy that opens without it. Runs in your browser, no uploads."],
  ['/pdf-password/cams-cas/index.html',
    'CAMS CAS PDF password: unlock it here, no upload',
    'CAMS CAS PDF password: the one you set when requesting it',
    'Unlock your CAMS CAS PDF here: enter the password you set on the request form and save a copy that opens without it. Runs in your browser, no uploads.'],
  ['/pdf-password/icici-prudential-policy/index.html',
    'Unlock ICICI Prudential policy PDF here, no upload',
    'ICICI Prudential policy PDF password: name + DDMM (meer0907)',
    'Unlock your ICICI Prudential policy PDF here: enter name + DDMM (e.g. meer0907) once and save a copy that opens without it. No uploads.'],
  ['/hi/pdf-password/cdsl-cas/index.html',
    'CDSL CAS PDF पासवर्ड: यहीं हटाएँ, कोई अपलोड नहीं',
    'CDSL CAS PDF पासवर्ड: आपका PAN बड़े अक्षरों में (ABCDE1234F)',
    'अपनी CDSL CAS PDF यहीं खोलें: पहले खाताधारक का PAN बड़े अक्षरों में एक बार डालें और बिना पासवर्ड खुलने वाली कॉपी सेव करें। कोई अपलोड नहीं।']
])('sells the tool in the title and keeps the answer in the heading for %s', (path, title, heading, description) => {
  const html = pages.get(path);
  expect(html.match(/<title>(.*?)<\/title>/)[1]).toBe(escape(title));
  expect(html.match(/<h1>(.*?)<\/h1>/)[1]).toBe(escape(heading));
  expect(html.match(/<meta name="description" content="([^"]+)"/)[1]).toBe(escape(description));
});

it('puts the unlock tool right after the password rule and the sources after the tool', () => {
  const html = pages.get('/pdf-password/cdsl-cas/index.html');
  const rule = html.indexOf('data-rule-status=');
  const tool = html.indexOf('<div class="workspace">');
  const sources = html.indexOf('class="password-sources"');
  expect(rule).toBeGreaterThan(0);
  expect(tool).toBeGreaterThan(rule);
  expect(sources).toBeGreaterThan(tool);
  expect(html.match(/<div class="workspace">/g)).toHaveLength(1);
});

it('includes the confirmed banking documents with official sources and channel-specific formats', () => {
  const banking = JSON.parse(read('research/round5-banking-pdf.json')).pdfs;
  const confirmed = banking.filter(doc => doc.confidence === 'CONFIRMED');
  expect(confirmed).toHaveLength(14);
  for (const source of [...confirmed, banking.find(doc => doc.id === 'icici-credit-card-netbanking-pdf')]) {
    const doc = pdfDocuments.find(doc => doc.match === source.issuer + ' ' + source.document);
    expect(doc).toBeDefined();
    expect(doc.agreement).toBe('official-confirmed');
    expect(doc.lastChecked).toBe('2026-10-25');
    expect(doc.sources).toEqual([{ url: source.sourceUrl, sourceType: 'official', quotes: source.sourceQuotes }]);
    expect(doc.example).toContain(source.example.password);
    expect(hi.pdfPages.documents[doc.id].example).toContain(source.example.password);
  }
  const byId = id => pdfDocuments.find(doc => doc.id === id);
  expect(byId('indusind-statement').rule).toContain('eight-digit Customer ID');
  expect(byId('federal-statement').rule).toContain('incorporation date');
  expect(byId('ais').rule).toContain('PAN in lowercase');
  expect(byId('upstox-contract-note').rule).toContain('lowercase');
  expect(byId('baroda-bnp-mutual-fund-statement').rule).toContain('Guardian PAN');
  expect(byId('icici-credit-card-statement').rule).toContain('lowercase');
  expect(byId('icici-credit-card-netbanking-statement').rule).toContain('last four digits');
  for (const id of ['axis-credit-card-statement', 'nps-transaction-statement']) {
    expect(byId(id)).toBeUndefined();
    expect(pdfRoutes).not.toContain('/pdf-password/' + id + '/');
  }
});

it('generates 68 unique bilingual PDF pages with metadata, hashes and reciprocal switchers', () => {
  expect(pages.size).toBe(68);
  auditSeo(pages);
  auditLanguages(pages, hi.pdfPages.literalTokens);
  for (const [path, html] of pages) {
    expect(html).toContain(path.startsWith('/hi/') ? hi.pdfPages.disclaimer : 'This does not crack passwords; you must know the password.');
    for (const id of ['file', 'password', 'unlock-form', 'download', 'clear']) expect(html).toContain('id="' + id + '"');
    expect(html).toContain('src="/src/pdf-main.ts"');
    expect(html).not.toContain('src="/src/main.ts"');
    const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(data.map(item => item['@type'])).toEqual(['FAQPage', 'WebApplication', 'HowTo', 'BreadcrumbList']);
    expect(data[0].mainEntity).toHaveLength(5);
    expect(data[2].step).toHaveLength(3);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/hreflang=/g)).toHaveLength(3);
    const policy = source => source.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replaceAll('&#39;', "'").replace(/ 'sha256-[^']+'/g, '');
    expect(policy(html)).toBe(policy(template));
  }
});

it('gates all factual document rules by research agreement and preserves exact supplied English rules, examples and sources', () => {
  expect(pdfDocuments).toHaveLength(29);
  expect(pdfResearch.filter(doc => !pdfDocuments.some(page => page.document === doc.document)).map(doc => doc.agreement)).toEqual(['not-found', 'not-found']);
  for (const doc of pdfDocuments) for (const root of ['', '/hi']) {
    const html = pages.get(root + '/pdf-password/' + doc.id + '/index.html');
    expect(html.includes('data-rule-status="fact"')).toBe((doc.agreement === 'official-confirmed' && doc.confirmation !== 'preview'));
    expect(html).toContain('data-agreement="' + doc.agreement + '"');
    expect(html).toContain(doc.lastChecked ?? '2026-10-15');
    const intro = html.match(/<div class="intro">(.*?)<\/div>/)[1];
    const confirmedLabel = root ? 'जारीकर्ता के आधिकारिक पेज से पुष्ट नियम' : "Rule confirmed by the issuer&#39;s official page";
    const warning = root ? 'यह न मानें कि बताया गया प्रारूप आपकी फ़ाइल पर लागू है।' : 'Do not assume that a reported pattern applies to your file.';
    const reported = root ? 'ये प्रारूप उपयोगकर्ताओं और ब्लॉगों ने बताए हैं; जारीकर्ता ने इनकी पुष्टि नहीं की है।' : 'Patterns reported by users and blogs (not confirmed by the issuer).';
    if ((doc.agreement === 'official-confirmed' && doc.confirmation !== 'preview')) {
      expect(html).toContain('<h2>' + confirmedLabel + '</h2>');
      expect(intro).toContain(root ? hi.pdfPages.confirmedHint : 'Check the password hint in your email or on the download screen first');
      expect(html).not.toContain(warning);
      expect(html).not.toContain(reported);
      expect(html).not.toContain('data-rule-status="reported"');
      expect(html).toContain('<h3>' + (root ? 'पासवर्ड का उदाहरण' : 'Example password') + '</h3>');
    } else {
      expect(intro).toContain(root ? hi.pdfPages.hint : 'Check the email or download screen hint.');
      expect(intro).toContain(warning);
      expect(html).toContain(reported);
      expect(html).toContain('data-rule-status="reported"');
      expect(html).not.toContain(confirmedLabel);
      expect(intro).not.toContain(root ? hi.pdfPages.confirmedHint : 'Check the password hint in your email or on the download screen first');
      expect(html).toContain(root ? hi.pdfPages.reportedExample : 'Reported example only; not a confirmed password');
    }
    if (doc.agreement === 'multiple-unofficial-agree') expect(html).toContain(root ? hi.pdfPages.common : 'Commonly reported rule (not confirmed by the issuer)');
    else if (doc.confirmation !== 'preview' && doc.agreement !== 'official-confirmed') expect(html).toContain(root ? hi.pdfPages.uncertain : 'Reported patterns: unconfirmed and conflicting');
    for (const source of doc.sources) expect(html).toContain('href="' + escape(source.url) + '"');
    if (!root) {
      expect(html).toContain('<p>' + escape(doc.rule ?? doc.passwordRule) + '</p>');
      expect(html).toContain('<p>' + escape(doc.example) + '</p>');
    } else {
      expect(hi.pdfPages.documents[doc.id].rule).toMatch(/[\u0900-\u097f]/);
      expect(hi.pdfPages.documents[doc.id].example).toMatch(/[\u0900-\u097f]/);
    }
  }
});

it('uses reader-facing copy while keeping source limitations and format-change guidance in both languages', () => {
  for (const [path, html] of pages) {
    expect(html).not.toMatch(/supplied research|supplied sources|from the research|search snippets|दिए गए शोध|शोध/i);
    if (!/\/pdf-password\/[^/]+\//.test(path)) continue;
    const doc = pdfDocuments.find(doc => path.endsWith('/' + doc.id + '/index.html'));
    expect(html).toContain((path.startsWith('/hi/') ? 'अंतिम जाँच: ' : 'Last checked: ') + (doc.lastChecked ?? '2026-10-15'));
    expect(html).toContain(path.startsWith('/hi/') ? 'प्रारूप बदल सकते हैं, इसलिए हमेशा पहले अपने ईमेल या डाउनलोड स्क्रीन पर संकेत देखें।' : 'Formats can change, so always check the hint in your email or on the download screen first.');
    expect(html).toContain(path.startsWith('/hi/') ? 'कुछ जानकारी पूरे पेज के बजाय खोज परिणाम में दिखे अंश पर आधारित है; केवल आधिकारिक लिंक होने से पासवर्ड प्रारूप की पुष्टि नहीं होती।' : 'Some guidance is based on search-result previews rather than full pages; an official link alone does not confirm a password format.');
  }
});

it('interpolates checked dates independently of translated copy and defaults undated documents', () => {
  const doc = pdfDocuments[0];
  const originalDate = doc.lastChecked;
  const translated = structuredClone(hi);
  translated.pdfPages.checked = '{date} — जाँच की तारीख';
  try {
    for (const date of ['2026-11-01', undefined]) {
      doc.lastChecked = date;
      const rendered = pdfPages(template, translated);
      const expected = date ?? '2026-10-15';
      expect(rendered.get('/pdf-password/' + doc.id + '/index.html')).toContain('<p>Last checked: ' + expected + '</p>');
      expect(rendered.get('/hi/pdf-password/' + doc.id + '/index.html')).toContain('<p>' + expected + ' — जाँच की तारीख</p>');
    }
  } finally {
    if (originalDate === undefined) delete doc.lastChecked;
    else doc.lastChecked = originalDate;
  }
});

it('connects home, the primary PDF tool, footers, sibling pages and hubs and discovers every PDF route', () => {
  const templates = Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)]));
  const all = new Map([...generatePages(JSON.parse(read('presets/exams.json')), read('index.html'), hi), ...toolPages(templates, hi), ...generalPages(read('index.html'), hi), ...infoPages(read('index.html'), hi), ...pages]);
  const first = toolPages(templates, hi);
  const second = toolPages(Object.fromEntries([...first].filter(([path]) => !path.startsWith('/hi/'))), hi);
  for (const path of ['/pdf-unlock.html', '/hi/pdf-unlock.html']) {
    expect(second.get(path)).toBe(first.get(path));
    expect(second.get(path).match(/data-pdf-links="true"/g)).toHaveLength(1);
  }
  auditSeo(all);
  const sitemap = discoveryFiles(all).sitemap;
  for (const root of ['', '/hi']) {
    for (const route of pdfRoutes) {
      expect(all.get(root + '/pdf-unlock.html')).toContain('href="' + root + route + '"');
      expect(sitemap).toContain('<loc>https://nouploads.in' + root + route + '</loc>');
    }
    for (const route of ['/index.html', '/pdf-unlock.html', '/exam/index.html']) expect(all.get(root + route)).toContain('href="' + root + '/pdf-password/"');
  }
  for (const [path, html] of pages) for (const link of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    if (!link[1].startsWith('/')) continue;
    expect(all.has(link[1].endsWith('/') ? link[1] + 'index.html' : link[1].endsWith('/pdf-unlock') ? link[1] + '.html' : link[1]), path + ' -> ' + link[1]).toBe(true);
  }
});
