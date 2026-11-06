# Open Sea Skin · Lab 分支说明（1.5.24）

这是 [open-sea-skin](https://github.com/d-dev0101/open-sea-skin)（MIT，作者 d-dev0101）1.2.7 的**个人分支**，装在 DSH 桌面版的 `desktop` profile 里。
上游只提供「海洋 + 夕阳 + 玻璃界面」；本分支在它的地基上加了三块：**负载驱动的波浪**、**真实天文的天色与星空**、**跟着会话变化的船队**，并把所有能调的参数搬进了设置面板。

- 上游版本：1.2.7（`plugin/client.js` 与 `native-dist/*` 原样起步）
- 本分支版本：**1.5.24**
- 许可证：MIT（见 `LICENSE`；上游必须保留的署名见 `THIRD_PARTY_NOTICES.md`）
- 只在这台机器的 `C:\Users\recko\DSH\plugins\open-sea-skin-lab` 开发，profile 用 `link:` 安装

---

## 1. 一眼看懂装了什么

| 模块 | 做了什么 | 主要文件 |
|---|---|---|
| 海洋渲染 | three.js WebGPU + TSL 的 Gerstner 波海面、天空、云、bloom、渲染器内毛玻璃 | `shared/ocean.js` → `native-dist/ocean.js` |
| 波浪控制 | 浪高跟着「当前会话 token 吞吐」或「本会话累计消费」走，带缓动与波谷下限 | `plugin/client.js`（`stepWave`） |
| 天文日照 | 本地 NOAA 星历：太阳高度/方位每秒重算，日升日落时间、月相照度 | `shared/solar.js`、`shared/sky.js` |
| 星空 | 88 星座 743 条真实连线（d3-celestial 数据）、星点闪烁、十字星、流星，按本地恒星时转动 | `shared/stars-data.js`、`shared/sky-astro.js` |
| 船队 | 船数 = 本会话子智能体数（至少 1 艘），从画面两侧进出、随浪起伏、随浪调速 | `shared/ocean.js` §FLEET、`plugin/index.js` `/fleet` |
| 毛玻璃 | 三栏各自可开关与调档，两种实现（渲染器内 blur / CSS backdrop-filter） | `plugin/client.js`（`glassCss`/`blurCss`） |
| 界面 | 左下角按钮 + 十一组折叠面板（带搜索），深/浅色主题各自适配 | `plugin/client.js`（面板与 `uiCss`） |

---

## 2. 安装（另一台机器）

前提：目标机器有 DSH 桌面版（Windows/macOS），并且**没有**装官方 `open-sea-skin`（装了也没关系，下一步会先卸）。

```powershell
# 1. 解压到任意位置（不要放进同步盘的 DSH 工作区根目录以外也可以，但路径不要含中文空格）
Expand-Archive .\open-sea-skin-lab-1.5.24.zip -DestinationPath C:\Users\<你>\DSH\plugins\

# 2. 如果装过官方版，先卸掉（同一个包名，只能存在一个）
#    在 DSH 里让它执行 plugin_manager remove_bundle open-sea-skin

# 3. 用 link: 指向解压后的目录（绝对路径，正斜杠）
#    plugin_manager install_bundle  target = link:C:/Users/<你>/DSH/plugins/open-sea-skin-lab

# 4. 完全退出桌面端再打开（宿主半边 plugin/index.js 只在启动时加载）
# 5. 打开后按 F5（渲染半边 ocean.js 由 iframe 加载，刷新即换）
```

验收三条：

1. 左下角出现海洋图标按钮，点开有十一组折叠面板（顶部还有搜索框）；
2. 面板「天空控制」里能看到「今日 日出 …· 日落 …」；
3. 控制台（`Ctrl+Shift+I`）第一行有 `[open-sea-skin] client lab-1.5.24` 与 `[open-sea-skin] ocean lab-1.5.24`。

> 只改渲染半边（`shared/ocean.js` 等）时，F5 就够；改了宿主半边（`plugin/index.js`）必须**完全退出重开**，或者在装了 `dsh-unlag` 的情况下点它的刷新按钮。

---

## 3. 目录结构

```
open-sea-skin-lab/
├─ plugin/
│  ├─ index.js         宿主半：注册静态路由 /open-sea-skin/*，暴露 /open-sea-skin/fleet
│  └─ client.js        浏览器半：注入 glass/style、iframe、设置面板、波浪与船数引擎、指标桥
├─ shared/             真正的源（改这里）
│  ├─ ocean.js         海面/天空/星空/船/毛玻璃的全部渲染逻辑
│  ├─ solar.js         太阳与月亮位置、日升日落时间
│  ├─ sky.js           按太阳高度给出的三段色板（夜/黄昏/昼）
│  ├─ sky-astro.js     恒星时、赤道→地平坐标、星座顶点去重、亮度
│  ├─ stars-data.js    88 星座折线数据（d3-celestial，BSD-3-Clause）
│  └─ styles.css       皮肤在非 skin 页面用的样式
├─ native-dist/        构建产物（由 scripts/build-runtime.mjs 生成，不要手改）
├─ scripts/build-runtime.mjs   把 shared/ 里 6 个文件复制进 native-dist/
├─ tests/              node:test 单文件测试（6 个文件，79 条）
├─ docs/
│  ├─ CONTRACT.md      面板 ↔ 渲染端 ↔ 宿主的接口契约（改消息先读它）
│  └─ FORK.md          为什么这样分叉、怎么构建、怎么回退
├─ package.json        版本号与打包白名单（files）
└─ CHANGELOG.md        逐版变更
```

**关键约定：`native-dist/` 是产物。** 改 `shared/ocean.js` 之后必须跑构建；只改 `plugin/client.js` 不用构建，但要 F5。

---

## 4. 设置面板一览

按钮在对话输入框左下角（跟随侧边栏底部对齐）。**十一组折叠面板**，全部实时生效并写进 `localStorage`；顶部搜索框按名字过滤（中文/英文都行，命中项所在的组会自动展开，没命中的组整组收起）。「恢复默认」在最后一组里。

下面按组列出：范围与默认值就是代码里的 `DEFAULTS`，改完不需要 F5。

### 皮肤与界面
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 启用 | 开/关 | 开 | 关掉会移除海面与玻璃效果 |
| 面板不透明度 | 40–90% | 72% | 只影响本面板自身 |

### 波浪
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 来源 | 手动/吞吐/金额 | 吞吐 | 吞吐=运行中按 tok/s；金额=空闲时按本会话累计消费 |
| 手动浪高 | 0–100 | 45 | 仅在「手动」下有效 |
| 波谷下限 | 0–60 | 25 | 浪再小也保留的海况 |
| 吞吐参考 | 1–200 tok/s | 25 | 达到该速率时浪高到半程 |
| 满浪金额 | ¥1–100 | ¥10 | 消费到此金额时满浪 |
| 平滑时间 | 2–8 s | 4 s | 吞吐 EMA 与状态判定用的时间常数 |

面板底部那行会打印实时读数：`来源吞吐 · 消费 ¥0.1234（满浪 ¥10）· 吞吐 18 tok/s · 浪 42`，以及「指标桥 N 次 · Xs 前」。指标桥若显示「未挂载」，说明宿主的 slots 服务没拿到，输出会给出原因码。

### 天空与日照
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 时间来源 | 真实/手动 | 真实 | 真实=按系统时刻与经纬度秒级重算；手动=用滑杆直接给太阳高度 |
| 手动时间 | 0–100 | 55 | 手动模式下的太阳高度（-18°…60°） |
| 纬度 / 经度 | ±90 / ±180 | 空（未定位） | 空=还没定位；首次打开会静默要一次浏览器定位，失败不影响渲染 |
| 使用我的位置 | 按钮 | — | 重新读浏览器定位 |
| 时区 | 本机/按经度/手动 | 本机 | **只影响读数显示，不影响天文**：天空永远是「此刻此地」的真实样子 |
| 手动时区 | −12…+14 | +8 | 时区=手动时用它换算「该地时刻」 |
| 月亮 | 开/关 | 开 | 只在高度 >0 且亮面 >0.2% 时绘制 |

读数区（同一屏内，不需要展开别处）：`本机 21:04 · 该地 21:04`、`太阳 高度 -32.4° · 方位 312°`、`日出 06:18 / 日落 17:01`、`暮光 民用 05:49 / 17:30 · 航海 05:20 / 17:59 · 天文 04:51 / 18:28`、月亮高度/相位。

### 星空
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 星空距离 | 0.6–3.0× | **2.0×** | 2.0 时画面里能装下 18–22 个星座 |
| 穹顶比例 | 0–100% | 55% | 距离怎么生效：0=旧式「整体缩小」，100=完全立体投影（保角，星座不走形） |
| 星星亮度 | 0–200% | 100% | 100% 等于 1.5.22 的「中」档，可作为亮度总闸 |
| 星点大小 | 1–14 px | 5.4 | 主星点直径 |
| 亮星增益 | 0–2 | 1.0 | 只放大亮星（按顶点级数），让亮暗层次更明显 |
| 光晕 | 0–2 | 0.28 | 主星点外面那层柔光 |
| 底噪星场 | 0–2 | 1.0 | 程序化撒的背景星（不是星座顶点）；2.0 时接近真实银河密度 |
| 闪烁速度 | 0.1–4 | 1.5 | 每秒闪烁相位 |
| 闪烁幅度 | 0–90% | 30% | 0=完全不闪 |
| 银河 | 0–2 | 0.35 | 沿银道面的淡带 |
| 夜色 | 真实黑/深蓝/暖夜 | 真实黑 | 只对夜段乘色：真实黑保持中性，深蓝偏冷，暖夜偏黄 |

### 星座
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 连线亮度 | 0–200% | 100% | 743 条真实连线 |
| 十字星 | 0–200% | 100% | 每个星座顶点上的闪烁十字 |
| 连线粗细 | 0.2–4× | 1.0× | 腿宽倍数 |
| 地平淡出 | 3–45° | 14° | 高度低于该角度的连线渐隐，避免糊在海天交界 |

### 流星
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 流星 | 开/关 | 开 | 只在画面可见天区内随机出现 |
| 频率 | 0.1–6× | 1.0× | 1.0≈每 2.5–7.5 s 一颗；6× 是「流星雨」 |
| 亮度 | 0.2–3× | 1.0× | 头部亮点与拖尾强度；12% 概率是带长尾的火流星 |

### 云
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 云量 | 0–100% | 55% | 55% 与上游 1.2.7 逐位等价 |
| 漂移速度 | 0–4× | 1.0× | 0=冻结 |
| 不透明度 | 0–150% | 100% | 云的浓度上限 |

### 船与舰队
| 项 | 范围 | 默认 | 说明 |
|---|---|---|---|
| 启用 | 开/关 | 开 | 关掉整层船 |
| 横向范围 | 0.2–3.0× | **2.0×** | 航道摆幅；会按「该深度能容纳的画面半宽 ×92%」截断 |
| 航速 | 0.3–2.5× | 1.0× | 兜圈快慢（浪大时另有加速） |
| 船的大小 | 1.4–4.6× | **2.5×** | 船体视觉尺寸 |

船数规则：**本会话的子智能体数**，至少 1 艘；切会话会跟着变（切换后 600 ms 落定，避免快速扫侧边栏时船被反复召回）。读数是 `本会话 3 个子智能体，0 个正在运行（会话 060cb1 · 海面 3/3 · 0.87,0.86 …）`：括号里是渲染端自报的「已画/目标」与逐船屏幕坐标；一旦渲染端报错，会追加 `· 船层报错 <原因>`。

### 毛玻璃
| 项 | 选项 | 默认 | 说明 |
|---|---|---|---|
| 实现方式 | 渲染器内/CSS | 渲染器内 | 渲染器内=在 three.js 后处理里对三栏区域做模糊；CSS=用 `backdrop-filter` |
| 面板不透明度 | 40–90% | 72% | 面板自身 |
| 模糊半径 | 0–24 px | 14 px | 真实的模糊半径（渲染器内映射到 9-tap 的采样间距，CSS 模式直接当 px 用） |
| 左/中/右栏 | 开关 + 0–100% | 开/40%·60%·40% | 每栏的强度是模糊混合权重，不再是四档硬跳 |
| 高性能模式 | 开/关 | 关 | 关掉所有模糊，只留半透明 |

### 高级
| 项 | 说明 |
|---|---|
| 恢复默认 | 全部参数回 `DEFAULTS`（等于手动清 `localStorage` 的 `oss*` 键） |

---

## 5. 开发与验证

```powershell
cd plugins\open-sea-skin-lab

node --check shared\ocean.js          # 改完先过语法
node --check plugin\client.js
node scripts\build-runtime.mjs        # shared/ → native-dist/
node scripts\build-runtime.mjs --check   # 只核对是否一致

# 测试：必须单文件直跑（本机 sandbox 下 `node --test tests/` 会 spawn EPERM）
node tests\structure.test.mjs
node tests\fleet.test.mjs
node tests\sky.test.mjs
node tests\solar.test.mjs
node tests\stars.test.mjs
node tests\sky-astro.test.mjs
```

当前：**79 条全绿**（structure 30 / fleet 5 / sky 13 / solar 14 / stars 5 / sky-astro 12）。

`tests/structure.test.mjs` 是本项目的防线，里面有几次真实事故的回归断言：

- 常量在声明前被使用（1.5.13 把船层永久关掉）；
- 模块级集合被重新赋值（`boatSpots = []` 而非 `.length = 0`）；
- 星座连线必须两两成对消费点表（1.5.18 连出 149 条跨星座假线）；
- 半透明 token 只能覆写在 `#root`，不能覆写 `body`（否则 body 上的浮层跟着变透明）。

---

## 6. 诊断手册

| 现象 | 先看什么 |
|---|---|
| 面板里没有新控件/读数全空 | 控制台第一行构建戳是不是当前版本；不是就 `Ctrl+Shift+R` 硬刷新 |
| 船数不对 | 面板「船」行的 `x/y`：`3/3` 说明渲染端画了 3 艘；再去控制台看有没有 `boats disabled` |
| 船一艘都没有 | 面板出现 `· 船层报错 …`；否则看 `/open-sea-skin/fleet?session=<id>` 返回的 `children` |
| 天色不对 | 先切「手动」拖到最左（纯 CPU 调色板，夜天色样），能区分「色板问题」和「时钟问题」 |
| 星空不出现 | 白天/月亮太亮都会淡出，属正常；看「星星亮度」与面板的太阳高度读数 |
| 卡顿 | 先开「高性能模式」；仍卡就把「星空距离」调回 1.0、星座降到低 |

浏览器里可直接读渲染端状态：在 iframe 控制台执行 `window.__ossState()`，返回 `sea / seaGoal / sun* / moon* / starOpacity / boats / boatTarget / boatSpots / boatError / skyDist / renderScale …`。它每 400 ms 也会以 `oss-state` 消息推给父页面，面板读数就是靠这个。

服务端接口（宿主插件提供）：

```
GET /open-sea-skin/fleet?session=<sessionId>
→ { ok, sessionId, running, ships, children, childStates, members,
    services: { subagents, sessionQuery, agents, agentTeams } }
```

`running` 用 `sessionQuery.observeSession(childId)` 读 `subagentTiming.active` 判定（有未结束回合），结果缓存 2.5 s 并显式释放；船数本身用 `children.length`。

---

## 7. 已知限制

- **方位折进 ±40°**：太阳/月亮方位被压进视轴 ±40°，否则 55–60° 视场装不下一天 131° 的横扫。高度是真实的（0–28° 原样，28–90° 压到 28–38°）。要完全真实只能上鱼眼，海面会畸变，暂未做。
- **星空距离是穹顶投影，不是把相机拉远**：拉远不改变角位置，压不了视野。1.5.23 起改成绕视轴的立体投影 `r = 2tan(θ/2)` 再按「穹顶比例」与旧的缩小方式混合，星座形状保角（只在画面最外圈有约 10% 的径向拉伸），星点仍是原生像素。
- **星星还没有真实星等**：`shared/stars-data.js` 只有星座连线，没有每颗星的星等与色温。要加得先拿到 HYG/BSC5 星表（`d3-celestial` 的 `stars.6.json` 约 640 KB），而本机沙箱不通外网、只能走 `web_fetch` 整包拉进上下文，代价过大。所以 1.5.23 的「亮星增益/星点大小/光晕」是按**星座顶点的连线数**分级的近似，不是真实星等；面板也没有放会空转的星等旋钮。
- **船走的是世界坐标航道**：极端窗口高度下仍可能被对话栏挡住一部分；曾试过「屏幕空间摆放」，因为依赖面板测量而反复出错，已回退（见 `docs/FORK.md`）。
- **只做 skin 模式**：非 skin 页面仍按上游那套舞台渲染。

---

## 8. 回退到官方 1.2.7

```powershell
# 在 DSH 里执行
plugin_manager remove_bundle open-sea-skin
plugin_manager install_bundle target = open-sea-skin@1.2.7
# 然后完全退出桌面端重开
```

本分支没有改 profile 之外的任何东西；`localStorage` 里的键都以 `oss` 开头（`ossSea`/`ossGlass`/`ossBoats`…），旧版本会忽略它们。

---

## 9. 许可与致谢

- 上游：open-sea-skin © d-dev0101，MIT。
- 星座数据：d3-celestial `constellations.lines.json`，BSD-3-Clause，已随包附带（`shared/stars-data.js`），署名见 `THIRD_PARTY_NOTICES.md`。
- three.js 0.178（WebGPU/TSL）随包在 `native-dist/vendor/`。
- 本分支的改动同样以 MIT 发布。
