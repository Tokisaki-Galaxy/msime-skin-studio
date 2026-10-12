import React, { useRef, useState, useEffect } from 'react';
import { FourSides } from '../../types/skin';

interface SliceModalProps {
  imageSrc: string;
  imageTitle: string;
  slices: FourSides<number>;
  onSave: (slices: FourSides<number>) => void;
  onClose: () => void;
}

export const SliceModal: React.FC<SliceModalProps> = ({
  imageSrc,
  imageTitle,
  slices,
  onSave,
  onClose
}) => {
  const [currentSlices, setCurrentSlices] = useState<FourSides<number>>(slices);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [dragTarget, setDragTarget] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageSrc]);

  // 处理拖动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragTarget || !containerRef.current || !naturalSize.width) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = naturalSize.width / rect.width;
    const scaleY = naturalSize.height / rect.height;

    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left)) * scaleX;
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top)) * scaleY;

    if (dragTarget === 'top') {
      const top = Math.round(Math.min(relY, naturalSize.height - currentSlices.bottom - 2));
      setCurrentSlices(prev => ({ ...prev, top: Math.max(0, top) }));
    } else if (dragTarget === 'bottom') {
      const bottom = Math.round(Math.min(naturalSize.height - relY, naturalSize.height - currentSlices.top - 2));
      setCurrentSlices(prev => ({ ...prev, bottom: Math.max(0, bottom) }));
    } else if (dragTarget === 'left') {
      const left = Math.round(Math.min(relX, naturalSize.width - currentSlices.right - 2));
      setCurrentSlices(prev => ({ ...prev, left: Math.max(0, left) }));
    } else if (dragTarget === 'right') {
      const right = Math.round(Math.min(naturalSize.width - relX, naturalSize.width - currentSlices.left - 2));
      setCurrentSlices(prev => ({ ...prev, right: Math.max(0, right) }));
    }
  };

  const handleMouseUp = () => {
    setDragTarget(null);
  };

  const topPercent = naturalSize.height ? (currentSlices.top / naturalSize.height) * 100 : 0;
  const bottomPercent = naturalSize.height ? (currentSlices.bottom / naturalSize.height) * 100 : 0;
  const leftPercent = naturalSize.width ? (currentSlices.left / naturalSize.width) * 100 : 0;
  const rightPercent = naturalSize.width ? (currentSlices.right / naturalSize.width) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden">
        {/* 标题 */}
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h3 className="font-semibold text-slate-100">九宫格切片参考线标定器: {imageTitle}</h3>
            {naturalSize.width > 0 && (
              <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                原图: {naturalSize.width} × {naturalSize.height} px
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 text-sm"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center justify-center">
          {/* 大图与切片线 */}
          <div
            ref={containerRef}
            className="relative border border-slate-600 bg-slate-950 rounded overflow-hidden max-w-[480px] max-h-[480px] flex items-center justify-center cursor-crosshair shadow-inner"
          >
            <img
              src={imageSrc}
              alt="Slice Source"
              className="max-w-full max-h-[440px] object-contain pointer-events-none block"
            />

            {/* 顶线 */}
            <div
              style={{ top: `${topPercent}%` }}
              onMouseDown={() => setDragTarget('top')}
              className="absolute left-0 right-0 h-0.5 bg-rose-500 hover:h-1 cursor-ns-resize shadow-[0_0_8px_rgba(244,63,94,0.8)] z-10"
            >
              <div className="absolute left-2 -top-4 bg-rose-600 text-white text-[10px] px-1 rounded shadow">
                Top: {currentSlices.top}px
              </div>
            </div>

            {/* 底线 */}
            <div
              style={{ bottom: `${bottomPercent}%` }}
              onMouseDown={() => setDragTarget('bottom')}
              className="absolute left-0 right-0 h-0.5 bg-rose-500 hover:h-1 cursor-ns-resize shadow-[0_0_8px_rgba(244,63,94,0.8)] z-10"
            >
              <div className="absolute left-2 top-1 bg-rose-600 text-white text-[10px] px-1 rounded shadow">
                Bottom: {currentSlices.bottom}px
              </div>
            </div>

            {/* 左线 */}
            <div
              style={{ left: `${leftPercent}%` }}
              onMouseDown={() => setDragTarget('left')}
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 hover:w-1 cursor-ew-resize shadow-[0_0_8px_rgba(59,130,246,0.8)] z-10"
            >
              <div className="absolute top-2 -left-5 bg-blue-600 text-white text-[10px] px-1 rounded shadow -rotate-90">
                Left: {currentSlices.left}px
              </div>
            </div>

            {/* 右线 */}
            <div
              style={{ right: `${rightPercent}%` }}
              onMouseDown={() => setDragTarget('right')}
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 hover:w-1 cursor-ew-resize shadow-[0_0_8px_rgba(59,130,246,0.8)] z-10"
            >
              <div className="absolute top-2 -right-5 bg-blue-600 text-white text-[10px] px-1 rounded shadow 90">
                Right: {currentSlices.right}px
              </div>
            </div>

            {/* 提示遮罩 */}
            <div
              style={{
                position: 'absolute',
                top: `${topPercent}%`,
                left: `${leftPercent}%`,
                right: `${rightPercent}%`,
                bottom: `${bottomPercent}%`,
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px dashed rgba(34, 197, 94, 0.4)',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* 右侧数值手动微调面板 */}
          <div className="flex flex-col gap-4 w-64 bg-slate-900/60 p-4 rounded-lg border border-slate-700">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">切片数值精准调整</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-rose-400 flex justify-between">
                  <span>上边距 (Top)</span>
                  <span>{currentSlices.top} px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(10, (naturalSize.height || 100) - 2)}
                  value={currentSlices.top}
                  onChange={e => setCurrentSlices(prev => ({ ...prev, top: Number(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-blue-400 flex justify-between">
                  <span>右边距 (Right)</span>
                  <span>{currentSlices.right} px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(10, (naturalSize.width || 100) - 2)}
                  value={currentSlices.right}
                  onChange={e => setCurrentSlices(prev => ({ ...prev, right: Number(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-rose-400 flex justify-between">
                  <span>下边距 (Bottom)</span>
                  <span>{currentSlices.bottom} px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(10, (naturalSize.height || 100) - 2)}
                  value={currentSlices.bottom}
                  onChange={e => setCurrentSlices(prev => ({ ...prev, bottom: Number(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500 mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-blue-400 flex justify-between">
                  <span>左边距 (Left)</span>
                  <span>{currentSlices.left} px</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(10, (naturalSize.width || 100) - 2)}
                  value={currentSlices.left}
                  onChange={e => setCurrentSlices(prev => ({ ...prev, left: Number(e.target.value) }))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-1"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-800/80 p-2.5 rounded leading-relaxed border border-slate-700/60 mt-2">
              提示：拖动参考线可定义九宫格固定保护区。中间浅绿区域将在候选词拉长时自由平铺或拉伸。
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3 border-t border-slate-700 flex justify-end gap-3 bg-slate-850">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={() => onSave(currentSlices)}
            className="px-4 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition"
          >
            应用切片标定
          </button>
        </div>
      </div>
    </div>
  );
};
