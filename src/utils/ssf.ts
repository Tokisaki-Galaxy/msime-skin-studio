import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import * as pako from 'pako';
import { SkinV2Config } from '../types/skin';

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

export function parseSogouMargins(raw?: string): { top: number; right: number; bottom: number; left: number } {
  if (!raw) return { top: 4, right: 4, bottom: 4, left: 4 };
  const parts = raw.split(',').map(s => parseInt(s.trim(), 10) || 0);
  if (parts.length === 4) {
    return {
      left: parts[0],
      right: parts[1],
      top: parts[2],
      bottom: parts[3]
    };
  }
  return { top: 4, right: 4, bottom: 4, left: 4 };
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

  const parsedIni = parseIni(iniText);
  const cand = parsedIni['Skin_Cand'] || {};
  const general = parsedIni['General'] || {};

  const margins = parseSogouMargins(cand['margin_cand']);
  const skinTitle = general['skin_name'] || fileName.replace(/\.ssf$/i, '') || 'Sogou_Port';

  let bgImage = '';
  if (cand['bg_cand']) {
    const candBgName = cand['bg_cand'].replace(/\\/g, '/').split('/').pop() || '';
    if (images[candBgName]) {
      bgImage = `assets/${candBgName}`;
    }
  }
  if (!bgImage) {
    const candPng = Object.keys(images).find(k => k.toLowerCase().includes('cand') || k.toLowerCase().includes('bg'));
    if (candPng) {
      bgImage = `assets/${candPng}`;
    }
  }

  const skinConfig: SkinV2Config = {
    meta: {
      schema_version: 2,
      name: skinTitle,
      version: '1.0.0',
      author: general['author'] || '搜狗皮肤转换器',
      description: `从搜狗皮肤 ${fileName} 自动转换而来`,
      supported_modes: ['horizontal']
    },
    candidate_window: {
      border_slice_px: margins,
      border_width_dip: margins,
      scale_mode: 'stretch',
      line_gap_dip: 8,
      item_gap_dip: 12,
      ...(bgImage ? { background_image: bgImage } : {})
    },
    preedit: {
      text_color: parseSogouColor(cand['py_color'], '#334155'),
      font_size_pt: 11
    },
    candidate_item: {
      text_color: parseSogouColor(cand['cand_color'], '#0f172a'),
      number_color: parseSogouColor(cand['cand_num_color'], '#64748b'),
      font_size_pt: 12
    },
    highlight_item: {
      text_color: parseSogouColor(cand['cand_hl_color'], '#2563eb'),
      number_color: parseSogouColor(cand['cand_hl_num_color'] || cand['cand_hl_color'], '#2563eb')
    },
    paging: {
      prev_color: parseSogouColor(cand['page_color'], '#94a3b8'),
      next_color: parseSogouColor(cand['page_color'], '#94a3b8'),
      font_size_pt: 10
    }
  };

  return { skinConfig, images };
}
