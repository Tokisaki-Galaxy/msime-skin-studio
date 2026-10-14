import JSZip from 'jszip';
import { SkinAsset, SkinV2Config } from '../types/skin';
import { parseSkinToml } from './toml';

// 导入一份已有的皮肤：既支持单个 skin.toml，也支持导出的 ZIP（<id>/skin.toml + <id>/assets/…），
// 以及直接选一个皮肤目录。没有这条路，用户导出的皮肤就再也拿不回工坊改。

export interface ImportedSkin {
  config: Partial<SkinV2Config>;
  /** key 形如 `assets/x.png`，与 AssetManager 的上传路径和 render 的匹配方式一致。 */
  assets: Map<string, SkinAsset>;
  /** 引用到了但没找到的图片，导入后提示用户补。 */
  missingImages: string[];
  warnings: string[];
  sourceLabel: string;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg)$/i;

/** 皮肤声明的图片引用（相对皮肤目录）。 */
export function referencedImages(config: Partial<SkinV2Config>): string[] {
  const cw = config.candidate_window;
  if (!cw) return [];
  const refs = [
    cw.border_image?.source,
    cw.background?.image,
    cw.decoration?.image,
    ...(cw.decorations ?? []).map(d => d.image)
  ];
  return Array.from(new Set(refs.filter((r): r is string => typeof r === 'string' && r.length > 0)));
}

/**
 * 把 zip 内的相对路径规整成 `assets/xxx` 形式。
 * 导出的包是 `<id>/assets/x.png`，剥掉首段目录名；也接受平铺的 `assets/x.png` 或 `x.png`。
 */
function normalizeAssetPath(zipPath: string): string | null {
  const parts = zipPath.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const file = parts[parts.length - 1];
  if (!IMAGE_EXT.test(file)) return null;
  return `assets/${file}`;
}

function assetFromBlob(path: string, blob: Blob, file?: File): Promise<SkinAsset> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ path, blobUrl: url, file, width: img.naturalWidth, height: img.naturalHeight });
    // 解不出来也要把条目留下，用户能在素材库看到它并替换。
    img.onerror = () => resolve({ path, blobUrl: url, file });
    img.src = url;
  });
}

function findTomlPath(paths: string[]): string | null {
  // 优先顶层 skin.toml，其次任意深度的 skin.toml。
  const sorted = [...paths].sort((a, b) => a.split('/').length - b.split('/').length);
  return sorted.find(p => p.toLowerCase().endsWith('skin.toml')) ?? null;
}

async function assemble(
  tomlText: string,
  entries: { path: string; blob: Blob; file?: File }[],
  sourceLabel: string
): Promise<ImportedSkin> {
  const config = parseSkinToml(tomlText);
  const assets = new Map<string, SkinAsset>();
  for (const entry of entries) {
    const normalized = normalizeAssetPath(entry.path);
    if (!normalized) continue;
    assets.set(normalized, await assetFromBlob(normalized, entry.blob, entry.file));
  }
  const refs = referencedImages(config);
  const missingImages = refs.filter(ref => {
    const alt = ref.startsWith('assets/') ? ref.slice('assets/'.length) : `assets/${ref}`;
    return !assets.has(ref) && !assets.has(alt);
  });
  const warnings: string[] = [];
  if (refs.length > 0 && entries.length === 0) {
    warnings.push('只导入了 skin.toml，皮肤引用的图片需要另外放进素材库。');
  }
  return { config, assets, missingImages, warnings, sourceLabel };
}

/** 从 ZIP（导出的皮肤包）导入。 */
export async function importSkinZip(file: File): Promise<ImportedSkin> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries: { path: string; blob: Blob; file?: File }[] = [];
  const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  const tomlPath = findTomlPath(paths);
  if (!tomlPath) throw new Error('包里没有找到 skin.toml');
  for (const p of paths) {
    if (p === tomlPath) continue;
    if (!IMAGE_EXT.test(p)) continue;
    entries.push({ path: p, blob: await zip.files[p].async('blob') });
  }
  const tomlText = await zip.files[tomlPath].async('string');
  return assemble(tomlText, entries, file.name);
}

/** 从单个 skin.toml 文件导入（图片需随后自行补齐）。 */
export async function importSkinToml(file: File): Promise<ImportedSkin> {
  return assemble(await file.text(), [], file.name);
}

/** 从一组文件导入：用户在文件选择器里选中一个皮肤目录，或同时选中 skin.toml 加图片。 */
export async function importSkinFiles(files: File[]): Promise<ImportedSkin> {
  const toml = files.find(f => f.name.toLowerCase().endsWith('skin.toml'));
  if (!toml) throw new Error('这一组文件里没有 skin.toml');
  const images = files.filter(f => f !== toml && IMAGE_EXT.test(f.name));
  const label = toml.webkitRelativePath ? toml.webkitRelativePath.split('/')[0] : toml.name;
  return assemble(
    await toml.text(),
    images.map(f => ({ path: f.webkitRelativePath || f.name, blob: f, file: f })),
    label
  );
}

// 测试钩子：不碰浏览器 API 的纯逻辑部分。
export const normalizeAssetPathForTest = normalizeAssetPath;

/** 只做「解析配置 + 收集已有素材路径 + 算缺图」，不构造 blob URL，供测试使用。 */
export function assembleForTest(
  tomlText: string,
  entries: { path: string }[]
): { config: Partial<SkinV2Config>; paths: string[]; missingImages: string[]; warnings: string[] } {
  const config = parseSkinToml(tomlText);
  const paths = entries.map(e => normalizeAssetPath(e.path)).filter((p): p is string => !!p);
  const refs = referencedImages(config);
  const missingImages = refs.filter(ref => {
    const alt = ref.startsWith('assets/') ? ref.slice('assets/'.length) : `assets/${ref}`;
    return !paths.includes(ref) && !paths.includes(alt);
  });
  const warnings: string[] = [];
  if (refs.length > 0 && entries.length === 0) {
    warnings.push('只导入了 skin.toml，皮肤引用的图片需要另外放进素材库。');
  }
  return { config, paths, missingImages, warnings };
}
