import './shell';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import './style.css';
import generalTools from '../presets/general-tools.json';
import { generalSpec } from './general';
import exams from '../presets/exams.json';
import { encodeCanvas, fitJpeg, KbLimitError, padJpeg } from './compress';
import { cleanSignature } from './signature';
import hi from '../presets/hi.json';
import { tr, errorMessage } from './locale';
import { customSpec, outputDimensions, withDpi, type Exam, type Mode } from './exam-spec';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const general = generalTools.find(tool => tool.id === document.body.dataset.general);
const uncropped = !!general && !general.crop;
const custom = document.body.dataset.customLimits === 'true';
const preset: Exam = (exams as Exam[]).find(exam => exam.id === document.body.dataset.exam && exam.verified) ?? (exams as Exam[])[0];
const hindi = document.documentElement.lang === 'hi';
const longSide = get<HTMLInputElement>('long-side');
const triple = !general && !custom && preset.signature?.layout === 'triple';
const labels = { photo: tr('Photo'), signature: triple ? tr('Triple signature') : tr('Signature'), thumb: tr('Left thumb'), declaration: tr('Handwritten declaration') };
let mode: Mode = general ? general.mode as Mode : custom || preset.photo ? 'photo' : 'signature';
const modeField = document.querySelector('.mode')!;
modeField.innerHTML = '<legend class="sr-only">' + tr('Image type') + '</legend>' + (Object.keys(labels) as Mode[]).filter(key => general ? key === general.mode : custom ? key === 'photo' || key === 'signature' : preset[key]).map(key => '<label><input type="radio" name="mode" value="' + key + '"' + (key === mode ? ' checked' : '') + '><span>' + labels[key] + '</span></label>').join('');
function currentSpec() {
  if (general) return generalSpec(get<HTMLInputElement>('general-max').value, general.kbRequired, general.pixels ? get<HTMLInputElement>('general-width').value : '', general.pixels ? get<HTMLInputElement>('general-height').value : '');
  if (!custom) return preset[mode]!;
  return customSpec(Object.fromEntries(['min', 'max', 'width', 'height', 'unit', 'dpi'].map(key => [key, get<HTMLInputElement>('custom-' + key).value])) as Parameters<typeof customSpec>[0]);
}
function aspectRatio() {
  if (general) return Number(get<HTMLSelectElement>('aspect-ratio').value);
  if (custom) {
    try { const dimensions = currentSpec().dimensions; return dimensions ? dimensions.width / dimensions.height : NaN; }
    catch { return NaN; }
  }
  const spec = preset[mode]!;
  const dimensions = spec.dimensions ?? spec.target ?? spec.minDimensions ?? spec.dimensionsCm;
  return dimensions ? dimensions.width / dimensions.height : NaN;
}
let cropper: Cropper | undefined;
let inputUrl: string | undefined;
let outputUrl: string | undefined;
let revision = 0;
let loadVersion = 0;
let busy = false;
let ready = false;
const image = get<HTMLImageElement>('image');
const file = get<HTMLInputElement>('file');
const generate = get<HTMLButtonElement>('generate');
const status = get('status');
const result = get('result');
const black = get<HTMLInputElement>('black');
const white = get<HTMLInputElement>('white');
const controls = [...document.querySelectorAll<HTMLButtonElement>('.crop-controls button')];

if (!custom && !general) {
  get('preset-title').textContent = preset.name;
  get('preset-note').textContent = hindi ? (hi.examNotes[preset.id as keyof typeof hi.examNotes] ?? (preset.thumb ? hi.bankNote : preset.photo?.minDimensions ? hi.target + ' ' + hi.noLimit : hi.choose)) : preset.notes;
  get('verified-date').textContent = tr('Source checked') + ': ' + preset.verifiedOn;
  get<HTMLAnchorElement>('source').href = preset.sourceUrl;
}

function invalidate() {
  revision++;
  result.hidden = true;
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = undefined;
  get<HTMLAnchorElement>('download').removeAttribute('href');
}

function updateSpec() {
  if (general) {
    get('signature-settings').hidden = mode !== 'signature';
    try { currentSpec(); get('general-error').textContent = ''; }
    catch (error) { get('general-error').textContent = errorMessage(error, 'Could not process this image.'); }
    return;
  }
  if (custom) {
    get('signature-settings').hidden = mode !== 'signature';
    get('output-size').hidden = false;
    try {
      const spec = currentSpec();
      get('output-size').hidden = !!spec.dimensions;
      get('custom-error').textContent = '';
    } catch (error) { get('custom-error').textContent = errorMessage(error, 'Could not process this image.'); }
    return;
  }
  const spec = preset[mode]!;
  const dimensions = spec.dimensions ?? spec.target ?? spec.minDimensions;
  const range = spec.minDimensions && spec.maxDimensions ? spec.minDimensions.width + '–' + spec.maxDimensions.width + ' × ' + spec.minDimensions.height + '–' + spec.maxDimensions.height + ' px' : '';
  get('dimensions').textContent = dimensions ? dimensions.width + ' × ' + dimensions.height + ' px' + (spec.preferred ? ' · ' + tr('Preferred, not mandatory') : spec.target && range ? ' · ' + tr('Allowed') + ' ' + range : spec.minDimensions ? ' · ' + tr('Targeting minimum dimensions') : '') : (spec.dimensionsCm ? spec.dimensionsCm.width + ' × ' + spec.dimensionsCm.height + ' ' + (hindi ? 'सेमी' : 'cm') + ' · ' : '') + tr('Choose output size');
  get('size-range').textContent = spec.kbMax === null ? tr('No KB limit stated') : (spec.kbMin === null ? '≤ ' : spec.kbMin + '–') + spec.kbMax + ' KB';
  get('dpi').textContent = spec.dpi === null ? tr('Not specified') : String(spec.dpi);
  get('output-size').hidden = !!dimensions;
  get('signature-settings').hidden = mode !== 'signature';
  get('triple-guide').hidden = !(triple && mode === 'signature');
}

function syncControls() {
  generate.disabled = !ready || busy;
  controls.forEach(button => button.disabled = !ready || busy);
}

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
  radio.addEventListener('change', () => {
    mode = radio.value as Mode;
    invalidate();
    updateSpec();
    cropper?.setAspectRatio(aspectRatio());
    status.textContent = ready ? tr('Crop updated. Create a new JPEG when ready.') : tr('Choose an image to begin.');
  });
}

file.addEventListener('change', async () => {
  const selected = file.files?.[0];
  if (!selected) return;
  const version = ++loadVersion;
  invalidate();
  cropper?.destroy();
  cropper = undefined;
  ready = false;
  syncControls();
  image.hidden = true;
  image.removeAttribute('src');
  get('empty').hidden = false;
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  inputUrl = undefined;
  get('file-info').textContent = '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 25 * 1024 * 1024) {
    status.textContent = tr('Choose a JPG, PNG or WebP image up to 25 MB.');
    file.value = '';
    return;
  }
  status.textContent = tr('Opening image…');
  const url = URL.createObjectURL(selected);
  inputUrl = url;
  const decoded = new Image();
  decoded.src = url;
  try {
    await decoded.decode();
    if (version !== loadVersion) return;
    if (decoded.naturalWidth * decoded.naturalHeight > 40_000_000) throw new Error(tr('This image is too large. Choose an image under 40 megapixels.'));
    image.src = url;
    await image.decode();
    if (version !== loadVersion) return;
    image.hidden = false;
    get('empty').hidden = true;
    get('file-info').textContent = selected.name + ' · ' + decoded.naturalWidth + ' × ' + decoded.naturalHeight + ' px. ' + tr('Drag the crop edges to frame your image. Scroll or pinch to zoom.');
    if (general) get('file-info').textContent = selected.name + ' · ' + decoded.naturalWidth + ' × ' + decoded.naturalHeight + ' px · ' + tr('Before') + ': ' + (selected.size / 1024).toFixed(2) + ' KB';
    if (uncropped) {
      ready = true;
      syncControls();
      status.textContent = tr('Image ready. Choose a maximum KB and create your JPEG.');
      return;
    }
    cropper = new Cropper(image, {
      aspectRatio: aspectRatio(),
      viewMode: 1,
      autoCropArea: 0.9,
      checkOrientation: false,
      checkCrossOrigin: false,
      background: false,
      ready() {
        if (version !== loadVersion) return;
        ready = true;
        syncControls();
        status.textContent = tr('Adjust the crop, then create your JPEG.');
      },
      crop() {
        invalidate();
        if (ready && !busy) status.textContent = tr('Crop updated. Create your JPEG when ready.');
      }
    });
  } catch (error) {
    if (version !== loadVersion) return;
    image.hidden = true;
    get('empty').hidden = false;
    URL.revokeObjectURL(url);
    inputUrl = undefined;
    file.value = '';
    status.textContent = errorMessage(error, 'This image could not be opened. Try another JPG, PNG or WebP.');
  }
});

get('zoom-in').onclick = () => cropper?.zoom(0.1);
get('zoom-out').onclick = () => cropper?.zoom(-0.1);
get('rotate').onclick = () => cropper?.rotate(90);
get('reset').onclick = () => cropper?.reset();
get('move-left').onclick = () => cropper?.move(-10, 0);
get('move-right').onclick = () => cropper?.move(10, 0);
get('move-up').onclick = () => cropper?.move(0, -10);
get('move-down').onclick = () => cropper?.move(0, 10);
for (const slider of [black, white]) slider.oninput = () => {
  get(slider.id + '-value').textContent = slider.value;
  invalidate();
  status.textContent = tr('Cleanup changed. Create a new JPEG to preview it.');
};

generate.onclick = async () => {
  if ((!cropper && !uncropped) || !ready || busy) return;
  invalidate();
  const current = revision;
  const currentMode = mode;
  busy = true;
  syncControls();
  status.textContent = tr('Resizing and finding the best JPEG quality…');
  try {
    const spec = currentSpec();
    const sourceSize = uncropped ? { width: image.naturalWidth, height: image.naturalHeight } : cropper!.getData();
    const side = general ? Math.min(4096, Math.round(Math.max(sourceSize.width, sourceSize.height))) : Number(longSide.value);
    const dimensions = outputDimensions(spec, sourceSize, side);
    let canvas: HTMLCanvasElement;
    if (uncropped) {
      canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error(tr('Canvas is unavailable in this browser.'));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else canvas = cropper!.getCroppedCanvas({ width: dimensions.width, height: dimensions.height, fillColor: '#fff', imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
    if (!canvas) throw new Error(tr('Unable to create the exact image dimensions. Try another crop.'));
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      const exact = document.createElement('canvas');
      exact.width = dimensions.width;
      exact.height = dimensions.height;
      const context = exact.getContext('2d');
      if (!context) throw new Error(tr('Canvas is unavailable in this browser.'));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(canvas, 0, 0, exact.width, exact.height);
      canvas = exact;
    }
    if (currentMode === 'signature') {
      const context = canvas.getContext('2d');
      if (!context) throw new Error(tr('Canvas is unavailable in this browser.'));
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      pixels.data.set(cleanSignature(pixels.data, Number(black.value), Number(white.value)));
      context.putImageData(pixels, 0, 0);
    }
    const encodeOf = (target: HTMLCanvasElement) => async (quality: number) => withDpi(await encodeCanvas(target, quality), spec.dpi);
    const minBytes = (spec.kbMin ?? 0) * 1024;
    let reduced = false;
    let padded = false;
    let compressed: Awaited<ReturnType<typeof fitJpeg>>;
    if (spec.kbMax === null) compressed = { blob: await encodeOf(canvas)(1), quality: 1, belowMinimum: false };
    else {
      const maxBytes = spec.kbMax * 1024;
      for (let attempt = 0; ; attempt++) {
        try {
          compressed = await fitJpeg(encodeOf(canvas), minBytes, maxBytes);
          break;
        } catch (error) {
          if (!(error instanceof KbLimitError) || !general || spec.dimensions || attempt >= 6) throw error;
          const factor = Math.min(0.9, Math.max(0.2, Math.sqrt((maxBytes - 1) / error.smallestBytes) * 0.9));
          const smaller = document.createElement('canvas');
          smaller.width = Math.max(1, Math.round(canvas.width * factor));
          smaller.height = Math.max(1, Math.round(canvas.height * factor));
          const smallerContext = smaller.getContext('2d');
          if (!smallerContext) throw error;
          smallerContext.imageSmoothingEnabled = true;
          smallerContext.imageSmoothingQuality = 'high';
          smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
          canvas = smaller;
          reduced = true;
        }
      }
      if (compressed.belowMinimum) {
        const filled = await padJpeg(compressed.blob, minBytes, maxBytes);
        if (filled !== compressed.blob) {
          compressed = { ...compressed, blob: filled, belowMinimum: false };
          padded = true;
        }
      }
    }
    if (current !== revision) return;
    outputUrl = URL.createObjectURL(compressed.blob);
    get<HTMLImageElement>('preview').src = outputUrl;
    const kb = compressed.blob.size / 1024;
    const name = currentMode + '_' + canvas.width + 'x' + canvas.height + '_' + Math.floor(kb) + 'kb.jpg';
    const download = get<HTMLAnchorElement>('download');
    download.href = outputUrl;
    download.download = name;
    get('result-info').textContent = (general ? tr('Before') + ': ' + ((file.files?.[0]?.size ?? 0) / 1024).toFixed(2) + ' KB · ' + tr('After') + ': ' : '') + canvas.width + ' × ' + canvas.height + ' px · ' + kb.toFixed(2) + ' KB (' + compressed.blob.size.toLocaleString() + ' ' + tr('bytes') + ') · JPEG';
    const warning = get('warning');
    warning.hidden = !compressed.belowMinimum;
    warning.textContent = tr('Below the minimum even at highest quality. This file may be rejected. Try a more detailed image.');
    result.hidden = false;
    status.textContent = compressed.belowMinimum ? tr('JPEG created, but the minimum size is not met.') : tr('JPEG ready. Review the preview before submitting.') + (reduced ? ' ' + tr('The pixel size was also reduced to meet the KB limit.') : '') + (padded ? ' ' + tr('Invisible filler data was added to reach the required minimum size.') : '');
  } catch (error) {
    if (current === revision) status.textContent = errorMessage(error, 'Could not process this image.');
  } finally {
    busy = false;
    syncControls();
  }
};

longSide.oninput = () => { invalidate(); status.textContent = tr('Crop updated. Create a new JPEG when ready.'); };

window.addEventListener('pagehide', () => {
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  if (outputUrl) URL.revokeObjectURL(outputUrl);
});
updateSpec();

if (custom) for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#custom-limits input, #custom-limits select')) input.addEventListener('input', () => {
  invalidate();
  updateSpec();
  cropper?.setAspectRatio(aspectRatio());
  status.textContent = tr('Crop updated. Create a new JPEG when ready.');
});

if (general) {
  for (const input of document.querySelectorAll<HTMLInputElement>('#general-settings input')) input.addEventListener('input', () => { invalidate(); updateSpec(); });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-kb]')) button.onclick = () => {
    get<HTMLInputElement>('general-max').value = button.dataset.kb!;
    invalidate();
    updateSpec();
  };
  get<HTMLSelectElement>('aspect-ratio').onchange = () => { invalidate(); cropper?.setAspectRatio(aspectRatio()); };
}
