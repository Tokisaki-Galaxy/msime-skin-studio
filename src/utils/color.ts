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

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
  /** 原值是十六进制还是 rgb()/rgba() 写法，决定改 alpha 后保持哪种格式。 */
  kind: 'hex' | 'rgb';
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function roundAlpha(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

/** 解析水杉认的颜色写法，取不到返回 null。transparent 视作 alpha 0。 */
function parseColor(color: string | undefined): ParsedColor | null {
  if (!color) return null;
  const text = color.trim();
  if (/^transparent$/i.test(text)) return { r: 0, g: 0, b: 0, alpha: 0, kind: 'rgb' };

  const rgba = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      alpha: rgba[4] === undefined ? 1 : clamp01(Number(rgba[4])),
      kind: 'rgb'
    };
  }

  const hex = text.replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const alpha = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, alpha, kind: 'hex' };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, alpha, kind: 'hex' };
  }
  return null;
}

const toHex2 = (value: number) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');

/**
 * 只改颜色的透明度，保留 RGB 与原来的写法家族。
 * - 十六进制输入输出 #rrggbb（不透明）或 #rrggbbaa
 * - rgb()/rgba() 输入输出 rgb() 或 rgba()
 * - color 为空时用 fallback 的 RGB 当基色，alpha 由调用方给
 * - color 与 fallback 都认不出时原样返回 color，不破坏用户手写的值
 */
export function withAlpha(color: string | undefined, alpha: number, fallback?: string): string {
  const parsed = parseColor(color) ?? (fallback ? parseColor(fallback) : null);
  if (!parsed) return color ?? '';
  const a = roundAlpha(alpha);
  if (parsed.kind === 'hex') {
    const base = `#${toHex2(parsed.r)}${toHex2(parsed.g)}${toHex2(parsed.b)}`;
    return a >= 1 ? base : `${base}${toHex2(a * 255)}`;
  }
  return a >= 1
    ? `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`
    : `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`;
}

/** 透明度的百分比文案，面板与提示共用一份格式。 */
export function alphaPercent(alpha: number): string {
  return `${Math.round(clamp01(alpha) * 100)}%`;
}

/**
 * 判断一段文本是不是水杉能接受的颜色。用于文本框「边打边校验」：
 * 半成品（如 `#ff`、`rgba(1,2,`）返回 false，不被写进配置去触发一屏校验错误。
 * CSS 具名色与关键字（red、transparent 等）走字母分支放行。
 */
export function isColorText(text: string): boolean {
  const value = text.trim();
  if (value === '') return false;
  if (parseColor(value)) return true;
  return /^[a-z]+$/i.test(value);
}
