import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Field } from './Field';
import { textFaint } from './tokens';
import { alphaPercent, extractAlpha, isColorText, toOpaqueHex, withAlpha } from '../../utils/color';

interface ColorFieldProps {
  label: string;
  /** skin.toml 里的键名。 */
  fieldKey?: string;
  /** 当前配置值；空串或 undefined 表示沿用 base。 */
  value: string | undefined;
  /** 留空时基础皮肤实际生效的颜色，用于色块底与「继承」展示。 */
  inherited?: string;
  /** 认不出任何值时的兜底色，仅供色块使用。 */
  fallback: string;
  dark: boolean;
  onChange: (value: string | undefined) => void;
  hint?: string;
}

/**
 * 颜色字段。旧版只有一个原生色块加一个要用户自己写 rgba 的文本框：
 * 调透明度得记住 rgba 语法，看不到留空时实际长什么样。
 * 这块把三件事都做进来：色块选色、十六进制输入、透明度滑杆，并直接显示继承值。
 */
export const ColorField: React.FC<ColorFieldProps> = ({
  label,
  fieldKey,
  value,
  inherited,
  fallback,
  dark,
  onChange,
  hint
}) => {
  // 原生 <input type="color"> 只认 #rrggbb，而配置里可能是 #rrggbbaa 或 rgba()。
  // React 会把非法值写进节点、浏览器再刷一屏格式告警，所以色块与文本框分开存草稿。
  const [draft, setDraft] = useState<string | null>(null);
  const [draftSwatch, setDraftSwatch] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // 文本框的输入草稿。键入只更新它，回车或失焦才写配置：拼十六进制时每敲一位都会产生一串
  // 合法中间值，直接提交会让候选窗反复跳色。
  const [typing, setTyping] = useState<string | null>(null);

  const configured = value ?? '';
  const shown = draft ?? configured;
  const isInherited = configured === '';
  // 实际生效色只认「解析得出的颜色」：手输一半的 #ff 留在 shown 里显示红框，但不能拿去算
  // 色块与透明度，否则滑杆会跳回 100%。
  const effective = isInherited ? inherited || fallback : isColorText(shown) ? shown : configured || fallback;

  const alpha = extractAlpha(effective);
  const swatch = draftSwatch ?? toOpaqueHex(effective, fallback);
  const invalid = !isInherited && !isColorText(shown);

  const previewStyle = { backgroundColor: isColorText(effective) ? effective : fallback };

  const commit = (next: string | undefined) => {
    setDraft(next ?? null);
    // 半成品（如输入到一半的 `#ff`）只留在草稿里显示红框提示，
    // 不写进配置，避免边打字边刷出一屏校验错误。
    if (next === undefined || next.trim() === '') {
      onChange(undefined);
      return;
    }
    if (isColorText(next)) onChange(next);
  };

  const pickRgb = (hex: string) => {
    // 色块与文本框共用一份显示：改了色块就丢掉文本草稿，否则输入框还挂着旧的非法文本。
    setTyping(null);
    setDraftSwatch(hex);
    // 色块只给 #rrggbb，这里把原透明度补回去，改色不该顺手抹掉透明度。
    const next = alpha < 1 ? withAlpha(hex, alpha) : hex;
    setDraft(next);
    onChange(next);
  };

  const setAlpha = (next: number) => {
    // 基于当前生效色改透明度；留空时就以继承值为基色，第一次拖滑杆也能得到合理结果。
    const source = isColorText(effective) ? effective : fallback;
    const composed = withAlpha(source, next, fallback);
    setTyping(null);
    setDraftSwatch(toOpaqueHex(composed, fallback));
    setDraft(composed);
    onChange(composed);
  };

  return (
    <Field
      label={label}
      fieldKey={fieldKey}
      inherited={isInherited}
      onReset={isInherited ? undefined : () => commit(undefined)}
      error={invalid ? '不是有效颜色，导出会被拦下' : undefined}
      dark={dark}
      hint={hint}
    >
      <div className="flex items-center gap-2">
        <label
          className={cn(
            'relative w-7 h-7 shrink-0 rounded-md border cursor-pointer overflow-hidden',
            dark ? 'border-slate-600' : 'border-slate-300'
          )}
          title="点开调 RGB，透明度用右边的滑杆"
        >
          {/* 棋盘底，透出颜色自身的 alpha */}
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #8883 25%, transparent 25%), linear-gradient(-45deg, #8883 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #8883 75%), linear-gradient(-45deg, transparent 75%, #8883 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
            }}
          />
          <span className={cn('absolute inset-0', isInherited && 'opacity-60')} style={previewStyle} />
          <input
            type="color"
            value={swatch}
            onChange={e => pickRgb(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <input
          type="text"
          value={typing ?? shown}
          placeholder={inherited ? `继承 ${inherited}` : '留空沿用 base'}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (typing !== null) commit(typing);
            setTyping(null);
            // 非法输入留在草稿里显示红框，但 effective 已经不再采信它，透明度不会被带偏。
            if (typing !== null && typing.trim() !== '' && !isColorText(typing)) setDraft(typing);
          }}
          onChange={e => {
            setTyping(e.target.value);
            // 输入即预览：合法值同步给色块与透明度滑杆，配置仍等提交时才写。
            if (isColorText(e.target.value) || e.target.value.trim() === '') setDraft(e.target.value || null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (typing !== null) commit(typing);
              setTyping(null);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setTyping(null);
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            'flex-1 min-w-0 rounded-md border px-2 py-1 text-[11px] font-mono outline-none transition focus:border-emerald-500',
            (typing !== null && typing.trim() !== '' && !isColorText(typing)) && 'border-rose-500',
            dark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
          )}
        />
      </div>

      {/* 透明度滑杆：只在色值可解析时才有意义 */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className={cn('text-[10px] shrink-0', textFaint(dark))}>透明度</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(alpha * 100)}
          onChange={e => setAlpha(Number(e.target.value) / 100)}
          className={cn('flex-1 h-1 rounded appearance-none accent-emerald-500', dark ? 'bg-slate-700' : 'bg-slate-200')}
        />
        <span className={cn('w-8 shrink-0 text-right text-[10px] font-mono', textFaint(dark))}>{alphaPercent(alpha)}</span>
      </div>

      {!focused && isInherited && inherited && (
        <button
          type="button"
          onClick={() => {
            setDraft(inherited);
            onChange(inherited);
          }}
          className="text-[10px] text-emerald-500 hover:text-emerald-400 underline"
        >
          以继承值 {inherited} 为起点修改
        </button>
      )}
    </Field>
  );
};
