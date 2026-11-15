import { describe, expect, it } from 'vitest';
import { cleanSignature } from '../src/signature';

describe('signature levels', () => {
  it('whitens paper and darkens ink', () => {
    expect([...cleanSignature(new Uint8ClampedArray([225,220,215,255,30,40,50,255]))]).toEqual([255,255,255,255,0,0,0,255]);
  });
  it('preserves grey anti-aliased strokes between the levels', () => {
    expect([...cleanSignature(new Uint8ClampedArray([135,135,135,255]))]).toEqual([128,128,128,255]);
  });
  it('uses luminance for colored ink', () => {
    const result = cleanSignature(new Uint8ClampedArray([0,0,200,255]));
    expect([...result]).toEqual([0,0,0,255]);
  });
  it('composites transparent pixels onto white', () => {
    expect([...cleanSignature(new Uint8ClampedArray([0,0,0,0]))]).toEqual([255,255,255,255]);
    const partial = cleanSignature(new Uint8ClampedArray([0,0,0,128]));
    expect(partial[0]).toBe(114);
    expect(partial[3]).toBe(255);
  });
  it('applies custom levels and clamps extremes', () => {
    expect([...cleanSignature(new Uint8ClampedArray([80,80,80,255,180,180,180,255]),80,180)]).toEqual([0,0,0,255,255,255,255,255]);
  });
  it('does not mutate the input', () => {
    const input = new Uint8ClampedArray([40,50,60,255]);
    const before = input.slice();
    expect(cleanSignature(input)).not.toBe(input);
    expect(input).toEqual(before);
  });
  it('accepts empty pixel data', () => {
    expect(cleanSignature(new Uint8ClampedArray())).toHaveLength(0);
  });
  it('rejects incomplete pixels and invalid levels', () => {
    expect(() => cleanSignature(new Uint8ClampedArray(3))).toThrow('RGBA');
    for (const [black,white] of [[100,100],[200,100],[-1,210],[0,256],[NaN,210],[60,Infinity]]) {
      expect(() => cleanSignature(new Uint8ClampedArray(4),black,white)).toThrow('levels');
    }
  });
});
