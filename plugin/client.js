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

  // Panel element ids are derived in one place: the readouts above and the
  // panel builder below must agree. A helper local to mountUi is invisible to
  // the readouts, which then throw ReferenceError on every tick.
  const pid = (suffix) => `${IDS.panel}-${suffix}`;

  // Host half of the skin: live roster of running subagents (one boat each).
  const FLEET_PATH = '/open-sea-skin/fleet';

  // Every number here is a continuous dial that reaches the ocean as a uniform,
  // so nothing in the panel snaps between looks. lat/lon start unset: the first
  // time the sky wants a real sun, the panel asks the browser where it is, and
  // only falls back to a fixed city if that is refused.
  const DEFAULTS = Object.freeze({
    enabled: true,
    sea: 45,
    time: 720,
    glass: 72,
    autoCycle: true,
    waveMode: 'throughput',
    floor: 25,
    r0: 25,
    amountFull: 10,
    smooth: 4,
    overflowGain: 1,
    sunMode: 'real',
    lat: null,
    lon: null,
    tzMode: 'system',
    tzOffset: 8,
    moon: true,
    // sky: distance and how much of the stereographic fold is applied
    skyDist: 2,
    domeAmount: 0.55,
    skyTone: 'real',
    // stars: brightness, art, haze
    stars: 100,
    starSize: 12,
    starMin: 4.2,
    starFalloff: 0.16,
    starColor: 1.5,
    starSpikes: 2.2,
    starBase: 0.82,
    starHalo: 0.28,
    starCount: 1,
    starBias: 0,
    starMode: 'real',
    starCut: 5.5,
    starsDaylight: false,
    twinkleSpeed: 1.5,
    twinkleAmp: 0.3,
    milky: 0.35,
    // constellations
    constellation: 100,
    cross: 100,
    lineWidth: 1,
    lineFadeDeg: 14,
    lineTwinkle: 0.8,
  lineSpeed: 0.55,
    // meteors
    meteor: true,
    meteorRate: 1,
    meteorBright: 1,
    // clouds
    clouds: 55,
    cloudSpeed: 1,
    cloudOpacity: 1,
    // 1.5.26: frame budget. The scene is fill bound, so the quality preset is
    // the lever that matters; glow is the one remaining full-screen pass.
    quality: 'low',
  fps: 24,
    glow: 55,
    glassStyle: 'gaussian',
    frost: true,
  glassMode: 'render',
    glassRadius: 20,
    colLeft: Object.freeze({ on: true, strength: 28 }),
    colRight: Object.freeze({ on: true, strength: 28 }),
    perf: false,
    boats: true,
    boatSpread: 2,
    boatPace: 1,
    boatScale: 2.5,
  });

  // Where the sky looks if the browser will not say: Shanghai. The value is
  // only a placeholder until a geolocation fix or a typed coordinate arrives.
  const FALLBACK_PLACE = Object.freeze({ lat: 31.23, lon: 121.47 });

  // Old profiles stored a blur letter per column. Map it onto a strength.
  const LEGACY_COLUMN = Object.freeze({ off: 0, weak: 35, medium: 60, strong: 90 });
  const LEGACY_GLASS_PX = Object.freeze({ off: 0, weak: 10, medium: 18, strong: 30 });
  const GRADE_LEVELS = Object.freeze(['off', 'low', 'mid', 'high']);

  const COPY = Object.freeze({
    zh: {
      boatSpread: '横向范围',
      boatPace: '航速',
      boatScale: '船的大小',
      skyDist: '星空距离',
      button: '海洋皮肤设置',
      close: '关闭',
      sea: '波浪大小',
      time: '日光',
      glass: '玻璃不透明度',
      enable: '启用海洋皮肤',
      autoCycle: '自动昼夜循环',
      reset: '恢复默认',
      resetNote: '恢复默认：有自己保存的默认就用它，否则回到内置值（波浪 45 / 日光 55 / 玻璃 72 / 自动循环开）',
      makeDefault: '把当前设置设为默认',
      perfTier: '运行中：画质 {tier}',
      perfCap: '上限 {fps} fps',
      perfScale: '渲染比例 {scale}×（屏幕 {dpr}×）',
      perfFps: '实测 {fps} fps',
      defaultBuiltin: '当前默认：内置值。',
      defaultSaved: '当前默认：{at} 保存的快照。',
      previewCols: '预览左右栏范围（2.6 秒）',
      colsNote: '强度 0 或关掉开关 = 该栏不模糊。点上面按钮会在屏幕上框出左右两栏的真实区域。',
      note: '调节即时生效并自动保存。波浪与日照都按下面的设置实时驱动。',
      times: ['黄昏', '金色时刻', '下午', '正午'],
      secSkin: '皮肤',
      secWave: '波浪',
      secSun: '天空控制',
      secBoat: '船',
      boats: '显示船只',
      boatNote: '每个子智能体一艘船；没有子智能体时海面保留 1 艘。切会话会跟着变。',
      boatIdle: '本会话没有子智能体（海面保留 1 艘）',
      boatCount: '本会话 {n} 个子智能体，{m} 个正在运行',
      boatLoading: '读取中…',
      boatOffline: '读不到子智能体列表（接口未启用？）',
      boatStale: '宿主插件还是旧版，先按右上角刷新按钮或重启桌面端',
      boatOff: '已关闭船只',
      secGlass: '毛玻璃',
    frost: '背景模糊',
    hints: {
      qualityMode: '画质档位：高 = 1.5× 像素比 / 60 fps；平衡 = 1.0× / 45；省电 = 0.85× / 30。只改内部渲染分辨率与目标帧率，面板本身不变。',
      fpsMode: '帧率上限：显卡每秒最多画多少帧，越低越省电。与上面画质档位独立，取两者中更省的那个。',
      glow: '泛光强度：地平线、太阳与月光的高光溢出。0 = 关掉整个 1/4 分辨率泛光 pass。',
      glassMode: '渲染器内 = 毛玻璃在 WebGPU 里做（可逐栏、可调半径）；CSS 模糊 = 交给浏览器，省 GPU 但只有一档。',
      glassStyle: '模糊的取样形状：高斯最自然、盒式最省、双层更厚、径向中间清楚边缘糊、磨砂有颗粒、玻璃砖成块。',
      perf: '性能模式：一键关掉毛玻璃与额外采样，只保留海面与天空。',
      frost: '背景模糊总开关。关掉后三栏与外壳都不再糊，但设置面板仍保留 9px 底模糊以便阅读。',
      cols: {
        left: '左侧栏（会话/项目列表）。',
        right: '右侧栏（文件与预览面板，未打开时不生效）。',
      },
      skyDist: '把整片天空压进一个更宽的角度；1 倍是真实视场，2 倍能看到更多星座。',
      stars: '星点的总亮度。0 关闭星空，150% 最亮。',
      starSize: '最亮那颗星（星等 0）的直径，暗星按星等缩小。',
      starFalloff: '星等每差 1 等缩小多少，0.16 接近肉眼观感。',
      starColor: '色温饱和度。100% 用真实 B−V 颜色，0 是纯白。',
      starBias: '整体偏冷（负）或偏暖（正），用来抵消屏幕色偏。',
      starMode: '真实 = 天文色；单色 = 全白；夸张 = 放大蓝橙差异。',
      starHalo: '每颗星外圈的柔光占比，0 是硬点。',
      starCount: '背景里随机撒的那层星，不来自星表。',
      twinkleSpeed: '星点闪烁的快慢。',
      twinkleAmp: '星点闪烁的幅度，0 完全不闪。',
      milky: '银河强度。银心落到地平线下会自动变淡。',
      skyTone: '整体色调：真实 / 偏蓝 / 偏暖。',
      constellation: '星座连线的亮度。',
      cross: '星点十字星芒的亮度。',
      lineWidth: '连线粗细。星点会跟着放大，避免粗线顶着针尖。',
      lineFadeDeg: '连线在地平线上方多少度内淡出。',
      lineTwinkle: '整个星座一起呼吸的幅度，0 是常亮。',
      lineSpeed: '呼吸快慢，0.55 约 11 秒一拍。',
      starSpikes: '星等亮于这个值的星才有星芒（默认 2.2 等，约 60 颗）。',
      starCut: '暗于这个星等就不画了，越小越省。',
      meteorRate: '流星出现频率的倍数。',
      meteorBright: '流星亮度倍数。',
      clouds: '云量。',
      cloudSpeed: '云的漂移速度。',
      cloudOpacity: '云的不透明度。',
      glassRadius: '背景模糊的真实半径（像素）。',
      glow: '泛光强度，0 关闭，能省一点 GPU。',
      quality: '画质档位：影响像素比与分辨率自适应。',
      fps: '帧率上限，越低越省电。',
      boatSpread: '船在水平方向能游多远。',
      boatPace: '船的巡航速度。',
      boatScale: '船的大小。',
      overflowGain: '超预算时白冠与喷雾的敏感度。',
      time: '按当地时间拖动，覆盖全天 24 小时。',
      tzOffset: '手动指定该地时区，只影响读数显示。',
      glass: '面板与三栏底色的不透明度：0 = 完全透明（只剩边框），100 = 实底。',
      colStrength: '这一栏享受多少背景模糊。',
    },
      waveSource: '驱动来源',
      manualSea: '手动波浪',
      floor: '波谷下限',
      r0: '半浪吞吐',
      amountFull: '满浪金额',
      smooth: '平滑时间',
      waveNote: '吞吐模式：会话运行时按当前 token 速率起伏，停下来回落到本会话累计消费对应的浪高；金额模式：始终按累计消费。',
      waveOutNone: '指标未连接（等一帧，或刷新页面）',
      waveOut: '来源{src} · 消费 ¥{cost}（满浪 ¥{full}）· 吞吐 {rate} tok/s · 浪 {sea}',
      waveBridgeNone: '指标桥未挂载',
      waveBridge: '指标桥 {n} 次 · {s}s 前',
      bridgeWhy: { 'no-slots': '未拿到 slots 服务', 'slots-shape': 'slots 接口不符', 'inject-failed': '注入失败，见控制台', 'no-ctx': '没有 ctx' },
      waveSrcManual: '手动',
      waveSrcThroughput: '吞吐',
      waveSrcAmount: '金额',
      sunSource: '时间来源',
      manualTime: '手动时刻（24 小时）',
  timeNow: '现在',
      lat: '纬度',
      lon: '经度',
      locate: '使用我的位置',
      locateBusy: '定位中…',
      locateOk: '已更新坐标',
      locateFail: '定位失败，请手动填经纬度',
      moon: '显示月亮',
      stars: '星空',
      constellation: '星座连线',
      crossStars: '十字星',
      meteor: '流星',
      moonOut: '月亮：—',
    sunOut: '太阳：—',
    sunReadout: '太阳：真实高度 {el}°，方位 {az}°，画面里画在 {view}°',
    sunReadoutNight: '太阳：现在在地平线下（方位 {az}°），夜里没有日盘',
    sunReadoutManual: '太阳：按手动时刻计算（滑杆=当地时间，全天 24 小时）',
      sunTimes: '今日 日出 {rise} · 日落 {set}',
      sunTimesNone: '今日无日出日落（极昼或极夜）',
      moonInfo: '月亮：{name}，亮面 {p}%，高度 {h}°',
      moonBelow: '月亮：{name}，亮面 {p}%，现在在地平线下',
      moonOff: '月亮：已关闭',
      clouds: '云量',
      sunNote: '按经纬度用真实时钟计算太阳与月亮的位置；高度角尽量保持真实，只有方位折进画面，不联网。',
      realTime: '真实',
      moonNames: ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'],
      glassMode: '实现方式',
      perf: '高性能模式',
      glassNote: '模糊与底色是两件事：模糊归上面的总开关，底色归这个滑杆。渲染器内模糊最省；CSS 模糊更兼容但更吃帧。三栏可分别开关与调强度。',
      search: '搜索设置项…',
      secSky: '天空与日照',
      secStars: '星空',
      secConst: '星座',
      secMeteor: '流星',
      secClouds: '云',
      secAdvanced: '高级',
      skyTone: '夜色倾向',
      domeAmount: '穹顶弧度',
      starSize: '星点大小',
      starMin: '最暗星大小',
      starFalloff: '星等衰减',
      starColor: '色温饱和度',
      starSpikes: '星芒阈值',
      starBase: '星星亮度',
      starHalo: '光晕',
      starCount: '底噪星场',
      twinkleSpeed: '闪烁速度',
      twinkleAmp: '闪烁幅度',
      milky: '银河带',
  milkyPending: '银河：等待海面上报',
  milkyStarsOff: '银河：星空已关闭',
  milkyHidden: '银河：被天光或地平线挡住',
  milkyStrong: '银河：可见，银心高度 {alt}°',
  milkyWeak: '银河：偏弱，银心贴地平 {alt}°',
  milkyOuter: '银河：只剩外臂，银心在地平下 {alt}°',
  starBias: '色温偏置',
  starCut: '星等截止',
  starMode: '色彩模式',
  starModes: { real: '真实', mono: '单色', vivid: '夸张' },
  starsDaylight: '白天也显示星空',
  lineTwinkle: '连线闪烁',
  lineSpeed: '闪烁速度',
  overflowGain: '超限敏感度',
  glassStyle: '模糊形状',
  magSuffix: ' 等',
  glassStyles: { gaussian: '高斯', box: '盒式', double: '双层', radial: '径向', frost: '磨砂', tile: '玻璃砖' },
      lineWidth: '连线粗细',
      lineFadeDeg: '地平淡出',
      meteorRate: '出现频率',
      meteorBright: '亮度',
      cloudSpeed: '漂移速度',
      cloudOpacity: '不透明度',
      glassRadius: '模糊半径',
      perfGroup: '性能',
  fpsMode: '帧率上限',
  fps: { 24: '24 fps', 30: '30 fps', 45: '45 fps', 60: '60 fps' },
      qualityMode: '画质档位',
      quality: {
        high: '高',
        balanced: '平衡',
        low: '省电',
      },
      glow: '泛光',
      colStrength: '强度',
      tzMode: '时钟',
      tzOffset: '时区偏移',
      clockOut: '本机 {local} · 该地 {place}',
    clockManual: '手动时刻 {at} · 太阳与月亮按该时刻计算',
      twilightOut: '暮光 民用 {civil} · 航海 {nautical} · 天文 {astro}',
      twilightNone: '—',
      skyTones: { real: '真实', blue: '深蓝', warm: '暖夜' },
      tzModes: { system: '跟本机', longitude: '按经度', manual: '手动' },
      cols: { left: '左侧栏', center: '交互区', right: '右侧栏' },
      modes: { manual: '手动', throughput: '吞吐', amount: '金额' },
      sunModes: { real: '真实时钟', manual: '手动' },
      grades: { off: '关', low: '少', mid: '中', high: '多' },
      glassModes: { render: '渲染器内', css: 'CSS 模糊' },
      levels: { off: '关', weak: '弱', medium: '中', strong: '强' },
    },
    en: {
      boatSpread: 'Sweep',
      boatPace: 'Pace',
      boatScale: 'Hull size',
      skyDist: 'Sky distance',
      button: 'Open Sea skin settings',
      close: 'Close',
      sea: 'Sea state',
      time: 'Daylight',
      glass: 'Glass opacity (0 = clear, 100 = solid)',
      enable: 'Enable Open Sea skin',
      autoCycle: 'Automatic day cycle',
      reset: 'Reset to defaults',
      resetNote: 'Restore: your saved baseline if you have one, otherwise the built-in values (sea 45 / daylight 55 / glass 72 / auto cycle on)',
      makeDefault: 'Use current settings as defaults',
      perfTier: 'Running: {tier}',
      perfCap: 'cap {fps} fps',
      perfScale: 'render scale {scale}x (screen {dpr}x)',
      perfFps: 'measured {fps} fps',
      defaultBuiltin: 'Defaults: built-in values.',
      defaultSaved: 'Defaults: snapshot saved {at}.',
      previewCols: 'Preview both rails (2.6 s)',
      colsNote: 'Strength 0 or the switch off means that rail stays sharp. The button above outlines both rails on screen.',
      note: 'Changes apply immediately and save automatically.',
      times: ['Dusk', 'Golden hour', 'Afternoon', 'Midday'],
      secSkin: 'Skin',
      secWave: 'Waves',
      secSun: 'Sky',
      secBoat: 'Boats',
      boats: 'Show boats',
      boatNote: 'One boat per subagent, and one kept afloat when the session has none. Switching sessions reshapes it.',
      boatIdle: 'No subagent in this session (one boat kept afloat)',
      boatCount: '{n} subagent(s) in this session, {m} running',
      boatLoading: 'Reading…',
      boatOffline: 'Subagent roster unavailable (endpoint off?)',
      boatStale: 'Host plugin is stale: press the header refresh button, or restart',
      boatOff: 'Boats off',
      secGlass: 'Frosted glass',
    frost: 'Background blur',
    hints: {
      qualityMode: 'Quality: high = 1.5x pixel ratio / 60 fps; balanced = 1.0x / 45; saver = 0.85x / 30. It only changes the internal render size and frame target, never the panel.',
      fpsMode: 'Frame cap: how many frames per second the GPU draws. Independent of quality; the lower of the two wins.',
      glow: 'Bloom strength on the horizon, sun and moon. At 0 the whole quarter-resolution bloom pass is skipped.',
      glassMode: 'Renderer = blur inside WebGPU (per column, real radius); CSS = the browser does it: cheaper, one radius only.',
      glassStyle: 'Kernel shape: gaussian is the most natural, box the cheapest, double thicker, radial sharp centre, frost grainy, tile blocky.',
      perf: 'Performance mode: drops the glass and extra taps, keeps water and sky.',
      frost: 'Master background blur. Off leaves all columns sharp, while the settings panel keeps a 9px floor so it stays readable.',
      cols: {
        left: 'Left column: the session and project list.',
        right: 'Right column: files and preview. Has no effect while it is closed.',
      },
      skyDist: 'Packs the sky into a wider angle; 1x is the real field, 2x folds in more constellations.',
      stars: 'Overall star brightness. 0 hides the sky, 150% is the brightest.',
      starSize: 'Diameter of a magnitude-0 star; fainter ones shrink along the scale.',
      starFalloff: 'How much a star shrinks per magnitude. 0.16 matches the naked eye.',
      starColor: 'Saturation of the B-V colour; 100% is the catalogue, 0 is white.',
      starBias: 'Shift the sky cooler (negative) or warmer (positive).',
      starMode: 'Real = astronomical colour; mono = white; vivid = exaggerated.',
      starHalo: 'Soft glow around each dot; 0 makes it a hard pixel.',
      starCount: 'The random background haze that is not from the catalogue.',
      twinkleSpeed: 'How fast the dots scintillate.',
      twinkleAmp: 'How much they scintillate; 0 keeps them steady.',
      milky: 'Strength of the Milky Way; it fades when the core sets.',
      skyTone: 'Overall cast: real / blue / warm.',
      constellation: 'Brightness of the constellation figures.',
      cross: 'Brightness of the four-point spikes.',
      lineWidth: 'Stroke width; the dots grow with it so a thick leg never ends in a pinhead.',
      lineFadeDeg: 'Degrees above the horizon where the figures dissolve.',
      lineTwinkle: 'Depth of the whole-figure breathing; 0 keeps it steady.',
      lineSpeed: 'Speed of that breath; 0.55 is about one beat per 11 seconds.',
      starSpikes: 'Stars brighter than this get spikes (default 2.2, about 60 stars).',
      starCut: 'Nothing fainter than this magnitude is drawn; lower saves work.',
      meteorRate: 'Multiplier on how often meteors appear.',
      meteorBright: 'Multiplier on meteor brightness.',
      clouds: 'Cloud cover.',
      cloudSpeed: 'How fast the cloud drifts.',
      cloudOpacity: 'How solid the cloud looks.',
      glassRadius: 'Real blur radius of the background, in pixels.',
      glow: 'Bloom strength; 0 turns it off and saves a little GPU.',
      quality: 'Pixel ratio and adaptive resolution: high / balanced / saver.',
      fps: 'Frame rate ceiling; lower is cheaper.',
      boatSpread: 'How far the hulls range sideways.',
      boatPace: 'Cruising speed of the boats.',
      boatScale: 'Size of the boats.',
      overflowGain: 'How eagerly over-budget sessions grow whitecaps and spray.',
      time: 'Drag through the local 24 hour day.',
      tzOffset: 'Manual timezone for the readout only.',
      glass: 'Opacity of the three background columns.',
      colStrength: 'How much blur this column gets.',
    },
      waveSource: 'Driven by',
      manualSea: 'Manual sea state',
      floor: 'Wave floor',
      r0: 'Half-wave rate',
      amountFull: 'Full-wave cost',
      smooth: 'Smoothing',
      waveNote: 'Throughput: swells with the current token rate and settles to this session\u2019s spend when idle. Cost: always follows spend.',
      waveOutNone: 'No metrics yet (wait a tick, or reload)',
      waveOut: '{src} · spend ¥{cost} (full wave ¥{full}) · {rate} tok/s · sea {sea}',
      waveBridgeNone: 'metrics bridge not mounted',
      waveBridge: 'bridge {n} pushes · {s}s ago',
      bridgeWhy: { 'no-slots': 'no slots service', 'slots-shape': 'slots has an unexpected shape', 'inject-failed': 'injection failed, see console', 'no-ctx': 'no plugin context' },
      waveSrcManual: 'manual',
      waveSrcThroughput: 'throughput',
      waveSrcAmount: 'spend',
      sunSource: 'Time source',
      manualTime: 'Manual clock (24 h)',
  timeNow: 'Now',
      lat: 'Latitude',
      lon: 'Longitude',
      locate: 'Use my location',
      locateBusy: 'Locating…',
      locateOk: 'Coordinates updated',
      locateFail: 'Location unavailable, type it manually',
      moon: 'Show moon',
      stars: 'Stars',
      constellation: 'Constellations',
      crossStars: 'Cross stars',
      meteor: 'Meteors',
      moonOut: 'Moon: \u2014',
    sunOut: 'Sun: \u2014',
    sunReadout: 'Sun: {el}\u00b0 up at bearing {az}\u00b0, drawn at {view}\u00b0 in the frame',
    sunReadoutNight: 'Sun: below the horizon now (bearing {az}\u00b0), no disc at night',
    sunReadoutManual: 'Sun: solved for the manual clock (slider = local time, full 24 h)',
      sunTimes: 'today {rise} sunrise \u00b7 {set} sunset',
      sunTimesNone: 'no sunrise or sunset today (polar day or night)',
      moonInfo: 'Moon: {name}, {p}% lit, {h}\u00b0 up',
      moonBelow: 'Moon: {name}, {p}% lit, below the horizon',
      moonOff: 'Moon: off',
      clouds: 'Clouds',
      sunNote: 'Sun and moon come from your coordinates and the real clock; altitude stays true, only the bearing is folded into the frame. Offline.',
      realTime: 'Real',
      moonNames: ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
      glassMode: 'Implementation',
      perf: 'Performance mode',
      glassNote: 'Blur and fill are separate: the switch above owns the blur, this slider owns the fill. In-renderer blur is cheapest; CSS blur is more compatible but costs frames.',
      search: 'Search settings…',
      secSky: 'Sky & daylight',
      secStars: 'Stars',
      secConst: 'Constellations',
      secMeteor: 'Meteors',
      secClouds: 'Clouds',
      secAdvanced: 'Advanced',
      skyTone: 'Night tint',
      domeAmount: 'Dome curve',
      starSize: 'Star size',
      starMin: 'Faint floor',
      starFalloff: 'Magnitude falloff',
      starColor: 'Colour saturation',
      starSpikes: 'Spike gate',
      starBase: 'Star brightness',
      starHalo: 'Halo',
      starCount: 'Faint field',
      twinkleSpeed: 'Twinkle speed',
      twinkleAmp: 'Twinkle depth',
      milky: 'Milky Way',
  milkyPending: 'Milky Way: waiting for the surface',
  milkyStarsOff: 'Milky Way: stars are off',
  milkyHidden: 'Milky Way: washed out or below the horizon',
  milkyStrong: 'Milky Way: visible, core at {alt}°',
  milkyWeak: 'Milky Way: faint, core near the horizon at {alt}°',
  milkyOuter: 'Milky Way: outer arm only, core is {alt}° below',
  starBias: 'Colour bias',
  starCut: 'Magnitude cut',
  starMode: 'Colour mode',
  starModes: { real: 'Real', mono: 'Mono', vivid: 'Vivid' },
  starsDaylight: 'Stars in daylight',
  lineTwinkle: 'Line twinkle',
  lineSpeed: 'Twinkle speed',
  overflowGain: 'Overflow gain',
  glassStyle: 'Blur shape',
  magSuffix: ' mag',
  glassStyles: { gaussian: 'Gaussian', box: 'Box', double: 'Double', radial: 'Radial', frost: 'Frost', tile: 'Tile' },
      lineWidth: 'Line weight',
      lineFadeDeg: 'Horizon fade',
      meteorRate: 'Rate',
      meteorBright: 'Brightness',
      cloudSpeed: 'Drift speed',
      cloudOpacity: 'Opacity',
      glassRadius: 'Blur radius',
      perfGroup: 'Performance',
  fpsMode: 'Frame rate',
  fps: { 24: '24 fps', 30: '30 fps', 45: '45 fps', 60: '60 fps' },
      qualityMode: 'Quality',
      quality: {
        high: 'High',
        balanced: 'Balanced',
        low: 'Power saver',
      },
      glow: 'Glow',
      colStrength: 'Strength',
      tzMode: 'Clock',
      tzOffset: 'UTC offset',
      clockOut: 'Here {local} · there {place}',
    clockManual: 'Manual {at} · sun and moon solved for that instant',
      twilightOut: 'Twilight civil {civil} · nautical {nautical} · astro {astro}',
      twilightNone: '—',
      skyTones: { real: 'Real', blue: 'Deep blue', warm: 'Warm night' },
      tzModes: { system: 'This machine', longitude: 'By longitude', manual: 'Manual' },
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

  // Two shipped builds hard-coded a city (Shanghai, then Wuhan). Anyone who
  // never touched the field still carries one of those pairs, so treat them as
  // "unset" once and let the machine's own location take over.
  const LEGACY_PLACES = [
    { lat: 31.23, lon: 121.47 },
    { lat: 30.59, lon: 114.31 },
  ];
  function isLegacyPlace(source) {
    return LEGACY_PLACES.some(
      (place) => Number(source.lat) === place.lat && Number(source.lon) === place.lon,
    );
  }

  const WAVE_MODES = ['manual', 'throughput', 'amount'];
  const STAR_MODES = ['real', 'mono', 'vivid'];
  const GLASS_STYLES = ['gaussian', 'box', 'double', 'radial', 'frost', 'tile'];
  const SKY_TONES = ['real', 'blue', 'warm'];
  const TZ_MODES = ['system', 'longitude', 'manual'];
const QUALITY_LEVELS = ['high', 'balanced', 'low'];
const FPS_LEVELS = [24, 30, 45, 60];

  // A column used to store a blur letter. It now stores a 0..100 strength, and
  // a saved letter is folded into one so old profiles keep their look.
  function normalizeColumn(raw, fallback) {
    const column = raw && typeof raw === 'object' ? raw : {};
    let strength = Number(column.strength);
    if (!Number.isFinite(strength)) {
      const legacy = LEGACY_COLUMN[column.level];
      strength = Number.isFinite(legacy) ? legacy : fallback.strength;
    }
    return { on: column.on !== false, strength: clamp(strength, 0, 100, fallback.strength) };
  }

  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const legacyPlace = isLegacyPlace(source);
    const lat = legacyPlace ? null : Number(source.lat);
    const lon = legacyPlace ? null : Number(source.lon);
    return {
      enabled: source.enabled !== false,
      sea: clamp(source.sea, 0, 100, DEFAULTS.sea),
      time: clamp(source.time, 0, 1439, DEFAULTS.time),
      glass: clamp(source.glass, 0, 100, DEFAULTS.glass),
      autoCycle: source.autoCycle !== false,
      waveMode: WAVE_MODES.includes(source.waveMode) ? source.waveMode : DEFAULTS.waveMode,
      floor: clamp(source.floor, 0, 60, DEFAULTS.floor),
      r0: clamp(source.r0, 1, 200, DEFAULTS.r0),
      amountFull: clamp(source.amountFull, 1, 100, DEFAULTS.amountFull),
      smooth: clamp(source.smooth, 2, 8, DEFAULTS.smooth),
      sunMode: source.sunMode === 'manual' ? 'manual' : 'real',
      lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
      lon: Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : null,
      tzMode: TZ_MODES.includes(source.tzMode) ? source.tzMode : DEFAULTS.tzMode,
      tzOffset: clamp(source.tzOffset, -12, 14, DEFAULTS.tzOffset),
      moon: source.moon !== false,
      // sky
      skyDist: clamp(source.skyDist, 0.6, 3, DEFAULTS.skyDist),
      domeAmount: clamp(source.domeAmount, 0, 1, DEFAULTS.domeAmount),
      skyTone: SKY_TONES.includes(source.skyTone) ? source.skyTone : DEFAULTS.skyTone,
      // stars: a letter from 1.5.22 becomes its percentage
      stars: clamp(dialFrom(source.stars, { off: 0, low: 60, mid: 100, high: 150 }), 0, 200, DEFAULTS.stars),
      starSize: clamp(source.starSize, 1, 14, DEFAULTS.starSize),
      starMin: clamp(source.starMin, 0.5, 4, DEFAULTS.starMin),
      starFalloff: clamp(source.starFalloff, 0.04, 0.5, DEFAULTS.starFalloff),
      starColor: clamp(source.starColor, 0, 2.2, DEFAULTS.starColor),
      starSpikes: clamp(source.starSpikes, 0, 6, DEFAULTS.starSpikes),
      starBase: clamp(source.starBase, 0, 2, DEFAULTS.starBase),
      starHalo: clamp(source.starHalo, 0, 2, DEFAULTS.starHalo),
      starCount: clamp(source.starCount, 0, 2, DEFAULTS.starCount),
      twinkleSpeed: clamp(source.twinkleSpeed, 0.1, 4, DEFAULTS.twinkleSpeed),
      twinkleAmp: clamp(source.twinkleAmp, 0, 0.9, DEFAULTS.twinkleAmp),
      milky: clamp(source.milky, 0, 2, DEFAULTS.milky),
      // constellations
      constellation: clamp(dialFrom(source.constellation, { off: 0, low: 50, mid: 100, high: 170 }), 0, 200, DEFAULTS.constellation),
      cross: clamp(dialFrom(source.cross, { off: 0, low: 55, mid: 100, high: 175 }), 0, 200, DEFAULTS.cross),
      lineWidth: clamp(source.lineWidth, 0.2, 4, DEFAULTS.lineWidth),
      lineFadeDeg: clamp(source.lineFadeDeg, 3, 45, DEFAULTS.lineFadeDeg),
      lineTwinkle: clamp(source.lineTwinkle, 0, 1.5, DEFAULTS.lineTwinkle),
      lineSpeed: clamp(source.lineSpeed, 0.1, 3, DEFAULTS.lineSpeed),
      starBias: clamp(source.starBias, -0.3, 0.3, DEFAULTS.starBias),
      starMode: STAR_MODES.includes(source.starMode) ? source.starMode : DEFAULTS.starMode,
      starCut: clamp(source.starCut, 1.5, 6, DEFAULTS.starCut),
      starsDaylight: source.starsDaylight === true,
      overflowGain: clamp(source.overflowGain, 0.5, 3, DEFAULTS.overflowGain),
      glassStyle: GLASS_STYLES.includes(source.glassStyle) ? source.glassStyle : DEFAULTS.glassStyle,
      // meteors
      meteor: source.meteor !== false,
      meteorRate: clamp(source.meteorRate, 0.1, 6, DEFAULTS.meteorRate),
      meteorBright: clamp(source.meteorBright, 0.2, 3, DEFAULTS.meteorBright),
      // clouds
      clouds: clamp(dialFrom(source.clouds, { off: 0, low: 35, mid: 55, high: 80 }), 0, 100, DEFAULTS.clouds),
      cloudSpeed: clamp(source.cloudSpeed, 0, 4, DEFAULTS.cloudSpeed),
      cloudOpacity: clamp(source.cloudOpacity, 0, 1.5, DEFAULTS.cloudOpacity),
      quality: QUALITY_LEVELS.includes(source.quality) ? source.quality : DEFAULTS.quality,
    fps: FPS_LEVELS.includes(Number(source.fps)) ? Number(source.fps) : DEFAULTS.fps,
      glow: clamp(source.glow, 0, 100, DEFAULTS.glow),
      frost: source.frost !== false,
    glassMode: source.glassMode === 'css' ? 'css' : 'render',
      glassRadius: clamp(
        source.glassRadius,
        0,
        24,
        Number.isFinite(LEGACY_GLASS_PX[source.glassLevel]) ? LEGACY_GLASS_PX[source.glassLevel] : DEFAULTS.glassRadius,
      ),
      colLeft: normalizeColumn(source.colLeft, DEFAULTS.colLeft),
      colRight: normalizeColumn(source.colRight, DEFAULTS.colRight),
      perf: source.perf === true,
      boats: source.boats !== false,
      boatSpread: clamp(source.boatSpread, 0.2, 3, DEFAULTS.boatSpread),
      boatPace: clamp(source.boatPace, 0.3, 2.5, DEFAULTS.boatPace),
      boatScale: clamp(source.boatScale, 1.4, 4.6, DEFAULTS.boatScale),
    };
  }

  // A level letter from the previous build, or a plain number.
  function dialFrom(value, table) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : NaN;
  }

  function selectCopy(locale) {
    const requested = locale || document.documentElement.lang || navigator.language || 'en';
    return requested.toLowerCase().startsWith('zh') ? COPY.zh : COPY.en;
  }

  // 1.5.33: the daylight slider is minutes after local midnight.
  function clockLabel(minutes) {
    const total = Math.max(0, Math.min(1439, Math.round(Number(minutes) || 0)));
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return hh + ':' + mm;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function alpha(value) {
    return Number(value.toFixed(2));
  }

  function blurCss(state) {
    if (!state.frost || state.glassMode !== 'css' || state.perf) return '';
    const column = (selector, key) => {
      const entry = state[key];
      // one radius for the frame, each column takes a share of it
      const px = entry.on ? Math.round(state.glassRadius * Math.pow(entry.strength / 100, 0.85)) : 0;
      if (!px) return '';
      return `${selector} { -webkit-backdrop-filter: blur(${px}px) saturate(125%); backdrop-filter: blur(${px}px) saturate(125%); }`;
    };
    return `
/* CSS fallback: the browser blurs what sits behind each column. Slower than
   the in-renderer pass, so it is opt-in from the settings panel. */
${column('body [data-slot="sidebar"], body .dshDesktopSidebarSurface', 'colLeft')}
${column('body [data-rightbar-col], body .dshDesktopDetailsSurface', 'colRight')}`;
  }

  function glassCss(glass, state) {
    const light = glass / 100;
    const dark = Math.max(0.40, light - 0.12);
    return `
/* Open Sea Skin: one translucent shell; nested fills must not compound.
   The tokens are scoped to #root rather than body on purpose. Hover cards,
   tooltips and dialogs are body-level portals: with the translucent tokens on
   body they inherited them and turned into glass you could read the page
   through (the "changed files" preview was the worst case). Outside #root they
   now keep whatever the theme itself paints, which is opaque in both modes. */
body {
  background: transparent !important;
}
body #root,
body:not(:has(#root)) {
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
body[data-ds-dark-theme] #root,
body[data-ds-dark-theme]:not(:has(#root)) {
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

  // The panel and its button are glass as well: give them the same radius the
  // columns use, so "blur 0" really means a crisp window everywhere.
  // The panel always keeps a working blur: it is the control surface, and a
  // 300px card of text over moving water is not readable without one. The
  // master switch and the radius still govern the columns and the shell.
  const PANEL_BLUR_FLOOR = 9;
  function paneBlur(state) {
    if (state.perf) return 0;
    const wanted = Math.max(0, Math.round(state.glassRadius * 0.85));
    return state.frost ? Math.max(PANEL_BLUR_FLOOR, wanted) : PANEL_BLUR_FLOOR;
  }

  function uiCss(state) {
    const panePx = paneBlur(state);
    // The app shell goes fully clear at 0, but the settings panel keeps a 18%
    // floor: it is the only surface that can put the value back.
    const paneAlpha = Math.max(0.18, Math.min(1, state.glass / 100)).toFixed(3);
    return `
#${IDS.button} {
  position: fixed; z-index: 6000; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.22);
  background: rgba(12,16,22,${paneAlpha}); backdrop-filter: blur(${panePx}px) saturate(130%);
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
  background:rgba(10,14,20,${paneAlpha}); backdrop-filter:blur(${panePx}px) saturate(140%);
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
#${IDS.panel} .oss-sec { margin-top:12px; padding-top:11px; border-top:1px solid rgba(255,255,255,.1); }
#${IDS.panel} .oss-sec:first-of-type { margin-top:10px; padding-top:0; border-top:0; }
#${IDS.panel} .oss-sec > .oss-caption {
  margin:0 0 8px; font-size:10px; letter-spacing:.16em; text-transform:uppercase;
  color:rgba(143,233,228,.85); font-weight:600; cursor:pointer; display:flex;
  align-items:center; gap:7px; list-style:none; user-select:none;
}
#${IDS.panel} .oss-sec > .oss-caption::-webkit-details-marker { display:none; }
#${IDS.panel} .oss-sec > .oss-caption::before {
  content:''; width:0; height:0; border-left:5px solid currentColor;
  border-top:4px solid transparent; border-bottom:4px solid transparent;
  transform:rotate(90deg); transition:transform .16s ease; opacity:.75;
}
#${IDS.panel} .oss-hint { margin:-1px 0 2px; font-size:11px; line-height:1.4; opacity:.55; }
  #${IDS.panel} .oss-hint:empty { display:none; }
  #${IDS.panel} .oss-sec:not([open]) > .oss-caption::before { transform:rotate(0deg); }
#${IDS.panel} .oss-sec:not([open]) > .oss-caption { margin-bottom:0; opacity:.72; }
#${IDS.panel} .oss-search { margin:12px 0 4px; }
#${IDS.panel} .oss-search input {
  width:100%; box-sizing:border-box; padding:6px 9px; font-size:11px;
  color:rgba(226,242,255,.9); background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.14); border-radius:7px; outline:none;
}
#${IDS.panel} .oss-search input:focus { border-color:rgba(143,233,228,.5); background:rgba(255,255,255,.08); }
#${IDS.panel} .oss-row[hidden] { display:none; }
#${IDS.panel} .oss-seg { display:flex; gap:4px; }
#${IDS.panel} .oss-seg button { flex:1; padding:5px 0; font-size:10.5px; border-radius:7px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05); color:rgba(255,255,255,.72); cursor:pointer; transition:color .15s ease, border-color .15s ease, background .15s ease; }
#${IDS.panel} .oss-seg button:hover { color:#dafdfb; border-color:rgba(143,233,228,.35); }
#${IDS.panel} .oss-seg button.on { border-color:rgba(143,233,228,.85); background:rgba(143,233,228,.3); color:#f2fffe; font-weight:600; box-shadow:inset 0 0 0 1px rgba(143,233,228,.35), 0 0 10px rgba(143,233,228,.22); }
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
/* Light shell: the panel above is written for the dark glass, so on a light
   theme it was white text on a pale card. Same layout, inverted inks. Every rule
   here comes after the dark ones on purpose — equal specificity, later wins. */
body:not([data-ds-dark-theme]) #${IDS.panel} {
  background:rgba(247,249,252,${paneAlpha});
  border-color:rgba(12,20,28,.12);
  box-shadow:0 18px 50px rgba(10,20,30,.16), inset 0 1px 0 rgba(255,255,255,.75);
  color:#0d1620;
}
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-title,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-head,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-switch label,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-col-head,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-inline > label { color:rgba(13,22,32,.70); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-note,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-sub { color:rgba(13,22,32,.60); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-sec > .oss-caption,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-mark,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-value { color:#0d7a76; }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-mini,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-seg button,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-reset {
  background:rgba(12,22,32,.05); border-color:rgba(12,22,32,.16); color:#0d1620;
}
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-seg button { color:rgba(13,22,32,.74); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-seg button:hover,
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-locate:hover { color:#0a4f4d; border-color:rgba(13,122,118,.35); background:rgba(13,122,118,.08); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-seg button.on {
  background:rgba(13,122,118,.26); border-color:rgba(13,122,118,.8); color:#063d3b; font-weight:600;
  box-shadow:inset 0 0 0 1px rgba(13,122,118,.3);
}
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-reset:hover { background:rgba(13,122,118,.12); border-color:rgba(13,122,118,.4); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-close { color:rgba(13,22,32,.55); }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-close:hover { color:#0d1620; background:rgba(12,22,32,.08); }
body:not([data-ds-dark-theme]) #${IDS.panel} input[type='range']::-webkit-slider-runnable-track { background:rgba(12,22,32,.22); }
body:not([data-ds-dark-theme]) #${IDS.panel} input[type='range']::-moz-range-track { background:rgba(12,22,32,.22); }
body:not([data-ds-dark-theme]) #${IDS.panel} input[type='range']::-webkit-slider-thumb { background:#0d7a76; box-shadow:0 0 10px rgba(13,122,118,.55); }
body:not([data-ds-dark-theme]) #${IDS.panel} input[type='range']::-moz-range-thumb { background:#0d7a76; }
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-switch input[type='checkbox'],
body:not([data-ds-dark-theme]) #${IDS.panel} .oss-col-head input[type='checkbox'] { accent-color:#0d7a76; }
body:not([data-ds-dark-theme]) #${IDS.panel}::-webkit-scrollbar-thumb { background:rgba(12,22,32,.20); }
body:not([data-ds-dark-theme]) #${IDS.button} {
  color:rgba(13,22,32,.82); border:1px solid rgba(12,22,32,.16); background:rgba(247,249,252,.92);
}
body:not([data-ds-dark-theme]) #${IDS.button}:hover { color:#0d7a76; border-color:rgba(13,122,118,.42); background:rgba(255,255,255,.97); }
body:not([data-ds-dark-theme]) #${IDS.button}.active { color:#0a4f4d; border-color:rgba(13,122,118,.55); background:rgba(230,246,244,.96); box-shadow:0 0 14px rgba(13,122,118,.20); }
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
      if (!target) return;
      target.addEventListener(event, listener, settings);
      surfaceCleanups.push(() => target.removeEventListener(event, listener, settings));
    };

    // A saved baseline: "make what I have now the defaults" without shipping a
    // release. Reset reads this first and only falls back to the built-in table.
    let baseline = null;
    const baselineStamp = () => {
      if (!baseline || !baseline.savedAt) return '';
      const at = new Date(baseline.savedAt);
      const pad = (n) => String(n).padStart(2, '0');
      return at.getFullYear() + '-' + pad(at.getMonth() + 1) + '-' + pad(at.getDate()) + ' ' + pad(at.getHours()) + ':' + pad(at.getMinutes());
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
      const chrome = document.getElementById(IDS.uiStyle);
      if (chrome) chrome.textContent = uiCss(state);
    };

    const post = (message) => {
      const frame = document.getElementById(IDS.frame);
      if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return;
      let targetOrigin = '*';
      try { targetOrigin = new URL(frame.src).origin; } catch { /* local test documents may have no absolute base URL */ }
      frame.contentWindow.postMessage(message, targetOrigin);
    };

    // how far past the wave ceiling the session is, 0..1; refreshed by the sea
    // tick and piggybacked on both messages so either one can carry it
    let overflowValue = 0;
    const seaOverflow = () => overflowValue;

    const postToOcean = (sea) => {
      // Daylight is always driven by `oss-sun` now; the legacy `auto` flag must
      // stay false or the iframe would resume its own 12-minute sine cycle.
      post({
        type: 'oss-set', sea: sea === undefined ? state.sea : sea, t: state.time, auto: false,
        overflow: seaOverflow(),
      });
    };

    const postSun = () => {
      post({
        type: 'oss-sun',
        mode: state.sunMode,
        t: state.time,
        lat: state.lat,
        lon: state.lon,
        tzMode: state.tzMode,
        tzOffset: state.tzOffset,
        moon: state.moon,
        stars: state.stars,
        constellation: state.constellation,
        cross: state.cross,
        meteor: state.meteor,
        meteorRate: state.meteorRate,
        meteorBright: state.meteorBright,
        clouds: state.clouds,
        cloudSpeed: state.cloudSpeed,
        cloudOpacity: state.cloudOpacity,
        skyDist: state.skyDist,
        domeAmount: state.domeAmount,
        skyTone: state.skyTone,
        starSize: state.starSize,
        starMin: state.starMin,
        starFalloff: state.starFalloff,
        starColor: state.starColor,
        starBias: state.starBias,
        starMode: STAR_MODES.indexOf(state.starMode),
        starCut: state.starCut,
        starsDaylight: state.starsDaylight,
        starSpikes: state.starSpikes,
        starBase: state.starBase,
        starHalo: state.starHalo,
        starCount: state.starCount,
        twinkleSpeed: state.twinkleSpeed,
        twinkleAmp: state.twinkleAmp,
        milky: state.milky,
        lineWidth: state.lineWidth,
        lineFadeDeg: state.lineFadeDeg,
        lineTwinkle: state.lineTwinkle,
        lineSpeed: state.lineSpeed,
        overflow: seaOverflow(),
        quality: state.quality,
    fps: state.fps,
        glow: state.glow,
      });
    };

    const COLUMN_SELECTORS = {
      colLeft: ['[data-slot="sidebar"]', '.dshDesktopSidebarSurface', '#root > div:first-child > :first-child'],
      colRight: ['[data-rightbar-col]', '.dshDesktopDetailsSurface'],
    };

    const measureColumns = () => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const pick = (key) => {
        const column = state[key];
        if (!column || !column.on) return null;
        const level = clamp(column.strength, 0, 100, 0) / 100;
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
      // only the two side rails are dressed; the conversation stays untouched
      return [pick('colLeft'), pick('colRight')].filter(Boolean);
    };

    // Same selectors as the renderer pass, but ignoring the on/strength gates:
    // the preview has to show a column even when it is currently switched off.
    const measureAllColumns = () => {
      const pick = (key) => {
        const element = COLUMN_SELECTORS[key]
          .map((selector) => document.querySelector(selector))
          .find((candidate) => {
            if (!(candidate instanceof HTMLElement)) return false;
            const rect = candidate.getBoundingClientRect();
            return rect.width > 8 && rect.height > 8;
          });
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        return { key, x0: rect.left, y0: rect.top, x1: rect.right, y1: rect.bottom };
      };
      return ['colLeft', 'colRight'].map(pick).filter(Boolean);
    };

    // One click to see which boxes the strength dials actually talk about.
    // What the renderer is actually running at (the dial only asks): the panel
    // should answer "is the cheap tier in effect?" without opening devtools.
    let fpsFrames = 0;
    let fpsSince = 0;
    let fpsSeen = 0;
    const meterFps = (now) => {
      if (!fpsSince) { fpsSince = now; fpsFrames = 0; return; }
      fpsFrames += 1;
      const span = now - fpsSince;
      if (span >= 1000) {
        fpsSeen = Math.round((fpsFrames * 1000) / span);
        fpsSince = now;
        fpsFrames = 0;
      }
    };

    const perfText = () => {
      const ocean = readOceanState();
      const scale = ocean && Number.isFinite(ocean.renderScale) ? ocean.renderScale : null;
      const ratio = window.devicePixelRatio || 1;
      const parts = [];
      parts.push(copy.perfTier.replace('{tier}', (copy.quality && copy.quality[state.quality]) || state.quality));
      parts.push(copy.perfCap.replace('{fps}', String(state.fps)));
      if (scale !== null) parts.push(copy.perfScale.replace('{scale}', scale.toFixed(2)).replace('{dpr}', ratio.toFixed(1)));
      if (fpsSeen) parts.push(copy.perfFps.replace('{fps}', String(fpsSeen)));
      return parts.join(' · ');
    };

    const previewColumns = () => {
      for (const node of document.querySelectorAll('.oss-colmap')) node.remove();
      const labels = { colLeft: copy.cols.left, colRight: copy.cols.right };
      for (const rect of measureAllColumns()) {
        if (!rect) continue;
        const box = document.createElement('div');
        box.className = 'oss-colmap';
        box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483000;border:2px dashed rgba(143,233,228,.85);border-radius:10px;box-shadow:inset 0 0 0 9999px rgba(143,233,228,.06);'
          + 'left:' + rect.x0 + 'px;top:' + rect.y0 + 'px;width:' + (rect.x1 - rect.x0) + 'px;height:' + (rect.y1 - rect.y0) + 'px;';
        const chip = document.createElement('span');
        chip.textContent = (labels[rect.key] || rect.key) + (rect.guess ? ' ≈' : '');
        if (rect.guess) box.style.borderColor = 'rgba(255,206,120,.85)';
        chip.style.cssText = 'position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:6px;background:rgba(10,20,26,.82);color:#c9fffb;font-size:11px;line-height:1.6;';
        if (rect.guess) chip.style.color = '#ffd9a0';
        box.append(chip);
        document.body.append(box);
      }
      window.setTimeout(() => {
        for (const node of document.querySelectorAll('.oss-colmap')) node.remove();
      }, 2600);
    };

    const postGlass = () => {
      // The in-renderer pass only runs in `render` mode; CSS mode blurs itself
      // and must leave the water sharp so the two do not fight.
      const active = state.enabled && state.frost && !state.perf && state.glassMode === 'render';
      post({
        type: 'oss-glass',
        active,
        mode: state.glassMode,
        perf: state.perf,
        radius: state.glassRadius,
        style: state.glassStyle,
        rects: active ? measureColumns() : [],
      });
    };

    // ---- fleet: one boat per subagent in the open conversation --------------
    // A switch is only committed after the user rests on a session for this long;
    // flipping through the sidebar must not reshape the fleet at every stop.
    const FLEET_SETTLE_MS = 600;
    let fleetInFlight = false;
    let fleetSince = 0;
    let fleetAt = 0;
    let fleetSettleAt = 0;

    const boatOutEl = () => document.getElementById(`${IDS.panel}-${'boat-out'}`);

    const postFleet = (count) => {
      // One hull stays out even when the session has no subagents (the copy says
      // so), so "off" must mean the switch alone — otherwise 0 would be posted as
      // "boats off" and the base boat would vanish with the note still promising it.
      const enabled = !!(state.boats && state.enabled);
      const shown = enabled ? Math.max(1, count) : 0;
      // Posted on every poll, not only on change: the ocean frame starts at one
      // boat and can be reloaded under us, so an unchanged number still has to
      // reach it or the surface keeps the count it was born with.
      post({ type: 'oss-fleet', count: shown, off: !enabled });
    };

    // Hull shape: the panel owns these numbers, the surface just applies them.
    const postBoats = () => {
      post({
        type: 'oss-boats',
        spread: state.boatSpread,
        pace: state.boatPace,
        scale: state.boatScale,
      });
    };

    // The panel and the surface are two documents, and the surface is served from
    // its own origin, so its window cannot be read from here. It posts back the
    // state it ended up with; keep the latest one and prefer it when the direct
    // read is unavailable.
    let lastOceanState = null;
    const readOceanState = () => {
      try {
        const el = document.getElementById(IDS.frame);
        const win = el instanceof HTMLIFrameElement ? el.contentWindow : null;
        if (win && typeof win.__ossState === 'function') return win.__ossState();
      } catch {
        // cross-origin: the posted copy is the only way in
      }
      return lastOceanState;
    };

    on(window, 'message', (event) => {
      const data = event && event.data;
      if (!data || data.type !== 'oss-state' || !data.state || typeof data.state !== 'object') return;
      const el = document.getElementById(IDS.frame);
      if (el instanceof HTMLIFrameElement && event.source && event.source !== el.contentWindow) return;
      lastOceanState = data.state;
    });

    // What the ocean frame says it ended up with. Read back rather than assumed:
    // "the note says three, the sea shows one" is a message-path question, and
    // this is the only way to tell the two sides apart from the panel.
    const readOceanFleet = () => {
      const state = readOceanState();
      if (!state) return null;
      return {
        target: state.boatTarget,
        drawn: state.boats,
        spots: Array.isArray(state.boatSpots) ? state.boatSpots : [],
        error: typeof state.boatError === 'string' ? state.boatError : '',
      };
    };

    const phaseName = (phase01) => {
      const names = copy.moonNames;
      if (!names || !names.length) return '';
      const t = ((Number(phase01) || 0) % 1 + 1) % 1;
      if (t < 0.03 || t > 0.97) return names[0];
      if (t < 0.22) return names[1];
      if (t < 0.28) return names[2];
      if (t < 0.47) return names[3];
      if (t < 0.53) return names[4];
      if (t < 0.72) return names[5];
      if (t < 0.78) return names[6];
      return names[7];
    };

    // The moon line is read straight off the frame, so it reports what the sky
    // really shows instead of what the settings say it should.
    const refreshMoonReadout = () => {
      const el = document.getElementById(pid('moon-out'));
      if (!el) return;
      const ocean = readOceanState();
      if (!ocean || typeof ocean.moonIllum !== 'number') return;
      if (!state.moon) {
        el.textContent = copy.moonOff;
        return;
      }
      const lit = Math.round(Math.max(0, Math.min(1, ocean.moonIllum)) * 100);
      const height = Math.round(Number(ocean.moonElevationDeg) || 0);
      const name = phaseName(ocean.moonPhase01);
      if (height <= 0) el.textContent = copy.moonBelow.replace('{name}', name).replace('{p}', String(lit));
      else el.textContent = copy.moonInfo.replace('{name}', name).replace('{p}', String(lit)).replace('{h}', String(height));
    };

    // Same idea for the sun: the panel prints the real altitude plus where that
    // altitude lands in the frame, so "it does not match the clock" becomes a
    // number to check instead of a guess.
    // Sunrise and sunset come from the frame, which already owns the ephemeris,
    // so the panel cannot disagree with the sky it is describing.
    // The sky is drawn in real time, so the panel has to say which clock it is
    // drawn against: the machine's, the coordinate's, or a hand-set offset.
    const deviceOffset = () => -new Date().getTimezoneOffset() / 60;
    const placeOffset = () => {
      if (state.tzMode === 'manual') return state.tzOffset;
      if (state.tzMode === 'longitude' && typeof state.lon === 'number') return Math.round(state.lon / 15);
      return deviceOffset();
    };
    // Sun times are minutes of the machine's day; the panel prints the place's.
    const placeShiftMinutes = () => (placeOffset() - deviceOffset()) * 60;
    const clockOf = (minutes, shift = 0) => {
      if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return null;
      const total = ((Math.round(minutes) + shift) % 1440 + 1440) % 1440;
      const h = Math.floor(total / 60);
      const m = total % 60;
      return String(h).padStart(2, '0') + ':' + (m < 10 ? '0' + m : String(m));
    };
    const clockNow = (offset) => new Date(Date.now() + offset * 3600000).toISOString().slice(11, 16);
    const sunTimesText = (ocean) => {
      const shift = placeShiftMinutes();
      const rise = ocean ? clockOf(ocean.sunriseMinutes, shift) : null;
      const set = ocean ? clockOf(ocean.sunsetMinutes, shift) : null;
      if (!rise || !set) return copy.sunTimesNone;
      return copy.sunTimes.replace('{rise}', rise).replace('{set}', set);
    };
    const twilightText = (ocean) => {
      const table = ocean && ocean.twilightMinutes;
      if (!table) return copy.twilightNone;
      const shift = placeShiftMinutes();
      const pair = (name) => {
        const slot = table[name] || {};
        const dawn = clockOf(slot.dawnMinutes, shift);
        const dusk = clockOf(slot.duskMinutes, shift);
        return dawn && dusk ? `${dawn} / ${dusk}` : copy.twilightNone;
      };
      return copy.twilightOut
        .replace('{civil}', pair('civil'))
        .replace('{nautical}', pair('nautical'))
        .replace('{astro}', pair('astronomical'));
    };
    // The band is either the bright core, the faint outer arm, or gone — and the
    // panel says which, because "no Milky Way tonight" without a reason reads as a
    // bug. Numbers come from the ocean frame (galactic centre altitude, opacity).
    const milkyText = () => {
      const ocean = readOceanState();
      if (!ocean) return copy.milkyPending;
      if (state.stars <= 0) return copy.milkyStarsOff;
      const alt = Number(ocean.galacticCentreAlt);
      const visible = Number(ocean.milkyVisible) || 0;
      if (visible < 0.02) return copy.milkyHidden;
      if (!Number.isFinite(alt)) return copy.milkyPending;
      if (alt >= 10) return copy.milkyStrong.replace('{alt}', alt.toFixed(0));
      if (alt >= -8) return copy.milkyWeak.replace('{alt}', alt.toFixed(0));
      return copy.milkyOuter.replace('{alt}', alt.toFixed(0));
    };

    const refreshSunReadout = () => {
      const clockEl = document.getElementById(pid('clock-out'));
      if (clockEl) {
        // In manual mode the sky is solved for a chosen instant, so say which one
        // instead of printing a clock the picture no longer follows.
        if (state.sunMode === 'manual') {
          clockEl.textContent = copy.clockManual.replace('{at}', clockLabel(state.time));
        } else {
          const place = clockNow(placeOffset());
          const local = clockNow(deviceOffset());
          const zone = `UTC${placeOffset() >= 0 ? '+' : '−'}${Math.abs(placeOffset())}`;
          clockEl.textContent = copy.clockOut
            .replace('{local}', local)
            .replace('{place}', `${place} ${zone}`);
        }
      }
      const twilightEl = document.getElementById(pid('twilight-out'));
      const el = document.getElementById(pid('sun-out'));
      if (!el) return;
      const ocean = readOceanState();
      if (twilightEl) twilightEl.textContent = twilightText(ocean);
      if (!ocean || typeof ocean.sunElevationDeg !== 'number') return;
      const times = sunTimesText(ocean);
      if (state.sunMode !== 'real') {
        el.textContent = copy.sunReadoutManual + ' · ' + times;
        return;
      }
      const real = Math.round(ocean.sunElevationDeg);
      const view = Math.round(Number(ocean.sunViewElevationDeg) || 0);
      const az = Math.round(Number(ocean.sunAzimuthDeg) || 0);
      const body = real <= -1
        ? copy.sunReadoutNight.replace('{az}', String(az))
        : copy.sunReadout
          .replace('{el}', String(real))
          .replace('{az}', String(az))
          .replace('{view}', String(view));
      el.textContent = body + ' · ' + times;
    };

    const setBoatNote = (text) => {
      const el = boatOutEl();
      if (el) el.textContent = text;
    };

    // The wave has two inputs (spend and token rate) and three sources; when the
    // sea looks flat there is no way to tell which one is missing. Print the
    // numbers the engine actually used, right under the sliders.
    const refreshWaveReadout = () => {
      const el = document.getElementById(pid('wave-out'));
      if (!el) return;
      const store = globalThis.__openSeaSkinMetrics;
      const seen = store && typeof store.count === 'number' ? store.count : 0;
      const age = store && store.at ? Math.max(0, Math.round((performance.now() - store.at) / 1000)) : -1;
      const bridgeState = globalThis.__openSeaSkinBridgeState;
      const why = seen === 0 && bridgeState && bridgeState !== 'mounted'
        ? '（' + ((copy.bridgeWhy && copy.bridgeWhy[bridgeState]) || bridgeState) + '）'
        : '';
      const tag = seen === 0
        ? copy.waveBridgeNone + why
        : copy.waveBridge.replace('{n}', String(seen)).replace('{s}', String(age));
      const snapshot = readMetrics();
      if (!snapshot) {
        el.textContent = copy.waveOutNone + ' · ' + tag;
        return;
      }
      const src = state.waveMode === 'manual'
        ? copy.waveSrcManual
        : state.waveMode === 'amount' ? copy.waveSrcAmount : copy.waveSrcThroughput;
      const cost = Math.round(Math.max(0, snapshot.costYuan || 0) * 100) / 100;
      el.textContent = copy.waveOut
        .replace('{src}', src)
        .replace('{cost}', cost.toFixed(2))
        .replace('{full}', String(state.amountFull))
        .replace('{rate}', String(Math.round(rate)))
        .replace('{sea}', String(Math.round(seaValue))) + ' · ' + tag;
    };

    const pollFleet = async () => {
      if (!state.boats) return;
      // Released rather than trusted: a request that never settles would
      // otherwise leave the flag set and freeze the roster.
      if (fleetInFlight && performance.now() - fleetSince < 9000) return;
      const snapshot = readMetrics();
      const sessionId = snapshot && snapshot.sessionId;
      if (!sessionId) {
        setBoatNote(copy.boatLoading);
        return;
      }
      fleetInFlight = true;
      fleetSince = performance.now();
      try {
        // A stalled request must not wedge the poll: the flag would stay set and
        // the fleet would sit at whatever count it last heard, forever.
        const response = await fetch(`${FLEET_PATH}?session=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });
        const data = await response.json();
        // Boats picture the conversation you are looking at, so the number is the
        // subagents this session has; `running` is the live subset the note reports.
        // That is also what makes switching sessions reshape the fleet.
        const children = data && Array.isArray(data.children) ? data.children.length : 0;
        const running = Math.max(0, Math.min(12, Number(data && data.running) || 0));
        const count = Math.max(0, Math.min(12, children));
        postFleet(count);
        // A host build from before the per-child observation answers without
        // sessionQuery, and its `running` counts the parent agent, so the fleet
        // would silently sit at one boat forever. Say it instead of guessing.
        const hostFresh = !!(data && data.services && data.services.sessionQuery === true);
        const ocean = readOceanFleet();
        const sessionTag = sessionId ? `会话 ${String(sessionId).slice(-6)} · ` : '';
        const spotText = ocean && ocean.spots.length
          ? ocean.spots.map((spot) => `${spot[0]},${spot[1]}`).join(' ')
          : '';
        const suffix = ocean
          ? `（${sessionTag}海面 ${ocean.drawn}/${ocean.target}${ocean.error ? ' · 船层报错 ' + ocean.error : ''}${spotText ? ' · ' + spotText : ''}）`
          : '';
        if (data && data.ok === true) {
          if (!hostFresh) setBoatNote(copy.boatStale);
          else if (count > 0) setBoatNote(copy.boatCount.replace('{n}', String(count)).replace('{m}', String(running)) + suffix);
          else setBoatNote(copy.boatIdle);
        }
        else setBoatNote(`${copy.boatOffline} ${data && data.error ? `(${data.error})` : ''}`.trim());
      } catch {
        setBoatNote(copy.boatOffline);
      } finally {
        fleetInFlight = false;
      }
    };

    const startFleetEngine = () => {
      stopFleetEngine();
      fleetAt = 0;
      fleetSettleAt = performance.now() + FLEET_SETTLE_MS;
    };

    // The poll itself is driven from the wave tick (see stepWave): one loop owns
    // the page, so a session switch cannot leave a second timer orphaned.
    const stopFleetEngine = () => {
      fleetInFlight = false;
      fleetAt = 0;
    };

    let waveTimer = 0;
    let glassTimer = 0;
    let seaValue = state.sea;
    let rate = 0;
    let lastTotal = null;
    let lastAt = 0;
    let lastActiveAt = 0;
    let lastSession = null;
    let lastStepAt = 0;

    const readMetrics = () => {
      const store = globalThis.__openSeaSkinMetrics;
      return store && typeof store.read === 'function' ? store.read() : null;
    };

    const stepWave = () => {
      const now = performance.now();
      const floor = state.floor;
      const span = Math.max(0, 100 - floor);
      let target = state.sea;

      const snapshot = readMetrics();
      const sessionId = snapshot ? snapshot.sessionId : null;
      // The open conversation decides the fleet, but only once the user has come
      // to rest on one: rapid switching would otherwise post every intermediate
      // roster, and boats still sailing out get yanked back or dropped mid-stride.
      if (sessionId && sessionId !== lastSession) {
        lastSession = sessionId;
        lastTotal = snapshot
          ? (snapshot.cachedTokens || 0) + (snapshot.uncachedTokens || 0) + (snapshot.outputTokens || 0)
          : null;
        lastAt = now;
        rate = 0;
        fleetAt = 0;
        fleetSettleAt = now + FLEET_SETTLE_MS;
      }
      if (sessionId && now >= fleetSettleAt && now - fleetAt > 4000) {
        fleetAt = now;
        void pollFleet();
      }
      // The readouts and the wave/bridge lines live in the panel's scope. With the
      // panel closed they are not defined at all, so touching them would throw on
      // every tick and the surface would never follow the session. The engine runs
      // whether or not a panel is mounted, so the panel bits are optional.
      try {
        refreshSunReadout();
        refreshMoonReadout();
        if (milkyOut) milkyOut.textContent = milkyText();
      } catch { /* no panel mounted */ }

      if (state.waveMode === 'manual') {
        rate = 0;
        target = state.sea;
      } else {
        if (!snapshot) {
          target = floor;
        } else {
          const total = (snapshot.cachedTokens || 0) + (snapshot.uncachedTokens || 0) + (snapshot.outputTokens || 0);
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

      // 1.5.35: Over budget is a fact about the session, not about whether it is
      // currently producing tokens. In 吞吐 mode an idle session used to report
      // overflow 0 while the cost had long passed the ceiling, so the caps only
      // appeared mid-answer and vanished the moment the model stopped.
      const budgetCeiling = Math.max(1, state.amountFull);
      const spent = Math.max(0, (snapshot && snapshot.costYuan) || 0);
      const rateCeiling = Math.max(1, state.r0);
      const curve = (value, ceiling) => Math.max(0, (value / ceiling - 0.6) / 1.6);
      // the spend curve always applies; the throughput curve adds to it while busy
      const byBudget = curve(spent, budgetCeiling);
      const byRate = state.waveMode === 'manual' ? 0 : curve(Math.max(0, rate), rateCeiling);
      overflowValue = Math.min(1, Math.max(byBudget, byRate) * state.overflowGain);

      // The cost curve is `log1p(yuan)/log1p(amountFull)`, which goes past 1 as soon
      // as the session spends more than the threshold. Sent unclamped, the ocean
      // frame's `sea <= 100` guard rejected the whole message and the surface sat
      // at whatever it was born with — a ¥12 session looked dead calm.
      target = Math.max(0, Math.min(100, target));
      // Ease with the real elapsed time, not a fixed 0.25 s: a late tick (busy
      // frame, throttled timer) would otherwise let the surface catch up in one
      // visible jump instead of a steady slide.
      const elapsed = lastStepAt ? Math.max(0.001, (now - lastStepAt) / 1000) : 0.25;
      lastStepAt = now;
      const alphaSea = 1 - Math.exp(-elapsed / Math.max(0.4, state.smooth / 2));
      seaValue += (target - seaValue) * alphaSea;
      postToOcean(seaValue);
      try {
        refreshWaveReadout();
      } catch { /* no panel mounted */ }
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
        // Fold everything on every open: the panel element survives being closed,
        // so a group left expanded last time used to still be expanded now.
        panel.querySelectorAll('.oss-sec').forEach((section) => {
          section.open = false;
          section.hidden = false;
        });
        panel.querySelectorAll('.oss-row, .oss-inline, .oss-col').forEach((item) => { item.hidden = false; });
        const filter = panel.querySelector('.oss-search input');
        if (filter instanceof HTMLInputElement) filter.value = '';
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
        postBoats();
          postToOcean(state.waveMode === 'manual' ? state.sea : seaValue);
        // The frame boots with one boat on the water; the poll below reposts the
        // real count on the first tick after load.
        // started here as well: with the panel closed the surface used to freeze
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
      style.textContent = uiCss(state);
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

      // Every control explains itself in one line underneath: "falloff" or "dome
      // share" is not something a user should have to reverse-engineer.
      const hint = (key) => `<p class="oss-hint" data-copy="hints.${key}"></p>`;
      const rangeRow = (id, key, min, max, step) => `<div class="oss-row"><div class="oss-head"><label for="${id}" data-copy="${key}"></label><output class="oss-value" id="${id}-out"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" />${hint(key)}</div>`;
      const segRow = (id, key, options) => `<div class="oss-row"><div class="oss-head"><span data-copy="${key}"></span></div><div class="oss-seg" id="${id}">${options.map(([value, copyKey]) => `<button type="button" data-value="${value}" data-copy="${copyKey}"></button>`).join('')}</div>${hint(key)}</div>`;
      const switchRow = (id, key) => `<div class="oss-row oss-switch"><label for="${id}" data-copy="${key}"></label><input type="checkbox" id="${id}" />${hint(key)}</div>`;
      // One slider per column: the shared radius times this column's share.
      const colRow = (id, key) => `<div class="oss-col" id="${id}"><div class="oss-col-head"><label for="${id}-on" data-copy="${key}"></label><input type="checkbox" id="${id}-on" /></div><div class="oss-head"><span data-copy="colStrength"></span><output class="oss-value" id="${id}-out"></output></div><input type="range" id="${id}-strength" min="0" max="100" step="1" /></div>`;
      // Collapsible group: eleven of them do not fit on one screen unfolded.
      const group = (key, rows, open) => `<details class="oss-sec"${open ? ' open' : ''} data-open0="${open ? '1' : '0'}"><summary class="oss-caption" data-copy="${key}"></summary>${rows}</details>`;

      panel.innerHTML = `
        <div class="oss-title"><span>OPEN SEA <span class="oss-mark">·</span> SKIN</span><button class="oss-close" type="button" aria-label="${copy.close}">×</button></div>
        <div class="oss-search"><input type="search" id="${pid('search')}" placeholder="${copy.search}" aria-label="${copy.search}" /></div>
        ${group('secSkin', `${switchRow(pid('enabled'), 'enable')}`)}
        ${group('secWave', `
          ${segRow(pid('wave-mode'), 'waveSource', [['manual', 'modes.manual'], ['throughput', 'modes.throughput'], ['amount', 'modes.amount']])}
          ${rangeRow(pid('sea-range'), 'manualSea', 0, 100, 1)}
          ${rangeRow(pid('floor'), 'floor', 0, 60, 1)}
          ${rangeRow(pid('r0'), 'r0', 1, 200, 1)}
          ${rangeRow(pid('amount-full'), 'amountFull', 1, 100, 1)}
          ${rangeRow(pid('smooth'), 'smooth', 2, 8, 0.5)}
          ${rangeRow(pid('overflow-gain'), 'overflowGain', 0.5, 3, 0.1)}
          <p class="oss-sub" id="${pid('wave-out')}"></p>
          <p class="oss-sub" data-copy="waveNote"></p>`)}
        ${group('secSky', `
          ${segRow(pid('sun-mode'), 'sunSource', [['real', 'sunModes.real'], ['manual', 'sunModes.manual']])}
          <p class="oss-sub" id="${pid('clock-out')}"></p>
          <div class="oss-row"><div class="oss-head"><label for="${pid('time-range')}" data-copy="manualTime"></label><output class="oss-value" id="${pid('time-range-out')}"></output></div><input type="range" id="${pid('time-range')}" min="0" max="1439" step="1" /><button type="button" class="oss-mini oss-now" id="${pid('time-now')}" data-copy="timeNow"></button></div>
          <div class="oss-inline"><label for="${pid('lat')}" data-copy="lat"></label><input class="oss-mini" id="${pid('lat')}" type="number" step="0.01" min="-90" max="90" /></div>
          <div class="oss-inline"><label for="${pid('lon')}" data-copy="lon"></label><input class="oss-mini" id="${pid('lon')}" type="number" step="0.01" min="-180" max="180" /></div>
          <div class="oss-row"><button type="button" class="oss-mini oss-locate" id="${pid('locate')}" data-copy="locate"></button><span class="oss-sub oss-locate-out" id="${pid('locate-out')}"></span></div>
          ${segRow(pid('tz-mode'), 'tzMode', [['system', 'tzModes.system'], ['longitude', 'tzModes.longitude'], ['manual', 'tzModes.manual']])}
          ${rangeRow(pid('tz-offset'), 'tzOffset', -12, 14, 0.5)}
          ${switchRow(pid('moon'), 'moon')}
          <p class="oss-sub" id="${pid('sun-out')}" data-copy="sunOut"></p>
          <p class="oss-sub" id="${pid('moon-out')}" data-copy="moonOut"></p>
          <p class="oss-sub" id="${pid('twilight-out')}"></p>
          <p class="oss-sub" data-copy="sunNote"></p>`)}
        ${group('secStars', `
          ${rangeRow(pid('sky-dist'), 'skyDist', 0.6, 3, 0.05)}
          ${rangeRow(pid('stars'), 'stars', 0, 200, 1)}
          ${rangeRow(pid('star-size'), 'starSize', 1, 14, 0.1)}
          ${rangeRow(pid('star-falloff'), 'starFalloff', 0.04, 0.5, 0.01)}
          ${rangeRow(pid('star-color'), 'starColor', 0, 2.2, 0.05)}
          ${rangeRow(pid('star-bias'), 'starBias', -0.3, 0.3, 0.01)}
          ${segRow(pid('star-mode'), 'starMode', [['real', 'starModes.real'], ['mono', 'starModes.mono'], ['vivid', 'starModes.vivid']])}
          ${rangeRow(pid('star-base'), 'starBase', 0, 2, 0.01)}
          ${rangeRow(pid('star-halo'), 'starHalo', 0, 2, 0.01)}
          ${rangeRow(pid('star-count'), 'starCount', 0, 2, 0.01)}
          ${rangeRow(pid('star-cut'), 'starCut', 1.5, 6, 0.1)}
          ${rangeRow(pid('twinkle-speed'), 'twinkleSpeed', 0.1, 4, 0.05)}
          ${rangeRow(pid('twinkle-amp'), 'twinkleAmp', 0, 0.9, 0.01)}
          ${rangeRow(pid('milky'), 'milky', 0, 3, 0.01)}
          <p class="oss-sub" id="${pid('milky-out')}"></p>
          ${switchRow(pid('stars-daylight'), 'starsDaylight')}
          ${segRow(pid('sky-tone'), 'skyTone', [['real', 'skyTones.real'], ['blue', 'skyTones.blue'], ['warm', 'skyTones.warm']])}`)}
        ${group('secConst', `
          ${rangeRow(pid('constellation'), 'constellation', 0, 200, 1)}
          ${rangeRow(pid('cross'), 'crossStars', 0, 200, 1)}
          ${rangeRow(pid('star-spikes'), 'starSpikes', 0, 6, 0.1)}
          ${rangeRow(pid('line-width'), 'lineWidth', 0.2, 4, 0.05)}
          ${rangeRow(pid('line-fade'), 'lineFadeDeg', 3, 45, 0.5)}
          ${rangeRow(pid('line-twinkle'), 'lineTwinkle', 0, 1.5, 0.01)}
          ${rangeRow(pid('line-speed'), 'lineSpeed', 0.1, 3, 0.05)}`)}
        ${group('secMeteor', `
          ${switchRow(pid('meteor'), 'meteor')}
          ${rangeRow(pid('meteor-rate'), 'meteorRate', 0.1, 6, 0.1)}
          ${rangeRow(pid('meteor-bright'), 'meteorBright', 0.2, 3, 0.05)}`)}
        ${group('secClouds', `
          ${rangeRow(pid('clouds'), 'clouds', 0, 100, 1)}
          ${rangeRow(pid('cloud-speed'), 'cloudSpeed', 0, 4, 0.05)}
          ${rangeRow(pid('cloud-opacity'), 'cloudOpacity', 0, 1.5, 0.01)}`)}
        ${group('secBoat', `
          ${switchRow(pid('boats'), 'boats')}
          ${rangeRow(pid('boat-spread'), 'boatSpread', 0.2, 3, 0.1)}
          ${rangeRow(pid('boat-pace'), 'boatPace', 0.3, 2.5, 0.1)}
          ${rangeRow(pid('boat-scale'), 'boatScale', 1.4, 4.6, 0.1)}
          <p class="oss-sub" id="${pid('boat-out')}"></p>
          <p class="oss-sub" data-copy="boatNote"></p>`)}
        ${group('secGlass', `
          ${switchRow(pid('frost'), 'frost')}
          ${segRow(pid('glass-mode'), 'glassMode', [['render', 'glassModes.render'], ['css', 'glassModes.css']])}
          ${segRow(pid('glass-style'), 'glassStyle', [['gaussian', 'glassStyles.gaussian'], ['box', 'glassStyles.box'], ['double', 'glassStyles.double'], ['radial', 'glassStyles.radial'], ['frost', 'glassStyles.frost'], ['tile', 'glassStyles.tile']])}
          ${rangeRow(pid('glass-range'), 'glass', 0, 100, 1)}
          ${rangeRow(pid('glass-radius'), 'glassRadius', 0, 24, 0.5)}
                    ${colRow(pid('col-left'), 'cols.left')}
                    ${colRow(pid('col-right'), 'cols.right')}
          <div class="oss-row"><button type="button" class="oss-reset" id="${pid('cols-preview')}" data-copy="previewCols"></button></div>
<p class="oss-sub" data-copy="colsNote"></p>
${switchRow(pid('perf'), 'perf')}
          <p class="oss-sub" data-copy="glassNote"></p>`)}
        ${group('secAdvanced', `
          <p class="oss-sub" data-copy="perfGroup"></p>
          ${segRow(pid('quality'), 'qualityMode', [['high', 'quality.high'], ['balanced', 'quality.balanced'], ['low', 'quality.low']])}
          ${rangeRow(pid('glow'), 'glow', 0, 100, 1)}
        ${segRow(pid('fps'), 'fpsMode', [['24', 'fps.24'], ['30', 'fps.30'], ['45', 'fps.45'], ['60', 'fps.60']])}
<p class="oss-sub" id="${pid('perf-out')}"></p>
          <div class="oss-row"><button type="button" class="oss-reset" id="${pid('make-default')}" data-copy="makeDefault"></button></div>
          <p class="oss-sub" id="${pid('default-out')}"></p>
          <div class="oss-row"><button type="button" class="oss-reset" id="${pid('reset')}" data-copy="reset"></button></div>
          <p class="oss-sub" data-copy="resetNote"></p>`)}
        <p class="oss-note" data-copy="note"></p>`;

      const host = document.body || document.documentElement;
      host.append(button, panel);

      const el = (suffix) => panel.querySelector(`#${pid(suffix)}`);
      const out = (suffix) => panel.querySelector(`#${pid(suffix)}-out`);
      const enabledBox = el('enabled');
      const moonBox = el('moon');
      const perfBox = el('perf');
      const frostBox = el('frost');
      const milkyOut = el('milky-out');
      const boatsBox = el('boats');
      const meteorBox = el('meteor');
      const daylightBox = el('stars-daylight');
      const latInput = el('lat');
      const lonInput = el('lon');
      const resetBtn = panel.querySelector('#' + pid('reset'));
      const searchBox = el('search');

      // runtime readout: created once per mount, not on a button press
      const perfOut = el('perf-out');
      const refreshPerfOut = () => {
        if (perfOut) perfOut.textContent = perfText();
      };
      refreshPerfOut();
      const perfTimer = window.setInterval(refreshPerfOut, 1500);
      surfaceCleanups.push(() => window.clearInterval(perfTimer));
      const perfTick = (now) => {
        meterFps(now);
        window.requestAnimationFrame(perfTick);
      };
      window.requestAnimationFrame(perfTick);

      const segWave = el('wave-mode');
      const segSun = el('sun-mode');
      const segTz = el('tz-mode');
      const segTone = el('sky-tone');
      const segGlassMode = el('glass-mode');
      const columns = {
        colLeft: { root: el('col-left'), on: el('col-left-on'), range: el('col-left-strength'), out: out('col-left') },
        colRight: { root: el('col-right'), on: el('col-right-on'), range: el('col-right-strength'), out: out('col-right') },
      };

      const setSeg = (group, value) => {
        if (!(group instanceof HTMLElement)) return;
        for (const option of group.querySelectorAll('button')) {
          option.classList.toggle('on', option.dataset.value === value);
          option.setAttribute('aria-pressed', String(option.dataset.value === value));
        }
      };

      const setRowVisible = (control, visible) => {
        const row = control && control.closest('.oss-row');
        if (row instanceof HTMLElement) row.style.display = visible ? '' : 'none';
      };

      // Every slider on the panel, in one table: syncUi and the input listener
      // both walk it, so a new dial is one line instead of five.
      const RANGE_ROWS = [
        ['sea-range', 'sea', 0, 'waves'],
        ['floor', 'floor', 0, 'int'],
        ['r0', 'r0', 0, 'tps'],
        ['amount-full', 'amountFull', 0, 'yuan'],
        ['smooth', 'smooth', 1, 'sec'],
        ['overflow-gain', 'overflowGain', 1, 'mul'],
        ['time-range', 'time', 0, 'clock'],
        ['tz-offset', 'tzOffset', 1, 'tz'],
        ['sky-dist', 'skyDist', 2, 'x'],
        ['stars', 'stars', 0, 'pct'],
        ['star-size', 'starSize', 1, 'px'],
  ['star-falloff', 'starFalloff', 2, 'f2'],
  ['star-color', 'starColor', 2, 'f2'],
  ['star-spikes', 'starSpikes', 1, 'f2'],
        ['star-base', 'starBase', 2, 'f2'],
        ['star-halo', 'starHalo', 2, 'f2'],
        ['star-bias', 'starBias', 2, 'offset'],
        ['star-cut', 'starCut', 1, 'mag'],
        ['star-count', 'starCount', 2, 'f2'],
        ['twinkle-speed', 'twinkleSpeed', 2, 'f2'],
        ['twinkle-amp', 'twinkleAmp', 2, 'f2'],
        ['milky', 'milky', 2, 'f2'],
        ['constellation', 'constellation', 0, 'pct'],
        ['cross', 'cross', 0, 'pct'],
        ['line-width', 'lineWidth', 2, 'f2'],
        ['line-fade', 'lineFadeDeg', 1, 'deg'],
        ['line-twinkle', 'lineTwinkle', 0, 'factor'],
    ['line-speed', 'lineSpeed', 2, 'x'],
        ['meteor-rate', 'meteorRate', 1, 'f1'],
        ['meteor-bright', 'meteorBright', 2, 'f2'],
        ['clouds', 'clouds', 0, 'pct'],
        ['cloud-speed', 'cloudSpeed', 2, 'f2'],
        ['cloud-opacity', 'cloudOpacity', 2, 'f2'],
        ['boat-spread', 'boatSpread', 1, 'mul'],
        ['boat-pace', 'boatPace', 1, 'mul'],
        ['boat-scale', 'boatScale', 1, 'mul'],
        ['glass-range', 'glass', 0, 'pct'],
        ['glass-radius', 'glassRadius', 1, 'px'],
        ['glow', 'glow', 0, 'pct'],
      ];

      // One formatter per kind of value; the panel never shows a raw float.
      const formatValue = (kind, value) => {
        switch (kind) {
          case 'pct': return `${Math.round(value)}%`;
          case 'px': return `${Number(value).toFixed(1).replace(/\.0$/, '')}px`;
          case 'x': return `${Number(value).toFixed(2).replace(/0$/, '')}×`;
          case 'factor': return `${Math.round(value * 100)}%`;
          case 'int': return String(Math.round(value));
          case 'waves': return `${Math.round(value)}`;
          case 'tps': return `${Math.round(value)} tok/s`;
          case 'yuan': return `¥${Math.round(value)}`;
          case 'sec': return `${Number(value).toFixed(1).replace(/\.0$/, '')}s`;
          case 'clock': return state.sunMode === 'real' ? copy.realTime : clockLabel(value);
          case 'tz': return `UTC${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
        case 'mag': return `${value.toFixed(1)}${copy.magSuffix}`;
        case 'offset': return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`;
          case 'deg': return `${Number(value).toFixed(1).replace(/\.0$/, '')}°`;
          case 'mul': return `${Number(value).toFixed(1)}×`;
          default: return Number(value).toFixed(2);
        }
      };
      const rowEl = (id) => panel.querySelector(`#${pid(id)}`);
      const rowOut = (id) => panel.querySelector(`#${pid(id)}-out`);

      const syncUi = () => {
        enabledBox.checked = state.enabled;
        moonBox.checked = state.moon;
        perfBox.checked = state.perf;
        if (frostBox) frostBox.checked = state.frost;
        if (meteorBox) meteorBox.checked = state.meteor;
      if (daylightBox) daylightBox.checked = state.starsDaylight;
        if (boatsBox) boatsBox.checked = state.boats;
        setSeg(segWave, state.waveMode);
        setSeg(segSun, state.sunMode);
        setSeg(segTz, state.tzMode);
        setSeg(segTone, state.skyTone);
        setSeg(segGlassMode, state.glassMode);
      setSeg(el('star-mode'), state.starMode);
      setSeg(el('glass-style'), state.glassStyle);
      if (milkyOut) milkyOut.textContent = milkyText();
        for (const [key, entry] of Object.entries(columns)) {
          const entryState = state[key];
          entry.on.checked = entryState.on;
          entry.root.classList.toggle('off', !entryState.on);
          entry.range.value = String(entryState.strength);
          entry.out.textContent = `${Math.round(entryState.strength)}%`;
        }
        for (const [id, key, , kind] of RANGE_ROWS) {
          const input = rowEl(id);
          const output = rowOut(id);
          if (input) input.value = String(state[key]);
          if (output) output.textContent = formatValue(kind, state[key]);
        }
        if (latInput) latInput.value = state.lat === null ? '' : String(state.lat);
        if (lonInput) lonInput.value = state.lon === null ? '' : String(state.lon);
        setRowVisible(el('sea-range'), state.waveMode === 'manual');
        setRowVisible(el('time-range'), state.sunMode === 'manual');
        setRowVisible(el('tz-offset'), state.tzMode === 'manual');
      };

      const refresh = () => {
        syncUi();
        updateGlass();
        postSun();
        postGlass();
        postBoats();
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
        if (searchBox) {
          searchBox.placeholder = copy.search;
          searchBox.setAttribute('aria-label', copy.search);
        }
        applyCopy();
        syncUi();
        refreshSunReadout();
      };
      syncLocale();
      const localeObserver = new MutationObserver(syncLocale);
      localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      surfaceCleanups.push(() => localeObserver.disconnect());

      // Which message a slider belongs to; everything not listed is local-only.
      const SKY_KEYS = new Set([
        'skyDist', 'domeAmount', 'stars', 'starSize', 'starMin', 'starFalloff', 'starColor',
        'starSpikes', 'starBase', 'starHalo', 'starCount', 'starBias', 'starMode', 'starCut',
        'lineTwinkle', 'lineSpeed', 'starsDaylight', 'overflowGain',
        'twinkleSpeed', 'twinkleAmp', 'milky', 'skyTone', 'constellation', 'cross', 'lineWidth',
        'lineFadeDeg', 'meteor', 'meteorRate', 'meteorBright', 'clouds', 'cloudSpeed', 'cloudOpacity',
        'tzOffset', 'moon', 'lat', 'lon', 'quality', 'glow', 'fps',
      ]);
      const GLASS_KEYS = new Set(['glass', 'glassRadius', 'glassMode', 'perf']);
      const BOAT_KEYS = new Set(['boats', 'boatSpread', 'boatPace', 'boatScale']);

      for (const [id, key, , kind] of RANGE_ROWS) {
        const input = rowEl(id);
        if (!input) continue;
        on(input, 'input', () => {
          state[key] = clamp(input.value, Number(input.min), Number(input.max), DEFAULTS[key]);
          const output = rowOut(id);
          if (output) output.textContent = formatValue(kind, state[key]);
          void save({ [key]: state[key] });
          if (key === 'time') {
            state.autoCycle = false;
            state.sunMode = 'manual';
            syncUi();
            postSun();
            return;
          }
          if (key === 'sea') {
            seaValue = state.sea;
            postToOcean(seaValue);
            return;
          }
          if (GLASS_KEYS.has(key)) {
            updateGlass();
            postGlass();
            return;
          }
          if (BOAT_KEYS.has(key)) {
            postBoats();
            return;
          }
          if (SKY_KEYS.has(key)) postSun();
        });
      }

      for (const [input, key, min, max] of [[latInput, 'lat', -90, 90], [lonInput, 'lon', -180, 180]]) {
        if (!input) continue;
        on(input, 'change', () => {
          const raw = input.value.trim();
          const parsed = Number(raw);
          state[key] = raw === '' || !Number.isFinite(parsed) ? null : clamp(parsed, min, max, parsed);
          input.value = state[key] === null ? '' : String(state[key]);
          void save({ [key]: state[key] });
          postSun();
        });
      }
      const locateBtn = panel.querySelector(`#${pid('locate')}`);
      const locateOut = panel.querySelector(`#${pid('locate-out')}`);
      // One quiet attempt per page load: a declined prompt must not re-ask every
      // time the skin is switched back on.
      let locateTried = false;
      const runLocate = () => {
        locateTried = true;
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
            state.lat = clamp(lat, -90, 90, lat);
            state.lon = clamp(lon, -180, 180, lon);
            if (latInput) latInput.value = String(state.lat);
            if (lonInput) lonInput.value = String(state.lon);
            locateOut.textContent = copy.locateOk;
            void save({ lat: state.lat, lon: state.lon });
            postSun();
          },
          () => {
            locateOut.textContent = copy.locateFail;
          },
          { timeout: 8000, maximumAge: 600000 },
        );
      };
      if (locateBtn) on(locateBtn, 'click', runLocate);
    const nowBtn = panel.querySelector(`#${pid('time-now')}`);
    if (nowBtn) on(nowBtn, 'click', () => {
      // back to the live clock: the slider value is only meaningful in manual mode
      state = normalize({ ...state, sunMode: 'real', time: nowMinutes() });
      save();
      syncUi();
      postSun();
    });

      on(panel, 'click', (event) => {
        const option = event.target instanceof Element ? event.target.closest('.oss-seg button') : null;
        if (!(option instanceof HTMLElement)) return;
        const group = option.parentElement;
        const value = option.dataset.value;
        if (!(group instanceof HTMLElement) || !value) return;
        const patch = (() => {
          switch (group.id) {
            case pid('wave-mode'): return { waveMode: value };
            case pid('sun-mode'):
          // walking into manual lights up *now*, not 12:00, or the first drag jumps
          return value === 'manual' ? { sunMode: value, time: nowMinutes() } : { sunMode: value };
            case pid('tz-mode'): return { tzMode: value };
            case pid('sky-tone'): return { skyTone: value };
            case pid('glass-mode'): return { glassMode: value };
      case pid('star-mode'): return { starMode: value };
      case pid('glass-style'): return { glassStyle: value };
            case pid('quality'): return { quality: value };
      case pid('fps'): return { fps: Number(value) };
            default: return null;
          }
        })();
        if (!patch) return;
        setSeg(group, value);
        void save(patch);
        refresh();
      });

      for (const [key, entry] of Object.entries(columns)) {
        on(entry.on, 'change', () => {
          const patch = { [key]: { ...state[key], on: entry.on.checked } };
          void save(patch);
          refresh();
        });
        on(entry.range, 'input', () => {
          const strength = clamp(entry.range.value, 0, 100, state[key].strength);
          entry.out.textContent = `${Math.round(strength)}%`;
          const patch = { [key]: { ...state[key], strength } };
          void save(patch);
          updateGlass();
          postGlass();
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
        refreshSunReadout();
      refreshMoonReadout();
      });
      if (meteorBox) {
        on(meteorBox, 'change', () => {
          void save({ meteor: meteorBox.checked });
          postSun();
        });
      }
      if (daylightBox) {
        on(daylightBox, 'change', () => {
          void save({ starsDaylight: daylightBox.checked });
          postSun();
        });
      }
      on(boatsBox, 'change', () => {
        void save({ boats: boatsBox.checked });
        if (!boatsBox.checked) postFleet(0);
        else void pollFleet();
      });
      on(perfBox, 'change', () => {
        void save({ perf: perfBox.checked });
        updateGlass();
        postGlass();
      });
      on(frostBox, 'change', () => {
        void save({ frost: frostBox.checked });
        updateGlass();
        postGlass();
      });
      const makeDefaultBtn = el('make-default');
      const defaultOut = el('default-out');
      const refreshDefaultOut = () => {
        if (!defaultOut) return;
        defaultOut.textContent = baseline
          ? copy.defaultSaved.replace('{at}', baselineStamp())
          : copy.defaultBuiltin;
      };
      if (makeDefaultBtn) on(makeDefaultBtn, 'click', () => {
        const snapshot = { ...state, savedAt: Date.now() };
        baseline = snapshot;
        void options.storage.set({ baseline: snapshot });
        refreshDefaultOut();
      });
      refreshDefaultOut();

      const colsPreviewBtn = el('cols-preview');
      if (colsPreviewBtn) on(colsPreviewBtn, 'click', previewColumns);

      on(resetBtn, 'click', () => {
        // Resetting should put the look back, not revoke the location the browser
        // already granted: wiping lat/lon sent the sky back to the fallback city
        // and asked for permission again on the next launch.
        const base = baseline ? { ...baseline } : { ...DEFAULTS };
        delete base.savedAt;
        void save({ ...base, lat: state.lat, lon: state.lon }).then(() => {
          seaValue = state.sea;
          refresh();
          applyEnabled();
        });
      });

      // A new panel group is a lot of rows; typing narrows the list, and any
      // section with a hit is forced open so nothing stays folded out of sight.
      if (searchBox) {
        on(searchBox, 'input', () => {
          const needle = searchBox.value.trim().toLowerCase();
          for (const section of panel.querySelectorAll('.oss-sec')) {
            // a hit on the group's own title keeps every row of that group
            const caption = section.querySelector('.oss-caption');
            const titleHit = Boolean(needle) && Boolean(caption) && caption.textContent.toLowerCase().includes(needle);
            let hits = 0;
            for (const item of section.querySelectorAll('.oss-row, .oss-inline, .oss-col')) {
              const match = !needle || titleHit || item.textContent.toLowerCase().includes(needle);
              item.hidden = !match;
              if (match) hits += 1;
            }
            // searching opens whatever it found; clearing restores the built shape
            section.open = needle ? true : section.dataset.open0 === '1';
            section.hidden = Boolean(needle) && !titleHit && hits === 0;
          }
          // the mode-gated rows are hidden for their own reasons, not for search
          if (!needle) {
            setRowVisible(el('sea-range'), state.waveMode === 'manual');
            setRowVisible(el('time-range'), state.sunMode === 'manual');
            setRowVisible(el('tz-offset'), state.tzMode === 'manual');
          }
        });
      }

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

      // Never located before: try once, quietly. Declining the browser prompt is
      // not an error — the field stays empty and the sky keeps its fallback city.
      if (!locateTried && (state.lat === null || state.lon === null)) globalThis.setTimeout(runLocate, 600);
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
      const mountPanel = () => {
        try {
          if (!document.getElementById(IDS.button)) mountUi();
        } catch (error) {
          console.warn('[Open Sea Skin] Panel failed to mount.', error);
        }
      };
      if (!state.enabled) {
        mountPanel();
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
      if (document.getElementById(IDS.frame)) {
        mountPanel();
        return;
      }
      if (mountOcean()) mountPanel();
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
      // A reload is a new session: the manual clock re-seeds to the wall clock, so
      // a page that was left on a manual midnight opens on the real time of day.
      if (state.sunMode === 'manual') state.time = nowMinutes();
      try {
        const stored = await options.storage.get({ baseline: null });
        if (stored && stored.baseline && typeof stored.baseline === 'object') baseline = stored.baseline;
      } catch (error) {
        console.warn('[Open Sea Skin] Failed to load the saved defaults.', error);
      }
      seaValue = state.sea;
      applyEnabled();
      // the sea follows the session even when no panel is mounted
      startWaveEngine();
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
    baseline: 'ossBaseline',
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
    constellation: 'ossConstellation',
    cross: 'ossCross',
    meteor: 'ossMeteor',
    clouds: 'ossClouds',
    frost: 'ossFrost',
    glassMode: 'ossGlassMode',
    colLeft: 'ossColLeft',
    colRight: 'ossColRight',
    perf: 'ossPerf',
    boats: 'ossBoats',
    boatSpread: 'ossBoatSpread',
    boatPace: 'ossBoatPace',
    boatScale: 'ossBoatScale',
    skyDist: 'ossSkyDist',
    domeAmount: 'ossDomeAmount',
    skyTone: 'ossSkyTone',
    starSize: 'ossStarSize',
    starMin: 'ossStarMin',
    starFalloff: 'ossStarFalloff',
    starColor: 'ossStarColor',
    starSpikes: 'ossStarSpikes',
    starBase: 'ossStarBase',
    starHalo: 'ossStarHalo',
    starCount: 'ossStarCount',
    twinkleSpeed: 'ossTwinkleSpeed',
    twinkleAmp: 'ossTwinkleAmp',
    milky: 'ossMilky',
    lineWidth: 'ossLineWidth',
    lineFadeDeg: 'ossLineFadeDeg',
    lineTwinkle: 'ossLineTwinkle',
    lineSpeed: 'ossLineSpeed',
    starBias: 'ossStarBias',
    starMode: 'ossStarMode',
    starCut: 'ossStarCut',
    starsDaylight: 'ossStarsDaylight',
    overflowGain: 'ossOverflowGain',
    glassStyle: 'ossGlassStyle',
    meteorRate: 'ossMeteorRate',
    meteorBright: 'ossMeteorBright',
    cloudSpeed: 'ossCloudSpeed',
    cloudOpacity: 'ossCloudOpacity',
    glassRadius: 'ossGlassRadius',
    tzMode: 'ossTzMode',
    tzOffset: 'ossTzOffset',
    quality: 'ossQuality',
    fps: 'ossFps',
    glow: 'ossGlow',
  });

  const BOOLEAN_KEYS = new Set(['enabled', 'autoCycle', 'moon', 'meteor', 'perf', 'boats', 'starsDaylight', 'frost']);
  const JSON_KEYS = new Set(['colLeft', 'colRight', 'baseline']);
  const NULLABLE_KEYS = new Set(['lat', 'lon']);
  const TEXT_KEYS = new Set([
    'waveMode', 'sunMode', 'stars', 'constellation', 'cross', 'clouds', 'glassMode',
    'skyTone', 'tzMode', 'starMode', 'glassStyle',
  ]);

  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(KEYS[key]);
      if (value === null) return fallback;
      if (BOOLEAN_KEYS.has(key)) return value !== 'false';
      if (JSON_KEYS.has(key)) {
        try { return JSON.parse(value); } catch { return fallback; }
      }
      if (TEXT_KEYS.has(key)) return value;
      // An unset coordinate is stored as an empty string, not as "0", so a
      // profile written before the machine was ever located still reads as null.
      if (NULLABLE_KEYS.has(key)) return value === '' || value === 'null' ? null : Number(value);
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
    count: 0,
    at: 0,
    read() { return this.value; },
    // `count`/`at` let the panel say out loud whether the hidden bridge ever
    // rendered. Without them a dead bridge and a flat session look identical:
    // both leave the wave engine reading nothing and easing to the floor.
    push(next) { this.value = next; this.count += 1; this.at = performance.now(); },
  };

  // Stamped into both halves so a report can name which copy the browser is
  // actually running: the panel and the frame are loaded by different paths and
  // a stale one looks exactly like a bug.
  const SKIN_BUILD = 'lab-1.5.55';

  exports.name = 'open-sea-skin-client';
  exports.inject = ['slots'];
  exports.apply = function apply(ctx) {
    globalThis.__openSeaSkinMetrics = metricsStore;
    console.info('[open-sea-skin] client', SKIN_BUILD);

    // Renders nothing: it only mirrors the session's cumulative token usage and
    // the active model into the store the wave engine polls.
    //
    // Registered before the controller and guarded rather than bailing out: the
    // skin has to draw even when the host cannot give us a slot, and the panel
    // prints *why* the bridge is missing instead of leaving a silent flat sea.
    const slots = ctx && (ctx.slots || (typeof ctx.get === 'function' ? ctx.get('slots') : null));
    const describeSlots = () => {
      if (!ctx) return 'no-ctx';
      if (!slots) return 'no-slots';
      if (typeof slots.inject !== 'function' || typeof slots.register !== 'function') return 'slots-shape';
      return '';
    };
    let bridgeState = describeSlots();
    if (!bridgeState) {
      const Bridge = function OpenSeaSkinMetrics(props) {
        const usage = props && props.useProjection ? props.useProjection('tokenUsage') : null;
        const selection = props && props.useProjection ? props.useProjection('modelSelection') : null;
        const model = selection ? selection.next || selection.lastUsed : null;
        // Pushed while rendering instead of from an effect: the store has to carry
        // the open conversation on the first tick after a switch, and an effect
        // only fires after paint (and only when its dependency list agrees).
        metricsStore.push({
          sessionId: (props && props.sessionId) || null,
          cachedTokens: (usage && usage.cacheReadTokens) || 0,
          uncachedTokens: (usage && usage.uncachedInputTokens) || 0,
          outputTokens: (usage && usage.outputTokens) || 0,
          costYuan: costOf(usage, model),
        });
        return null;
      };
      Bridge.displayName = 'OpenSeaSkinMetrics';
      // Handed to the slot as a plain component: no React.createElement needed, so
      // this path cannot fail just because the module loader will not resolve
      // 'react' for a plugin that never declared it as a dependency.
      const register = () => slots.register(
        { name: 'conversation.composer.dock', id: 'open-sea-skin-metrics', order: 900 },
        Bridge,
      );
      try {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => slots.inject('conversation.composer.dock', register), 'open-sea-skin: metrics bridge');
        } else {
          slots.inject('conversation.composer.dock', register);
        }
      } catch (error) {
        bridgeState = 'inject-failed';
        console.warn('[open-sea-skin] metrics bridge failed to mount', error);
      }
    }
    globalThis.__openSeaSkinBridgeState = bridgeState || 'mounted';

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
              // An unset coordinate is written as an empty string so it reads
              // back as "never located" instead of the number NaN.
              if (value === null) { localStorage.setItem(KEYS[key], ''); continue; }
              localStorage.setItem(KEYS[key], typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
          } catch {
            // Locked-down storage keeps the live value for this page.
          }
        },
      },
    });
    // One controller per page. A second mount (hot reload, a re-applied plugin)
    // would otherwise keep a second frame alive and post its own, older roster
    // numbers into the same ocean, so whichever posted last won.
    const previous = globalThis.__openSeaSkinController;
    if (previous && typeof previous.stop === 'function') {
      try { previous.stop(); } catch { /* already gone */ }
    }
    globalThis.__openSeaSkinController = controller;
    void controller.start();
    ctx.effect(() => () => {
      if (globalThis.__openSeaSkinController === controller) globalThis.__openSeaSkinController = null;
      controller.stop();
    }, 'open-sea-skin: browser surface');

  };

  return module.exports;
}});
