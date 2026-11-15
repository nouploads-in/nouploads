import { createRequire } from 'node:module';
import { readFileSync, constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const entry = require.resolve('@neslinesli93/qpdf-wasm');
export const create = async () => {
  const diagnostics = { invalidPassword: false };
  const exports = { exports: {} };
  runInNewContext(readFileSync(entry, 'utf8'), {
    module: exports,
    exports: exports.exports,
    require,
    __dirname: dirname(entry),
    __filename: entry,
    process: { versions: { node: '24' }, argv: ['node', 'qpdf'], exitCode: 0, platform: 'win32', binding: () => ({ fs: constants }) },
    console: { log() {}, error(message) { diagnostics.invalidPassword ||= /invalid password/i.test(String(message)); } },
    TextDecoder,
    TextEncoder,
    WebAssembly,
    URL,
    setTimeout,
    clearTimeout,
    crypto: globalThis.crypto
  });
  const qpdf = await exports.exports({ locateFile: () => join(dirname(entry), 'qpdf.wasm') });
  qpdf.diagnostics = diagnostics;
  return qpdf;
};

export function tinyPdf() {
  let pdf = '%PDF-1.4\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\nendstream'
  ];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = pdf.length;
  pdf += 'xref\n0 5\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return new TextEncoder().encode(pdf);
}

