import createModule from '@neslinesli93/qpdf-wasm';
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { PdfError, processPdf, type QpdfRuntime } from './pdf-core';

const diagnostics = { invalidPassword: false };
console.log = () => {};
console.error = message => { diagnostics.invalidPassword ||= /invalid password/i.test(String(message)); };

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; password?: string }>) => {
  const request = event.data;
  try {
    const qpdf = await createModule({ locateFile: () => wasmUrl }) as unknown as QpdfRuntime;
    qpdf.diagnostics = diagnostics;
    const result = processPdf(qpdf, new Uint8Array(request.bytes), request.password);
    request.password = '';
    if (result.output) {
      self.postMessage({ encrypted: result.encrypted, output: result.output.buffer }, { transfer: [result.output.buffer] });
    } else {
      self.postMessage({ encrypted: result.encrypted });
    }
  } catch (error) {
    self.postMessage({ error: error instanceof PdfError ? error.code : 'processing' });
  } finally {
    request.password = '';
    new Uint8Array(request.bytes).fill(0);
    self.close();
  }
};
