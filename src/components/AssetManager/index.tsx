import React, { useRef } from 'react';
import { SkinV2Config, SkinAsset } from '../../types/skin';

interface AssetManagerProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  onAddAsset: (path: string, file: File) => void;
  onSetBackgroundImage: (path: string) => void;
  onSetHighlightImage: (path: string) => void;
  onAddAccessoryFromAsset: (path: string) => void;
  onOpenSliceModal: (type: 'background' | 'highlight') => void;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  config,
  assets,
  onAddAsset,
  onSetBackgroundImage,
  onSetHighlightImage,
  onAddAccessoryFromAsset,
  onOpenSliceModal
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const assetPath = `assets/${file.name}`;
      onAddAsset(assetPath, file);
    }
  };

  const currentBg = config.candidate_window.background_image;
  const currentHl = config.highlight_item?.background_image;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-80 select-none">
      {/* 顶部操作区 */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>素材库与九宫格</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
              {assets.size} 项
            </span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">支持将 PNG/JPG 直接拖入此处</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded shadow transition"
        >
          + 导入素材
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* 核心贴图槽位 */}
      <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">核心皮肤贴图槽位</div>

        {/* 窗口背景贴图槽位 */}
        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-200">候选窗口背景</span>
            {currentBg && (
              <button
                onClick={() => onOpenSliceModal('background')}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded transition"
              >
                标定九宫格
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate font-mono">
            {currentBg || '未设置 (使用纯色背景)'}
          </div>
        </div>

        {/* 首选高亮背景槽位 */}
        <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-200">首选项高亮背景</span>
            {currentHl && (
              <button
                onClick={() => onOpenSliceModal('highlight')}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded transition"
              >
                标定九宫格
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate font-mono">
            {currentHl || '未设置 (使用常规纯色)'}
          </div>
        </div>
      </div>

      {/* 图片资源列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">全部可用贴图素材</div>

        {assets.size === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg p-4">
            素材库暂无图片，导入 SSF 或点击右上角上传图片
          </div>
        ) : (
          Array.from(assets.entries()).map(([pathKey, asset]) => {
            const isBg = currentBg === pathKey;
            const isHl = currentHl === pathKey;

            return (
              <div
                key={pathKey}
                className="group bg-slate-850 hover:bg-slate-800 p-2.5 rounded-lg border border-slate-700/60 transition flex gap-3 items-center"
              >
                <div className="w-12 h-12 rounded bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  <img src={asset.blobUrl} alt={pathKey} className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{pathKey.replace('assets/', '')}</div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <button
                      onClick={() => onSetBackgroundImage(pathKey)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                        isBg
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {isBg ? '已设为背景' : '设为背景'}
                    </button>
                    <button
                      onClick={() => onSetHighlightImage(pathKey)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                        isHl
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {isHl ? '已设为高亮' : '设为高亮'}
                    </button>
                    <button
                      onClick={() => onAddAccessoryFromAsset(pathKey)}
                      className="text-[10px] bg-purple-900/60 text-purple-300 hover:bg-purple-800 px-1.5 py-0.5 rounded transition"
                    >
                      + 挂件
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
