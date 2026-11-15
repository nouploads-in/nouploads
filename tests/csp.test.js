import { generalPages } from '../scripts/general-pages.mjs';
import { infoPages } from '../scripts/info-pages.mjs';
import { pdfPages } from '../scripts/pdf-pages.mjs';
import { toolPages } from '../scripts/tool-pages.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generatePages } from '../scripts/exam-pages.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pages = generatePages(JSON.parse(read('presets/exams.json')), read('index.html'), JSON.parse(read('presets/hi.json')));
for (const [path, html] of toolPages(Object.fromEntries(['index.html', 'pdf-unlock.html', '404.html'].map(path => ['/' + path, read(path)])), JSON.parse(read('presets/hi.json')))) pages.set(path, html);
for (const [path, html] of generalPages(read('index.html'), JSON.parse(read('presets/hi.json')))) pages.set(path, html);
for (const [path, html] of infoPages(read('index.html'), JSON.parse(read('presets/hi.json')))) pages.set(path, html);
for (const [path, html] of pdfPages(read('pdf-unlock.html'), JSON.parse(read('presets/hi.json')))) pages.set(path, html);

const decode = value => value.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
for (const [path, html] of pages) {
  it(path + ' permits only local code, hashed inline scripts and self connections', () => {
    const meta = html.match(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i);
    expect(meta).not.toBeNull();
    const directives = new Map(decode(meta[1]).split(';').map(part => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }));
    expect(directives.get('connect-src')).toEqual(["'self'"]);
    expect(directives.get('worker-src')).toEqual(["'self'"]);
    expect(directives.get('manifest-src')).toEqual(["'self'"]);
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
    expect(directives.get('script-src').includes("'wasm-unsafe-eval'")).toBe(html.includes('data-tool="pdf"'));
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('src="/src/pwa.ts"');
    expect(html).not.toMatch(/URL pending|repo-url-pending/);
    expect(html).not.toMatch(/\son\w+\s*=/i);
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = script[1].match(/\bsrc="([^"]+)"/);
      if (!src) expect(directives.get('script-src')).toContain("'sha256-" + createHash('sha256').update(script[2]).digest('base64') + "'");
    }
    for (const tag of html.matchAll(/<(script|link|iframe|object|embed)\b([^>]*)>/gi)) {
      if (tag[1].toLowerCase() === 'link' && !/\brel="(?:stylesheet|modulepreload|preload|prefetch|manifest|icon)"/i.test(tag[2])) continue;
      for (const attribute of tag[2].matchAll(/\b(?:src|href|data)="([^"]+)"/gi)) {
        const url = new URL(decode(attribute[1]), 'https://local.test' + path);
        expect(url.origin).toBe('https://local.test');
      }
    }
  });
}
