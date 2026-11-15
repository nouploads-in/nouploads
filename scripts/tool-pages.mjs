import { pageHeader, pageFooter, publicRoute } from './page-shell.mjs';
import { escape, scriptHash } from './seo.mjs';
import { pdfLinks } from './pdf-pages.mjs';

export function translateMarkup(html, hi) {
  const translate = value => {
    const key = value.trim();
    const translated = hi.translations[key];
    return translated ? value.replace(key, escape(translated)) : value;
  };
  return html.replace(/>([^<>]+)</g, (match, text) => '>' + translate(text) + '<').replace(/\b(alt|aria-label|title)="([^"]*)"/g, (match, name, value) => name + '="' + translate(value) + '"');
}

export function toolPages(templates, hi, origin = 'https://nouploads.in') {
  const pages = new Map();
  for (const [path, source] of Object.entries(templates)) {
    const route = path.replace(/index.html$/, '');
    const shown = publicRoute(route);
    const twin = '/hi' + shown;
    const alternates = [['en', shown], ['hi', twin], ['x-default', shown]].map(([lang, url]) => '<link rel="alternate" hreflang="' + lang + '" href="' + origin + url + '">').join('');
    const english = source.replace(/<link rel="alternate"[^>]*>/g, '').replace('</head>', alternates + '</head>');
    const frame = (html, lang) => html.replace(/<header>[\s\S]*?<\/header>/, pageHeader(lang, route, hi)).replace(/<footer>([\s\S]*?)<\/footer>/, (_, note) => pageFooter(lang, route, hi, note.match(/<section class="footer-note"><h2>[^<]*<\/h2>([\s\S]*?)<\/section>/)?.[1] ?? note));
    const extras = (html, lang) => route === '/pdf-unlock.html' ? html.replace(/<section class="more-tools" data-pdf-links="true">[\s\S]*?<\/section>/g, '').replace('</main>', pdfLinks(lang, hi) + '</main>') : html;
    pages.set(path, extras(frame(english, 'en'), 'en'));
    let hindi = english.replace('<html lang="en">', '<html lang="hi">');
    const scripts = [];
    hindi = hindi.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (tag, text) => {
      const localize = value => typeof value === 'string' ? hi.translations[value] ?? (value.startsWith(origin) && value !== origin + '/share.png' ? value.replace(origin, origin + '/hi') : value) : Array.isArray(value) ? value.map(localize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item)])) : value;
      const data = localize(JSON.parse(text));
      data.inLanguage = 'hi';
      const translated = JSON.stringify(data).replace(/</g, '\\u003c');
      scripts.push([scriptHash(text), scriptHash(translated)]);
      return '<script type="application/ld+json">' + translated + '</script>';
    });
    hindi = translateMarkup(hindi, hi);
    hindi = hindi.replace(/<meta (name|property)="([^"]+)" content="([^"]*)">/g, (tag, kind, key, value) => {
      if (hi.translations[value]) return '<meta ' + kind + '="' + key + '" content="' + escape(hi.translations[value]) + '">';
      if (key === 'og:url') return tag.replace(origin + shown, origin + twin);
      if (key === 'og:locale') return tag.replace('en_IN', 'hi_IN');
      return tag;
    }).replace('rel="canonical" href="' + origin + shown + '"', 'rel="canonical" href="' + origin + twin + '"');
    hindi = hindi.replace(/<a\b([^>]*)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (tag, before, href, after, label) => {
      if (/\blang="hi"/.test(before + after)) return '<a data-language-switch lang="en" href="' + shown + '">English</a>';
      if (href.startsWith('/') && !href.startsWith('/hi/')) return '<a' + before + 'href="/hi' + href + '"' + after + '>' + label + '</a>';
      return tag;
    }).replace('href="./favicon.svg"', 'href="/favicon.svg"');
    for (const [before, after] of scripts) hindi = hindi.replace(before, after);
    pages.set('/hi' + path, extras(frame(hindi, 'hi'), 'hi'));
  }
  return pages;
}
