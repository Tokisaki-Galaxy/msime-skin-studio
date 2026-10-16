# 水杉输入法皮肤工坊

水杉输入法（MetasequoiaIME）`schema_version = 2` 外部皮肤的可视化编辑器与仿真器。无需 C++ 编译环境即可创作、调试、转换皮肤。

字段名、层级与取值范围对齐 `msime-windows/server/src/skin/candidate_skin_catalog.h`，导出的 `skin.toml` 能被水杉原样加载。

## 仿真精度

- 候选窗预览跑在独立 iframe 里，与真实页面同构：横竖排各自的页面头、`ui-html/webview2/candwnd/` 的六个内置皮肤 CSS、以及同一套 DOM（`.containerParent > .container > .row.pinyin / .row-wrapper > .row.cand`）。横排的翻译换行、竖排的翻译同行、翻页箭头、`.last-visible` 贴角都按各自页面还原。
- 顶部「渲染后端」可切换 WebView2 与 D2D 两套仿真，用来对照出厂默认后端与设计目标的差异。
  - WebView2 逐条对照 `server/src/webview2/windows_webview2_skin.cpp` 生成：九宫格边框、`content_insets_dip`（从面板外缘量起并扣掉边框宽度）、`outer_insets_dip`、`line_gap_dip`、自由挂件的锚点与 `z_index`、以及全部配色键。
  - D2D 逐条对照 `server/src/window/candidate_presenter.cpp`、`candidate_skin_overlay.cpp` 与 `ui/src/Layout.cpp` 的**决策**：`width_dip` 与 `fill` 被忽略、卡片底色描边圆角保留、`content_insets_dip` 不扣边框、`line_gap_dip` 作用到全部子元素、挂件拉成 `width x height` 不保比例、`z_index` 不分层。它复刻的是两个后端会不一样的地方，不是 D2D 的逐像素栅格化。
- `src/skins/` 下的 CSS 是从 `msime-windows` 拷来的副本。水杉那边改了基础皮肤，重新拷一次即可。

## 能力

1. 三套起手模板：纯色卡片、九宫格贴图面板加立绘、深色配色。
2. 可视化九宫格标定：拖动参考线调 `slice_dip`、`width_dip` 与 `outer_insets_dip`，绿色区域就是可拉伸区。
3. 自由挂件：层数不限，九种锚点，拖拽直接改 `offset_x_dip` / `offset_y_dip`（正数向右向下）。
4. 候选窗打字仿真：横竖排切换、深浅主题切换、WebView2 与 D2D 后端切换、候选词翻译开关、首选高亮、翻页箭头。
5. 搜狗皮肤（`.ssf`）导入：纯 JS 解密与解包，转成 v2 规范。
6. 一键导出：打包成 `<id>/skin.toml` + `<id>/assets/`，解压后直接放进水杉数据目录。

## 启动

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3322`。

## 部署

这是一个纯静态前端应用：没有 Worker 脚本、没有后端、不需要任何环境变量。SSF 解密、ZIP 打包、TOML 序列化全部在浏览器里完成，所以部署只需要托管构建产物。

### Cloudflare Workers（Git 集成）

在 Cloudflare 后台新建 Worker 并连上本仓库，构建配置：

| 项目 | 值 |
| --- | --- |
| 构建命令 | `pnpm build` |
| 部署命令 | `npx wrangler deploy`（默认值，无需修改） |
| 包管理器与 Node | 无需设置 |

包管理器与 Node 版本由 Cloudflare 自动检测：它读 `package.json` 的 `packageManager` 字段决定用哪个 pnpm，Node 则用构建环境自带的版本。本项目的构建日志里检测结果是 `pnpm@11.22.0` 与 `nodejs@24.18.0`，构建与部署都正常，所以不需要额外配环境变量。

提交到 `master` 会自动发布生产环境，其他分支生成预览 URL。部署命令读 `wrangler.toml` 里的 `[assets]`，把 `dist` 作为静态资源上传。

请求默认走 asset-first：命中静态文件就直接返回，不会唤起任何脚本。因此不消耗 Workers 免费版每天 100,000 次的「调用 Worker 脚本」额度，静态资源请求是免费无限的。

### Cloudflare Workers（Wrangler 直传）

不想让 Cloudflare 拉仓库时，用本地构建加直传：

```bash
pnpm build
pnpm exec wrangler deploy
```

需要 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 两个环境变量。注意同一个 Worker 在「Git 集成」与「本地直传」之间只能选一种部署路径，别同时用。

### 其他静态托管

Vercel、Netlify、GitHub Pages 等任何静态托管都能直接用，参数同上：构建 `pnpm build`，输出 `dist`。若部署在子路径（例如 GitHub Pages 的项目页），构建时需要加基路径：

```bash
pnpm exec vite build --base=/msime-skin-studio/
```

## 命令行批量转换

```bash
pnpm convert "C:\Users\username\Desktop\test.ssf" "./output"
```

产出 `./output/<id>/`，可以直接放进水杉的 `skins\` 目录。转换完会打印需要人工确认的项。

## 已知限制

- 水杉 v2 每个皮肤只有一张面板图，搜狗皮肤里独立的 `Scheme_H2` / `Scheme_V1` / `Scheme_V2` 只取 `Scheme_H1`。
- 搜狗 `customN_align` 的十个数只解出了第 6、8 位（0 = 左/上，2 = 右/下），其余位含义未知，挂件位置需要人工核对。
- 搜狗 `*_marge` 与窗口边距的精确关系尚未完全确认，复杂立绘皮肤的 `content_insets_dip` 可能要手工调。
- 模板内置的占位贴图是 SVG data URL，只方便浏览器预览。导出前请换成真正的 PNG。
