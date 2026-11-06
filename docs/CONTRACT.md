# 接口契约（client.js ↔ ocean.js）

本文件是两边并行开发的唯一依据。改动契约必须两边同时改。

## 1. 设置项（client 侧 state，localStorage 持久化）

既有（保持不变）：`enabled`、`sea 0–100`、`time 0–100`、`glass 40–90`、`autoCycle`。

新增：

| 键 | 取值 | 默认 | 含义 |
| --- | --- | --- | --- |
| `waveMode` | `manual` / `throughput` / `amount` | `throughput` | 波浪来源 |
| `floor` | 0–60 | 25 | 波谷下限（三档共用的 sea 下限） |
| `r0` | 1–200 | 25 | 吞吐参考值：r0 tok/s 时达到 63% 浪高 |
| `amountFull` | 1–100 | 10 | 金额满浪阈值（元，当前会话累计） |
| `smooth` | 2–8 | 4 | 平滑时间常数 τ（秒） |
| `sunMode` | `real` / `manual` | `real` | 时间来源 |
| `lat` | -90–90 | 31.23 | 纬度 |
| `lon` | -180–180 | 121.47 | 经度 |
| `moon` | bool | true | 显示月亮 |
| `stars` | `off`/`low`/`mid`/`high` | `mid` | 星空密度 |
| `clouds` | `off`/`low`/`mid`/`high` | `mid` | 云量 |
| `glassMode` | `render` / `css` | `render` | 毛玻璃实现方式 |
| `colLeft` / `colCenter` / `colRight` | `{on:bool, level:'off'\|'weak'\|'medium'\|'strong'}` | 左 `{true,'weak'}`、中 `{true,'medium'}`、右 `{true,'weak'}` | 分栏玻璃开关与模糊档 |
| `perf` | bool | false | 高性能模式：全部模糊关闭 |

> 分栏不透明度：1.2.7 的外壳是**单一 frame 一次上色**，三栏各自 alpha 需要改成逐栏自绘并重写整套 token 覆盖，回归风险远大于收益。因此不透明度保持**全局一项**（沿用 `glass` 40–90），三栏只控制「是否毛玻璃 + 模糊档」。要逐栏 alpha 需另立任务。

## 2. 父页 → iframe 消息

`window.parent === frame.contentWindow` 的 source 校验沿用现有实现（`ocean.js` 内 `ev.source === window.parent`）。

### 2.1 `oss-set`（既有，保留兼容）

```js
{ type: 'oss-set', sea: 0..100, t: 0..100, auto: boolean }
```

`auto === true` 表示交给 iframe 自己走时间；`client` 在 `waveMode === 'manual'` 时发真实滑杆值，其余模式发算出来的 `sea`。

### 2.2 `oss-sun`（新增）

```js
{ type: 'oss-sun',
  mode: 'real' | 'manual',
  lat: number, lon: number,
  t: 0..100,            // 仅 mode==='manual' 时使用
  moon: boolean,
  stars: 'off'|'low'|'mid'|'high',
  clouds: 'off'|'low'|'mid'|'high' }
```

- `mode === 'real'`：iframe 每秒按 `Date.now()` + `lat/lon` 重算太阳/月亮，**禁止**再走 720 秒正弦循环。
- 太阳高度角 `elevDeg` 映射到既有日光值：`t = clamp((elevDeg + 4) / 44, 0, 1) * 100`（elev ≥ 40° 即满日光；≤ -4° 为夜）。
- 云量映射到 `uCloudCover`：`off .15 / low .35 / mid .55 / high .80`。
- 星空强度：`clamp(-elevDeg / 8, 0, 1) * starLevel * (1 - 0.65 * moonBrightness)`；`starLevel` = `off 0 / low .33 / mid .66 / high 1`。
- 月亮：位置取反日点近似 + 月赤纬近似，相位按朔望周期；`moonBrightness = 相位亮面比例 × 高度可见度`。

### 2.3 `oss-glass`（新增）

```js
{ type: 'oss-glass',
  mode: 'render' | 'css',
  perf: boolean,
  rects: [ { x0, y0, x1, y1, level } ]   // CSS px 归一化到 0..1，坐标系为父页视口
}
```

- `rects` 最多 3 个，按栏顺序（左、中、右）；`level` 由档位映射：`off 0 / weak .35 / medium .7 / strong 1`；`on === false` 的栏不发。
- `mode === 'css'` 时 ocean 端**不加采样**，只保留清晰画面（模糊由父页 backdrop-filter 完成）。
- `perf === true` 时 ocean 端同样不加采样。

## 3. ocean.js 义务

1. **零重编译**：所有新增效果（模糊、月亮、星空、云量）用 uniform 控制，运行中切换不得触发着色器重编译。
2. **模糊实现**：仿 `vendor/addons/tsl/display/BloomNode.js` 写一个 `TempNode` 子类（半分辨率、可分离 9-tap、H+V 两遍），用 `passTexture()` 暴露输出，再在最终 `outputNode` 里按 rect 掩码与原图混合。掩码外必须保持原画质；`rects` 为空或 `perf` 时走 `outputNode = 原图` 分支且零额外采样。
3. **性能兜底**：模糊开启时自适应分辨率的**上限压到 0.7**（不得高于 0.7），关闭后恢复 1.0；`LOW_END_DEVICE` 仍按现有 0.6 起步。
4. **失败兜底**：新增节点创建/编译抛错时，捕获并以清晰画面继续渲染，控制台 `warn` 一次，不得白屏。
5. **非 skin 模式**（`skin.html` 之外的 showcase 页）保持原样：新增 uniform 默认值必须让画面与 1.2.7 一致。
6. **状态钩子**：`window.__ossState()` 扩展返回 `{ sea, daylight, sunElevationDeg, sunAzimuthDeg, moonElevationDeg, moonBrightness, starsIntensity, cloudCover, blurRects, renderScale, reducedMotion, lowEndDevice }`，供自动化检查。
7. **初始值**：query 参数沿用 `?skin=1&sea=&t=&auto=&parentOrigin=`；新增可选 `lat=`、`lon=`、`sunMode=real|manual`，用于首帧即正确（避免闪一下）。

## 4. 父页 CSS 义务（client.js）

- `glassMode === 'css'`：按栏输出 `backdrop-filter: blur(<px>) saturate(1.1..1.3)` 与半透明底色；`render` 模式**不得**输出 backdrop-filter。
- 两栏/三栏的选择器沿用 1.2.7 已有语义标记（`[data-slot="sidebar"]`、`[data-slot="main.conversation"]`、`[data-rightbar-col]`、`.dshDesktopSidebarSurface` 等），不要新增 CSS-module 哈希。
- 分区遮罩与 `rects` 必须同源：rect 由父页对同一选择器做 `getBoundingClientRect()` 得到，避免「模糊位置」与「半透明区域」错位。

## 4 · 船（oss-fleet）

宿主半（`plugin/index.js`）暴露 `GET /open-sea-skin/fleet?session=<id>`，返回：

```json
{ "ok": true, "running": 2,
  "ships": [{ "id": "…", "title": "…", "status": "running" }],
  "children": [{ "id": "…", "title": "…", "status": "" }],
  "childStates": [{ "id": "…", "title": "…", "running": true }],
  "members": [],
  "services": { "subagents": true, "sessionQuery": true, "agents": true, "agentTeams": true } }
```

- 口径（2026-11-06 修订）：船数 = **本会话的子智能体条目数**（`children.length`），与侧边栏「子智能体」列表的条数一致，不是「正在运行」数、也不累计跨会话。`running`（有未结束回合的 child 数）只用于面板文案「本会话 N 个子智能体，M 个正在运行」。
- 判定方法：`subagentCatalog` 条目只有 `{id, createdAt, mode, label?}`，**没有 running 字段**；而 team members 里包含父智能体自己。所以逐个 `sessionQuery.observeSession(childId, { projectionMode: 'all' })`，读 `projections.values.subagentTiming.active`——有 open turn 就是 running，`lastTurnCompleted` 后就不是。每个 child 结果缓存 2.5 s（轮询间隔 4 s），observation 用 `Symbol.asyncDispose`/`Symbol.dispose` 释放；最多观察 24 个 child。
- `members` 只作为诊断字段保留，不参与计数（否则父智能体永远贡献一艘幽灵船）。
- 宿主服务全部按需读取（`ctx.get` / `ctx.reflect.get`），未组装 subagents/teams 的 profile 只会返回 `running: 0`，不影响皮肤其它部分。
- 客户端 4 s 轮询一次，转成 `{ type: 'oss-fleet', count }` 投进 iframe，`count` = `children.length`（clamp 0..12，渲染端再按 `BOAT_BASE`/`BOAT_MAX` 收边）；`sessionId` 一变立即重拉，不用等下一轮。宿主返回的是旧形状（没有 `children`）时，面板显示「宿主半是旧版本，需要重启」提示。
- 渲染端在 `SECTION 10 · FLEET`：`InstancedMesh` × 4（船体 / 桅杆 / 帆 / 船灯），每帧用 `seaStateAt()` 采样 CPU 版 Gerstner 波面决定高度与倾斜。船在相机前方走**椭圆环**（`boatCruise`：`base = 15 + ((i*7.3) % 11)` 即 15–25、`radiusRight = 3 + ((i*1.3) % 4)`、`radiusBack = 1.5 + ((i*1.1) % 2)`、角速度 0.10–0.19 rad/s 即静水下一圈 33–63 s，各船相位错开），一圈船头始终顺着切线转向，所以不会「飞到边缘再掉头」；船头是局部 +X，`boatYaw.setFromAxisAngle(BOAT_UP, atan2(-vz, vx))`。两轮 `BOAT_MIN_SEP = 3.4` 的 O(n²) 分离把相邻船推开，推力记在 `pushX/pushZ` 里按 0.92 衰减，是稳定避碰而不是抖动。
- **进出场不能用缩放做**（那样会「凭空冒出/凭空消失」）：`boatFade` 0..1 同时驱动「离航道多远」——`across = sin(angle)*radiusRight + side*(1-fade)*BOAT_APPROACH(26)`，各船 `side` 左右交替，所以船是**从画面左/右侧横着开进来、又横着开出去**；朝向把这段横向速度算进航向（`lateralSpeed`），来船船头朝你、离船船头朝外。缩放只做最后收尾（`tail = min(1, fade*2.5)`），保证消失时已经是小点而不是满尺寸突然不见。各船到达速率不同（0.9–1.35）且离场略快（1.3–1.7），一起增加/切换会话时是多艘各自驶入而不是整体瞬变。
- **速度来自浪，不来自秒表**：轨道角是逐帧积分 `lane.angle += dt * lane.speed * cruise * lane.surge`，不是 `phase + time * speed`。`cruise = 0.65 + 0.95 * seaNorm`（`seaNorm = (uSea-0.25)/1.5`，静水慢、大浪快）；`surge` 由船头前方 2.4 单位处的水面高差（`BOAT_PROBE`）算出——下坡加速、上坡减速，钳在 0.7–1.5 并按 3/s 平滑（避免小碎浪抖速度）。所以浪高变化时船速真会跟着变，而不是恒速绕圈。
- **每次轮询都发，不做去重**：iframe 帧每次加载都从 `BOAT_BASE`（1 艘）起步，也可能被重载，所以数字没变也必须发；只发变化量会让海面一直停在它出生时的数量上。
- **轮询挂在波浪 tick 上**：`stepWave`（250 ms）里每 4 s `void pollFleet()`，会话 id 一变立刻重取一次。船数不靠独立 `setInterval`——切会话时界面重挂载容易把单独的定时器留在旧会话上，而波浪 tick 是页面唯一常驻的循环。
- **指标桥在渲染期写入**：`Bridge` 组件不做 `useEffect` 延迟，直接在下发时 `metricsStore.push(...)`，保证切会话后的第一拍就拿得到新 `sessionId`。

## 5 · 星空与流星

- `shared/stars-data.js`：d3-celestial 的 88 星座 / 150 折线 / 893 点（BSD-3-Clause），坐标已换成 `[RA 0..360, Dec -90..90]`。
- `shared/sky-astro.js`：GMST + 球面地平转换 + 顶点去重 + 亮度映射，纯函数。
- 渲染端 `SECTION 10`：`LineSegments` 画星座连线、`Points` 画顶点恒星，每 5 s 按当前 LST / 纬度重算一次（15°/h ≈ 0.02°/5s，肉眼不可辨）；不透明度 = 星空档位 × 夜间因子 × 月光压制；地平线下的点被推到 y=-6000 自然隐藏。流星是复用的一条 2 点线段，随机间隔 4–13 s、时长 0.55–1.15 s。
