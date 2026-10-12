import { SkinV2Config, FourSides } from '../types/skin';

function formatFourSides(sides?: FourSides<number>): string {
  if (!sides) return '{ top = 0, right = 0, bottom = 0, left = 0 }';
  return `{ top = ${sides.top}, right = ${sides.right}, bottom = ${sides.bottom}, left = ${sides.left} }`;
}

function escapeString(val: string): string {
  return JSON.stringify(val);
}

export function serializeSkinToml(config: SkinV2Config): string {
  const lines: string[] = [];

  // [meta]
  lines.push('[meta]');
  lines.push(`schema_version = 2`);
  lines.push(`name = ${escapeString(config.meta.name)}`);
  lines.push(`version = ${escapeString(config.meta.version || '1.0.0')}`);
  lines.push(`author = ${escapeString(config.meta.author || '原创皮肤工坊')}`);
  lines.push(`description = ${escapeString(config.meta.description || '')}`);
  const modes = (config.meta.supported_modes || ['horizontal']).map(m => `"${m}"`).join(', ');
  lines.push(`supported_modes = [${modes}]`);
  lines.push('');

  // [candidate_window]
  lines.push('[candidate_window]');
  if (config.candidate_window.background_color) {
    lines.push(`background_color = ${escapeString(config.candidate_window.background_color)}`);
  }
  if (config.candidate_window.background_image) {
    lines.push(`background_image = ${escapeString(config.candidate_window.background_image)}`);
  }
  if (config.candidate_window.border_slice_px) {
    lines.push(`border_slice_px = ${formatFourSides(config.candidate_window.border_slice_px)}`);
  }
  if (config.candidate_window.border_width_dip) {
    lines.push(`border_width_dip = ${formatFourSides(config.candidate_window.border_width_dip)}`);
  }
  if (config.candidate_window.scale_mode) {
    lines.push(`scale_mode = ${escapeString(config.candidate_window.scale_mode)}`);
  }
  if (config.candidate_window.margin_dip) {
    lines.push(`margin_dip = ${formatFourSides(config.candidate_window.margin_dip)}`);
  }
  if (config.candidate_window.corner_radius_dip !== undefined) {
    lines.push(`corner_radius_dip = ${config.candidate_window.corner_radius_dip}`);
  }
  if (config.candidate_window.line_gap_dip !== undefined) {
    lines.push(`line_gap_dip = ${config.candidate_window.line_gap_dip}`);
  }
  if (config.candidate_window.item_gap_dip !== undefined) {
    lines.push(`item_gap_dip = ${config.candidate_window.item_gap_dip}`);
  }
  if (config.candidate_window.min_width_dip !== undefined) {
    lines.push(`min_width_dip = ${config.candidate_window.min_width_dip}`);
  }
  if (config.candidate_window.min_height_dip !== undefined) {
    lines.push(`min_height_dip = ${config.candidate_window.min_height_dip}`);
  }
  lines.push('');

  // [preedit]
  if (config.preedit) {
    lines.push('[preedit]');
    if (config.preedit.text_color) lines.push(`text_color = ${escapeString(config.preedit.text_color)}`);
    if (config.preedit.font_size_pt !== undefined) lines.push(`font_size_pt = ${config.preedit.font_size_pt}`);
    if (config.preedit.font_weight !== undefined) lines.push(`font_weight = ${config.preedit.font_weight}`);
    if (config.preedit.offset_dip) {
      lines.push(`offset_dip = { x = ${config.preedit.offset_dip.x}, y = ${config.preedit.offset_dip.y} }`);
    }
    lines.push('');
  }

  // [candidate_item]
  if (config.candidate_item) {
    lines.push('[candidate_item]');
    if (config.candidate_item.text_color) lines.push(`text_color = ${escapeString(config.candidate_item.text_color)}`);
    if (config.candidate_item.number_color) lines.push(`number_color = ${escapeString(config.candidate_item.number_color)}`);
    if (config.candidate_item.font_size_pt !== undefined) lines.push(`font_size_pt = ${config.candidate_item.font_size_pt}`);
    if (config.candidate_item.font_weight !== undefined) lines.push(`font_weight = ${config.candidate_item.font_weight}`);
    lines.push('');
  }

  // [highlight_item]
  if (config.highlight_item) {
    lines.push('[highlight_item]');
    if (config.highlight_item.text_color) lines.push(`text_color = ${escapeString(config.highlight_item.text_color)}`);
    if (config.highlight_item.number_color) lines.push(`number_color = ${escapeString(config.highlight_item.number_color)}`);
    if (config.highlight_item.background_color) lines.push(`background_color = ${escapeString(config.highlight_item.background_color)}`);
    if (config.highlight_item.background_image) lines.push(`background_image = ${escapeString(config.highlight_item.background_image)}`);
    if (config.highlight_item.border_slice_px) lines.push(`border_slice_px = ${formatFourSides(config.highlight_item.border_slice_px)}`);
    if (config.highlight_item.border_width_dip) lines.push(`border_width_dip = ${formatFourSides(config.highlight_item.border_width_dip)}`);
    if (config.highlight_item.scale_mode) lines.push(`scale_mode = ${escapeString(config.highlight_item.scale_mode)}`);
    if (config.highlight_item.corner_radius_dip !== undefined) lines.push(`corner_radius_dip = ${config.highlight_item.corner_radius_dip}`);
    lines.push('');
  }

  // [paging]
  if (config.paging) {
    lines.push('[paging]');
    if (config.paging.prev_color) lines.push(`prev_color = ${escapeString(config.paging.prev_color)}`);
    if (config.paging.next_color) lines.push(`next_color = ${escapeString(config.paging.next_color)}`);
    if (config.paging.font_size_pt !== undefined) lines.push(`font_size_pt = ${config.paging.font_size_pt}`);
    lines.push('');
  }

  // [[accessories]]
  if (config.accessories && config.accessories.length > 0) {
    for (const acc of config.accessories) {
      lines.push('[[accessories]]');
      lines.push(`id = ${escapeString(acc.id)}`);
      lines.push(`image = ${escapeString(acc.image)}`);
      lines.push(`anchor = ${escapeString(acc.anchor)}`);
      lines.push(`offset_dip = { x = ${acc.offset_dip.x}, y = ${acc.offset_dip.y} }`);
      if (acc.size_dip) {
        lines.push(`size_dip = { width = ${acc.size_dip.width}, height = ${acc.size_dip.height} }`);
      }
      lines.push(`z_order = ${acc.z_order}`);
      if (acc.attach_to) {
        lines.push(`attach_to = ${escapeString(acc.attach_to)}`);
      }
      lines.push('');
    }
  }

  // [vertical_candidate_window]
  if (config.vertical_candidate_window) {
    lines.push('[vertical_candidate_window]');
    if (config.vertical_candidate_window.background_color) {
      lines.push(`background_color = ${escapeString(config.vertical_candidate_window.background_color)}`);
    }
    if (config.vertical_candidate_window.background_image) {
      lines.push(`background_image = ${escapeString(config.vertical_candidate_window.background_image)}`);
    }
    if (config.vertical_candidate_window.border_slice_px) {
      lines.push(`border_slice_px = ${formatFourSides(config.vertical_candidate_window.border_slice_px)}`);
    }
    if (config.vertical_candidate_window.border_width_dip) {
      lines.push(`border_width_dip = ${formatFourSides(config.vertical_candidate_window.border_width_dip)}`);
    }
    if (config.vertical_candidate_window.min_width_dip !== undefined) {
      lines.push(`min_width_dip = ${config.vertical_candidate_window.min_width_dip}`);
    }
    if (config.vertical_candidate_window.min_height_dip !== undefined) {
      lines.push(`min_height_dip = ${config.vertical_candidate_window.min_height_dip}`);
    }
    lines.push('');
  }

  // [[vertical_accessories]]
  if (config.vertical_accessories && config.vertical_accessories.length > 0) {
    for (const acc of config.vertical_accessories) {
      lines.push('[[vertical_accessories]]');
      lines.push(`id = ${escapeString(acc.id)}`);
      lines.push(`image = ${escapeString(acc.image)}`);
      lines.push(`anchor = ${escapeString(acc.anchor)}`);
      lines.push(`offset_dip = { x = ${acc.offset_dip.x}, y = ${acc.offset_dip.y} }`);
      if (acc.size_dip) {
        lines.push(`size_dip = { width = ${acc.size_dip.width}, height = ${acc.size_dip.height} }`);
      }
      lines.push(`z_order = ${acc.z_order}`);
      if (acc.attach_to) {
        lines.push(`attach_to = ${escapeString(acc.attach_to)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function parseSkinToml(content: string): Partial<SkinV2Config> {
  const result: any = {
    meta: {
      schema_version: 2,
      name: '自定义皮肤',
      version: '1.0.0',
      author: '匿名',
      description: '',
      supported_modes: ['horizontal']
    },
    candidate_window: {},
    accessories: []
  };

  const lines = content.split('\n');
  let currentSection = '';
  let currentAccessory: any = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line === '[[accessories]]') {
      currentSection = 'accessory';
      currentAccessory = {};
      result.accessories.push(currentAccessory);
      continue;
    }

    const secMatch = line.match(/^\[([a-zA-Z0-9_]+)\]$/);
    if (secMatch) {
      currentSection = secMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let valStr = kvMatch[2].trim();

    const targetObj = currentSection === 'accessory' ? currentAccessory : result[currentSection];
    if (!targetObj) continue;

    // 解析内联对象 { top = 1, ... } 或 { x = 0, y = 0 }
    if (valStr.startsWith('{') && valStr.endsWith('}')) {
      const inner = valStr.slice(1, -1);
      const obj: any = {};
      const pairs = inner.split(',');
      for (const p of pairs) {
        const [pk, pv] = p.split('=').map(s => s.trim());
        if (pk && pv) {
          obj[pk] = isNaN(Number(pv)) ? pv.replace(/^["']|["']$/g, '') : Number(pv);
        }
      }
      targetObj[key] = obj;
      continue;
    }

    // 解析数组 ["a", "b"]
    if (valStr.startsWith('[') && valStr.endsWith(']')) {
      const inner = valStr.slice(1, -1);
      targetObj[key] = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      continue;
    }

    // 字符串
    if (valStr.startsWith('"') && valStr.endsWith('"')) {
      targetObj[key] = valStr.slice(1, -1);
      continue;
    }

    // 数字
    if (!isNaN(Number(valStr))) {
      targetObj[key] = Number(valStr);
      continue;
    }

    // 布尔
    if (valStr === 'true') targetObj[key] = true;
    else if (valStr === 'false') targetObj[key] = false;
    else targetObj[key] = valStr;
  }

  return result as SkinV2Config;
}
