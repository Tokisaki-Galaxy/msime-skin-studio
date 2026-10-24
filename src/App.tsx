import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { CandidatePreview } from './components/CandidatePreview';
import { AssetManager } from './components/AssetManager';
import { ConfigPanel } from './components/ConfigPanel';
import { SliceModal } from './components/SliceModal';
import { SampleDataEditor } from './components/SampleDataEditor';

import { Insets, LayoutMode, SkinAsset, SkinV2Config, ThemeName } from './types/skin';
import { SKIN_TEMPLATES, SkinTemplate } from './constants/templates';
import { processSsfArchive } from './utils/ssf';
import { exportSkinPackage, downloadBlob } from './utils/exporter';
import { validateSkinConfig } from './utils/toml';
import { clearSession, loadSession, saveSession } from './utils/session';
import { importSkinFiles, importSkinToml, importSkinZip, referencedImages, ImportedSkin } from './utils/importer';

/** 给导出结果条用：175.6 KB 这种写法比一串字节数好懂。 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const DEFAULT_SLICE = (w: number, h: number) =>
  Math.max(1, Math.min(64, Math.round(Math.min(w || 32, h || 32) * 0.2)));

// 三栏宽度可拖拽调节。左右各留最小值，中间至少留 320px。
const MIN_SIDE = 200;
const MIN_CENTER = 320;
const MAX_SIDE = 640;
const DEFAULT_LEFT = 320;
const DEFAULT_RIGHT = 340;

/** 把左右栏收进「中间至少留 MIN_CENTER」的预算里，返回钳制后的左右宽度。 */
function clampSideWidths(left: number, right: number, total: number): { left: number; right: number } {
  if (total <= 0) return { left, right };
  // 两侧都压到最小值后仍放不下中间栏时，优先保中间栏，两侧按比例退让。
  const budget = Math.max(0, total - MIN_CENTER);
  if (budget < MIN_SIDE * 2) {
    const scale = budget / (MIN_SIDE * 2);
    const floor = Math.max(0, Math.floor(MIN_SIDE * scale));
    return { left: Math.min(left, floor), right: Math.min(right, floor) };
  }
  let l = Math.max(MIN_SIDE, Math.min(MAX_SIDE, left));
  let r = Math.max(MIN_SIDE, Math.min(MAX_SIDE, right));
  // 先削右侧，不够再削左侧，始终不动中间栏。
  const overflow = l + r - budget;
  if (overflow > 0) {
    const fromRight = Math.min(overflow, r - MIN_SIDE);
    r -= fromRight;
    const rest = overflow - fromRight;
    if (rest > 0) l = Math.max(MIN_SIDE, l - rest);
  }
  return { left: l, right: r };
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<SkinV2Config>(SKIN_TEMPLATES[0].config);
  const [assets, setAssets] = useState<Map<string, SkinAsset>>(new Map());

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('horizontal');
  const [previewTheme, setPreviewTheme] = useState<ThemeName>('dark');
  const [samplePinyin, setSamplePinyin] = useState("shui'shan'shu'ru'fa");
  const [sampleCandidates, setSampleCandidates] = useState(['水杉输入法', '水杉', '水扇', '税收', '随身']);
  const [sampleTranslations, setSampleTranslations] = useState<string[]>(['metasequoia', '', '', '', '']);
  const [samplePos, setSamplePos] = useState<string[]>(['n.', '', '', '', '']);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedDecorationIndex, setSelectedDecorationIndex] = useState<number | null>(null);
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // 会话恢复或导入后的提示，展示一次即可。
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  // 导出结果。包含文件名、体积与安装指引，关掉之前一直留在页面上。
  const [exportResult, setExportResult] = useState<{ filename: string; size: number; skinId: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // 三栏宽度与拖拽状态
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const [draggingSide, setDraggingSide] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 拖拽回调里要读最新的左右宽度，用 ref 同步，避免把宽度塞进 effect 依赖导致每帧重装监听。
  const widthsRef = useRef({ left: DEFAULT_LEFT, right: DEFAULT_RIGHT });
  widthsRef.current = { left: leftWidth, right: rightWidth };

  // 窗口自身缩放时也要守住中间栏。拖拽只覆盖了「用户改宽度」这一条路径，
  // flex 会无条件压 flex-1 那一栏，所以这里补一条 resize 兜底。
  useEffect(() => {
    const sync = () => {
      const total = bodyRef.current?.clientWidth ?? window.innerWidth;
      const clamped = clampSideWidths(widthsRef.current.left, widthsRef.current.right, total);
      if (clamped.left !== widthsRef.current.left) setLeftWidth(clamped.left);
      if (clamped.right !== widthsRef.current.right) setRightWidth(clamped.right);
    };
    sync();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', sync);
      return () => window.removeEventListener('resize', sync);
    }
    const observer = new ResizeObserver(sync);
    if (bodyRef.current) observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!draggingSide) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      const total = bodyRef.current?.clientWidth ?? window.innerWidth;
      const other = drag.side === 'left' ? widthsRef.current.right : widthsRef.current.left;
      const budget = Math.max(MIN_SIDE, total - other - MIN_CENTER);
      const maxWidth = Math.min(MAX_SIDE, budget);
      const raw = drag.side === 'left' ? drag.startWidth + delta : drag.startWidth - delta;
      const next = Math.max(MIN_SIDE, Math.min(maxWidth, raw));
      if (drag.side === 'left') setLeftWidth(next);
      else setRightWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      setDraggingSide(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // 只依赖 draggingSide：左右宽度走 widthsRef 读最新值，否则每帧 setWidth 都会重装监听。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingSide]);

  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { side, startX: e.clientX, startWidth: side === 'left' ? leftWidth : rightWidth };
    setDraggingSide(side);
  };

  const resetWidths = () => {
    setLeftWidth(DEFAULT_LEFT);
    setRightWidth(DEFAULT_RIGHT);
  };

  // 启动时恢复上次的会话；没有存档才落到第一个模板。
  // 恢复要等首次渲染之后再做一次：StrictMode 会把挂载期的 effect 跑两遍，若恢复与保存
  // 在同一次挂载里竞争，第二次恢复会读到被初始状态覆盖的存档、刷新后回到默认值。
  const [hydrated, setHydrated] = useState(false);
  // 这一轮是否真的写过存档。pristine 时只有写过才需要清，避免每次渲染都 removeItem。
  const wroteSessionRef = useRef(false);
  // 当前配置的来源，用于在界面上明确「你在编辑什么」。导入与选模板时更新。
  const [origin, setOrigin] = useState<string>('内置模板');
  useEffect(() => {
    const restored = loadSession();
    if (restored) {
      const s = restored.session;
      setConfig(s.config);
      setLayoutMode(s.layoutMode);
      setPreviewTheme(s.previewTheme);
      setSamplePinyin(s.samplePinyin);
      setSampleCandidates(s.sampleCandidates.length ? s.sampleCandidates : ['水杉输入法']);
      setSampleTranslations(s.sampleTranslations);
      setSamplePos(s.samplePos);
      setSelectedIndex(s.selectedIndex);
      setOrigin(s.origin || '上次编辑');

      // 素材是 object URL，跨会话必然失效。引用非空时要说清「图丢了」，
      // 而不是丢一句「已恢复」，让用户对着空素材库和报错自己猜。
      const lostRefs = referencedImages(s.config).length;
      // 注意：这里不把引用的图片当成「已丢失」来渲染，只影响提示文案。
      if (restored.issues.length > 0) {
        setRestoredNotice(
          `已恢复上次的配置，但有 ${restored.issues.length} 处不合法，导出会被拦下。` +
            (lostRefs > 0 ? `另外 ${lostRefs} 张图片不会跨刷新保存，需要重新导入。` : '')
        );
      } else if (lostRefs > 0) {
        setRestoredNotice(
          `已恢复上次的排版，但 ${lostRefs} 张图片不会跨刷新保存。重新导入同一份皮肤（ZIP 或 .ssf）即可找回。`
        );
      } else {
        setRestoredNotice(null);
      }
    } else {
      loadTemplate(SKIN_TEMPLATES[0]);
      setOrigin('内置模板');
    }
    setHydrated(true);
  }, []);

  // 会话自动落盘。assets 不进存档，位图靠导出/导入流转。
  // hydrated 为 false 时这一轮是初始状态，不能覆盖存档。
  // 配置与默认模板完全一致且没有任何素材时压根不落盘：否则第一次来访看一眼就走，
  // 下次进来会被判成「有未导出的编辑」，弹出误导性的恢复提示。
  useEffect(() => {
    if (!hydrated) return;
    // 只看 config 与模板是否一致还不够：只切了横竖排或预览主题的用户，改动同样值得留。
    // 这里把「默认模板 + 默认预览设置」整体当作 pristine，其余一律落盘。
    const pristine =
      assets.size === 0 &&
      JSON.stringify(config) === JSON.stringify(SKIN_TEMPLATES[0].config) &&
      layoutMode === 'horizontal' &&
      previewTheme === 'dark' &&
      !origin.startsWith('搜狗皮肤') &&
      !origin.startsWith('模板「');
    if (pristine) {
      // 改回默认模板后旧存档要清掉，否则下次进来还会读到它、继续弹「已恢复」。
      // 只在确实写过存档时清一次：否则每次渲染都会调 removeItem。
      if (wroteSessionRef.current) {
        clearSession();
        wroteSessionRef.current = false;
      }
      return;
    }
    wroteSessionRef.current = true;
    saveSession({
      config,
      layoutMode,
      previewTheme,
      samplePinyin,
      sampleCandidates,
      sampleTranslations,
      samplePos,
      selectedIndex,
      origin
    });
  }, [config, layoutMode, previewTheme, samplePinyin, sampleCandidates, sampleTranslations, samplePos, selectedIndex, origin, assets, hydrated]);

  // 实时校验：导出按钮据此禁用，面板顶部列出问题，不再等到点导出才 alert。
  const validationIssues = useMemo(() => validateSkinConfig(config).map(i => `${i.field}：${i.message}`), [config]);
  // 模板内置的占位图是 SVG data URL。导出时会被原样写成 .png，水杉用 WIC 解码打不开，
  // 用户却会拿到一个「导出成功」的坏皮肤。这里当成阻断项报出来。
  const placeholderAssets = useMemo(() => {
    const refs = referencedImages(config);
    return refs.filter(ref => {
      const alt = ref.startsWith('assets/') ? ref.slice('assets/'.length) : `assets/${ref}`;
      const asset = assets.get(ref) ?? assets.get(alt);
      return !!asset && asset.blobUrl.startsWith('data:image/svg');
    });
  }, [config, assets]);
  const assetsMissing = useMemo(() => {
    const refs = referencedImages(config);
    return refs.filter(ref => {
      const alt = ref.startsWith('assets/') ? ref.slice('assets/'.length) : `assets/${ref}`;
      return !assets.has(ref) && !assets.has(alt);
    });
  }, [config, assets]);

  // 最近一次破坏性操作的撤销快照。素材被删后 object URL 已 revoke，撤销时先重新建一个。
  // 只保留一步：够救手滑，又不会把整份历史留在内存里。
  // createdUrl 记录撤销时新开出来的 object URL，下一次覆盖快照前要回收。
  const undoRef = useRef<{
    label: string;
    config: SkinV2Config;
    asset?: { path: string; asset: SkinAsset; file?: File };
    createdUrl?: string;
  } | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);

  /** 丢弃撤销快照，顺手撤销时新建的 object URL，避免攒下一堆没人引用的地址。 */
  const discardUndo = () => {
    const snapshot = undoRef.current;
    if (snapshot?.createdUrl && ownedUrlsRef.current.has(snapshot.createdUrl)) {
      URL.revokeObjectURL(snapshot.createdUrl);
      ownedUrlsRef.current.delete(snapshot.createdUrl);
    }
    undoRef.current = null;
    setUndoLabel(null);
  };

  const pushUndo = (
    label: string,
    configSnapshot: SkinV2Config,
    asset?: { path: string; asset: SkinAsset; file?: File }
  ) => {
    // 旧快照的撤销历史只保留一步，新的覆盖它之前先回收旧快照占着的 URL。
    discardUndo();
    undoRef.current = { label, config: configSnapshot, asset };
    setUndoLabel(label);
  };

  const handleUndo = () => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    setConfig(snapshot.config);
    if (snapshot.asset) {
      const { path, asset, file } = snapshot.asset;
      const reloaded = file ? { ...asset, blobUrl: URL.createObjectURL(file) } : asset;
      if (file) ownedUrlsRef.current.add(reloaded.blobUrl);
      setAssets(prev => new Map(prev).set(path, reloaded));
      // 撤销已经消费掉这次操作，再「撤销」没有意义，直接收起提示条。
      undoRef.current = null;
      setUndoLabel(null);
      return;
    }
    undoRef.current = null;
    setUndoLabel(null);
  };

  // 自己 createObjectURL 出来的地址要记着，替换同名素材、切模板、组件卸载三处都要释放。
  // data URL（模板内置图、SSF 解出来的图）不是 object URL，不能 revoke。
  const ownedUrlsRef = useRef<Set<string>>(new Set());
  const releaseAssets = (map: Map<string, SkinAsset>) => {
    for (const asset of map.values()) {
      if (ownedUrlsRef.current.has(asset.blobUrl)) {
        URL.revokeObjectURL(asset.blobUrl);
        ownedUrlsRef.current.delete(asset.blobUrl);
      }
    }
  };
  useEffect(() => {
    const owned = ownedUrlsRef.current;
    return () => {
      for (const url of owned) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);

  // 覆盖编辑中的内容前确认一次，避免模板/导入把手工改的东西直接冲掉。
  // 要把「被覆盖的是谁」说清楚：只说「当前编辑中的皮肤」，用户根本不知道自己改过什么。
  const confirmDiscard = (what: string): boolean => {
    const touched = JSON.stringify(config) !== JSON.stringify(SKIN_TEMPLATES[0].config) || assets.size > 0;
    if (!touched) return true;
    const name = config.meta.name || config.meta.id || '未命名';
    const assetNote = assets.size > 0 ? `，以及素材库里的 ${assets.size} 张图` : '';
    return window.confirm(`载入${what}会替换掉当前正在编辑的「${name}」${assetNote}，且不可撤销。继续吗？`);
  };

  const loadTemplate = (tpl: SkinTemplate) => {
    setConfig(tpl.config);
    const next = new Map<string, SkinAsset>();
    for (const [path, dataUrl] of Object.entries(tpl.defaultImages || {})) {
      next.set(path, { path, blobUrl: dataUrl });
    }
    setAssets(prev => {
      releaseAssets(prev);
      return next;
    });
    setSelectedDecorationIndex(null);
  };

  const handleSelectTemplate = (tpl: SkinTemplate) => {
    if (!confirmDiscard(`模板「${tpl.name}」`)) return;
    // 整份配置被替换后，上一套皮肤留下的撤销快照就失效了。不清掉的话点「撤销」
    // 会把旧配置盖回新皮肤上，预览变成两套皮肤的拼接体。
    discardUndo();
    loadTemplate(tpl);
    setOrigin(`模板「${tpl.name}」`);
    setRestoredNotice(null);
  };

  const handleAddAsset = (path: string, file: File) => {
    const blobUrl = URL.createObjectURL(file);
    ownedUrlsRef.current.add(blobUrl);
    const img = new Image();
    img.onload = () => {
      setAssets(prev => {
        // 同名素材被替换时，旧的那个 object URL 要立刻释放，否则传几次就攒几个。
        const replaced = prev.get(path);
        if (replaced && ownedUrlsRef.current.has(replaced.blobUrl)) {
          URL.revokeObjectURL(replaced.blobUrl);
          ownedUrlsRef.current.delete(replaced.blobUrl);
        }
        const next = new Map(prev);
        next.set(path, { path, blobUrl, file, width: img.naturalWidth, height: img.naturalHeight });
        return next;
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      ownedUrlsRef.current.delete(blobUrl);
    };
    img.src = blobUrl;
  };

  const handleImportSsf = async (file: File) => {
    if (!confirmDiscard('搜狗皮肤')) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = await processSsfArchive(buffer, file.name);

      const next = new Map<string, SkinAsset>();
      for (const [imgName, dataUrl] of Object.entries(result.images)) {
        next.set(`assets/${imgName}`, { path: `assets/${imgName}`, blobUrl: dataUrl });
      }

      setAssets(prev => {
        releaseAssets(prev);
        return next;
      });
      discardUndo();
      setConfig(result.skinConfig);
      setSelectedDecorationIndex(null);
      setOrigin(`搜狗皮肤 ${file.name}`);
      // 成功与「注意事项」分成两件事说：先前只有 alert，且连带成功提示一起弹，
      // 关掉之后界面上没有任何「我已经导入成功了」的痕迹。
      setRestoredNotice(
        result.warnings.length > 0
          ? `已导入「${result.skinConfig.meta.name}」。${result.warnings.length} 处已自动处理，详见下方说明。`
          : `已导入「${result.skinConfig.meta.name}」，共 ${Object.keys(result.images).length} 张图片。`
      );
      if (result.warnings.length > 0) {
        alert('导入完成，有几处需要你确认：\n\n' + result.warnings.map(w => '· ' + w).join('\n'));
      }
    } catch (err) {
      alert(`导入皮肤失败: ${(err as Error).message || err}`);
    }
  };

  /** 导入已导出的皮肤包（ZIP）或裸 skin.toml。 */
  const handleImportSkin = async (file: File) => {
    if (!confirmDiscard('导入的皮肤')) return;
    try {
      const result = file.name.toLowerCase().endsWith('.zip')
        ? await importSkinZip(file)
        : await importSkinToml(file);
      applyImported(result);
    } catch (err) {
      alert(`导入皮肤失败：${(err as Error).message || err}`);
    }
  };

  /** 选中一个皮肤目录（或同时选中 skin.toml 与图片）。 */
  const handleImportSkinFiles = async (files: File[]) => {
    if (!confirmDiscard('导入的皮肤')) return;
    try {
      applyImported(await importSkinFiles(files));
    } catch (err) {
      alert(`导入皮肤失败：${(err as Error).message || err}`);
    }
  };

  const applyImported = (result: ImportedSkin) => {
    const next = new Map<string, SkinAsset>();
    for (const [path, asset] of result.assets.entries()) {
      next.set(path, asset);
      if (asset.blobUrl.startsWith('blob:')) ownedUrlsRef.current.add(asset.blobUrl);
    }
    setAssets(prev => {
      releaseAssets(prev);
      return next;
    });
    // 用导入的配置补全模板默认值，避免缺字段让渲染报错。
    discardUndo();
    setConfig({ ...SKIN_TEMPLATES[0].config, ...result.config, meta: { ...SKIN_TEMPLATES[0].config.meta, ...result.config.meta } } as SkinV2Config);
    setSelectedDecorationIndex(null);
    setOrigin(result.sourceLabel);
    const notes: string[] = [];
    if (result.missingImages.length > 0) notes.push(`缺少图片：${result.missingImages.join('、')}，请放进素材库。`);
    notes.push(...result.warnings);
    const name = result.config.meta?.name || result.sourceLabel;
    const assetNote = result.assets.size > 0 ? `，共 ${result.assets.size} 张图片` : '';
    setRestoredNotice(
      notes.length ? `已导入「${name}」${assetNote}。${notes.join(' ')}` : `已导入「${name}」${assetNote}。`
    );
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    // 上一次的成功横幅先收掉：失败时留着它，页面上会同时出现「已导出」和一条报错。
    setExportResult(null);
    try {
      const blob = await exportSkinPackage(config, assets);
      // ZIP 里的根目录名就是 meta.id，文件名也用它，两者必须一致，否则用户按横幅
      // 去包里找「xxx/」会找不到。
      const skinId = config.meta.id || 'my_skin';
      const filename = `${skinId}.zip`;
      downloadBlob(blob, filename);
      // 下载是浏览器的行为，页面原本毫无反应，用户连点三次也不知道成没成。
      // 这里给出文件名、大小与「接下来怎么装」，闭环最后一环。
      setExportResult({ filename, size: blob.size, skinId });
      // 导出成功意味着这一轮任务走完了，先前的导入/恢复提示可以让位，避免页头叠两三条横幅。
      setRestoredNotice(null);
    } catch (err) {
      alert(`导出皮肤失败: ${(err as Error).message || err}`);
    } finally {
      setExporting(false);
    }
  };

  /** 设为九宫格面板。 */
  const handleSetPanelImage = (pathKey: string) => {
    const asset = assets.get(pathKey);
    const slice = DEFAULT_SLICE(asset?.width || 32, asset?.height || 32);
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        border_image: {
          ...(prev.candidate_window.border_image || {}),
          source: pathKey,
          slice_dip: prev.candidate_window.border_image?.slice_dip ?? [slice, slice, slice, slice],
          width_dip: prev.candidate_window.border_image?.width_dip ?? [slice, slice, slice, slice],
          fill: prev.candidate_window.border_image?.fill ?? true
        }
      }
    }));
  };

  /** 设为卡片背景图（画在底色之上、文字之下）。 */
  const handleSetBackgroundImage = (pathKey: string) => {
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        background: { image: pathKey, fit: prev.candidate_window.background?.fit || 'cover', opacity: 1 }
      }
    }));
  };

  const handleAddDecorationFromAsset = (pathKey: string) => {
    const asset = assets.get(pathKey);
    // 新下标要在 setConfig 之外算：更新函数必须是纯函数，StrictMode 下会跑两次。
    const newIndex = (config.candidate_window.decorations ?? []).length;
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        decorations: [
          ...(prev.candidate_window.decorations ?? []),
          {
            image: pathKey,
            anchor: 'bottom-left' as const,
            width_dip: asset?.width || 64,
            height_dip: asset?.height || 64,
            offset_x_dip: 0,
            offset_y_dip: 0,
            z_index: 2
          }
        ]
      }
    }));
    setSelectedDecorationIndex(newIndex);
  };

  const handleUpdateDecoration = (index: number, patch: Partial<NonNullable<SkinV2Config['candidate_window']['decorations']>[number]>) => {
    setConfig(prev => {
      const list = [...(prev.candidate_window.decorations ?? [])];
      if (!list[index]) return prev;
      list[index] = { ...list[index], ...patch };
      return { ...prev, candidate_window: { ...prev.candidate_window, decorations: list } };
    });
  };

  const handleRemoveDecoration = (index: number) => {
    const dec = (config.candidate_window.decorations ?? [])[index];
    if (dec && !window.confirm(`删除挂件 #${index}（${dec.anchor} ${dec.image}）？`)) return;
    setConfig(prev => {
      const list = (prev.candidate_window.decorations ?? []).filter((_, i) => i !== index);
      return { ...prev, candidate_window: { ...prev.candidate_window, decorations: list } };
    });
    // 删中间项时后面的下标整体前移，选中项要跟着挪，删到最后一项则清空。
    setSelectedDecorationIndex(prev => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  /** 删素材，并清掉引用它的配置字段，避免留下指向不存在文件的悬空引用。 */
  const handleRemoveAsset = (pathKey: string) => {
    const cw = config.candidate_window;
    const refs: string[] = [];
    if (cw.border_image?.source === pathKey) refs.push('九宫格面板');
    if (cw.background?.image === pathKey) refs.push('卡片背景');
    if (cw.decoration?.image === pathKey) refs.push('顶部装饰');
    if ((cw.decorations ?? []).some(d => d.image === pathKey)) refs.push('自由挂件');
    if (refs.length > 0 && !window.confirm(`${pathKey} 正被${refs.join('、')}使用，删除后会一并清掉，继续吗？`)) return;

    const removed = assets.get(pathKey);
    if (removed) pushUndo(`删除素材 ${pathKey.replace('assets/', '')}`, config, { path: pathKey, asset: removed, file: removed.file });

    setAssets(prev => {
      const next = new Map(prev);
      const asset = next.get(pathKey);
      if (asset && ownedUrlsRef.current.has(asset.blobUrl)) {
        URL.revokeObjectURL(asset.blobUrl);
        ownedUrlsRef.current.delete(asset.blobUrl);
      }
      next.delete(pathKey);
      return next;
    });
    setConfig(prev => {
      const win = prev.candidate_window;
      return {
        ...prev,
        candidate_window: {
          ...win,
          border_image: win.border_image?.source === pathKey ? undefined : win.border_image,
          background: win.background?.image === pathKey ? undefined : win.background,
          decoration: win.decoration?.image === pathKey ? undefined : win.decoration,
          decorations: (win.decorations ?? []).filter(d => d.image !== pathKey)
        }
      };
    });
  };

  /** 取消槽位但保留素材。快照在 setConfig 之外取，更新函数保持纯函数。
   *  快照里带上被引用的素材：万一它刚好在上一轮撤销后被删掉，撤销这次清除也能把图找回来。 */
  const snapshotAssetOf = (pathKey?: string) => {
    if (!pathKey) return undefined;
    const asset = assets.get(pathKey);
    return asset ? { path: pathKey, asset, file: asset.file } : undefined;
  };

  const handleClearPanel = () => {
    pushUndo('清除九宫格面板', config, snapshotAssetOf(config.candidate_window.border_image?.source));
    setConfig(prev => ({ ...prev, candidate_window: { ...prev.candidate_window, border_image: undefined } }));
  };

  const handleClearBackground = () => {
    pushUndo('清除卡片背景', config, snapshotAssetOf(config.candidate_window.background?.image));
    setConfig(prev => ({ ...prev, candidate_window: { ...prev.candidate_window, background: undefined } }));
  };

  const handleSaveSlice = (slice: number[], width: number[], outer: Insets) => {
    setConfig(prev => ({
      ...prev,
      candidate_window: {
        ...prev.candidate_window,
        border_image: {
          ...(prev.candidate_window.border_image ?? { source: '' }),
          slice_dip: slice,
          // 空数组表示「沿用 slice」，与 ConfigPanel 的写法一致；存成 [] 会被导出校验判为非法。
          width_dip: width.length > 0 ? width : undefined
        },
        outer_insets_dip: outer
      }
    }));
    setSliceModalOpen(false);
  };

  // 模板高亮只在配置与模板完全一致时出现，改过任意字段就撤掉，避免误导。
  const activeTemplateId = useMemo(
    () => SKIN_TEMPLATES.find(tpl => JSON.stringify(tpl.config) === JSON.stringify(config))?.id ?? null,
    [config]
  );

  // 极限自检的样例数据。全部只动预览样例，不碰皮肤配置。
  const CHECK_SAMPLES = {
    longPinyin: {
      pinyin: "zhe'shi'yi'ge'fei'chang'chang'de'pin'yin'chuan'ce'shi'shui'shan'shu'ru'fa'pi'fu",
      candidates: ['这是一个非常长的拼音串测试', '折十八式', '这才是', '折射', '折腾', '哲人', '鹧鸪', '浙江', '蔗糖']
    },
    manyCandidates: {
      pinyin: "shui'shan",
      candidates: ['水杉输入法皮肤', '水杉', '水扇', '税收', '随身', '水山', '睡衫', '水杉树', '水杉林']
    },
    singleCandidate: {
      pinyin: "shui",
      candidates: ['水杉']
    },
    reset: {
      pinyin: "shui'shan'shu'ru'fa",
      candidates: ['水杉输入法', '水杉', '水扇', '税收', '随身']
    }
  } as const;

  // 进自检前的主题选择，仅用于「复位」还原。声明在 applyCheck 之前，读代码不必往下找。
  const themeBeforeCheck = useRef<ThemeName | null>(null);

  const applyCheck = (kind: keyof typeof CHECK_SAMPLES) => () => {
    const sample = CHECK_SAMPLES[kind];
    setSamplePinyin(sample.pinyin);
    const n = sample.candidates.length;
    setSampleCandidates([...sample.candidates]);
    // 翻译与词性按候选数补齐，避免长度对不上时渲染出空行。
    setSampleTranslations(Array.from({ length: n }, (_, i) => (i === 0 ? 'metasequoia' : '')));
    setSamplePos(Array.from({ length: n }, (_, i) => (i === 0 ? 'n.' : '')));
    setSelectedIndex(0);
    // 复位时把自检临时借走的主题还回去。
    if (kind === 'reset' && themeBeforeCheck.current !== null) {
      setPreviewTheme(themeBeforeCheck.current);
      themeBeforeCheck.current = null;
    }
  };

  const checkBtnCls = `shrink-0 px-2 py-0.5 rounded border transition ${
    isDarkMode
      ? 'border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
      : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

  const panelPath = config.candidate_window.border_image?.source;
  const panelAsset = panelPath ? assets.get(panelPath) : undefined;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Header
        skinName={config.meta.name}
        activeTemplateId={activeTemplateId}
        layoutMode={layoutMode}
        onChangeLayoutMode={setLayoutMode}
        onSelectTemplate={handleSelectTemplate}
        onImportSsf={handleImportSsf}
        onImportSkin={handleImportSkin}
        onImportSkinFiles={handleImportSkinFiles}
        onExport={handleExport}
        exportDisabled={validationIssues.length > 0 || assetsMissing.length > 0 || placeholderAssets.length > 0}
        exporting={exporting}
        origin={origin}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
      />

      {restoredNotice && (
        <div
          className={`px-4 py-1.5 text-xs flex items-start justify-between gap-3 border-b ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{restoredNotice}</span>
          <button onClick={() => setRestoredNotice(null)} className="shrink-0 underline opacity-70 hover:opacity-100">
            知道了
          </button>
        </div>
      )}

      {exportResult && (
        <div
          className={`px-4 py-2 text-xs border-b flex items-start justify-between gap-3 ${
            isDarkMode ? 'bg-emerald-950/50 border-emerald-800 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="min-w-0">
            <div className="font-medium">
              已导出 {exportResult.filename}（{formatBytes(exportResult.size)}），请在浏览器的下载列表里找它。
            </div>
            <div className="mt-1 leading-relaxed opacity-85">
              装进水杉：解压这个 ZIP，得到 <code className="font-mono">{exportResult.skinId}/</code> 目录，
              整个放进水杉的皮肤目录，再到输入法设置里切换到这个皮肤即可。
            </div>
          </div>
          <button onClick={() => setExportResult(null)} className="shrink-0 underline opacity-70 hover:opacity-100">
            知道了
          </button>
        </div>
      )}

      {undoLabel && (
        <div
          className={`px-4 py-1.5 text-xs flex items-center justify-between gap-3 border-b ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <span>已{undoLabel}</span>
          <span className="flex items-center gap-3 shrink-0">
            <button onClick={handleUndo} className="font-medium underline hover:text-sky-600">
              撤销
            </button>
            <button onClick={discardUndo} className="underline opacity-70 hover:opacity-100">
              关闭
            </button>
          </span>
        </div>
      )}

      <div ref={bodyRef} className={`flex-1 flex overflow-hidden ${draggingSide ? 'select-none' : ''}`}>
        <div style={{ width: leftWidth }} className="shrink-0 flex h-full min-w-0">
          <AssetManager
            config={config}
            assets={assets}
            onAddAsset={handleAddAsset}
            onRemoveAsset={handleRemoveAsset}
            onSetPanelImage={handleSetPanelImage}
            onSetBackgroundImage={handleSetBackgroundImage}
            onClearPanel={handleClearPanel}
            onClearBackground={handleClearBackground}
            onAddDecorationFromAsset={handleAddDecorationFromAsset}
            onOpenSliceModal={() => setSliceModalOpen(true)}
            isDarkMode={isDarkMode}
          />
        </div>

        <Splitter
          isDarkMode={isDarkMode}
          dragging={draggingSide === 'left'}
          label="素材库与预览之间的分隔条"
          width={leftWidth}
          onMouseDown={startDrag('left')}
          onNudge={delta => setLeftWidth(prev => clampSideWidths(prev + delta, rightWidth, bodyRef.current?.clientWidth ?? window.innerWidth).left)}
        />

        <main className={`flex-1 flex flex-col relative overflow-hidden min-w-0 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <div className={`h-10 border-b px-4 flex items-center justify-between gap-4 text-xs select-none whitespace-nowrap overflow-hidden ${isDarkMode ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}>
            <div className="flex items-center gap-2 shrink-0">
              <span>候选框主题:</span>
              <button
                onClick={() => setPreviewTheme('dark')}
                className={`px-2 py-0.5 rounded transition ${previewTheme === 'dark' ? 'bg-emerald-600 text-white font-medium' : ''}`}
              >
                深色
              </button>
              <button
                onClick={() => setPreviewTheme('light')}
                className={`px-2 py-0.5 rounded transition ${previewTheme === 'light' ? 'bg-emerald-600 text-white font-medium' : ''}`}
              >
                浅色
              </button>
              <span className="ml-3 text-slate-500">基础皮肤: {config.meta.base}</span>
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={sampleTranslations.some(t => !!t)}
                  onChange={e => {
                    const n = Math.max(1, sampleCandidates.length);
                    if (e.target.checked) {
                      const tr = Array.from({ length: n }, (_, i) => (i === 0 ? 'metasequoia' : ''));
                      const ps = Array.from({ length: n }, (_, i) => (i === 0 ? 'n.' : ''));
                      setSampleTranslations(tr);
                      setSamplePos(ps);
                    } else {
                      setSampleTranslations(Array.from({ length: n }, () => ''));
                      setSamplePos(Array.from({ length: n }, () => ''));
                    }
                  }}
                />
                候选词翻译
              </label>
              <span className="shrink-0">测试拼音:</span>
              <input
                type="text"
                value={samplePinyin}
                onChange={e => setSamplePinyin(e.target.value)}
                className={`px-2 py-0.5 rounded border text-xs focus:outline-none focus:border-emerald-500 w-44 min-w-0 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
              />
            </div>
          </div>

          {/* 极限自检。输入法皮肤最容易坏在「用默认样例看着挺好、真实长句子/满候选就崩」，
              手心与搜狗都有同类检错模式。这里用一键按钮把样例推到边界，缺陷直接可见。 */}
          <div className={`h-8 border-b px-4 flex items-center gap-2 text-[11px] whitespace-nowrap overflow-x-auto select-none ${isDarkMode ? 'border-slate-800 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
            <span className="shrink-0">自检:</span>
            <button
              onClick={applyCheck('longPinyin')}
              title="超长拼音串：检查预编辑区换行与卡片撑宽"
              className={checkBtnCls}
            >
              长拼音
            </button>
            <button
              onClick={applyCheck('manyCandidates')}
              title="塞满 9 个候选：检查候选区高度与翻页箭头位置"
              className={checkBtnCls}
            >
              满候选
            </button>
            <button
              onClick={applyCheck('singleCandidate')}
              title="只剩 1 个候选：检查最小尺寸下九宫格是否变形"
              className={checkBtnCls}
            >
              单候选
            </button>
            {/* 自检只切临时视图，不改写会话里记住的主题偏好：进自检前的选择存在 ref 里，
                点「复位」时还原。否则用户点一下自检，下次打开页面主题就悄悄变了。 */}
            <button
              onClick={() => {
                if (themeBeforeCheck.current === null) themeBeforeCheck.current = previewTheme;
                setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark');
              }}
              title="临时切到另一套配色，检查两边是否都可读；点「复位」还原"
              className={checkBtnCls}
            >
              切换深浅色
            </button>
            <button onClick={applyCheck('reset')} title="恢复到默认示例" className={checkBtnCls}>
              复位
            </button>
          </div>

          <SampleDataEditor
            pinyin={samplePinyin}
            candidates={sampleCandidates}
            translations={sampleTranslations}
            pos={samplePos}
            selectedIndex={selectedIndex}
            isDarkMode={isDarkMode}
            onPinyin={setSamplePinyin}
            onCandidates={setSampleCandidates}
            onTranslations={setSampleTranslations}
            onPos={setSamplePos}
            onSelectedIndex={setSelectedIndex}
          />

          <div className={`flex-1 relative flex items-start justify-center p-8 overflow-auto ${isDarkMode ? 'bg-slate-950' : 'bg-slate-200'}`}>
            <CandidatePreview
              config={config}
              assets={assets}
              layoutMode={layoutMode}
              theme={previewTheme}
              samplePinyin={samplePinyin}
              sampleCandidates={sampleCandidates}
              sampleTranslations={sampleTranslations}
              samplePos={samplePos}
              selectedIndex={selectedIndex}
              onSelectCandidate={setSelectedIndex}
              onUpdateDecorationOffset={(index, offset) =>
                handleUpdateDecoration(index, { offset_x_dip: offset.x, offset_y_dip: offset.y })
              }
              selectedDecorationIndex={selectedDecorationIndex}
              onSelectDecoration={setSelectedDecorationIndex}
            />
          </div>

          {(validationIssues.length > 0 || assetsMissing.length > 0 || placeholderAssets.length > 0) && (
            <div
              className={`max-h-32 overflow-y-auto border-t px-4 py-2 text-[11px] ${
                isDarkMode ? 'border-slate-800 bg-rose-950/40 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {placeholderAssets.length > 0 && (
                <>
                  <div className="font-medium mb-0.5">还在用模板占位图（{placeholderAssets.length}）</div>
                  <p className="mb-1 opacity-90">
                    这些是模板内置的矢量占位图，导出后会写成 .png，水杉打不开。请换成真正的 PNG 再导出。
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {placeholderAssets.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </>
              )}
              {validationIssues.length > 0 && (
                <>
                  <div className="font-medium mb-0.5">导出会被水杉拒绝（{validationIssues.length}）</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {validationIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </>
              )}
              {assetsMissing.length > 0 && (
                <>
                  <div className="font-medium mt-1 mb-0.5">缺少图片（{assetsMissing.length}）</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {assetsMissing.map((p, i) => (
                      <li key={i}>{p} — 请放进素材库</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className={`h-7 border-t px-4 flex items-center justify-between text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-500 bg-slate-900/60' : 'border-slate-200 text-slate-500 bg-white'}`}>
            <span className="truncate">拖拽挂件即可微调 offset，正数向右向下；改动自动保存到本地</span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="whitespace-nowrap">渲染对齐 candwnd 页面</span>
              <button onClick={resetWidths} className="underline hover:text-emerald-500">
                重置栏宽
              </button>
            </span>
          </div>
        </main>

        <Splitter
          isDarkMode={isDarkMode}
          dragging={draggingSide === 'right'}
          label="预览与属性面板之间的分隔条"
          width={rightWidth}
          onMouseDown={startDrag('right')}
          onNudge={delta => setRightWidth(prev => clampSideWidths(leftWidth, prev - delta, bodyRef.current?.clientWidth ?? window.innerWidth).right)}
        />

        <div style={{ width: rightWidth }} className="shrink-0 flex h-full min-w-0">
          <ConfigPanel
            config={config}
            onChange={setConfig}
            selectedDecorationIndex={selectedDecorationIndex}
            onSelectDecoration={setSelectedDecorationIndex}
            onRemoveDecoration={handleRemoveDecoration}
            onUpdateDecoration={handleUpdateDecoration}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {sliceModalOpen && panelAsset && (
        <SliceModal
          imageSrc={panelAsset.blobUrl}
          imageTitle={panelPath || '面板'}
          slice={config.candidate_window.border_image?.slice_dip || [16, 16, 16, 16]}
          width={config.candidate_window.border_image?.width_dip ?? []}
          outer={config.candidate_window.outer_insets_dip || { top: 0, right: 0, bottom: 0, left: 0 }}
          onSave={handleSaveSlice}
          onClose={() => setSliceModalOpen(false)}
        />
      )}
    </div>
  );
};

/** 三栏之间的拖拽条。宽度固定 5px，命中区域够大又不抢视觉；聚焦后可用左右方向键微调。 */
const Splitter: React.FC<{
  isDarkMode: boolean;
  dragging: boolean;
  label: string;
  /** 当前栏宽，供 aria-valuenow 读出，屏幕阅读器才知道方向键改到了多少。 */
  width: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onNudge: (delta: number) => void;
}> = ({ isDarkMode, dragging, label, width, onMouseDown, onNudge }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    aria-valuenow={Math.round(width)}
    aria-valuemin={MIN_SIDE}
    aria-valuemax={MAX_SIDE}
    tabIndex={0}
    title="拖动调整栏宽，聚焦后用方向键微调"
    onMouseDown={onMouseDown}
    onKeyDown={e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNudge(-16);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNudge(16);
      }
    }}
    className={`w-[5px] shrink-0 cursor-col-resize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
      dragging
        ? 'bg-emerald-500'
        : isDarkMode
        ? 'bg-slate-800 hover:bg-emerald-600'
        : 'bg-slate-200 hover:bg-emerald-500'
    }`}
  />
);
