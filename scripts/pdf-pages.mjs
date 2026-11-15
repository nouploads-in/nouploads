import { readFileSync } from 'node:fs';
import { pageHeader, pageFooter } from './page-shell.mjs';
import { translateMarkup } from './tool-pages.mjs';
import { escape, jsonLd, scriptHash, socialTags } from './seo.mjs';

export const pdfConfig = JSON.parse(readFileSync(new URL('../presets/pdf-pages.json', import.meta.url), 'utf8'));
const research = JSON.parse(readFileSync(new URL('../research/round2-raw.json', import.meta.url), 'utf8'));
const bankingResearch = JSON.parse(readFileSync(new URL('../research/round5-banking-pdf.json', import.meta.url), 'utf8'));
const bankingDocuments = bankingResearch.pdfs.filter(doc => doc.confidence === 'CONFIRMED' || doc.id === 'icici-credit-card-netbanking-pdf').map(doc => ({
  document: doc.issuer + ' ' + doc.document,
  passwordRule: doc.passwordFormat,
  agreement: 'official-confirmed',
  lastChecked: '2026-10-25',
  sources: [{ url: doc.sourceUrl, sourceType: 'official', quotes: doc.sourceQuotes }]
}));
export const pdfResearch = [...Object.values(research.results).flatMap(result => result.documents ?? []), ...bankingDocuments];
export const pdfDocuments = pdfConfig.documents.map(config => ({ ...pdfResearch.find(doc => doc.document === config.match), ...config })).filter(doc => doc.passwordRule && doc.sources?.length && doc.agreement !== 'not-found');
export const pdfRoutes = [...pdfConfig.intents.map(page => '/' + page.id + '/'), '/pdf-password/', ...pdfDocuments.map(doc => '/pdf-password/' + doc.id + '/')];
const en = {
  hub: 'PDF password help', hubIntro: 'Find the password format for your document, see whether the issuer confirms it, then remove a password you already know with the local tool. Issuers and delivery channels can use different formats.',
  hubDescription: 'Find PDF password formats for Aadhaar, bank statements, PAN and tax documents. Check which rules are confirmed and unlock with a known password in your browser.',
  disclaimer: 'This does not crack passwords; you must know the password.',
  privacy: 'After offline setup finishes, the tool works without a connection. Your PDF and password stay on your device; there are no uploads.',
  how: 'How to remove the password', faq: 'Frequently asked questions', related: 'Related PDF tools',
  steps: ['Choose one password-protected PDF up to 50 MB.', 'Enter the password you already know and select Remove password.', 'Download the unlocked copy and check it in your PDF reader.'],
  questions: ['Is this PDF tool private?', 'Does it work offline?', 'What about owner passwords, user passwords or a forgotten password?', 'What is the PDF file size limit?', 'Will this change my PDF?'],
  answers: ['Yes. Password checks and removal run in your browser on your device. Files and passwords are not uploaded or stored by the app. Protect the downloaded unlocked copy yourself.', 'Yes, after the offline installation finishes. Turn off Wi-Fi and mobile data, reload the page and try a file. Clearing browser site data requires installation again.', 'A user password controls opening; an owner password controls restrictions. A known user or owner password can work. Leave the field blank for a restricted PDF that opens without a password. Forgotten passwords cannot be cracked here; ask the issuer for its hint or a replacement.', 'Choose one non-empty PDF up to 50 MB. Processing also depends on your browser and available device memory; a complex file may fail even below this limit.', 'The tool decrypts into a new PDF without turning text or pages into images. The original is unchanged, but output bytes and size can differ. Review layout, forms and any digital signatures before using the copy.'],
  preview: 'Rule attributed to the issuer (full page not checked)', confirmed: "Rule confirmed by the issuer's official page", common: 'Commonly reported rule (not confirmed by the issuer)', uncertain: 'Reported patterns: unconfirmed and conflicting',
  reported: 'Patterns reported by users and blogs (not confirmed by the issuer). These may not apply to your file.',
  confirmedHint: 'Check the password hint in your email or on the download screen first, as formats can vary by delivery channel.',
  hint: 'Check the email or download screen hint. If it is missing, ask the issuer or sender. Do not assume that a reported pattern applies to your file.',
  checked: 'Last checked: {date}', provenance: 'Formats can change, so always check the hint in your email or on the download screen first. Some guidance is based on search-result previews rather than full pages; an official link alone does not confirm a password format.',
  example: 'Example password', reportedExample: 'Reported example only; not a confirmed password', sources: 'Sources and further reading', official: 'Official source', unofficial: 'Unofficial source',
  format: 'PDF password format', scope: 'Document covered',
  docTitles: ['{name} PDF password: unlock it here, no upload', 'Unlock {name} PDF here, no upload', 'Unlock {name} PDF'],
  docDescriptions: ['Unlock your {name} PDF here: pick the file, enter its password once and save a copy that opens without one. Runs in your browser, no uploads.', 'Unlock your {name} PDF here: enter its password once and save a copy that opens without one. Nothing is uploaded.']
};
export const fit = (templates, name, min, max) => templates.map(text => text.replaceAll('{name}', name)).find(text => text.length >= min && text.length <= max);

export function pdfLinks(lang, hi, route = '') {
  const root = lang === 'hi' ? '/hi' : '';
  const t = lang === 'hi' ? hi.pdfPages : en;
  return '<section class="more-tools" data-pdf-links="true"><h2>' + escape(t.related) + '</h2><a href="' + root + '/pdf-unlock">' + escape(lang === 'hi' ? hi.translations['PDF password remover'] : 'PDF password remover') + '</a><ul>' + pdfConfig.intents.flatMap((page, i) => route === '/' + page.id + '/' ? [] : ['<li><a href="' + root + '/' + page.id + '/">' + escape(lang === 'hi' ? t.intents[i].title : page.title) + '</a></li>']).join('') + '</ul><h3><a href="' + root + '/pdf-password/">' + escape(t.hub) + '</a></h3><ul>' + pdfDocuments.map(doc => '<li><a href="' + root + '/pdf-password/' + doc.id + '/">' + escape(lang === 'hi' ? t.documents[doc.id].name : doc.name) + '</a></li>').join('') + '</ul></section>';
}

export function pdfPages(template, hi, origin = 'https://nouploads.in') {
  const pages = new Map();
  const workspace = template.slice(template.indexOf('<div class="workspace">'), template.indexOf('    <aside class="local-note">'));
  for (const lang of ['en', 'hi']) for (const route of pdfRoutes) {
    const t = lang === 'hi' ? hi.pdfPages : en;
    const root = lang === 'hi' ? '/hi' : '';
    const url = origin + root + route;
    const intentIndex = pdfConfig.intents.findIndex(page => route === '/' + page.id + '/');
    const doc = pdfDocuments.find(page => route === '/pdf-password/' + page.id + '/');
    const intent = intentIndex >= 0 ? (lang === 'hi' ? t.intents[intentIndex] : pdfConfig.intents[intentIndex]) : undefined;
    const local = doc && (lang === 'hi' ? t.documents[doc.id] : doc);
    const heading = intent?.heading ?? (doc ? local.heading ?? local.name + ' ' + t.format : t.hub);
    const title = intent?.title ?? (doc ? fit(t.docTitles, local.name, 1, 60) : heading);
    const description = intent?.description ?? (doc ? local.toolDescription ?? fit(t.docDescriptions, local.name, 120, 160) : t.hubDescription);
    let content = '<div class="intro"><h1>' + escape(heading) + '</h1><p>' + escape(intent?.intro ?? (doc ? doc.agreement === 'official-confirmed' && doc.confirmation !== 'preview' ? t.confirmedHint : t.hint : t.hubIntro)) + '</p><p><strong>' + escape(t.disclaimer) + '</strong></p></div>';
    if (intent) content += '<section><h2>' + escape(intent.angle) + '</h2><p>' + escape(intent.detail) + '</p></section>';
    if (doc) {
      const fact = doc.agreement === 'official-confirmed' && doc.confirmation !== 'preview';
      const label = doc.confirmation === 'preview' ? t.preview : fact ? t.confirmed : doc.agreement === 'multiple-unofficial-agree' ? t.common : t.uncertain;
      content += '<section class="password-guidance" data-agreement="' + escape(doc.agreement) + '"><h2>' + escape(label) + '</h2><p>' + escape(t.scope) + ': ' + escape(lang === 'hi' ? local.scope : doc.document) + '</p>' + (fact ? '' : '<p>' + escape(t.reported) + '</p>') + '<div data-rule-status="' + (fact ? 'fact' : 'reported') + '"><p>' + escape(lang === 'hi' ? local.rule : (doc.rule ?? doc.passwordRule)) + '</p></div>';
      if (doc.example && doc.example !== 'none verified') content += '<h3>' + escape(fact ? t.example : t.reportedExample) + '</h3><p>' + escape(lang === 'hi' ? local.example : (doc.example)) + '</p>';
      content += '</section>' + (lang === 'hi' ? translateMarkup(workspace, hi) : workspace) + '<section class="password-sources"><p>' + escape(t.checked.replace('{date}', doc.lastChecked ?? '2026-10-15')) + '</p><p>' + escape(t.provenance) + '</p><h2>' + escape(t.sources) + '</h2><ul>' + doc.sources.map((source, i) => '<li><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer external">' + escape(source.sourceType === 'official' ? t.official : t.unofficial) + ' ' + (i + 1) + '</a></li>').join('') + '</ul></section>';
    }
    if (!doc) content += lang === 'hi' ? translateMarkup(workspace, hi) : workspace;
    content += '<aside class="local-note"><p>' + escape(t.privacy) + '</p></aside><section><h2>' + escape(t.how) + '</h2><ol>' + t.steps.map(step => '<li>' + escape(step) + '</li>').join('') + '</ol></section><section><h2>' + escape(t.faq) + '</h2>' + t.questions.map((q, i) => '<h3>' + escape(q) + '</h3><p>' + escape(t.answers[i]) + '</p>').join('') + '</section>' + pdfLinks(lang, hi, route);
    const data = [
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.questions.map((name, i) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: t.answers[i] } })) },
      { '@context': 'https://schema.org', '@type': 'WebApplication', name: heading, url, inLanguage: lang, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }, description },
      { '@context': 'https://schema.org', '@type': 'HowTo', name: t.how, description: t.disclaimer, step: t.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'nouploads', item: origin + root + '/' }, ...(doc ? [{ name: t.hub, item: origin + root + '/pdf-password/' }] : []), { name: heading, item: url }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) }
    ].map(jsonLd);
    const policy = template.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/ 'sha256-[^']+'/g, '').replace("script-src 'self'", "script-src 'self' " + data.map(scriptHash).join(' '));
    pages.set(root + route + 'index.html', '<!doctype html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="' + escape(policy) + '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escape(title) + '</title><meta name="description" content="' + escape(description) + '"><link rel="canonical" href="' + url + '">' + ['en', 'hi', 'x-default'].map(language => '<link rel="alternate" hreflang="' + language + '" href="' + origin + (language === 'hi' ? '/hi' : '') + route + '">').join('') + socialTags(title, description, url, lang) + '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg"><meta name="theme-color" content="#285c43"><link rel="stylesheet" href="/src/style.css">' + data.map(ld => '<script type="application/ld+json">' + ld + '</script>').join('') + '</head><body data-tool="pdf" data-static-shell="true">' + pageHeader(lang, route, hi) + '<main>' + content + '</main>' + pageFooter(lang, route, hi, '<span data-offline-status>' + escape(lang === 'hi' ? hi.translations['Works offline'] : 'Works offline') + '</span>') + '<script type="module" src="/src/pwa.ts"></script><script type="module" src="/src/pdf-main.ts"></script></body></html>');
  }
  return pages;
}
