import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DecorationAnchor, SkinAsset, SkinV2Config, ThemeName, LayoutMode } from '../../types/skin';
import { baseSkinCss, SHARED_CANDIDATE_CSS, HORIZONTAL_PAGE_CSS } from '../../skins';
import { buildHostVars, buildSkinOverrideCss, outerInsetsOf } from '../../utils/skinCss';
import { InspectTarget, setInspectTarget, subscribeInspectTarget } from '../../utils/inspect';

interface CandidatePreviewProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  layoutMode: LayoutMode;
  theme: ThemeName;
  samplePinyin: string;
  sampleCandidates: string[];
  sampleTranslations?: string[];
  /** 词性，与 sampleTranslations 一一对应；空串表示该候选没有词性。 */
  samplePos?: string[];
  selectedIndex: number;
  onSelectCandidate: (index: number) => void;
  onUpdateDecorationOffset?: (index: number, offset: { x: number; y: number }) => void;
  selectedDecorationIndex?: number | null;
  onSelectDecoration?: (index: number | null) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const FRAME_PADDING = 28;

/**
 * 候选窗预览。真实候选窗是一份独立 HTML 文档（`ui-html/webview2/candwnd/*.html`），宿主把皮肤
 * CSS 注入它的 `<head>`。这里不再把皮肤 CSS 注进工坊自己的文档 —— 那样 `body{}` 与 `.container`
 * 会和 Tailwind 的应用样式互相污染，量到的几何也不是候选窗的。改为把「页面头部 + 真实 DOM」
 * 拼成一份文档塞进 sandbox iframe，与真实渲染同构，横排竖排、翻译、翻页箭头才都作数。
 */
export const CandidatePreview: React.FC<CandidatePreviewProps> = ({
  config,
  assets,
  layoutMode,
  theme,
  samplePinyin,
  sampleCandidates,
  sampleTranslations,
  samplePos,
  selectedIndex,
  onSelectCandidate,
  onUpdateDecorationOffset,
  selectedDecorationIndex,
  onSelectDecoration,
  hasPrevious = true,
  hasNext = true
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dragging, setDragging] = useState<{ index: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  // 挂件拖拽的位移直接换算成 offset_dip，正数向右向下，与两端语义一致。
  // 拖拽期间只更新这份 pending 偏移，松手才写 config：每次 mousemove 都写 config 会让整份
  // srcdoc 重建、localStorage 反复落盘，拖动时闪烁卡顿。
  const [previewOffset, setPreviewOffsetState] = useState<{ index: number; x: number; y: number } | null>(null);
  // 与 previewOffset 同步的 ref，供松手回调读取最新值而不必塞进 updater。
  const previewOffsetRef = useRef<{ index: number; x: number; y: number } | null>(null);
  const setPreviewOffset = (next: { index: number; x: number; y: number } | null) => {
    previewOffsetRef.current = next;
    setPreviewOffsetState(next);
  };
  const [frameSize, setFrameSize] = useState({ width: 420, height: 320 });

  const assetUrl = (path?: string) => {
    if (!path) return '';
    const direct = assets.get(path);
    if (direct?.blobUrl) return direct.blobUrl;
    const alt = path.startsWith('assets/') ? path.slice('assets/'.length) : `assets/${path}`;
    return assets.get(alt)?.blobUrl || path;
  };

  const base = config.meta.base || 'fluent';
  const decorations = config.candidate_window.decorations ?? [];
  const outer = outerInsetsOf(config);
  const pageArrows = config.candidate_window.page_arrows === true;
  const activeIndex =
    sampleCandidates.length === 0 ? -1 : Math.min(Math.max(selectedIndex, 0), sampleCandidates.length - 1);
  const preeditHidden = samplePinyin.length === 0;

  // 与宿主一致：外留白之外再留出阴影与拖动余量，卡片才不会被 iframe 边界裁掉。
  const padTop = Math.max(FRAME_PADDING, outer.top + FRAME_PADDING);
  const padRight = Math.max(FRAME_PADDING, outer.right + FRAME_PADDING);
  const padBottom = Math.max(FRAME_PADDING, outer.bottom + FRAME_PADDING);
  const padLeft = Math.max(FRAME_PADDING, outer.left + FRAME_PADDING);

  // iframe 回传：候选点击与内容尺寸。监听常驻，不随 srcdoc 重建而失效。
  // 来源校验只认自己的 iframe，别的窗口发来的同类消息一律丢弃。
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; index?: number; width?: number; height?: number } | null;
      if (!data) return;

      if (data.type === 'msime-select-candidate') {
        if (typeof data.index !== 'number') return;
        if (data.index < 0 || data.index >= sampleCandidates.length) return;
        onSelectCandidate(data.index);
        return;
      }

      if (data.type === 'msime-preview-size') {
        const { width, height, box } = data as { width: number; height: number; box?: typeof contentBox };
        if (typeof width !== 'number' || typeof height !== 'number') return;
        if (!(width > 0 && height > 0)) return;
        setFrameSize(prev =>
          Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }
        );
        if (box && typeof box.top === 'number') setContentBox(box);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelectCandidate, sampleCandidates.length]);

  const srcdoc = useMemo(() => {
    const hostVars = buildHostVars(config);
    const baseCss = baseSkinCss(base, layoutMode, theme);
    const overrideCss = buildSkinOverrideCss(config, layoutMode, theme, assetUrl);

    // fit_content 去掉各皮肤 .container 的 7em 下限，只留皮肤声明的 min_width_dip 与装饰图
    // 宽度。宿主把它拼在内置皮肤 CSS 之后（windows_webview2_skin.cpp:681-686）。
    const fitContentCss = config.candidate_window.fit_content
      ? '\nhtml[data-fit-content="on"] .container:not(:empty) { min-width: ' +
        'max(var(--msime-skin-min-width, 0px), var(--msime-skin-decoration-width, 0px)); }\n'
      : '';

    // 竖排页头没有 .cand-translation 规则，翻译靠皮肤 CSS 的 margin-left 同行显示；
    // 横排由页面头给出 display:block，翻译落到候选文字下方。这里按布局分流。
    const translationCss = layoutMode === 'horizontal' ? HORIZONTAL_PAGE_CSS : '';

    // 有翻页箭头时箭头成了 .container 的最后一个子元素，贴尾项的 :last-child 选择器落空，
    // 真实页面给最后一个可见候选补 .last-visible，这里照做。
    const lastVisible = pageArrows && sampleCandidates.length > 0 ? sampleCandidates.length - 1 : -1;
    const numClass = layoutMode === 'horizontal' ? 'num' : 'cand-no';

    const rows = sampleCandidates
      .map((cand, idx) => {
        const isFirst = idx === activeIndex;
        const pos = samplePos?.[idx];
        const translation = sampleTranslations?.[idx];
        let content = escapeHtml(cand);
        if (translation) {
          let transHtml = pos
            ? `<span class="cand-pos">${escapeHtml(pos)}</span><span class="cand-sep"> </span>`
            : '';
          transHtml += escapeHtml(translation);
          content += `<span class="cand-translation">${transHtml}</span>`;
        }
        const wrapperCls = `row-wrapper${isFirst ? ' first-row-wrapper' : ''}${idx === lastVisible ? ' last-visible' : ''}`;
        return (
          `<div class="${wrapperCls}" data-cand-index="${idx}">` +
          `<div class="row cand${isFirst ? ' first' : ''}">` +
          `<div class="text"><span class="${numClass}">${idx + 1}</span>` +
          `<span class="cand-content">${content}</span></div></div></div>`
        );
      })
      .join('\n');

    const pinyinRow = preeditHidden
      ? ''
      : `<div class="row pinyin"><div class="text">${escapeHtml(samplePinyin)}<span class="cursor"></span></div><div class="hidden-pinyin">n</div></div>`;

    const arrows = pageArrows
      ? `<div class="page-arrows">` +
        `<span class="page-arrow page-arrow-prev${hasPrevious ? '' : ' disabled'}" data-page="previous"></span>` +
        `<span class="page-arrow page-arrow-next${hasNext ? '' : ' disabled'}" data-page="next"></span>` +
        `</div>`
      : '';

    const decorDivs = decorations.map((_, i) => `<div class="msime-skin-decor" data-i="${i}"></div>`).join('');

    const hostVarStyle = parseCssVars(hostVars);

    return `<!DOCTYPE html>
<html lang="zh-CN" data-candidate-layout="${layoutMode}" data-candidate-theme="${theme}"
      data-candidate-skin="${escapeHtml(config.meta.id)}" data-candidate-base="${base}"
      data-page-arrows="${pageArrows ? 'on' : 'off'}"
      data-fit-content="${config.candidate_window.fit_content ? 'on' : 'off'}">
<head>
<meta charset="UTF-8">
<style>
  html { --msime-max-width-dip: 720px; --msime-max-height-dip: 2000px; --cand-font-size: 16px; --preedit-font-size: 16px; ${hostVarStyle} }
  /* 预览里候选窗就是整份文档。不能沿用真实页面的 height:100vh（测高会自锁）。
     尺寸由宿主侧量所有后代的实际包围盒得出（见 measure），这里不设 overflow:hidden：
     挂件与 containerParent 会按 outer_insets 溢出到 stage 之外，夹住就量不到真实需要多大。 */
  body { margin: 0; padding: ${padTop}px ${padRight}px ${padBottom}px ${padLeft}px; box-sizing: border-box;
         height: auto !important; min-height: 0 !important;
         background: transparent !important; display: inline-block; vertical-align: top;
         /* 关键：inline-block 的收缩宽度会被 iframe 视口夹住，卡片就永远不超过当前 iframe 宽，
            测量自我锁定、右边被裁。max-content 让 body 按内容撑开，配合上面的测量才能得到真实尺寸。 */
         width: max-content !important; }
  .stage { position: relative; display: inline-block; }
  ${translationCss}
</style>
<style>${SHARED_CANDIDATE_CSS}</style>
<style id="built-in-candidate-skin">${baseCss}${fitContentCss}</style>
<style id="external-candidate-skin-vars">:root{${hostVars}}</style>
<style id="external-candidate-skin">${overrideCss}</style>
</head>
<body>
<div class="stage">
  <div class="containerParent" id="realContainerParent">
    <div class="container${preeditHidden ? ' preedit-hidden' : ''}" id="realContainer">
${pinyinRow}
${rows}
${arrows}
    </div>
${decorDivs}
  </div>
</div>
${buildBridgeScript({ top: padTop, right: padRight, bottom: padBottom, left: padLeft })}
</body>
</html>`;
    // assetUrl 依赖 assets；sample* 与选中项都参与生成。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, layoutMode, theme, samplePinyin, sampleCandidates, sampleTranslations, samplePos, selectedIndex, hasPrevious, hasNext, assets, padTop, padRight, padBottom, padLeft]);

  // 尺寸交给 iframe 内的脚本自报（见 PREVIEW_BRIDGE_SCRIPT）：卡片按内容撑开，宿主侧跨文档
  // 测量要求 allow-same-origin，那样会和 allow-scripts 凑成沙箱逃逸告警。字体与图片加载后
  // 尺寸会变，脚本那边用 ResizeObserver 盯着 body 与 .stage。

  // 悬停中的挂件，用于命中区高亮：否则用户看不出预览里哪一块可以拖。
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 右侧面板正在悬停哪一组字段：对应区域在预览里点亮，解决「这个数字改的是哪一块」。
  const [inspect, setInspect] = useState<InspectTarget>(null);
  useEffect(() => subscribeInspectTarget(setInspect), []);

  // 预览自身滚动时高亮会错位，直接收起。只监听这个容器，不监听全局 scroll：
  // 后者会把用户滚动右侧面板找字段的动作也当成「注意力转移」，反而清掉刚点亮的高亮。
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !inspect) return;
    const clear = () => setInspectTarget(null);
    el.addEventListener('scroll', clear, { passive: true });
    return () => el.removeEventListener('scroll', clear);
  }, [inspect]);

  // 卡片相对预览左上角的位置与尺寸，用来画「文字内边距」高亮框。由 iframe 内脚本量好报回来。
  const [contentBox, setContentBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // 拖拽中把监听挂到 window：鼠标划出预览容器或掠过 iframe 时事件不会丢，松手一定收尾。
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPreviewOffset({
        index: dragging.index,
        x: Math.round(dragging.baseX + (e.clientX - dragging.startX)),
        y: Math.round(dragging.baseY + (e.clientY - dragging.startY))
      });
    };
    // 松手提交读 ref 而不是在 updater 里做副作用：StrictMode 会把 updater 跑两遍，
    // 那样每次松手都会写两次 config。
    const onUp = () => {
      const offset = previewOffsetRef.current;
      if (offset && offset.index === dragging.index) {
        onUpdateDecorationOffset?.(dragging.index, { x: offset.x, y: offset.y });
      }
      setPreviewOffset(null);
      setDragging(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // onUpdateDecorationOffset 每次渲染都是新函数，放进依赖会让相邻两次 mousemove 之间重装监听。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // 挂件的拖拽热区画在 iframe 外的一层覆盖层上：iframe 内的挂件是 CSS 背景，命中不便，
  // 且需要跨 iframe 同步坐标。热区相对 .containerParent 定位，坐标参照系与挂件一致。
  const hitOverlay = decorations.map((dec, idx) => {
    if (!assetUrl(dec.image)) return null;
    const isSelected = selectedDecorationIndex === idx;
    const isHovered = hoveredIndex === idx;
    const isDragging = dragging?.index === idx;
    const pending = previewOffset && previewOffset.index === idx ? previewOffset : null;
    const ox = pending ? pending.x : dec.offset_x_dip ?? 0;
    const oy = pending ? pending.y : dec.offset_y_dip ?? 0;
    const style: React.CSSProperties = {
      width: dec.width_dip,
      height: dec.height_dip,
      position: 'absolute',
      zIndex: (dec.z_index ?? 2) + 1000
    };
    switch (dec.anchor as DecorationAnchor) {
      case 'top-left':
        style.left = ox;
        style.top = oy;
        break;
      case 'top-right':
        style.right = -ox;
        style.top = oy;
        break;
      case 'bottom-left':
        style.left = ox;
        style.bottom = -oy;
        break;
      case 'bottom-right':
        style.right = -ox;
        style.bottom = -oy;
        break;
      case 'left':
        style.left = ox;
        style.top = `calc(50% + ${oy}px)`;
        style.transform = 'translateY(-50%)';
        break;
      case 'right':
        style.right = -ox;
        style.top = `calc(50% + ${oy}px)`;
        style.transform = 'translateY(-50%)';
        break;
      case 'top':
        style.top = oy;
        style.left = `calc(50% + ${ox}px)`;
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        style.bottom = -oy;
        style.left = `calc(50% + ${ox}px)`;
        style.transform = 'translateX(-50%)';
        break;
      default:
        style.left = `calc(50% + ${ox}px)`;
        style.top = `calc(50% + ${oy}px)`;
        style.transform = 'translate(-50%, -50%)';
        break;
    }
    return (
      <div
        key={idx}
        data-decor-hit="1"
        style={style}
        title={`挂件 #${idx}，锚点 ${dec.anchor}，拖动调整偏移`}
        className={`cursor-move pointer-events-auto transition-shadow ${
          isDragging
            ? 'outline outline-2 outline-emerald-500 bg-emerald-400/20 shadow-lg'
            : isSelected
            ? 'outline outline-2 outline-emerald-400 bg-emerald-400/10'
            : isHovered
            ? 'outline outline-2 outline-dashed outline-sky-400 bg-sky-400/10'
            : ''
        }`}
        onMouseEnter={() => setHoveredIndex(idx)}
        onMouseLeave={() => setHoveredIndex(prev => (prev === idx ? null : prev))}
        onMouseDown={e => {
          e.stopPropagation();
          onSelectDecoration?.(idx);
          setDragging({ index: idx, startX: e.clientX, startY: e.clientY, baseX: ox, baseY: oy });
        }}
      >
        {(isSelected || isDragging) && (
          <div className="absolute -top-5 left-0 bg-emerald-600 text-[10px] text-white px-1.5 rounded whitespace-nowrap shadow">
            #{idx} {dec.anchor} ({ox}, {oy})
          </div>
        )}
      </div>
    );
  });

  return (
    <div
      ref={scrollRef}
      className="relative select-none"
      style={{ width: '100%', overflow: 'auto' }}
      onClick={() => onSelectDecoration?.(null)}
    >
      <div className="relative inline-block">
        <iframe
          ref={iframeRef}
          title="候选窗预览"
          sandbox="allow-scripts"
          srcDoc={srcdoc}
          style={{
            width: frameSize.width,
            height: frameSize.height,
            border: '1px solid rgba(120,130,140,.35)',
            borderRadius: 6,
            background: theme === 'dark' ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.6)'
          }}
        />
        {/* 覆盖层整体不吃事件，只有挂件热区自己 pointer-events-auto：否则整块预览的点击会被这层
            挡住，iframe 里的候选行永远收不到 click。 */}
        {hitOverlay.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px` }}
          >
            <div className="relative h-full pointer-events-none">{hitOverlay}</div>
          </div>
        )}

        {/* 字段高亮层。contentBox 是 iframe 内相对文档左上角的绝对坐标，所以这一层
            不能再加 padding（那会二次偏移），直接用 inset-0 铺满 iframe 区域对齐。
            1px 是本层与 iframe 边框的差，扣掉才能贴住内容边缘。 */}
        {inspect && (
          <div className="absolute inset-0 pointer-events-none z-20" style={{ padding: 1 }}>
            <div className="relative h-full">
              {inspect === 'content' && contentBox && (
                <div
                  className="absolute rounded border-2 border-violet-400 bg-violet-400/15"
                  style={{ top: contentBox.top, left: contentBox.left, width: contentBox.width, height: contentBox.height }}
                >
                  <span className="absolute -top-5 left-1 whitespace-nowrap rounded bg-violet-600 px-1.5 text-[10px] text-white">
                    文字内边距
                  </span>
                </div>
              )}
              {inspect === 'outer' && (
                <div className="absolute inset-0 rounded border-2 border-dashed border-sky-400 bg-sky-400/10">
                  <span className="absolute left-1 top-1 whitespace-nowrap rounded bg-sky-600 px-1.5 text-[10px] text-white">
                    窗口留白（挂件探出时的余量）
                  </span>
                </div>
              )}
              {/* 九宫格面板画的是卡片本身，不是外围留白：两者只在 outer_insets 全 0 时才重合，
                  用 inset-0 会在带立绘留白的皮肤上整体框偏。 */}
              {inspect === 'panel' && contentBox && (
                <div
                  className="absolute rounded border-2 border-emerald-400 bg-emerald-400/10"
                  style={{ top: contentBox.top, left: contentBox.left, width: contentBox.width, height: contentBox.height }}
                >
                  <span className="absolute left-1 top-1 whitespace-nowrap rounded bg-emerald-600 px-1.5 text-[10px] text-white">
                    九宫格面板
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 注入 iframe 的最小脚本，只做两件事，不碰皮肤 CSS：
 *   1. 候选行被点中时把 index 回传给宿主，宿主改 selectedIndex 后 srcdoc 重建、高亮跟着换；
 *   2. 内容变化时把 body 的 scroll 尺寸报回去，宿主据此设置 iframe 尺寸。
 *
 * iframe 因此不需要 allow-same-origin（那是「同时开脚本与同源」的沙箱逃逸告警来源），
 * 尺寸与点击一律走 postMessage。
 */
const buildBridgeScript = (pad: { top: number; right: number; bottom: number; left: number }) => `<script>
(function () {
  var PAD_TOP = ${pad.top}, PAD_RIGHT = ${pad.right}, PAD_BOTTOM = ${pad.bottom}, PAD_LEFT = ${pad.left};
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-cand-index')) {
        parent.postMessage({ type: 'msime-select-candidate', index: Number(el.getAttribute('data-cand-index')) }, '*');
        return;
      }
      el = el.parentNode;
    }
  });

  var lastW = 0, lastH = 0, lastBox = { top: -1, left: -1, width: -1, height: -1 };
  function report() {
    var body = document.body;
    var stage = document.querySelector('.stage');
    if (!body || !stage) return;
    // 内容宽度取卡片本身的包围盒再补上 body 左右内边距：.stage 与 documentElement 的下限都是
    // iframe 视口宽度，卡片比视口窄时会把视口宽度当成内容宽度报回去，iframe 再也缩不回来。
    // 高度反过来要用 body.scrollHeight，挂件溢出到卡片外的部分只有它算得进去。
    var card = document.querySelector('.container') || stage;
    // .container 才是按内容撑开的元素，.stage 与 containerParent 都会被视口拉到满宽。
    var w = Math.ceil(card.scrollWidth) + PAD_LEFT + PAD_RIGHT + 2;
    var h = Math.max(body.scrollHeight, Math.ceil(card.getBoundingClientRect().height) + PAD_TOP + PAD_BOTTOM) + 2;
    // 卡片相对文档左上角的坐标，供宿主在覆盖层上对齐高亮框。iframe 内不会滚动，
    // scroll 项通常是 0，留着是为了视口滚动时仍然取到绝对坐标。
    var cb = card.getBoundingClientRect();
    var box = {
      top: Math.round(cb.top + window.scrollY),
      left: Math.round(cb.left + window.scrollX),
      width: Math.round(cb.width),
      height: Math.round(cb.height)
    };
    // 高度必须一起去重：宽度被 max-content 锁住时，只有行数变化会让卡片长高。
    if (
      w === lastW && h === lastH &&
      box.top === lastBox.top && box.left === lastBox.left &&
      box.width === lastBox.width && box.height === lastBox.height
    ) return;
    lastW = w; lastH = h; lastBox = box;
    parent.postMessage({ type: 'msime-preview-size', width: w, height: h, box: box }, '*');
  }

  // 图片与字体加载完尺寸才会定下来，所以从 load 起才开始上报，之后再补几拍收敛。
  function startWatching() {
    report();
    if (window.ResizeObserver) {
      var body = document.body;
      var stage = document.querySelector('.stage');
      var ro = new ResizeObserver(report);
      if (body) ro.observe(body);
      if (stage) ro.observe(stage);
    }
  }
  [0, 60, 250, 600].forEach(function (t) { setTimeout(report, t); });
  if (document.readyState === 'complete') startWatching();
  else window.addEventListener('load', startWatching);
})();
<\/script>`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

function parseCssVars(vars: string): string {
  return vars
    .split(';')
    .map(p => p.trim())
    .filter(Boolean)
    .join('; ');
}
