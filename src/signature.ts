import { tr } from './locale';
export function cleanSignature(pixels: Uint8ClampedArray, blackPoint = 60, whitePoint = 210): Uint8ClampedArray {
  if (pixels.length % 4 !== 0) throw new Error(tr('Expected RGBA pixels.'));
  if (!Number.isFinite(blackPoint) || !Number.isFinite(whitePoint) || blackPoint < 0 || whitePoint > 255 || blackPoint >= whitePoint) throw new Error(tr('Invalid signature levels.'));
  const output = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const luminance = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) * alpha + 255 * (1 - alpha);
    const level = Math.round(255 * Math.max(0, Math.min(1, (luminance - blackPoint) / (whitePoint - blackPoint))));
    output[i] = output[i + 1] = output[i + 2] = level;
    output[i + 3] = 255;
  }
  return output;
}
