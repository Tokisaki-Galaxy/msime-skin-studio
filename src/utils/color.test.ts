import { describe, expect, it } from 'vitest';
import { extractAlpha, hexToRgba, toOpaqueHex } from './color';

describe('extractAlpha', () => {
  it('八位十六进制取末尾两位，不是开头的两位', () => {
    // 水杉是 #RRGGBBAA，透明度在末尾
    expect(extractAlpha('#e9e8e89d')).toBeCloseTo(0x9d / 255, 5);
    expect(extractAlpha('#0000001f')).toBeCloseTo(0x1f / 255, 5);
    expect(extractAlpha('#3e3e3eb9')).toBeCloseTo(0xb9 / 255, 5);
  });

  it('四位十六进制取最后一位', () => {
    expect(extractAlpha('#e8a4')).toBeCloseTo(0x44 / 255, 5);
  });

  it('rgba 的 a 是 0-1 浮点', () => {
    expect(extractAlpha('rgba(255, 255, 255, 0.08)')).toBeCloseTo(0.08, 5);
    expect(extractAlpha('rgba(32, 32, 32, 0.92)')).toBeCloseTo(0.92, 5);
  });

  it('不透明的写法都返回 1', () => {
    expect(extractAlpha('#e9e8e8')).toBe(1);
    expect(extractAlpha('#e8a')).toBe(1);
    expect(extractAlpha('rgb(1, 2, 3)')).toBe(1);
    expect(extractAlpha(undefined)).toBe(1);
    expect(extractAlpha('')).toBe(1);
  });

  it('transparent 是 0', () => {
    expect(extractAlpha('transparent')).toBe(0);
  });
});

describe('toOpaqueHex', () => {
  it('八位十六进制去掉 alpha 后给色块用', () => {
    expect(toOpaqueHex('#e9e8e89d', '#000000')).toBe('#e9e8e8');
    expect(toOpaqueHex('#3e3e3eb9', '#000000')).toBe('#3e3e3e');
  });

  it('rgba 转成十六进制基色', () => {
    expect(toOpaqueHex('rgba(255, 255, 255, 0.08)', '#000000')).toBe('#ffffff');
    expect(toOpaqueHex('rgba(32, 32, 32, 0.92)', '#000000')).toBe('#202020');
  });

  it('三位缩写会展开', () => {
    expect(toOpaqueHex('#e8a', '#000000')).toBe('#ee88aa');
  });

  it('认不出的值回退', () => {
    expect(toOpaqueHex('notacolor', '#123456')).toBe('#123456');
    expect(toOpaqueHex('transparent', '#123456')).toBe('#123456');
    expect(toOpaqueHex(undefined, '#123456')).toBe('#123456');
  });
});

describe('hexToRgba', () => {
  it('保住传入的 alpha', () => {
    expect(hexToRgba('#ffffff', 0.08)).toBe('rgba(255, 255, 255, 0.08)');
    expect(hexToRgba('#202020', 0.92)).toBe('rgba(32, 32, 32, 0.92)');
  });

  it('不合法输入原样返回', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('#fff');
  });

  it('色块改色后透明度不丢，这是一开始丢 alpha 的根因', () => {
    const original = 'rgba(255, 255, 255, 0.08)';
    const alpha = extractAlpha(original);
    const picked = hexToRgba('#ff0000', alpha);
    expect(extractAlpha(picked)).toBeCloseTo(alpha, 5);
    expect(picked).toBe('rgba(255, 0, 0, 0.08)');
  });
});
