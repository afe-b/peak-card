/* =============================================================
   生涯模式（v2.0）
   -------------------------------------------------------------
   把原来的「对战」和「赛程」合并成一个生涯模式页面，
   版式参考 NBA 2K 的 MyCareer 日程界面：
     · 顶部：生涯标题 / 我的战绩 / 分区排名 / 赛季切换
     · 左侧：月历 —— 每格是一天的比赛，显示对手、主客、胜负
     · 右侧：比赛日对手面板 —— 球队 + 总评 + 排名 + 首发阵容 + 挑战
     · 季后赛：对阵图；总决赛：单独高亮
   ============================================================= */

/* ---------- 赛季月份划分 ----------
   85 轮对应 85 天，按 30 天一个月切成 3 个月 + 季后赛。
   和 2K 一样，"月度"是有意义的单位（月度奖励、月最佳）。 */
/* 每一轮之间隔 2.6 天 —— 和 NBA 一样"打一场歇一两天"，
   85 轮 ≈ 221 天 ≈ 7 个半月（十月开打，次年六月总决赛）。
   这样一个月大约 11~12 场，和 2K 月历的疏密一致。 */
const DAYS_PER_ROUND = 2.6;
const CAREER_MONTHS = [
  { key: 'oct', name: '十月',   en: 'October',   idx: 0 },
  { key: 'nov', name: '十一月', en: 'November',  idx: 1 },
  { key: 'dec', name: '十二月', en: 'December',  idx: 2 },
  { key: 'jan', name: '一月',   en: 'January',   idx: 3 },
  { key: 'feb', name: '二月',   en: 'February',  idx: 4 },
  { key: 'mar', name: '三月',   en: 'March',     idx: 5 },
  { key: 'apr', name: '四月',   en: 'April',     idx: 6 },
  { key: 'may', name: '五月',   en: 'May',       idx: 7 },
];
/** 第 r 轮落在第几天 */
function roundToDay(r) { return Math.round((r - 1) * DAYS_PER_ROUND) + 1; }
/** 某个月显示的日期区间（每月 30 天） */
function monthRange(mi) { return { from: mi * 30 + 1, to: mi * 30 + 30 }; }
/** 第 r 轮属于第几个月 */
/** 队名去掉城市前缀，只留队名（和参考图一样显示"奇才/开拓者/猛龙"） */
function shortTeamName(full) {
  if (!full) return '';
  /* 参考图里显示的是"奇才/开拓者/猛龙"这种队名（去掉城市）。
     城市名长短不一，逐个匹配容易漏（比如"俄克拉荷马城雷霆"），
     这里直接查表，最稳。 */
  const MAP = {
    '亚特兰大老鹰': '老鹰', '波士顿凯尔特人': '凯尔特人', '布鲁克林篮网': '篮网',
    '夏洛特黄蜂': '黄蜂', '芝加哥公牛': '公牛', '克利夫兰骑士': '骑士',
    '达拉斯独行侠': '独行侠', '丹佛掘金': '掘金', '底特律活塞': '活塞',
    '金州勇士': '勇士', '休斯顿火箭': '火箭', '印第安纳步行者': '步行者',
    '洛杉矶快船': '快船', '洛杉矶湖人': '湖人', '孟菲斯灰熊': '灰熊',
    '迈阿密热火': '热火', '密尔沃基雄鹿': '雄鹿', '明尼苏达森林狼': '森林狼',
    '新奥尔良鹈鹕': '鹈鹕', '纽约尼克斯': '尼克斯', '俄克拉荷马城雷霆': '雷霆',
    '俄克拉荷马雷霆': '雷霆', '奥兰多魔术': '魔术', '费城76人': '76人',
    '菲尼克斯太阳': '太阳', '波特兰开拓者': '开拓者', '萨克拉门托国王': '国王',
    '圣安东尼奥马刺': '马刺', '多伦多猛龙': '猛龙', '犹他爵士': '爵士',
    '华盛顿奇才': '奇才',
  };
  if (MAP[full]) return MAP[full];
  // 兜底：去掉开头 2~5 个字的城市名
  const m = full.match(/^(.{2,5}?)([\u4e00-\u9fa5]{2,4})$/);
  return m ? m[2] : full;
}
function monthOfRound(r) {
  const d = roundToDay(r);
  const mi = Math.floor((d - 1) / 30);
  return Math.max(0, Math.min(CAREER_MONTHS.length - 1, mi));
}
/** 我当前该打第几轮 */
function careerRound() {
  if (typeof nextUnplayedRound === 'function') {
    const r = nextUnplayedRound();
    if (r) return r;
  }
  const L = (typeof seasonState === 'function') ? seasonState() : {};
  return L.round || 1;
}

/* ---------- 球队徽标（没有图片，用配色 + 缩写做） ---------- */
function teamCrest(key, size) {
  const t = (typeof TEAM_BY_KEY !== 'undefined') && TEAM_BY_KEY[key];
  if (!t || key === SEASON.MY_KEY) {
    return `<div class="cr-crest mine" style="--s:${size || 44}px">
      <b>我</b></div>`;
  }
  return `<div class="cr-crest" style="--s:${size || 44}px;
      background:linear-gradient(150deg,${t.c1},${t.c2 || t.c1})">
    <b>${t.abbr}</b></div>`;
}

/* =============================================================
   突破徽章（球员名左边那个小方块）
   -------------------------------------------------------------
   用户要求：
     · 满突破（8 阶）才显示 MAX
     · 没满突破就显示实际阶数：1 阶显示 1，2 阶显示 2 …
     · 完全没突破（0 阶）什么都不显示
   ============================================================= */
function brkBadge(brk) {
  const n = brk || 0;
  if (n <= 0) return '';                       // 没突破 → 不显示
  const max = (typeof MAX_BREAK !== 'undefined') ? MAX_BREAK : 8;
  if (n >= max) return '<span class="cr-max">MAX</span>';
  return `<span class="cr-brk" title="${n} 阶突破">${n}</span>`;
}

/* ---------- 顶部条 ---------- */
function careerTopHTML() {
  const L = seasonState();
  const rec = myRecord();
  const rank = myConfRank();
  const conf = myConf();
  return `
    <div class="cr-head">
      <div class="cr-title"><i>◀</i>生涯模式
        <button class="cr-help" id="crHelp">?</button></div>
      <div class="cr-acts">
        <button class="cr-switch ghost2" id="crReset">🔄 当季重置</button>
      <button class="cr-switch" id="crAdv">赛季切换 ⇄</button>
      </div>
    </div>
    <div class="cr-bar">
      <div class="cr-ava">${teamCrest(SEASON.MY_KEY, 38)}</div>
      <div class="cr-me">
        <b>${S.teamName || '我的球队'}</b>
      </div>
      <div class="cr-rank">排行: <b>${rank || '—'}</b>
        <em>[${conf}部]</em></div>
      <div class="cr-sep"></div>
      <div class="cr-wl">胜场: <b class="w">${rec.w}</b>
        <i>|</i> 负场: <b class="l">${rec.l}</b></div>
      <button class="cr-chart" id="crChart" title="赛季数据">📊</button>
    </div>`;
}
function crAdvLabel(L) {
  if (L.phase === 'regular') {
    const r = careerRound();
    return r > SEASON.ROUNDS ? '进入季后赛 ▸' : '推进到第 ' + r + ' 轮 ▸';
  }
  if (L.phase === 'playoff') return '打下一轮系列赛 ▸';
  /* 打到 2056 并拿下总冠军之后 —— 可以回到 2026 开新一轮（不是回档，
     收藏/金币/荣誉全部保留）。 */
  if (typeof canStartNewCycle === 'function' && canStartNewCycle()) {
    return '🔄 回到 ' + SEASON.START_YEAR + ' 开新一轮 ▸';
  }
  if (typeof isLastSeason === 'function' && isLastSeason()) return '赛季结束 🏁';
  return `开启 ${seasonName(L.year + 1)} 赛季 ▸`;
}
/** 我在本分区的排名 */
function myConf() {
  /* 只认 S.myConf 这一个来源，和季后赛种子计算保持一致，
     避免"显示西部第 3、季后赛按东部排"这种不一致。 */
  return (typeof S !== 'undefined' && S.myConf) ? S.myConf : '西';
}
function myConfRank() {
  const conf = myConf();
  const L = seasonState();
  const rec = myRecord();
  const list = [];
  NBA_TEAMS.filter((t) => t.conf === conf).forEach((t) => {
    const st = L.teams[t.key] || { wins: 0, loses: 0 };
    list.push({ key: t.key, w: st.wins || 0, l: st.loses || 0 });
  });
  list.push({ key: SEASON.MY_KEY, w: rec.w, l: rec.l });
  list.sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.w - a.w);
  const i = list.findIndex((x) => x.key === SEASON.MY_KEY);
  return i < 0 ? 0 : i + 1;
}

/* ---------- 月历 ---------- */
let crMonth = null;        // 当前显示第几个月
let crSelRound = null;     // 选中哪一天

function careerCalendarHTML() {
  const L = seasonState();
  const cur = careerRound();
  if (crMonth == null) crMonth = monthOfRound(Math.min(cur, 85));
  const m = CAREER_MONTHS[crMonth];
  const rg = monthRange(crMonth);
  const full = myFullSchedule();
  // 天 → 该天的比赛
  const byDay = {};
  full.forEach((g) => { byDay[roundToDay(g.round)] = g; });
  const todayDay = roundToDay(cur);

  /* 7 列 × 5 行 = 35 天 —— 和参考图一致的七列日历 */
  const cells = [];
  for (let d = rg.from; d <= rg.to; d++) {
    const g = byDay[d];
    const rec = g && (L.mySched || []).filter((x) => x.round === g.round)[0];
    const isToday = d === todayDay;
    const sel = d === crSelRound;
    const o = g ? oppBrief(g.opp) : null;
    const stars = o ? (o.ovr >= 112 ? 3 : o.ovr >= 105 ? 2 : 1) : 0;
    let cls = 'cr-cell';
    if (!g) cls += ' off';
    if (rec) cls += rec.win ? ' win' : ' lose';
    if (isToday) cls += ' today';
    if (sel) cls += ' sel';
    cells.push(`<div class="${cls}" data-crday="${g ? g.round : ''}"
      data-crdaynum="${d}" ${g ? `title="${o.name} · 综合 ${o.ovr} · ${
        g.home ? '主场' : '客场'}"` : ''}>
      <i class="cr-d">${d - rg.from + 1}</i>
      ${g ? `
        <span class="cr-stars">${'★'.repeat(stars)}</span>
        <div class="cr-opp">${teamCrest(g.opp, 44)}</div>
        <div class="cr-onm">${shortTeamName(o.name)}</div>
        ${rec ? `<div class="cr-res ${rec.win ? 'w' : 'l'}">${
          rec.win ? '胜' : '负'} ${rec.my}-${rec.opp2}</div>` : ''}
      ` : ''}
    </div>`);
  }

  return `
    <div class="cr-cal">
      <div class="cr-cal-head">
        <span class="cr-season">${String(L.year).slice(2)}-${String(L.year + 1).slice(2)}赛季</span>
        <button class="cr-legend" id="crLegend">图例</button>
        <button class="cr-mbtn" id="crPrevM" ${crMonth === 0 ? 'disabled' : ''}>◂</button>
        <b>${m.name}</b><em>${m.en}</em>
        <button class="cr-mbtn" id="crNextM"
          ${crMonth >= CAREER_MONTHS.length - 1 ? 'disabled' : ''}>▸</button>
        <span class="cr-dots">${CAREER_MONTHS.map((x, i) =>
          `<i class="${i === crMonth ? 'on' : ''}"></i>`).join('')}</span>
      </div>
      <div class="cr-grid">${cells.join('')}</div>
    </div>`;
}

/* ---------- 右侧：比赛日对手面板 ---------- */
function careerPanelHTML() {
  const cur = careerRound();
  const sel = crSelRound || cur;
  const full = myFullSchedule();
  const g = full.filter((x) => x.round === sel)[0];
  const L = seasonState();
  const done = {};
  (L.mySched || []).forEach((x) => { done[x.round] = x; });
  const rec = done[sel];

  if (!g) {
    return `<div class="cr-panel">
      <div class="cr-p-empty">休息日<br><span>这一天没有比赛安排</span></div>
      <button class="cr-challenge" id="crAdv2">${crAdvLabel(L)}</button>
    </div>`;
  }

  const o = oppBrief(g.opp);
  const st = L.teams[g.opp] || {};
  const t = TEAM_BY_KEY[g.opp] || {};
  const cs = (typeof coachStyle === 'function') ? coachStyle(g.opp) : null;
  const roster = (st.roster || []).slice(0, 10);
  const bm = (typeof teamBrkMap === 'function') ? (teamBrkMap(g.opp) || {}) : {};
  const ps = roster.map((id) => {
    const c = CARD_BY_ID[id];
    if (!c) return null;
    const brk = bm[id] || 0;
    return { c, brk, ovr: statsOf(c, brk).ovr };
  }).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const starters = ps.slice(0, 5);

  // 该队在分区的排名
  const confList = [];
  NBA_TEAMS.filter((x) => x.conf === t.conf).forEach((x) => {
    const s2 = L.teams[x.key] || { wins: 0, loses: 0 };
    confList.push({ key: x.key, w: s2.wins || 0, l: s2.loses || 0 });
  });
  confList.sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.w - a.w);
  const confRank = confList.findIndex((x) => x.key === g.opp) + 1;

  return `
    <div class="cr-panel">
      <div class="cr-p-head">比赛日 · 对手</div>
      <div class="cr-p-team">
        ${teamCrest(g.opp, 52)}
        <div class="cr-p-ti">
          <b>${o.name}</b>
          <span>${g.home ? '主场' : '客场'} · 第 ${sel} 轮</span>
        </div>
      </div>
      <div class="cr-p-stats">
        <div class="cr-ps"><span>总评</span><b>${o.ovr}</b></div>
        <div class="cr-ps"><span>胜场</span><b>${st.wins || 0}</b></div>
        <div class="cr-ps"><span>${t.conf || ''}部</span><b>${confRank || '—'}</b></div>
      </div>
      <div class="cr-p-sub">首发阵容${
        cs ? `<em>${cs.name}</em>` : ''}</div>
      <div class="cr-p-lineup">
        ${starters.map((p) => `
          <div class="cr-pl" data-crcard="${p.c.id}">
            ${brkBadge(p.brk)}
            <div class="cr-pl-img"><img src="${p.c.photo}" alt=""
              onerror="this.parentNode.style.visibility='hidden'"></div>
            <div class="cr-pl-nm">${p.c.name}</div>
            <div class="cr-pl-pos pos-${p.c.pos}">${p.c.pos}</div>
          </div>`).join('') || '<div class="cr-p-empty2">阵容未知</div>'}
      </div>
      ${rec ? `
        <div class="cr-p-done">本场已结束：<b class="${rec.win ? 'w' : 'l'}">${
          rec.win ? '胜' : '负'} ${rec.my}-${rec.opp2}</b></div>
        <button class="cr-challenge ghost" id="crAdv3">${crAdvLabel(L)}</button>
      ` : `
        <button class="cr-challenge" id="crChallenge">挑 战</button>
      `}
    </div>`;
}

/* ---------- 季后赛：生涯模式内的对阵 ---------- */
function careerPlayoffHTML() {
  const L = seasonState();
  const po = L.playoff;
  if (!po) return '';
  const rounds = ['首轮', '分区半决赛', '分区决赛', '总决赛'];
  const isFinal = po.round === 3;
  const mineSeries = (po.series || []).filter((s) =>
    s.round === po.round && (s.hi === SEASON.MY_KEY || s.lo === SEASON.MY_KEY))[0];
  return `
    <div class="cr-po">
      <div class="cr-po-head">
        <b>${isFinal ? '🏆 总决赛' : '季后赛 · ' + (rounds[po.round] || '')}</b>
        <span>${po.champion ? '总冠军：' +
          (po.champion === SEASON.MY_KEY ? '我的球队' : oppBrief(po.champion).name)
          : '7 战 4 胜制'}</span>
      </div>
      ${mineSeries ? `
        <div class="cr-po-series">
          <div class="cr-po-t ${mineSeries.hi === SEASON.MY_KEY ? 'me' : ''}">
            ${teamCrest(mineSeries.hi, 40)}
            <span>${mineSeries.hi === SEASON.MY_KEY ? '我的球队'
              : oppBrief(mineSeries.hi).name}</span>
            <b>${mineSeries.hw}</b>
          </div>
          <div class="cr-po-vs">VS</div>
          <div class="cr-po-t ${mineSeries.lo === SEASON.MY_KEY ? 'me' : ''}">
            ${teamCrest(mineSeries.lo, 40)}
            <span>${mineSeries.lo === SEASON.MY_KEY ? '我的球队'
              : oppBrief(mineSeries.lo).name}</span>
            <b>${mineSeries.lw}</b>
          </div>
        </div>` : `<div class="cr-po-note">本轮没有我的系列赛</div>`}
    </div>`;
}

/* =============================================================
   生涯模式内嵌子页签（v2.1）
   -------------------------------------------------------------
   把原来「联赛」页的 6 个视图并进来：
     赛程 / 排名 / 奖项 / 季后赛 / 历史 / 战报
   转会市场与任务属于"我的资产"，放到「我的」页，
   这样生涯页只管"赛季"，不和管理功能混在一起。
   ============================================================= */
let crView = 'sched';        // sched | rank | award | playoff | history | news
const CR_VIEWS = [
  { key: 'sched',   label: '📅 赛程' },
  { key: 'rank',    label: '📊 排名' },
  { key: 'award',   label: '🏅 奖项' },
  { key: 'playoff', label: '🏆 季后赛' },
  { key: 'history', label: '📜 历史' },
  { key: 'news',    label: '📰 战报' },
];
function crTabsHTML() {
  const L = seasonState();
  const po = L.playoff;
  return `<div class="cr-tabs">
    ${CR_VIEWS.map((v) => {
      const badge = v.key === 'news' ? (L.news || []).length
        : v.key === 'award' ? (L.awards || []).length
        : v.key === 'playoff' ? (po && po.champion ? '🏆' : '')
        : '';
      return `<button class="cr-tab${crView === v.key ? ' on' : ''}"
        data-crview="${v.key}">${v.label}${
        badge ? `<i>${badge}</i>` : ''}</button>`;
    }).join('')}
  </div>`;
}
/** 内嵌视图的正文 */
function crViewHTML() {
  try {
    if (crView === 'rank' && typeof lgRankHTML === 'function') {
      return `<div class="cr-embed">${lgRankHTML()}</div>`;
    }
    if (crView === 'award' && typeof lgAwardHTML === 'function') {
      return `<div class="cr-embed">${lgAwardHTML()}</div>`;
    }
    if (crView === 'playoff') {
      /* 常规赛第 50 场后进入"季后赛争夺"，实时显示对阵与晋级线；
         季后赛开始后显示已锁定的对阵图。 */
      const L2 = seasonState();
      if (L2.phase === 'playoff' && typeof bracketHTML === 'function') {
        return `<div class="cr-embed">${bracketHTML()}</div>` +
          (typeof raceHTML === 'function'
            ? `<div class="cr-embed" style="margin-top:10px">${raceHTML()}</div>` : '');
      }
      if (typeof raceHTML === 'function') {
        return `<div class="cr-embed">${raceHTML()}</div>`;
      }
    }
    if (crView === 'history' && typeof historyHTML === 'function') {
      return `<div class="cr-embed">${historyHTML()}</div>`;
    }
    if (crView === 'news' && typeof lgNewsHTML === 'function') {
      return `<div class="cr-embed">${lgNewsHTML()}</div>`;
    }
  } catch (e) { return `<div class="cr-embed">加载失败：${e.message}</div>`; }
  return '';
}

/* ---------- 总入口 ---------- */
function careerHTML() {
  const L = seasonState();
  const po = L.playoff;
  // 季后赛阶段：显示对阵 + 对手面板
  if (L.phase === 'playoff' && po && crView === 'sched') {
    return `<div class="cr-wrap">
      ${careerTopHTML()}
      ${crTabsHTML()}
      <div class="cr-body">
        <div class="cr-main">${careerPlayoffHTML()}</div>
        ${careerPlayoffPanelHTML()}
      </div>
      <div class="cr-uid">UID:${S.uid || 'peakcard2026'}</div>
    </div>`;
  }
  // 非赛程视图：整页显示该视图（右侧不再挂对手面板，避免挤压）
  if (crView !== 'sched') {
    return `<div class="cr-wrap">
      ${careerTopHTML()}
      ${crTabsHTML()}
      <div class="cr-fullview">${crViewHTML()}</div>
      <div class="cr-uid">UID:${S.uid || 'peakcard2026'}</div>
    </div>`;
  }
  return `<div class="cr-wrap">
    ${careerTopHTML()}
    ${crTabsHTML()}
    <div class="cr-body">
      <div class="cr-main">${careerCalendarHTML()}</div>
      ${careerPanelHTML()}
    </div>
    <div class="cr-uid">UID:${S.uid || 'peakcard2026'}</div>
  </div>`;
}
/** 季后赛时的右侧面板 */
function careerPlayoffPanelHTML() {
  const L = seasonState();
  const po = L.playoff;
  if (!po) return '<div class="cr-panel"></div>';
  const mine = (po.series || []).filter((s) =>
    s.round === po.round && (s.hi === SEASON.MY_KEY || s.lo === SEASON.MY_KEY))[0];
  if (!mine) {
    return `<div class="cr-panel"><div class="cr-p-empty">
      我的球队已被淘汰<br><span>可以推进查看其他系列赛</span></div>
      <button class="cr-challenge ghost" id="crAdv3">${crAdvLabel(L)}</button></div>`;
  }
  const oppKey = mine.hi === SEASON.MY_KEY ? mine.lo : mine.hi;
  const o = oppBrief(oppKey);
  const st = L.teams[oppKey] || {};
  const roster = (st.roster || []).slice(0, 5);
  const bm = (typeof teamBrkMap === 'function') ? (teamBrkMap(oppKey) || {}) : {};
  const ps = roster.map((id) => {
    const c = CARD_BY_ID[id];
    if (!c) return null;
    const brk = bm[id] || 0;
    return { c, brk, ovr: statsOf(c, brk).ovr };
  }).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  return `
    <div class="cr-panel">
      <div class="cr-p-head">${po.round === 3 ? '总决赛对手' : '系列赛对手'}</div>
      <div class="cr-p-team">
        ${teamCrest(oppKey, 52)}
        <div class="cr-p-ti"><b>${o.name}</b>
          <span>系列赛 ${mine.hi === SEASON.MY_KEY ? mine.hw : mine.lw} : ${
            mine.hi === SEASON.MY_KEY ? mine.lw : mine.hw}</span></div>
      </div>
      <div class="cr-p-stats">
        <div class="cr-ps"><span>总评</span><b>${o.ovr}</b></div>
        <div class="cr-ps"><span>胜场</span><b>${st.wins || 0}</b></div>
      </div>
      <div class="cr-p-sub">首发阵容</div>
      <div class="cr-p-lineup">
        ${ps.map((p) => `
          <div class="cr-pl" data-crcard="${p.c.id}">
            ${brkBadge(p.brk)}
            <div class="cr-pl-img"><img src="${p.c.photo}" alt=""
              onerror="this.parentNode.style.visibility='hidden'"></div>
            <div class="cr-pl-nm">${p.c.name}</div>
            <div class="cr-pl-pos">${p.c.pos}</div>
          </div>`).join('')}
      </div>
      ${(function () {
        const info = (typeof mySeriesInfo === 'function') ? mySeriesInfo() : null;
        if (!info) {
          return '<button class="cr-challenge ghost" id="crAdv3">赛季切换 ▸</button>';
        }
        if (info.done) {
          return `<div class="cr-p-done">系列赛结束：<b class="${
            info.winner === SEASON.MY_KEY ? 'w' : 'l'}">${
            info.winner === SEASON.MY_KEY ? '晋级' : '被淘汰'}</b></div>
            <button class="cr-challenge ghost" id="crAdv3">下一轮 ▸</button>`;
        }
        return `<div class="cr-p-series">系列赛 <b>${info.myWins}</b> : <b>${
          info.oppWins}</b>　第 ${info.gameNo} 场　${
          info.iAmHome ? '主场' : '客场'}</div>
          <button class="cr-challenge" id="crChallenge">打 第 ${info.gameNo} 场</button>`;
      })()}
    </div>`;
}

/* ---------- 交互 ---------- */
function bindCareer() {
  const el = document.getElementById('scr-battle');
  if (!el) return;
  el.querySelectorAll('[data-crview]').forEach((b) => {
    b.onclick = () => {
      crView = b.dataset.crview;
      Sfx.click();
      renderBattle();
    };
  });
  /* ★ 对阵图的点击绑定。
     原来 bindBracket() 是在「联赛」页里调的，联赛页删掉后就没人调了，
     于是对阵图能显示但点不动。这里补上。 */
  try { if (typeof bindBracket === 'function') bindBracket(); } catch (e) {}
  // 点对阵图里的球队 → 看对手阵容
  /* 对阵图上的系列赛：
     只有「我的系列赛 + 已经进季后赛 + 还没被淘汰」才能开打，
     其他一律只读（看阵容）。 */
  el.querySelectorAll('.bk-series').forEach((row) => {
    if (row.onclick) return;
    const ds = row.dataset.series;
    if (!ds) return;
    row.onclick = () => {
      const parts = ds.split(':');
      const isMine = parts[1] === SEASON.MY_KEY || parts[2] === SEASON.MY_KEY;
      const opp = parts[1] === SEASON.MY_KEY ? parts[2] : parts[1];
      Sfx.click();
      const canPlay = isMine && (typeof canPlayPlayoff === 'function') && canPlayPlayoff();
      try {
        showOppPreview(opp, canPlay ? (poNextRound() || null) : null,
          canPlay ? 'playoff' : 'view');
      } catch (e) { toast('打开失败：' + e.message); }
    };
  });
  /* 常规赛期间的东西部前 8 种子 → 纯预览，绝对不能开打
     （用户明确要求：没打完 82 场、没进季后赛之前不能打季后赛） */
  el.querySelectorAll('[data-opp]').forEach((b) => {
    if (b.onclick) return;
    b.onclick = () => {
      Sfx.click();
      try { showOppPreview(b.dataset.opp, null, 'view'); } catch (e) {}
    };
  });
  const hp = document.getElementById('crHelp');
  if (hp) hp.onclick = () => {
    Sfx.click();
    toast('生涯模式：★=对手强度 · 红格=今天 · ▶▶=可快速推进 · 点格子看对手阵容');
  };
  const lg = document.getElementById('crLegend');
  if (lg) lg.onclick = () => {
    Sfx.click();
    toast('蓝格=比赛日 · 红格=今天 · 灰格=休息日 · 显示"胜/负 比分"的是已打完的比赛');
  };
  const ch2 = document.getElementById('crChart');
  if (ch2) ch2.onclick = () => {
    Sfx.click();
    const rec = myRecord();
    switchTab('league'); lgTab = 'rank';
    try { renderMarket(); } catch (e) {}
    toast('生涯战绩 ' + rec.w + '胜' + rec.l + '负（已切到排名页）');
  };
  // 切月
  const pv = document.getElementById('crPrevM');
  if (pv) pv.onclick = () => { if (crMonth > 0) { crMonth--; Sfx.click(); renderBattle(); } };
  const nx = document.getElementById('crNextM');
  if (nx) nx.onclick = () => {
    if (crMonth < CAREER_MONTHS.length - 1) { crMonth++; Sfx.click(); renderBattle(); }
  };
  // 点某一天 → 右侧显示那天对手
  /* 月历格子的点击：
     第一次点 → 选中这一天，右侧显示对手阵容；
     再点同一个 → 直接进入对手预览，可以立刻开打。
     这样即使右侧面板在小屏上被挤掉，也能只靠月历完成"选队→开打"。 */
  el.querySelectorAll('[data-crday]').forEach((c) => {
    if (!c.dataset.crday) return;                 // 休息日不可点
    c.onclick = () => {
      const r = parseInt(c.dataset.crday, 10);
      if (crSelRound === r) {
        // 第二次点同一个 → 直接开打
        const g = myFullSchedule().filter((x) => x.round === r)[0];
        if (!g) { toast('这一天没有比赛'); return; }
        Sfx.reveal('gold');
        crSelRound = r;
        renderBattle();
        try { showOppPreview(g.opp, r); }
        catch (e2) { toast('打开失败：' + e2.message); }
        return;
      }
      crSelRound = r;
      Sfx.click();
      renderBattle();
    };
  });
  // 挑战
  // 第一次选中某天时提示一下，让玩家知道下一步
  if (crSelRound) {
    const panel = el.querySelector('.cr-panel');
    if (panel && !panel.querySelector('.cr-p-hint')) {
      const h = document.createElement('div');
      h.className = 'cr-p-hint';
      h.textContent = '再点一次该对手可直接开打';
      panel.appendChild(h);
    }
  }
  const ch = document.getElementById('crChallenge');
  if (ch) ch.onclick = () => {
    Sfx.reveal('gold');
    /* 季后赛：直接打系列赛的下一场（不走赛程表） */
    if (seasonState().phase === 'playoff') {
      const info = (typeof mySeriesInfo === 'function') ? mySeriesInfo() : null;
      if (!info) { toast('我的球队已被淘汰，点「赛季切换」推进'); return; }
      if (info.done) { toast('系列赛已结束，点上方按钮推进下一轮'); return; }
      try { showOppPreview(info.opp, null, 'playoff'); }
      catch (e) { toast('打开失败：' + e.message); }
      return;
    }
    const cur = careerRound();
    const sel = crSelRound || cur;
    const g = myFullSchedule().filter((x) => x.round === sel)[0];
    if (!g) { toast('这一天没有比赛'); return; }
    // 把"我要打第几轮"一起传下去，结算才会记到正确的那一轮
    try { showOppPreview(g.opp, sel); }
    catch (e) { toast('打开失败：' + e.message); }
  };
  // 推进
  const bindAdv = (id) => {
    const b = document.getElementById(id);
    if (b) b.onclick = () => {
      Sfx.reveal('gold');
      // 打完 2056 → 回到 2026 开新一轮
      if (typeof canStartNewCycle === 'function' && canStartNewCycle()) {
        const res = startNewCycle();
        Sfx.reveal('momentPurple');
        toast('🔄 第 ' + res.cycle + ' 轮开启！年份回到 ' + res.year +
          '，球员卡与金币全部保留');
        crSelRound = null; crView = 'sched';
        renderBattle();
        return;
      }
      const r = advanceSeason();
      let msg = '';
      if (r.newSeason) { Sfx.reveal('momentPurple'); msg = '🎉 ' + seasonName(r.newSeason.year) + ' 赛季开幕！'; }
      else if (r.finished) msg = '已经打完 2056 赛季 🏁';
      else if (r.seeds) msg = '常规赛结束，季后赛对阵已生成！';
      else if (r.playoff) msg = '本轮系列赛结束';
      else if (r.roundResult) msg = '第 ' + r.round + ' 轮结束';
      if (r.awards && r.awards.length) msg += ' · 颁发 ' + r.awards.length + ' 个奖项';
      toast(msg || '已推进');
      crSelRound = null;
      renderBattle();
    };
  };
  bindAdv('crAdv'); bindAdv('crAdv2'); bindAdv('crAdv3');
  /* 当季生涯重置：清空本赛季进度，但保留球员 / 金币 / 阵容 */
  const rst = document.getElementById('crReset');
  if (rst) rst.onclick = async () => {
    Sfx.click();
    const L = (typeof seasonState === 'function') ? seasonState() : null;
    const y = L ? L.year : 2026;
    const nm = y + '-' + String((y + 1) % 100).padStart(2, '0');
    const ok = await uiConfirm({
      title: '🔄 当季生涯重置',
      html: '<p>把 <b>' + nm + '</b> 赛季的进度全部清空，重新从第 1 轮开始打。</p>'
        + '<p class="cfm-list"><b>会重置：</b>30 支球队战绩 · 你的 82 场赛程记录 · '
        + '数据统计 · 奖项 · 季后赛<br>'
        + '<b>会保留：</b>你的球员收藏 · 金币 · 阵容 · 突破等级 · 徽章 · '
        + '球员能力成长 · AI 球队的球员</p>'
        + '<p class="cfm-warn">球员不会被删除，只是本赛季重新打一遍。</p>',
      ok: '确认重置', cancel: '再想想',
    });
    if (!ok) return;
    if (typeof resetSeasonCareer !== 'function') { toast('重置功能未加载'); return; }
    resetSeasonCareer();
    toast('✅ 赛季已重置，球员和金币都保留');
    Sfx.reveal('gold');
    setTimeout(() => { renderCareer(); }, 150);
  };
  // 点对手球员看详情
  el.querySelectorAll('[data-crcard]').forEach((c) => {
    c.onclick = () => {
      Sfx.click();
      try { openDetail(c.dataset.crcard, false, true); } catch (e) {}
    };
  });
}

/* ---------- 调试：?careertest=1 生涯模式自检 ---------- */
(function careerTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('careertest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        const el = document.getElementById('scr-battle');
        out.push('顶部条=' + (el.querySelector('.cr-top') ? '✓' : '✗'));
        out.push('月历=' + (el.querySelector('.cr-cal') ? '✓' : '✗'));
        out.push('对手面板=' + (el.querySelector('.cr-panel') ? '✓' : '✗'));
        const cells = el.querySelectorAll('.cr-cell');
        const games = el.querySelectorAll('.cr-cell:not(.off)');
        out.push('月历格子=' + cells.length + ' 个，其中有比赛 ' + games.length + ' 天');
        out.push('今天高亮=' + el.querySelectorAll('.cr-cell.today').length + ' 个');
        // 点一天看右侧是否切换
        const dayBtns = el.querySelectorAll('[data-crday]');
        const target = Array.prototype.filter.call(dayBtns, (c) =>
          !c.classList.contains('off'))[2];
        if (target) {
          const d = target.dataset.crday;
          target.click();
          setTimeout(() => {
            const el2 = document.getElementById('scr-battle');
            const ti = el2.querySelector('.cr-p-ti b');
            out.push('点第' + d + '天 → 右侧显示「' + (ti ? ti.textContent : '?') + '」');
            out.push('首发阵容=' +
              el2.querySelectorAll('.cr-pl').length + ' 人');
            out.push('挑战按钮=' + (el2.querySelector('#crChallenge') ? '✓' : '✗'));
            // 切月
            const nx = document.getElementById('crNextM');
            if (nx) {
              nx.click();
              setTimeout(() => {
                const el3 = document.getElementById('scr-battle');
                out.push('切到下月=' + (el3.querySelector('.cr-cal-head b')
                  ? el3.querySelector('.cr-cal-head b').textContent : '?'));
                out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(';') : '无 ✓'));
                document.title = 'CAREER ' + out.join(' | ');
              }, 350);
            } else {
              document.title = 'CAREER ' + out.join(' | ');
            }
          }, 350);
        } else {
          out.push('异常=' + (errs.length ? '✗ ' + errs[0] : '无 ✓'));
          document.title = 'CAREER ' + out.join(' | ');
        }
      }, 700);
    }, 900);
  } catch (e) { document.title = 'CAREER-ERR ' + e.message; }
})();

/* 调试：?notut=1 跳过新手引导（截图/测试用） */
(function noTut() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('notut')) return;
    S.tut = { done: true, step: 99 };
    if (typeof renderTutorial === 'function') renderTutorial();
    setTimeout(() => {
      const tb = q.get('tab') || 'battle';
      if (typeof switchTab === 'function') switchTab(tb);
    }, 300);
  } catch (e) {}
})();

/* ---------- 调试：?crsweep=1 生涯模式 → 挑战 → 扫荡 ---------- */
(function crSweep() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('crsweep')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        const ch = document.getElementById('crChallenge');
        out.push('挑战按钮=' + (ch ? '✓' : '✗'));
        if (!ch) { document.title = 'CRSWEEP ' + out.join(' | '); return; }
        ch.click();
        setTimeout(() => {
          const go = document.getElementById('opGo');
          out.push('对手浮层开打=' + (go ? '✓' : '✗'));
          if (!go) { document.title = 'CRSWEEP ' + out.join(' | '); return; }
          go.click();
          setTimeout(() => {
            out.push('比赛=' + BT.phase + ' 对手=' + (BT.aiTeam ? BT.aiTeam.name : '?'));
            /* 连扫 4 场，严格按玩家的操作顺序：
               挑战 → 开始比赛 → 一键扫荡 → 继续生涯 → （下一场）挑战 */
            let n = 0;
            const doOne = () => {
              if (n >= 4) {
                const rec = myRecord();
                out.push('合计 ' + rec.w + '胜' + rec.l + '负 / 轮次=' +
                  seasonState().round);
                out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,3).join(' ; ')
                  : '无 ✓'));
                document.title = 'CRSWEEP ' + out.join(' | ');
                return;
              }
              n++;
              switchTab('battle');
              setTimeout(() => {
                // ① 若还在比赛中 → 先扫荡
                if (BT.phase === 'live') {
                  const sk = document.getElementById('btSkip');
                  if (sk) sk.click();
                }
                setTimeout(() => {
                  // ② 若在赛后页 → 点「继续生涯」
                  if (BT.phase === 'done') {
                    const ag = document.getElementById('btAgain');
                    if (ag) ag.click();
                  }
                  setTimeout(() => {
                    // ③ 现在应该在生涯模式，找挑战按钮
                    const c2 = document.getElementById('crChallenge')
                      || document.getElementById('crAdv3');
                    if (!c2) {
                      out.push('第' + n + '场：无挑战按钮 ✗ phase=' + BT.phase);
                      document.title = 'CRSWEEP ' + out.join(' | '); return;
                    }
                    c2.click();
                    setTimeout(() => {
                      const g2 = document.getElementById('opGo');
                      if (!g2) { out.push('第' + n + '场：无开打按钮 ✗');
                        document.title = 'CRSWEEP ' + out.join(' | '); return; }
                      g2.click();
                      setTimeout(() => {
                        const sk2 = document.getElementById('btSkip');
                        if (!sk2) { out.push('第' + n + '场：无扫荡按钮 ✗');
                          document.title = 'CRSWEEP ' + out.join(' | '); return; }
                        const oppName = BT.aiTeam ? BT.aiTeam.name : '?';
                        sk2.click();
                        setTimeout(() => {
                          const rr = myRecord();
                          out.push('第' + n + '场 vs ' + oppName + ' ' +
                            BT.myTeam.score + ':' + BT.aiTeam.score +
                            ' → ' + rr.w + '胜' + rr.l + '负');
                          doOne();
                        }, 600);
                      }, 800);
                    }, 450);
                  }, 500);
                }, 700);
              }, 400);
            };
            doOne();
          }, 1100);
        }, 600);
      }, 700);
    }, 900);
  } catch (e) { document.title = 'CRSWEEP-ERR ' + e.message; }
})();

/* ---------- 调试：?mergetest=1 生涯+联赛合并自检 ---------- */
(function mergeTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('mergetest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(900);
      // ① 页签数量
      out.push('底部页签=' + document.querySelectorAll('#tabbar button').length +
        ' 个（应为 7）');
      out.push('联赛页签已移除=' +
        (document.querySelector('[data-tab="league"]') ? '✗还在' : '✓'));
      // ② 生涯内嵌子页签
      switchTab('battle'); await wait(500);
      const tabs = document.querySelectorAll('[data-crview]');
      out.push('生涯子页签=' + tabs.length + ' 个' +
        (tabs.length === 6 ? ' ✓' : ' ✗') + '：' +
        Array.prototype.map.call(tabs, (t) => t.textContent.trim().slice(0, 3)).join(' '));
      // ③ 逐个切换
      const names = [];
      for (let i = 0; i < tabs.length; i++) {
        const b = document.querySelectorAll('[data-crview]')[i];
        const key = b.dataset.crview;
        b.click();
        await wait(320);
        const el = document.getElementById('scr-battle');
        const fv = el.querySelector('.cr-fullview');
        const has = key === 'sched'
          ? !!el.querySelector('.cr-cal')
          : (fv && fv.textContent.trim().length > 10);
        names.push(key + (has ? '✓' : '✗'));
      }
      out.push('六个视图渲染：' + names.join(' '));
      // ④ 回到赛程
      const s0 = document.querySelector('[data-crview="sched"]');
      if (s0) s0.click();
      await wait(320);
      out.push('赛程日历=' +
        (document.querySelector('.cr-cal') ? '✓' : '✗') +
        ' 对手面板=' + (document.querySelector('.cr-panel') ? '✓' : '✗'));
      // ⑤ 独立转会市场页
      switchTab('market'); await wait(700);
      const mkt = document.getElementById('scr-market');
      const rows = mkt ? mkt.querySelectorAll('.lg-mk-card, .lg-market-row, .lg-mk')
        .length : 0;
      const txt = mkt ? mkt.textContent : '';
      out.push('转会页=' + (mkt && mkt.classList.contains('active') ? '✓' : '✗') +
        ' 有内容=' + (txt.length > 100 ? '✓ ' + txt.length + ' 字' : '✗'));
      out.push('转会页含关键词：' +
        ['转会', '金币', '球员'].filter((k) => txt.indexOf(k) >= 0).join('/'));
      // 一键清仓按钮
      const bulk = mkt ? mkt.querySelectorAll('[data-bulk]').length : 0;
      out.push('一键清仓按钮=' + bulk + ' 个');
      // 任务入口
      const qb = document.getElementById('mkQuest');
      out.push('转会页任务按钮=' + (qb ? '✓' : '✗'));
      if (qb) {
        qb.click(); await wait(500);
        const ml = document.getElementById('mineLayer');
        const qr = ml ? ml.querySelectorAll('.qs-row').length : 0;
        out.push('任务浮层=' + (qr > 20 ? '✓ ' + qr + ' 行' : '✗'));
        const c = document.getElementById('mlClose');
        if (c) c.click();
        await wait(250);
      }
      out.push('我的页已无转会入口=' +
        (document.getElementById('mtMarket') ? '✗还在' : '✓'));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'MERGE ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'MERGE-ERR ' + e.message; }
})();

/* ---------- 调试：?seasontest=1 赛季切换 + 季后赛奖项自检 ---------- */
(function seasonTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('seasontest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(900);
      const L = seasonState();
      out.push('起始赛季 ' + L.year + ' 阶段=' + L.phase);
      // 连续推进直到进入季后赛
      let guard = 0;
      while (seasonState().phase === 'regular' && guard++ < 120) {
        advanceSeason();
      }
      out.push('推进 ' + guard + ' 次后 阶段=' + seasonState().phase +
        ' 轮次=' + seasonState().round);
      const po0 = seasonState().playoff;
      out.push('季后赛=' + (po0 ? '✓ 第' + (po0.round + 1) + '轮' : '✗'));
      out.push('我的种子=' + (po0 && po0.mineIn ? '进季后赛 ✓' : '未进 ✗'));
      // 季后赛期间奖项是否还在
      const aw = seasonState().awards || [];
      out.push('季后赛期间奖项条数=' + aw.length +
        (aw.length ? ' ✓仍显示' : ' ⚠无'));
      switchTab('battle'); crView = 'award'; renderBattle();
      await wait(400);
      const av = document.querySelector('.cr-fullview');
      out.push('奖项视图渲染=' +
        (av && av.textContent.indexOf('MVP') >= 0 || av.textContent.length > 40
          ? '✓' : '✗'));
      // 打完季后赛
      crView = 'sched';
      let g2 = 0;
      while (seasonState().phase === 'playoff' && g2++ < 60) advanceSeason();
      const po1 = seasonState().playoff;
      out.push('季后赛结束 ' + g2 + ' 次推进 → 冠军=' +
        (po1 && po1.champion ?
          (po1.champion === SEASON.MY_KEY ? '我的球队' : oppBrief(po1.champion).name)
          : '?'));
      out.push('我夺冠=' + (po1 && po1.champion === SEASON.MY_KEY ? '✓' : '否'));
      // 切到下一个赛季
      renderBattle(); await wait(300);
      const adv = document.getElementById('crAdv');
      out.push('赛季切换按钮文案=' + (adv ? '「' + adv.textContent.trim() + '」' : '✗'));
      const y0 = seasonState().year;
      if (adv) adv.click();
      await wait(700);
      const y1 = seasonState().year;
      out.push('点一次 → 赛季 ' + y0 + ' → ' + y1 +
        (y1 === y0 + 1 ? ' ✓成功切换' : ' ⚠'));
      out.push('新赛季阶段=' + seasonState().phase +
        ' 轮次=' + seasonState().round);
      // 历史记录
      const h = (typeof historyState === 'function') ? historyState() : [];
      out.push('历史冠军墙=' + h.length + ' 条');
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'SEASON ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'SEASON-ERR ' + e.message; }
})();

/* 调试：?freshcheck=1 新档初始赛季状态 */
(function freshCheck() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('freshcheck')) return;
    setTimeout(() => {
      const L = seasonState();
      const out = [];
      out.push('赛季阶段=' + L.phase + ' 轮次=' + L.round);
      out.push('年份=' + L.year + ' 赛季号=' + L.season);
      out.push('赛程长度=' + (L.schedule ? L.schedule.length : 0));
      out.push('我的已打=' + ((L.mySched || []).length));
      out.push('我的总场次=' + myFullSchedule().length);
      out.push('下一场轮次=' + nextUnplayedRound());
      out.push('战绩=' + myRecord().w + '胜' + myRecord().l + '负');
      document.title = 'FRESH ' + out.join(' | ');
    }, 1200);
  } catch (e) { document.title = 'FRESH-ERR ' + e.message; }
})();

/* ---------- 调试：?brkbadge=1 突破徽章自检 ---------- */
(function brkBadgeTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('brkbadge')) return;
    const out = [];
    setTimeout(() => {
      // ① 函数本身：0/1/2/7/8 阶
      const cases = [0, 1, 2, 7, 8];
      out.push('阶数 → 徽章：' + cases.map((n) => {
        const h = brkBadge(n);
        const txt = h ? h.replace(/<[^>]*>/g, '') : '（不显示）';
        return n + '→' + txt;
      }).join('  '));
      out.push('校验：0 不显示=' + (brkBadge(0) === '' ? '✓' : '✗') +
        ' 1 显示1=' + (brkBadge(1).indexOf('>1<') > 0 ? '✓' : '✗') +
        ' 8 显示MAX=' + (brkBadge(8).indexOf('MAX') > 0 ? '✓' : '✗'));
      // ② 先推进 20 轮，让 AI 球队练球员（有突破才有徽章可验）
      for (let i = 0; i < 20; i++) {
        try { advanceSeason(); } catch (e) {}
      }
      out.push('推进 20 轮后 联赛轮次=' + seasonState().round);
      // 统计全联盟的突破分布
      const dist = {};
      NBA_TEAMS.forEach((t) => {
        const bm = teamBrkMap(t.key) || {};
        Object.keys(bm).forEach((id) => {
          const b = bm[id] || 0;
          dist[b] = (dist[b] || 0) + 1;
        });
      });
      out.push('全联盟突破分布：' + Object.keys(dist).sort((a, b) => a - b)
        .map((k) => k + '阶×' + dist[k]).join(' '));
      // ③ 实际页面：对手阵容里的徽章要与突破数一致
      switchTab('battle');
      setTimeout(() => {
        const el = document.getElementById('scr-battle');
        const rows = el.querySelectorAll('.cr-pl');
        const info = [];
        rows.forEach((r, i) => {
          const mx = r.querySelector('.cr-max');
          const bk = r.querySelector('.cr-brk');
          const nm = r.querySelector('.cr-pl-nm');
          info.push((nm ? nm.textContent.slice(-3) : '?') + '=' +
            (mx ? 'MAX' : bk ? bk.textContent : '无'));
        });
        out.push('对手首发徽章：' + info.join(' '));
        // ③ 与真实突破数据核对
        const cur = careerRound();
        const full = myFullSchedule();
        const g = full.filter((x) => x.round === cur)[0];
        if (g) {
          const bm = teamBrkMap(g.opp) || {};
          const st = seasonState().teams[g.opp] || {};
          const chk = (st.roster || []).slice(0, 10).map((id) => {
            const c = CARD_BY_ID[id];
            return c ? c.name.slice(-3) + ':' + (bm[id] || 0) : null;
          }).filter(Boolean).sort();
          out.push('真实突破数：' + chk.join(' '));
        }
        // ④ 找一个真有突破的球队，验证页面上确实渲染出数字
        let found = null;
        NBA_TEAMS.forEach((t) => {
          if (found) return;
          const bm = teamBrkMap(t.key) || {};
          const hit = Object.keys(bm).filter((id) => (bm[id] || 0) > 0)[0];
          if (hit) found = { key: t.key, id: hit, brk: bm[hit] };
        });
        if (found) {
          const c = CARD_BY_ID[found.id];
          out.push('样例：' + (c ? c.name : '?') + ' ' + found.brk + ' 阶突破');
          out.push('  brkBadge 输出=' + brkBadge(found.brk)
            .replace(/<span class="([^"]*)">([^<]*)<\/span>/, '[$1] $2'));
          // 真正插进页面看一眼
          const host = document.createElement('div');
          host.innerHTML = brkBadge(found.brk);
          document.body.appendChild(host);
          const el2 = host.firstElementChild;
          const cs = el2 ? getComputedStyle(el2) : null;
          out.push('  实际渲染：文字=' + (el2 ? el2.textContent : '?') +
            ' 字号=' + (cs ? cs.fontSize : '?') +
            ' 可见=' + (el2 && el2.offsetWidth > 0 ? '✓' : '✗'));
          host.remove();
        }
        document.title = 'BRKBADGE ' + out.join(' | ');
      }, 800);
    }, 900);
  } catch (e) { document.title = 'BRKBADGE-ERR ' + e.message; }
})();

/* ---------- 调试：?schedyear=1 每年赛程是否不同 ---------- */
(function schedYearTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('schedyear')) return;
    setTimeout(() => {
      const out = [];
      const sig = (list) => list.slice(0, 12).map((g) =>
        g.round + (g.home ? 'H' : 'A') + g.opp).join(',');
      const L = seasonState();
      // 记录连续 4 个赛季的赛程签名
      const sigs = [];
      for (let y = 0; y < 4; y++) {
        const full = myFullSchedule();
        sigs.push({ year: L.year, n: full.length, s: sig(full) });
        // 手动推进到下一赛季（跳过比赛）
        L.round = SEASON.ROUNDS + 1;
        L.phase = 'done';
        try { startNewSeason(); } catch (e) { out.push('切换失败 ' + e.message); break; }
      }
      sigs.forEach((x, i) => {
        out.push(x.year + ' 赛季 ' + x.n + ' 场 前4轮: ' +
          x.s.split(',').slice(0, 4).map((t) =>
            t.replace(/^(\d+)([HA])([a-z]+)$/, '$1$2$3')).join(' '));
      });
      // 检查是否两两不同
      let same = 0;
      for (let i = 1; i < sigs.length; i++) {
        if (sigs[i].s === sigs[i - 1].s) same++;
      }
      out.push('与上一年完全相同=' + same + ' 次' +
        (same === 0 ? ' ✓每年都不同' : ' ✗有重复'));
      // 场次是否都是 82
      const all82 = sigs.every((x) => x.n === SEASON.GAMES);
      out.push('每年都是 82 场=' + (all82 ? '✓' : '✗ ' +
        sigs.map((x) => x.n).join('/')));
      document.title = 'SCHEDYEAR ' + out.join(' | ');
    }, 1000);
  } catch (e) { document.title = 'SCHEDYEAR-ERR ' + e.message; }
})();

/* ---------- 调试：?potest=1 季后赛按战绩实时排阵自检 ---------- */
(function poTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('potest')) return;
    const out = [];
    setTimeout(() => {
      const L = seasonState();
      // ① 打满常规赛
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 120) advanceSeason();
      out.push('常规赛 ' + g + ' 轮后 → 阶段=' + seasonState().phase);
      const po = L.playoff;
      if (!po) { document.title = 'PO 季后赛未生成 ✗'; return; }

      // ② 种子是否严格按战绩排序
      ['东', '西'].forEach((c) => {
        const sd = po.seeds[c] || [];
        const lines = sd.slice(0, 8).map((x) => {
          const o = oppBrief(x.key);
          return (x.seed) + '.' + o.name.slice(-3) + ' ' + o.w + '-' + o.l;
        });
        out.push(c + '部种子：' + lines.join('  '));
        // 验证单调不增
        let ok = true;
        for (let i = 1; i < sd.length; i++) {
          const p0 = sd[i - 1].w - sd[i - 1].l, p1 = sd[i].w - sd[i].l;
          if (p1 > p0) ok = false;
        }
        out.push('  ' + c + '部按战绩排序=' + (ok ? '✓' : '✗'));
      });

      // ③ 首轮对阵是否为 1v8 / 2v7 / 3v6 / 4v5
      const r1 = po.series.filter((s) => s.round === 0);
      const pairs = r1.map((s) => (s.hiSeed || '?') + 'v' + (s.loSeed || '?'));
      out.push('首轮对阵：' + pairs.join(' '));
      const expect = ['1v8', '4v5', '2v7', '3v6', '1v8', '4v5', '2v7', '3v6'];
      out.push('首轮配对正确=' +
        (pairs.slice().sort().join() === expect.slice().sort().join() ? '✓' : '✗'));
      // 每个系列赛的 hi 必须种子更小（战绩更好）
      const hiOk = r1.every((s) => (s.hiSeed || 99) < (s.loSeed || 0));
      out.push('主场方=高种子=' + (hiOk ? '✓' : '✗'));

      // ④ 我的分区与排名是否一致
      const myConf = (S.myConf || '西');
      const rank = myConfRank();
      const inEast = (po.seeds['东'] || []).some((x) => x.key === SEASON.MY_KEY);
      const inWest = (po.seeds['西'] || []).some((x) => x.key === SEASON.MY_KEY);
      out.push('我的分区=' + myConf + ' 排名=' + rank +
        ' 出现在: ' + (inEast ? '东部' : '') + (inWest ? '西部' : '') +
        ((myConf === '东') === inEast && (myConf === '西') === inWest
          ? ' ✓一致' : ' ✗不一致'));

      // ⑤ 推进一轮，检查第二轮主场是否按战绩
      let g2 = 0;
      while (seasonState().playoff.round === 0 && g2++ < 30) advanceSeason();
      const r2 = po.series.filter((s) => s.round === 1);
      if (r2.length) {
        const chk = r2.map((s) => {
          const h = oppBrief(s.hi), l = oppBrief(s.lo);
          const ph = h.w - h.l, pl = l.w - l.l;
          return (ph >= pl ? '✓' : '✗') + '(' + ph + ':' + pl + ')';
        });
        out.push('第二轮主场按战绩=' + chk.join(' '));
      }
      out.push('第二轮系列赛数=' + r2.length + '（应为 4）');
      document.title = 'PO ' + out.join(' | ');
    }, 1000);
  } catch (e) { document.title = 'PO-ERR ' + e.message; }
})();

/* ---------- 调试：?clickteam=1 点击选择对手自检 ---------- */
(function clickTeamTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('clickteam')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      switchTab('battle');
      await wait(600);
      const el = () => document.getElementById('scr-battle');
      const cells = el().querySelectorAll('[data-crday]');
      out.push('月历格子=' + cells.length);
      const withGame = Array.prototype.filter.call(cells, (c) => c.dataset.crday);
      out.push('有比赛的格子=' + withGame.length + ' 个（应为 11~13）');
      if (!withGame.length) { document.title = 'CLICKTEAM ' + out.join(' | '); return; }

      // ① 逐个点击前 4 个比赛格，看右侧面板是否跟着变
      const names = [];
      for (let i = 0; i < Math.min(4, withGame.length); i++) {
        const c = el().querySelectorAll('[data-crday]')[i];
        if (!c || !c.dataset.crday) continue;
        const want = c.getAttribute('title') || '';
        c.click();
        await wait(320);
        const ti = el().querySelector('.cr-p-ti b');
        const got = ti ? ti.textContent : '?';
        const ok = want.indexOf(got) >= 0;
        names.push('第' + c.dataset.crday + '轮→' + got + (ok ? '✓' : '✗'));
      }
      out.push('点击切换对手：' + names.join('  '));

      // ② 选中未来的某一场，挑战按钮应该还在
      const later = withGame[withGame.length - 1];
      later.click();
      await wait(350);
      const ch = document.getElementById('crChallenge');
      out.push('选未来场次后挑战按钮=' + (ch ? '✓「' + ch.textContent.trim() + '」' : '✗'));
      out.push('选中年份/轮次=' + crSelRound);

      // ③ 切到下个月，格子是否还能点
      const nx = document.getElementById('crNextM');
      out.push('下月按钮=' + (nx ? '✓' : '✗'));
      if (nx) {
        nx.click(); await wait(400);
        const c2 = el().querySelectorAll('[data-crday]');
        const g2 = Array.prototype.filter.call(c2, (c) => c.dataset.crday);
        out.push('下个月格子=' + c2.length + ' 有比赛=' + g2.length);
        if (g2.length) {
          const before = (el().querySelector('.cr-p-ti b') || {}).textContent;
          g2[0].click(); await wait(350);
          const after = (el().querySelector('.cr-p-ti b') || {}).textContent;
          out.push('下月点击生效=' + (after && after !== before ? '✓ ' + after : '（同名或未变）'));
        }
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'CLICKTEAM ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'CLICKTEAM-ERR ' + e.message; }
})();

/* ---------- 调试：?pickplay=1 选中任意球队开打 ---------- */
(function pickPlay() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pickplay')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      switchTab('battle'); await wait(600);
      const el = () => document.getElementById('scr-battle');

      // 找到第 3 个有比赛的格子（当前轮之后的某一场）
      const cells = Array.prototype.filter.call(
        el().querySelectorAll('[data-crday]'), (c) => c.dataset.crday);
      const target = cells[2];
      const wantRound = parseInt(target.dataset.crday, 10);
      const wantName = (target.getAttribute('title') || '').split(' ')[0];
      out.push('目标：第' + wantRound + '轮 vs ' + wantName);

      // ① 第一次点 → 选中
      target.click(); await wait(400);
      out.push('选中的轮次=' + crSelRound +
        (crSelRound === wantRound ? ' ✓' : ' ✗'));
      out.push('右侧显示=' +
        ((el().querySelector('.cr-p-ti b') || {}).textContent || '?'));

      // ② 再点同一个 → 直接弹出对手预览
      const c2 = Array.prototype.filter.call(
        el().querySelectorAll('[data-crday]'), (c) => c.dataset.crday)[2];
      c2.click(); await wait(600);
      const ol = document.getElementById('oppLayer');
      const opened = ol && !ol.classList.contains('hidden');
      out.push('再点一次 → 对手预览=' + (opened ? '✓' : '✗'));

      // ③ 开打
      const go = document.getElementById('opGo');
      if (go) {
        go.click(); await wait(1000);
        out.push('比赛已开=' + (BT.phase === 'live' ? '✓' : '✗ ' + BT.phase) +
          ' 对手=' + (BT.aiTeam ? BT.aiTeam.name : '?'));
        out.push('记到第几轮=' + BT.myRound +
          (BT.myRound === wantRound ? ' ✓正确' : ' ✗应为' + wantRound));
        // 扫荡结束
        const sk = document.getElementById('btSkip');
        if (sk) sk.click();
        await wait(700);
        const rec = myRecord();
        const played = (seasonState().mySched || []).filter(
          (x) => x.round === wantRound)[0];
        out.push('赛后：战绩 ' + rec.w + '胜' + rec.l + '负，第' +
          wantRound + '轮记录=' +
          (played ? played.my + ':' + played.opp2 + (played.win ? ' 胜' : ' 负') +
            ' ✓' : '✗没有'));
      } else out.push('开打按钮 ✗');

      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'PICKPLAY ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'PICKPLAY-ERR ' + e.message; }
})();

/* ---------- 调试：?pobracket=1 季后赛对阵显示自检 ---------- */
(function poBracketTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pobracket')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      // ① 打满常规赛
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 120) advanceSeason();
      const L = seasonState();
      out.push('常规赛结束 阶段=' + L.phase);
      const po = L.playoff;
      out.push('季后赛系列赛总数=' + (po ? po.series.length : 0) + '（首轮应为 8）');

      // ② 进入生涯页，看是否直接能看到对阵
      switchTab('battle');
      await wait(700);
      crView = 'sched'; renderBattle(); await wait(500);
      let el = document.getElementById('scr-battle');
      out.push('生涯默认视图有对阵图=' +
        (el.querySelector('.cr-po') || el.querySelector('.bk-series') ? '✓' : '✗'));

      // ③ 切到「季后赛」子页签，数一数显示了几组
      const pt = el.querySelector('[data-crview="playoff"]');
      if (pt) { pt.click(); await wait(500); }
      el = document.getElementById('scr-battle');
      const rows = el.querySelectorAll('.bk-series');
      out.push('季后赛视图显示系列赛=' + rows.length + ' 组' +
        (rows.length >= 8 ? ' ✓全部显示' : ' ✗不足8组'));
      // ④ 每组是否都有两队名 + 战绩
      let okBoth = 0, okRec = 0;
      rows.forEach((r) => {
        const ts = r.querySelectorAll('.bk-t');
        if (ts.length === 2) okBoth++;
        if (r.querySelectorAll('.bk-rec').length === 2) okRec++;
      });
      out.push('两队齐全=' + okBoth + '/' + rows.length +
        ' 带战绩=' + okRec + '/' + rows.length);
      // ⑤ 我的系列赛能否点开
      const mine = el.querySelector('.bk-series.mine');
      out.push('我的系列赛高亮=' + (mine ? '✓' : '✗'));
      if (mine) {
        mine.click(); await wait(600);
        const ol = document.getElementById('oppLayer');
        out.push('点我的系列赛 → 对手预览=' +
          (ol && !ol.classList.contains('hidden') ? '✓ ' +
            (ol.querySelector('.op-tm') || {}).textContent : '✗'));
        const go = document.getElementById('opGo');
        if (go) { go.click(); await wait(900);
          out.push('可开打=' + (BT.phase === 'live' ? '✓ 对手=' + BT.aiTeam.name : '✗'));
        }
      }
      // ⑥ 点别人的系列赛也能看
      const other = Array.prototype.filter.call(rows, (r) =>
        !r.classList.contains('mine'))[0];
      if (other) {
        other.click(); await wait(500);
        const ol = document.getElementById('oppLayer');
        out.push('点其他球队系列赛=' +
          (ol && !ol.classList.contains('hidden') ? '✓' : '✗'));
        const c = ol.querySelector('.op-mask'); if (c) c.click();
        await wait(250);
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'POBRACKET ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'POBRACKET-ERR ' + e.message; }
})();

/* ---------- 调试：?pomanual=1 季后赛手动对战自检 ---------- */
(function poManualTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pomanual')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      // ① 打满常规赛（最后 3 轮前注入好战绩，保证进季后赛）
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 120) {
        if (seasonState().round >= 83) {          // 只在收官阶段注入一次
          const me = myLeagueEntry();
          me.w = Math.max(me.w, 60); me.l = Math.min(me.l, 20);
        }
        advanceSeason();
      }
      const L = seasonState();
      out.push('阶段=' + L.phase + ' 轮次=' + L.round);
      const info0 = mySeriesInfo();
      out.push('我的系列赛=' + (info0
        ? info0.myWins + ':' + info0.oppWins + ' vs ' +
          oppBrief(info0.opp).name + ' 第' + info0.gameNo + '场'
        : '（没进季后赛）'));
      if (!info0) {
        const me = myLeagueEntry();
        out.push('我的战绩=' + me.w + '胜' + me.l + '负  分区=' +
          ((typeof S !== 'undefined' && S.myConf) ? S.myConf : '西(默认)'));
        ['东', '西'].forEach((c) => {
          const sd = (L.playoff && L.playoff.seeds[c]) || [];
          out.push(c + '部前8：' + sd.slice(0, 8).map((x, i) =>
            (i + 1) + '.' + oppBrief(x.key).name.slice(-3) + ' ' +
            x.w + '-' + x.l + (x.key === SEASON.MY_KEY ? '★' : '')).join(' '));
        });
        out.push('我在po.series里=' + (L.playoff ? L.playoff.series.filter(
          (x) => x.hi === SEASON.MY_KEY || x.lo === SEASON.MY_KEY).length : 0));
        document.title = 'POMANUAL ' + out.join(' | '); return;
      }

      // ② 进生涯页，点「打第 N 场」
      switchTab('battle'); crView = 'sched'; renderBattle();
      await wait(700);
      const btn = document.getElementById('crChallenge');
      out.push('按钮文案=「' + (btn ? btn.textContent.trim() : '无') + '」');

      // ③ 连打 4 场（应该 4:0 晋级）
      for (let i = 1; i <= 4; i++) {
        switchTab('battle'); crView = 'sched'; renderBattle();
        await wait(400);
        const b = document.getElementById('crChallenge');
        if (!b) {
          const adv = document.getElementById('crAdv3');
          out.push('第' + i + '场：按钮变成=' +
            (adv ? '「' + adv.textContent.trim() + '」' : '无'));
          break;
        }
        b.click(); await wait(450);
        const go = document.getElementById('opGo');
        if (!go) { out.push('第' + i + '场：无开打按钮 ✗'); break; }
        go.click(); await wait(800);
        if (BT.phase !== 'live') { out.push('第' + i + '场：没开赛 ' + BT.phase); break; }
        out.push('第' + i + '场 对手=' + BT.aiTeam.name +
          ' isPlayoff=' + (BT.isPlayoffGame ? '✓' : '✗') +
          ' 轮次=' + BT.myRound);
        const sk = document.getElementById('btSkip');
        if (sk) sk.click();
        await wait(600);
        const inf = mySeriesInfo();
        out.push('  打完 → 系列赛 ' + (inf ? inf.myWins + ':' + inf.oppWins +
          (inf.done ? (inf.winner === SEASON.MY_KEY ? ' 晋级✓' : ' 被淘汰') : '') : '?'));
        if (inf && inf.done) break;
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'POMANUAL ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'POMANUAL-ERR ' + e.message; }
})();

/* 调试：?invariant=1 赛程不变量检查（每轮我最多出现一次） */
(function invTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('invariant')) return;
    setTimeout(() => {
      const out = [];
      const sch = seasonSchedule();
      let dup = 0, zero = 0, total = 0;
      const bad = [];
      sch.forEach((rd, i) => {
        let n = 0;
        rd.pairs.forEach((pr) => {
          if (pr[0] === SEASON.MY_KEY) n++;
          if (pr[1] === SEASON.MY_KEY) n++;
        });
        if (n > 1) { dup++; bad.push('第' + (i + 1) + '轮出现' + n + '次'); }
        if (n === 0) zero++;
        total += n;
      });
      out.push('总轮数=' + sch.length + ' 我出现总次数=' + total +
        '（应约 82）');
      out.push('我出现>1次的轮=' + dup + (dup ? ' ✗ ' + bad.slice(0, 3).join(' ') : ' ✓'));
      out.push('我轮空的轮=' + zero + '（应约 3）');
      // 每轮比赛数是否守恒（31 队 → 15 场 + 1 轮空）
      const badCnt = [];
      sch.forEach((rd, i) => {
        const teams = new Set();
        let overlap = 0;
        rd.pairs.forEach((pr) => {
          if (teams.has(pr[0]) || teams.has(pr[1])) overlap++;
          teams.add(pr[0]); teams.add(pr[1]);
        });
        if (overlap) badCnt.push('第' + (i + 1) + '轮重复' + overlap);
        if (rd.pairs.length !== 15) badCnt.push('第' + (i + 1) + '轮' + rd.pairs.length + '场');
      });
      out.push('每轮 15 场且无重复=' + (badCnt.length ? '✗ ' + badCnt.slice(0, 4).join(' ') : '✓'));
      // 我的总场次
      out.push('myFullSchedule 场次=' + myFullSchedule().length);
      out.push('我的联赛战绩=' + (function () {
        const me = myLeagueEntry(); return me.w + '胜' + me.l + '负';
      })());
      document.title = 'INV ' + out.join(' | ');
    }, 1200);
  } catch (e) { document.title = 'INV-ERR ' + e.message; }
})();

/* ---------- 调试：?pogate=1 季后赛资格门禁自检 ---------- */
(function poGateTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('pogate')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      // ① 常规赛阶段：点种子不能开打
      out.push('【常规赛阶段】phase=' + seasonState().phase);
      switchTab('battle'); crView = 'playoff'; renderBattle();
      await wait(700);
      let el = document.getElementById('scr-battle');
      const seeds = el.querySelectorAll('[data-opp]');
      out.push('种子格=' + seeds.length + ' 个');
      if (seeds.length) {
        seeds[0].click(); await wait(500);
        const ol = document.getElementById('oppLayer');
        const opened = ol && !ol.classList.contains('hidden');
        out.push('点种子 → 浮层=' + (opened ? '✓' : '✗'));
        const go = document.getElementById('opGo');
        const note = ol.querySelector('.op-viewnote');
        out.push('常规赛不能开打=' +
          (!go && note ? '✓ 提示「' + note.textContent.trim().slice(0, 14) + '…」' : '✗ 还能开打'));
        const c = ol.querySelector('.op-mask'); if (c) c.click();
        await wait(250);
      }
      // ② 打满常规赛 + 确保进季后赛
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 120) {
        if (seasonState().round >= 83) {
          const me = myLeagueEntry();
          me.w = Math.max(me.w, 62); me.l = Math.min(me.l, 18);
        }
        advanceSeason();
      }
      out.push('【季后赛阶段】phase=' + seasonState().phase);
      out.push('canPlayPlayoff=' +
        ((typeof canPlayPlayoff === 'function' && canPlayPlayoff()) ? '✓' : '✗'));
      // ③ 这时点我的系列赛才能开打
      switchTab('battle'); crView = 'playoff'; renderBattle();
      await wait(700);
      el = document.getElementById('scr-battle');
      const mine = el.querySelector('.bk-series.mine');
      out.push('我的系列赛=' + (mine ? '✓' : '✗'));
      if (mine) {
        mine.click(); await wait(600);
        const ol = document.getElementById('oppLayer');
        const go = document.getElementById('opGo');
        out.push('季后赛能开打=' + (go ? '✓ 有「开始比赛」按钮' : '✗'));
        if (go) {
          go.click(); await wait(900);
          out.push('  比赛=' + BT.phase + ' isPlayoff=' +
            (BT.isPlayoffGame ? '✓' : '✗'));
          const sk = document.getElementById('btSkip');
          if (sk) sk.click();
          await wait(700);
          const inf = mySeriesInfo();
          out.push('  扫荡后 系列赛=' + (inf ? inf.myWins + ':' + inf.oppWins : '?'));
        }
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'POGATE ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'POGATE-ERR ' + e.message; }
})();

/* ---------- 调试：?racetest=1 季后赛争夺实时性自检 ---------- */
(function raceTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('racetest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const snap = () => liveBracket().map((m) =>
      m.hi.seed + '.' + shortName(m.hi.name).slice(0, 2) + 'v' +
      m.lo.seed + '.' + shortName(m.lo.name).slice(0, 2)).join(' ');
    (async () => {
      await wait(1000);
      // ① 前 49 场：争夺未开始
      out.push('起始 我的场次=' + myGamesPlayed() + ' 争夺已开始=' +
        (playoffRaceStarted() ? '是' : '否') + ' 还差=' + gamesUntilRace() + ' 场');
      // 推进到 30 场
      let g = 0;
      while (myGamesPlayed() < 30 && g++ < 40) advanceSeason();
      out.push('打到 ' + myGamesPlayed() + ' 场 争夺已开始=' +
        (playoffRaceStarted() ? '是' : '否') + '（应"否"）');
      // 界面应显示锁定提示
      switchTab('battle'); crView = 'playoff'; renderBattle();
      await wait(600);
      let el = document.getElementById('scr-battle');
      out.push('30 场时界面=' + (el.querySelector('.rc-locked')
        ? '✓ 显示「还差 N 场」锁定提示' : '✗'));
      // ② 推进到 50 场
      let g2 = 0;
      while (myGamesPlayed() < PLAYOFF_RACE_FROM && g2++ < 40) advanceSeason();
      out.push('打到 ' + myGamesPlayed() + ' 场 争夺已开始=' +
        (playoffRaceStarted() ? '是' : '否') + '（应"是"）');
      renderBattle(); await wait(600);
      el = document.getElementById('scr-battle');
      out.push('50 场时界面=' + (el.querySelector('.rc-bracket')
        ? '✓ 显示实时对阵' : '✗'));
      out.push('对阵组数=' + el.querySelectorAll('.rc-series').length + '（应 8）');
      const s1 = snap();
      out.push('对阵快照1：' + s1);
      // ③ 再推进 8 轮，看对阵是否随战绩变化
      for (let i = 0; i < 8; i++) advanceSeason();
      out.push('再打 8 轮 我的场次=' + myGamesPlayed());
      const s2 = snap();
      out.push('对阵快照2：' + s2);
      out.push('对阵实时变化=' + (s1 !== s2 ? '✓ 变了' : '⚠ 没变（可能战绩未变）'));
      // ④ 排名表与晋级线
      renderBattle(); await wait(500);
      el = document.getElementById('scr-battle');
      const rows = el.querySelectorAll('.rc-row');
      const inRows = el.querySelectorAll('.rc-row.in');
      out.push('排名表行数=' + rows.length + '（东西各15=30）');
      out.push('晋级区标记=' + inRows.length + ' 行（应为 16）');
      out.push('第9名cut线标记=' + el.querySelectorAll('.rc-row.cut').length + ' 行');
      // ⑤ 排名是否严格按战绩
      const t1 = liveConfTable('西');
      let ok = true;
      for (let i = 1; i < t1.length; i++) {
        if ((t1[i].w - t1[i].l) > (t1[i - 1].w - t1[i - 1].l)) ok = false;
      }
      out.push('西部按战绩排序=' + (ok ? '✓' : '✗'));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'RACE ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'RACE-ERR ' + e.message; }
})();

/* ---------- 调试：?cycletest=1 赛季轮回自检 ---------- */
(function cycleTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('cycletest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      const L = seasonState();
      out.push('起始 年份=' + L.year + ' 轮次=' + cycleOf());
      // 记下一些"资产"，验证轮回后保留
      const coins0 = S.coins;
      const owned0 = Object.keys(S.owned).length;
      const brk0 = CARDS.filter((c) => (S.owned[c.id] || {}).brk).length;
      out.push('轮回前 金币=' + coins0 + ' 收藏=' + owned0 + ' 张 有突破的=' + brk0);

      // 直接跳到最后一季
      L.year = SEASON.END_YEAR;
      L.season = 31;
      L.phase = 'done';
      L.playoff = { round: 3, series: [], seeds: {}, champion: SEASON.MY_KEY };
      L.history = [{ year: 2056, champion: SEASON.MY_KEY, myW: 60, myL: 22 }];
      save && save();
      out.push('设到 ' + L.year + ' 赛季结束 canStartNewCycle=' +
        (canStartNewCycle() ? '✓' : '✗'));

      // 生涯页按钮文案
      switchTab('battle'); renderBattle(); await wait(500);
      const el = document.getElementById('scr-battle');
      const adv = el.querySelector('#crAdv');
      out.push('按钮文案=「' + (adv ? adv.textContent.trim() : '无') + '」');

      // 点它 → 应该回到 2026
      if (adv) adv.click();
      await wait(700);
      const L2 = seasonState();
      out.push('点击后 年份=' + L2.year + ' 轮次=' + cycleOf() +
        ' 阶段=' + L2.phase + ' 轮次号=' + L2.round);
      out.push('回到 2026=' + (L2.year === SEASON.START_YEAR ? '✓' : '✗'));
      out.push('进入新一轮=' + (cycleOf() === 2 ? '✓ 第2轮' : '✗ ' + cycleOf()));
      // 资产保留？
      out.push('金币保留=' + (S.coins >= coins0 ? '✓ ' + S.coins : '✗'));
      out.push('收藏保留=' +
        (Object.keys(S.owned).length >= owned0 ? '✓ ' +
          Object.keys(S.owned).length + ' 张' : '✗'));
      out.push('历史保留=' + (L2.history.length + ' 条'));
      out.push('轮回记录=' + ((L2.cycleHistory || []).length) + ' 条');
      out.push('新赛程已生成=' +
        (L2.schedule && L2.schedule.length === 85 ? '✓ 85 轮' : '✗'));
      out.push('我的赛程已清空=' + ((L2.mySched || []).length === 0 ? '✓' : '✗'));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'CYCLE ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'CYCLE-ERR ' + e.message; }
})();

/* ---------- 调试：?raceline=1 50场实时→82场锁定 全链路 ---------- */
(function raceLine() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('raceline')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const sig = () => liveBracket().map((m) =>
      m.hi.seed + shortName(m.hi.name) + '/' + m.lo.seed +
      shortName(m.lo.name)).join(' ');
    const sigShort = () => liveBracket().map((m) =>
      m.hi.seed + shortName(m.hi.name).slice(0, 2) + 'v' +
      m.lo.seed + shortName(m.lo.name).slice(0, 2)).join(' ');
    (async () => {
      await wait(1000);
      // 推进到第 49 场
      let g = 0;
      while (myGamesPlayed() < PLAYOFF_RACE_FROM - 1 && playoffsNotYet() && g++ < 60) advanceSeason();
      out.push('第 ' + myGamesPlayed() + ' 场：争夺=' +
        (playoffRaceStarted() ? '已开始' : '未开始（应未开始）') +
        ' 还差 ' + gamesUntilRace() + ' 场');
      // 第 50 场
      while (myGamesPlayed() < PLAYOFF_RACE_FROM && playoffsNotYet() && g++ < 60) advanceSeason();
      out.push('第 ' + myGamesPlayed() + ' 场：争夺=' +
        (playoffRaceStarted() ? '已开始 ✓' : '未开始 ✗'));
      const s50 = sigShort();
      out.push('  50 场对阵：' + s50);
      // 逐轮记录对阵变化次数
      let changes = 0, prev = s50, rounds = 0;
      while (seasonState().phase === 'regular' && g++ < 200) {
        advanceSeason(); rounds++;
        const cur = sigShort();
        if (cur !== prev) { changes++; prev = cur; }
      }
      out.push('50→82 场之间推进 ' + rounds + ' 轮，对阵变化 ' + changes +
        ' 次' + (changes > 0 ? ' ✓实时更新' : ' ✗没更新'));
      out.push('  82 场对阵：' + prev);
      // 现在应该已经进季后赛
      const L = seasonState();
      out.push('82 场后 阶段=' + L.phase + '（应为 playoff）');
      // 82 场锁定后的正式种子 vs 50 场实时预测，是否同一套规则
      const po = L.playoff;
      if (po) {
        const official = ['东', '西'].flatMap((c) => {
          const r1 = po.series.filter((x) => x.round === 0 && x.conf === c);
          return r1.sort((a, b) => (a.hiSeed || 0) - (b.hiSeed || 0)).map((x) =>
            (x.hiSeed || '?') + 'v' + (x.loSeed || '?'));
        });
        out.push('正式首轮配对（东西各4组）：' + official.join(' '));
        // 每组的 hi 战绩应不差于 lo
        let ok = true;
        po.series.filter((x) => x.round === 0).forEach((s) => {
          const h = oppBrief(s.hi), l2 = oppBrief(s.lo);
          if ((h.w - h.l) < (l2.w - l2.l)) ok = false;
        });
        out.push('每组主场方战绩更好=' + (ok ? '✓' : '✗'));
        // 我的种子 vs 排名
        const myConf = (S.myConf || '西');
        out.push('我的分区=' + myConf + ' 排名=' + myConfRank() +
          ' 进季后赛=' + (po.mineIn ? '✓' : '否'));
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'RACELINE ' + out.join(' | ');
    })();
    function playoffsNotYet() { return seasonState().phase === 'regular'; }
  } catch (e) { document.title = 'RACELINE-ERR ' + e.message; }
})();

/* ---------- 调试：?markettest=1 转会市场自检 ---------- */
(function marketTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('markettest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      switchTab('market');
      await wait(900);
      const el = document.getElementById('scr-market');
      out.push('转会页激活=' +
        (el && el.classList.contains('active') ? '✓' : '✗'));
      const body = document.getElementById('mk-body');
      out.push('内容容器=' + (body ? '✓ #mk-body' : '✗ 不存在'));
      if (!body) {
        const raw = el ? el.innerHTML : '';
        out.push('scr-market 内容前 200 字=' +
          raw.slice(0, 200).replace(/</g, '(').replace(/\n/g, ' '));
        out.push('scr-market 长度=' + raw.length);
        out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无'));
        document.title = 'MARKET ' + out.join(' | '); return;
      }
      out.push('内容长度=' + body.textContent.length + ' 字');
      // 市场卡片
      const cards = body.querySelectorAll('.lg-mk-card, .lg-mk, .mk-card, [data-buy]');
      out.push('市场卡片元素=' + cards.length + ' 个');
      // 找"买入"按钮
      const buyBtns = body.querySelectorAll('.lg-buy');
      out.push('买入按钮(.lg-buy)=' + buyBtns.length + ' 个');
      out.push('市场卡片(.lg-mk-card)=' +
        body.querySelectorAll('.lg-mk-card').length + ' 个');
      out.push('模式切换按钮=' +
        body.querySelectorAll('[data-lgmks]').length + ' 个');
      // 一键清仓
      const bulkBtns = Array.prototype.filter.call(
        body.querySelectorAll('button'), (b) => /清仓|一键/.test(b.textContent));
      out.push('一键清仓按钮=' + bulkBtns.length + ' 个');

      // 真的买一个试试
      if (buyBtns.length) {
        const c0 = S.coins, o0 = Object.keys(S.owned).length;
        buyBtns[0].click();
        await wait(700);
        // 现在应该弹出游戏内确认框（不再是原生 confirm）
        const cfm = document.getElementById('cfmLayer');
        const openC = cfm && !cfm.classList.contains('hidden');
        out.push('确认框弹出=' + (openC ? '✓' : '✗'));
        out.push('确认框标题=' + (openC && cfm.querySelector('.cfm-title')
          ? cfm.querySelector('.cfm-title').textContent : '?'));
        if (openC) {
          cfm.querySelector('#cfmYes').click();
          await wait(900);
        }
        const c1 = S.coins, o1 = Object.keys(S.owned).length;
        out.push('点击买入：金币 ' + c0 + '→' + c1 +
          ' 收藏 ' + o0 + '→' + o1 +
          (c1 !== c0 ? ' ✓交易成功' : ' ⚠金币没变'));
        out.push('  买入后市场内容长度=' +
          (document.getElementById('mk-body') || {}).textContent.length);
      } else {
        out.push('⚠ 没找到买入按钮，列出按钮文案：' +
          Array.prototype.slice.call(body.querySelectorAll('button'), 0, 6)
            .map((b) => b.textContent.trim().slice(0, 8)).join('/'));
      }
      // 切走再切回，看是否还在
      switchTab('battle'); await wait(400);
      switchTab('market'); await wait(700);
      out.push('切走再切回=' +
        (document.getElementById('mk-body') ? '✓ 正常' : '✗ 丢了'));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'MARKET ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'MARKET-ERR ' + e.message; }
})();

/* ---------- 调试：?devtest=1 动态身价与成长自检 ---------- */
(function devTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('devtest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      out.push('评估间隔=' + DEV_INTERVAL + ' 场  单项单次±' + DEV_ATTR_STEP +
        '  单项赛季上限±' + DEV_ATTR_CAP);
      // ① 基线身价
      const c = CARDS.filter((x) => x.tier === 'purple')
        .sort((a, b) => b.ovr - a.ovr)[0];
      const p0 = marketPrice(c);
      out.push('样例球员 ' + c.name + ' 综合' + c.ovr + ' 基础身价 ' + p0);
      // ② 需求影响
      bumpDemand(c.id, 8);
      const p1 = marketPrice(c);
      out.push('买 8 次后身价 ' + p1 + '（+' +
        ((p1 / p0 - 1) * 100).toFixed(1) + '%）' +
        (p1 > p0 ? ' ✓涨价' : ' ✗没变'));
      // ③ 需求衰减
      decayDemand(); decayDemand();
      const p2 = marketPrice(c);
      out.push('衰减 2 次后 ' + p2 + (p2 < p1 ? ' ✓回落' : ' ⚠'));
      // ④ 推进 55 场，看成长是否发生
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 60) advanceSeason();
      const dev = devState();
      const ids = Object.keys(dev);
      out.push('推进 ' + g + ' 轮后，有变化的球员=' + ids.length + ' 名');
      // 幅度检查
      let maxUp = 0, maxDown = 0, over = 0;
      ids.forEach((id) => {
        const a = dev[id].adj || {};
        Object.keys(a).forEach((k) => {
          if (a[k] > maxUp) maxUp = a[k];
          if (a[k] < maxDown) maxDown = a[k];
          if (Math.abs(a[k]) > DEV_ATTR_CAP) over++;
        });
      });
      out.push('单项最大上调=+' + maxUp + ' 最大下调=' + maxDown +
        ' 超上限的=' + over + (over === 0 ? ' ✓幅度合理' : ' ✗'));
      // 抽样 3 人
      ids.slice(0, 3).forEach((id) => {
        const cc = CARD_BY_ID[id];
        if (!cc) return;
        const a = dev[id].adj || {};
        out.push('  ' + cc.name + ' 综合' + cc.ovr + '→' + effectiveOvr(cc) +
          ' 调整=' + Object.keys(a).map((k) => k + (a[k] > 0 ? '+' : '') + a[k])
            .join(','));
      });
      // ⑤ 表现系数
      const someId = ids[0];
      if (someId) {
        const cc = CARD_BY_ID[someId];
        out.push('表现系数样例 ' + cc.name + '=' +
          perfMul(someId, cc.teamKey).toFixed(3) +
          ' 现在身价=' + marketPrice(cc));
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'DEV ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'DEV-ERR ' + e.message; }
})();

/* ---------- 调试：?devview=1 转会市场能力变动视图 ---------- */
(function devView() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('devview')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@STACK@@ ' + ((e.error && e.error.stack) ? e.error.stack.split('\n').slice(0,5).join(' >> ') : 'no-stack')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      // 空状态
      switchTab('market'); await wait(700);
      let el = document.getElementById('mk-body');
      const tabs = el.querySelectorAll('[data-lgmks]');
      out.push('市场模式按钮=' + tabs.length + ' 个（应 3：买入/出售/能力变动）');
      out.push('  文案：' + Array.prototype.map.call(tabs, (b) =>
        b.textContent.trim().replace(/\s+/g, '').slice(0, 8)).join(' / '));
      const devTab = el.querySelector('[data-lgmks="dev"]');
      if (devTab) { devTab.click(); await wait(500); }
      el = document.getElementById('mk-body');
      out.push('空状态提示=' +
        (el.querySelector('.dv-empty') ? '✓' : '✗'));
      out.push('  当前内容前 120 字=' +
        el.textContent.trim().slice(0, 120).replace(/\s+/g, ' '));
      out.push('  lgMarketMode=' + lgMarketMode + ' lgTab=' + lgTab);
      out.push('  devLog=' + ((seasonState().devLog || []).length) + ' 条');

      // 推进 30 场产生变动
      let g = 0;
      while (seasonState().phase === 'regular' && g++ < 35) advanceSeason();
      const log = seasonState().devLog || [];
      out.push('推进 ' + g + ' 轮 → 变动记录 ' + log.length + ' 条');
      const ups = log.filter((x) => x.up).length;
      out.push('  上升 ' + ups + ' 条 / 下滑 ' + (log.length - ups) + ' 条' +
        (ups > 0 && ups < log.length ? ' ✓有升有降' : ''));

      // 再看视图
      switchTab('market'); await wait(600);
      el = document.getElementById('mk-body');
      const t2 = el.querySelector('[data-lgmks="dev"]');
      if (t2) { t2.click(); await wait(600); }
      el = document.getElementById('mk-body');
      const cards = el.querySelectorAll('.dv-card');
      out.push('变动卡片=' + cards.length + ' 张');
      out.push('分组数=' + el.querySelectorAll('.dv-group').length);
      const plusEls = el.querySelectorAll('.dv-changes .plus');
      const minusEls = el.querySelectorAll('.dv-changes .minus');
      out.push('属性 + 标记=' + plusEls.length + ' 个   − 标记=' +
        minusEls.length + ' 个' +
        (plusEls.length || minusEls.length ? ' ✓' : ' ✗'));
      out.push('综合变化标记=' + el.querySelectorAll('.dv-ovr em').length + ' 个');
      out.push('累计栏=' + el.querySelectorAll('.dv-cum').length + ' 个');
      // 身价相关
      const prEls = el.querySelectorAll('.dv-price');
      out.push('身价变动条=' + prEls.length + ' 个' +
        (prEls.length ? ' ✓' : ' ✗'));
      out.push('  身价涨=' + el.querySelectorAll('.dv-price.plus').length +
        ' 跌=' + el.querySelectorAll('.dv-price.minus').length);
      out.push('涨跌榜=' + el.querySelectorAll('.dv-rank').length + ' 个' +
        (el.querySelectorAll('.dv-rank').length ? ' ✓' : ' ✗'));
      out.push('榜单 chip=' + el.querySelectorAll('.dv-chip').length + ' 个');
      if (prEls.length) {
        out.push('身价样例：' + prEls[0].textContent.replace(/\s+/g, ' ').trim());
      }
      // 日志里有多少条带身价
      const wl = (seasonState().devLog || []);
      out.push('日志中带身价的=' + wl.filter((x) => x.price).length + '/' + wl.length);
      out.push('纯身价变动条目(属性没动)=' +
        wl.filter((x) => x.priceOnly).length + ' 条');
      // 样例
      const c0 = cards[0];
      if (c0) {
        out.push('样例：' + (c0.querySelector('.dv-nm') || {}).textContent +
          ' 综合' + (c0.querySelector('.dv-ovr') || {}).textContent
            .replace(/\s+/g, '') +
          ' 变化[' + Array.prototype.map.call(
            c0.querySelectorAll('.dv-changes span'), (x) => x.textContent.trim())
            .join(' ') + ']');
      }
      // 点卡面能否开详情
      if (c0) {
        const face = c0.querySelector('.dv-face');
        if (face) {
          face.click(); await wait(600);
          const dl = document.getElementById('detailLayer');
          out.push('点卡面开详情=' +
            (dl && !dl.classList.contains('hidden') ? '✓' : '✗'));
        }
      }
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'DEVVIEW ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'DEVVIEW-ERR ' + e.message; }
})();

/* ---------- 调试：?effecttest=1 变动是否真的影响比赛 ---------- */
(function effectTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('effecttest')) return;
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      // 找一名 AI 球员，手动给它一个大幅调整，看属性/比赛是否跟着变
      const id = anyTeamRoster(NBA_TEAMS[0].key)[0];
      const card = CARD_BY_ID[id];
      out.push('测试球员：' + card.name + '（' + NBA_TEAMS[0].name + '）');
      const before = statsOf(card, 0);
      out.push('调整前 综合=' + before.ovr + ' 三分=' + before.attrs.three +
        ' 篮板=' + before.attrs.dreb);

      // ① 直接写一个 +3 的成长
      const dev = devState();
      dev[id] = { adj: { three: 3, mid: 3, dreb: 3 }, badges: 0, last: 1 };
      const after = statsOf(card, 0);
      out.push('调整后 综合=' + after.ovr + ' 三分=' + after.attrs.three +
        ' 篮板=' + after.attrs.dreb);
      out.push('属性生效=' + (after.attrs.three === before.attrs.three + 3
        ? '✓ 三分 +3' : '✗'));
      out.push('综合生效=' + (after.ovr > before.ovr ? '✓ +' +
        (after.ovr - before.ovr) : '✗'));

      // ② 建队时是否用上了
      const p1 = mkPlayer ? null : null;
      switchTab('battle');
      await wait(400);
      BT.oppTeam = NBA_TEAMS[0].key;
      startBattle('live', NBA_TEAMS[0].key);
      await wait(500);
      const foe = BT.aiTeam.players.filter((x) => x.id === id)[0];
      if (foe) {
        const expect = card.attrs.three + 3 + (foe.brk || 0) * BREAK.attr;
        out.push('比赛里的他 三分=' + foe.attrs.three +
          '（原始 ' + card.attrs.three + ' + 突破' + (foe.brk || 0) +
          '×4 + 成长3 = ' + expect + '）' +
          (foe.attrs.three === expect ? ' ✓成长已影响比赛' : ' ✗没影响'));
      } else {
        out.push('他不在首发，检查替补=' +
          (BT.aiTeam.bench.filter((x) => x.id === id).length ? '在替补 ✓' : '不在'));
      }

      // ③ 徽章变动是否影响
      const bs0 = badgesOf(card, 0).length;
      out.push('原始徽章数=' + bs0);
      // 给一个"金徽章"级别的调整看是否有变化
      dev[id] = { adj: {}, badges: 3, last: 1 };
      const bs1 = badgesOf(card, 0).length;
      out.push('徽章调整后=' + bs1 + '（devBadge=3）');

      // ④ 复原
      delete devState()[id];
      out.push('复原后 综合=' + statsOf(card, 0).ovr);
      document.title = 'EFFECT ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'EFFECT-ERR ' + e.message; }
})();

/* ---------- 调试：?playdev=1 手动打 10 场是否触发能力变动 ---------- */
(function playDevTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('playdev')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message + ' @@ ' +
      ((e.error && e.error.stack) ? e.error.stack.split('\n')[1] : '')));
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1000);
      out.push('开打前 devLog=' + ((seasonState().devLog || []).length) +
        ' 条 / 我的场次=' + myGamesPlayed() +
        ' / 距下次评估=' + gamesUntilDev() + ' 场');
      // 手动打 11 场（每场都走"挑战→开打→扫荡"，不点推进按钮）
      for (let i = 1; i <= 22; i++) {
        switchTab('battle');
        if (BT.phase === 'live') { const s0 = document.getElementById('btSkip');
          if (s0) s0.click(); await wait(700); }
        if (BT.phase === 'done') { const a0 = document.getElementById('btAgain');
          if (a0) a0.click(); await wait(500); }
        crView = 'sched'; renderBattle();
        await wait(350);
        const ch = document.getElementById('crChallenge')
          || document.getElementById('crAdv3');
        if (!ch) { out.push('第' + i + '场：无挑战按钮 phase=' + BT.phase); break; }
        ch.click(); await wait(400);
        const go = document.getElementById('opGo');
        if (!go) { out.push('第' + i + '场：无开打按钮'); break; }
        go.click(); await wait(700);
        const sk = document.getElementById('btSkip');
        if (sk) sk.click();
        await wait(700);
      }
      const L = seasonState();
      out.push('打完 ' + myGamesPlayed() + ' 场 / 联赛轮次=' + L.round +
        ' / lastDevGame=' + (L.lastDevGame || 0) +
        ' / 距下次评估=' + gamesUntilDev() + ' 场');
      const log = L.devLog || [];
      out.push('devLog=' + log.length + ' 条' +
        (log.length ? ' ✓ 手动打也会触发成长' : ' ✗ 还是没触发'));
      const ups = log.filter((x) => x.price && x.price.delta > 0).length;
      const dns = log.filter((x) => x.price && x.price.delta < 0).length;
      out.push('  身价 ▲' + ups + ' / ▼' + dns);
      const rounds2 = {};
      log.forEach((x) => { rounds2[x.round] = (rounds2[x.round] || 0) + 1; });
      out.push('  评估轮次: ' + Object.keys(rounds2).sort((a2,b2)=>a2-b2)
        .map((k) => '第' + k + '轮×' + rounds2[k]).join(' '));
      const lastRd = Math.max.apply(null, Object.keys(rounds2).map(Number));
      const lastLog = log.filter((x) => x.round === lastRd);
      const chg = lastLog.filter((x) => (x.price && x.price.delta) ||
        (x.detail && Object.keys(x.detail).length));
      out.push('  最近一次(第' + lastRd + '轮)有变动=' + chg.length + '/' +
        lastLog.length + ' 名');
      const cAttr = lastLog.filter((x) => x.detail && Object.keys(x.detail).length).length;
      out.push('  其中属性变动=' + cAttr + ' 名');
      // 打开能力变动页看渲染
      switchTab('market'); await wait(600);
      const el = document.getElementById('mk-body');
      const t = el.querySelector('[data-lgmks="dev"]');
      if (t) { t.click(); await wait(600); }
      const b = document.getElementById('mk-body');
      out.push('能力变动卡=' + b.querySelectorAll('.dv-card').length + ' 张');
      out.push('▲ 图标=' + (b.textContent.match(/▲/g) || []).length +
        ' 个   ▼ 图标=' + (b.textContent.match(/▼/g) || []).length + ' 个');
      out.push('  属性 ▲=' + b.querySelectorAll('.dv-changes .plus').length +
        ' ▼=' + b.querySelectorAll('.dv-changes .minus').length);
      out.push('  身价 ▲=' + b.querySelectorAll('.dv-price.plus').length +
        ' ▼=' + b.querySelectorAll('.dv-price.minus').length);
      const c0 = b.querySelector('.dv-card');
      if (c0) out.push('样例：' + c0.textContent.replace(/\s+/g, ' ')
        .trim().slice(0, 78));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'PLAYDEV ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'PLAYDEV-ERR ' + e.message; }
})();

/* ---------- 调试：?advdev=1 用「模拟本轮」推进 22 轮 ---------- */
(function advDevTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('advdev')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const out = [];
    setTimeout(() => {
      out.push('推进前 我的场次=' + myGamesPlayed() + ' 距下次评估=' +
        gamesUntilDev() + ' 场');
      let g = 0;
      while (myGamesPlayed() < 22 && g++ < 30) advanceSeason();
      const L = seasonState();
      out.push('推进 ' + g + ' 次 → 我的场次=' + myGamesPlayed() +
        ' lastDevGame=' + (L.lastDevGame || 0) + ' 距下次=' +
        gamesUntilDev() + ' 场');
      const log = L.devLog || [];
      out.push('devLog=' + log.length + ' 条' +
        (log.length ? ' ✓ 推进也会触发' : ' ✗ 没触发'));
      const rounds2 = {};
      log.forEach((x) => { rounds2[x.round] = (rounds2[x.round] || 0) + 1; });
      out.push('  评估轮次: ' + Object.keys(rounds2).sort((a2,b2)=>a2-b2)
        .map((k) => '第' + k + '轮×' + rounds2[k]).join(' '));
      const chg = log.filter((x) => (x.price && x.price.delta) ||
        (x.detail && Object.keys(x.detail).length)).length;
      out.push('  有变动的记录=' + chg + ' 条');
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'ADVDEV ' + out.join(' | ');
    }, 1000);
  } catch (e) { document.title = 'ADVDEV-ERR ' + e.message; }
})();

/* ---------- 调试：?allprice=1 每10场全员身价是否都变 ---------- */
(function allPriceTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('allprice')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const out = [];
    setTimeout(() => {
      const L = seasonState();
      // 推进到 20 场，产生两次评估
      let g = 0;
      while (myGamesPlayed() < 20 && g++ < 30) advanceSeason();
      out.push('我的场次=' + myGamesPlayed() + ' lastDevGame=' +
        (L.lastDevGame || 0));
      const log = L.devLog || [];
      const rd20 = log.filter((x) => x.round === 20);
      out.push('第20轮评估记录=' + rd20.length + ' 条');
      const moved = rd20.filter((x) => x.price && x.price.delta !== 0);
      const flat = rd20.filter((x) => x.price && x.price.delta === 0);
      out.push('  身价有变化=' + moved.length + ' / 持平=' + flat.length);
      out.push('  表现平稳不动=' + (flat.length > 0
        ? '✓ ' + flat.length + ' 人身价不变（符合预期）' : '（本轮全部有变动）'));
      const up = moved.filter((x) => x.price.delta > 0).length;
      out.push('  涨=' + up + ' 跌=' + (moved.length - up));
      // 幅度检查
      let minP = 99, maxP = -99;
      moved.forEach((x) => {
        if (x.price.pct < minP) minP = x.price.pct;
        if (x.price.pct > maxP) maxP = x.price.pct;
      });
      out.push('  变动幅度 ' + minP + '% ~ ' + maxP + '%' +
        (Math.abs(minP) <= 20 && Math.abs(maxP) <= 20 ? ' ✓在 ±20% 内' : ' ⚠偏大'));

      // 跨赛季验证：跳到 2056 再测
      L.year = SEASON.END_YEAR - 1;
      L.phase = 'done';
      try { startNewSeason(); } catch (e) {}
      L.lastDevGame = 0; L.mySched = []; L.devLog = [];
      L.priceSnap = {};
      let g2 = 0;
      while (myGamesPlayed() < 20 && g2++ < 30) advanceSeason();
      const log2 = (seasonState().devLog || []).filter((x) => x.round === 20);
      const mv2 = log2.filter((x) => x.price && x.price.delta !== 0);
      const fl2 = log2.filter((x) => x.price && x.price.delta === 0);
      out.push('2056 赛季第20轮：有变化=' + mv2.length + ' 持平=' + fl2.length +
        '（与 2026 同一套机制 ' + (log2.length === log.length ? '✓' :
          '（记录数 ' + log2.length + ' vs ' + log.length + '）') + '）');
      // 评估体系诊断
      try {
        const bl = leagueBaseline();
        const gk = Object.keys(bl);
        out.push('基准分组=' + gk.length + ' 组：' + gk.join(','));
        if (gk.length) {
          const k0 = gk[0];
          out.push('  ' + k0 + ' 指标=' + Object.keys(bl[k0]).join(','));
          const m0 = Object.keys(bl[k0])[0];
          out.push('  ' + k0 + '.' + m0 + ' 均值=' +
            bl[k0][m0].mean.toFixed(2) + ' sd=' + bl[k0][m0].sd.toFixed(3) +
            ' 样本=' + bl[k0][m0].n);
        }
        const roster0 = anyTeamRoster(NBA_TEAMS[0].key);
        out.push('球队0阵容=' + roster0.length + ' 人');
        const ln0 = seasonLineOf(roster0[0], NBA_TEAMS[0].key);
        out.push('  首人数据=' + (ln0 ? 'g=' + ln0.g + ' ppg=' +
          ln0.ppg.toFixed(1) : '无'));
        const ev0 = evaluatePlayer(roster0[0], NBA_TEAMS[0].key, bl);
        out.push('  评估=' + (ev0 ? 'SCORE=' + ev0.score + ' 判定=' +
          ev0.verdict + ' 指标数=' + ev0.rows.length : 'null ✗'));
      } catch (e) {
        out.push('评估异常=' + e.message);
      }
      out.push('runDevelopment 错误=' + (window.__devErr || '无'));
      out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
      document.title = 'ALLPRICE ' + out.join(' | ');
    }, 1000);
  } catch (e) { document.title = 'ALLPRICE-ERR ' + e.message; }
})();

/* ---------- 调试：?resettest=1 当季重置自检 ---------- */
(function resetTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('resettest')) return;
    const out = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1200);
      switchTab('battle');
      await wait(900);
      const L = seasonState();
      // 先制造一些进度
      const before = {
        year: L.year, round: L.round,
        cards: Object.keys(S.owned || {}).length,
        coins: S.coins,
        myW: myLeagueEntry().w,
      };
      L.round = 37;
      L.phase = 'playoff';
      L.awards = [{ d: 1, kind: 'x', title: 't' }];
      myLeagueEntry().w = 25; myLeagueEntry().l = 12;
      const t0 = NBA_TEAMS[0].key;
      if (L.teams[t0]) { L.teams[t0].w = 30; L.teams[t0].l = 10; }
      out.push('造假进度: round=37 phase=playoff 我 25胜12负');

      // 调用重置
      const r = resetSeasonCareer();
      await wait(300);
      const A = seasonState();
      out.push('重置后: year=' + A.year + ' round=' + A.round +
        ' phase=' + A.phase);
      out.push('  年份保持=' + (A.year === before.year ? '✓' : '✗'));
      out.push('  轮次归零=' + (A.round === 1 ? '✓' : '✗'));
      out.push('  回到常规赛=' + (A.phase === 'regular' ? '✓' : '✗'));
      out.push('  我的战绩清零=' + (myLeagueEntry().w === 0 &&
        myLeagueEntry().l === 0 ? '✓' : '✗'));
      out.push('  全联盟战绩清零=' + (A.teams[t0].w === 0 &&
        A.teams[t0].l === 0 ? '✓' : '✗'));
      out.push('  奖项已清=' + (A.awards.length === 0 ? '✓' : '✗'));
      out.push('  季后赛已清=' + (A.playoff === null ? '✓' : '✗'));
      out.push('  赛程已重生成=' + (A.schedule && A.schedule.length
        ? '✓ ' + A.schedule.length + ' 轮' : '✗'));
      out.push('  我的赛程记录已清=' + ((A.mySched || []).length === 0 ? '✓' : '✗'));
      // 关键：球员没被删
      const after = {
        cards: Object.keys(S.owned || {}).length,
        coins: S.coins,
      };
      out.push('★ 球员收藏=' + before.cards + '→' + after.cards +
        (after.cards === before.cards ? ' ✓未删' : ' ✗被删了'));
      out.push('★ 金币=' + before.coins + '→' + after.coins +
        (after.coins === before.coins ? ' ✓未动' : ' ✗变了'));
      out.push('★ AI 球队球员=' + (A.teams[t0].roster || []).length + ' 人' +
        ((A.teams[t0].roster || []).length > 0 ? ' ✓保留' : ' ✗空了'));
      // 按钮：直接检查 careerTopHTML 的输出（空存档时生涯页不渲染完整界面）
      const html = (typeof careerTopHTML === 'function') ? careerTopHTML() : '';
      out.push('顶栏含重置按钮=' + (html.indexOf('crReset') >= 0
        ? '✓「🔄 当季重置」' : '✗'));
      out.push('顶栏含赛季切换=' + (html.indexOf('crAdv') >= 0 ? '✓' : '✗'));
      // 塞几张卡再渲染一次页面，确认按钮真的出现
      try {
        if (Object.keys(S.owned || {}).length === 0) {
          CARDS.slice(0, 20).forEach((c) => { S.owned[c.id] = { dup: 0, brk: 0, got: 1 }; });
          S.roster = null;
          if (typeof renderCareer === 'function') renderCareer();
          const b2 = document.getElementById('crReset');
          out.push('补卡后实际渲染=' + (b2 ? '✓ 按钮存在' : '✗'));
          if (b2) out.push('  按钮文字=' + b2.textContent.trim());
        }
      } catch (e) { out.push('渲染测试失败: ' + e.message); }
      document.title = 'RESET ' + out.join(' | ');
    })();
  } catch (e) { document.title = 'RESET-ERR ' + e.message; }
})();
