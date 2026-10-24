import React from 'react';
import { Link, Unlink } from 'lucide-react';
import { Insets } from '../../types/skin';
import { cn } from '../../utils/cn';
import { textMuted } from './tokens';

interface InsetsEditorProps {
  value: Insets;
  dark: boolean;
  onChange: (value: Insets) => void;
  /** 上下的最大值。 */
  topBottomMax?: number;
  /** 左右的最大值。 */
  rightLeftMax?: number;
  /** 是否提供「四边联动」开关，默认提供。 */
  linked?: boolean;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const SIDE_LABELS: Record<(typeof SIDES)[number], string> = {
  top: '上',
  right: '右',
  bottom: '下',
  left: '左'
};

/**
 * 四边内边距编辑。旧版是四个完全一样、只能靠 title 提示是上右下左的裸数字框，
 * 用户得记住顺序。这里每个框都带可见的方位标签，并给出「四边联动」开关。
 */
export const InsetsEditor: React.FC<InsetsEditorProps> = ({
  value,
  dark,
  onChange,
  topBottomMax = 500,
  rightLeftMax = 500,
  linked = true
}) => {
  const allEqual = value.top === value.right && value.right === value.bottom && value.bottom === value.left;
  const [lock, setLock] = React.useState(allEqual);

  const limits: Record<(typeof SIDES)[number], number> = {
    top: topBottomMax,
    right: rightLeftMax,
    bottom: topBottomMax,
    left: rightLeftMax
  };

  const setSide = (side: (typeof SIDES)[number], raw: number) => {
    const clamped = Math.min(limits[side], Math.max(0, raw));
    if (lock) {
      // 联动时改任意一边都把四边拉齐，但不在这里抹平：用户刚调好的四边不该因为点了
      // 「四边联动」就只剩左边的值。
      onChange({ top: clamped, right: clamped, bottom: clamped, left: clamped });
      return;
    }
    onChange({ ...value, [side]: clamped });
  };

  return (
    <div className="space-y-1.5">
      {linked && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setLock(prev => !prev)}
            title={
              lock
                ? '四边联动中，改任意一边其余三边跟随'
                : allEqual
                ? '四边分别设置中，点开联动（首次修改时四边一起变）'
                : '四边分别设置中，点开联动（下次修改时会以那一边为准拉齐四边）'
            }
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition',
              lock
                ? 'bg-emerald-600/15 text-emerald-500'
                : dark
                ? 'text-slate-400 hover:bg-slate-700/70'
                : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {lock ? <Link size={10} /> : <Unlink size={10} />}
            {lock ? '四边联动' : '分别设置'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {SIDES.map(side => (
          <div key={side} className="space-y-0.5">
            <span className={cn('block text-center text-[10px]', textMuted(dark))}>{SIDE_LABELS[side]}</span>
            <input
              type="number"
              min={0}
              max={limits[side]}
              value={value[side]}
              onChange={e => {
                if (e.target.value.trim() === '') return;
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed)) setSide(side, parsed);
              }}
              // 清空后不论去向哪里都回填当前值，否则空框会一直留在表单里。
              onBlur={e => {
                if (e.target.value.trim() === '') e.target.value = String(value[side]);
              }}
              className={cn(
                'w-full rounded-md border px-1 py-1 text-center text-[11px] font-mono outline-none transition focus:border-emerald-500',
                dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
