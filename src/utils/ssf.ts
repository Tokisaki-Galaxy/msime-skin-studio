import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import * as pako from 'pako';
import { SkinV2Config, AccessoryStyle } from '../types/skin';

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
  // bytes[8:] 是 AES-256-CBC 密文
  const encryptedPayload = bytes.subarray(8);
  
  // 转换为 CryptoJS WordArray
  const keyWords = CryptoJS.enc.Hex.parse(AES_KEY_HEX);
  const ivWords = CryptoJS.enc.Hex.parse(AES_IV_HEX);
  
  // 将 Uint8Array 转换为 WordArray
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
  
  // 解密
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: encryptedWords } as CryptoJS.lib.CipherParams,
    keyWords,
    {
      iv: ivWords,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );
  
  // 转换为 Uint8Array
  const decryptedBytes = new Uint8Array(decrypted.sigBytes);
  for (let i = 0; i < decrypted.sigBytes; i++) {
    decryptedBytes[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  
  // decrypted[4:] 是 zlib 压缩流
  const uncompressed = pako.inflate(decryptedBytes.subarray(4));
  
  // 解析自定义目录结构:
  // [0..4]: total_size (uint32)
  // [4..8]: hdr_size (uint32)
  // [8..8+hdr_size]: offsets (uint32[])
  const view = new DataView(uncompressed.buffer, uncompressed.byteOffset, uncompressed.byteLength);
  const hdrSize = view.getUint32(4, true);
  const numOffsets = hdrSize / 4;
  
  const files: UnpackedFile[] = [];
  for (let i = 0; i < numOffsets; i++) {
    const off = view.getUint32(8 + i * 4, true);
    const nameLen = view.getUint32(off, true);
    
    // name 是 utf-16le 编码
    const nameBytes = uncompressed.subarray(off + 4, off + 4 + nameLen);
    const decoder = new TextDecoder('utf-16le');
    const name = decoder.decode(nameBytes);
    
    const contentLenOff = off + 4 + nameLen;
    const contentLen = view.getUint32(contentLenOff, true);
    const fileBytes = uncompressed.subarray(contentLenOff + 4, contentLenOff + 4 + contentLen);
    
    files.push({
      name,
      data: new Uint8Array(fileBytes)
    });
  }
  
  return files;
}

/**
 * 解压标准 ZIP 格式
 */
export async function extractZipSkin(bytes: Uint8Array): Promise<UnpackedFile[]> {
  const zip = await JSZip.loadAsync(bytes);
  const files: UnpackedFile[] = [];
  
  for (const [name, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    const content = await zipEntry.async('uint8array');
    files.push({
      name,
      data: content
    });
  }
  
  return files;
}

export function parseIni(text: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = '';

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1 && currentSection) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      result[currentSection][key] = val;
    }
  }

  return result;
}

export function parseSogouColor(raw?: string, fallback: string = '#333333'): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  
  // 处理 0xRRGGBB 或 0xBBGGRR (搜狗常见 0x514df9 或 0xRRGGBB)
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    const hex = trimmed.slice(2).padStart(6, '0');
    // 如果是 6 位十六进制
    if (hex.length === 6) {
      // 搜狗经典颜色很多是 BGR：0xBBGGRR
      const b = hex.slice(0, 2);
      const g = hex.slice(2, 4);
      const r = hex.slice(4, 6);
      return `#${r}${g}${b}`;
    }
  }

  if (trimmed.startsWith('#')) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  
  const parts = trimmed.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const r = Math.min(255, Math.max(0, parts[0])).toString(16).padStart(2, '0');
    const g = Math.min(255, Math.max(0, parts[1])).toString(16).padStart(2, '0');
    const b = Math.min(255, Math.max(0, parts[2])).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return fallback;
}

// 解析搜狗 margin: left, top, right, bottom (或 left, right, top, bottom)
// 在 Scheme_H1 中，顺序严格为 left, top, right, bottom
function getImageDimensions(dataUri: string): { width: number; height: number } {
  try {
    const bin = atob(dataUri.split(',')[1]);
    if (bin.length > 24) {
      // PNG check
      if (bin.charCodeAt(0) === 0x89 && bin.charCodeAt(1) === 0x50 && bin.charCodeAt(2) === 0x4E && bin.charCodeAt(3) === 0x47) {
        const width = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
        const height = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
        return { width, height };
      }
      // BMP check
      if (bin.charCodeAt(0) === 0x42 && bin.charCodeAt(1) === 0x4D) {
        const width = bin.charCodeAt(18) | (bin.charCodeAt(19) << 8) | (bin.charCodeAt(20) << 16) | (bin.charCodeAt(21) << 24);
        const height = Math.abs(bin.charCodeAt(22) | (bin.charCodeAt(23) << 8) | (bin.charCodeAt(24) << 16) | (bin.charCodeAt(25) << 24));
        return { width, height };
      }
    }
  } catch {}
  return { width: 0, height: 0 };
}

export async function processSsfArchive(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  skinConfig: SkinV2Config;
  images: Record<string, string>;
}> {
  const bytes = new Uint8Array(arrayBuffer);
  
  // 检查是否为 'Skin' 开头的加密格式
  let files: UnpackedFile[] = [];
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  
  if (magic === 'Skin') {
    files = extractEncryptedSkin(bytes);
  } else {
    // 尝试直接作为 ZIP 解压
    try {
      files = await extractZipSkin(bytes);
    } catch {
      // 兜底尝试加密解密
      try {
        files = extractEncryptedSkin(bytes);
      } catch (e) {
        throw new Error(`无法识别该皮肤包的格式 (${magic}): ${e}`);
      }
    }
  }

  const images: Record<string, string> = {};
  let iniFile: UnpackedFile | undefined;

  for (const file of files) {
    const cleanName = file.name.replace(/\\/g, '/').split('/').pop() || file.name;
    const lower = cleanName.toLowerCase();

    if (lower === 'skin.ini') {
      iniFile = file;
    } else if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.bmp')) {
      const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.jpg') ? 'image/jpeg' : 'image/bmp';
      // 转 base64
      let binary = '';
      const len = file.data.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(file.data[i]);
      }
      const base64 = btoa(binary);
      images[cleanName] = `data:${mime};base64,${base64}`;
    }
  }

  let iniText = '';
  if (iniFile) {
    if (iniFile.data.length >= 2 && iniFile.data[0] === 0xff && iniFile.data[1] === 0xfe) {
      iniText = new TextDecoder('utf-16le').decode(iniFile.data);
    } else if (iniFile.data.length >= 3 && iniFile.data[0] === 0xef && iniFile.data[1] === 0xbb && iniFile.data[2] === 0xbf) {
      iniText = new TextDecoder('utf-8').decode(iniFile.data.subarray(3));
    } else {
      try {
        iniText = new TextDecoder('utf-8', { fatal: true }).decode(iniFile.data);
      } catch {
        try {
          iniText = new TextDecoder('gb18030').decode(iniFile.data);
        } catch {
          iniText = new TextDecoder('utf-16le').decode(iniFile.data);
        }
      }
    }
  }

  const parsedIni = parseIni(iniText);
  const cand = parsedIni['Skin_Cand'] || {};
  const general = parsedIni['General'] || {};
  const display = parsedIni['Display'] || {};
  const schemeH1 = parsedIni['Scheme_H1'] || {};

  const skinTitle = general['skin_name'] || fileName.replace(/\.ssf$/i, '') || 'Sogou_Port';

  let bgImage = '';
  let bgImgFileName = '';
  if (cand['bg_cand']) {
    const candBgName = cand['bg_cand'].replace(/\\/g, '/').split('/').pop() || '';
    if (images[candBgName]) {
      bgImage = `assets/${candBgName}`;
      bgImgFileName = candBgName;
    }
  } else if (schemeH1['pic']) {
    const h1PicName = schemeH1['pic'].replace(/\\/g, '/').split('/').pop() || '';
    if (images[h1PicName]) {
      bgImage = `assets/${h1PicName}`;
      bgImgFileName = h1PicName;
    }
  }

  if (!bgImage) {
    const candPng = Object.keys(images).find(k => k.toLowerCase().includes('skin1') || k.toLowerCase().includes('cand') || k.toLowerCase().includes('bg'));
    if (candPng) {
      bgImage = `assets/${candPng}`;
      bgImgFileName = candPng;
    }
  }

  // 转换搜狗切片或边距到九宫格 border_slice_px
  // 搜狗 layout_horizontal=mode,left,right
  // 搜狗 layout_vertical=mode,top,bottom
  const parseSliceAndInsets = (
    scheme: Record<string, string>,
    bgFileName: string
  ) => {
    const dims = bgFileName && images[bgFileName] ? getImageDimensions(images[bgFileName]) : { width: 0, height: 0 };
    const bgW = dims.width;
    const bgH = dims.height;

    // 解析切片
    let sliceTop = 4;
    let sliceRight = 4;
    let sliceBottom = 4;
    let sliceLeft = 4;

    if (scheme['layout_horizontal']) {
      const parts = scheme['layout_horizontal'].split(',').map(s => parseInt(s.trim(), 10) || 0);
      if (parts.length >= 3) {
        sliceLeft = Math.max(1, parts[1]);
        sliceRight = Math.max(1, parts[2]);
      }
    }
    if (scheme['layout_vertical']) {
      const parts = scheme['layout_vertical'].split(',').map(s => parseInt(s.trim(), 10) || 0);
      if (parts.length >= 3) {
        sliceTop = Math.max(1, parts[1]);
        sliceBottom = Math.max(1, parts[2]);
      }
    }

    // 解析中文选区 left, top, right, bottom
    let insets = { top: sliceTop, right: sliceRight, bottom: sliceBottom, left: sliceLeft };
    let hasExplicitInsets = false;

    if (scheme['zhongwen_marge']) {
      const parts = scheme['zhongwen_marge'].split(',').map(s => parseInt(s.trim(), 10) || 0);
      if (parts.length === 4) {
        // parts: left, top, right, bottom
        const padLeft = parts[0];
        const padTop = parts[1];
        const padRight = parts[2];
        let padBottom = parts[3];

        // 如果 bgH 大于 0 且底边距看起来是候选框高度而不是下边界
        // 在老八和狂三等大图立绘皮肤中，整张图高度远大于 parts[1] + parts[3]
        if (bgH > 0 && bgH > (padTop + padBottom)) {
          // 下方留给立绘的自然空白高度
          padBottom = Math.max(padBottom, bgH - (padTop + 36));
        }

        insets = {
          top: Math.max(4, padTop),
          right: Math.max(4, padRight),
          bottom: Math.max(4, padBottom),
          left: Math.max(4, padLeft)
        };
        hasExplicitInsets = true;
      }
    }

    // 如果切片过小而原图很大，需要保证最小高度防止压扁
    const minHeight = bgH > 40 ? bgH : undefined;
    const minWidth = bgW > 80 ? Math.min(bgW, 180) : undefined;

    return {
      slice: { top: sliceTop, right: sliceRight, bottom: sliceBottom, left: sliceLeft },
      insets,
      minHeight,
      minWidth,
      bgW,
      bgH
    };
  };

  // 解析横排 H1
  const h1Parsed = parseSliceAndInsets(schemeH1, bgImgFileName);

  // 解析拼音与中文的相对偏移
  // 如果 pinyin_marge 存在，比较其与 zhongwen_marge 的 top 和 left 差值
  let preeditOffset: { x: number; y: number } | undefined = undefined;
  if (schemeH1['pinyin_marge'] && schemeH1['zhongwen_marge']) {
    const py = schemeH1['pinyin_marge'].split(',').map(s => parseInt(s.trim(), 10) || 0);
    const zw = schemeH1['zhongwen_marge'].split(',').map(s => parseInt(s.trim(), 10) || 0);
    if (py.length === 4 && zw.length === 4) {
      // py: left, top, right, bottom; zw: left, top, right, bottom
      const diffX = py[0] - zw[0];
      const diffY = py[1] - zw[1];
      if (Math.abs(diffX) > 2 || Math.abs(diffY) > 2) {
        preeditOffset = { x: diffX, y: diffY };
      }
    }
  }

  // 提取横排挂件 (Scheme_H1 accessories)
  const accessories: AccessoryStyle[] = [];
  const customCnt = parseInt(schemeH1['custom_cnt'] || '0', 10);
  for (let i = 0; i < customCnt; i++) {
    const picKey = `custom${i}`;
    const customPic = schemeH1[picKey];
    if (customPic) {
      const cleanPic = customPic.replace(/\\/g, '/').split('/').pop() || '';
      if (images[cleanPic]) {
        const accDims = getImageDimensions(images[cleanPic]);
        accessories.push({
          id: `acc_h_${i}`,
          image: `assets/${cleanPic}`,
          anchor: 'bottom_right',
          offset_dip: { x: 0, y: 0 },
          size_dip: accDims.width > 0 && accDims.height > 0 ? { width: accDims.width, height: accDims.height } : undefined,
          z_order: 10 + i
        });
      }
    }
  }

  // 解析竖排 (Scheme_V1)
  const schemeV1 = parsedIni['Scheme_V1'] || {};
  let v1BgFileName = '';
  if (schemeV1['pic']) {
    const v1PicName = schemeV1['pic'].replace(/\\/g, '/').split('/').pop() || '';
    if (images[v1PicName]) {
      v1BgFileName = v1PicName;
    }
  }
  const v1Parsed = parseSliceAndInsets(schemeV1, v1BgFileName);

  // 提取竖排挂件
  const verticalAccessories: AccessoryStyle[] = [];
  const v1CustomCnt = parseInt(schemeV1['custom_cnt'] || '0', 10);
  for (let i = 0; i < v1CustomCnt; i++) {
    const picKey = `custom${i}`;
    const customPic = schemeV1[picKey];
    if (customPic) {
      const cleanPic = customPic.replace(/\\/g, '/').split('/').pop() || '';
      if (images[cleanPic]) {
        const accDims = getImageDimensions(images[cleanPic]);
        verticalAccessories.push({
          id: `acc_v_${i}`,
          image: `assets/${cleanPic}`,
          anchor: 'bottom_right',
          offset_dip: { x: 0, y: 0 },
          size_dip: accDims.width > 0 && accDims.height > 0 ? { width: accDims.width, height: accDims.height } : undefined,
          z_order: 10 + i
        });
      }
    }
  }

  const supportedModes: Array<'horizontal' | 'vertical'> = ['horizontal'];
  if (v1BgFileName) {
    supportedModes.push('vertical');
  }

  const skinConfig: SkinV2Config = {
    meta: {
      schema_version: 2,
      name: skinTitle,
      version: '1.0.0',
      author: general['author'] || general['skin_author'] || '搜狗皮肤转换器',
      description: general['skin_info'] || `从搜狗皮肤 ${fileName} 自动转换而来`,
      supported_modes: supportedModes
    },
    candidate_window: {
      border_slice_px: h1Parsed.slice,
      border_width_dip: h1Parsed.slice,
      scale_mode: 'stretch',
      line_gap_dip: 8,
      item_gap_dip: 12,
      ...(bgImage ? { background_image: bgImage } : {}),
      margin_dip: h1Parsed.insets,
      ...(h1Parsed.minHeight ? { min_height_dip: h1Parsed.minHeight } : {}),
      ...(h1Parsed.minWidth ? { min_width_dip: h1Parsed.minWidth } : {})
    },
    ...(v1BgFileName ? {
      vertical_candidate_window: {
        border_slice_px: v1Parsed.slice,
        border_width_dip: v1Parsed.slice,
        scale_mode: 'stretch',
        line_gap_dip: 8,
        item_gap_dip: 12,
        background_image: `assets/${v1BgFileName}`,
        margin_dip: v1Parsed.insets,
        ...(v1Parsed.minHeight ? { min_height_dip: v1Parsed.minHeight } : {}),
        ...(v1Parsed.minWidth ? { min_width_dip: v1Parsed.minWidth } : {})
      },
      vertical_accessories: verticalAccessories
    } : {}),
    preedit: {
      text_color: parseSogouColor(cand['py_color'] || display['pinyin_color'], '#334155'),
      font_size_pt: parseInt(display['font_size'] || '11', 10) ? Math.min(16, Math.max(9, Math.round(parseInt(display['font_size'] || '11', 10) * 0.75))) : 11,
      ...(preeditOffset ? { offset_dip: preeditOffset } : {})
    },
    candidate_item: {
      text_color: parseSogouColor(cand['cand_color'] || display['zhongwen_color'], '#0f172a'),
      number_color: parseSogouColor(cand['cand_num_color'] || display['zhongwen_color'], '#64748b'),
      font_size_pt: parseInt(display['font_size'] || '12', 10) ? Math.min(18, Math.max(10, Math.round(parseInt(display['font_size'] || '12', 10) * 0.75))) : 12
    },
    highlight_item: {
      text_color: parseSogouColor(cand['cand_hl_color'] || display['zhongwen_first_color'], '#2563eb'),
      number_color: parseSogouColor(cand['cand_hl_num_color'] || cand['cand_hl_color'] || display['zhongwen_first_color'], '#2563eb')
    },
    paging: {
      prev_color: parseSogouColor(cand['page_color'], '#94a3b8'),
      next_color: parseSogouColor(cand['page_color'], '#94a3b8'),
      font_size_pt: 10
    },
    ...(accessories.length > 0 ? { accessories } : {})
  };

  return { skinConfig, images };
}
