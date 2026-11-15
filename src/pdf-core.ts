export interface QpdfRuntime {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, bytes: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  HEAPU8: Uint8Array;
  diagnostics: { invalidPassword: boolean };
}

export type PdfErrorCode = 'not-encrypted' | 'wrong-password' | 'invalid-pdf' | 'processing';

export class PdfError extends Error {
  constructor(public readonly code: PdfErrorCode) {
    super(code);
  }
}

function run(qpdf: QpdfRuntime, args: string[]): number {
  qpdf.diagnostics.invalidPassword = false;
  try {
    return qpdf.callMain(args);
  } finally {
    args.fill('');
  }
}

function remove(qpdf: QpdfRuntime, path: string) {
  try {
    const bytes = qpdf.FS.readFile(path);
    bytes.fill(0);
    qpdf.FS.writeFile(path, bytes);
    qpdf.FS.unlink(path);
  } catch {}
}

export function processPdf(qpdf: QpdfRuntime, bytes: Uint8Array, password?: string): { encrypted: boolean; output?: Uint8Array } {
  try {
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new PdfError('invalid-pdf');
    qpdf.FS.writeFile('/in.pdf', bytes);
    const encrypted = run(qpdf, ['--is-encrypted', '/in.pdf']);
    if (encrypted !== 0 && encrypted !== 2) throw new PdfError('invalid-pdf');
    if (encrypted === 2 && !qpdf.diagnostics.invalidPassword) {
      const valid = run(qpdf, ['--check', '/in.pdf']);
      if (valid !== 0 && valid !== 3) throw new PdfError('invalid-pdf');
      if (password !== undefined) throw new PdfError('not-encrypted');
      return { encrypted: false };
    }
    if (password === undefined) return { encrypted: true };
    const args = ['--password=' + password, '--decrypt', '/in.pdf', '/out.pdf'];
    password = '';
    const code = run(qpdf, args);
    if (qpdf.diagnostics.invalidPassword) throw new PdfError('wrong-password');
    if (code !== 0 && code !== 3) throw new PdfError('processing');
    const output = qpdf.FS.readFile('/out.pdf').slice();
    if (run(qpdf, ['--is-encrypted', '/out.pdf']) !== 2) {
      output.fill(0);
      throw new PdfError('processing');
    }
    return { encrypted: true, output };
  } finally {
    password = '';
    bytes.fill(0);
    remove(qpdf, '/in.pdf');
    remove(qpdf, '/out.pdf');
    qpdf.HEAPU8.fill(0);
  }
}
