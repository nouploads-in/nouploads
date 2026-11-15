import { tr } from './locale';
import './style.css';
import './shell';
import type { PdfErrorCode } from './pdf-core';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const picker = get<HTMLInputElement>('file');
const password = get<HTMLInputElement>('password');
const form = get<HTMLFormElement>('unlock-form');
const status = get('status');
const result = get('result');
const download = get<HTMLAnchorElement>('download');
const unlock = get<HTMLButtonElement>('unlock');
let selected: File | undefined;
let worker: Worker | undefined;
let outputUrl: string | undefined;
let revision = 0;
let busy = false;
let cancel: (() => void) | undefined;

const errors: Record<PdfErrorCode, string> = {
  'not-encrypted': tr('This PDF is not encrypted. It does not need password removal.'),
  'wrong-password': tr('Wrong password. Enter the PDF password again to retry.'),
  'invalid-pdf': tr('This file could not be read as a valid PDF. Choose another PDF.'),
  processing: tr('Could not process this PDF. It may be damaged or unsupported. Try another PDF.')
};

function size(bytes: number) {
  return (bytes / 1024).toFixed(2) + ' KB (' + bytes.toLocaleString() + ' ' + tr('bytes') + ')';
}

function reset() {
  revision++;
  cancel?.();
  worker?.terminate();
  worker = undefined;
  cancel = undefined;
  busy = false;
  selected = undefined;
  password.value = '';
  picker.value = '';
  form.hidden = true;
  result.hidden = true;
  unlock.disabled = false;
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = undefined;
  download.removeAttribute('href');
  get('before').textContent = '—';
  get('after').textContent = '—';
  get('file-info').textContent = tr('Choose one password-protected PDF.');
}

async function process(file: File, current: number, secret?: string): Promise<{ encrypted: boolean; output?: ArrayBuffer }> {
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    secret = '';
    throw new Error(errors.processing);
  }
  if (current !== revision) {
    secret = '';
    new Uint8Array(bytes).fill(0);
    throw new Error(tr('Cancelled'));
  }
  return new Promise((resolve, reject) => {
    let active: Worker;
    try {
      active = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      secret = '';
      new Uint8Array(bytes).fill(0);
      reject(new Error(tr('The PDF tool could not start. Reload the page or try a newer browser.')));
      return;
    }
    worker = active;
    const finish = () => {
      active.terminate();
      if (worker === active) worker = undefined;
      cancel = undefined;
    };
    cancel = () => { finish(); reject(new Error(tr('Cancelled'))); };
    active.onmessage = (event: MessageEvent<{ encrypted: boolean; output?: ArrayBuffer; error?: PdfErrorCode }>) => {
      finish();
      if (event.data.error) reject(new Error(errors[event.data.error] ?? errors.processing));
      else resolve(event.data);
    };
    active.onerror = event => {
      event.preventDefault();
      finish();
      reject(new Error(tr('The PDF tool could not start. Reload the page or try a newer browser.')));
    };
    try {
      active.postMessage({ bytes, password: secret }, [bytes]);
    } catch {
      finish();
      new Uint8Array(bytes).fill(0);
      reject(new Error(errors.processing));
    } finally {
      secret = '';
    }
  });
}

async function choose(file: File) {
  reset();
  const current = revision;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    status.textContent = tr('Choose a PDF file.');
    return;
  }
  if (!file.size || file.size > 50 * 1024 * 1024) {
    status.textContent = tr('Choose a non-empty PDF up to 50 MB.');
    return;
  }
  selected = file;
  get('file-info').textContent = file.name;
  get('before').textContent = size(file.size);
  status.textContent = tr('Checking PDF encryption…');
  busy = true;
  try {
    const info = await process(file, current);
    if (current !== revision) return;
    if (!info.encrypted) {
      status.textContent = errors['not-encrypted'];
      selected = undefined;
      return;
    }
    form.hidden = false;
    status.textContent = tr('Encrypted PDF detected. Enter its password to unlock it.');
    password.focus();
  } catch (error) {
    if (current === revision) {
      selected = undefined;
      status.textContent = error instanceof Error ? error.message : errors.processing;
    }
  } finally {
    if (current === revision) busy = false;
  }
}

picker.onchange = () => {
  const file = picker.files?.[0];
  if (file) void choose(file);
};
const zone = get('drop-zone');
zone.ondragover = event => { event.preventDefault(); zone.classList.add('drag-over'); };
zone.ondragleave = () => zone.classList.remove('drag-over');
zone.ondrop = event => {
  event.preventDefault();
  zone.classList.remove('drag-over');
  const files = event.dataTransfer?.files;
  if (files?.length === 1) void choose(files[0]);
  else {
    reset();
    status.textContent = tr('Choose one PDF at a time.');
  }
};
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
get('clear').onclick = () => { reset(); status.textContent = tr('Choose a PDF to begin.'); };

form.onsubmit = async event => {
  event.preventDefault();
  if (!selected || busy) return;
  const current = revision;
  const file = selected;
  let secret = password.value;
  password.value = '';
  busy = true;
  unlock.disabled = true;
  status.textContent = tr('Removing password on your device…');
  try {
    const pending = process(file, current, secret);
    secret = '';
    const info = await pending;
    if (current !== revision) return;
    if (!info.output) throw new Error(errors.processing);
    const blob = new Blob([info.output], { type: 'application/pdf' });
    new Uint8Array(info.output).fill(0);
    outputUrl = URL.createObjectURL(blob);
    download.href = outputUrl;
    download.download = file.name.replace(/\.pdf$/i, '') + '_unlocked.pdf';
    get('after').textContent = size(blob.size);
    result.hidden = false;
    form.hidden = true;
    selected = undefined;
    status.textContent = tr('Unlocked PDF ready. The password has been cleared.');
  } catch (error) {
    if (current === revision) {
      status.textContent = error instanceof Error ? error.message : errors.processing;
      password.focus();
    }
  } finally {
    secret = '';
    if (current === revision) {
      password.value = '';
      busy = false;
      unlock.disabled = false;
    }
  }
};
window.addEventListener('pagehide', reset);
