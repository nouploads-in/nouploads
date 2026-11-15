import { pageHeader, pageFooter } from './page-shell.mjs';
import { addUnverifiedPages } from './unverified-pages.mjs';
import { translateMarkup } from './tool-pages.mjs';
import { escape, jsonLd, scriptHash, socialTags } from './seo.mjs';

const en = { title: 'photo and signature size', listTitle: 'Exam photo and signature sizes', description: 'Check exam requirements and resize photos or signatures on your device. No file uploads.', upload: 'File type', dimensions: 'Dimensions', size: 'File size', format: 'Format', dpi: 'DPI', notes: 'Notes', preferred: 'Preferred, not mandatory', unspecified: 'Not stated', minimum: 'Minimum', maximum: 'Maximum', target: 'This tool targets the minimum dimensions.', choose: 'No pixel size is stated. Choose an output size; the default keeps the cropped aspect ratio with a 600 px long side. Only the KB range is enforced.', noLimit: 'No KB limit was found for the signature.', verified: 'Source checked', source: 'Official notification', all: 'All exams', faq: 'Frequently asked questions', faqSize: 'What output size should I choose?', faqPrivacy: 'Is my file uploaded?', faqPrivacyAnswer: 'No. Cropping, signature cleanup and JPEG encoding happen in your browser. Your file stays on your device.', faqCheck: 'Should I check the notification again?', faqCheckAnswer: 'Yes. Check the current requirements in the official source above before submitting your application.', photo: 'Photo', signature: 'Signature', thumb: 'Left thumb', declaration: 'Handwritten declaration', offline: 'Works offline', offlineVerify: 'How to verify: turn off Wi-Fi and reload', home: 'Photo and signature resizer', related: 'More exam photo sizes', seoPhoto: 'photo size', seoSuffix: 'Resize photos and signatures free in your browser. No uploads. See official rules before applying.', hubDescription: 'Exam photo and signature sizes for IBPS, SBI, RBI, UGC NET, SSC and more. Resize JPEGs free in your browser without uploads. Check official requirements.', bankNote: 'Photo and signature pixel dimensions are preferred, not mandatory.', toolPhoto: 'photo', toolSignature: 'signature', toolTitles: ['{name} {kind} {kb}: resize yours here, no upload', '{name} {kind} {kb}: resize yours here', '{name} {kind} {kb} resizer'], toolDescriptions: ['Resize your {name} {thing} to {spec} here: crop, download the JPEG and upload it to the form. Runs in your browser, no uploads.', 'Resize your {name} {thing} to {spec} here: crop and download the JPEG. Runs in your browser, no uploads.'] };
const languagesFor = exam => exam.languages ?? ['en', 'hi'];
const px = dimensions => dimensions.width + 'x' + dimensions.height + ' px';
const pathFor = (lang, slug = '') => (lang === 'hi' ? '/hi' : '') + '/exam/' + (slug ? slug + '/' : '');

export function generatePages(presets, template, hi, origin = 'https://nouploads.in', unverified = []) {
  const exams = presets.filter(exam => exam.verified === true);
  const pages = new Map();
  for (const lang of ['en', 'hi']) {
    const t = lang === 'hi' ? hi : en;
    const available = exams.filter(exam => languagesFor(exam).includes(lang));
    const dimensionsText = spec => {
      const cm = spec.dimensionsCm ? spec.dimensionsCm.width + 'x' + spec.dimensionsCm.height + ' ' + (lang === 'hi' ? 'सेमी' : 'cm') : '';
      const pixels = spec.dimensions ? px(spec.dimensions) : spec.minDimensions ? t.minimum + ' ' + px(spec.minDimensions) + (spec.maxDimensions ? '; ' + t.maximum + ' ' + px(spec.maxDimensions) : '') : '';
      return pixels && cm ? pixels + ' (' + cm + ')' : pixels || cm || t.unspecified;
    };
    const frame = (slug, title, content, faq = []) => {
      const route = pathFor(lang, slug);
      const exam = exams.find(item => item.id === slug);
      const languages = exam ? languagesFor(exam) : ['en', 'hi'];
      const primary = exam?.photo ?? exam?.signature;
      const seoName = exam && ((lang === 'hi' ? hi.seoNames?.[exam.id] : undefined) ?? exam.seoName ?? exam.name);
      const kind = exam && (exam.photo ? t.seoPhoto : lang === 'hi' ? hi.seoSignature : 'signature size');
      const kb = exam && (primary.kbMin === null ? (lang === 'hi' ? hi.maximum + ' ' : 'max ') : primary.kbMin + '-') + primary.kbMax + ' KB';
      const spec = exam && (!exam.state && primary.dimensions ? (primary.preferred ? (lang === 'hi' ? 'सुझाए ' : 'suggested ') : '') + px(primary.dimensions) + ', ' : primary.minDimensions ? (lang === 'hi' ? t.minimum + ' ' : 'min ') + px(primary.minDimensions) + ', ' : '') + kb;
      const fill = text => text.replaceAll('{name}', seoName).replaceAll('{kind}', kind).replaceAll('{kb}', kb).replaceAll('{spec}', spec).replaceAll('{thing}', exam.photo ? t.toolPhoto : t.toolSignature);
      const pick = (templates, min, max) => templates.map(fill).find(text => text.length >= min && text.length <= max);
      const seoTitle = exam ? pick(t.toolTitles, 1, 60) ?? seoName + ' ' + kind + ' ' + spec : t.listTitle;
      const oldDescription = exam && seoName + ' ' + kind + ' ' + spec + (lang === 'hi' ? '। ' : '. ') + (exam.photo ? t.seoSuffix : lang === 'hi' ? 'हस्ताक्षर की फ़ाइल का आकार ब्राउज़र में बदलें। कोई अपलोड नहीं। आवेदन से पहले आधिकारिक नियम जाँचें।' : 'Resize signatures free in your browser, with no uploads. Check official requirements before applying.');
      const description = exam ? pick(t.toolDescriptions, 120, 160) ?? oldDescription : t.hubDescription;
      const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: t.home, item: origin + (lang === 'hi' ? '/hi/' : '/') }, { name: t.all, item: origin + pathFor(lang) }, ...(slug ? [{ name: exam.name, item: origin + route }] : [])].map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) };
      const data = [...(faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) }] : []), breadcrumb].map(jsonLd);
      let csp = "default-src 'none'; script-src 'self' " + data.map(scriptHash).join(' ') + "; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'self'; manifest-src 'self'";
      if (!slug) csp = csp.replace("; style-src-attr 'unsafe-inline'", '').replace("img-src 'self' blob:", "img-src 'self'");
      return '<!doctype html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="' + escape(csp) + '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escape(seoTitle) + '</title><meta name="description" content="' + escape(description) + '"><link rel="canonical" href="' + origin + route + '">' + languages.map(language => '<link rel="alternate" hreflang="' + language + '" href="' + origin + pathFor(language, slug) + '">').join('') + '<link rel="alternate" hreflang="x-default" href="' + origin + pathFor('en', slug) + '"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg"><meta name="theme-color" content="#285c43"><link rel="stylesheet" href="/src/style.css">' + socialTags(seoTitle, description, origin + route, lang) + data.map(ld => '<script type="application/ld+json">' + ld + '</script>').join('') + '</head><body data-tool="resizer" data-static-shell="true"' + (slug ? ' data-exam="' + escape(slug) + '"' : '') + '>' + pageHeader(lang, '/exam/' + (slug ? slug + '/' : ''), hi, languages) + '<main><div class="intro"><h1>' + escape(title) + '</h1><p>' + escape(t.description) + '</p></div>' + content + '</main>' + pageFooter(lang, '/exam/' + (slug ? slug + '/' : ''), hi, 'nouploads · ' + escape(t.faqPrivacyAnswer.replace(/^(?:No\. |नहीं। )/, '')) + '<span><strong data-offline-status>' + escape(t.offline) + '</strong><br>' + escape(t.offlineVerify) + '</span>', languages) + '<script type="module" src="/src/pwa.ts"></script>' + (slug ? '<script type="module" src="/src/main.ts"></script>' : '') + '</body></html>';
    };
    const summary = spec => {
      const dimensions = dimensionsText(spec) + (spec.preferred ? ' · ' + t.preferred : '');
      const size = spec.kbMax === null ? t.unspecified : (spec.kbMin === null ? t.maximum + ' ' : spec.kbMin + '-') + spec.kbMax + ' KB';
      return dimensions + ' · ' + size;
    };
    const cards = group => group.map(exam => '<li class="exam-card"><h3><a href="./' + escape(exam.id) + '/">' + escape(exam.name) + '</a></h3>' + (exam.state ? '<p>' + escape(lang === 'hi' ? hi.stateNames[exam.state] : exam.state) + '</p>' : '') + '<dl>' + (exam.photo ? '<div><dt>' + escape(t.photo) + '</dt><dd>' + escape(summary(exam.photo)) + '</dd></div>' : '') + (exam.signature ? '<div><dt>' + escape(t.signature) + '</dt><dd>' + escape(summary(exam.signature)) + '</dd></div>' : '') + '</dl><p>' + escape(t.verified) + ': <time datetime="' + escape(exam.verifiedOn) + '">' + escape(exam.verifiedOn) + '</time></p><a class="exam-source" href="' + escape(exam.sourceUrl) + '">' + escape(t.source) + '</a></li>').join('');
    pages.set(pathFor(lang) + 'index.html', frame('', t.listTitle, [false, true].map(state => '<section><h2>' + escape(state ? (lang === 'hi' ? hi.stateExams : 'State exams') : (lang === 'hi' ? hi.nationalExams : 'National exams')) + '</h2><ul class="exam-list">' + cards(available.filter(exam => !!exam.state === state)) + '</ul></section>').join('')));
    for (const exam of available) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exam.id)) throw new Error('Invalid exam slug');
      const specs = ['photo','signature','thumb','declaration'].filter(key => exam[key]);
      const primary = exam.photo ?? exam.signature;
      const initialMode = exam.photo ? 'photo' : 'signature';
      const title = lang === 'en' && exam.id === 'gate-2027' ? exam.name + ' photo size: ' + px(primary.minDimensions) + ' minimum, ' + primary.kbMax + ' KB maximum' : exam.name + ' ' + (exam.photo ? t.seoPhoto : lang === 'hi' ? hi.signatureTitle : 'signature size') + ' ' + (!exam.state && primary.dimensions ? (primary.preferred ? (lang === 'hi' ? 'सुझाए ' : 'suggested ') : '') + px(primary.dimensions) + ', ' : primary.minDimensions ? t.minimum + ' ' + px(primary.minDimensions) + ', ' : '') + (primary.kbMin === null ? t.maximum + ' ' : primary.kbMin + '-') + primary.kbMax + ' KB';
      const policy = primary.dimensions ? (primary.preferred ? t.bankNote : (lang === 'hi' ? 'ऊपर दिए पिक्सेल और फ़ाइल के आकार के नियम देखें।' : 'Use the pixel dimensions and file size limits shown above.')) : primary.minDimensions ? t.target + (primary.kbMax === null ? ' ' + t.noLimit : '') : t.choose;
      const note = lang === 'hi' ? (hi.examNotes?.[exam.id] ?? policy) : exam.notes;
      const rows = specs.map(key => {
        const spec = exam[key];
        const dimensions = dimensionsText(spec);
        const size = spec.kbMax === null ? t.unspecified : (spec.kbMin === null ? t.maximum + ' ' : spec.kbMin + '-') + spec.kbMax + ' KB';
        return '<tr><th scope="row">' + escape(t[key]) + '</th><td>' + escape(dimensions) + '</td><td>' + escape(size) + '</td><td>' + escape(spec.format === null ? t.unspecified : spec.format.split(',').map(format => ({ 'image/jpeg': 'JPG/JPEG', 'image/gif': 'GIF', 'image/png': 'PNG' })[format] ?? format).join('/')) + '</td><td>' + (spec.dpi ?? escape(t.unspecified)) + '</td><td>' + escape(spec.preferred ? t.preferred : spec.minDimensions ? t.target : '') + '</td></tr>';
      }).join('');
      const table = '<div class="spec-table"><table><caption>' + escape(exam.name + ' · ' + (exam.photo ? t.title : lang === 'hi' ? hi.signatureTitle : 'signature size')) + '</caption><thead><tr>' + ['upload','dimensions','size','format','dpi','notes'].map(key => '<th scope="col">' + escape(t[key]) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div><p>' + escape(policy) + '</p>';
      const verified = '<section class="preset"><div><h2 id="preset-title">' + escape(exam.name) + '</h2><p id="preset-note">' + escape(note) + '</p></div><div class="verification"><p id="verified-date">' + escape(t.verified) + ': ' + escape(exam.verifiedOn) + '</p><a id="source" href="' + escape(exam.sourceUrl) + '" rel="noopener noreferrer">' + escape(t.source) + '</a></div></section>';
      let tool = template.slice(template.indexOf('<div class="workspace">'), template.indexOf('  </main>'));
      const photo = primary;
      const initialDimensions = photo.dimensions ?? photo.minDimensions;
      tool = tool.replace('id="dimensions"></dd>', 'id="dimensions">' + escape(dimensionsText(photo)) + '</dd>')
        .replace('id="size-range"></dd>', 'id="size-range">' + escape((photo.kbMin === null ? t.maximum + ' ' : photo.kbMin + '-') + photo.kbMax + ' KB') + '</dd>')
        .replace('id="dpi"></dd>', 'id="dpi">' + escape(photo.dpi ?? t.unspecified) + '</dd>')
        .replace(/<fieldset class="mode">[\s\S]*?<\/fieldset>/, '<fieldset class="mode"><legend class="sr-only">' + escape(lang === 'hi' ? hi.translations['Image type'] : 'Image type') + '</legend>' + specs.map(key => '<label><input type="radio" name="mode" value="' + key + '"' + (key === initialMode ? ' checked' : '') + '><span>' + escape(t[key]) + '</span></label>').join('') + '</fieldset>');
      if (!initialDimensions) tool = tool.replace('id="output-size" hidden', 'id="output-size"');
      if (lang === 'hi') tool = translateMarkup(tool, hi);
      const faq = [[t.faqSize, policy], [t.faqPrivacy, t.faqPrivacyAnswer], [t.faqCheck, t.faqCheckAnswer]];
      const siblings = '<section><h2>' + escape(t.related) + '</h2><ul>' + available.filter(item => item.id !== exam.id).map(item => '<li><a href="' + pathFor(lang, item.id) + '">' + escape(item.name) + '</a></li>').join('') + '</ul></section>';
      const faqHtml = '<section class="faq"><h2>' + escape(t.faq) + '</h2>' + faq.map(([q,a]) => '<h3>' + escape(q) + '</h3><p>' + escape(a) + '</p>').join('') + '</section>';
      pages.set(pathFor(lang, exam.id) + 'index.html', frame(exam.id, title, verified + tool + table + faqHtml + siblings, faq));
    }
  }
  if (unverified.length) addUnverifiedPages(pages, unverified, exams, template, hi, origin);
  return pages;
}

export function discoveryFiles(pages, origin = 'https://nouploads.in', buildDate = new Date().toISOString().slice(0, 10)) {
  const routes = [...new Set(['/', '/pdf-unlock', ...[...pages.keys()].filter(path => !path.endsWith('/404.html')).map(path => path.replace(/index.html$/, '').replace('/pdf-unlock.html', '/pdf-unlock'))])];
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + routes.map(path => {
    const html = pages.get(path.endsWith('/pdf-unlock') ? path + '.html' : path.endsWith('.html') ? path : path + 'index.html');
    const date = html?.match(/id="verified-date">[^<]*?(\d{4}-\d{2}-\d{2})/)?.[1] ?? buildDate;
    const alternates = html ? [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(match => '<xhtml:link rel="alternate" hreflang="' + match[1] + '" href="' + match[2] + '"/>').join('') : '';
    return '<url><loc>' + escape(origin + path) + '</loc><lastmod>' + escape(date) + '</lastmod>' + alternates + '</url>';
  }).join('') + '</urlset>';
  return { sitemap, robots: 'User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml\n' };
}
