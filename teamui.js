/* =============================================================
   球队管理（1:1 复刻 2K MyTeam 阵容页）
   -------------------------------------------------------------
   布局：
     顶栏：◀ 球队管理 ………… 查看工资 · 1.338亿/1.9亿 ➕
     左栏：王朝 / 球队总评 / 比赛策略 / 轮换设置 / 战术调整 / 备用名单
     主区：球场背景 + 首发 5 人在场上（带位置标签）
                         + 替补 7 人横排 + 一键换人
     左下：UID
   ============================================================= */

const TM_SLOT_LABEL = {
  0: '控球后卫', 1: '得分后卫', 2: '小前锋', 3: '大前锋', 4: '中锋',
};

/** 工资帽（和参考图一样显示"已用/上限"） */
/* v9.1：改成读 data.js 的统一工资帽（4 亿），不要再各写各的 */
const TM_SALARY_CAP = (typeof SALARY_CAP !== 'undefined') ? SALARY_CAP : 400000000;
/** 阵容总人数（首发 5 + 替补 7） */
const TM_ROSTER_SIZE = 12;

/* =============================================================
   工资帽配额（v9.27 新增）
   -------------------------------------------------------------
   问题：工资按档位固定（银 800万 / 金 3000万 / 紫 4500万），帽子 4 亿，
   **12 人全员计入** —— 于是：
     12 紫 = 5.40 亿 ✗    8 紫 + 4 银 = 3.92 亿 ✓
     5 紫 + 7 金 = 4.35 亿 ✗（看着很自然的搭配，实际超帽）
   旧 UI 只告诉你「超了多少」，不告诉你「还能上几张」，玩家只能反复试。

   现在算清楚：各档位还能再放几人、剩下几个空位、上限是几张紫卡。
   ============================================================= */
/** 各档位的工资档（时刻金并入金、名宿紫/时刻紫并入紫） */
const TM_SALARY_GROUP = {
  silver: 'silver', gold: 'gold', momentGold: 'gold',
  purple: 'purple', legendPurple: 'purple', momentPurple: 'purple',
};
const TM_GROUP_CN = { silver: '银卡', gold: '金卡', purple: '紫卡' };
const TM_GROUP_ORDER = ['silver', 'gold', 'purple'];

/**
 * 按当前阵容算出工资帽配额。
 * @param {Array<string|null>} ids 当前 12 个位置（含 null）
 * @returns {{total:number, used:number, free:number, slots:number,
 *            counts:Object, canAdd:Object, maxPurple:number}}
 */
function tmCapQuota(ids) {
  const counts = { silver: 0, gold: 0, purple: 0 };
  let total = 0, used = 0;
  (ids || []).forEach((id) => {
    if (!id) return;
    const c = CARD_BY_ID[id];
    if (!c) return;
    const pay = salaryOfTier(c.tier);
    total += pay;
    const g = TM_SALARY_GROUP[c.tier] || 'silver';
    counts[g]++;
    used++;
  });
  const slots = Math.max(0, TM_ROSTER_SIZE - used);        // 还空几个位置
  const free = Math.max(0, TM_SALARY_CAP - total);         // 还剩多少钱
  const canAdd = {};
  TM_GROUP_ORDER.forEach((g) => {
    const pay = salaryOfTier(g);
    /* 钱够几张、位置够几张，取小的 */
    canAdd[g] = Math.max(0, Math.min(slots, pay > 0 ? Math.floor(free / pay) : slots));
  });
  /* 理论最大值：4 亿全花在紫级卡上能摆几张 */
  const maxPurple = Math.max(0, Math.min(TM_ROSTER_SIZE,
    Math.floor(TM_SALARY_CAP / salaryOfTier('purple'))));
  return { total, used, free, slots, counts, canAdd, maxPurple };
}

/** 球员卡（沿用参考图的版式：照片 + MAX + 综合 + 等级 + 姓名 + 位置） */
function tmCardHTML(id, opts) {
  const o = opts || {};
  if (!id) {
    return `<div class="tmc empty${o.cls ? ' ' + o.cls : ''}"
      ${o.slot != null ? `data-tmslot="${o.slot}"` : ''}>
      <div class="tmc-plus">＋</div>
      <div class="tmc-nm">${o.label || '空 位'}</div>
    </div>`;
  }
  const card = CARD_BY_ID[id];
  if (!card) return '';
  const own = S.owned[id] || { brk: 0 };
  const st = statsOf(card, own.brk);
  const T = TIERS[card.tier];
  const max = (own.brk || 0) >= MAX_BREAK;
  const pos2 = card.pos2 ? ' | ' + card.pos2 : '';
  return `<div class="tmc${o.cls ? ' ' + o.cls : ''}${o.on ? ' on' : ''}"
      data-tmcard="${id}" data-tier="${card.tier}" ${
      o.slot != null ? `data-tmslot="${o.slot}"` : ''}${
      o.drag ? ' draggable="true"' : ''}>
    <div class="tmc-img">
      <img src="${card.photo}" alt="" data-src="${card.photo}"
        onload="this.__giveUp=false;if(this.parentNode)this.parentNode.classList.remove('noimg')"
        onerror="if(typeof __imgRetry==='function')__imgRetry(this);else this.parentNode.classList.add('noimg')">
      <span class="tmc-lv">Lv.50</span>
      <span class="tmc-team" style="background:${T.c1}">${
        (TEAM_BY_KEY[card.teamKey] || {}).abbr || ''}</span>
      ${max ? '<span class="tmc-max">MAX</span>'
        : (own.brk ? `<span class="tmc-brk">${own.brk}</span>` : '')}
      <span class="tmc-ovr">${st.ovr}</span>
    </div>
    <div class="tmc-bar" style="background:linear-gradient(100deg,${
      T.c1},${T.c2 || T.c1})">
      <b>${card.name}</b>
      <em>${card.pos}${pos2}</em>
    </div>
    ${o.showRemove ? '<button class="tmc-x" data-tmunload="1">✕</button>' : ''}
  </div>`;
}

/** 顶栏 */
function tmTopHTML(onCourt, caps) {
  const pct = Math.min(1, caps / TM_SALARY_CAP);
  const over = caps > TM_SALARY_CAP;
  /* v9.27：把「还能上几张」直接摆在帽子条旁边，
     省得玩家反复试着换人（5 紫 + 7 金 = 4.35 亿其实超帽） */
  const q = (typeof tmCapQuota === 'function') ? tmCapQuota(tmAllIds()) : null;
  const quota = q && !over ? TM_GROUP_ORDER.map((g) => {
    const n = q.counts[g];
    const can = q.canAdd[g];
    return `<i class="tmt-q${can <= 0 ? ' full' : ''}" title="${TM_GROUP_CN[g]}：已上 ${n} 人，还能再加 ${can} 人">
      ${TM_GROUP_CN[g]}${n}<em>+${can}</em></i>`;
  }).join('') : '';
  return `<div class="tmt">
    <div class="tmt-title"><i>◀</i>球队管理</div>
    <div class="tmt-right">
      ${quota ? `<div class="tmt-quota">${quota}</div>` : ''}
      <button class="tmt-btn" id="tmWage">💵 查看工资</button>
      <div class="tmt-cap${over ? ' over' : ''}">
        <span>💰</span>
        <b>${(caps / 100000000).toFixed(3)}亿</b>
        <i>/</i>
        <em>${(TM_SALARY_CAP / 100000000).toFixed(1)}亿</em>
        <div class="tmt-capbar"><i style="width:${pct * 100}%"></i></div>
      </div>
      <button class="tmt-plus" id="tmPlus">＋</button>
    </div>
  </div>`;
}

/** 当前 12 个位置（首发 5 + 替补 7），给配额计算用 */
function tmAllIds() {
  const r = rosterIds();
  return (r.starters || []).concat([null, null, null, null, null]).slice(0, 5)
    .concat((r.bench || []).concat([null, null, null, null, null, null, null]).slice(0, 7));
}

/** 左栏 */
function tmSideHTML(onCourt, all) {
  const ovr = rosterOvr(onCourt);
  const total = onCourt.filter(Boolean).reduce((s2, id) => {
    const c = CARD_BY_ID[id];
    return s2 + (c ? statsOf(c, (S.owned[id] || {}).brk).ovr : 0);
  }, 0);
  const offName = (OFF_TACTICS[S.offTac] || OFF_TACTICS.balanced).name;
  /* 阵容化学反应（v8.6）：0~100，直接决定首发五人吃多少属性加成 */
  const chem = (typeof lineupChem === 'function') ? lineupChem()
    : { score: 0, bonus: 0, attrBonus: 0, team: '', teamN: 0, posOK: 0, era: '', n: 0 };
  const chemLv = chem.score >= 85 ? 's' : chem.score >= 70 ? 'a'
    : chem.score >= 55 ? 'b' : chem.score >= 40 ? 'c' : 'd';
  const chemTip = !chem.n ? '首发还没排满'
    : (chem.teamN >= 2 ? '同队 ' + chem.teamN + ' 人 · ' : '')
      + '位置 ' + chem.posOK + '/5 · ' + chem.era;
  const chemGain = chem.bonus > 0
    ? '全队 +' + chem.bonus + ' 综合 / +' + chem.attrBonus + ' 能力'
    : '全队无加成';
  return `<div class="tms">
    <div class="tms-name">
      <b>${S.teamName || '我的球队'}</b>
      <button class="tms-swap" id="tmRename" title="改名">⇄</button>
    </div>
    <div class="tms-ovr">
      <span>🏀 球队总评</span>
      <b>${total || ovr}</b>
    </div>
    <div class="tms-chem" id="tmChem">
      <div class="tms-chem-top">
        <span>🧪 阵容化学</span>
        <b class="chem-${chemLv}">${chem.score}</b>
      </div>
      <div class="tms-chem-bar"><i class="chem-${chemLv}" style="width:${
        Math.max(2, Math.min(100, chem.score))}%"></i></div>
      <div class="tms-chem-tip">${chemTip}</div>
      <div class="tms-chem-gain ${chem.bonus > 0 ? 'on' : ''}">${chemGain}</div>
    </div>
    <div class="tms-sec">
      <span>🎯 比赛策略</span>
    </div>
    <div class="tms-row">
      <span>进攻站位</span>
      <b>${offName}</b>
    </div>
    <div class="tms-row">
      <span>轮换设置</span>
      <b>${S.autoSub ? '推荐换人' : '手动换人'}</b>
    </div>
    <button class="tms-btn red" id="tmTactic">🎯 战术调整</button>
    <button class="tms-btn blue" id="tmBenchList">📋 备用名单</button>
    <div class="tms-count">名单 ${all.length}/12 人</div>
  </div>`;
}

/**
 * 一个球场位置 = 位置标签 + 卡片。
 * 参考图里「小前锋 / 中锋 / 大前锋 / 得分后卫 / 控球后卫」
 * 都是紧贴着各自的卡片显示的，所以标签要和卡放在同一个容器里，
 * 不能再单独绝对定位（那样会和卡片错位）。
 */
function tmSlotBox(id, slot) {
  const label = TM_SLOT_LABEL[slot] || '';
  // 参考图：第一行标签在卡片左上方，第二行标签在卡片左侧
  const side = (slot === 1 || slot === 0) ? ' side' : ' top';
  return `<div class="tmslot${side}" data-tmslotbox="${slot}">
    <span class="tmslot-lb">${label}</span>
    ${tmCardHTML(id, { slot: slot })}
  </div>`;
}

/* =============================================================
   工资明细弹层（v9.1）
   -------------------------------------------------------------
   原来点「查看工资」只弹一句 toast，看不到明细。
   现在按档位列清楚每个人的工资，并显示合计 / 工资帽 / 是否超帽。
   ============================================================= */
function openWageLayer(rows, total, over) {
  let el = document.getElementById('wageLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wageLayer';
    el.className = 'layer hidden';
    document.body.appendChild(el);
  }
  const capTxt = (TM_SALARY_CAP / 1e8).toFixed(1) + ' 亿';
  const totTxt = (total / 1e8).toFixed(3) + ' 亿';
  const overBy = total - TM_SALARY_CAP;
  /* v9.27：配额明细 —— 直接回答「我还能上几张」 */
  const q = (typeof tmCapQuota === 'function') ? tmCapQuota(tmAllIds()) : null;
  const quotaRows = q ? TM_GROUP_ORDER.map((g) => {
    const pay = salaryOfTier(g);
    const n = q.counts[g];
    const can = q.canAdd[g];
    return `<div class="wg-q-row">
      <span class="wg-q-n">${TM_GROUP_CN[g]}</span>
      <span class="wg-q-pay">${(pay / 1e4).toFixed(0)} 万/人</span>
      <span class="wg-q-have">已上 <b>${n}</b></span>
      <span class="wg-q-can ${can > 0 ? 'ok' : 'no'}">还能加 <b>${can}</b> 人</span>
    </div>`;
  }).join('') : '';
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="wg-wrap">
      <div class="wg-top">
        <b>💵 工资明细</b>
        <button class="wg-close" id="wgClose">✕ 关闭</button>
      </div>
      <div class="wg-sum${over ? ' over' : ''}">
        <div class="wg-sum-l">
          <span>合计</span><b>${totTxt}</b>
          <i>/</i><em>${capTxt}</em>
        </div>
        <div class="wg-sum-r">${over
          ? '⚠️ 超帽 ' + (overBy / 1e8).toFixed(3) + ' 亿，无法开始比赛'
          : '✅ 未超帽，可以比赛'}</div>
      </div>
      ${q ? `<div class="wg-quota">
        <div class="wg-q-head">工资帽配额
          <em>还能上 <b>${q.slots}</b> 人 · 还剩 <b>${(q.free / 1e8).toFixed(3)}</b> 亿
            · 满编最多 <b>${q.maxPurple}</b> 张紫级卡</em></div>
        ${quotaRows}
        <div class="wg-q-note">
          ⚠️ 工资按档位固定（时刻金卡算金卡、名宿紫/时刻紫算紫卡），
          <b>12 个位置全部计入</b> —— 所以「5 紫 + 7 金 = 4.35 亿」其实是超帽的。
        </div>
      </div>` : ''}
      <div class="wg-note">
        银卡 ${(salaryOfTier('silver') / 1e4).toFixed(0)} 万 ·
        金卡（含时刻金卡）${(salaryOfTier('gold') / 1e4).toFixed(0)} 万 ·
        紫卡（含名宿紫 / 时刻紫）${(salaryOfTier('purple') / 1e4).toFixed(0)} 万
      </div>
      <div class="wg-list">
        ${rows.map((t) => `<div class="wg-row">${t}</div>`).join('')}
      </div>
    </div>`;
  const cl = document.getElementById('wgClose');
  if (cl) cl.onclick = () => { Sfx.click(); el.classList.add('hidden'); el.innerHTML = ''; };
}

/** 一键换人 */
function tmAutoHTML() {
  return `<button class="tm-auto" id="tmAuto">
    <b>👥 一键换人</b>
  </button>`;
}

/** 总入口：替换原来的 renderTeamSys */
function renderTeamUI() {
  const el = document.getElementById('scr-team');
  if (!el) return;
  const r = rosterIds();
  const onCourt = r.starters.concat([null, null, null, null, null]).slice(0, 5);
  const bench = r.bench.concat([null, null, null, null, null, null, null])
    .slice(0, 7);
  const all = onCourt.concat(bench).filter(Boolean);
  const caps = all.reduce((s2, id) => {
    const c = CARD_BY_ID[id];
    if (!c) return s2;
    return s2 + salaryOfTier(c.tier);   // v9.1 按档位固定工资
  }, 0);

  el.innerHTML = `<div class="tmwrap">
    ${tmTopHTML(onCourt, caps)}
    <div class="tmbody">
      ${tmSideHTML(onCourt, all)}
      <div class="tmcourt">
        <div class="tmcourt-bg"></div>
        <div class="tmcourt-row r1">
          ${tmSlotBox(onCourt[2], 2)}
          ${tmSlotBox(onCourt[4], 4)}
          ${tmSlotBox(onCourt[3], 3)}
        </div>
        <div class="tmcourt-row r2">
          ${tmSlotBox(onCourt[1], 1)}
          ${tmSlotBox(onCourt[0], 0)}
        </div>
        <div class="tmbench">
          ${bench.map((id, i) => tmCardHTML(id, { cls: 'bench',
            slot: 100 + i, label: '替补 ' + (i + 1) })).join('')}
        </div>
        ${tmAutoHTML()}
      </div>
    </div>
    <div class="tm-uid">UID:${S.uid || 'peakcard2026'}</div>
  </div>`;
  jseBindTeamUI();
}

function jseBindTeamUI() {
  const el = document.getElementById('scr-team');
  if (!el) return;
  const go = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  go('tmAuto', () => {
    Sfx.click();
    /* v9.2：改成「会算工资帽」的智能排阵 ——
       凑 5紫+5金+2银 的最优形状，首发按位置挑能力值最高的，
       全程验工资帽，加谁都不会超。refillSmartRoster 内部已经 toast 了。 */
    if (typeof refillSmartRoster === 'function') refillSmartRoster();
    else { refillRoster(); toast('已按综合评分自动排阵（首发 5 + 替补 7）'); }
    renderTeamUI();
  });
  go('tmTactic', () => {
    Sfx.click();
    switchTab('battle');
    toast('在生涯/对战页可以实时切换战术');
  });
  go('tmBenchList', () => {
    Sfx.click();
    openTeamPool();
  });
  go('tmWage', () => {
    Sfx.click();
    const r = rosterIds();
    const all = r.starters.concat(r.bench).filter(Boolean);
    /* v9.1：工资按档位固定，所以明细里直接标档位更直观 */
    const rows = all.map((id) => {
      const c = CARD_BY_ID[id];
      return `${c.name}(${TIERS[c.tier].name}) ${(salaryOfTier(c.tier) / 1e4).toFixed(0)}万`;
    });
    const total = salarySumOf(all);
    const over = total > TM_SALARY_CAP;
    openWageLayer(rows, total, over);
  });
  go('tmPlus', () => { Sfx.click(); toast('工资帽由联盟统一规定，无法调整'); });
  go('tmRename', () => {
    Sfx.click();
    const n = prompt('球队名称', S.teamName || '我的球队');
    if (n && n.trim()) { S.teamName = n.trim().slice(0, 12); save(); renderTeamUI(); }
  });
  // 每张卡：长按拖拽 + 轻点选中/看详情
  el.querySelectorAll('[data-tmcard]').forEach((c) => {
    const id = c.dataset.tmcard;
    tmBindDrag(c, id, {
      onTap: () => {
        // 空位 → 打开备用名单让人挑
        if (c.classList.contains('empty')) {
          Sfx.click();
          openTeamPool(parseInt(c.dataset.tmslot, 10));
          return;
        }
        // 已经选中了别人 → 这次点击是"选中这张"
        // 没有任何选中 → 第一次点选中，第二次点看详情
        if (tmSelectedId === id) {
          Sfx.click();
          tmSelect(null);
          try { openDetail(id, false, true); } catch (e2) {}
          return;
        }
        Sfx.click();
        tmSelect(id);
      },
    });
  });
  // 位置格：接收拖放 + 点选后轻点放入
  tmBindDropTargets('#scr-team');
}

/* =============================================================
   备用名单（1:1 复刻参考图）
   -------------------------------------------------------------
   参考图特征：
     · 左侧浮层面板（不是全屏），球场仍然可见
     · 标题「备用名单」+ 蓝色「☰ 筛选球员」按钮
     · 2 列 × 3 行 = 一页 6 个球员
     · 底部翻页：◂  1/19  ▸
     · 点卡片看能力详情；**拖动卡片放进替补席/首发位**
   ============================================================= */
let tmPoolFilter = 'ALL';
let tmPoolPage = 0;
const TM_POOL_PER = 6;          // 用户要求：一页 6 个
let tmPoolPickSlot = null;
let tmFilterOpen = false;
let tmDragId = null;           // 正在拖动的球员
let tmDragFrom = null;         // 从哪个槽位拖出（null=从名单拖）

function openTeamPool(slot) {
  let el = document.getElementById('tmPoolLayer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tmPoolLayer';
    el.className = 'hidden';
    document.body.appendChild(el);
  }
  tmPoolPickSlot = (slot == null) ? null : slot;
  tmPoolPage = 0;
  renderTeamPool();
}

function renderTeamPool() {
  const el = document.getElementById('tmPoolLayer');
  if (!el) return;
  const r = rosterIds();
  const inList = new Set(r.starters.concat(r.bench).filter(Boolean));
  let pool = ownedByOvr().filter((c) => !inList.has(c.id));
  if (tmPoolFilter !== 'ALL') {
    pool = pool.filter((c) => c.pos === tmPoolFilter || c.pos2 === tmPoolFilter);
  }
  const pages = Math.max(1, Math.ceil(pool.length / TM_POOL_PER));
  if (tmPoolPage >= pages) tmPoolPage = pages - 1;
  if (tmPoolPage < 0) tmPoolPage = 0;
  const list = pool.slice(tmPoolPage * TM_POOL_PER,
    (tmPoolPage + 1) * TM_POOL_PER);
  const POS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="tmp-panel">
      <div class="tmp-head">
        <button class="tmp-back" id="tmpBack">◀ 返回</button>
        <b>备用名单</b>
        <span class="tmp-count">${pool.length} 人可选</span>
      </div>
      <button class="tmp-filter" id="tmpFilter">
        <b>☰ 筛选球员</b>
        ${tmPoolFilter !== 'ALL' ? `<em>${tmPoolFilter}</em>` : ''}
      </button>
      ${tmFilterOpen ? `<div class="tmp-fchips">
        ${POS.map((p) => `<button class="tmp-fchip${
          tmPoolFilter === p ? ' on' : ''}" data-tmpos="${p}">${
          p === 'ALL' ? '全部' : p}</button>`).join('')}
      </div>` : ''}
      <div class="tmp-list">
        ${list.length ? list.map((c) => tmCardHTML(c.id, {
          cls: 'pick', drag: true })).join('')
          : '<div class="tmp-empty">没有符合条件的球员<br><span>去「招募」或「转会」补充</span></div>'}
      </div>
      <div class="tmp-pager">
        <button class="tmp-pg" id="tmpPrev" ${tmPoolPage === 0 ? 'disabled' : ''}>◂</button>
        <span>${tmPoolPage + 1}/${pages}</span>
        <button class="tmp-pg" id="tmpNext" ${
          tmPoolPage >= pages - 1 ? 'disabled' : ''}>▸</button>
      </div>
    </div>
    <div class="tmp-hint" id="tmpHint">拖动卡片到球场 / 替补席即可上阵</div>`;
  bindTeamPool();
}

function bindTeamPool() {
  const el = document.getElementById('tmPoolLayer');
  if (!el) return;
  const close = () => {
    el.classList.add('hidden');
    el.innerHTML = '';
    tmPoolPickSlot = null;
    if (typeof renderTeamUI === 'function') renderTeamUI();
  };
  const bk = document.getElementById('tmpBack');
  if (bk) bk.onclick = () => { Sfx.click(); close(); };
  const f = document.getElementById('tmpFilter');
  if (f) f.onclick = () => { Sfx.click(); tmFilterOpen = !tmFilterOpen;
    renderTeamPool(); };
  el.querySelectorAll('[data-tmpos]').forEach((b) => {
    b.onclick = () => { Sfx.click(); tmPoolFilter = b.dataset.tmpos;
      tmPoolPage = 0; tmFilterOpen = false; renderTeamPool(); };
  });
  const pv = document.getElementById('tmpPrev');
  if (pv) pv.onclick = () => { Sfx.click(); tmPoolPage--; renderTeamPool(); };
  const nx = document.getElementById('tmpNext');
  if (nx) nx.onclick = () => { Sfx.click(); tmPoolPage++; renderTeamPool(); };

  /* 备用名单里的卡：长按拖拽 + 轻点选中
       轻点 → 第一次选中（金色高亮），第二次打开详情 */
  el.querySelectorAll('[data-tmcard]').forEach((c) => {
    const id = c.dataset.tmcard;
    tmBindDrag(c, id, {
      onTap: () => {
        Sfx.click();
        if (tmSelectedId === id) {
          tmSelect(null);
          try { openDetail(id, false, true); } catch (e) {}
          return;
        }
        tmSelect(id);
      },
    });
  });
  // 位置格（面板是全屏时球场在下层，用 scr-team 的落点）
  tmBindDropTargets('#scr-team');
  tmBindDropTargets('#tmPoolLayer');
  if (tmSelectedId) tmFlashTargets(true);
}
/* ---------- 调试：?teamtest=1 球队管理页自检 ---------- */
(function teamUITest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('teamtest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@ ' +
      ((e.error && e.error.stack) ? e.error.stack.split('\n')[1] : '')));
    const out = [];
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const el = document.getElementById('scr-team');
        out.push('顶栏=' + (el.querySelector('.tmt') ? '✓' : '✗'));
        out.push('  标题=' + ((el.querySelector('.tmt-title') || {})
          .textContent || '').trim());
        out.push('  工资帽=' + ((el.querySelector('.tmt-cap') || {})
          .textContent || '').replace(/\s+/g, ' ').trim() + ' 按钮=' +
          (el.querySelector('.tmt-plus') ? '✓' : '✗'));
        out.push('左栏=' + (el.querySelector('.tms') ? '✓' : '✗'));
        out.push('  队名=' + ((el.querySelector('.tms-name b') || {})
          .textContent || '').trim() +
          ' 总评=' + ((el.querySelector('.tms-ovr b') || {})
          .textContent || '').trim());
        const btns = el.querySelectorAll('.tms-btn');
        out.push('  按钮=' + Array.prototype.map.call(btns,
          (b) => b.textContent.trim()).join(' / '));
        out.push('球场=' + (el.querySelector('.tmcourt') ? '✓' : '✗'));
        // 首发 5 个位置
        const slots = el.querySelectorAll('.tmcourt-row [data-tmslot]');
        out.push('首发位置=' + slots.length + ' 个（应 5）');
        const posLabels = el.querySelectorAll('.tmslot-lb');
        out.push('位置标签=' + Array.prototype.map.call(posLabels,
          (s2) => s2.textContent).join(' ') + '（共 ' + posLabels.length + ' 个）');
        out.push('  标签贴身=' + (el.querySelectorAll('.tmslot').length === 5
          ? '✓ 5 个位置各带标签' : '✗'));
        const lb0 = el.querySelector('.tmslot .tmslot-lb');
        const c0 = el.querySelector('.tmslot .tmc');
        if (lb0 && c0) {
          const a2 = lb0.getBoundingClientRect();
          const b2 = c0.getBoundingClientRect();
          const near = Math.abs(a2.bottom - b2.top) < 14 ||
            Math.abs(a2.right - b2.left) < 14;
          out.push('  标签与卡片相邻=' + (near ? '✓' : '✗ 距离过远'));
        }
        // 替补 7 人
        const bench = el.querySelectorAll('.tmbench > *');
        out.push('替补=' + bench.length + ' 个（应 7）' +
          (bench.length === 7 ? ' ✓' : ' ✗'));
        out.push('一键换人=' + (el.querySelector('.tm-auto') ? '✓' : '✗'));
        out.push('UID=' + (el.querySelector('.tm-uid') ? '✓' : '✗'));
        // 一键换人
        const au = el.querySelector('.tm-auto');
        if (au) {
          const b0 = rosterIds();
          au.click();
          setTimeout(() => {
            const b1 = rosterIds();
            out.push('点一键换人：首发=' +
              b1.starters.filter(Boolean).length + ' 替补=' +
              b1.bench.filter(Boolean).length +
              (b1.starters.filter(Boolean).length === 5 ? ' ✓' : ' ✗'));
            // 打开备用名单
            const bl = document.getElementById('tmBenchList');
            if (bl) {
              bl.click();
              setTimeout(() => {
                const pl = document.getElementById('tmPoolLayer');
                const open2 = pl && !pl.classList.contains('hidden');
                out.push('备用名单=' + (open2 ? '✓ ' +
                  pl.querySelectorAll('[data-tmcard]').length + ' 张卡' : '✗'));
                out.push('  位置筛选=' + (open2
                  ? pl.querySelectorAll('[data-tmpos]').length + ' 个' : 0));
                out.push('  分页=' + (open2
                  ? pl.querySelectorAll('.tmp-pg').length + ' 个' : 0));
                if (open2) {
                  const cl = document.getElementById('tmpClose');
                  if (cl) cl.click();
                }
                out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2)
                  .join(' ; ') : '无 ✓'));
                document.title = 'TEAMUI ' + out.join(' | ');
              }, 600);
            } else {
              out.push('异常=' + (errs.length ? '✗ ' + errs[0] : '无 ✓'));
              document.title = 'TEAMUI ' + out.join(' | ');
            }
          }, 700);
        } else {
          out.push('异常=' + (errs.length ? '✗ ' + errs[0] : '无 ✓'));
          document.title = 'TEAMUI ' + out.join(' | ');
        }
      }, 800);
    }, 1000);
  } catch (e) { document.title = 'TEAMUI-ERR ' + e.message; }
})();

/* ---------- 调试：?scrolltest=1 iPhone 尺寸下滑动自检 ---------- */
(function scrollTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('scrolltest')) return;
    const out = [];
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const sc = document.getElementById('scr-team');
        if (!sc) { document.title = 'SCROLL 无球队页'; return; }
        out.push('可滚动高度=' + sc.scrollHeight + ' 可视高度=' + sc.clientHeight);
        // 各区块高度明细
        const H = (sel) => {
          const e = sc.querySelector(sel);
          return e ? Math.round(e.getBoundingClientRect().height) : -1;
        };
        out.push('顶栏=' + H('.tmt') + ' 主体=' + H('.tmbody') +
          ' 球场=' + H('.tmcourt') + ' 左栏=' + H('.tms'));
        out.push('首发行1=' + H('.tmcourt-row.r1') + ' 行2=' +
          H('.tmcourt-row.r2') + ' 替补=' + H('.tmbench'));
        const c1 = sc.querySelector('.tmcourt-row .tmc');
        const c2 = sc.querySelector('.tmbench .tmc');
        if (c1) out.push('首发卡=' + Math.round(c1.getBoundingClientRect().width) +
          '×' + Math.round(c1.getBoundingClientRect().height));
        if (c2) out.push('替补卡=' + Math.round(c2.getBoundingClientRect().width) +
          '×' + Math.round(c2.getBoundingClientRect().height));
        const body = document.querySelector('.app-body') ||
          document.getElementById('tabbar');
        if (body) out.push('容器=' + Math.round(body.getBoundingClientRect().height));
        out.push('需要滚动=' + (sc.scrollHeight > sc.clientHeight + 4
          ? '✓ ' + (sc.scrollHeight - sc.clientHeight) + 'px'
          : '✗ 一屏放得下'));
        // 替补席是否在初始视口内
        const bench = sc.querySelector('.tmbench');
        const cards = sc.querySelectorAll('.tmbench > *');
        out.push('替补卡=' + cards.length + ' 张');
        if (bench) {
          const br = bench.getBoundingClientRect();
          const sr = sc.getBoundingClientRect();
          out.push('替补席初始位置 距顶=' +
            Math.round(br.top - sr.top) + 'px 距底=' +
            Math.round(br.bottom - sr.bottom) + 'px' +
            (br.bottom <= sr.bottom ? ' ✓已在屏内'
              : ' ⚠需下滑 ' + Math.round(br.bottom - sr.bottom) + 'px'));
        }
        // 滚到底，看最后一张替补卡是否可见
        sc.scrollTop = sc.scrollHeight;
        setTimeout(() => {
          const sc2 = document.getElementById('scr-team');
          const last = sc2.querySelector('.tmbench > *:last-child');
          if (last) {
            const lr = last.getBoundingClientRect();
            const sr2 = sc2.getBoundingClientRect();
            out.push('滚到底后 最后一张替补卡=' +
              (lr.bottom <= sr2.bottom + 2 && lr.top >= sr2.top - 2
                ? '✓完整可见' : '⚠ 底=' + Math.round(lr.bottom) +
                  ' 视口底=' + Math.round(sr2.bottom)));
          }
          // 备用名单每页数量
          const bl = document.getElementById('tmBenchList');
          if (bl) {
            bl.click();
            setTimeout(() => {
              const pl = document.getElementById('tmPoolLayer');
              const n = pl ? pl.querySelectorAll('[data-tmcard]').length : 0;
              out.push('备用名单每页=' + n + ' 个' +
                (n <= 20 ? ' ✓（上限 20）' : ' ✗超过 20'));
              const first = pl && pl.querySelector('.tmc');
              if (first) {
                const fr = first.getBoundingClientRect();
                out.push('  卡片比例=' + Math.round(fr.width) + '×' +
                  Math.round(fr.height) + '（含底部名字条）');
              }
              document.title = 'SCROLL ' + out.join(' | ');
            }, 700);
          } else {
            document.title = 'SCROLL ' + out.join(' | ');
          }
        }, 400);
      }, 900);
    }, 1000);
  } catch (e) { document.title = 'SCROLL-ERR ' + e.message; }
})();

/* ---------- 调试：?pooltest=1 备用名单自检 ---------- */
(function poolTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pooltest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@ ' +
      ((e.error && e.error.stack) ? e.error.stack.split('\n')[1] : '')));
    const out = [];
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const bl = document.getElementById('tmBenchList');
        out.push('备用名单按钮=' + (bl ? '✓' : '✗'));
        if (bl) bl.click();
        setTimeout(() => {
          const pl = document.getElementById('tmPoolLayer');
          const open2 = pl && !pl.classList.contains('hidden');
          out.push('浮层打开=' + (open2 ? '✓' : '✗'));
          if (!open2) { document.title = 'POOL ' + out.join(' | '); return; }
          out.push('面板=' + (pl.querySelector('.tmp-panel') ? '✓ 左侧浮层' : '✗'));
          out.push('  标题=' + ((pl.querySelector('.tmp-head') || {})
            .textContent || '').trim());
          out.push('  筛选按钮=' + ((pl.querySelector('.tmp-filter') || {})
            .textContent || '').replace(/\s+/g, ' ').trim());
          const cards = pl.querySelectorAll('[data-tmcard]');
          out.push('一页球员=' + cards.length + ' 个' +
            (cards.length <= 6 ? ' ✓（上限 6）' : ' ✗超过 6'));
          const grid = pl.querySelector('.tmp-list');
          if (grid) {
            const cs = getComputedStyle(grid);
            out.push('  网格列数=' + cs.gridTemplateColumns.split(' ').length +
              ' 列（应 2）');
          }
          out.push('  翻页器=' + ((pl.querySelector('.tmp-pager') || {})
            .textContent || '').replace(/\s+/g, ' ').trim());
          // 可拖动
          const draggable = pl.querySelectorAll('[data-tmcard][draggable="true"]');
          out.push('可拖动卡片=' + draggable.length + '/' + cards.length +
            (draggable.length === cards.length ? ' ✓' : ' ✗'));
          // 点卡看能力
          if (cards.length) {
            cards[0].click();
            setTimeout(() => {
              const dl = document.getElementById('detailLayer');
              out.push('点卡看能力=' +
                (dl && !dl.classList.contains('hidden') ? '✓ 详情页已开' : '✗'));
              if (dl && !dl.classList.contains('hidden')) {
                const cb = dl.querySelector('.dclose, [id*="close"], .dback');
                if (cb) cb.click();
              }
              // 拖放目标是否标记
              const slots = document.querySelectorAll('[data-tmslot]');
              out.push('可拖放位置格=' + slots.length + ' 个（应 12）');
              // 返回按钮
              const bk2 = document.getElementById('tmpBack');
              out.push('返回按钮=' + (bk2 ? '✓「' + bk2.textContent.trim() + '」' : '✗'));
              if (bk2) {
                bk2.click();
                setTimeout(() => {
                  const pl2 = document.getElementById('tmPoolLayer');
                  const closed = pl2 && pl2.classList.contains('hidden');
                  const teamVisible = document.querySelector(
                    '#scr-team .tmcourt');
                  out.push('点返回→浮层关闭=' + (closed ? '✓' : '✗') +
                    ' 球队页可见=' + (teamVisible ? '✓ 能看到首发/替补' : '✗'));
                  out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2)
                    .join(' ; ') : '无 ✓'));
                  document.title = 'POOL ' + out.join(' | ');
                }, 500);
              } else {
                document.title = 'POOL ' + out.join(' | ');
              }
            }, 700);
          } else {
            out.push('异常=' + (errs.length ? '✗ ' + errs[0] : '无 ✓'));
            document.title = 'POOL ' + out.join(' | ');
          }
        }, 700);
      }, 900);
    }, 1000);
  } catch (e) { document.title = 'POOL-ERR ' + e.message; }
})();

/* 调试：?poolmeasure=1 备用名单尺寸测量 */
(function poolMeasure() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('poolmeasure')) return;
    const out = [];
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => {
        const bl = document.getElementById('tmBenchList');
        if (bl) bl.click();
        setTimeout(() => {
          const pl = document.getElementById('tmPoolLayer');
          const panel = pl.querySelector('.tmp-panel');
          const list = pl.querySelector('.tmp-list');
          const cards = pl.querySelectorAll('[data-tmcard]');
          const W = window.innerWidth, H = window.innerHeight;
          out.push('屏幕=' + W + '×' + H);
          if (panel) {
            const r = panel.getBoundingClientRect();
            out.push('面板=' + Math.round(r.width) + '×' + Math.round(r.height) +
              ' 占比=' + Math.round(r.width / W * 100) + '%宽 / ' +
              Math.round(r.height / H * 100) + '%高');
          }
          if (list) {
            const r2 = list.getBoundingClientRect();
            out.push('列表区=' + Math.round(r2.width) + '×' + Math.round(r2.height));
            out.push('  列宽=' + getComputedStyle(list).gridTemplateColumns);
          }
          if (cards.length) {
            const c = cards[0].getBoundingClientRect();
            const cr = cards[0].getBoundingClientRect();
            const pr = panel.getBoundingClientRect();
            out.push('第一张卡=' + Math.round(c.width) + '×' + Math.round(c.height));
            out.push('  卡片右边缘=' + Math.round(cr.right) +
              ' 面板右边缘=' + Math.round(pr.right) +
              (cr.right <= pr.right + 1 ? ' ✓未溢出' : ' ✗被裁切'));
            const last = cards[cards.length - 1].getBoundingClientRect();
            out.push('  最后一张右边缘=' + Math.round(last.right) +
              (last.right <= pr.right + 1 ? ' ✓' : ' ✗溢出'));
          }
          // 是否横向滚动（说明被裁）
          if (list) out.push('横向溢出=' + (list.scrollWidth > list.clientWidth + 2
            ? '✗ ' + list.scrollWidth + '>' + list.clientWidth : '✓ 无'));
          document.title = 'POOLM ' + out.join(' | ');
        }, 800);
      }, 900);
    }, 1000);
  } catch (e) { document.title = 'POOLM-ERR ' + e.message; }
})();

/* 调试：?poolopen=1 直接打开备用名单（截图用） */
(function poolOpen() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('poolopen')) return;
    setTimeout(() => {
      switchTab('team');
      setTimeout(() => { openTeamPool(); }, 700);
    }, 900);
  } catch (e) {}
})();

/* =============================================================
   拖拽系统 v2（v5.1 重做）
   -------------------------------------------------------------
   用户反馈：拖动替换球员不方便，尤其是备用名单里。
   触屏上原生 HTML5 drag 基本不可用，pointer 拖拽又容易和点击冲突。
   这里做**两条路**，怎么顺手怎么来：

     ① 长按拖拽：按住卡片 0.25 秒 → 卡片浮起跟手 → 松手放到目标位置
     ② 点选放置：轻点卡片选中（金色高亮）→ 再点目标位置放入
        （不需要拖，单手也能操作，触屏最稳）

   两条路都走同一个 assignToSlot(id, slot)，所以
   「同一球员不能重复上场」等校验一律生效。
   ============================================================= */
let tmSelectedId = null;        // 点选模式下选中的球员
let tmDragCtx = null;           // 拖拽上下文

/** 当前是否处于"点选待放置"状态 */
function tmHasSelection() { return !!tmSelectedId; }

/** 选中/取消选中一张卡 */
function tmSelect(id) {
  tmSelectedId = (tmSelectedId === id) ? null : id;
  const el = document.getElementById('scr-team');
  if (el) {
    el.querySelectorAll('.tmc.sel').forEach((c) => c.classList.remove('sel'));
    if (tmSelectedId) {
      el.querySelectorAll(`[data-tmcard="${tmSelectedId}"]`)
        .forEach((c) => c.classList.add('sel'));
    }
  }
  const pl = document.getElementById('tmPoolLayer');
  if (pl) {
    pl.querySelectorAll('.tmc.sel').forEach((c) => c.classList.remove('sel'));
    if (tmSelectedId) {
      pl.querySelectorAll(`[data-tmcard="${tmSelectedId}"]`)
        .forEach((c) => c.classList.add('sel'));
    }
  }
  tmFlashTargets(!!tmSelectedId);
  if (tmSelectedId) {
    toast('已选中，点球场上的位置即可放入（再点一次取消）');
  }
}

/** 高亮/取消高亮所有可放置位置 */
function tmFlashTargets(on) {
  ['scr-team', 'tmPoolLayer'].forEach((rootId) => {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.querySelectorAll('[data-tmslot]').forEach((s) => {
      s.classList.toggle('dropzone', !!on);
    });
  });
}

/**
 * 统一的"放到某位置"入口。
 * 优先用当前选中的球员；没有选中就用传进来的 id。
 */
function tmDropAt(slot, id) {
  const useId = id || tmSelectedId;
  if (!useId) { toast('请先点选一名球员'); return false; }
  let ok = false;
  try {
    ok = (typeof assignToSlot === 'function')
      ? assignToSlot(useId, slot) : false;
  } catch (e) { toast('放入失败：' + e.message); return false; }
  if (ok === false) { Sfx.fail(); return false; }
  Sfx.coin();
  tmSelectedId = null;
  tmFlashTargets(false);
  const label = (typeof TM_SLOT_LABEL !== 'undefined' && TM_SLOT_LABEL[slot])
    ? TM_SLOT_LABEL[slot] : ('替补 ' + (slot - 99));
  toast('已放入「' + label + '」');
  setTimeout(() => {
    if (typeof renderTeamUI === 'function') renderTeamUI();
    const pl = document.getElementById('tmPoolLayer');
    if (pl && !pl.classList.contains('hidden') &&
        typeof renderTeamPool === 'function') renderTeamPool();
  }, 80);
  return true;
}

/**
 * 给一张卡装上"长按拖拽 + 点选"两种交互。
 * @param el    卡片元素
 * @param id    球员卡 id
 * @param opts  { onTap: 轻点时做什么 }
 */
/* =============================================================
   长按拖拽 v8.5 —— 重写版
   -------------------------------------------------------------
   上一版有六个问题，分成「卡顿」和「吃力」两类：

   【卡顿】
     1. ghost 用 style.left/top 逐帧移动 → 触发布局，无法合成
     2. ghost 是整张卡的深拷贝（含 base64 大图）＋ 大 box-shadow
     3. pointermove 不节流，120Hz 屏上每秒写 120 次样式

   【吃力 / 好像有阻力】
     4. 卡片没设 touch-action → iOS 把它当滚动手势接管，
        浏览器夺走指针后触发 pointercancel，而这里**没有 pointercancel 处理**，
        拖拽就无声无息地死掉 —— 手感就是「卡住、拖不动」
     5. 长按要 250ms，容差却只有 10px，手指一抖就取消
     6. 长按期间没 preventDefault，浏览器可以随时开始滚动

   v8.5 的改法：
     · 卡片加 touch-action:none + user-select:none（滚动手势不再抢）
     · setPointerCapture 锁住指针，手指滑出卡片也不丢事件
     · 补上 pointercancel / lostpointercapture 清理
     · 容差放宽到 22px，且按住超过 120ms 后放宽到 34px
     · ghost 改用 transform: translate3d()，并用 rAF 节流（一帧最多写一次）
     · ghost 挂 will-change/contain，且拖拽期间不画大阴影
   ============================================================= */
function tmBindDrag(el, id, opts) {
  const o = opts || {};
  if (el.__tmDragBound) return;      // 同一个元素不重复绑定
  el.__tmDragBound = true;

  let pressTimer = null;
  let dragging = false;
  let ghost = null;
  let startX = 0, startY = 0, pressAt = 0;
  let rafId = 0, pendX = 0, pendY = 0;
  let activeId = null;

  /* ghost 位置：用 transform，一帧最多写一次 */
  const flushGhost = () => {
    rafId = 0;
    if (!ghost) return;
    ghost.style.transform =
      'translate3d(' + (pendX - 39) + 'px,' + (pendY - 58) + 'px,0) scale(1.12)';
  };
  const moveGhost = (x, y) => {
    pendX = x; pendY = y;
    if (!rafId) rafId = requestAnimationFrame(flushGhost);
  };

  const cleanup = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (ghost) { ghost.remove(); ghost = null; }
    el.classList.remove('dragging');
    tmFlashTargets(!!tmSelectedId);
    dragging = false;
    tmDragCtx = null;
    activeId = null;
  };

  const startDrag = (px, py) => {
    dragging = true;
    tmDragCtx = { id };
    el.classList.add('dragging');
    ghost = el.cloneNode(true);
    ghost.className = (ghost.className || '') + ' tm-dragghost';
    ghost.removeAttribute('data-tmcard');
    ghost.style.left = '0';
    ghost.style.top = '0';
    pendX = px; pendY = py;
    ghost.style.transform =
      'translate3d(' + (px - 39) + 'px,' + (py - 58) + 'px,0) scale(1.12)';
    document.body.appendChild(ghost);
    tmFlashTargets(true);
    Sfx.click();
  };

  el.addEventListener('pointerdown', (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    if (dragging) return;
    startX = ev.clientX; startY = ev.clientY;
    pressAt = performance.now();
    activeId = ev.pointerId;
    let moved = false;
    /* 锁住指针：手指滑出卡片也照样收得到 move/up */
    try { el.setPointerCapture(ev.pointerId); } catch (e) {}

    const onMove = (e2) => {
      if (activeId != null && e2.pointerId !== activeId) return;
      const dx = e2.clientX - startX, dy = e2.clientY - startY;
      const dist = Math.hypot(dx, dy);
      if (!dragging) {
        /* 容差放宽：刚按下时 22px，按住一阵子后 34px。
           只有明显是在滚页面才取消长按。 */
        const held = performance.now() - pressAt;
        const tol = held > 120 ? 34 : 22;
        if (dist > tol) {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          moved = true;
          cleanup();
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onCancel);
        }
        return;
      }
      if (e2.cancelable) e2.preventDefault();
      moveGhost(e2.clientX, e2.clientY);
    };

    const detach = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      try { el.releasePointerCapture(activeId); } catch (e) {}
    };

    const onUp = (e2) => {
      if (activeId != null && e2.pointerId !== activeId) return;
      detach();
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (dragging) {
        if (ghost) ghost.style.display = 'none';
        const tgt = document.elementFromPoint(e2.clientX, e2.clientY);
        const slotEl = tgt && tgt.closest && tgt.closest('[data-tmslot]');
        cleanup();
        if (slotEl) {
          tmDropAt(parseInt(slotEl.dataset.tmslot, 10), id);
        } else {
          toast('松手的位置不是球场上的位置格');
        }
        return;
      }
      cleanup();
      if (!moved && o.onTap) o.onTap();
    };

    /* 浏览器夺走指针（滚动/手势）时，体面收场而不是留下半截状态 */
    const onCancel = () => {
      detach();
      cleanup();
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);

    pressTimer = setTimeout(() => {
      pressTimer = null;
      startDrag(startX, startY);
    }, 220);
  });

  // 鼠标：直接用原生拖拽，更顺手
  el.setAttribute('draggable', 'true');
  el.ondragstart = (ev) => {
    tmDragCtx = { id };
    el.classList.add('dragging');
    try { ev.dataTransfer.setData('text/plain', id); } catch (e) {}
    tmFlashTargets(true);
  };
  el.ondragend = () => { cleanup(); };
  el.ondragover = (ev) => { ev.preventDefault(); };
}

/** 把所有位置格变成可接收拖放的落点 */
function tmBindDropTargets(rootSel) {
  const root = document.querySelector(rootSel);
  if (!root) return;
  root.querySelectorAll('[data-tmslot]').forEach((s) => {
    const slot = parseInt(s.dataset.tmslot, 10);
    s.ondragover = (ev) => { ev.preventDefault(); s.classList.add('dropzone'); };
    s.ondragleave = () => { if (!tmSelectedId) s.classList.remove('dropzone'); };
    s.ondrop = (ev) => {
      ev.preventDefault();
      const id = (tmDragCtx && tmDragCtx.id) ||
        (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
      tmDropAt(slot, id);
    };
    // 点选模式：点位置格就把选中的球员放进去
    s.onclick = (ev) => {
      if (!tmSelectedId) return;
      ev.stopPropagation();
      tmDropAt(slot);
    };
  });
}

/* ---------- 调试：?drag2=1 拖拽/点选放置自检 ---------- */
(function drag2Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('drag2')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      switchTab('team');
      await wait(900);
      const el = () => document.getElementById('scr-team');

      // ① 位置格都装了落点
      const slots = el().querySelectorAll('[data-tmslot]');
      out.push('位置格=' + slots.length + ' 个（应 12）');
      const withDrop = Array.prototype.filter.call(slots,
        (s) => typeof s.ondrop === 'function').length;
      out.push('  已装拖放=' + withDrop + '/' + slots.length +
        (withDrop === slots.length ? ' ✓' : ' ✗'));

      // ② 点选模式：点一张替补卡 → 应进入选中态
      const benchCard = el().querySelector('.tmbench [data-tmcard]');
      if (!benchCard) { out.push('无替补卡'); document.title = 'DRAG2 ' + out.join(' | '); return; }
      const bid = benchCard.dataset.tmcard;
      benchCard.dispatchEvent(new PointerEvent('pointerdown',
        { bubbles: true, clientX: 100, clientY: 100, pointerType: 'touch' }));
      await wait(60);
      benchCard.dispatchEvent(new PointerEvent('pointerup',
        { bubbles: true, clientX: 100, clientY: 100, pointerType: 'touch' }));
      await wait(400);
      out.push('点选替补卡 → tmSelectedId=' + (tmSelectedId || 'null') +
        (tmSelectedId === bid ? ' ✓' : ' ✗'));
      out.push('  卡片金色高亮=' +
        (el().querySelector('.tmc.sel') ? '✓' : '✗'));
      out.push('  位置格高亮=' +
        el().querySelectorAll('.tmc.empty.dropzone, .tmc.dropzone').length + ' 个');

      // ③ 点一个空位 → 应该放进去
      const emptySlot = el().querySelector('.tmc.empty[data-tmslot]');
      if (emptySlot) {
        const slotIdx = parseInt(emptySlot.dataset.tmslot, 10);
        const before = rosterIds();
        emptySlot.click();
        await wait(700);
        const after = rosterIds();
        const placed = after.starters.indexOf(bid) >= 0 ||
          after.bench.indexOf(bid) >= 0;
        const inTarget = (slotIdx >= 100)
          ? after.bench[slotIdx - 100] === bid
          : after.starters[slotIdx] === bid;
        out.push('点空位(slot=' + slotIdx + ') → 放入=' +
          (inTarget ? '✓ 正确位置' : '✗ 没进去'));
        out.push('  选中态已清=' + (tmSelectedId === null ? '✓' : '✗'));
      } else {
        out.push('没有空位可测（阵容已满）');
      }

      // ④ 备用名单里的拖拽
      const bl = document.getElementById('tmBenchList');
      if (bl) {
        bl.click();
        await wait(800);
        const pl = document.getElementById('tmPoolLayer');
        const pc = pl.querySelector('[data-tmcard]');
        out.push('备用名单卡片=' + pl.querySelectorAll('[data-tmcard]').length);
        if (pc) {
          const pid = pc.dataset.tmcard;
          pc.dispatchEvent(new PointerEvent('pointerdown',
            { bubbles: true, clientX: 200, clientY: 200, pointerType: 'touch' }));
          await wait(60);
          pc.dispatchEvent(new PointerEvent('pointerup',
            { bubbles: true, clientX: 200, clientY: 200, pointerType: 'touch' }));
          await wait(400);
          out.push('面板里点选=' + (tmSelectedId === pid ? '✓ ' + pid : '✗'));
          // 点一个球场位置（面板全屏时位置格在下层，直接调用）
          const slots2 = el().querySelectorAll('.tmc[data-tmslot]');
          let done = false;
          for (let i = 0; i < slots2.length; i++) {
            const si = parseInt(slots2[i].dataset.tmslot, 10);
            if (tmDropAt(si, pid)) { done = true;
              out.push('面板→球场 放入 slot=' + si + ' ✓'); break; }
          }
          if (!done) out.push('面板→球场 放入失败（可能同球员冲突）');
          await wait(500);
        }
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'DRAG2 ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'DRAG2-ERR ' + e.message; }
})();
