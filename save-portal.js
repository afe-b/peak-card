/* =============================================================
   💾 存档加固（离线单文件版专用）
   -------------------------------------------------------------
   为什么需要它：
     单文件版是用「文件」App 打开本地 HTML（file:// 协议）。
     实测桌面 Chrome 在 file:// 下 localStorage **可以**用，
     但 iOS Safari 在 file:// 下**有可能禁用** localStorage
     （代码里原本的注释就是这么说的，而且这个坑真的有人踩过）。

     原来的兜底是「退回内存」—— 关掉页面进度就没了，体验很差。

   现在改成**多级降级**，尽最大可能把进度留下来：
     ① localStorage   —— 标准做法，最重要
     ② sessionStorage —— 至少同一会话内不丢
     ③ IndexedDB      —— 存储更大，且和 localStorage 是两套机制，
                          有时候一个被禁另一个还活着
     ④ 全都不行       —— 内存兜底 + 顶部红条提醒 + 引导导出存档

   设计要点：
     · **同步读、异步写**：游戏启动时要立刻读到存档，所以启动时
       先同步读 localStorage / sessionStorage；IndexedDB 是异步的，
       如果同步那两层都没数据，再异步补一次读，读到就热替换。
     · 不改变原有 API（Store.read / write / wipe），所以游戏主逻辑不用动。
   ============================================================= */
(function () {
  'use strict';

  var PROBE = '__peak_probe__';
  var IDB_NAME = 'peak-card-save';
  var IDB_STORE = 'kv';

  /* ---------- ① localStorage ---------- */
  var ls = (function () {
    try {
      localStorage.setItem(PROBE, '1');
      localStorage.removeItem(PROBE);
      return localStorage;
    } catch (e) { return null; }
  })();

  /* ---------- ② sessionStorage ---------- */
  var ss = (function () {
    try {
      sessionStorage.setItem(PROBE, '1');
      sessionStorage.removeItem(PROBE);
      return sessionStorage;
    } catch (e) { return null; }
  })();

  /* ---------- ③ IndexedDB（异步） ---------- */
  var idb = null;
  var idbReady = false;
  try {
    var openReq = indexedDB.open(IDB_NAME, 1);
    openReq.onupgradeneeded = function () {
      var db = openReq.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    openReq.onsuccess = function () { idb = openReq.result; idbReady = true; };
    openReq.onerror = function () { idb = null; };
  } catch (e) { idb = null; }

  function idbGet(key, cb) {
    if (!idb) return cb(null);
    try {
      var tx = idb.transaction(IDB_STORE, 'readonly');
      var rq = tx.objectStore(IDB_STORE).get(key);
      rq.onsuccess = function () { cb(rq.result == null ? null : rq.result); };
      rq.onerror = function () { cb(null); };
    } catch (e) { cb(null); }
  }
  function idbSet(key, val) {
    if (!idb) return;
    try {
      var tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(val, key);
    } catch (e) {}
  }

  /* ---------- 内存兜底 ---------- */
  var mem = {};
  var lastGood = null;   // 记录哪个后端真的写成功了，用来在界面上如实显示

  /* ---------- 统一 API ---------- */
  var Portal = {
    /** 启动时同步读：先 localStorage，再 sessionStorage */
    readSync: function (k) {
      if (ls) { try { var v = ls.getItem(k); if (v != null) { lastGood = 'localStorage'; return v; } } catch (e) {} }
      if (ss) { try { var v2 = ss.getItem(k); if (v2 != null) { lastGood = 'sessionStorage'; return v2; } } catch (e) {} }
      return mem[k] != null ? mem[k] : null;
    },
    /** 异步补读：同步层都没读到就试 IndexedDB */
    readAsync: function (k, cb) {
      idbGet(k, function (v) {
        if (v != null) { lastGood = 'IndexedDB'; cb(v); } else cb(null);
      });
    },
    /** 写：能写几层写几层（不互相排斥，多一份保险） */
    write: function (k, v) {
      var ok = false;
      if (ls) { try { ls.setItem(k, v); ok = true; lastGood = 'localStorage'; } catch (e) {} }
      if (ss) { try { ss.setItem(k, v); if (!ok) { ok = true; lastGood = 'sessionStorage'; } } catch (e) {} }
      idbSet(k, v);
      if (!ok) { mem[k] = v; lastGood = 'memory'; }
      return ok;
    },
    wipe: function (k) {
      if (ls) { try { ls.removeItem(k); } catch (e) {} }
      if (ss) { try { ss.removeItem(k); } catch (e) {} }
      idbSet(k, null);
      delete mem[k];
    },
    /** 给界面用：当前到底存在哪 */
    backendName: function () {
      if (ls) return '浏览器本地存储';
      if (ss) return '会话存储（关掉标签页会丢）';
      if (idb) return 'IndexedDB';
      return '仅内存（关掉就没了）';
    },
    /** 只要有任何一层可用就算 true（游戏靠它决定要不要提示） */
    get usable() { return !!(ls || ss || idb); },
    /** 真正"能持久"的只有 localStorage / IndexedDB */
    get persistent() { return !!(ls || idb); },
    get lsOK() { return !!ls; },
    get ssOK() { return !!ss; },
    get idbOK() { return !!idb; },
  };

  window.SavePortal = Portal;

  /* =============================================================
     接管原来的 Store（如果已经定义了）
     -------------------------------------------------------------
     app.js 里的 Store 是 IIFE 里创建的 const，没法直接改。
     所以这里在**加载顺序**上做文章：本文件必须在 app.js **之前**加载，
     它会预先挂一个 window.__SaveStoreOverride，app.js 检测到就用它。
     ============================================================= */
  window.__SaveStoreOverride = {
    get usable() { return Portal.usable; },
    get persistent() { return Portal.persistent; },
    read: function (k) { return Portal.readSync(k); },
    write: function (k, v) { return Portal.write(k, v); },
    wipe: function (k) { return Portal.wipe(k); },
  };

  /* ---------- 启动后：异步补读 + 状态提示 ---------- */
  function boot() {
    /* ① 同步层完全没读到 → 试 IndexedDB */
    var hadSync = ls || ss;
    if (!hadSync && idb) {
      Portal.readAsync('peak-card-recruit-v2', function (v) {
        if (!v) return;
        try {
          var st = JSON.parse(v);
          if (st && st.owned && window.S && window.load) {
            /* 用内存里的存档热替换（此时游戏已经读过一次了） */
            var cur = window.S;
            if (!cur || !cur.owned || Object.keys(cur.owned).length === 0) {
              window.S = Object.assign(window.DEFAULT_STATE ? window.DEFAULT_STATE() : {}, st);
              if (typeof window.renderAll === 'function') window.renderAll();
              toast('💾 已从 IndexedDB 恢复进度');
            }
          }
        } catch (e) {}
      });
    }
    /* ② 一层都没有 → 顶部红条警告 */
    if (!Portal.usable) {
      var w = document.createElement('div');
      w.id = 'saveWarn';
      w.innerHTML = '⚠️ <b>这个环境完全无法保存进度</b>（关掉页面就没了）。' +
        '请到「设置」用 <b>📤 导出存档文本</b> 手动备份。';
      document.body.appendChild(w);
    }
    /* ③ 只有会话存储 → 黄条提醒 */
    else if (!Portal.persistent) {
      var w2 = document.createElement('div');
      w2.id = 'saveWarn';
      w2.className = 'soft';
      w2.innerHTML = '💡 当前用的是<b>会话存储</b>，关掉 Safari 标签页进度会丢。' +
        '建议定期用「设置 → 📤 导出存档」备份。';
      document.body.appendChild(w2);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
