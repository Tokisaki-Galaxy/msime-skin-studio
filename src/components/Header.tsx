import React from 'react';
import { SKIN_TEMPLATES, SkinTemplate } from '../constants/templates';

interface HeaderProps {
  onSelectTemplate: (tpl: SkinTemplate) => void;
  onImportSsf: (file: File) => void;
  onImportSkin: (file: File) => void;
  onImportSkinFiles: (files: File[]) => void;
  onExport: () => void;
  exportDisabled?: boolean;
  layoutMode: 'horizontal' | 'vertical';
  onChangeLayoutMode: (mode: 'horizontal' | 'vertical') => void;
  skinName: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectTemplate,
  onImportSsf,
  onImportSkin,
  onImportSkinFiles,
  onExport,
  exportDisabled = false,
  layoutMode,
  onChangeLayoutMode,
  skinName,
  isDarkMode,
  onToggleTheme
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const skinDirInputRef = React.useRef<HTMLInputElement>(null);
  const dirInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSsf(file);
    // 不清空 value 时连续导入同一个文件不会触发 change。
    e.target.value = '';
  };

  const handleSkinFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSkin(file);
    e.target.value = '';
  };

  const handleSkinDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onImportSkinFiles(files);
    e.target.value = '';
  };

  const groupCls = `flex items-center rounded-lg p-0.5 border ${
    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
  }`;
  const groupLabelCls = `text-[11px] px-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`;
  const idleBtnCls = isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-white';
  const ghostBtnCls = `px-3.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
    isDarkMode ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700' : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
  }`;

  return (
    <header
      className={`border-b px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 select-none shrink-0 z-20 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className={`text-sm font-bold tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            水杉输入法皮肤工坊
            <span className="text-[10px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              v2 规范
            </span>
          </h1>
          <div className={`text-[11px] truncate max-w-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{skinName}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className={groupCls}>
          <span className={groupLabelCls}>模版起手:</span>
          {SKIN_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              title={tpl.description}
              className={`px-2.5 py-1 text-xs rounded transition ${idleBtnCls}`}
            >
              {tpl.name}
            </button>
          ))}
        </div>

        <div className={groupCls}>
          <button
            onClick={() => onChangeLayoutMode('horizontal')}
            className={`px-3 py-1 text-xs rounded transition ${
              layoutMode === 'horizontal' ? 'bg-emerald-600 text-white font-medium' : idleBtnCls
            }`}
          >
            横排
          </button>
          <button
            onClick={() => onChangeLayoutMode('vertical')}
            className={`px-3 py-1 text-xs rounded transition ${
              layoutMode === 'vertical' ? 'bg-emerald-600 text-white font-medium' : idleBtnCls
            }`}
          >
            竖排
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="https://github.com/Tokisaki-Galaxy/msime-skin-studio"
          target="_blank"
          rel="noopener noreferrer"
          title="在 GitHub 上查看源码、提 Issue"
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
            isDarkMode ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700' : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          GitHub
        </a>

        <button
          onClick={onToggleTheme}
          title={isDarkMode ? '切换到日间模式' : '切换到夜间模式'}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
            isDarkMode ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700' : 'text-slate-700 bg-white hover:bg-slate-100 border-slate-200'
          }`}
        >
          {isDarkMode ? '日间模式' : '夜间模式'}
        </button>

        <button onClick={() => fileInputRef.current?.click()} className={ghostBtnCls}>
          导入搜狗皮肤 (.ssf)
        </button>
        <input ref={fileInputRef} type="file" accept=".ssf,.zip" className="hidden" onChange={handleFileChange} />

        <button
          onClick={() => skinDirInputRef.current?.click()}
          title="选中一个皮肤目录（含 skin.toml 与图片），或直接选中导出的 ZIP"
          className={ghostBtnCls}
        >
          导入皮肤 (.zip / 目录)
        </button>
        <input
          ref={skinDirInputRef}
          type="file"
          accept=".zip,.toml"
          className="hidden"
          onChange={handleSkinFileChange}
        />
        <button
          onClick={() => dirInputRef.current?.click()}
          title="一次选中整个皮肤目录，连带图片一起读进来"
          className={ghostBtnCls}
        >
          导入目录
        </button>
        {/* 目录导入：webkitdirectory 让用户一次选中整个皮肤文件夹，连带图片一起读进来。 */}
        <input
          ref={dirInputRef}
          type="file"
          className="hidden"
          onChange={handleSkinDirChange}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />

        <button
          onClick={onExport}
          disabled={exportDisabled}
          title={exportDisabled ? '配置还有会被水杉拒绝的问题，见预览下方清单' : '打包成 <id>/skin.toml 加 <id>/assets/'}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition shadow-md ${
            exportDisabled
              ? 'bg-slate-400 text-white cursor-not-allowed shadow-none'
              : 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
          }`}
        >
          打包导出皮肤 (ZIP)
        </button>
      </div>
    </header>
  );
};
