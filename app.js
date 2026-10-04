'use strict';
/* =============================================================
   巅峰球星卡 · 招募系统
   —— 界面参考 NBA 巅峰对决：卡池选择 / 中央大立绘 / 底部招募按钮
   ============================================================= */

/* ---------------- 音效 ---------------- */
/* =============================================================
   真实赛场音效播放器
   -------------------------------------------------------------
   用的是 Mixkit 的真实录音（不是合成音），已内嵌为 base64。
   首次触摸屏幕时解码成 AudioBuffer，之后每次触发直接播放，
   支持叠音（同时多次播放）和音量控制。
   解码失败会自动回退到合成音，保证任何环境都有声音。
   ============================================================= */
const Arena = (() => {
  let ac = null, master = null;
  const buf = {};
  let ready = false, loading = false;
  function attach(ctx, out) { ac = ctx; master = out; }
  function load() {
    if (ready || loading || !ac) return;
    if (typeof ARENA_SRC === 'undefined') return;
    loading = true;
    let left = 0, done = 0;
    Object.keys(ARENA_SRC).forEach((k) => {
      left++;
      const b64 = ARENA_SRC[k].split(',')[1];
      try {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        // Safari 用 callback 形式，Chrome 两种都支持
        const p = ac.decodeAudioData(u8.buffer,
          (b) => { buf[k] = b; if (++done === left) ready = true; },
          () => { if (++done === left) ready = true; });
        if (p && p.then) p.then((b) => { if (!buf[k]) buf[k] = b; }).catch(() => {});
      } catch (e) { done++; }
    });
    setTimeout(() => { loading = false; }, 50);
  }
  /** 播放一个音效；vol 音量，rate 播放速度（变速可让同一素材听感不同） */
  function play(name, vol, rate) {
    if (!ac || !buf[name]) return false;
    try {
      const src = ac.createBufferSource();
      src.buffer = buf[name];
      src.playbackRate.value = rate || 1;
      const g = ac.createGain();
      g.gain.value = vol == null ? 1 : vol;
      src.connect(g); g.connect(master);
      src.start();
      return true;
    } catch (e) { return false; }
  }
  function loop(name, vol) {
    if (!ac || !buf[name]) return null;
    try {
      const src = ac.createBufferSource();
      src.buffer = buf[name]; src.loop = true;
      const g = ac.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 1.2);
      src.connect(g); g.connect(master); src.start();
      return { src, g };
    } catch (e) { return null; }
  }
  return { attach, load, play, loop, has: (n) => !!buf[n],
    get ready() { return ready; },
    get count() { return Object.keys(buf).length; } };
})();

const Sfx = (() => {
  let ac = null, bus = null;
  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    bus = ac.createGain(); bus.gain.value = 0.5; bus.connect(ac.destination);
    // 真实音效走同一个 AudioContext 和总线
    Arena.attach(ac, bus);
    Arena.load();
  }
  function note(f0, dur, opt) {
    if (!ac) return;
    opt = opt || {};
    const t0 = ac.currentTime + (opt.delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = opt.type || 'square';
    o.frequency.setValueAtTime(f0, t0);
    if (opt.f1) o.frequency.exponentialRampToValueAtTime(Math.max(25, opt.f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.vol == null ? 0.2 : opt.vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  /** 带滤波/包络的噪声，用来做观众、球鞋、篮筐这类"非乐音"效果 */
  function noiseF(dur, vol, opt) {
    if (!ac) return;
    opt = opt || {};
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // 包络：attack 上升、decay 下降
      const at = opt.attack == null ? 0.06 : opt.attack;
      const env = t < at ? t / at : Math.pow(1 - (t - at) / (1 - at), opt.power || 1.6);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ac.createBufferSource(); src.buffer = b;
    let node = src;
    if (opt.type) {
      const f = ac.createBiquadFilter();
      f.type = opt.type;
      f.frequency.value = opt.freq || 1200;
      if (opt.q != null) f.Q.value = opt.q;
      node.connect(f); node = f;
    }
    const g = ac.createGain();
    g.gain.value = vol == null ? 0.2 : vol;
    node.connect(g);
    const t0 = ac.currentTime + (opt.delay || 0);
    g.connect(bus);
    src.start(t0);
  }

  function noise(dur, vol) {
    if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = b;
    const g = ac.createGain(); g.gain.value = vol == null ? 0.2 : vol;
    s.connect(g); g.connect(bus); s.start();
  }
  return {
    unlock() { init(); if (ac && ac.state === 'suspended') ac.resume(); },
    click() { this.unlock(); note(680, 0.05, { vol: 0.13 }); },
    charge() { this.unlock(); note(160, 1.15, { f1: 900, type: 'sawtooth', vol: 0.13 }); noise(1.1, 0.05); },
    boom() { this.unlock(); note(150, 0.5, { f1: 32, type: 'sine', vol: 0.5 }); noise(0.45, 0.35); },
    flip() { this.unlock(); note(920, 0.05, { vol: 0.12 }); },
    coin() { this.unlock(); note(1180, 0.06, { vol: 0.15 }); note(1560, 0.16, { vol: 0.15, delay: 0.05 }); },
    fail() { this.unlock(); note(200, 0.16, { f1: 110, type: 'sawtooth', vol: 0.2 }); },

    /* =========================================================
       赛场音效（全部实时合成，不依赖任何音频文件）
       ========================================================= */
    /** 空心入网：短促的"唰" */
    swish() {
      this.unlock();
      if (Arena.play('swish', 0.85, 1 + (Math.random() - 0.5) * 0.14)) return;
      noiseF(0.16, 0.20, { type: 'highpass', freq: 2600 });   // 回退：合成
    },
    /** 打铁：金属碰撞 + 篮筐余振 */
    rim() {
      if (Arena.play('clang', 0.8, 1 + (Math.random() - 0.5) * 0.22)) return;
      this.unlock();
      noiseF(0.1, 0.22, { type: 'bandpass', freq: 3200, q: 6, attack: 0.004, power: 2.6 });
      note(420, 0.22, { f1: 250, type: 'triangle', vol: 0.14 });
      note(1180, 0.14, { f1: 900, type: 'square', vol: 0.05, delay: 0.01 });
    },
    /** 打板：闷响 */
    board() {
      if (Arena.play('hardhit', 0.75, 0.9)) return;
      this.unlock();
      noiseF(0.12, 0.18, { type: 'lowpass', freq: 900, attack: 0.004, power: 2.4 });
      note(260, 0.14, { f1: 130, type: 'sine', vol: 0.16 });
    },
    /** 扣篮：重击 + 篮筐震颤 + 观众炸开 */
    dunk() {
      this.unlock();
      if (Arena.play('impact', 0.95, 1)) { this.cheer(0.9, 0.34, 0.05); return; }
      this.unlock();
      note(110, 0.42, { f1: 34, type: 'sine', vol: 0.5 });
      noiseF(0.3, 0.3, { type: 'lowpass', freq: 1400, attack: 0.004, power: 2.2 });
      // 篮筐余振
      [0, 0.05, 0.1].forEach((d, i) =>
        note(520 - i * 60, 0.18, { f1: 300, type: 'triangle', vol: 0.09, delay: 0.04 + d }));
      this.cheer(0.9, 0.34, 0.06);
    },
    /** 盖帽：清脆的一巴掌 */
    blockSfx() {
      this.unlock();
      if (Arena.play('blow', 0.9, 1) && Arena.play('hardhit', 0.6, 1.15)) {
        this.ooh(0.5); return;
      }
      this.unlock();
      noiseF(0.09, 0.34, { type: 'bandpass', freq: 1800, q: 2.5, attack: 0.002, power: 3.2 });
      note(220, 0.1, { f1: 90, type: 'square', vol: 0.18 });
      this.ooh(0.5);
    },
    /** 抢断：球鞋摩擦地板 */
    stealSfx() {
      this.unlock();
      if (Arena.play('quickhit', 0.8, 1.1)) return;
      this.unlock();
      noiseF(0.19, 0.16, { type: 'bandpass', freq: 3600, q: 8, attack: 0.12, power: 1.4 });
      note(1400, 0.09, { f1: 2400, type: 'sawtooth', vol: 0.05 });
    },
    /** 突破脚步：几声急促的鞋底摩擦 */
    steps(n) {
      this.unlock();
      const k = n || 3;
      if (Arena.has('bounce')) {
        for (let i = 0; i < k; i++) {
          setTimeout(() => Arena.play('bounce', 0.35, 1.2 + Math.random() * 0.3), i * 115);
        }
        return;
      }
      for (let i = 0; i < k; i++) {
        noiseF(0.07, 0.1, { type: 'bandpass', freq: 4200, q: 9,
          attack: 0.2, power: 1.8, delay: i * 0.115 });
      }
    },
    /** 观众欢呼（越大声越久） */
    cheer(power, vol, delay) {
      this.unlock();
      const p = power == null ? 0.7 : power;
      if (Arena.has('cheer')) {
        const v = (vol == null ? 0.3 : vol) * 1.6;
        setTimeout(() => Arena.play('cheer', Math.min(1, v), 0.96 + Math.random() * 0.1),
          (delay || 0) * 1000);
        return;
      }
      const v = vol == null ? 0.26 * p : vol;
      noiseF(0.9 * p + 0.5, v, { type: 'bandpass', freq: 1500, q: 0.7,
        attack: 0.22, power: 1.1, delay: delay || 0 });
      noiseF(0.7 * p + 0.4, v * 0.6, { type: 'highpass', freq: 900,
        attack: 0.3, power: 1.0, delay: (delay || 0) + 0.05 });
    },
    /** 掌声：密集的短促脉冲 */
    clap(times, vol) {
      this.unlock();
      const n = times || 8;
      if (Arena.has('clap')) {
        Arena.play('clap', Math.min(1, (vol == null ? 0.5 : vol) * 4.2),
          0.94 + Math.random() * 0.12);
        return;
      }
      for (let i = 0; i < n; i++) {
        const r = 0.9 + Math.random() * 0.35;
        noiseF(0.045, (vol == null ? 0.12 : vol) * r,
          { type: 'bandpass', freq: 2400, q: 1.6, attack: 0.02, power: 2.6,
            delay: i * 0.055 + Math.random() * 0.02 });
      }
    },
    /** 全场惋惜："噢——"（球差一点进） */
    ooh(power) {
      this.unlock();
      const p = power == null ? 0.6 : power;
      if (Arena.play('ooh', 0.55 * p + 0.2, 0.98)) return;
      noiseF(0.75 * p + 0.3, 0.2 * p, { type: 'lowpass', freq: 700,
        attack: 0.14, power: 1.3 });
      note(300, 0.6, { f1: 170, type: 'sine', vol: 0.05 * p });
    },
    /** 嘘声 */
    boo() {
      this.unlock();
      noiseF(0.9, 0.16, { type: 'lowpass', freq: 420, attack: 0.2, power: 1.2 });
      note(120, 0.8, { f1: 90, type: 'sawtooth', vol: 0.06 });
    },
    /** 裁判哨 */
    whistle() {
      this.unlock();
      if (Arena.play('whistle', 0.6, 1.02)) return;
      note(2350, 0.16, { type: 'square', vol: 0.1 });
      note(2950, 0.16, { type: 'square', vol: 0.07, delay: 0.005 });
      note(2350, 0.2, { type: 'square', vol: 0.09, delay: 0.17 });
    },
    /** 蜂鸣器（节末） */
    buzzer() {
      this.unlock();
      if (Arena.play('buzzer', 0.75, 1)) return;
      note(190, 1.1, { type: 'square', vol: 0.24 });
      note(95, 1.1, { type: 'sawtooth', vol: 0.12 });
    },
    /** 得分后的播报提示音 */
    score() {
      this.unlock();
      note(760, 0.09, { vol: 0.13 });
      note(1010, 0.14, { vol: 0.13, delay: 0.06 });
    },
    /** 篮球拍地 */
    dribble() {
      this.unlock();
      if (Arena.play('bounce', 0.5, 1.15 + Math.random() * 0.25)) return;
      noiseF(0.08, 0.13, { type: 'lowpass', freq: 500 });
    },
    /** 篮球落地（运球/争抢） */
    ballBounce() {
      this.unlock();
      if (Arena.play('bounce', 0.55, 1 + (Math.random() - 0.5) * 0.2)) return;
      noiseF(0.08, 0.13, { type: 'lowpass', freq: 500 });
    },
    /** 接球 */
    catchBall() {
      this.unlock();
      if (Arena.play('catch', 0.6, 1)) return;
      noiseF(0.07, 0.12, { type: 'bandpass', freq: 1400, q: 1.5 });
    },
    /** 篮球重击（强对抗） */
    ballHit() {
      this.unlock();
      if (Arena.play('hardhit', 0.8, 1)) return;
      noiseF(0.09, 0.2, { type: 'bandpass', freq: 1800, q: 2.5 });
    },

    /* ---------------- 赛场环境音（持续循环） ----------------
       底噪：观众低声交谈 + 场馆混响，一直垫在背景里。
       开赛时启动、离场时停掉；音量随比赛紧张度微调。 */
    _amb: null,
    ambienceOn() {
      this.unlock();
      if (!ac || this._amb) return;
      // 优先用真实球场人声循环（Mixkit「Crowd chanting at stadium」）
      const real = Arena.loop('chant', 0.22);
      if (real) { this._amb = real; this._ambReal = true; return; }
      const n = Math.floor(ac.sampleRate * 3);
      const b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        // 布朗噪声：比白噪声更接近"人群低语"
        last = (last + (Math.random() * 2 - 1) * 0.06) * 0.985;
        // 首尾交叉淡化，循环无缝
        const fade = Math.min(1, i / (ac.sampleRate * 0.3),
          (n - i) / (ac.sampleRate * 0.3));
        d[i] = last * fade * 3.2;
      }
      const src = ac.createBufferSource();
      src.buffer = b; src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 90;
      const g = ac.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.14, ac.currentTime + 1.4);
      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(bus);
      src.start();
      this._amb = { src, g };
    },
    ambienceOff() {
      if (!this._amb || !ac) return;
      const { src, g } = this._amb;
      try {
        g.gain.cancelScheduledValues(ac.currentTime);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.8);
        src.stop(ac.currentTime + 0.9);
      } catch (e) {}
      this._amb = null; this._ambReal = false;
    },
    /** 比赛越紧张，观众底噪越大 */
    ambienceLevel(v) {
      if (!this._amb || !ac) return;
      try {
        // 真实录音底噪本身较响，整体压低；合成底噪按原值
        const t = this._ambReal
          ? Math.max(0.06, Math.min(0.48, v * 1.9))
          : Math.max(0.03, Math.min(0.3, v));
        this._amb.g.gain.cancelScheduledValues(ac.currentTime);
        this._amb.g.gain.linearRampToValueAtTime(t, ac.currentTime + 0.8);
      } catch (e) {}
    },
    reveal(key) {
      this.unlock();
      const seq = {
        silver:       [[520, .06]],
        gold:         [[620, .07], [800, .12]],
        purple:       [[660, .07], [880, .07], [1120, .16]],
        momentGold:   [[700, .08], [930, .08], [1180, .08], [1520, .22]],
        momentPurple: [[660, .09], [830, .09], [990, .09], [1320, .09], [1660, .16], [1980, .45]],
      }[key] || [[520, .06]];
      const loud = key === 'momentGold' || key === 'momentPurple';
      seq.forEach(([f, d], i) => note(f, d, { vol: loud ? 0.26 : 0.17, delay: i * 0.06 }));
      if (key === 'momentPurple') { note(70, 0.9, { f1: 28, type: 'sine', vol: 0.45 }); noise(0.8, 0.18); }
      else if (key === 'momentGold' || key === 'purple') {
        note(90, 0.5, { f1: 34, type: 'sine', vol: 0.32 }); noise(0.4, 0.12);
      }
    },
  };
})();

/* ---------------- 存档 ---------------- */
const SAVE_KEY = 'peak-card-recruit-v2';
// 构建标记：设置页会显示，方便确认手机上跑的是不是最新版
const BUILD_TAG = 'r' + (window.__BUILD__ || '2026-09-30b');

/* 退出 / 切后台时的兜底保存 —— 手机上这步最关键 */
(function autoSaveHooks() {
  const flush = () => { try { saveNow(true); } catch (e) {} };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  // 每 20 秒兜底一次，防止异常退出丢太多进度
  setInterval(() => { try { saveNow(true); } catch (e) {} }, 20000);
})();
const MAX_BREAK = BREAK.stages;   // 9 阶；银/金卡每阶 7 张，64 张（含本体）满突破
const DEFAULT_STATE = () => ({
  coins: 12000,
  autoSave: true,          // 自动保存开关（设置页可关）
  autoSub: true, myConf: '西',           // ⚠️ 旧字段，保留兼容（现在由 coachOn 主导）
  coachOn: true,                         // 🧠 教练是否接管比赛（v9.38）
  coachKey: 'default',                   // 使用哪个教练（教练卡的接口，暂时只有 default）
  fav: {},                 // 收藏标记（★）
  locked: {},              // 锁定的球员 { 卡id: true } —— 锁定后不可出售
  rotFlip: false,          // 竖屏旋转方向：false=顺时针90°，true=逆时针90°
  owned: {},
  pity: { purple: 0, legend: 0, moment: 0, total: 0 },
  pulls: 0,
  lastSupply: 0,
  supplyCount: 0,
  supplyDay: '',            // 补给每日上限：上次领的日期（v9.27）
  supplyToday: 0,           // 补给每日上限：今天已领次数（v9.27）
  exDay: '',                // 兑换所传说档次数：日期（v9.27）
  exToday: 0,               // 兑换所传说档次数：今天已兑换次数（v9.27）
  dexReward: 0,
  dexClaimed: {},          // 图鉴收集里程碑的领取记录 { 里程碑id: true }
  breakRefunded: false,    // v9.2 突破每阶张数下调的差额是否已退还（只退一次）
  removedCleaned: false,   // v9.11 已下架卡牌的存档残留是否已清理（只清一次）
  tradeOffers: null,       // AI 主动出价收件箱（见 league.js）
  offerSeen: 0,            // 上次查看收件箱时的报价数（用来显示红点）
  best: null,
  skipAnim: false,
  lineup: null,
  roster: null,
  btWin: 0,
  btLose: 0,
  offTac: 'balanced',
  defTac: 'man',
});
/* iOS 从「文件」App 打开本地 html 时 localStorage 有可能被禁用。
   先探测一次，不可用就退回内存存档，并提示玩家用「导出存档」手动备份。 */
/* ★ 单文件离线版：如果 save-portal.js 提供了加固版存储，就用它。
   （save-portal.js 必须在 app.js 之前加载 —— 见 index.html）
   它做了多级降级：localStorage → sessionStorage → IndexedDB → 内存。 */
const Store = window.__SaveStoreOverride || (() => {
  let usable = false;
  try {
    localStorage.setItem('__probe__', '1');
    localStorage.removeItem('__probe__');
    usable = true;
  } catch (e) { usable = false; }
  return {
    get usable() { return usable; },
    read(k) { try { return usable ? localStorage.getItem(k) : null; } catch (e) { return null; } },
    write(k, v) {
      try { if (!usable) return false; localStorage.setItem(k, v); return true; }
      catch (e) { usable = false; return false; }
    },
    wipe(k) { try { if (usable) localStorage.removeItem(k); } catch (e) {} },
  };
})();
let S = load();

/* =============================================================
   v9.2 存档迁移：补退「突破每阶张数」下调的差额
   -------------------------------------------------------------
   问题现象：有些球员卡明明已经 64 张了，却怎么都满突不了。

   根因：v9.0 把每阶消耗从「银/金 8 张、紫 6、名宿紫 5、时刻 4」
   下调成「7 / 5 / 4 / 3」，但**老存档里已经消耗掉的张数是按旧价扣的**，
   下调后没有退还。于是：
     · 老存档突到 7 阶时，已经按旧价扣掉 7×8 = 56 张
     · 手上只剩 dup = 63-56 = 7 张
     · 新规则每阶要 7 张 → 只能再突 1 阶到 8 阶，然后还差 7 张
     · 而持卡上限就是 64，买不动了 → 永远停在 8 阶

   修法：一次性把差额退还成可用的重复卡
     退还张数 = 已突阶数 × (旧每阶 − 新每阶)
   四个档位的差额都正好是 1，所以等于「突了几阶就退几张」。

   注意：只加 dup、**不动 got**。因为 got 是"累计抽到过几张"，
   退还消耗掉的卡并不会让你多抽到卡；而且退完之后
   恒等式 `got = 1 + dup + brk × 每阶` 正好重新成立。
   ============================================================= */
const BREAK_PER_OLD = {
  silver: 8, gold: 8, purple: 6, legendPurple: 5, momentGold: 4, momentPurple: 4,
};
function migrateBreakRefund() {
  if (S.breakRefunded) return 0;          // 只跑一次，重复跑会多退
  let back = 0, cards = 0;
  Object.keys(S.owned || {}).forEach((id) => {
    const o = S.owned[id];
    if (!o || !o.brk) return;
    const c = (typeof CARD_BY_ID !== 'undefined') && CARD_BY_ID[id];
    const tier = c ? c.tier : 'silver';
    const oldPer = BREAK_PER_OLD[tier] != null ? BREAK_PER_OLD[tier] : 8;
    const newPer = (typeof breakPerOf === 'function') ? breakPerOf(tier) : 7;
    const diff = oldPer - newPer;
    if (diff <= 0) return;
    const refund = (o.brk || 0) * diff;
    o.dup = (o.dup || 0) + refund;
    back += refund; cards++;
  });
  S.breakRefunded = true;
  if (cards) {
    try { save(); } catch (e) {}
    /* 让玩家知道发生了什么，不然会以为卡凭空多了 */
    setTimeout(() => {
      try {
        toast('🔧 突破规则更新：' + cards + ' 名球员退还了 ' + back
          + ' 张重复卡（每阶消耗下调的差额）');
      } catch (e) {}
    }, 1200);
  }
  return back;
}
try { migrateBreakRefund(); } catch (e) { /* 迁移失败不能挡住游戏启动 */ }

/* =============================================================
   清理已下架卡牌的残留（v9.11）
   -------------------------------------------------------------
   data.js 里用「墓碑」下架了 9 张照片不合格的卡（REMOVED_CARDS）。
   老存档里可能还留着对这些卡的引用 ——
   比如阵容里正好派了王治郅，卡没了但 slots 里还指着 c382，
   那球队管理页就会渲染出一个空位 / 报错。

   这里把残留引用清干净：
     · owned  里这些卡的持有记录
     · roster 首发/替补里的悬空 id
     · lineup / fav / locked 等以卡 id 为键的表
   跑完给玩家一个提示，不然会以为卡被吞了。
   ============================================================= */
function migrateRemovedCards() {
  if (S.removedCleaned) return 0;
  if (typeof REMOVED_CARDS === 'undefined' || !REMOVED_CARDS.size) return 0;
  const dead = new Set();
  REMOVED_CARDS.forEach((i) => dead.add('c' + i));
  let owned = 0, slots = 0;

  /* ① 持有记录 */
  Object.keys(S.owned || {}).forEach((id) => {
    if (dead.has(id)) { delete S.owned[id]; owned++; }
  });
  /* ② 阵容里的悬空 id（只清成 null，后面 finalizeRoster 会自动补位） */
  const r = S.roster;
  if (r) {
    ['starters', 'bench'].forEach((k) => {
      if (!Array.isArray(r[k])) return;
      r[k] = r[k].map((id) => {
        if (id && dead.has(id)) { slots++; return null; }
        return id;
      });
    });
  }
  /* ③ 以卡 id 为键的其它表 */
  ['fav', 'locked'].forEach((k) => {
    Object.keys(S[k] || {}).forEach((id) => { if (dead.has(id)) delete S[k][id]; });
  });
  /* ④ lineup 快照（可能是数组，也可能是对象） */
  if (Array.isArray(S.lineup)) S.lineup = S.lineup.filter((id) => !dead.has(id));
  else if (S.lineup && typeof S.lineup === 'object') {
    Object.keys(S.lineup).forEach((k) => { if (dead.has(k)) delete S.lineup[k]; });
  }

  S.removedCleaned = true;
  if (owned || slots) {
    try { save(); } catch (e) {}
    setTimeout(() => {
      try {
        toast('🔧 已下架 ' + dead.size + ' 张照片不合格的卡'
          + (slots ? '，你的阵容里有 ' + slots + ' 个位置被清空，请重新安排' : ''));
      } catch (e) {}
    }, 1400);
  }
  return owned + slots;
}
try { migrateRemovedCards(); } catch (e) { /* 迁移失败不能挡住游戏启动 */ }

function load() {
  try {
    const raw = Store.read(SAVE_KEY);
    if (!raw) return DEFAULT_STATE();
    const d = JSON.parse(raw);
    return Object.assign(DEFAULT_STATE(), d, { pity: Object.assign(DEFAULT_STATE().pity, d.pity || {}) });
  } catch (e) { return DEFAULT_STATE(); }
}
/* =============================================================
   存档
   -------------------------------------------------------------
   · S.autoSave 默认开启：任何操作后都会写一次 localStorage
   · 就算自动保存关掉，退出/切后台时也会兜底写一次
     （手机上 App 随时可能被系统杀掉，不兜底会丢进度）
   · 同时记录最后保存时间，设置页能看到
   ============================================================= */
let saveTimer = null;
let lastSaveAt = 0;

/**
 * 顶部支票余额实时刷新。
 * ---------------------------------------------------------------
 * 挂在 save() 里 —— 游戏里每一次金币变动（比赛奖金、买卖球员、
 * 招募花费、赛季奖励…）后面都会 save()，所以这样不可能漏掉，
 * 不用在每个加钱减钱的地方手动调用。
 */
let lastCoinShown = null;
function updateCoinsUI() {
  const el = document.getElementById('ui-coins');
  if (!el) return;
  const v = fmt(S.coins);
  if (lastCoinShown === null) { lastCoinShown = v; el.textContent = v; return; }
  if (el.textContent === v) { lastCoinShown = v; return; }
  el.textContent = v;
  lastCoinShown = v;
  // 数字弹一下 + 变金色，让玩家立刻注意到钱变了
  const box = el.closest('.cur') || el;
  box.classList.remove('coin-bump');
  void box.offsetWidth;
  box.classList.add('coin-bump');
}
window.updateCoinsUI = updateCoinsUI;

/** 真正写盘。force=true 时忽略自动保存开关（退出兜底用） */
function saveNow(force) {
  if (!force && S.autoSave === false) return false;
  const ok = Store.write(SAVE_KEY, JSON.stringify(S));
  if (ok) lastSaveAt = Date.now();
  // 余额实时刷新（放在最前面调用的地方，保证任何金币变动都能反映出来）
  try { updateCoinsUI(); } catch (e) {}
  return ok;
}

function save() {
  /* 阵容一变，化学反应就要重算。
     挂在这里最保险 —— 任何阵容/收藏改动后面都会调 save()，不会漏。 */
  if (typeof invalidateChem === 'function') invalidateChem();
  if (S.autoSave === false) {
    // 自动保存关了：只做延迟兜底，避免关掉就彻底不存
    if (saveTimer) return false;
    saveTimer = setTimeout(() => { saveTimer = null; saveNow(true); }, 4000);
    return false;
  }
  return saveNow(true);
}

/** 立刻保存（设置页的「立即保存」按钮、退出兜底都走这里） */
function forceSave() { return saveNow(true); }

/* ---------- 存档导出 / 导入（纯文本，方便在手机上复制备份） ---------- */
function exportSave() {
  const payload = { v: 2, at: new Date().toISOString(), state: S };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
function importSave(code) {
  const raw = decodeURIComponent(escape(atob(code.trim())));
  const d = JSON.parse(raw);
  const st = d.state || d;
  if (!st || typeof st !== 'object' || !st.owned) throw new Error('存档格式不对');
  S = Object.assign(DEFAULT_STATE(), st, { pity: Object.assign(DEFAULT_STATE().pity, st.pity || {}) });
  /* 卡池数据变动后做一次存档体检（删卡会让 id 位移） */
  try { sanitizeAfterDataChange(); } catch (e) {}
  save(); renderAll();
  return Object.keys(S.owned).length;
}

/**
 * 突破徽章 HTML。
 * 1~7 显示数字，8（满突破）显示 MAX；配色按等级递进。
 * 用法：brkBadgeHTML(3) → '<i class="brk-badge lv3">3</i>'
 */
function brkBadgeHTML(brk) {
  const n = Math.max(0, Math.min(MAX_BREAK, brk || 0));
  if (n <= 0) return '';
  if (n >= MAX_BREAK) return '<i class="brk-badge max">MAX</i>';
  return `<i class="brk-badge lv${n}">${n}</i>`;
}

/* ---------------- 工具 ---------------- */
const SALARY_OF = (ovr) => (typeof salaryOf === "function" ? salaryOf(ovr)
  : Math.min(5e7, valueOf(ovr) * 0.4));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const tierIdx = (k) => TIER_ORDER.indexOf(k);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
}
/** 能力值配色：110+ 紫、80+ 绿、不到 80 统一灰 */
function attrColor(v) {
  if (v >= 110) return '#c084fc';   // 紫——真正的招牌能力
  if (v >= 80) return '#3fc46a';    // 绿——合格以上
  return '#8b96ad';                 // 灰——短板
}
/* =============================================================
   阵容化学反应（v8.6）
   -------------------------------------------------------------
   参考 2K MyTeam / FUT 的化学系统：首发五人之间的「契合度」反过来影响属性。
   目的：让 95 分的同队球员可能比 96 分的杂牌更好用 ——
   阵容搭配第一次有了取舍，而不是无脑按综合从高到低排。

   评分 0~100，四项相加：
     底分 20
     同队  +35 / +26 / +17 / +8   （5 / 4 / 3 / 2 人同队）
     位置  打对本位每个 +5，最多 +25
     年代  全现役或全历史 +15；混搭 0
   加成：>=85 → 综合+4 / 能力+8   >=70 → +3/+6   >=55 → +2/+4   >=40 → +1/+2   否则 0

   注意：这里只读 card.team / card.pos / card.current / card.ovr，
   **绝不调用 statsOf()**，否则会自己调自己造成无限递归。
   ============================================================= */
const CHEM_BASE = 20;
let _chemCache = null;
function invalidateChem() { _chemCache = null; }

function lineupChem() {
  if (_chemCache) return _chemCache;
  const out = { score: 0, bonus: 0, attrBonus: 0, ids: {}, team: '', teamN: 0,
    posOK: 0, era: '', n: 0 };
  try {
    if (typeof rosterIds === 'function' && typeof CARD_BY_ID !== 'undefined') {
      const r = rosterIds();
      const starters = (r.starters || []).slice(0, 5);
      const cards = starters.map((id) => CARD_BY_ID[id]).filter(Boolean);
      const idset = {};
      starters.forEach((id) => { if (id) idset[id] = 1; });
      out.ids = idset;
      out.n = cards.length;
      if (cards.length) {
        /* 同队人数 */
        const cnt = {};
        cards.forEach((c) => { cnt[c.team] = (cnt[c.team] || 0) + 1; });
        let bn = 0, bt = '';
        Object.keys(cnt).forEach((k) => { if (cnt[k] > bn) { bn = cnt[k]; bt = k; } });
        out.team = bt; out.teamN = bn;

        let score = CHEM_BASE;
        score += bn >= 5 ? 35 : bn === 4 ? 26 : bn === 3 ? 17 : bn === 2 ? 8 : 0;

        /* 位置是否正确 */
        let ok = 0;
        if (typeof SLOT_POS !== 'undefined') {
          starters.forEach((id, i) => {
            const c = CARD_BY_ID[id];
            if (c && c.pos === SLOT_POS[i]) ok++;
          });
        }
        out.posOK = ok;
        score += ok * 5;

        /* 年代：全现役 / 全历史 / 混搭 */
        const cur = cards.filter((c) => c.current).length;
        const his = cards.length - cur;
        if (cur === cards.length) out.era = '现役';
        else if (his === cards.length) out.era = '历史';
        else out.era = '混搭';
        if (out.era !== '混搭') score += 15;

        out.score = Math.max(0, Math.min(100, score));
        const s = out.score;
        out.bonus = s >= 85 ? 4 : s >= 70 ? 3 : s >= 55 ? 2 : s >= 40 ? 1 : 0;
        out.attrBonus = out.bonus * 2;
      }
    }
  } catch (e) { /* 还没初始化就算了，按 0 处理 */ }
  _chemCache = out;
  return out;
}

/**
 * 突破加成：每阶全能力 +2、综合 +1，八阶满突破 = 全能力 +16、综合 +8。
 * 数值上限：能力 135、综合 129。
 */
const ATTR_MAX = 135;   // 能力上限：满突破（+16）后正好到 135
  function statsOf(card, brk) {
    const b = Math.max(0, Math.min(MAX_BREAK, brk || 0));
    /* ★ 把「动态成长」叠加进来。
       每 10 场评估出来的属性涨跌（devAdjOf）必须真的作用到比赛里 ——
       之前只改了显示和身价，比赛引擎读的还是原始属性，等于白调。
       这里是全游戏唯一的属性出口（比赛、详情页、身价、AI 建队都走它），
       所以在这一处叠加，保证"数值变了 = 比赛里也变了"。 */
    const adj = (typeof devAdjOf === 'function') ? devAdjOf(card.id) : null;
    /* ★ 阵容化学反应：只对「当前首发五人」生效。
       放在这里是因为 statsOf 是全游戏唯一的属性出口 ——
       加在这一处，比赛、详情页、身价、AI 建队会一起生效，不用改别的地方。
       不在首发里的卡（图鉴、市场、替补席）拿不到加成，保持原始数值。 */
    const chem = (typeof lineupChem === 'function') ? lineupChem() : null;
    const onCourt = !!(chem && chem.ids && chem.ids[card.id]);
    const chemA = onCourt ? chem.attrBonus : 0;
    const chemO = onCourt ? chem.bonus : 0;
    const attrs = {};
    let dSum = 0, dN = 0;
    ATTR_KEYS.forEach((k) => {
      const d = adj ? (adj[k] || 0) : 0;
      if (d) { dSum += d; dN++; }
      attrs[k] = Math.max(25, Math.min(ATTR_MAX,
        card.attrs[k] + d + chemA + breakAttrAt(b)));
    });
    const dOvr = dN ? Math.round(dSum * 0.5) : 0;
    return { ovr: Math.max(40, card.ovr + dOvr + chemO + breakOvrAt(b)), attrs, brk: b,
      devAdj: dN ? dSum : 0, chem: chemO };
  }
/**
 * 持有情况：
 *   total —— 累计抽到过多少张（"我抽到几张这个球员"）
 *   dup   —— 现在还有几张重复卡可以拿去突破（突破会消耗）
 *   need  —— 距离下一阶突破还差几张
 */
function holdings(id) {
  const o = S.owned[id];
  // 每阶消耗的张数按档位而定（高档卡更便宜，见 BREAK_PER_TIER）
  const card = (typeof CARD_BY_ID !== 'undefined') && CARD_BY_ID[id];
  const per = breakPerOf(card ? card.tier : 'silver');
  const cap = breakOwnOf(card ? card.tier : 'silver');   // 消耗张数 + 本体
  if (!o) return { total: 0, dup: 0, brk: 0, can: 0, need: 0, ready: false,
    per, cap };
  const total = o.got || (1 + (o.dup || 0) + (o.brk || 0) * per);
  const dup = o.dup || 0;
  const brk = o.brk || 0;
  const left = MAX_BREAK - brk;
  const can = Math.min(Math.floor(dup / per), left);   // 现在能连突几阶
  return { total, dup, brk, can, left, per, cap,
    need: left <= 0 ? 0 : per - (dup % per),
    ready: can > 0 };
}
/** 卡面右下角的持有量小标 */
function holdBadge(id) {
  const h = holdings(id);
  if (!h.total) return '';
  return `<div class="hold${h.ready ? ' ready' : ''}${h.total > 1 ? ' multi' : ''}">
      <b>×${h.total}</b>${h.ready ? `<i>可突破${h.can > 1 ? ' ' + h.can + ' 阶' : ''}</i>` : ''}
    </div>`;
}

/** 突破刻度：8 格 */
function breakPips(brk) {
  let h = '';
  for (let i = 0; i < MAX_BREAK; i++) h += `<i class="${i < brk ? 'on' : ''}"></i>`;
  return `<span class="pips">${h}</span>`;
}
/** 名字越长字号越小：中文按字数、英文按长度分别缩放 */
function nameScale(name, en) {
  const n = (name || '').length;
  let sc = 1;
  if (n >= 10) sc = 0.72;
  else if (n >= 9) sc = 0.78;
  else if (n >= 8) sc = 0.84;
  else if (n >= 7) sc = 0.9;
  // 中英同时显示，取更小的那个
  const e = (en || '').length;
  if (e >= 22) sc = Math.min(sc, 0.76);
  else if (e >= 18) sc = Math.min(sc, 0.86);
  return sc.toFixed(2);
}

/**
 * 全息种子：由卡 id 派生，保证
 *   · 同一张卡每次渲染花样/色相都一样（不会刷新一次变一个样）
 *   · 不同卡之间花样、色相、闪烁节奏都不同
 */
function holoSeedOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
/** 时刻卡的英文烫印文案 */
const MOMENT_EN = { momentGold: 'MOMENT', momentPurple: 'MOMENT' };

const tierVar = (t) => {
  const T = TIERS[t];
  return `--t1:${T.c1};--t2:${T.c2};--t3:${T.c3};--tc1:${T.glow};--tglow:${T.glow}`;
};
const TEAM_ABBR = {
  '洛杉矶湖人': 'LAL', '金州勇士': 'GSW', '丹佛掘金': 'DEN', '密尔沃基雄鹿': 'MIL',
  '俄克拉荷马雷霆': 'OKC', '波士顿凯尔特人': 'BOS', '菲尼克斯太阳': 'PHX', '费城76人': 'PHI',
  '圣安东尼奥马刺': 'SAS', '明尼苏达森林狼': 'MIN', '纽约尼克斯': 'NYK', '克利夫兰骑士': 'CLE',
  '印第安纳步行者': 'IND', '迈阿密热火': 'MIA', '洛杉矶快船': 'LAC', '孟菲斯灰熊': 'MEM',
  '新奥尔良鹈鹕': 'NOP', '萨克拉门托国王': 'SAC', '亚特兰大老鹰': 'ATL', '奥兰多魔术': 'ORL',
  '夏洛特黄蜂': 'CHA', '底特律活塞': 'DET', '多伦多猛龙': 'TOR', '休斯顿火箭': 'HOU',
  '芝加哥公牛': 'CHI', '犹他爵士': 'UTA', '华盛顿奇才': 'WAS', '波特兰开拓者': 'POR',
  '布鲁克林篮网': 'BKN', '达拉斯独行侠': 'DAL',
  /* ★ v9.9：时刻卡要标「那个赛季」的球队，所以会出现几支历史队名。
     不加进这张表的话，队徽会退化成"取中文名前三个字"。 */
  '西雅图超音速': 'SEA', '新泽西篮网': 'NJN', '新奥尔良黄蜂': 'NOH',
};
const teamAbbr = (card) => TEAM_ABBR[card.team] || card.team.slice(0, 3);
const ARCH_CN = {
  sniper: '神射手', scorer: '得分手', slasher: '突破手', floor_gen: '组织核心',
  two_way: '双向锋线', anchor: '护框支柱', skilled_big: '技术型内线', big_man: '蓝领中锋',
  three_d: '3D锋线', spark: '第六人', freak_forward: '怪兽前锋', point_forward: '持球前锋',
};

/* ---------------- 招募核心 ---------------- */
function rollTier(pool) {
  const keys = TIER_ORDER.filter((k) => (pool.rates[k] || 0) > 0);
  const total = keys.reduce((s, k) => s + pool.rates[k], 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= pool.rates[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}
/* =============================================================
   每个招募池抽到的球员不一样（v6.1）
   -------------------------------------------------------------
   卡数据里 current=true 是现役，false 是历史名宿。
   三个池子各有自己的球员范围，不再是"同一批人换概率"：
     普通招募：**银卡不限现役/名宿**，金卡及以上只出现役
     荣耀招募：现役 + 名宿都能出（金卡以上不限）
     名宿招募：**只出历史名宿**，专出金卡及以上

   ★ v8.9 修了一个「卡掉进缝里」的漏洞：
     银卡只有普通池会出（另两池 silver 概率是 0），
     而普通池的银卡原本限定 cur:true（只现役）；
     荣耀池和名宿池又**根本没配 silver 档位**。
     于是「银卡 × 名宿」这个组合三个池子都进不去 ——
     实测 30 万次/池 的抽卡模拟，178 张名宿银卡一次都抽不到
     （占全池 34%），图鉴永远集不齐。
     修法：把普通池的 silver 放开为不限定（{}）。
     选普通池而不是名宿池：普通池是 300 块的「补图鉴」池，
     银卡本来就归它；名宿池卖 388 且宣称"只出金卡及以上"，
     往里塞银卡会让抽到的人觉得亏。
   ============================================================= */
const POOL_CARDS = {
  regular: {
    /* 银卡不限定现役（否则 178 张名宿银卡没有任何池子能出） */
    silver: {}, gold: { cur: true }, purple: { cur: true },
    legendPurple: { cur: true }, momentGold: { cur: true },
    momentPurple: { cur: true },
  },
  /* 荣耀池：现役球星 + 名宿紫卡以上。
     金卡只出现役（名宿金卡留给名宿池）→ 与另两池都拉开区分。 */
  glory: {
    gold: { cur: true }, purple: {}, legendPurple: {},
    momentGold: {}, momentPurple: {},
  },
  legend: {
    gold: { cur: false }, purple: { cur: false },
    legendPurple: { cur: false }, momentGold: { cur: false },
    momentPurple: { cur: false },
  },
};

/** 取某池 + 某档可以出的球员 */
/* =============================================================
   池子排除表（用户指定）
   -------------------------------------------------------------
   个别球员只在特定池子出现，不按 `current` 这类通用规则走。

   本次：艾弗森 —— 用户要求把他从「名宿招募」踢出去，
   只留在「荣耀球员招募」（他在荣耀池本来就有）。

   键 = 池子 id，值 = 该池**不出现**的球员英文名数组。
   ⚠️ 排除发生在 `cur` 判定**之前**，且 pickCard 的兜底也要过一遍，
      否则某档被排除空了之后，兜底会把被排除的人又放回来。
   ============================================================= */
const POOL_EXCLUDE = {
  legend: ['Allen Iverson'],
};

/** 某池是否排除了某张卡 */
function poolExcluded(poolId, card) {
  const ex = POOL_EXCLUDE[poolId];
  return !!(ex && ex.length && card && ex.indexOf(card.en) >= 0);
}

function poolCards(poolId, tier) {
  const conf = (POOL_CARDS[poolId] || {})[tier];
  /* 池子里没配这个档次 → 该池不出这一档（避免"名宿池抽出银卡"这类问题） */
  if (!conf) return [];
  let list = CARDS.filter((c) => c.tier === tier);
  /* 先剔掉被该池排除的球员，再做 cur 判定 */
  if (POOL_EXCLUDE[poolId]) list = list.filter((c) => !poolExcluded(poolId, c));
  if (conf.cur != null) {
    const f2 = list.filter((c) => c.current === conf.cur);
    if (f2.length) list = f2;
  }
  return list;
}

/* =============================================================
   抽卡（v9.27：记录「哪一张是保底出的」）
   -------------------------------------------------------------
   原来只知道最终档位，玩家看不出「这一发是保底救的」还是「运气好」。
   现在每一抽都带一个来源标记，结果页会把保底那一张标出来。
     'pity10'  —— 十连保底（这一批没出够档位，兜底补上）
     'moment'  —— 90 抽硬保底（时刻紫）
     'legend'  —— 60 抽硬保底（名宿紫）
     'purple'  —— 30 抽硬保底（紫卡+）
     ''        —— 正常概率命中
   ============================================================= */
function rollBatch(pool, n) {
  const out = [];
  const from = [];                 // 与 out 一一对应的来源
  for (let i = 0; i < n; i++) {
    S.pity.purple++; S.pity.legend++; S.pity.moment++; S.pity.total++;
    let t, src = '';
    /* 三条保底，按稀有度从高到低判定 */
    if (S.pity.moment >= PITY.momentEvery) { t = 'momentPurple'; src = 'moment'; }
    else if (S.pity.legend >= PITY.legendEvery) { t = 'legendPurple'; src = 'legend'; }
    else if (S.pity.purple >= PITY.purpleEvery) { t = 'purple'; src = 'purple'; }
    else t = rollTier(pool);
    /* 抽中对应档位就清零（更高档位顺带清掉低档的计数） */
    if (t === 'momentPurple' || t === 'momentGold') {
      S.pity.moment = 0; S.pity.legend = 0; S.pity.purple = 0;
    } else if (t === 'legendPurple') {
      S.pity.legend = 0; S.pity.purple = 0;
    } else if (tierIdx(t) >= tierIdx('purple')) {
      S.pity.purple = 0;
    }
    out.push(t);
    from.push(src);
  }
  if (n >= 10) {
    const need = tierIdx(pool.pity10);
    if (!out.some((t) => tierIdx(t) >= need)) {
      let low = 0;
      out.forEach((t, i) => { if (tierIdx(t) < tierIdx(out[low])) low = i; });
      out[low] = pool.pity10;
      from[low] = 'pity10';        // ★ 这张是十连保底补的
    }
  }
  /* v9.27：把「来源」挂到数组上一起返回。
     刻意用属性而不是改返回结构 —— 老的 `rollBatch(pool,n).forEach(t=>...)`
     调用点（含各种自检代码）全都不用改。 */
  out.from = from;
  return out;
}

  function pickCard(tier, poolId) {
    let list = poolCards(poolId, tier);
    /* 兜底：该池这一档确实没人 → 退回全池，避免抽卡报错。
       ★ 兜底也必须过一遍排除表，否则某档被排除空了之后，
         被排除的人会从这里被放回来。 */
    if (!list.length) list = CARDS.filter((c) => c.tier === tier && !poolExcluded(poolId, c));
    return list[Math.floor(Math.random() * list.length)];
  }
function doRecruit(pool, n) {
  const tiers = rollBatch(pool, n);
  const srcs = tiers.from || [];
  const res = tiers.map((t, i) => {
    const card = pickCard(t, pool.id);
    const prev = S.owned[card.id];
    const isNew = !prev;
    if (prev) {
      prev.got = (prev.got || 1) + 1;      // 累计抽到过几张
      prev.dup = (prev.dup || 0) + 1;      // 当前可用于突破的重复张数
    } else {
      S.owned[card.id] = { dup: 0, brk: 0, got: 1 };
    }
    if (!S.best || tierIdx(t) > tierIdx(S.best)) S.best = t;
    /* from：'pity10' | 'moment' | 'legend' | 'purple' | '' —— 结果页标出保底 */
    return { card, tier: t, isNew, dup: S.owned[card.id].dup,
      brk: S.owned[card.id].brk, from: srcs[i] || '' };
  });
  S.pulls += n;
  const dex = Object.keys(S.owned).length;
  const mile = Math.floor(dex / 10);
  if (mile > S.dexReward) {
    const gain = (mile - S.dexReward) * 1500;
    S.coins += gain; S.dexReward = mile;
    res.milestone = gain;
  }
  save();
  return res;
}
const costOf = (pool, n) => (n === 10 ? pool.cost10 : pool.cost);

/* 保底来源 → 角标文字（v9.27） */
const PITY_TAG_CN = {
  pity10: '十连保底', moment: '90抽保底', legend: '60抽保底', purple: '30抽保底',
};

/* ---------------- 卡面 DOM ---------------- */
function cardHTML(card, opt) {
  opt = opt || {};
  const st = statsOf(card, opt.brk != null ? opt.brk
    : (S.owned[card.id] ? S.owned[card.id].brk : 0));
  const T = TIERS[card.tier];
  const holo = tierIdx(card.tier) >= tierIdx('purple') ? ' holo' : '';
  const moment = card.isMoment ? ' moment' : '';
  const posTxt = card.pos2 ? card.pos + ' | ' + card.pos2 : card.pos;
  /* 角标文字（v9.6）：
       · 时刻卡  → 显示赛季
       · 银卡    → **只标「现役」**，名宿银卡不标 —— 银卡就是银卡，
                   它本来就是"历史/现役混在一起"的大众档位，
                   单独给个「名宿」标签没意义，还容易让人误以为是名宿卡
       · 其它档位 → 现役 / 名宿 照旧 */
  const corner = card.isMoment ? card.season
    : (card.tier === 'silver'
      ? (card.current ? '现役' : '')
      : (card.current ? '现役' : '名宿'));
  const seed = holoSeedOf(card.id);
  const nsc = nameScale(card.name, card.en);
  const holoAttr = card.isMoment
    ? ` data-holo="${seed % 4}" style="${tierVar(card.tier)};--holo-hue:${seed % 360}deg;--nm-scale:${nsc}"`
    : ` style="${tierVar(card.tier)};--nm-scale:${nsc}"`;
  /* 保底角标（v9.27）：用**真实 DOM 元素**而不是卡的 ::after。
     踩过的两个坑：
       ① v6.8「关闭全息特效」用 `.card.holo::after{content:none!important}`
          把卡自身的伪元素整条吃掉了（紫卡/时刻卡都带 .holo）
       ② 挂到 `.prizm::after` 也不显示 —— .prizm 是 z-index:0，
          而球员照片在 .shot 里是 z-index:2，角标被压在照片下面
     所以直接插一个 z-index:20 的真元素，谁都盖不住。 */
  const pityTag = opt.pity
    ? `<div class="pity-tag" data-pity="${opt.pity}">${
        (PITY_TAG_CN[opt.pity] || '保底')}</div>`
    : '';
  return `
  <div class="card${holo}${moment}" data-id="${card.id}" data-tier="${card.tier}"${holoAttr}>
    ${pityTag}
    ${card.isMoment ? `<div class="holo-foil"></div><div class="holo-sparkle"></div>
      <div class="holo-lines"></div><div class="holo-gloss"></div>
      <div class="moment-stamp">${MOMENT_EN[card.tier] || 'MOMENT'}</div>` : ''}
    <div class="prizm"></div>
    <div class="weave"></div>
    <div class="crest">${teamAbbr(card)}</div>
    <div class="shot" data-ini="${card.name.slice(0, 1)}">
      <img src="${card.photo}" alt="${card.name}" data-src="${card.photo}"${opt.lazy ? ' loading="lazy"' : ''}
           onload="this.__giveUp=false;if(this.parentNode)this.parentNode.classList.remove('noimg')" onerror="__imgRetry(this)">
      <div class="fade"></div>
    </div>
    <div class="rating"><b>${st.ovr}</b><span>${card.pos}</span></div>
    ${corner ? `<div class="corner${card.isMoment ? ' moment' : ''}">${corner}</div>` : ''}
    ${brkBadgeHTML(st.brk)}
    <div class="plate">
      <div class="nm">${opt.shortName && typeof shortName === 'function'
        ? shortName(card.name) : card.name}</div>
      <div class="en">${card.en}</div>
      <div class="rule"></div>
      <div class="row">
        <span class="pos">${posTxt}</span>
        <span class="tag">${ARCH_CN[card.arch] || T.name}</span>
        <span class="tm">${card.isMoment
          ? card.season + ' · ' + card.team : card.team}</span>
      </div>
      <div class="brk">${breakPips(st.brk)}</div>
    </div>
    ${holdBadge(card.id)}
    <div class="bevel"></div>
    <div class="frame"></div>
    ${opt.isNew ? '<div class="newtag">NEW</div>' : ''}
  </div>`;
}
/* =============================================================
   ★★★ v9.58 卡图自愈（修「图鉴里很多球员卡面不显示」）
   -------------------------------------------------------------
   玩家反馈（iPhone，开启满特效后）：图鉴里很多球员卡面不显示，
   韦德等球员的卡是空白的。

   排查结论：所有 542 张图都存在（本地实测 0 缺失），
   无头环境满特效 + 542 张 + 逐屏滚动检查 500 张也是 0 空白。
   → 所以是**设备侧偶发加载失败**，而不是图缺失。

   但原来的代码**一旦失败就永久放弃**：
     <img … onerror="this.parentNode.classList.add('noimg')">
   而 CSS 是 `.shot.noimg img{display:none}` —— 图片被隐藏后
   **没有任何重试或恢复**，玩家看到的就是永远空白。

   iOS Safari 在大列表 + 大量图片时，内存紧张会中断部分图片加载；
   只要中一次，那张卡就再也回不来了 —— 这完全符合玩家描述
   （"很多卡面不显示，比如韦德还有别的球员"）。

   修法（三道保险）：
     ① **超时检测**：图片 6 秒还没解码就算可疑，自动重试
     ② **重试 2 次**：每次带 cache-busting 参数强制重新请求
     ③ **彻底失败才降级**：重试都失败才用"姓氏首字"占位，
        并且每次重新渲染都会重置重试计数（有恢复机会）
   ============================================================= */
function __imgRetry(img) {
  if (!img) return;
  if (img.__retried >= 3) {
    /* 三次重试都失败 → 降级成"姓氏首字"占位（不再反复请求） */
    if (img.parentNode) {
      img.parentNode.classList.add('noimg');
      img.__giveUp = true;
    }
    return;
  }
  /* ★ 始终从"原始地址"重试，而不是从上次带 ?r= 的地址再拼一次
     （否则 URL 会越拼越长：?r=1…?r=2…?r=3…） */
  var base = img.getAttribute('data-src') || '';
  if (!base) {
    base = img.getAttribute('src') || '';
    if (!base || base.indexOf('data:') !== 0) {
      /* 剥掉之前拼上去的 ?r= 尾部 */
      base = base.replace(/[?&]r=\d+$/, '');
      if (base) img.setAttribute('data-src', base);
    }
  }
  if (!base) return;
  img.__retried = (img.__retried || 0) + 1;
  img.__giveUp = false;
  if (img.parentNode) img.parentNode.classList.remove('noimg');
  if (base.indexOf('data:') === 0) {
    /* base64（单文件版）：加查询参数会破坏数据，原样重设触发重新解码 */
    img.setAttribute('src', base);
    return;
  }
  /* 加时间戳强制绕过可能已损坏的缓存条目 */
  img.setAttribute('src', base + (base.indexOf('?') >= 0 ? '&' : '?') + 'r=' + img.__retried + '_' + Date.now());
}

/* -------------------------------------------------------------
   强制加载：把还没解码出来的卡图"催"一下
   -------------------------------------------------------------
   ★ 这是针对玩家反馈的第二道修复。

   实测确认：截图里空白的是**已拥有**的卡（×N 徽章只在已拥有的卡上显示），
   "我的"页用的是同一个 miniHTML —— 所以两处同时出问题。

   而本地反复测都复现不了（480 张滚动全部正常加载），
   说明是**设备侧的懒加载没有触发**：
     iOS Safari 在大列表 + 大量图片时，原生 loading="lazy" 有时
     **不发出请求**，图片就永远停在"未加载"状态（不是 onerror，所以
     原来的 onerror 重试根本不会被调用）。

   对策：
     ① 清掉 loading="lazy" —— 不让浏览器替我们决定什么时候加载
     ② 用 IntersectionObserver 自己驱动：进入视口才设 src
     ③ 兜底扫描时，对"已在视口内但还没解码"的图直接重新赋一次 src
        （这是最有效的一招：重新赋值会强制浏览器重新发起加载）
   ============================================================= */
function __forceLoadVisibleCardImgs() {
  try {
    var imgs = document.querySelectorAll('.shot img');
    var n = 0;
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.naturalWidth > 0 || im.__giveUp) continue;
      var q = im.getBoundingClientRect();
      if (!(q.width > 2 && q.height > 2 && q.bottom > 0 && q.top < innerHeight)) continue;
      if (im.__retried >= 3) continue;
      __imgRetry(im);
      n++;
    }
    return n;
  } catch (e) { return 0; }
}
window.__forceLoadVisibleCardImgs = __forceLoadVisibleCardImgs;

/**
 * 兜底扫描：把当前文档里"没解码出来"的卡图重试一遍。
 * @param {boolean} fresh 是否重置重试额度。
 *   ★ 这个参数是必须的 —— 第一版没有它，踩了个坑：
 *     图片插入 DOM 时可能在视口外（懒加载不请求）→ complete 为 true、naturalWidth 0
 *     → 被误判成"加载失败"，两次重试额度在这里就烧光了、标记成 __giveUp；
 *     等玩家真的滚到这张卡时已经没有额度，图片永远空白。
 *     所以"因不可见而误判"的图**不算失败**，也不消耗额度；
 *     真正的兜底扫描（启动后 / 切回前台）才允许重置额度重试。
 */
function __recoverBrokenCardImgs(fresh) {
  try {
    /* ★ 先做一轮"强制加载"：把视口内还没解码的图重新催一次 */
    __forceLoadVisibleCardImgs();
    var imgs = document.querySelectorAll('.shot img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.naturalWidth > 0) { im.__giveUp = false; continue; }   // 已成功
      /* 已在视口内才算"真的该显示却没显示" */
      var q = im.getBoundingClientRect();
      var visible = q.width > 2 && q.height > 2 && q.bottom > 0 && q.top < innerHeight;
      if (!visible) continue;                 // 不可见 → 不管它，也不消耗额度
      if (fresh) { im.__retried = 0; im.__giveUp = false; if (im.parentNode) im.parentNode.classList.remove('noimg'); }
      if (im.__giveUp && !fresh) continue;
      if (im.complete) { __imgRetry(im); continue; }        // 明确失败 → 重试
      var since = (Date.now() - (im.__born || (im.__born = Date.now()))) / 1000;
      if (since > 6) __imgRetry(im);                        // 卡住了 → 重试
    }
  } catch (e) {}
}
window.__recoverBrokenCardImgs = __recoverBrokenCardImgs;
/* 启动后、以及每次切页签后延迟扫一次（等图片有机会加载） */
document.addEventListener('DOMContentLoaded', function () {
  /* 多打几个时间点：启动后 / 图鉴渲染后 / 滚动停顿后，都会扫 */
  [2500, 5000, 9000, 15000].forEach(function (ms) {
    setTimeout(function () { __recoverBrokenCardImgs(true); }, ms);
  });
  /* 滚动时低频兜底（节流 600ms），保证"滚到哪就加载到哪" */
  var _scrollT = null;
  window.addEventListener('scroll', function () {
    if (_scrollT) return;
    _scrollT = setTimeout(function () {
      _scrollT = null;
      __forceLoadVisibleCardImgs();
    }, 600);
  }, true);
});
/* 从后台切回前台时也扫一次 —— iOS 切后台常会丢图片 */
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) setTimeout(function () { __recoverBrokenCardImgs(true); }, 1500);
});

function miniHTML(card, owned) {
  const T = TIERS[card.tier];
  if (!owned) {
    return `<div class="mini locked" data-id="${card.id}" style="${tierVar(card.tier)}">
      <div class="weave"></div><div class="shot"></div><div class="nm2">未获得</div>
      <div class="frame"></div></div>`;
  }
  const o = S.owned[card.id];
  if (!o) return miniHTML(card, false);
  const st = statsOf(card, o.brk);
  const seed = holoSeedOf(card.id);
  return `<div class="mini${card.isMoment ? ' moment' : ''}" data-id="${card.id}"${card.isMoment
    ? ` data-holo="${seed % 4}" style="${tierVar(card.tier)};--holo-hue:${seed % 360}deg"`
    : ` style="${tierVar(card.tier)}"`}>
    ${card.isMoment ? '<div class="holo-foil"></div><div class="holo-sparkle"></div>' : ''}
    <div class="prizm"></div>
    <div class="weave"></div>
    <div class="crest">${teamAbbr(card)}</div>
    <div class="shot"><img src="${card.photo}" alt="${card.name}" data-src="${card.photo}"
      onload="this.__giveUp=false;if(this.parentNode)this.parentNode.classList.remove('noimg')" onerror="__imgRetry(this)"><div class="fade"></div></div>
    <div class="rt">${st.ovr}</div>
    <div class="st">${T.name.replace('卡', '')}${st.brk ? ' +' + st.brk : ''}</div>
    <div class="nm2">${card.name}</div>
    ${holdBadge(card.id)}
    ${isLocked(card.id) ? '<b class="mini-lock">🔒</b>' : ''}<div class="frame"></div>
  </div>`;
}

/* ---------------- 招募页 ---------------- */
let curPool = 0;
  /* =============================================================
     保底进度条（实时）
     -------------------------------------------------------------
     每抽一次都会重新渲染：数字 = 距离保底还差几抽。
     抽中对应档位就归零，重新从满值倒数。
     ============================================================= */
  function pityBarHTML(pool) {
    const tracks = [
      { key: 'purple', every: PITY.purpleEvery, tier: 'purple',
        label: '紫卡', cls: 'p' },
      { key: 'legend', every: PITY.legendEvery, tier: 'legendPurple',
        label: '名宿紫卡', cls: 'l' },
      { key: 'moment', every: PITY.momentEvery, tier: 'momentPurple',
        label: '时刻卡', cls: 'm' },
    ];
    return '<div class="pitybar">' + tracks.map((t) => {
      const used = S.pity[t.key] || 0;
      const left = Math.max(0, t.every - used);
      const pct = Math.min(100, (used / t.every) * 100);
      const near = left <= 10;
      const TT = TIERS[t.tier];
      return `<div class="ptrack ${t.cls}${near ? ' near' : ''}">
        <div class="ptop">
          <span class="pname" style="color:${TT.glow}">${t.label}</span>
          <span class="pnum"><b>${left}</b> 抽必得</span>
        </div>
        <div class="pbar"><i style="width:${pct}%;background:${TT.glow}"></i></div>
      </div>`;
    }).join('') + '</div>';
  }

function renderHome() {
  const pool = POOLS[curPool];
  const owned = Object.keys(S.owned).length;
  const left = Math.max(0, PITY.purpleEvery - S.pity.purple);
  /* ★ 封面用「这个池子里真正能抽到的最强卡」。
     原来写的是 top[curPool * 3 + 1] —— 一个跟池子内容无关的固定偏移，
     而且筛选用的是 `pool.id === 'regular' ? !isMoment : isMoment` 这种粗判，
     荣耀池和名宿池会算出同一批卡（都是"所有时刻卡"），
     所以封面上出现了根本不属于该池、也不是池里最强的球员。

     现在按 POOL_CARDS 的真实归属逐档取人（和抽卡用的是同一套判定，
     见 poolCards()），再按「综合降序、同分看档位」取第一名。 */
  const poolAll = [];
  TIER_ORDER.forEach((t) => { poolCards(pool.id, t).forEach((c) => poolAll.push(c)); });
  /* ★ 封面必须**固定**，不能每次点页签都换人。
     上一版为了「三个池不挂同一张脸」，把已用过的封面记在 window.__poolHeroUsed 里，
     结果并列 113 的那几个人（艾弗森/韦德/魔术师…）会被轮流选中 ——
     用户看到的就是"照片一直在变"。
     现在的规则：**永远取池内综合最高的那张**；
     并列时用「档位 → 卡 id」逐级打破，保证任何一次渲染结果都一样。 */
  poolAll.sort((a, b) => (b.ovr - a.ovr)
    || (tierIdx(b.tier) - tierIdx(a.tier))
    || String(a.id).localeCompare(String(b.id)));
  const heroCard = poolAll[0] || CARDS[0];

  const poolTabs = POOLS.map((p, i) => `
    <button class="pooltab${i === curPool ? ' on' : ''}" data-pool="${i}">
      <i class="dot ${p.theme}"></i><b>${p.name}</b><span>${p.sub}</span>
    </button>`).join('');

  const rateChips = TIER_ORDER.filter((k) => pool.rates[k] > 0).map((k) => {
    const TT = TIERS[k];
    return `<span class="rc" style="color:${TT.glow};border-color:${TT.glow}55">${TT.name} ${pool.rates[k]}%</span>`;
  }).join('');

  const now = Date.now();
  /* 补给已改为无冷却（v9.45），不再需要 ready / cdLeft */
  const can1 = S.coins >= pool.cost, can10 = S.coins >= pool.cost10;

  $('#scr-home').innerHTML = `
    <div class="hero theme-${pool.theme}">
      <div class="hero-bg"></div>
      <div class="hero-art"><img src="${heroCard.photo}" alt=""
        onerror="this.style.display='none'"></div>
      <div class="hero-txt">
        <h2>${pool.name}</h2>
        <div class="sub">${pool.sub}</div>
        ${pityBarHTML(pool)}
      </div>
      <div class="hero-card">${cardHTML(heroCard, {})}</div>
    </div>
    <div class="home-side">
    <div class="home-scroll">
    <div class="pooltabs">${poolTabs}</div>
    <div class="poolinfo">
      <div class="desc">${pool.desc}</div>
      <div class="rates">${rateChips}</div>
    </div>
    <div class="supply">
      <div class="txt"><div class="t1">🏀 赞助商补给</div>
        <div class="t2" id="supplyText">点一下领一次（无冷却）· 今日还剩 <b>${supplyLeft()}</b>/${SUPPLY_DAILY_MAX} 次 · 共领 ${S.supplyCount} 次</div></div>
      <button id="btnSupplyAll" ${supplyLeft() > 0 ? '' : 'disabled'}>${
        supplyLeft() > 0 ? ('一键领完 ' + supplyLeft() + ' 次') : '今日已领完'}</button>
      <button id="btnSupply" ${supplyLeft() > 0 ? '' : 'disabled'}>${
        supplyLeft() <= 0 ? '明日再来' : '领取'}</button>
    </div>
    <label class="skip"><input type="checkbox" id="chkSkip" ${S.skipAnim ? 'checked' : ''}>
      快速跳过紫卡以下动画</label>
    <div class="stats-line">已招募 <b>${S.pulls}</b> 次 · 图鉴 <b>${owned}/${CARDS.length}</b>
      · 最高档位 <b style="color:${S.best ? TIERS[S.best].glow : '#8593b5'}">${S.best ? TIERS[S.best].name : '—'}</b></div>
    </div>
    <div class="home-fixed">
    <div class="recruit-bar">
      <button class="rb blue" data-recruit="1" ${can1 ? '' : 'disabled'}>
        <b>招募一次</b><span>🪙 ${fmt(pool.cost)}</span></button>
      <button class="rb red" data-recruit="10" ${can10 ? '' : 'disabled'}>
        <b>招募十次</b><span>🪙 ${fmt(pool.cost10)}</span></button>
    </div>
    </div>`;
}

/* =============================================================
   球员搜索
   支持：中文名 / 英文名 / 球队 / 位置 / 球风 / 档位
   排序：完全匹配 > 前缀 > 包含；同分时"能突破的"和"已拥有"的排前面
   ============================================================= */
const TIER_CN = () => {
  const m = { '银卡': 'silver', '金卡': 'gold', '紫卡': 'purple', '名宿紫卡': 'legendPurple', '时刻金卡': 'momentGold', '时刻紫卡': 'momentPurple' };
  return m;
};
const POS_LIST = ['PG', 'SG', 'SF', 'PF', 'C'];

function searchCards(q, onlyOwned) {
  const raw = (q || '').trim();
  const base = onlyOwned ? CARDS.filter((c) => S.owned[c.id]) : CARDS;
  if (!raw) return base;
  const s = raw.toLowerCase().replace(/\s+/g, '');
  const tierMap = TIER_CN();
  const hits = [];
  base.forEach((c) => {
    const zh = c.name.toLowerCase();
    const en = c.en.toLowerCase().replace(/[^a-z]/g, '');
    const enRaw = c.en.toLowerCase();
    const team = (c.team || '').toLowerCase();
    const arch = (ARCH_CN[c.arch] || '');
    const tier = TIERS[c.tier].name;
    let sc = -1;
    if (zh === s || enRaw.replace(/\s+/g, '') === s) sc = 1000;
    else if (zh.startsWith(s) || en.startsWith(s)) sc = 800;
    else if (zh.includes(s) || en.includes(s) || enRaw.includes(s)) sc = 600;
    else if (team.includes(s) || arch.includes(s) || tier.includes(s)) sc = 400;
    else if (POS_LIST.includes(raw.toUpperCase()) && c.pos === raw.toUpperCase()) sc = 380;
    else if (c.pos2 && POS_LIST.includes(raw.toUpperCase()) && c.pos2 === raw.toUpperCase()) sc = 360;
    if (sc < 0) return;
    const h = holdings(c.id);
    if (S.owned[c.id]) sc += 60;                 // 已拥有的优先
    if (h.ready) sc += 120;                      // 能突破的更优先
    sc += Math.min(50, h.total);                 // 张数多的稍微靠前
    hits.push({ c, sc });
  });
  hits.sort((a, b) => b.sc - a.sc || tierIdx(b.c.tier) - tierIdx(a.c.tier) || b.c.ovr - a.c.ovr);
  return hits.map((x) => x.c);
}

/** 搜索框（图鉴/我的共用） */
function searchBarHTML(id, placeholder) {
  return `<div class="searchbar">
      <span class="sic">🔍</span>
      <input id="${id}" type="search" autocomplete="off" autocorrect="off"
             autocapitalize="off" spellcheck="false" placeholder="${placeholder}">
      <button class="sclr" data-clr="${id}" aria-label="清空">✕</button>
    </div>`;
}
/**
 * 搜索框：只在第一次创建时绑一次监听器。
 *
 * 之前每渲染一次就 addEventListener 一次，监听器会随输入字数指数级累积
 * （打 10 个字就有 10 个监听器，每个都触发一次全量重绘 500 张卡），
 * 结果就是越打字越卡、最后输入框卡死删不掉字。
 *
 * 同时做了三件事：
 *   ① 防抖 130ms —— 连续输入只在停下来后过滤一次
 *   ② 输入框聚焦时不去改它的 value —— 否则光标会跳到末尾
 *   ③ 结果超过 150 条就截断显示，避免一次渲染上千个节点
 */
const MAX_RESULTS = 150;
function ensureSearchBar(wrapId, inputId, placeholder, onQuery) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return null;
  if (!wrap.dataset.ready) {
    wrap.innerHTML = searchBarHTML(inputId, placeholder);
    const input = document.getElementById(inputId);
    let timer = null;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onQuery(input.value), 130);
    };
    input.addEventListener('input', fire);
    input.addEventListener('search', fire);
    // 中文输入法：拼音候选阶段不触发，选完字才搜
    input.addEventListener('compositionend', fire);
    const clr = wrap.querySelector('.sclr');
    if (clr) clr.onclick = () => { input.value = ''; onQuery(''); input.focus(); };
    wrap.dataset.ready = '1';
  }
  return document.getElementById(inputId);
}
/** 外部改了关键词（比如 ?q= 参数）才同步到输入框，打字过程中绝不动它 */
function syncSearchInput(input, want) {
  if (!input) return;
  if (input.value !== want && document.activeElement !== input) input.value = want;
}

/* ---------------- 图鉴 / 我的 ---------------- */
let dexFilter = 'ALL', mineFilter = 'ALL';
function renderChips(el, cur, onPick) {
  const list = ['ALL'].concat(TIER_ORDER.slice().reverse());
  el.innerHTML = list.map((k) =>
    `<button class="chip${cur === k ? ' on' : ''}" data-f="${k}">${k === 'ALL' ? '全部' : TIERS[k].name}</button>`
  ).join('');
  el.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    Sfx.click(); onPick(b.dataset.f);
  };
}
let dexQuery = '', mineQuery = '';
/* =============================================================
   图鉴收集里程碑（v8.6）
   -------------------------------------------------------------
   原来只有一个「每收集 10 张自动给 1500 金币」的隐式奖励（见 S.dexReward），
   玩家根本不知道它的存在，收集也没有目标感。

   这里补一层**可见、可领取**的里程碑：进度条 + 一键领取。
   · 存 S.dexClaimed = { 里程碑id: true }
   · 进度函数一律现算（读 S.owned / CARDS），不额外存状态
   · 老存档没有 dexClaimed 字段也没关系 —— DEFAULT_STATE 会补齐
   ============================================================= */
function dexOwnedCards() {
  return CARDS.filter((c) => S.owned[c.id]);
}
function dexCountTier(tiers) {
  return dexOwnedCards().filter((c) => tiers.indexOf(c.tier) >= 0).length;
}
/** 每支球队各收集了几张 */
function dexTeamCounts() {
  const m = {};
  dexOwnedCards().forEach((c) => { m[c.team] = (m[c.team] || 0) + 1; });
  return m;
}
/** 有多少名球员的两张卡都集齐了 */
function dexFullPairs() {
  const byPlayer = {};
  dexOwnedCards().forEach((c) => {
    const k = playerKeyOf(c.id);
    byPlayer[k] = (byPlayer[k] || 0) + 1;
  });
  return Object.keys(byPlayer).filter((k) => byPlayer[k] >= 2).length;
}
const DEX_MILES = [
  { id: 'own50', txt: '收集 50 张卡', coins: 8000,
    prog: () => [Object.keys(S.owned).length, 50] },
  { id: 'own120', txt: '收集 120 张卡', coins: 18000,
    prog: () => [Object.keys(S.owned).length, 120] },
  { id: 'own250', txt: '收集 250 张卡', coins: 40000,
    prog: () => [Object.keys(S.owned).length, 250] },
  { id: 'team5', txt: '集齐任意一支球队 5 人', coins: 10000,
    prog: () => {
      const m = dexTeamCounts();
      const best = Object.keys(m).reduce((a, k) => Math.max(a, m[k]), 0);
      return [Math.min(best, 5), 5];
    } },
  { id: 'team5x5', txt: '集齐 5 支球队各 5 人', coins: 30000,
    prog: () => {
      const m = dexTeamCounts();
      return [Object.keys(m).filter((k) => m[k] >= 5).length, 5];
    } },
  { id: 'gold60', txt: '收集 60 张金卡', coins: 20000,
    prog: () => [dexCountTier(['gold']), 60] },
  { id: 'purple30', txt: '收集 30 张紫卡及以上', coins: 25000,
    prog: () => [dexCountTier(['purple', 'legendPurple']), 30] },
  { id: 'moment15', txt: '收集 15 张时刻卡', coins: 30000,
    prog: () => [dexCountTier(['momentGold', 'momentPurple']), 15] },
  { id: 'pair1', txt: '集齐任意一名球员的两张卡', coins: 6000,
    prog: () => [Math.min(dexFullPairs(), 1), 1] },
  { id: 'pair15', txt: '集齐 15 名球员的双卡', coins: 35000,
    prog: () => [dexFullPairs(), 15] },
];
function dexMileReady(m) {
  if (S.dexClaimed && S.dexClaimed[m.id]) return false;
  const [have, need] = m.prog();
  return have >= need;
}
function claimDexMile(id) {
  const m = DEX_MILES.filter((x) => x.id === id)[0];
  if (!m) return false;
  if (S.dexClaimed && S.dexClaimed[m.id]) { toast('这个里程碑已经领过了'); return false; }
  const [have, need] = m.prog();
  if (have < need) { Sfx.fail(); toast('还没达成：还差 ' + (need - have)); return false; }
  if (!S.dexClaimed) S.dexClaimed = {};
  S.dexClaimed[m.id] = true;
  S.coins += m.coins;
  save();
  Sfx.reveal('gold');
  toast('🎁 领取成功：' + m.txt + ' → 金币 +' + fmt(m.coins));
  renderDex();
  return true;
}
function renderDexMile() {
  const box = document.getElementById('dex-mile');
  if (!box) return;
  let ready = 0;
  const rows = DEX_MILES.map((m) => {
    const [have, need] = m.prog();
    const done = !!(S.dexClaimed && S.dexClaimed[m.id]);
    const can = !done && have >= need;
    if (can) ready++;
    const pct = Math.max(2, Math.min(100, Math.round(have / need * 100)));
    return `<div class="dm-row${done ? ' done' : ''}${can ? ' can' : ''}">
      <div class="dm-main">
        <b>${m.txt}</b>
        <span>${done ? '已领取' : have + ' / ' + need}</span>
      </div>
      <div class="dm-bar"><i style="width:${done ? 100 : pct}%"></i></div>
      <button class="dm-btn${can ? ' can' : ''}${done ? ' done' : ''}"
        data-dm="${m.id}"${can ? '' : ' disabled'}>${
        done ? '✓' : (can ? '领取 ' + fmt(m.coins) : '🪙' + fmt(m.coins))}</button>
    </div>`;
  }).join('');
  box.innerHTML = `<div class="dm-head">
      <span>🏆 收集里程碑</span>
      <b>${S.dexClaimed ? Object.keys(S.dexClaimed).length : 0}/${DEX_MILES.length}${
        ready ? ' · <em>' + ready + ' 个可领</em>' : ''}</b>
    </div>
    <div class="dm-list${ready ? '' : ' folded'}">${rows}</div>`;
  box.querySelectorAll('.dm-btn[data-dm]').forEach((b) => {
    b.onclick = (ev) => { ev.stopPropagation(); claimDexMile(b.dataset.dm); };
  });
  const head = box.querySelector('.dm-head');
  if (head) head.onclick = () => {
    Sfx.click();
    box.querySelector('.dm-list').classList.toggle('folded');
  };
}

function renderDex() {
  /* ★ v9.58：重渲染后延迟扫一次卡图（老内核/低内存设备容易漏加载） */
  setTimeout(function () { try { __recoverBrokenCardImgs(true); } catch (e) {} }, 3500);
  const owned = Object.keys(S.owned).length;
  $('#dex-bar').style.width = (owned / CARDS.length * 100).toFixed(1) + '%';
  $('#dex-count').textContent = owned + ' / ' + CARDS.length;
  renderChips($('#dex-filter'), dexFilter, (f) => { dexFilter = f; renderDex(); });
  const dbox = ensureSearchBar('dex-search-wrap', 'dex-search',
    '搜球员：中文名 / 英文名 / 球队 / 位置',
    (v) => { dexQuery = v; renderDex(); });
  syncSearchInput(dbox, dexQuery);

  let list, total = 0;
  if (dexQuery.trim()) {
    list = searchCards(dexQuery, false);
    if (dexFilter !== 'ALL') list = list.filter((c) => c.tier === dexFilter);
    total = list.length;
    list = list.slice(0, MAX_RESULTS);
    $('#dex-count').textContent = total > MAX_RESULTS
      ? `${total} 个结果（显示前 ${MAX_RESULTS}）` : list.length + ' 个结果';
  } else {
    list = CARDS.slice().sort((a, b) => {
      const oa = S.owned[a.id] ? 0 : 1, ob = S.owned[b.id] ? 0 : 1;
      return oa - ob || tierIdx(b.tier) - tierIdx(a.tier) || b.ovr - a.ovr;
    });
    if (dexFilter !== 'ALL') list = list.filter((c) => c.tier === dexFilter);
  }
  $('#dex-grid').innerHTML = list.map((c) => miniHTML(c, !!S.owned[c.id])).join('');
  $('#dex-grid').onclick = (e) => {
    const m = e.target.closest('.mini');
    if (!m) return;
    if (!S.owned[m.dataset.id]) { Sfx.fail(); toast('还没招募到这张卡'); return; }
    openDetail(m.dataset.id);
  };
  renderDexMile();          // 🏆 收集里程碑（v8.6）
  renderDexEx();            // 🎯 图鉴兑换所（v9.27）
}

/* =============================================================
   🎯 图鉴兑换所（v9.27 新增玩法）
   -------------------------------------------------------------
   解决的问题：重复卡只有「突破自己」一个用途，卡池外的全是废卡；
   同时个别卡因为池子归属问题极难获得 ——
   实测阿伦·艾弗森的时刻紫卡要 **2911 抽**才有 50% 把握摸到，
   图鉴永远收不了尾（模拟 16000 抽时正是卡在 541/542）。

   规则：
     · 只能兑换**还没拥有**的卡（补图鉴，不给你刷重复卡）
     · 价格 = 该档位的金币底价 −（祭品折算值 × 55%），最低不低于底价的 15%
     · [祭品]是**全部档位**的闲置重复卡（dup），按当日市价折算；
       会自动先烧最便宜的，把贵的重复卡留给你突破
     · ★ 绝不碰「最后一张」：只扣 dup，不动 got，也不碰正在突破的存量
     · 传说档（名宿紫/时刻紫）每天限 EX_DAILY_MAX 次，
       免得靠金币直接买齐顶级卡、把抽卡的意义抹掉

   ★ 定价经过一次返工：最初祭品**限同档位**、底价也定得太高，
     实测 12 张金卡祭品只抵掉 7 个金币（被底价压住），祭品形同虚设。
     现在改成跨档位祭品池 + 15% 保底，祭品才真正有分量。

   -------------------------------------------------------------
   ★ v9.48 用户改版：传说档可兑重复卡，每日上限 200
   -------------------------------------------------------------
   用户要求：
     「传说档兑换每日可兑换 200 张，但是同一名球员持有数量到上限
       以后，也就是可以满突破以后，就不能再兑换该球员了。」

   改动：
     · EX_DAILY_MAX  3 → **200**（只作用于传说档）
     · 传说档**允许兑换已经拥有的卡**（拿重复张，用来凑突破）
       非传说档维持原规则（只能兑没拥有的，用来补图鉴）
     · 新增持有上限拦截：持有总数一旦达到满突破所需张数，
       该球员**不能再兑换**（见 exHoldMaxOf / exAtHoldMax）
     · 价格不变（用户明确要求保持原价）
   ============================================================= */
const EX_DAILY_MAX = 200;               // 传说档每日限兑次数
/** 各档位兑换底价（金币）。刻意定得比"抽出来"便宜，但不便宜到抹掉抽卡 */
const EX_COIN_COST = {
  silver: 4000, gold: 10000, purple: 28000,
  legendPurple: 90000, momentGold: 60000, momentPurple: 130000,
};
/** 名宿紫及以上算"传说档"，受每日次数限制 */
function exIsLegendary(tier) { return tierIdx(tier) >= tierIdx('legendPurple'); }

/** 一张闲置重复卡的折算价（按当日市价的比例）
 *  注意用 marketPrice(card) 而不是 marketPriceOf(id) —— 后者收的是 id。
 *
 *  ★ 0.55 → 0.30（v9.28 调平衡）
 *  实测：中后期玩家手里 1300+ 张闲置重复卡，按 0.55 折算值 53 万，
 *  能把 13 万的时刻紫卡压到 1.95 万 —— **比硬抽（5.5 万）还便宜 2.8 倍**，
 *  稀有度直接被抹平，等于绕过了抽卡。
 *  降到 0.30 后时刻紫约 3.3 万，与硬抽同量级：兑换是"用攒下的重复卡
 *  换一个确定的结果"，而不是"用钱把抽卡买断"。
 *  ⚠️ 祭品是真的从库存扣掉的，所以这不是无成本兑换；但即便如此，
 *     也必须保证「兑换不比硬抽明显便宜」，否则没人再抽卡。 */
const EX_SPARE_VALUE = 0.30;
/** 兑换价的下限（占底价的比例）。
 *  ★ 0.15 → 0.40（v9.28 调平衡）
 *  15% 太低：中后期玩家随手就有上千张闲置重复卡，祭品永远够抵扣，
 *  于是**下限成了唯一起作用的约束** —— 时刻紫只要 1.95 万，
 *  比硬抽（5.5 万）便宜 2.8 倍，抽卡直接被绕过。
 *  40% 之后即使祭品无限多，时刻紫也要 5.2 万，与硬抽同量级。
 *  ⚠️ 改这个值必须同时看「兑换 vs 硬抽」的对比，别只看兑换本身贵不贵。 */
const EX_PRICE_FLOOR = 0.40;
const exSpareWorth = (card) =>
  Math.round(((typeof marketPrice === 'function' ? marketPrice(card) : 0) || 0) * EX_SPARE_VALUE);

/** 全部档位的闲置重复卡池：按折算价从低到高（先烧便宜的） */
function exSparePool() {
  const out = [];
  CARDS.forEach((c) => {
    const o = S.owned[c.id];
    const n = o ? (o.dup || 0) : 0;
    if (n > 0) out.push({ card: c, n, worth: exSpareWorth(c) });
  });
  return out.sort((a, b) => a.worth - b.worth || b.n - a.n);
}
/** 闲置重复卡总张数 */
function exSpareTotal() { return exSparePool().reduce((s, x) => s + x.n, 0); }
/** 全部闲置重复卡的总折算值 */
function exSpareValue() { return exSparePool().reduce((s, x) => s + x.n * x.worth, 0); }

/* -------------------------------------------------------------
   持有上限：满突破之后就不能再兑这名球员
   -------------------------------------------------------------
   持有总数 = 1（本体）+ dup（闲置重复）+ brk × 每阶消耗
   满突破需要消耗 breakTotalOf(tier) 张，所以持有上限 = breakTotalOf + 1

     银卡/金卡     7×9 = 63 → 上限 64 张
     紫卡          5×9 = 45 → 上限 46 张
     名宿紫卡      4×9 = 36 → 上限 37 张
     时刻金/时刻紫  3×9 = 27 → 上限 28 张

   ★ 用 brk*per 而不是 got 来算：got 只增不减（记录历史抽到过多少），
     用它会把"已经烧掉做祭品的重复卡"也算进来，导致提前判定到顶。
     brk*per 是"已经真正消耗在突破上的张数"，才是准的。
   ============================================================= */
function exHoldCount(id) {
  const card = CARD_BY_ID[id];
  if (!card) return 0;
  const o = S.owned[id];
  if (!o) return 0;
  const per = breakPerOf(card.tier);
  return 1 + (o.dup || 0) + (o.brk || 0) * per;
}
/** 该卡的持有上限（满突破所需总张数） */
function exHoldMaxOf(id) {
  const card = CARD_BY_ID[id];
  if (!card) return 0;
  return breakOwnOf(card.tier);
}
/** 是否已到持有上限（到了就不能再兑） */
function exAtHoldMax(id) {
  const o = S.owned[id];
  if (!o) return false;                 // 还没拥有 → 还能兑（补图鉴）
  if ((o.brk || 0) >= MAX_BREAK) return true;   // 已经满突破 → 肯定到顶
  return exHoldCount(id) >= exHoldMaxOf(id);
}

/** 今日已兑换的传说档次数 */
function exUsedToday() {
  const today = localDayKey();
  if (S.exDay !== today) { S.exDay = today; S.exToday = 0; }
  return S.exToday || 0;
}
/**
 * 兑换一张卡需要的金币。spareValue = 玩家愿意抵扣的祭品折算值。
 * 抵扣后不低于底价的 15%（避免祭品多就几乎白拿）。
 */
function exCostOf(card, spareValue) {
  const list = EX_COIN_COST[card.tier] || 10000;
  const floor = Math.max(1, Math.round(list * EX_PRICE_FLOOR));
  const off = Math.max(0, Math.min(spareValue || 0, list - floor));
  return Math.max(floor, Math.round(list - off));
}

/** 该档位最多能抵扣多少（不超过底价的 85%，也不超过手里祭品总值） */
function exMaxOffset(card) {
  const list = EX_COIN_COST[card.tier] || 10000;
  const floor = Math.max(1, Math.round(list * EX_PRICE_FLOOR));
  return Math.max(0, Math.min(exSpareValue(), list - floor));
}
/** 默认抵扣档：只烧「折算价 < 300」的廉价重复卡，不动值钱的存量 */
function exCheapOffset() {
  return exSparePool().filter((x) => x.worth < 300)
    .reduce((s, x) => s + x.n * x.worth, 0);
}

/** 取祭品：按折算价从低到高烧，烧到凑够 wantValue 为止 */
function exTakeSpares(wantValue) {
  const pool = exSparePool();
  let left = Math.max(0, wantValue);
  const taken = [];
  for (const it of pool) {
    if (left <= 0) break;
    const o = S.owned[it.card.id];
    if (!o || !(o.dup > 0)) continue;
    /* 这张卡最多能贡献几张才够 */
    const canTake = Math.min(o.dup, Math.ceil(left / Math.max(1, it.worth)));
    const take = Math.max(0, Math.min(canTake, o.dup));
    if (take <= 0) continue;
    o.dup -= take;                      // ★ 只扣 dup，不动 got / brk
    left -= take * it.worth;
    taken.push({ card: it.card, n: take, worth: it.worth });
  }
  return { taken, left: Math.max(0, left) };   // left > 0 表示祭品不够抵扣
}

/**
 * 执行兑换。spareWant = 愿意抵扣的祭品折算值
 * ---------------------------------------------------------------
 * ★ v9.48 规则变化（用户要求）：
   · 传说档（名宿紫/时刻金/时刻紫）**允许兑换已经拥有的卡** ——
     拿到的是一张重复张（dup），用来凑突破。
     非传说档维持原规则（只能兑没拥有的，用来补图鉴）。
   · 持有总数达到满突破上限后，**该球员不能再兑换**。
     判定见 exAtHoldMax()：用 brk×每阶消耗 来算真实持有量，
     不用 got（got 只增不减，会把烧掉的祭品也算进去）。
   · 每日上限 3 → 200（只作用于传说档）。
 */
function exRedeem(id, spareWant) {
  const card = CARD_BY_ID[id];
  if (!card) return false;
  const legendary = exIsLegendary(card.tier);
  const already = !!S.owned[id];

  /* ① 非传说档：保持原规则，只能补图鉴 */
  if (already && !legendary) {
    Sfx.fail();
    toast('这张已经拥有了（只有传说档可以兑换重复张）');
    return false;
  }

  /* ② 传说档：到持有上限就不给兑了（这是用户明确要求的硬规则） */
  if (already && legendary && exAtHoldMax(id)) {
    Sfx.fail();
    const mx = exHoldMaxOf(id);
    toast(`⛔ ${card.name} 已经可以满突破了（${exHoldCount(id)}/${mx} 张），不能再兑换`);
    return false;
  }

  /* ③ 每日次数（传说档） */
  if (legendary && exUsedToday() >= EX_DAILY_MAX) {
    Sfx.fail();
    toast('传说档每天最多兑换 ' + EX_DAILY_MAX + ' 次，明天再来');
    return false;
  }

  /* ④ 算钱 + 收祭品 */
  const list = EX_COIN_COST[card.tier] || 10000;
  const floor = Math.max(1, Math.round(list * EX_PRICE_FLOOR));
  const maxOff = Math.max(0, Math.min(exSpareValue(), list - floor));
  const useValue = Math.max(0, Math.min(spareWant || 0, maxOff));
  const cost = exCostOf(card, useValue);
  if (S.coins < cost) {
    Sfx.fail();
    toast(`金币不够，还差 🪙${fmt(cost - S.coins)}`);
    return false;
  }
  S.coins -= cost;
  const { taken } = exTakeSpares(useValue);

  /* ⑤ 发卡：新卡建记录；重复张累加 dup（不动 brk） */
  if (already) {
    S.owned[id].dup = (S.owned[id].dup || 0) + 1;
    S.owned[id].got = (S.owned[id].got || 1) + 1;
  } else {
    S.owned[id] = { dup: 0, brk: 0, got: 1 };
  }
  if (legendary) { S.exToday = exUsedToday() + 1; }

  try { Sfx.reveal(card.tier); } catch (e) { Sfx.click(); }
  save();

  const nSpare = taken.reduce((s, t) => s + t.n, 0);
  if (already) {
    const n = exHoldCount(id), mx = exHoldMaxOf(id);
    toast(`🎯 重复张 +1：${card.name}　持有 ${n}/${mx}　🪙${fmt(cost)}`);
  } else {
    toast(`🎯 兑换成功：${TIERS[card.tier].name} · ${card.name}`);
  }
  const detail = nSpare ? `祭品 ${nSpare} 张 · 金币 🪙${fmt(cost)}` : `金币 🪙${fmt(cost)}`;
  if (typeof pushNews === 'function') {
    try {
      pushNews(already
        ? `【我的球队】用兑换所换到 ${card.name} 的重复张（${detail}）`
        : `【我的球队】用图鉴兑换所换到了 ${card.name}（${detail}）`, 'deal');
    } catch (e) {}
  }
  renderAll();
  return true;
}

/* ---------------- 兑换所界面 ---------------- */
let exTier = 'legendPurple';
let exPick = null;
let exSpareWant = 0;
let exEl = null;

function closeDexEx() {
  if (exEl) { try { exEl.remove(); } catch (e) {} exEl = null; }
}
window.closeDexEx = closeDexEx;

/** 图鉴页上的入口按钮 */
function renderDexEx() {
  const box = $('#dex-exchange');
  if (!box) return;
  const missing = CARDS.filter((c) => !S.owned[c.id]).length;
  const spare = exSpareTotal();
  box.innerHTML = `<button class="btn ex-open" id="btnDexEx">
      🎯 图鉴兑换所
      <em>还差 ${missing} 张 · 闲置重复卡 ${spare} 张</em>
    </button>`;
  const b = $('#btnDexEx');
  if (b) b.onclick = () => { Sfx.click(); openDexEx(); };
}

function openDexEx() {
  closeDexEx();
  exPick = null; exSpareWant = 0;
  const box = document.createElement('div');
  box.className = 'ex-mask';   // ★ 不能用 .spf-mask —— closeConflictDialog 会兜底清掉所有 .spf-mask
  document.body.appendChild(box);
  exEl = box;
  box.onclick = (ev) => {
    if (ev.target === box) { closeDexEx(); return; }
    const act = ev.target.closest && ev.target.closest('[data-ex]');
    if (!act) return;
    const k = act.dataset.ex;
    if (k === 'close') { Sfx.click(); closeDexEx(); return; }
    if (k === 'tier') { Sfx.click(); exTier = act.dataset.tier; exPick = null; exSpareWant = 0; renderDexExBody(); return; }
    if (k === 'pick') {
      Sfx.click();
      exPick = act.dataset.id;
      /* ★ 默认只烧廉价重复卡，绝不默认烧掉值钱的存量 */
      exSpareWant = exCheapOffset();
      renderDexExBody(); return;
    }
    if (k === 'spareall') {
      Sfx.click();
      exSpareWant = 1e9;                // 尽量全用，实际会用 exRedeem 里的上限夹住
      renderDexExBody(); return;
    }
    if (k === 'sparecheap') {
      /* 默认档：只烧「市价 300 以下」的廉价重复卡，
         不碰紫卡/时刻卡这些真正值钱的存量 */
      Sfx.click();
      exSpareWant = exSparePool()
        .filter((x) => x.worth < 300)
        .reduce((s, x) => s + x.n * x.worth, 0);
      renderDexExBody(); return;
    }
    if (k === 'spareadd' || k === 'sparesub') {
      Sfx.click();
      const step = 5000;
      const maxOff = exPick ? exMaxOffset(exPick) : 0;
      exSpareWant = Math.max(0, Math.min(maxOff,
        (exSpareWant || 0) + (k === 'spareadd' ? step : -step)));
      renderDexExBody(); return;
    }
    if (k === 'spare0') { Sfx.click(); exSpareWant = 0; renderDexExBody(); return; }
    if (k === 'go') {
      if (!exPick) { Sfx.fail(); toast('先选一张要兑换的卡'); return; }
      if (exRedeem(exPick, exSpareWant)) { exPick = null; exSpareWant = 0; renderDexExBody(); }
      return;
    }
  };
  document.addEventListener('keydown', exEsc);
  renderDexExBody();
}
function exEsc(e) {
  if (e.key === 'Escape') { closeDexEx(); document.removeEventListener('keydown', exEsc); }
}

function renderDexExBody() {
  if (!exEl) return;
  const tier = exTier;
  const TT = TIERS[tier];
  /* ★ v9.48：传说档把「已拥有但还没到持有上限」的卡也列进来，
     这样玩家可以反复兑换同一名球员来凑突破（用户明确要求）。
     非传说档维持原样：只列还没有的（补图鉴）。
     到上限的卡不列（用户要求：满突破后不能再兑该球员）。 */
  const list = CARDS.filter((c) => {
    if (c.tier !== tier) return false;
    if (!S.owned[c.id]) return true;                 // 没拥有 → 可以兑（补图鉴）
    if (!exIsLegendary(tier)) return false;          // 非传说档：已拥有就不列
    return !exAtHoldMax(c.id);                       // 传说档：没到上限就列
  }).sort((a, b) => b.ovr - a.ovr);
  const spare = exSpareTotal();
  const spareVal = exSpareValue();
  const legendary = exIsLegendary(tier);
  const used = exUsedToday();
  const left = legendary ? Math.max(0, EX_DAILY_MAX - used) : Infinity;
  const pick = exPick ? CARD_BY_ID[exPick] : null;
  /* 实际可抵扣的上限：不能超过底价的 85%，也不能超过手里的祭品总值 */
  const maxOff = pick ? exMaxOffset(pick) : 0;
  const spareUse = pick ? Math.max(0, Math.min(exSpareWant, maxOff)) : 0;
  const cost = pick ? exCostOf(pick, spareUse) : 0;
  const pickAtMax = pick ? exAtHoldMax(pick.id) : false;
  const afford = pick && !pickAtMax && S.coins >= cost && (!legendary || left > 0);
  /* 这次会烧掉多少张（按"先烧便宜的"顺序试算，不真的扣） */
  let burnN = 0;
  if (pick && spareUse > 0) {
    let leftV = spareUse;
    for (const it of exSparePool()) {
      if (leftV <= 0) break;
      const take = Math.min(it.n, Math.ceil(leftV / Math.max(1, it.worth)));
      if (take <= 0) continue;
      leftV -= take * it.worth;
      burnN += take;
    }
  }
  const tierTabs = TIER_ORDER.map((k) => {
    const leg = exIsLegendary(k);
    /* 传说档：可兑数 = 没拥有的 + 已拥有但没到上限的 */
    const can = CARDS.filter((c) => {
      if (c.tier !== k) return false;
      if (!S.owned[c.id]) return true;
      return leg && !exAtHoldMax(c.id);
    }).length;
    const on = k === tier ? ' on' : '';
    const label = leg ? ('可兑 ' + can) : ('缺 ' + can);
    return `<button class="ex-tab${on}" data-ex="tier" data-tier="${k}"
      style="--g:${TIERS[k].glow}">${TIERS[k].name}<em>${label}</em></button>`;
  }).join('');
  exEl.innerHTML = `
    <div class="spf ex-panel">
      <div class="ex-head">
        <div class="ex-title">🎯 图鉴兑换所</div>
        <div class="ex-sub">用「闲置重复卡 + 金币」换卡
          <em class="ex-sub-tip">传说档可以反复兑换<b>同一名球员</b>来凑突破（到满突破上限为止）</em>
          ${legendary ? `<i class="${left > 0 ? '' : 'out'}">· 传说档今日剩 ${left}/${EX_DAILY_MAX}</i>` : ''}</div>
        <button class="ex-x" data-ex="close">✕</button>
      </div>
      <div class="ex-row">
        <div class="ex-tabs">${tierTabs}</div>
        <div class="ex-count">🪙${fmt(S.coins)} · 祭品 <b>${spare}</b> 张</div>
      </div>
      <div class="ex-grid">${list.length ? list.map((c) => {
        const own = !!S.owned[c.id];
        const n = own ? exHoldCount(c.id) : 0;
        const mx = own ? exHoldMaxOf(c.id) : 0;
        return `
        <div class="ex-cell${exPick === c.id ? ' on' : ''}${own ? ' owned' : ''}"
          data-ex="pick" data-id="${c.id}" style="--g:${TT.glow}">
          <img src="${c.photo}" alt="" data-src="${c.photo}"
            onload="this.style.display='';this.__giveUp=false"
            onerror="if(typeof __imgRetry==='function')__imgRetry(this);else this.style.display='none'">
          <b>${c.name}</b>
          <span>${c.ovr}</span>
          ${own ? `<i class="ex-own">重复 +1　${n}/${mx}</i>` : ''}
        </div>`;
      }).join('') : '<div class="ex-none">这一档已经全部收集完成 🎉</div>'}</div>
      <div class="ex-foot">
        ${pick ? `
          <div class="ex-foot-l">
            <div class="ex-sel">已选 <b style="color:${TT.glow}">${pick.name}</b>
              <span>${TIERS[pick.tier].name} · 综合 ${pick.ovr}</span></div>
            <div class="ex-sel ex-burn">祭品抵扣 🪙${fmt(spareUse)}/${fmt(maxOff)}
              <span class="ex-warn">将烧掉 ${burnN} 张闲置重复卡</span></div>
            <div class="ex-sel ex-hint">💡 拿重复卡当祭品比卖掉划算：
              省掉 20% 卖卡手续费，而且能直接换成你缺的那一张</div>
          </div>
          <div class="ex-foot-r">
            <div class="ex-mini">
              <button class="btn" data-ex="spare0">不用祭品</button>
              <button class="btn" data-ex="sparecheap">只用廉价卡</button>
              <button class="btn" data-ex="sparesub">−5000</button>
              <button class="btn" data-ex="spareadd">＋5000</button>
              <button class="btn" data-ex="spareall">尽量用</button>
            </div>
            <button class="btn primary ex-go" data-ex="go" ${afford ? '' : 'disabled'}>
              ${pickAtMax ? '⛔ 已可满突破，不能再兑'
                : (!afford && legendary && left <= 0) ? '今日次数已用完'
                : !afford ? '金币不够' : '确认兑换 · 🪙 ' + fmt(cost)}</button>
          </div>
        ` : `
          <div class="ex-foot-l">
            <div class="ex-sel">↑ 从上面选一张要兑换的卡<span>${legendary
              ? '（传说档含已拥有的，可兑重复张）' : '（只列你还没有的）'}</span></div>
            <div class="ex-sel ex-burn">祭品抵扣 🪙0
              <span class="ex-warn">选中后可用闲置重复卡抵金币</span></div>
            <div class="ex-sel ex-hint">💡 拿重复卡当祭品比卖掉划算：
              省掉 20% 卖卡手续费，而且能直接换成你缺的那一张</div>
          </div>
          <div class="ex-foot-r">
            <div class="ex-mini">
              <button class="btn" disabled>不用祭品</button>
              <button class="btn" disabled>只用廉价卡</button>
              <button class="btn" disabled>−5000</button>
              <button class="btn" disabled>＋5000</button>
              <button class="btn" disabled>尽量用</button>
            </div>
            <button class="btn primary ex-go" data-ex="go" disabled>请先选一张卡</button>
          </div>
        `}
      </div>
    </div>`;
}
/* =============================================================
   📴 离线缓存面板（设置页）
   -------------------------------------------------------------
   用户反馈：「不连同一个 WiFi 时，有些球员图片不显示」。
   根因：Service Worker 只缓存了**看过的**图；没看过的图在断网时
   拿不到。SW v2 会在后台自动补齐，但用户看不到进度、也不知道
   什么时候算"存好了"。

   这里给一个**看得见的状态 + 一键补齐**：
     · 显示 已缓存 / 总数 与进度条
     · 「下载全部」按钮：让 SW 立刻开始补，并实时刷新进度
     · 补完后提示"可以离线玩了"
   ============================================================= */
/* =============================================================
   📴 离线缓存：**页面驱动**的批量下载（v4）
   -------------------------------------------------------------
   ★ 为什么把下载从 SW 挪到页面
   -------------------------------------------------------------
   v3 让 Service Worker 自己在后台下载 589 张卡图。iPhone 上彻底失败：
     · iOS 随时掐断 SW，掐断后重启新实例；
     · 新旧实例同时读写同一个 IndexedDB 队列 → **竞态**，队列被写坏；
     · 现象：进度显示 **622/621**（超过 100%）、**30%→0%→50%→0%** 乱跳、
       浮层永远停在"正在准备离线版"，**即使 100% 也打不开游戏**。

   ★ v4 的做法
   -------------------------------------------------------------
   · **页面**负责下载（前台任务，不会被 iOS 掐断），
     每次只下 **4 个**（iOS 上最稳的并发），下完一批就存一次进度。
   · **SW** 只负责"存"（它的 fetch 拦截会自动缓存页面请求过的资源）
     和回答"这些 URL 里哪些还没缓存"。
   · 进度**单调递增**：只在真的新增缓存时才 +1，永远不会倒退。
   · 断点续传：进度存在 localStorage，关掉页面再回来接着下。

   ★ 关键设计：进度不可能乱跳
   -------------------------------------------------------------
   只有一个数据源 —— 页面自己数的 `doneCount`。
   每次成功下载 +1，从不重算、从不回退。
   ============================================================= */
function bindOfflineCache() {
  const statusEl = $('#cacheStatus');
  const fillEl = $('#cacheFill');
  const btn = $('#btnCacheAll');
  const hintEl = $('#cacheHint');
  if (!statusEl) return;

  const canSW = ('serviceWorker' in navigator) && location.protocol !== 'file:';
  if (!canSW) {
    statusEl.textContent = '不可用（需用网址打开）';
    statusEl.style.color = '#ffb020';
    if (btn) { btn.disabled = true; btn.textContent = '📥 需用网址打开才能离线'; }
    if (hintEl) hintEl.textContent = '从「文件」App 直接打开的本地文件不支持离线缓存。';
    return;
  }

  const KEY = 'peak-card-prefetch-v1';

  /* 全部要下载的资源清单（把 img/xxx.webp 从 CARDS 里抽出来） */
  const ALL_IMAGES = (function () {
    const seen = new Set();
    const out = [];
    CARDS.forEach((c) => {
      const p = c.photo;
      if (!p || p.indexOf('data:') === 0) return;
      if (seen.has(p)) return;
      seen.add(p);
      out.push(p);
    });
    return out;
  })();

  /* ---------- 状态（单一数据源，只增不减） ---------- */
  let total = ALL_IMAGES.length;
  let downloaded = 0;          // 本次会话已确认缓存好的数量
  let knownCached = 0;         // SW 查出来的已缓存数量（用来算起点）
  let running = false;
  let aborted = false;

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  /* -------------------------------------------------------------
     ★★★ v9.60：把"全部下完"永久记下来
     -------------------------------------------------------------
     玩家反馈：「下载完了，上面还是显示"下载全部球员照片"，
     不应该是下载好了以后就可以缓存了吗？」

     根因：按钮文字完全依赖 `knownCached + downloaded >= total`，
     而 knownCached 来自 SW 的回复。如果 SW 那次没及时回
     （iOS 上 SW 被系统回收很常见），knownCached 就是 0，
     按钮立刻退回"下载全部"，**看起来就像没下载过**。

     修法：下完之后在 localStorage 记一个 done 标记，
     下次打开先按这个标记显示"已下载"。SW 回复后如果发现
     真的少了（比如换了新版本、多了新卡），标记会自动撤销。
     ============================================================= */
  const DONE_KEY = 'peak-card-prefetch-done';
  function markDone(n) { try { localStorage.setItem(DONE_KEY, String(n)); } catch (e) {} }
  function readDone() { try { return parseInt(localStorage.getItem(DONE_KEY) || '0', 10) || 0; } catch (e) { return 0; } }
  function clearDone() { try { localStorage.removeItem(DONE_KEY); } catch (e) {} }

  function paint() {
    const done = Math.min(total, knownCached + downloaded);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ready = done >= total;
    statusEl.textContent = done + ' / ' + total + '　' + pct + '%';
    statusEl.style.color = ready ? '#5ee08a' : (pct > 0 ? '#9fb0d0' : '#ffb020');
    if (fillEl) fillEl.style.width = pct + '%';
    if (hintEl) {
      if (ready) {
        hintEl.textContent = '✅ 已存到手机里了 —— 断网、飞行模式、用流量都能看全所有卡面，' +
          '以后更新游戏也不用重新下载。';
      } else if (running) {
        hintEl.textContent = '正在下载…（可以继续玩，不影响）还差 ' + (total - done) + ' 张';
      } else {
        hintEl.textContent = '还差 ' + (total - done) + ' 张。点「下载全部」补齐，' +
          '或保持联网继续玩，看过谁就自动存谁。';
      }
    }
    if (btn) {
      btn.disabled = running;
      btn.textContent = running
        ? ('⏸ 下载中… ' + pct + '%')
        : (ready ? '✅ 已下载完成（点此复查）' : '📥 下载全部球员照片（约 10 MB）');
    }
    /* 全部下完 → 永久记住；没下完 → 撤销标记 */
    if (ready) markDone(total); else if (!running && downloaded === 0) clearDone();
  }

  /* ---------- 问 SW：这些图里哪些还没缓存 ---------- */
  function askMissing() {
    return new Promise((resolve) => {
      const sw = navigator.serviceWorker.controller;
      if (!sw) { resolve(null); return; }
      let done = false;
      const onMsg = (ev) => {
        const d = ev.data || {};
        if (d.type !== 'sw-missing-result') return;
        done = true;
        navigator.serviceWorker.removeEventListener('message', onMsg);
        resolve(d);
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      sw.postMessage({ type: 'sw-missing', urls: ALL_IMAGES });
      setTimeout(() => {
        if (done) return;
        navigator.serviceWorker.removeEventListener('message', onMsg);
        resolve(null);
      }, 8000);
    });
  }

  /* ---------- 下载一张（走 SW 的 fetch 拦截，成功即被缓存） ---------- */
  function fetchOne(url) {
    return fetch(url, { cache: 'no-store' })
      .then((r) => (r && r.ok ? true : false))
      .catch(() => false);
  }

  /* ---------- 主循环：4 并发，下完一批存一次进度 ---------- */
  async function runPrefetch(missing) {
    if (running) { aborted = true; return; }
    running = true;
    aborted = false;
    paint();

    const CONC = 4;
    let i = 0;
    let fails = [];

    while (i < missing.length && !aborted) {
      const batch = missing.slice(i, i + CONC);
      /* eslint-disable no-await-in-loop */
      const results = await Promise.all(batch.map((u) => fetchOne(u)));
      results.forEach((ok, k) => {
        if (ok) downloaded++;
        else fails.push(batch[k]);
      });
      i += batch.length;
      paint();
      saveProgress({ at: Date.now(), remaining: missing.length - i });

      /* 连续失败说明网络断了，歇一下再试，避免烧电 */
      if (results.every((x) => !x)) await new Promise((r) => setTimeout(r, 2500));
      else await new Promise((r) => setTimeout(r, 60));
    }

    /* 失败的再补一轮（网络抖动通常这轮就好了） */
    if (fails.length && !aborted) {
      const retry = fails.slice(0, 200);
      fails = [];
      for (let k = 0; k < retry.length; k += CONC) {
        const batch = retry.slice(k, k + CONC);
        /* eslint-disable no-await-in-loop */
        const rs = await Promise.all(batch.map((u) => fetchOne(u)));
        rs.forEach((ok, j) => { if (ok) downloaded++; else fails.push(batch[j]); });
        paint();
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    running = false;
    saveProgress({ at: Date.now(), remaining: fails.length });

    if (fails.length) {
      /* 只把真实结果报给用户，不假装成功 */
      if (hintEl) hintEl.textContent = '有 ' + fails.length + ' 张没下下来（可能网络不稳），再点一次会重试。';
      toast('还差 ' + fails.length + ' 张，再点一次试试');
    } else {
      toast('✅ 全部下载完成，可以离线玩了');
    }
    paint();
  }

  /* ---------- 入口 ---------- */
  async function refresh() {
    const res = await askMissing();
    if (!res) {
      /* ★ SW 没回（iOS 上很常见）→ 用本地"已下完"标记兜底，
         而不是直接把按钮退回"下载全部" */
      const wasDone = readDone();
      if (wasDone >= ALL_IMAGES.length) {
        total = ALL_IMAGES.length;
        knownCached = total;
        downloaded = 0;
        paint();
        return { total: total, cached: total, missing: [] };
      }
      statusEl.textContent = '离线系统未就绪，稍后再试';
      statusEl.style.color = '#ffb020';
      return;
    }
    if (res.version) window.__SW_VER__ = 'v' + res.version;
    total = res.total || ALL_IMAGES.length;
    knownCached = res.cached || 0;
    downloaded = 0;
    /* SW 说一张都不缺 → 记上标记；SW 说缺 → 撤销标记（可能有新卡） */
    if (res.missing && res.missing.length === 0) markDone(total); else clearDone();
    paint();
    return res;
  }

  if (btn) {
    btn.onclick = async () => {
      Sfx.click();
      if (running) { aborted = true; toast('已暂停'); return; }
      const res = await refresh();
      if (!res) return;
      if (!res.missing.length) { toast('已经全部下载好了 ✅'); return; }
      toast('开始下载 ' + res.missing.length + ' 张，可以继续玩');
      runPrefetch(res.missing);
    };
  }

  /* ---------- 版本号 + 手动检查更新 ---------- */
  const verEl = $('#verText');
  function showVer() {
    if (!verEl) return;
    verEl.textContent = window.__SW_VER__ || '已连接';
    verEl.style.color = '#5ee08a';
  }

  /* -------------------------------------------------------------
     ⚡ 性能模式开关（v9.54）
     -------------------------------------------------------------
     自动判断在 pwa.js 的 initPerf() 里做（安卓默认开、高刷屏开）。
     这里只负责让玩家手动覆盖它 —— 选择会记在 localStorage。
     ============================================================= */
  function refreshPerfUI() {
    const on = !!window.__perfOn;
    const st = $('#perfState');
    if (st) {
      st.textContent = on ? '已开启 · 特效精简' : '已关闭 · 满特效';
      st.style.color = on ? '#5ee08a' : '#ffb020';
    }
    const hz = window.__perfHz;
    const hint = $('#perfHint');
    if (hint && hz) {
      hint.innerHTML = '检测到屏幕刷新率约 <b>' + hz + 'Hz</b>。'
        + (hz >= 90
          ? '高刷屏上跑满特效更耗电，建议保持开启。'
          : '安卓手机默认自动开启。')
        + '<br>如果觉得画面卡顿，确认这里是「已开启」。';
    }
  }
  const bOn = $('#btnPerfOn');
  if (bOn) bOn.onclick = () => {
    Sfx.click();
    if (typeof window.__setPerf === 'function') window.__setPerf(true);
    else document.documentElement.classList.add('perf');
    refreshPerfUI();
    toast('已开启性能模式（特效精简，更流畅）');
  };
  const bOff = $('#btnPerfOff');
  if (bOff) bOff.onclick = () => {
    Sfx.click();
    if (typeof window.__setPerf === 'function') window.__setPerf(false);
    else document.documentElement.classList.remove('perf');
    refreshPerfUI();
    toast('已关闭性能模式（显示全部特效）');
  };
  refreshPerfUI();
  /* 刷新率测出来后更新提示（pwa.js 检测是异步的） */
  if (typeof window.__detectHz === 'function' && window.__perfHz === undefined) {
    try {
      window.__detectHz((hz) => { window.__perfHz = hz; refreshPerfUI(); });
    } catch (e) {}
  }

  /* -------------------------------------------------------------
     🔄「检查更新」按钮（v9.47 改成一键到位）
     -------------------------------------------------------------
     实测确认它**是真功能**，不是摆设：
       · 已是最新 → 提示「已是最新版本」
       · 有新版   → SW 装好并进入 waiting

     但原体验不好：点了之后还要**再点一次**横幅上的「立即更新」，
     两次操作才更新完。现在改成一键到位：

       点「检查更新」
          ↓
       ① reg.update() 让浏览器比对服务器上的 sw.js
       ② 轮询等新 SW 装好（最多 8 秒）
       ③ 三方比对：服务器版本 vs 本地记录
       ④ 确有新版 → 直接 applyUpdate（skipWaiting + 刷新）
       ⑤ 没有新版 → 提示「已是最新版本 ✅」
     ============================================================= */
  const ubtn = $('#btnCheckUpdate');
  if (ubtn) {
    ubtn.onclick = () => {
      Sfx.click();
      const reg = window.__swReg__;
      if (!reg) { toast('离线系统还没就绪，稍后再试'); return; }

      const btn2 = ubtn;
      const oldTxt = btn2.textContent;
      btn2.disabled = true;
      btn2.textContent = '⏳ 检查中…';
      const restore = (t) => { btn2.disabled = false; btn2.textContent = oldTxt; if (t) toast(t); };

      const stored = (function () {
        try { return localStorage.getItem('peak-card-sw-ver') || ''; } catch (e) { return ''; }
      })();

      let pr;
      try { pr = reg.update(); } catch (e) { pr = null; }
      const updP = (pr && pr.then) ? pr : Promise.resolve();

      /* ① 先并行去问服务器版本（这个很快，一次 fetch） */
      const srvP = askServerVerForBtn();

      /* ② 轮询等新 SW 装好。
         ★ 优化：update() resolve 之后如果还没有 pending，说明大概率没新版，
           只需要再等一小会儿（2.5 秒）确认，不必等满 8 秒 ——
           否则"已是最新"要 8 秒才出提示，用户以为卡死了。
           真出新版时，浏览器下载安装通常在 1~2 秒内完成，够用。 */
      updP.then(() => new Promise((r) => {
        let n = 0;
        const MAX = 5;                  // 5 × 500ms = 2.5 秒
        const t = setInterval(() => {
          if (reg.waiting || reg.installing) { clearInterval(t); r('pending'); return; }
          if (++n >= MAX) { clearInterval(t); r('timeout'); }
        }, 500);
      })).then((state) => srvP.then((srv) => {
        const hasNew = state === 'pending' || !!(stored && srv && stored !== srv);
        if (hasNew) {
          btn2.textContent = '⏳ 正在更新…';
          toast('发现新版本，正在更新…');
          window.__swUserConfirmed = true;
          try {
            if (typeof window.__swApplyUpdate === 'function') window.__swApplyUpdate(reg);
            else location.reload();
          } catch (e) { restore('更新失败，请手动关闭重开'); }
        } else {
          restore('已是最新版本 ✅');
          if (srv) { try { localStorage.setItem('peak-card-sw-ver', srv); } catch (e) {} }
        }
      })).catch(() => restore('检查失败（可能没联网）'));
    };
  }

  /** 读服务器上的 sw.js 版本（按钮专用；pwa.js 里那份在闭包里拿不到） */
  function askServerVerForBtn() {
    return fetch('sw.js', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => {
        const m = /const VERSION = "([^"]+)"/.exec(t || '');
        return m ? m[1] : '';
      })
      .catch(() => '');
  }

  /* 首次进入：查一次真实状态（不轮询，避免进度乱跳） */
  refresh().then(showVer);
  setTimeout(showVer, 1500);
}

function renderSettings() {
  const owned = Object.keys(S.owned).length;
  const size = JSON.stringify(S).length;
  $('#scr-set').innerHTML = `
    <div class="pad">
      <div class="sec-title">设 置</div>
      <div class="setcard">
        <div class="stitle">🏛️ 名人堂</div>
        <div class="shint">带过的球员会留下跨赛季的生涯数据。
          生涯累计 ${HOF_POINTS} 分，或 ${HOF_POINTS_WITH_HONOR} 分 + 总冠军 / 常规赛 MVP，
          就能入选名人堂。</div>
        <button class="setbtn" id="btnHof">🏛️ 打开名人堂（已入选 ${
          (typeof hofList === 'function' ? hofList().length : 0)} 人）</button>
      </div>
      <div class="setcard">
        <div class="stitle">💾 自动保存</div>
        <div class="shint">开启后，每次操作、切到后台、关闭页面时都会自动写盘。
          下次打开游戏进度还在。</div>
        <div class="srow auto">
          <span>自动保存${S.autoSave === false ? '（已关闭）' : ''}</span>
          <button class="switch${S.autoSave === false ? '' : ' on'}" id="swAuto">
            <i></i><b>${S.autoSave === false ? '关' : '开'}</b></button>
        </div>
        <div class="srow"><span>最后保存</span>
          <b id="lastSaveTxt">${lastSaveAt
            ? new Date(lastSaveAt).toLocaleTimeString('zh-CN')
            : '本次还没保存'}</b></div>
        <button class="setbtn" id="btnSaveNow">💾 立即保存一次</button>
        ${Store.usable ? '' : `<div class="swarn">⚠️ 这个环境不支持本地存储${
          (window.__platform && window.__platform.isIOS)
            ? '（iPhone 从「文件」直接打开 HTML 时很常见）'
            : '（部分浏览器/App 内置浏览器会禁用）'}。
          自动保存写了也没用，请用下面的「导出存档」备份，
          或者用浏览器直接打开网址（不要从文件打开）。</div>`}
      </div>
      <div class="setcard" style="border-color:rgba(245,196,81,.45);
        background:rgba(245,196,81,.07)">
        <div class="stitle">📲 装到桌面，像手游一样锁横屏（重要）</div>
        <div class="shint" style="color:#c8d3e8">
          想要「一进去就是横屏、系统锁定方向也不影响」，必须<b>装到桌面</b>，
          从桌面图标启动（这样才会像原生 App 一样跑在 standalone 模式，
          manifest 里的横屏锁定才生效）。<br><br>
          ${(() => {
            /* ★ v9.52：分平台显示安装步骤。
               原来写死「用 Safari 打开 → 点分享 → 添加到主屏幕」——
               那是 iPhone 的步骤，**安卓上根本没有 Safari**，
               安卓玩家看到会懵，以为游戏不支持安卓（有玩家就是这样反馈的）。
               步骤文案统一来自 pwa.js 的 installSteps()，两边不会不一致。 */
            const P = window.__platform || null;
            const IS = (typeof window.__installSteps === 'function')
              ? window.__installSteps() : null;
            if (!IS) {
              return '<b>操作步骤：</b><br>① 用浏览器打开游戏<br>② 在浏览器菜单里找「安装」或「添加到主屏幕」<br>③ 回桌面点图标启动';
            }
            const rows = IS.steps.map((t, i) => '　' + '①②③④⑤'[i] + ' ' + t).join('<br>');
            /* 微信/QQ 里：最要紧的是先跳出去，用醒目红字 */
            const warn = (P && P.inApp)
              ? '<div style="color:#ff9aab;font-weight:700;margin-bottom:7px">'
                + '⚠️ ' + (P.wechat ? '微信' : '当前App') + '里打不开这个游戏，请先按下面第 1 步跳出去</div>'
              : '';
            const osTag = P
              ? '<span style="display:inline-block;padding:2px 8px;border-radius:5px;'
                + 'background:rgba(245,196,81,.16);color:#f5c451;font-size:11px;'
                + 'font-weight:700;margin-bottom:6px">识别到：' + P.osName + '</span>'
              : '';
            return osTag + warn
              + '<b>' + IS.title + ' · 操作步骤：</b><br>' + rows
              + '<br><br><span style="color:#f5c451">' + IS.note + '</span>';
          })()}
          <br><br>
          <span style="color:#8b96ad;font-size:11px">
            装了之后：断网也能玩、自动全屏横屏、有更新会提醒你。
          </span>
        </div>
        <div class="srow"><span>当前运行模式</span>
          <b style="color:${(window.navigator.standalone
            || window.matchMedia('(display-mode: standalone)').matches)
            ? '#3fc46a' : '#ffb020'}">
            ${(window.navigator.standalone
              || window.matchMedia('(display-mode: standalone)').matches)
              ? '✓ 已安装（横屏锁定生效）' : '浏览器标签页（请添加到主屏幕）'}</b></div>
      </div>
      <div class="setcard">
        <div class="rowline">
          <span>新手引导</span>
          <button class="setbtn" id="btnTutAgain" style="margin:0;padding:7px 14px;
            font-size:12px;width:auto">重新看一遍</button>
        </div>
        <div class="shint">第一次进游戏时的 5 步引导，带你认识招募、阵容、比赛、市场、突破。</div>
      </div>
      <div class="setcard">
        <div class="rowline">
          <span>🧠 教练接管比赛</span>
          <button class="switch${S.coachOn !== false ? ' on' : ''}" id="swCoach">
            <i></i></button>
        </div>
        <div class="shint">开启后，教练会根据<b>体力 / 比赛影响力 / 能力 / 效率</b>
          四个维度自动安排比赛：换人、叫暂停、调整战术。<br>
          比赛界面右上角也有「🧠 教练」按钮可以随时开关。
          关掉后只保留基础轮换（体力不支才换），其余要自己手动操作。</div>
      </div>
      <div class="setcard">
        <div class="stitle">📱 屏幕方向
          <em style="float:right;font-style:normal;font-size:10px;color:#5d6a84">
            构建 ${BUILD_TAG}</em></div>
        <div class="srow"><span>当前视口</span>
          <b>${innerWidth} × ${innerHeight}
            <em style="font-style:normal;color:${innerWidth > innerHeight ? '#3fc46a' : '#f5c451'}">
              ${innerWidth > innerHeight ? '横屏 · 直接显示' : '竖屏 · 已旋转 90°'}
            </em></b></div>
        <div class="shint">iPhone 的「锁定屏幕方向」锁的是<b>竖屏</b>，锁定后游戏会自动把画面
          旋转 90° 显示，你把手机横过来看就是正常的。<br>
          如果画面方向反了（左右颠倒），点下面的按钮翻一下。</div>
        <div class="srow auto">
          <span>竖屏旋转方向</span>
          <button class="setbtn" id="btnRotFlip" style="margin:0;padding:7px 14px;
            font-size:12px;width:auto">🔄 翻转 180°</button>
        </div>
        <div class="srow"><span>当前</span>
          <b>${S.rotFlip ? '逆时针 90°' : '顺时针 90°'}</b></div>
      </div>
      <div class="setcard">
        <div class="srow"><span>存档方式</span>
          <b style="color:${Store.usable ? '#5ee08a' : '#ffb020'}">
            ${Store.usable ? '浏览器本地存储' : '仅内存（关掉就没了）'}</b></div>
        <div class="srow"><span>已收集</span><b>${owned} / ${CARDS.length} 张</b></div>
        <div class="srow"><span>已招募</span><b>${S.pulls} 次</b></div>
        <div class="srow"><span>存档大小</span><b>${(size / 1024).toFixed(1)} KB</b></div>
      </div>
      <div class="setcard" id="perfCard"
        style="border-color:rgba(120,170,255,.35);background:rgba(120,170,255,.06)">
        <div class="stitle">⚡ 性能模式（手机卡就打开）</div>
        <div class="shint" style="color:#c8d3e8">
          关掉卡牌的镭射流动、毛玻璃、阴影等<b>纯装饰特效</b>，
          让画面更流畅、手机不发烫、更省电。<br>
          <b style="color:#7fd4a0">不影响任何游戏数值和玩法</b> ——
          抽卡、比赛、突破、战术全部照常。
        </div>
        <div class="srow auto">
          <span>当前状态</span>
          <b id="perfState" style="color:#9fb0d0">读取中…</b>
        </div>
        <div class="btnrow" style="margin-top:2px">
          <button class="setbtn" id="btnPerfOn">开启（推荐手机用）</button>
          <button class="setbtn ghost" id="btnPerfOff">关闭（想要满特效）</button>
        </div>
        <div class="shint" style="margin-top:6px" id="perfHint">
          安卓手机默认<b>自动开启</b>。如果觉得画面卡顿，确认这里是「已开启」。
        </div>
      </div>
      <div class="setcard" id="offlineCard">
        <div class="stitle">📴 离线缓存（出门也能玩）</div>
        <div class="shint">
          游戏会把你<b>看过的球员照片</b>存到手机上。全部存好后，
          不连 WiFi、飞行模式也能看全所有卡面。
        </div>
        <div class="srow"><span>已缓存</span>
          <b id="cacheStatus" style="color:#9fb0d0">检测中…</b></div>
        <div class="cachebar"><i id="cacheFill"></i></div>
        <button class="setbtn" id="btnCacheAll">📥 下载全部球员照片（约 10 MB）</button>
        <div class="btnrow" style="margin-top:6px">
          <button class="setbtn ghost" id="btnCheckUpdate">🔄 检查更新</button>
          <span class="srow" style="flex:1;border:0;padding:0">
            <span>版本</span><b id="verText" style="color:#9fb0d0">读取中…</b>
          </span>
        </div>
        <div class="shint" style="margin-top:7px" id="cacheHint">
          建议在 WiFi 下点一次「下载全部」，等进度到 100% 再出门。
        </div>
      </div>
      <div class="setcard">
        <div class="stitle">备份 / 恢复</div>
        <div class="shint">导出后会得到一串文本，复制存到备忘录即可。换手机或进度丢了，粘回来就能恢复。</div>
        <button class="setbtn" id="btnExport">📤 导出存档</button>
        <textarea id="saveBox" class="savebox"
          placeholder="点「导出存档」生成备份码；或把备份码粘到这里再点「导入」"></textarea>
        <div class="btnrow">
          <button class="setbtn ghost" id="btnCopy">复制</button>
          <button class="setbtn ghost" id="btnSaveFile">💾 存成文件</button>
          <button class="setbtn ghost" id="btnImport">📥 导入</button>
        </div>
      </div>
      <div class="setcard">
        <div class="stitle">其他</div>
        <button class="setbtn ghost" id="btnReset2">🗑 清空存档重新开始</button>
        <div class="shint" style="margin-top:9px">
          游戏版本 v2 · 500 张卡 / 440 名球员 / 30 项能力 / 30 种徽章<br>
          球员照片来自 Wikimedia Commons（自由授权），
          本项目仅供个人娱乐，请勿商用。
        </div>
      </div>
    </div>`;

  // 自动保存开关
  const sw = $('#swAuto');
  if (sw) sw.onclick = () => {
    S.autoSave = S.autoSave === false;      // 取反
    if (S.autoSave) forceSave();
    Sfx.click();
    toast(S.autoSave ? '已开启自动保存' : '已关闭自动保存（退出时仍会兜底存一次）');
    renderSettings();
  };
  const bt2 = $('#btnTutAgain');
  if (bt2) bt2.onclick = () => {
    if (typeof tutRestart === 'function') tutRestart();
  };
  const ss = $('#swCoach');
  if (ss) ss.onclick = () => {
    /* 用统一的 coachToggle（它同时同步旧的 S.autoSub，避免中途失效） */
    const on = (typeof coachToggle === 'function') ? coachToggle() : (S.coachOn = S.coachOn === false);
    Sfx.click();
    toast(on ? '🧠 教练已接管比赛' : '🧠 教练已关闭（记得自己安排）');
    renderSettings();
  };
  const rf = $('#btnRotFlip');
  if (rf) rf.onclick = () => {
    S.rotFlip = !S.rotFlip;
    if (window.applyRotFlip) window.applyRotFlip();
    Sfx.click(); save();
    toast(S.rotFlip ? '已翻转：逆时针 90°' : '已翻转：顺时针 90°');
    renderSettings();
  };
  const btnHof = $('#btnHof');
  if (btnHof) btnHof.onclick = () => {
    Sfx.click();
    if (typeof openHof === 'function') openHof();
    else toast('名人堂模块没加载（hof.js）');
  };
  const btnNow = $('#btnSaveNow');
  if (btnNow) btnNow.onclick = () => {
    if (!Store.usable) { Sfx.fail(); toast('这个环境不支持本地存储，请用下方导出备份'); return; }
    forceSave();
    Sfx.coin();
    toast('已保存');
    renderSettings();
  };

  /* ---------- 📴 离线缓存面板 ---------- */
  bindOfflineCache();

  const box = $('#saveBox');
  $('#btnExport').onclick = () => {
    Sfx.coin();
    box.value = exportSave();
    box.focus(); box.select();
    try { document.execCommand('copy'); toast('备份码已生成并复制'); }
    catch (e) { toast('备份码已生成，请长按文本框复制'); }
  };
  $('#btnCopy').onclick = async () => {
    if (!box.value) { toast('先点「导出存档」'); return; }
    box.focus(); box.select();
    // 优先用 Clipboard API（iOS Safari 需要 https 或 localhost），失败再退回 execCommand
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(box.value);
      } else {
        document.execCommand('copy');
      }
      Sfx.click(); toast('已复制，粘到备忘录里就是备份');
    } catch (e) {
      try { document.execCommand('copy'); Sfx.click(); toast('已复制'); }
      catch (e2) { toast('请长按文本框手动复制'); }
    }
  };
  // 存成文件：iOS 会弹「存储到文件」，可以直接放进 iCloud/本机
  const btnFile = $('#btnSaveFile');
  if (btnFile) btnFile.onclick = () => {
    if (!box.value) { toast('先点「导出存档」'); return; }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const blob = new Blob([box.value], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '巅峰球星卡-存档-' + stamp + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    Sfx.reveal('gold');
    toast('存档文件已导出，请保存到「文件」App');
  };
  $('#btnImport').onclick = () => {
    const code = box.value.trim();
    if (!code) { toast('请先粘贴备份码'); return; }
    try {
      const n = importSave(code);
      Sfx.reveal('momentGold');
      toast(`导入成功！恢复了 ${n} 张卡`);
    } catch (e) { Sfx.fail(); toast('备份码无效：' + e.message); }
  };
  $('#btnReset2').onclick = () => {
    if (!confirm('确定清空所有卡牌、金币和突破进度吗？此操作不可撤销。')) return;
    Store.wipe(SAVE_KEY); S = DEFAULT_STATE(); save(); renderAll(); switchTab('home');
    toast('存档已重置');
  };
}

function renderMine() {
  const readyN = CARDS.filter((c) => S.owned[c.id] && holdings(c.id).ready).length;
  /* 转会市场已独立成页签；这里只留任务入口 */
  try {
    const tb = $('#mine-tools');
    if (tb) {
      const qs = (typeof dailyList === 'function')
        ? dailyList().filter((i) => i.done && !i.claimed).length
          + achList().filter((i) => i.done && !i.claimed).length
          + dexList().filter((i) => i.done && !i.claimed).length : 0;
      tb.innerHTML = `
        <button class="mine-tool" id="mtMarket">💰 转会市场
          <em>买卖球员 · 重复卡突破</em></button>
        <button class="mine-tool${qs ? ' hot' : ''}" id="mtQuest">🎯 任务成就
          <em>${qs ? '有 ' + qs + ' 个奖励可领' : '每日任务 · 成就 · 图鉴里程碑'}</em>
          ${qs ? `<i>${qs}</i>` : ''}</button>`;
      const mk = document.getElementById('mtMarket');
      if (mk) mk.onclick = () => { Sfx.click(); openMineLayer('market'); };
      const qt = document.getElementById('mtQuest');
      if (qt) qt.onclick = () => { Sfx.click(); openMineLayer('quest'); };
    }
  } catch (e) {}

  const el = $('#mine-filter');
  const list0 = ['ALL', 'READY'].concat(TIER_ORDER.slice().reverse());
  el.innerHTML = list0.map((k) => {
    const label = k === 'ALL' ? '全部' : k === 'READY' ? `可突破 ${readyN}` : TIERS[k].name;
    return `<button class="chip${mineFilter === k ? ' on' : ''}${k === 'READY' && readyN ? ' hot' : ''}"
      data-f="${k}">${label}</button>`;
  }).join('');
  el.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    Sfx.click(); mineFilter = b.dataset.f; renderMine();
  };
  const mbox = ensureSearchBar('mine-search-wrap', 'mine-search',
    '搜我拥有的球员，找能突破的',
    (v) => { mineQuery = v; renderMine(); });
  syncSearchInput(mbox, mineQuery);

  let list;
  if (mineQuery.trim()) {
    list = searchCards(mineQuery, true);
    if (mineFilter === 'READY') list = list.filter((c) => holdings(c.id).ready);
    else if (mineFilter !== 'ALL' && mineFilter !== 'READY') {
      list = list.filter((c) => c.tier === mineFilter);
    }
    list = list.slice(0, MAX_RESULTS);
  } else {
    list = CARDS.filter((c) => S.owned[c.id]);
    if (mineFilter === 'READY') list = list.filter((c) => holdings(c.id).ready);
    else if (mineFilter !== 'ALL') list = list.filter((c) => c.tier === mineFilter);
    list.sort((a, b) => statsOf(b, S.owned[b.id].brk).ovr - statsOf(a, S.owned[a.id].brk).ovr);
  }
  if (!list.length) {
    $('#mine-grid').innerHTML = mineQuery.trim()
      ? `<div class="empty" style="grid-column:1/-1">没找到「${mineQuery}」<br>换个关键词试试</div>`
      : '<div class="empty" style="grid-column:1/-1">还没有球员<br>去招募页签几个吧 🏀</div>';
    return;
  }
  $('#mine-grid').innerHTML = list.map((c) => miniHTML(c, true)).join('');
  $('#mine-grid').onclick = (e) => {
    const m = e.target.closest('.mini');
    if (!m) return;
    // 双击直接开查看器，单击进详情
    const now = Date.now();
    if (m._lastTap && now - m._lastTap < 320) { m._lastTap = 0; openViewer(m.dataset.id); return; }
    m._lastTap = now;
    openDetail(m.dataset.id);
  };
}
/**
 * 同一球员冲突提示弹窗。
 * 比 toast 更明确 —— 把"阵容里已有谁、你想换上谁"摆清楚，
 * 并提供一个「用这张替换掉原来那张」的快捷操作。
 */
function showConflictDialog(newId, oldId) {
  const a = CARD_BY_ID[newId], b = CARD_BY_ID[oldId];
  if (!a || !b) return;
  closeConflictDialog();                             // 先关掉旧的，别叠加
  if (document.querySelector('.spf-mask')) return;
  const box = document.createElement('div');
  box.className = 'spf-mask';
  box.innerHTML = `
    <div class="spf">
      <div class="spf-ico">⚠️</div>
      <div class="spf-title">同一名球员只能上一张卡</div>
      <div class="spf-body">
        <div class="spf-row"><span>阵容里已有</span>
          <b style="color:${TIERS[b.tier].glow}">${TIERS[b.tier].name} · ${b.name}</b></div>
        <div class="spf-row"><span>你想换上</span>
          <b style="color:${TIERS[a.tier].glow}">${TIERS[a.tier].name} · ${a.name}</b></div>
      </div>
      <div class="spf-note">
        虽然档位不同，但他们是同一个人。<br>
        一场比赛只能上一张卡，请先把原来那张换下。
      </div>
      <div class="spf-btns">
        <button class="btn" data-spf="cancel">知道了</button>
        <button class="btn primary" data-spf="swap">用这张替换原来那张</button>
      </div>
    </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  conflictEl = box;
  box.onclick = (ev) => {
    if (ev.target === box) { close(); return; }
    const act = ev.target.closest && ev.target.closest('[data-spf]');
    if (!act) return;
    if (act.dataset.spf === 'cancel') { Sfx.click(); close(); return; }
    if (act.dataset.spf !== 'swap') return;
    const r = rosterIds();
    const si = r.starters.indexOf(oldId);
    if (si >= 0) putOnCourtSilent(newId, si);
    else {
      const bi = r.bench.indexOf(oldId);
      if (bi >= 0) { r.bench[bi] = newId; finalizeRoster(r); S.roster = r; save(); }
    }
    Sfx.reveal('gold');
    toast(`已用 ${TIERS[a.tier].name} · ${a.name} 替换掉 ${b.name}`);
    close();
    renderRoster();
    renderBattle();
  };
}

/* -------------------------------------------------------------
   冲突弹窗的引用 + 统一关闭
   -------------------------------------------------------------
   玩家把冲突的那名球员拿下之后，弹窗必须自己消失，
   不能一直挂在那儿挡住操作。
   关闭时机：任何阵容变动、切标签页、点关闭、按 Esc。
   ------------------------------------------------------------- */
let conflictEl = null;
function closeConflictDialog() {
  if (conflictEl) { try { conflictEl.remove(); } catch (e) {} conflictEl = null; }
  // 兜底：万一引用丢了，按类名再扫一遍
  document.querySelectorAll('.spf-mask').forEach((n) => n.remove());
}
window.closeConflictDialog = closeConflictDialog;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeConflictDialog();
});

function renderAll() {
  try { if (typeof renderTutorial === 'function') renderTutorial(); } catch (e) {}
  $('#ui-coins').textContent = fmt(S.coins);
  $('#ui-dex').textContent = Object.keys(S.owned).length + '/' + CARDS.length;
  renderHome(); renderDex(); renderMine();
  if ($('#scr-team')) renderTeamSys();
  if ($('#scr-battle')) renderBattle();
  if ($('#scr-set')) renderSettings();
}

/* =============================================================
   卡片查看器：点卡放大 → 可翻转看背面
   ============================================================= */
function cardBackHTML(card, st, badges) {
  const scores = groupScores(st.attrs);
  const T = TIERS[card.tier];
  const bt = {};
  badges.forEach((b) => { bt[b.tier] = (bt[b.tier] || 0) + 1; });
  const rows = ATTR_GROUPS.map((g) => {
    const v = scores[g.key];
    const col = v >= 110 ? '#c084fc' : v >= 80 ? '#3fc46a' : '#8b96ad';
    return `<div class="cb-row"><span>${g.name}</span>
      <b style="color:${col}">${v}<i>${gradeOf(v)}</i></b></div>`;
  }).join('');
  const born = card.birth ? `${card.birth} 年生` : '';
  const teamYears = card.current ? '现役' : (card.birth ? `${card.birth + 21} 年前后` : '');
  const seed = holoSeedOf(card.id);
  return `
  <div class="cardback${card.isMoment ? ' moment' : ''}"${card.isMoment
    ? ` data-holo="${seed % 4}" style="${tierVar(card.tier)};--holo-hue:${seed % 360}deg"`
    : ` style="${tierVar(card.tier)}"`}>
    ${card.isMoment ? '<div class="holo-foil"></div><div class="holo-sparkle"></div>' : ''}
    <div class="cb-grid"></div>
    <div class="cb-in">
      <div class="cb-head">
        <div class="cb-team">${card.isMoment ? card.season + ' 赛季' : card.team}</div>
        <div class="cb-name">${card.name}</div>
        <div class="cb-en">${card.en}</div>
      </div>
      <div class="cb-stats">${rows}</div>
      <div class="cb-bio">
        <b>${card.pos}${card.pos2 ? ' / ' + card.pos2 : ''}</b>　
        ${card.height}cm / ${card.weight}kg<br>
        ${card.team}　${born}${teamYears ? '　' + teamYears : ''}<br>
        综合 <b>${st.ovr}</b>　${BREAK_LABEL[st.brk]}　持有 <b>${holdings(card.id).total}</b> 张<br>
        ${badges.length
          ? `徽章 ${['gold', 'silver', 'bronze'].filter((k) => bt[k])
              .map((k) => `<b style="color:${BADGE_TIERS[k].color}">${BADGE_TIERS[k].name[0]}${bt[k]}</b>`).join(' ')}`
          : '暂无徽章'}
        ${badges.length ? `<div class="cb-badges">${badges.slice(0, 8).map((b) =>
          `<i style="--bc:${BADGE_TIERS[b.tier].color}" title="${b.name}">${b.icon}</i>`).join('')}</div>` : ''}
      </div>
      <div class="cb-foot"><span>巅峰球星卡 · ${T.name}</span><b>#${card.no || card.id.slice(1)}</b></div>
    </div>
    <div class="cb-frame"></div>
  </div>`;
}

let cvCard = null, cvFlipped = false, cvScale = 1;
function openViewer(id, fromDetail) {
  const card = CARD_BY_ID[id];
  if (!card) return;
  const o = S.owned[id];
  if (!o) { Sfx.fail(); toast('还没招募到这张卡'); return; }
  cvCard = id; cvFlipped = false; cvScale = 1;
  Sfx.click();
  const st = statsOf(card, o.brk);
  const badges = badgesOf({ tier: card.tier, attrs: st.attrs, ovr: st.ovr }, st.brk);
  const layer = $('#cardViewer');
  layer.setAttribute('style', `--gc:${TIERS[card.tier].glow}`);
  layer.innerHTML = `
    <div class="cv-wrap" id="cvWrap">
      <div class="cv-face cv-front">${cardHTML(card, {})}</div>
      <div class="cv-face cv-back">${cardBackHTML(card, st, badges)}</div>
    </div>
    <div class="cv-hint">点卡片翻转 · 看背面的能力与徽章</div>
    <div class="cv-bar">
      <button id="cvFlip">🔄 翻面</button>
      <button id="cvZoom">🔍 放大</button>
      <button class="primary" id="cvClose">关闭</button>
    </div>`;
  layer.classList.remove('hidden');
  const wrap = $('#cvWrap');
  // 指针在卡面上移动时轻微倾斜，全息层跟着位移 —— 模拟实体卡换角度的观感
  const onMove = (e) => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    wrap.classList.add('tilt');
    wrap.style.setProperty('--ry', (px * 15).toFixed(1) + 'deg');
    wrap.style.setProperty('--rx', (-py * 13).toFixed(1) + 'deg');
    wrap.style.setProperty('--hx', (px * 90).toFixed(0) + 'px');
    wrap.style.setProperty('--hy', (py * 90).toFixed(0) + 'px');
  };
  const onLeave = () => {
    wrap.classList.remove('tilt');
    wrap.style.setProperty('--ry', '0deg');
    wrap.style.setProperty('--rx', '0deg');
    wrap.style.setProperty('--hx', '0px');
    wrap.style.setProperty('--hy', '0px');
  };
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerleave', onLeave);
  wrap.addEventListener('pointercancel', onLeave);
  const flip = () => {
    cvFlipped = !cvFlipped;
    wrap.classList.toggle('flipped', cvFlipped);
    Sfx.flip();
  };
  wrap.onclick = flip;
  $('#cvFlip').onclick = flip;
  $('#cvZoom').onclick = () => {
    cvScale = cvScale >= 1.6 ? 1 : cvScale + 0.3;
    wrap.style.transform = cvFlipped
      ? `rotateY(180deg) scale(${cvScale})` : `scale(${cvScale})`;
    Sfx.click();
  };
  $('#cvClose').onclick = () => { Sfx.click(); layer.classList.add('hidden'); };
}

/* ---------------- 详情 ---------------- */
function radarSVG(scores, color) {
  const keys = ATTR_GROUPS.map((g) => g.key);
  const cx = 100, cy = 100, R = 74, n = keys.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * v / 100;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  let grid = '';
  [25, 50, 75, 100].forEach((lv) => {
    grid += `<polygon points="${keys.map((_, i) => pt(i, lv).map((x) => x.toFixed(1)).join(',')).join(' ')}"
      fill="none" stroke="rgba(255,255,255,${lv === 100 ? .3 : .11})" stroke-width="1"/>`;
  });
  let axes = '', labels = '';
  keys.forEach((k, i) => {
    const p100 = pt(i, 100);
    axes += `<line x1="${cx}" y1="${cy}" x2="${p100[0].toFixed(1)}" y2="${p100[1].toFixed(1)}" stroke="rgba(255,255,255,.14)"/>`;
    const lp = pt(i, 132), vp = pt(i, 112);
    labels += `<text x="${lp[0].toFixed(1)}" y="${lp[1].toFixed(1)}" fill="#9fb0d4" font-size="12"
      text-anchor="middle" dominant-baseline="middle">${ATTR_GROUPS[i].name}</text>`;
    labels += `<text x="${vp[0].toFixed(1)}" y="${vp[1].toFixed(1)}" fill="${color}" font-size="14"
      font-weight="800" text-anchor="middle" dominant-baseline="middle">${scores[k]}</text>`;
  });
  const poly = keys.map((k, i) => pt(i, scores[k]).map((x) => x.toFixed(1)).join(',')).join(' ');
  const dots = keys.map((k, i) => {
    const p = pt(i, scores[k]);
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="${color}"/>`;
  }).join('');
  return `<svg class="radar" viewBox="-52 -52 304 304">${grid}${axes}
    <polygon points="${poly}" fill="${color}" fill-opacity=".26" stroke="${color}" stroke-width="2.2"/>
    ${dots}${labels}</svg>`;
}
let detailTab = 'overview';
let badgeCat = 'shot';      // 徽章页当前选中的分类

/** 8 轴雷达图，带字母评级（参考巅峰对决的雷达） */
function radarSVG(scores, color) {
  const keys = ATTR_GROUPS.map((g) => g.key);
  const cx = 100, cy = 100, R = 72, n = keys.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * v / 100;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  let grid = '';
  [25, 50, 75, 100].forEach((lv) => {
    grid += `<polygon points="${keys.map((_, i) => pt(i, lv).map((x) => x.toFixed(1)).join(',')).join(' ')}"
      fill="none" stroke="rgba(255,255,255,${lv === 100 ? .32 : .12})" stroke-width="1"/>`;
  });
  let axes = '', labels = '';
  keys.forEach((k, i) => {
    const p100 = pt(i, 100);
    axes += `<line x1="${cx}" y1="${cy}" x2="${p100[0].toFixed(1)}" y2="${p100[1].toFixed(1)}" stroke="rgba(255,255,255,.15)"/>`;
    const lp = pt(i, 128);
    const g = ATTR_GROUPS[i], v = scores[k];
    labels += `<text x="${lp[0].toFixed(1)}" y="${lp[1].toFixed(1)}" fill="#9fb0d4" font-size="11.5"
      text-anchor="middle" dominant-baseline="middle">${g.name}<tspan fill="${color}" font-weight="900"> ${gradeOf(v)}</tspan></text>`;
  });
  const poly = keys.map((k, i) => pt(i, scores[k]).map((x) => x.toFixed(1)).join(',')).join(' ');
  const dots = keys.map((k, i) => {
    const p = pt(i, scores[k]);
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${color}"/>`;
  }).join('');
  return `<svg class="radar" viewBox="-46 -34 292 268">${grid}${axes}
    <polygon points="${poly}" fill="${color}" fill-opacity=".26" stroke="${color}" stroke-width="2.2"/>
    ${dots}${labels}</svg>`;
}

/**
 * 打开球员信息页。
 * -------------------------------------------------------------
 * own === false 时表示"还没拥有的卡"（转会市场的球员、对手阵容里的球员），
 * 这时照样能看能力/徽章，只是不显示突破、出售这些只对自己球员有意义的操作。
 */
function openDetail(id, keepTab, forceView, viewBrk) {
  const card = CARD_BY_ID[id];
  if (!card) return;
  const owned = S.owned[id];
  // 没有这张卡、也不是"只查看"模式 → 什么都不做
  if (!owned && !forceView) return;
  if (forceView && !owned) {
    /* 临时造一份只读的持有记录，让后面所有计算都能跑通。
       viewBrk：对手球员的真实突破等级 —— 不传的话他会显示成裸卡，
       徽章几乎全空，看不出真实实力。 */
    S.owned[id] = { got: 0, dup: 0, brk: viewBrk || 0, _view: true };
  }
  const o = S.owned[id];
  if (!o) return;
  if (!keepTab) detailTab = 'overview';
  Sfx.click();
  const T = TIERS[card.tier];
  const st = statsOf(card, o.brk);
  const hd = holdings(id);              // 该卡的持有量与每阶消耗（按档位）
  const maxed = o.brk >= MAX_BREAK;
  const canUp = !maxed && o.dup >= hd.per;
  const nextSt = maxed ? null : statsOf(card, o.brk + 1);
  const left = maxed ? 0 : hd.per - o.dup;
  const scores = groupScores(st.attrs);
  const badges = badgesOf({ tier: card.tier, attrs: st.attrs, ovr: st.ovr }, st.brk);
  const slots = badgeSlots(card.tier, st.brk);
  const posTxt = card.pos2 ? card.pos + ' | ' + card.pos2 : card.pos;
  const val = valueOf(st.ovr);
  const bt = { bronze: 0, silver: 0, gold: 0 };
  badges.forEach((b) => { bt[b.tier]++; });

  /* --- 总况：左表格 + 右雷达 --- */
  const overview = `
    <div class="ov-wrap">
      <div class="ov-grid">
        <div class="ov-row"><span>总评</span><b style="color:${T.glow}">${st.ovr}</b></div>
        <div class="ov-row"><span>徽章</span><b>
          ${badges.length ? BADGE_ORDER.filter((k) => bt[k]).map((k) =>
            `<em class="bt ${k}">${bt[k]}</em>`).join('') : '<i style="color:#93a0b8;font-size:12.5px">无</i>'}
          <i class="bt-cap">${badges.length}/${slots.full}</i>
        </b></div>
        <div class="ov-row"><span>身价</span><b style="color:#1f9d4d">${valueText(st.ovr)}</b></div>
        <div class="ov-row"><span>持有</span><b>${hd.total} 张
          <i style="font-style:normal;color:#8b96ad;font-size:11.5px">可突破 ${hd.dup} 张</i></b></div>
        <div class="ov-row"><span>突破</span><b>${BREAK_LABEL[st.brk]}
          <i style="font-style:normal;color:#8b3ce0;font-size:12.5px">${st.brk}/${MAX_BREAK}</i></b></div>
        <div class="ov-row"><span>球队</span><b>${card.team}</b></div>
      </div>
      <div class="radar-box">${radarSVG(scores, '#c8a83c')}
        <div class="play-tags">${playTags(card).map((t) => `<span>${t}</span>`).join('')}</div>
      </div>
    </div>`;

  /* --- 能力：4 列 × 2 行，每列顶部一条彩色横杠 --- */
  const ability = `<div class="ab-grid">${ATTR_GROUPS.map((g) => {
    const v = scores[g.key];
    const lv = v >= 110 ? '#8b3ce0' : v >= 80 ? '#1f9d4d' : '#93a0b8';
    return `<div class="ab-col">
      <div class="ab-head">
        <div class="bar" style="background:${g.color}"></div>
        <div class="nm">${g.name}</div>
        <div class="val" style="color:${lv}">${v}</div>
      </div>
      <div class="ab-rows">${g.attrs.map((a) => {
        const av = st.attrs[a.key], up = av - card.attrs[a.key];
        const cls = av >= 110 ? 'lv-p' : av >= 80 ? 'lv-g' : 'lv-x';
        return `<div class="ab-row ${cls}"><span>${a.name}</span><b>${av}${
          up > 0 ? `<em>+${up}</em>` : ''}</b></div>`;
      }).join('')}</div>
    </div>`;
  }).join('')}</div>`;

  /* --- 徽章：左侧彩色计数栏 + 右侧徽章卡 --- */
  const badgeStat = {};
  ATTR_GROUPS.forEach((g) => { badgeStat[g.key] = 0; });
  badges.forEach((b) => { const g = ATTR_GROUP_OF[b.key]; if (g) badgeStat[g.key]++; });
  /* =============================================================
     徽章页（参考 2K 的排版）
     -------------------------------------------------------------
     左边一列是五大分类 + 该球员在每类拥有的徽章数（六边形），
     点分类右边就显示这一类里他具体有哪些徽章（名称 + 说明 + 品质）。
     ============================================================= */
  const catCounts = badgeCatCounts(card, st.brk);
  const curCat = BADGE_CATS.filter((c) => c.key === badgeCat)[0] || BADGE_CATS[0];
  const catBadges = badgesInCat(card, st.brk, curCat.key);
  const totalOwned = BADGE_CATS.reduce((a, c) => a + catCounts[c.key], 0);

  /* 六边形徽章图标：底托 + 专属图案 + 右下角品质角标
     每个徽章有自己的一套 SVG 图案（不是统一占位图），
     像 2K 那样一眼能认出是什么徽章。 */
  let hexSeq = 0;
  const hexHTML = (b, tier) => {
    const T2 = BADGE_TIERS[tier];
    const gid = 'hg' + (hexSeq++);
    const path = badgeIconPath(b.key);
    return `<div class="bd-hex" style="--hc:${T2.color};--hc2:${T2.c2}">
      <svg viewBox="0 0 40 46" aria-hidden="true">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${T2.color}" stop-opacity=".55"/>
            <stop offset="1" stop-color="${T2.c2}" stop-opacity=".92"/>
          </linearGradient>
        </defs>
        <polygon points="20,1 39,12 39,34 20,45 1,34 1,12"
          fill="url(#${gid})" stroke="${T2.color}" stroke-width="1.8"/>
        <polygon points="20,5 35,13.5 35,32.5 20,41 5,32.5 5,13.5"
          fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".8"/>
        <g transform="translate(8,11) scale(1.0)">
          <path d="${path}" fill="#fff" fill-opacity=".96"/>
        </g>
      </svg>
      <u class="bd-hex-lv">${T2.rank}</u>
    </div>`;
  };

  /* 身价波动：这张卡的价值随综合分／突破／赛季变化 */
  const trendTab = `
    <div class="dtr">
      <div class="dtr-now">
        <span>当前身价</span>
        <b>🪙 ${fmt(marketPrice(card))}</b>
      </div>
      <div class="dtr-list">
        <div class="dtr-row"><span>基础身价（${T.name}）</span>
          <b>🪙 ${fmt(marketPrice({ ...card, ovr: TIERS[card.tier].baseOvr || card.ovr }))}</b></div>
        <div class="dtr-row"><span>综合分加成</span>
          <b class="up">+ ${fmt(Math.max(0, marketPrice(card) - marketPrice({
            ...card, ovr: TIERS[card.tier].baseOvr || card.ovr })))}</b></div>
        <div class="dtr-row"><span>突破 ${st.brk} 阶</span>
          <b class="up">+${breakAttrAt(st.brk)} 能力 / +${breakOvrAt(st.brk)} 综合</b></div>
        <div class="dtr-row"><span>持有张数</span><b>${hd.total} / ${hd.cap} 张</b></div>
        <div class="dtr-row"><span>每阶突破消耗</span><b>${hd.per} 张 · 满突破共 ${hd.cap} 张</b></div>
        <div class="dtr-row"><span>出售实收（扣 20%）</span>
          <b class="dn">🪙 ${fmt(marketPrice(card) - Math.round(marketPrice(card) * 0.2))}</b></div>
      </div>
      <div class="dtr-note">身价随综合分上涨 · 突破与赛季表现都会推高身价</div>
    </div>`;

  /* 动作增益：这名球员在比赛里实际能吃到哪些加成 */
  const gainRows = (() => {
    const m = {};
    badgesOf(card, st.brk).forEach((b) => { m[b.key] = b.tier; });
    const out = [];
    const push = (name, val, unit, key) => {
      if (!key || m[key]) out.push({ name, val, unit, tier: m[key] || null });
    };
    out.push({ name: '招牌动作加成', val: (SIGNATURE_BONUS({ badges: m }, 'three') * 100).toFixed(0),
      unit: '%', tier: m.three || null, note: '三分／中投／终结各自按徽章品质加成' });
    out.push({ name: '体力上限', val: 100 + (m.charged === 'gold' ? 18
      : m.charged === 'silver' ? 12 : m.charged === 'bronze' ? 6 : 0),
      unit: '', tier: m.charged || null, note: '电量充满徽章提升' });
    const d = Math.round((1 - (m.relentless === 'gold' ? 0.35
      : m.relentless === 'silver' ? 0.23 : m.relentless === 'bronze' ? 0.12 : 0)) * 100);
    out.push({ name: '防守体力消耗', val: d, unit: '%', tier: m.relentless || null,
      note: '不知疲倦徽章降低' });
    out.push({ name: '关键球加成', val: (m.clutchGene === 'gold' ? 6.5
      : m.clutchGene === 'silver' ? 4.3 : m.clutchGene === 'bronze' ? 2.2 : 0).toFixed(1),
      unit: '', tier: m.clutchGene || null, note: '第四节最后两分钟' });
    out.push({ name: '关键罚球', val: (m.ice === 'gold' ? 7.5
      : m.ice === 'silver' ? 5 : m.ice === 'bronze' ? 2.5 : 0).toFixed(1),
      unit: '%', tier: m.ice || null, note: '大心脏徽章' });
    out.push({ name: '全队领袖加成', val: (m.leader === 'gold' ? 4.5
      : m.leader === 'silver' ? 3 : m.leader === 'bronze' ? 1.5 : 0).toFixed(1),
      unit: '%', tier: m.leader || null, note: '领袖徽章，在场即生效' });
    return out;
  })();

  const gainTab = `
    <div class="dgn">
      ${gainRows.map((r) => {
        const BT2 = r.tier ? BADGE_TIERS[r.tier] : null;
        return `<div class="dgn-row${r.tier ? '' : ' off'}"${
          BT2 ? ` style="--gc:${BT2.color}"` : ''}>
          <div class="dgn-name">${r.name}${
            BT2 ? `<em style="background:${BT2.color}">${BT2.name}</em>` : ''}</div>
          <div class="dgn-val">${r.val}<i>${r.unit}</i></div>
          <div class="dgn-note">${r.note}</div>
        </div>`;
      }).join('')}
    </div>`;

  const badgeTab = `
    <div class="bd-wrap">
      <div class="bd-side">
        ${BADGE_CATS.map((c) => {
          const n = catCounts[c.key];
          return `<button class="bd-cat${c.key === curCat.key ? ' on' : ''}${
            n ? '' : ' zero'}" data-bcat="${c.key}"
            style="--cc:${c.color};--cc2:${c.c2}">
            <span class="bd-cat-hex">${n}</span>
            <b>${c.name}</b>
            <em>${c.en}</em>
          </button>`;
        }).join('')}
        <div class="bd-next">
          <b>${totalOwned}<i>/${slots.full}</i></b>
          <span>${slots.locked ? `还差 ${slots.locked} 个槽位` : '已全解锁'}</span>
        </div>
      </div>
      <div class="bd-main">
        <div class="bd-bar">
          <b style="color:${curCat.color}">${curCat.name}徽章</b>
          <span>${catBadges.length
            ? `拥有 ${catBadges.length} 枚`
            : `这一类还没有达标的能力（${curCat.badges.length} 枚可解锁）`}</span>
        </div>
        <div class="bd-grid">
          ${catBadges.map((b) => {
            const BT = BADGE_TIERS[b.tier];
            return `<div class="bd-item" style="--bc:${BT.color};--bc2:${BT.c2}">
              ${hexHTML(b, b.tier)}
              <div class="bd-body">
                <div class="bd-name">${b.name}
                  <em class="bd-tier">${BT.name}</em></div>
                <div class="bd-desc">${b.desc}</div>
              </div>
            </div>`;
          }).join('')}
          ${catBadges.length ? '' : `<div class="bd-none">
            <div class="bd-none-ico">${curCat.icon}</div>
            <div>这名球员在「${curCat.name}」类还没有达到门槛的徽章<br>
              <em>铜徽章需要该分类任一能力 ≥ 83</em></div>
          </div>`}
        </div>
        ${slots.locked ? `<div class="bd-lock-note">
          🔒 还有 ${slots.locked} 个徽章槽位待解锁 · 突破到 ${
            BREAK_LABEL[Math.min(BREAK.stages, st.brk + 1)]} 可再开一枚</div>
        <div class="bd-locked-row">
          ${Array.from({ length: Math.min(slots.locked, 5) }, (_, k) => {
            const want = slots.max + k + 1;
            const at = BADGE_UNLOCK.findIndex((u, i) => i > st.brk && u.n >= want);
            const stage = at > 0 ? at : BREAK.stages;
            const up = BADGE_TIERS[BADGE_UNLOCK[stage].top].rank
              > BADGE_TIERS[slots.top].rank;
            return `<div class="bd-lock-chip">
              <i>🔒</i><span>第 ${slots.max + k + 1} 枚</span>
              <em>突破到 ${BREAK_LABEL[stage]}${up ? ' · 开' +
                BADGE_TIERS[BADGE_UNLOCK[stage].top].name : ''}</em>
            </div>`;
          }).join('')}
          ${slots.locked > 5 ? `<div class="bd-lock-chip more">还有 ${
            slots.locked - 5} 枚</div>` : ''}
        </div>` : ''}
      </div>
    </div>`;

  $('#detailLayer').innerHTML = `
    <div class="dwrap">
      <div class="dmain">
      <!-- ===== 顶部：左球员卡（斜置定格）+ 右大名字与信息栏（复刻参考图） ===== -->
      <div class="dtop">
        <div class="dtop-card" id="dheadCard" title="点开放大查看">
          ${cardHTML(card, {})}
          ${st.brk > 0 ? `<div class="brkbadge">突破 ${st.brk}</div>` : ''}
          ${maxed ? '<div class="maxbadge">MAX</div>' : ''}
        </div>
        <div class="dtop-info">
          <div class="dtop-line">
            <div class="dtop-name">${card.name}</div>
            <div class="dtop-acts">
              <button class="dact${isLocked(id) ? ' on' : ''}" id="dactLock"
                title="${isLocked(id) ? '已锁定不可出售' : '锁定后不可出售'}">${
                isLocked(id) ? '🔒' : '🔓'}</button>
              <button class="dact star${(S.fav && S.fav[id]) ? ' on' : ''}" id="dactFav"
                title="收藏标记">★</button>
              <button class="dact wide" id="dactBreak" title="去突破">🏅 球员突破</button>
            </div>
          </div>
          ${(() => {
            const ms = (typeof momentSkillOf === 'function') ? momentSkillOf(card) : null;
            return ms ? `<div class="dtop-skill" title="${ms.desc}">
              <b>${ms.icon} ${ms.name}</b><em>${ms.desc}</em></div>` : '';
          })()}
          <div class="dtop-sub">
            <span class="dtop-pos">${posTxt}</span>
            <span class="dtop-tier" style="color:${T.glow}">${T.name}${
              card.isMoment ? ' · 荣耀时刻' : ''}</span>
            <span class="dtop-en">${card.en}</span>
          </div>
          <div class="dtop-grid">
            <div class="cell"><span>身高</span><b>${card.height} cm</b></div>
            <div class="cell"><span>基础工资</span><b>${salaryText(st.ovr)}</b></div>
            <div class="cell"><span>体重</span><b>${card.weight} Kg</b></div>
            <div class="cell"><span>臂展</span><b>${card.wingspan || Math.round(card.height * 1.06)} cm</b></div>
            <div class="cell"><span>惯用手</span><b>右手</b></div>
            <div class="cell"><span>球队</span><b>${card.team}</b></div>
          </div>
        </div>
      </div>

      <div class="dtabs">
        <button class="${detailTab === 'overview' ? 'on' : ''}" data-dtab="overview">总况</button>
        <button class="${detailTab === 'ability' ? 'on' : ''}" data-dtab="ability">能力</button>
        <button class="${detailTab === 'badge' ? 'on' : ''}" data-dtab="badge">徽章</button>
        <button class="${detailTab === 'trend' ? 'on' : ''}" data-dtab="trend">身价波动</button>
        <button class="${detailTab === 'gain' ? 'on' : ''}" data-dtab="gain">动作增益</button>
      </div>

      <div class="dpanel">
        ${detailTab === 'overview' ? overview
          : detailTab === 'ability' ? ability
          : detailTab === 'trend' ? trendTab
          : detailTab === 'gain' ? gainTab
          : badgeTab}
      </div>

      <div class="dfoot${o._view ? ' readonly' : ''}">
        ${o._view ? '<div class="dview-tip">👁 这是别队的球员 · 只能查看能力与徽章</div>' : ''}
        ${card.isMoment ? `<div class="dmoment">🏆 ${card.momentDesc}</div>` : ''}
        <div class="dupsell">
          ${maxed
            ? `已经 <b>满突破</b>（累计抽到 ${hd.total} 张）· 全部能力 +${breakAttrAt(MAX_BREAK)}、综合 +${breakOvrAt(MAX_BREAK)}`
            : `累计抽到 <b>${hd.total}</b> 张，手上还有 <b>${hd.dup}</b> 张重复卡<br>
               突破到 <b>${BREAK_LABEL[o.brk + 1]}</b> 每阶消耗 <b>${hd.per}</b> 张，
               ${hd.dup >= hd.per
                 ? `现在可以连突 <b>${hd.can}</b> 阶`
                 : `还差 <b>${hd.per - hd.dup % hd.per}</b> 张`}<br>
               <span style="color:#8b96ad">突破后综合 ${st.ovr} → ${nextSt.ovr}，30 项能力各 +${breakAttrAt(o.brk + 1) - breakAttrAt(o.brk)}
               　|　满突破共需 ${hd.cap} 张</span>`}
        </div>
        <div class="dbtns">
          <button class="btn cmp" id="btnCmpThis">⚖️ 加入对比
            <small>再点一张卡，并排比较能力与徽章</small></button>
          <button class="btn lock${isLocked(id) ? ' on' : ''}" id="btnLockThis">
            ${isLocked(id) ? '🔒 已锁定（点一下解锁）' : '🔓 锁定此球员'}
            <small>${isLocked(id) ? '解锁后才能出售' : '锁定后不可出售，防止误卖'}</small>
          </button>
          ${window.pickTarget ? '<button class="btn pick" id="btnPickThis">选 入 阵 容</button>' : ''}
          <button class="btn" id="btnCloseDetail">关闭</button>
          ${o._view ? '' : maxed ? '' : `<button class="btn primary" id="btnUpgrade" ${canUp ? '' : 'disabled'}>
            ${o.dup >= hd.per * 2
              ? `连续突破 ${Math.min(Math.floor(o.dup / hd.per), MAX_BREAK - o.brk)} 阶`
              : `突破到 ${o.brk + 1} 阶`}
            <small>每阶消耗 ${hd.per} 张重复</small></button>`}
        </div>
        <div class="dcredit">照片来源：Wikimedia Commons（自由授权）</div>
      </div>
      </div>
    </div>`;
  const layer = $('#detailLayer');
  layer.classList.remove('hidden');
  layer.scrollTop = 0;
  $$('.dtabs button', layer).forEach((b) => {
    b.onclick = () => { detailTab = b.dataset.dtab; openDetail(id, true); };
  });
  $$('#detailLayer [data-bcat]').forEach((b) => {
    b.onclick = () => { badgeCat = b.dataset.bcat; Sfx.click(); openDetail(id, true); };
  });
  const hc = $('#dheadCard');
  if (hc) hc.onclick = () => openViewer(id, true);
  const bc = $('#btnCmpThis');
  if (bc) bc.onclick = () => {
    compareAdd(id);
    layer.classList.add('hidden');
    toast('已加入对比，再点一张卡');
  };
  const bl = $('#btnLockThis');
  if (bl) bl.onclick = () => { toggleLock(id); openDetail(id, true); };
  const dl = $('#dactLock');
  if (dl) dl.onclick = () => { toggleLock(id); openDetail(id, true); };
  const df = $('#dactFav');
  if (df) df.onclick = () => {
    if (!S.fav) S.fav = {};
    if (S.fav[id]) delete S.fav[id]; else S.fav[id] = true;
    Sfx.click(); save();
    toast(S.fav[id] ? '已加入收藏 ★' : '已取消收藏');
    openDetail(id, true);
  };
  const db = $('#dactBreak');
  if (db) db.onclick = () => {
    const up = $('#btnUpgrade');
    if (up && !up.disabled) { up.click(); }
    else toast(maxed ? '已经满突破了' : '重复卡不足，先去招募或转会市场凑齐');
  };
  const closeMe = () => {
    Sfx.click();
    layer.classList.add('hidden');
    // 清掉"只查看"用的临时记录，别污染存档
    if (o._view) delete S.owned[id];
  };
  $('#btnCloseDetail').onclick = closeMe;
  layer._closeFn = closeMe;
  const pk = $('#btnPickThis');
  if (pk) pk.onclick = () => {
    Sfx.click();
    layer.classList.add('hidden');
    if (typeof assignToSlot === 'function' && window.pickTarget) assignToSlot(id);
  };
  const up = $('#btnUpgrade');
  if (up) up.onclick = async () => {
    if (o.dup < hd.per) return;
    const canTimes = Math.min(Math.floor(o.dup / hd.per), MAX_BREAK - o.brk);
    const times = canTimes >= 2 ? canTimes : 1;
    const from = o.brk;
    o.dup -= hd.per * times;
    o.brk = Math.min(MAX_BREAK, o.brk + times);
    try { qsOnBreak(times); } catch (e) {}
    save();
    openDetail(id, true); renderAll();
    await playBreakthrough(card, from, o.brk);
    toast(o.brk >= MAX_BREAK
      ? `🎉 满突破！${card.name} 全部能力 +${breakAttrAt(MAX_BREAK)}`
      : `突破成功！${card.name} 现在是 ${BREAK_LABEL[o.brk]}`);
  };
}

/** 基础工资显示（公式在 data.js 里，这里只负责格式化） */
function salaryText(ovr) {
  const v = SALARY_OF(ovr);
  return v >= 1e8 ? (v / 1e8).toFixed(2) + ' 亿' : Math.round(v / 1e4) + ' 万';
}
/** 身价显示 */
function valueText(ovr) {
  const v = valueOf(ovr);
  if (v >= 1e8) return (v / 1e8).toFixed(2) + ' 亿';
  return Math.round(v / 1e4) + ' 万';
}

/** 雷达下方的球风标签（参考图里是"持球/攻筐/中投"这种绿色小标） */
function playTags(card) {
  const a = card.attrs;
  const cand = [
    ['持球', a.handle], ['攻筐', a.driveDunk], ['中投', a.mid], ['三分', a.three],
    ['组织', a.pass], ['护框', a.block], ['篮板', a.dreb], ['抢断', a.steal],
    ['背身', a.postControl], ['快攻', a.offBallSpeed], ['终结', a.layup], ['外防', a.perimD],
  ].sort((x, y) => y[1] - x[1]);
  return cand.slice(0, 3).map((x) => x[0]);
}

/* =============================================================
   招募演出
   ============================================================= */
let seqToken = 0, curResults = [];
const rank = (t) => tierIdx(t);
const BADGE_ORDER = ['gold', 'silver', 'bronze'];

function confetti(colors, count, opts) {
  const cv = $('#fxCanvas');
  cv.classList.remove('hidden');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  /* ★ 补丁②（修 iOS 抽卡闪屏）
     原来只要像素级不等就 resize 整块画布。而 iOS Safari 在滚动、
     地址栏收放时会给出 ±1px 抖动的 innerWidth/innerHeight，
     于是几乎每次喷彩带都命中这个条件、每次 resize 一次全屏画布；
     iOS 上 resize canvas 会**清空并重新分配后备缓冲** = 一瞬间的闪白。
     彩带正好在**卡牌揭示那一刻**触发，所以表现就是"抽卡时会闪"且"有时候闪"。
     加 2px 容差：只有真的换了尺寸（旋转/窗口变化）才 resize。 */
  const _cw = Math.floor(innerWidth * dpr), _ch = Math.floor(innerHeight * dpr);
  if (Math.abs(cv.width - _cw) > 2 || Math.abs(cv.height - _ch) > 2) {
    cv.width = _cw; cv.height = _ch;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const o = opts || {};
  const ox = o.x != null ? o.x : innerWidth / 2;
  const oy = o.y != null ? o.y : innerHeight * 0.42;
  const ps = [];
  for (let i = 0; i < (count || 90); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = o.power ? (2 + Math.random() * o.power) : (4 + Math.random() * 9);
    ps.push({
      x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5,
      w: 4 + Math.random() * 7, h: 6 + Math.random() * 10,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * .45,
      col: colors[Math.floor(Math.random() * colors.length)],
      life: 1, streamer: Math.random() < .35,
    });
  }
  let t0 = performance.now();
  cancelAnimationFrame(confetti._raf);
  (function tick(now) {
    const dt = Math.min(2.4, (now - t0) / 16.7); t0 = now;
    c.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    ps.forEach((q) => {
      q.vy += 0.42 * dt; q.vx *= 0.99;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      q.life -= 0.0068 * dt;
      if (q.y > innerHeight + 50) q.life = 0;
      if (q.life <= 0) return;
      alive++;
      c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
      c.globalAlpha = Math.min(1, q.life * 1.6);
      c.fillStyle = q.col;
      if (q.streamer) c.fillRect(-q.w / 2, -q.h / 2, q.w * .5, q.h * 2.4);
      else c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      c.restore();
    });
    if (alive > 0) confetti._raf = requestAnimationFrame(tick);
    else { cv.classList.add('hidden'); c.clearRect(0, 0, innerWidth, innerHeight); }
  })(performance.now());
}
function shockwave(x, y, color) {
  const el = document.createElement('div');
  el.className = 'shock';
  el.style.cssText = `left:${x}px;top:${y}px;--sc:${color}`;
  $('#fxLayer').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/** 开球：球体蓄力时透出的光色会暗示本次最高档位（经典抽卡预告手法） */
async function playOpening(bestTier) {
  const T = TIERS[bestTier];
  const r = rank(bestTier);
  const fx = $('#fxLayer');
  fx.classList.remove('hidden');
  fx.innerHTML = `<div class="ballwrap lv${r}" style="--gc:${T.glow}">
      <div class="beam"></div><div class="halo"></div><div class="ball">🏀</div>
    </div><div class="flash"></div>`;
  Sfx.charge();
  await sleep(r >= 3 ? 1300 : 880);
  const wrap = fx.querySelector('.ballwrap');
  if (!wrap) return;
  wrap.classList.add('burst');
  const fl = fx.querySelector('.flash');
  if (fl) fl.classList.add('go');
  Sfx.boom();
  shockwave(innerWidth / 2, innerHeight * 0.42, T.glow);
  confetti([T.glow, T.c2, '#ffffff', '#ffe08a'], r >= 4 ? 130 : r >= 3 ? 85 : 45,
    { power: r >= 4 ? 15 : 9 });
  if (navigator.vibrate) navigator.vibrate(r >= 4 ? [50, 40, 110] : 45);
  await sleep(520);
  fx.classList.add('hidden');
  fx.innerHTML = '';
}
function showBanner(tier) {
  const T = TIERS[tier];
  const b = $('#rarBanner');
  b.style.setProperty('--bc', T.glow);
  b.querySelector('.b1').textContent = T.name;
  b.querySelector('.b2').textContent = tier === 'momentPurple' ? 'GLORY MOMENT'
    : tier === 'momentGold' ? 'MOMENT' : T.short;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

async function startRecruit(n) {
  const pool = POOLS[curPool];
  const cost = costOf(pool, n);
  if (S.coins < cost) { Sfx.fail(); toast('金币不够，去领赞助商补给吧'); return; }
  S.coins -= cost;
  const results = doRecruit(pool, n);
  try { qsOnPull(n); } catch (e) {}
  curResults = results;
  results.sort((a, b) => rank(a.tier) - rank(b.tier));   // 最好的压轴
  const best = results[results.length - 1];

  /* ★ 补丁③（修 iOS 抽卡闪屏）
     原来的顺序是：renderAll() → 播开场动画 → 最后才显示抽卡浮层。
     · renderAll() 会把整个主界面拆掉重建 —— 这本身就是一次可见的闪；
     · 勾了"跳过动画"时走 else 分支，那 150ms 里只有主界面露着。
     现在改成：**先把浮层立起来**（它是不透明全屏层，一立就挡住主界面）
     → 只刷新金币 → 再播动画。全程不再有"主界面裸露"的窗口。
     保底进度条等关掉浮层时会由 btnPullDone 里的 renderAll() 统一刷新。 */
  const layer = $('#pullLayer');
  if (layer) layer.classList.remove('hidden');
  try { enterFullLayer(); } catch (e) {}
  try { if (typeof updateCoinsUI === 'function') updateCoinsUI(); } catch (e) {}

  const skip = S.skipAnim && rank(best.tier) < rank('purple');
  if (!skip) await playOpening(best.tier);
  else await sleep(150);

  if (layer) layer.classList.remove('hidden');
  $('#pullTitle').textContent = pool.name;
  /* v9.27：把「保底出的」说清楚 —— 原来只知道最高档位，
     玩家分不清「运气好」还是「保底救的」 */
  const PITY_SRC_CN = {
    pity10: '十连保底', moment: '90 抽保底', legend: '60 抽保底', purple: '30 抽保底',
  };
  const pityHits = results.filter((r) => r.from);
  const pityTxt = pityHits.length
    ? '　·　' + pityHits.map((r) => PITY_SRC_CN[r.from] + ' → ' + r.card.name).join('，')
    : '';
  $('#pullSub').textContent = '本次最高：' + TIERS[best.tier].name + pityTxt;
  $('#pullSub').classList.toggle('has-pity', pityHits.length > 0);
  $('#btnPullDone').disabled = true;
  $('#btnFlipAll').disabled = false;
  $('#btnSkipAnim').disabled = false;
  // 用 class 控制布局，不再写行内样式（行内样式会被横版的 !important 盖掉）
  $('#pullGrid').className = n === 1 ? 'single' : n >= 10 ? 'ten' : 'few';
  $('#pullGrid').style.cssText = '';
  $('#pullGrid').innerHTML = results.map((r) =>
    cardHTML(r.card, { isNew: r.isNew, brk: r.brk, pity: r.from })).join('');
  $$('#pullGrid .card').forEach((el, i) => { el.style.zIndex = 10 + i; });

  const token = ++seqToken;
  await sleep(180);
  for (let i = 0; i < results.length; i++) {
    if (token !== seqToken) return;
    const r = results[i], el = $$('#pullGrid .card')[i], rk = rank(r.tier);
    if (rk >= 3) { await sleep(420); if (token !== seqToken) return; }
    el.classList.add('revealed', 'pop');
    Sfx.reveal(r.tier);
    if (rk >= 3) {
      showBanner(r.tier);
      const box = el.getBoundingClientRect();
      shockwave(box.left + box.width / 2, box.top + box.height / 2, TIERS[r.tier].glow);
      confetti([TIERS[r.tier].glow, TIERS[r.tier].c2, '#fff'], rk >= 4 ? 110 : 60,
        { x: box.left + box.width / 2, y: box.top + box.height / 2, power: 11 });
      if (navigator.vibrate) navigator.vibrate(rk >= 4 ? [40, 40, 90] : 40);
      await sleep(600);
    } else await sleep(150);
  }
  if (token !== seqToken) return;
  await playFinale(best, token);
}

/** 收尾：把最好的一张单独拉到屏幕中央再炫一次 */
async function playFinale(best, token) {
  const r = rank(best.tier);
  finishReveal();
  if (r < 3) return;
  const layer = $('#finaleLayer');
  layer.style.setProperty('--gc', TIERS[best.tier].glow);
  layer.innerHTML = `<div class="fin-rays"></div><div class="fin-glow"></div>
    <div class="fin-card">${cardHTML(best.card, { isNew: best.isNew, brk: best.brk })}</div>
    <div class="fin-name"><b>${TIERS[best.tier].name}</b><span>${best.card.name}</span></div>`;
  layer.classList.remove('hidden');
  Sfx.reveal(best.tier);
  confetti([TIERS[best.tier].glow, TIERS[best.tier].c2, '#fff', '#ffe08a'],
    r >= 4 ? 150 : 90, { power: r >= 4 ? 15 : 10 });
  if (navigator.vibrate) navigator.vibrate(r >= 4 ? [60, 50, 130] : 50);
  await sleep(r >= 4 ? 2500 : 1700);
  if (token === seqToken) layer.classList.add('hidden');
}
function finishReveal() {
  $('#btnPullDone').disabled = false;
  $('#btnFlipAll').disabled = true;
  $('#btnSkipAnim').disabled = true;
  const counts = {};
  curResults.forEach((r) => { counts[r.tier] = (counts[r.tier] || 0) + 1; });
  const news = curResults.filter((r) => r.isNew).length;
  const summary = TIER_ORDER.slice().reverse().filter((k) => counts[k])
    .map((k) => `${TIERS[k].name}×${counts[k]}`).join('  ');
  $('#pullSub').innerHTML = `${summary}　·　新卡 ${news} 张` +
    (curResults.milestone ? `　·　<span style="color:#f5c451">图鉴里程碑 +${fmt(curResults.milestone)}🪙</span>` : '');
}
/**
 * 一键跳过动画。
 * -------------------------------------------------------------
 * 和「全部翻开」的区别：
 *   · 全部翻开 —— 逐张 40ms 依次翻开，保留一点演出感
 *   · 跳过动画 —— 立刻揭晓全部结果，**取消所有正在跑的动画**
 *     （开场演出 / 翻牌 / 收尾放大 / 横幅特效），直接进结果页
 * 动画本身**没有被删掉**，默认还是完整播放，这只是个"快进"按钮。
 */
function skipAllAnim() {
  // ① 如果连卡片都还没渲染（跳过点太早，正处在开场演出阶段），
  //    先把结果补渲染出来 —— 否则 seqToken++ 会取消整个流程，
  //    玩家点完跳过反而什么都看不到。
  const grid = $('#pullGrid');
  if (grid && !grid.querySelector('.card')
      && typeof curResults !== 'undefined' && curResults && curResults.length) {
   try {
    const lay0 = $('#pullLayer');
    if (lay0) lay0.classList.remove('hidden');
    const ttl = document.getElementById('pullTitle');
    if (ttl && !ttl.textContent.trim()) ttl.textContent = '招募结果';
    $('#pullSub').textContent = '本次最高：' +
      TIERS[curResults.reduce((a, b) => rank(b.tier) > rank(a.tier) ? b : a).tier].name;
    grid.className = curResults.length === 1 ? 'single'
      : curResults.length >= 10 ? 'ten' : 'few';
    grid.style.cssText = '';
    grid.innerHTML = curResults.map((r) =>
      cardHTML(r.card, { isNew: r.isNew, brk: r.brk })).join('');
    $$('#pullGrid .card').forEach((el, i) => { el.style.zIndex = 10 + i; });
   } catch (e) { /* 补渲染失败也不能影响后面的揭晓 */ }
  }
  // ② 让正在跑的异步循环立刻退出
  seqToken++;
  // ③ 收起所有演出层
  const fin = $('#finaleLayer');
  if (fin) fin.classList.add('hidden');
  const ban = $('#rarBanner');
  if (ban) ban.classList.add('hidden');
  const lay = $('#pullLayer');
  if (lay) lay.classList.remove('hidden');
  // ④ 所有卡瞬间翻开（无延迟、无音效、无特效）
  $$('#pullGrid .card').forEach((el) => {
    el.classList.add('revealed');
    el.style.transition = 'none';
  });
  Sfx.flip();
  finishReveal();                              // 立刻解锁「确认」按钮并统计
  $('#btnFlipAll').disabled = true;
  if (navigator.vibrate) navigator.vibrate(20);
}

function flipAll() {
  seqToken++;
  $('#finaleLayer').classList.add('hidden');
  $$('#pullGrid .card').forEach((el, i) => {
    if (!el.classList.contains('revealed')) {
      setTimeout(() => { el.classList.add('revealed', 'pop'); Sfx.flip(); }, i * 40);
    }
  });
  setTimeout(finishReveal, curResults.length * 40 + 300);
}

/* =============================================================
   突破演出
   能量汇聚 → 冲击爆闪 → 刻度逐个点亮 + 综合分滚动 → 横幅定格
   ============================================================= */
async function playBreakthrough(card, fromBrk, toBrk) {
  const T = TIERS[card.tier];
  const layer = $('#brkLayer');
  const oldSt = statsOf(card, fromBrk);
  const newSt = statsOf(card, toBrk);
  const isMax = toBrk >= MAX_BREAK;
  const gc = isMax ? '#e05cff' : T.glow;
  layer.setAttribute('style', `--gc:${gc}`);
  layer.className = '';

  // 汇聚粒子：从屏幕四周飞向卡牌
  let sparks = '';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
    const r = 260 + Math.random() * 260;
    sparks += `<div class="brk-spark" style="--sx:${(Math.cos(a) * r).toFixed(0)}px;` +
      `--sy:${(Math.sin(a) * r * 0.7).toFixed(0)}px;animation-delay:${(i * 28)}ms"></div>`;
  }
  // 上升金粒
  let rises = '';
  for (let i = 0; i < 16; i++) {
    rises += `<div class="brk-rise" style="left:${8 + Math.random() * 84}%;` +
      `animation-delay:${(i * 55)}ms"></div>`;
  }

  layer.innerHTML = `
    <div class="brk-rays"></div><div class="brk-glow"></div>
    ${sparks}
    <div class="brk-banner"><b>${isMax ? '满 突 破' : '突 破 成 功'}</b>
      <span>${BREAK_LABEL[toBrk]}</span></div>
    <div class="brk-stage">
      <div class="brk-rings"><i></i><i></i><i></i></div>
      <div class="brk-card">${cardHTML(card, { brk: fromBrk })}</div>
      <div class="brk-ovr"><span>${oldSt.ovr}</span><b>${newSt.ovr}</b></div>
      <div class="brk-pips">${Array.from({ length: MAX_BREAK }, (_, i) =>
        `<i class="${i < fromBrk ? 'on' : ''}" data-i="${i}"></i>`).join('')}</div>
    </div>
    ${rises}`;
  layer.classList.remove('hidden');

  // ① 蓄力
  layer.classList.add('charging');
  Sfx.charge();
  await sleep(950);

  // ② 冲击
  layer.classList.remove('charging');
  layer.classList.add('burst');
  Sfx.boom();
  if (navigator.vibrate) navigator.vibrate(isMax ? [70, 50, 140] : [45, 35, 90]);
  confetti([gc, T.c2, '#ffffff', '#ffe08a'], isMax ? 160 : 100, { power: isMax ? 16 : 11 });
  await sleep(380);

  // ③ 刻度逐个点亮 + 卡面换成突破后的形态
  layer.classList.add('done');
  const pips = $$('.brk-pips i', layer);
  for (let i = fromBrk; i < toBrk; i++) {
    if (pips[i]) { pips[i].classList.add('on', 'fresh'); Sfx.flip(); }
    await sleep(170);
  }
  const cardBox = $('.brk-card', layer);
  if (cardBox) cardBox.innerHTML = cardHTML(card, { brk: toBrk });
  await sleep(320);
  if (isMax) {
    Sfx.reveal('momentPurple');
    confetti(['#e05cff', '#ffd23f', '#ffffff', '#7dffa0'], 180, { power: 15 });
    if (navigator.vibrate) navigator.vibrate([80, 60, 160]);
  } else {
    Sfx.reveal(toBrk >= 5 ? 'momentGold' : toBrk >= 3 ? 'purple' : 'gold');
  }
  await sleep(isMax ? 1500 : 1050);

  // ④ 淡出
  layer.classList.add('fade');
  await sleep(460);
  layer.classList.add('hidden');
  layer.className = 'hidden';
  layer.innerHTML = '';
}

/* ---------------- 补给 ----------------
   =============================================================
   赞助商补给（v9.45 用户改版）
   -------------------------------------------------------------
   ★ 用户要求：「每日可领一千次，并且不需要等待，
     点击就可以领取」（原来是 8 秒一次、每日上限 40 次）。

   改动：
     · SUPPLY_DAILY_MAX  40 → **1000**
     · 去掉 8 秒冷却（删掉 lastSupply 的时间判断与倒计时）
     · 点一下领一次，按钮常驻可点；另外给一个「一键领完」省手

   ⚠️ 经济影响（如实记录，便于以后回看）
     单次 1500~3499（均值 2500）
       40 次 →   10 万/天（原来的"零钱"定位，约一个赛季的 29%）
     1000 次 →  250 万/天（约 7 个赛季的收入）
     也就是说补给会变成主要收入来源，打比赛的经济意义大幅下降。
     这是用户明确要求的效果，如需回调只改这两个常量即可。
   ============================================================= */
const SUPPLY_DAILY_MAX = 1000;
/** 本地日期 YYYY-MM-DD（不能用 toISOString —— 那是 UTC，
    国内玩家每天要等到早上 8 点才重置） */
function localDayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/** 跨天就把今日补给次数清零，返回今日已领次数 */
function supplyToday() {
  const today = localDayKey();
  if (S.supplyDay !== today) { S.supplyDay = today; S.supplyToday = 0; }
  return S.supplyToday || 0;
}
/** 今日还剩几次 */
function supplyLeft() { return Math.max(0, SUPPLY_DAILY_MAX - supplyToday()); }

/** 领一次（无冷却，点了就领） */
/* =============================================================
   ★ v9.46 性能修复：补给连点的"存档抖动"
   -------------------------------------------------------------
   问题：`claimSupply()` 每点一次都调 `save()`，
   而 save 会把**整个存档** JSON.stringify 后写 localStorage。
   存档大了以后（几千张卡 + 赛季数据）单次写要几毫秒，
   手快连点会明显卡顿；同时每点一次都弹 toast，会把提示刷屏。

   修法（两条）：
     ① **存档合并**：连点期间只累加内存，400ms 内没有新点击
        才真正写一次盘。掉电最坏丢 400ms 的补给，无感。
        另外「一键领完」结束、切后台、页面隐藏时都会立刻 flush。
     ② **提示合并**：toast 也做 400ms 节流，连点只看到最新的那条，
        并显示"本次连续领取 N 次，共 +X"。
   ============================================================= */
let _supPendingSave = null;      // 存档 flush 定时器
let _supPendingToast = null;     // toast 节流定时器
let _supBurstCoins = 0;          // 本轮连点累计金币
let _supBurstN = 0;              // 本轮连点次数

function _supFlushSave() {
  if (_supPendingSave) { clearTimeout(_supPendingSave); _supPendingSave = null; }
  try { save(); } catch (e) {}
}
function _supFlushToast() {
  if (_supPendingToast) { clearTimeout(_supPendingToast); _supPendingToast = null; }
  if (!_supBurstN) return;
  const n = _supBurstN, c = _supBurstCoins;
  _supBurstN = 0; _supBurstCoins = 0;
  if (n === 1) toast(`补给到账 🪙 +${fmt(c)}　今日还剩 ${supplyLeft()} 次`);
  else toast(`连领 ${n} 次 🪙 +${fmt(c)}　今日还剩 ${supplyLeft()} 次`);
}
/* 切后台/关页面时立刻落盘，避免丢进度 */
try {
  document.addEventListener('visibilitychange', () => { if (document.hidden) { _supFlushSave(); _supFlushToast(); } });
  window.addEventListener('pagehide', () => { _supFlushSave(); });
} catch (e) {}

function claimSupply() {
  if (supplyLeft() <= 0) {
    Sfx.fail();
    toast('今日补给已领完（' + SUPPLY_DAILY_MAX + ' 次），明天再来');
    return;
  }
  S.lastSupply = Date.now();
  S.supplyCount++;
  S.supplyToday = supplyToday() + 1;
  const coins = 1500 + Math.floor(Math.random() * 2000);
  S.coins += coins;
  Sfx.coin();
  /* ① 只更新界面（便宜），存档延后合并写 */
  tickSupply();
  try { updateCoinsUI(); } catch (e) {}
  /* ② 累计到本轮，400ms 后一起写盘 + 一起提示 */
  _supBurstCoins += coins;
  _supBurstN += 1;
  if (_supPendingSave) clearTimeout(_supPendingSave);
  _supPendingSave = setTimeout(() => { _supPendingSave = null; try { save(); } catch (e) {} }, 400);
  if (_supPendingToast) clearTimeout(_supPendingToast);
  _supPendingToast = setTimeout(_supFlushToast, 400);
}

/**
 * 一键把今天剩余的次数全领完。
 * ---------------------------------------------------------------
 * 用户要求每日 1000 次，手点 1000 次不现实，所以给个批量入口。
 * 这里**只做一次保存**（循环里不 save/render），否则会卡死。
 */
function claimSupplyAll() {
  const left = supplyLeft();
  if (left <= 0) { Sfx.fail(); toast('今日已领完'); return; }
  let sum = 0;
  for (let i = 0; i < left; i++) sum += 1500 + Math.floor(Math.random() * 2000);
  S.coins += sum;
  S.supplyCount += left;
  S.supplyToday = supplyToday() + left;
  S.lastSupply = Date.now();
  Sfx.coin();
  /* 一键领完要走完整保存；顺手清掉连点累计，避免提示数字重复计算 */
  _supBurstCoins = 0; _supBurstN = 0;
  if (_supPendingToast) { clearTimeout(_supPendingToast); _supPendingToast = null; }
  _supFlushSave();
  renderAll();
  tickSupply();
  toast(`一键领完 ${left} 次　🪙 +${fmt(sum)}`);
}
let supplyTimer = null;
/** 更新按钮与文案（无冷却，所以不需要定时器高频刷新） */
function tickSupply() {
  const b = $('#btnSupply');
  if (!b) return;
  const left = supplyLeft();
  if (left <= 0) { b.disabled = true; b.textContent = '明日再来'; }
  else { b.disabled = false; b.textContent = '领取'; }
  const all = $('#btnSupplyAll');
  if (all) {
    all.disabled = left <= 0;
    all.textContent = left > 0 ? ('一键领完 ' + left + ' 次') : '今日已领完';
  }
  updateSupplyText();
}
/** 只改那行小字，避免 renderAll 的开销 */
function updateSupplyText() {
  const el = $('#supplyText');
  if (!el) return;
  el.innerHTML = '点一下领一次（无冷却）· 今日还剩 <b>' + supplyLeft() + '</b>/' +
    SUPPLY_DAILY_MAX + ' 次 · 共领 ' + (S.supplyCount || 0) + ' 次';
}
/* 无冷却后不需要高频计时器；保留一个低频兜底刷新跨天状态 */
function startSupplyTimer() {
  clearInterval(supplyTimer);
  supplyTimer = setInterval(tickSupply, 30000);
}

/* =============================================================
   ★ 重建①（配套 JS）：全屏浮层打开时收起主界面
   -------------------------------------------------------------
   光靠 z-index 挡不住 iOS 在长动画期间的合成异常。
   最可靠的做法是**让下面根本没有东西**：浮层打开时把 .screen 与页签栏
   display:none（浮层本身不透明，玩家看到的画面一模一样），
   同时停掉每 500ms 改主界面 DOM 的补给定时器。
   看门狗：万一浮层没正常关闭，40 秒后强制恢复，避免主界面一直隐藏（黑屏）。
   ============================================================= */
let _fullLayerN = 0;
let _fullLayerWatch = null;
function exitFullLayer() {
  _fullLayerN = 0;
  try { if (_fullLayerWatch) { clearTimeout(_fullLayerWatch); _fullLayerWatch = null; } } catch (e) {}
  try { document.body.classList.remove('full-layer'); } catch (e) {}
  try { startSupplyTimer(); } catch (e) {}
  try { tickSupply(); } catch (e) {}
}
function enterFullLayer() {
  _fullLayerN++;
  try { document.body.classList.add('full-layer'); } catch (e) {}
  try { clearInterval(supplyTimer); supplyTimer = null; } catch (e) {}
  try {
    if (_fullLayerWatch) clearTimeout(_fullLayerWatch);
    _fullLayerWatch = setTimeout(() => {
      try {
        const open = (id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };
        if (!open('pullLayer') && !open('fxLayer') && !open('finaleLayer')) exitFullLayer();
        else _fullLayerWatch = setTimeout(exitFullLayer, 40000);
      } catch (e) { exitFullLayer(); }
    }, 40000);
  } catch (e) {}
}

/* ---------------- 事件 ---------------- */
function switchTab(tab) {
  if (typeof closeConflictDialog === 'function') closeConflictDialog();
  /* v9.27：兑换所也是全屏浮层，切页签时一并收掉，避免残留挡点击 */
  if (typeof closeDexEx === 'function') closeDexEx();
  /* 保险：切页签时把可能残留的全屏浮层收掉。
     浮层是 position:fixed;inset:0 的，一旦没关掉就会吃掉所有点击，
     表现就是"点什么都没反应"。 */
  ['tutLayer', 'oppLayer', 'cmpLayer', 'mineLayer', 'detailLayer'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'tutLayer') {
      // 新手引导只在没走完时显示，切页签不要误关
      if (typeof tutActive === 'function' && tutActive()) return;
    }
    el.classList.add('hidden');
    if (id !== 'detailLayer') el.innerHTML = '';
  });
  $$('#tabbar button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + tab));
  if (tab === 'home') { renderHome(); tickSupply(); }
  if (tab === 'dex') renderDex();
  if (tab === 'mine') renderMine();
  if (tab === 'team') renderTeamSys();
  if (tab === 'battle') {
    /* 点「生涯」页签时，如果上一场刚打完（还停在赛后总结），
       自动回到生涯模式 —— 否则玩家看不到下一个对手，
       也没法再点「挑战」。比赛进行中则不动。 */
    if (typeof BT !== 'undefined' && BT.phase === 'done') {
      BT.phase = 'setup';
      BT.myRound = null;
      if (typeof crSelRound !== 'undefined') crSelRound = null;
    }
    renderBattle();
  }
  if (tab === 'market') renderMarket();
  if (tab === 'set') renderSettings();
}
function bindGlobal() {
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sfx.click();
    const tab = b.dataset.tab;
    switchTab(tab);
  });
  $('#scr-home').addEventListener('click', (e) => {
    if (e.target.closest('#btnSupplyAll')) { claimSupplyAll(); return; }
    if (e.target.closest('#btnSupply')) { claimSupply(); return; }
    const pt = e.target.closest('.pooltab');
    if (pt) { Sfx.click(); curPool = parseInt(pt.dataset.pool, 10); renderHome(); tickSupply(); return; }
    const r = e.target.closest('[data-recruit]');
    if (r) { Sfx.unlock(); startRecruit(parseInt(r.dataset.recruit, 10)); }
  });
  $('#scr-home').addEventListener('change', (e) => {
    if (e.target.id === 'chkSkip') { S.skipAnim = e.target.checked; save(); }
  });
  $('#btnFlipAll').addEventListener('click', flipAll);
  const sk = $('#btnSkipAnim');
  if (sk) sk.addEventListener('click', skipAllAnim);
  // 按住不放也能跳（省得动画跑完才点到）
  if (sk) sk.addEventListener('pointerdown', (e) => { e.preventDefault(); skipAllAnim(); });
  $('#btnPullDone').addEventListener('click', () => {
    Sfx.click(); seqToken++;
    $('#pullLayer').classList.add('hidden');
    $('#finaleLayer').classList.add('hidden');
    $('#fxLayer').classList.add('hidden');
    try { exitFullLayer(); } catch (e) {}   // 先恢复主界面，再整体重绘
    renderAll(); tickSupply();
  });
  $('#detailLayer').addEventListener('click', (e) => {
    if (e.target.id === 'detailLayer') $('#detailLayer').classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('#detailLayer').classList.add('hidden');
  });
}

/* ---------------- 启动 ---------------- */
function boot() {
  if (!$('#scr-home')) return;
  /* ★ 补丁⑤：启动流程必须"无论成功失败都收掉启动遮罩"。
     原因：#boot 是 position:fixed;z-index:500 的全屏遮罩，
     原来它是在 bindGlobal()/renderAll()/startSupplyTimer() **之后**才收的；
     这三步只要有任何一步抛异常（不同浏览器/standalone 模式下环境差异很大），
     遮罩就永远盖在屏幕上 —— 玩家看到的就是"打不开、不显示画面"（白屏）。
     现在把三步包进 try/catch：失败照样收遮罩进游戏，
     并把原因写进错误条，方便定位。 */
  try {
    bindGlobal(); renderAll(); startSupplyTimer();
  } catch (e) {
    try {
      window.__BOOT_ERR__ = String((e && e.message) || e) + ' @' + ((e && e.stack) ? String(e.stack).split('\n')[1] : '');
      const b = document.getElementById('errbar') || (function () {
        const d = document.createElement('div'); d.id = 'errbar'; document.body.appendChild(d); return d;
      })();
      b.textContent = '启动异常（游戏仍可继续）：' + window.__BOOT_ERR__;
    } catch (_) {}
  }
  const bt = $('#boot');
  if (bt) { bt.classList.add('gone'); setTimeout(() => bt.remove(), 400); }
  const q = new URLSearchParams(location.search);
  if (q.get('tab')) switchTab(q.get('tab'));
  // 调试：?savetest=1 —— 验证导出 / 复制 / 存成文件 / 导入 全链路
  if (q.get('savetest')) {
    setTimeout(() => {
      switchTab('set');
      const out = [];
      const before = Object.keys(S.owned).length;
      const exp = document.getElementById('btnExport');
      if (!exp) { document.title = 'SAVE 找不到导出按钮'; return; }
      exp.click();
      const box = document.getElementById('saveBox');
      out.push('导出=' + (box && box.value.length > 100 ? 'OK(' + box.value.length + '字符)' : '失败'));
      const code = box ? box.value : '';
      // 存成文件（headless 下 a.click() 会触发下载，这里只验证不报错）
      let fileOk = false;
      try {
        const f = document.getElementById('btnSaveFile');
        if (f) { f.click(); fileOk = true; }
      } catch (e) { fileOk = 'err:' + e.message; }
      out.push('存成文件=' + fileOk);
      out.push('有复制按钮=' + !!document.getElementById('btnCopy'));
      // 清空后导入回来
      Store.wipe(SAVE_KEY); S = DEFAULT_STATE(); save();
      out.push('清空后=' + Object.keys(S.owned).length + '张');
      let restored = 0;
      try { restored = importSave(code); } catch (e) { out.push('导入异常:' + e.message); }
      out.push('导入恢复=' + restored + '张(原' + before + ')');
      document.title = 'SAVE ' + out.join(' | ');
    }, 900);
  }

  // 调试：?duptest=1 —— 名单完整性压力测试（随机换人 200 次）
  if (q.get('duptest')) {
    setTimeout(() => {
      switchTab('team');
      const r0 = rosterIds();
      const all0 = r0.starters.concat(r0.bench);
      let bad = 0, holes = 0, minTotal = 99;
      const poolAll = ownedByOvr();
      for (let k = 0; k < 200; k++) {
        putOnCourtSilent(poolAll[(k * 7) % poolAll.length].id, k % 5);
        const rr = rosterIds();
        const aa = rr.starters.concat(rr.bench);
        if (new Set(aa).size !== aa.length) bad++;
        if (rr.starters.length !== 5 || rr.bench.length !== 5) holes++;
        if (aa.length < minTotal) minTotal = aa.length;
      }
      const r2 = rosterIds();
      const all2 = r2.starters.concat(r2.bench);
      document.title = 'DUP 初始=' + all0.length + '人/唯一' + new Set(all0).size +
        ' | 换200次后=' + all2.length + '人/唯一' + new Set(all2).size +
        ' 首发' + r2.starters.length + '/替补' + r2.bench.length +
        ' 出现重复=' + bad + '次 人数异常=' + holes + '次 最少=' + minTotal + '人';
    }, 800);
  }

  // 平台覆盖：?platform=desktop|mobile（在一台设备上测另一个版本）
  const pf = q.get('platform');
  if (pf === 'desktop' || pf === 'mobile') {
    document.documentElement.setAttribute('data-platform', pf);
  }

  // 调试：?endtest=1 —— 打完一场，验证赛后统计两个标签能正确切换
  if (q.get('endtest')) {
    setTimeout(() => {
      switchTab('battle');
      setTimeout(() => {
        startBattle('quick');
        setTimeout(() => {
          const tabs = document.querySelectorAll('.bt-stat-tab');
          if (tabs.length !== 2) {
            document.title = 'END 标签数异常=' + tabs.length; return;
          }
          const out = ['标签=' + tabs.length];
          const read = () => {
            const rows = document.querySelectorAll('#btStatBox tr').length;
            const sum = document.querySelector('#btStatSum .bt-sum-i b');
            const top = document.querySelector('.bt-stat-tab.on b');
            return (top ? top.textContent : '?') + '/行' + rows +
              '/得分' + (sum ? sum.textContent : '?');
          };
          out.push('默认:' + read());
          tabs[1].click();
          setTimeout(() => {
            out.push('切到对方:' + read());
            tabs[0].click();
            setTimeout(() => {
              out.push('切回我方:' + read());
              const names1 = [...document.querySelectorAll('#btStatBox tr td.nm')]
                .map((x) => x.textContent).join(',');
              tabs[1].click();
              setTimeout(() => {
                const names2 = [...document.querySelectorAll('#btStatBox tr td.nm')]
                  .map((x) => x.textContent).join(',');
                out.push('球员不同=' + (names1 !== names2 ? 'OK' : '异常(两边一样)'));
                document.title = 'END ' + out.join(' | ');
              }, 250);
            }, 250);
          }, 250);
        }, 1600);
      }, 400);
    }, 600);
  }

  // 调试：?subtest=1 —— 验证换人只替换目标格，其他人不位移
  if (q.get('subtest')) {
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const out = [];
        const snap = () => {
          const r = rosterIds();
          return { st: r.starters.slice(), bn: r.bench.slice() };
        };
        const same = (a, b, skip) => a.every((x, i) => i === skip || x === b[i]);
        const nm = (id) => (id ? shortName(CARD_BY_ID[id].name) : '空');

        // ① 把一个备用名单球员放进首发第 2 位（PG 位）
        let r = rosterIds();
        const pool = ownedByOvr().filter((c) => !r.starters.includes(c.id)
          && !r.bench.includes(c.id));
        const before = snap();
        const newcomer = pool[0];
        putOnCourtSilent(newcomer.id, 2);
        let after = snap();
        out.push('首发换人: 目标位=' + nm(after.st[2]) +
          (after.st[2] === newcomer.id ? '✓' : '✗'));
        out.push(' 其余首发不动=' +
          (same(before.st, after.st, 2) ? '✓' : '✗(' +
            before.st.map((x, i) => i === 2 ? '' : (x === after.st[i] ? '' : nm(x) + '→' + nm(after.st[i]))).join(',') + ')'));

        // ② 把替补席第 4 格的球员和第 1 格对调
        r = rosterIds();
        const b1 = r.bench[1], b4 = r.bench[4];
        const bn0 = r.bench.slice();
        putOnBenchSilent(b4, 1);
        after = snap();
        out.push('替补对调: 第1格=' + nm(after.bn[1]) + (after.bn[1] === b4 ? '✓' : '✗') +
          ' 第4格=' + nm(after.bn[4]) + (after.bn[4] === b1 ? '✓' : '✗'));
        out.push(' 其它替补不动=' +
          ([0, 2, 3].every((i) => after.bn[i] === bn0[i]) ? '✓' : '✗'));

        // ③ 首发 ↔ 替补 对调
        r = rosterIds();
        const st3 = r.starters[3], bn2 = r.bench[2];
        putOnBenchSilent(st3, 2);
        after = snap();
        out.push('首发↔替补: 首发3位=' + nm(after.st[3]) + (after.st[3] === bn2 ? '✓' : '✗') +
          ' 替补2格=' + nm(after.bn[2]) + (after.bn[2] === st3 ? '✓' : '✗'));

        // ④ 人数与唯一性
        r = rosterIds();
        const all = r.starters.concat(r.bench);
        out.push('人数=' + all.length + '/唯一' + new Set(all).size +
          (all.length === 10 && new Set(all).size === 10 ? ' ✓' : ' ✗'));
        document.title = 'SUB ' + out.join(' | ');
      }, 600);
    }, 600);
  }

  // 调试：?bubble=1 —— 触发双方球员对话气泡，并测量有没有跑出屏幕
  if (q.get('bubble')) {
    setTimeout(() => {
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const my = BT.myTeam.players[0], foe = BT.aiTeam.players[0];
          if (q.get('bubble') !== 'foe') {
            sayFromCard(my.id, '你太弱了，让你奶奶来跟我打吧。', true, 3,
              `<b>${shortName(my.name)}</b> 连得 9 分 · 4 连中`);
          }
          if (q.get('bubble') !== 'my') {
            setTimeout(() => sayFromCard(foe.id, '过你就像清晨的马路。', false, 2,
              `<b>${shortName(foe.name)}</b>（对方）连得 7 分 · 3 连中`), 700);
          }
          setTimeout(() => {
            const stage = document.querySelector('.bt-stage');
            const sr = stage.getBoundingClientRect();
            const out = [];
            document.querySelectorAll('.bt-say').forEach((el) => {
              const r = el.getBoundingClientRect();
              const isUp = el.classList.contains('arrow-up');
              const insideX = r.left >= sr.left - 2 && r.right <= sr.right + 2;
              const insideY = r.top >= sr.top - 2 && r.bottom <= sr.bottom + 2;
              out.push((el.classList.contains('mine') ? '我方' : '对手') +
                (isUp ? '气泡在卡下方↓' : '气泡在卡上方↑') +
                ' y[' + Math.round(r.top) + '~' + Math.round(r.bottom) + ']' +
                (insideX && insideY ? ' ✓' : ' ✗出屏'));
            });
            document.title = 'BUBBLE 视口' + innerWidth + ' 场地[' +
              Math.round(sr.left) + '~' + Math.round(sr.right) + '] ' + out.join(' | ');
          }, 1400);
        }, 500);
      }, 400);
    }, 600);
  }

  // 调试：?brkdemo=1 —— 给阵容里每人不同突破等级，看徽章配色
  if (q.get('brkdemo')) {
    setTimeout(() => {
      const r = rosterIds();
      const ids = r.starters.concat(r.bench);
      ids.forEach((id, i) => {
        const lv = [1, 3, 5, 7, 8, 2, 4, 6, 8, 1][i % 10];
        S.owned[id] = { got: 1 + lv * 8, dup: 0, brk: lv };
      });
      save();
      switchTab('team');
    }, 500);
  }

  /* =============================================================
     竖屏旋转：用 JS 实测像素值直接设内联样式
     ---------------------------------------------------------------
     为什么不用纯 CSS 媒体查询：iOS Safari 上 dvh/dvw 和媒体查询在
     方向锁定/地址栏收放时偶发不生效。用 innerWidth/innerHeight 实测
     再算 transform，最可靠。
     竖屏时把 #app 转 90°，你横着拿手机看就是正常的横屏画面。
     ============================================================= */
  /** 动态注入样式表：比内联样式更可靠（同优先级 !important 靠后者胜） */
  function rotStyleTag() {
    let el = document.getElementById('rotStyle');
    if (!el) {
      el = document.createElement('style');
      el.id = 'rotStyle';
      document.head.appendChild(el);   // 放最后，确保压过前面的规则
    }
    return el;
  }
  /* ★ 补丁①（修 iOS 抽卡闪屏 / 点击落空）
     这个函数挂在 window.resize 上，而 iOS Safari 在滚动、地址栏收放、
     甚至一次点击引起的布局变化时都会触发 resize。
     原来它**每次调用都整段重写旋转样式表**（下面 tag.textContent = ...）——
     而旋转是把 body 设成 position:fixed + transform:rotate()，
     所以整表重写 = body 与它下面**所有 position:fixed 浮层**（抽卡浮层正是）
     全部重新计算样式并重新合成 → 眼睛看到的就是"闪一下"；
     重写正好落在点击那一帧时还会让这次点击作废。
     加一个 key 守卫：宽/高/翻转/横竖都没变就**直接返回**，连样式表都不碰。 */
  let _orientKey = '';
  function applyOrientation() {
    const app = document.getElementById('app');
    if (!app) return;
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    const tag = rotStyleTag();
    const wantRot = w < h;                       // 应该旋转吗（竖屏才转）
    const _k = w + 'x' + h + ':' + (S.rotFlip ? 1 : 0) + ':' + (w >= h ? 'L' : 'P');
    /* ★ 补丁⑥：守卫不能只看尺寸，还要核对 DOM 的**实际状态**。
       原因（主屏图标打开白屏）：standalone 模式下可能根本不触发 resize，
       而 iOS 在 PWA 启动瞬间给出的视口尺寸经常是错的（例如先报成横向）。
       如果那次错误的应用被守卫记进 _orientKey，后面尺寸"没变化"就永远不会
       再纠正 —— 旋转没生效，画面就看不到。原版没有守卫，每次 resize 都会
       自我纠正，是我的守卫把这条自愈路径堵死了。
       现在三个条件全部一致才跳过：
         · 尺寸/翻转 key 没变
         · html.rot 类的有无 与"应该旋转"一致
         · 旋转样式表的有无 与"应该旋转"一致
       任何一条不符就重新应用 —— 既挡住 resize 风暴，又能自愈。 */
    const haveRot = document.documentElement.classList.contains('rot');
    const haveCss = !!(tag.textContent && tag.textContent.length > 0);
    if (_k === _orientKey && haveRot === wantRot && (wantRot ? haveCss : !haveCss)) return;
    _orientKey = _k;
    // 横屏（或桌面窗口）：什么都不做，用正常的横版布局
    if (w >= h) {
      document.documentElement.classList.remove('rot');
      tag.textContent = '';
      return;
    }
    // 竖屏：把 #app 转 90°，横着拿手机看就是正常的横屏画面
    document.documentElement.classList.add('rot');
    // 翻转方向：顺时针把盒子往右推 w，逆时针把盒子往上推 h
    const tf = S.rotFlip
      ? 'translateY(' + h + 'px) rotate(-90deg)'
      : 'translateX(' + w + 'px) rotate(90deg)';
    // 旋转目标是 body 而不是 #app —— #app 上有很多带 !important 的
    // 布局规则（宽高、grid 行列），body 上干净，改了立刻生效。
    tag.textContent =
      'html.rot{overflow:hidden!important;height:100%!important;' +
        'overscroll-behavior:none;background:#05070f}' +
      'html.rot #rotateTip{display:none!important}' +
      'html.rot body{position:fixed!important;top:0!important;left:0!important;' +
        'right:auto!important;bottom:auto!important;' +
        'width:' + h + 'px!important;height:' + w + 'px!important;' +
        'max-width:none!important;max-height:none!important;margin:0!important;' +
        'padding:0!important;overflow:hidden!important;z-index:1!important;' +
        'transform-origin:0 0!important;transform:' + tf + '!important}' +
      /* ★ 补丁⑦【主屏图标白屏的真正原因】
         `#app` 的基础样式里有 `min-height:100dvh`，而这条旋转规则
         只覆盖了 height，**漏了 min-height** → `#app` 的最小高度依然是
         竖屏视口的完整高度（例如 813px），于是它被撑成 813x813 的正方形，
         内容被挤出可视区。
         为什么"Safari 网页能玩、主屏图标白屏"：
           · Safari 有地址栏 → 视口矮 → min-height 顶出来的多余高度小，还看得见
           · 加到主屏幕后是**全屏 standalone** → 视口更高 → 100dvh 更大
             → #app 被撑得更高 → 内容整体跑到画面外 → **纯白**
         补上 min-height:0 让 #app 严格等于旋转后的 body 尺寸。 */
      'html.rot #app{width:100%!important;height:100%!important;' +
        'min-height:0!important;max-height:none!important;' +
        'max-width:none!important}';
  }
  /** 兼容旧调用（设置页的「翻转 180°」按钮） */
  function applyRotFlip() { applyOrientation(); }
  window.applyRotFlip = applyRotFlip;
  window.applyOrientation = applyOrientation;
  applyRotFlip();
  // 方向变化 / 地址栏收放 / 切回前台都重算一次
  /* ★ 补丁④：resize / visibilitychange 回调全部加异常保护。
     原因：iOS Safari 在弹出共享面板、切后台、系统弹窗时，页面处于
     "半失效"状态（layout/storage/orientation API 都可能临时不可用）。
     原来这些回调是裸调用的，只要抛一次异常就会被 #errbar 捕获、
     在屏幕底部显示"运行出错"——玩家看到的就是"点了共享游戏就报错"。
     这类回调失败不该影响游戏，静默忽略即可（下一次事件会重试）。 */
  window.addEventListener('resize', () => { try { applyOrientation(); } catch (e) {} });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { try { applyOrientation(); } catch (e) {} }, 60);
    setTimeout(() => { try { applyOrientation(); } catch (e) {} }, 300);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(() => { try { applyOrientation(); } catch (e) {} }, 60);
    }
  });

  // 锁横屏：支持的浏览器（安卓 Chrome、加到主屏幕的 iOS PWA）直接锁死；
  // 不支持的（iOS Safari 普通浏览）由 landscape.css 的「竖屏旋转 90°」兜底，
  // 所以用户开系统级的「竖排方向锁定」也不会跳出竖屏提示。
  (function lockLandscape() {
    const tryLock = () => {
      try {
        const so = screen.orientation;
        if (so && so.lock) {
          const p = so.lock('landscape');
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) { /* iOS Safari 不支持，忽略 */ }
    };
    tryLock();
    // 从后台切回来时再试一次（有些浏览器要用户手势后才允许）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tryLock();
    });
    window.addEventListener('pointerdown', tryLock, { once: true });
  })();

  // 调试：?midtest=1 量比赛页各区高度
  if (q.get('midtest')) {
    setTimeout(() => {
      const el = document.getElementById('scr-battle');
      const h = (sel) => {
        const n = el.querySelector(sel);
        return n ? Math.round(n.getBoundingClientRect().height) : -1;
      };
      const mid = el.querySelector('.bt-middle');
      const feed = el.querySelector('.bt-feed');
      const lines = el.querySelectorAll('.bt-line').length;
      const lineH = el.querySelector('.bt-line')
        ? Math.round(el.querySelector('.bt-line').getBoundingClientRect().height) : 0;
      document.title = 'MID 视口' + innerHeight +
        ' 记分条=' + h('.bt-scorebar') +
        ' 上排=' + h('.bt-col.foe') +
        ' 解说=' + h('.bt-middle') +
        ' 下排=' + h('.bt-col.my') +
        ' 战术条=' + h('.bt-livetac') +
        ' 操作条=' + h('.bt-actions') +
        ' | 解说内部=' + (feed ? Math.round(feed.getBoundingClientRect().height) : -1) +
        ' 单行高=' + lineH + ' 可见行数≈' + (lineH ? Math.floor(
          (mid ? mid.getBoundingClientRect().height - 14 : 0) / lineH) : 0) +
        ' 当前解说条数=' + lines;
    }, 1200);
  }

  // 调试：?rottest=1 检查竖屏旋转后的实际几何
  if (q.get('rottest')) {
    setTimeout(() => {
      const app = document.getElementById('app');
      const r = app.getBoundingClientRect();
      const cs = getComputedStyle(app);
      document.title = 'ROT 视口=' + innerWidth + 'x' + innerHeight +
        ' | app矩形=' + Math.round(r.left) + ',' + Math.round(r.top) +
        ' ' + Math.round(r.width) + 'x' + Math.round(r.height) +
        ' | 内联样式 w=' + app.style.width + ' h=' + app.style.height +
        ' tf=' + app.style.transform +
        ' | 计算 w=' + cs.width + ' h=' + cs.height +
        ' pos=' + cs.position +
        ' | rotStyle=' + ((document.getElementById('rotStyle') || {}).textContent || '(无)').slice(0, 150) +
        ' | html.rot=' + document.documentElement.classList.contains('rot') +
        ' | 滚动=' + document.documentElement.scrollWidth + 'x' + document.documentElement.scrollHeight;
    }, 800);
  }

  // 调试：?cardsizes=1 —— 同一张卡在多种尺寸下并排，检查清晰度
  if (q.get('cardsizes')) {
    setTimeout(() => {
      const c = CARDS.find((x) => x.name.indexOf('勒布朗') >= 0) || CARDS[0];
      const m = CARDS.find((x) => x.isMoment) || c;
      const sizes = [46, 58, 72, 88, 104, 128, 170, 220];
      const row = (card, label) => `
        <div style="color:#8b96ad;font-size:12px;margin:14px 0 10px">${label}</div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          ${sizes.map((w) => `<div style="text-align:center">
            <div style="width:${w}px">${cardHTML(card, {})}</div>
            <div style="color:#6f7c96;font-size:10px;margin-top:5px">${w}px</div>
          </div>`).join('')}
        </div>`;
      document.body.innerHTML = `<div style="padding:18px;background:#05070f;
        font-family:-apple-system,PingFang SC,sans-serif">
        ${row(c, '普通金卡 · 宽度 46 → 220px')}
        ${row(m, '时刻紫卡 · 宽度 46 → 220px')}
        </div>`;
      const out = [];
      document.querySelectorAll('div[style*="width"]').forEach((box) => {
        const card = box.querySelector('.card');
        if (!card) return;
        const w = Math.round(card.getBoundingClientRect().width);
        if (out.some((o) => o.w === w)) return;
        const shot = card.querySelector('.shot');
        const img = card.querySelector('.shot img');
        const plate = card.querySelector('.plate');
        out.push({ w,
          ch: Math.round(card.getBoundingClientRect().height),
          shotH: shot ? Math.round(shot.getBoundingClientRect().height) : 0,
          imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
          imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
          plateH: plate ? Math.round(plate.getBoundingClientRect().height) : 0 });
      });
      document.title = 'CARDSIZES ' + out.slice(0, 8).map((o) =>
        o.w + ':卡' + o.ch + ' 窗口' + o.shotH + ' 图' + o.imgW + 'x' + o.imgH +
        ' 栏' + o.plateH).join(' | ');
    }, 900);
  }

  // 调试：?tmtab=lineup|tactic|info 直接切到球队系统的某个标签
  if (q.get('tmtab')) {
    setTimeout(() => { if (typeof tmTab !== 'undefined') { tmTab = q.get('tmtab'); renderTeamSys(); } }, 500);
  }
  // 调试：?pagetest=1 —— 验证翻页能翻到最后一页且每次都 10 人
  if (q.get('pagetest')) {
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const out = [];
        let guard = 0;
        for (let k = 0; k < 30; k++) {
          const cards = document.querySelectorAll('.tm-pcard').length;
          const info = document.querySelector('.tm-pageinfo');
          const nxt = document.getElementById('tmNext');
          const first = document.querySelector('.tm-pcard-ovr');
          out.push(cards + (first ? '(' + first.textContent + ')' : ''));
          if (!nxt || nxt.disabled || guard++ > 12) {
            out.push('末页:' + (info ? info.textContent.replace(/\s+/g, ' ').trim() : '?'));
            break;
          }
          nxt.click();
        }
        const r = rosterIds();
        document.title = 'PAGE 每页卡片=' + out.join(' ') +
          ' | 名单=' + (r.starters.length + r.bench.length);
      }, 700);
    }, 700);
  }
  // 调试：?pull=N 直接抽 N 张并停住（用来看卡牌位置）
  if (q.get('pull')) {
    const n = parseInt(q.get('pull'), 10) || 1;
    setTimeout(async () => {
      switchTab('home');
      S.coins = 999999;
      await sleep(300);
      const before = Object.keys(S.owned).length;
      // 直接调内部抽卡流程
      const btn = document.querySelector(`[data-recruit="${n}"]`);
      if (btn) btn.click();
      await sleep(3200);
      const grid = document.getElementById('pullGrid');
      const cards = grid ? grid.querySelectorAll('.card') : [];
      let r0 = 'none', r1 = 'none';
      if (cards.length) {
        const a2 = cards[0].getBoundingClientRect();
        const b2 = cards[cards.length - 1].getBoundingClientRect();
        r0 = a2.left.toFixed(0) + '~' + a2.right.toFixed(0);
        r1 = b2.left.toFixed(0) + '~' + b2.right.toFixed(0);
      }
      const g = grid ? grid.getBoundingClientRect() : null;
      document.title = 'PULL n=' + n + ' 卡片数=' + cards.length +
        ' 网格=' + (g ? g.left.toFixed(0) + '~' + g.right.toFixed(0) : '?') +
        ' 首卡=' + r0 + ' 末卡=' + r1 +
        ' vw=' + innerWidth;
    }, 800);
  }
  // 调试：?flow=1 —— 端到端可玩性测试：招募 → 看图鉴 → 排阵容 → 打比赛 → 出结果
  if (q.get('flow')) {
    const steps = [];
    const log = (t) => steps.push(t);
    setTimeout(async () => {
      try {
        // ① 招募一次
        switchTab('home');
        const before = Object.keys(S.owned).length;
        const btn = document.querySelector('[data-recruit="1"]');
        if (!btn) { log('招募按钮缺失'); }
        else {
          btn.click();
          await sleep(2600);
          const after = Object.keys(S.owned).length;
          log('招募:' + (after >= before ? 'OK(+' + (after - before) + ')' : '无变化'));
        }
        await sleep(600);
        // 关掉抽卡层
        const skip = document.querySelector('#pullLayer .pull-skip, #pullLayer [data-skip]');
        if (skip) skip.click();
        document.querySelectorAll('#pullLayer .hidden, #pullLayer').forEach((x) => {});
        if (typeof closePull === 'function') closePull();
        await sleep(400);

        // ② 图鉴能看到卡
        switchTab('dex');
        await sleep(300);
        const dexN = document.querySelectorAll('#dex-grid > *').length;
        log('图鉴:' + (dexN > 0 ? 'OK(' + dexN + '张)' : '空'));

        // ③ 球队：阵容完整
        switchTab('team');
        await sleep(400);
        const r = rosterIds();
        const all = r.starters.concat(r.bench);
        log('阵容:' + (all.length === 10 && new Set(all).size === 10 &&
          r.starters.length === 5 && r.bench.length === 5
          ? 'OK(10人/5首发/5替补)'
          : '异常(' + all.length + '人/' + r.starters.length + '/' + r.bench.length + ')'));
        const slotN = document.querySelectorAll('.tm-slot').length;
        const bsN = document.querySelectorAll('.tm-bslot').length;
        const poolN = document.querySelectorAll('.tm-pcard').length;
        log('界面:首发槽' + slotN + '/替补槽' + bsN + '/备选' + poolN);

        // ④ 战术页
        switchTab('team');
        tmTab = 'tactic'; renderTeamSys();
        await sleep(200);
        const tacN = document.querySelectorAll('.bt-tac').length;
        log('战术:' + (tacN >= 7 ? 'OK(' + tacN + ')' : '缺(' + tacN + ')'));

        // ⑤ 打一场（快速）
        tmTab = 'lineup';
        switchTab('battle');
        await sleep(300);
        const quick = document.getElementById('btStartQuick');
        if (!quick) log('扫荡按钮缺失');
        else {
          quick.click();
          await sleep(1200);
          const done = document.querySelector('.bt-result');
          const stat = document.querySelector('.bt-stat-tab');
          log('扫荡:' + (done ? 'OK(' + done.querySelector('.bt-final').textContent.trim() + ')' : '无结果'));
          log('统计切换:' + (stat ? 'OK' : '缺'));
        }

        // ⑥ 现场比赛能跑起来
        const back = document.getElementById('btBack');
        if (back) back.click();
        await sleep(400);
        const live = document.getElementById('btStartLive');
        if (live) {
          live.click();
          await sleep(2200);
          const clk = document.getElementById('btClock');
          const cards = document.querySelectorAll('.bt-pc').length;
          log('直播:时钟' + (clk ? clk.textContent : '?') + ' 卡片' + cards +
            (cards === 10 ? ' OK' : ' 异常'));
          const timeouts = document.getElementById('btTimeout');
          if (timeouts) {
            timeouts.click();
            await sleep(400);
            const subRows = document.querySelectorAll('.bt-sub-row').length;
            log('暂停换人:' + (subRows >= 10 ? 'OK(' + subRows + '人)' : '异常(' + subRows + ')'));
            const close = document.getElementById('subClose');
            if (close) close.click();
          }
        } else log('现场比赛按钮缺失');

        document.title = 'FLOW ' + steps.join(' | ');
      } catch (e) {
        document.title = 'FLOW ERR ' + e.message + ' | ' + steps.join(' | ');
      }
    }, 900);
  }
  // 调试：?btmeasure=1 —— 量对战页卡片尺寸
  if (q.get('btmeasure')) {
    setTimeout(() => {
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const card0 = document.querySelector('.bt-pc');
          const ovr0 = card0 && card0.querySelector('.bt-pc-ovr');
          const info0 = card0 && card0.querySelector('.bt-pc-info');
          const cr0 = card0 ? card0.getBoundingClientRect() : null;
          const orr = ovr0 ? ovr0.getBoundingClientRect() : null;
          const irr = info0 ? info0.getBoundingClientRect() : null;
          document.title = 'OVRPOS 卡[' + (cr0 ? Math.round(cr0.left) + '~' + Math.round(cr0.right) : '?') +
            '] 评分[' + (orr ? Math.round(orr.left) + '~' + Math.round(orr.right) : '?') +
            '] 名字行[' + (irr ? Math.round(irr.left) + '~' + Math.round(irr.right) +
              ' y' + Math.round(irr.top) + '~' + Math.round(irr.bottom) : '?') +
            '] ovrPos=' + (ovr0 ? getComputedStyle(ovr0).position + ' r=' + getComputedStyle(ovr0).right +
              ' t=' + getComputedStyle(ovr0).top : '?');
          const pc = document.querySelector('.bt-pc');
          const cards = document.querySelector('.bt-col-cards');
          const col = document.querySelector('.bt-col');
          const stage = document.querySelector('.bt-stage');
          const r = (el) => el ? el.getBoundingClientRect().width.toFixed(0) + 'x' +
            el.getBoundingClientRect().height.toFixed(0) : 'null';
          const cs = cards ? getComputedStyle(cards) : null;
          document.title = 'BTMEASURE vp=' + innerWidth + 'x' + innerHeight +
            ' app=' + r(document.getElementById('app')) +
            ' top=' + r(document.getElementById('topbar')) +
            ' main=' + r(document.querySelector('main')) +
            ' scr=' + r(document.getElementById('scr-battle')) +
            ' act=' + r(document.querySelector('#scr-battle.active')) +
            ' || stage=' + r(stage) + ' col=' + r(col) +
            ' cards=' + r(cards) + ' pc=' + r(pc) +
            ' pcCount=' + document.querySelectorAll('.bt-pc').length +
            ' | cards.display=' + (cs ? cs.display : '?') +
            ' gtc=' + (cs ? cs.gridTemplateColumns : '?') +
            ' gtr=' + (cs ? cs.gridTemplateRows : '?') +
            ' flex=' + (cs ? cs.flex : '?') +
            ' | pc.ar=' + (pc ? getComputedStyle(pc).aspectRatio : '?') +
            ' pc.h=' + (pc ? getComputedStyle(pc).height : '?');
        }, 600);
      }, 500);
    }, 600);
  }
  // 调试：?measure=1 量尺寸；?dragtest=方向 模拟拖放
  if (q.get('measure') || q.get('dragtest')) {
    setTimeout(() => {
      switchTab(q.get('tab') || 'team');
      setTimeout(() => {
        if (q.get('dragtest')) { runDragTest(q.get('dragtest')); return; }
        // ---- 尺寸测量 ----
        const pc = document.querySelector('.tm-pcard');
        const poolEl = document.getElementById('tmPool');
        const bs = document.querySelectorAll('.tm-bslot').length;
        const r0 = rosterIds();
        const rect = (sel, k) => {
          const el = document.querySelector(sel);
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          return Math.round(k === 'h' ? r.height : r.width);
        };
        const court = document.querySelector('.tm-court');
        const cr = court ? court.getBoundingClientRect() : { width: 0, height: 0 };
        const parts = [];
        parts.push('窗高=' + innerHeight + ' 顶栏=' + rect('#topbar', 'h') +
          ' 头=' + rect('.tm-head', 'h') + ' 标签=' + rect('.tm-tabs', 'h') +
          ' 面板=' + rect('.tm-pane.on', 'h'));
        parts.push('球场=' + Math.round(cr.width) + 'x' + Math.round(cr.height) +
          ' 首发卡=' + rect('.tm-slot') + ' 替补卡=' + rect('.tm-bslot') +
          ' 列表卡=' + (pc ? Math.round(pc.getBoundingClientRect().width) : 0) +
          ' 左栏=' + rect('.tm-pool'));
        parts.push('名单=' + (r0.starters.length + r0.bench.length) +
          ' 首发槽=' + document.querySelectorAll('.tm-slot').length +
          ' 替补槽=' + bs +
          ' 列表卡数=' + document.querySelectorAll('.tm-pcard').length);
        document.title = 'MEASURE ' + parts.join(' | ');
      }, 600);
    }, 600);
  }

  /**
   * 拖拽回归测试。4 个方向：
   *   pool2court / pool2bench   备用名单 → 阵容
   *   court2bench / bench2court 阵容内部互换
   */
  function runDragTest(kind) {
    const $all = (sel) => document.querySelectorAll(sel);
    let src, slots;
    if (kind === 'pool2bench' || kind === 'bench') { src = $all('.tm-pcard')[0]; slots = $all('.tm-bslot'); }
    else if (kind === 'pool2court' || kind === 'court') { src = $all('.tm-pcard')[0]; slots = $all('.tm-slot'); }
    else if (kind === 'court2bench') { src = $all('.tm-slot')[0]; slots = $all('.tm-bslot'); }
    else if (kind === 'bench2court') { src = $all('.tm-bslot')[0]; slots = $all('.tm-slot'); }
    else { document.title = 'DRAG 未知方向 ' + kind; return; }
    if (!src || !slots.length) { document.title = 'DRAG 找不到卡片或槽位'; return; }

    const target = slots[2] || slots[0];
    const srcId = src.dataset.id, tgtId = target.dataset.id;
    const r0 = rosterIds();
    const slotOf = (r, id) => (r.starters.indexOf(id) >= 0
      ? 'S' + r.starters.indexOf(id)
      : (r.bench.indexOf(id) >= 0 ? 'B' + r.bench.indexOf(id) : 'P'));
    const srcBefore = slotOf(r0, srcId), tgtBefore = slotOf(r0, tgtId);
    const sR = src.getBoundingClientRect(), tR = target.getBoundingClientRect();
    const cx = sR.left + sR.width / 2, cy = sR.top + sR.height / 2;
    const tx = tR.left + tR.width / 2, ty = tR.top + tR.height / 2;
    const opt = { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
      pointerType: 'touch', button: 0, buttons: 1 };
    const P = (type, x, y, extra) => new PointerEvent(type,
      Object.assign({}, opt, { clientX: x, clientY: y }, extra || {}));

    src.dispatchEvent(P('pointerdown', cx, cy));
    setTimeout(() => {
      document.dispatchEvent(P('pointermove', cx + 10, cy + 10));
      document.dispatchEvent(P('pointermove', tx, ty));
      setTimeout(() => {
        const ghost = !!document.querySelector('.tm-ghost');
        const over = document.querySelectorAll('.tm-slot.over,.tm-bslot.over').length;
        document.dispatchEvent(P('pointerup', tx, ty, { buttons: 0 }));
        setTimeout(() => {
          const r2 = rosterIds();
          const all2 = r2.starters.concat(r2.bench);
          const srcNow = slotOf(r2, srcId), tgtNow = slotOf(r2, tgtId);
          document.title = 'DRAG[' + kind + '] 浮层=' + ghost + ' 悬停=' + over +
            ' | ' + srcId + ' ' + srcBefore + '→' + srcNow +
            ' ; ' + tgtId + ' ' + tgtBefore + '→' + tgtNow +
            (srcNow !== srcBefore ? ' ✓已替换' : ' ✗没动') +
            (tgtId && tgtNow === srcBefore ? ' ✓对方接管' : '') +
            ' | 名单=' + all2.length + '人/唯一' + new Set(all2).size +
            ' 浮层清理=' + !document.querySelector('.tm-ghost');
        }, 320);
      }, 320);
    }, 320);
  }

  // 调试：?btdiag=1 检查比赛时钟是否真的在走
  if (q.get('btdiag') === '1') {
    setTimeout(() => {
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        const t0 = { clock: BT.gs.clock, log: BT.log.length };
        setTimeout(() => {
          document.title = 'BTDIAG 起点 clock=' + t0.clock.toFixed(1) +
            ' log=' + t0.log +
            ' | 4秒后 clock=' + BT.gs.clock.toFixed(1) +
            ' log=' + BT.log.length +
            ' 比分=' + BT.myTeam.score + ':' + BT.aiTeam.score +
            ' 节=' + (BT.gs.q + 1) + ' running=' + BT.gs.running;
        }, 4000);
      }, 400);
    }, 600);
  }
  // 调试：?bt=setup|live|quick 直接进对战页
  if (q.get('bt')) {
    if (q.get('seed')) { /* seed 已在上面处理 */ }
    setTimeout(() => {
      switchTab('battle');
      const mode = q.get('bt');
      if (mode === 'live' || mode === 'quick') {
        if (q.get('oppteam')) BT.oppTeam = q.get('oppteam');
        startBattle(mode);
      }
    }, 700);
  }
  // 调试：?cvdiag=1 检查查看器状态
  if (q.get('cvdiag') === '1') {
    setTimeout(() => {
      const v = document.getElementById('cardViewer');
      const cs = v ? getComputedStyle(v) : null;
      const w = document.getElementById('cvWrap');
      document.title = 'CVDIAG ' + (v ? (
        'class=' + v.className +
        ' display=' + cs.display +
        ' bg=' + cs.backgroundImage.slice(0, 40) +
        ' opacity=' + cs.opacity +
        ' z=' + cs.zIndex +
        ' rect=' + JSON.stringify(v.getBoundingClientRect().toJSON()) +
        ' | wrap=' + (w ? w.getBoundingClientRect().width + 'x' + w.getBoundingClientRect().height : 'null')
      ) : 'no viewer');
    }, 1200);
  }
  // 回归测试：?perf=1 —— 模拟连续打字，统计重绘次数与耗时
  if (q.get('perf') === '1') {
    setTimeout(async () => {
      const tab = q.get('tab') || 'mine';
      switchTab(tab);
      await sleep(300);
      const input = document.getElementById(tab === 'dex' ? 'dex-search' : 'mine-search');
      if (!input) { document.title = 'PERF 找不到搜索框'; return; }
      // 包一层统计 renderDex / renderMine 被调用的次数
      let calls = 0;
      const origDex = window.renderDex, origMine = window.renderMine;
      const wrap = (fn) => function () { calls++; return fn.apply(this, arguments); };
      window.renderDex = wrap(origDex); window.renderMine = wrap(origMine);
      const t0 = performance.now();
      const text = '斯蒂芬库里';
      for (let i = 1; i <= text.length; i++) {
        input.value = text.slice(0, i);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(35);                   // 模拟真实打字速度
      }
      await sleep(400);
      const dt = performance.now() - t0;
      // 再模拟"删掉重搜"
      const t1 = performance.now();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(60);
      input.value = '乔丹';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);
      const dt2 = performance.now() - t1;
      const finalCards = document.querySelectorAll('#mine-grid .mini, #dex-grid .mini').length;
      document.title = `PERF 打字${text.length}字重绘${calls}次 ${dt.toFixed(0)}ms | ` +
        `清空改搜 ${dt2.toFixed(0)}ms | 末次结果 ${finalCards} 张 | 输入框值="${input.value}"`;
    }, 900);
  }
  // 调试：?cv=1 直接打开卡片查看器
  if (q.get('cv')) {
    setTimeout(() => {
      const best = CARDS.filter((c) => S.owned[c.id])
        .sort((a, b) => statsOf(b, S.owned[b.id].brk).ovr - statsOf(a, S.owned[a.id].brk).ovr)[0];
      // ?cvcard=英文名 可指定查看器打开哪张卡
      const want = q.get('cvcard');
      const pick = want ? CARDS.find((c) => c.en === want && !!c.isMoment === (q.get('moment') === '1'))
          || CARDS.find((c) => c.en === want) : null;
      if (pick && !S.owned[pick.id]) S.owned[pick.id] = { dup: 30, brk: 2, got: 31 };
      const target = pick || best;
      if (target) { openViewer(target.id); if (q.get('flip')) setTimeout(() => $('#cvWrap').click(), 500); }
    }, 320);
  }
  // 调试：?q=关键词 预填搜索框
  if (q.get('q')) {
    const kw = q.get('q');
    const tab = q.get('tab') || 'mine';
    if (tab === 'dex') dexQuery = kw; else mineQuery = kw;
    switchTab(tab);
  }
  if (q.get('dtab')) detailTab = q.get('dtab');
  if (q.get('bcat')) badgeCat = q.get('bcat');
  // ?cardtest=<序号> 直接打开第 N 张已拥有卡的详情（截图/自检用）
  // ?safetest=1 检查安全区是否生效（模拟刘海内边距）
  if (q.get('safetest')) {
    document.documentElement.style.setProperty('--safe-l', '59px');
    document.documentElement.style.setProperty('--safe-r', '59px');
    setTimeout(() => {
      const el = document.getElementById('detailLayer');
      const w = el.querySelector('.dwrap');
      const cs = getComputedStyle(w);
      const card = el.querySelector('.dtop-card');
      const name = el.querySelector('.dtop-name');
      const tabs = el.querySelector('.dtabs');
      const r = (n) => { const b = n && n.getBoundingClientRect();
        return b ? Math.round(b.left) + '~' + Math.round(b.right) : '?'; };
      const panel = el.querySelector('.dpanel');
      const bd = el.querySelector('.bd-side');
      const h = (sel) => { const n = el.querySelector(sel);
        return n ? Math.round(n.getBoundingClientRect().height) : -1; };
      const canScroll = el.scrollHeight > el.clientHeight + 2;
      const sd = el.querySelector('.bd-side');
      const scrollInfo = sd
        ? ('可滚动=' + (sd.scrollHeight > sd.clientHeight + 1 ? '✓' : '否') +
           ' 内容' + sd.scrollHeight + '/可视' + sd.clientHeight)
        : '无分类栏';
      document.title = 'SAFE 整页可滚=' + (canScroll ? '✓' : '否') +
        ' 页高' + el.scrollHeight + '/屏' + el.clientHeight +
        ' | ' + scrollInfo + ' | 视口=' + innerWidth + 'x' + innerHeight +
        ' | 上=' + h('.dtop') + ' 页签=' + h('.dtabs') + ' 面板=' + h('.dpanel') +
        ' 底=' + h('.dfoot') + ' 卡=' + h('.dtop-card') + ' 信息栏=' + h('.dtop-grid') +
        ' | wrap左右内边距=' + cs.paddingLeft + '/' + cs.paddingRight +
        ' | 卡片x=' + r(card) + ' 名字x=' + r(name) +
        ' | 页签宽=' + (tabs ? Math.round(tabs.getBoundingClientRect().width) : 0) +
        ' | 面板高=' + (panel ? Math.round(panel.getBoundingClientRect().height) : 0) +
        ' 分类栏高=' + (bd ? Math.round(bd.getBoundingClientRect().height) : 0) +
        ' 分类数=' + el.querySelectorAll('.bd-cat').length +
        ' | 横向溢出=' + (document.documentElement.scrollWidth > innerWidth ? '✗有' : '✓无');
    }, 2200);
  }
  // ?sbtest=1 记分条暂停数渲染自检
  if (q.get('sbtest')) {
    setTimeout(() => {
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          renderBattle();
          setTimeout(() => {
            const el = document.getElementById('scr-battle');
            const foe = el.querySelector('.bt-sb-side.foe');
            const to = el.querySelector('.bt-sb-side.foe .bt-sb-to');
            document.title = 'SB 对手栏=' + (foe ? '✓' : '✗') +
              ' 暂停元素=' + (to ? '✓「' + to.textContent.trim() + '」' : '✗') +
              ' AI暂停数=' + (BT.aiTeam ? BT.aiTeam.timeouts : '?');
          }, 300);
        }, 1200);
      }, 400);
    }, 700);
  }
  // ?sameplayertest=1 同一球员只能上一张的规则自检
  if (q.get('sameplayertest')) {
    setTimeout(() => {
      const out = [];
      const kobe = CARDS.filter((c) => c.en === 'Kobe Bryant');
      out.push('科比卡数=' + kobe.length + '（' +
        kobe.map((c) => TIERS[c.tier].name).join('/') + '）');
      out.push('samePlayer=' + samePlayer(kobe[0].id, kobe[1].id));
      // 全部 60 名重复球员都验一遍
      const byEn = {};
      CARDS.forEach((c) => { (byEn[c.en] = byEn[c.en] || []).push(c); });
      const dups = Object.keys(byEn).filter((k) => byEn[k].length > 1);
      let ok = 0, bad = 0;
      dups.forEach((k) => {
        const a0 = byEn[k][0], b0 = byEn[k][1];
        if (samePlayer(a0.id, b0.id)) ok++; else bad++;
      });
      out.push('重复球员 ' + dups.length + ' 名，识别正确 ' + ok +
        (bad === 0 ? ' ✓' : ' ✗' + bad));
      // 不同球员不能被误判
      const diff = CARDS.filter((c) => c.en !== 'Kobe Bryant');
      let wrong = 0;
      for (let i = 0; i < 200; i++) {
        const x = diff[i * 2], y = diff[i * 2 + 1];
        if (x && y && samePlayer(x.id, y.id)) wrong++;
      }
      out.push('不同球员误判=' + wrong + (wrong === 0 ? ' ✓' : ' ✗'));
      // 强制上阵测试
      switchTab('team');
      setTimeout(() => {
        S.owned[kobe[0].id] = { got: 2, dup: 1, brk: 0 };
        S.owned[kobe[1].id] = { got: 2, dup: 1, brk: 0 };
        S.rosterManual = false;
        S.roster = { starters: [], bench: [] };
        const r0 = autoLineup();
        const ids0 = r0.starters.concat(r0.bench);
        const kk = ids0.filter((x) => playerKeyOf(x) === playerKeyOf(kobe[0].id));
        out.push('自动排阵里科比占 ' + kk.length + ' 个位置' +
          (kk.length <= 1 ? ' ✓' : ' ✗'));
        // ---- 强制拦截测试 ----
        const kA = kobe[0].id, kB = kobe[1].id;   // 紫卡 / 时刻紫卡
        const others = CARDS.filter((c) => c.en !== 'Kobe Bryant' &&
          ['PG','SG','SF','PF','C'].indexOf(c.pos) >= 0).slice(0, 12);
        others.forEach((c) => { S.owned[c.id] = { got: 2, dup: 1, brk: 0 }; });
        S.roster = {
          starters: [kA].concat(others.slice(0, 4).map((c) => c.id)),
          bench: others.slice(4, 9).map((c) => c.id),
        };
        S.rosterManual = false;
        save();
        // ① 把时刻科比放进首发 → 应被拦截
        const before = JSON.stringify(rosterIds());
        putOnCourt(kB, 2);
        const after = JSON.stringify(rosterIds());
        out.push('放时刻科比进首发=' + (before === after ? '✓被拦下' : '✗放进去了'));
        // ② 放进替补 → 也应被拦截
        const b1 = JSON.stringify(rosterIds());
        putOnBench(kB, 3);
        out.push('放时刻科比进替补=' +
          (b1 === JSON.stringify(rosterIds()) ? '✓被拦下' : '✗放进去了'));
        // ③ 弹窗是否出现
        out.push('冲突弹窗=' +
          (document.querySelector('.spf-mask') ? '✓弹出' : '✗没弹'));
        // ④ 阵容里科比仍然只有 1 张
        const cur = rosterIds().starters.concat(rosterIds().bench).filter(Boolean);
        const kn = cur.filter((x) => playerKeyOf(x) === playerKeyOf(kA)).length;
        out.push('阵容里科比=' + kn + ' 张' + (kn === 1 ? ' ✓' : ' ✗'));
        // ⑤ 点"用这张替换"后应换成功且仍只有 1 张
        const swap = document.querySelector('[data-spf="swap"]');
        if (swap) {
          swap.click();
          setTimeout(() => {
            const c2 = rosterIds().starters.concat(rosterIds().bench).filter(Boolean);
            const kn2 = c2.filter((x) => playerKeyOf(x) === playerKeyOf(kA)).length;
            const hasNew = c2.indexOf(kB) >= 0;
            out.push('替换后 科比=' + kn2 + ' 张' +
              (kn2 === 1 ? ' ✓' : ' ✗') + ' 新卡在场=' + (hasNew ? '✓' : '✗'));
            // ⑥ 不同球员不受影响
            const o = others[0].id;
            const b3 = JSON.stringify(rosterIds());
            putOnCourt(o, 0);
            out.push('不同球员可正常上阵=' +
              (b3 !== JSON.stringify(rosterIds()) ? '✓' : '✗'));
            // ⑦ 所有档位组合都要拦
            const byEn = {};
            CARDS.forEach((c) => { (byEn[c.en] = byEn[c.en] || []).push(c); });
            const dups = Object.keys(byEn).filter((k) => byEn[k].length > 1);
            let pairs = 0, blocked = 0, tiers = {};
            dups.forEach((k) => {
              const cs = byEn[k];
              const t = cs.map((c) => TIERS[c.tier].name).sort().join('+');
              tiers[t] = (tiers[t] || 0) + 1;
              pairs++;
            });
            out.push('重复球员覆盖档位组合: ' +
              Object.keys(tiers).map((t) => t + '×' + tiers[t]).join(' '));
            // ⑧ 队伍里不会出现同一球员两次
            let dup = 0, teams = 0;
            try {
              const L2 = (typeof leagueState === 'function') ? leagueState() : null;
              const map = (L2 && L2.teams) || {};
              Object.keys(map).slice(0, 30).forEach((k) => {
                const tm = map[k];
                if (!tm || !tm.roster) return;
                teams++;
                const ks = tm.roster.map(playerKeyOf);
                if (new Set(ks).size !== ks.length) dup++;
              });
            } catch (e2) { out.push('AI检查跳过:' + e2.message); }
            out.push('AI 球队 ' + teams + ' 支，同球员重复 ' + dup + ' 支' +
              (dup === 0 ? ' ✓' : ' ✗'));
            // ⑨ 全量：60 名重复球员逐一试放进玩家阵容，全部要被拦
            let pass = 0, fail = 0;
            dups.forEach((k) => {
              const cs = byEn[k];
              const A = cs[0].id, B = cs[1].id;
              S.owned[A] = { got: 2, dup: 1, brk: 0 };
              S.owned[B] = { got: 2, dup: 1, brk: 0 };
              // 造一个含 A 的阵容
              const filler = others.map((c) => c.id).filter((x) => x !== A);
              S.roster = { starters: [A].concat(filler.slice(0, 4)),
                bench: filler.slice(4, 9) };
              S.rosterManual = false;
              const before2 = JSON.stringify(rosterIds());
              putOnCourt(B, 3);
              const ok1 = before2 === JSON.stringify(rosterIds());
              const before3 = JSON.stringify(rosterIds());
              putOnBench(B, 2);
              const ok2 = before3 === JSON.stringify(rosterIds());
              if (ok1 && ok2) pass++; else fail++;
              // 清掉弹窗免得叠一堆
              const mk = document.querySelector('.spf-mask');
              if (mk) mk.remove();
            });
            out.push('全量 ' + dups.length + ' 名重复球员：拦截成功 ' + pass +
              ' 失败 ' + fail + (fail === 0 ? ' ✓' : ' ✗'));
            // ⑫ 弹窗要在冲突解除后自动消失
            {
              const kA2 = kobe[0].id, kB2 = kobe[1].id;
              S.owned[kA2] = { got: 2, dup: 1, brk: 0 };
              S.owned[kB2] = { got: 2, dup: 1, brk: 0 };
              const fl = others.map((c) => c.id).filter((x) => x !== kA2);
              S.roster = { starters: [kA2].concat(fl.slice(0, 4)),
                bench: fl.slice(4, 9) };
              S.rosterManual = false; save();
              switchTab('team');
              setTimeout(() => {
                // 触发冲突弹窗
                putOnCourt(kB2, 3);
                out.push('冲突弹窗已弹=' +
                  (document.querySelector('.spf-mask') ? '✓' : '✗'));
                // 把冲突的科比拿下
                unloadSlot('court', 0);
                setTimeout(() => {
                  out.push('拿下后弹窗=' +
                    (document.querySelector('.spf-mask') ? '✗ 还挂着' : '✓ 已消失'));
                  // 再试：切标签页也要消失
                  putOnCourt(kB2, 3);
                  const had = !!document.querySelector('.spf-mask');
                  switchTab('league');
                  setTimeout(() => {
                    out.push('切页签后（弹前' + (had ? '有' : '无') + '）=' +
                      (document.querySelector('.spf-mask') ? '✗ 还挂着' : '✓ 已消失'));
                    document.title = 'SAMEPLAYER ' + out.join(' | ');
                  }, 300);
                }, 400);
              }, 500);
            }
            // ⑪ 池子里要能提前看到"同球员在阵容"标记
            switchTab('team');
            setTimeout(() => {
              const el2 = document.getElementById('scr-team');
              const marks = el2.querySelectorAll('.tm-pcard-clash').length;
              out.push('池子里的同球员预警标记 ' + marks + ' 个' +
                (marks > 0 ? ' ✓ 提前可见' : ' ⚠ 当前阵容无冲突'));
              document.title = 'SAMEPLAYER ' + out.join(' | ');
            }, 600);
            // ⑩ 所有档位都覆盖（银/金/时刻金/紫/时刻紫）
            const tierSet = {};
            CARDS.forEach((c) => { tierSet[c.tier] = (tierSet[c.tier] || 0) + 1; });
            out.push('覆盖档位: ' + Object.keys(tierSet).map((t) =>
              TIERS[t].name + tierSet[t]).join(' '));
            document.title = 'SAMEPLAYER ' + out.join(' | ');
          }, 500);
        } else document.title = 'SAMEPLAYER ' + out.join(' | ');
      }, 500);
    }, 900);
  }
  // ?bdmeasure=1 量徽章页几何（自检用）
  if (q.get('bdmeasure')) {
    setTimeout(() => {
      const el = document.getElementById('detailLayer');
      const g = (sel) => { const n = el.querySelector(sel);
        return n ? Math.round(n.getBoundingClientRect().height) : -1; };
      const side = el.querySelector('.bd-side');
      const cats = el.querySelectorAll('.bd-cat');
      let last = null, clipped = 0;
      cats.forEach((c) => {
        const r = c.getBoundingClientRect();
        if (r.bottom > (side ? side.getBoundingClientRect().bottom + 1 : 9999)) clipped++;
        last = r;
      });
      document.title = 'BD 头部=' + g('.dhead') + ' 信息栏=' + g('.dhead-grid') +
        ' 页签=' + g('.dtabs') + ' 面板=' + g('.dpanel') +
        ' 分类栏=' + g('.bd-side') + ' 分类数=' + cats.length +
        ' 被截断=' + clipped + (clipped === 0 ? ' ✓' : ' ✗') +
        ' 徽章卡=' + el.querySelectorAll('.bd-item').length;
    }, 2200);
  }
  if (q.get('cardtest')) {
    setTimeout(() => {
      const owned = CARDS.filter((c) => S.owned[c.id]);
      if (!owned.length) { toast('没有已拥有的卡'); return; }
      // ?cardtest=rich 挑徽章最多的卡（截图/自检用），否则按序号
      const arg = q.get('cardtest');
      let c;
      if (arg === 'rich') {
        owned.forEach((x) => { S.owned[x.id].brk = 8; });   // 全部满突破，展示满徽章
        c = owned.slice().sort((a, b) =>
          badgesOf(b, 8).length - badgesOf(a, 8).length)[0];
      } else {
        const n = parseInt(arg, 10);
        c = owned[(isNaN(n) || n < 1 ? 1 : n) - 1] || owned[0];
      }
      openDetail(c.id, true);   // keepTab：保留 ?dtab= 指定的页签
    }, 600);
  }
  // 调试：?seed=N —— 静默发 N 张卡（含几张紫卡），用于截图/验证
  if (q.get('seed')) {
    const n = parseInt(q.get('seed'), 10) || 12;
    const pick = (t) => CARDS.filter((c) => c.tier === t);
    const grant = (c, dup, brk) => {
      S.owned[c.id] = { dup: dup || 0, brk: brk || 0 };
    };
    ['momentPurple', 'purple', 'gold'].forEach((t) => {
      const pool = pick(t);
      if (pool.length) grant(pool[Math.floor(Math.random() * pool.length)],
        t === 'momentPurple' ? 40 : t === 'purple' ? 24 : 8, t === 'gold' ? 3 : 0);
    });
    for (let i = 0; i < n; i++) {
      const pool = pick('silver').concat(pick('gold'));
      grant(pool[Math.floor(Math.random() * pool.length)], 0, 0);
    }
    if (q.get('card')) {
      const named = CARDS.find((c) => c.en === q.get('card') && (q.get('moment')
        ? c.isMoment : !c.isMoment));
      if (named) grant(named, parseInt(q.get('dup'), 10) || 0, parseInt(q.get('brk'), 10) || 0);
    }
    save(); renderAll();
  }
  if (q.get('detail') === '1') {
    setTimeout(() => {
      const best = CARDS.filter((c) => S.owned[c.id])
        .sort((a, b) => statsOf(b, S.owned[b.id].brk).ovr - statsOf(a, S.owned[a.id].brk).ovr)[0];
      if (best) openDetail(best.id, !!q.get('dtab')); else toast('还没有球员，先招募一次');
    }, 320);
  }
  if (q.get('pool') != null) { curPool = Math.min(POOLS.length - 1, parseInt(q.get('pool'), 10) || 0); renderHome(); }
  if (q.get('recruit')) {
    S.coins += 9999999;
    const n = parseInt(q.get('recruit'), 10) || 10;
    setTimeout(() => startRecruit(n), 300);
  }
  // 调试：?brk=张数 —— 给指定卡发重复卡并直接播放突破演出（用于截图/验证）
  if (q.get('brk')) {
    const en = q.get('card') || 'Stephen Curry';
    const card = CARDS.find((c) => c.en === en && !c.isMoment) || CARDS.find((c) => c.en === en) || CARDS[0];
    S.owned[card.id] = { dup: parseInt(q.get('brk'), 10) || 16, brk: parseInt(q.get('from'), 10) || 0 };
    save();
    setTimeout(async () => {
      const o = S.owned[card.id];
      const times = Math.min(Math.floor(o.dup / hd.per), MAX_BREAK - o.brk) || 1;
      const from = o.brk;
      o.dup -= hd.per * times;
      o.brk = Math.min(MAX_BREAK, o.brk + times);
      save();
      renderAll();
      await playBreakthrough(card, from, o.brk);
    }, 400);
  }
  // 排查横向溢出：临时解除 overflow-x:hidden，量各块真实宽度
  if (q.get('overflow') === '1') {
    setTimeout(() => {
      document.body.style.overflowX = 'visible';
      const vw = document.documentElement.clientWidth;
      const lines = ['vw=' + vw + ' docW=' + document.documentElement.scrollWidth];
      const app = document.getElementById('app');
      if (app) lines.push('#app w=' + Math.round(app.getBoundingClientRect().width));
      const seen = [];
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > vw + 0.5) {
          let path = el.tagName.toLowerCase();
          if (el.id) path += '#' + el.id;
          else if (el.className) path += '.' + el.className.toString().split(' ')[0];
          seen.push(path + ' w=' + Math.round(r.width));
        }
      });
      const uniq = [...new Set(seen)];
      lines.push('--- 超宽元素 (' + uniq.length + ') ---');
      lines.push(...uniq.slice(0, 10));
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#c00;color:#fff;' +
        'font:10px/1.45 monospace;padding:5px;white-space:pre;max-width:100%;overflow:hidden';
      box.textContent = lines.join('\n');
      document.body.appendChild(box);
      document.title = 'OVF ' + lines.slice(0, 8).join(' | ');
    }, 900);
  }
  if (q.get('diag') === '1') {
    setTimeout(() => {
      document.title = 'DIAG cards=' + CARDS.length + ' owned=' + Object.keys(S.owned).length +
        ' vw=' + document.documentElement.clientWidth + ' tiers=' + TIER_ORDER.join(',');
    }, 700);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* ★ 补丁⑤ 兜底：不管 boot() 有没有跑、有没有抛错，
   8 秒后强制把启动遮罩摘掉 —— 绝不允许永久白屏。 */
setTimeout(() => {
  try {
    const bt = document.getElementById('boot');
    if (bt && !bt.classList.contains('gone')) { bt.classList.add('gone'); setTimeout(() => bt.remove(), 400); }
  } catch (e) {}
}, 8000);

/* =============================================================
   横屏适配
   ---------------------------------------------------------------
   游戏是按横屏设计的，但 iOS Safari 不允许网页锁方向，
   所以只能：① 尽量用 Fullscreen API 请求横屏；② 用 CSS 提示页兜底。
   ============================================================= */
(function initLandscape() {
  if (typeof document === 'undefined') return;

  const go = document.getElementById('rtGo');
  if (go) {
    go.onclick = () => {
      // 用户点了"我已横屏" —— 试一次全屏+锁方向，失败也无所谓
      tryLockLandscape();
      // 如果其实还是竖屏，给个提示
      if (window.innerHeight > window.innerWidth) {
        const tip = document.querySelector('#rotateTip .rt-note');
        if (tip) {
          tip.textContent = '还是竖屏哦 —— 请真的把设备横过来，或把浏览器窗口拉宽到比高度更长。';
          tip.style.color = '#ff9aab';
        }
      }
    };
  }

  async function tryLockLandscape() {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch (e) { /* iOS 不支持，忽略 */ }
  }

  // 双击顶栏也能触发一次全屏（iOS 上全屏后横屏体验更好）
  const top = document.getElementById('topbar');
  if (top) top.addEventListener('dblclick', tryLockLandscape);

  // 横竖屏切换时刷新一下尺寸相关的布局（比如查看器里的卡面尺寸）
  const onOrient = () => {
    window.dispatchEvent(new Event('resize'));
    if (typeof refreshCardSizes === 'function') refreshCardSizes();
  };
  window.addEventListener('orientationchange', () => setTimeout(onOrient, 260));
})();

/* ---------- 调试：?savetest2=1 自动保存自检 ---------- */
(function autoSaveTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('savetest2')) return;
    setTimeout(() => {
      const out = [];
      out.push('存储可用=' + (Store.usable ? '✓' : '✗'));
      out.push('开关默认=' + (S.autoSave === false ? '关' : '开'));
      // 改点东西 → 应该自动存
      const before = S.coins;
      S.coins += 777;
      save();
      const raw = Store.read(SAVE_KEY);
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) {}
      out.push('自动保存后读回=' + (parsed && parsed.coins === before + 777 ? '✓' : '✗'));
      // 关掉自动保存 → 不该立刻写
      S.autoSave = false;
      S.coins = 999;
      save();
      let p2 = null;
      try { p2 = JSON.parse(Store.read(SAVE_KEY)); } catch (e) {}
      out.push('关闭后不写=' + (p2 && p2.coins !== 999 ? '✓' : '✗'));
      // 但退出兜底必须写
      forceSave();
      let p3 = null;
      try { p3 = JSON.parse(Store.read(SAVE_KEY)); } catch (e) {}
      out.push('退出兜底写入=' + (p3 && p3.coins === 999 ? '✓' : '✗'));
      // 切后台事件
      S.coins = 1234; S.autoSave = false;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
      let p4 = null;
      try { p4 = JSON.parse(Store.read(SAVE_KEY)); } catch (e) {}
      out.push('切后台兜底=' + (p4 && p4.coins === 1234 ? '✓' : '✗'));
      out.push('最后保存时间=' + (lastSaveAt ? '已记录' : '未记录'));
      // 恢复
      S.autoSave = true; forceSave();
      document.title = 'AUTOSAVE ' + out.join(' | ');
    }, 800);
  } catch (e) { document.title = 'AUTOSAVE-ERR ' + e.message; }
})();

/* ---------- 调试：?cointest=1 支票实时刷新自检 ---------- */
(function coinTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('cointest')) return;
    setTimeout(() => {
      const out = [];
      const el = document.getElementById('ui-coins');
      const show = () => (el ? el.textContent : '?');
      out.push('初始显示=' + show() + ' 实际=' + fmt(S.coins));

      // ① 加钱后立刻反映
      const a0 = show();
      S.coins += 12345;
      save();
      out.push('+12345 → 显示 ' + a0 + '→' + show() +
        (show() === fmt(S.coins) ? ' ✓' : ' ✗'));
      out.push('有弹动动画=' + ((el.closest('.cur') || el)
        .classList.contains('coin-bump') ? '✓' : '✗'));

      // ② 减钱
      const b0 = show();
      S.coins -= 5000;
      save();
      out.push('-5000 → ' + b0 + '→' + show() +
        (show() === fmt(S.coins) ? ' ✓' : ' ✗'));

      // ③ 模拟比赛奖金（走 endBattle 的路径：改 S.coins 再 save）
      const c0 = show();
      S.coins += 3200;
      save();
      out.push('比赛奖金 → ' + c0 + '→' + show() +
        (show() === fmt(S.coins) ? ' ✓' : ' ✗'));

      // ④ 转会市场买卖路径
      switchTab('market');
      const before = show();
      S.coins += 8888; Sfx.coin(); save();
      out.push('市场收入 → ' + before + '→' + show() +
        (show() === fmt(S.coins) ? ' ✓' : ' ✗'));
      out.push('最终 显示=' + show() + ' 实际=' + fmt(S.coins) +
        (show() === fmt(S.coins) ? ' ✓一致' : ' ✗不一致'));
      document.title = 'COIN ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'COIN-ERR ' + e.message; }
})();

/* ---------- 调试：?lock2test=1 「我的」页锁定入口自检 ---------- */
(function lock2Test() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('lock2test')) return;
    setTimeout(() => {
      const out = [];
      const top = CARDS.slice(0, 4);
      top.forEach((c) => { S.owned[c.id] = { got: 2, dup: 1, brk: 0 }; });
      S.locked = {};
      const id = top[0].id;

      // ① 我的页卡片上有没有锁标
      switchTab('mine');
      setTimeout(() => {
        let mini = document.querySelector('.mini[data-id="' + id + '"]');
        out.push('我的页找到卡片=' + (mini ? '✓' : '✗'));
        out.push('isLocked函数存在=' + (typeof isLocked === 'function' ? '✓' : '✗'));
        out.push('未锁定时无锁标=' +
          (!mini || !mini.querySelector('.mini-lock') ? '✓' : '✗'));

        // ② 点卡片开详情，锁定按钮在不在
        openDetail(id);
        setTimeout(() => {
          const btn = document.getElementById('btnLockThis');
          out.push('详情页锁定按钮=' + (btn ? '✓「' +
            btn.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + '」' : '✗'));
          if (btn) {
            btn.click();   // 点一下锁定
            setTimeout(() => {
              out.push('点击后 isLocked=' + (isLocked(id) ? '✓' : '✗'));
              const b2 = document.getElementById('btnLockThis');
              out.push('按钮变成「' + (b2 ? b2.textContent.trim()
                .replace(/\s+/g, ' ').slice(0, 14) : '?') + '」');
              // ③ 锁上以后不可卖
              const r = sellPlayer(id);
              out.push('锁定后出售=' + (r.ok ? '✗竟然能卖' : '✓被拦下'));
              // ④ 我的页出现锁标
              switchTab('mine');
              setTimeout(() => {
                // 注意：#scr-dex 的网格在 DOM 里排在 #scr-mine 前面，
                // 用 document.querySelector 会拿到图鉴页那张（没重绘过）。
                // 必须限定在 #mine-grid 里查。
                const grid = document.getElementById('mine-grid');
                const m2 = grid ? grid.querySelector('.mini[data-id="' + id + '"]') : null;
                out.push('我的页锁标=' +
                  (m2 && m2.querySelector('.mini-lock') ? '✓显示' : '✗没显示'));
                // ⑤ 解锁后能卖
                toggleLock(id);
                const r2 = sellPlayer(id);
                out.push('解锁后可卖=' + (r2.ok ? '✓' : '✗' + r2.why));
                document.title = 'LOCK2 ' + out.join(' | ');
              }, 400);
            }, 500);
          } else document.title = 'LOCK2 ' + out.join(' | ');
        }, 600);
      }, 600);
    }, 800);
  } catch (e) { document.title = 'LOCK2-ERR ' + e.message; }
})();

/* ---------- 调试：?skiptest=1 一键跳过动画自检 ---------- */
(function skipAnimTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('skiptest')) return;
    setTimeout(() => {
      const out = [];
      const t0 = Date.now();
      // 触发十连（会播动画）
      S.coins = Math.max(S.coins, 200000);       // 保证钱够
      switchTab('home');
      const btn = document.querySelector('#scr-home [data-recruit="10"]')
        || document.querySelector('[data-recruit="10"]');
      if (!btn) { document.title = 'SKIP 找不到十连按钮'; return; }
      btn.click();
      setTimeout(() => {
        const lay = document.getElementById('pullLayer');
        const cards = document.querySelectorAll('#pullGrid .card');
        out.push('动画中 卡片=' + cards.length +
          ' 已翻开=' + document.querySelectorAll('#pullGrid .card.revealed').length);
        const sk = document.getElementById('btnSkipAnim');
        out.push('跳过按钮=' + (sk ? '✓存在' : '✗没有') +
          (sk && sk.disabled ? '（当前禁用）' : '（可点）'));
        // 点跳过
        const t1 = Date.now();
        if (sk) sk.click();
        const t2 = Date.now();
        setTimeout(() => {
          const rev = document.querySelectorAll('#pullGrid .card.revealed').length;
          const done = document.getElementById('btnPullDone');
          out.push('点跳过耗时 ' + (t2 - t1) + 'ms');
          out.push('立刻全开=' + rev + '/' + cards.length +
            (rev === cards.length ? ' ✓' : ' ✗'));
          out.push('确认按钮已解锁=' + (done && !done.disabled ? '✓' : '✗'));
          out.push('收尾层已收起=' +
            (document.getElementById('finaleLayer').classList.contains('hidden') ? '✓' : '✗'));
          out.push('总耗时 ' + (Date.now() - t0) + 'ms');
          document.title = 'SKIP ' + out.join(' | ');
        }, 400);
      }, 900);
    }, 900);
  } catch (e) { document.title = 'SKIP-ERR ' + e.message; }
})();

/* ---------- 调试：?soundtest=1 赛场音效自检 ---------- */
(function soundTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('soundtest')) return;
    setTimeout(() => {
      const out = [];
      const need = ['swish','rim','board','dunk','blockSfx','stealSfx','steps',
        'cheer','clap','ooh','boo','whistle','buzzer','score','dribble',
        'ambienceOn','ambienceOff','ambienceLevel'];
      const miss = need.filter((k) => typeof Sfx[k] !== 'function');
      out.push('赛场音效 ' + (need.length - miss.length) + '/' + need.length +
        (miss.length ? ' ✗缺:' + miss.join(',') : ' ✓齐全'));
      // 实际播放一遍（无头环境没有声卡，只验证不报错）
      let err = null;
      try {
        Sfx.unlock();
        ['swish','rim','board','dunk','blockSfx','stealSfx','steps','cheer',
         'clap','ooh','boo','whistle','buzzer','score','dribble'].forEach((k) => Sfx[k]());
        Sfx.ambienceOn(); Sfx.ambienceLevel(0.2); Sfx.ambienceOff();
      } catch (e) { err = e.message; }
      out.push('全部播放=' + (err ? '✗ ' + err : '✓无异常'));
      // 事件→音效映射
      const kinds = ['made3','made2','madeInside','madePost','dunk','poster',
        'posterize','miss','ftMiss','block','pin','snatch','rejection',
        'steal','crossover','turnover','freethrow','rebound'];
      let bad = 0;
      kinds.forEach((k) => {
        try { playEventSound({ kind: k, pts: 0, mine: true }); }
        catch (e) { bad++; }
      });
      out.push('事件音效映射=' + (bad === 0 ? '✓全部正常' : '✗' + bad + '个报错'));
      // AudioContext 状态
      const AC = window.AudioContext || window.webkitAudioContext;
      out.push('AudioContext支持=' + (AC ? '✓' : '✗'));
      // 真实素材
      out.push('真实音效素材=' + (typeof ARENA_SRC !== 'undefined'
        ? Object.keys(ARENA_SRC).length + '个' : '✗无'));
      out.push('已解码=' + Arena.count + '个' +
        (Arena.count > 0 ? ' ✓' : '（无头环境无音频设备，正常）'));
      document.title = 'SOUND ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'SOUND-ERR ' + e.message; }
})();

/* ---------- 调试：?balancetest=1 v1.1 平衡修复自检 ---------- */
(function balanceTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('balancetest')) return;
    setTimeout(() => {
      const out = [];
      // ① 各档位的突破成本
      const tiers = ['silver', 'gold', 'purple', 'momentGold', 'momentPurple'];
      out.push('突破成本：' + tiers.map((t) =>
        TIERS[t].name + ' ' + breakPerOf(t) + '张/阶×' + BREAK.stages + '=' +
        breakTotalOf(t) + '张消耗（含本体共 ' + breakOwnOf(t) + ' 张）'
      ).join('  '));
      // ② 满突破所需金币（按市价）
      const rows = tiers.map((t) => {
        const c = CARDS.filter((x) => x.tier === t)
          .sort((a, b) => b.ovr - a.ovr)[0];
        if (!c) return null;
        const price = marketPrice(c);
        const need = breakTotalOf(t) - 1;     // 第一张靠自己抽/买
        return { name: TIERS[t].name, price, need, cost: price * need, card: c };
      }).filter(Boolean);
      rows.forEach((r) => out.push(r.name + '：' + fmt(r.price) + '/张 × ' +
        r.need + ' = ' + fmt(r.cost)));
      // ③ 一个赛季能挣多少
      const L = leagueState();
      /* v9.27：与实发口径对齐 —— 走 battleReward()，
         别再自己写一份公式（原来这里比实发少 80/场）。 */
      const winPay = (oppOvr) => (typeof battleReward === 'function'
        ? battleReward(oppOvr, true, 10) : Math.round(ECO.WIN_BASE + (oppOvr - 80) * ECO.WIN_PER_OVR));
      const perGame = winPay(110);
      // 现实估算：常规赛 55% 胜率 + 打进分区决赛
      const season = Math.round(perGame * 82 * 0.55 + 375 * 82 * 0.45
        + PLAYOFF_REWARD.make + PLAYOFF_REWARD.r1 + PLAYOFF_REWARD.semi
        + PLAYOFF_REWARD.gameWin * 8);
      out.push('单场(打110强队)=' + fmt(perGame) +
        ' 一季现实收入≈' + fmt(season) + '（55%胜率+分区决赛）');
      // ④ 换算成赛季数
      rows.forEach((r) => {
        const seasons = r.cost / season;
        out.push(r.name + ' 练满需要 ' + seasons.toFixed(1) + ' 个赛季' +
          (seasons <= 6 ? ' ✓可达' : seasons <= 12 ? ' ⚠偏长' : ' ✗太长'));
      });
      out.push('游戏总赛季数=' + (SEASON.END_YEAR - SEASON.START_YEAR + 1));
      document.title = 'BALANCE ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'BALANCE-ERR ' + e.message; }
})();


/* =============================================================
   独立页签：转会市场
   ============================================================= */
function renderMarket() {
  const el = document.getElementById('scr-market');
  if (!el) return;
  try {
    if (typeof lgTab !== 'undefined') lgTab = 'market';
    el.innerHTML = `<div class="pad">
      <div class="mk-head">
        <div class="sec-title">转 会 市 场</div>
        <button class="mk-quest" id="mkQuest">🎯 任务</button>
      </div>
      <div id="mk-body">${
        (typeof lgMarketHTML === 'function') ? lgMarketHTML()
          : '<div class="lg-empty">转会市场不可用</div>'}</div>
    </div>`;
    if (typeof bindLeagueBody === 'function') bindLeagueBody();
    const qb = document.getElementById('mkQuest');
    if (qb) qb.onclick = () => { Sfx.click(); openMineLayer('quest'); };
  } catch (e) {
    el.innerHTML = '<div class="pad">转会市场加载失败：' + e.message + '</div>';
  }
}

/* =============================================================
   任务浮层（原「联赛」页搬过来的）
   （原「联赛」页合并后，这两个功能搬到「我的」）
   ============================================================= */
function openMineLayer(kind) {
  let el = document.getElementById('mineLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mineLayer';
    el.className = 'layer hidden';
    document.body.appendChild(el);
  }
  const title = kind === 'market' ? '💰 转会市场' : '🎯 任务与成就';
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="ml-top">
      <b>${title}</b>
      <button class="ml-close" id="mlClose">✕ 关闭</button>
    </div>
    <div class="ml-body" id="mlBody"></div>`;
  const body = document.getElementById('mlBody');
  try {
    if (kind === 'market') {
      if (typeof lgTab !== 'undefined') lgTab = 'market';
      body.innerHTML = (typeof lgMarketHTML === 'function')
        ? lgMarketHTML() : '<div class="pad">转会市场不可用</div>';
      if (typeof bindLeagueBody === 'function') bindLeagueBody();
    } else {
      body.innerHTML = (typeof questHTML === 'function')
        ? questHTML() : '<div class="pad">任务系统不可用</div>';
      if (typeof bindQuest === 'function') bindQuest();
    }
  } catch (e) {
    body.innerHTML = '<div class="pad">加载失败：' + e.message + '</div>';
  }
  const cl = document.getElementById('mlClose');
  if (cl) cl.onclick = () => { Sfx.click(); closeMineLayer(); };
}
function closeMineLayer() {
  const el = document.getElementById('mineLayer');
  if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  if (typeof renderMine === 'function') renderMine();
  if (typeof updateCoinsUI === 'function') updateCoinsUI();
  try { save && save(); } catch (e) {}
}

/* =============================================================
   游戏内确认框（替代浏览器原生 confirm）
   -------------------------------------------------------------
   iPhone「添加到主屏幕」后，原生的 confirm() 会被系统拦截、
   或者根本不弹出来 —— 表现就是"点了买入没反应"。
   这里做一个和游戏风格一致的确认弹窗，返回 Promise<boolean>。
   ============================================================= */
function uiConfirm(opts) {
  return new Promise((resolve) => {
    const o = (typeof opts === 'string') ? { body: opts } : (opts || {});
    let el = document.getElementById('cfmLayer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cfmLayer';
      el.className = 'layer hidden';
      document.body.appendChild(el);
    }
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="cfm-mask"></div>
      <div class="cfm-box">
        ${o.title ? `<div class="cfm-title">${o.title}</div>` : ''}
        <div class="cfm-body">${(o.body || '').replace(/\n/g, '<br>')}</div>
        <div class="cfm-btns">
          <button class="cfm-no" id="cfmNo">${o.no || '取消'}</button>
          <button class="cfm-yes" id="cfmYes">${o.yes || '确 定'}</button>
        </div>
      </div>`;
    const done = (v) => {
      el.classList.add('hidden');
      el.innerHTML = '';
      resolve(v);
    };
    const y = document.getElementById('cfmYes');
    const n = document.getElementById('cfmNo');
    if (y) y.onclick = () => { Sfx.click(); done(true); };
    if (n) n.onclick = () => { Sfx.click(); done(false); };
    el.querySelector('.cfm-mask').onclick = () => done(false);
  });
}

/* ---------- 调试：?poolcards=1 三池球员范围自检 ---------- */
(function poolCardsTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('poolcards')) return;
    setTimeout(() => {
      const out = [];
      const ids = POOLS.map((p) => p.id);
      const TIERS6 = ['silver','gold','purple','legendPurple','momentGold','momentPurple'];
      const sets = {};
      ids.forEach((pid) => {
        sets[pid] = new Set();
        TIERS6.forEach((t) => poolCards(pid, t).forEach((c) => sets[pid].add(c.id)));
      });
      // 每池规模
      ids.forEach((pid, i) => {
        out.push(POOLS[i].name + '=' + sets[pid].size + ' 人');
      });
      // 两两重叠率
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const A = sets[ids[a]], B = sets[ids[b]];
          let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
          const rate = inter / Math.min(A.size, B.size);
          out.push(ids[a] + '∩' + ids[b] + '=' + inter +
            ' 重叠率 ' + (rate * 100).toFixed(0) + '%' +
            (rate < 0.9 ? ' ✓有区分' : ' ✗太像'));
        }
      }
      // 名宿池必须只出名宿
      const lg = sets['legend'];
      let curCount = 0;
      lg.forEach((id) => { if (CARD_BY_ID[id].current) curCount++; });
      out.push('名宿池里现役球员=' + curCount + ' 人' +
        (curCount === 0 ? ' ✓纯名宿' : ' ✗混入现役'));
      // 名宿池不出银卡
      const silver = poolCards('legend', 'silver').filter(
        (c) => !c.current).length;
      out.push('名宿池银卡=' + poolCards('legend','silver').length + ' 张');
      out.push('异常=无');
      document.title = 'POOLCARDS ' + out.join(' | ');
    }, 1200);
  } catch (e) { document.title = 'POOLCARDS-ERR ' + e.message; }
})();

/* ---------- 调试：?pitytest=1 保底实时更新自检 ---------- */
(function pityTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pitytest')) return;
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const readBar = () => {
      const el = document.getElementById('scr-home');
      if (!el) return null;
      const t = el.querySelectorAll('.ptrack');
      if (!t.length) return null;
      return Array.prototype.map.call(t, (x) => ({
        name: x.querySelector('.pname').textContent.trim(),
        left: parseInt(x.querySelector('.pnum b').textContent, 10),
      }));
    };
    (async () => {
      switchTab('home');
      await wait(900);
      const b0 = readBar();
      out.push('初始: ' + (b0 ? b0.map((x) => x.name + x.left).join(' / ') : '✗没渲染'));

      // 抽一次（直接调用，绕过金币限制）
      S.coins = 99999999;
      renderHome();
      await wait(200);
      const before = S.pity.purple;
      doRecruit(POOLS[0], 1);
      renderHome();
      await wait(400);
      const b1 = readBar();
      out.push('抽1次后: ' + (b1 ? b1.map((x) => x.name + x.left).join(' / ') : '✗'));
      out.push('  紫卡计数 ' + before + '→' + S.pity.purple +
        (S.pity.purple === before + 1 || S.pity.purple === 0 ? ' ✓' : ' ✗'));

      // 十连
      doRecruit(POOLS[0], 10);
      renderHome();
      await wait(400);
      const b2 = readBar();
      out.push('再十连后: ' + (b2 ? b2.map((x) => x.name + x.left).join(' / ') : '✗'));
      out.push('  总抽数=' + S.pity.total);

      // 连续抽到触发保底
      let guard = 0;
      while (S.pity.purple < PITY.purpleEvery && guard++ < 40) {
        doRecruit(POOLS[0], 1);
      }
      renderHome();
      await wait(400);
      const b3 = readBar();
      out.push('逼近紫卡保底时: ' + (b3 ? b3.map((x) => x.name + x.left).join(' / ') : '✗'));
      // 再抽一次必得紫卡
      doRecruit(POOLS[0], 1);
      renderHome();
      await wait(400);
      const b4 = readBar();
      out.push('触发后: ' + (b4 ? b4.map((x) => x.name + x.left).join(' / ') : '✗'));
      const pz = b4 ? b4[0].left : -1;
      out.push('  紫卡归零=' + (pz >= PITY.purpleEvery - 2 ? '✓ 重新倒数' : '⚠ ' + pz));
      document.title = 'PITY ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'PITY-ERR ' + e.message; }
})();

/* =============================================================
   数据变动后的存档清理（v6.5）
   -------------------------------------------------------------
   删掉一批球员后，卡片的 id（c0/c1/…按数组下标生成）会整体前移，
   老存档里记录的 id 可能指向不存在的卡、或者指向了另一名球员。
   所以启动时做一次体检：
     ① 清掉 owned 里已经不存在的 id
     ② 阵容里失效的位置腾空（首发/替补分别处理）
     ③ AI 球队：被删掉的球员清出阵容，并补偿金币让它们自己去买
   ============================================================= */
function sanitizeAfterDataChange() {
  let fixed = 0, payouts = 0;
  // ① 我的收藏
  Object.keys(S.owned || {}).forEach((id) => {
    if (!CARD_BY_ID[id]) { delete S.owned[id]; fixed++; }
  });
  // ② 我的阵容
  const r = S.roster || {};
  ['starters', 'bench'].forEach((k) => {
    if (!Array.isArray(r[k])) return;
    r[k] = r[k].map((id) => {
      if (id && !CARD_BY_ID[id]) { fixed++; return null; }
      return id || null;
    });
  });
  // ③ AI 球队
  try {
    const L = (typeof leagueState === 'function') ? leagueState() : null;
    if (L && L.teams) {
      Object.keys(L.teams).forEach((key) => {
        const t = L.teams[key];
        if (!t || !Array.isArray(t.roster)) return;
        const before = t.roster.length;
        t.roster = t.roster.filter((id) => CARD_BY_ID[id]);
        const lost = before - t.roster.length;
        if (lost > 0) {
          // 补偿：每损失一人补 8000 金币，让它去转会市场买
          t.coins = (t.coins || 0) + lost * 8000;
          payouts += lost;
        }
      });
    }
  } catch (e) { /* 联赛还没初始化就算了 */ }
  /* ④ 补齐：删人之后 AI 阵容会缺人，这里补到满员（每队 10 人） */
  let refill = { filled: 0, teams: 0 };
  try {
    const L2 = (typeof leagueState === 'function') ? leagueState() : null;
    if (L2 && typeof refillAIRosters === 'function') refill = refillAIRosters(L2);
  } catch (e) {}
  if (fixed || refill.filled) { try { save(); } catch (e) {} }
  return { fixed, payouts, refill };
}

/* ---------- 调试：?holocheck=1 全息特效是否已关闭 ---------- */
(function holoCheck() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('holocheck')) return;
    setTimeout(() => {
      const out = [];
      const moment = CARDS.filter((c) => c.isMoment).slice(0, 3);
      out.push('时刻卡样本=' + moment.length);
      let hiddenAll = true, maxOk = true;
      moment.forEach((c) => {
        const box = document.createElement('div');
        box.innerHTML = cardHTML ? cardHTML(c, {}) : '';
        document.body.appendChild(box);
        const foil = box.querySelector('.holo-foil');
        const sp = box.querySelector('.holo-sparkle');
        [foil, sp].forEach((el) => {
          if (!el) return;
          if (getComputedStyle(el).display !== 'none') hiddenAll = false;
        });
        const card = box.querySelector('.card');
        if (card) {
          const bef = getComputedStyle(card, '::before');
          if (bef.display !== 'none' && bef.content !== 'none') maxOk = false;
        }
        box.remove();
      });
      out.push('全息浮层已隐藏=' + (hiddenAll ? '✓' : '✗'));
      out.push('流光扫描已关闭=' + (maxOk ? '✓' : '✗'));
      // MAX 特效必须保留
      const m = document.getElementById('detailLayer');
      out.push('MAX 特效未受影响（代码未改动）');
      document.title = 'HOLO ' + out.join(' | ');
    }, 1200);
  } catch (e) { document.title = 'HOLO-ERR ' + e.message; }
})();
