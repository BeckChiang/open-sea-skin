# Changelog

All notable changes to Open Sea Skin are documented here.

## 1.5.7 — 2026-11-06

### Changed
- 星座的端点星有了自己的光晕层：原来连线的顶点只是一颗和背景同亮度的 1 px 点，整片天空看起来像没星星的直线网格。
- 星座连线加亮并换成偏蓝白，星点从 3.6 提到 5.4。
- 船重新回到画面里可见的那片水：泊位从 26–44 单位拉近到 18–27（对话栏底边以下），缩放 2.8 → 2.1，三艘同时可见。

### Fixed
- 「只看到一艘船」：泊位落在对话栏背后，现在落在卡片下方的开阔水面上。

## 1.5.6 — 2026-11-06

### Changed
- 海面不再按页面空隙分配航道：整幅画面都是可航行的水域，船可能驶过对话栏背后，这是真实海面的样子。设置面板「船」那行仍会印出每艘船的屏幕坐标，便于核对。

## 1.5.5 — 2026-11-06

### 修复 / Fixed

- **面板显示 3 艘、画面上只有 1 艘**：三艘船都确实在渲染，但中间那条航道正好落在对话栏后面——船画在被面板遮住的地方，看上去就是数量不对。页面现在把自己的布局空隙（侧边栏与对话栏之间、对话栏右侧）通过 `oss-bands` 报给海面，航道按空隙分配，船一律走在能看见的那几列海面上。

## 1.5.4 — 2026-11-06

### 修复 / Fixed

- **快速切会话时船会突然出现或消失**：每停在一个会话上就立刻按那个会话的名册重排，来回扫过侧边栏时船被反复召回/丢弃。现在切换要停留 600 ms（`FLEET_SETTLE_MS`）才认，只有最后停留的窗口决定船数。
- **被召回时换边**：船已驶出并被丢弃后，同一序号再被需要时原来固定从自己那一侧重新入场，若刚才是从另一侧出去的，看起来就是从另一头凭空出现。现在记住离开的那一侧（`lane.exitFrom`），从原路回来。

## 1.5.3 — 2026-11-06

### 修复 / Fixed

- **天空组一个字都不显示**：面板用 `readOceanState()` 去读海面帧的 `__ossState()`，但那个 `frame` 变量是控制器创建时取的一次快照，iframe 还没挂上，永远是 `null`（另外帧与面板是不同 origin，直接读也会被拦）。现在每 400 ms 由帧主动 `postMessage({ type: 'oss-state' })` 上报自己的状态，面板优先直读、读不到就用最近一次上报 —— 太阳高度/方位、日出日落、月相、船的实际数量都走这条路。

## 1.5.2 — 2026-11-06

### 修复 / Fixed

- **面板读数全是空的、浪也不动**：`pid()` 被写在 `mountUi` 里面，而几个读数函数在它外面，于是每 250 ms 的波浪 tick 都在 `refreshSunReadout` 抛 `ReferenceError: pid is not defined`，整个 tick 就此中断——波浪引擎既没发值，读数也没更新。`pid` 提到模块作用域，并加一条结构测试守住（`structure.test.mjs` 第 18 条）。

- **船贴着画面底边**：相机上扬 8° 后海面只占画面下三分之一，原来的 15–25 单位泊位落在 84%–97% 高度。泊位外推到 36–52 单位、船体缩放 2.2→3.2，船回到地平线下方一带。
- **没有子智能体的会话连保底一艘都没有**：`count === 0` 被当成「关船」发出去（`off: true`），与面板文案「保留 1 艘」自相矛盾。现在 `off` 只由「船」开关决定，`count` 至少 1。
- **悬停预览仍然透底**：真正的病因是把 `--dsw-alias-bg-*` 覆写在 `body` 上，`body` 下的 portal（「已编辑 N 个文件」卡片、tooltip、dialog）继承了玻璃底色。现在 token 只覆写在 `#root` 上，portal 保留主题原本的不透明色；上一轮针对 `data-hovercard-bridge` 的单点补丁已回退。

### 变更 / Changed

- 面板「船」那行在数量后追加诊断读数 `（会话 xxxxxx · 海面 实际/目标）`，用来分辨「名册不对」还是「消息没送到」。

## 1.5.1 — 2026-11-06

### 修复 / Fixed

- **太阳月亮不再自己漂**：skin 模式关掉 `OrbitControls.autoRotate`（相机自转会让天体横向漂移）；相机上扬改为写进 `controls.target`（原来的 `camera.rotation.x` 每次 `update()` 都被重算覆盖，8° 上扬实际没生效，`maxPolarAngle` 也把仰角钳回 0°）。
- **画面更像真实天象**：fov 55→60、上扬 10°，可见天区 −20°..40°，地平线下移到画面下三分之一；真实高度 0..30° 原样透传，30°..90° 压进 30°..39°。今天 15:50 武汉实测太阳 18.8° / 方位 237°，落在画面 65% 高度处。
- **白天天空不再灰**：`DAY` 地平线色从接近灰的 `[0.52,0.68,0.82]` 改成饱和蓝 `[0.36,0.60,0.90]`；云色不再用写死的亮灰，改取地平线色（白天偏蓝、黄昏自动变暖），云层不透明度略降。
- **黄昏晚霞**：天空着色器新增按「太阳方位 + 低太阳 + 近地平线」加权的暖色带，并用 `smoothstep(-0.16,0.03,uSunDir.y)` 门控，深夜地平线不会挂假晚霞。

### 新增 / Added

- **设置面板适配深浅色**：浅色 shell 下面板改成浅色玻璃、深色文字，滑杆/分段控件/输入框同步换色（原先只有深色一套，浅色下白字压白底）。
- **悬停预览可读**：已改动文件的悬停预览卡与 tooltip 是 body portal，用同一套半透明 token 时能透出下面的正文；现在把 token 叠在不透明底上（深色 `#0c1118` / 浅色 `#fbfcfe`），保留主题色但不再透字。
- 日照组改名为「天空控制」（英文 `Sky`）。

## 1.5.0 — 2026-11-06

### 新增 / Added

- 日照改为「真实高度 + 相机上扬」：相机上扬 8° 后可见天区约 −20°..34°，太阳/月亮在 0..16° 时**原样使用真实高度**，只有 16°..90° 才压进 16°..32°，不再整天钉在画面同一条线上，也不会飘出画面；方位仍然折进画面（正东→左缘、正西→右缘）。
- 月亮：同一套映射，月盘放大到 1.0°、亮面倍数提高，相位明暗界线按真实朔望计算；面板新增月亮读数（月相名称 / 亮面百分比 / 高度角，地平线下会明说）。
- 星座：显示真实的 88 个星座连线与顶点恒星（d3-celestial 数据，BSD-3-Clause），星点加大并带闪烁与冷暖色差；连线亮度受新设置项「星座连线」控制（关 / 少 / 中 / 多）。
- 流星：新增「流星」开关，关闭后不再生成。

### 修复 / Fixed

- `__ossState()` 里 `stars` 键被星级不透明度覆盖，改为 `stars`（档位名）+ `starOpacity`（实际不透明度）。

## 1.4.1 — 2026-11-06

### 修复 / Fixed

- 切会话后船的数量要刷新界面才变：船数轮询改为由 250 ms 的波浪 tick 驱动（每 4 s 一次，会话 id 一变立刻重取），不再挂在单独容易失联的定时器上；`postFleet` 改成每次轮询都发，iframe 帧重载后能自愈；指标桥改为在渲染期写入，切会话第一拍即带新 `sessionId`。

## 1.4.0 — 2026-11-06

本地 fork（`plugins/open-sea-skin-lab`），在 1.2.7 基础上加功能，未改动上游 npm 包。

### 新增 / Added

- 真实日照：`shared/solar.js` 用 NOAA 公式按经纬度算太阳高度与方位；`shared/sky.js` 提供夜/晨昏/昼三段色板（0° 恰好等于原版黄昏，≤ −18° 全夜）；月亮按真实相位与地平高度出现，天顶有 88 个真实星座（含连线与闪烁）与流星。设置里可填经纬度，或按「使用我的位置」自动定位。
- 船：每个子智能体一艘（`/open-sea-skin/fleet` 由宿主半查询），至少保留一艘；从画面左右两侧驶入驶出，随 Gerstner 波面起伏，船头顺航向，多船自动避碰。
- 波浪随负载：按当前会话的 token 吞吐（输入+输出）或累计金额改变浪高，带波谷下限、参考值、平滑时间与曲线开关。
- 毛玻璃：渲染器内半分辨率 9-tap 模糊（比 CSS `backdrop-filter` 省性能），左/中/右三栏可分别开关与选档；另有 CSS 模式与「高性能模式」。
- 设置面板四组（皮肤 / 波浪 / 日照 / 毛玻璃），子智能体数量在「船」一行可读。

### 已修 / Fixed

- 夜天色板原来是「最暗只到黄昏」，凌晨仍是橙灰；现在按真实太阳高度过渡到深蓝夜色。
- 刷新后海面只剩一艘船（`postFleet` 会跳过未变化的数字，而 iframe 每次加载从一艘起步）。
- 船进出场原来靠缩放，看起来是凭空出现/消失；改成从画面两侧横着驶入驶出。

## 1.2.7 — 2026-11-01

### 修复 / Fixed

- 皮肤控制面板不再被宿主的浅色 dialog 样式染成白底白字；提高左下角按钮与说明文字对比度。感谢 #16 中的精确复现。
- 清除官方 Windows 侧栏内层重复背景，保留单层工作区玻璃；底部区域不再叠加填色。
- 按 Harness 0.2.1-rc.5 的真实 `main.conversation` 插槽适配输入卡片、消息气泡与代码卡片的专属颜色变量，保留圆角和代码高亮；不对其它插件做全局卡片覆盖。
- Keep Open Sea controls readable in either theme and restore translucent conversation surfaces on current Harness layouts.

### 优化 / Performance

- 合并波浪法线/浪峰计算，缓存重复的余弦与视线计算。部分采纳 @zdjmrq 的 #21 建议；原 PR 已由作者关闭，并未整体合并。
- WebGPU / WebGL2 均无渲染错误，固定场景最大色值差为 1/255；800 个时空/浪高样本与原公式一致。未进行 FPS 基准，不宣称固定提速比例。原海洋效果、Logo 与动态展示图保留。

### 兼容与发布 / Compatibility and delivery

- 核对官方最新发布通道 **0.2.1-rc.5**，新增可复跑的隔离运行时安装/加载/卸载检查；[测试边界与已知问题](docs/compatibility.md)。Windows 原生完整安装仍未实测。
- 新增中文优先的问题模板，更新官网与安装文档；GitHub 包和 npm 包分阶段发布时，明确哪个版本已可安装。
- npm 发布复用 GitHub 的同一份校验包，再比对 registry integrity 和 SHA-256，避免二次打包漂移。
- 远景高光闪烁（#19）与独立波浪速度（#22）仍在跟进，不计入本次已修复项。

## 1.2.6 — 2026-10-20

### 修复 / Fixed

- 将浮层背景与工作区玻璃值分离：插件广场使用的 overlay token 保持 97% 不透明度。
- 语义 dialog / alertdialog 与设置弹窗使用独立可读底色，覆盖 body portal 中的二级插件配置弹窗；不改遮罩、层级和海洋效果。感谢 #16 的复现信息。
- Keep overlay tokens and semantic modal cards legible independently of workspace glass opacity, including sibling-portalled plugin configuration dialogs.

### 验证范围 / Verification scope

- macOS / Windows 页面结构、浅深色、40% / 90% 工作区玻璃组合回归；确认工作区透明度与 shell overlay 不变，停用后样式清除。
- 核对官方 Harness 0.2.1-rc.2 安装文档及 Modal 结构。不是 Windows 原生安装或该新版完整实机兼容认证。
- 中文安装指引明确 npm 插件优先、社区市场可选、浏览器扩展不适用于桌面客户端。Logo 未修改。

## 1.2.5 — 2026-10-10

### Fixed

- Official DeepSeek Harness Desktop `0.2.0-rc.2` now paints one glass layer
  across the sidebar, conversation, and rightbar. The conversation's nested
  background no longer compounds opacity, while the composer remains readable.
- Official Desktop Settings stays opaque enough to read when workspace glass
  is set to its minimum 40%.

### Tested

- Installed the release package into an isolated official macOS Desktop
  `0.2.0-rc.2` profile with its bundled CLI and visually verified the shell.
- Added a 0.2.x shell regression fixture for macOS/Windows structure in light
  and dark modes. Windows is fixture-tested, not native Windows E2E-tested.

### Documentation

- Clarified the Desktop install path and distinguished the GitHub release from
  the older npm package currently available through registries.

## 1.2.4 — 2026-09-09

### Fixed

- Quick controls follow asynchronous Harness document-language changes in both
  Chinese and English, including accessibility labels, without losing focus or
  control state. The observer is removed on disposal. Thanks to @Max-Null for
  reporting the issue in #6; the fix lives in the shared source and all generated
  install targets.

### Documentation

- Recommend the prebuilt npm package to avoid Git transport failures during
  installation; explain why a `git ls-remote` error is not proof of a blocked
  build script (#8).

## 1.2.3 — 2026-09-07

### Fixed

- DSH Desktop advanced and extended layouts now paint a single shared glass
  background. The sidebar, conversation and details panes no longer differ
  in opacity due to transparent sidebar overrides and stacked conversation fills.
- Composer cards and dialogs retain their own backgrounds. Disabling or
  unloading Open Sea restores the desktop's original styles.

### Tested

- Desktop shell regression based on DSH Desktop Beta `2.0.5-beta.1`: 24
  combinations of layout, native material, light/dark mode and glass opacity,
  plus settings, text input, disable/re-enable and disposal in Chromium.
- The old `1.2.2` bundle fails this regression: at 40% glass the sidebar's
  effective opacity is 0%, while nested conversation fills reach 64%.

## 1.2.2 — 2026-09-01

### Added

- Quick-controls panel gains an enable toggle, an automatic day-cycle toggle,
  and a reset-to-defaults button. Disabling the skin now only tears down the
  ocean surface while keeping the button and panel, so the skin can always be
  re-enabled from the same page.
- Public npm publishing metadata and guarded release automation for DSH
  Desktop managed installation.

### Fixed

- Dragging the daylight slider now unchecks the automatic day-cycle toggle to
  match the persisted state.
- Native source integration now supports Harness `0.1.2-alpha.3` and its split
  client store, renderer, and session services.
- Browsers without WebGPU can use a capped low-end WebGL2 fallback instead of
  stopping at an unavailable screen.

## 1.2.1 — 2026-08-18

### Changed

- The Chrome/Edge extension is now Harness-only and no longer replaces the
  browser new-tab page.
- Loopback pages must match the DeepSeek Harness title, root element, and
  server-injected boot marker before the extension changes their DOM.
- Browser acceptance now proves that real Harness pages are skinned while a
  generic localhost app and an existing third-party new-tab homepage remain
  untouched.

## 1.2.0 — 2026-08-17

### Added

- A root `dsh.bundle` package that installs directly into DeepSeek Harness.
- Lower-left quick controls for wave size, daylight, glass opacity, and the
  automatic day/night cycle in the one-line DSH installation.
- A DeepSeek Harness-specific marketplace cover and four 40%-glass gallery
  animations covering dark mode, light mode, waves, and sunset.
- Host-route boundary tests for local renderer assets.

### Fixed

- Kept the native Settings dialog above the conversation composer at wide
  aspect ratios.
- Restored the lower-left Skin settings launcher and persisted every control.

## 1.1.0 — 2026-08-17

- Added the native Harness source integration, static installer, browser
  acceptance coverage, and bilingual 40%-glass gallery.

## 1.0.0 — 2026-08-14

- Initial Open Sea WebGPU showcase and Chrome/Edge extension.
