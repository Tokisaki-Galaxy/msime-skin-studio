import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { divider, textMuted } from './tokens';

interface SectionProps {
  title: string;
  /** 标题右侧的小徽标，例如字段数量或当前取值。 */
  badge?: React.ReactNode;
  /** 标题右侧的操作区，例如「全部还原」。 */
  action?: React.ReactNode;
  /** 一句话说明这组字段干什么用的。 */
  description?: string;
  dark: boolean;
  /** 默认是否展开。配色这种长列表默认收起，几何这种高频项默认展开。 */
  defaultOpen?: boolean;
  /** 受控展开时传入，否则组件自己管。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** panel 是右侧面板的一级分组，nested 嵌在分组内、样式更轻。 */
  variant?: 'panel' | 'nested';
  children: React.ReactNode;
}

/**
 * 可折叠的字段分组。以前所有分组平铺在一个滚动条里，几十个输入框连成一片，
 * 找一项要滚很久。折叠后每组一行标题，扫一眼就知道有哪些能力。
 */
export const Section: React.FC<SectionProps> = ({
  title,
  badge,
  action,
  description,
  dark,
  defaultOpen = true,
  open,
  onOpenChange,
  variant = 'panel',
  children
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const nested = variant === 'nested';

  return (
    <section className={cn(nested ? 'rounded-lg border' : 'border-b', divider(dark), nested && (dark ? 'bg-slate-800/30' : 'bg-slate-50/70'))}>
      <div className={cn('w-full flex items-center gap-2', nested ? 'px-2.5 py-1.5' : 'px-4 py-2.5')}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex flex-1 min-w-0 items-center gap-2 text-left"
        >
          <ChevronDown
            size={nested ? 12 : 14}
            className={cn('shrink-0 transition-transform', isOpen ? '' : '-rotate-90', textMuted(dark))}
          />
          <span className={cn(nested ? 'text-[11px] font-medium' : 'text-xs font-semibold tracking-wide', dark ? 'text-slate-200' : 'text-slate-700')}>
            {title}
          </span>
          {badge != null && <span className="ml-auto shrink-0">{badge}</span>}
        </button>
        {action && <span className="shrink-0">{action}</span>}
      </div>
      {isOpen && (
        <div className={cn(nested ? 'px-2.5 pb-2.5 space-y-3' : 'px-4 pb-4 space-y-3')}>
          {description && <p className={cn('text-[11px] leading-relaxed', textMuted(dark))}>{description}</p>}
          {children}
        </div>
      )}
    </section>
  );
};
