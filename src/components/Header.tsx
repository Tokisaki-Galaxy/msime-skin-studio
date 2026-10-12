import React from 'react';
import { SKIN_TEMPLATES, SkinTemplate } from '../constants/templates';

interface HeaderProps {
  onSelectTemplate: (tpl: SkinTemplate) => void;
  onImportSsf: (file: File) => void;
  onExport: () => void;
  layoutMode: 'horizontal' | 'vertical';
  onChangeLayoutMode: (mode: 'horizontal' | 'vertical') => void;
  skinName: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectTemplate,
  onImportSsf,
  onExport,
  layoutMode,
  onChangeLayoutMode,
  skinName
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSsf(file);
    }
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between select-none shrink-0 z-20">
      {/* 品牌与当前名称 */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            水杉输入法皮肤工坊
            <span className="text-[10px] font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
              v2 规范
            </span>
          </h1>
          <div className="text-[11px] text-slate-400 truncate max-w-xs">{skinName}</div>
        </div>
      </div>

      {/* 中部操作区 */}
      <div className="flex items-center gap-3">
        {/* 模板快速起手 */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <span className="text-[11px] text-slate-400 px-2">模版起手:</span>
          {SKIN_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded transition"
            >
              {tpl.name.split('')[0] + tpl.name.split('')[1]}款
            </button>
          ))}
        </div>

        {/* 横排/竖排模式切换 */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            onClick={() => onChangeLayoutMode('horizontal')}
            className={`px-3 py-1 text-xs rounded transition ${
              layoutMode === 'horizontal' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            横排
          </button>
          <button
            onClick={() => onChangeLayoutMode('vertical')}
            className={`px-3 py-1 text-xs rounded transition ${
              layoutMode === 'vertical' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            竖排
          </button>
        </div>
      </div>

      {/* 右侧动作按钮 */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
        >
          <span>📥</span>
          <span>导入搜狗皮肤 (.ssf)</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ssf,.zip"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={onExport}
          className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-md shadow-emerald-900/40 flex items-center gap-1.5"
        >
          <span>📦</span>
          <span>打包导出皮肤 (ZIP)</span>
        </button>
      </div>
    </header>
  );
};
