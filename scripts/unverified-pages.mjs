import { pageHeader, pageFooter } from './page-shell.mjs';
import { translateMarkup } from './tool-pages.mjs';
import { escape, jsonLd, scriptHash, socialTags } from './seo.mjs';

const en = {
  heading: 'photo and signature size: set your own limits', title: 'photo and signature size - set your own limits', shortTitle: 'photo/signature size - custom limits',
  callout: 'We have not verified the official photo and signature requirements for {exam}. Open your official notification, find the size limits, and enter them below.',
  official: "Conducting body's official site", where: 'What to look for in the notification', location: 'Where to look', check: 'What to check',
  steps: [['{body} website', 'Open the current {exam} notification and application instructions.'], ['Photo and signature annexure', 'Find accepted formats, minimum and maximum KB, width, height and DPI.'], ['Application portal', 'Check whether a live photo or an uploaded file is needed. Use this tool only if JPEG is accepted.']],
  faq: 'Frequently asked questions', questions: ['Which limits should I enter for {exam}?', 'Are the official rules verified on this page?', 'Are my file or entered limits saved?'],
  answers: ['Use your current {exam} notification. Find instructions on the {body} site; official size limits are not listed here.', 'No. This page is unverified. Confirm the rules in the official notification and application portal before submitting.', 'No. Image processing runs in this browser. Your limits exist only in this page session.'],
  toolTitles: ['{exam} photo & signature resizer - no upload', '{exam} photo & signature resizer', '{exam} photo resizer'], toolDescriptions: ['Resize your {exam} photo and signature to the KB limit in your notification: crop, enter the limit, download a JPEG. Nothing is uploaded.', 'Resize your {exam} photo and signature to the KB limit in your notification and download a JPEG. Nothing is uploaded.'],
  hub: 'Browse the verified exam list', siblings: 'Other exams in this region', description: '{exam} photo and signature rules are unverified. Enter limits from your official notification and create a JPEG in your browser without uploads.'
};
const pathFor = (lang, id = '') => (lang === 'hi' ? '/hi' : '') + '/exam/' + (id ? id + '/' : '');

export function addUnverifiedPages(pages, exams, verified, template, hi, origin) {
  for (const lang of ['en', 'hi']) {
    const t = lang === 'hi' ? hi.unverified : en;
    const tr = text => lang === 'hi' ? hi.translations[text] ?? text : text;
    const available = exams.filter(exam => exam.languages.includes(lang));
    const badge = '<strong class="unverified-badge">' + escape(tr('Unverified')) + '</strong>';
    const groups = [...new Set(available.map(exam => exam.state))].sort();
    const hub = '<section id="unverified-exams"><h2>' + escape(tr('More exams (rules not yet verified)')) + '</h2>' + badge + groups.map(state => '<h3>' + escape(lang === 'hi' ? hi.stateNames[state] : state) + '</h3><ul>' + available.filter(exam => exam.state === state).map(exam => '<li><a href="' + pathFor(lang, exam.id) + '">' + escape(exam.name) + '</a></li>').join('') + '</ul>').join('') + '</section>';
    const hubPath = pathFor(lang) + 'index.html';
    pages.set(hubPath, pages.get(hubPath).replace('</main>', hub + '</main>'));
    for (const exam of available) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exam.id) || verified.some(item => item.id === exam.id)) throw new Error('Invalid or duplicate unverified exam');
      const fill = text => text.replaceAll('{exam}', exam.name).replaceAll('{body}', exam.body);
      const route = pathFor(lang, exam.id);
      const pick = (templates, min, max) => templates.map(fill).find(text => text.length >= min && text.length <= max);
      let title = pick(t.toolTitles, 1, 60) ?? exam.name + ' ' + t.title;
      if (title.length > 60) title = exam.name + ' ' + t.shortTitle;
      let description = pick(t.toolDescriptions, 120, 160) ?? fill(t.description);
      if (description.length > 160) description = lang === 'hi' ? exam.name + ' के फ़ोटो और हस्ताक्षर नियम सत्यापित नहीं हैं। अधिसूचना की सीमाएँ दर्ज करें और ब्राउज़र में JPEG बनाएँ। कोई फ़ाइल अपलोड नहीं होती।' : exam.name + ' photo and signature rules are unverified. Enter official limits and create a JPEG in your browser without uploads. Check your notification.';
      const faq = t.questions.map((question, index) => [fill(question), fill(t.answers[index])]);
      const data = [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'nouploads', item: origin + (lang === 'hi' ? '/hi/' : '/') }, { name: lang === 'hi' ? hi.all : 'All exams', item: origin + pathFor(lang) }, { name: exam.name, item: origin + route }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) }].map(jsonLd);
      const policy = template.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/ 'sha256-[^']+'/g, '').replace("script-src 'self'", "script-src 'self' " + data.map(scriptHash).join(' '));
      const inputs = [['min', 'Minimum KB (required)'], ['max', 'Maximum KB (required)'], ['width', 'Width (optional)'], ['height', 'Height (optional)']].map(([id, label]) => '<label for="custom-' + id + '">' + escape(tr(label)) + '</label><input id="custom-' + id + '" type="number" step="any" min="0" autocomplete="off"' + (['min', 'max'].includes(id) ? ' required' : '') + '>').join('');
      const custom = '<fieldset id="custom-limits"><legend>' + escape(tr('Custom limits')) + '</legend><p>' + escape(tr('Limits are used only for this session. Enter the limits from your notification.')) + '</p>' + inputs + '<label for="custom-unit">' + escape(tr('Unit')) + '</label><select id="custom-unit"><option value="px">px</option><option value="cm">' + escape(tr('cm')) + '</option></select><label for="custom-dpi">' + escape(tr('DPI for cm')) + '</label><input id="custom-dpi" type="number" autocomplete="off"><p id="custom-error" role="alert"></p></fieldset>';
      let tool = template.slice(template.indexOf('<div class="workspace">'), template.indexOf('  </main>')).replace(/<dl class="specs">[\s\S]*?<\/dl>/, custom).replace('id="output-size" hidden', 'id="output-size"');
      tool = tool.replace('1 KB = 1,024 bytes. JPEG quality is adjusted automatically.', lang === 'hi' ? 'JPEG की गुणवत्ता अपने आप चुनी जाती है।' : 'JPEG quality is adjusted automatically.');
      if (lang === 'hi') tool = translateMarkup(tool, hi);
      const official = '<a href="' + escape(exam.officialSiteUrl) + '" target="_blank" rel="noopener noreferrer external">' + escape(t.official) + '</a>';
      const siblings = [...available, ...verified.filter(item => (item.languages ?? ['en', 'hi']).includes(lang))].filter(item => item.id !== exam.id && (item.state ?? 'National') === exam.state);
      const content = '<div class="intro"><h1>' + escape(exam.name + ' ' + t.heading) + '</h1>' + badge + '<p class="warning">' + escape(fill(t.callout)) + ' ' + official + '</p><p>' + escape(exam.name + ' · ' + exam.body + ' · ' + (lang === 'hi' ? hi.stateNames[exam.state] : exam.state)) + '</p></div>' + tool + '<section><h2>' + escape(t.where) + '</h2><table><thead><tr><th>' + escape(t.location) + '</th><th>' + escape(t.check) + '</th></tr></thead><tbody>' + t.steps.map(row => '<tr>' + row.map(cell => '<td>' + escape(fill(cell)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></section><section><h2>' + escape(t.faq) + '</h2>' + faq.map(([q, a]) => '<h3>' + escape(q) + '</h3><p>' + escape(a) + '</p>').join('') + '</section><section><h2>' + escape(t.siblings) + '</h2><a href="' + pathFor(lang) + '">' + escape(t.hub) + '</a><ul>' + siblings.map(item => '<li><a href="' + pathFor(lang, item.id) + '">' + escape(item.name) + '</a></li>').join('') + '</ul></section>';
      pages.set(route + 'index.html', '<!doctype html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="' + escape(policy) + '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escape(title) + '</title><meta name="description" content="' + escape(description) + '"><link rel="canonical" href="' + origin + route + '">' + [...exam.languages, 'x-default'].map(language => '<link rel="alternate" hreflang="' + language + '" href="' + origin + pathFor(language === 'x-default' ? 'en' : language, exam.id) + '">').join('') + '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg"><meta name="theme-color" content="#285c43"><link rel="stylesheet" href="/src/style.css">' + socialTags(title, description, origin + route, lang) + data.map(ld => '<script type="application/ld+json">' + ld + '</script>').join('') + '</head><body data-tool="resizer" data-static-shell="true" data-custom-limits="true">' + pageHeader(lang, pathFor('en', exam.id), hi, exam.languages) + '<main>' + content + '</main>' + pageFooter(lang, pathFor('en', exam.id), hi, escape(tr('Your image stays with you.')), exam.languages) + '<script type="module" src="/src/pwa.ts"></script><script type="module" src="/src/main.ts"></script></body></html>');
    }
  }
}
