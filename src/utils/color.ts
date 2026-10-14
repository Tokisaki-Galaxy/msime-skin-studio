// 颜色取值与原生 <input type="color"> 之间的换算。
//
// 水杉的色值格式：
//   #rgb / #rgba / #rrggbb / #rrggbbaa  —— 透明度在**末尾**，是 CSS 的写法，不是 Windows 的 #AARRGGBB
//   rgb(r, g, b) / rgba(r, g, b, a)     —— a 是 0-1 浮点
//   transparent
// 而 <input type="color"> 只认 #rrggbb，所以色块和文本框要分开处理：
// 文本框保留原值，色块只负责改 RGB，改动时把原来的 alpha 补回去。

/** 取颜色的不透明度，取不到按 1 处理。 */
export function extractAlpha(color: string | undefined): number {
  if (!color) return 1;
  const text = color.trim();

  if (/^transparent$/i.test(text)) return 0;

  const rgba = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    if (rgba[4] === undefined) return 1;
    const a = Number(rgba[4]);
    return Number.isNaN(a) ? 1 : Math.min(1, Math.max(0, a));
  }

  const hex = text.replace(/^#/, '');
  if (/^[0-9a-fA-F]+$/.test(hex)) {
    if (hex.length === 4) return parseInt(hex[3] + hex[3], 16) / 255;
    if (hex.length === 8) return parseInt(hex.slice(6, 8), 16) / 255;
  }
  return 1;
}

/** 把任意支持的颜色折成 #rrggbb，供原生色块使用；无法解析时回退。 */
export function toOpaqueHex(color: string | undefined, fallback: string): string {
  const norm = (value: string) => (/^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback);

  if (!color) return fallback;
  const text = color.trim();
  if (/^transparent$/i.test(text)) return fallback;

  const rgba = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i);
  if (rgba) {
    const part = (v: string) => Math.min(255, Math.max(0, Number(v))).toString(16).padStart(2, '0');
    return `#${part(rgba[1])}${part(rgba[2])}${part(rgba[3])}`;
  }

  const hex = text.replace(/^#/, '');
  if (/^[0-9a-fA-F]+$/.test(hex)) {
    if (hex.length === 3 || hex.length === 4) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }
    if (hex.length === 6 || hex.length === 8) {
      return `#${hex.slice(0, 6)}`.toLowerCase();
    }
  }
  return norm(text);
}

/** 用给定的 RGB 与 alpha 生成 rgba()。 */
export function hexToRgba(hex: string, alpha: number): string {
  const text = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return hex;
  const r = parseInt(text.slice(0, 2), 16);
  const g = parseInt(text.slice(2, 4), 16);
  const b = parseInt(text.slice(4, 6), 16);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
