import React from 'react';
import { SkinV2Config, AccessoryAnchor } from '../../types/skin';

interface ConfigPanelProps {
  config: SkinV2Config;
  onChange: (newConfig: SkinV2Config) => void;
  selectedAccessoryId: string | null;
  onSelectAccessory: (id: string | null) => void;
  onRemoveAccessory: (id: string) => void;
  isDarkMode?: boolean;
  layoutMode?: 'horizontal' | 'vertical';
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onChange,
  selectedAccessoryId,
  onSelectAccessory,
  onRemoveAccessory,
  isDarkMode = false,
  layoutMode = 'horizontal'
}) => {
  const isVertical = layoutMode === 'vertical';
  const candWin = (isVertical && config.vertical_candidate_window)
    ? config.vertical_candidate_window
    : config.candidate_window;
  const accessoriesList = (isVertical && config.vertical_accessories && config.vertical_accessories.length > 0)
    ? config.vertical_accessories
    : (config.accessories || []);

  const updateMeta = (field: string, val: any) => {
    onChange({
      ...config,
      meta: { ...config.meta, [field]: val }
    });
  };

  const updateCandidateWindow = (field: string, val: any) => {
    if (isVertical) {
      onChange({
        ...config,
        vertical_candidate_window: {
          ...(config.vertical_candidate_window || config.candidate_window),
          [field]: val
        }
      });
    } else {
      onChange({
        ...config,
        candidate_window: { ...config.candidate_window, [field]: val }
      });
    }
  };

  const updatePreedit = (field: string, val: any) => {
    onChange({
      ...config,
      preedit: { ...(config.preedit || {}), [field]: val }
    });
  };

  const updateCandidateItem = (field: string, val: any) => {
    onChange({
      ...config,
      candidate_item: { ...(config.candidate_item || {}), [field]: val }
    });
  };

  const updateHighlightItem = (field: string, val: any) => {
    onChange({
      ...config,
      highlight_item: { ...(config.highlight_item || {}), [field]: val }
    });
  };

  const updateAccessory = (id: string, field: string, val: any) => {
    if (isVertical && config.vertical_accessories && config.vertical_accessories.some(a => a.id === id)) {
      const nextAcc = config.vertical_accessories.map(acc => {
        if (acc.id === id) {
          return { ...acc, [field]: val };
        }
        return acc;
      });
      onChange({ ...config, vertical_accessories: nextAcc });
    } else {
      const nextAcc = (config.accessories || []).map(acc => {
        if (acc.id === id) {
          return { ...acc, [field]: val };
        }
        return acc;
      });
      onChange({ ...config, accessories: nextAcc });
    }
  };

  const selectedAcc = accessoriesList.find(a => a.id === selectedAccessoryId);

  return (
    <div className={`flex flex-col h-full border-l w-84 select-none overflow-y-auto transition-colors ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      {/* 选项卡标题 */}
      <div className={`p-4 border-b transition-colors ${
        isDarkMode ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <h2 className="text-sm font-semibold">样式与属性微调</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">即时调整字体、色值、间距与挂件参数</p>
      </div>

      <div className="p-4 space-y-6">
        {/* 元数据 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            皮肤元数据
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              <label className="text-slate-400">皮肤名称</label>
              <input
                type="text"
                value={config.meta.name}
                onChange={e => updateMeta('name', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 mt-1 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400">作者</label>
              <input
                type="text"
                value={config.meta.author}
                onChange={e => updateMeta('author', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 mt-1 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400">说明描述</label>
              <input
                type="text"
                value={config.meta.description}
                onChange={e => updateMeta('description', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 mt-1 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 窗口几何与间距 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            窗口与间距布局 ({isVertical ? '竖排' : '横排'})
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 flex justify-between">
                <span>窗口圆角 (Corner Radius)</span>
                <span>{candWin.corner_radius_dip || 0}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="32"
                value={candWin.corner_radius_dip || 0}
                onChange={e => updateCandidateWindow('corner_radius_dip', Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded appearance-none accent-emerald-500 mt-1.5"
              />
            </div>

            <div>
              <label className="text-slate-400 flex justify-between">
                <span>候选词间距 (Item Gap)</span>
                <span>{candWin.item_gap_dip || 12}px</span>
              </label>
              <input
                type="range"
                min="4"
                max="36"
                value={candWin.item_gap_dip || 12}
                onChange={e => updateCandidateWindow('item_gap_dip', Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded appearance-none accent-emerald-500 mt-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400">
                <label>窗口最小高度 (Min Height)</label>
                <span className="font-mono">{candWin.min_height_dip ?? 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                value={candWin.min_height_dip ?? 0}
                onChange={e => updateCandidateWindow('min_height_dip', Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded appearance-none accent-emerald-500 mt-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400">
                <label>窗口最小宽度 (Min Width)</label>
                <span className="font-mono">{candWin.min_width_dip ?? 0}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="600"
                value={candWin.min_width_dip ?? 0}
                onChange={e => updateCandidateWindow('min_width_dip', Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded appearance-none accent-emerald-500 mt-1.5"
              />
            </div>

            {!candWin.background_image && (
              <div>
                <label className="text-slate-400">纯色背景色</label>
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="color"
                    value={candWin.background_color || '#ffffff'}
                    onChange={e => updateCandidateWindow('background_color', e.target.value)}
                    className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={candWin.background_color || '#ffffff'}
                    onChange={e => updateCandidateWindow('background_color', e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 字体与配色 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            文字与配色方案
          </h3>

          <div className="space-y-3 text-xs">
            {/* 预编辑文字 */}
            <div>
              <label className="text-slate-400">预编辑区文字颜色 (Pinyin)</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={config.preedit?.text_color || '#334155'}
                  onChange={e => updatePreedit('text_color', e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={config.preedit?.text_color || '#334155'}
                  onChange={e => updatePreedit('text_color', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>

            {/* 候选词文字 */}
            <div>
              <label className="text-slate-400">普通候选词颜色</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={config.candidate_item?.text_color || '#0f172a'}
                  onChange={e => updateCandidateItem('text_color', e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={config.candidate_item?.text_color || '#0f172a'}
                  onChange={e => updateCandidateItem('text_color', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>

            {/* 序号颜色 */}
            <div>
              <label className="text-slate-400">数字序号颜色</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={config.candidate_item?.number_color || '#94a3b8'}
                  onChange={e => updateCandidateItem('number_color', e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={config.candidate_item?.number_color || '#94a3b8'}
                  onChange={e => updateCandidateItem('number_color', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>

            {/* 首选高亮色 */}
            <div>
              <label className="text-slate-400">首选项高亮颜色</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="color"
                  value={config.highlight_item?.text_color || '#2563eb'}
                  onChange={e => updateHighlightItem('text_color', e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={config.highlight_item?.text_color || '#2563eb'}
                  onChange={e => updateHighlightItem('text_color', e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 选中的挂件配置 */}
        {selectedAcc && (
          <div className="space-y-3 bg-slate-850 p-3 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                当前挂件: {selectedAcc.id}
              </h3>
              <button
                onClick={() => onRemoveAccessory(selectedAcc.id)}
                className="text-[11px] text-rose-400 hover:text-rose-300"
              >
                删除挂件
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-400">定位锚点 (Anchor)</label>
                <select
                  value={selectedAcc.anchor}
                  onChange={e => updateAccessory(selectedAcc.id, 'anchor', e.target.value as AccessoryAnchor)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 mt-1"
                >
                  <option value="top_left">左上角 (top_left)</option>
                  <option value="top_right">右上角 (top_right)</option>
                  <option value="bottom_left">左下角 (bottom_left)</option>
                  <option value="bottom_right">右下角 (bottom_right)</option>
                  <option value="center">中心 (center)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400">X 偏移 (DIP)</label>
                  <input
                    type="number"
                    value={selectedAcc.offset_dip.x}
                    onChange={e =>
                      updateAccessory(selectedAcc.id, 'offset_dip', {
                        ...selectedAcc.offset_dip,
                        x: Number(e.target.value)
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Y 偏移 (DIP)</label>
                  <input
                    type="number"
                    value={selectedAcc.offset_dip.y}
                    onChange={e =>
                      updateAccessory(selectedAcc.id, 'offset_dip', {
                        ...selectedAcc.offset_dip,
                        y: Number(e.target.value)
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400">图层顺序 (Z-Order)</label>
                <input
                  type="number"
                  value={selectedAcc.z_order}
                  onChange={e => updateAccessory(selectedAcc.id, 'z_order', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 mt-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
