import { describe, expect, it } from 'vitest';
import { buildD2dPreviewCss, buildD2dOverrideCss, d2dBorderSlice, d2dContentPadding, d2dMinWidthDip } from './d2dCss';
import { buildSkinOverrideCss } from './skinCss';
import { SkinV2Config } from '../types/skin';

const urlFor = (p: string) => `blob:${p}`;

// 一份把两个后端所有分歧都放大的配置，用来钉住 D2D 的取值语义。
const stress: SkinV2Config = {
  meta: {
    schema_version: 2,
    id: 'stress',
    name: '压力',
    version: '1.0.0',
    base: 'fluent'
  },
  candidate_window: {
    min_width_dip: 340,
    corner_radius_dip: 14,
    border_width_dip: 2,
    line_gap_dip: 14,
    border_image: {
      source: 'panel.png',
      slice_dip: [0, 11, 0, 64],
      width_dip: [0, 30, 0, 64],
      fill: false
    },
    content_insets_dip: { top: 4, right: 16, bottom: 6, left: 6 },
    decorations: [
      { image: 'portrait.png', anchor: 'right', offset_x_dip: 10, offset_y_dip: 0, width_dip: 120, height_dip: 200, z_index: 1 },
      { image: 'portrait.png', anchor: 'left', offset_x_dip: 6, offset_y_dip: 0, width_dip: 90, height_dip: 90, z_index: 9 }
    ]
  },
  candidate: {
    dark: {
      text: '#ff0000',
      number: '#00ff00',
      surface: '#123456',
      border: '#abcdef',
      accent: '#9900ff',
      selected: '#334455',
      hover: '#667788',
      translation: '#9a6dd7',
      translation_pos: '#e255a180',
      translation_separator: '#9a6dd773'
    }
  }
};

describe('D2D 取值语义', () => {
  it('九宫格四边取 slice，width_dip 不参与', () => {
    // width_dip 是 [0,30,0,64]，slice_dip 是 [0,11,0,64]；D2D 必须取后者。
    expect(d2dBorderSlice(stress)).toEqual({ top: 0, right: 11, bottom: 0, left: 64 });
  });

  it('stretch_dip 优先于 slice_dip', () => {
    const withStretch: SkinV2Config = {
      ...stress,
      candidate_window: {
        ...stress.candidate_window,
        border_image: { ...stress.candidate_window.border_image!, stretch_dip: [0, 5, 0, 9] }
      }
    };
    expect(d2dBorderSlice(withStretch)).toEqual({ top: 0, right: 5, bottom: 0, left: 9 });
  });

  it('content_insets_dip 直接作内边距，不扣边框', () => {
    expect(d2dContentPadding(stress)).toEqual({ top: 4, right: 16, bottom: 6, left: 6 });
  });

  it('忽略 width_dip：border-image-width 用 slice 的值', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(css).toContain('border-image-width: 0px 11px 0px 64px');
    expect(css).not.toContain('border-width: 0px 30px');
  });

  it('忽略 fill=false：中心永远绘制，slice 后带 fill', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(css).toContain('border-image-slice: 0 11 0 64 fill');
  });

  it('保留卡片圆角，不把圆角归零', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(css).toContain('border-radius: 14px');
    expect(css).not.toContain('border-radius: 0');
  });

  it('content_insets 直接落成 padding，不做 max(0, insets - border)', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(css).toContain('padding: 4px 16px 6px 6px !important');
  });

  it('line_gap_dip 作用到全部子元素，而非只加在预编辑行', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(css).toContain('.container > * + * { margin-top: 14px; }');
  });

  it('挂件拉成 width x height，不保比例，且忽略 z_index', () => {
    const css = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    // 第一个挂件 120x200：背景按 120x200 拉伸，不是 contain。
    expect(css).toContain('background-size: 120px 200px');
    // 两个挂件都落在同一层级，不出现分层。
    expect(css).toContain('.msime-skin-decor[data-i="0"] { z-index: 1;');
    expect(css).toContain('.msime-skin-decor[data-i="1"] { z-index: 1;');
    expect(css).not.toContain('z-index: 9');
  });
});

describe('D2D 最小宽度用 160 而不是 CSS 的 7em', () => {
  it('默认下限是 160 DIP', () => {
    const plain: SkinV2Config = {
      meta: { schema_version: 2, id: 'p', name: 'P', version: '1', base: 'fluent' },
      candidate_window: {},
      candidate: {}
    };
    expect(d2dMinWidthDip(plain)).toBe(160);
    // 没有皮肤声明时也要盖掉基础 CSS 的 min-width。
    expect(buildD2dPreviewCss(plain, 'horizontal', 'dark', urlFor)).toContain('min-width: 160px');
  });

  it('fit_content 去掉 160 下限，只留声明值', () => {
    const fit: SkinV2Config = {
      ...stress,
      candidate_window: { ...stress.candidate_window, min_width_dip: 340, fit_content: true }
    };
    expect(d2dMinWidthDip(fit)).toBe(0);
    expect(buildD2dPreviewCss(fit, 'horizontal', 'dark', urlFor)).not.toContain('min-width');
  });

  it('装饰图宽度也能撑开卡片', () => {
    const withDeco: SkinV2Config = {
      meta: { schema_version: 2, id: 'd', name: 'D', version: '1', base: 'fluent' },
      candidate_window: { decoration: { image: 'x.png', top_inset_dip: 80, width_dip: 220 } },
      candidate: {}
    };
    expect(buildD2dPreviewCss(withDeco, 'horizontal', 'dark', urlFor)).toContain('min-width: 220px');
  });
});

describe('配色不属于后端差异', () => {
  it('D2D 覆盖也带全套皮肤配色', () => {
    const css = buildD2dOverrideCss(stress, 'horizontal', 'dark', urlFor);
    for (const key of ['#ff0000', '#00ff00', '#123456', '#abcdef', '#9900ff', '#334455', '#667788', '#9a6dd7']) {
      expect(css).toContain(key);
    }
  });

  it('D2D 的几何覆盖本身不含配色，配色由外层叠加', () => {
    const geo = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(geo).not.toContain('#ff0000');
    expect(geo).not.toContain('#9a6dd7');
  });
});

describe('两个后端的差异确实存在', () => {
  it('WebView2 用 width_dip，D2D 用 slice_dip', () => {
    const wv = buildSkinOverrideCss(stress, 'horizontal', 'dark', urlFor);
    const d2d = buildD2dPreviewCss(stress, 'horizontal', 'dark', urlFor);
    expect(wv).toContain('border-image-width: 0px 30px 0px 64px');
    expect(d2d).toContain('border-image-width: 0px 11px 0px 64px');
  });

  it('WebView2 把卡片底色与圆角清掉，D2D 保留', () => {
    const wv = buildSkinOverrideCss(stress, 'horizontal', 'dark', urlFor);
    expect(wv).toContain('background-color: transparent');
    expect(wv).toContain('border-radius: 0');
  });

  it('WebView2 的挂件保比例（contain），D2D 拉伸', () => {
    const wv = buildSkinOverrideCss(stress, 'horizontal', 'dark', urlFor);
    expect(wv).toContain('background-size: contain');
  });
});

describe('回归：v1 皮肤没有 v2 字段时只留最小宽度', () => {
  it('纯配色皮肤不产出几何覆盖', () => {
    const v1: SkinV2Config = {
      meta: { schema_version: 2, id: 'plain', name: '纯色', version: '1.0.0', base: 'fluent' },
      candidate_window: { fit_content: true },
      candidate: { dark: { text: '#fff' } }
    };
    // fit_content 打开时连 160 下限都不写，几何覆盖应为空。
    expect(buildD2dPreviewCss(v1, 'horizontal', 'dark', urlFor)).toBe('');
  });
});
