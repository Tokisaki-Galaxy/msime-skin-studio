import React, { useState } from 'react';

interface SampleDataEditorProps {
  pinyin: string;
  candidates: string[];
  translations: string[];
  pos: string[];
  selectedIndex: number;
  isDarkMode: boolean;
  onPinyin: (v: string) => void;
  onCandidates: (v: string[]) => void;
  onTranslations: (v: string[]) => void;
  onPos: (v: string[]) => void;
  onSelectedIndex: (v: number) => void;
}

/**
 * 预览用的假数据：拼音串、候选词、译文与词性。真实候选来自输入法引擎，工坊没有引擎，
 * 所以这里让用户自己填一份，用来检查排版在各种字数下的表现。默认折叠，不占预览空间。
 */
export const SampleDataEditor: React.FC<SampleDataEditorProps> = ({
  pinyin,
  candidates,
  translations,
  pos,
  selectedIndex,
  isDarkMode,
  onPinyin,
  onCandidates,
  onTranslations,
  onPos,
  onSelectedIndex
}) => {
  const [open, setOpen] = useState(false);
  const rows = candidates.length;
  const inputCls = `w-full rounded px-2 py-1 text-xs border focus:outline-none focus:border-emerald-500 ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  }`;

  const setAt = (list: string[], index: number, value: string): string[] => {
    const next = [...list];
    while (next.length <= index) next.push('');
    next[index] = value;
    return next;
  };

  /** 候选词增删后，译文与词性数组保持同样的长度，翻译开关才不会错位。 */
  const resize = (list: string[], length: number): string[] => {
    const next = list.slice(0, length);
    while (next.length < length) next.push('');
    return next;
  };

  const setCount = (count: number) => {
    const n = Math.max(1, Math.min(9, count));
    const base = candidates.slice(0, n);
    while (base.length < n) base.push('');
    onCandidates(base);
    onTranslations(resize(translations, n));
    onPos(resize(pos, n));
    if (selectedIndex >= n) onSelectedIndex(n - 1);
  };

  return (
    <div className={`border-t text-xs ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-1.5 text-left ${isDarkMode ? 'text-slate-400 hover:bg-slate-800/60' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        {open ? '▾' : '▸'} 预览示例文字（{rows} 个候选，点候选可切换首选高亮）
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>拼音</span>
            <input type="text" value={pinyin} onChange={e => onPinyin(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-2">
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>候选数</span>
            <input
              type="number"
              min={1}
              max={9}
              value={rows}
              onChange={e => {
                if (e.target.value.trim() === '') return;
                setCount(Number(e.target.value));
              }}
              className={`${inputCls} w-20`}
            />
            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>首选高亮：第 {selectedIndex + 1} 个</span>
          </div>
          <div className="space-y-1">
            <div className={`grid gap-1 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} style={{ gridTemplateColumns: '1.4fr 1.4fr 0.6fr 0.5fr' }}>
              <span>候选词</span>
              <span>译文</span>
              <span>词性</span>
              <span>首选</span>
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: '1.4fr 1.4fr 0.6fr 0.5fr' }}>
                <input
                  type="text"
                  value={candidates[i] ?? ''}
                  onChange={e => onCandidates(setAt(candidates, i, e.target.value))}
                  className={inputCls}
                />
                <input
                  type="text"
                  value={translations[i] ?? ''}
                  placeholder="留空无译文"
                  onChange={e => onTranslations(setAt(translations, i, e.target.value))}
                  className={inputCls}
                />
                <input
                  type="text"
                  value={pos[i] ?? ''}
                  placeholder="n."
                  onChange={e => onPos(setAt(pos, i, e.target.value))}
                  className={inputCls}
                />
                <button
                  onClick={() => onSelectedIndex(i)}
                  className={`text-[10px] px-1.5 py-1 rounded ${
                    selectedIndex === i
                      ? 'bg-emerald-600 text-white'
                      : isDarkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {selectedIndex === i ? '选中' : '设为'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
