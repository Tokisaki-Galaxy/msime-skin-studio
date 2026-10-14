import {
  BuiltInSkin,
  CandidateColors,
  Insets,
  LayoutMode,
  SkinV2Config,
  ThemeName,
  expandFour,
  resolveBorderSlice,
  resolveBorderWidth
} from '../types/skin';

// 逐条对照 server/src/webview2/windows_webview2_skin.cpp 的
// BuildExternalCandidateSkinCss / AppendExternalCandidateColorCss / AppendExternalCandidateGeometryCss。

/** candidate_skin_palette.cpp 的 CandidateSkinBaseItemRadiusDip。 */
export const BASE_ITEM_RADIUS: Record<BuiltInSkin, number> = {
  fluent: 4,
  wechat: 4,
  graphite: 2,
  willow_green: 0,
  autumn_osmanthus: 6,
  microsoft: 4
};

/** candidate_skin_palette.cpp 里各 base 皮肤的 border。 */
const BASE_BORDER: Record<BuiltInSkin, Record<ThemeName, string>> = {
  fluent: { dark: 'rgba(155, 155, 155, 0.18)', light: 'rgba(0, 0, 0, 0.12)' },
  wechat: { dark: '#292929', light: '#dedede' },
  graphite: { dark: '#30353b', light: '#e2e5e9' },
  willow_green: { dark: 'transparent', light: 'transparent' },
  autumn_osmanthus: { dark: 'transparent', light: 'transparent' },
  microsoft: { dark: '#1c1c1c', light: 'rgba(0, 0, 0, 0.1)' }
};

/** candidate_skin_palette.cpp 里各 base 皮肤的 surface。 */
const BASE_SURFACE: Record<BuiltInSkin, Record<ThemeName, string>> = {
  fluent: { dark: '#202020', light: '#ffffff' },
  wechat: { dark: '#151515', light: '#f7f7f7' },
  graphite: { dark: '#1c1f23', light: '#fbfbfc' },
  willow_green: { dark: '#2d2f2e', light: '#f4f5f3' },
  autumn_osmanthus: { dark: '#7d929f', light: '#d6ecf0' },
  microsoft: { dark: '#2c2c2c', light: '#f9f9f9' }
};

function resolvedBorder(base: BuiltInSkin, theme: ThemeName, colors?: CandidateColors): string {
  return colors?.border || BASE_BORDER[base][theme];
}

function resolvedSurface(base: BuiltInSkin, theme: ThemeName, colors?: CandidateColors): string {
  return colors?.surface || BASE_SURFACE[base][theme];
}

/** 把 rgba() 里的 alpha 乘一个系数；不是 rgba 写法时原样返回。 */
function scaleRgba(color: string, factor: number): string {
  const match = color.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!match) return color;
  const a = (match[4] !== undefined ? Number(match[4]) : 1) * factor;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${Number(a.toFixed(3))})`;
}

function colorLines(colors: CandidateColors | undefined): string {
  if (!colors) return '';
  let css = '';
  const add = (value: string | undefined, selector: string, property: string) => {
    if (!value) return;
    css += `${selector} { ${property}: ${value}; }\n`;
  };
  add(colors.accent, '.cursor, .first::before', 'background');
  add(colors.selected, '.first, .cand.first, .hover-active .cand.first:hover', 'background-color');
  add(colors.hover, '.hover-active .cand:not(.first):hover, .hover-active .page-arrow:not(.disabled):hover', 'background-color');
  add(colors.surface, '.container', 'background');
  add(colors.border, '.container', 'border-color');
  add(colors.text, ':root', '--cand-text');
  add(colors.text, '.container', 'color');
  add(colors.number, '.num, .cand-no, .page-arrow', 'color');
  add(colors.translation, '.cand-translation', 'color');
  if (colors.translation) {
    css += '.cand-translation { opacity: 1; }\n';
    css += '.cand-translation .cand-pos, .cand-translation .cand-sep { color: inherit; }\n';
  }
  add(colors.translation_pos, '.cand-translation .cand-pos', 'color');
  add(colors.translation_separator, '.cand-translation .cand-sep', 'color');
  if (colors.show_selected_bar === false) {
    css += '.first::before { display: none; }\n';
  }
  if (colors.candidate_text) {
    css += `:where(.cand) .text { color: var(--msime-user-text, ${colors.candidate_text}); }\n`;
  }
  if (colors.preedit_text) {
    css += `.pinyin .text { color: var(--msime-user-text, ${colors.preedit_text}); }\n`;
  }
  add(colors.preedit_caret, '.cursor', 'background');
  add(colors.selected_bar, '.first::before', 'background');
  add(colors.selected_text, '.cand.first .text', 'color');
  add(colors.selected_number, '.cand.first .num, .cand.first .cand-no', 'color');
  add(colors.selected_translation, '.cand.first .cand-translation', 'color');
  if (colors.selected_translation) {
    css += '.cand.first .cand-translation { opacity: 1; }\n';
    css += '.cand.first .cand-translation .cand-pos, .cand.first .cand-translation .cand-sep { color: inherit; }\n';
  }
  add(colors.selected_translation_pos, '.cand.first .cand-translation .cand-pos', 'color');
  add(colors.selected_translation_separator, '.cand.first .cand-translation .cand-sep', 'color');
  add(colors.menu?.background, '.context-menu, .context-submenu', 'background');
  add(colors.menu?.border, '.context-menu, .context-submenu', 'border-color');
  add(colors.menu?.text, '.context-menu, .context-submenu, .context-menu-item', 'color');
  add(colors.menu?.hover, '.context-menu-item:hover', 'background');
  return css;
}

function borderImageCss(cfg: SkinV2Config, urlFor: (path: string) => string): string {
  const bi = cfg.candidate_window.border_image;
  if (!bi || !bi.source) return '';
  const slice = resolveBorderSlice(bi);
  const width = resolveBorderWidth(bi);
  const sliceArr = [slice.top, slice.right, slice.bottom, slice.left];
  const widthArr = [width.top, width.right, width.bottom, width.left];
  const sliceStr = sliceArr.join(' ') + (bi.fill === false ? '' : ' fill');
  const widthStr = widthArr.map(v => `${v}px`).join(' ');
  // border-width 决定内容盒的内缩量，必须与 border-image-width 一致。
  return (
    `.container:not(:empty) { border-style: solid; border-image-source: url("${urlFor(bi.source)}"); ` +
    `border-width: ${widthStr}; border-image-slice: ${sliceStr}; border-image-width: ${widthStr}; ` +
    `border-image-repeat: stretch; background-color: transparent; border-color: transparent; border-radius: 0; }\n`
  );
}

function contentInsetsCss(cfg: SkinV2Config): string {
  const insets = cfg.candidate_window.content_insets_dip;
  if (!insets) return '';
  // content_insets_dip 从面板外缘量起，而 CSS 的 padding 从边框内缘起算，这里把边框宽度扣掉。
  const border = resolveBorderWidth(cfg.candidate_window.border_image);
  const pad = (a: number, b: number) => Math.max(0, a - b);
  return (
    `.container:not(:empty) { padding: ${pad(insets.top, border.top)}px ${pad(insets.right, border.right)}px ` +
    `${pad(insets.bottom, border.bottom)}px ${pad(insets.left, border.left)}px !important; }\n`
  );
}

function decorationCss(cfg: SkinV2Config, urlFor: (path: string) => string): string {
  const list = cfg.candidate_window.decorations ?? [];
  if (list.length === 0) return '';
  let css = '.containerParent { position: relative; }\n';
  css +=
    '.msime-skin-decor { position: absolute; pointer-events: none; background-position: center; ' +
    'background-repeat: no-repeat; background-size: contain; }\n';
  list.forEach((dec, idx) => {
    if (!dec.image) return;
    const ox = dec.offset_x_dip ?? 0;
    const oy = dec.offset_y_dip ?? 0;
    let pos: string;
    switch (dec.anchor) {
      case 'top-left':
        pos = `left: ${ox}px; top: ${oy}px;`;
        break;
      case 'top-right':
        pos = `right: ${-ox}px; top: ${oy}px;`;
        break;
      case 'bottom-left':
        pos = `left: ${ox}px; bottom: ${-oy}px;`;
        break;
      case 'bottom-right':
        pos = `right: ${-ox}px; bottom: ${-oy}px;`;
        break;
      case 'left':
        pos = `left: ${ox}px; top: 50%; transform: translateY(calc(-50% + ${oy}px));`;
        break;
      case 'right':
        pos = `right: ${-ox}px; top: 50%; transform: translateY(calc(-50% + ${oy}px));`;
        break;
      case 'top':
        pos = `top: ${oy}px; left: 50%; transform: translateX(calc(-50% + ${ox}px));`;
        break;
      case 'bottom':
        pos = `bottom: ${-oy}px; left: 50%; transform: translateX(calc(-50% + ${ox}px));`;
        break;
      default:
        pos = `left: 50%; top: 50%; transform: translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px));`;
        break;
    }
    css +=
      `.msime-skin-decor[data-i="${idx}"] { z-index: ${dec.z_index ?? 2}; ${pos} ` +
      `width: ${dec.width_dip}px; height: ${dec.height_dip}px; background-image: url("${urlFor(dec.image)}"); }\n`;
  });
  return css;
}

export function buildSkinOverrideCss(
  cfg: SkinV2Config,
  layout: LayoutMode,
  theme: ThemeName,
  urlFor: (path: string) => string
): string {
  const cw = cfg.candidate_window;
  const base = cfg.meta.base || 'fluent';
  const colors = theme === 'light' ? cfg.candidate?.light : cfg.candidate?.dark;

  let css =
    '.container:not(:empty) { min-width: max(7em, var(--msime-skin-min-width, 0px), ' +
    'var(--msime-skin-decoration-width, 0px)); }\n';

  const top = cw.decoration;
  if (top && top.top_inset_dip > 0 && top.image) {
    const horizontal =
      top.align === 'left' ? 'left: 0;' : top.align === 'center' ? 'left: 0; right: 0; margin-inline: auto;' : 'right: 0;';
    css +=
      '.containerParent { padding-top: var(--msime-skin-decoration-top, 0px); position: relative; ' +
      'box-sizing: border-box; }\n' +
      '.containerParent:not(:empty)::before { content: ""; position: absolute; z-index: 0; top: 0; ' +
      `${horizontal} width: var(--msime-skin-decoration-width, 0px); ` +
      `height: var(--msime-skin-decoration-top, 0px); background: url("${urlFor(top.image)}") ` +
      'center / contain no-repeat; pointer-events: none; }\n' +
      '.container { position: relative; z-index: 1; }\n';
  }

  const outer = cw.outer_insets_dip;
  if (outer && (outer.left > 0 || outer.top > 0)) {
    css += `.containerParent { position: relative; left: ${outer.left}px; top: ${outer.top}px; }\n`;
  }

  if (cw.corner_radius_dip !== undefined) {
    const r = `${cw.corner_radius_dip}px`;
    css += `body, .container { border-radius: ${r}; }\n`;
    css += `.container { --wg-radius: ${r}; --ao-radius: ${r}; }\n`;
    if (base === 'willow_green') {
      css += `.containerParent { border-radius: ${r}; }\n`;
    }
    if ((base === 'fluent' || base === 'wechat') && layout === 'horizontal') {
      css +=
        `.container > .pinyin + .row-wrapper > .cand { border-bottom-left-radius: ${r}; }\n` +
        `.container.preedit-hidden > .pinyin + .row-wrapper > .cand { border-top-left-radius: ${r}; }\n` +
        `.container > .row-wrapper:is(:last-child, .last-visible) > .cand { border-bottom-right-radius: ${r}; }\n` +
        `.container.preedit-hidden > .row-wrapper:is(:last-child, .last-visible) > .cand { border-top-right-radius: ${r}; }\n`;
    }
  }

  css += colorLines(colors);

  const itemRadius = cw.item_corner_radius_dip ?? BASE_ITEM_RADIUS[base];
  if (colors?.preedit_background) {
    css += `.row.pinyin { background: ${colors.preedit_background}; border-radius: ${itemRadius}px; }\n`;
  }
  if (colors?.preedit_divider) {
    css += `.row.pinyin { border-bottom: 1px solid ${colors.preedit_divider}; }\n`;
  }
  if (cw.border_width_dip !== undefined) {
    css +=
      `.container:not(:empty) { border: ${cw.border_width_dip}px solid ` +
      `${resolvedBorder(base, theme, colors)}; }\n`;
  }
  if (cw.item_corner_radius_dip !== undefined) {
    css += `.container { --ao-item-radius: ${itemRadius}px; }\n`;
    css += `.container .cand, .container .cand.first { border-radius: ${itemRadius}px; }\n`;
  }
  if (cw.shadow) {
    const selector = base === 'willow_green' ? '.containerParent:not(:empty)' : '.container:not(:empty)';
    let value = 'none';
    if (cw.shadow !== 'none') {
      const scale = cw.shadow === 'soft' ? 0.5 : 1.6;
      const a1 = Math.min((theme === 'light' ? 0.18 : 0.34) * scale, 1);
      const a2 = Math.min((theme === 'light' ? 0.1 : 0.22) * scale, 1);
      value = `8px 10px 24px rgba(0, 0, 0, ${a1.toFixed(3)}), 2px 3px 8px rgba(0, 0, 0, ${a2.toFixed(3)})`;
    }
    css += `${selector} { box-shadow: ${value}; }\n`;
  }

  const bg = cw.background;
  if (bg && bg.image) {
    const size = bg.fit === 'contain' ? 'contain' : bg.fit === 'stretch' ? '100% 100%' : 'cover';
    const opacity = bg.opacity ?? 1;
    const veil = scaleRgba(resolvedSurface(base, theme, colors), 1 - opacity);
    css +=
      `.container:not(:empty) { background-image: linear-gradient(${veil}, ${veil}), url("${urlFor(bg.image)}"); ` +
      `background-size: auto, ${size}; background-position: center; background-repeat: no-repeat; ` +
      `background-origin: border-box; background-clip: border-box; }\n`;
  }

  css += borderImageCss(cfg, urlFor);
  css += contentInsetsCss(cfg);

  if (cw.line_gap_dip) {
    css += `.row.pinyin { margin-bottom: ${cw.line_gap_dip}px; }\n`;
  }

  css += decorationCss(cfg, urlFor);

  return css;
}

/** 宿主写进 <html> 内联样式里的几个变量。 */
export function buildHostVars(cfg: SkinV2Config): string {
  const cw = cfg.candidate_window;
  const minWidth = cw.min_width_dip ?? 0;
  const decorationTop = cw.decoration?.top_inset_dip ?? 0;
  const decorationWidth = cw.decoration?.width_dip ?? 0;
  return `--msime-skin-min-width:${minWidth}px;--msime-skin-decoration-top:${decorationTop}px;--msime-skin-decoration-width:${decorationWidth}px;`;
}

export function outerInsetsOf(cfg: SkinV2Config): Insets {
  return cfg.candidate_window.outer_insets_dip ?? { top: 0, right: 0, bottom: 0, left: 0 };
}

export { expandFour };
