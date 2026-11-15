import { tr } from './locale';
export type Dimensions = { width: number; height: number };
export type UploadSpec = { dimensions: Dimensions | null; dimensionsCm?: Dimensions; minDimensions?: Dimensions; maxDimensions?: Dimensions; target?: Dimensions; layout?: 'triple'; kbMin: number | null; kbMax: number | null; format: string | null; dpi: number | null; preferred?: boolean };
export type Mode = 'photo' | 'signature' | 'thumb' | 'declaration';
export type Exam = { id: string; name: string; state?: string; languages?: string[]; verified: boolean; verifiedOn: string | null; sourceUrl: string; watchUrl?: string; window?: { opens?: string; closes: string }; examDates?: { label?: string; dates: string[]; tentative: boolean; sourceUrl: string }[]; notes: string; photo?: UploadSpec; signature: UploadSpec; thumb?: UploadSpec; declaration?: UploadSpec };

export function outputDimensions(spec: UploadSpec, crop: Dimensions, longSide = 600): Dimensions {
  const fixed = spec.dimensions ?? spec.target ?? spec.minDimensions;
  if (fixed) return fixed;
  if (!Number.isInteger(longSide) || longSide < 1 || longSide > 4096) throw new Error(tr('Choose a whole-number long side from 1 to 4096 px.'));
  const scale = longSide / Math.max(crop.width, crop.height);
  return { width: Math.max(1, Math.round(crop.width * scale)), height: Math.max(1, Math.round(crop.height * scale)) };
}

export async function withDpi(blob: Blob, dpi: number | null): Promise<Blob> {
  if (dpi === null) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const segment = new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,dpi >> 8,dpi & 255,dpi >> 8,dpi & 255,0,0]);
  if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error(tr('The browser could not encode a JPEG.'));
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 255) {
    const marker = bytes[offset + 1];
    if (marker === 218 || marker === 217) break;
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if (marker === 224 && String.fromCharCode(...bytes.slice(offset + 4, offset + 9)) === 'JFIF\0' && length >= 16) {
      bytes.set(segment.slice(11,16), offset + 11);
      return new Blob([bytes], { type: 'image/jpeg' });
    }
    offset += length + 2;
  }
  return new Blob([bytes.slice(0,2),segment,bytes.slice(2)], { type: 'image/jpeg' });
}

export type CustomLimits = { min: string; max: string; width: string; height: string; unit: string; dpi: string };
export function customSpec(values: CustomLimits): UploadSpec {
  const kbMin = Number(values.min);
  const kbMax = Number(values.max);
  if (!Number.isFinite(kbMin) || !Number.isFinite(kbMax) || kbMin <= 0 || kbMax < kbMin || kbMax > 25600 || kbMin * 1024 < 1) throw new Error(tr('Enter positive KB limits with maximum at least minimum, up to 25600 KB.'));
  let dimensions: Dimensions | null = null;
  let dpi: number | null = null;
  if (values.width.trim() || values.height.trim()) {
    let width = Number(values.width);
    let height = Number(values.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error(tr('Enter both width and height as positive numbers.'));
    if (values.unit === 'cm') {
      dpi = Number(values.dpi);
      if (!Number.isInteger(dpi) || dpi < 1 || dpi > 1200) throw new Error(tr('For cm dimensions, enter a whole-number DPI from 1 to 1200.'));
      width = Math.round(width * dpi / 2.54);
      height = Math.round(height * dpi / 2.54);
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096) throw new Error(tr('Output width and height must be whole pixels from 1 to 4096.'));
    dimensions = { width, height };
  }
  return { dimensions, kbMin, kbMax, dpi, format: 'image/jpeg' };
}
