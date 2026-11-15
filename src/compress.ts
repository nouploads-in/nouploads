import { tr } from './locale';
export type Encoder = (quality: number) => Promise<Blob>;
export class KbLimitError extends Error {
  constructor(message: string, readonly smallestBytes: number) { super(message); }
}
export type CompressionResult = { blob: Blob; quality: number; belowMinimum: boolean };

export async function fitJpeg(encode: Encoder, minBytes: number, maxBytes: number): Promise<CompressionResult> {
  if (!Number.isFinite(minBytes) || !Number.isFinite(maxBytes) || minBytes < 0 || maxBytes < minBytes || maxBytes < 2) throw new Error(tr('Invalid byte limits.'));
  const ceiling = Math.ceil(maxBytes) - 1;
  const sample = async (quality: number) => {
    const blob = await encode(quality);
    if (blob.type !== 'image/jpeg' || blob.size === 0) throw new Error(tr('The browser could not encode a JPEG.'));
    return { blob, quality, belowMinimum: blob.size < minBytes };
  };
  const bestQuality = await sample(1);
  if (bestQuality.blob.size <= ceiling) return bestQuality;
  let best = await sample(0);
  if (best.blob.size > ceiling) throw new KbLimitError(tr('This image cannot fit under the KB limit at these dimensions. Try a simpler crop or a different image.'), best.blob.size);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step++) {
    const quality = (low + high) / 2;
    const candidate = await sample(quality);
    if (candidate.blob.size <= ceiling) {
      low = quality;
      if (candidate.blob.size > best.blob.size || (candidate.blob.size === best.blob.size && candidate.quality > best.quality)) best = candidate;
    } else high = quality;
  }
  return best;
}

export function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(tr('JPEG encoding failed. Try a smaller image.'))), 'image/jpeg', quality);
  });
}

export async function padJpeg(blob: Blob, minBytes: number, maxBytes: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const need = Math.ceil(minBytes) - bytes.length;
  if (need <= 0 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
  const total = Math.max(need, 4);
  if (bytes.length + total > Math.ceil(maxBytes) - 1) return blob;
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4] << 8) | bytes[5]);
  const padding = new Uint8Array(total);
  let offset = 0;
  while (offset < total) {
    let size = Math.min(total - offset, 65537);
    const left = total - offset - size;
    if (left > 0 && left < 4) size -= 4 - left;
    padding.set([0xff, 0xfe, (size - 2) >> 8, (size - 2) & 255], offset);
    offset += size;
  }
  const output = new Uint8Array(bytes.length + total);
  output.set(bytes.subarray(0, at), 0);
  output.set(padding, at);
  output.set(bytes.subarray(at), at + total);
  return new Blob([output], { type: 'image/jpeg' });
}
