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

当前状态（2026-11-06）：已按上面两步装进 profile `desktop`，`node_modules/open-sea-skin` 是指向本目录的符号链接，插件版本显示 **1.5.0**（`plugin_manager list_bundles` 可见 `source: link:C:\Users\recko\DSH\plugins\open-sea-skin-lab`）。改完源码后宿主的静态路由（`/open-sea-skin/*`）即时反映新文件，但**浏览器侧的 client.js 需要刷新页面/重启桌面端**才会重新加载；改了 `plugin/index.js`（宿主半）则必须按右上角 dsh-unlag 的刷新按钮或完全退出桌面端重开。

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
