import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DecorationAnchor, SkinAsset, SkinV2Config, ThemeName, LayoutMode } from '../../types/skin';
import { baseSkinCss, SHARED_CANDIDATE_CSS, HORIZONTAL_PAGE_CSS } from '../../skins';
import { buildHostVars, buildSkinOverrideCss, outerInsetsOf } from '../../utils/skinCss';
import { buildD2dOverrideCss } from '../../utils/d2dCss';

export type PreviewBackend = 'webview2' | 'd2d';

interface CandidatePreviewProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  layoutMode: LayoutMode;
  theme: ThemeName;
  backend: PreviewBackend;
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
  backend,
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

  const srcdoc = useMemo(() => {
    const hostVars = buildHostVars(config);
    const baseCss = baseSkinCss(base, layoutMode, theme);
    const overrideCss =
      backend === 'webview2'
        ? buildSkinOverrideCss(config, layoutMode, theme, assetUrl)
        : buildD2dOverrideCss(config, layoutMode, theme, assetUrl);

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
          `<div class="${wrapperCls}">` +
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
      data-fit-content="${config.candidate_window.fit_content ? 'on' : 'off'}"
      data-preview-backend="${backend}">
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
</body>
</html>`;
    // assetUrl 依赖 assets；sample* 与选中项都参与生成。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, layoutMode, theme, backend, samplePinyin, sampleCandidates, sampleTranslations, samplePos, selectedIndex, hasPrevious, hasNext, assets, padTop, padRight, padBottom, padLeft]);

  // 预览里候选窗就是整份文档，不能把 iframe 设成 width:100%：卡片按内容撑开时会被父容器
  // 夹住并裁掉右边。这里量 .stage 的包围盒（它与卡片加留白同尺寸，且不受 overflow 影响），
  // 把 iframe 设成该尺寸，外层容器负责滚动；字体与图片加载后尺寸会变，所以挂 ResizeObserver。
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      try {
        const doc = frame.contentDocument;
        const stage = doc?.querySelector('.stage');
        if (!doc || !stage) return;
        // body 是 width:max-content，会按内容撑开，所以 documentElement.scrollWidth 就是
        // 卡片加留白的真实宽度；不需要再逐元素求并集。+2 吸收 subpixel 取整。
        const w = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth) + 2;
        const h = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 2;
        if (w > 0 && h > 0) {
          setFrameSize(prev =>
            Math.abs(prev.width - w) < 1 && Math.abs(prev.height - h) < 1 ? prev : { width: w, height: h }
          );
        }
      } catch {
        /* 跨文档异常忽略，保持上次尺寸 */
      }
    };

    const attach = () => {
      measure();
      try {
        const stage = frame.contentDocument?.querySelector('.stage');
        if (stage && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure);
          observer.observe(stage);
        }
      } catch {
        /* 忽略 */
      }
    };

    // srcdoc 写入后内容才就绪；load 事件比固定延时可靠，另外补两次兜底覆盖字体/图片。
    frame.addEventListener('load', attach);
    const timers = [window.setTimeout(attach, 60), window.setTimeout(measure, 250), window.setTimeout(measure, 600)];
    attach();
    return () => {
      frame.removeEventListener('load', attach);
      timers.forEach(t => window.clearTimeout(t));
      observer?.disconnect();
    };
  }, [srcdoc, decorations.length]);

  // 挂件拖拽：位移直接换算成 offset_dip，正数向右向下，与两端语义一致。
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !onUpdateDecorationOffset) return;
    onUpdateDecorationOffset(dragging.index, {
      x: Math.round(dragging.baseX + (e.clientX - dragging.startX)),
      y: Math.round(dragging.baseY + (e.clientY - dragging.startY))
    });
  };
  const handleMouseUp = () => setDragging(null);

  // 挂件的拖拽热区画在 iframe 外的一层覆盖层上：iframe 内的挂件是 CSS 背景，命中不便，
  // 且需要跨 iframe 同步坐标。热区相对 .containerParent 定位，坐标参照系与挂件一致。
  const hitOverlay = decorations.map((dec, idx) => {
    if (!assetUrl(dec.image)) return null;
    const isSelected = selectedDecorationIndex === idx;
    const ox = dec.offset_x_dip ?? 0;
    const oy = dec.offset_y_dip ?? 0;
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
        className={`cursor-move ${isSelected ? 'outline outline-2 outline-emerald-400' : ''}`}
        onMouseDown={e => {
          e.stopPropagation();
          onSelectDecoration?.(idx);
          setDragging({ index: idx, startX: e.clientX, startY: e.clientY, baseX: ox, baseY: oy });
        }}
      >
        {isSelected && (
          <div className="absolute -top-5 left-0 bg-emerald-600 text-[10px] text-white px-1.5 rounded whitespace-nowrap shadow">
            #{idx} {dec.anchor} ({ox}, {oy})
          </div>
        )}
      </div>
    );
  });

  return (
    <div
      className="relative select-none"
      style={{ width: '100%', overflow: 'auto' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => onSelectDecoration?.(null)}
    >
      <div className="relative inline-block">
        <span
          className={`absolute top-1 left-1 z-10 text-[10px] leading-4 px-1.5 rounded-full pointer-events-none text-white ${
            backend === 'd2d' ? 'bg-rose-600/85' : 'bg-emerald-600/85'
          }`}
        >
          {backend === 'd2d' ? 'D2D' : 'WebView2'}
        </span>
        <iframe
          ref={iframeRef}
          title="候选窗预览"
          sandbox="allow-same-origin"
          srcDoc={srcdoc}
          style={{
            width: frameSize.width,
            height: frameSize.height,
            border: '1px solid rgba(120,130,140,.35)',
            borderRadius: 6,
            background: theme === 'dark' ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.6)'
          }}
        />
        {hitOverlay.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ padding: `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px` }}
          >
            <div className="relative h-full pointer-events-none">
              <div className="absolute inset-0 pointer-events-auto" onClick={e => e.stopPropagation()}>
                {hitOverlay}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
