import JSZip from 'jszip';
import { SkinV2Config, SkinAsset } from '../types/skin';
import { serializeSkinToml, validateSkinConfig } from './toml';

/** 与 server/src/skin/candidate_skin_catalog.cpp 的 IsSafeId 一致。 */
export function isSafeSkinId(id: string): boolean {
  if (!id || id.length > 64) return false;
  if (!/^[a-z0-9]/.test(id)) return false;
  return /^[a-z0-9._-]+$/.test(id);
}

export async function exportSkinPackage(config: SkinV2Config, assets: Map<string, SkinAsset>): Promise<Blob> {
  const id = config.meta.id;
  if (!isSafeSkinId(id)) {
    throw new Error(
      `皮肤 id "${id}" 不合法。水杉要求：以小写字母或数字开头，只含小写字母、数字和 . _ -，长度不超过 64。\n` +
        `id 还必须与皮肤目录名一致。`
    );
  }

  const zip = new JSZip();
  const root = zip.folder(id) as JSZip;

  // 水杉的 Load() 是硬校验：任何一条不过整份皮肤都加载不了，没有回退。打包前先自己拦一道。
  const issues = validateSkinConfig(config);
  if (issues.length > 0) {
    const detail = issues.map(issue => `· ${issue.field}：${issue.message}`).join('\n');
    throw new Error(`皮肤配置不合法，导出后水杉无法加载：\n${detail}`);
  }

  root.file('skin.toml', serializeSkinToml(config));

  for (const [pathKey, asset] of assets.entries()) {
    if (asset.file) {
      root.file(pathKey, asset.file);
    } else if (asset.blobUrl) {
      const resp = await fetch(asset.blobUrl);
      root.file(pathKey, await resp.blob());
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
