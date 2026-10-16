import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind 类名。clsx 负责条件拼接，twMerge 负责去掉冲突项，
 * 这样调用方在后面覆写宽高/间距时不用再操心顺序。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
