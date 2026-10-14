import { describe, expect, it } from 'vitest';
import { parseSkinToml, parseToml, serializeSkinToml } from './toml';
import { SKIN_TEMPLATES } from '../constants/templates';
import { isSafeSkinId } from './exporter';
import { parseSogouColor, safeSkinId } from './ssf';
import { buildSkinOverrideCss } from './skinCss';

const urlFor = (p: string) => `blob:${p}`;

describe('skin.toml 往返', () => {
  it('三套模板序列化后能原样读回', () => {
    for (const tpl of SKIN_TEMPLATES) {
      const text = serializeSkinToml(tpl.config);
      const back = parseSkinToml(text);
      expect(back).toEqual(tpl.config);
    }
  });

  it('顶层键收进 meta，子表按真实 schema 落位', () => {
    const text = `
schema_version = 2
id = "demo"
name = "演示"
version = "1.0.0"
base = "fluent"

[supports]
layouts = ["horizontal"]

[candidate_window]
min_width_dip = 160
border_width_dip = 1.5

[candidate_window.border_image]
source = "assets/skin1.png"
slice_dip = [16, 16, 16, 16]
width_dip = [16, 16, 16, 16]
fill = true

[candidate_window.content_insets_dip]
top = 20
right = 18
bottom = 20
left = 18

[[candidate_window.decorations]]
image = "assets/char.png"
anchor = "top-left"
width_dip = 120
height_dip = 200
offset_x_dip = 4
offset_y_dip = -200
z_index = 3

[candidate.dark]
text = "#e9e8e8"
show_selected_bar = false
`;
    const parsed = parseSkinToml(text) as any;
    expect(parsed.meta.id).toBe('demo');
    expect(parsed.meta.base).toBe('fluent');
    expect(parsed.meta.supports.layouts).toEqual(['horizontal']);
    expect(parsed.candidate_window.border_width_dip).toBe(1.5);
    expect(parsed.candidate_window.border_image.slice_dip).toEqual([16, 16, 16, 16]);
    expect(parsed.candidate_window.content_insets_dip).toEqual({ top: 20, right: 18, bottom: 20, left: 18 });
    expect(parsed.candidate_window.decorations).toHaveLength(1);
    expect(parsed.candidate_window.decorations[0].anchor).toBe('top-left');
    expect(parsed.candidate_window.decorations[0].z_index).toBe(3);
    expect(parsed.candidate.dark.show_selected_bar).toBe(false);
  });

  it('注释里的 # 不会被当成字符串内容截断', () => {
    const parsed = parseToml('text = "#e9e8e8" # 说明\n') as any;
    expect(parsed.text).toBe('#e9e8e8');
  });
});

describe('覆盖样式生成', () => {
  const base = {
    meta: { schema_version: 2 as const, id: 'x', name: 'x', version: '1', base: 'fluent' as const },
    candidate_window: {
      border_image: { source: 'assets/p.png', slice_dip: [16, 16, 16, 16], width_dip: [16, 16, 16, 16], fill: true },
      content_insets_dip: { top: 20, right: 18, bottom: 20, left: 18 }
    },
    candidate: {}
  };

  it('content_insets_dip 扣掉边框宽度后落到 padding', () => {
    const css = buildSkinOverrideCss(base as any, 'horizontal', 'dark', urlFor);
    // 20-16=4, 18-16=2
    expect(css).toContain('padding: 4px 2px 4px 2px !important;');
  });

  it('border-width 与 border-image-width 一致', () => {
    const css = buildSkinOverrideCss(base as any, 'horizontal', 'dark', urlFor);
    expect(css).toContain('border-width: 16px 16px 16px 16px;');
    expect(css).toContain('border-image-width: 16px 16px 16px 16px;');
    expect(css).toContain('border-image-slice: 16 16 16 16 fill;');
  });

  it('挂件 offset 正数向右向下', () => {
    const cfg = {
      ...base,
      candidate_window: {
        ...base.candidate_window,
        outer_insets_dip: { top: 200, right: 0, bottom: 0, left: 0 },
        decorations: [
          { image: 'assets/c.png', anchor: 'top-left' as const, width_dip: 100, height_dip: 200, offset_x_dip: 8, offset_y_dip: -200 }
        ]
      }
    };
    const css = buildSkinOverrideCss(cfg as any, 'horizontal', 'dark', urlFor);
    expect(css).toContain('left: 8px; top: -200px;');
    expect(css).toContain('width: 100px; height: 200px;');
    expect(css).toContain('.containerParent { position: relative; left: 0px; top: 200px; }');
  });
});

describe('id 与颜色', () => {
  it('id 规则与水杉 IsSafeId 一致', () => {
    expect(isSafeSkinId('my_skin')).toBe(true);
    expect(isSafeSkinId('a.b-c_1')).toBe(true);
    expect(isSafeSkinId('MySkin')).toBe(false);
    expect(isSafeSkinId('_skin')).toBe(false);
    expect(isSafeSkinId('皮肤')).toBe(false);
    expect(isSafeSkinId('')).toBe(false);
  });

  it('搜狗中文名退化成不撞车的 id', () => {
    expect(safeSkinId('航海')).toMatch(/^sogou_skin_[0-9a-f]+$/);
    expect(safeSkinId('航海')).toBe(safeSkinId('航海'));
    expect(safeSkinId('航海')).not.toBe(safeSkinId('简约'));
    // 有可用的 ASCII 时优先用 ASCII，中文名才退到 skin_id 或哈希
    expect(safeSkinId('Date A Live', '599588')).toBe('sogou_date_a_live');
  });

  it('0xBBGGRR 转成 #RRGGBB', () => {
    expect(parseSogouColor('0x637af4')).toBe('#f47a63');
    expect(parseSogouColor('0xe9a000')).toBe('#00a0e9');
    expect(parseSogouColor(undefined, '#123456')).toBe('#123456');
  });
});
