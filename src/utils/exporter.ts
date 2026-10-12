import JSZip from 'jszip';
import { SkinV2Config, SkinAsset } from '../types/skin';
import { serializeSkinToml } from './toml';

export async function exportSkinPackage(config: SkinV2Config, assets: Map<string, SkinAsset>): Promise<Blob> {
  const zip = new JSZip();

  // 1. 生成 skin.toml
  const tomlContent = serializeSkinToml(config);
  zip.file('skin.toml', tomlContent);

  // 2. 写入使用到的 assets 文件
  for (const [pathKey, asset] of assets.entries()) {
    // 检查是否有 blob 或 file
    if (asset.file) {
      zip.file(pathKey, asset.file);
    } else if (asset.blobUrl) {
      const resp = await fetch(asset.blobUrl);
      const blob = await resp.blob();
      zip.file(pathKey, blob);
    }
  }

  // 3. 打包并返回
  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return content;
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
