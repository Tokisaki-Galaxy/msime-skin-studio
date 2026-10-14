import fs from 'node:fs';
import { parseSkinToml, serializeSkinToml } from '../src/utils/toml';

const path = process.argv[2];
const text = fs.readFileSync(path, 'utf-8');
const parsed = parseSkinToml(text);
console.log(JSON.stringify(parsed, null, 2));

const again = serializeSkinToml(parsed as any);
const reparsed = parseSkinToml(again);
const same = JSON.stringify(parsed) === JSON.stringify(reparsed);
console.log('\n=== 二次序列化后是否一致:', same ? '一致' : '不一致');
if (!same) {
  console.log('--- 第一遍 ---');
  console.log(JSON.stringify(parsed, null, 2));
  console.log('--- 第二遍 ---');
  console.log(JSON.stringify(reparsed, null, 2));
}
