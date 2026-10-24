import React, { useEffect, useRef, useState } from 'react';
import { Insets, compactFour, expandFour } from '../../types/skin';

interface SliceModalProps {
  imageSrc: string;
  imageTitle: string;
  /** 当前 slice_dip，1~4 个值。 */
  slice: number[];
  /** 当前 width_dip，1~4 个值；空数组表示沿用 slice。 */
  width: number[];
  /** 当前 outer_insets_dip。 */
  outer: Insets;
  onSave: (slice: number[], width: number[], outer: Insets) => void;
  onClose: () => void;
}

type DragTarget = 'top' | 'right' | 'bottom' | 'left' | null;

const SIDE_LABELS: Record<keyof Insets, string> = { top: '上', right: '右', bottom: '下', left: '左' };

export const SliceModal: React.FC<SliceModalProps> = ({ imageSrc, imageTitle, slice, width, outer, onSave, onClose }) => {
  const [sliceInsets, setSliceInsets] = useState<Insets>(() => expandFour(slice));
  const [widthInsets, setWidthInsets] = useState<Insets>(() => (width.length ? expandFour(width) : expandFour(slice)));
  const [outerInsets, setOuterInsets] = useState<Insets>(outer);
  const [useSliceForWidth, setUseSliceForWidth] = useState(width.length === 0);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 拖拽开始时的四边快照。闭包里读 sliceInsets 会拿到上一帧的值，拖动时线条跟不上鼠标。
  const dragStartRef = useRef<Insets | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setNatural({ width: img.naturalWidth, height: img.naturalHeight });
  }, [imageSrc]);

  // Esc 关闭。拖拽中按 Esc 先取消拖拽，避免「线跟着鼠标走但已经关窗」。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (dragTarget) {
        setDragTarget(null);
        dragStartRef.current = null;
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, dragTarget]);

  // 拖拽监听挂在 window：鼠标划出弹窗或掠过图片边缘时事件不会丢，松手总能收尾。
  useEffect(() => {
    if (!dragTarget) return;
    const rect = () => containerRef.current?.getBoundingClientRect();

    const onMove = (e: MouseEvent) => {
      const box = rect();
      const start = dragStartRef.current;
      if (!box || !start || !natural.width) return;
      const relX = Math.max(0, Math.min(box.width, e.clientX - box.left)) * (natural.width / box.width);
      const relY = Math.max(0, Math.min(box.height, e.clientY - box.top)) * (natural.height / box.height);

      setSliceInsets(() => {
        const next = { ...start };
        if (dragTarget === 'top') next.top = Math.round(Math.max(0, Math.min(relY, natural.height - start.bottom - 1)));
        else if (dragTarget === 'bottom') next.bottom = Math.round(Math.max(0, Math.min(natural.height - relY, natural.height - start.top - 1)));
        else if (dragTarget === 'left') next.left = Math.round(Math.max(0, Math.min(relX, natural.width - start.right - 1)));
        else next.right = Math.round(Math.max(0, Math.min(natural.width - relX, natural.width - start.left - 1)));
        return next;
      });
    };
    const onUp = () => {
      setDragTarget(null);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragTarget, natural.width, natural.height]);

  const beginDrag = (side: Exclude<DragTarget, null>) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = sliceInsets;
    setDragTarget(side);
  };

  const pct = (value: number, total: number) => (total ? (value / total) * 100 : 0);

  // 滑杆与数字框共用一份状态：滑杆负责快速拖，数字框负责精确值，超出台阶上限也能直接填。
  const sideSlider = (
    label: string,
    key: keyof Insets,
    state: Insets,
    setState: React.Dispatch<React.SetStateAction<Insets>>,
    total: number,
    accent: string
  ) => (
    <div>
      <div className={`text-xs ${accent} flex items-center justify-between gap-2`}>
        <label htmlFor={`slice-${label}`}>{label}</label>
        <input
          id={`slice-${label}`}
          type="number"
          value={state[key]}
          onChange={e => {
            const raw = Number(e.target.value);
            const next = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
            setState(prev => ({ ...prev, [key]: next }));
          }}
          className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 text-right text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(10, total - 2)}
        value={Math.min(state[key], Math.max(10, total - 2))}
        onChange={e => setState(prev => ({ ...prev, [key]: Number(e.target.value) }))}
        className={`w-full h-1 rounded-lg appearance-none cursor-pointer mt-1 bg-slate-700 ${accent}`}
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onMouseDown={e => {
        // 只有点遮罩本身才关窗，点面板内容不算。
        if (e.target === e.currentTarget && !dragTarget) onClose();
      }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-5xl w-full flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-slate-100">九宫格标定: {imageTitle}</h3>
            {natural.width > 0 && (
              <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                原图 {natural.width} × {natural.height} px
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="关闭（Esc）"
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-6 items-start justify-center">
          <div
            ref={containerRef}
            className="relative border border-slate-600 bg-slate-950 rounded overflow-hidden max-w-[520px] max-h-[520px] flex items-center justify-center"
          >
            <img src={imageSrc} alt="slice source" className="max-w-full max-h-[480px] object-contain pointer-events-none block" />

            {/* 视觉上 2px 的参考线，命中区拉到 14px，否则几乎点不中。 */}
            <div
              style={{ top: `${pct(sliceInsets.top, natural.height)}%` }}
              onMouseDown={beginDrag('top')}
              className="absolute left-0 right-0 h-3 -mt-1.5 cursor-ns-resize z-10 flex items-center"
            >
              <div className={`h-0.5 w-full ${dragTarget === 'top' ? 'bg-rose-300' : 'bg-rose-500'}`} />
            </div>
            <div
              style={{ bottom: `${pct(sliceInsets.bottom, natural.height)}%` }}
              onMouseDown={beginDrag('bottom')}
              className="absolute left-0 right-0 h-3 -mb-1.5 cursor-ns-resize z-10 flex items-center"
            >
              <div className={`h-0.5 w-full ${dragTarget === 'bottom' ? 'bg-rose-300' : 'bg-rose-500'}`} />
            </div>
            <div
              style={{ left: `${pct(sliceInsets.left, natural.width)}%` }}
              onMouseDown={beginDrag('left')}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-10 flex justify-center"
            >
              <div className={`w-0.5 h-full ${dragTarget === 'left' ? 'bg-blue-300' : 'bg-blue-500'}`} />
            </div>
            <div
              style={{ right: `${pct(sliceInsets.right, natural.width)}%` }}
              onMouseDown={beginDrag('right')}
              className="absolute top-0 bottom-0 w-3 -mr-1.5 cursor-ew-resize z-10 flex justify-center"
            >
              <div className={`w-0.5 h-full ${dragTarget === 'right' ? 'bg-blue-300' : 'bg-blue-500'}`} />
            </div>

            {/* 可拉伸区提示 */}
            <div
              style={{
                position: 'absolute',
                top: `${pct(sliceInsets.top, natural.height)}%`,
                left: `${pct(sliceInsets.left, natural.width)}%`,
                right: `${pct(sliceInsets.right, natural.width)}%`,
                bottom: `${pct(sliceInsets.bottom, natural.height)}%`,
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px dashed rgba(34, 197, 94, 0.4)',
                pointerEvents: 'none'
              }}
            />
          </div>

          <div className="flex flex-col gap-4 w-72 bg-slate-900/60 p-4 rounded-lg border border-slate-700">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">切片 slice_dip</h4>
            <div className="space-y-3">
              {sideSlider('上 Top', 'top', sliceInsets, setSliceInsets, natural.height, 'text-rose-400')}
              {sideSlider('右 Right', 'right', sliceInsets, setSliceInsets, natural.width, 'text-blue-400')}
              {sideSlider('下 Bottom', 'bottom', sliceInsets, setSliceInsets, natural.height, 'text-rose-400')}
              {sideSlider('左 Left', 'left', sliceInsets, setSliceInsets, natural.width, 'text-blue-400')}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 border-t border-slate-700 pt-3 cursor-pointer">
              <input type="checkbox" checked={useSliceForWidth} onChange={e => setUseSliceForWidth(e.target.checked)} />
              绘制宽度沿用 slice（width_dip 留空）
            </label>

            {!useSliceForWidth && (
              <>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">绘制宽度 width_dip</h4>
                <div className="space-y-3">
                  {sideSlider('上 Top', 'top', widthInsets, setWidthInsets, 200, 'text-rose-400')}
                  {sideSlider('右 Right', 'right', widthInsets, setWidthInsets, 200, 'text-blue-400')}
                  {sideSlider('下 Bottom', 'bottom', widthInsets, setWidthInsets, 200, 'text-rose-400')}
                  {sideSlider('左 Left', 'left', widthInsets, setWidthInsets, 200, 'text-blue-400')}
                </div>
              </>
            )}

            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-t border-slate-700 pt-3">
              outer_insets_dip（窗口多留的空白）
            </h4>
            <div className="grid grid-cols-4 gap-1">
              {(['top', 'right', 'bottom', 'left'] as const).map(side => (
                <label key={side} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-slate-400">{SIDE_LABELS[side]}</span>
                  <input
                    type="number"
                    value={outerInsets[side]}
                    onChange={e => {
                      const raw = Number(e.target.value);
                      const next = Number.isFinite(raw) ? Math.round(raw) : 0;
                      setOuterInsets(prev => ({ ...prev, [side]: next }));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-slate-100 text-center text-xs focus:outline-none focus:border-emerald-500"
                  />
                </label>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-800/80 p-2.5 rounded leading-relaxed border border-slate-700/60">
              绿色区域会被拉伸。面板图里画死的立绘与花纹要放在它外面，否则会被横向拉长。
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-200">
            取消
          </button>
          <button
            onClick={() => onSave(compactFour(sliceInsets), useSliceForWidth ? [] : compactFour(widthInsets), outerInsets)}
            className="px-4 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  );
};
