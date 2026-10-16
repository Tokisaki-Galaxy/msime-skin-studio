import { describe, expect, it } from 'vitest';
import { alphaPercent, extractAlpha, hexToRgba, toOpaqueHex, withAlpha } from './color';

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

describe('withAlpha', () => {
  it('十六进制改透明度，保持十六进制写法', () => {
    // 0.5 * 255 = 127.5，四舍五入 128 -> 0x80
    expect(withAlpha('#ff0000', 0.5)).toBe('#ff000080');
    expect(withAlpha('#ff0000', 1)).toBe('#ff0000');
    expect(withAlpha('#ff0000', 0)).toBe('#ff000000');
  });

  it('rgba 改透明度，保持 rgb 写法', () => {
    expect(withAlpha('rgba(32, 32, 32, 0.92)', 0.5)).toBe('rgba(32, 32, 32, 0.5)');
    expect(withAlpha('rgb(1, 2, 3)', 0.25)).toBe('rgba(1, 2, 3, 0.25)');
    expect(withAlpha('rgb(1, 2, 3)', 1)).toBe('rgb(1, 2, 3)');
  });

  it('八位十六进制的原透明度会被替换而不是叠加', () => {
    expect(withAlpha('#11223380', 1)).toBe('#112233');
    expect(withAlpha('#11223380', 0.2)).toBe('#11223333');
  });

  it('值为空时用 fallback 的 RGB 接住，透明 draft 也有底可调', () => {
    expect(withAlpha('', 0.5, '#abcdef')).toBe('#abcdef80');
    expect(withAlpha(undefined, 0.5, 'rgba(10, 20, 30, 1)')).toBe('rgba(10, 20, 30, 0.5)');
  });

  it('都认不出时原样返回，不覆盖用户手写的关键字', () => {
    expect(withAlpha('currentColor', 0.5)).toBe('currentColor');
    expect(withAlpha('', 0.5)).toBe('');
  });

  it('transparent 当作黑色透明，可继续调到不透明', () => {
    expect(withAlpha('transparent', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });
});

describe('alphaPercent', () => {
  it('四舍五入成百分比文案', () => {
    expect(alphaPercent(0.08)).toBe('8%');
    expect(alphaPercent(0.999)).toBe('100%');
    expect(alphaPercent(1.4)).toBe('100%');
  });
});
