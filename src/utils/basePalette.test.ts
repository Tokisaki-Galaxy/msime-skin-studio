import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePalette } from './basePalette';
import { BUILT_IN_SKINS } from '../types/skin';

// vitest 下 Vite 的 `?raw` 导入拿不到内容，所以这里直接读源码目录里的 CSS，
// 数据源与 src/skins/index.ts 引用的是同一批文件。
const readBase = (base: string, theme: string) =>
  readFileSync(join(process.cwd(), 'src', 'skins', base, `horizontal_${theme}.css`), 'utf8');

describe('parsePalette', () => {
  it('fluent 暗色的继承值与水杉内置 CSS 一致', () => {
    const p = parsePalette(readBase('fluent', 'dark'));
    expect(p.text).toBe('#e9e8e8');
    expect(p.number).toBe('#e9e8e89d');
    expect(p.surface).toBe('#202020');
    expect(p.accent).toBe('#6b69d6');
    expect(p.translation).toBe('#9a6dd7');
  });

  it('fluent 浅色的 border 取到 rgba 而非十六进制', () => {
    const p = parsePalette(readBase('fluent', 'light'));
    expect(p.surface).toBe('#ffffff');
    expect(p.border).toBe('rgba(0, 0, 0, 0.12)');
  });

  it('var() 会被溯源成字面量，不把 var(--x) 透给 UI', () => {
    // willow_green 的 surface 写成 var(--wg-surface)
    const p = parsePalette(readBase('willow_green', 'dark'));
    expect(p.surface).toBe('#2d2f2e');
    expect(p.accent).toBe('#65c98d');
  });

  it('autumn_osmanthus 的 surface 同样从变量解析出来', () => {
    const p = parsePalette(readBase('autumn_osmanthus', 'dark'));
    expect(p.surface).toBe('#7d929f');
    expect(p.accent).toBe('#f97d0a');
  });

  it('wechat 的选中底色是品牌绿，不是通用的灰', () => {
    const p = parsePalette(readBase('wechat', 'dark'));
    expect(p.selected).toBe('#07c160');
    expect(p.hover).toBe('rgba(7, 193, 96, .32)');
  });

  it('每个内置皮肤每个主题都能抽出正文色与底色', () => {
    for (const base of BUILT_IN_SKINS) {
      for (const theme of ['dark', 'light'] as const) {
        const p = parsePalette(readBase(base, theme));
        expect(`${base}/${theme} text ${p.text}`).toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
        expect(`${base}/${theme} surface ${p.surface}`).toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
      }
    }
  });

  it('不会把 var(--x) 这类中间量漏出去', () => {
    for (const base of BUILT_IN_SKINS) {
      for (const theme of ['dark', 'light'] as const) {
        for (const value of Object.values(parsePalette(readBase(base, theme)))) {
          expect(`${base}/${theme} ${value}`).not.toContain('var(');
        }
      }
    }
  });

  it('组合选择器也能命中最后一条定义', () => {
    const css = `
      .first .text, .first .num { color: #fff; }
      .first { background-color: #111; }
    `;
    const p = parsePalette(css);
    expect(p.selected_text).toBe('#fff');
    expect(p.selected_number).toBe('#fff');
    expect(p.selected).toBe('#111');
  });

  it('基础皮肤没写选中态时，语义链回落到正文与翻译色', () => {
    const css = `
      :root { --cand-text: #112233; --cand-num: #445566; }
      .cursor { background: #778899; }
      .cand-translation { color: #aabbcc; }
      .cand-translation .cand-pos { color: #ddeeff; }
    `;
    const p = parsePalette(css);
    // 选中态没单独定义，都该跟正文/翻译一套走
    expect(p.selected_text).toBe('#112233');
    expect(p.selected_number).toBe('#445566');
    expect(p.selected_bar).toBe('#778899');
    expect(p.selected_translation).toBe('#aabbcc');
    expect(p.selected_translation_pos).toBe('#ddeeff');
    expect(p.preedit_caret).toBe('#778899');
  });

  it('空 CSS 不抛错，返回空对象', () => {
    expect(parsePalette('')).toEqual({});
  });
});
