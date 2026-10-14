import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CandidatePreview } from './components/CandidatePreview';
import { AssetManager } from './components/AssetManager';
import { ConfigPanel } from './components/ConfigPanel';
import { SliceModal } from './components/SliceModal';

import { Insets, LayoutMode, SkinAsset, SkinV2Config, ThemeName } from './types/skin';
import { SKIN_TEMPLATES, SkinTemplate } from './constants/templates';
import { processSsfArchive } from './utils/ssf';
import { exportSkinPackage, downloadBlob } from './utils/exporter';

const DEFAULT_SLICE = (w: number, h: number) =>
  Math.max(1, Math.min(64, Math.round(Math.min(w || 32, h || 32) * 0.2)));

// 三栏宽度可拖拽调节。左右各留最小值，中间至少留 320px。
const MIN_SIDE = 200;
const MIN_CENTER = 320;
const MAX_SIDE = 640;

export const App: React.FC = () => {
  const [config, setConfig] = useState<SkinV2Config>(SKIN_TEMPLATES[0].config);
  const [assets, setAssets] = useState<Map<string, SkinAsset>>(new Map());

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');
  const [previewTheme, setPreviewTheme] = useState<ThemeName>('dark');
  const [samplePinyin, setSamplePinyin] = useState("shui'shan'shu'ru'fa");
  const [sampleCandidates, setSampleCandidates] = useState(['水杉输入法', '水杉', '水扇', '税收', '随身']);
  const [sampleTranslations, setSampleTranslations] = useState<string[]>(['metasequoia', '', '', '', '']);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedDecorationIndex, setSelectedDecorationIndex] = useState<number | null>(null);
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 三栏宽度与拖拽状态
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(340);
  const [draggingSide, setDraggingSide] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!draggingSide) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      const total = bodyRef.current?.clientWidth ?? window.innerWidth;
      const other = drag.side === 'left' ? rightWidth : leftWidth;
      const maxWidth = Math.min(MAX_SIDE, Math.max(MIN_SIDE, total - other - MIN_CENTER));
      const raw = drag.side === 'left' ? drag.startWidth + delta : drag.startWidth - delta;
      const next = Math.max(MIN_SIDE, Math.min(maxWidth, raw));
      if (drag.side === 'left') setLeftWidth(next);
      else setRightWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      setDraggingSide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingSide, leftWidth, rightWidth]);

  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { side, startX: e.clientX, startWidth: side === 'left' ? leftWidth : rightWidth };
    setDraggingSide(side);
  };

  const resetWidths = () => {
    setLeftWidth(320);
    setRightWidth(340);
  };

  useEffect(() => {
    loadTemplate(SKIN_TEMPLATES[0]);
  }, []);

  const loadTemplate = (tpl: SkinTemplate) => {
    setConfig(tpl.config);
    const next = new Map<string, SkinAsset>();
    for (const [path, dataUrl] of Object.entries(tpl.defaultImages || {})) {
      next.set(path, { path, blobUrl: dataUrl });
    }
    setAssets(next);
    setSelectedDecorationIndex(null);
  };

  const handleAddAsset = (path: string, file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = blobUrl;
    img.onload = () => {
      setAssets(prev => {
        const next = new Map(prev);
        next.set(path, { path, blobUrl, file, width: img.naturalWidth, height: img.naturalHeight });
        return next;
      });
    };
  };

  const handleImportSsf = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const result = await processSsfArchive(buffer, file.name);

      const next = new Map<string, SkinAsset>();
      for (const [imgName, dataUrl] of Object.entries(result.images)) {
        next.set(`assets/${imgName}`, { path: `assets/${imgName}`, blobUrl: dataUrl });
      }

      setAssets(next);
      setConfig(result.skinConfig);
      setSelectedDecorationIndex(null);
      if (result.warnings.length > 0) {
        alert('导入完成，有几处需要你确认：\n\n' + result.warnings.map(w => '· ' + w).join('\n'));
      }
    } catch (err) {
      alert(`导入皮肤失败: ${(err as Error).message || err}`);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportSkinPackage(config, assets);
      const safeName = (config.meta.id || 'my_skin').replace(/[^a-z0-9._-]/gi, '_');
      downloadBlob(blob, `${safeName}.zip`);
    } catch (err) {
      alert(`导出皮肤失败: ${(err as Error).message || err}`);
    }
  };

  /** 设为九宫格面板。 */
  const handleSetPanelImage = (pathKey: string) => {
    const asset = assets.get(pathKey);
    const slice = DEFAULT_SLICE(asset?.width || 32, asset?.height || 32);
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        border_image: {
          ...(prev.candidate_window.border_image || {}),
          source: pathKey,
          slice_dip: prev.candidate_window.border_image?.slice_dip ?? [slice, slice, slice, slice],
          width_dip: prev.candidate_window.border_image?.width_dip ?? [slice, slice, slice, slice],
          fill: prev.candidate_window.border_image?.fill ?? true
        }
      }
    }));
  };

  /** 设为卡片背景图（画在底色之上、文字之下）。 */
  const handleSetBackgroundImage = (pathKey: string) => {
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        background: { image: pathKey, fit: prev.candidate_window.background?.fit || 'cover', opacity: 1 }
      }
    }));
  };

  const handleAddDecorationFromAsset = (pathKey: string) => {
    const asset = assets.get(pathKey);
    setConfig(prev => {
      const list = prev.candidate_window.decorations ?? [];
      const next = [
        ...list,
        {
          image: pathKey,
          anchor: 'bottom-left' as const,
          width_dip: asset?.width || 64,
          height_dip: asset?.height || 64,
          offset_x_dip: 0,
          offset_y_dip: 0,
          z_index: 2
        }
      ];
      setSelectedDecorationIndex(next.length - 1);
      return { ...prev, candidate_window: { ...prev.candidate_window, decorations: next } };
    });
  };

  const handleUpdateDecoration = (index: number, patch: Partial<NonNullable<SkinV2Config['candidate_window']['decorations']>[number]>) => {
    setConfig(prev => {
      const list = [...(prev.candidate_window.decorations ?? [])];
      if (!list[index]) return prev;
      list[index] = { ...list[index], ...patch };
      return { ...prev, candidate_window: { ...prev.candidate_window, decorations: list } };
    });
  };

  const handleRemoveDecoration = (index: number) => {
    setConfig(prev => {
      const list = (prev.candidate_window.decorations ?? []).filter((_, i) => i !== index);
      return { ...prev, candidate_window: { ...prev.candidate_window, decorations: list } };
    });
    setSelectedDecorationIndex(null);
  };

  const handleSaveSlice = (slice: number[], width: number[], outer: Insets) => {
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        border_image: { ...(prev.candidate_window.border_image ?? { source: '' }), slice_dip: slice, width_dip: width },
        outer_insets_dip: outer
      }
    }));
    setSliceModalOpen(false);
  };

  const panelPath = config.candidate_window.border_image?.source;
  const panelAsset = panelPath ? assets.get(panelPath) : undefined;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Header
        skinName={config.meta.name}
        layoutMode={layoutMode}
        onChangeLayoutMode={setLayoutMode}
        onSelectTemplate={loadTemplate}
        onImportSsf={handleImportSsf}
        onExport={handleExport}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      <div ref={bodyRef} className={`flex-1 flex overflow-hidden ${draggingSide ? 'select-none' : ''}`}>
        <div style={{ width: leftWidth }} className="shrink-0 flex h-full min-w-0">
          <AssetManager
            config={config}
            assets={assets}
            onAddAsset={handleAddAsset}
            onSetPanelImage={handleSetPanelImage}
            onSetBackgroundImage={handleSetBackgroundImage}
            onAddDecorationFromAsset={handleAddDecorationFromAsset}
            onOpenSliceModal={() => setSliceModalOpen(true)}
            isDarkMode={isDarkMode}
          />
        </div>

        <Splitter isDarkMode={isDarkMode} dragging={draggingSide === 'left'} onMouseDown={startDrag('left')} />

        <main className={`flex-1 flex flex-col relative overflow-hidden min-w-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <div className={`h-10 border-b px-4 flex items-center justify-between text-xs select-none ${isDarkMode ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}>
            <div className="flex items-center gap-2">
              <span>候选框主题:</span>
              <button
                onClick={() => setPreviewTheme('dark')}
                className={`px-2 py-0.5 rounded transition ${previewTheme === 'dark' ? 'bg-emerald-600 text-white font-medium' : ''}`}
              >
                深色
              </button>
              <button
                onClick={() => setPreviewTheme('light')}
                className={`px-2 py-0.5 rounded transition ${previewTheme === 'light' ? 'bg-emerald-600 text-white font-medium' : ''}`}
              >
                浅色
              </button>
              <span className="ml-3 text-slate-500">基础皮肤: {config.meta.base}</span>
            </div>

            <div className="flex items-center gap-3">
              <span>测试拼音:</span>
              <input
                type="text"
                value={samplePinyin}
                onChange={e => setSamplePinyin(e.target.value)}
                className={`px-2 py-0.5 rounded border text-xs focus:outline-none focus:border-emerald-500 w-44 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              />
            </div>
          </div>

          <div className={`flex-1 relative flex items-center justify-center p-8 overflow-auto ${isDarkMode ? 'bg-slate-950' : 'bg-slate-200'}`}>
            <CandidatePreview
              config={config}
              assets={assets}
              layoutMode={layoutMode}
              theme={previewTheme}
              samplePinyin={samplePinyin}
              sampleCandidates={sampleCandidates}
              sampleTranslations={sampleTranslations}
              selectedIndex={selectedIndex}
              onSelectCandidate={setSelectedIndex}
              onUpdateDecorationOffset={(index, offset) =>
                handleUpdateDecoration(index, { offset_x_dip: offset.x, offset_y_dip: offset.y })
              }
              selectedDecorationIndex={selectedDecorationIndex}
              onSelectDecoration={setSelectedDecorationIndex}
            />
          </div>

          <div className={`h-7 border-t px-4 flex items-center justify-between text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-500 bg-slate-900/60' : 'border-slate-200 text-slate-500 bg-white'}`}>
            <span>拖拽挂件即可微调 offset，正数向右向下，与水杉两端语义一致</span>
            <span className="flex items-center gap-3">
              <span>渲染规则对齐 ui-html/webview2/candwnd</span>
              <button onClick={resetWidths} className="underline hover:text-emerald-500">
                重置栏宽
              </button>
            </span>
          </div>
        </main>

        <Splitter isDarkMode={isDarkMode} dragging={draggingSide === 'right'} onMouseDown={startDrag('right')} />

        <div style={{ width: rightWidth }} className="shrink-0 flex h-full min-w-0">
          <ConfigPanel
            config={config}
            onChange={setConfig}
            selectedDecorationIndex={selectedDecorationIndex}
            onSelectDecoration={setSelectedDecorationIndex}
            onRemoveDecoration={handleRemoveDecoration}
            onUpdateDecoration={handleUpdateDecoration}
            isDarkMode={isDarkMode}
            layoutMode={layoutMode}
          />
        </div>
      </div>

      {sliceModalOpen && panelAsset && (
        <SliceModal
          imageSrc={panelAsset.blobUrl}
          imageTitle={panelPath || '面板'}
          slice={config.candidate_window.border_image?.slice_dip || [16, 16, 16, 16]}
          width={config.candidate_window.border_image?.width_dip || [16, 16, 16, 16]}
          outer={config.candidate_window.outer_insets_dip || { top: 0, right: 0, bottom: 0, left: 0 }}
          onSave={handleSaveSlice}
          onClose={() => setSliceModalOpen(false)}
        />
      )}
    </div>
  );
};

/** 三栏之间的拖拽条。宽度固定 5px，命中区域够大又不抢视觉。 */
const Splitter: React.FC<{
  isDarkMode: boolean;
  dragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ isDarkMode, dragging, onMouseDown }) => (
  <div
    onMouseDown={onMouseDown}
    title="拖动调整栏宽"
    className={`w-[5px] shrink-0 cursor-col-resize transition-colors ${
      dragging
        ? 'bg-emerald-500'
        : isDarkMode
        ? 'bg-slate-800 hover:bg-emerald-600'
        : 'bg-slate-200 hover:bg-emerald-500'
    }`}
  />
);
