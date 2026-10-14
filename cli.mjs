import fs from 'node:fs';
import path from 'node:path';
import { processSsfArchive } from './src/utils/ssf';
import { serializeSkinToml } from './src/utils/toml';
import { isSafeSkinId } from './src/utils/exporter';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
水杉输入法皮肤转换 CLI

用法:
  node cli.mjs <ssf文件路径> [输出根目录]

输出结构（水杉要求皮肤目录名与 skin.toml 的 id 一致）:
  <输出根目录>/<id>/skin.toml
  <输出根目录>/<id>/assets/...

示例:
  node cli.mjs "C:\\Users\\User\\Downloads\\航海.ssf" "./output"
`);
    process.exit(0);
  }

  const ssfPath = path.resolve(args[0]);
  if (!fs.existsSync(ssfPath)) {
    console.error(`错误: 文件不存在 -> ${ssfPath}`);
    process.exit(1);
  }

  const rootDir = path.resolve(args[1] || path.dirname(ssfPath));

  console.log(`正在读取并转换: ${ssfPath}`);
  const buffer = fs.readFileSync(ssfPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const { skinConfig, images, warnings } = await processSsfArchive(arrayBuffer, path.basename(ssfPath));

  const id = skinConfig.meta.id;
  if (!isSafeSkinId(id)) {
    console.error(`错误: 生成的 id "${id}" 不合法，无法作为水杉皮肤目录名`);
    process.exit(1);
  }

  const skinDir = path.join(rootDir, id);
  const assetsDir = path.join(skinDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(skinDir, 'skin.toml'), serializeSkinToml(skinConfig), 'utf-8');
  console.log(`✓ 已生成配置: ${path.join(skinDir, 'skin.toml')}`);

  let count = 0;
  for (const [imgName, dataUrl] of Object.entries(images)) {
    const base64Data = dataUrl.split(',')[1];
    if (base64Data) {
      fs.writeFileSync(path.join(assetsDir, imgName), Buffer.from(base64Data, 'base64'));
      count++;
    }
  }
  console.log(`✓ 已提取贴图素材: ${count} 张 -> ${assetsDir}`);

  if (warnings.length > 0) {
    console.log('\n需要人工确认:');
    for (const w of warnings) console.log(`  · ${w}`);
  }

  console.log(`\n把 "${skinDir}" 整个放进水杉数据目录的 skins\\ 下即可。`);
}

main().catch(err => {
  console.error('转换失败:', err);
  process.exit(1);
});
