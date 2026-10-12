import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CandidatePreview } from './components/CandidatePreview';
import { AssetManager } from './components/AssetManager';
import { ConfigPanel } from './components/ConfigPanel';
import { SliceModal } from './components/SliceModal';

import { SkinV2Config, SkinAsset, FourSides, AccessoryAnchor } from './types/skin';
import { SKIN_TEMPLATES, SkinTemplate } from './constants/templates';
import { processSsfArchive } from './utils/ssf';
import { exportSkinPackage, downloadBlob } from './utils/exporter';

export const App: React.FC = () => {
  // 当前皮肤配置
  const [config, setConfig] = useState<SkinV2Config>(SKIN_TEMPLATES[0].config);
  // 素材库映射 path -> SkinAsset
  const [assets, setAssets] = useState<Map<string, SkinAsset>>(new Map());

  // 视口与沙盒状态
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [samplePinyin, setSamplePinyin] = useState('shui\'shan\'shu\'ru\'fa');
  const [sampleCandidates, setSampleCandidates] = useState(['水杉输入法', '水杉', '水扇', '税收', '随身']);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [wallpaperMode, setWallpaperMode] = useState<'dark' | 'light' | 'grid'>('dark');

  // 选中的挂件
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string | null>(null);

  // 九宫格标定弹窗状态
  const [sliceModalTarget, setSliceModalTarget] = useState<'background' | 'highlight' | null>(null);

  // 主题模式（默认明亮白色系）
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 初始化加载默认模板素材
  useEffect(() => {
    loadTemplate(SKIN_TEMPLATES[0]);
  }, []);

  const loadTemplate = (tpl: SkinTemplate) => {
    setConfig(tpl.config);
    const newAssets = new Map<string, SkinAsset>();
    if (tpl.defaultImages) {
      for (const [pathKey, dataUrl] of Object.entries(tpl.defaultImages)) {
        newAssets.set(pathKey, {
          path: pathKey,
          blobUrl: dataUrl
        });
      }
    }
    setAssets(newAssets);
    setSelectedAccessoryId(null);
  };

  // 添加素材
  const handleAddAsset = (path: string, file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = blobUrl;
    img.onload = () => {
      setAssets(prev => {
        const next = new Map(prev);
        next.set(path, {
          path,
          blobUrl,
          file,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        return next;
      });
    };
  };

  // 导入 SSF
  const handleImportSsf = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const result = await processSsfArchive(buffer, file.name);

      const newAssets = new Map<string, SkinAsset>();
      for (const [imgName, dataUrl] of Object.entries(result.images)) {
        newAssets.set(`assets/${imgName}`, {
          path: `assets/${imgName}`,
          blobUrl: dataUrl
        });
      }

      setAssets(newAssets);
      setConfig(result.skinConfig);
      setSelectedAccessoryId(null);
    } catch (err: any) {
      alert(`导入皮肤失败: ${err.message || err}`);
    }
  };

  // 导出皮肤包
  const handleExport = async () => {
    try {
      const zipBlob = await exportSkinPackage(config, assets);
      const safeName = (config.meta.name || 'custom_skin').replace(/[\\/:*?"<>|]/g, '_');
      downloadBlob(zipBlob, `${safeName}.zip`);
    } catch (err: any) {
      alert(`导出皮肤失败: ${err.message || err}`);
    }
  };

  // 设为窗口背景
  const handleSetBackgroundImage = (pathKey: string) => {
    const asset = assets.get(pathKey);
    // 给定默认的九宫格参数 (取尺寸的四分之一作为保守默认值)
    const w = asset?.width || 32;
    const h = asset?.height || 32;
    const defaultSlice = {
      top: Math.round(h * 0.25),
      right: Math.round(w * 0.25),
      bottom: Math.round(h * 0.25),
      left: Math.round(w * 0.25)
    };

    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        background_image: pathKey,
        border_slice_px: prev.candidate_window.border_slice_px || defaultSlice,
        border_width_dip: prev.candidate_window.border_width_dip || defaultSlice,
        scale_mode: 'stretch'
      }
    }));
  };

  // 设为高亮背景
  const handleSetHighlightImage = (pathKey: string) => {
    const asset = assets.get(pathKey);
    const w = asset?.width || 24;
    const h = asset?.height || 24;
    const defaultSlice = {
      top: Math.round(h * 0.25),
      right: Math.round(w * 0.25),
      bottom: Math.round(h * 0.25),
      left: Math.round(w * 0.25)
    };

    setConfig(prev => ({
      ...prev,
      highlight_item: {
        ...(prev.highlight_item || {}),
        background_image: pathKey,
        border_slice_px: prev.highlight_item?.border_slice_px || defaultSlice,
        border_width_dip: prev.highlight_item?.border_width_dip || defaultSlice,
        scale_mode: 'stretch'
      }
    }));
  };

  // 从素材添加挂件
  const handleAddAccessoryFromAsset = (pathKey: string) => {
    const asset = assets.get(pathKey);
    const newId = `acc_${Date.now() % 10000}`;
    const newAcc = {
      id: newId,
      image: pathKey,
      anchor: 'bottom_right' as AccessoryAnchor,
      offset_dip: { x: 10, y: 10 },
      size_dip: asset?.width && asset?.height ? { width: asset.width, height: asset.height } : undefined,
      z_order: 10,
      attach_to: 'window' as const
    };

    setConfig(prev => ({
      ...prev,
      accessories: [...(prev.accessories || []), newAcc]
    }));
    setSelectedAccessoryId(newId);
  };

  // 更新挂件偏移
  const handleUpdateAccessoryOffset = (id: string, offset: { x: number; y: number }, anchor?: AccessoryAnchor) => {
    setConfig(prev => ({
      ...prev,
      accessories: (prev.accessories || []).map(acc => {
        if (acc.id === id) {
          return {
            ...acc,
            offset_dip: offset,
            ...(anchor ? { anchor } : {})
          };
        }
        return acc;
      })
    }));
  };

  // 移除挂件
  const handleRemoveAccessory = (id: string) => {
    setConfig(prev => ({
      ...prev,
      accessories: (prev.accessories || []).filter(a => a.id !== id)
    }));
    if (selectedAccessoryId === id) {
      setSelectedAccessoryId(null);
    }
  };

  // 保存切片标定
  const handleSaveSlice = (slices: FourSides<number>) => {
    if (sliceModalTarget === 'background') {
      setConfig(prev => ({
        ...prev,
        candidate_window: {
          ...prev.candidate_window,
          border_slice_px: slices,
          border_width_dip: slices
        }
      }));
    } else if (sliceModalTarget === 'highlight') {
      setConfig(prev => ({
        ...prev,
        highlight_item: {
          ...(prev.highlight_item || {}),
          border_slice_px: slices,
          border_width_dip: slices
        }
      }));
    }
    setSliceModalTarget(null);
  };

  // 获取标定弹窗需要展示的素材
  const getSliceTargetAsset = () => {
    if (sliceModalTarget === 'background') {
      const path = config.candidate_window.background_image;
      if (!path) return null;
      return {
        path,
        asset: assets.get(path),
        slices: config.candidate_window.border_slice_px || { top: 4, right: 4, bottom: 4, left: 4 },
        title: '候选窗口背景'
      };
    }
    if (sliceModalTarget === 'highlight') {
      const path = config.highlight_item?.background_image;
      if (!path) return null;
      return {
        path,
        asset: assets.get(path),
        slices: config.highlight_item?.border_slice_px || { top: 4, right: 4, bottom: 4, left: 4 },
        title: '首选高亮背景'
      };
    }
    return null;
  };

  const sliceTargetInfo = getSliceTargetAsset();

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* 顶部标题栏 */}
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

      {/* 主体三栏工作台 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧资产库 */}
        <AssetManager
          config={config}
          assets={assets}
          onAddAsset={handleAddAsset}
          onSetBackgroundImage={handleSetBackgroundImage}
          onSetHighlightImage={handleSetHighlightImage}
          onAddAccessoryFromAsset={handleAddAccessoryFromAsset}
          onOpenSliceModal={setSliceModalTarget}
        />

        {/* 中央高保真仿真画布 */}
        <main className={`flex-1 flex flex-col relative overflow-hidden transition-colors ${
          isDarkMode ? 'bg-slate-950' : 'bg-slate-100'
        }`}>
          {/* 画布控制条 */}
          <div className={`h-10 border-b px-4 flex items-center justify-between text-xs select-none transition-colors ${
            isDarkMode ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-white text-slate-600'
          }`}>
            <div className="flex items-center gap-2">
              <span>壁纸氛围:</span>
              <button
                onClick={() => setWallpaperMode('dark')}
                className={`px-2 py-0.5 rounded transition ${
                  wallpaperMode === 'dark'
                    ? 'bg-emerald-600 text-white font-medium'
                    : isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'
                }`}
              >
                深灰
              </button>
              <button
                onClick={() => setWallpaperMode('light')}
                className={`px-2 py-0.5 rounded transition ${
                  wallpaperMode === 'light'
                    ? 'bg-emerald-600 text-white font-medium'
                    : isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'
                }`}
              >
                浅色
              </button>
              <button
                onClick={() => setWallpaperMode('grid')}
                className={`px-2 py-0.5 rounded transition ${
                  wallpaperMode === 'grid'
                    ? 'bg-emerald-600 text-white font-medium'
                    : isDarkMode ? 'hover:text-white' : 'hover:text-slate-900'
                }`}
              >
                像素网格
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span>测试拼音:</span>
              <input
                type="text"
                value={samplePinyin}
                onChange={e => setSamplePinyin(e.target.value)}
                className={`px-2 py-0.5 rounded border text-xs focus:outline-none focus:border-emerald-500 w-36 transition-colors ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
                placeholder="输入拼音测试..."
              />
            </div>
          </div>

          {/* 画布视口 */}
          <div
            className={`flex-1 relative flex items-center justify-center p-8 overflow-auto ${
              wallpaperMode === 'light'
                ? 'bg-slate-200'
                : wallpaperMode === 'grid'
                ? 'bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] bg-slate-950'
                : 'bg-slate-950'
            }`}
          >
            <CandidatePreview
              config={config}
              assets={assets}
              layoutMode={layoutMode}
              samplePinyin={samplePinyin}
              sampleCandidates={sampleCandidates}
              selectedIndex={selectedIndex}
              onSelectCandidate={setSelectedIndex}
              onUpdateAccessoryOffset={handleUpdateAccessoryOffset}
              selectedAccessoryId={selectedAccessoryId}
              onSelectAccessory={setSelectedAccessoryId}
            />
          </div>

          {/* 底部操作提示 */}
          <div className="h-7 border-t border-slate-800 px-4 flex items-center justify-between text-[11px] text-slate-500 bg-slate-900/60 select-none">
            <span>🖱️ 支持直接拖拽挂件微调位置 | 贴图槽位支持一键标定九宫格切片参考线</span>
            <span>水杉输入法 v2 架构高保真呈现</span>
          </div>
        </main>

        {/* 右侧属性检查面板 */}
        <ConfigPanel
          config={config}
          onChange={setConfig}
          selectedAccessoryId={selectedAccessoryId}
          onSelectAccessory={setSelectedAccessoryId}
          onRemoveAccessory={handleRemoveAccessory}
        />
      </div>

      {/* 九宫格标定弹窗 */}
      {sliceTargetInfo && (
        <SliceModal
          imageSrc={sliceTargetInfo.asset?.blobUrl || ''}
          imageTitle={sliceTargetInfo.title}
          slices={sliceTargetInfo.slices}
          onSave={handleSaveSlice}
          onClose={() => setSliceModalTarget(null)}
        />
      )}
    </div>
  );
};
