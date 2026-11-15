import { expect, it } from 'vitest';
import exams from '../presets/exams.json';
import { outputDimensions, withDpi, type Exam } from '../src/exam-spec';

const presets = exams as Exam[];
it('validates optional exam schedules with real ISO dates and official sources', () => {
  for (const exam of presets) {
    if (exam.examDates === undefined) continue;
    expect(Array.isArray(exam.examDates)).toBe(true);
    expect(exam.examDates.length).toBeGreaterThan(0);
    for (const schedule of exam.examDates) {
      expect(Object.keys(schedule).every(key => ['label', 'dates', 'tentative', 'sourceUrl'].includes(key))).toBe(true);
      if (schedule.label !== undefined) {
        expect(typeof schedule.label).toBe('string');
        expect(schedule.label.trim().length).toBeGreaterThan(0);
      }
      expect(typeof schedule.tentative).toBe('boolean');
      expect(new URL(schedule.sourceUrl).protocol).toBe('https:');
      expect(Array.isArray(schedule.dates)).toBe(true);
      expect(schedule.dates.length).toBeGreaterThan(0);
      expect(schedule.dates).toEqual([...new Set(schedule.dates)].sort());
      for (const date of schedule.dates) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(date).toISOString().slice(0, 10)).toBe(date);
      }
    }
  }
});
it('keeps cropped aspect at 600 px by default and allows user sizes', () => {
  const spec = presets.find(exam => exam.id === 'jee-main')!.photo!;
  expect(outputDimensions(spec, { width: 400, height: 800 })).toEqual({ width: 300, height: 600 });
  expect(outputDimensions(spec, { width: 800, height: 400 }, 1000)).toEqual({ width: 1000, height: 500 });
  expect(() => outputDimensions(spec, { width: 1, height: 1 }, 1.5)).toThrow();
});
it('targets GATE minimums without inventing signature KB limits', () => {
  const exam = presets.find(exam => exam.id === 'gate-2027')!;
  expect(outputDimensions(exam.photo!, { width: 1000, height: 1000 })).toEqual({ width: 200, height: 260 });
  expect(outputDimensions(exam.signature, { width: 1000, height: 1000 })).toEqual({ width: 250, height: 80 });
  expect(exam.signature.kbMin).toBeNull();
  expect(exam.signature.kbMax).toBeNull();
});
it('targets RRB NTPC minimum signature dimensions with the stated KB limits', () => {
  const exam = presets.find(exam => exam.id === 'rrb-ntpc')!;
  expect(exam.photo).toBeUndefined();
  expect(exam.signature.dimensions).toBeNull();
  expect(exam.signature.maxDimensions).toBeUndefined();
  expect(outputDimensions(exam.signature, { width: 1000, height: 1000 })).toEqual({ width: 140, height: 60 });
  expect([exam.signature.kbMin, exam.signature.kbMax]).toEqual([30, 49]);
});
for (const id of ['csir-net', 'nift']) it(id + ' preserves crop proportions without inventing pixel requirements', () => {
  const exam = presets.find(exam => exam.id === id)!;
  for (const spec of [exam.photo!, exam.signature]) {
    expect(spec.dimensions).toBeNull();
    expect(spec.minDimensions).toBeUndefined();
    expect(spec.maxDimensions).toBeUndefined();
    expect(outputDimensions(spec, { width: 800, height: 400 })).toEqual({ width: 600, height: 300 });
  }
});
it('targets 400x500 for the UPSC triple signature inside the stated 350-500 px range', () => {
  const exam = presets.find(exam => exam.id === 'upsc-civil-services')!;
  const signature = exam.signature;
  expect(signature.layout).toBe('triple');
  expect(outputDimensions(signature, { width: 1000, height: 300 })).toEqual({ width: 400, height: 500 });
  for (const side of ['width', 'height'] as const) {
    expect(signature.target![side]).toBeGreaterThanOrEqual(signature.minDimensions![side]);
    expect(signature.target![side]).toBeLessThanOrEqual(signature.maxDimensions![side]);
  }
  expect([signature.kbMin, signature.kbMax]).toEqual([20, 100]);
  expect([exam.photo!.kbMin, exam.photo!.kbMax, exam.photo!.dimensions]).toEqual([20, 200, null]);
  expect(presets.filter(exam => exam.signature.layout === 'triple').every(exam => exam.signature.target)).toBe(true);
});
it('writes 200 DPI JFIF metadata and updates it without duplicating a segment', async () => {
  const original = new Blob([new Uint8Array([255,216,255,217])], { type: 'image/jpeg' });
  const result = await withDpi(original, 200);
  const bytes = new Uint8Array(await result.arrayBuffer());
  expect([...bytes.slice(13,18)]).toEqual([1,0,200,0,200]);
  expect([...bytes.slice(-2)]).toEqual([255,217]);
  const updated = await withDpi(result, 200);
  expect(updated.size).toBe(result.size);
  expect(new Uint8Array(await updated.arrayBuffer())).toEqual(bytes);
  expect(await withDpi(original, null)).toBe(original);
});
