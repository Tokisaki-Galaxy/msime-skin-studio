import { describe, expect, it } from 'vitest';
import { resolveSkinTitle } from './ssf';

// 搜狗皮肤制作工具会把 skin_name 预填成 new，作者不改就原样进包。真实遇到的那个
// 「老八咬袋子翻转版蓝边.ssf」导进来名字变成 new，就是因为这条没有兜底。
describe('搜狗皮肤导入后的显示名', () => {
  it('skin_name 正常时直接用', () => {
    expect(resolveSkinTitle('航海', 'whatever.ssf').title).toBe('航海');
  });

  it('skin_name 是占位名 new 时回退到文件名', () => {
    const r = resolveSkinTitle('new', '老八咬袋子翻转版蓝边.ssf');
    expect(r.title).toBe('老八咬袋子翻转版蓝边');
    expect(r.fellBackFrom).toBe('new');
  });

  it('skin_name 与文件名都是占位名时退到 skin_id', () => {
    expect(resolveSkinTitle('new', 'new.ssf', '561085').title).toBe('搜狗皮肤 561085');
  });

  it('什么都没有时给一个能看的通用名', () => {
    expect(resolveSkinTitle('', 'new.ssf').title).toBe('未命名搜狗皮肤');
  });

  it('浏览器另存留下的 (1) 尾缀会被剥掉', () => {
    expect(resolveSkinTitle('', '航海 (1).ssf').title).toBe('航海');
  });

  it('双后缀 .ssf.zip 也能剥干净', () => {
    expect(resolveSkinTitle('', '简约.ssf.zip').title).toBe('简约');
  });

  it('占位名判定不区分大小写与首尾空格', () => {
    expect(resolveSkinTitle('  NEW  ', '航海.ssf').title).toBe('航海');
    expect(resolveSkinTitle('Skin', '航海.ssf').title).toBe('航海');
  });

  it('正常的皮肤名不会被当成占位', () => {
    expect(resolveSkinTitle('New York', 'x.ssf').title).toBe('New York');
  });
});
