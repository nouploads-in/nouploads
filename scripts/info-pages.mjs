import { readFileSync } from 'node:fs';
import { pageHeader, pageFooter, REPO_URL } from './page-shell.mjs';
import { escape, jsonLd, scriptHash, socialTags } from './seo.mjs';

export const info = JSON.parse(readFileSync(new URL('../presets/info-pages.json', import.meta.url), 'utf8'));
const EMAIL = 'contact@nouploads.in';

export function infoPages(template, hi, origin = 'https://nouploads.in') {
  const pages = new Map();
  const links = { repo: '<a href="' + escape(REPO_URL) + '" rel="noopener noreferrer external">' + escape(REPO_URL.replace('https://', '')) + '</a>', email: '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>' };
  for (const lang of ['en', 'hi']) for (const page of info.pages) {
    const tr = text => lang === 'hi' ? hi.translations[text] ?? text : text;
    const root = lang === 'hi' ? '/hi' : '';
    const route = '/' + page.id + '/';
    const url = origin + root + route;
    const { title, description, heading, lead, sections } = page[lang];
    const data = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'nouploads', item: origin + root + '/' }, { name: heading, item: url }].map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })) }].map(jsonLd);
    const policy = template.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/ 'sha256-[^']+'/g, '').replace("script-src 'self'", "script-src 'self' " + data.map(scriptHash).join(' '));
    const body = sections.map(([name, text]) => '<section><h2>' + escape(name) + '</h2><p>' + escape(text).replace(/\{(repo|email)\}/g, (_, key) => links[key]) + '</p></section>').join('');
    pages.set(root + route + 'index.html', '<!doctype html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="' + escape(policy) + '"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escape(title) + '</title><meta name="description" content="' + escape(description) + '"><link rel="canonical" href="' + url + '">' + ['en', 'hi', 'x-default'].map(language => '<link rel="alternate" hreflang="' + language + '" href="' + origin + (language === 'hi' ? '/hi' : '') + route + '">').join('') + socialTags(title, description, url, lang) + '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg"><meta name="theme-color" content="#285c43"><link rel="stylesheet" href="/src/style.css">' + data.map(ld => '<script type="application/ld+json">' + ld + '</script>').join('') + '</head><body data-static-shell="true">' + pageHeader(lang, route, hi) + '<main class="info-page"><div class="intro"><h1>' + escape(heading) + '</h1><p>' + escape(lead) + '</p></div>' + body + '</main>' + pageFooter(lang, route, hi, '<span>' + escape(tr('nouploads · Local browser tools')) + '</span><span data-offline-status>' + escape(tr('Works offline')) + '</span>') + '<script type="module" src="/src/pwa.ts"></script></body></html>');
  }
  return pages;
}
