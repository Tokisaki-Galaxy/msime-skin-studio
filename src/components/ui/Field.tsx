import React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../utils/cn';
import { textFaint, textMuted } from './tokens';

interface FieldProps {
  label: string;
  /** 字段在 skin.toml 里的真实键名，用等宽小字附在标签后，方便对照文档。 */
  fieldKey?: string;
  /** 当前取值来自基础皮肤时，传它的真实值，标签旁会标一个「继承」。 */
  inherited?: boolean;
  /** 恢复默认：把字段清空回落到 base。传了才出现按钮。 */
  onReset?: () => void;
  /** 标签右侧的自定义内容，例如联动开关。 */
  action?: React.ReactNode;
  /** 说明文字，放在控件下方。 */
  hint?: React.ReactNode;
  /** 校验错误，传了会标红并展示。 */
  error?: string;
  dark: boolean;
  /** 让控件独占整行还是带标签并排，默认整行。 */
  children: React.ReactNode;
}

/**
 * 字段外壳。统一处理三件事，避免每个输入框各写一套：
 * 标签 + 键名 + 「继承/已改」状态 + 重置按钮 + 错误提示。
 */
export const Field: React.FC<FieldProps> = ({
  label,
  fieldKey,
  inherited = false,
  onReset,
  action,
  hint,
  error,
  dark,
  children
}) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5">
      <label className={cn('text-[11px] font-medium', dark ? 'text-slate-300' : 'text-slate-600')}>{label}</label>
      {fieldKey && (
        <code className={cn('text-[10px] font-mono', textFaint(dark))} title={`skin.toml 字段 ${fieldKey}`}>
          {fieldKey}
        </code>
      )}
      {inherited && (
        <span
          className={cn(
            'rounded px-1 py-px text-[9px] leading-tight',
            dark ? 'bg-slate-700/70 text-slate-300' : 'bg-slate-200 text-slate-500'
          )}
          title="留空时沿用基础皮肤"
        >
          继承
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        {action}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="清空该字段，回落到基础皮肤"
            className={cn(
              'rounded p-0.5 transition',
              dark ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            )}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
    {children}
    {hint && <p className={cn('text-[10px] leading-relaxed', textMuted(dark))}>{hint}</p>}
    {error && <p className="text-[10px] text-rose-500">{error}</p>}
  </div>
);
