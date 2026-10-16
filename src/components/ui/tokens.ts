// 右侧面板的样式令牌。以前同一个深色/浅色三元表达式在几百行里抄了十几遍，
// 改一处颜色要满文件找。这里集中成几组函数，组件按语义取用。

/** 次要说明文字。 */
export const textMuted = (dark: boolean) => (dark ? 'text-slate-400' : 'text-slate-500');

/** 更淡的辅助文字。 */
export const textFaint = (dark: boolean) => (dark ? 'text-slate-500' : 'text-slate-400');

/** 分组之间的分隔线。 */
export const divider = (dark: boolean) => (dark ? 'border-slate-800' : 'border-slate-200');

/** 小徽标：显示「已改几项」这类状态。 */
export const chipBase = (dark: boolean) =>
  `inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
    dark ? 'bg-slate-700/70 text-slate-300' : 'bg-slate-200 text-slate-600'
  }`;
