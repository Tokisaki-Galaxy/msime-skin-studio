import { SkinV2Config } from '../types/skin';

export interface SkinTemplate {
  id: string;
  name: string;
  description: string;
  config: SkinV2Config;
  defaultImages?: Record<string, string>;
}

// 模板内置的占位贴图用 SVG data URL，方便在浏览器里直接预览。
// 导出前请换成真正的 PNG：水杉用 WIC 解码，SVG 存成 .png 后缀是打不开的。
function createSvgSliceDataUrl(bgColor: string, borderColor: string, radius: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect x="2" y="2" width="60" height="60" rx="${radius}" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSvgCharacterDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="#f472b6"/>
    <circle cx="24" cy="26" r="4" fill="#ffffff"/>
    <circle cx="40" cy="26" r="4" fill="#ffffff"/>
    <path d="M26 40 Q32 46 38 40" stroke="#ffffff" stroke-width="3" fill="none"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SKIN_TEMPLATES: SkinTemplate[] = [
  {
    id: 'fluent-glass',
    name: '现代磨砂',
    description: '纯色圆角卡片，只调配色与间距，最容易上手',
    config: {
      meta: {
        schema_version: 2,
        id: 'my_glass_skin',
        name: '现代磨砂',
        version: '1.0.0',
        author: '原创皮肤工坊',
        description: '极简透明质感的现代皮肤',
        base: 'fluent',
        supports: { layouts: ['horizontal', 'vertical'], themes: ['dark', 'light'] }
      },
      candidate_window: {
        corner_radius_dip: 10,
        border_width_dip: 1.5,
        item_corner_radius_dip: 6,
        shadow: 'soft',
        line_gap_dip: 6
      },
      candidate: {
        dark: {
          surface: 'rgba(32, 32, 32, 0.92)',
          border: 'rgba(255, 255, 255, 0.08)',
          text: '#e9e8e8',
          number: '#e9e8e89d',
          accent: '#8e8cd8',
          selected: '#3e3e3eb9',
          hover: '#414141',
          candidate_text: '#e9e8e8',
          preedit_text: '#8e8cd8',
          selected_text: '#ffffff'
        },
        light: {
          surface: 'rgba(255, 255, 255, 0.94)',
          border: 'rgba(0, 0, 0, 0.08)',
          text: '#1a1a1a',
          number: '#1a1a1a8c',
          accent: '#6f6bc7',
          selected: '#e8e8e8',
          hover: '#ececec',
          candidate_text: '#1a1a1a',
          preedit_text: '#6f6bc7',
          selected_text: '#1a1a1a'
        }
      }
    }
  },
  {
    id: 'panel-decor',
    name: '贴图面板',
    description: '九宫格贴图面板加一个挂在卡片外沿的立绘，v2 的完整形态',
    config: {
      meta: {
        schema_version: 2,
        id: 'my_panel_skin',
        name: '贴图面板立绘款',
        version: '1.0.0',
        author: '原创皮肤工坊',
        description: '整图面板加自由挂件',
        base: 'fluent',
        supports: { layouts: ['horizontal'], themes: ['dark', 'light'] }
      },
      candidate_window: {
        border_image: {
          source: 'assets/cand_bg.png',
          slice_dip: [16, 16, 16, 16],
          width_dip: [16, 16, 16, 16],
          fill: true
        },
        content_insets_dip: { top: 18, right: 18, bottom: 18, left: 18 },
        outer_insets_dip: { top: 0, right: 0, bottom: 0, left: 76 },
        decorations: [
          {
            image: 'assets/character.png',
            anchor: 'bottom-left',
            width_dip: 72,
            height_dip: 72,
            offset_x_dip: -76,
            offset_y_dip: 0,
            z_index: 2
          }
        ]
      },
      candidate: {
        dark: { candidate_text: '#4a044e', preedit_text: '#701a75', number: '#a21caf', accent: '#c026d3' },
        light: { candidate_text: '#4a044e', preedit_text: '#701a75', number: '#a21caf', accent: '#c026d3' }
      }
    },
    defaultImages: {
      'assets/cand_bg.png': createSvgSliceDataUrl('#fdf4ff', '#f0abfc', 16),
      'assets/character.png': createSvgCharacterDataUrl()
    }
  },
  {
    id: 'graphite-dark',
    name: '石墨深色',
    description: '沿用 graphite 基础皮肤，只改配色',
    config: {
      meta: {
        schema_version: 2,
        id: 'my_graphite_skin',
        name: '石墨深色',
        version: '1.0.0',
        author: '原创皮肤工坊',
        description: '高对比深色皮肤',
        base: 'graphite',
        supports: { layouts: ['horizontal', 'vertical'], themes: ['dark'] }
      },
      candidate_window: {
        corner_radius_dip: 8,
        item_corner_radius_dip: 4,
        shadow: 'strong'
      },
      candidate: {
        dark: {
          surface: '#0f172a',
          border: '#1e293b',
          text: '#f8fafc',
          number: '#64748b',
          accent: '#22c55e',
          selected: 'rgba(34, 197, 94, 0.15)',
          hover: 'rgba(34, 197, 94, 0.08)',
          candidate_text: '#f8fafc',
          preedit_text: '#38bdf8',
          selected_text: '#4ade80'
        }
      }
    }
  }
];
