# Open Sea Skin · Lab（2.0.3）

**实时海洋皮肤** —— 给 DeepSeek Harness 桌面版 / Web 用的一层会呼吸的海面：浪跟着你的会话负载起伏，天光按真实星历走，星空是真的星表，船是你正在跑的子智能体。

![version](https://img.shields.io/badge/version-2.0.3-138b8b) ![license](https://img.shields.io/badge/license-MIT-138b8b) ![upstream](https://img.shields.io/badge/upstream-d--dev0101%2Fopen--sea--skin-6c7f8a)

---

## 项目声明

本项目是基于 **[d-dev0101/open-sea-skin](https://github.com/d-dev0101/open-sea-skin)**（作者 **d-dev0101**，MIT 许可）**1.2.7** 版本**重新构建的 Lab 分支（fork）**，**不是上游官方版本**，也不由上游维护。

它沿用了上游的渲染底座（three.js WebGPU + TSL 的海面、天空、云与毛玻璃思路），在底座之上重做了海浪驱动、天文日照、星空、船队与整块设置面板，演进到 **2.0.3**。原生代码、着色器、面板与测试都由本仓库维护，出现的问题请提到**本仓库**而不是上游。

- 上游项目：[d-dev0101/open-sea-skin](https://github.com/d-dev0101/open-sea-skin) · 分叉起点：`v1.2.7`
- 上游许可：MIT，全文见 [`LICENSE`](LICENSE)；必须保留的第三方署名见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- 为什么分叉、改了什么、怎么回退上游：[`docs/FORK.md`](docs/FORK.md)
- 当前版本：**2.0.3**（tag `v2.0.3`；2.0.0 是冻结基线，tag `v2.0.0` 仍可安装）

---

## 相对上游 1.2.7 新增了什么

上游给的是一张会动的海面壁纸。本分支要它回答一个问题：**这片海能不能反映我正在做的事？** 一共五块。

| # | 能力 | 具体做了什么 |
|---|---|---|
| 1 | **负载驱动的波浪** | 浪高跟「当前会话 token 吞吐」或「本会话累计消费」走，带 EMA 平滑与波峰下限；超限时白冠与喷雾按 `dt·1.3` 渐显，不会突然叠加 |
| 2 | **真实天文的天色** | 本地 NOAA 星历每秒重算太阳高度/方位，日出日落、月相照度、三条暮光线（金星带 / 地影 / 朝晚不对称）都有；单曲线 `skyLight` 让天色全天连续，不会在某个时刻跳变 |
| 3 | **真实星空** | 2851 颗真实恒星（HYG 子集，含星等与 B−V）：按星等定尺寸、按色温上色、亮星带四芒、88 星座 150 条折线按星座整体呼吸；银河按银心高度决定可见度，带内星点密度加权；流星每帧推进 |
| 4 | **跟着会话走的船队** | 每个**运行中的子智能体**一艘船，切会话立即重排；船速来自浪（不是秒表），离场侧在离场那一刻冻结 |
| 5 | **能取舍的性能与面板** | 画质档位（高/平衡/省电）+ 帧率上限（30/60/90/120）+ 1/4 分辨率 9-tap 泛光；十一组可折叠面板 + 搜索 + 每项一句解释 + 每项持久化 + 默认快照。无头实测 **126 ms → 70 ms 一帧** |

几个数字上的差别（同一台核显机器）：

- 星空：上游无星表 → 本分支 2851 颗真实恒星、88 星座、150 条折线
- 面板：上游 4 组 → 本分支 **11 组**、可搜索、可存默认快照
- 画质：上游固定渲染比例 → 本分支三档画质 × 四档帧率上限，且按帧耗时自适应缩放
- 玻璃：只作用于**左右侧栏**，中间会话区不参与（不做估算式覆盖、不画分割线、不压暗界面）

> 完整逐项说明与 113 条测试覆盖见 [`README.zh.md`](README.zh.md)。

---

## 安装

本分支有两种装法：**发布包**（正常使用）或**本地 link**（要改渲染代码时）。

### 方式一：插件发布包（推荐）

本仓库符合 DSH 插件市场的收录形态：`package.json` 声明了 `dsh.bundle`（指向 `cordis.patch.yml`），预构建 tarball 挂在 [Releases](https://github.com/BeckChiang/open-sea-skin/releases) 上，仓库带 `dsh-plugin` topic。

```powershell
dsh plugin add github:BeckChiang/open-sea-skin
```

不想让本机走源码构建的话，用 Release 上的预构建包（免 `allowBuilds` 授权）：

```powershell
dsh plugin add https://github.com/BeckChiang/open-sea-skin/releases/download/v2.0.3/open-sea-skin-2.0.3.tgz
```

### 方式二：本地 link（改代码用）

1. 把仓库放到 DSH 插件目录：

   ```powershell
   git clone https://github.com/BeckChiang/open-sea-skin.git "$env:USERPROFILE\DSH\plugins\open-sea-skin"
   ```

2. 在 DSH profile 的 `package.json`（`%USERPROFILE%\.dsh\profiles\desktop\package.json`）里加 `link:` 依赖：

   ```json
   "open-sea-skin": "link:C:/Users/<你>/DSH/plugins/open-sea-skin"
   ```

3. 重启桌面端（改了宿主半 `plugin/index.js` 必须完全退出重开；只改客户端按 F5）。

**确认生效**：控制台第一行会出现

```text
[open-sea-skin] client lab-2.0.3
[open-sea-skin] ocean lab-2.0.3
```

---

## 设置面板

右上角圆形按钮打开，顶部搜索框按关键字过滤并自动展开命中的分组；每次打开都从全部折叠开始。

| 分组 | 里面有什么 |
|---|---|
| 皮肤与界面 | 总开关 |
| 波浪 | 驱动方式（吞吐/金额/手动）、浪高、波峰下限、湍流、满额浪高、平滑、溢出增益 |
| 天空与日照 | 驱动模式（真实时钟/手动）、24 小时滑杆与「现在」、经纬度与定位、时区三档、月亮、日出日落与暮光读数 |
| 星空 | 星空距离与穹顶比例、星点大小、亮度、色温饱和与偏置、星等截止与衰减、光晕、底噪星场、闪烁、银河、夜色三档、白天也显示星空 |
| 星座 | 连线亮度、粗细、地面淡出高度、闪烁强度与速度、星芒阈值 |
| 流星 | 开关、频率、亮度 |
| 云 | 云量、漂移速度、不透明度 |
| 船与舰队 | 开关、散布、节奏、大小 |
| 毛玻璃 | 总开关、不透明度、半径、六种形状、左右栏强度、栏位预览、性能模式 |
| 高级 | 画质档位、帧率上限、运行读数、泛光、把当前设置设为默认、恢复默认 |

### 性能档位

| 档位 | 像素比 | 目标帧率 | 说明 |
|---|---|---|---|
| 高 | 1.5× | 60 | 清晰优先，核显吃紧 |
| 平衡 | 1.0× | 45 | 折中 |
| 省电（默认） | 0.85× | 30 | 核显友好 |

帧率上限与画质档位相互独立，实际取两者中更省的那个；渲染比例还会按真实帧耗时自适应缩放。高级组里的**运行读数**显示的是渲染器真实状态，例如：

```text
运行中：画质 省电 · 上限 30 fps · 渲染比例 0.58×（屏幕 1.0×） · 实测 30 fps
```

---

## 构建与测试

```powershell
node scripts/build-runtime.mjs     # shared/ + plugin/ → native-dist/
node tests/structure.test.mjs      # 单文件跑（node --test 整目录在本机会 EPERM）
```

六个 `node:test` 文件、**113 条断言**：结构 62 / 船队 5 / 星表 6 / 天色 14 / 星历 14 / 坐标 12。

星表是静态派生文件，不联网：`node scripts/gen-stars-catalog.mjs` 从 `d3-celestial` 的 HYG 重新生成，再跑 `build-runtime.mjs`。

---

## 已知限制

- **星表静态**：2851 颗来自 HYG 子集（经 `d3-celestial`，CC BY-SA 4.0），更新需重跑生成器。
- **穹顶是立体投影**：`θ' = 2·atan(tan(θ/2)/fold)`，目的是把更多天装进同样画幅且星座不变形，不是鱼眼。
- **无头浏览器验不到真机观感**：无头 Edge 拿不到 WebGPU（回退软件 WebGL2），帧耗时只能看相对份额；面板与毛玻璃要在真机 F5 看。
- **9 颗共享星**（Alpheratz、Elnath、Car/Pup/Vel、Ophiuchus/Serpens）会同时出现在两个星座里，不影响闪烁。

---

## 目录

```text
open-sea-skin-lab/
├── plugin/       # DSH 插件入口：index.js（资源服务）、client.js（面板与消息）
├── shared/       # 真正跑的逻辑：ocean.js、sky.js、solar.js、stars-*.js
├── native-dist/  # 构建产物（iframe 页面加载这份）
├── scripts/      # build-runtime.mjs、gen-stars-catalog.mjs
├── tests/        # 6 个 node:test 文件
├── docs/         # FORK.md（分叉决策与踩坑）、CONTRACT.md（消息契约）
└── README.md / README.zh.md / README.en.md / CHANGELOG.md
```

---

## 许可与致谢

- 本仓库：**MIT**（`LICENSE`），版权行 `Copyright (c) 2026 Open Sea Skin contributors`。
- 上游：**d-dev0101/open-sea-skin**，MIT，作者 **d-dev0101** —— 本分支的一切始于它。
- 第三方：three.js 0.178.0（MIT）、HYG 星表经 d3-celestial（CC BY-SA 4.0）、Geist 字体（OFL）。逐项声明与本地许可副本见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 与 `native-dist/vendor/licenses/`。
