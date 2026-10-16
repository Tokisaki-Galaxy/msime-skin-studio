import React from 'react';
import { cn } from '../../utils/cn';

interface NumberSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 单位后缀，例如 dip。 */
  unit?: string;
  dark: boolean;
  /** 值显示在字段行右侧时用 compact，不显示滑轨刻度。 */
  onChange: (value: number) => void;
}

/**
 * 滑杆 + 可直接输入的数字框。旧版只有滑杆，想精确设成 12 得用鼠标慢慢蹭；
 * 数字框又只有它自己。这里两者联动：拖动粗调，输入精调。
 */
export const NumberSlider: React.FC<NumberSliderProps> = ({ value, min, max, step = 1, unit, dark, onChange }) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(clamp(parsed));
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value)}
        onChange={e => onChange(clamp(Number(e.target.value)))}
        className={cn('flex-1 h-1 rounded appearance-none accent-emerald-500', dark ? 'bg-slate-700' : 'bg-slate-200')}
      />
      <div className="relative shrink-0">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          // 空串先不写配置，避免把 NaN 落进去；失焦时若仍是空则回填边界内的合法值。
          onChange={e => {
            if (e.target.value.trim() === '') return;
            commit(e.target.value);
          }}
          onBlur={e => {
            if (e.target.value.trim() === '') onChange(clamp(value));
          }}
          className={cn(
            'w-16 rounded-md border px-1.5 py-0.5 text-right text-[11px] font-mono outline-none transition focus:border-emerald-500',
            dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          )}
        />
        {unit && (
          <span className={cn('pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px]', dark ? 'text-slate-500' : 'text-slate-400')}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
