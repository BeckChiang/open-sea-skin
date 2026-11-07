# Open Sea Skin · Lab 分支说明（2.0.4）

这是 [open-sea-skin](https://github.com/d-dev0101/open-sea-skin)（MIT，作者 d-dev0101）1.2.7 的**重新构建版（fork）**，装在 DSH 桌面版的 `desktop` profile 里。首页与安装说明见 [`README.md`](README.md)，本文是该版本的技术说明。

上游只提供「海面 + 夕阳 + 玻璃界面」；本分支在它的地基上重做了五块：**负载驱动的波浪**、**真实天文的天色与星空**、**跟着会话变化的船队**、**可逐项取舍的性能开关**、**可折叠且带解释的设置面板**。

- 上游版本：1.2.7
- 本分支版本：**2.0.4**（2.0.0 是冻结基线；本文档是该版本的完整说明）
- 许可：MIT（见 `LICENSE`）；上游必须保留的署名见 `THIRD_PARTY_NOTICES.md`
- 开发位置：`C:\Users\<你>\DSH\plugins\open-sea-skin-lab`，profile 用 `link:` 安装
- 默认档：**画质「省电」（0.85× 像素比）+ 30 fps 上限**，夜间核显占用多数时候低于 20%

---

## 1. 一眼看懂装了什么

| 模块 | 做了什么 | 主要文件 |
|---|---|---|
| 海洋渲染 | three.js WebGPU + TSL 的 Gerstner 波海面、天空、云、1/4 分辨率泛光、渲染器内毛玻璃 | `shared/ocean.js` → `native-dist/ocean.js` |
| 波浪控制 | 浪高跟着「当前会话 token 吞吐」或「本会话累计消费」走，带缓动与波峰下限；超出上限时白冠与喷雾渐显 | `plugin/client.js`（`stepWave`） |
| 天文日照 | 本地 NOAA 星历：太阳高度/方位每秒重算，日出日落、月相照度、三条暮光线 | `shared/solar.js`、`shared/sky.js` |
| 星空 | 2851 颗真实恒星（HYG 子集，含星等与 B−V）、88 星座 150 条折线、银河带、流星 | `shared/stars-catalog.js`、`shared/stars-data.js`、`shared/ocean.js` |
| 船队 | 每个子智能体一艘船，切会话跟着变；离场距离在离场那一刻冻结 | `shared/ocean.js`、`plugin/client.js` |
| 设置面板 | 11 个折叠分组、搜索、每项一句解释、左右栏预览、默认快照 | `plugin/client.js` |

---

## 2. 安装

1. 装到 DSH 插件目录，二选一：
   ```powershell
   # 发布包（推荐）
   dsh plugin add github:BeckChiang/open-sea-skin

   # 或者从源码 clone（要改渲染代码时）
   git clone https://github.com/BeckChiang/open-sea-skin.git "$env:USERPROFILE\DSH\plugins\open-sea-skin"
   ```
2. 在 profile 里 `link:` 指向该目录（`C:\Users\<你>\.dsh\profiles\desktop\package.json`）：
   ```json
   "open-sea-skin": "link:C:/Users/<你>/DSH/plugins/open-sea-skin"
   ```
3. 重启桌面端或按 F5 刷新窗口。

**确认生效**：控制台第一行有 `[open-sea-skin] client lab-2.0.4` 与 `[open-sea-skin] ocean lab-2.0.4`。

---

## 3. 设置面板

右上角圆形按钮打开。面板顶部有搜索框，输入文字会只留下命中的行并展开对应分组；清空后恢复原状，且**每次打开都全部折叠**。

### 3.1 十一个分组

| 分组 | 内容 |
|---|---|
| 皮肤与界面 | 总开关 |
| 波浪 | 驱动方式（吞吐/金额/手动）、浪高、波峰下限、湍流半径、满额浪高、平滑、溢出增益 |
| 天空与日照 | 驱动模式（真实时钟/手动）、24 小时滑杆与「现在」、经纬度与定位、时区三档、月亮、日出日落/暮光读数 |
| 星空 | 星空距离（含穹顶比例）、星点大小、星星亮度、色温饱和、色温偏置、星等截止、星等衰减、光晕、底噪星场、闪烁速度/幅度、银河、夜色三档、白天也显示星空 |
| 星座 | 连线亮度、粗细、地面淡出高度、闪烁强度、闪烁速度、星芒阈值 |
| 流星 | 开关、频率、亮度 |
| 云 | 云量、漂移速度、不透明度 |
| 船与舰队 | 开关、散布、节奏、大小 |
| 毛玻璃 | 背景模糊总开关、不透明度、半径、六个形状、左右栏强度、**栏位预览**、性能模式 |
| 高级 | 画质档位、帧率上限、**运行读数**、泛光、把当前设置设为默认、恢复默认 |

### 3.2 性能档位到底改了什么

| 档位 | 像素比 | 目标帧率 | 说明 |
|---|---|---|---|
| 高 | 1.5× | 90 | 清晰优先，核显吃紧，建议高刷屏 |
| 平衡 | 1.0× | 60 | 折中 |
| 省电（默认） | 0.85× | 30 | 核显友好 |

选画质档位会把帧率上限一起设成该档建议值（高 90 / 平衡 60 / 省电 30），之后帧率仍可单独调。四档上限（30/60/90/120）高于屏幕刷新率时按刷新率跑；分辨率还会按实际帧耗时自适应缩放（`renderScale`），所以高档位在弱机上也未必糊。

**运行读数**在高级组里实时显示，例如：
`运行中：画质 省电 · 上限 30 fps · 渲染比例 0.58×（屏幕 1.0×） · 实测 30 fps`
——「运行中」是渲染器真实状态（来自 `__ossState()`），不是面板上请求的值。

### 3.3 毛玻璃只作用于左右侧栏

中间会话区**不参与**毛玻璃：它没有稳定的容器，任何估算都会盖在对话内容上。界面里也不再画任何分割线、不再压暗侧栏——皮肤只改每一栏的模糊，不改界面的层级与明暗。

| 栏位 | 界面位置 | 识别方式 |
| --- | --- | --- |
| 左侧栏 | 会话 / 项目列表 | `[data-slot="sidebar"]` → `.dshDesktopSidebarSurface` |
| 右侧栏 | 文件与预览面板 | `[data-rightbar-col]` → `.dshDesktopDetailsSurface` |

点「**预览左右栏范围（2.6 秒）**」会在屏幕上框出两栏真实区域，青色虚线框 = 量到的范围。

强度 0 或关掉该栏开关 = 那一栏不模糊。总开关关掉后两栏都不糊，但设置面板仍保留 9 px 底模糊，否则面板压在流动海面上读不清。

### 3.5 默认快照

高级组 →「把当前设置设为默认」：把眼下的整份设置存成默认（写入 `ossBaseline`），此后「恢复默认」优先读它，下方会显示「当前默认：内置值」或「当前默认：某日某时保存的快照」。重置会保留定位授权，不会清空经纬度。

---

## 4. 关键行为

- **星空跟太阳走**：`smoothstep(+6° → −2°)` 淡入淡出，淡到 0.4% 以下整层从绘制列表摘掉；白天默认不渲染，可在星空组打开「白天也显示星空」。
- **银河**：按银心高度决定可见度（下限 0.55），带内星点密度 ×(bandNear·1.4+1)，所以读起来是「星堆」而不是一层雾。
- **星座连线**：每条折线按星座名取相位，同一个星座整体呼吸；首末段 24% 淡出避免锯齿线头；像素下限按绘制缓冲高度算，缩放着也不会碎成虚线。
- **星点**：每颗星一个朝向相机的四边形（WebGPU 点精灵只能画方块），圆盘 + 柔光 + 亮星四芒；尺寸来自真实星等 `size = clamp(base · 10^(−k·mag), min, base)`。
- **手动时刻是时钟**：滑杆 0–1439 分钟，太阳与月亮按该时刻真实求解；每次刷新若处于手动模式，会重新落到当前时间。
- **超限**：`max(花费曲线, 吞吐曲线)`，空闲时花费照样生效；白冠与喷雾按 `dt·1.3` 缓动，不会突然叠加。

---

## 5. 构建与测试

```powershell
cd C:\Users\<你>\DSH\plugins\open-sea-skin-lab
node scripts/build-runtime.mjs            # shared/ + plugin/ → native-dist/
node tests/structure.test.mjs             # 每个文件单独跑，node --test 会 EPERM
```

`node:test` 单文件测试（6 个文件，113 条）：

| 文件 | 覆盖 |
|---|---|
| `tests/structure.test.mjs` | 61 条：模块、面板、着色器关键片段、设置接线、默认快照、三栏测量 |
| `tests/fleet.test.mjs` | 5 条：船数、离场、节奏 |
| `tests/stars.test.mjs` | 6 条：星表真实星等与颜色 |
| `tests/sky.test.mjs` | 14 条：色板连续性、暮光、夜空中性 |
| `tests/solar.test.mjs` | 14 条：日月星历、暮光次序、档位解析 |
| `tests/sky-astro.test.mjs` | 12 条：坐标变换与恒星时 |

当前：**113 条全绿**（structure 62 / fleet 5 / stars 6 / sky 14 / solar 14 / sky-astro 12）。

---

## 6. 已知限制

- **星表是静态的**：`shared/stars-catalog.js` 由 `scripts/gen-stars-catalog.mjs` 从 `d3-celestial` 的 HYG 派生（CC BY-SA 4.0），不会每次启动联网；要更新就重跑生成器再 `build-runtime.mjs`。
- **穹顶是立体投影的折射视角**：`θ' = 2·atan(tan(θ/2)/fold)`，`fold = 1+(星空距离−1)·穹顶比例`；设计目的是「把更多天装进同样的画幅且星座不变形」，不是鱼眼。
- **无头浏览器验不到真机观感**：本机无头 Edge 拿不到 WebGPU（回退软件 WebGL2），帧耗时只能看相对份额；面板与毛玻璃的真实效果需要真机 F5。
- **9 颗共享星**（Alpheratz、Elnath、Car/Pup/Vel、Ophiuchus/Serpens）会同时出现在两个星座里；不影响星座闪烁，暂不调整。
- **旧安装包已清理**：跨机中转目录只保留本基线包。

---

## 7. 目录

```
open-sea-skin-lab/
├── plugin/            # DSH 插件入口：index.js（资源服务）、client.js（面板与消息）
├── shared/            # 真正跑的逻辑：ocean.js、sky.js、solar.js、stars-*.js
├── native-dist/       # 构建产物（iframe 页面加载这份）
├── scripts/           # build-runtime.mjs、gen-stars-catalog.mjs
├── tests/             # 6 个 node:test 文件
├── docs/FORK.md       # 分叉决策与踩坑记录
└── README.md / README.zh.md / CHANGELOG.md / THIRD_PARTY_NOTICES.md
```
