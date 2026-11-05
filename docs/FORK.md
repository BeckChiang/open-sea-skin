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

当前状态（2026-11-05）：已按上面两步装进 profile `desktop`，`node_modules/open-sea-skin` 是指向本目录的符号链接，插件版本显示 **1.3.0**（`plugin_manager list_bundles` 可见 `source: link:C:\Users\recko\DSH\plugins\open-sea-skin-lab`）。改完源码后宿主的静态路由（`/open-sea-skin/*`）即时反映新文件，但**浏览器侧的 client.js 需要刷新页面/重启桌面端**才会重新加载。

改完一律先跑：

```sh
node scripts/build-runtime.mjs --check   # shared/ 与 native-dist/ 是否同步
node --check plugin/client.js            # 语法
node tests/solar.test.mjs                # 天文函数 12 个用例
```
（不要用 `node --test tests/`——本机沙箱不允许 `--test` 起子进程，报 `spawn EPERM`。）
