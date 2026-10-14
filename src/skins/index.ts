import { BuiltInSkin, LayoutMode, ThemeName } from '../types/skin';

// 水杉宿主在候选窗页面 <head> 里注入选中的内置皮肤 CSS，这里把同一批文件原样带进来。
// 用 Vite 的 ?raw 读取，改水杉那边的 CSS 只要重新拷一份过来。
import fluentHorizontalDark from '../skins/fluent/horizontal_dark.css?raw';
import fluentHorizontalLight from '../skins/fluent/horizontal_light.css?raw';
import fluentVerticalDark from '../skins/fluent/vertical_dark.css?raw';
import fluentVerticalLight from '../skins/fluent/vertical_light.css?raw';
import wechatHorizontalDark from '../skins/wechat/horizontal_dark.css?raw';
import wechatHorizontalLight from '../skins/wechat/horizontal_light.css?raw';
import wechatVerticalDark from '../skins/wechat/vertical_dark.css?raw';
import wechatVerticalLight from '../skins/wechat/vertical_light.css?raw';
import graphiteHorizontalDark from '../skins/graphite/horizontal_dark.css?raw';
import graphiteHorizontalLight from '../skins/graphite/horizontal_light.css?raw';
import graphiteVerticalDark from '../skins/graphite/vertical_dark.css?raw';
import graphiteVerticalLight from '../skins/graphite/vertical_light.css?raw';
import willowHorizontalDark from '../skins/willow_green/horizontal_dark.css?raw';
import willowHorizontalLight from '../skins/willow_green/horizontal_light.css?raw';
import willowVerticalDark from '../skins/willow_green/vertical_dark.css?raw';
import willowVerticalLight from '../skins/willow_green/vertical_light.css?raw';
import autumnHorizontalDark from '../skins/autumn_osmanthus/horizontal_dark.css?raw';
import autumnHorizontalLight from '../skins/autumn_osmanthus/horizontal_light.css?raw';
import autumnVerticalDark from '../skins/autumn_osmanthus/vertical_dark.css?raw';
import autumnVerticalLight from '../skins/autumn_osmanthus/vertical_light.css?raw';
import microsoftHorizontalDark from '../skins/microsoft/horizontal_dark.css?raw';
import microsoftHorizontalLight from '../skins/microsoft/horizontal_light.css?raw';
import microsoftVerticalDark from '../skins/microsoft/vertical_dark.css?raw';
import microsoftVerticalLight from '../skins/microsoft/vertical_light.css?raw';

const BASE_CSS: Record<BuiltInSkin, Record<LayoutMode, Record<ThemeName, string>>> = {
  fluent: {
    horizontal: { dark: fluentHorizontalDark, light: fluentHorizontalLight },
    vertical: { dark: fluentVerticalDark, light: fluentVerticalLight }
  },
  wechat: {
    horizontal: { dark: wechatHorizontalDark, light: wechatHorizontalLight },
    vertical: { dark: wechatVerticalDark, light: wechatVerticalLight }
  },
  graphite: {
    horizontal: { dark: graphiteHorizontalDark, light: graphiteHorizontalLight },
    vertical: { dark: graphiteVerticalDark, light: graphiteVerticalLight }
  },
  willow_green: {
    horizontal: { dark: willowHorizontalDark, light: willowHorizontalLight },
    vertical: { dark: willowVerticalDark, light: willowVerticalLight }
  },
  autumn_osmanthus: {
    horizontal: { dark: autumnHorizontalDark, light: autumnHorizontalLight },
    vertical: { dark: autumnVerticalDark, light: autumnVerticalLight }
  },
  microsoft: {
    horizontal: { dark: microsoftHorizontalDark, light: microsoftHorizontalLight },
    vertical: { dark: microsoftVerticalDark, light: microsoftVerticalLight }
  }
};

// 候选窗页面 <head> 里那段与皮肤无关的公共样式，逐条照抄 horizontal_candidate_window.html。
// 注意 `.cand .text` / `.cand-content` / `.cand-translation` 三条是**横排页头独有**的，
// 竖排页头没有，翻译在竖排里靠皮肤 CSS 的 margin-left 同行显示。所以它们由预览按布局分流，
// 这里只保留两个页面共有的翻页箭头部分。
export const SHARED_CANDIDATE_CSS = `
.page-arrows { display: none; }
html[data-page-arrows="on"] .page-arrows {
  display: flex; justify-content: flex-start; align-items: center; gap: 1px;
  margin: -1px 0 1px 0; user-select: none;
}
html[data-page-arrows="on"][data-candidate-layout="horizontal"] .page-arrows {
  display: inline-flex; vertical-align: bottom; margin: 0 1px 0.25em 2px;
}
.page-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 0.72em; height: 0.9em; border-radius: 3px;
  color: var(--cand-num, var(--cand-text)); cursor: default;
}
.page-arrow::before {
  content: ""; width: 0.28em; height: 0.28em; box-sizing: border-box;
  border: solid currentColor; border-width: 0 0 max(1.2px, 0.075em) max(1.2px, 0.075em);
  transform: translateX(0.07em) rotate(45deg);
}
.page-arrow-next::before { transform: translateX(-0.07em) rotate(-135deg); }
.page-arrow.disabled { opacity: 0.3; }
.hover-active .page-arrow:not(.disabled):hover { background: rgba(128, 128, 128, 0.22); }
`;

/** 横排页头独有的三条：翻译换到候选文字下方。竖排不注入。 */
export const HORIZONTAL_PAGE_CSS = `
.cand .text { display: flex; align-items: baseline; }
.cand-content { min-width: 0; }
.cand-translation { display: block; font-size: 0.78em; line-height: 1.25; opacity: 0.62; }
`;

export function baseSkinCss(base: BuiltInSkin, layout: LayoutMode, theme: ThemeName): string {
  return BASE_CSS[base]?.[layout]?.[theme] ?? BASE_CSS.fluent[layout][theme];
}
