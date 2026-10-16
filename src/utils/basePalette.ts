import { BuiltInSkin, ThemeName } from '../types/skin';
import { baseSkinCss } from '../skins';

// 右侧面板里每个配色字段留空时都「沿用 base」。以前这句话只是一行提示，用户看不到
// 实际生效的颜色，只能靠猜或翻水杉的 CSS。这里把内置皮肤 CSS 里的继承值抽出来，
// 面板就能把「当前实际效果」直接摆给用户看。
//
// 数据源是 src/skins/ 下那份拷贝，与水杉宿主注入的完全同源，基础皮肤更新后重新拷
// 一次 CSS，这里会跟着变，不需要另维护一张色表。

/** 面板里需要展示继承值的配色键，与 CandidateColors 的字段名对齐。 */
export type InheritedColorKey =
  | 'text'
  | 'preedit_text'
  | 'number'
  | 'accent'
  | 'surface'
  | 'border'
  | 'selected'
  | 'hover'
  | 'preedit_caret'
  | 'selected_text'
  | 'selected_number'
  | 'selected_bar'
  | 'translation'
  | 'translation_pos'
  | 'translation_separator'
  | 'selected_translation'
  | 'selected_translation_pos'
  | 'selected_translation_separator'
  | 'preedit_background'
  | 'preedit_divider';

export type InheritedPalette = Partial<Record<InheritedColorKey, string>>;

interface CssBlock {
  selectors: string[];
  body: string;
}

/** 把 CSS 拆成块，选择器按逗号拆开，方便匹配 `a, b { ... }` 这类组合写法。 */
function scanBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const brace = css.indexOf('{', cursor);
    if (brace < 0) break;
    const selectorText = css.slice(cursor, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const end = css.indexOf('}', brace);
    if (end < 0) break;
    const body = css.slice(brace + 1, end);
    if (selectorText) {
      blocks.push({
        selectors: selectorText.split(',').map(s => s.trim()).filter(Boolean),
        body
      });
    }
    cursor = end + 1;
  }
  return blocks;
}

function declaration(body: string, property: string): string {
  const re = new RegExp(`(?:^|[;{])\\s*${property}\\s*:\\s*([^;]+)(?:;|$)`);
  const match = body.match(re);
  return match ? match[1].trim() : '';
}

/** 收集所有 `--var: value;`，后者覆盖前者，与 CSS 层叠一致。 */
function variableTable(blocks: CssBlock[]): Record<string, string> {
  const table: Record<string, string> = {};
  for (const block of blocks) {
    const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(block.body)) !== null) table[match[1]] = match[2].trim();
  }
  return table;
}

/** 把 var(--x) 溯源到变量表，解析不出就原样返回。 */
function resolveVars(value: string, vars: Record<string, string>, depth = 0): string {
  if (!value || depth > 6) return value;
  return value.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*([^)]+))?\)/gi, (whole, name: string, fallback?: string) => {
    const found = vars[name] ?? fallback?.trim();
    return found ? resolveVars(found, vars, depth + 1) : whole;
  });
}

/** 从 `.container` 的 border 简写值里取出颜色部分。 */
function borderColor(shorthand: string): string {
  if (!shorthand) return '';
  const match = shorthand.match(/^[\d.]+px\s+\w+\s+([\s\S]+)$/);
  return match ? match[1].trim() : shorthand;
}

/** 取背景色，`background-color` 优先，兼容 `background` 简写。 */
function backgroundOf(body: string): string {
  return declaration(body, 'background-color') || declaration(body, 'background');
}

/**
 * 在块表里找最后一个匹配某选择器的块，取指定属性。
 * 命中后解析 var()，返回 undefined 表示这个基础皮肤没定义该键。
 */
function pick(
  blocks: CssBlock[],
  vars: Record<string, string>,
  selector: string,
  property: string
): string | undefined {
  let found: string | undefined;
  for (const block of blocks) {
    if (!block.selectors.includes(selector)) continue;
    const value = declaration(block.body, property);
    if (value) found = value;
  }
  if (!found) return undefined;
  const resolved = resolveVars(found, vars);
  return resolved.length > 0 ? resolved : undefined;
}

/** `.container` 上某属性最后一次定义的值，解析 var() 后返回。 */
function containerProp(blocks: CssBlock[], vars: Record<string, string>, property: string): string | undefined {
  let raw: string | undefined;
  for (const block of blocks) {
    if (!block.selectors.includes('.container')) continue;
    const value = declaration(block.body, property);
    if (value) raw = value;
  }
  return raw ? resolveVars(raw, vars) : undefined;
}

/** 把可能带前缀的取值归一成纯颜色，非颜色返回 undefined。 */
function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (/^(none|inherit|initial|unset|auto)$/i.test(text)) return undefined;
  // `background` / `border-bottom` 这类简写里抠出颜色部分。
  const shorthand = text.match(/(?:^|[\s])?(#(?:[0-9a-f]{3,8})\b|rgba?\([^)]*\)|\btransparent\b)\s*$/i);  if (shorthand) return shorthand[1].trim();
  return text;
}

/**
 * 抽一套 base + 主题的继承配色。取不到的键不写，面板会显示「跟随基础皮肤」。
 * 这里读的是横排 CSS，几个基础皮肤的配色在横竖排之间一致，只有布局差异。
 */
export function inheritedPalette(base: BuiltInSkin, theme: ThemeName): InheritedPalette {
  return parsePalette(baseSkinCss(base, 'horizontal', theme));
}

/**
 * 从一份基础皮肤 CSS 里解析继承配色。抽成纯函数，单测可以直接喂 CSS 文本，
 * 不依赖 Vite 的 `?raw` 导入。
 */
export function parsePalette(css: string): InheritedPalette {
  const blocks = scanBlocks(css);
  const vars = variableTable(blocks);
  const container = (property: string) => containerProp(blocks, vars, property);

  const text = pick(blocks, vars, ':root', '--cand-text');
  const palette: InheritedPalette = {
    text,
    // 预编辑文字在基础皮肤里与正文同色。
    preedit_text: text,
    number: pick(blocks, vars, ':root', '--cand-num'),
    accent: pick(blocks, vars, '.cursor', 'background'),
    preedit_caret: pick(blocks, vars, '.cursor', 'background'),
    surface: container('background-color') ?? container('background'),
    border: (() => {
      const raw = container('border');
      return raw ? resolveVars(borderColor(raw), vars) || undefined : undefined;
    })(),
    selected: pick(blocks, vars, '.first', 'background-color') ?? (() => {
      for (const block of blocks) {
        if (!block.selectors.includes('.first')) continue;
        const value = backgroundOf(block.body);
        if (value) return resolveVars(value, vars);
      }
      return undefined;
    })(),
    hover: pick(blocks, vars, '.hover-active .cand:not(.first):hover', 'background-color'),
    selected_text: pick(blocks, vars, '.first .text', 'color'),
    selected_number: pick(blocks, vars, '.first .num', 'color'),
    selected_bar: pick(blocks, vars, '.first::before', 'background'),
    translation: pick(blocks, vars, '.cand-translation', 'color'),
    translation_pos: pick(blocks, vars, '.cand-translation .cand-pos', 'color'),
    translation_separator: pick(blocks, vars, '.cand-translation .cand-sep', 'color'),
    selected_translation: pick(blocks, vars, '.first .cand-translation', 'color'),
    selected_translation_pos: pick(blocks, vars, '.first .cand-translation .cand-pos', 'color'),
    selected_translation_separator: pick(blocks, vars, '.first .cand-translation .cand-sep', 'color'),
    preedit_background: pick(blocks, vars, '.row.pinyin', 'background'),
    preedit_divider: pick(blocks, vars, '.row.pinyin', 'border-bottom')
  };

  const cleaned: InheritedPalette = {};
  for (const [key, value] of Object.entries(palette)) {
    const normalized = normalizeColor(value);
    if (normalized) cleaned[key as InheritedColorKey] = normalized;
  }
  return withFallbackChain(cleaned);
}

/**
 * 基础皮肤往往不单独定义「选中态」的每个色，而是借用正文那套。
 * 这里补上这层语义链，面板给每个字段都显示真正生效的颜色，而不是一个假的兜底色。
 * 具体 CSS 里写没写对应选择器由内置皮肤决定，这里只表达「没写时跟谁走」。
 */
const FALLBACK_CHAIN: Partial<Record<InheritedColorKey, InheritedColorKey>> = {
  preedit_text: 'text',
  selected_text: 'text',
  selected_number: 'number',
  selected_bar: 'accent',
  preedit_caret: 'accent',
  selected_translation: 'translation',
  selected_translation_pos: 'translation_pos',
  selected_translation_separator: 'translation_separator'
};

export function withFallbackChain(palette: InheritedPalette): InheritedPalette {
  const result: InheritedPalette = { ...palette };
  for (const [key, source] of Object.entries(FALLBACK_CHAIN)) {
    const target = key as InheritedColorKey;
    if (!result[target] && result[source as InheritedColorKey]) {
      result[target] = result[source as InheritedColorKey];
    }
  }
  return result;
}
