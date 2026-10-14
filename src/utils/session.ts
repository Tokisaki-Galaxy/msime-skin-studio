import { LayoutMode, SkinV2Config, ThemeName } from '../types/skin';
import { validateSkinConfig } from './toml';
import type { PreviewBackend } from '../components/CandidatePreview';

// 工坊的会话状态：编辑中的皮肤文档加预览上下文。刷新或误关标签不该丢掉这些。
// assets 里的位图不进这里（objectURL 会失效，File 无法序列化），由导出/导入负责。

const STORAGE_KEY = 'msime-skin-studio.session.v1';

export interface StudioSession {
  config: SkinV2Config;
  layoutMode: LayoutMode;
  previewTheme: ThemeName;
  previewBackend: PreviewBackend;
  samplePinyin: string;
  sampleCandidates: string[];
  sampleTranslations: string[];
  samplePos: string[];
  selectedIndex: number;
}

export interface RestoredSession {
  session: StudioSession;
  /** 恢复时的校验问题，用于提示「上次退出时这份配置并不合法」。 */
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/** 只接受结构上说得通的会话，避免旧版本或手改坏的 JSON 让页面白屏。 */
function parseSession(raw: unknown): StudioSession | null {
  if (!isRecord(raw)) return null;
  const config = raw.config;
  if (!isRecord(config) || !isRecord(config.meta) || !isRecord(config.candidate_window)) return null;
  const meta = config.meta as Record<string, unknown>;
  if (typeof meta.id !== 'string' || typeof meta.base !== 'string') return null;

  const strings = (value: unknown, fallback: string[]): string[] =>
    Array.isArray(value) && value.every(v => typeof v === 'string') ? (value as string[]) : fallback;

  return {
    config: config as unknown as SkinV2Config,
    layoutMode: raw.layoutMode === 'vertical' ? 'vertical' : 'horizontal',
    previewTheme: raw.previewTheme === 'light' ? 'light' : 'dark',
    previewBackend: raw.previewBackend === 'd2d' ? 'd2d' : 'webview2',
    samplePinyin: typeof raw.samplePinyin === 'string' ? raw.samplePinyin : '',
    sampleCandidates: strings(raw.sampleCandidates, []),
    sampleTranslations: strings(raw.sampleTranslations, []),
    samplePos: strings(raw.samplePos, []),
    selectedIndex: typeof raw.selectedIndex === 'number' && Number.isFinite(raw.selectedIndex) ? raw.selectedIndex : 0
  };
}

export function saveSession(session: StudioSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 配额满或隐私模式：持久化是便利功能，失败不影响继续编辑。
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上。
  }
}

export function loadSession(): RestoredSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const session = parseSession(parsed);
  if (!session) return null;
  return {
    session,
    issues: validateSkinConfig(session.config).map(issue => `${issue.field}：${issue.message}`)
  };
}
