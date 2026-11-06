# open-sea-skin-lab

本地 fork：`open-sea-skin@1.2.7`（MIT，上游 d-dev0101/open-sea-skin）。
用途：增加「波浪随吞吐/金额」「真实日照（月、星、云）」「分区毛玻璃」，保留上游全部原功能。

## 目录约定

| 路径 | 由谁维护 | 说明 |
| --- | --- | --- |
| `shared/ocean.js` | **手写源码** | 海面/天空/后处理渲染。构建时原样复制到 `native-dist/ocean.js` |
| `shared/styles.css` | **手写源码** | 渲染页样式。构建时原样复制到 `native-dist/styles.css` |
| `shared/solar.js` | **手写源码**（本 fork 新增） | 纯函数太阳/月亮天文计算，无 three 依赖，可 `node --test` |
| `plugin/client.js` | **手写**（本 fork 改为直接编辑） | 宿主页控制器：iframe、玻璃 CSS、设置面板、吞吐采样 |
| `native-dist/*`（ocean.js、styles.css） | 生成物 | 由 `node scripts/build-runtime.mjs` 生成，不要直接改 |
| `native-dist/skin.html`、`loader.js`、`vendor/**` | 上游产物 | 本 fork 不改（除非确需） |
| `plugin/index.js` | 上游产物 | host 插件：把 `native-dist/` 静态挂到 `/open-sea-skin` |

## 与上游构建的差异（为什么）

上游 `plugin/client.js` 是 `shared/skin-core.js` 经 `npm run build` 生成的产物，且生成时会拼上 localStorage 适配器。发布包不含 `shared/` 与 `scripts/`，本机又无法联网安装上游构建链，因此：

- `shared/ocean.js`、`shared/styles.css`：已用 git blob 校验证明与上游 `shared/` 中的同名文件**逐字节相同**（blob `17683a73…`、`4e63db9d…`），所以「复制」就是上游 runtime 构建对这两个文件做的全部事情，我们自写的 `scripts/build-runtime.mjs` 与之等价，并带 `--check` 防漂移。
- `plugin/client.js`：**直接作为手写文件编辑**。它没有 import/export，是纯可读 JS；本 fork 的所有控制器改动都落在这一层。将来上游若提供 `shared/skin-core.js`，可按 diff 平移过去。

## 构建与自检

```sh
node scripts/build-runtime.mjs          # shared/ -> native-dist/
node scripts/build-runtime.mjs --check  # 生成物漂移则 exit 1
node --test tests/                      # 纯函数单测（solar 等）
node --check shared/ocean.js            # 语法检查（ES module 按 --input-type=module）
```

## 基线

`2c2cacd` = 1.2.7 原样（未做任何修改）。对比上游差异：`git diff 2c2cacd -- .`

## 安装与回退

```sh
# 装本 fork（同一包名 open-sea-skin，profile 里的 cordis.patch.yml insert id 不变）
plugin_manager remove_bundle  open-sea-skin
plugin_manager install_bundle link:C:/Users/recko/DSH/plugins/open-sea-skin-lab
```

回退：`remove_bundle` 本 fork，再 `install_bundle open-sea-skin@1.2.7`（npm 源）。

当前状态（2026-11-06）：已按上面两步装进 profile `desktop`，`node_modules/open-sea-skin` 是指向本目录的符号链接，插件版本显示 **1.5.2**（`plugin_manager list_bundles` 可见 `source: link:C:\Users\recko\DSH\plugins\open-sea-skin-lab`）。改完源码后宿主的静态路由（`/open-sea-skin/*`）即时反映新文件，但**浏览器侧的 client.js 需要刷新页面/重启桌面端**才会重新加载；改了 `plugin/index.js`（宿主半）则必须按右上角 dsh-unlag 的刷新按钮或完全退出桌面端重开。

改完一律先跑：

```sh
node scripts/build-runtime.mjs --check   # shared/ 与 native-dist/ 是否同步
node --check plugin/client.js            # 语法
node tests/solar.test.mjs                # 天文函数 12 个用例
node tests/sky.test.mjs                  # 夜/黄昏/昼色板 9 个用例
node tests/structure.test.mjs            # 模块作用域结构 5 个用例
node tests/fleet.test.mjs                # /fleet 计数口径 5 个用例
```
（不要用 `node --test tests/`——本机沙箱不允许 `--test` 起子进程，报 `spawn EPERM`。）

## 两次「整屏灰白」的成因（2026-11-05）

`animate()` 里先 `updateBoats()` / `updateStarDome()`，最后才 `postProcessing.render()`；任何一帧抛错画布就永远不提交，界面只剩白色底。两次崩溃都属这一类：

1. **`meteor` 键重名**：`createStarLayer()` 的返回对象字面量里 `meteor` 写了两次（流星 `Line` 与流星状态机），后者覆盖前者，`updateStarDome()` 读 `layer.meteor.geometry` 得到 `undefined`。现改为 `meteorLine: meteor`，并给船/星空两层的更新各自套 `try/catch`，单层失效不再连坐渲染循环。
2. **SECTION 被插进 `boot()`**：船与星空两节曾被 splice 到天空球与 post-processing 之间，于是 `const BOAT_MAX` 等变成 boot 局部量——`boot()` 调 `createBoats()` 时撞 TDZ（`Cannot access 'BOAT_MAX' before initialization`），boot 中止，玻璃节点也没建。现已移到 `boot();` 之前的模块作用域（SECTION 10/11），并由 `tests/structure.test.mjs` 守住：两个 section 横幅上方最近的非空非注释行必须是顶格 `}`，且相关声明必须以 `const`/`let`/`function` 出现在行首。

`node --check` 查不出这类错误（语法合法），只能靠结构测试。另外 `/open-sea-skin/fleet` 路由由宿主插件注册，改 `plugin/index.js` 后**必须完全重启桌面端**，刷新页面不够。

## 船数与夜海（2026-11-05，第二次修「灰白」之后）

- **船数对齐顶部栏**：顶部栏用 `runningSubagentCount`，判据是子会话「有未结束的 turn」。而 `subagents.listChildren()` 返回的 catalog 条目只有 `{id, createdAt, mode, label?}`，没有 running 字段；`agentTeams.listMembers()` 里还含父智能体自己。旧的实现把两者混着数，结果永远是 1 艘幽灵船。现在逐个 `sessionQuery.observeSession(childId, { projectionMode: 'all' })` 读 `subagentTiming.active`，members 只当诊断字段。改这个文件要**完全重启桌面端**。
- **夜海发雾**：夜里海面加过两项平坦亮色（0.55 的星光项 + 写死亮灰的浪花），浪一起来就糊成一层奶白。星光项改成掠射角项 `grazing = (1 - N·V)^2`，浪花色改为 `vec3(0.82,0.88,0.90) * (uSkyLight*0.78 + 0.16)`，白天的观感不变、夜里跟着天光变暗。
- **船不再飘走**：原来每艘船有固定的世界坐标 berth，镜头一转就出画。现在船沿相机前侧的可见带巡航，到边缘折返，两轮分离避碰。

## 全天连续的天色与穹顶投影（2026-11-06，1.5.23）

- **十五个小时长得一样**：`skyFromElevation` 把 DAY 钳在 +12°、NIGHT 钳在 −18°，两段 smoothstep 之间只有 9 小时的窗口；实测 08:00–16:00 `skyLight` 恒为 1、天顶恒为 DAY 色，深度夜间一小时色板距离 0.000000。现在白昼混合区间拉到 0…90°，`skyLight` 是单条 `smoothstep01(-18,12,el)` 曲线，夜色里补了月光散射、气辉与银河底色；实测单分钟最大色板跳变 0.024（只出现在真实日出那一刻），夜间每小时都有可见位移。`tests/sky.test.mjs` 用「0.25° 步长 < 0.03」「20°→35° 与 −25°→−60° 都必须有变化」守住。
- **压缩天空时的生硬**：旧做法把星方向朝视轴 slerp，星座整体缩小、地平线附近抬升，而着色器里的程序化星场不参与压缩，2.0× 时两层会互相滑动。现在几何用 `r = 2tan(θ/2)` 的立体投影（保角）到 `θ' = 2atan(tan(θ/2)/fold)`，`fold = 1 + (skyZoom−1)·domeAmount`；着色器里的星场按同一映射**反向展开**（`tan(θ'/2)·fold`）再取 hash，两层同步。
- **面板**：5 组 → 11 组 `<details>` + 搜索；旧的 `off/low/mid/high` 枚举换成 0–100 或物理量的滑杆，`RANGE_ROWS` 一张表同时驱动模板、回填、事件与格式化，避免三处各写一遍。

## 真实星等，以及两次「不像原来」的回归（2026-11-06，1.5.25）

- **整屏灰：百分比当成了比例**。1.5.23 把 `STAR_GRADES` / `CONSTELLATION_GRADES` / `CROSS_GRADES` 从 0..1 改成百分比（mid = 100），但 `ocean.js` 里两个 uniform 仍写 `uniform(CROSS_GRADES.mid)`。`uCrossGlow = 100` 把星芒臂长从 15 个世界单位撑到 574，757 颗星的十字铺满天空，加法混合后就是均匀灰白；`uConstellation = 100` 同时把星座腿放大百倍。教训：**换单位必须同时改播种值**，灰屏不一定是渲染管线坏了，也可能只是一个数值放大了 100 倍。
- **星座连线变虚线**：腿是两片渐细四边形，半宽 `STAR_RADIUS * 0.0012 = 3.84` 世界单位；在小窗口里折算不到 1 像素，光栅化成断续的点。现在给一个像素下限 `pxWorld * 0.9`（`pxWorld = 2·STAR_RADIUS·tan(fov/2)/innerHeight`），大窗口下这条下限不生效，观感与 1.5.22 一致。
- **星表**：`scripts/gen-stars-catalog.mjs` 从 d3-celestial 的 `stars.6.json` 抽 mag ≤ 5.5 的 2851 颗写进 `shared/stars-catalog.js`（79 KB）；星径 `uStarSize·10^(−falloff·mag)`、颜色按 B−V 插值、星芒只给 mag ≤ `uStarSpikes`。星表是静态产物，换源或调阈值后要重跑生成器（`--check` 校验），CC BY-SA 4.0 的署名写在 `THIRD_PARTY_NOTICES.md`。


## GPU 开销：先把钱花在哪量清楚（2026-11-06，1.5.26）

- **归因**：无头 Edge + CDP 采样 rAF（`tmp/perf-probe/`，`?ossdebug=1` 才挂 `__ossDebug`）。基线 126 ms/帧；绕过 post 只剩 86；半 pixelRatio 56；隐藏海洋 70；隐藏天穹 123（天穹本身不贵，是因为 post 还在跑）。结论是 **fill bound**：像素数是最大杠杆，其次是 post 链。把 bloom 换成空节点后 126 → 83，坐实 mip 链就是那 42 ms。
- **泛光换实现**：`SoftGlowNode` 在 1/4 分辨率上做「阈值提取 + 两次可分离高斯」，权重用编译期 `GLASS_WEIGHTS`，`active=false` 时连 render target 都不碰。整条 post 链从 40 ms 掉到 ~2 ms。
- **`sin` 是隐藏的成本**：`hash2` 每像素两次 `sin`，海洋一像素约 120 次。换成 `fract(dot(q,·)·43758.5453)` 的多项式哈希后 raw scene 86 → 71，视觉上只是噪声格子换了种分布。
- **噪声预算**：海洋细节 2 个 FBM → 2 次梯度噪声；sparkle/泡沫单阶；云 3 阶 → 2 阶；海面反射干脆不算云（掩码是节点，云 fbm 对整片水面都算）。合计 126 → 70.4。
- **像素下限要按缓冲高度算**：`renderer.domElement.height` 而不是 `innerHeight`，否则自适应 scale 下 0.9 像素下限实际只有 0.55 像素，连线碎成虚线。
- 教训：这个渲染器的瓶颈是填充率与 transcendental 单元，不是顶点或 draw call（天体、星点、船的开关几乎不影响帧时间）。

## 夜要黑、星要接海、毛玻璃要清（2026-11-06，1.5.28）

- **深蓝不是夜色，是加项**：色板的值已经很低（天顶 0.006/0.012/0.032），但 `skyColor` 末尾还有气辉 `vec3(0.010,0.016,0.030)`、月夜提亮 `vec3(0.030,0.038,0.058)`、银河带三笔**固定色加项**，它们的蓝红比都在 3–5，几十 lux 的天顶加几毫就变成一整片蓝雾。现在三项同比例压到色板量级，色板本身也改成近似中性（blue/red < 1.9），`tests/sky.test.mjs` 用「夜角色比 < 1.9」守住。
- **折轴决定了星空能不能落到海面**：`compressSky` 原来朝 `boatCamera.getWorldDirection` 折，而相机仰角 +8°、画面中心还在 +8° 上，于是视线方向的一切被卷得更高，地平线上永远空一条。折轴改成「相机方向把 y 归零」的地平方向后，压缩只改「卷进来多少天空」，不改地平线位置；`tests/structure.test.mjs` 守 `skyAxis.y = 0;`。
- **星星大小与颜色互相拖累**：`uStarBase` 是 1.0 时，亮星叠加后进入 ACES 的高光段，三通道一起被压到 1，蓝星与橙星都读成白色——这正是「颜色差别不明显」的原因。把基准亮度降到 0.82、色温饱和度升到 1.35 之后，颜色才落在色调曲线的线性段里。
- **毛玻璃斑驳是半径不够**：14 px 的模糊对水面的高频不够狠，粗粒度的高光块留在玻璃后面变成斑点。半径 20 px 之后同一个采样结构把水纹抹平了，三栏强度降到 28/46/28 也更适合读正文（淡玻璃只做分隔，中心栏保清晰）。
- **程序化星场不能是规则网格**：星点半径与亮度都从同一个单元哈希来，网格感会从「处处等距」直接读出来。给每颗星独立半径（0.42–1.28×）与亮度（0.55–1.45×），再叠一层更粗、偏移的星场，才像是在撒盐而不是画点阵。
- **TSL 不能拿 JS 数字直接乘节点**：`STAR_SIZE * (0.42 + 0.86 * hs)` 里 `hs` 是节点，`0.42 + 0.86 * hs` 会先被 JS 算成 `NaN`，编译出的着色器带字面量 `NaN`，报 `Shader Error: 'NaN' : undeclared identifier`，整个天穹与星点渲染失败（画面只剩星座连线）。写成 `hs.mul(0.86).add(0.42)` 才对。**这类错误 `node --check` 看不见，无头探针的 console 里也不会标成致命错**——必须看渲染结果或 `Shader Error` 那一行。

## 星点为什么不能用点精灵（2026-11-06，1.5.29）

想让星点变成「圆点 + 星芒」，第一反应是给 `THREE.PointsNodeMaterial` 贴一张圆形贴图。
在节点材质路径里行不通：vendor 的 `setupDiffuseColor` 只读 `colorNode`，`map` 与 `alphaTest` 都被忽略，
点精灵在 WebGPU 里只能是不透明的方块。

所以星层改成每颗星一个 billboard 四边形：几何里带 `aCorner`（本地四角）、`aExtent`（像素半宽）、
`aSize`（圆盘直径）、`aSpike`（星芒长度），顶点着色器用相机的 right/up 轴把四边形推到星壳面上，
片元里用 `pxDist = length(corner) * extent` 画圆盘、柔光与四道沿轴的星芒。
位置只在每 20 秒重算一次，朝向靠 uniform 每帧更新，几何本身不重建。

同一个教训：删掉一层渲染对象时，要把引用它的字段一起删。这次留下了一个 `crossColor: crossColorAttr`，
`createStarLayer` 直接抛 `ReferenceError`，而 `animate` 的 try/catch 把异常变成一行
`[open-sea-skin] star dome disabled` 警告——画面看上去只是「星星变少了」，非常难查。
排查时先搜这行警告，再看 `__ossState().starOpacity` 是否为 0。

## 跟太阳走的星空（1.5.31）

星空过去是「亮/灭」两态：白天整层归零，入夜直接满亮。现在改成
`starFade = smoothstep(+6°, −2°, 太阳高度)`，淡到 0.004 以下才把整层从绘制列表摘掉——
看起来是连续的淡入淡出，算账时是一分钱不花。面板另有「白天也显示星空」开关，让想看
星图的人自己决定要不要付这份 fill。

银河也一起修了：过去只乘一个夜间系数，银心在 −69° 时画面仍然一条亮带，明显不对。现在
强度跟着银心高度走（`0.35 + 0.65 * smoothstep(−10°, 10°)`），并在面板里报「可见 / 偏弱 /
只剩外臂」——不给理由的「今晚没有银河」会被当成 bug。

## 两种「看起来一样、代价不同」的写法（1.5.31）

- 星座连线要「各自呼吸」：每条边带一个 `aLinePhase`，两个不可通约的频率叠加。用全局
  相位会变成整片天空一起闪，像坏掉的霓虹灯；用随机相位每次刷新都会重排。相位由星座名
  哈希决定，同一个星座永远同一个节奏。
- 毛玻璃要六种形状：全部放在合成阶段用 uniform 分支，模糊链仍然只有一条（半分辨率、9 taps）。
  换形状不重建材质、不增加 pass，代价最多是磨砂/双层各多 1–2 次采样。
