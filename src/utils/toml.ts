import {
  SkinV2Config,
  CandidateColors,
  Insets,
  LayoutMode,
  ThemeName,
  BUILT_IN_SKINS,
  DECORATION_ANCHORS
} from '../types/skin';

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

  const resolvedId = meta.id || 'my_skin';
  lines.push(`schema_version = 2`);
  lines.push(`id = ${q(resolvedId)}`);
  // name 不能写空串：水杉 ReadString(root, "name", 80, true) 要求必填。回落顺序是 id。
  lines.push(`name = ${q(meta.name || resolvedId)}`);
  lines.push(`version = ${q(meta.version || '1.0.0')}`);
  if (meta.author) lines.push(`author = ${q(meta.author)}`);
  if (meta.description) lines.push(`description = ${q(meta.description)}`);
  lines.push(`base = ${q(meta.base || 'fluent')}`);
  lines.push('');

  // supports.layouts / themes 都是必填且非空，缺一个就整份皮肤加载失败，必须补默认值。
  const layouts = meta.supports?.layouts && meta.supports.layouts.length > 0 ? meta.supports.layouts : (['horizontal'] as LayoutMode[]);
  const themes = meta.supports?.themes && meta.supports.themes.length > 0 ? meta.supports.themes : (['dark', 'light'] as ThemeName[]);
  lines.push('[supports]');
  lines.push(`layouts = [${layouts.map(q).join(', ')}]`);
  lines.push(`themes = [${themes.map(q).join(', ')}]`);
  lines.push('');

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
// 校验：严格对照 server/src/skin/candidate_skin_catalog.cpp 的 Load()
// ---------------------------------------------------------------------------

export interface SkinValidationIssue {
  /** 出问题的字段路径，例如 candidate_window.border_image.slice_dip */
  field: string;
  message: string;
}

const LAYOUTS: LayoutMode[] = ['horizontal', 'vertical'];
const THEMES: ThemeName[] = ['dark', 'light'];
const SHADOWS = ['none', 'soft', 'strong'];
const ALIGNS = ['left', 'center', 'right'];
const FITS = ['cover', 'contain', 'stretch'];

/** 对应 IsSafeId：非空、≤64、首字符是字母或数字、其余只含 [a-z0-9._-]。 */
export function isValidSkinId(id: string): boolean {
  if (!id || id.length > 64) return false;
  if (!/^[a-z0-9]/i.test(id[0])) return false;
  return /^[a-z0-9._-]+$/i.test(id);
}

/** 对应 ReadString 的长度与必填判定。 */
function checkString(
  issues: SkinValidationIssue[],
  field: string,
  value: string | undefined,
  maximum: number,
  required: boolean
): boolean {
  if (value === undefined) {
    if (required) issues.push({ field, message: `${field} 不能缺失` });
    return false;
  }
  if (typeof value !== 'string') {
    issues.push({ field, message: `${field} 必须是字符串` });
    return false;
  }
  if (required && value.length === 0) {
    issues.push({ field, message: `${field} 不能为空` });
    return false;
  }
  if (value.length > maximum) {
    issues.push({ field, message: `${field} 长度不能超过 ${maximum}` });
    return false;
  }
  return true;
}

/** 对应 BoundedNumber：缺省返回 0，非数字或越界返回 -1。这里直接报错。 */
function checkNumber(
  issues: SkinValidationIssue[],
  field: string,
  value: number | undefined,
  maximum: number,
  minimum = 0
): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ field, message: `${field} 必须是数值` });
    return false;
  }
  if (value < minimum || value > maximum) {
    issues.push({ field, message: `${field} 必须在 ${minimum} 到 ${maximum} 之间` });
    return false;
  }
  return true;
}

/**
 * 对应 ReadCssColor：水杉放行 [A-Za-z0-9#(),.% /-]，不放行中文、分号、'!'、'@' 之类。
 * 颜色会被拼进 WebView2 的 CSS 声明，空串等于没写，是合法的。
 */
const CSS_COLOR_CHARS = /^[A-Za-z0-9#(),.% /-]*$/;

function checkCssColor(issues: SkinValidationIssue[], field: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string') {
    issues.push({ field, message: `${field} 必须是字符串` });
    return;
  }
  if (value.length > 80) {
    issues.push({ field, message: `${field} 长度不能超过 80` });
    return;
  }
  if (!CSS_COLOR_CHARS.test(value)) {
    issues.push({ field, message: `${field} 含非法字符，只能是颜色值字符 [A-Za-z0-9#(),.% /-]` });
  }
}

/** 对应 ReadCssColor 的键集合，逐条走一遍。 */
function checkCandidateColors(issues: SkinValidationIssue[], prefix: string, colors?: CandidateColors): void {
  if (!colors) return;
  const keys: (keyof CandidateColors)[] = [
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
  for (const key of keys) {
    checkCssColor(issues, `${prefix}.${key}`, colors[key]);
  }
  if (colors.menu) {
    for (const key of ['background', 'border', 'text', 'hover'] as const) {
      checkCssColor(issues, `${prefix}.menu.${key}`, colors.menu[key]);
    }
  }
}

/** 对应 candidate_window.font_family 的字符集判定。 */
function checkFontFamily(issues: SkinValidationIssue[], value: string | undefined): void {
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string') {
    issues.push({ field: 'candidate_window.font_family', message: 'candidate_window.font_family 必须是字符串' });
    return;
  }
  if (value.length > 64) {
    issues.push({ field: 'candidate_window.font_family', message: 'candidate_window.font_family 长度不能超过 64' });
  }
  // 控制字符（含 DEL）与非 ASCII 之外的敏感符号都不放行；中文等非 ASCII 字节一律放行。
  const safe = Array.from(value).every(ch => {
    const code = ch.codePointAt(0) as number;
    if (code >= 0x80) return true;
    if (code < 0x20 || code === 0x7f) return false;
    return !'"\'\\,;{}<>`'.includes(ch);
  });
  if (!safe) {
    issues.push({
      field: 'candidate_window.font_family',
      message: 'candidate_window.font_family 不能包含引号、反斜杠、逗号、分号、花括号、尖括号、反引号或控制字符'
    });
  }
}

/** 对应 border_image 里三组切片数组的公共判定。 */
function checkSliceArray(
  issues: SkinValidationIssue[],
  field: string,
  values: number[] | undefined
): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    issues.push({ field, message: `${field} 必须是数组` });
    return;
  }
  if (values.length !== 1 && values.length !== 2 && values.length !== 4) {
    issues.push({ field, message: `${field} 必须包含 1、2 或 4 个数值` });
    return;
  }
  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 500) {
      issues.push({ field, message: `${field}[${index}] 必须在 0 到 500 之间` });
    }
  });
}

function checkInsets(
  issues: SkinValidationIssue[],
  prefix: string,
  insets: Partial<Insets> | undefined,
  topBottomMax: number,
  rightLeftMax: number
): void {
  if (insets === undefined || insets === null) return;
  const limits: [keyof Insets, number][] = [
    ['top', topBottomMax],
    ['right', rightLeftMax],
    ['bottom', topBottomMax],
    ['left', rightLeftMax]
  ];
  for (const [key, maximum] of limits) {
    const value = insets[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ field: `${prefix}.${key}`, message: `${prefix}.${key} 必须是数值` });
      continue;
    }
    if (value < 0 || value > maximum) {
      issues.push({ field: `${prefix}.${key}`, message: `${prefix}.${key} 必须在 0 到 ${maximum} 之间` });
    }
  }
}

/**
 * 严格对照水杉 CandidateSkinCatalog::Load() 的硬校验。
 * 水杉那边任何一条不过就整份皮肤加载失败，没有回退，所以这里也不做任何下调。
 */
export function validateSkinConfig(config: SkinV2Config): SkinValidationIssue[] {
  const issues: SkinValidationIssue[] = [];
  const meta = config?.meta ?? ({ schema_version: 2, id: '', name: '', version: '', base: undefined } as unknown as SkinV2Config['meta']);

  checkString(issues, 'id', meta.id, 64, true);
  if (typeof meta.id === 'string' && meta.id.length > 0) {
    // 与 IsSafeId 一致：首字符必须是字母或数字，其余只含小写字母、数字与 . _ -
    if (!/^[a-z0-9]/i.test(meta.id[0])) {
      issues.push({ field: 'id', message: 'id 必须以小写字母或数字开头' });
    } else if (!/^[a-z0-9._-]+$/i.test(meta.id)) {
      issues.push({ field: 'id', message: 'id 只能包含小写字母、数字和 . _ -' });
    }
  }
  checkString(issues, 'name', meta.name, 80, true);
  checkString(issues, 'version', meta.version, 32, true);
  checkString(issues, 'author', meta.author, 120, false);
  checkString(issues, 'description', meta.description, 500, false);

  const base = meta.base as string | undefined;
  if (base === undefined || base === null || base === '') {
    issues.push({ field: 'base', message: 'base 不能为空' });
  } else if (typeof base !== 'string') {
    issues.push({ field: 'base', message: 'base 必须是字符串' });
  } else if (!(BUILT_IN_SKINS as readonly string[]).includes(base)) {
    issues.push({ field: 'base', message: `base 只能是 ${BUILT_IN_SKINS.join('、')} 之一` });
  }

  // supports.layouts / supports.themes：必填、至少一项、值合法且不重复。
  const supports = meta.supports;
  const layouts = supports?.layouts;
  const themes = supports?.themes;
  if (!Array.isArray(layouts) || layouts.length === 0) {
    issues.push({ field: 'supports.layouts', message: 'supports.layouts 必填且不能为空数组' });
  } else {
    layouts.forEach((item, index) => {
      if (!LAYOUTS.includes(item)) {
        issues.push({ field: 'supports.layouts', message: `supports.layouts[${index}] 只能是 horizontal 或 vertical` });
      }
    });
    if (new Set(layouts).size !== layouts.length) {
      issues.push({ field: 'supports.layouts', message: 'supports.layouts 不能有重复项' });
    }
  }
  if (!Array.isArray(themes) || themes.length === 0) {
    issues.push({ field: 'supports.themes', message: 'supports.themes 必填且不能为空数组' });
  } else {
    themes.forEach((item, index) => {
      if (!THEMES.includes(item)) {
        issues.push({ field: 'supports.themes', message: `supports.themes[${index}] 只能是 dark 或 light` });
      }
    });
    if (new Set(themes).size !== themes.length) {
      issues.push({ field: 'supports.themes', message: 'supports.themes 不能有重复项' });
    }
  }

  const cw = config?.candidate_window ?? {};

  checkNumber(issues, 'candidate_window.min_width_dip', cw.min_width_dip, 1000);
  checkNumber(issues, 'candidate_window.corner_radius_dip', cw.corner_radius_dip, 32);
  checkNumber(issues, 'candidate_window.border_width_dip', cw.border_width_dip, 4);
  checkNumber(issues, 'candidate_window.item_corner_radius_dip', cw.item_corner_radius_dip, 16);
  checkNumber(issues, 'candidate_window.line_gap_dip', cw.line_gap_dip, 100);

  if (cw.shadow !== undefined && !SHADOWS.includes(cw.shadow)) {
    issues.push({ field: 'candidate_window.shadow', message: 'candidate_window.shadow 只能是 none、soft 或 strong' });
  }
  checkFontFamily(issues, cw.font_family);

  // decoration：写了这张表就必须给 image，且 top_inset_dip 与 width_dip 都要大于 0。
  if (cw.decoration) {
    const dec = cw.decoration;
    if (!dec.image) {
      issues.push({ field: 'candidate_window.decoration.image', message: 'candidate_window.decoration.image 必填' });
    } else {
      checkString(issues, 'candidate_window.decoration.image', dec.image, 256, true);
    }
    if (dec.align !== undefined && !ALIGNS.includes(dec.align)) {
      issues.push({ field: 'candidate_window.decoration.align', message: 'candidate_window.decoration.align 只能是 left、center 或 right' });
    }
    const top = dec.top_inset_dip;
    if (typeof top !== 'number' || !Number.isFinite(top) || top <= 0 || top > 500) {
      issues.push({
        field: 'candidate_window.decoration.top_inset_dip',
        message: 'candidate_window.decoration.top_inset_dip 必须大于 0 且不超过 500'
      });
    }
    const width = dec.width_dip;
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || width > 1000) {
      issues.push({
        field: 'candidate_window.decoration.width_dip',
        message: 'candidate_window.decoration.width_dip 必须大于 0 且不超过 1000'
      });
    }
  }

  if (cw.background) {
    if (!cw.background.image) {
      issues.push({ field: 'candidate_window.background.image', message: 'candidate_window.background.image 必填' });
    } else {
      checkString(issues, 'candidate_window.background.image', cw.background.image, 256, true);
    }
    if (cw.background.fit !== undefined && !FITS.includes(cw.background.fit)) {
      issues.push({ field: 'candidate_window.background.fit', message: 'candidate_window.background.fit 只能是 cover、contain 或 stretch' });
    }
    checkNumber(issues, 'candidate_window.background.opacity', cw.background.opacity, 1);
  }

  // border_image 只在 schema_version >= 2 时读取，本编辑器导出的都是 2。
  if (cw.border_image) {
    const bi = cw.border_image;
    if (!bi.source) {
      issues.push({ field: 'candidate_window.border_image.source', message: 'candidate_window.border_image.source 必填' });
    } else {
      checkString(issues, 'candidate_window.border_image.source', bi.source, 256, true);
    }
    if (!Array.isArray(bi.slice_dip) || bi.slice_dip.length === 0) {
      issues.push({
        field: 'candidate_window.border_image.slice_dip',
        message: 'candidate_window.border_image.slice_dip 必填，且必须包含 1、2 或 4 个数值'
      });
    } else {
      checkSliceArray(issues, 'candidate_window.border_image.slice_dip', bi.slice_dip);
    }
    checkSliceArray(issues, 'candidate_window.border_image.stretch_dip', bi.stretch_dip);
    checkSliceArray(issues, 'candidate_window.border_image.width_dip', bi.width_dip);
  }

  checkInsets(issues, 'candidate_window.content_insets_dip', cw.content_insets_dip, 200, 500);
  checkInsets(issues, 'candidate_window.outer_insets_dip', cw.outer_insets_dip, 500, 500);

  if (cw.decorations) {
    if (!Array.isArray(cw.decorations)) {
      issues.push({ field: 'candidate_window.decorations', message: 'candidate_window.decorations 必须是数组' });
    } else {
      cw.decorations.forEach((dec, index) => {
        const prefix = `candidate_window.decorations[${index}]`;
        if (!dec.image) {
          issues.push({ field: `${prefix}.image`, message: `${prefix}.image 必填` });
        } else {
          checkString(issues, `${prefix}.image`, dec.image, 256, true);
        }
        if (dec.anchor === undefined || dec.anchor === null || (dec.anchor as string) === '') {
          // 锚点缺省时水杉用包内默认值，合法。
        } else if (!DECORATION_ANCHORS.includes(dec.anchor)) {
          issues.push({ field: `${prefix}.anchor`, message: `${prefix}.anchor 不是允许的九个锚点之一` });
        }
        const width = dec.width_dip;
        if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || width > 2000) {
          issues.push({ field: `${prefix}.width_dip`, message: `${prefix}.width_dip 必须大于 0 且不超过 2000` });
        }
        const height = dec.height_dip;
        if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0 || height > 2000) {
          issues.push({ field: `${prefix}.height_dip`, message: `${prefix}.height_dip 必须大于 0 且不超过 2000` });
        }
      });
    }
  }

  checkCandidateColors(issues, 'candidate.dark', config?.candidate?.dark);
  checkCandidateColors(issues, 'candidate.light', config?.candidate?.light);

  if (config?.toolbar) {
    checkNumber(issues, 'toolbar.corner_radius_dip', config.toolbar.corner_radius_dip, 32);
    for (const theme of ['dark', 'light'] as const) {
      const colors = config.toolbar[theme];
      if (!colors) continue;
      for (const key of ['background', 'border', 'handle', 'divider', 'icon', 'hover'] as const) {
        checkCssColor(issues, `toolbar.${theme}.${key}`, colors[key]);
      }
    }
  }

  return issues;
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
