/* =============================================================
   📲 PWA 注册（离线玩 + 添加到主屏幕）
   -------------------------------------------------------------
   只在「通过网址打开」时注册 Service Worker。
   从「文件」App 直接打开（file://）时不注册 —— 那种情况下
   SW 根本用不了，而且 iOS 还会禁用 localStorage。

   装好之后：
     · 断网 / 飞行模式照样能玩
     · 添加到主屏幕后全屏横屏运行，像原生 App
     · 存档正常保存（同源 localStorage）
   ============================================================= */
(function () {
  'use strict';

  var isFile = location.protocol === 'file:';
  var canSW = 'serviceWorker' in navigator && !isFile;

  /* =============================================================
     ★★★ v9.52 平台检测（修「安卓玩家看到 iPhone 教程」）
     -------------------------------------------------------------
     问题：安装教程写死了「用 Safari 打开 → 点分享 → 添加到主屏幕」，
     这是 iPhone 的步骤。**安卓手机上没有 Safari**，玩家看到会懵，
     以为游戏不支持安卓就放弃了（有玩家反馈"安卓不能玩"）。

     全项目原先**零平台检测**，同一段 iOS 文案无差别显示给所有人。

     现在统一在这里判平台，并通过 window.__platform 暴露给 app.js 共用
     （避免两处各写一套判断，将来不一致）。

     判断要点：
       · iPadOS 13+ 的 Safari 会把自己伪装成 Mac（"Macintosh"），
         但它是触屏 —— 用 maxTouchPoints > 1 才能认出来
       · 微信/QQ 内置浏览器必须单独识别：它们不支持"添加到主屏幕"，
         正确做法是「在浏览器中打开」，所以文案完全不同
       · 安卓上不同浏览器的安装入口也不一样（Chrome 有原生安装提示，
         三星浏览器在菜单里，其他浏览器只能"添加到主屏幕"）
     ============================================================= */
  var UA = navigator.userAgent || '';
  var PF = (function () {
    var ua = UA;
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS 伪装成 Mac
    var isAndroid = /Android/i.test(ua);
    var wechat = /MicroMessenger/i.test(ua);
    /* ★ 注意区分两个东西（一开始判错了）：
         · QQ 浏览器（MQQBrowser）—— 正规浏览器，能装到桌面，**不算 inApp**
         · QQ App 内置浏览器（UA 里有 "QQ/8.x" 且没有 MQQBrowser）—— 才算 inApp
       只写 /QQ/ 会把 QQ 浏览器也误判成内置浏览器，于是给它显示
       「请用浏览器打开」，而它本身就是浏览器 —— 自相矛盾。 */
    var qqApp = /\sQQ\/[\d.]+/i.test(ua) && !/MQQBrowser/i.test(ua);
    var inApp = wechat || qqApp || /FBAN|FBAV|Instagram|Line\//i.test(ua);
    var chrome = /Chrome\//i.test(ua) && !/Edg|OPR|SamsungBrowser|HuaweiBrowser|MiuiBrowser|UCBrowser|MQQBrowser/i.test(ua);
    var samsung = /SamsungBrowser/i.test(ua);
    var edge = /Edg/i.test(ua);
    var firefox = /Firefox|FxiOS/i.test(ua);
    var opera = /OPR\/|Opera/i.test(ua);
    var safari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
    /* 国产浏览器（都是 Chromium 内核，能玩；只是菜单路径不同） */
    var huawei = /HuaweiBrowser/i.test(ua);
    var mi = /MiuiBrowser|XiaoMi/i.test(ua);
    var uc = /UCBrowser|UBrowser/i.test(ua);
    var qqb = /MQQBrowser/i.test(ua);
    var browserName = huawei ? '华为浏览器' : mi ? '小米浏览器' : uc ? 'UC 浏览器'
      : qqb ? 'QQ 浏览器' : opera ? 'Opera' : chrome ? 'Chrome' : '浏览器';
    var os = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
    return {
      os: os, isIOS: isIOS, isAndroid: isAndroid, isDesktop: os === 'desktop',
      wechat: wechat, qq: qqApp, inApp: inApp,
      chrome: chrome, samsung: samsung, edge: edge, firefox: firefox, safari: safari,
      opera: opera, huawei: huawei, mi: mi, uc: uc, qqb: qqb,
      browserName: browserName,
      /* 中文名，界面上直接显示 */
      osName: isIOS ? 'iPhone / iPad' : isAndroid ? '安卓' : '电脑',
    };
  })();

  /** 各平台的「装到桌面」步骤（设置页与提示条共用） */
  function installSteps() {
    if (PF.inApp) {
      return {
        title: PF.wechat ? '微信里打不开，请用浏览器打开' : '请用浏览器打开',
        steps: [
          '点右上角「···」',
          PF.wechat ? '选「在浏览器打开」' : '选「用浏览器打开」',
          '在浏览器里再按下面 ' + (PF.isAndroid ? '安卓' : 'iPhone') + ' 的步骤装到桌面',
        ],
        note: PF.wechat ? '微信内置浏览器不支持这个游戏，会白屏。'
          : 'App 内置浏览器不支持，请用系统浏览器打开。',
      };
    }
    if (PF.isAndroid) {
      if (PF.chrome) {
        return {
          title: '安卓 · Chrome',
          steps: [
            '用 <b>Chrome</b> 打开游戏（你现在就是）',
            '点右上角 <b>「⋮」</b> 菜单',
            '选 <b>「安装应用」</b>（有的版本叫「添加到主屏幕」）',
            '回桌面，点篮球图标启动 —— 就是全屏横屏了',
          ],
          note: 'Chrome 有时会自己在底部弹出「安装应用」提示，直接点更方便。',
        };
      }
      if (PF.samsung) {
        return {
          title: '安卓 · 三星浏览器',
          steps: [
            '用<b>三星浏览器</b>打开游戏',
            '点右下角 <b>「≡」</b>菜单',
            '选 <b>「添加页面到」→「主屏幕」</b>',
            '回桌面，点篮球图标启动',
          ],
          note: '也可以换成 Chrome，安装入口更明显。',
        };
      }
      /* ★ 任何安卓浏览器都能玩 —— 实测 10 种全部通过
         （Chrome / Edge / 三星 / Firefox / 华为 / 小米 / UC / QQ / Opera / 系统 WebView）
         这里只是菜单路径不同，「装到桌面」的入口各叫各的名字。 */
      if (PF.edge) {
        return {
          title: '安卓 · Edge',
          steps: [
            '点右下角 <b>「···」</b>菜单',
            '选 <b>「添加到手机」</b>',
            '确认添加',
            '回桌面，点篮球图标启动',
          ],
          note: 'Edge 也能正常玩，装到桌面后一样有横屏全屏和离线。',
        };
      }
      if (PF.firefox) {
        return {
          title: '安卓 · Firefox',
          steps: [
            '点右上角 <b>「⋮」</b>菜单',
            '选 <b>「安装」</b>或<b>「添加到主屏幕」</b>',
            '确认添加',
            '回桌面，点篮球图标启动',
          ],
          note: 'Firefox 也能正常玩。',
        };
      }
      return {
        title: '安卓 · ' + (PF.browserName || '当前浏览器'),
        steps: [
          '点浏览器的<b>菜单按钮</b>（一般在右上角「⋮」或右下角「≡」/「三」）',
          '找 <b>「添加到主屏幕」/「添加书签」→「桌面」/「安装」</b>'
            + (PF.huawei ? '（华为浏览器在「书签」里）' : '')
            + (PF.mi ? '（小米浏览器在「工具箱」里）' : ''),
          '确认添加',
          '回桌面，点篮球图标启动',
        ],
        note: '找不到也没关系 —— <b>直接在浏览器里玩完全一样</b>，'
            + '只是没有全屏横屏、断网不能玩。想装的话换成 Chrome 入口最显眼。',
      };
    }
    if (PF.isIOS) {
      return {
        title: 'iPhone / iPad · 必须用 Safari',
        steps: [
          '用 <b>Safari</b> 打开游戏' + (PF.safari ? '（你现在就是）' : '（现在是别的浏览器，请换 Safari）'),
          '点底部中间的 <b>「分享」</b>（方框 + 向上箭头）',
          '往下滑，点 <b>「添加到主屏幕」</b>',
          '回桌面，点篮球图标启动 —— 就是横屏的了',
        ],
        note: '一定要<b>先用 Safari 打开一次</b>再加到主屏幕，否则打开会白屏。',
      };
    }
    return {
      title: '电脑',
      steps: [
        '点浏览器<b>地址栏右侧</b>的「安装」小图标',
        '或者点右上角菜单 → <b>「安装 巅峰球星卡」</b>',
        '装好后会变成独立窗口，像 App 一样',
      ],
      note: '不装也能玩，直接用浏览器打开即可。',
    };
  }

  /* =============================================================
     ★★★ v9.56 老内核兼容（修「华为 Nova 6 界面跟别人不一样」）
     -------------------------------------------------------------
     玩家反馈用华为 Nova 6 时界面和别人不一样。

     排查：nova 6 是 2019 年 12 月的机型，出厂 EMUI 10，
     原厂浏览器内核约 **Chromium 74~77**（2019 年）。如果没升级系统，
     就会缺这几样现代 CSS：

       · **flex 的 gap**      → Chromium 84+ 才有（本项目用了 247 条规则！）
       · aspect-ratio        → Chromium 88+
       · inset               → Chromium 87+
       · clamp() / min()     → Chromium 79+
       · :has()              → Chromium 105+

     实测模拟（把 gap/aspect-ratio/inset 全部置为失效）：
       页面骨架没崩，但**大量元素挤在一起、重叠 29 处**
       —— 最明显的是首页推荐卡和保底进度条叠在一起。
       这就是玩家说的"界面不一样"。

     修法：
       ① 运行时**实测** flex gap 是否生效（不是猜 UA —— UA 会被伪装，
          而且同一机型升级系统后内核会变）
       ② 不支持就给 <html> 加 .nogap，由 compat.css 补等效外边距
       ③ compat.css 由 tools/gen-compat.js 从各 CSS 自动生成（240 条）

     ★ 为什么用 .nogap 类门控、而不用 @supports：
       `@supports (gap:1px)` 在 Chrome 57+ 就返回 true（那是 **grid** 的 gap），
       无法区分 flex gap。用类门控最可靠，且现代浏览器不会双倍间距。
     ============================================================= */
  /** 实测 flex gap 是否生效 */
  function hasFlexGap() {
    try {
      var box = document.createElement('div');
      box.style.cssText = 'display:flex;gap:10px;position:absolute;left:-9999px;top:0;width:100px';
      var a = document.createElement('i'), b = document.createElement('i');
      a.style.cssText = b.style.cssText = 'width:20px;height:10px;flex:0 0 20px';
      box.appendChild(a); box.appendChild(b);
      document.body.appendChild(box);
      var gap = b.getBoundingClientRect().left - a.getBoundingClientRect().right;
      box.remove();
      return gap > 1;
    } catch (e) { return true; }        // 检测失败就当作支持，不冒险
  }
  /** 实测 aspect-ratio 是否生效 */
  function hasAspectRatio() {
    try {
      var el = document.createElement('div');
      el.style.cssText = 'aspect-ratio:2/1;width:100px;position:absolute;left:-9999px';
      document.body.appendChild(el);
      var h = el.getBoundingClientRect().height;
      el.remove();
      return h > 40 && h < 60;          // 2:1 → 高度应约 50
    } catch (e) { return true; }
  }
  /** 实测 clamp() 是否生效 */
  function hasClamp() {
    try {
      var el = document.createElement('div');
      el.style.cssText = 'font-size:clamp(10px,1vw,20px);position:absolute;left:-9999px';
      document.body.appendChild(el);
      var fs = parseFloat(getComputedStyle(el).fontSize);
      el.remove();
      return fs > 0 && fs !== 16;        // 不支持时会退回 16px 默认值
    } catch (e) { return true; }
  }

  var COMPAT = { flexGap: true, aspectRatio: true, clamp: true };
  function initCompat() {
    COMPAT.flexGap = hasFlexGap();
    COMPAT.aspectRatio = hasAspectRatio();
    COMPAT.clamp = hasClamp();
    var cls = document.documentElement.classList;
    cls.toggle('nogap', !COMPAT.flexGap);
    cls.toggle('noar', !COMPAT.aspectRatio);
    cls.toggle('noclamp', !COMPAT.clamp);
    /* 暴露出去，方便设置页显示/排查 */
    window.__compat = COMPAT;
    if (!COMPAT.flexGap || !COMPAT.aspectRatio) {
      try {
        console.warn('[兼容模式] 检测到老内核：flexGap=' + COMPAT.flexGap +
          ' aspectRatio=' + COMPAT.aspectRatio + ' clamp=' + COMPAT.clamp);
      } catch (e) {}
    }
  }

  /* =============================================================
     ★★★ v9.54 性能模式（修「安卓高刷屏玩起来很卡」）
     -------------------------------------------------------------
     玩家反馈安卓手机很卡。实测排查发现：

       · JS 逻辑**很快**（最慢的操作 46ms，多数 <10ms）→ 不是代码问题
       · 布局在所有安卓尺寸下**零溢出** → 不是适配问题
       · 但项目里有 **36 处无限循环动画**（animation: ... infinite），
         其中 holo.css 的镭射卡特效有 7 个（5.5s~18s 循环）
       · 还有 577 处 box-shadow、14 处 backdrop-filter

     为什么在手机上才卡：
       ① **高刷屏**——vivo X100s / 小米14 / 三星S24 都是 120Hz，
          动画按 120 帧/秒重绘，负载是 60Hz 的两倍
       ② **手机 GPU 填充率低**——box-shadow 和 blur 是逐像素开销，
          桌面 GPU 无感，手机 GPU 很吃力
       ③ 图鉴/阵容一次显示几十张卡，每张都在跑自己的镭射动画

     策略：**只砍装饰，不动玩法**。
       · 停掉无限循环动画（一次性动画如抽卡揭示保留）
       · 毛玻璃 → 纯色
       · 列表项去阴影 + 单独合成层
       · 长列表 contain: layout paint style（只重绘可见部分）

     怎么决定开不开：
       · 安卓一律开（实测最需要，且 UI 影响最小）
       · 其他平台实测刷新率 ≥ 90Hz 也开
       · 玩家可在「设置 → 性能模式」手动开关，选择会记住
     ============================================================= */
  var PERF_KEY = 'peak-card-perf';

  function perfPref() {
    try {
      var v = localStorage.getItem(PERF_KEY);
      return v === null ? null : v === '1';     // null = 没设置过，跟随自动判断
    } catch (e) { return null; }
  }
  function setPerfPref(on) {
    try { localStorage.setItem(PERF_KEY, on ? '1' : '0'); } catch (e) {}
  }
  function applyPerf(on) {
    try {
      document.documentElement.classList.toggle('perf', !!on);
      window.__perfOn = !!on;
    } catch (e) {}
  }

  /** 测屏幕刷新率（60 / 90 / 120 / 144Hz）——决定要不要降特效 */
  function detectHz(cb) {
    var frames = 0, t0 = 0;
    function loop(t) {
      if (!t0) t0 = t;
      frames++;
      if (t - t0 < 320) requestAnimationFrame(loop);
      else {
        var hz = Math.round(frames / ((t - t0) / 1000));
        cb(hz);
      }
    }
    try { requestAnimationFrame(loop); } catch (e) { cb(60); }
  }

  function initPerf() {
    var pref = perfPref();
    if (pref !== null) { applyPerf(pref); return; }      // 玩家手动设过 → 听玩家的
    /* 没设过：安卓直接开（实测最需要），其他平台看刷新率 */
    if (PF.isAndroid) { applyPerf(true); detectHz(function (hz) { window.__perfHz = hz; }); return; }
    detectHz(function (hz) { window.__perfHz = hz; applyPerf(hz >= 90); });
  }
  window.__setPerf = function (on) { setPerfPref(on); applyPerf(on); };
  window.__detectHz = detectHz;

  /* 暴露给 app.js 共用，避免两边各写一套判断 */
  window.__platform = PF;
  window.__installSteps = installSteps;

  /* ---------- 兜底：存储不可用时提醒 ---------- */
  function storageWarn() {
    try {
      localStorage.setItem('__probe__', '1');
      localStorage.removeItem('__probe__');
      return;
    } catch (e) { /* 不可用，往下走 */ }
    var bar = document.createElement('div');
    bar.id = 'pwaWarn';
    bar.innerHTML = '⚠️ <b>这个打开方式不保存进度</b>' +
      '（iOS 从「文件」App 直接打开会禁用本地存储）。<br>' +
      '请改用<b>网址</b>打开，或到「设置」里用 <b>📤 导出存档</b> 手动备份。';
    document.body.appendChild(bar);
  }

  /* ---------- 离线小提示条 ---------- */
  function statusBar() {
    var bar = document.createElement('div');
    bar.id = 'pwaBar';
    document.body.appendChild(bar);
    var t = null;
    function show(msg, cls, ms) {
      bar.textContent = msg;
      bar.className = cls || '';
      bar.classList.add('show');
      clearTimeout(t);
      if (ms) t = setTimeout(function () { bar.classList.remove('show'); }, ms);
    }
    window.__pwaToast = show;
    window.addEventListener('offline', function () { show('📴 已离线 —— 照样能玩', 'off', 2600); });
    window.addEventListener('online', function () { show('🌐 已恢复联网', 'on', 1800); });
  }

  /* =============================================================
     ★ v4：删掉了「正在准备离线版…」浮层
     -------------------------------------------------------------
     那个浮层是 v2/v3 用来显示 **SW 自己批量下载** 的进度。
     实机上它有两个致命问题：
       · iOS 掐断 SW 后进度不再更新，浮层**永远卡住**（即使显示 100%）；
       · 它和设置页的进度来自不同数据源，数字**互相矛盾**
         （用户看到 30%→0%→50%→0% 乱跳）。

     v4 把下载交给**页面**，进度只在「设置 → 📴 离线缓存」里显示，
     单一数据源、单调递增。这里不再有全屏浮层。
     ============================================================= */

  /* =============================================================
     🎉 更新提醒（v9.45 用户要求）
     -------------------------------------------------------------
     用户要求：「只要我这边更新了以后，手机联网后也能收到更新提醒，
     并且有确认更新提示的选项」。

     做法：
       · SW 每次装好新版会进入 waiting 状态（因为我们用了 skipWaiting，
         更常见的是 controllerchange 直接触发）。两种都处理：
           - 发现 reg.waiting  → 有新版本等着 → 弹提醒
           - controllerchange  → 新版本已接管 → 弹提醒
       · 弹一个横幅：「🎉 发现新版本」，两个按钮：
           「立即更新」→ 通知 SW skipWaiting，然后刷新
           「稍后」    → 收起，本次会话不再提示（下次打开再提醒）
       · 对比 SW 版本号存进 localStorage，让"是否真有新版"可判断，
         避免每次启动都误报。
     ============================================================= */
  var VER_KEY = 'peak-card-sw-ver';
  var updateShown = false;

  function getVer() {
    try { return localStorage.getItem(VER_KEY) || ''; } catch (e) { return ''; }
  }
  function setVer(v) {
    try { if (v) localStorage.setItem(VER_KEY, v); } catch (e) {}
  }

  function showUpdateBanner(newVer, onConfirm) {
    if (updateShown) return;
    if (document.getElementById('updateBar')) return;
    updateShown = true;

    var bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.innerHTML =
      '<span class="ub-ic">🎉</span>' +
      '<span class="ub-txt">发现新版本' + (newVer ? '（' + newVer + '）' : '') +
      '　更新后存档不会丢</span>' +
      '<button class="ub-yes">立即更新</button>' +
      '<button class="ub-no">稍后</button>';
    document.body.appendChild(bar);
    /* 用 rAF 触发过渡，保证动画能播 */
    requestAnimationFrame(function () { bar.classList.add('show'); });

    bar.querySelector('.ub-yes').onclick = function () {
      try { if (window.Sfx) Sfx.click(); } catch (e) {}
      window.__swUserConfirmed = true;      // 标记"用户已确认"，让 controllerchange 去刷新
      bar.querySelector('.ub-txt').textContent = '正在更新…';
      bar.querySelector('.ub-yes').disabled = true;
      bar.querySelector('.ub-no').disabled = true;
      onConfirm();
    };
    bar.querySelector('.ub-no').onclick = function () {
      try { if (window.Sfx) Sfx.click(); } catch (e) {}
      bar.classList.remove('show');
      setTimeout(function () { bar.remove(); }, 400);
    };
  }

  /** 通知 waiting 的 SW 立刻接管，然后刷新页面 */
  function applyUpdate(reg) {
    var doReload = function () { location.reload(); };
    var w = reg && reg.waiting;
    /* ★ 没有 waiting 的情况（三方比对发现版本不一致，但浏览器还没下完新版）：
       先主动触发一次 update()，等新 SW 就绪后再刷新。
       兜底：最多等 6 秒，到点也刷新（普通刷新也能让浏览器重新检查）。 */
    if (!w && reg) {
      var done2 = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (done2) return;
        done2 = true;
        doReload();
      });
      try {
        var pr = reg.update();
        if (pr && pr.catch) pr.catch(function () {});
      } catch (e) {}
      setTimeout(function () { if (!done2) { done2 = true; doReload(); } }, 6000);
      return;
    }
    if (w) {
      /* 监听 controllerchange 再刷新，避免刷在新的还没接管时 */
      var done = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (done) return;
        done = true;
        doReload();
      });
      try { w.postMessage({ type: 'sw-skip-waiting' }); } catch (e) {}
      /* 兜底：3 秒还没接管也刷一次 */
      setTimeout(function () { if (!done) { done = true; doReload(); } }, 3000);
    } else {
      doReload();
    }
  }

  /* 把 applyUpdate 暴露给 app.js 的「检查更新」按钮用
     （这样按钮能做到"一键更新"，不用用户再点横幅） */
  window.__swApplyUpdate = function (reg) { applyUpdate(reg); };

  /* ---------- 注册 ---------- */
  function register() {
    if (!canSW) {
      if (isFile) storageWarn();
      return;
    }
    /* ★★★ updateViaCache:'none' 是关键（iOS 必加）
       -------------------------------------------------------------
       默认情况下，浏览器做"检查 SW 更新"时会**先看 HTTP 缓存**里的
       sw.js。GitHub Pages 给静态文件发了缓存头，于是即使服务器
       发布了新版本，检查时仍然读到旧的 sw.js → **永远发现不了更新**。
       实测：不加这个参数，模拟发布新版后 25 秒都没检测到；
             加上之后立刻检测到。

       'none' 表示：连 sw.js 本身都不走 HTTP 缓存，每次都问服务器。 */
    navigator.serviceWorker.register('sw.js', {
      scope: './',
      updateViaCache: 'none',
    }).then(function (reg) {
      /* ★ v4：这里不再监听 sw-progress / sw-status 去驱动浮层。
         缓存进度由「设置 → 📴 离线缓存」面板（app.js 的 bindOfflineCache）
         自己查询和显示 —— 单一数据源，不会出现数字打架。
         SW 每次装好新版会通过 controllerchange 触发页面刷新（见下）。 */

      /* -------------------------------------------------------------
         ★ 主动更新检查（iOS 关键）
         -------------------------------------------------------------
         用户反馈「不连同一个 WiFi 时有些球员图片不显示」——
         根因之一是**旧的 SW 还在跑**（旧版一次性装 589 张图，
         iOS 会中途掐断，导致缓存不全）。
         这里每次回到前台都查一次更新，确保拿到最新版 SW。
         ============================================================= */
      window.__swReg__ = reg;      // 供设置页「检查更新」按钮使用
      function checkUpdate() {
        /* ★ 必须 catch —— 断网时 reg.update() 会 reject，
           不接住就会在控制台刷 "Failed to update a ServiceWorker" 错误，
           玩家离线玩的时候看到一堆红字会以为坏了。 */
        try {
          var p = reg.update();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
      checkUpdate();
      /* 从后台切回前台时再查一次（iOS 上 PWA 常被挂起，靠这个兜底） */
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) checkUpdate();
      });
      window.addEventListener('online', checkUpdate);

      /* -------------------------------------------------------------
         🎉 更新检测：不再"静默自动刷新"，改成**先问用户**
         -------------------------------------------------------------
         之前 controllerchange 直接 location.reload()，玩家会看到
         游戏突然自己闪一下，可能正在打比赛就被打断了。
         现在改成：发现新版 → 弹横幅 → 用户点「立即更新」才刷新。
         （用户明确要求「有确认更新提示的选项」）
         ============================================================= */
      /* -------------------------------------------------------------
         ★ 关键：先问"当前跑的是哪个版本"，记录下来
         -------------------------------------------------------------
         之前一发现 reg.waiting 就弹横幅，导致**首次安装也会误报**
         "发现新版本"（因为装完 controller 还是旧的）。
         现在改成：先拿到运行中的版本存起来，只有**真的变了**才提示。
         ============================================================= */
      var runningVer = '';       // 当前实际在跑的 SW 版本
      var verReady = false;      // 是否已经拿到版本号

      function askRunningVer() {
        return new Promise(function (resolve) {
          var sw = navigator.serviceWorker.controller || reg.active;
          if (!sw) { resolve(''); return; }
          var done = false;
          var ch = new MessageChannel();
          ch.port1.onmessage = function (ev) {
            var d = ev.data || {};
            if (d.type === 'sw-version' && d.version) { done = true; resolve(d.version); }
          };
          try { sw.postMessage({ type: 'sw-version' }, [ch.port2]); } catch (e) { resolve(''); return; }
          setTimeout(function () { if (!done) resolve(''); }, 2500);
        });
      }

      /* -------------------------------------------------------------
         ★ 再问一次"服务器上是哪个版本"
         -------------------------------------------------------------
         为什么需要这个：
           `reg.waiting` 只在浏览器**已经悄悄下好**新版 SW 时才为真。
           如果用户打开游戏时浏览器还没来得及检查更新，waiting 就是 null，
           横幅**永远不弹** —— 这正是用户反馈"看不到更新提醒"的原因。

           直接读服务器的 sw.js（加 no-store 绕过缓存）拿到最新版本号，
           和 localStorage 里记录的比对，就能**立刻**判断出有没有新版，
           不依赖浏览器的后台检查时机。
         ============================================================= */
      function askServerVer() {
        return fetch('sw.js', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (t) {
            var m = /const VERSION = "([^"]+)"/.exec(t || '');
            return m ? m[1] : '';
          })
          .catch(function () { return ''; });
      }

      /* 版本已就绪后，把"当前版本"写进存储（首次打开时这是新版，
         所以不会误报）。之后再有变化就是真的更新了。 */
      function markRunningVer(v) {
        runningVer = v || '';
        var known = getVer();
        if (!known && v) setVer(v);          // 首次：登记，不提示
        verReady = true;
      }

      /* -------------------------------------------------------------
         ★★★ v9.50 修复"更新后横幅不消失 / 每次打开都弹"
         -------------------------------------------------------------
         SW 接管后会主动广播自己的版本号（见 sw.template.js 的 activate）。
         页面收到后：
           ① 把"记录版本"更新成它 —— 于是"记录 == 服务器"，不再误判
           ② 撤掉可能还挂着的横幅与"正在更新…"状态
         ============================================================= */
      navigator.serviceWorker.addEventListener('message', function (ev) {
        var d = ev.data || {};
        if (d.type !== 'sw-version' || !d.version) return;
        var known = getVer();
        if (known !== d.version) {
          setVer(d.version);
          runningVer = d.version;
        }
        /* 更新完成 → 收掉横幅 */
        var bar = document.getElementById('updateBar');
        if (bar) {
          bar.classList.remove('show');
          setTimeout(function () { try { bar.remove(); } catch (e) {} }, 400);
        }
      });

      function verChanged() {
        var known = getVer();
        if (!known) return false;            // 没登记过 → 不当成更新
        if (!runningVer) return false;       // 还没拿到运行版本 → 不猜
        return known !== runningVer;
      }

      /* -------------------------------------------------------------
         ★ 判定"真的有新版"的唯一可靠标准
         -------------------------------------------------------------
         必须是：**已经有新的 SW 装好、在 waiting 状态等着**
         （或正在 installing）。

         不要用"版本号字符串不同"来判断 —— 实测会误报：
         如果 localStorage 里记录的版本和当前 active 的版本不一致
         （换过部署、或上次更新没写成功），首次打开就会弹
         "发现新版本"，而其实根本没有新版可装。

         waiting 是浏览器给的事实，不会骗人。
         ============================================================= */
      function hasPending(reg2) {
        return !!(reg2 && (reg2.waiting || reg2.installing));
      }

      /**
       * 弹更新提醒。
       * @param {ServiceWorkerRegistration} reg2
       * @param {string} ver        显示的版本号（旧版本）
       * @param {boolean} force     三方比对发现版本不一致时传 true
       *                            （此时 reg.waiting 可能还是 null，
       *                              因为浏览器还没把新版 SW 下完）
       */
      function reportNew(reg2, ver, force) {
        if (!force && !hasPending(reg2)) return;
        showUpdateBanner(ver, function () { applyUpdate(reg2); });
      }

      /* 启动流程：记录当前版本 → 问服务器版本 → 比对 → 挂各种检测 */
      askRunningVer().then(function (v) {
        markRunningVer(v);

        /* ① 打开时就有新版在 waiting —— 最明确的信号 */
        var pending = !!reg.waiting;

        /* ② 三方比对：localStorage 记录 vs 运行中 vs 服务器
              —— 不依赖浏览器后台检查的时机，立刻能判断 */
        var stored = getVer();
        askServerVer().then(function (srv) {
          var stale = !!(stored && srv && stored !== srv);
          if (pending || stale) {
            /* 有新版等着 → 正常提示；仅版本对不上 → 强制提示
               （此时 reg.waiting 常为 null，但确实有新版本） */
            reportNew(reg, stored || runningVer, !pending && stale);
          }
          /* ★★★ v9.55 修复「点完更新下次打开还弹」
             -------------------------------------------------------------
             实测复现（线上）：
               点「立即更新」→ 运行中 SW = 3c573679d0 ✓
                                服务器      = 3c573679d0 ✓
                                但 localStorage 记录 = 8265d0e63e ✗ 没变
               → 下次打开又判定"记录 ≠ 服务器"→ 又弹一次。

             为什么没变：
               v9.50 让新 SW 在 **activate** 时广播自己的版本号，页面收到就登记。
               但如果新版 SW 已经装过（缓存里就是最新），这次只是**页面重新加载**，
               activate **不会再次触发** → 没有广播 → 页面永远没机会更新记录。

             修法：**服务器是权威**。每次加载只要拿到服务器版本，
             就把它写进记录（不论有没有弹横幅）。

             这样两种路径都自愈：
               · 没弹横幅（已是最新）→ 记录被纠正，下次不误弹
               · 点了更新（重新加载）→ 记录立刻追上服务器，下次不重复弹

             为什么"先弹再纠正"不会误报：
               判定用的是**本次加载开始时**读到的 stored（上方闭包已取值），
               所以本次该弹还是会弹；写记录只影响**下一次**打开。 */
          if (srv && stored !== srv) setVer(srv);
        });

        /* ② 运行中新版装好了 */
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state !== 'installed') return;
            if (!navigator.serviceWorker.controller) return;   // 首次安装不算更新
            askRunningVer().then(function (v2) {
              if (v2) markRunningVer(v2);
              reportNew(reg, runningVer);
            });
          });
        });

        /* ③ 新 SW 接管（skipWaiting 已生效） */
        var refreshed = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (refreshed) return;
          refreshed = true;
          askRunningVer().then(function (v2) {
            if (v2) markRunningVer(v2);
            /* 用户点过「立即更新」→ 刷新；否则只有在还有新版等着时才提示 */
            if (window.__swUserConfirmed) { location.reload(); return; }
            reportNew(reg, runningVer);
          });
        });
      });
    }).catch(function (e) {
      /* 注册失败不影响游戏本体，静默即可 */
      if (window.console) console.warn('SW 注册失败：', e && e.message);
    });
  }

  function boot() {
    initCompat();        /* ★ 老内核兼容检测（要在渲染前做） */
    initPerf();          /* ★ 尽早开性能模式，避免第一帧就卡 */
    statusBar();
    var isStandalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    /* 已装到主屏幕就不再提示安装 */
    if (!isStandalone && !isFile) {
      var tipMsg;
      if (PF.inApp) {
        /* 微信/QQ 里：先告诉他怎么跳出去，这是最要紧的一步 */
        tipMsg = PF.wechat
          ? '⚠️ 微信里可能打不开，点右上角「···」→「在浏览器打开」'
          : '⚠️ 请点右上角菜单「用浏览器打开」，体验更完整';
      } else if (PF.isAndroid) {
        tipMsg = PF.chrome
          ? '📲 想出门也能玩？点右上角「⋮」→「安装应用」'
          : '📲 想出门也能玩？点浏览器菜单 →「添加到主屏幕」（不装也能玩）';
      } else if (PF.isIOS) {
        tipMsg = '📲 想出门也能玩？点 Safari 底部「分享」→「添加到主屏幕」';
      } else {
        tipMsg = '📲 想更爽？点地址栏右侧的「安装」图标，变成独立窗口';
      }
      var tip = document.createElement('div');
      tip.id = 'pwaTip';
      tip.innerHTML = tipMsg;
      document.body.appendChild(tip);
      tip.classList.add('show');
      tip.onclick = function () { tip.classList.remove('show'); };
      setTimeout(function () { tip.classList.remove('show'); }, PF.inApp ? 12000 : 9000);
    }
    register();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
