# Open Sea Skin · Lab 分支说明（1.5.39）

这是 [open-sea-skin](https://github.com/d-dev0101/open-sea-skin)（MIT，作者 d-dev0101）1.2.7 的**个人分支**，装在 DSH 桌面版的 `desktop` profile 里。

上游只提供「海面 + 夕阳 + 玻璃界面」；本分支在它的地基上加了四块：**负载驱动的波浪**、**真实天文的天色与星空**、**跟着会话变化的船队**、**可逐项取舍的性能开关**，并把所有能调的参数搬进了设置面板。

- 上游版本：1.2.7（`plugin/client.js` 与 `native-dist/*` 原样起步）
- 本分支版本：**1.5.39**
- 许可：MIT（见 `LICENSE`）；上游必须保留的署名见 `THIRD_PARTY_NOTICES.md`
- 只在这台机器的 `C:\Users\recko\DSH\plugins\open-sea-skin-lab` 开发，profile 用 `link:` 安装

---

## 1. 一眼看懂装了什么

| 模块 | 做了什么 | 主要文件 |
|---|---|---|
| 海洋渲染 | three.js WebGPU + TSL 的 Gerstner 波海面、天空、云、1/4 分辨率泛光、渲染器内毛玻璃 | `shared/ocean.js` → `native-dist/ocean.js` |
| 波浪控制 | 浪高跟着「当前会话 token 吞吐」或「本会话累计消费」走，带缓动与波峰下限 | `plugin/client.js`（`stepWave`） |
| 天文日照 | 本地 NOAA 星历：太阳高度/方位每秒重算，日出日落、月相照度、三条暮光线 | `shared/solar.js`、`shared/sky.js` |
| 星空 | 2851 颗真实恒星（mag ≤ 5.5，含 B−V）+ 88 星座 743 条连线（d3-celestial 数据）；圆点星、亮星星芒、流星；按本地恒星时转动 | `shared/stars-catalog.js`、`shared/stars-data.js`、`shared/sky-astro.js` |
| 船队 | 船数 = 本会话子智能体数（至少 1 艘），从画面两侧进出，随浪起伏 | `shared/ocean.js` §FLEET、`plugin/index.js` `/fleet` |
| 毛玻璃 | 三栏各自可开关与调强度，六种模糊形状，两种实现（渲染器内 blur / CSS backdrop-filter） | `plugin/client.js`（`glassCss`/`blurCss`）、`shared/ocean.js` |

---

## 2. 安装

```powershell
Expand-Archive .\open-sea-skin-lab-1.5.39.zip -DestinationPath C:\Users\<你>\DSH\plugins\
```

然后在 DSH 里安装：

```powershell
# 已有同名插件时先移除，否则会因 already-installed 拒绝
dsh plugin remove open-sea-skin
dsh plugin install C:\Users\<你>\DSH\plugins\open-sea-skin-lab
```

重启桌面端（或 `F5`），背景应当出现海面。

**确认生效**：控制台第一行有 `[open-sea-skin] client lab-1.5.39` 与 `[open-sea-skin] ocean lab-1.5.39`。

---

## 3. 设置面板

右上角小按钮打开，共 11 组，每组可折叠，顶部有搜索框（命中组标题也会展开整组）。

| 组 | 内容 |
|---|---|
| 皮肤与界面 | 总开关 |
| 波浪 | 驱动模式（手动 / 吞吐 / 金额）、手动浪高、波峰下限、速率常数、金额满幅、平滑时间、**超限敏感度** |
| 天空与日照 | 驱动模式、本机/该地时钟、昼夜滑杆、经纬度与定位、时区三档、月亮、太阳/月亮/暮光读数 |
| 星空 | 星空距离、穹顶比例、整体亮度、星点大小、最暗星、星等衰减、色温饱和度、**色温偏置**、**色彩模式**、基准亮度、光晕、底噪星场、**星等截止**、闪烁速度/幅度、银河带、**白天也显示星空** |
| 星座 | 连线亮度、星芒亮度、**星芒阈值**、连线粗细、地平淡出、**连线闪烁** |
| 流星 | 开关、频率、亮度 |
| 云 | 云量、漂移速度、不透明度 |
| 船与舰队 | 开关、散布、航速、大小 |
| 毛玻璃 | 实现方式、不透明度、模糊半径、**模糊形状（六种）**、三栏开关与强度、性能模式 |
| 高级 | 画质档位、泛光、帧率上限、恢复默认 |

**恢复默认**只重置观感参数，保留已经授权的经纬度。

---

## 4. 关键行为

- **星空跟太阳走**：`starFade = smoothstep(+6° → −2°)`，日落前后连续淡入，天亮前后连续淡出；完全淡出时整层从绘制列表里摘掉，不占 fill。打开「白天也显示星空」可强行常显。
- **银河按真实位置**：银心（RA 266.4°，Dec −28.9°）在 11 月的凌晨已经落到地平线下，这时只剩外臂；面板读数会写「可见 / 偏弱 / 只剩外臂」以及银心高度。
- **穹顶投影**：星空按 `θ' = 2·atan(tan(θ/2)/fold)` 做立体投影（保角），折轴取**地平方位**而不是视轴 —— 折向视轴会把整片天抬离海面。
- **超限**：吞吐或金额超过上限后，浪高到顶不再上涨，改由浪冠白沫与喷雾表现，`overflow = log(需求/上限)/log4` 映射到 0…1。
- **性能**：画面是 fill bound。顺序有效的杠杆是：画质档位（像素比）→ 帧率上限 → 泛光强度 → 白天隐星。1.5.26 起泛光换成自写 1/4 分辨率高斯，126 → 70 ms/帧（1600×900 无头 Edge）。

---

## 5. 测试

`node:test` 单文件测试（6 个文件，99 条）：

```powershell
node tests/structure.test.mjs
node tests/fleet.test.mjs
node tests/stars.test.mjs
node tests/sky.test.mjs
node tests/solar.test.mjs
node tests/sky-astro.test.mjs
```

注意 `node --test tests/` 在本机会因 spawn 权限失败，逐文件直接跑即可（测试是进程内执行）。

当前：**99 条全绿**（structure 48 / fleet 5 / stars 6 / sky 14 / solar 14 / sky-astro 12）。

---

## 6. 构建

`native-dist/` 是打包进安装包的副本，插件运行读的是 `shared/` + `plugin/`。改完 `shared/*.js` 后：

```powershell
node scripts/build-runtime.mjs          # 复制到 native-dist/
node scripts/build-runtime.mjs --check  # 只校验是否同步
node scripts/gen-stars-catalog.mjs      # 重新下载并生成星表（需要联网）
node scripts/gen-stars-catalog.mjs --check
```

---

## 7. 已知限制

- 星表是**静态生成**的产物，不会每次启动联网；要更新就重跑生成器（源：d3-celestial 的 `stars.6.json`，CC BY-SA 4.0）。
- 无头 Edge 拿不到 WebGPU（`No available adapters`，回退软件 WebGL2），所以自动化截图只能验证脚本错误与构图，**真机观感必须在 app 里 F5 看**。
- 星座连线与上游 `constellations.lines.json` 逐段对账：150 条折线 / 743 段完全一致，仅 16 段端点有 ≤10° 的差异（坐标舍入与 RA 环绕）。看起来「连错」的多半是共享星（如 Alpheratz 同时属于 Pegasus 与 Andromeda）或多折线星座（UMa 拆成 7 条）。
- 毛玻璃的「磨砂」与「双层」各多 1–2 次采样，弱核显上建议用高斯或盒式。
