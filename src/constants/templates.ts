import { SkinV2Config } from '../types/skin';

export interface SkinTemplate {
  id: string;
  name: string;
  description: string;
  config: SkinV2Config;
  defaultImages?: Record<string, string>; // path -> dataUrl/svg
}

// 生成简单的纯色/圆角SVG九宫格作为模板内置素材
function createSvgSliceDataUrl(bgColor: string, borderColor: string, radius: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect x="2" y="2" width="60" height="60" rx="${radius}" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SKIN_TEMPLATES: SkinTemplate[] = [
  {
    id: 'modern-glass',
    name: '现代极简磨砂卡片',
    description: '通透高雅的半透明设计，兼顾轻量与美感',
    config: {
      meta: {
        schema_version: 2,
        name: '现代极简磨砂',
        version: '1.0.0',
        author: '官方预设',
        description: '极简透明质感现代皮肤',
        supported_modes: ['horizontal', 'vertical']
      },
      candidate_window: {
        background_color: 'rgba(255, 255, 255, 0.85)',
        corner_radius_dip: 12,
        margin_dip: { top: 8, right: 12, bottom: 8, left: 12 },
        line_gap_dip: 8,
        item_gap_dip: 16
      },
      preedit: {
        text_color: '#334155',
        font_size_pt: 11,
        font_weight: 400
      },
      candidate_item: {
        text_color: '#0f172a',
        number_color: '#94a3b8',
        font_size_pt: 12,
        font_weight: 400
      },
      highlight_item: {
        text_color: '#0284c7',
        number_color: '#38bdf8',
        background_color: 'rgba(2, 132, 199, 0.08)',
        corner_radius_dip: 6,
        font_weight: 500
      },
      paging: {
        prev_color: '#94a3b8',
        next_color: '#94a3b8',
        font_size_pt: 10
      },
      accessories: []
    }
  },
  {
    id: 'character-stand',
    name: '萌系立绘挂件款',
    description: '自带左下角角色立绘与对话气泡风格的个性皮肤',
    config: {
      meta: {
        schema_version: 2,
        name: '萌系立绘主题',
        version: '1.0.0',
        author: '原创皮肤工坊',
        description: '附带角色立绘与自适应气泡边框',
        supported_modes: ['horizontal']
      },
      candidate_window: {
        background_image: 'assets/cand_bg.png',
        border_slice_px: { top: 16, right: 16, bottom: 16, left: 16 },
        border_width_dip: { top: 16, right: 16, bottom: 16, left: 16 },
        scale_mode: 'stretch',
        line_gap_dip: 8,
        item_gap_dip: 14
      },
      preedit: {
        text_color: '#701a75',
        font_size_pt: 11
      },
      candidate_item: {
        text_color: '#4a044e',
        number_color: '#a21caf',
        font_size_pt: 12
      },
      highlight_item: {
        text_color: '#c026d3',
        number_color: '#e879f9',
        background_color: 'rgba(192, 38, 211, 0.1)',
        corner_radius_dip: 8
      },
      paging: {
        prev_color: '#d946ef',
        next_color: '#d946ef',
        font_size_pt: 10
      },
      accessories: [
        {
          id: 'character_badge',
          image: 'assets/character.png',
          anchor: 'bottom_left',
          offset_dip: { x: -28, y: 16 },
          size_dip: { width: 56, height: 56 },
          z_order: 10,
          attach_to: 'window'
        }
      ]
    },
    defaultImages: {
      'assets/cand_bg.png': createSvgSliceDataUrl('#fdf4ff', '#f0abfc', 16),
      'assets/character.png': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="%23f472b6"/><circle cx="24" cy="26" r="4" fill="%23ffffff"/><circle cx="40" cy="26" r="4" fill="%23ffffff"/><path d="M26 40 Q32 46 38 40" stroke="%23ffffff" stroke-width="3" fill="none"/></svg>'
    }
  },
  {
    id: 'cyber-dark',
    name: '赛博深色电竞款',
    description: '暗黑荧光配色，适合夜间与专注编码环境',
    config: {
      meta: {
        schema_version: 2,
        name: '赛博电竞深色',
        version: '1.0.0',
        author: '官方预设',
        description: '高对比深色极客皮肤',
        supported_modes: ['horizontal', 'vertical']
      },
      candidate_window: {
        background_color: '#0f172a',
        corner_radius_dip: 8,
        margin_dip: { top: 8, right: 12, bottom: 8, left: 12 },
        line_gap_dip: 8,
        item_gap_dip: 16
      },
      preedit: {
        text_color: '#38bdf8',
        font_size_pt: 11
      },
      candidate_item: {
        text_color: '#f8fafc',
        number_color: '#64748b',
        font_size_pt: 12
      },
      highlight_item: {
        text_color: '#22c55e',
        number_color: '#4ade80',
        background_color: 'rgba(34, 197, 94, 0.15)',
        corner_radius_dip: 4
      },
      paging: {
        prev_color: '#64748b',
        next_color: '#64748b',
        font_size_pt: 10
      },
      accessories: []
    }
  }
];
