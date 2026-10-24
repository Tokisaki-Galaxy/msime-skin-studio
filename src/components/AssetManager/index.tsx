import React, { useRef } from 'react';
import { SkinAsset, SkinV2Config } from '../../types/skin';

interface AssetManagerProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  onAddAsset: (path: string, file: File) => void;
  onRemoveAsset: (path: string) => void;
  onSetPanelImage: (path: string) => void;
  onSetBackgroundImage: (path: string) => void;
  /** 取消九宫格面板与卡片背景，素材本身保留在库里。 */
  onClearPanel: () => void;
  onClearBackground: () => void;
  onAddDecorationFromAsset: (path: string) => void;
  onOpenSliceModal: () => void;
  isDarkMode?: boolean;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  config,
  assets,
  onAddAsset,
  onRemoveAsset,
  onSetPanelImage,
  onSetBackgroundImage,
  onClearPanel,
  onClearBackground,
  onAddDecorationFromAsset,
  onOpenSliceModal,
  isDarkMode = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) onAddAsset(`assets/${files[i].name}`, files[i]);
    // 同一个文件连选两次时不清空 value 不会触发 change，导入会「没反应」。
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files) return;
    const skipped: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || /\.(png|jpe?g|bmp|webp|gif)$/i.test(file.name)) {
        onAddAsset(`assets/${file.name}`, file);
      } else {
        // 拖进来的混有目录或非图片时，静默跳过会让人以为拖拽坏了，这里攒起来说一次。
        skipped.push(file.name || '(未命名)');
      }
    }
    if (skipped.length > 0) {
      alert(`以下文件不是图片，已跳过：\n${skipped.map(n => '· ' + n).join('\n')}`);
    }
  };

  const panel = config.candidate_window.border_image?.source;
  const background = config.candidate_window.background?.image;
  const decorationImages = new Set((config.candidate_window.decorations ?? []).map(d => d.image));

  const labelCls = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const slotCls = `p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200'}`;

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={handleDrop}
      className={`flex flex-col h-full border-r w-full min-w-0 select-none relative ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'} ${isDragOver ? 'ring-2 ring-emerald-500' : ''}`}
    >
      <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
        <div>
          <h2 className="text-sm font-semibold">素材库</h2>
          <p className={`text-[11px] mt-0.5 ${labelCls}`}>拖入 PNG/JPG，或点右上角导入</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded">
          + 导入
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
      </div>

      <div className={`p-4 border-b space-y-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/70'}`}>
        <div className={`text-[11px] font-medium uppercase tracking-wider ${labelCls}`}>当前槽位</div>

        <div className={slotCls}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">九宫格面板 border_image</span>
            {panel && (
              <span className="flex items-center gap-2">
                <button onClick={onOpenSliceModal} className="text-[11px] text-emerald-500 hover:text-emerald-400">
                  标定切片
                </button>
                <button onClick={onClearPanel} title="取消九宫格面板" className={`text-[11px] ${labelCls} hover:text-rose-500`}>
                  清除
                </button>
              </span>
            )}
          </div>
          <div className={`text-[11px] truncate font-mono mt-1 ${labelCls}`}>{panel || '未设置'}</div>
        </div>

        <div className={slotCls}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">卡片背景 background</span>
            {background && (
              <button onClick={onClearBackground} title="取消卡片背景图" className={`text-[11px] ${labelCls} hover:text-rose-500`}>
                清除
              </button>
            )}
          </div>
          <div className={`text-[11px] truncate font-mono mt-1 ${labelCls}`}>{background || '未设置'}</div>
        </div>

        <div className={slotCls}>
          <span className="text-xs font-medium">挂件 decorations（{(config.candidate_window.decorations ?? []).length}）</span>
          <div className={`text-[11px] truncate font-mono mt-1 ${labelCls}`}>
            {(config.candidate_window.decorations ?? []).map(d => d.image.replace('assets/', '')).join(', ') || '未设置'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className={`text-[11px] font-medium uppercase tracking-wider ${labelCls}`}>全部贴图</div>
        {assets.size === 0 ? (
          <div className={`text-center py-8 text-xs border border-dashed rounded-lg p-4 ${isDarkMode ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-300'}`}>
            还没有素材，导入 SSF 或上传图片
          </div>
        ) : (
          Array.from(assets.entries()).map(([pathKey, asset]) => (
            <div
              key={pathKey}
              className={`p-2.5 rounded-lg border flex gap-3 items-center ${isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'}`}
            >
              <div className={`w-12 h-12 rounded border overflow-hidden flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <img src={asset.blobUrl} alt={pathKey} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{pathKey.replace('assets/', '')}</div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <button
                    onClick={() => onSetPanelImage(pathKey)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${panel === pathKey ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {panel === pathKey ? '已作面板' : '设为面板'}
                  </button>
                  <button
                    onClick={() => onSetBackgroundImage(pathKey)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${background === pathKey ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {background === pathKey ? '已作背景' : '设为背景'}
                  </button>
                  <button
                    onClick={() => onAddDecorationFromAsset(pathKey)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${decorationImages.has(pathKey) ? 'bg-purple-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    + 挂件
                  </button>
                  <button
                    onClick={() => onRemoveAsset(pathKey)}
                    title="删除素材，并清掉引用它的字段"
                    className={`text-[10px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-rose-300 hover:bg-rose-900/60' : 'bg-slate-100 text-rose-600 hover:bg-rose-100'}`}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
