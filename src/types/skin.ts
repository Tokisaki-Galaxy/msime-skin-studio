// 水杉输入法外部皮肤 schema_version = 2 的数据模型。
// 字段名、层级、取值范围与 server/src/skin/candidate_skin_catalog.h 一一对应，
// 导出的 skin.toml 必须能被水杉原样加载。

export type LayoutMode = 'horizontal' | 'vertical';
export type ThemeName = 'dark' | 'light';

/** 内置基础皮肤 id，对应 ui-html/webview2/candwnd/skins/<id>/。 */
export const BUILT_IN_SKINS = [
  'fluent',
  'wechat',
  'graphite',
  'willow_green',
  'autumn_osmanthus',
  'microsoft'
] as const;
export type BuiltInSkin = (typeof BUILT_IN_SKINS)[number];

export const BUILT_IN_SKIN_LABELS: Record<BuiltInSkin, string> = {
  fluent: 'fluent 现代',
  wechat: 'wechat 微信',
  graphite: 'graphite 石墨',
  willow_green: 'willow_green 杨柳青',
  autumn_osmanthus: 'autumn_osmanthus 秋桂',
  microsoft: 'microsoft 微软'
};

export type DecorationAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'center';

export const DECORATION_ANCHORS: DecorationAnchor[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left',
  'right',
  'top',
  'bottom',
  'center'
];

export type DecorationAlign = 'left' | 'center' | 'right';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type ShadowLevel = 'none' | 'soft' | 'strong';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 九宫格贴图面板。切片与宽度都按「上右下左」排列，支持 1~4 个值。 */
export interface BorderImage {
  source: string;
  /** 四边切片大小（DIP）。 */
  slice_dip?: number[];
  /** 可拉伸区，给出时覆盖 slice_dip。面板图里画死的装饰要落在它之外。 */
  stretch_dip?: number[];
  /** 四边绘制宽度（DIP），为空时沿用 slice_dip。 */
  width_dip?: number[];
  /** 是否保留九宫格中心内容区，默认 true。 */
  fill?: boolean;
}

/** 卡片上方的装饰图（v1 起的旧机制，只有一张，贴在卡片上方）。 */
export interface TopDecoration {
  image: string;
  top_inset_dip: number;
  width_dip: number;
  align?: DecorationAlign;
}

/** 卡片背景图，画在底色之上、文字之下，按圆角裁剪。 */
export interface BackgroundImage {
  image: string;
  fit?: BackgroundFit;
  opacity?: number;
}

/** 自由锚定挂件层，层数不限。 */
export interface FreeDecoration {
  image: string;
  anchor: DecorationAnchor;
  width_dip: number;
  height_dip: number;
  /** 相对锚点的平移量，正数向右、向下。 */
  offset_x_dip?: number;
  offset_y_dip?: number;
  /** 层级，默认 2。 */
  z_index?: number;
}

export interface CandidateWindowStyle {
  min_width_dip?: number;
  corner_radius_dip?: number;
  /** 外框线宽，0–4。 */
  border_width_dip?: number;
  /** 候选项高亮圆角，0–16。 */
  item_corner_radius_dip?: number;
  shadow?: ShadowLevel;
  font_family?: string;
  page_arrows?: boolean;
  fit_content?: boolean;
  /** 预编辑行与候选行之间的行距，0–100。 */
  line_gap_dip?: number;
  decoration?: TopDecoration;
  background?: BackgroundImage;
  border_image?: BorderImage;
  /** 文字安全内边距，从面板外缘量起，渲染时扣掉边框宽度。 */
  content_insets_dip?: Insets;
  /** 挂件挂在卡片外沿时窗口要额外预留的透明空白。 */
  outer_insets_dip?: Insets;
  decorations?: FreeDecoration[];
}

export interface CandidateMenuColors {
  background?: string;
  border?: string;
  text?: string;
  hover?: string;
}

export interface CandidateColors {
  accent?: string;
  selected?: string;
  hover?: string;
  surface?: string;
  border?: string;
  text?: string;
  number?: string;
  translation?: string;
  translation_pos?: string;
  translation_separator?: string;
  show_selected_bar?: boolean;
  candidate_text?: string;
  preedit_text?: string;
  preedit_caret?: string;
  selected_text?: string;
  selected_number?: string;
  selected_translation?: string;
  selected_translation_pos?: string;
  selected_translation_separator?: string;
  selected_bar?: string;
  preedit_background?: string;
  preedit_divider?: string;
  menu?: CandidateMenuColors;
}

export interface ToolbarColors {
  background?: string;
  border?: string;
  handle?: string;
  divider?: string;
  icon?: string;
  hover?: string;
}

export interface SkinMeta {
  schema_version: 2;
  /** 必须与皮肤目录名一致。 */
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  base: BuiltInSkin;
  supports?: {
    layouts?: LayoutMode[];
    themes?: ThemeName[];
  };
  license?: {
    code?: string;
    assets?: string;
  };
}

export interface SkinV2Config {
  meta: SkinMeta;
  candidate_window: CandidateWindowStyle;
  candidate: {
    dark?: CandidateColors;
    light?: CandidateColors;
  };
  toolbar?: {
    corner_radius_dip?: number;
    dark?: ToolbarColors;
    light?: ToolbarColors;
  };
}

export interface SkinAsset {
  path: string;
  blobUrl: string;
  file?: File;
  width?: number;
  height?: number;
}

/** 把 1~4 个值展开成「上右下左」，与 CSS 的 border-image-slice 规则一致。 */
export function expandFour(values: number[] | undefined): Insets {
  const v = values ?? [];
  if (v.length === 1) return { top: v[0], right: v[0], bottom: v[0], left: v[0] };
  if (v.length === 2) return { top: v[0], right: v[1], bottom: v[0], left: v[1] };
  return {
    top: v[0] ?? 0,
    right: v[1] ?? 0,
    bottom: v[2] ?? 0,
    left: v[3] ?? 0
  };
}

/** 把「上右下左」压成 TOML 里最短的数组写法。 */
export function compactFour(insets: Insets): number[] {
  const { top, right, bottom, left } = insets;
  if (top === right && right === bottom && bottom === left) return [top];
  if (top === bottom && right === left) return [top, right];
  return [top, right, bottom, left];
}

/** 面板实际生效的边框宽度：没写 width_dip 时沿用 stretch_dip，再没有就是 slice_dip。 */
export function resolveBorderWidth(bi: BorderImage | undefined): Insets {
  if (!bi) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (bi.width_dip && bi.width_dip.length > 0) return expandFour(bi.width_dip);
  if (bi.stretch_dip && bi.stretch_dip.length > 0) return expandFour(bi.stretch_dip);
  return expandFour(bi.slice_dip);
}

/** 面板实际生效的切片：stretch_dip 优先。 */
export function resolveBorderSlice(bi: BorderImage | undefined): Insets {
  if (!bi) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (bi.stretch_dip && bi.stretch_dip.length > 0) return expandFour(bi.stretch_dip);
  return expandFour(bi.slice_dip);
}
