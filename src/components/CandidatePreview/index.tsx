import React, { useRef, useState } from 'react';
import { SkinV2Config, SkinAsset, AccessoryAnchor } from '../../types/skin';

interface CandidatePreviewProps {
  config: SkinV2Config;
  assets: Map<string, SkinAsset>;
  layoutMode: 'horizontal' | 'vertical';
  samplePinyin: string;
  sampleCandidates: string[];
  selectedIndex: number;
  onSelectCandidate: (index: number) => void;
  onUpdateAccessoryOffset?: (id: string, offset: { x: number; y: number }, anchor?: AccessoryAnchor) => void;
  selectedAccessoryId?: string | null;
  onSelectAccessory?: (id: string | null) => void;
}

export const CandidatePreview: React.FC<CandidatePreviewProps> = ({
  config,
  assets,
  layoutMode,
  samplePinyin,
  sampleCandidates,
  selectedIndex,
  onSelectCandidate,
  onUpdateAccessoryOffset,
  selectedAccessoryId,
  onSelectAccessory
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [draggingAccId, setDraggingAccId] = useState<string | null>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 0,
    initialY: 0
  });

  const getAssetUrl = (path?: string): string | undefined => {
    if (!path) return undefined;
    const direct = assets.get(path);
    if (direct?.blobUrl) return direct.blobUrl;
    // 尝试去除 assets/ 前缀或补充 assets/
    const altPath = path.startsWith('assets/') ? path.replace('assets/', '') : `assets/${path}`;
    const alt = assets.get(altPath);
    return alt?.blobUrl || path;
  };

  const candWin = config.candidate_window;
  const bgImage = getAssetUrl(candWin.background_image);
  const hlBgImage = getAssetUrl(config.highlight_item?.background_image);

  // 计算窗口九宫格切片与边宽样式
  const windowSlice = candWin.border_slice_px;
  const windowWidthDip = candWin.border_width_dip;

  // 搜狗与传统大背景图常带大立绘或较大原图高度，需保证合理最小高度
  const minHeightDip = Math.max(
    layoutMode === 'vertical' ? 120 : 48,
    (windowWidthDip?.top ?? 0) + (windowWidthDip?.bottom ?? 0) + (layoutMode === 'vertical' ? 70 : 34)
  );

  let windowBgStyle: React.CSSProperties = {
    backgroundColor: candWin.background_color || (bgImage ? 'transparent' : '#ffffff'),
    borderRadius: candWin.corner_radius_dip ? `${candWin.corner_radius_dip}px` : undefined,
    minHeight: `${minHeightDip}px`,
  };

  if (bgImage) {
    if (windowSlice && windowWidthDip) {
      windowBgStyle = {
        ...windowBgStyle,
        borderStyle: 'solid',
        borderTopWidth: `${windowWidthDip.top}px`,
        borderRightWidth: `${windowWidthDip.right}px`,
        borderBottomWidth: `${windowWidthDip.bottom}px`,
        borderLeftWidth: `${windowWidthDip.left}px`,
        borderImageSource: `url("${bgImage}")`,
        borderImageSlice: `${windowSlice.top} ${windowSlice.right} ${windowSlice.bottom} ${windowSlice.left} fill`,
        borderImageRepeat: candWin.scale_mode === 'tile' ? 'repeat' : 'stretch',
        backgroundColor: 'transparent'
      };
    } else {
      windowBgStyle = {
        ...windowBgStyle,
        backgroundImage: `url("${bgImage}")`,
        backgroundSize: candWin.scale_mode === 'tile' ? 'auto' : '100% 100%',
        backgroundRepeat: candWin.scale_mode === 'tile' ? 'repeat' : 'no-repeat'
      };
    }
  }

  // 计算内容内边距 (保证边框花纹内部有足够安全的文本呼吸空间)
  const paddingStyle: React.CSSProperties = {
    paddingTop: `${(candWin.margin_dip?.top ?? 0) + 6}px`,
    paddingRight: `${(candWin.margin_dip?.right ?? 0) + 12}px`,
    paddingBottom: `${(candWin.margin_dip?.bottom ?? 0) + 6}px`,
    paddingLeft: `${(candWin.margin_dip?.left ?? 0) + 12}px`
  };

  // 挂件拖拽交互
  const handleAccMouseDown = (e: React.MouseEvent, acc: any) => {
    e.stopPropagation();
    onSelectAccessory?.(acc.id);
    setDraggingAccId(acc.id);
    dragStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: acc.offset_dip.x,
      initialY: acc.offset_dip.y
    };
  };

  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (!draggingAccId || !windowRef.current) return;
    const deltaX = e.clientX - dragStartPos.current.mouseX;
    const deltaY = e.clientY - dragStartPos.current.mouseY;

    const newX = Math.round(dragStartPos.current.initialX + deltaX);
    const newY = Math.round(dragStartPos.current.initialY + deltaY);

    onUpdateAccessoryOffset?.(draggingAccId, { x: newX, y: newY });
  };

  const handleGlobalMouseUp = () => {
    setDraggingAccId(null);
  };

  return (
    <div
      className="relative flex items-center justify-center p-12 min-h-[320px] select-none"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
      onClick={() => onSelectAccessory?.(null)}
    >
      {/* 候选窗口主容器 */}
      <div
        ref={windowRef}
        style={{
          ...windowBgStyle,
          boxShadow: bgImage ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)'
        }}
        className="relative transition-all duration-100 ease-out"
        onClick={e => e.stopPropagation()}
      >
        {/* 自由挂件挂载层 (支持任意数量图层，按 z_order 排序渲染) */}
        {config.accessories?.map(acc => {
          const accUrl = getAssetUrl(acc.image);
          if (!accUrl) return null;

          const isSelected = selectedAccessoryId === acc.id;

          // 计算基于锚点的相对偏移定位
          const style: React.CSSProperties = {
            position: 'absolute',
            zIndex: acc.z_order,
            cursor: 'move',
            width: acc.size_dip ? `${acc.size_dip.width}px` : 'auto',
            height: acc.size_dip ? `${acc.size_dip.height}px` : 'auto'
          };

          // 锚点换算
          switch (acc.anchor) {
            case 'top_left':
              style.top = `${acc.offset_dip.y}px`;
              style.left = `${acc.offset_dip.x}px`;
              break;
            case 'top_right':
              style.top = `${acc.offset_dip.y}px`;
              style.right = `${-acc.offset_dip.x}px`;
              break;
            case 'bottom_left':
              style.bottom = `${-acc.offset_dip.y}px`;
              style.left = `${acc.offset_dip.x}px`;
              break;
            case 'bottom_right':
              style.bottom = `${-acc.offset_dip.y}px`;
              style.right = `${-acc.offset_dip.x}px`;
              break;
            case 'center':
              style.top = `calc(50% + ${acc.offset_dip.y}px)`;
              style.left = `calc(50% + ${acc.offset_dip.x}px)`;
              style.transform = 'translate(-50%, -50%)';
              break;
            default:
              style.top = `${acc.offset_dip.y}px`;
              style.left = `${acc.offset_dip.x}px`;
              break;
          }

          return (
            <div
              key={acc.id}
              style={style}
              onMouseDown={e => handleAccMouseDown(e, acc)}
              className={`group transition-transform active:scale-95 ${
                isSelected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 rounded' : ''
              }`}
            >
              <img
                src={accUrl}
                alt={acc.id}
                className="max-w-none pointer-events-none block drop-shadow"
                style={{
                  width: acc.size_dip ? `${acc.size_dip.width}px` : undefined,
                  height: acc.size_dip ? `${acc.size_dip.height}px` : undefined
                }}
              />
              {isSelected && (
                <div className="absolute -top-5 left-0 bg-emerald-600 text-[10px] text-white px-1.5 py-0.2 rounded whitespace-nowrap shadow pointer-events-none">
                  {acc.id} ({acc.offset_dip.x}, {acc.offset_dip.y})
                </div>
              )}
            </div>
          );
        })}

        {/* 内部文本流容器 */}
        <div style={paddingStyle} className="flex flex-col gap-1.5 relative z-0">
          {/* 预编辑区 (Pinyin) */}
          {samplePinyin && (
            <div
              style={{
                color: config.preedit?.text_color || '#334155',
                fontSize: `${(config.preedit?.font_size_pt || 11) * 1.33}px`,
                fontWeight: config.preedit?.font_weight || 400,
                marginBottom: `${candWin.line_gap_dip || 6}px`
              }}
              className="tracking-wide select-none font-sans"
            >
              {samplePinyin}
            </div>
          )}

          {/* 候选列表区 */}
          <div
            className={`flex ${layoutMode === 'vertical' ? 'flex-col' : 'flex-row items-center'} flex-wrap`}
            style={{
              gap: `${candWin.item_gap_dip || 12}px`
            }}
          >
            {sampleCandidates.map((cand, idx) => {
              const isSelected = idx === selectedIndex;
              const hlConfig = config.highlight_item;
              const candConfig = config.candidate_item;

              // 高亮项九宫格或背景样式
              let itemBgStyle: React.CSSProperties = {};
              if (isSelected) {
                if (hlBgImage) {
                  const hlSlice = hlConfig?.border_slice_px;
                  const hlWidth = hlConfig?.border_width_dip;
                  if (hlSlice && hlWidth) {
                    itemBgStyle = {
                      borderStyle: 'solid',
                      borderTopWidth: `${hlWidth.top}px`,
                      borderRightWidth: `${hlWidth.right}px`,
                      borderBottomWidth: `${hlWidth.bottom}px`,
                      borderLeftWidth: `${hlWidth.left}px`,
                      borderImageSource: `url("${hlBgImage}")`,
                      borderImageSlice: `${hlSlice.top} ${hlSlice.right} ${hlSlice.bottom} ${hlSlice.left} fill`,
                      borderImageRepeat: hlConfig?.scale_mode === 'tile' ? 'repeat' : 'stretch'
                    };
                  } else {
                    itemBgStyle = {
                      backgroundImage: `url("${hlBgImage}")`,
                      backgroundSize: '100% 100%'
                    };
                  }
                } else if (hlConfig?.background_color) {
                  itemBgStyle = {
                    backgroundColor: hlConfig.background_color,
                    borderRadius: `${hlConfig.corner_radius_dip ?? 4}px`
                  };
                }
              }

              const textColor = isSelected
                ? hlConfig?.text_color || '#2563eb'
                : candConfig?.text_color || '#0f172a';

              const numColor = isSelected
                ? hlConfig?.number_color || hlConfig?.text_color || '#2563eb'
                : candConfig?.number_color || '#94a3b8';

              const fontSize = isSelected
                ? (hlConfig?.font_size_pt || candConfig?.font_size_pt || 12) * 1.33
                : (candConfig?.font_size_pt || 12) * 1.33;

              const fontWeight = isSelected
                ? hlConfig?.font_weight || 500
                : candConfig?.font_weight || 400;

              return (
                <div
                  key={idx}
                  onClick={() => onSelectCandidate(idx)}
                  style={{
                    ...itemBgStyle,
                    padding: isSelected ? '2px 6px' : '2px 4px',
                    cursor: 'pointer'
                  }}
                  className="flex items-baseline gap-1 select-none transition-all rounded"
                >
                  <span
                    style={{
                      color: numColor,
                      fontSize: `${fontSize * 0.85}px`,
                      fontWeight: fontWeight
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <span
                    style={{
                      color: textColor,
                      fontSize: `${fontSize}px`,
                      fontWeight: fontWeight
                    }}
                  >
                    {cand}
                  </span>
                </div>
              );
            })}

            {/* 翻页指示符 */}
            <div
              className="flex items-center gap-1.5 ml-auto text-xs opacity-75 pl-2"
              style={{
                color: config.paging?.next_color || '#94a3b8',
                fontSize: `${(config.paging?.font_size_pt || 10) * 1.33}px`
              }}
            >
              <span>◀</span>
              <span>▶</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
