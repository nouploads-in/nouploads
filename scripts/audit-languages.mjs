import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const literalTokens = [...JSON.parse(readFileSync(new URL('../presets/hi.json', import.meta.url), 'utf8')).pdfPages.literalTokens, ...JSON.parse(readFileSync(new URL('../presets/info-pages.json', import.meta.url), 'utf8')).tokens];

export function auditLanguages(pages, examNames) {
  const targetPath = route => route.endsWith('/') ? route + 'index.html' : route.endsWith('/pdf-unlock') ? route + '.html' : route;
  for (const [path, html] of pages) {
    const hindi = path.startsWith('/hi/');
    const twin = hindi ? path.slice(3) : '/hi' + path;
    if (!pages.has(twin)) {
      assert.ok(!hindi, path + ': missing English page');
      assert.doesNotMatch(html, /data-language-switch|lang="hi"|hreflang="hi"/, path + ': unavailable Hindi link');
      continue;
    }
    const switcher = html.match(/<a\b[^>]*data-language-switch[^>]*>/)?.[0];
    assert.ok(switcher, path + ': missing language switcher');
    const href = switcher.match(/href="([^"]+)"/)?.[1];
    assert.equal(targetPath(new URL(href, 'https://nouploads.in' + path).pathname), twin, path + ': switcher equivalent');
    if (!hindi) continue;
    const body = html.replace('nouploads<span>.in</span>', 'nouploads.in').replace(/<span class="selected" lang="en">EN<\/span>/g, '').replace(/<a\b[^>]*lang="en"[^>]*>(?:English|EN)<\/a>/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<a\b[^>]*data-language-switch[^>]*>[\s\S]*?<\/a>/g, '');
    const visible = [...body.matchAll(/>([^<>]+)</g)].map(match => match[1]).concat([...body.matchAll(/\b(?:alt|aria-label|title)="([^"]+)"/g)].map(match => match[1])).join(' ');
    let remaining = visible;
    for (const name of [...examNames, ...literalTokens, 'CRP PO/MT-XVI', 'CRP CSA-XVI', 'CRPD/CR/2026-27/17', 'CRP RRBs XV', 'CRPD/APPR/2026-27/07', '05/Grade A/2025-26', 'IBPS', 'NTA', 'OTR', 'UPSC', 'NDA', 'NA', 'CDS', 'CAPF', 'ESE', 'CSE', 'PCS', 'nouploads.in', 'nouploads', 'Wi-Fi', 'WebP', 'JPEG', 'JPG', 'PNG', 'GIF', 'PDF', 'DPI', 'KB', 'MB', 'px'].sort((a,b) => b.length - a.length)) remaining = remaining.replaceAll(name, '');
    assert.doesNotMatch(remaining, /[a-zA-Z]{2,}/, path + ': untranslated visible text');
  }
}
