// GENERATED from shared/skin-core.js. Run npm run build after editing shared sources.
window.__ModuleLoader__.load({ id: "open-sea-skin", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
// Open Sea Skin shared host-page controller.
//
// This file intentionally has no import/export statements: the release build
// concatenates it with either the Chrome storage adapter or the localStorage
// adapter, so both installation paths run the same DOM, glass and a11y code.
(function registerOpenSeaSkinCore(global) {
  'use strict';

  const IDS = Object.freeze({
    frame: '__open-sea-skin__',
    glass: '__open-sea-skin-glass__',
    uiStyle: '__open-sea-skin-glass__-ui',
    button: '__open-sea-skin-btn__',
    panel: '__open-sea-skin-panel__',
  });

  // Host half of the skin: live roster of running subagents (one boat each).
  const FLEET_PATH = '/open-sea-skin/fleet';

  const DEFAULTS = Object.freeze({
    enabled: true,
    sea: 45,
    time: 55,
    glass: 72,
    autoCycle: true,
    waveMode: 'throughput',
    floor: 25,
    r0: 25,
    amountFull: 10,
    smooth: 4,
    sunMode: 'real',
    lat: 30.59,
    lon: 114.31,
    moon: true,
    stars: 'mid',
    clouds: 'mid',
    glassMode: 'render',
    colLeft: Object.freeze({ on: true, level: 'weak' }),
    colCenter: Object.freeze({ on: true, level: 'medium' }),
    colRight: Object.freeze({ on: true, level: 'weak' }),
    perf: false,
    boats: true,
  });

  // Blur strength per column, sent to the ocean as a 0..1 weight.
  const BLUR_LEVELS = Object.freeze({ off: 0, weak: 0.35, medium: 0.7, strong: 1 });
  const BLUR_PX = Object.freeze({ off: 0, weak: 10, medium: 18, strong: 30 });
  const GRADE_LEVELS = Object.freeze(['off', 'low', 'mid', 'high']);

  const COPY = Object.freeze({
    zh: {
      button: '海洋皮肤设置',
      close: '关闭',
      sea: '波浪大小',
      time: '日光',
      glass: '玻璃不透明度',
      enable: '启用海洋皮肤',
      autoCycle: '自动昼夜循环',
      reset: '恢复默认',
      resetNote: '恢复全部默认设置（波浪 45 / 日光 55 / 玻璃 72 / 自动循环开）',
      note: '调节即时生效并自动保存。波浪与日照都按下面的设置实时驱动。',
      times: ['黄昏', '金色时刻', '下午', '正午'],
      secSkin: '皮肤',
      secWave: '波浪',
      secSun: '日照',
      secBoat: '船',
      boats: '显示船只',
      boatNote: '船的数量等于当前正在运行的子智能体，随进程增减。',
      boatIdle: '当前没有运行中的子智能体',
      boatCount: '正在运行 {n} 个子智能体',
      boatLoading: '读取中…',
      boatOffline: '读不到子智能体列表（接口未启用？）',
      boatOff: '已关闭船只',
      secGlass: '毛玻璃',
      waveSource: '驱动来源',
      manualSea: '手动波浪',
      floor: '波谷下限',
      r0: '半浪吞吐',
      amountFull: '满浪金额',
      smooth: '平滑时间',
      waveNote: '吞吐模式：会话运行时按当前 token 速率起伏，停下来回落到本会话累计消费对应的浪高；金额模式：始终按累计消费。',
      sunSource: '时间来源',
      manualTime: '手动日照',
      lat: '纬度',
      lon: '经度',
      locate: '使用我的位置',
      locateBusy: '定位中…',
      locateOk: '已更新坐标',
      locateFail: '定位失败，请手动填经纬度',
      moon: '显示月亮',
      stars: '星空',
      clouds: '云量',
      sunNote: '真实时钟按经纬度计算太阳高度，离线计算，不联网。',
      realTime: '真实',
      glassMode: '实现方式',
      perf: '高性能模式',
      glassNote: '渲染器内模糊最省；CSS 模糊更兼容但更吃帧。三栏可分别开关与调强度。',
      cols: { left: '左侧栏', center: '交互区', right: '右侧栏' },
      modes: { manual: '手动', throughput: '吞吐', amount: '金额' },
      sunModes: { real: '真实时钟', manual: '手动' },
      grades: { off: '关', low: '少', mid: '中', high: '多' },
      glassModes: { render: '渲染器内', css: 'CSS 模糊' },
      levels: { off: '关', weak: '弱', medium: '中', strong: '强' },
    },
    en: {
      button: 'Open Sea skin settings',
      close: 'Close',
      sea: 'Sea state',
      time: 'Daylight',
      glass: 'Glass opacity',
      enable: 'Enable Open Sea skin',
      autoCycle: 'Automatic day cycle',
      reset: 'Reset to defaults',
      resetNote: 'Restore all defaults (sea 45 / daylight 55 / glass 72 / auto cycle on)',
      note: 'Changes apply immediately and save automatically.',
      times: ['Dusk', 'Golden hour', 'Afternoon', 'Midday'],
      secSkin: 'Skin',
      secWave: 'Waves',
      secSun: 'Sunlight',
      secBoat: 'Boats',
      boats: 'Show boats',
      boatNote: 'One boat per running subagent; the fleet follows them live.',
      boatIdle: 'No subagent running right now',
      boatCount: '{n} subagent(s) running',
      boatLoading: 'Reading…',
      boatOffline: 'Subagent roster unavailable (endpoint off?)',
      boatOff: 'Boats off',
      secGlass: 'Frosted glass',
      waveSource: 'Driven by',
      manualSea: 'Manual sea state',
      floor: 'Wave floor',
      r0: 'Half-wave rate',
      amountFull: 'Full-wave cost',
      smooth: 'Smoothing',
      waveNote: 'Throughput: swells with the current token rate and settles to this session\u2019s spend when idle. Cost: always follows spend.',
      sunSource: 'Time source',
      manualTime: 'Manual daylight',
      lat: 'Latitude',
      lon: 'Longitude',
      locate: 'Use my location',
      locateBusy: 'Locating…',
      locateOk: 'Coordinates updated',
      locateFail: 'Location unavailable, type it manually',
      moon: 'Show moon',
      stars: 'Stars',
      clouds: 'Clouds',
      sunNote: 'Real time computes the solar altitude from your coordinates, offline.',
      realTime: 'Real',
      glassMode: 'Implementation',
      perf: 'Performance mode',
      glassNote: 'In-renderer blur is cheapest; CSS blur is more compatible but costs frames. Each column toggles separately.',
      cols: { left: 'Left column', center: 'Conversation', right: 'Right column' },
      modes: { manual: 'Manual', throughput: 'Throughput', amount: 'Cost' },
      sunModes: { real: 'Real clock', manual: 'Manual' },
      grades: { off: 'Off', low: 'Low', mid: 'Mid', high: 'High' },
      glassModes: { render: 'In renderer', css: 'CSS blur' },
      levels: { off: 'Off', weak: 'Weak', medium: 'Mid', strong: 'Strong' },
    },
  });

  const WAVE_ICON = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
  <path d="M1.5 8.5c1.2-1.7 2.4-1.7 3.6 0s2.4 1.7 3.6 0 1.9-1.2 3-0.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M1.5 12c1.2-1.4 2.4-1.4 3.6 0s2.4 1.4 3.6 0 1.9-1 3-.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
</svg>`;

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  // The lab build first shipped with Shanghai as the default location. Anyone
  // who never touched the field still carries that pair, so treat it as
  // "unset" once and migrate to the current default.
  const LEGACY_DEFAULT_LOCATION = { lat: 31.23, lon: 121.47 };
  function legacyDefaultLocation(source) {
    return (
      Number(source.lat) === LEGACY_DEFAULT_LOCATION.lat &&
      Number(source.lon) === LEGACY_DEFAULT_LOCATION.lon
    );
  }

  const BLUR_LEVEL_NAMES = Object.keys(BLUR_LEVELS);
  const WAVE_MODES = ['manual', 'throughput', 'amount'];

  function normalizeColumn(raw, fallback) {
    const column = raw && typeof raw === 'object' ? raw : {};
    return {
      on: column.on !== false,
      level: BLUR_LEVEL_NAMES.includes(column.level) ? column.level : fallback.level,
    };
  }

  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      enabled: source.enabled !== false,
      sea: clamp(source.sea, 0, 100, DEFAULTS.sea),
      time: clamp(source.time, 0, 100, DEFAULTS.time),
      glass: clamp(source.glass, 40, 90, DEFAULTS.glass),
      autoCycle: source.autoCycle !== false,
      waveMode: WAVE_MODES.includes(source.waveMode) ? source.waveMode : DEFAULTS.waveMode,
      floor: clamp(source.floor, 0, 60, DEFAULTS.floor),
      r0: clamp(source.r0, 1, 200, DEFAULTS.r0),
      amountFull: clamp(source.amountFull, 1, 100, DEFAULTS.amountFull),
      smooth: clamp(source.smooth, 2, 8, DEFAULTS.smooth),
      sunMode: source.sunMode === 'manual' ? 'manual' : 'real',
      lat: legacyDefaultLocation(source) ? DEFAULTS.lat : clamp(source.lat, -90, 90, DEFAULTS.lat),
      lon: legacyDefaultLocation(source) ? DEFAULTS.lon : clamp(source.lon, -180, 180, DEFAULTS.lon),
      moon: source.moon !== false,
      stars: GRADE_LEVELS.includes(source.stars) ? source.stars : DEFAULTS.stars,
      clouds: GRADE_LEVELS.includes(source.clouds) ? source.clouds : DEFAULTS.clouds,
      glassMode: source.glassMode === 'css' ? 'css' : 'render',
      colLeft: normalizeColumn(source.colLeft, DEFAULTS.colLeft),
      colCenter: normalizeColumn(source.colCenter, DEFAULTS.colCenter),
      colRight: normalizeColumn(source.colRight, DEFAULTS.colRight),
      perf: source.perf === true,
      boats: source.boats !== false,
    };
  }

  function selectCopy(locale) {
    const requested = locale || document.documentElement.lang || navigator.language || 'en';
    return requested.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
  }

  function timeLabel(copy, value) {
    const t = value / 100;
    if (t < 0.12) return copy.times[0];
    if (t < 0.30) return copy.times[1];
    if (t < 0.62) return copy.times[2];
    return copy.times[3];
  }

  function alpha(value) {
    return Number(value.toFixed(2));
  }

  function blurCss(state) {
    if (state.glassMode !== 'css' || state.perf) return '';
    const column = (selector, key) => {
      const entry = state[key];
      const px = entry.on ? BLUR_PX[entry.level] || 0 : 0;
      if (!px) return '';
      return `${selector} { -webkit-backdrop-filter: blur(${px}px) saturate(125%); backdrop-filter: blur(${px}px) saturate(125%); }`;
    };
    return `
/* CSS fallback: the browser blurs what sits behind each column. Slower than
   the in-renderer pass, so it is opt-in from the settings panel. */
${column('body [data-slot="sidebar"], body .dshDesktopSidebarSurface', 'colLeft')}
${column('body [data-slot="main.conversation"], body .dshDesktopConversationSurface', 'colCenter')}
${column('body [data-rightbar-col], body .dshDesktopDetailsSurface', 'colRight')}`;
  }

  function glassCss(glass, state) {
    const light = glass / 100;
    const dark = Math.max(0.40, light - 0.12);
    return `
/* Open Sea Skin: one translucent shell; nested fills must not compound. */
body {
  background: transparent !important;
  --dsw-alias-bg-base: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-layer-1: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-layer-2: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-layer-3: rgba(255, 255, 255, ${alpha(light)}) !important;
  --dsw-alias-bg-module-platform: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
  --dsw-alias-bg-multi-select: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
  --dsw-alias-bg-overlay: rgba(233, 236, 242, .97) !important;
  --dsw-specific-sidebar-fill: rgba(249, 250, 251, ${alpha(Math.max(0.36, light - 0.04))}) !important;
  --dsw-specific-selector: rgba(245, 246, 247, ${alpha(light + 0.02)}) !important;
}
body[data-ds-dark-theme] {
  --dsw-alias-bg-base: rgba(9, 12, 16, ${alpha(dark)}) !important;
  --dsw-alias-bg-layer-1: rgba(12, 16, 22, ${alpha(dark)}) !important;
  --dsw-alias-bg-layer-2: rgba(16, 20, 27, ${alpha(dark)}) !important;
  --dsw-alias-bg-layer-3: rgba(20, 25, 33, ${alpha(dark)}) !important;
  --dsw-alias-bg-module-platform: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
  --dsw-alias-bg-multi-select: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
  --dsw-alias-bg-overlay: rgba(18, 22, 30, .97) !important;
  --dsw-specific-sidebar-fill: rgba(11, 15, 21, ${alpha(Math.max(0.35, dark - 0.05))}) !important;
  --dsw-specific-selector: rgba(13, 17, 23, ${alpha(dark + 0.02)}) !important;
}
/* DSH Desktop owns a different shell: its transparent sidebar and two
   independently painted conversation layers otherwise produce uneven glass.
   Paint the shared frame once. Only shell roots lose their fill; cards,
   composer, menus and the sibling overlay keep their own theme tokens. */
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopFrame {
  background: var(--dsw-alias-bg-base) !important;
}
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) .dshDesktopSidebarSurface {
  --dsw-specific-sidebar-fill: transparent !important;
}
body:is([data-dsh-desktop-mode="advanced"], [data-dsh-desktop-mode="extended"]) :is(
  .dshDesktopSidebarSurface,
  .dshDesktopConversationSurface,
  .dshDesktopDetailsSurface,
  .dshDesktopMacCaptionRow,
  .dshDesktopWindowsCaptionRow,
  .dshDesktopConversationSurface > *,
  .dshDesktopConversationSurface [data-phase="hero"],
  .dshDesktopConversationSurface [data-phase="active"],
  .dshDesktopConversationSurface [data-phase="settling"],
  .dshDesktopDetailsSurface > *
) {
  background: transparent !important;
}
/* Official Harness Desktop 0.2.x uses a different AppFrame from the
   community desktop wrapper. Its sidebar, center, conversation and docked
   rightbar each paint a surface; translucent paints compound into a much
   darker center. The shell overlay is a stable AppFrame marker, while the
   platform attributes keep this adjustment out of ordinary Harness Web. */
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) {
  background: var(--dsw-alias-bg-base) !important;
}
/* The sidebar slot contains another SidebarRoot fill on Windows. Clear its
   token at this semantic boundary instead of targeting a CSS-module hash. */
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :first-child [data-slot="sidebar"] {
  --dsw-specific-sidebar-fill: transparent !important;
}
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :is(:first-child, :nth-child(2), [data-rightbar-col], [data-shell-bottom]),
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root div:has(> [data-shell-overlay]) > :nth-child(2) [data-phase],
html:is([data-platform="darwin"], [data-windows-titlebar]) body #root [data-rightbar-col] [data-dockkit-host="dock"] > [data-dockkit-content] {
  background: transparent !important;
}
html[data-windows-titlebar] body #root div:has(> [data-shell-overlay])::before {
  background: transparent !important;
}
/* Harness 0.2.1 uses dedicated tokens for composer, message bubbles and tool /
   code cards. Limit these to the conversation slot: settings and other plugin
   interfaces retain their original surfaces, radii and syntax highlighting. */
body [data-slot="main.conversation"] {
  --dsw-specific-input-major: var(--dsw-alias-bg-layer-1) !important;
  --dsw-specific-bubble: var(--dsw-alias-bg-layer-2) !important;
  --dsw-alias-markdown-code-block: var(--dsw-alias-bg-layer-1) !important;
  --dsw-alias-markdown-code-block-banner: var(--dsw-alias-bg-layer-2) !important;
}
/* Modal cards can be independent body portals, including second-level plugin
   configuration. Protect semantic dialog surfaces, not the full-screen mask
   or shell overlay. Open Sea's own dialog already supplies dark glass and light
   text in either theme; the host light fill would make it white on white. */
body :is([data-shortcut-modal="settings"], [role="dialog"], [role="alertdialog"]):not(#${IDS.panel}) {
  background: rgba(250, 251, 253, .97) !important;
}
body[data-ds-dark-theme] :is([data-shortcut-modal="settings"], [role="dialog"], [role="alertdialog"]):not(#${IDS.panel}) {
  background: rgba(24, 28, 35, .97) !important;
}
/* Legacy Harness builds: these CSS-module hashes are best-effort fallbacks. */
.wSkVaW_root,
.pI_x6G_sidebarCol,
.hHd-Xa_root {
  background: transparent !important;
}
${blurCss(state)}`;
  }

  function uiCss() {
    return `
#${IDS.button} {
  position: fixed; z-index: 6000; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.22);
  background: rgba(12,16,22,.78); backdrop-filter: blur(14px) saturate(130%);
  color: #c5dce3; cursor: pointer; padding: 0;
  transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .1s ease;
}
#${IDS.button}:hover { color:#8fe9e4; border-color:rgba(143,233,228,.5); background:rgba(16,22,30,.88); }
#${IDS.button}.active { color:#dafdfb; border-color:rgba(143,233,228,.55); background:rgba(16,32,38,.92); box-shadow:0 0 14px rgba(143,233,228,.25); }
#${IDS.button}:active { transform:scale(.94); }
#${IDS.button}:focus-visible, #${IDS.panel} button:focus-visible, #${IDS.panel} input:focus-visible { outline:2px solid rgba(143,233,228,.7); outline-offset:2px; }
#${IDS.panel} {
  position:fixed; z-index:6001; width:300px; padding:16px;
  max-height:min(78vh, 720px); overflow-y:auto; overscroll-behavior:contain;
  border-radius:16px; border:1px solid rgba(255,255,255,.14);
  background:rgba(10,14,20,.82); backdrop-filter:blur(22px) saturate(140%);
  box-shadow:0 18px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1);
  color:#eef4f6; font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
  display:none; scrollbar-width:thin;
}
#${IDS.panel}::-webkit-scrollbar { width:6px; }
#${IDS.panel}::-webkit-scrollbar-thumb { background:rgba(255,255,255,.18); border-radius:3px; }
#${IDS.panel}.open { display:block; }
#${IDS.panel} .oss-title { display:flex; align-items:center; justify-content:space-between; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.6); margin-bottom:14px; }
#${IDS.panel} .oss-mark, #${IDS.panel} .oss-value { color:#8fe9e4; }
#${IDS.panel} .oss-close { background:none; border:0; color:rgba(255,255,255,.55); font-size:18px; line-height:1; cursor:pointer; padding:3px 6px; border-radius:6px; }
#${IDS.panel} .oss-close:hover { color:#fff; background:rgba(255,255,255,.08); }
#${IDS.panel} .oss-row { margin-top:13px; }
#${IDS.panel} .oss-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:9px; font-size:11px; letter-spacing:.1em; color:rgba(255,255,255,.7); }
#${IDS.panel} .oss-value { font-variant-numeric:tabular-nums; }
#${IDS.panel} input[type='range'] { appearance:none; display:block; width:100%; height:14px; margin:0; padding:0; background:transparent; cursor:pointer; }
#${IDS.panel} input[type='range']::-webkit-slider-runnable-track { height:3px; border-radius:2px; background:rgba(255,255,255,.2); }
#${IDS.panel} input[type='range']::-webkit-slider-thumb { appearance:none; width:14px; height:14px; margin-top:-5.5px; border:0; border-radius:50%; background:#8fe9e4; box-shadow:0 0 10px rgba(143,233,228,.75); }
#${IDS.panel} input[type='range']::-moz-range-track { height:3px; border-radius:2px; background:rgba(255,255,255,.2); }
#${IDS.panel} input[type='range']::-moz-range-thumb { width:14px; height:14px; border:0; border-radius:50%; background:#8fe9e4; box-shadow:0 0 10px rgba(143,233,228,.75); }
#${IDS.panel} .oss-note { margin-top:13px; font-size:10px; line-height:1.7; color:rgba(255,255,255,.6); }
#${IDS.panel} .oss-switch { display:flex; align-items:center; justify-content:space-between; gap:12px; }
#${IDS.panel} .oss-switch label { font-size:11px; color:rgba(255,255,255,.7); }
#${IDS.panel} .oss-switch input[type='checkbox'] { width:15px; height:15px; margin:0; accent-color:#8fe9e4; cursor:pointer; }
#${IDS.panel} .oss-reset { width:100%; margin-top:4px; padding:7px 0; border-radius:8px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#eef4f6; font-size:11px; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
#${IDS.panel} .oss-reset:hover { background:rgba(143,233,228,.12); border-color:rgba(143,233,228,.4); }
#${IDS.panel} .oss-sec { margin-top:15px; padding-top:13px; border-top:1px solid rgba(255,255,255,.1); }
#${IDS.panel} .oss-sec:first-of-type { margin-top:10px; padding-top:0; border-top:0; }
#${IDS.panel} .oss-sec > .oss-caption { margin:0 0 10px; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:rgba(143,233,228,.85); font-weight:600; }
#${IDS.panel} .oss-seg { display:flex; gap:4px; }
#${IDS.panel} .oss-seg button { flex:1; padding:5px 0; font-size:10.5px; border-radius:7px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05); color:rgba(255,255,255,.72); cursor:pointer; transition:color .15s ease, border-color .15s ease, background .15s ease; }
#${IDS.panel} .oss-seg button:hover { color:#dafdfb; border-color:rgba(143,233,228,.35); }
#${IDS.panel} .oss-seg button.on { border-color:rgba(143,233,228,.55); background:rgba(143,233,228,.16); color:#dafdfb; }
#${IDS.panel} .oss-inline { display:flex; align-items:center; gap:8px; margin-top:9px; }
#${IDS.panel} .oss-inline > label { flex:0 0 52px; font-size:11px; color:rgba(255,255,255,.7); }
#${IDS.panel} .oss-mini { width:100%; min-width:0; padding:5px 8px; border-radius:7px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#eef4f6; font-size:11px; font-variant-numeric:tabular-nums; }
#${IDS.panel} .oss-mini:disabled { opacity:.45; }
#${IDS.panel} .oss-sub { margin-top:7px; font-size:10px; line-height:1.65; color:rgba(255,255,255,.55); }
#${IDS.panel} .oss-locate { flex:0 0 auto; width:auto; cursor:pointer; padding:5px 10px; }
#${IDS.panel} .oss-locate:hover { border-color:rgba(255,255,255,.34); background:rgba(255,255,255,.12); }
#${IDS.panel} .oss-locate-out { margin:0; }
#${IDS.panel} .oss-col { margin-top:10px; }
#${IDS.panel} .oss-col-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; font-size:11px; color:rgba(255,255,255,.72); }
#${IDS.panel} .oss-col-head input[type='checkbox'] { width:14px; height:14px; margin:0; accent-color:#8fe9e4; cursor:pointer; }
#${IDS.panel} .oss-col .oss-seg button { padding:4px 0; font-size:10px; }
#${IDS.panel} .oss-col.off .oss-seg { display:none; }
@media (prefers-reduced-motion: reduce) {
  #${IDS.button}, #${IDS.panel}, #${IDS.panel} * { transition:none !important; }
}`;
  }

  function createController(options) {
    if (!options || typeof options.assetUrl !== 'function' || !options.storage) {
      throw new TypeError('OpenSeaSkinCore requires assetUrl() and storage adapters.');
    }

    let copy = selectCopy(options.locale);
    let state = { ...DEFAULTS };
    let ownsSurface = false;
    let panelOpen = false;
    let previousFocus = null;
    let placementObserver = null;
    let placementFrame = 0;
    const surfaceCleanups = [];
    const controllerCleanups = [];

    const on = (target, event, listener, settings) => {
      target.addEventListener(event, listener, settings);
      surfaceCleanups.push(() => target.removeEventListener(event, listener, settings));
    };

    const save = (patch) => {
      state = normalize({ ...state, ...patch });
      return Promise.resolve(options.storage.set(patch)).catch((error) => {
        console.warn('[Open Sea Skin] Failed to save settings.', error);
      });
    };

    const updateGlass = () => {
      const style = document.getElementById(IDS.glass);
      if (style) style.textContent = glassCss(state.glass, state);
    };

    const post = (message) => {
      const frame = document.getElementById(IDS.frame);
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return;
      let targetOrigin = '*';
      try { targetOrigin = new URL(frame.src).origin; } catch { /* local test documents may have no absolute base URL */ }
      frame.contentWindow.postMessage(message, targetOrigin);
    };

    const postToOcean = (sea) => {
      // Daylight is always driven by `oss-sun` now; the legacy `auto` flag must
      // stay false or the iframe would resume its own 12-minute sine cycle.
      post({
        type: 'oss-set', sea: sea === undefined ? state.sea : sea, t: state.time, auto: false,
      });
    };

    const postSun = () => {
      post({
        type: 'oss-sun',
        mode: state.sunMode,
        t: state.time,
        lat: state.lat,
        lon: state.lon,
        moon: state.moon,
        stars: state.stars,
        clouds: state.clouds,
      });
    };

    const COLUMN_SELECTORS = {
      colLeft: ['[data-slot="sidebar"]', '.dshDesktopSidebarSurface', '#root > div:first-child > :first-child'],
      colCenter: ['[data-slot="main.conversation"]', '.dshDesktopConversationSurface'],
      colRight: ['[data-rightbar-col]', '.dshDesktopDetailsSurface'],
    };

    const measureColumns = () => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const pick = (key) => {
        const column = state[key];
        if (!column || !column.on) return null;
        const level = BLUR_LEVELS[column.level] || 0;
        if (!level) return null;
        const element = COLUMN_SELECTORS[key]
          .map((selector) => document.querySelector(selector))
          .find((candidate) => {
            if (!(candidate instanceof HTMLElement)) return false;
            const rect = candidate.getBoundingClientRect();
            return rect.width > 8 && rect.height > 8;
          });
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return {
          x0: rect.left / width,
          y0: rect.top / height,
          x1: rect.right / width,
          y1: rect.bottom / height,
          level,
        };
      };
      return [pick('colLeft'), pick('colCenter'), pick('colRight')].filter(Boolean).slice(0, 3);
    };

    const postGlass = () => {
      // The in-renderer pass only runs in `render` mode; CSS mode blurs itself
      // and must leave the water sharp so the two do not fight.
      const active = state.enabled && !state.perf && state.glassMode === 'render';
      post({ type: 'oss-glass', mode: state.glassMode, perf: state.perf, rects: active ? measureColumns() : [] });
    };

    // ---- fleet: one boat per running subagent -------------------------------
    let fleetTimer = 0;
    let fleetInFlight = false;
    let fleetCount = -1;

    const boatOutEl = () => document.getElementById(`${IDS.panel}-${'boat-out'}`);

    const postFleet = (count) => {
      const shown = state.boats && state.enabled ? count : 0;
      if (shown === fleetCount) return;
      fleetCount = shown;
      post({ type: 'oss-fleet', count: shown });
    };

    const setBoatNote = (text) => {
      const el = boatOutEl();
      if (el) el.textContent = text;
    };

    const pollFleet = async () => {
      if (!state.boats || fleetInFlight) return;
      const snapshot = readMetrics();
      const sessionId = snapshot && snapshot.sessionId;
      if (!sessionId) {
        setBoatNote(copy.boatLoading);
        return;
      }
      fleetInFlight = true;
      try {
        const response = await fetch(`${FLEET_PATH}?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const data = await response.json();
        const count = Math.max(0, Math.min(12, Number(data && data.running) || 0));
        postFleet(count);
        if (data && data.ok === true) setBoatNote(count > 0 ? copy.boatCount.replace('{n}', String(count)) : copy.boatIdle);
        else setBoatNote(`${copy.boatOffline} ${data && data.error ? `(${data.error})` : ''}`.trim());
      } catch {
        setBoatNote(copy.boatOffline);
      } finally {
        fleetInFlight = false;
      }
    };

    const startFleetEngine = () => {
      stopFleetEngine();
      void pollFleet();
      fleetTimer = window.setInterval(() => { void pollFleet(); }, 4000);
    };

    const stopFleetEngine = () => {
      if (fleetTimer) window.clearInterval(fleetTimer);
      fleetTimer = 0;
    };

    let waveTimer = 0;
    let glassTimer = 0;
    let seaValue = state.sea;
    let rate = 0;
    let lastTotal = null;
    let lastAt = 0;
    let lastActiveAt = 0;
    let lastSession = null;

    const readMetrics = () => {
      const store = globalThis.__openSeaSkinMetrics;
      return store && typeof store.read === 'function' ? store.read() : null;
    };

    const stepWave = () => {
      const now = performance.now();
      const floor = state.floor;
      const span = Math.max(0, 100 - floor);
      let target = state.sea;

      if (state.waveMode === 'manual') {
        rate = 0;
        target = state.sea;
      } else {
        const snapshot = readMetrics();
        if (!snapshot) {
          target = floor;
        } else {
          const total = (snapshot.cachedTokens || 0) + (snapshot.uncachedTokens || 0) + (snapshot.outputTokens || 0);
          if (snapshot.sessionId !== lastSession) {
            lastSession = snapshot.sessionId;
            lastTotal = total;
            lastAt = now;
            rate = 0;
          }
          const seconds = Math.max(0.05, (now - lastAt) / 1000);
          const delta = Math.max(0, total - (lastTotal === null ? total : lastTotal));
          lastTotal = total;
          lastAt = now;
          if (delta > 0) lastActiveAt = now;
          const instant = delta / seconds;
          const alphaRate = 1 - Math.exp(-seconds / Math.max(0.5, state.smooth));
          rate += (instant - rate) * alphaRate;
          if (delta === 0) rate *= Math.exp(-seconds / Math.max(1, state.smooth * 2));

          const running = now - lastActiveAt < Math.max(2000, state.smooth * 700);
          const byThroughput = floor + span * (1 - Math.exp(-rate / Math.max(1, state.r0)));
          const yuan = Math.max(0, snapshot.costYuan || 0);
          const byAmount = floor + span * (Math.log1p(yuan) / Math.log1p(Math.max(1, state.amountFull)));
          if (state.waveMode === 'amount') target = byAmount;
          else target = running ? byThroughput : byAmount;
        }
      }

      const alphaSea = 1 - Math.exp(-0.25 / Math.max(0.4, state.smooth / 2));
      seaValue += (target - seaValue) * alphaSea;
      postToOcean(seaValue);
    };

    const startWaveEngine = () => {
      stopWaveEngine();
      waveTimer = window.setInterval(stepWave, 250);
      stepWave();
    };

    const stopWaveEngine = () => {
      if (waveTimer) window.clearInterval(waveTimer);
      waveTimer = 0;
    };

    const placeButton = () => {
      const button = document.getElementById(IDS.button);
      if (!(button instanceof HTMLElement)) return;
      const selectors = [
        '[data-slot="sidebar.settings"] button',
        '[data-testid="settings-trigger"]',
        '.VOzbGW_trigger',
      ];
      const trigger = selectors.map((selector) => document.querySelector(selector))
        .find((candidate) => candidate instanceof HTMLElement && candidate.getBoundingClientRect().width > 0);
      if (trigger instanceof HTMLElement) {
        const rect = trigger.getBoundingClientRect();
        button.style.left = `${Math.round(rect.right + 8)}px`;
        button.style.top = `${Math.round(rect.top + rect.height / 2 - 17)}px`;
        button.style.bottom = 'auto';
      } else {
        button.style.left = '16px';
        button.style.bottom = '16px';
        button.style.top = 'auto';
      }
    };

    const schedulePlace = () => {
      cancelAnimationFrame(placementFrame);
      placementFrame = requestAnimationFrame(placeButton);
    };

    const setPanelOpen = (open) => {
      const button = document.getElementById(IDS.button);
      const panel = document.getElementById(IDS.panel);
      if (!(button instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;
      panelOpen = open;
      panel.classList.toggle('open', open);
      button.classList.toggle('active', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        previousFocus = document.activeElement;
        const rect = button.getBoundingClientRect();
        panel.style.left = `${Math.min(Math.max(12, rect.left - panel.offsetWidth + 34), window.innerWidth - panel.offsetWidth - 12)}px`;
        panel.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 10)}px`;
        panel.querySelector('input')?.focus();
      } else if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };

    const mountOcean = () => {
      const root = document.body || document.documentElement;
      if (!root || document.getElementById(IDS.frame)) return false;
      const frame = document.createElement('iframe');
      const query = new URLSearchParams({
        skin: '1',
        sea: String(state.sea),
        t: String(state.time),
        auto: state.autoCycle ? '1' : '0',
        parentOrigin: location.origin,
      });
      frame.id = IDS.frame;
      frame.src = `${options.assetUrl('skin.html')}?${query}`;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:0;pointer-events:none;background:transparent;';
      root.insertBefore(frame, root.firstChild);

      const style = document.createElement('style');
      style.id = IDS.glass;
      style.textContent = glassCss(state.glass, state);
      (document.head || document.documentElement).appendChild(style);
      // Messages reach the frame only after its module ran; re-send on load.
      frame.addEventListener('load', () => {
        postSun();
        postGlass();
        postToOcean(state.waveMode === 'manual' ? state.sea : seaValue);
        startWaveEngine();
        startFleetEngine();
        if (glassTimer) window.clearInterval(glassTimer);
        glassTimer = window.setInterval(postGlass, 1500);
      }, { once: true });
      ownsSurface = true;
      return true;
    };

    const mountUi = () => {
      if (document.getElementById(IDS.button)) return;
      const style = document.createElement('style');
      style.id = IDS.uiStyle;
      style.textContent = uiCss();
      (document.head || document.documentElement).appendChild(style);

      const button = document.createElement('button');
      button.id = IDS.button;
      button.type = 'button';
      button.title = copy.button;
      button.setAttribute('aria-label', copy.button);
      button.setAttribute('aria-controls', IDS.panel);
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = WAVE_ICON;

      const panel = document.createElement('div');
      panel.id = IDS.panel;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-label', copy.button);

      const pid = (suffix) => `${IDS.panel}-${suffix}`;
      const rangeRow = (id, key, min, max, step) => `<div class="oss-row"><div class="oss-head"><label for="${id}" data-copy="${key}"></label><output class="oss-value" id="${id}-out"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" /></div>`;
      const segRow = (id, key, options) => `<div class="oss-row"><div class="oss-head"><span data-copy="${key}"></span></div><div class="oss-seg" id="${id}">${options.map(([value, copyKey]) => `<button type="button" data-value="${value}" data-copy="${copyKey}"></button>`).join('')}</div></div>`;
      const switchRow = (id, key) => `<div class="oss-row oss-switch"><label for="${id}" data-copy="${key}"></label><input type="checkbox" id="${id}" /></div>`;
      const colRow = (id, key) => `<div class="oss-col" id="${id}"><div class="oss-col-head"><span data-copy="${key}"></span><input type="checkbox" id="${id}-on" /></div><div class="oss-seg" id="${id}-level">${['off', 'weak', 'medium', 'strong'].map((level) => `<button type="button" data-value="${level}" data-copy="levels.${level}"></button>`).join('')}</div></div>`;
      const gradeOptions = [['off', 'grades.off'], ['low', 'grades.low'], ['mid', 'grades.mid'], ['high', 'grades.high']];

      panel.innerHTML = `
        <div class="oss-title"><span>OPEN SEA <span class="oss-mark">·</span> SKIN</span><button class="oss-close" type="button" aria-label="${copy.close}">×</button></div>
        <div class="oss-sec">
          <p class="oss-caption" data-copy="secSkin"></p>
          ${switchRow(pid('enabled'), 'enable')}
        </div>
        <div class="oss-sec">
          <p class="oss-caption" data-copy="secWave"></p>
          ${segRow(pid('wave-mode'), 'waveSource', [['manual', 'modes.manual'], ['throughput', 'modes.throughput'], ['amount', 'modes.amount']])}
          ${rangeRow(pid('sea-range'), 'manualSea', 0, 100, 1)}
          ${rangeRow(pid('floor'), 'floor', 0, 60, 1)}
          ${rangeRow(pid('r0'), 'r0', 1, 200, 1)}
          ${rangeRow(pid('amount-full'), 'amountFull', 1, 100, 1)}
          ${rangeRow(pid('smooth'), 'smooth', 2, 8, 0.5)}
          <p class="oss-sub" data-copy="waveNote"></p>
        </div>
        <div class="oss-sec">
          <p class="oss-caption" data-copy="secSun"></p>
          ${segRow(pid('sun-mode'), 'sunSource', [['real', 'sunModes.real'], ['manual', 'sunModes.manual']])}
          ${rangeRow(pid('time-range'), 'manualTime', 0, 100, 1)}
          <div class="oss-inline"><label for="${pid('lat')}" data-copy="lat"></label><input class="oss-mini" id="${pid('lat')}" type="number" step="0.01" min="-90" max="90" /></div>
          <div class="oss-inline"><label for="${pid('lon')}" data-copy="lon"></label><input class="oss-mini" id="${pid('lon')}" type="number" step="0.01" min="-180" max="180" /></div>
          <div class="oss-row"><button type="button" class="oss-mini oss-locate" id="${pid('locate')}" data-copy="locate"></button><span class="oss-sub oss-locate-out" id="${pid('locate-out')}"></span></div>
          ${switchRow(pid('moon'), 'moon')}
          ${segRow(pid('stars'), 'stars', gradeOptions)}
          ${segRow(pid('clouds'), 'clouds', gradeOptions)}
          <p class="oss-sub" data-copy="sunNote"></p>
        </div>
        <div class="oss-sec">
          <p class="oss-caption" data-copy="secBoat"></p>
          ${switchRow(pid('boats'), 'boats')}
          <p class="oss-sub" id="${pid('boat-out')}"></p>
          <p class="oss-sub" data-copy="boatNote"></p>
        </div>
        <div class="oss-sec">
          <p class="oss-caption" data-copy="secGlass"></p>
          ${segRow(pid('glass-mode'), 'glassMode', [['render', 'glassModes.render'], ['css', 'glassModes.css']])}
          ${switchRow(pid('perf'), 'perf')}
          ${colRow(pid('col-left'), 'cols.left')}
          ${colRow(pid('col-center'), 'cols.center')}
          ${colRow(pid('col-right'), 'cols.right')}
          ${rangeRow(pid('glass-range'), 'glass', 40, 90, 1)}
          <p class="oss-sub" data-copy="glassNote"></p>
        </div>
        <div class="oss-row"><button type="button" class="oss-reset" data-copy="reset"></button></div>
        <p class="oss-note" data-copy="note"></p>`;

      const host = document.body || document.documentElement;
      host.append(button, panel);

      const seaRange = panel.querySelector(`#${pid('sea-range')}`);
      const floorRange = panel.querySelector(`#${pid('floor')}`);
      const r0Range = panel.querySelector(`#${pid('r0')}`);
      const amountRange = panel.querySelector(`#${pid('amount-full')}`);
      const smoothRange = panel.querySelector(`#${pid('smooth')}`);
      const timeRange = panel.querySelector(`#${pid('time-range')}`);
      const glassRange = panel.querySelector(`#${pid('glass-range')}`);
      const seaOut = panel.querySelector(`#${pid('sea-range')}-out`);
      const floorOut = panel.querySelector(`#${pid('floor')}-out`);
      const r0Out = panel.querySelector(`#${pid('r0')}-out`);
      const amountOut = panel.querySelector(`#${pid('amount-full')}-out`);
      const smoothOut = panel.querySelector(`#${pid('smooth')}-out`);
      const timeOut = panel.querySelector(`#${pid('time-range')}-out`);
      const glassOut = panel.querySelector(`#${pid('glass-range')}-out`);
      const enabledBox = panel.querySelector(`#${pid('enabled')}`);
      const moonBox = panel.querySelector(`#${pid('moon')}`);
      const perfBox = panel.querySelector(`#${pid('perf')}`);
      const boatsBox = panel.querySelector(`#${pid('boats')}`);
      const latInput = panel.querySelector(`#${pid('lat')}`);
      const lonInput = panel.querySelector(`#${pid('lon')}`);
      const resetBtn = panel.querySelector('.oss-reset');

      const seg = (suffix) => panel.querySelector(`#${pid(suffix)}`);
      const segWave = seg('wave-mode');
      const segSun = seg('sun-mode');
      const segStars = seg('stars');
      const segClouds = seg('clouds');
      const segGlassMode = seg('glass-mode');
      const columns = {
        colLeft: { root: seg('col-left'), on: panel.querySelector(`#${pid('col-left')}-on`), level: seg('col-left-level') },
        colCenter: { root: seg('col-center'), on: panel.querySelector(`#${pid('col-center')}-on`), level: seg('col-center-level') },
        colRight: { root: seg('col-right'), on: panel.querySelector(`#${pid('col-right')}-on`), level: seg('col-right-level') },
      };

      const setSeg = (group, value) => {
        if (!(group instanceof HTMLElement)) return;
        for (const option of group.querySelectorAll('button')) {
          option.classList.toggle('on', option.dataset.value === value);
          option.setAttribute('aria-pressed', String(option.dataset.value === value));
        }
      };

      const setRowVisible = (control, visible) => {
        const row = control.closest('.oss-row');
        if (row instanceof HTMLElement) row.style.display = visible ? '' : 'none';
      };

      const syncUi = () => {
        enabledBox.checked = state.enabled;
        moonBox.checked = state.moon;
        perfBox.checked = state.perf;
        if (boatsBox) boatsBox.checked = state.boats;
        setSeg(segWave, state.waveMode);
        setSeg(segSun, state.sunMode);
        setSeg(segStars, state.stars);
        setSeg(segClouds, state.clouds);
        setSeg(segGlassMode, state.glassMode);
        for (const [key, entry] of Object.entries(columns)) {
          entry.on.checked = state[key].on;
          entry.root.classList.toggle('off', !state[key].on);
          setSeg(entry.level, state[key].level);
        }
        seaRange.value = String(state.sea);
        floorRange.value = String(state.floor);
        r0Range.value = String(state.r0);
        amountRange.value = String(state.amountFull);
        smoothRange.value = String(state.smooth);
        timeRange.value = String(state.time);
        glassRange.value = String(state.glass);
        seaOut.textContent = String(state.sea).padStart(2, '0');
        floorOut.textContent = String(state.floor);
        r0Out.textContent = `${Math.round(state.r0)} tok/s`;
        amountOut.textContent = `¥${state.amountFull}`;
        smoothOut.textContent = `${state.smooth}s`;
        glassOut.textContent = `${state.glass}%`;
        timeOut.textContent = state.sunMode === 'real' ? copy.realTime : timeLabel(copy, state.time);
        latInput.value = String(state.lat);
        lonInput.value = String(state.lon);
        setRowVisible(seaRange, state.waveMode === 'manual');
        setRowVisible(timeRange, state.sunMode === 'manual');
      };

      const refresh = () => {
        syncUi();
        updateGlass();
        postSun();
        postGlass();
        if (state.waveMode === 'manual') { seaValue = state.sea; postToOcean(seaValue); }
        syncUi();
      };

      // Harness may set lang after boot. Update only our own UI, in both
      // directions, without replacing controls or losing focus/listeners.
      const applyCopy = () => {
        for (const node of panel.querySelectorAll('[data-copy]')) {
          const value = node.dataset.copy.split('.').reduce((bag, key) => (bag && typeof bag === 'object' ? bag[key] : undefined), copy);
          if (typeof value === 'string') node.textContent = value;
        }
      };

      const syncLocale = () => {
        copy = selectCopy(options.locale);
        button.title = copy.button;
        button.setAttribute('aria-label', copy.button);
        panel.setAttribute('aria-label', copy.button);
        panel.querySelector('.oss-close').setAttribute('aria-label', copy.close);
        applyCopy();
        syncUi();
      };
      syncLocale();
      const localeObserver = new MutationObserver(syncLocale);
      localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      surfaceCleanups.push(() => localeObserver.disconnect());

      on(seaRange, 'input', () => {
        state.sea = clamp(seaRange.value, 0, 100, DEFAULTS.sea);
        seaValue = state.sea;
        seaOut.textContent = String(state.sea).padStart(2, '0');
        void save({ sea: state.sea });
        postToOcean(state.sea);
      });
      on(floorRange, 'input', () => {
        state.floor = clamp(floorRange.value, 0, 60, DEFAULTS.floor);
        floorOut.textContent = String(state.floor);
        void save({ floor: state.floor });
      });
      on(r0Range, 'input', () => {
        state.r0 = clamp(r0Range.value, 1, 200, DEFAULTS.r0);
        r0Out.textContent = `${Math.round(state.r0)} tok/s`;
        void save({ r0: state.r0 });
      });
      on(amountRange, 'input', () => {
        state.amountFull = clamp(amountRange.value, 1, 100, DEFAULTS.amountFull);
        amountOut.textContent = `¥${state.amountFull}`;
        void save({ amountFull: state.amountFull });
      });
      on(smoothRange, 'input', () => {
        state.smooth = clamp(smoothRange.value, 2, 8, DEFAULTS.smooth);
        smoothOut.textContent = `${state.smooth}s`;
        void save({ smooth: state.smooth });
      });
      on(timeRange, 'input', () => {
        state.time = clamp(timeRange.value, 0, 100, DEFAULTS.time);
        state.autoCycle = false;
        state.sunMode = 'manual';
        timeOut.textContent = timeLabel(copy, state.time);
        syncUi();
        void save({ time: state.time, autoCycle: false, sunMode: 'manual' });
        postSun();
      });
      on(glassRange, 'input', () => {
        state.glass = clamp(glassRange.value, 40, 90, DEFAULTS.glass);
        glassOut.textContent = `${state.glass}%`;
        updateGlass();
        void save({ glass: state.glass });
      });
      for (const [input, key, min, max] of [[latInput, 'lat', -90, 90], [lonInput, 'lon', -180, 180]]) {
        on(input, 'change', () => {
          state[key] = clamp(input.value, min, max, DEFAULTS[key]);
          input.value = String(state[key]);
          void save({ [key]: state[key] });
          postSun();
        });
      }
      const locateBtn = panel.querySelector(`#${pid('locate')}`);
      const locateOut = panel.querySelector(`#${pid('locate-out')}`);
      if (locateBtn) {
        on(locateBtn, 'click', () => {
          const geo = globalThis.navigator && globalThis.navigator.geolocation;
          if (!geo || typeof geo.getCurrentPosition !== 'function') {
            locateOut.textContent = copy.locateFail;
            return;
          }
          locateOut.textContent = copy.locateBusy;
          geo.getCurrentPosition(
            (position) => {
              const lat = Math.round(position.coords.latitude * 100) / 100;
              const lon = Math.round(position.coords.longitude * 100) / 100;
              state.lat = clamp(lat, -90, 90, DEFAULTS.lat);
              state.lon = clamp(lon, -180, 180, DEFAULTS.lon);
              if (latInput) latInput.value = String(state.lat);
              if (lonInput) lonInput.value = String(state.lon);
              locateOut.textContent = copy.locateOk;
              void save({ lat: state.lat, lon: state.lon });
              postSun();
            },
            () => {
              locateOut.textContent = copy.locateFail;
            },
            { timeout: 8000, maximumAge: 600000 }
          );
        });
      }

      on(panel, 'click', (event) => {
        const option = event.target instanceof Element ? event.target.closest('.oss-seg button') : null;
        if (!(option instanceof HTMLElement)) return;
        const group = option.parentElement;
        const value = option.dataset.value;
        if (!(group instanceof HTMLElement) || !value) return;
        const patch = (() => {
          switch (group.id) {
            case pid('wave-mode'): return { waveMode: value };
            case pid('sun-mode'): return { sunMode: value };
            case pid('stars'): return { stars: value };
            case pid('clouds'): return { clouds: value };
            case pid('glass-mode'): return { glassMode: value };
            case pid('col-left-level'): return { colLeft: { ...state.colLeft, level: value } };
            case pid('col-center-level'): return { colCenter: { ...state.colCenter, level: value } };
            case pid('col-right-level'): return { colRight: { ...state.colRight, level: value } };
            default: return null;
          }
        })();
        if (!patch) return;
        void save(patch);
        refresh();
      });

      for (const [key, entry] of Object.entries(columns)) {
        on(entry.on, 'change', () => {
          const patch = { [key]: { ...state[key], on: entry.on.checked } };
          void save(patch);
          refresh();
        });
      }

      on(enabledBox, 'change', () => {
        state.enabled = enabledBox.checked;
        void save({ enabled: state.enabled });
        // Only tear down the ocean surface, never the button/panel: otherwise
        // a disabled skin has no settings entry left to re-enable it.
        applyEnabled();
      });
      on(moonBox, 'change', () => {
        void save({ moon: moonBox.checked });
        postSun();
      });
      on(boatsBox, 'change', () => {
        void save({ boats: boatsBox.checked });
        if (!boatsBox.checked) postFleet(0);
        else void pollFleet();
      });
      on(perfBox, 'change', () => {
        void save({ perf: perfBox.checked });
        postGlass();
      });
      on(resetBtn, 'click', () => {
        void save({ ...DEFAULTS }).then(() => {
          seaValue = state.sea;
          refresh();
          applyEnabled();
        });
      });

      on(button, 'click', () => setPanelOpen(!panelOpen));
      on(panel.querySelector('.oss-close'), 'click', () => setPanelOpen(false));
      on(document, 'click', (event) => {
        if (panelOpen && !panel.contains(event.target) && !button.contains(event.target)) setPanelOpen(false);
      });
      on(document, 'keydown', (event) => {
        if (!panelOpen) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          setPanelOpen(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...panel.querySelectorAll('button, input')].filter((element) => !element.disabled);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      on(window, 'resize', () => { if (!panelOpen) schedulePlace(); });

      placementObserver = new MutationObserver(schedulePlace);
      placementObserver.observe(host, { childList: true, subtree: true });
      schedulePlace();
    };

    const unmount = () => {
      panelOpen = false;
      stopWaveEngine();
      stopFleetEngine();
      if (glassTimer) window.clearInterval(glassTimer);
      glassTimer = 0;
      placementObserver?.disconnect();
      placementObserver = null;
      cancelAnimationFrame(placementFrame);
      while (surfaceCleanups.length > 0) surfaceCleanups.pop()();
      if (ownsSurface) {
        document.getElementById(IDS.frame)?.remove();
        document.getElementById(IDS.glass)?.remove();
      }
      document.getElementById(IDS.button)?.remove();
      document.getElementById(IDS.panel)?.remove();
      document.getElementById(IDS.uiStyle)?.remove();
      ownsSurface = false;
    };

    const applyEnabled = () => {
      // The button/panel are the only way back in: mount the UI entry
      // regardless of enabled state, so a skin that starts disabled (or on a
      // host page that saved disabled) still offers the enable switch
      // (2026-08-23: previously the button was created only on first enable,
      // leaving a disabled-after-reload skin with no entry point at all).
      if (!document.getElementById(IDS.button)) mountUi();
      if (!state.enabled) {
        // Tear down only the ocean surface (frame + glass), keeping the
        // button/panel so the skin can be re-enabled from the same page.
        stopWaveEngine();
        if (glassTimer) window.clearInterval(glassTimer);
        glassTimer = 0;
        if (ownsSurface) {
          document.getElementById(IDS.frame)?.remove();
          document.getElementById(IDS.glass)?.remove();
          ownsSurface = false;
        }
        return;
      }
      // The extension and both native paths intentionally share the same ids.
      // Whichever implementation mounted first owns the surface; later ones
      // leave it untouched instead of double-rendering WebGPU.
      if (document.getElementById(IDS.frame)) return;
      if (mountOcean()) mountUi();
    };

    const ready = () => new Promise((resolve) => {
      if (document.body) { resolve(); return; }
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });

    const start = async () => {
      await ready();
      try {
        state = normalize(await options.storage.get(DEFAULTS));
      } catch (error) {
        console.warn('[Open Sea Skin] Failed to load settings; using defaults.', error);
      }
      seaValue = state.sea;
      applyEnabled();
      if (typeof options.listen === 'function') {
        const dispose = options.listen((patch) => {
          state = normalize({ ...state, ...patch });
          applyEnabled();
          updateGlass();
          postSun();
          postGlass();
          postToOcean();
        });
        if (typeof dispose === 'function') controllerCleanups.push(dispose);
      }
    };

    const stop = () => {
      unmount();
      while (controllerCleanups.length > 0) controllerCleanups.pop()();
    };

    return Object.freeze({ start, stop, getState: () => ({ ...state }) });
  }

  global.OpenSeaSkinCore = Object.freeze({ createController, DEFAULTS, IDS });
})(globalThis);


  const KEYS = Object.freeze({
    enabled: 'ossEnabled',
    sea: 'ossSea',
    time: 'ossTime',
    glass: 'ossGlass',
    autoCycle: 'ossAutoCycle',
    waveMode: 'ossWaveMode',
    floor: 'ossFloor',
    r0: 'ossR0',
    amountFull: 'ossAmountFull',
    smooth: 'ossSmooth',
    sunMode: 'ossSunMode',
    lat: 'ossLat',
    lon: 'ossLon',
    moon: 'ossMoon',
    stars: 'ossStars',
    clouds: 'ossClouds',
    glassMode: 'ossGlassMode',
    colLeft: 'ossColLeft',
    colCenter: 'ossColCenter',
    colRight: 'ossColRight',
    perf: 'ossPerf',
    boats: 'ossBoats',
  });

  const BOOLEAN_KEYS = new Set(['enabled', 'autoCycle', 'moon', 'perf', 'boats']);
  const JSON_KEYS = new Set(['colLeft', 'colCenter', 'colRight']);
  const TEXT_KEYS = new Set(['waveMode', 'sunMode', 'stars', 'clouds', 'glassMode']);

  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(KEYS[key]);
      if (value === null) return fallback;
      if (BOOLEAN_KEYS.has(key)) return value !== 'false';
      if (JSON_KEYS.has(key)) {
        try { return JSON.parse(value); } catch { return fallback; }
      }
      if (TEXT_KEYS.has(key)) return value;
      return Number(value);
    } catch {
      return fallback;
    }
  }

  // Official pricing (CNY per million tokens, 2026-11). Idle price is half the
  // peak price; peak = Beijing Mon-Fri 09:00-12:00 and 14:00-18:00.
  const PRICES = {
    'deepseek-flash': { off: { cacheRead: 0.02, input: 1, output: 4 }, peak: { cacheRead: 0.04, input: 2, output: 8 } },
    'deepseek-v4-pro': { off: { cacheRead: 0.15, input: 4.5, output: 13.5 }, peak: { cacheRead: 0.30, input: 9, output: 27 } },
  };
  const ALIAS = { 'deepseek-v4-flash': 'deepseek-flash', 'deepseek-v4-flash-vision-exp': 'deepseek-flash' };
  const FALLBACK_MODEL = 'deepseek-flash';

  function beijingPeak(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
      }).formatToParts(date);
      const fields = {};
      for (const part of parts) fields[part.type] = part.value;
      if (fields.weekday === 'Sat' || fields.weekday === 'Sun') return false;
      const minutes = (Number(fields.hour) % 24) * 60 + Number(fields.minute);
      return (minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080);
    } catch {
      return false;
    }
  }

  function rateFor(modelName, date) {
    const entry = PRICES[ALIAS[modelName] || modelName] || PRICES[FALLBACK_MODEL];
    return beijingPeak(date) ? entry.peak : entry.off;
  }

  function costOf(usage, model, date) {
    if (!usage) return 0;
    const rate = rateFor(model, date || new Date());
    const cached = usage.cacheReadTokens || 0;
    const uncached = usage.uncachedInputTokens || 0;
    const output = usage.outputTokens || 0;
    return (cached * rate.cacheRead + uncached * rate.input + output * rate.output) / 1e6;
  }

  // Written by the hidden React bridge, read by the controller's wave engine.
  const metricsStore = {
    value: null,
    read() { return this.value; },
    push(next) { this.value = next; },
  };

  exports.name = 'open-sea-skin-client';
  exports.inject = ['slots'];
  exports.apply = function apply(ctx) {
    globalThis.__openSeaSkinMetrics = metricsStore;

    const controller = globalThis.OpenSeaSkinCore.createController({
      assetUrl: (path) => '/open-sea-skin/' + path,
      storage: {
        get: async (defaults) => {
          const loaded = {};
          for (const key of Object.keys(KEYS)) loaded[key] = readSetting(key, defaults[key]);
          return loaded;
        },
        set: async (patch) => {
          try {
            for (const [key, value] of Object.entries(patch)) {
              if (!KEYS[key]) continue;
              localStorage.setItem(KEYS[key], typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
          } catch {
            // Locked-down storage keeps the live value for this page.
          }
        },
      },
    });
    void controller.start();
    ctx.effect(() => () => controller.stop(), 'open-sea-skin: browser surface');

    // Renders nothing: it only mirrors the session's cumulative token usage and
    // the active model into the store the wave engine polls.
    let React = null;
    try { React = require('react'); } catch { React = null; }
    if (!React || !ctx.slots || typeof ctx.slots.inject !== 'function') return;

    const Bridge = function OpenSeaSkinMetrics(props) {
      const usage = props.useProjection ? props.useProjection('tokenUsage') : null;
      const selection = props.useProjection ? props.useProjection('modelSelection') : null;
      React.useEffect(() => {
        const model = selection ? selection.next || selection.lastUsed : null;
        metricsStore.push({
          sessionId: props.sessionId || null,
          cachedTokens: (usage && usage.cacheReadTokens) || 0,
          uncachedTokens: (usage && usage.uncachedInputTokens) || 0,
          outputTokens: (usage && usage.outputTokens) || 0,
          costYuan: costOf(usage, model),
        });
      }, [usage, selection, props.sessionId]);
      return null;
    };
    Bridge.displayName = 'OpenSeaSkinMetrics';

    ctx.effect(() => ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'open-sea-skin-metrics', order: 900 },
      (props) => React.createElement(Bridge, props),
    )), 'open-sea-skin: metrics bridge');
  };

  return module.exports;
}});
