import { readFileSync } from 'node:fs';
export const REPO_URL = 'https://github.com/nouploads-in/nouploads';
export const publicRoute = route => route === '/pdf-unlock.html' ? '/pdf-unlock' : route;
const pdf = JSON.parse(readFileSync(new URL('../presets/pdf-pages.json', import.meta.url), 'utf8'));
const pdfLabels = ['Unlock PDF', 'Remove PDF password', 'Private PDF password remover', 'Remove PDF password offline'];
const generalTools = JSON.parse(readFileSync(new URL('../presets/general-tools.json', import.meta.url), 'utf8'));
const info = JSON.parse(readFileSync(new URL('../presets/info-pages.json', import.meta.url), 'utf8'));
import { escape } from './seo.mjs';

export function pageHeader(lang, route, hi, languages = ['en', 'hi']) {
  const root = lang === 'hi' ? '/hi' : '';
  const tr = text => lang === 'hi' ? hi.translations[text] ?? text : text;
  const active = route.startsWith('/exam/') ? '/exam/' : route === '/pdf-unlock.html' || route.startsWith('/pdf-password/') || pdf.intents.some(page => route === '/' + page.id + '/') ? '/pdf-unlock' : route === '/' || generalTools.some(tool => route === '/' + tool.id + '/') ? '/' : '';
  const links = [['/', 'Photo & signature'], ['/pdf-unlock', 'PDF password remover'], ['/exam/', 'Exam photo sizes']];
  return '<header><a class="brand" href="' + root + '/"><img class="brand-mark" src="/favicon.svg" alt="" width="34" height="34">nouploads<span>.in</span></a><nav class="primary-nav" aria-label="' + escape(tr('Tools')) + '">' + links.map(([href, text]) => '<a href="' + root + href + '"' + (active === href ? ' aria-current="page"' : '') + '>' + escape(tr(text)) + '</a>').join('') + '</nav><div class="language-switch" role="group" aria-label="' + escape(tr('Language')) + '">' + [['en', 'EN'], ['hi', 'हिंदी']].filter(([language]) => languages.includes(language)).map(([language, label]) => language === lang ? '<span class="selected" lang="' + language + '">' + label + '</span>' : '<a data-language-switch lang="' + language + '" href="' + (language === 'hi' ? '/hi' : '') + publicRoute(route) + '">' + label + '</a>').join('') + '</div></header>';
}

export function pageFooter(lang, route, hi, note, languages = ['en', 'hi']) {
  note = note.replace(/<a\b[^>]*data-(?:repository|info)-link[^>]*>[\s\S]*?<\/a>/g, '');
  const root = lang === 'hi' ? '/hi' : '';
  const tr = text => lang === 'hi' ? hi.translations[text] ?? text : text;
  return '<footer><section><h2>' + escape(tr('Tools')) + '</h2><a href="' + root + '/">' + escape(tr('Photo & signature')) + '</a><a href="' + root + '/pdf-unlock">' + escape(tr('PDF password remover')) + '</a>' + pdf.intents.map((page, i) => '<a href="' + root + '/' + page.id + '/">' + escape(tr(pdfLabels[i])) + '</a>').join('') + '<a href="' + root + '/pdf-password/">' + escape(tr('PDF password help')) + '</a>' + generalTools.map(tool => '<a href="' + root + '/' + tool.id + '/">' + escape(tr(tool.label)) + '</a>').join('') + '</section><section><h2>' + escape(tr('Exams')) + '</h2><a href="' + root + '/exam/">' + escape(tr('Exam photo sizes')) + '</a></section><section><h2>' + escape(tr('Language')) + '</h2>' + languages.map(language => '<a lang="' + language + '" href="' + (language === 'hi' ? '/hi' : '') + publicRoute(route) + '">' + (language === 'hi' ? hi.languageName : 'English') + '</a>').join('') + '</section><section class="footer-note"><h2>' + escape(tr('Privacy')) + '</h2>' + note + repositoryLink(lang, hi) + infoLinks(lang) + '</section></footer>';
}

export function repositoryLink(lang, hi, url = REPO_URL) {
  return url ? '<a data-repository-link href="' + escape(url) + '" rel="noopener noreferrer external">' + escape(lang === 'hi' ? hi.translations['Source code'] : 'Source code') + '</a>' : '';
}

export function infoLinks(lang) {
  return info.pages.map(page => '<a data-info-link href="' + (lang === 'hi' ? '/hi' : '') + '/' + page.id + '/">' + escape(info.labels[lang][page.id]) + '</a>').join('');
}
