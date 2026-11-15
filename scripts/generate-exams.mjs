import { generalPages } from './general-pages.mjs';
import { pdfPages } from './pdf-pages.mjs';
import { toolPages } from './tool-pages.mjs';
import { copyFile, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePages, discoveryFiles } from './exam-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const [presets, hi, template] = await Promise.all([read('presets/exams.json').then(JSON.parse), read('presets/hi.json').then(JSON.parse), read('index.html')]);
const unverified = JSON.parse(await read('presets/unverified-exams.json'));
const pages = generatePages(presets, template, hi, undefined, unverified);
for (const [path, html] of toolPages({ '/index.html': template, '/pdf-unlock.html': await read('pdf-unlock.html'), '/404.html': await read('404.html') }, hi)) pages.set(path, html);
for (const [path, html] of generalPages(template, hi)) pages.set(path, html);
for (const [path, html] of pdfPages(await read('pdf-unlock.html'), hi)) pages.set(path, html);
for (const directory of ['exam', 'hi/exam']) {
  const target = resolve(root, directory);
  if (!target.startsWith(resolve(root) + sep)) throw new Error('Output outside project');
  await rm(target, { recursive: true, force: true });
}
for (const [path, html] of pages) {
  const target = resolve(root, '.' + path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
const { sitemap, robots } = discoveryFiles(pages);
await mkdir(resolve(root, 'public'), { recursive: true });
await writeFile(resolve(root, 'public/sitemap.xml'), sitemap);
await writeFile(resolve(root, 'public/robots.txt'), robots);
console.log('Generated ' + pages.size + ' static pages.');
await copyFile(resolve(root, 'THIRD-PARTY-NOTICES.md'), resolve(root, 'public/THIRD-PARTY-NOTICES.md'));
