import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import * as pako from 'pako';
import {
  CandidateColors,
  DecorationAnchor,
  FreeDecoration,
  Insets,
  SkinV2Config
} from '../types/skin';

const AES_KEY_HEX = '5236461ad38503669045162879033623ddbe6f03ff04e3cad57ffca350e49ed9';
const AES_IV_HEX = 'e07aad35e090aa038a51fd05df8c5d0f';

export interface UnpackedFile {
  name: string;
  data: Uint8Array;
}

/**
 * 解密搜狗 Skin 加密格式
 */
export function extractEncryptedSkin(bytes: Uint8Array): UnpackedFile[] {
  if (bytes.length <= 12) {
    throw new Error('文件太小，不是有效的搜狗加密皮肤');
  }
  const encryptedPayload = bytes.subarray(8);

  const keyWords = CryptoJS.enc.Hex.parse(AES_KEY_HEX);
  const ivWords = CryptoJS.enc.Hex.parse(AES_IV_HEX);

  const words: number[] = [];
  for (let i = 0; i < encryptedPayload.length; i += 4) {
    words.push(
      ((encryptedPayload[i] || 0) << 24) |
        ((encryptedPayload[i + 1] || 0) << 16) |
        ((encryptedPayload[i + 2] || 0) << 8) |
        (encryptedPayload[i + 3] || 0)
    );
  }
  const encryptedWords = CryptoJS.lib.WordArray.create(words, encryptedPayload.length);

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: encryptedWords } as CryptoJS.lib.CipherParams,
    keyWords,
    { iv: ivWords, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  // 密钥对不上时 CryptoJS 返回 0 字节，直接喂给 pako 只会得到一句看不懂的 zlib 报错。
  if (decrypted.sigBytes < 8) {
    throw new Error('无法解密该皮肤，可能不是搜狗加密皮肤，或文件已损坏');
  }

  const decryptedBytes = new Uint8Array(decrypted.sigBytes);
  for (let i = 0; i < decrypted.sigBytes; i++) {
    decryptedBytes[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }

  let uncompressed: Uint8Array;
  try {
    // decrypted[0..4) 是头，压缩流从第 4 字节开始。
    uncompressed = pako.inflate(decryptedBytes.subarray(4));
  } catch {
    throw new Error('皮肤内容解压失败，文件可能已损坏');
  }

  // [0..4): total_size  [4..8): hdr_size  [8..8+hdr_size): offsets
  if (uncompressed.byteLength < 8) {
    throw new Error('皮肤目录结构不完整');
  }
  const view = new DataView(uncompressed.buffer, uncompressed.byteOffset, uncompressed.byteLength);
  const hdrSize = view.getUint32(4, true);
  if (hdrSize === 0 || hdrSize % 4 !== 0 || 8 + hdrSize > uncompressed.byteLength) {
    throw new Error('皮肤目录头部长度非法');
  }
  const numOffsets = hdrSize / 4;

  // 下面是逐条读目录项。偏移量与长度全部来自文件，任何一处越界都可能让 subarray 读空
  // 或者让 TextDecoder 吃到巨量数据，所以每个取值都要先落到缓冲区内再使用。
  const total = uncompressed.byteLength;
  const files: UnpackedFile[] = [];
  for (let i = 0; i < numOffsets; i++) {
    const off = view.getUint32(8 + i * 4, true);
    if (off + 4 > total) {
      throw new Error(`皮肤目录项 ${i} 的偏移越界`);
    }
    const nameLen = view.getUint32(off, true);
    if (nameLen > 1024 || off + 4 + nameLen + 4 > total) {
      throw new Error(`皮肤目录项 ${i} 的文件名长度非法`);
    }
    const nameBytes = uncompressed.subarray(off + 4, off + 4 + nameLen);
    const name = new TextDecoder('utf-16le').decode(nameBytes);

    const contentLenOff = off + 4 + nameLen;
    const contentLen = view.getUint32(contentLenOff, true);
    if (contentLenOff + 4 + contentLen > total) {
      throw new Error(`皮肤目录项 ${i} 的内容长度越界`);
    }
    const fileBytes = uncompressed.subarray(contentLenOff + 4, contentLenOff + 4 + contentLen);

    files.push({ name, data: new Uint8Array(fileBytes) });
  }

  return files;
}

export async function extractZipSkin(bytes: Uint8Array): Promise<UnpackedFile[]> {
  const zip = await JSZip.loadAsync(bytes);
  const files: UnpackedFile[] = [];
  for (const [name, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const content = await zipEntry.async('uint8array');
    files.push({ name, data: content });
  }
  return files;
}

export function parseIni(text: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim();
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1 && currentSection) {
      result[currentSection][line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
    }
  }

  return result;
}

/** 搜狗颜色是 0xBBGGRR，水杉要 #RRGGBB。 */
export function parseSogouColor(raw?: string, fallback?: string): string | undefined {
  if (!raw) return fallback;
  const trimmed = raw.trim();

  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const hex = trimmed.slice(2).padStart(6, '0');
    if (hex.length === 6) {
      const b = hex.slice(0, 2);
      const g = hex.slice(2, 4);
      const r = hex.slice(4, 6);
      return `#${r}${g}${b}`;
    }
  }
  if (trimmed.startsWith('#')) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;

  const parts = trimmed.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
    return (
      '#' +
      parts
        .slice(0, 3)
        .map(n => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return fallback;
}

/**
 * 转 base64。不能写成 `binary += String.fromCharCode(byte)` 那种逐字节拼接，
 * 单张皮肤贴图动辄几百 KB 到几 MB，逐字节拼会构造超长中间字符串，直接把主线程卡住。
 * 这里按块处理，每块用 apply 一次性展开，块大小取 0x8000 以免超过调用参数上限。
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * 只读图片头部拿宽高。水杉两端都支持 GIF：WebView2 播放动图，D2D 用 WIC 解出静态首帧
 * （ui/src/DeviceResources.cpp 的 GetBitmapFromFile 取 GetFrame(0)）。所以 GIF 必须能拿到尺寸，
 * 否则挂件宽度算成 0，渲染出来就是看不见。
 */
export function getImageDimensions(dataUri: string): { width: number; height: number } {
  try {
    const bin = atob(dataUri.split(',')[1]);
    if (bin.length > 26) {
      // PNG：IHDR 的宽高在固定偏移
      if (bin.charCodeAt(0) === 0x89 && bin.charCodeAt(1) === 0x50) {
        const width = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
        const height = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
        return { width, height };
      }
      // BMP：小端 32 位
      if (bin.charCodeAt(0) === 0x42 && bin.charCodeAt(1) === 0x4d) {
        const width = bin.charCodeAt(18) | (bin.charCodeAt(19) << 8) | (bin.charCodeAt(20) << 16) | (bin.charCodeAt(21) << 24);
        const height = Math.abs(bin.charCodeAt(22) | (bin.charCodeAt(23) << 8) | (bin.charCodeAt(24) << 16) | (bin.charCodeAt(25) << 24));
        return { width, height };
      }
      // GIF：逻辑屏幕描述符紧跟 6 字节签名与 3 字节版本，宽高都是小端 16 位
      if (bin.charCodeAt(0) === 0x47 && bin.charCodeAt(1) === 0x49 && bin.charCodeAt(2) === 0x46) {
        const width = bin.charCodeAt(6) | (bin.charCodeAt(7) << 8);
        const height = bin.charCodeAt(8) | (bin.charCodeAt(9) << 8);
        return { width, height };
      }
    }
  } catch {
    /* 忽略：拿不到尺寸时按 0 处理 */
  }
  return { width: 0, height: 0 };
}

/** 搜狗 `layout_horizontal` / `layout_vertical` 形如 `mode, 前, 后`，后两个是固定的边宽。 */
function parseLayout(value?: string): { first: number; second: number } | null {
  if (!value) return null;
  const parts = value.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length < 3 || parts.some(n => isNaN(n))) return null;
  return { first: Math.max(0, parts[1]), second: Math.max(0, parts[2]) };
}

/** `a,b,c,d` 四个整数。 */
function parseQuad(value?: string): number[] | null {
  if (!value) return null;
  const parts = value.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return null;
  return parts;
}

/**
 * 搜狗 `customN_align` 有 10 个数，第 6、8 位在实测样本里只出现 0 与 2，
 * 且与立绘实际所在方向一致（0 = 左/上，2 = 右/下）。其余位含义未知，这里不猜。
 */
function anchorFromAlign(value?: string): DecorationAnchor {
  const parts = (value || '').split(',').map(s => parseInt(s.trim(), 10));
  const horizontal = parts[5];
  const vertical = parts[7];
  const left = horizontal !== 2;
  const top = vertical !== 2;
  if (left && top) return 'top-left';
  if (left && !top) return 'bottom-left';
  if (!left && top) return 'top-right';
  return 'bottom-right';
}

/** msime 要求 id 只含小写字母数字与 . _ -，且以字母数字开头，长度 ≤ 64。 */
/** 搜狗皮肤制作工具预填、作者常常忘了改的占位名。这些名字等于「没填」。 */
const PLACEHOLDER_SKIN_NAMES = ['new', 'skin', 'default', 'untitled', '未命名'];

function isPlaceholderName(value: string): boolean {
  return PLACEHOLDER_SKIN_NAMES.includes(value.trim().toLowerCase());
}

/** 文件名去掉扩展名与浏览器另存留下的 "(1)" 尾缀。xxx.ssf.zip 这类双后缀也剥干净。 */
export function stripSkinFileName(fileName: string): string {
  return fileName
    .replace(/(\.(ssf|zip))+$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .trim();
}

/**
 * 决定导入后的皮肤显示名。
 * 优先级：skin.ini 里的 skin_name → 文件名 → 「搜狗皮肤 <skin_id>」→ 通用名字。
 * skin_name 与文件名都可能是占位值（new / skin），浏览器另存还会留下「xxx (1)」尾缀。
 */
export function resolveSkinTitle(
  skinName: string | undefined,
  fileName: string,
  skinId?: string
): { title: string; fellBackFrom?: string } {
  const rawName = (skinName || '').trim();
  const baseName = stripSkinFileName(fileName);
  const placeholderFrom = rawName && isPlaceholderName(rawName) ? rawName : undefined;

  if (rawName && !isPlaceholderName(rawName)) return { title: rawName };
  if (baseName && !isPlaceholderName(baseName)) return { title: baseName, fellBackFrom: placeholderFrom };
  // skin_id 缺失时不要拼出「搜狗皮肤 」，那样比直接用通用名更难懂。
  const idSuffix = (skinId || '').trim();
  if (idSuffix) return { title: `搜狗皮肤 ${idSuffix}`, fellBackFrom: placeholderFrom };
  return { title: '未命名搜狗皮肤', fellBackFrom: placeholderFrom };
}

export function safeSkinId(source: string, skinId?: string): string {
  const ascii = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  if (ascii) return `sogou_${ascii}`;
  // 名字全是中文时，用搜狗的 skin_id，再不行就用名字的哈希，保证不同皮肤不会撞 id。
  const numeric = (skinId || '').replace(/[^0-9]/g, '');
  if (numeric) return `sogou_${numeric}`.slice(0, 64);
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return `sogou_skin_${hash.toString(16)}`;
}

export interface SsfImportResult {
  skinConfig: SkinV2Config;
  images: Record<string, string>;
  warnings: string[];
}

export async function processSsfArchive(arrayBuffer: ArrayBuffer, fileName: string): Promise<SsfImportResult> {
  const bytes = new Uint8Array(arrayBuffer);

  let files: UnpackedFile[] = [];
  const magic = String.fromCharCode(...bytes.subarray(0, 4));

  if (magic === 'Skin') {
    files = extractEncryptedSkin(bytes);
  } else {
    try {
      files = await extractZipSkin(bytes);
    } catch {
      files = extractEncryptedSkin(bytes);
    }
  }

  const images: Record<string, string> = {};
  let iniFile: UnpackedFile | undefined;

  for (const file of files) {
    const cleanName = file.name.replace(/\\/g, '/').split('/').pop() || file.name;
    const lower = cleanName.toLowerCase();

    if (lower === 'skin.ini') {
      iniFile = file;
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.bmp') || lower.endsWith('.gif')) {
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.gif')
        ? 'image/gif'
        : lower.endsWith('.bmp')
        ? 'image/bmp'
        : 'image/jpeg';
      images[cleanName] = `data:${mime};base64,${bytesToBase64(file.data)}`;
    }
  }

  if (!iniFile) throw new Error('皮肤包里没有 skin.ini');

  let iniText = '';
  const data = iniFile.data;
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
    iniText = new TextDecoder('utf-16le').decode(data);
  } else if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    iniText = new TextDecoder('utf-8').decode(data.subarray(3));
  } else {
    try {
      iniText = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      iniText = new TextDecoder('gb18030').decode(data);
    }
  }

  const ini = parseIni(iniText);
  const general = ini['General'] || {};
  const display = ini['Display'] || {};
  const cand = ini['Skin_Cand'] || {};
  const schemeH1 = ini['Scheme_H1'] || {};

  const warnings: string[] = [];

  const { title, fellBackFrom } = resolveSkinTitle(general['skin_name'], fileName, general['skin_id']);
  if (fellBackFrom) {
    warnings.push(`skin.ini 里的皮肤名是制作工具留下的占位名「${fellBackFrom}」，已改用「${title}」，可在右侧属性里修改。`);
  }

  // ---- 面板与九宫格 ----
  const panelRaw = cand['bg_cand'] || schemeH1['pic'] || '';
  const panelName = panelRaw.replace(/\\/g, '/').split('/').pop() || '';
  const hasPanel = panelName !== '' && !!images[panelName];

  if (!hasPanel) {
    const guess = Object.keys(images).find(k => /skin1|cand|bg/i.test(k));
    if (guess) {
      warnings.push(`skin.ini 里没有可用的面板图，改用 ${guess}`);
    } else {
      warnings.push('皮肤包里找不到面板图，只转换了配色');
    }
  }
  const panelFile = hasPanel ? panelName : Object.keys(images).find(k => /skin1|cand|bg/i.test(k)) || '';

  const horizontal = parseLayout(schemeH1['layout_horizontal']);
  const vertical = parseLayout(schemeH1['layout_vertical']);
  const slice = [
    vertical ? vertical.first : 0,
    horizontal ? horizontal.second : 0,
    vertical ? vertical.second : 0,
    horizontal ? horizontal.first : 0
  ];

  const zhongwen = parseQuad(schemeH1['zhongwen_marge']);
  const contentInsets: Insets | undefined = zhongwen
    ? { left: zhongwen[0], top: zhongwen[1], right: zhongwen[2], bottom: zhongwen[3] }
    : undefined;

  // ---- 挂件：只收 customN_display = 1 的，其余在搜狗里本来就不显示 ----
  const decorations: FreeDecoration[] = [];
  const customCount = parseInt(schemeH1['custom_cnt'] || '0', 10);
  for (let i = 0; i < customCount; i++) {
    if (schemeH1[`custom${i}_display`] !== '1') continue;
    const pic = schemeH1[`custom${i}`];
    if (!pic) continue;
    const clean = pic.replace(/\\/g, '/').split('/').pop() || '';
    if (!images[clean]) {
      warnings.push(`挂件 ${clean} 的图片不在包里，已跳过`);
      continue;
    }
    const dims = getImageDimensions(images[clean]);
    decorations.push({
      image: `assets/${clean}`,
      anchor: anchorFromAlign(schemeH1[`custom${i}_align`]),
      width_dip: dims.width,
      height_dip: dims.height,
      offset_x_dip: 0,
      offset_y_dip: 0,
      z_index: 2
    });
    warnings.push(`挂件 ${clean} 的锚点由 custom${i}_align 推测（第 6、8 位），位置需要在工坊里核对`);
  }
  if (customCount > 0 && decorations.length === 0) {
    warnings.push('搜狗里声明了挂件但没有 customN_display = 1，按不显示处理');
  }

  // ---- 外留白：按挂件超出面板图的范围估算，避免立绘被窗口裁掉 ----
  const panelDims = panelFile && images[panelFile] ? getImageDimensions(images[panelFile]) : { width: 0, height: 0 };
  const outer: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  if (panelDims.width > 0 && panelDims.height > 0) {
    for (const dec of decorations) {
      const ox = dec.offset_x_dip ?? 0;
      const oy = dec.offset_y_dip ?? 0;
      switch (dec.anchor) {
        case 'top-left':
          outer.left = Math.max(outer.left, -ox);
          outer.top = Math.max(outer.top, -oy);
          break;
        case 'top-right':
          outer.right = Math.max(outer.right, ox);
          outer.top = Math.max(outer.top, -oy);
          break;
        case 'bottom-left':
          outer.left = Math.max(outer.left, -ox);
          outer.bottom = Math.max(outer.bottom, oy);
          break;
        case 'bottom-right':
          outer.right = Math.max(outer.right, ox);
          outer.bottom = Math.max(outer.bottom, oy);
          break;
        case 'top':
          outer.top = Math.max(outer.top, -oy);
          break;
        case 'bottom':
          outer.bottom = Math.max(outer.bottom, oy);
          break;
        case 'left':
          outer.left = Math.max(outer.left, -ox);
          break;
        case 'right':
          outer.right = Math.max(outer.right, ox);
          break;
        default:
          break;
      }
    }
  }
  const hasOuter = outer.top > 0 || outer.right > 0 || outer.bottom > 0 || outer.left > 0;

  // ---- 配色 ----
  const colors: CandidateColors = {};
  const preeditColor = parseSogouColor(cand['py_color'] || display['pinyin_color']);
  const candidateColor = parseSogouColor(cand['cand_color'] || display['zhongwen_color']);
  const firstColor = parseSogouColor(cand['cand_hl_color'] || display['zhongwen_first_color']);
  const numberColor = parseSogouColor(cand['cand_num_color'] || display['zhongwen_color']);

  if (candidateColor) {
    colors.text = candidateColor;
    colors.candidate_text = candidateColor;
  }
  if (preeditColor) colors.preedit_text = preeditColor;
  if (numberColor) colors.number = numberColor;
  if (firstColor) {
    colors.selected_text = firstColor;
    colors.selected_number = firstColor;
    colors.accent = firstColor;
    colors.selected_bar = firstColor;
  }

  // ---- 字体 ----
  const fontFamily = (display['font_ch'] || '').trim();

  const skinConfig: SkinV2Config = {
    meta: {
      schema_version: 2,
      // id 用文件名派生，与显示名分开处理：显示名可以回退到 skin_id，
      // id 必须稳定落在文件名上，否则不同来源的皮肤会互相覆盖。
      id: safeSkinId(stripSkinFileName(fileName), general['skin_id']),
      name: title,
      version: '1.0.0',
      author: general['skin_author'] || general['author'] || '搜狗皮肤转换器',
      description: general['skin_info'] || `从搜狗皮肤 ${fileName} 转换而来`,
      base: 'fluent',
      supports: { layouts: ['horizontal'], themes: ['dark', 'light'] }
    },
    candidate_window: {
      ...(fontFamily && /^[^"'\\,;<>{}`]{1,64}$/.test(fontFamily) ? { font_family: fontFamily } : {}),
      ...(panelFile
        ? {
            border_image: {
              source: `assets/${panelFile}`,
              slice_dip: slice,
              width_dip: slice,
              fill: true
            }
          }
        : {}),
      ...(contentInsets ? { content_insets_dip: contentInsets } : {}),
      ...(hasOuter ? { outer_insets_dip: outer } : {}),
      ...(decorations.length > 0 ? { decorations } : {})
    },
    candidate: {
      // 搜狗只有一个 Display 配色，深浅两套先给相同的值，但必须是两份独立对象，
      // 否则在编辑器里改深色会连带把浅色一起改掉。
      dark: { ...colors },
      light: { ...colors }
    }
  };

  if (!zhongwen) {
    warnings.push('skin.ini 里没有 zhongwen_marge，文字内边距按 0 处理，需要手工调');
  }
  if (ini['Scheme_H1'] === undefined) {
    warnings.push('皮肤里没有 Scheme_H1，横排面板可能不对');
  }
  if (Object.keys(ini).some(k => /^Scheme_H[2]$|^Scheme_V/.test(k))) {
    warnings.push('搜狗皮肤有独立的双行 / 竖排方案，水杉 v2 每个皮肤只有一张面板图，只取了 Scheme_H1');
  }

  return { skinConfig, images, warnings };
}
