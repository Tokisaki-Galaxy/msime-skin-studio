import { describe, expect, it } from 'vitest';
import { assembleForTest, normalizeAssetPathForTest, referencedImages } from './importer';
import { SkinV2Config } from '../types/skin';

describe('导入：图片引用收集', () => {
  it('收齐九宫格、背景、顶部装饰与自由挂件', () => {
    const cfg: Partial<SkinV2Config> = {
      candidate_window: {
        border_image: { source: 'assets/panel.png', slice_dip: [1], width_dip: [1], fill: true },
        background: { image: 'assets/bg.png' },
        decoration: { image: 'assets/top.png', top_inset_dip: 10, width_dip: 20 },
        decorations: [
          { image: 'assets/a.png', anchor: 'right', width_dip: 1, height_dip: 1 },
          { image: 'assets/a.png', anchor: 'left', width_dip: 1, height_dip: 1 }
        ]
      }
    };
    // 重复引用只算一次。
    expect(referencedImages(cfg).sort()).toEqual(['assets/a.png', 'assets/bg.png', 'assets/panel.png', 'assets/top.png']);
  });

  it('没有 candidate_window 时不报错', () => {
    expect(referencedImages({})).toEqual([]);
  });
});

describe('导入：zip 内路径规整', () => {
  it('剥掉皮肤目录名，统一成 assets/ 前缀', () => {
    expect(normalizeAssetPathForTest('kurumi-v2/assets/panel.png')).toBe('assets/panel.png');
    expect(normalizeAssetPathForTest('assets/panel.png')).toBe('assets/panel.png');
    expect(normalizeAssetPathForTest('panel.png')).toBe('assets/panel.png');
    expect(normalizeAssetPathForTest('a/b/c/portrait.png')).toBe('assets/portrait.png');
  });

  it('非图片条目与目录项跳过', () => {
    expect(normalizeAssetPathForTest('kurumi-v2/skin.toml')).toBeNull();
    expect(normalizeAssetPathForTest('')).toBeNull();
    expect(normalizeAssetPathForTest('assets/')).toBeNull();
  });
});

describe('导入：缺图识别', () => {
  it('引用到但没有对应素材时列进 missingImages', () => {
    const result = assembleForTest(
      'schema_version = 2\nid = "t"\nname = "T"\nversion = "1"\nbase = "fluent"\n\n[supports]\nlayouts = ["horizontal"]\nthemes = ["dark"]\n\n[candidate_window.border_image]\nsource = "assets/panel.png"\nslice_dip = [1]\n',
      [{ path: 'assets/panel.png' }]
    );
    expect(result.missingImages).toEqual([]);
  });

  it('素材缺失时提示，且只有 toml 导入才提示需要补图', () => {
    const withNoAssets = assembleForTest(
      'schema_version = 2\nid = "t"\nname = "T"\nversion = "1"\nbase = "fluent"\n\n[supports]\nlayouts = ["horizontal"]\nthemes = ["dark"]\n\n[candidate_window.border_image]\nsource = "assets/panel.png"\nslice_dip = [1]\n',
      []
    );
    expect(withNoAssets.missingImages).toEqual(['assets/panel.png']);
    expect(withNoAssets.warnings.join('')).toContain('只导入了 skin.toml');
  });
});
