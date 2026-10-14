import { describe, expect, it } from 'vitest';
import { parseSkinToml, parseToml, serializeSkinToml, validateSkinConfig } from './toml';
import { SKIN_TEMPLATES } from '../constants/templates';
import { SkinV2Config } from '../types/skin';
import { isSafeSkinId } from './exporter';
import { getImageDimensions, extractEncryptedSkin, parseSogouColor, parseIni, safeSkinId } from './ssf';
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

describe('图片尺寸探测', () => {
  const gif = (w: number, h: number) => {
    const bytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 0xff, (w >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return 'data:image/gif;base64,' + btoa(String.fromCharCode(...bytes));
  };
  const png = (w: number, h: number) => {
    const bytes = new Array(28).fill(0);
    bytes[0] = 0x89;
    bytes[1] = 0x50;
    bytes[2] = 0x4e;
    bytes[3] = 0x47;
    bytes[16] = (w >> 24) & 0xff;
    bytes[17] = (w >> 16) & 0xff;
    bytes[18] = (w >> 8) & 0xff;
    bytes[19] = w & 0xff;
    bytes[20] = (h >> 24) & 0xff;
    bytes[21] = (h >> 16) & 0xff;
    bytes[22] = (h >> 8) & 0xff;
    bytes[23] = h & 0xff;
    return 'data:image/png;base64,' + btoa(String.fromCharCode(...bytes));
  };
  const bmp = (w: number, h: number) => {
    const bytes = new Array(28).fill(0);
    bytes[0] = 0x42;
    bytes[1] = 0x4d;
    bytes[18] = w & 0xff;
    bytes[19] = (w >> 8) & 0xff;
    bytes[20] = (w >> 16) & 0xff;
    bytes[21] = (w >> 24) & 0xff;
    bytes[22] = h & 0xff;
    bytes[23] = (h >> 8) & 0xff;
    bytes[24] = (h >> 16) & 0xff;
    bytes[25] = (h >> 24) & 0xff;
    return 'data:image/bmp;base64,' + btoa(String.fromCharCode(...bytes));
  };

  it('GIF 也能拿到尺寸，否则挂件会被算成 0x0', () => {
    // 仲夏梦之夜的 oh_custom01.gif 实际是 87x80
    expect(getImageDimensions(gif(87, 80))).toEqual({ width: 87, height: 80 });
    expect(getImageDimensions(gif(1, 1))).toEqual({ width: 1, height: 1 });
  });

  it('PNG 与 BMP 仍然正确', () => {
    expect(getImageDimensions(png(255, 130))).toEqual({ width: 255, height: 130 });
    expect(getImageDimensions(bmp(29, 142))).toEqual({ width: 29, height: 142 });
  });

  it('认不出的格式返回 0 而不是抛错', () => {
    expect(getImageDimensions('data:image/webp;base64,' + btoa('RIFFxxxxWEBP'))).toEqual({ width: 0, height: 0 });
    expect(getImageDimensions('data:image/png;base64,')).toEqual({ width: 0, height: 0 });
  });
});

describe('skin.toml 校验', () => {
  const clone = (config: SkinV2Config): SkinV2Config => JSON.parse(JSON.stringify(config));
  const fields = (config: SkinV2Config) => validateSkinConfig(config).map(issue => issue.field);

  it('三套模板都是合法皮肤', () => {
    for (const tpl of SKIN_TEMPLATES) {
      expect(validateSkinConfig(clone(tpl.config))).toEqual([]);
    }
  });

  it('name 为空要报 name', () => {
    const cfg = clone(SKIN_TEMPLATES[0].config);
    cfg.meta.name = '';
    expect(fields(cfg)).toContain('name');
  });

  it('font_family 含逗号要报 font_family', () => {
    const cfg = clone(SKIN_TEMPLATES[0].config);
    cfg.candidate_window.font_family = 'Microsoft YaHei, sans-serif';
    expect(fields(cfg)).toContain('candidate_window.font_family');
  });

  it('颜色含中文或分号要报对应颜色字段', () => {
    const chinese = clone(SKIN_TEMPLATES[0].config);
    chinese.candidate!.dark!.surface = '深色背景';
    expect(fields(chinese)).toContain('candidate.dark.surface');

    const semicolon = clone(SKIN_TEMPLATES[0].config);
    semicolon.candidate!.light!.text = '#fff;}body{';
    expect(fields(semicolon)).toContain('candidate.light.text');
  });

  it('slice_dip 长度为 3 要报 slice_dip', () => {
    const cfg = clone(SKIN_TEMPLATES[1].config);
    cfg.candidate_window.border_image!.slice_dip = [16, 16, 16];
    expect(fields(cfg)).toContain('candidate_window.border_image.slice_dip');
  });

  it('slice_dip 有一项 501 要报 slice_dip', () => {
    const cfg = clone(SKIN_TEMPLATES[1].config);
    cfg.candidate_window.border_image!.slice_dip = [16, 501, 16, 16];
    expect(fields(cfg)).toContain('candidate_window.border_image.slice_dip');
  });

  it('decorations 的 height_dip 为 0 要报该项', () => {
    const cfg = clone(SKIN_TEMPLATES[1].config);
    cfg.candidate_window.decorations![0].height_dip = 0;
    expect(fields(cfg)).toContain('candidate_window.decorations[0].height_dip');
  });

  it('supports.layouts 为空数组要报 supports.layouts', () => {
    const cfg = clone(SKIN_TEMPLATES[0].config);
    cfg.meta.supports!.layouts = [];
    expect(fields(cfg)).toContain('supports.layouts');
  });

  it('content_insets_dip.top 为 -1 要报该项', () => {
    const cfg = clone(SKIN_TEMPLATES[1].config);
    cfg.candidate_window.content_insets_dip!.top = -1;
    expect(fields(cfg)).toContain('candidate_window.content_insets_dip.top');
  });
});

describe('搜狗 ini 解析', () => {
  it('分节与键值对', () => {
    const ini = parseIni('[Scheme_H1]\r\npic=skin1.png\r\nlayout_horizontal=0,301,92\r\n\r\n[Display]\r\nfont_size=32\r\n');
    expect(ini['Scheme_H1'].pic).toBe('skin1.png');
    expect(ini['Scheme_H1'].layout_horizontal).toBe('0,301,92');
    expect(ini['Display'].font_size).toBe('32');
  });

  it('忽略注释与空行', () => {
    const ini = parseIni('; 注释\n# 也当注释\n[A]\nk = v\n');
    expect(ini['A']).toEqual({ k: 'v' });
  });
});

describe('加密皮肤解包的边界', () => {
  it('文件太小时给出可读错误而不是崩', () => {
    expect(() => extractEncryptedSkin(new Uint8Array(4))).toThrow(/太小/);
    expect(() => extractEncryptedSkin(new Uint8Array(12))).toThrow(/太小/);
  });

  it('密钥对不上时明确说是解密失败，不要把 zlib 报错透出去', () => {
    const junk = new Uint8Array(64);
    junk.fill(0xab);
    expect(() => extractEncryptedSkin(junk)).toThrow(/无法解密/);
  });
});
