export interface FourSides<T = number> {
  top: T;
  right: T;
  bottom: T;
  left: T;
}

export type LayoutMode = 'horizontal' | 'vertical';
export type ScaleMode = 'stretch' | 'tile';
export type AccessoryAnchor =
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'center'
  | 'top_center'
  | 'bottom_center'
  | 'center_left'
  | 'center_right';

export type AccessoryAttachTo = 'window' | 'highlight_item';

export interface SkinMeta {
  schema_version: 2;
  name: string;
  version: string;
  author: string;
  description: string;
  supported_modes: LayoutMode[];
}

export interface CandidateWindowStyle {
  margin_dip?: FourSides<number>;
  corner_radius_dip?: number;
  background_color?: string;
  background_image?: string;
  border_slice_px?: FourSides<number>;
  border_width_dip?: FourSides<number>;
  scale_mode?: ScaleMode;
  line_gap_dip?: number;
  item_gap_dip?: number;
  min_width_dip?: number;
  min_height_dip?: number;
}

export interface PreeditStyle {
  text_color?: string;
  font_size_pt?: number;
  font_weight?: number;
  offset_dip?: {
    x: number;
    y: number;
  };
}

export interface CandidateItemStyle {
  text_color?: string;
  number_color?: string;
  font_size_pt?: number;
  font_weight?: number;
}

export interface HighlightItemStyle {
  text_color?: string;
  number_color?: string;
  background_color?: string;
  background_image?: string;
  border_slice_px?: FourSides<number>;
  border_width_dip?: FourSides<number>;
  scale_mode?: ScaleMode;
  font_size_pt?: number;
  font_weight?: number;
  corner_radius_dip?: number;
}

export interface PagingStyle {
  prev_color?: string;
  next_color?: string;
  font_size_pt?: number;
}

export interface AccessoryStyle {
  id: string;
  image: string;
  anchor: AccessoryAnchor;
  offset_dip: {
    x: number;
    y: number;
  };
  size_dip?: {
    width: number;
    height: number;
  };
  z_order: number;
  attach_to?: AccessoryAttachTo;
}

export interface SkinV2Config {
  meta: SkinMeta;
  candidate_window: CandidateWindowStyle;
  preedit?: PreeditStyle;
  candidate_item?: CandidateItemStyle;
  highlight_item?: HighlightItemStyle;
  paging?: PagingStyle;
  accessories?: AccessoryStyle[];
  // 竖排专属配置
  vertical_candidate_window?: CandidateWindowStyle;
  vertical_accessories?: AccessoryStyle[];
}

export interface SkinAsset {
  path: string;
  blobUrl: string;
  file?: File;
  width?: number;
  height?: number;
}
