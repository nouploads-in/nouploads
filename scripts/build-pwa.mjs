import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { auditCopy } from './audit-copy.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory = '') {
  const entries = await readdir(root + directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(directory + entry.name + '/') : [directory + entry.name]));
  return groups.flat().sort();
}
const files = (await walk()).filter(file => file !== 'sw.js');
auditCopy(new Map(await Promise.all(files.filter(file => file.endsWith('.html')).map(async file => ['/' + file, await readFile(root + file, 'utf8')]))));
const template = await readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
const precache = [...(await Promise.all(files.filter(file => file !== '_headers').map(async file => file.endsWith('.html') && (await readFile(root + file, 'utf8')).includes('data-custom-limits="true"') ? null : file))).filter(Boolean), 'sw.js'].sort().map(file => '/' + file);
const hash = createHash('sha256').update(template).update(JSON.stringify(precache));
for (const file of files) {
  hash.update(file).update('\0').update(await readFile(root + file)).update('\0');
}
const cache = 'noupload-' + hash.digest('hex');
const source = template.replace('__CACHE__', JSON.stringify(cache)).replace('__FILES__', JSON.stringify(precache));
await writeFile(root + 'sw.js', source);
console.log('PWA precache: ' + precache.length + ' files, ' + cache);
const bytes = (await Promise.all(precache.map(file => readFile(root + file.slice(1)).then(buffer => buffer.length)))).reduce((sum, size) => sum + size, 0);
console.log('PWA precache size: ' + bytes + ' bytes (' + (bytes / 1024 / 1024).toFixed(2) + ' MiB). Unverified pages excluded.');
