'use strict';
/* =============================================================
   🏛️ 名人堂 · 退役与生涯荣誉（v9.27 新增玩法）
   -------------------------------------------------------------
   为什么做这个：
     season.js 的统计（L.stats）是**按赛季**存的，赛季一换就重来。
     所以打到第 10 个赛季，没人说得清"我的中锋生涯一共拿了多少分"。
     30 个赛季的长线玩法因此没有终点感 —— 只有一座冷冰冰的冠军墙。

   这套东西补齐三件事：
     ① 跨赛季累计生涯数据（S.career，键是**球员 id**）
     ② 生涯荣誉清单（总冠军 / MVP / 得分王 / 全明星 / 周最佳…）
     ③ 够格的球员"入堂"，在历史页留下一张永久的名人堂卡

   ⚠️ 关键设计：生涯数据按 **球员** 累计，不按卡。
      同一名球员有常规卡和时刻卡两张卡，如果按卡累计，
      "科比"的生涯数据会被拆成两份，永远入不了堂。
      data.js 的 playerKeyOf(id) 就是干这个的 —— 但这里用 id 更稳，
      因为阵容里同一名球员只能上一张卡，不会重复计数。
   ============================================================= */

/* =============================================================
   入堂门槛（v9.29 调整）
   -------------------------------------------------------------
   原来是「累积 2000 分」。实测产量后发现门槛太松：
     队内得分王 22 分/场 × 82 场 = 1804 分/赛季 → **1.11 个赛季就入堂**
     队内最低   1 分/场 × 82 场 =   82 分/赛季 → 24.4 个赛季
   主力打一个多赛季就进名人堂，30 个赛季下来殿堂会被塞满，
   完全没有"殿堂"的分量。

   现在改成两层判断：
     · 生涯累积 ≥ HOF_POINTS（7000 分）—— 主力约 4 个赛季
     · 或者：生涯 ≥ HOF_POINTS_WITH_HONOR（5000 分）+ 拿过总冠军 / MVP
       （给"巅峰短但拿过冠军"的球员一条路，也是现实里的入选逻辑）
   ============================================================= */
const HOF_POINTS = 7000;              // 硬门槛：生涯累积得分
const HOF_POINTS_WITH_HONOR = 5000;   // 有冠军/MVP 时的放宽门槛
/** 这些荣誉可以把门槛从 7000 放宽到 5000 */
const HOF_AUTO_KINDS = { mvp: 1, champ: 1 };

/** 生涯数据总表 { 球员id: {g,pts,reb,ast,stl,blk,fgs...,seasons:[],feats:{}} } */
function hofState() {
  if (!S.career || typeof S.career !== 'object') S.career = {};
  return S.career;
}
/** 名人堂名单 [{ id, year, pts, ... }] */
function hofList() {
  if (!Array.isArray(S.hof)) S.hof = [];
  return S.hof;
}
function hofIn(id) { return hofList().some((x) => x.id === id); }

/** 取（或建）某球员的生涯记录 */
function careerOf(id) {
  const C = hofState();
  if (!C[id]) {
    C[id] = { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, seasons: [], feats: {} };
  }
  const c = C[id];
  if (!c.feats) c.feats = {};
  if (!Array.isArray(c.seasons)) c.seasons = [];
  return c;
}

/** 记一项生涯荣誉（可重复计数） */
function careerFeat(id, key, n) {
  if (!id || !CARD_BY_ID[id]) return;
  const c = careerOf(id);
  c.feats[key] = (c.feats[key] || 0) + (n == null ? 1 : n);
}

/* =============================================================
   ① 每个赛季结束时，把**我的球队**这一季的数据并进生涯
   -------------------------------------------------------------
   为什么只算"我的球队"：
     AI 球队换人频繁，把 30 队 300 多号人的生涯全累计，
     存档会膨胀、页面也没人看。名人堂讲的是"我带过的球员"。
   ============================================================= */
function hofMergeMySeason() {
  try {
    const L = (typeof seasonState === 'function') ? seasonState() : null;
    if (!L || !L.stats) return 0;
    const season = L.season || 1;
    const year = L.year || SEASON.START_YEAR;
    const prefix = (typeof SEASON !== 'undefined' ? SEASON.MY_KEY : 'mine') + '|';
    let n = 0;
    Object.keys(L.stats).forEach((k) => {
      if (k.indexOf(prefix) !== 0) return;          // 只看我的球队
      const line = L.stats[k];
      if (!line || !line.id || !CARD_BY_ID[line.id]) return;
      if (!line.g) return;
      const c = careerOf(line.id);
      /* ★ 幂等：同一赛季在同一球员身上只并一次。
         否则玩家反复切换页面 / 重复调用会把数据翻倍。 */
      if (c.seasons.indexOf(season) >= 0) return;
      c.seasons.push(season);
      c.g += line.g || 0;
      c.pts += line.pts || 0;
      c.reb += line.reb || 0;
      c.ast += line.ast || 0;
      c.stl += line.stl || 0;
      c.blk += line.blk || 0;
      n++;
    });
    if (n) save();
    return n;
  } catch (e) { return 0; }
}

/* =============================================================
   ② 入堂评选
   -------------------------------------------------------------
   两个条件满足其一：
     · 生涯累计得分 ≥ HOF_POINTS（7000 分）
     · 拿过总冠军或常规赛 MVP
   入选后永久留在名单里，不会因为换队 / 下架卡片而移除。
   ============================================================= */
function hofInduct(year) {
  const C = hofState();
  const out = [];
  Object.keys(C).forEach((id) => {
    if (hofIn(id)) return;
    if (!CARD_BY_ID[id]) return;
    const c = C[id];
    const pts = c.pts || 0;
    const hasHonor = Object.keys(HOF_AUTO_KINDS).some((k) => (c.feats || {})[k] > 0);
    const byPoints = pts >= HOF_POINTS;
    const byHonor = hasHonor && pts >= HOF_POINTS_WITH_HONOR;
    if (!byPoints && !byHonor) return;
    const card = CARD_BY_ID[id];
    hofList().push({
      id, year: year || 0,
      g: c.g || 0, pts: c.pts || 0, reb: c.reb || 0, ast: c.ast || 0,
      stl: c.stl || 0, blk: c.blk || 0,
      seasons: (c.seasons || []).length,
      feats: Object.assign({}, c.feats || {}),
      name: card.name, tier: card.tier, photo: card.photo, team: card.team,
      reason: byPoints ? '生涯 ' + pts + ' 分' : '荣誉入选（' + pts + ' 分 + 冠军/MVP）',
    });
    out.push(card.name);
    try {
      pushNews(`🏛️ ${card.name} 入选名人堂（${byPoints ? '生涯 ' + pts + ' 分' : '荣誉入选'}）`, 'award');
    } catch (e) {}
  });
  if (out.length) save();
  return out;
}

/** 一个赛季结束时统一调用：先并数据，再评选 */
function hofOnSeasonEnd(year) {
  hofMergeMySeason();
  return hofInduct(year);
}

/* =============================================================
   ③ 荣誉名（给简历用）
   ============================================================= */
const HOF_FEAT_CN = {
  champ: '总冠军', mvp: '常规赛 MVP', dpoy: '最佳防守球员',
  sixth: '最佳第六人', mip: '最快进步球员', coy: '最佳教练',
  stat: '数据王', month: '月最佳', week: '周最佳',
  allstar: '全明星', scoring: '得分王', rebound: '篮板王',
  assist: '助攻王', steal: '抢断王', block: '盖帽王',
};

/* =============================================================
   ④ 名人堂页面
   ============================================================= */
let hofEl = null;
function closeHof() {
  if (hofEl) { try { hofEl.remove(); } catch (e) {} hofEl = null; }
}
window.closeHof = closeHof;

function openHof() {
  closeHof();
  const box = document.createElement('div');
  box.className = 'ex-mask hof-mask';       // 复用兑换所的遮罩样式（独立类，不与 .spf-mask 冲突）
  box.innerHTML = hofHTML();
  document.body.appendChild(box);
  hofEl = box;
  box.onclick = (ev) => {
    if (ev.target === box) { closeHof(); return; }
    const act = ev.target.closest && ev.target.closest('[data-hof]');
    if (!act) return;
    if (act.dataset.hof === 'close') { try { Sfx.click(); } catch (e) {} closeHof(); }
  };
  document.addEventListener('keydown', hofEsc);
}
function hofEsc(e) {
  if (e.key === 'Escape') { closeHof(); document.removeEventListener('keydown', hofEsc); }
}

/** 生涯场均（没有场次就返回 0） */
const hofAvg = (v, g) => (g > 0 ? (v / g).toFixed(1) : '0.0');

function hofHTML() {
  const list = hofList().slice().sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const C = hofState();
  /* 候选：还没入堂、但有生涯数据的球员，按得分排 —— 让玩家看到"还差多少" */
  const cands = Object.keys(C)
    .filter((id) => !hofIn(id) && CARD_BY_ID[id] && (C[id].g || 0) > 0)
    .map((id) => ({ id, c: C[id], card: CARD_BY_ID[id] }))
    .sort((a, b) => (b.c.pts || 0) - (a.c.pts || 0))
    .slice(0, 12);

  const featTags = (f) => Object.keys(f || {}).filter((k) => f[k] > 0)
    .map((k) => `<i class="hof-feat">${HOF_FEAT_CN[k] || k}${f[k] > 1 ? ' ×' + f[k] : ''}</i>`)
    .join('');

  return `
  <div class="spf hof-panel">
    <div class="hof-head">
      <div class="hof-title">🏛️ 名 人 堂</div>
      <div class="hof-sub">生涯累计 <b>${HOF_POINTS}</b> 分，或
        <b>${HOF_POINTS_WITH_HONOR}</b> 分 + 总冠军 / 常规赛 MVP，即可入选
        <i>· 已入选 ${list.length} 人</i></div>
      <button class="ex-x" data-hof="close">✕</button>
    </div>
    ${list.length ? `<div class="hof-grid">
      ${list.map((x) => `
        <div class="hof-card">
          <div class="hof-photo"><img src="${x.photo}" alt="" loading="lazy"
            onerror="this.style.display='none'"></div>
          <div class="hof-nm">${x.name}</div>
          <div class="hof-yr">${x.year ? x.year + ' 年入选' : '入选'} · ${x.reason || ''}</div>
          <div class="hof-line">
            <span><b>${x.g || 0}</b>场</span>
            <span><b>${hofAvg(x.pts, x.g)}</b>分</span>
            <span><b>${hofAvg(x.reb, x.g)}</b>板</span>
            <span><b>${hofAvg(x.ast, x.g)}</b>助</span>
          </div>
          <div class="hof-total">生涯 ${x.pts || 0} 分 · ${x.seasons || 0} 个赛季</div>
          ${featTags(x.feats) ? `<div class="hof-feats">${featTags(x.feats)}</div>` : ''}
        </div>`).join('')}
    </div>` : `<div class="hof-empty">
      还没有人入选<br><span>带一名球员打完赛季，生涯累计 ${HOF_POINTS} 分
        （或 ${HOF_POINTS_WITH_HONOR} 分 + 夺冠 / 拿 MVP）就会出现在这里</span>
    </div>`}
    ${cands.length ? `<div class="hof-cand">
      <div class="hof-cand-h">候选（按生涯得分）</div>
      <div class="hof-cand-list">
        ${cands.map((x) => {
          const cpts = x.c.pts || 0;
          const cHonor = Object.keys(HOF_AUTO_KINDS).some((k) => (x.c.feats || {})[k] > 0);
          /* 有冠军/MVP 的候选按放宽后的门槛显示进度，否则他会一直显示"差很多" */
          const bar = cHonor ? HOF_POINTS_WITH_HONOR : HOF_POINTS;
          const pct = Math.min(100, Math.round(100 * cpts / bar));
          return `<div class="hof-cand-row">
            <span class="hof-cand-n">${x.card.name}</span>
            <span class="hof-cand-bar"><i style="width:${pct}%"></i></span>
            <span class="hof-cand-v">${cpts} / ${bar}${cHonor ? ' 🏆' : ''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

/* =============================================================
   ⑤ 荣誉挂钩：所有颁奖都记进生涯简历
   -------------------------------------------------------------
   包一层 giveAward，而不是去改 season.js 的十几处调用点 ——
   这样以后新增奖项也自动被记上，不会再漏。
   ============================================================= */
(function hookAwards() {
  const orig = (typeof giveAward === 'function') ? giveAward : null;
  if (!orig) return;
  /* season.js 先于本文件加载，所以这里能拿到真实的 giveAward。
     用 window 上的同名函数覆盖，调用点无需改动。 */
  const wrapped = function (kind, title, pid, teamKey, note, day) {
    const r = orig(kind, title, pid, teamKey, note, day);
    try { careerFeat(pid, kind, 1); } catch (e) {}
    return r;
  };
  try { window.giveAward = wrapped; } catch (e) {}
  /* 同一作用域内的直接调用（season.js 内部）拿不到 window 上的覆盖，
     所以再把 careerFeat 直接接到奖项生成处 —— 见 season.js 的
     hofNoteAward()，两处都调也不会重复计数（careerFeat 是幂等追加）。 */
})();

/**
 * season.js 内部颁奖时调用（它拿不到被覆盖的 window.giveAward）。
 * 做成独立函数，避免 season.js 依赖 hof.js 的内部结构。
 */
function hofNoteAward(kind, pid) {
  try { careerFeat(pid, kind, 1); } catch (e) {}
}
/** 总冠军：记给冠军球队的每一名球员 */
function hofNoteChamp(teamKey) {
  try {
    if (typeof anyTeamRoster !== 'function') return;
    if (teamKey !== (typeof SEASON !== 'undefined' ? SEASON.MY_KEY : 'mine')) return;
    anyTeamRoster(teamKey).forEach((id) => careerFeat(id, 'champ', 1));
    save();
  } catch (e) {}
}
