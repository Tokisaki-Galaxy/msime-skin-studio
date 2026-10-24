import React, { useMemo, useState } from 'react';
import {
  BUILT_IN_SKINS,
  BUILT_IN_SKIN_LABELS,
  BuiltInSkin,
  CandidateColors,
  DECORATION_ANCHORS,
  DecorationAnchor,
  Insets,
  SkinV2Config,
  ThemeName
} from '../../types/skin';
import { inheritedPalette, InheritedColorKey } from '../../utils/basePalette';
import { cn } from '../../utils/cn';
import { chipBase, textFaint, textMuted } from '../ui/tokens';import { Section } from '../ui/Section';
import { Field } from '../ui/Field';
import { ColorField } from '../ui/ColorField';
import { NumberSlider } from '../ui/NumberSlider';
import { InsetsEditor } from '../ui/InsetsEditor';

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

/** 一组配色字段的描述。分组后长列表能折叠，用户按用途找而不是从头扫到尾。 */
interface ColorSpec {
  key: keyof CandidateColors & InheritedColorKey;
  label: string;
  fallback: string;
  group: '基础' | '翻译' | '进阶';
  hint?: string;
}

const COLOR_SPECS: ColorSpec[] = [
  { key: 'text', label: '候选文字', fallback: '#e9e8e8', group: '基础' },
  { key: 'preedit_text', label: '预编辑文字', fallback: '#8e8cd8', group: '基础' },
  { key: 'number', label: '序号', fallback: '#e9e8e89d', group: '基础' },
  { key: 'accent', label: '强调色', fallback: '#8e8cd8', group: '基础', hint: '翻页箭头、光标等共用色' },
  { key: 'surface', label: '卡片底色', fallback: '#202020', group: '基础' },
  { key: 'border', label: '外框色', fallback: '#9b9b9b2e', group: '基础' },
  { key: 'selected', label: '选中底色', fallback: '#3e3e3eb9', group: '基础' },
  { key: 'hover', label: '悬停底色', fallback: '#414141', group: '基础' },
  { key: 'selected_text', label: '选中文字', fallback: '#ffffff', group: '基础' },
  { key: 'preedit_caret', label: '预编辑光标', fallback: '#6b69d6', group: '基础' },
  { key: 'translation', label: '翻译文字', fallback: '#9a6dd7', group: '翻译' },
  { key: 'translation_pos', label: '翻译词性', fallback: '#e255a180', group: '翻译' },
  { key: 'translation_separator', label: '翻译分隔符', fallback: '#9a6dd773', group: '翻译' },
  { key: 'selected_translation', label: '选中翻译', fallback: '#ffffff', group: '翻译' },
  { key: 'selected_translation_pos', label: '选中翻译词性', fallback: '#ffffff', group: '翻译' },
  { key: 'selected_translation_separator', label: '选中翻译分隔符', fallback: '#ffffff', group: '翻译' },
  { key: 'selected_number', label: '选中序号', fallback: '#ffffff', group: '进阶' },
  { key: 'selected_bar', label: '选中条', fallback: '#6b69d6', group: '进阶' },
  { key: 'preedit_background', label: '预编辑底色', fallback: '#00000000', group: '进阶' },
  { key: 'preedit_divider', label: '预编辑分隔线', fallback: '#00000000', group: '进阶' }
];

const COLOR_GROUPS: ColorSpec['group'][] = ['基础', '翻译', '进阶'];
const LIGHT_FALLBACKS: Partial<Record<ColorSpec['key'], string>> = {
  text: '#1a1a1a',
  preedit_text: '#6f6bc7',
  number: '#1a1a1a8c',
  accent: '#6f6bc7',
  surface: '#ffffff',
  border: '#0000001f',
  selected: '#e8e8e8',
  hover: '#ececec',
  selected_text: '#1a1a1a',
  preedit_caret: '#6f6bc7',
  translation: '#6940a5',
  translation_pos: '#ad1a7280',
  translation_separator: '#6940a573',
  selected_translation: '#1a1a1a',
  selected_translation_pos: '#1a1a1a',
  selected_translation_separator: '#1a1a1a',
  selected_number: '#1a1a1a',
  selected_bar: '#6f6bc7'
};

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onChange,
  selectedDecorationIndex,
  onSelectDecoration,
  onRemoveDecoration,
  onUpdateDecoration,
  isDarkMode = false
}) => {
  const dark = isDarkMode;
  const cw = config.candidate_window;
  const decorations = cw.decorations ?? [];
  const selected = selectedDecorationIndex !== null ? decorations[selectedDecorationIndex] : undefined;
  const base = config.meta.base;
  const [onlyModified, setOnlyModified] = useState(false);
  // 「只看已改」下点重置会让该字段瞬间从列表消失，鼠标停在原地但目标没了。这里记下刚重置的
  // 字段，短暂保留在列表里，让用户看到它已经变回继承色。
  const [justReset, setJustReset] = useState<Set<string>>(() => new Set());
  const markReset = (key: string) => {
    setJustReset(prev => new Set(prev).add(key));
    window.setTimeout(() => {
      setJustReset(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2500);
  };

  // 基础皮肤的实际配色随 base 变化，抽一次给整份面板用。
  const inherited = useMemo(
    () => ({ dark: inheritedPalette(base, 'dark'), light: inheritedPalette(base, 'light') }),
    [base]
  );

  const updateWindow = (patch: Partial<SkinV2Config['candidate_window']>) => {
    onChange({ ...config, candidate_window: { ...cw, ...patch } });
  };
  const updateMeta = (patch: Partial<SkinV2Config['meta']>) => {
    onChange({ ...config, meta: { ...config.meta, ...patch } });
  };
  const updateColor = (theme: ThemeName, key: keyof CandidateColors, value: string | boolean | undefined) => {
    const current = config.candidate[theme] || {};
    onChange({ ...config, candidate: { ...config.candidate, [theme]: { ...current, [key]: value } } });
  };

  const modifiedColors = (theme: ThemeName) =>
    COLOR_SPECS.filter(spec => (config.candidate[theme]?.[spec.key] ?? '') !== '').length;

  /** 一个主题整组配色。只显示已修改时过滤掉留空的项。 */
  const colorSection = (theme: ThemeName, title: string) => {
    const colors = config.candidate[theme] || {};
    const showBar = colors.show_selected_bar;
    const specs = onlyModified
      ? COLOR_SPECS.filter(s => (colors[s.key] ?? '') !== '' || justReset.has(`${theme}:${String(s.key)}`))
      : COLOR_SPECS;

    return (
      <Section
        key={theme}
        title={title}
        dark={dark}
        defaultOpen={false}
        badge={<span className={chipBase(dark)}>{modifiedColors(theme)} 项已改</span>}
        description="留空即沿用基础皮肤，色块会显示实际继承到的颜色。透明度用滑杆调，不必手写 rgba。"
        action={
          modifiedColors(theme) > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`把「${title}」的 ${modifiedColors(theme)} 项改动全部清空，恢复成继承？`)) {
                  onChange({ ...config, candidate: { ...config.candidate, [theme]: {} } });
                }
              }}
              className="text-[10px] text-rose-500 hover:text-rose-400"
            >
              全部还原
            </button>
          ) : undefined
        }
      >
        {specs.length === 0 ? (
          <p className={cn('text-[11px] py-1', textMuted(dark))}>这组还没有改过任何配色。</p>
        ) : (
          <div className="space-y-2">
            {COLOR_GROUPS.filter(group => specs.some(s => s.group === group)).map(group => (
              <Section
                key={group}
                variant="nested"
                title={group}
                dark={dark}
                defaultOpen={group === '基础'}
                badge={
                  <span className={chipBase(dark)}>
                    {specs.filter(s => s.group === group && (colors[s.key] ?? '') !== '').length}/
                    {specs.filter(s => s.group === group).length}
                  </span>
                }
              >
                <div className="space-y-3.5">
                  {specs
                    .filter(s => s.group === group)
                    .map(spec => (
                      <ColorField
                        key={spec.key}
                        label={spec.label}
                        fieldKey={String(spec.key)}
                        value={colors[spec.key] as string | undefined}
                        inherited={inherited[theme][spec.key]}
                        fallback={(theme === 'light' ? LIGHT_FALLBACKS[spec.key] : spec.fallback) || spec.fallback}
                        dark={dark}
                        hint={spec.hint}
                        onChange={v => {
                          // 只有「从有值改成留空」才算重置，正常改色不算。
                          if (v === undefined && (colors[spec.key] ?? '') !== '') markReset(`${theme}:${String(spec.key)}`);
                          updateColor(theme, spec.key, v);
                        }}
                      />
                    ))}
                </div>
              </Section>
            ))}
          </div>
        )}

        <Field label="选中指示条" fieldKey="show_selected_bar" dark={dark} hint="关掉后首选前的竖条不再绘制。">
          <select
            value={showBar === undefined ? '' : String(showBar)}
            onChange={e => updateColor(theme, 'show_selected_bar', e.target.value === '' ? undefined : e.target.value === 'true')}
            className={cn(
              'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
              dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            )}
          >
            <option value="">沿用 base</option>
            <option value="true">显示</option>
            <option value="false">隐藏</option>
          </select>
        </Field>
      </Section>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full border-l w-full min-w-0 select-none',
        dark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      <div className={cn('px-4 py-3 border-b shrink-0', dark ? 'border-slate-800' : 'border-slate-200')}>
        <h2 className="text-sm font-semibold">皮肤属性</h2>
        <div className="mt-1 flex items-center gap-2">
          <p className={cn('text-[11px] flex-1', textMuted(dark))}>每个字段都对应 skin.toml 里的一项</p>
          <label className={cn('flex items-center gap-1 text-[11px] cursor-pointer', textMuted(dark))}>
            <input type="checkbox" checked={onlyModified} onChange={e => setOnlyModified(e.target.checked)} />
            只看已改
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 元数据 */}
        <Section title="皮肤信息" dark={dark} description="打包成皮肤目录时用的身份信息。">
          <div className="space-y-3">
            <Field
              label="皮肤 id"
              fieldKey="id"
              dark={dark}
              hint="必须与皮肤目录名一致，只能小写字母、数字与 . _ -，且以字母或数字开头。"
            >
              <input
                type="text"
                value={config.meta.id}
                onChange={e => updateMeta({ id: e.target.value })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs font-mono outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                )}
              />
            </Field>
            <Field label="名称" fieldKey="name" dark={dark}>
              <input
                type="text"
                value={config.meta.name}
                onChange={e => updateMeta({ name: e.target.value })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="版本" fieldKey="version" dark={dark}>
                <input
                  type="text"
                  value={config.meta.version}
                  onChange={e => updateMeta({ version: e.target.value })}
                  className={cn(
                    'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                    dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  )}
                />
              </Field>
              <Field label="作者" fieldKey="author" dark={dark}>
                <input
                  type="text"
                  value={config.meta.author || ''}
                  onChange={e => updateMeta({ author: e.target.value || undefined })}
                  className={cn(
                    'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                    dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  )}
                />
              </Field>
            </div>
            <Field label="说明" fieldKey="description" dark={dark}>
              <input
                type="text"
                value={config.meta.description || ''}
                onChange={e => updateMeta({ description: e.target.value || undefined })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                )}
              />
            </Field>
            <Field
              label="基础皮肤"
              fieldKey="base"
              dark={dark}
              hint="留空的字段都从这里继承。预览里的主体外观由它决定。"
            >
              <select
                value={config.meta.base}
                onChange={e => updateMeta({ base: e.target.value as BuiltInSkin })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                )}
              >
                {BUILT_IN_SKINS.map(id => (
                  <option key={id} value={id}>
                    {BUILT_IN_SKIN_LABELS[id]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="支持的布局" fieldKey="supports.layouts" dark={dark}>
              <div className="flex gap-4 pt-0.5">
                {(['horizontal', 'vertical'] as const).map(mode => {
                  const layouts = config.meta.supports?.layouts ?? ['horizontal'];
                  const checked = layouts.includes(mode);
                  return (
                    <label key={mode} className={cn('flex items-center gap-1.5 text-[11px]', textMuted(dark))}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          updateMeta({ supports: { ...config.meta.supports, layouts: checked ? layouts.filter(m => m !== mode) : [...layouts, mode] } })
                        }
                      />
                      {mode === 'horizontal' ? '横排' : '竖排'}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
        </Section>

        {/* 窗口几何 */}
        <Section title="候选窗口" dark={dark} description="卡片本身的尺寸、圆角与阴影。">
          <div className="space-y-3.5">
            <Field label="外框圆角" fieldKey="corner_radius_dip" inherited={cw.corner_radius_dip === undefined} onReset={cw.corner_radius_dip === undefined ? undefined : () => updateWindow({ corner_radius_dip: undefined })} dark={dark}>
              <NumberSlider dark={dark} value={cw.corner_radius_dip ?? 0} min={0} max={32} unit="dip" onChange={v => updateWindow({ corner_radius_dip: v })} />
            </Field>
            <Field label="外框线宽" fieldKey="border_width_dip" inherited={cw.border_width_dip === undefined} onReset={cw.border_width_dip === undefined ? undefined : () => updateWindow({ border_width_dip: undefined })} dark={dark}>
              <NumberSlider dark={dark} value={cw.border_width_dip ?? 0} min={0} max={4} step={0.5} unit="dip" onChange={v => updateWindow({ border_width_dip: v })} />
            </Field>
            <Field label="高亮圆角" fieldKey="item_corner_radius_dip" inherited={cw.item_corner_radius_dip === undefined} onReset={cw.item_corner_radius_dip === undefined ? undefined : () => updateWindow({ item_corner_radius_dip: undefined })} dark={dark} hint="候选高亮块的圆角，各基础皮肤有各自默认值。">
              <NumberSlider dark={dark} value={cw.item_corner_radius_dip ?? 0} min={0} max={16} unit="dip" onChange={v => updateWindow({ item_corner_radius_dip: v })} />
            </Field>
            <Field label="最小宽度" fieldKey="min_width_dip" inherited={cw.min_width_dip === undefined} onReset={cw.min_width_dip === undefined ? undefined : () => updateWindow({ min_width_dip: undefined })} dark={dark}>
              <NumberSlider dark={dark} value={cw.min_width_dip ?? 0} min={0} max={600} unit="dip" onChange={v => updateWindow({ min_width_dip: v })} />
            </Field>
            <Field label="行距" fieldKey="line_gap_dip" inherited={cw.line_gap_dip === undefined} onReset={cw.line_gap_dip === undefined ? undefined : () => updateWindow({ line_gap_dip: undefined })} dark={dark}>
              <NumberSlider dark={dark} value={cw.line_gap_dip ?? 0} min={0} max={40} unit="dip" onChange={v => updateWindow({ line_gap_dip: v })} />
            </Field>
            <Field label="阴影" fieldKey="shadow" inherited={cw.shadow === undefined} onReset={cw.shadow === undefined ? undefined : () => updateWindow({ shadow: undefined })} dark={dark}>
              <select
                value={cw.shadow ?? ''}
                onChange={e => updateWindow({ shadow: (e.target.value || undefined) as SkinV2Config['candidate_window']['shadow'] })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                )}
              >
                <option value="">沿用 base</option>
                <option value="none">无</option>
                <option value="soft">柔和</option>
                <option value="strong">明显</option>
              </select>
            </Field>
            <Field label="候选字体" fieldKey="font_family" inherited={!cw.font_family} onReset={cw.font_family ? () => updateWindow({ font_family: undefined }) : undefined} dark={dark} hint="不能包含引号、逗号、分号等符号，多个字体名用空格分隔。">
              <input
                type="text"
                value={cw.font_family || ''}
                placeholder="留空沿用 base"
                onChange={e => updateWindow({ font_family: e.target.value || undefined })}
                className={cn(
                  'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                  dark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                )}
              />
            </Field>
            <div className="flex gap-4 pt-0.5">
              <label className={cn('flex items-center gap-1.5 text-[11px]', textMuted(dark))}>
                <input type="checkbox" checked={cw.page_arrows === true} onChange={e => updateWindow({ page_arrows: e.target.checked })} />
                显示翻页箭头
              </label>
              <label className={cn('flex items-center gap-1.5 text-[11px]', textMuted(dark))}>
                <input type="checkbox" checked={cw.fit_content === true} onChange={e => updateWindow({ fit_content: e.target.checked })} />
                宽度贴紧内容
              </label>
            </div>
          </div>
        </Section>

        {/* 九宫格面板 */}
        <Section
          title="九宫格面板"
          dark={dark}
          badge={cw.border_image?.source ? <span className={chipBase(dark)}>已设</span> : undefined}
          description="用一张贴图当卡片外框，四角固定、边缘拉伸。"
        >
          <div className="space-y-3.5">
            <div className={cn('rounded-md border px-2.5 py-1.5 text-[11px] font-mono truncate', dark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}>
              {cw.border_image?.source || '未设置，先在左侧素材点「设为面板」'}
            </div>
            {cw.border_image && (
              <>
                <Field label="切片" fieldKey="slice_dip" dark={dark} hint="四角保持原样的尺寸，顺序是上右下左。用左侧的「标定切片」拖拽更直观。">
                  <NumberList
                    dark={dark}
                    values={cw.border_image.slice_dip ?? []}
                    onChange={v => updateWindow({ border_image: { ...cw.border_image!, slice_dip: v } })}
                  />
                </Field>
                <Field label="绘制宽度" fieldKey="width_dip" dark={dark} hint="边框画多宽。留空则与切片一致。">
                  <NumberList
                    dark={dark}
                    values={cw.border_image.width_dip ?? []}
                    onChange={v => updateWindow({ border_image: { ...cw.border_image!, width_dip: v.length ? v : undefined } })}
                  />
                </Field>
                <label className={cn('flex items-center gap-1.5 text-[11px]', textMuted(dark))}>
                  <input
                    type="checkbox"
                    checked={cw.border_image.fill !== false}
                    onChange={e => updateWindow({ border_image: { ...cw.border_image!, fill: e.target.checked } })}
                  />
                  保留中心内容区
                </label>
              </>
            )}
          </div>
        </Section>

        {/* 内边距 */}
        <Section
          title="内边距与窗口留白"
          dark={dark}
          description="决定文字离边框多远，以及挂件挂到卡片外时窗口要多留多少透明空间。"
        >
          <div className="space-y-4">
            <Field label="文字内边距" fieldKey="content_insets_dip" dark={dark} hint="从面板外缘量起，渲染时会自动扣掉边框宽度。">
              <InsetsEditor
                dark={dark}
                value={cw.content_insets_dip ?? { top: 0, right: 0, bottom: 0, left: 0 }}
                topBottomMax={200}
                rightLeftMax={500}
                onChange={(v: Insets) => updateWindow({ content_insets_dip: v })}
              />
            </Field>
            <Field label="窗口留白" fieldKey="outer_insets_dip" dark={dark} hint="挂件伸出卡片时，窗口需要多留的空白，否则会被裁掉。">
              <InsetsEditor
                dark={dark}
                value={cw.outer_insets_dip ?? { top: 0, right: 0, bottom: 0, left: 0 }}
                topBottomMax={500}
                rightLeftMax={500}
                onChange={(v: Insets) => updateWindow({ outer_insets_dip: v })}
              />
            </Field>
          </div>
        </Section>

        {colorSection('dark', '深色主题配色')}
        {colorSection('light', '浅色主题配色')}

        {/* 挂件 */}
        <Section title={`自由挂件（${decorations.length}）`} dark={dark} description="挂在卡片任意位置的贴图，层数不限。">
          {decorations.length === 0 && <p className={cn('text-[11px]', textMuted(dark))}>从左侧素材点「+ 挂件」添加。</p>}
          <div className="space-y-1">
            {decorations.map((dec, idx) => (
              <button
                key={idx}
                ref={node => {
                  if (node && selectedDecorationIndex === idx) node.scrollIntoView({ block: 'nearest' });
                }}
                onClick={() => onSelectDecoration(idx)}
                className={cn(
                  'w-full text-left text-[11px] px-2.5 py-1.5 rounded-md font-mono truncate border transition',
                  selectedDecorationIndex === idx
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : dark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-transparent'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent'
                )}
              >
                #{idx}　{dec.anchor}　{dec.image.replace('assets/', '')}
              </button>
            ))}
          </div>

          {selected && (
            <div className={cn('rounded-lg border p-3 space-y-3 mt-1', dark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200')}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-500">正在编辑 #{selectedDecorationIndex}</span>
                <button
                  onClick={() => onRemoveDecoration(selectedDecorationIndex as number)}
                  className="text-[11px] text-rose-500 hover:text-rose-400"
                >
                  删除
                </button>
              </div>
              <Field label="锚点" fieldKey="anchor" dark={dark}>
                <select
                  value={selected.anchor}
                  onChange={e => onUpdateDecoration(selectedDecorationIndex as number, { anchor: e.target.value as DecorationAnchor })}
                  className={cn(
                    'w-full rounded-md border px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500',
                    dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  )}
                >
                  {DECORATION_ANCHORS.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="宽" fieldKey="width_dip" dark={dark}>
                  <NumberSlider dark={dark} value={selected.width_dip} min={1} max={2000} unit="dip" onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { width_dip: v })} />
                </Field>
                <Field label="高" fieldKey="height_dip" dark={dark}>
                  <NumberSlider dark={dark} value={selected.height_dip} min={1} max={2000} unit="dip" onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { height_dip: v })} />
                </Field>
                <Field label="水平偏移" fieldKey="offset_x_dip" dark={dark}>
                  <NumberSlider dark={dark} value={selected.offset_x_dip ?? 0} min={-500} max={500} unit="dip" onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { offset_x_dip: v })} />
                </Field>
                <Field label="垂直偏移" fieldKey="offset_y_dip" dark={dark}>
                  <NumberSlider dark={dark} value={selected.offset_y_dip ?? 0} min={-500} max={500} unit="dip" onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { offset_y_dip: v })} />
                </Field>
              </div>
              <Field label="层级" fieldKey="z_index" dark={dark} hint="数字大的盖在上面。">
                <NumberSlider dark={dark} value={selected.z_index ?? 2} min={0} max={10} onChange={v => onUpdateDecoration(selectedDecorationIndex as number, { z_index: v })} />
              </Field>
              <p className={cn('text-[10px] leading-relaxed', textMuted(dark))}>
                偏移正数向右向下。挂到卡片外的立绘，要在上方「窗口留白」里留出同样多的空间，否则会被窗口裁掉。
              </p>
            </div>
          )}
        </Section>

        <div className="px-4 py-3">
          <p className={cn('text-[10px] leading-relaxed', textFaint(dark))}>
            改动会自动保存到本地。导出的皮肤包与水杉 schema_version 2 完全对齐。
          </p>
        </div>
      </div>
    </div>
  );
};

/** 1~4 个值的数组编辑，逗号分隔。空项与非法项忽略，支持中间增删。 */
const NumberList: React.FC<{ values: number[]; dark: boolean; onChange: (v: number[]) => void }> = ({
  values,
  dark,
  onChange
}) => {
  // 文本框保留原始串，否则输入 "16," 的中间态会被立刻解析掉、光标跳走。
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? values.join(', ');
  return (
    <input
      type="text"
      value={shown}
      placeholder="留空"
      onChange={e => {
        const raw = e.target.value;
        setText(raw);
        const parsed = raw
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '')
          .map(Number)
          .filter(n => Number.isFinite(n));
        onChange(parsed);
      }}
      onBlur={() => setText(null)}
      className={cn(
        'w-full rounded-md border px-2.5 py-1.5 text-xs font-mono outline-none transition focus:border-emerald-500',
        dark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
      )}
    />
  );
};
