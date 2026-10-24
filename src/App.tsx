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
import { loadSession, saveSession } from './utils/session';
import { importSkinFiles, importSkinToml, importSkinZip, referencedImages, ImportedSkin } from './utils/importer';

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
      setRestoredNotice(
        restored.issues.length > 0
          ? `已恢复上次的编辑，但这份配置有 ${restored.issues.length} 处不合法，导出会被拦下。`
          : '已恢复上次未导出的编辑。'
      );
    } else {
      loadTemplate(SKIN_TEMPLATES[0]);
    }
    setHydrated(true);
  }, []);

  // 会话自动落盘。assets 不进存档，位图靠导出/导入流转。
  // hydrated 为 false 时这一轮是初始状态，不能覆盖存档。
  useEffect(() => {
    if (!hydrated) return;
    saveSession({
      config,
      layoutMode,
      previewTheme,
      samplePinyin,
      sampleCandidates,
      sampleTranslations,
      samplePos,
      selectedIndex
    });
  }, [config, layoutMode, previewTheme, samplePinyin, sampleCandidates, sampleTranslations, samplePos, selectedIndex]);

  // 实时校验：导出按钮据此禁用，面板顶部列出问题，不再等到点导出才 alert。
  const validationIssues = useMemo(() => validateSkinConfig(config).map(i => `${i.field}：${i.message}`), [config]);
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
  const confirmDiscard = (what: string): boolean => {
    const touched = JSON.stringify(config) !== JSON.stringify(SKIN_TEMPLATES[0].config) || assets.size > 0;
    if (!touched) return true;
    return window.confirm(`载入${what}会覆盖当前编辑中的皮肤，继续吗？`);
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
    loadTemplate(tpl);
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
      setConfig(result.skinConfig);
      setSelectedDecorationIndex(null);
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
    setConfig({ ...SKIN_TEMPLATES[0].config, ...result.config, meta: { ...SKIN_TEMPLATES[0].config.meta, ...result.config.meta } } as SkinV2Config);
    setSelectedDecorationIndex(null);
    const notes: string[] = [];
    if (result.missingImages.length > 0) notes.push(`缺少图片：${result.missingImages.join('、')}，请放进素材库。`);
    notes.push(...result.warnings);
    setRestoredNotice(notes.length ? `已导入 ${result.sourceLabel}。${notes.join(' ')}` : `已导入 ${result.sourceLabel}。`);
  };

  const handleExport = async () => {
    try {
      const blob = await exportSkinPackage(config, assets);
      const safeName = (config.meta.id || 'my_skin').replace(/[^a-z0-9._-]/gi, '_');
      downloadBlob(blob, `${safeName}.zip`);
    } catch (err) {
      alert(`导出皮肤失败: ${(err as Error).message || err}`);
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
        exportDisabled={validationIssues.length > 0}
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

          {(validationIssues.length > 0 || assetsMissing.length > 0) && (
            <div
              className={`max-h-32 overflow-y-auto border-t px-4 py-2 text-[11px] ${
                isDarkMode ? 'border-slate-800 bg-rose-950/40 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
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
