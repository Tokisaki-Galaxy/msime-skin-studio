import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { processSsfArchive } from './src/utils/ssf';
import { serializeSkinToml } from './src/utils/toml';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
水杉输入法皮肤转换 CLI 工具
用法:
  node cli.mjs <ssf文件路径> [输出目录]

示例:
  node cli.mjs "C:\\Users\\User\\Downloads\\航海.ssf" "./output/航海"
`);
    process.exit(0);
  }

  const ssfPath = path.resolve(args[0]);
  if (!fs.existsSync(ssfPath)) {
    console.error(`错误: 文件不存在 -> ${ssfPath}`);
    process.exit(1);
  }

  const defaultOutDir = path.join(path.dirname(ssfPath), path.basename(ssfPath, path.extname(ssfPath)));
  const outDir = path.resolve(args[1] || defaultOutDir);

  console.log(`正在读取并转换: ${ssfPath}`);
  const buffer = fs.readFileSync(ssfPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const result = await processSsfArchive(arrayBuffer, path.basename(ssfPath));

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const assetsDir = path.join(outDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 1. 写入 skin.toml
  const tomlStr = serializeSkinToml(result.skinConfig);
  fs.writeFileSync(path.join(outDir, 'skin.toml'), tomlStr, 'utf-8');
  console.log(`✓ 已生成配置规范: ${path.join(outDir, 'skin.toml')}`);

  // 2. 写入图片资源
  let count = 0;
  for (const [imgName, dataUrl] of Object.entries(result.images)) {
    const base64Data = dataUrl.split(',')[1];
    if (base64Data) {
      const filePath = path.join(assetsDir, imgName);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      count++;
    }
  }
  console.log(`✓ 已提取贴图素材: ${count} 张 -> ${assetsDir}`);
  console.log(`\n🎉 转换完成！您可以直接将 "${outDir}" 文件夹放入水杉输入法的皮肤数据目录。`);
}

main().catch(err => {
  console.error('转换失败:', err);
  process.exit(1);
});
