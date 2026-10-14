import React, { useMemo, useRef, useState } from 'react';
import { DecorationAnchor, SkinAsset, SkinV2Config, ThemeName, LayoutMode } from '../../types/skin';
import { baseSkinCss, SHARED_CANDIDATE_CSS } from '../../skins';
import { buildHostVars, buildSkinOverrideCss, outerInsetsOf } from '../../utils/skinCss';

interface CandidatePreviewProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  layoutMode: LayoutMode;
  theme: ThemeName;
  samplePinyin: string;
  sampleCandidates: string[];
  sampleTranslations?: string[];
  selectedIndex: number;
  onSelectCandidate: (index: number) => void;
  onUpdateDecorationOffset?: (index: number, offset: { x: number; y: number }) => void;
  selectedDecorationIndex?: number | null;
  onSelectDecoration?: (index: number | null) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

/** 与页面脚本一致的挂件空 div 注入层。 */
function ensureDecorationLayers(root: HTMLElement, count: number) {
  const parent = root.querySelector('.containerParent');
  if (!parent) return;
  for (let i = 0; i < count; i++) {
    if (!parent.querySelector(`.msime-skin-decor[data-i="${i}"]`)) {
      const node = document.createElement('div');
      node.className = 'msime-skin-decor';
      node.setAttribute('data-i', String(i));
      parent.appendChild(node);
    }
  }
  parent.querySelectorAll('.msime-skin-decor').forEach(node => {
    const idx = Number(node.getAttribute('data-i'));
    if (idx >= count) node.remove();
  });
}

export const CandidatePreview: React.FC<CandidatePreviewProps> = ({
  config,
  assets,
  layoutMode,
  theme,
  samplePinyin,
  sampleCandidates,
  sampleTranslations,
  selectedIndex,
  onSelectCandidate,
  onUpdateDecorationOffset,
  selectedDecorationIndex,
  onSelectDecoration,
  hasPrevious = true,
  hasNext = true
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ index: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const assetUrl = (path?: string) => {
    if (!path) return '';
    const direct = assets.get(path);
    if (direct?.blobUrl) return direct.blobUrl;
    const alt = path.startsWith('assets/') ? path.slice('assets/'.length) : `assets/${path}`;
    return assets.get(alt)?.blobUrl || path;
  };

  const base = config.meta.base || 'fluent';
  const baseCss = baseSkinCss(base, layoutMode, theme);
  const overrideCss = useMemo(
    () => buildSkinOverrideCss(config, layoutMode, theme, assetUrl),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, layoutMode, theme, assets]
  );
  const hostVars = buildHostVars(config);
  const outer = outerInsetsOf(config);
  const decorations = config.candidate_window.decorations ?? [];
  const pageArrows = config.candidate_window.page_arrows === true;
  const preeditHidden = samplePinyin.length === 0;

  const stageRef = (node: HTMLDivElement | null) => {
    (hostRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node) ensureDecorationLayers(node, decorations.length);
  };

  // 挂件拖拽：位移直接换算成 offset_dip，正数向右向下，与两端语义一致。
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !onUpdateDecorationOffset) return;
    onUpdateDecorationOffset(dragging.index, {
      x: Math.round(dragging.baseX + (e.clientX - dragging.startX)),
      y: Math.round(dragging.baseY + (e.clientY - dragging.startY))
    });
  };

  const handleMouseUp = () => setDragging(null);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ padding: `${Math.max(24, outer.top + 24)}px ${Math.max(24, outer.right + 24)}px ${Math.max(24, outer.bottom + 24)}px ${Math.max(24, outer.left + 24)}px` }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => onSelectDecoration?.(null)}
    >
      <style>{SHARED_CANDIDATE_CSS}</style>
      {/* 仿真器专用：真实窗口里 .msime-skin-decor 由宿主注入到 .containerParent，它是绝对定位的
          空 div，只负责画挂件，不该参与命中。这里补一条真实页面没有的规则把它和卡片一起放行
          点击。没有挂件时整套规则都不加，避免影响纯色皮肤。 */}
      <style>{`.candidate .containerParent.has-decorations,
.candidate .containerParent.has-decorations .container,
.candidate .containerParent.has-decorations .container * { pointer-events: none; }
.candidate .containerParent.has-decorations .cand,
.candidate .containerParent.has-decorations .cand * { pointer-events: auto; cursor: pointer; }`}</style>
      <style>{baseCss}</style>
      <style>{overrideCss}</style>

      {/* 与候选窗页面同一套 DOM：.candidate > .containerParent > .container */}
      <div
        ref={stageRef}
        className={`candidate hover-active wnd-${layoutMode === 'horizontal' ? 'h' : 'v'}`}
        style={{
          // 宿主在真实窗口里注入 --msime-max-width-dip / --msime-max-height-dip（宿主尺寸 DIP）。
          // 仿真器没有宿主，给一个和出厂预览一致的 720px 上限，卡片宽度才会按内容收。
          ['--msime-max-width-dip' as string]: '720px',
          ['--msime-max-height-dip' as string]: '2000px',
          ...(parseCssVars(hostVars) as React.CSSProperties)
        }}
        data-candidate-layout={layoutMode}
        onClick={e => e.stopPropagation()}
      >
        <div className={`containerParent${decorations.length ? ' has-decorations' : ''}`} id="realContainerParent">
          <div className={`container${preeditHidden ? ' preedit-hidden' : ''}`} id="realContainer">
            <div className="row pinyin">
              <div className="text">
                {samplePinyin}
                <span className="cursor" />
              </div>
              <div className="hidden-pinyin">n</div>
            </div>
            {sampleCandidates.map((cand, idx) => (
              <div key={idx} className={`row-wrapper${idx === 0 ? ' first-row-wrapper' : ''}`}>
                <div
                  className={`row cand${idx === 0 ? ' first' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectCandidate(idx)}
                >
                  <div className="text">
                    <span className="num">{idx + 1}</span>
                    {cand}
                    {sampleTranslations?.[idx] ? (
                      <span className="cand-translation">{sampleTranslations[idx]}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {pageArrows && (
              <div className="page-arrows">
                <span className={`page-arrow page-arrow-prev${hasPrevious ? '' : ' disabled'}`} />
                <span className={`page-arrow page-arrow-next${hasNext ? '' : ' disabled'}`} />
              </div>
            )}
          </div>

          {/* 挂件的拖拽热区：真实渲染由注入的 .msime-skin-decor 承担，热区放在同一个
              .containerParent 里，坐标参照系才和挂件一致。 */}
          {decorations.map((dec, idx) => {
            const url = assetUrl(dec.image);
            if (!url) return null;
            const isSelected = selectedDecorationIndex === idx;
            return (
              <div
                key={idx}
                data-decor-hit="1"
                style={{
                  ...decorationHitStyle(dec.anchor, dec.offset_x_dip ?? 0, dec.offset_y_dip ?? 0, dec.width_dip, dec.height_dip),
                  position: 'absolute',
                  zIndex: dec.z_index ?? 2
                }}
                className={`pointer-events-auto cursor-move ${isSelected ? 'outline outline-2 outline-emerald-400' : ''}`}
                onMouseDown={e => {
                  e.stopPropagation();
                  onSelectDecoration?.(idx);
                  setDragging({
                    index: idx,
                    startX: e.clientX,
                    startY: e.clientY,
                    baseX: dec.offset_x_dip ?? 0,
                    baseY: dec.offset_y_dip ?? 0
                  });
                }}
              >
                <img
                  src={url}
                  alt=""
                  className="pointer-events-none block"
                  style={{ width: dec.width_dip, height: dec.height_dip, objectFit: 'contain' }}
                />
                {isSelected && (
                  <div className="absolute -top-5 left-0 bg-emerald-600 text-[10px] text-white px-1.5 rounded whitespace-nowrap shadow">
                    #{idx} {dec.anchor} ({dec.offset_x_dip ?? 0}, {dec.offset_y_dip ?? 0})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function parseCssVars(vars: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of vars.split(';')) {
    const idx = part.indexOf(':');
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function decorationHitStyle(
  anchor: DecorationAnchor,
  ox: number,
  oy: number,
  width: number,
  height: number
): React.CSSProperties {
  const style: React.CSSProperties = { width, height };
  switch (anchor) {
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
  return style;
}
