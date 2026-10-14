import React, { useState } from 'react';
import {
  BUILT_IN_SKINS,
  BUILT_IN_SKIN_LABELS,
  BuiltInSkin,
  CandidateColors,
  DECORATION_ANCHORS,
  DecorationAnchor,
  SkinV2Config,
  ThemeName
} from '../../types/skin';
import { extractAlpha, hexToRgba, toOpaqueHex } from '../../utils/color';

type Decoration = NonNullable<SkinV2Config['candidate_window']['decorations']>[number];

interface ConfigPanelProps {
  config: SkinV2Config;
  onChange: (newConfig: SkinV2Config) => void;
  selectedDecorationIndex: number | null;
  onSelectDecoration: (index: number | null) => void;
  onRemoveDecoration: (index: number) => void;
  onUpdateDecoration: (index: number, patch: Partial<Decoration>) => void;
  isDarkMode?: boolean;
  layoutMode?: 'horizontal' | 'vertical';
}

const fieldCls = (dark: boolean) =>
  `w-full rounded px-2.5 py-1 mt-1 outline-none border focus:border-emerald-500 ${
    dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  }`;

const labelClsFor = (dark: boolean) => (dark ? 'text-slate-400' : 'text-slate-500');

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onChange,
  selectedDecorationIndex,
  onSelectDecoration,
  onRemoveDecoration,
  onUpdateDecoration,
  isDarkMode = false
}) => {
  const cw = config.candidate_window;
  const decorations = cw.decorations ?? [];
  const selected = selectedDecorationIndex !== null ? decorations[selectedDecorationIndex] : undefined;

  const inputCls = fieldCls(isDarkMode);
  const labelCls = labelClsFor(isDarkMode);
  const headingCls = `text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`;
  const subPanelCls = `space-y-2 text-xs p-3 rounded-lg border ${
    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;

  const updateWindow = (patch: Partial<SkinV2Config['candidate_window']>) => {
    onChange({ ...config, candidate_window: { ...cw, ...patch } });
  };

  const updateMeta = (patch: Partial<SkinV2Config['meta']>) => {
    onChange({ ...config, meta: { ...config.meta, ...patch } });
  };

  const updateColor = (theme: ThemeName, key: keyof CandidateColors, value: string | boolean | undefined) => {
    const current = config.candidate[theme] || {};
    onChange({
      ...config,
      candidate: { ...config.candidate, [theme]: { ...current, [key]: value } }
    });
  };

  // 色块的取值与文本框分开存。带 alpha 的原始值（#rrggbbaa / rgba()）只走文本框，
  // 绝不经过 <input type="color">，否则 React 在 commit 阶段会把原值写进节点，
  // 浏览器判定格式非法并刷一屏 "does not conform to the required format"。
  const [draftColor, setDraftColor] = useState<Record<string, string>>({});
  const [draftSwatch, setDraftSwatch] = useState<Record<string, string>>({});

  const colorInput = (theme: ThemeName, key: keyof CandidateColors, label: string, fallback: string) => {
    const value = (config.candidate[theme]?.[key] as string) ?? '';
    const fieldId = `${theme}.${String(key)}`;
    const shown = draftColor[fieldId] ?? value;
    // 文本框是权威来源，原样保留 rgba() / #rrggbbaa 里的透明度。
    const alpha = extractAlpha(shown);
    const swatch = draftSwatch[fieldId] ?? toOpaqueHex(shown, fallback);
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <div className="flex gap-2 items-center mt-1">
          <input
            type="color"
            value={swatch}
            title="只能调 RGB，透明度请在右侧文本框里用 rgba() 或 #rrggbbaa 写"
            onChange={e => {
              // 色块只会给出 #rrggbb，这里把原来的 alpha 补回去，避免改个色就把透明度抹掉。
              const picked = e.target.value;
              setDraftSwatch(prev => ({ ...prev, [fieldId]: picked }));
              const next = alpha < 1 ? hexToRgba(picked, alpha) : picked;
              setDraftColor(prev => ({ ...prev, [fieldId]: next }));
              updateColor(theme, key, next);
            }}
            className={`w-7 h-7 rounded border bg-transparent cursor-pointer ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}
          />
          <input
            type="text"
            value={shown}
            placeholder="留空沿用 base"
            onChange={e => {
              const text = e.target.value;
              setDraftColor(prev => ({ ...prev, [fieldId]: text }));
              // 文本框是唯一能表达透明度的入口，色块跟着它的 RGB 走。
              setDraftSwatch(prev => {
                const next = { ...prev };
                delete next[fieldId];
                return next;
              });
              updateColor(theme, key, text || undefined);
            }}
            className={`flex-1 ${fieldCls(isDarkMode)} mt-0 font-mono`}
          />
          {alpha < 1 && <span className={`text-[10px] shrink-0 ${labelCls}`}>透明度 {Math.round(alpha * 100)}%</span>}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full border-l w-full min-w-0 select-none overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
      <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
        <h2 className="text-sm font-semibold">皮肤属性</h2>
        <p className={`text-[11px] mt-0.5 ${labelCls}`}>字段与 skin.toml 一一对应</p>
      </div>

      <div className="p-4 space-y-6">
        {/* 元数据 */}
        <section className="space-y-3">
          <h3 className={headingCls}>皮肤元数据</h3>
          <div className="space-y-2 text-xs">
            <div>
              <label className={labelCls}>id（必须与皮肤目录名一致，只能小写字母数字与 . _ -）</label>
              <input
                type="text"
                value={config.meta.id}
                onChange={e => updateMeta({ id: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>名称</label>
              <input type="text" value={config.meta.name} onChange={e => updateMeta({ name: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>版本</label>
                <input type="text" value={config.meta.version} onChange={e => updateMeta({ version: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>作者</label>
                <input type="text" value={config.meta.author || ''} onChange={e => updateMeta({ author: e.target.value || undefined })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>说明</label>
              <input type="text" value={config.meta.description || ''} onChange={e => updateMeta({ description: e.target.value || undefined })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>基础皮肤 base</label>
              <select
                value={config.meta.base}
                onChange={e => updateMeta({ base: e.target.value as BuiltInSkin })}
                className={inputCls}
              >
                {BUILT_IN_SKINS.map(id => (
                  <option key={id} value={id}>
                    {BUILT_IN_SKIN_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>支持的布局</label>
              <div className="flex gap-3 mt-1">
                {(['horizontal', 'vertical'] as const).map(mode => {
                  const layouts = config.meta.supports?.layouts ?? ['horizontal'];
                  const checked = layouts.includes(mode);
                  return (
                    <label key={mode} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          updateMeta({
                            supports: {
                              ...config.meta.supports,
                              layouts: checked ? layouts.filter(m => m !== mode) : [...layouts, mode]
                            }
                          })
                        }
                      />
                      {mode === 'horizontal' ? '横排' : '竖排'}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 窗口几何 */}
        <section className="space-y-3">
          <h3 className={headingCls}>候选窗口</h3>
          <div className="space-y-3 text-xs">
            <Slider dark={isDarkMode} label="外框圆角 corner_radius_dip" value={cw.corner_radius_dip ?? 0} min={0} max={32}
              onChange={v => updateWindow({ corner_radius_dip: v })} />
            <Slider dark={isDarkMode} label="外框线宽 border_width_dip" value={cw.border_width_dip ?? 0} min={0} max={4} step={0.5}
              onChange={v => updateWindow({ border_width_dip: v })} />
            <Slider dark={isDarkMode} label="高亮圆角 item_corner_radius_dip" value={cw.item_corner_radius_dip ?? 0} min={0} max={16}
              onChange={v => updateWindow({ item_corner_radius_dip: v })} />
            <Slider dark={isDarkMode} label="最小宽度 min_width_dip" value={cw.min_width_dip ?? 0} min={0} max={600}
              onChange={v => updateWindow({ min_width_dip: v })} />
            <Slider dark={isDarkMode} label="行距 line_gap_dip" value={cw.line_gap_dip ?? 0} min={0} max={40}
              onChange={v => updateWindow({ line_gap_dip: v })} />

            <div>
              <label className={labelCls}>阴影 shadow</label>
              <select
                value={cw.shadow ?? ''}
                onChange={e => updateWindow({ shadow: (e.target.value || undefined) as SkinV2Config['candidate_window']['shadow'] })}
                className={inputCls}
              >
                <option value="">沿用 base</option>
                <option value="none">none</option>
                <option value="soft">soft</option>
                <option value="strong">strong</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>候选字体 font_family</label>
              <input
                type="text"
                value={cw.font_family || ''}
                placeholder="留空沿用 base"
                onChange={e => updateWindow({ font_family: e.target.value || undefined })}
                className={inputCls}
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={cw.page_arrows === true} onChange={e => updateWindow({ page_arrows: e.target.checked })} />
                翻页箭头
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={cw.fit_content === true} onChange={e => updateWindow({ fit_content: e.target.checked })} />
                宽度贴紧内容
              </label>
            </div>
          </div>
        </section>

        {/* 九宫格面板 */}
        <section className="space-y-3">
          <h3 className={headingCls}>九宫格面板 border_image</h3>
          <div className="space-y-2 text-xs">
            <div className={`font-mono truncate ${labelCls}`}>{cw.border_image?.source || '未设置'}</div>
            <NumberList dark={isDarkMode} label="slice_dip（上右下左）" values={cw.border_image?.slice_dip ?? []}
              onChange={v => updateWindow({ border_image: { ...(cw.border_image || { source: '' }), slice_dip: v } })} />
            <NumberList dark={isDarkMode} label="width_dip（留空沿用 slice）" values={cw.border_image?.width_dip ?? []}
              onChange={v => updateWindow({ border_image: { ...(cw.border_image || { source: '' }), width_dip: v.length ? v : undefined } })} />
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={cw.border_image?.fill !== false}
                onChange={e => updateWindow({ border_image: { ...(cw.border_image || { source: '' }), fill: e.target.checked } })}
              />
              保留中心内容区 fill
            </label>
          </div>
        </section>

        {/* 内边距 */}
        <section className="space-y-3">
          <h3 className={headingCls}>内边距与窗口留白</h3>
          <div className="space-y-2 text-xs">
            <InsetsEditor
              label="content_insets_dip（从面板外缘量起）"
              insets={cw.content_insets_dip}
              dark={isDarkMode}
              onChange={v => updateWindow({ content_insets_dip: v })}
            />
            <InsetsEditor
              label="outer_insets_dip（挂件外挂时窗口多留的空白）"
              insets={cw.outer_insets_dip}
              dark={isDarkMode}
              onChange={v => updateWindow({ outer_insets_dip: v })}
            />
          </div>
        </section>

        {/* 配色 */}
        <section className="space-y-3">
          <h3 className={headingCls}>配色（深色主题）</h3>
          <div className="space-y-2 text-xs">
            {colorInput('dark', 'text', '候选文字 text', '#e9e8e8')}
            {colorInput('dark', 'preedit_text', '预编辑文字 preedit_text', '#8e8cd8')}
            {colorInput('dark', 'number', '序号 number', '#e9e8e89d')}
            {colorInput('dark', 'accent', '强调 accent', '#8e8cd8')}
            {colorInput('dark', 'surface', '卡片底色 surface', '#202020')}
            {colorInput('dark', 'border', '外框色 border', '#9b9b9b2e')}
            {colorInput('dark', 'selected_text', '选中文字 selected_text', '#ffffff')}
            {colorInput('dark', 'selected', '选中底色 selected', '#3e3e3eb9')}
            {colorInput('dark', 'hover', '悬停底色 hover', '#414141')}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={headingCls}>配色（浅色主题）</h3>
          <div className="space-y-2 text-xs">
            {colorInput('light', 'text', '候选文字 text', '#1a1a1a')}
            {colorInput('light', 'preedit_text', '预编辑文字 preedit_text', '#6f6bc7')}
            {colorInput('light', 'number', '序号 number', '#1a1a1a8c')}
            {colorInput('light', 'accent', '强调 accent', '#6f6bc7')}
            {colorInput('light', 'surface', '卡片底色 surface', '#ffffff')}
            {colorInput('light', 'border', '外框色 border', '#0000001f')}
            {colorInput('light', 'selected_text', '选中文字 selected_text', '#1a1a1a')}
            {colorInput('light', 'selected', '选中底色 selected', '#e8e8e8')}
            {colorInput('light', 'hover', '悬停底色 hover', '#ececec')}
          </div>
        </section>

        {/* 挂件 */}
        <section className="space-y-3">
          <h3 className={headingCls}>
            自由挂件 decorations（{decorations.length}）
          </h3>
          {decorations.length === 0 && <p className={`text-[11px] ${labelCls}`}>从左侧素材点「+ 挂件」添加</p>}
          <div className="space-y-1">
            {decorations.map((dec, idx) => (
              <div
                key={idx}
                ref={node => {
                  if (node && selectedDecorationIndex === idx) node.scrollIntoView({ block: 'nearest' });
                }}
                onClick={() => onSelectDecoration(idx)}
                className={`w-full text-left text-[11px] px-2 py-1 rounded font-mono truncate cursor-pointer border ${
                  selectedDecorationIndex === idx
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-transparent'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent'
                }`}
              >
                #{idx} {dec.anchor} {dec.image.replace('assets/', '')}
              </div>
            ))}
          </div>

          {selected && (
            <div className={subPanelCls}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400">#{selectedDecorationIndex} 挂件</span>
                <button onClick={() => onRemoveDecoration(selectedDecorationIndex as number)} className="text-rose-400">
                  删除
                </button>
              </div>
              <div>
                <label className={labelCls}>锚点 anchor</label>
                <select
                  value={selected.anchor}
                  onChange={e => onUpdateDecoration(selectedDecorationIndex as number, { anchor: e.target.value as DecorationAnchor })}
                  className={inputCls}
                >
                  {DECORATION_ANCHORS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField dark={isDarkMode} label="宽 width_dip" value={selected.width_dip}
                  onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { width_dip: v })} />
                <NumberField dark={isDarkMode} label="高 height_dip" value={selected.height_dip}
                  onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { height_dip: v })} />
                <NumberField dark={isDarkMode} label="offset_x_dip" value={selected.offset_x_dip ?? 0}
                  onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { offset_x_dip: v })} />
                <NumberField dark={isDarkMode} label="offset_y_dip" value={selected.offset_y_dip ?? 0}
                  onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { offset_y_dip: v })} />
              </div>
              <NumberField dark={isDarkMode} label="z_index" value={selected.z_index ?? 2}
                onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { z_index: v })} />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                offset 正数向右向下。挂到卡片外的立绘要在 outer_insets_dip 里留出同样多的空间，否则会被窗口裁掉。
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; dark: boolean; onChange: (v: number) => void }> = ({
  label,
  value,
  min,
  max,
  step = 1,
  dark,
  onChange
}) => (
  <div>
    <label className={`${labelClsFor(dark)} flex justify-between`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={`w-full h-1 rounded appearance-none accent-emerald-500 mt-1.5 ${dark ? 'bg-slate-700' : 'bg-slate-200'}`}
    />
  </div>
);

const NumberField: React.FC<{ label: string; value: number; dark: boolean; onChange: (v: number) => void }> = ({
  label,
  value,
  dark,
  onChange
}) => (
  <div>
    <label className={labelClsFor(dark)}>{label}</label>
    <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className={fieldCls(dark)} />
  </div>
);

/** 1~4 个值的数组编辑，逗号分隔。 */
const NumberList: React.FC<{ label: string; values: number[]; dark: boolean; onChange: (v: number[]) => void }> = ({
  label,
  values,
  dark,
  onChange
}) => (
  <div>
    <label className={labelClsFor(dark)}>{label}</label>
    <input
      type="text"
      value={values.join(', ')}
      placeholder="留空"
      onChange={e => {
        const parsed = e.target.value
          .split(',')
          .map(s => Number(s.trim()))
          .filter(n => !Number.isNaN(n));
        onChange(parsed);
      }}
      className={`${fieldCls(dark)} font-mono`}
    />
  </div>
);

const InsetsEditor: React.FC<{
  label: string;
  insets?: { top: number; right: number; bottom: number; left: number };
  dark: boolean;
  onChange: (v: any) => void;
}> = ({ label, insets, dark, onChange }) => (
  <div>
    <label className={labelClsFor(dark)}>{label}</label>
    <div className="grid grid-cols-4 gap-1 mt-1">
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <input
          key={side}
          type="number"
          title={side}
          value={insets?.[side] ?? 0}
          onChange={e => onChange({ ...(insets || { top: 0, right: 0, bottom: 0, left: 0 }), [side]: Number(e.target.value) })}
          className={`${fieldCls(dark)} mt-0 text-center`}
        />
      ))}
    </div>
  </div>
);
