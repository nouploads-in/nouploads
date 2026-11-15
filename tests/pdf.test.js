import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { PdfError, processPdf } from '../src/pdf-core';

const require = createRequire(import.meta.url);
const entry = require.resolve('@neslinesli93/qpdf-wasm');
const create = async () => {
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

function tinyPdf() {
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

let encrypted;
beforeAll(async () => {
  const qpdf = await create();
  qpdf.FS.writeFile('/in.pdf', tinyPdf());
  expect(qpdf.callMain(['--check', '/in.pdf'])).toBe(0);
  expect(qpdf.callMain(['--encrypt', 'user', 'owner', '256', '--', '/in.pdf', '/enc.pdf'])).toBe(0);
  encrypted = new Uint8Array(qpdf.FS.readFile('/enc.pdf'));
  qpdf.HEAPU8.fill(0);
});

describe('qpdf PDF password removal', () => {
  it('detects encryption before asking for a password', async () => {
    expect(processPdf(await create(), encrypted.slice())).toEqual({ encrypted: true });
  });

  it('unlocks with the right password and produces a valid unencrypted PDF', async () => {
    const input = encrypted.slice();
    const qpdf = await create();
    const result = processPdf(qpdf, input, 'user');
    expect(result.output?.length).toBeGreaterThan(0);
    expect(input.every(byte => byte === 0)).toBe(true);
    expect(qpdf.HEAPU8.every(byte => byte === 0)).toBe(true);
    const check = await create();
    check.FS.writeFile('/out.pdf', result.output);
    expect(check.callMain(['--is-encrypted', '/out.pdf'])).toBe(2);
    expect(check.callMain(['--check', '/out.pdf'])).toBe(0);
  });

  it('fails with a wrong password and clears the processing memory', async () => {
    const qpdf = await create();
    const input = encrypted.slice();
    expect(() => processPdf(qpdf, input, 'wrong')).toThrowError(new PdfError('wrong-password'));
    expect(input.every(byte => byte === 0)).toBe(true);
    expect(qpdf.HEAPU8.every(byte => byte === 0)).toBe(true);
  });

  it('reports an unencrypted PDF without unlocking', async () => {
    expect(processPdf(await create(), tinyPdf())).toEqual({ encrypted: false });
    const qpdf = await create();
    expect(() => processPdf(qpdf, tinyPdf(), 'user')).toThrowError(new PdfError('not-encrypted'));
  });

  it('rejects corrupt PDFs', async () => {
    for (const text of ['not a pdf', '%PDF-1.4\ninvalid']) {
      const qpdf = await create();
      expect(() => processPdf(qpdf, new TextEncoder().encode(text))).toThrowError(new PdfError('invalid-pdf'));
    }
  });

  it('unlocks owner-restricted PDFs with an empty user password', async () => {
    const encrypt = await create();
    encrypt.FS.writeFile('/in.pdf', tinyPdf());
    expect(encrypt.callMain(['--encrypt', '', 'owner', '256', '--', '/in.pdf', '/enc.pdf'])).toBe(0);
    const bytes = new Uint8Array(encrypt.FS.readFile('/enc.pdf'));
    expect(processPdf(await create(), bytes.slice())).toEqual({ encrypted: true });
    expect(processPdf(await create(), bytes.slice(), '').output?.length).toBeGreaterThan(0);
  });

  it('accepts the owner password', async () => {
    expect(processPdf(await create(), encrypted.slice(), 'owner').output?.length).toBeGreaterThan(0);
  });
});
