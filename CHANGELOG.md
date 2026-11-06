# Changelog

All notable changes to Open Sea Skin are documented here.

## 1.5.24 — 2026-11-06

### Fixed

- **整片天空发灰（1.5.23 的回归）**。1.5.23 把三个档位表从 0..1 改成百分比（mid = 100），但 `uConstellation` 与 `uCrossGlow` 两个 uniform 仍按老表播种，值是 100 而不是 1：757 颗星的十字星臂长从 15 涨到 574，加法混合铺满天空；星座连线也被放大 100 倍，形成一层白色格栅。两处改为 `…_GRADES.mid / 100`。
- 顺带给「星空亮度/十字星」的 uniform 加了回归断言，避免百分比与 0..1 再次混用。
- `window.__ossDebug` 调试出口改为只在 URL 带 `?ossdebug=1` 时挂载（1.5.23 是无条件挂的）。

## 1.5.23 — 2026-11-06

### Added

- 设置面板从 5 组改成 **11 组可折叠 + 搜索框**：皮肤与界面 / 波浪 / 天空与日照 / 星空 / 星座 / 流星 / 云 / 船与舰队 / 毛玻璃 / 高级。所有旧的四档枚举都换成了连续滑杆。
- 天空与日照组新增读数区：本机时刻、该地时刻、太阳高度方位、日出日落、民用/航海/天文三条暮光线、月亮高度相位。
- 时区三档（本机 / 按经度推算 / 手动 UTC±），与经纬度一起决定读数的「该地时刻」。默认经纬度改为「未定位」，首屏静默请求一次浏览器定位。
- 星空组 11 个旋钮：星空距离（默认 2.0）、穹顶比例、星星亮度、星点大小、亮星增益、光晕、底噪星场、闪烁速度/幅度、银河、夜色三档。
- 星座组 4 个旋钮：连线亮度、十字星、连线粗细、地平淡出高度。
- 流星组：频率与亮度；新增流星**头部亮点**，12% 概率是带长尾的火流星。
- 云组：云量、漂移速度、不透明度。
- 毛玻璃：全局模糊半径 0–24 px（真实半径，不再是四档硬跳），三栏强度改为 0–100%。

### Changed

- 天色改为**全天连续**：白昼混合区间从 0…12° 拉到 0…90°，深夜不再冻结，加入了月光散射、气辉、银河底色。1 分钟内最大色板跳变 0.024（只发生在真实日出那一刻），夜间每小时都有可见变化。
- 暮光独立成轴：暮光强度随太阳高度平滑升降，新增**金星带**（背日侧粉带）与**地影**（地平线下暗蓝楔），朝霞偏冷白粉、晚霞偏深橙红。
- 星空距离从「整体缩小星座」改为**立体投影**（`r = 2tan(θ/2)`，保角），并按「穹顶比例」与旧方式混合；程序化星场跟着同一套投影展开，两层不再错位。
- 星星的闪烁速度/幅度、星点大小、光晕、连线粗细都变成实时 uniform，不再重建几何。
- 测试 79 条全绿（structure 30 / fleet 5 / sky 13 / solar 14 / stars 5 / sky-astro 12）。

### Known

- 还没有真实星等/色温：星表（约 640 KB）需要联网机器生成，本次未内置；「亮星增益」是按星座顶点连线数的近似。

## 1.5.22 — 2026-11-06

### Added

- 天空控制新增「星空距离」0.6–3.0 ×（默认 1）：把天球角度按视轴压缩，同一窗口能看到更多星座。1 = 原来的 60° 视锥。

### Changed

- 船的默认值改为用户指定：横向范围 2 ×、体积 2.5 ×。
- 横向摆幅按该深度能容纳的画面半宽 92% 截断，避免 2 × 时近处港口甩出画面。

## 1.5.21 — 2026-11-06

### Changed

- 回退 1.5.20 的「画面半宽比例」摆幅，恢复 1.5.3 的固定航道（`radiusRight` 6–20 世界单位）。
- 面板「船」组新增三个设置：**横向范围**（0.2–3.0 ×，默认 1 = 1.5.3 原样）、**航速**（0.3–2.5 ×，默认 1）、**船的大小**（1.4–4.6 ×，默认 2.8）。三者经 `oss-boats` 消息下发。

## 1.5.20 — 2026-11-06

### Changed

- 船的横向摆幅改为「画面半宽的比例（0.62–0.92）」而不是固定的 6–20 世界单位：泊位从 15–25 移到 26–44 之后，固定幅度会让三条船都只在画面中段兜圈。

## 1.5.19 — 2026-11-06

### Fixed

- 星座连线把「每条边存两次」的点表当作折线逐点连接，于是每个星座末尾与下一个星座开头之间被画出一条不存在的连线（共 149 条），星座形状因此明显不对；改为两两成对步进，按真实边绘制。
- 连线粗细从约 4 px 收到约 3 px。

## 1.5.18 — 2026-11-06

### Changed

- 星座连线改由两片软边四边形绘制（每段 8 顶点、中心线最亮、两缘归零），斜线不再锯齿。
- 星穹重算周期 5 秒 → 20 秒；星空已淡出时整段跳过，减少周期性长帧。
- 自适应分辨率：skin 模式最低比例 0.5 → 0.7，步长 0.97 / 1.015，改动后保持 8 秒，死区 ±6 FPS。
- 船位投影从每帧改为面板状态上报时按需计算（`boatSpotList()`）。

## 1.5.17 — 2026-11-06

### Changed

- **船的摆放与巡航整段回退到 1.5.3 的实现**（用户："重新阅读 1.5.3 的代码，那个时候船是正常的"）。
  1.5.4–1.5.16 期间为了"让三艘都看得见"做了三次改造（横向折叠、世界坐标泊位、屏幕空间反投影 + 可见水域导航道），
  每次都引入了新的副作用（画面外泊位、船舱被玻璃盖住、进出场凭空出现）。1.5.3 的版本是：

  - 世界坐标椭圆航道：`base = 26 + (index % 4) * 9 + Math.floor(index / 4) * 3`、`radiusRight = 6 + ((index * 3.7) % 14)`、`radiusBack = 2 + ((index * 2.3) % 6)`，每条船在自己的椭圆上绕圈，船头永远朝切线方向；
  - 进出场靠 `away` 横向位移 + `boatApproachOffset(ahead)` 按相机视锥算出的画面外距离，不用缩放做淡入淡出；
  - 避碰用世界单位 `BOAT_MIN_SEP = 7` 的两轮松弛，推挤写回各自航道；
  - 速度仍由浪决定（`cruise` + `surge` 读船头前方 `BOAT_PROBE = 2.4` 的坡度），缩放 2.8。

  保留 1.5.13/1.5.15 补上的两件事：`boatError` 会把船层崩溃写进面板读数（不再静默关层），以及
  `__ossState().boatSpots` 仍上报逐船屏幕坐标（1.5.3 的实现里用 `project()` 补回）。
  随之移除：`oss-water` 消息、`waterTop/waterLeft`、可见水域导航道、屏幕空间反投影与屏幕单位避碰。

## 1.5.16 — 2026-11-06

### Fixed

- **三艘都"画了"却只看得见一艘**：面板读数 `海面 3/3 · 0.87,0.86 0.16,0.91 0.8,0.94`。
  三艘确实都在画面里，但对话栏与输入框那块半透明玻璃盖住了 x>0.3 的部分，两艘只剩 28% 对比度，
  读不出来。现在客户端把"没被盖住的水域"整个量出来（左边界 = 对话栏左边，上边界 = 侧栏底边），
  `oss-water` 同时带 `top` 与 `left`；三条航道排在侧栏下方、对话栏左侧的那片可见水里，
  进出场也改成贴着这片水的左右边缘，不再钻到玻璃底下。

## 1.5.15 — 2026-11-06

### Fixed

- **船还是一艘都没有**：1.5.14 只补了常量，真正的第一处崩溃是
  `const boatSpots = []` 又被 `boatSpots = []` 重新赋值 —— 给常量赋值会抛
  `TypeError: Assignment to constant variable`，同样被 `animate()` 的 try 吞掉并把 `boats` 置空。
  改成 `boatSpots.length = 0`。
- 船层出错时把消息留给面板：`__ossState().boatError` 会带上异常文本，面板「船」那行直接显示
  「船层报错 …」，不用再开 DevTools 找那行被吞掉的警告。
- 新增结构测试「module-scope collections are mutated, never reassigned」：拿它跑 1.5.14 的代码会
  正好报出 `boatSpots`。

## 1.5.14 — 2026-11-06

### Fixed

- **一艘船都没有了**：1.5.13 重写 SECTION 10 时，`BOAT_ENTER_RATE`、`BOAT_EXIT_RATE`、
  `BOAT_PROBE` 三个常量的声明被连带删掉，函数体还在用它们。`animate()` 里
  `try { updateBoats(dt) } catch { boats = null }` 把 ReferenceError 吞了，于是把整个船层关掉、
  控制台只留一行警告——看起来就是"船全没了"。三个常量已补回。
- 新增结构测试「no constant is used before it is declared」：去掉注释和字符串后，源码里每个
  全大写常量都必须有声明或来自 import。拿它跑 1.5.13 的代码会正好报出这三个名字。

## 1.5.13 — 2026-11-06

### Fixed

- 船改成**屏幕空间摆放**：先在画面里定好每艘船的 (x, y)，再把这条视线反投影到海面。
  之前按"深度 + 横向"推算，面板一长、相机一倾，最远那艘就落到下沿外面（读数里 y=1.06），
  看上去永远只有一艘。现在越界在构造上就不可能发生。
- 客户端每次测量聊天栏底边（`oss-water`）报给海面，窗口大小、会话长短变了船就跟着挪。
- 船道不再集中在左下角：三条航道横跨可见宽度（amp 0.33–0.37，中轴 0.51/0.56/0.56）。

## 1.5.12 — 2026-11-06

### Changed
- 船恢复横向巡航：不再固定在左/中/右三个泊位，而是各自以 0.62–0.72 倍可见半宽为振幅、±0.06 为常驻偏移，左右扫过整个画面。
- 活动范围硬框在画面内：横向 ±0.78 半宽（折合屏幕 x 约 0.11–0.89），纵向深度夹在 17.5–24（折合屏幕 y 约 0.83–0.91），任何一侧都不会被画到画外。
- 深度改成三条带（19.5 / 21.1 / 22.7），三条航道不再挤在同一条线上。

## 1.5.11 — 2026-11-06

### Fixed
- 「十字星」档位点了没反应：cross 从 1.5.9 起只写在 DEFAULTS 里，没进 normalize() 的白名单，每次保存都被丢掉并回位到默认；现在补进白名单，档位既能存住也能立刻生效。
- 三艘船只有一艘在画面内：泊位深度 base + cos(angle) * radiusBack 会下探到 13 单位左右，投影后 y > 1（画面下沿以外）；现在把深度夹在 17.5–24，全部落在 83%–91% 画面高度。
- 流星一直看不到：原来在整片天球上随机生成，而画面只覆盖约 80° 方位、38° 高度，四分之三的流星落在身后；现在只在可见扇区生成（方位 ±30°、高度 13–33°），尾迹从 0.35 收到 0.18 更利落，亮度 1.4 → 2.6，间隔 4–13s → 3–9s。

## 1.5.10 — 2026-11-06

### Changed
- 船的帆与船体各提亮 1.75 / 1.5 倍、船体缩放 2.1 → 2.7：对话栏是 72% 不透明的玻璃膜，船落在它后面时对比度被吃掉大半，三艘看起来像一艘。

## 1.5.9 — 2026-11-06

### Added
- 天空控制新增「十字星」档位（关 / 弱 / 中 / 强）：每个星座顶点上那颗星画成闪烁的十字，档位同时决定亮度与臂长。默认「中」。

### Changed
- 十字星整体提亮：亮度系数 1.35 → 2.2，闪烁幅度 0.4 → 0.55，臂长按档位从 0.72 倍长到 1.14 倍。

## 1.5.8 — 2026-11-06

### Added
- 星座顶点画成闪烁的十字星：每个端点由两条短线段组成，按相机平面取向，避免透视压扁；每条臂按各自相位呼吸，读数才像星星而不是短线。

### Changed
- 船的泊位固定成左 / 中 / 右三处（±0.6 与 0，按可见半宽的比例），每艘只做小幅摆动，三艘不会再挤成一条线或叠成一艘。
- 泊位深度 18（±1.2），三艘都落在对话栏底边以下的开阔水面。

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
