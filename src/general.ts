import { tr } from './locale';
import type { UploadSpec } from './exam-spec';

export function generalSpec(max: string, required: boolean, width = '', height = ''): UploadSpec {
  const kbMax = max.trim() ? Number(max) : null;
  if ((required && kbMax === null) || (kbMax !== null && (!Number.isFinite(kbMax) || kbMax < 1 || kbMax > 25600))) throw new Error(tr('Enter a maximum from 1 to 25600 KB.'));
  let dimensions = null;
  if (width.trim() || height.trim()) {
    const w = Number(width), h = Number(height);
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 4096 || h > 4096) throw new Error(tr('Output width and height must be whole pixels from 1 to 4096.'));
    dimensions = { width: w, height: h };
  }
  return { dimensions, kbMin: null, kbMax, dpi: null, format: 'image/jpeg' };
}
