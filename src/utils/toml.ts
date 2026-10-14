import { SkinV2Config, CandidateColors, Insets } from '../types/skin';

// ---------------------------------------------------------------------------
// 序列化：写出水杉能直接加载的 skin.toml
// ---------------------------------------------------------------------------

function q(val: string): string {
  return JSON.stringify(val);
}

function num(val: number): string {
  if (Number.isInteger(val)) return String(val);
  return String(Number(val.toFixed(4)));
}

function arr(values: number[]): string {
  return `[${values.map(num).join(', ')}]`;
}

const COLOR_KEYS: (keyof CandidateColors)[] = [
  'accent',
  'selected',
  'hover',
  'surface',
  'border',
  'text',
  'number',
  'translation',
  'translation_pos',
  'translation_separator',
  'show_selected_bar',
  'candidate_text',
  'preedit_text',
  'preedit_caret',
  'selected_text',
  'selected_number',
  'selected_translation',
  'selected_translation_pos',
  'selected_translation_separator',
  'selected_bar',
  'preedit_background',
  'preedit_divider'
];

function pushColors(lines: string[], header: string, colors?: CandidateColors) {
  if (!colors) return;
  const body: string[] = [];
  for (const key of COLOR_KEYS) {
    const value = colors[key];
    if (value === undefined || value === '') continue;
    if (typeof value === 'boolean') body.push(`${key} = ${value}`);
    else body.push(`${key} = ${q(value as string)}`);
  }
  const menu = colors.menu;
  if (body.length > 0 || menu) {
    lines.push(header);
    lines.push(...body);
    if (menu) {
      lines.push('');
      lines.push(`${header}.menu`);
      for (const key of ['background', 'border', 'text', 'hover'] as const) {
        const value = menu[key];
        if (value) lines.push(`${key} = ${q(value)}`);
      }
    }
    lines.push('');
  }
}

function pushInsets(lines: string[], header: string, insets?: Insets) {
  if (!insets) return;
  lines.push(header);
  lines.push(`top = ${num(insets.top)}`);
  lines.push(`right = ${num(insets.right)}`);
  lines.push(`bottom = ${num(insets.bottom)}`);
  lines.push(`left = ${num(insets.left)}`);
  lines.push('');
}

export function serializeSkinToml(config: SkinV2Config): string {
  const lines: string[] = [];
  const meta = config.meta;

  lines.push(`schema_version = 2`);
  lines.push(`id = ${q(meta.id || 'my_skin')}`);
  lines.push(`name = ${q(meta.name || '')}`);
  lines.push(`version = ${q(meta.version || '1.0.0')}`);
  if (meta.author) lines.push(`author = ${q(meta.author)}`);
  if (meta.description) lines.push(`description = ${q(meta.description)}`);
  lines.push(`base = ${q(meta.base || 'fluent')}`);
  lines.push('');

  if (meta.supports && (meta.supports.layouts || meta.supports.themes)) {
    lines.push('[supports]');
    if (meta.supports.layouts) {
      lines.push(`layouts = [${meta.supports.layouts.map(q).join(', ')}]`);
    }
    if (meta.supports.themes) {
      lines.push(`themes = [${meta.supports.themes.map(q).join(', ')}]`);
    }
    lines.push('');
  }

  if (meta.license && (meta.license.code || meta.license.assets)) {
    lines.push('[license]');
    if (meta.license.code) lines.push(`code = ${q(meta.license.code)}`);
    if (meta.license.assets) lines.push(`assets = ${q(meta.license.assets)}`);
    lines.push('');
  }

  // ---- [candidate_window]：先写标量，再写子表，顺序不能反 ----
  const cw = config.candidate_window;
  const winLines: string[] = [];
  if (cw.min_width_dip !== undefined) winLines.push(`min_width_dip = ${num(cw.min_width_dip)}`);
  if (cw.corner_radius_dip !== undefined) winLines.push(`corner_radius_dip = ${num(cw.corner_radius_dip)}`);
  if (cw.border_width_dip !== undefined) winLines.push(`border_width_dip = ${num(cw.border_width_dip)}`);
  if (cw.item_corner_radius_dip !== undefined)
    winLines.push(`item_corner_radius_dip = ${num(cw.item_corner_radius_dip)}`);
  if (cw.shadow) winLines.push(`shadow = ${q(cw.shadow)}`);
  if (cw.font_family) winLines.push(`font_family = ${q(cw.font_family)}`);
  if (cw.page_arrows !== undefined) winLines.push(`page_arrows = ${cw.page_arrows}`);
  if (cw.fit_content !== undefined) winLines.push(`fit_content = ${cw.fit_content}`);
  if (cw.line_gap_dip !== undefined) winLines.push(`line_gap_dip = ${num(cw.line_gap_dip)}`);
  if (winLines.length > 0) {
    lines.push('[candidate_window]');
    lines.push(...winLines);
    lines.push('');
  }

  if (cw.background && cw.background.image) {
    lines.push('[candidate_window.background]');
    lines.push(`image = ${q(cw.background.image)}`);
    if (cw.background.fit) lines.push(`fit = ${q(cw.background.fit)}`);
    if (cw.background.opacity !== undefined) lines.push(`opacity = ${num(cw.background.opacity)}`);
    lines.push('');
  }

  if (cw.decoration && cw.decoration.image) {
    lines.push('[candidate_window.decoration]');
    lines.push(`image = ${q(cw.decoration.image)}`);
    lines.push(`top_inset_dip = ${num(cw.decoration.top_inset_dip)}`);
    lines.push(`width_dip = ${num(cw.decoration.width_dip)}`);
    if (cw.decoration.align) lines.push(`align = ${q(cw.decoration.align)}`);
    lines.push('');
  }

  if (cw.border_image && cw.border_image.source) {
    const bi = cw.border_image;
    lines.push('[candidate_window.border_image]');
    lines.push(`source = ${q(bi.source)}`);
    if (bi.slice_dip && bi.slice_dip.length > 0) lines.push(`slice_dip = ${arr(bi.slice_dip)}`);
    if (bi.stretch_dip && bi.stretch_dip.length > 0) lines.push(`stretch_dip = ${arr(bi.stretch_dip)}`);
    if (bi.width_dip && bi.width_dip.length > 0) lines.push(`width_dip = ${arr(bi.width_dip)}`);
    if (bi.fill !== undefined) lines.push(`fill = ${bi.fill}`);
    lines.push('');
  }

  pushInsets(lines, '[candidate_window.content_insets_dip]', cw.content_insets_dip);
  pushInsets(lines, '[candidate_window.outer_insets_dip]', cw.outer_insets_dip);

  for (const dec of cw.decorations ?? []) {
    if (!dec.image) continue;
    lines.push('[[candidate_window.decorations]]');
    lines.push(`image = ${q(dec.image)}`);
    lines.push(`anchor = ${q(dec.anchor)}`);
    lines.push(`width_dip = ${num(dec.width_dip)}`);
    lines.push(`height_dip = ${num(dec.height_dip)}`);
    if (dec.offset_x_dip !== undefined) lines.push(`offset_x_dip = ${num(dec.offset_x_dip)}`);
    if (dec.offset_y_dip !== undefined) lines.push(`offset_y_dip = ${num(dec.offset_y_dip)}`);
    if (dec.z_index !== undefined) lines.push(`z_index = ${dec.z_index}`);
    lines.push('');
  }

  pushColors(lines, '[candidate.dark]', config.candidate?.dark);
  pushColors(lines, '[candidate.light]', config.candidate?.light);

  if (config.toolbar) {
    const toolbarLines: string[] = [];
    if (config.toolbar.corner_radius_dip !== undefined)
      toolbarLines.push(`corner_radius_dip = ${num(config.toolbar.corner_radius_dip)}`);
    const hasColors = config.toolbar.dark || config.toolbar.light;
    if (toolbarLines.length > 0 || hasColors) {
      lines.push('[toolbar]');
      lines.push(...toolbarLines);
      lines.push('');
    }
    const pushToolbar = (header: string, colors?: Record<string, string | undefined>) => {
      if (!colors) return;
      const body = (['background', 'border', 'handle', 'divider', 'icon', 'hover'] as const)
        .filter(key => colors[key])
        .map(key => `${key} = ${q(colors[key] as string)}`);
      if (body.length === 0) return;
      lines.push(header);
      lines.push(...body);
      lines.push('');
    };
    pushToolbar('[toolbar.dark]', config.toolbar.dark as Record<string, string | undefined>);
    pushToolbar('[toolbar.light]', config.toolbar.light as Record<string, string | undefined>);
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// 解析：够用的 TOML 子集（标量、数组、内联表、[a.b] 表、[[a.b]] 数组表）
// ---------------------------------------------------------------------------

function stripComment(line: string): string {
  let inBasic = false;
  let inLiteral = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inBasic) {
      if (ch === '\\') i++;
      else if (ch === '"') inBasic = false;
    } else if (inLiteral) {
      if (ch === "'") inLiteral = false;
    } else if (ch === '"') inBasic = true;
    else if (ch === "'") inLiteral = true;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inBasic = false;
  let inLiteral = false;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inBasic) {
      if (ch === '\\') i++;
      else if (ch === '"') inBasic = false;
      continue;
    }
    if (inLiteral) {
      if (ch === "'") inLiteral = false;
      continue;
    }
    if (ch === '"') inBasic = true;
    else if (ch === "'") inLiteral = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

function parseValue(raw: string): unknown {
  const text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) return text.slice(1, -1);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitTopLevel(text.slice(1, -1)).map(parseValue);
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    const obj: Record<string, unknown> = {};
    for (const pair of splitTopLevel(text.slice(1, -1))) {
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      obj[pair.slice(0, eq).trim()] = parseValue(pair.slice(eq + 1));
    }
    return obj;
  }
  const n = Number(text.replace(/_/g, ''));
  if (!Number.isNaN(n) && text !== '') return n;
  return text;
}

function descend(root: Record<string, unknown>, path: string): Record<string, unknown> {
  let node = root;
  for (const rawKey of path.split('.')) {
    const key = rawKey.trim().replace(/^["']|["']$/g, '');
    const next = node[key];
    if (next && typeof next === 'object' && !Array.isArray(next)) {
      node = next as Record<string, unknown>;
    } else {
      const created: Record<string, unknown> = {};
      node[key] = created;
      node = created;
    }
  }
  return node;
}

function descendArray(root: Record<string, unknown>, path: string): Record<string, unknown> {
  const parts = path.split('.').map(p => p.trim().replace(/^["']|["']$/g, ''));
  const leaf = parts.pop() as string;
  const parent = descend(root, parts.join('.'));
  if (!Array.isArray(parent[leaf])) parent[leaf] = [];
  const created: Record<string, unknown> = {};
  (parent[leaf] as Record<string, unknown>[]).push(created);
  return created;
}

export function parseToml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    let match = line.match(/^\[\[(.+)\]\]$/);
    if (match) {
      current = descendArray(root, match[1]);
      continue;
    }
    match = line.match(/^\[(.+)\]$/);
    if (match) {
      current = descend(root, match[1]);
      continue;
    }

    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().replace(/^["']|["']$/g, '');
    current[key] = parseValue(line.slice(eq + 1));
  }
  return root;
}

export function parseSkinToml(content: string): Partial<SkinV2Config> {
  const raw = parseToml(content) as Record<string, any>;
  // TOML 里 schema_version / id / name 都是顶层键，模型里收在 meta 下。
  const meta = {
    schema_version: raw.schema_version ?? 2,
    id: raw.id ?? '',
    name: raw.name ?? '',
    version: raw.version ?? '',
    author: raw.author,
    description: raw.description,
    base: raw.base ?? 'fluent',
    supports: raw.supports,
    license: raw.license
  };
  return {
    meta,
    candidate_window: raw.candidate_window ?? {},
    candidate: raw.candidate ?? {},
    toolbar: raw.toolbar
  } as Partial<SkinV2Config>;
}
