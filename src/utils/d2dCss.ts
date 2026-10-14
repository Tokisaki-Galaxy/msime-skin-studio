import {
  Insets,
  LayoutMode,
  SkinV2Config,
  ThemeName,
  expandFour,
  resolveBorderSlice
} from '../types/skin';
import { colorLines } from './skinCss';

// D2D 后端的预览样式。真实 D2D 不是 CSS，这里把它在 CandidatePresenter::ApplySkin /
// candidate_skin_overlay.cpp / ui/src/Layout.cpp 里的**决策**逐条翻成等价的 CSS，
// 目的不是逐像素复刻栅格化，而是让「两个后端会不一样的地方」在预览里如实体现：
//
//   width_dip         D2D 忽略，四边宽度取 stretch_dip（再退回 slice_dip）
//   fill=false        D2D 忽略，九宫格中心永远绘制
//   卡片底色/描边/圆角 D2D 保留，九宫格叠在它们之上
//   content_insets_dip D2D 直接作内边距，不扣边框宽度
//   line_gap_dip      D2D 用 SetSpacing 作用到 body 全部子元素
//   挂件              D2D 把位图拉成 width_dip x height_dip，不保比例
//   z_index           D2D 忽略，按声明顺序画在卡片之上
//
// 配色不在差异之列：两个后端读的是同一批键，所以 buildD2dOverrideCss 直接复用
// WebView2 的 colorLines，只有几何与挂件定位按各自实现分流。

/** D2D 九宫格四边取值的优先级：stretch_dip，其次 slice_dip；width_dip 不参与。 */
export function d2dBorderSlice(cfg: SkinV2Config): Insets {
  return resolveBorderSlice(cfg.candidate_window.border_image);
}

/** D2D 直接使用 content_insets_dip 作为内边距。 */
export function d2dContentPadding(cfg: SkinV2Config): Insets | null {
  const ci = cfg.candidate_window.content_insets_dip;
  return ci ? ci : null;
}

/** D2D 卡片的最小宽度：kCandidateMinWidthDip，fit_content 打开时去掉这个下限。 */
export function d2dMinWidthDip(cfg: SkinV2Config): number {
  const cw = cfg.candidate_window;
  return cw.fit_content ? 0 : 160;
}

function anchorRule(anchor: string, ox: number, oy: number): string {
  switch (anchor) {
    case 'top-left':
      return `left: ${ox}px; top: ${oy}px;`;
    case 'top-right':
      return `right: ${-ox}px; top: ${oy}px;`;
    case 'bottom-left':
      return `left: ${ox}px; bottom: ${-oy}px;`;
    case 'bottom-right':
      return `right: ${-ox}px; bottom: ${-oy}px;`;
    case 'left':
      return `left: ${ox}px; top: 50%; transform: translateY(calc(-50% + ${oy}px));`;
    case 'top':
      return `top: ${oy}px; left: 50%; transform: translateX(calc(-50% + ${ox}px));`;
    case 'bottom':
      return `bottom: ${-oy}px; left: 50%; transform: translateX(calc(-50% + ${ox}px));`;
    case 'center':
      return `left: 50%; top: 50%; transform: translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px));`;
    default: // right
      return `right: ${-ox}px; top: 50%; transform: translateY(calc(-50% + ${oy}px));`;
  }
}

/**
 * 生成 D2D 预览的几何覆盖：相对基础皮肤 CSS 的增量。
 * `urlFor` 把皮肤目录里的相对路径换成预览可用的 URL。
 * 配色不在这里，由 buildD2dOverrideCss 叠加。
 */
export function buildD2dPreviewCss(
  cfg: SkinV2Config,
  _layout: LayoutMode,
  _theme: ThemeName,
  urlFor: (path: string) => string
): string {
  const cw = cfg.candidate_window;
  const bi = cw.border_image;
  let css = '';

  // 1) 最小宽度：真实 D2D 用 kCandidateMinWidthDip（160），不是 CSS 的 7em；
  //    fit_content 去掉下限，只剩皮肤声明的 min_width_dip 与装饰图宽度。
  const floor = d2dMinWidthDip(cfg);
  const decorationWidth = cw.decoration?.width_dip ?? 0;
  const declaredMin = cw.min_width_dip ?? 0;
  const minWidth = Math.max(floor, declaredMin, decorationWidth);
  if (floor > 0) {
    // 盖掉基础皮肤的 min-width，避免 CSS 的下限渗进 D2D 的几何。
    css += `.container:not(:empty) { min-width: ${minWidth}px; }\n`;
  }

  // 2) 九宫格：四边宽度取 slice（D2D 不看 width_dip），中心永远填充，卡片底色/描边/圆角保留。
  if (bi && bi.source) {
    const slice = d2dBorderSlice(cfg);
    const sliceStr = `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}`;
    const widthStr = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
    css +=
      `.container:not(:empty) { border-image-source: url("${urlFor(bi.source)}"); ` +
      `border-image-slice: ${sliceStr} fill; border-image-width: ${widthStr}; ` +
      `border-image-repeat: stretch; border-style: solid; }\n`;
    if (cw.corner_radius_dip !== undefined) {
      css += `.container:not(:empty) { border-radius: ${cw.corner_radius_dip}px; }\n`;
    }
  }

  // 3) content_insets_dip 直接作内边距，不扣边框宽度。
  if (cw.content_insets_dip) {
    const p = d2dContentPadding(cfg)!;
    css += `.container:not(:empty) { padding: ${p.top}px ${p.right}px ${p.bottom}px ${p.left}px !important; }\n`;
  }

  // 4) line_gap_dip 用 SetSpacing 作用到全部子元素，竖排时列表与翻页栏之间也会被拉开。
  if (cw.line_gap_dip) {
    css += `.container > * + * { margin-top: ${cw.line_gap_dip}px; }\n`;
  }

  // 5) 挂件：拉成 width_dip x height_dip，忽略 z_index（统一层级，按声明顺序叠加）。
  const decorations = cw.decorations ?? [];
  if (decorations.length > 0) {
    css += `.msime-skin-decor { position: absolute; background-repeat: no-repeat; background-position: center; }\n`;
    decorations.forEach((dec, idx) => {
      const ox = dec.offset_x_dip ?? 0;
      const oy = dec.offset_y_dip ?? 0;
      css +=
        `.msime-skin-decor[data-i="${idx}"] { z-index: 1; ${anchorRule(dec.anchor, ox, oy)} ` +
        `width: ${dec.width_dip}px; height: ${dec.height_dip}px; ` +
        `background-size: ${dec.width_dip}px ${dec.height_dip}px; background-image: url("${urlFor(dec.image)}"); }\n`;
    });
  }

  return css;
}

/** D2D 预览的完整覆盖：几何差异叠上皮肤配色。 */
export function buildD2dOverrideCss(
  cfg: SkinV2Config,
  layout: LayoutMode,
  theme: ThemeName,
  urlFor: (path: string) => string
): string {
  const colors = theme === 'light' ? cfg.candidate?.light : cfg.candidate?.dark;
  return buildD2dPreviewCss(cfg, layout, theme, urlFor) + colorLines(colors);
}

/** 供设置页/预览图例使用：D2D 卡片四周固定的阴影留白。 */
export const D2D_SHADOW_PAD = { left: 32, top: 20, right: 32, bottom: 40 } as const;

export { expandFour };
