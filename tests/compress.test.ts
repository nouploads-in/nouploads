import { describe, expect, it, vi } from 'vitest';
import { encodeCanvas, fitJpeg, KbLimitError, padJpeg } from '../src/compress';

const jpeg = (size: number) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' });

describe('JPEG quality search', () => {
  it('finds a JPEG immediately below the maximum and above the minimum', async () => {
    const encode = vi.fn(async (quality: number) => jpeg(Math.round(1000 + quality * 100000)));
    const result = await fitJpeg(encode, 20 * 1024, 50 * 1024);
    expect(result.blob.size).toBeLessThan(50 * 1024);
    expect(result.blob.size).toBeGreaterThanOrEqual(50 * 1024 - 3);
    expect(result.belowMinimum).toBe(false);
    expect(encode.mock.calls.length).toBeLessThanOrEqual(18);
  });
  it('uses full quality if it already fits', async () => {
    const encode = vi.fn(async () => jpeg(25000));
    expect((await fitJpeg(encode, 20000, 50000)).quality).toBe(1);
    expect(encode).toHaveBeenCalledTimes(1);
  });
  it('never accepts a blob exactly at the maximum', async () => {
    const result = await fitJpeg(async quality => jpeg(quality === 1 ? 50000 : 49999), 20000, 50000);
    expect(result.blob.size).toBe(49999);
  });
  it('reports images that cannot reach the minimum without padding', async () => {
    const result = await fitJpeg(async () => jpeg(1000), 10000, 20000);
    expect(result.belowMinimum).toBe(true);
    expect(result.blob.size).toBe(1000);
  });
  it('rejects an impossible maximum', async () => {
    await expect(fitJpeg(async () => jpeg(30000), 10000, 20000)).rejects.toThrow('cannot fit');
  });
  it('handles quantized encoder sizes', async () => {
    const result = await fitJpeg(async quality => jpeg(1000 + Math.floor(quality * 10) * 5000), 10000, 20000);
    expect(result.blob.size).toBe(16000);
    expect(result.belowMinimum).toBe(false);
  });
  it('propagates encoding errors', async () => {
    await expect(fitJpeg(async () => { throw new Error('encoder failed'); }, 10, 20)).rejects.toThrow('encoder failed');
  });
  it('rejects empty or non-JPEG encoder output', async () => {
    await expect(fitJpeg(async () => jpeg(0), 10, 20)).rejects.toThrow('could not encode');
    await expect(fitJpeg(async () => new Blob(['png'], {type:'image/png'}), 10, 20)).rejects.toThrow('could not encode');
  });
  it.each([[20,10],[-1,10],[0,NaN],[NaN,20],[0,Infinity],[0,1]])('rejects invalid byte limits %s, %s', async (min, max) => {
    await expect(fitJpeg(async () => jpeg(1), min, max)).rejects.toThrow('Invalid byte limits');
  });
  it('calls canvas.toBlob with the requested JPEG quality', async () => {
    const blob = jpeg(20);
    const toBlob = vi.fn((callback: BlobCallback) => callback(blob));
    const canvas = { toBlob } as unknown as HTMLCanvasElement;
    expect(await encodeCanvas(canvas, 0.7)).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.7);
  });
  it('rejects a null canvas result', async () => {
    const canvas = {toBlob: (callback: BlobCallback) => callback(null)} as unknown as HTMLCanvasElement;
    await expect(encodeCanvas(canvas, 0.5)).rejects.toThrow('encoding failed');
  });
});

const tinyJpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0xff, 0xdb, 0, 4, 1, 2, 0xff, 0xd9])], { type: 'image/jpeg' });

describe('minimum size padding', () => {
  it('pads to the minimum with comment segments, keeping JFIF first and EOI last', async () => {
    const source = tinyJpeg();
    const out = new Uint8Array(await (await padJpeg(source, 10 * 1024, 20 * 1024)).arrayBuffer());
    expect(out.length).toBe(10 * 1024);
    expect(out.slice(0, 4)).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
    expect(out.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
    let at = 2;
    at += 2 + ((out[4] << 8) | out[5]);
    let comments = 0;
    while (out[at] === 0xff && out[at + 1] === 0xfe) { comments++; at += 2 + ((out[at + 2] << 8) | out[at + 3]); }
    expect(comments).toBeGreaterThan(0);
    expect(out[at]).toBe(0xff);
    expect(out[at + 1]).toBe(0xdb);
  });
  it('pads across several segments when more than 64 KB is needed', async () => {
    const out = await padJpeg(tinyJpeg(), 150 * 1024, 200 * 1024);
    expect(out.size).toBe(150 * 1024);
  });
  it('handles tiny shortfalls', async () => {
    for (const need of [1, 2, 3, 4, 5, 6, 7]) {
      const size = tinyJpeg().size;
      const out = new Uint8Array(await (await padJpeg(tinyJpeg(), size + need, 100000)).arrayBuffer());
      expect(out.length).toBeGreaterThanOrEqual(size + need);
      expect(out.length).toBeLessThanOrEqual(size + Math.max(need, 4));
      expect(out.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
    }
  });
  it('leaves files that already meet the minimum and refuses to exceed the maximum', async () => {
    const source = tinyJpeg();
    expect(await padJpeg(source, 10, 20000)).toBe(source);
    expect(await padJpeg(source, 5000, 4000)).toBe(source);
  });
  it('reports the smallest size when the limit cannot be met', async () => {
    const error = await fitJpeg(async () => jpeg(30000), 0, 20000).catch(failure => failure);
    expect(error).toBeInstanceOf(KbLimitError);
    expect(error.smallestBytes).toBe(30000);
  });
});
