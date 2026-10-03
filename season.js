'use strict';
/* =============================================================
   赛季系统：82 场常规赛 + 奖项 + 季后赛淘汰赛
   -------------------------------------------------------------
   · 常规赛 82 轮，30 支 NBA 球队 + 玩家球队（"我的球队"）一起打
     31 队是奇数，每轮有一队轮空，轮空权轮流分配，
     所以每队实际打 79~80 场（真实 NBA 是 82 场，这里结构一致）
   · 每场比赛会给双方球员生成数据，累计成赛季数据
   · 奖项：周最佳 / 月最佳 / MVP / DPOY / 最佳第六人 /
           最快进步 / 最佳教练 / 最佳阵容 / 最佳防守阵容 / 五项数据王
   · 季后赛：东西部各取前 8，四轮全部 7 战 4 胜淘汰赛
   · 奖励：进季后赛 / 过首轮 / 过分区半决赛 / 过分区决赛 / 总冠军
   ============================================================= */

const SEASON = {
  START_YEAR: 2026,       // 从 2026-27 赛季开始
  END_YEAR: 2056,         // 打到 2055-56 赛季（共 30 个赛季）
  ROUNDS: 85,             // 常规赛轮数（决定赛程长度）
  GAMES: 82,              // 每队实际场次 —— 见下面 buildByeSchedule 的算法
  ROUNDS_UI: 82,          // 界面显示用（"82 场常规赛"）
  PLAYOFF_SEEDS: 8,       // 每区前几名进季后赛
  SERIES_WINS: 4,         // 7 战 4 胜
  WEEK: 7,                // 几天算一周
  MONTH: 15,              // 几天算一个月
  MY_KEY: 'mine',         // 玩家球队在联赛里的 key
};

/** 季后赛每轮奖励（玩家球队）。AI 球队只拿 1/4，避免经济膨胀 */
const PLAYOFF_REWARD = {
  make: 5000,             // 进季后赛
  r1: 10000,               // 过首轮
  semi: 20000,             // 过分区半决赛
  conf: 37500,            // 过分区决赛（进总决赛）
  champ: 75000,           // 总冠军
  gameWin: 880,           // 季后赛每赢一场
  mvp: 7500, dpoy: 3750, sixth: 3000, mip: 3000, coy: 3750,
};
const ROUND_NAME = ['首轮', '分区半决赛', '分区决赛', '总决赛'];
const ROUND_KEY = ['r1', 'semi', 'conf', 'champ'];

/* =============================================================
   自动模拟比赛的分红比例（v9.27）
   -------------------------------------------------------------
   玩家不亲自打的联赛场次会自动模拟，只发一部分奖金当"分红"。
   必须保证：**亲手打的收益永远高于自动模拟**，否则玩家会理性地
   什么都不做、让球队自动输球（输球分红一度高达 45%，比手动输球的
   34% 还多）。现在赢 32% / 输 22%，方向正确。
   ============================================================= */
const AUTO_SIM_WIN_RATE = 0.32;    // 自动模拟赢球 → 拿 32%
const AUTO_SIM_LOSE_RATE = 0.22;   // 自动模拟输球 → 只拿 22%（低于手动输球的 34%）

/**
 * 轮空表：让每队**正好打 82 场**。
 * ---------------------------------------------------------------
 * 31 队是奇数，每轮必定有队轮空。要凑出每队 82 场：
 *   总场次 = 31 × 82 / 2 = 1271
 *   85 轮要有 85 × 31 − 2 × 1271 = 93 次轮空
 *   93 ÷ 31 = 3  → 每队正好轮空 3 次，打 85 − 3 = **82 场** ✓
 * 具体分布：81 轮各 1 队轮空 + 4 轮各 3 队轮空 = 81 + 12 = 93 ✓
 */
/* =============================================================
   固定的整季赛程（v1.6，参考 2K 的赛季日程）
   -------------------------------------------------------------
   原来每轮是"临时随机配对"，所以赛前根本看不到未来对手。
   现在赛季开始就把 85 轮全部对阵一次算好并**存下来**：
     · 赛程页能提前看到全部 82 场的对手与主客
     · 玩家的比赛结果直接写回对应那一场
     · 不再有"对手待定"
   ============================================================= */
/* 年份种子随机数：同一个赛季生成同一份赛程（可复现），
   不同赛季种子不同 → 赛程自然不一样。 */
function yearRng(seed) {
  let s2 = (seed * 2654435761) >>> 0;
  return function () {
    s2 ^= s2 << 13; s2 >>>= 0;
    s2 ^= s2 >> 17;
    s2 ^= s2 << 5; s2 >>>= 0;
    return s2 / 4294967296;
  };
}
function buildSeasonSchedule(year) {
  const L = (typeof seasonState === 'function') ? seasonState() : {};
  const y = year || L.year || SEASON.START_YEAR;
  const rnd = yearRng(y);
  const byes = buildByeSchedule(rnd);
  const all = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  const rounds = [];
  let lastOpp = null;         // 我上一轮的对手，用来避免连续打同一队
  byes.forEach((byeList, r) => {
    const play = all.filter((k) => byeList.indexOf(k) < 0);
    for (let i = play.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [play[i], play[j]] = [play[j], play[i]];
    }
    let pairs = [];
    for (let i = 0; i + 1 < play.length; i += 2) {
      const homeFirst = rnd() < 0.5;
      pairs.push(homeFirst ? [play[i], play[i + 1]] : [play[i + 1], play[i]]);
    }
    /* 真实赛程里不会"连着两轮打同一支队"。
       如果我这轮的对手和上一轮相同，就和别的配对整体交换一次。 */
    const myPairIdx = pairs.findIndex((p) =>
      p[0] === SEASON.MY_KEY || p[1] === SEASON.MY_KEY);
    if (myPairIdx >= 0 && lastOpp) {
      const myPair = pairs[myPairIdx];
      const myOpp = myPair[0] === SEASON.MY_KEY ? myPair[1] : myPair[0];
      if (myOpp === lastOpp && pairs.length > 1) {
        // 找一组不含 lastOpp 的配对来换
        let sw = -1;
        for (let k = 0; k < pairs.length; k++) {
          if (k === myPairIdx) continue;
          const other = pairs[k];
          if (other[0] === lastOpp || other[1] === lastOpp) continue;
          sw = k; break;
        }
        if (sw >= 0) {
          // 交换两组的"对手"，保持主客方向
          const a0 = myPair[0] === SEASON.MY_KEY ? 1 : 0;
          const b0 = pairs[sw][0] === SEASON.MY_KEY ? 1 : 0;
          const tmp = myPair[a0];
          myPair[a0] = pairs[sw][b0];
          pairs[sw][b0] = tmp;
        }
      }
      const newMyOpp = myPair[0] === SEASON.MY_KEY ? myPair[1] : myPair[0];
      lastOpp = newMyOpp;
    }
    rounds.push({ byes: byeList.slice(), pairs });
  });
  return rounds;
}
/** 取整季赛程（没有就生成） */
function seasonSchedule() {
  const L = seasonState();
  if (!L.schedule || !L.schedule.length) L.schedule = buildSeasonSchedule(L.year);
  return L.schedule;
}
/** 我这一轮的对阵（提前就知道） */
function myFixture(round) {
  const sch = seasonSchedule();
  const rd = sch[(round || seasonState().round) - 1];
  if (!rd) return null;
  for (let i = 0; i < rd.pairs.length; i++) {
    const [h, a] = rd.pairs[i];
    if (h === SEASON.MY_KEY) return { round: round || seasonState().round,
      opp: a, home: true };
    if (a === SEASON.MY_KEY) return { round: round || seasonState().round,
      opp: h, home: false };
  }
  return null;   // 这轮轮空
}
/** 我的整季 82 场（含已打结果） */
function myFullSchedule() {
  const L = seasonState();
  const played = {};
  (L.mySched || []).forEach((g) => { played[g.round] = g; });
  const out = [];
  const sch = seasonSchedule();
  for (let r = 1; r <= sch.length; r++) {
    const fx = myFixture(r);
    if (!fx) continue;
    const done = played[r];
    out.push({ ...fx, done: !!done,
      my: done ? done.my : null, opp2: done ? done.opp2 : null,
      win: done ? done.win : null });
  }
  return out;
}

/* =============================================================
   打完自己的比赛 → 补齐本轮其他场次并推进（2K 流程）
   -------------------------------------------------------------
   ⚠️ 这段之前因为补丁锚点不匹配而**没有被写入**，导致：
     · nextUnplayedRound 未定义 → 赛程页总是回退到当前轮
     · finishMyRound 未定义 → 打完比赛轮次不推进
     结果就是"每次都在打同一个对手、赢了战绩也不涨"。
   ============================================================= */
function finishMyRound(round) {
  const L = seasonState();
  if (L.phase !== 'regular') return 0;
  const sch = seasonSchedule();
  // 用调用方传来的轮次；没传就用当前轮
  const r = round || L.round;
  const rd = sch[r - 1];
  if (!rd) { L.round = Math.max(L.round, r + 1); save && save(); return 0; }
  // 该轮除我之外的比赛全部模拟掉
  let sim = 0;
  rd.pairs.forEach((pr) => {
    if (pr[0] === SEASON.MY_KEY || pr[1] === SEASON.MY_KEY) return;
    playLeagueGame(pr[0], pr[1]);
    sim++;
  });
  // 轮次推进到"下一个还没打的"，避免和 L.round 脱节
  const before = L.round;
  L.round = Math.max(L.round, r) + 1;
  try {
    if (typeof nextUnplayedRound === 'function') {
      const nx = nextUnplayedRound();
      if (nx) L.round = nx;
    }
  } catch (e) {}
  /* ★ 手动打完自己的比赛也要跑能力评估。
     以「玩家已打场次」为准，每 10 场评估一次。 */
  try { tickDevelopment(); } catch (e) {}
  try {
    if (typeof weeklyAward === 'function') weeklyAward(L);
  } catch (e) {}
  save && save();
  return sim;
}
/** 下一场还没打的轮次（赛程页高亮 + "亲自打这一场"都用它） */
function nextUnplayedRound() {
  const L = seasonState();
  if (L.phase !== 'regular') return null;
  const sch = seasonSchedule();
  const played = {};
  (L.mySched || []).forEach((g) => { played[g.round] = 1; });
  for (let r = 1; r <= sch.length; r++) {
    const fx = myFixture(r);
    if (!fx) continue;               // 轮空
    if (!played[r]) return r;
  }
  return null;
}

function buildByeSchedule(rnd) {
  const R = (typeof rnd === 'function') ? rnd : Math.random;
  const keys = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  const pool = [];
  keys.forEach((k) => { for (let i = 0; i < 3; i++) pool.push(k); });   // 每队 3 次
  const shuf = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  shuf(pool);
  const counts = [];
  for (let i = 0; i < 81; i++) counts.push(1);
  for (let i = 0; i < 4; i++) counts.push(3);
  shuf(counts);
  const rounds = [];
  let p = 0;
  for (let r = 0; r < counts.length; r++) {
    const take = [];
    let guard = 0;
    while (take.length < counts[r] && p < pool.length && guard++ < 200) {
      if (!take.includes(pool[p])) { take.push(pool[p]); p++; continue; }
      // 同一轮里重复了 → 和后面某个不重复的换位置
      let sw = -1;
      for (let q = p + 1; q < pool.length; q++) {
        if (!take.includes(pool[q])) { sw = q; break; }
      }
      if (sw < 0) { p++; continue; }
      [pool[p], pool[sw]] = [pool[sw], pool[p]];
      take.push(pool[p]); p++;
    }
    rounds.push(take);
  }
  return rounds;
}

/* ---------- 赛季节奏 ---------- */
function seasonState() {
  const L = leagueState();
  if (!L.phase) L.phase = 'regular';        // regular | playoff | done
  if (!L.year) L.year = SEASON.START_YEAR;
  if (!L.season) L.season = 1;
  if (!L.history) L.history = [];           // 历届冠军
  if (!L.round) L.round = 1;
  if (!L.stats) L.stats = {};
  if (!L.wkStats) { L.wkStats = {}; L.wkStart = 1; }
  if (!L.moStats) { L.moStats = {}; L.moStart = 1; }
  if (!L.awards) L.awards = [];             // {d, kind, title, pid, team, note}
  if (!L.playoff) L.playoff = null;
  if (!L.byes) L.byes = {};                 // 各队轮空次数
  if (!L.byePlan) L.byePlan = buildByeSchedule();
  return L;
}

/** 赛季名称，例如 2026-27 */
function seasonName(year) {
  const y = year || seasonState().year;
  return y + '-' + String((y + 1) % 100).padStart(2, '0');
}
/** 是不是最后一个赛季了 */
function isLastSeason() {
  return seasonState().year >= SEASON.END_YEAR;
}

/**
 * 开启新赛季。
 * ---------------------------------------------------------------
 * 重置：战绩 / 常规赛轮次 / 季后赛 / 球员赛季数据 / 轮空表
 * 保留：球队阵容、突破等级、支票、已买张数、转会市场
 * 年份 +1，到 2056 就不再往后推了。
 */
function startNewSeason() {
  const L = seasonState();
  const me = myLeagueEntry();
  // 归档上一季
  L.history.unshift({
    year: L.year,
    season: L.season,
    champion: L.playoff ? L.playoff.champion : null,
    myW: me.w, myL: me.l,
    mySeed: L.playoff && L.playoff.seeds
      ? ['东', '西'].map((c) => L.playoff.seeds[c].findIndex(
        (x) => x.key === SEASON.MY_KEY) + 1).filter((n) => n > 0)[0] || 0
      : 0,
    awards: (L.awards || []).filter((a) => a.team === SEASON.MY_KEY ||
      (a.multi && a.multi.some((m) => m.team === SEASON.MY_KEY))).length,
  });
  if (L.history.length > 40) L.history.length = 40;

  // 年份推进
  L.year += 1;
  L.season = (L.season || 1) + 1;

  // 重置战绩
  NBA_TEAMS.forEach((t) => {
    const st = L.teams[t.key];
    if (!st) return;
    st.w = 0; st.l = 0; st.pf = 0; st.pa = 0;
    st.buys = 0; st.upgrades = 0;
  });
  const me2 = myLeagueEntry();
  me2.w = 0; me2.l = 0; me2.pf = 0; me2.pa = 0;

  // 重置赛季结构
  L.round = 1;
  L.phase = 'regular';
  L.playoff = null;
  L.stats = {}; L.wkStats = {}; L.moStats = {};
  L.wkStart = 1; L.moStart = 1;
  L.byes = {};
  L.byePlan = buildByeSchedule();
  /* ★ 每个赛季都要换一份新赛程：
     下面这两行以前漏了，导致新赛季还用着上一年的对手与日期。 */
  L.schedule = buildSeasonSchedule(L.year);     // 年份做种子 → 年年不同
  L.mySched = [];                               // 清空我的比赛记录
  L.lastDevGame = 0;                            // 能力评估计数归零
  L.awards = [];

  pushNews(`🏀 ${seasonName(L.year)} 赛季开幕！30 支球队重新出发。`, 'info');
  save();
  return { year: L.year, season: L.season };
}

  /* =============================================================
     当季生涯重置（v7.0）
     -------------------------------------------------------------
     用户要求："一键当季生涯重置" —— 把本赛季打过的比赛全部清空，
     重新从第 1 轮开始打，但**不删球员**、不动收藏、不动金币。

     保留：球员收藏(S.owned) / 金币(S.coins) / 阵容(S.roster)
           突破等级 / 徽章 / 能力成长(L.dev) / AI 球队的球员
           历届冠军(L.history) / 赛季年份(L.year)
     重置：30 队战绩 / 我的赛程记录 / 数据统计 / 奖项 /
           季后赛 / 轮空安排 / 本赛季赛程
     ============================================================= */
  function resetSeasonCareer() {
    const L = seasonState();
    NBA_TEAMS.forEach((t) => {
      const st = L.teams[t.key];
      if (!st) return;
      st.w = 0; st.l = 0; st.pf = 0; st.pa = 0;
      st.buys = 0; st.upgrades = 0;
    });
    const me = myLeagueEntry();
    me.w = 0; me.l = 0; me.pf = 0; me.pa = 0;
    L.round = 1;
    L.phase = 'regular';
    L.playoff = null;
    L.stats = {}; L.wkStats = {}; L.moStats = {};
    L.wkStart = 1; L.moStart = 1;
    L.byes = {};
    L.byePlan = buildByeSchedule();
    L.schedule = buildSeasonSchedule(L.year);
    L.mySched = [];
    L.lastDevGame = 0;
    L.awards = [];
    L._scoreCache = {};
    L.priceSnap = {};
    pushNews('🔄 ' + seasonName(L.year) + ' 赛季已重置，30 支球队重新出发！', 'info');
    save();
    return { year: L.year, season: L.season };
  }

/** 玩家球队的联赛条目 */
function myLeagueEntry() {
  const L = seasonState();
  if (!L.teams[SEASON.MY_KEY]) {
    L.teams[SEASON.MY_KEY] = {
      w: 0, l: 0, pf: 0, pa: 0, buys: 0, spent: 0, auto: false,
      isMine: true, bye: 0,
    };
  }
  const e = L.teams[SEASON.MY_KEY];
  e.isMine = true;
  return e;
}
/** 玩家球队当前阵容评分（实时读球队系统） */
function myTeamOvr() {
  try {
    const r = rosterIds();
    const ids = r.starters.concat(r.bench);
    if (ids.length < 5) return 0;
    return rosterOvr(ids);
  } catch (e) { return 0; }
}
/** 统一取某队评分；mine 走玩家阵容 */
function anyTeamOvr(key) {
  if (key === SEASON.MY_KEY) return myTeamOvr();
  const st = seasonState().teams[key];
  // 带上该队的突破表 —— AI 练出来的等级要真的反映到战力上
  return st ? rosterOvr(st.roster || [], st.brk) : 0;
}
/** 统一取某队阵容 id 列表 */
function anyTeamRoster(key) {
  if (key === SEASON.MY_KEY) {
    try { const r = rosterIds(); return r.starters.concat(r.bench); } catch (e) { return []; }
  }
  const st = seasonState().teams[key];
  return st ? (st.roster || []) : [];
}
/** 队伍展示信息 */
function anyTeamInfo(key) {
  if (key === SEASON.MY_KEY) {
    return { key, name: '我的球队', abbr: 'MINE', c1: '#f5c451', c2: '#7a4a00', conf: '东' };
  }
  return TEAM_BY_KEY[key] || { key, name: key, abbr: '?', c1: '#666', c2: '#333', conf: '东' };
}

/* =============================================================
   球员数据生成
   ============================================================= */
function blankLine() {
  return { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0, to: 0, gs: 0 };
}
/**
 * 记账。
 * ---------------------------------------------------------------
 * 键是「球队|球员」而不是只有球员 —— 因为玩家球队和 NBA 球队
 * 可能持有**同一张卡**，只用球员 id 会把两边的数据加在一起，
 * 场次翻倍、场均腰斩，结果玩家球员永远拿不到奖。
 */
function addStat(bucket, teamKey, id, line) {
  const k = teamKey + '|' + id;
  const o = bucket[k] || (bucket[k] = Object.assign(blankLine(), { t: teamKey, id }));
  Object.keys(line).forEach((x) => { o[x] = (o[x] || 0) + line[x]; });
  return o;
}

/**
 * 给一支球队生成一场比赛的数据。
 * 用球员各自的能力做加权分配，所以得分王通常真的是队里最能得分的。
 */
function genTeamStats(rosterIds2, score) {
  const players = rosterIds2.map((id) => mkAIPlayer(id)).filter(Boolean);
  if (!players.length) return {};
  const starters = players.slice(0, 5);
  const all = players;
  /**
   * 球权分配：先按相关能力排序，再乘一条衰减曲线。
   * 平摊的话每人都只有十几分，不像真实的 NBA（得分王场均 30+）。
   * 用 0.78 的衰减：第一选择占 ~24% 的球权，第 10 人只剩 3%。
   */
  const DECAY = 0.78;
  const pick = (keys, total, spread) => {
    const scored = all.map((p) => {
      let ab = 0;
      keys.forEach((k) => { ab += (p.attrs[k] || 60); });
      ab /= keys.length;
      return { p, ab: ab * (0.85 + Math.random() * 0.3) };
    }).sort((a, b) => b.ab - a.ab);
    const ws = scored.map((x, rank) => Math.pow(DECAY, rank) * (0.75 + Math.random() * 0.5));
    const sum = ws.reduce((a, b) => a + b, 0);
    const out = {};
    scored.forEach((x, rank) => {
      out[x.p.id] = Math.round(total * ws[rank] / sum + (Math.random() - 0.5) * spread);
    });
    return all.map((p) => out[p.id] || 0);
  };
  const pts = pick(['inside', 'three', 'mid'], score, 3);
  const reb = pick(['reb'], Math.round(38 + Math.random() * 14), 1);
  const ast = pick(['pass'], Math.round(20 + Math.random() * 10), 1);
  const stl = pick(['steal'], Math.round(6 + Math.random() * 5), 1);
  const blk = pick(['block'], Math.round(3 + Math.random() * 4), 1);
  const to = pick(['pass'], Math.round(11 + Math.random() * 5), 1);
  const out = {};
  all.forEach((p, i) => {
    const P = Math.max(0, pts[i]), R = Math.max(0, reb[i]), A = Math.max(0, ast[i]);
    const fga = Math.max(1, Math.round(P / 1.15 + Math.random() * 3));
    const tpa = Math.round(fga * (0.2 + Math.random() * 0.28));
    out[p.id] = {
      g: 1, pts: P, reb: R, ast: A,
      stl: Math.max(0, stl[i]), blk: Math.max(0, blk[i]),
      fgm: Math.max(0, Math.round(P * 0.42)), fga,
      tpm: Math.max(0, Math.round(P * 0.11)), tpa,
      to: Math.max(0, to[i]), gs: i < 5 ? 1 : 0,
    };
  });
  return out;
}

/** 把一场比赛的数据记进赛季 / 本周 / 本月 */
function recordStats(key, score) {
  const L = seasonState();
  const roster = anyTeamRoster(key);
  if (!roster.length) return;
  const lines = genTeamStats(roster, score);
  Object.keys(lines).forEach((id) => {
    addStat(L.stats, key, id, lines[id]);
    addStat(L.wkStats, key, id, lines[id]);
    addStat(L.moStats, key, id, lines[id]);
  });
}

/* =============================================================
   奖项
   ============================================================= */
/** 综合效率值（用来排奖项） */
function effOf(s) {
  if (!s || !s.g) return 0;
  const per = (x) => x / s.g;
  return per(s.pts) + per(s.reb) * 1.2 + per(s.ast) * 1.5 +
    per(s.stl) * 2 + per(s.blk) * 2 - per(s.fga - s.fgm) * 0.8 - per(s.to) * 1.2;
}
/** 条目自带球队（复合键 "球队|球员"），不用再全局反查 */
function pidTeam(entry) {
  return entry && entry.t ? entry.t : null;
}
/** 从某个数据桶里排出前 N 名 */
function topFrom(bucket, teamFilter, n, minG) {
  const rows = [];
  Object.keys(bucket).forEach((k) => {
    const s = bucket[k];
    if (!s || s.g < (minG || 1)) return;
    if (teamFilter && s.t !== teamFilter) return;
    rows.push({ id: s.id, s, eff: effOf(s), team: s.t });
  });
  rows.sort((a, b) => b.eff - a.eff);
  return rows.slice(0, n || 5);
}

/** 发一个奖 */
function giveAward(kind, title, pid, teamKey, note, day) {
  const L = seasonState();
  L.awards.unshift({
    d: day || L.round, kind, title, pid, team: teamKey,
    note: note || '', season: L.season || 1,
  });
  if (L.awards.length > 160) L.awards.length = 160;
  /* v9.27：生涯荣誉也要记一笔（名人堂简历用）。
     ★ 必须在 season.js 内部挂 —— 它调 giveAward 用的是词法作用域，
       覆盖 window.giveAward 拦不到这些调用。 */
  try { if (typeof hofNoteAward === 'function') hofNoteAward(kind, pid); } catch (e) {}
  const c = CARD_BY_ID[pid];
  const t = anyTeamInfo(teamKey);
  pushNews(`【${title}】${c ? c.name : pid}（${t.name}）${note || ''}`, 'award',
    { pid, team: teamKey, kind });
  return { kind, title, pid, team: teamKey, note };
}

/** 周最佳：东西部各一人 */
function weeklyAward() {
  const L = seasonState();
  const out = [];
  [['东', '东部'], ['西', '西部']].forEach(([abbr, cn]) => {
    const rows = topFrom(L.wkStats, null, 40, 2).filter((r) => {
      const t = anyTeamInfo(r.team);
      return t.conf === abbr;
    });
    if (rows.length) {
      const r = rows[0];
      out.push(giveAward('week', `${cn}周最佳球员`, r.id, r.team,
        `场均 ${(r.s.pts / r.s.g).toFixed(1)} 分 ${(r.s.reb / r.s.g).toFixed(1)} 板 ` +
        `${(r.s.ast / r.s.g).toFixed(1)} 助`));
    }
  });
  L.wkStats = {}; L.wkStart = L.round;
  return out;
}

/** 月最佳 */
function monthlyAward() {
  const L = seasonState();
  const out = [];
  [['东', '东部'], ['西', '西部']].forEach(([abbr, cn]) => {
    const rows = topFrom(L.moStats, null, 40, 4).filter((r) => {
      const t = anyTeamInfo(r.team);
      return t.conf === abbr;
    });
    if (rows.length) {
      const r = rows[0];
      out.push(giveAward('month', `${cn}月最佳球员`, r.id, r.team,
        `场均 ${(r.s.pts / r.s.g).toFixed(1)} 分 ${(r.s.reb / r.s.g).toFixed(1)} 板 ` +
        `${(r.s.ast / r.s.g).toFixed(1)} 助`));
    }
  });
  L.moStats = {}; L.moStart = L.round;
  return out;
}

/** 常规赛结束时的所有奖项 */
function seasonAwards() {
  const L = seasonState();
  const out = [];
  const S2 = L.stats;

  // ① 五项数据王
  const leaders = [
    ['pts', '得分王'], ['reb', '篮板王'], ['ast', '助攻王'],
    ['stl', '抢断王'], ['blk', '盖帽王'],
  ];
  leaders.forEach(([k, title]) => {
    let best = null;
    Object.keys(S2).forEach((key) => {
      const s = S2[key];
      if (!s || s.g < 10) return;
      const avg = s[k] / s.g;
      if (!best || avg > best.avg) best = { id: s.id, avg, s, team: s.t };
    });
    if (best) {
      out.push(giveAward('stat', title, best.id, best.team,
        `场均 ${best.avg.toFixed(1)}（${best.s.g} 场）`, SEASON.ROUNDS));
    }
  });

  // ② 最佳防守球员：抢断 + 盖帽加权
  let dpoy = null;
  Object.keys(S2).forEach((key) => {
    const s = S2[key];
    if (!s || s.g < 20) return;
    const v = (s.stl * 2 + s.blk * 2.2 + s.reb * 0.5) / s.g;
    if (!dpoy || v > dpoy.v) dpoy = { id: s.id, v, s, team: s.t };
  });
  if (dpoy) {
    out.push(giveAward('dpoy', '最佳防守球员', dpoy.id, dpoy.team,
      `场均 ${(dpoy.s.stl / dpoy.s.g).toFixed(1)} 断 ${(dpoy.s.blk / dpoy.s.g).toFixed(1)} 帽`,
      SEASON.ROUNDS));
  }

  // ③ 常规赛 MVP：个人效率 + 球队战绩
  let mvp = null;
  Object.keys(S2).forEach((key) => {
    const s = S2[key];
    if (!s || s.g < 30) return;
    const tk = s.t;
    const st = tk ? L.teams[tk] : null;
    const winPct = st ? st.w / Math.max(1, st.w + st.l) : 0.5;
    const v = effOf(s) + winPct * 12;
    if (!mvp || v > mvp.v) mvp = { id: s.id, v, s, tk, winPct };
  });
  if (mvp) {
    out.push(giveAward('mvp', '常规赛 MVP', mvp.id, mvp.tk,
      `场均 ${(mvp.s.pts / mvp.s.g).toFixed(1)} 分 ${(mvp.s.reb / mvp.s.g).toFixed(1)} 板 ` +
      `${(mvp.s.ast / mvp.s.g).toFixed(1)} 助 · 球队 ${Math.round(mvp.winPct * 100)}% 胜率`,
      SEASON.ROUNDS));
    // 玩家球队拿到 MVP 有额外奖励
    if (mvp.tk === SEASON.MY_KEY) {
      S.coins += PLAYOFF_REWARD.mvp;
      pushNews(`你的球员拿下常规赛 MVP，奖励 🪙${fmt(PLAYOFF_REWARD.mvp)}`, 'award');
    }
  }

  // ④ 最佳第六人：替补出场效率最高（用 gs/g 判断主力与否）
  let sixth = null;
  Object.keys(S2).forEach((key) => {
    const s = S2[key];
    if (!s || s.g < 20) return;
    if (s.gs / s.g > 0.35) return;              // 首发太多，不算第六人
    const v = effOf(s);
    if (!sixth || v > sixth.v) sixth = { id: s.id, v, s, team: s.t };
  });
  if (sixth) {
    out.push(giveAward('sixth', '最佳第六人', sixth.id, sixth.team,
      `场均 ${(sixth.s.pts / sixth.s.g).toFixed(1)} 分（替补出场）`, SEASON.ROUNDS));
  }

  // ⑤ 最快进步球员：用效率值最高的年轻/低突破球员代替（没有上季数据）
  let mip = null;
  Object.keys(S2).forEach((key) => {
    const s = S2[key];
    if (!s || s.g < 20) return;
    const c = CARD_BY_ID[s.id];
    if (!c) return;
    const v = effOf(s) * (1 + (120 - c.ovr) / 200);   // 起点低的加分
    if (!mip || v > mip.v) mip = { id: s.id, v, s, c, team: s.t };
  });
  if (mip) {
    out.push(giveAward('mip', '最快进步球员', mip.id, mip.team,
      `场均 ${(mip.s.pts / mip.s.g).toFixed(1)} 分，卡面 ${mip.c.ovr}`,
      SEASON.ROUNDS));
  }

  // ⑥ 最佳教练：战绩第一的球队主帅
  const rank = leagueStandings();
  if (rank.length) {
    const t = rank[0];
    out.push(giveAward('coy', '最佳教练', null, t.team.key,
      `${t.w}胜${t.l}负，联盟第一`, SEASON.ROUNDS));
  }

  // ⑦ 最佳阵容一阵 / 二阵 / 三阵
  const allNba = topFrom(S2, null, 15, 25);
  ['一阵', '二阵', '三阵'].forEach((nm, k) => {
    const five = allNba.slice(k * 5, k * 5 + 5);
    if (!five.length) return;
    const L2 = seasonState();
    L2.awards.unshift({
      d: SEASON.ROUNDS, kind: 'team', title: '最佳阵容' + nm,
      multi: five.map((r) => ({ pid: r.id, team: r.team })),
      note: five.map((r) => CARD_BY_ID[r.id].name).join('、'),
      season: L2.season || 1,
    });
    pushNews(`【最佳阵容${nm}】${five.map((r) => CARD_BY_ID[r.id].name).join('、')}`,
      'award', { kind: 'team' });
  });

  // ⑧ 最佳防守阵容一阵 / 二阵
  const defRows = [];
  Object.keys(S2).forEach((key) => {
    const s = S2[key];
    if (!s || s.g < 20) return;
    defRows.push({ id: s.id, v: (s.stl * 2 + s.blk * 2.2 + s.reb * 0.5) / s.g, team: s.t });
  });
  defRows.sort((a, b) => b.v - a.v);
  ['防守一阵', '防守二阵'].forEach((nm, k) => {
    const five = defRows.slice(k * 5, k * 5 + 5);
    if (!five.length) return;
    const L2 = seasonState();
    L2.awards.unshift({
      d: SEASON.ROUNDS, kind: 'team', title: nm,
      multi: five.map((r) => ({ pid: r.id, team: r.team })),
      note: five.map((r) => CARD_BY_ID[r.id].name).join('、'),
      season: L2.season || 1,
    });
    pushNews(`【${nm}】${five.map((r) => CARD_BY_ID[r.id].name).join('、')}`,
      'award', { kind: 'team' });
  });

  return out;
}

/* =============================================================
   常规赛赛程
   ============================================================= */
/**
 * 一轮比赛：31 队（30 NBA + 我的球队）打 15 场，1 队轮空。
 * 轮空权按轮空次数从少到多挑，保证各队轮空次数均衡。
 */
function playRound() {
  const L = seasonState();
  const keys = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  // 轮空按预先算好的轮空表来（保证每队正好 82 场）
  const sch = seasonSchedule();
  const rd = sch[Math.min(L.round - 1, sch.length - 1)] || { byes: [], pairs: [] };
  const byes = rd.byes || [];
  byes.forEach((k) => { L.byes[k] = (L.byes[k] || 0) + 1; });
  const bye = byes[0] || null;
  const results = [];
  for (let i = 0; i < rd.pairs.length; i++) {
    const pr = rd.pairs[i];
    const g = playLeagueGame(pr[0], pr[1]);
    results.push(g);
    /* 记下"我的"这一场的对手与结果，赛程页要用。
       真实比赛里 82 场是提前排好的，但这里每轮随机配对，
       所以只能边打边记；没打的场次显示"待定对手"。 */
    if (pr[0] === SEASON.MY_KEY || pr[1] === SEASON.MY_KEY) {
      const home = pr[0] === SEASON.MY_KEY;
      const opp = home ? pr[1] : pr[0];
      const myScore = home ? g.hs : g.as;
      const oppScore = home ? g.as : g.hs;
      mySchedulePush({
        round: L.round, opp, home,
        my: myScore, opp2: oppScore,
        win: myScore > oppScore,
      });
    }
  }
  return { bye, byes, results };
}

/* ---------- 我的赛程（v1.5） ----------
   记录我打过的每一场：第几轮、对手、主客、比分。
   赛程页用它展示"已打 / 待打"，并支持点击对手直接开打。 */
function mySchedulePush(rec) {
  const L = seasonState();
  if (!L.mySched) L.mySched = [];
  const i = L.mySched.findIndex((x) => x.round === rec.round);
  if (i >= 0) L.mySched[i] = rec; else L.mySched.push(rec);
  L.mySched.sort((a, b) => a.round - b.round);
  if (L.mySched.length > 120) L.mySched.length = 120;
}
function mySchedule() {
  const L = seasonState();
  return L.mySched || [];
}
/** 我这一轮的对手（还没打就是 null —— 要等推进才知道） */
function myRoundOpp() {
  const L = seasonState();
  const rec = mySchedule().filter((x) => x.round === L.round)[0];
  return rec ? rec.opp : null;
}
/** 我当前的战绩 */
function myRecord() {
  const sch = mySchedule();
  const w = sch.filter((x) => x.win).length;
  return { w, l: sch.length - w, n: sch.length };
}

/** 一场常规赛：算比分、记账、生成球员数据、发奖金 */
function playLeagueGame(homeKey, awayKey) {
  const L = seasonState();
  const ho = anyTeamOvr(homeKey), ao = anyTeamOvr(awayKey);
  let hs = simScore(ho, ao, true);
  let as = simScore(ao, ho, false);
  if (hs === as) hs += Math.random() < 0.5 ? 2 : -2;
  const homeWin = hs > as;
  const winKey = homeWin ? homeKey : awayKey;
  const loseKey = homeWin ? awayKey : homeKey;
  const winOvr = homeWin ? ho : ao, loseOvr = homeWin ? ao : ho;

  // 记账
  const bw = L.teams[winKey] || myLeagueEntry();
  const bl = L.teams[loseKey] || myLeagueEntry();
  bw.w++; bl.l++;
  bw.pf = (bw.pf || 0) + (homeWin ? hs : as);
  bw.pa = (bw.pa || 0) + (homeWin ? as : hs);
  bl.pf = (bl.pf || 0) + (homeWin ? as : hs);
  bl.pa = (bl.pa || 0) + (homeWin ? hs : as);

  // 球员数据
  recordStats(homeKey, hs);
  recordStats(awayKey, as);

  // 玩家球队的比赛走真实金币，AI 球队走联赛支票
  const winPay = Math.round(ECO.WIN_BASE + (loseOvr - 80) * ECO.WIN_PER_OVR
    + Math.random() * 120);
  const losePay = Math.round(ECO.LOSE_BASE + (winOvr - 80) * ECO.WIN_PER_OVR * 0.4
    + Math.random() * 70);
  [[winKey, Math.max(200, winPay)], [loseKey, Math.max(80, losePay)]].forEach(([k, pay]) => {
    if (k === SEASON.MY_KEY) {
      /* 玩家球队的联赛比赛是**自动模拟**的，只给少量分红；
         想拿全额奖金就去对战页亲自打（一场 800~2800）。
         ★ v9.27 修倒挂：原来赢 32% / 输 45%，导致「故意不打、让它输」
           反而比手动打一场输球（34%、无分差加成）更赚。
           现在赢 32% / 输 22%，自动模拟永远不如亲手打。 */
      S.coins += Math.round(pay * (k === winKey ? AUTO_SIM_WIN_RATE : AUTO_SIM_LOSE_RATE));
      return;
    }
    const st = L.teams[k];
    if (!st) return;
    st.coins += pay;
    const wage = Math.round(anyTeamRoster(k).reduce((x, id) => x + cardPower(id), 0)
      * ECO.WAGE_PER_POWER);
    st.coins = Math.max(0, st.coins - wage);
  });

  return { home: homeKey, away: awayKey, hs, as, winKey, loseKey,
    homeWin, winPay: Math.max(200, winPay) };
}

/* =============================================================
   季后赛
   ============================================================= */
/** 分区排名（含玩家球队） */
function confStandings(conf) {
  const L = seasonState();
  const rows = [];
  NBA_TEAMS.forEach((t) => {
    if (t.conf !== conf) return;
    const st = L.teams[t.key];
    if (st) rows.push({ key: t.key, w: st.w, l: st.l, ovr: anyTeamOvr(t.key) });
  });
  /* 玩家球队归属哪个分区，以 S.myConf 为准（默认西部）。
     原来这里写死 '东'，而生涯页显示默认西部 —— 两边对不上，
     会出现"我明明排在西部第 3，季后赛却按东部算"的问题。 */
  const MY_CONF = (typeof S !== 'undefined' && S.myConf) ? S.myConf : '西';
  if (conf === MY_CONF) {
    const me = myLeagueEntry();
    rows.push({ key: SEASON.MY_KEY, w: me.w, l: me.l, ovr: myTeamOvr() });
  }
  rows.sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.ovr - a.ovr);
  return rows;
}

/** 常规赛结束 → 生成季后赛对阵 */
function startPlayoffs() {
  const L = seasonState();
  const seeds = {};
  ['东', '西'].forEach((c) => {
    seeds[c] = confStandings(c).slice(0, SEASON.PLAYOFF_SEEDS);
  });
  // 首轮：1v8 / 2v7 / 3v6 / 4v5（高顺位有主场优势）
  const mkSeries = (a, b, round, conf) => ({
    conf, round, hi: a.key, lo: b.key, hw: 0, lw: 0, done: false,
    games: [], hiSeed: a.seed, loSeed: b.seed,
  });
  const r1 = [];
  ['东', '西'].forEach((c) => {
    const s = seeds[c].map((x, i) => ({ ...x, seed: i + 1 }));
    r1.push(mkSeries(s[0], s[7], 0, c));
    r1.push(mkSeries(s[3], s[4], 0, c));
    r1.push(mkSeries(s[1], s[6], 0, c));
    r1.push(mkSeries(s[2], s[5], 0, c));
  });
  /* 种子里也带上序号，界面显示"3. 洛杉矶湖人 48-34"时才不会缺号 */
  ['东', '西'].forEach((c) => {
    seeds[c] = (seeds[c] || []).map((x, i) => ({ ...x, seed: i + 1 }));
  });
  L.playoff = { round: 0, series: r1, seeds, champion: null,
    season: L.season || 1, myRound: 0 };
  L.phase = 'playoff';

  // 进季后赛奖励
  const inPlayoffs = ['东', '西'].some((c) =>
    seeds[c].some((x) => x.key === SEASON.MY_KEY));
  L.playoff.mineIn = inPlayoffs;
  if (inPlayoffs) {
    S.coins += PLAYOFF_REWARD.make;
    const seed = ['东', '西'].map((c) => seeds[c].findIndex((x) => x.key === SEASON.MY_KEY) + 1)
      .filter((n) => n > 0)[0];
    pushNews(`我的球队以分区第 ${seed} 种子进入季后赛！` +
      `奖励 🪙${fmt(PLAYOFF_REWARD.make)}`, 'award');
  } else {
    pushNews('常规赛结束，我的球队没能进入季后赛。', 'info');
  }
  // 给 AI 球队发进季后赛奖励（1/4 额度，避免经济膨胀）
  ['东', '西'].forEach((c) => {
    seeds[c].forEach((x) => {
      if (x.key === SEASON.MY_KEY) return;
      const st = L.teams[x.key];
      if (st) st.coins += Math.round(PLAYOFF_REWARD.make / 4);
    });
  });
  save();
  return seeds;
}

/** 模拟一轮系列赛（7 战 4 胜，主场 2-2-1-1-1） */
function simSeries(se) {
  const need = SEASON.SERIES_WINS;
  se.games = [];
  let n = 0;
  // 主场顺序：hi hi lo lo hi lo hi
  const homeOrder = [se.hi, se.hi, se.lo, se.lo, se.hi, se.lo, se.hi];
  while (se.hw < need && se.lw < need && n < 7) {
    const hk = homeOrder[n];
    const ak = hk === se.hi ? se.lo : se.hi;
    const ho = anyTeamOvr(hk), ao = anyTeamOvr(ak);
    let hs = simScore(ho, ao, true);
    let as = simScore(ao, ho, false);
    if (hs === as) hs += Math.random() < 0.5 ? 2 : -2;
    const hWin = hs > as;
    // 关键：hw/lw 记的是「系列赛高种子 / 低种子」的胜场，
    // 不是「该场主队」的胜场 —— 否则客队赢球会被算成输球。
    const winnerIsHi = hWin ? (hk === se.hi) : (ak === se.hi);
    if (winnerIsHi) se.hw++; else se.lw++;
    se.games.push({ hk, ak, hs, as, hWin });
    // 球员数据照常累计
    recordStats(hk, hs); recordStats(ak, as);
    // 每赢一场给球队一点奖金
    const wk = hWin ? hk : ak;
    if (wk === SEASON.MY_KEY) S.coins += PLAYOFF_REWARD.gameWin;
    else if (L2coins(wk) != null) L2coins(wk, PLAYOFF_REWARD.gameWin);
    n++;
  }
  se.done = true;
  se.winner = se.hw >= need ? se.hi : se.lo;
  se.loser = se.hw >= need ? se.lo : se.hi;
  se.score = se.hw + '-' + se.lw;
  return se;
}
function L2coins(key, add) {
  const st = seasonState().teams[key];
  if (!st) return null;
  if (add) st.coins += Math.round(add / 4);
  return st.coins;
}

/** 玩家球队赢下系列赛 → 发晋级奖励 */
function payAdvance(roundIdx, teamKey, isChamp) {
  if (teamKey !== SEASON.MY_KEY) {
    const st = seasonState().teams[teamKey];
    if (st) st.coins += Math.round(PLAYOFF_REWARD[ROUND_KEY[roundIdx]] / 4);
    return 0;
  }
  const amt = PLAYOFF_REWARD[ROUND_KEY[roundIdx]];
  S.coins += amt;
  pushNews(`我的球队赢下${ROUND_NAME[roundIdx]}！奖励 🪙${fmt(amt)}`, 'award');
  return amt;
}

/** 推进一轮季后赛 */
function advancePlayoffRound() {
  const L = seasonState();
  const po = L.playoff;
  if (!po || L.phase !== 'playoff') return null;
  const cur = po.series.filter((s) => s.round === po.round);
  if (!cur.length) return null;
  // 全部打完
  cur.forEach((s) => { if (!s.done) simSeries(s); });
  // 发晋级奖励
  cur.forEach((s) => payAdvance(po.round, s.winner));
  // 生成下一轮
  const winners = cur.map((s) => s.winner);
  const nextRound = po.round + 1;
  if (nextRound > 3) {
    po.champion = winners[0];
    L.phase = 'done';
    const t = anyTeamInfo(po.champion);
    // 注意：总冠军奖金已经在上面 payAdvance(3, ...) 里发过了，
    // 这里只发新闻，不要再加一次钱（否则会重复发 30000）
    try {
      const champName = po.champion === SEASON.MY_KEY ? SEASON.MY_KEY
        : (TEAM_BY_KEY[po.champion] ? TEAM_BY_KEY[po.champion].name : po.champion);
      const mvpA = (L.awards || []).filter((a) => a.key === 'mvp')[0];
      histRecord(L.year, champName, mvpA ? mvpA.name : '',
        po.champion === SEASON.MY_KEY ? '夺冠' : '止步' + (po.round + 1) + '轮');
      /* 🏛️ v9.27 名人堂：赛季落幕时先把「我的球队」这一季的生涯数据并进总表，
         再评选入堂。放在这里是因为这是"赛季真正结束"的唯一收口点。 */
      if (typeof hofOnSeasonEnd === 'function') hofOnSeasonEnd(L.year);
    } catch (e) {}
    if (po.champion === SEASON.MY_KEY) {
      try { if (typeof qsOnTitle === 'function') qsOnTitle(); } catch (e) {}
      pushNews(`🏆 我的球队拿下总冠军！` +
        `（含总冠军奖励 🪙${fmt(PLAYOFF_REWARD.champ)}）`, 'award');
    } else {
      pushNews(`🏆 ${t.name} 拿下本赛季总冠军！`, 'award');
    }
    // 总决赛 MVP
    return { round: po.round, series: cur, winners, champion: po.champion };
  }
  const next = [];
  if (nextRound === 3) {
    // 总决赛：东西部冠军对决
    /* 总决赛主场优势同样看常规赛战绩，不看东西部顺序 */
    const rOf = (k) => {
      if (k === SEASON.MY_KEY) {
        const me = myLeagueEntry();
        return { w: me.w, l: me.l };
      }
      const st = L.teams[k] || { w: 0, l: 0 };
      return { w: st.w || 0, l: st.l || 0 };
    };
    const fA = winners[0], fB = winners[1];
    const rA = rOf(fA), rB = rOf(fB);
    const fHi = (rA.w - rA.l) >= (rB.w - rB.l) ? fA : fB;
    const fLo = fHi === fA ? fB : fA;
    next.push({ conf: '总', round: 3, hi: fHi, lo: fLo,
      hw: 0, lw: 0, done: false, games: [] });
  } else {
    /* 同区内两两配对。
       ★ 主场优势必须按**常规赛战绩**决定，而不是数组顺序 ——
       否则 8 号种子爆冷淘汰 1 号之后，第二轮反而变成它占主场，不合理。 */
    const recOf = (k) => {
      if (k === SEASON.MY_KEY) {
        const me = myLeagueEntry();
        return { w: me.w, l: me.l };
      }
      const st = L.teams[k] || { w: 0, l: 0 };
      return { w: st.w || 0, l: st.l || 0 };
    };
    const better = (a, b) => {
      const ra = recOf(a), rb = recOf(b);
      const pa = ra.w - ra.l, pb = rb.w - rb.l;
      if (pa !== pb) return pa > pb ? a : b;
      return ra.w >= rb.w ? a : b;
    };
    ['东', '西'].forEach((c) => {
      const w = cur.filter((s) => s.conf === c).map((s) => s.winner);
      for (let i = 0; i + 1 < w.length; i += 2) {
        const a = w[i], b = w[i + 1];
        const hi = better(a, b);            // 战绩好的占主场
        const lo = hi === a ? b : a;
        next.push({ conf: c, round: nextRound, hi, lo,
          hw: 0, lw: 0, done: false, games: [] });
      }
    });
  }
  po.round = nextRound;
  po.series = po.series.concat(next);
  save();
  return { round: po.round - 1, series: cur, winners, next };
}

/* =============================================================
   赛季推进总入口
   ============================================================= */
/**
 * 推进一天（一轮）。
 * 常规赛：打一轮 + 处理周/月奖项 + 到 82 轮自动进季后赛
 * 季后赛：推进一轮系列赛
 */
function advanceSeason() {
  const L = seasonState();
  const out = { phase: L.phase, round: L.round, awards: [] };


  if (L.phase === 'regular') {
    const r = playRound();
    out.roundResult = r;
    L.round++;
    /* ★ 必须在 playRound 之后评估 —— 先算这一轮我打没打，
       再判断是否跨过 10 场节点。放在前面会永远差一场。 */
    try {
      const ran = tickDevelopment();
      if (ran) out.devRan = ran;
    } catch (e) { /* 成长模块异常不能影响赛季推进 */ }

    // 30 支 AI 球队自主运营：练球员（突破）+ 去市场买人
    const ups = [];
    NBA_TEAMS.forEach((t) => {
      const u = aiUpgrade(t);
      if (u) ups.push(u);
    });
    out.upgrades = ups;
    // 练级新闻（最多一条，避免刷屏）
    if (ups.length && Math.random() < 0.5) {
      const u = ups[Math.floor(Math.random() * ups.length)];
      pushNews(`${u.team.name} 把 ${u.card.name} 练到 突${u.to}` +
        `（花费 🪙${fmt(u.cost)}）`, 'deal',
        { team: u.team.key, card: u.card.id, up: u.to });
    }
    const deals = [];
    NBA_TEAMS.forEach((t) => {
      const d = aiShopping(t);
      if (d) deals.push(d);
    });
    out.deals = deals;
    // 周 / 月奖项
    if ((L.round - 1) % SEASON.WEEK === 0) out.awards = out.awards.concat(weeklyAward());
    if ((L.round - 1) % SEASON.MONTH === 0) out.awards = out.awards.concat(monthlyAward());
    // 常规赛新闻
    const big = r.results.slice().sort((a, b) =>
      Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as))[0];
    if (big && Math.abs(big.hs - big.as) >= 20) {
      const w = anyTeamInfo(big.winKey), l = anyTeamInfo(big.loseKey);
      pushNews(`${w.name} ${Math.max(big.hs, big.as)}:${Math.min(big.hs, big.as)} ` +
        `${l.name}（大胜）`, 'game', { win: big.winKey, lose: big.loseKey });
    }
    // 85 轮打完（每队正好 82 场）→ 进季后赛
    if (L.round > SEASON.ROUNDS) {
      out.awards = out.awards.concat(seasonAwards());
      out.seeds = startPlayoffs();
    }
  } else if (L.phase === 'playoff') {
    out.playoff = advancePlayoffRound();
    out.round++;
  } else if (L.phase === 'done') {
    // 赛季结束 → 开新赛季（打到 2056 就停住）
    if (isLastSeason()) {
      out.finished = true;
    } else {
      out.newSeason = startNewSeason();
    }
  }
  save();
  return out;
}

/* =============================================================
   调试：?seasontest=1 —— 跑完整个赛季 + 季后赛
   ============================================================= */
(function seasonTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('seasontest')) return;
    setTimeout(() => {
      const t0 = Date.now();
      const L = seasonState();
      const out = [];
      const startCoins = S.coins;

      // ① 常规赛 82 轮
      let awardCount = 0;
      for (let i = 0; i < SEASON.ROUNDS; i++) {
        const r = advanceSeason();
        awardCount += (r.awards || []).length;
      }
      const me = myLeagueEntry();
      out.push('常规赛 82 轮(' + (Date.now() - t0) + 'ms) 我的战绩 ' +
        me.w + '胜' + me.l + '负');
      // 各队场次是否均衡
      const games = NBA_TEAMS.map((t) => {
        const st = L.teams[t.key]; return st.w + st.l;
      }).concat([me.w + me.l]);
      out.push('场次 ' + Math.min(...games) + '~' + Math.max(...games));
      out.push('奖项 ' + L.awards.length + '项(其中赛事中颁发' + awardCount + ')');
      // AI 自主运营统计
      let upTotal = 0, buyTotal = 0, maxLv = 0, maxName = '';
      NBA_TEAMS.forEach((t) => {
        const st = L.teams[t.key];
        upTotal += st.upgrades || 0;
        buyTotal += st.buys || 0;
        Object.keys(st.brk || {}).forEach((id) => {
          if (st.brk[id] > maxLv) { maxLv = st.brk[id]; maxName = CARD_BY_ID[id].name; }
        });
      });
      out.push('AI练级 ' + upTotal + '次 / 买人 ' + buyTotal + '次');
      out.push('最高突破 突' + maxLv + '(' + maxName + ')');

      // ② 季后赛
      out.push('阶段=' + L.phase + ' 种子=' +
        (L.playoff && L.playoff.seeds ? ('东' + L.playoff.seeds['东'].length +
          '/西' + L.playoff.seeds['西'].length) : '无'));
      const mineSeed = L.playoff && L.playoff.seeds
        ? ['东', '西'].map((c) => L.playoff.seeds[c].findIndex((x) =>
          x.key === SEASON.MY_KEY) + 1).filter((n) => n > 0)[0] : 0;
      out.push('我进季后赛=' + (mineSeed ? '是(第' + mineSeed + '种子)' : '否'));

      // ③ 四轮系列赛
      for (let r = 0; r < 4; r++) {
        const before = L.playoff.round;
        advanceSeason();
        const round = L.playoff.round;
        out.push(ROUND_NAME[before] + '完成→下一轮' + round);
        if (L.phase !== 'playoff') break;
      }
      out.push('总冠军=' + (L.playoff.champion
        ? anyTeamInfo(L.playoff.champion).name : '无'));
      out.push('阶段=' + L.phase);

      // ④ 经济
      const coins = NBA_TEAMS.map((t) => L.teams[t.key].coins);
      out.push('AI支票 ' + Math.round(Math.min(...coins)) + '~' +
        Math.round(Math.max(...coins)));
      out.push('我的支票 ' + Math.round(startCoins) + '→' + Math.round(S.coins));
      out.push('新闻 ' + L.news.length + '条');
      document.title = 'SEASON ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'SEASON-ERR ' + e.message; }
})();

/* ---------- 调试：?potest=1 —— 玩家强阵容打进季后赛，验证晋级奖励 ---------- */
(function playoffRewardTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('potest')) return;
    setTimeout(() => {
      const out = [];
      const L = seasonState();
      // 先给玩家塞一套顶配阵容，确保能进季后赛
      const top = CARDS.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 10);
      top.forEach((c) => { S.owned[c.id] = { got: 1, dup: 0, brk: 0 }; });
      try {
        const ids = top.map((c) => c.id);
        S.roster = { starters: ids.slice(0, 5), bench: ids.slice(5, 10) };
      } catch (e) { out.push('阵容写入失败:' + e.message); }
      const c0 = S.coins;
      for (let i = 0; i < SEASON.ROUNDS; i++) advanceSeason();
      const me = myLeagueEntry();
      const east = confStandings('东');
      const seed = east.findIndex((x) => x.key === SEASON.MY_KEY) + 1;
      out.push('常规赛 ' + me.w + '胜' + me.l + '负 东部第' + (seed || '-') + '种子');
      out.push('支票 ' + Math.round(c0) + '→' + Math.round(S.coins) +
        '(赛后)');
      const c1 = S.coins;
      const gains = [];
      for (let r = 0; r < 4; r++) {
        const before = S.coins;
        advanceSeason();
        const alive = ['东', '西'].some((c) => L.playoff.series.some((x) =>
          x.round === L.playoff.round && (x.hi === SEASON.MY_KEY || x.lo === SEASON.MY_KEY)));
        const mySer = L.playoff.series.filter((x) => x.round === r &&
          (x.hi === SEASON.MY_KEY || x.lo === SEASON.MY_KEY))[0];
        gains.push(ROUND_NAME[r] + '后 +' + Math.round(S.coins - before) +
          (mySer ? '(' + mySer.hi + 'vs' + mySer.lo +
            ' ' + (mySer.winner === SEASON.MY_KEY ? '胜' : '负') +
            ' ' + mySer.score + ')' : '(没参赛)'));
        if (L.phase !== 'playoff') break;
      }
      out.push('晋级奖励 ' + gains.join(' / '));
      out.push('总冠军=' + (L.playoff.champion ? anyTeamInfo(L.playoff.champion).name : '无'));
      out.push('我夺冠=' + (L.playoff.champion === SEASON.MY_KEY ? '是' : '否'));
      out.push('支票 ' + Math.round(c1) + '→' + Math.round(S.coins) + '(季后赛)');
      const awards = L.awards.filter((a) => a.team === SEASON.MY_KEY ||
        (a.multi && a.multi.some((m) => m.team === SEASON.MY_KEY))).length;
      out.push('我拿到的奖项 ' + awards + ' 个');

      // 诊断：奖项归属对不对
      const r2 = rosterIds();
      out.push('我的阵容 ' + r2.starters.length + '+' + r2.bench.length +
        ' 评分' + myTeamOvr().toFixed(1));
      const mv = L.awards.find((a) => a.kind === 'mvp');
      out.push('MVP=' + (mv ? (CARD_BY_ID[mv.pid] ? CARD_BY_ID[mv.pid].name : mv.pid) +
        '@' + mv.team : '没评出'));
      const sc = L.awards.find((a) => a.kind === 'stat');
      out.push('数据王示例=' + (sc ? (CARD_BY_ID[sc.pid] ? CARD_BY_ID[sc.pid].name : '?') +
        '@' + sc.team : '无'));
      out.push('奖项总数=' + L.awards.length + ' 统计人数=' + Object.keys(L.stats).length);
      // 得分榜前 5 看数据是否合理
      const top5 = Object.keys(L.stats).map((k) => {
        const x = L.stats[k];
        return { id: x.id, t: x.t, ppg: x.pts / x.g, rpg: x.reb / x.g, apg: x.ast / x.g, g: x.g };
      }).sort((a, b) => b.ppg - a.ppg).slice(0, 5);
      out.push('得分榜 ' + top5.map((x) => (CARD_BY_ID[x.id] ? CARD_BY_ID[x.id].name : '?') +
        ' ' + x.ppg.toFixed(1) + '分').join(' / '));
      document.title = 'POTEST ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'POTEST-ERR ' + e.message; }
})();

/* ---------- 调试：?yeartest=N 连续打 N 个赛季 ---------- */
(function yearTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('yeartest')) return;
    setTimeout(() => {
      const t0 = Date.now();
      const N = parseInt(q.get('yeartest'), 10) || 3;
      const out = [];
      const L = seasonState();
      out.push('起始 ' + seasonName(L.year));
      for (let y = 0; y < N; y++) {
        // 一个完整赛季：85 轮常规赛 + 4 轮季后赛
        for (let i = 0; i < SEASON.ROUNDS; i++) advanceSeason();
        let guard = 0;
        while (L.phase === 'playoff' && guard++ < 8) advanceSeason();
        const champ = L.playoff && L.playoff.champion;
        const me = myLeagueEntry();
        out.push(seasonName(L.year) + ' 冠军=' +
          (champ ? anyTeamInfo(champ).name : '?') +
          ' 我' + me.w + '胜' + me.l + '负');
        // 开新赛季
        if (y < N - 1) {
          advanceSeason();
          if (L.phase !== 'regular') { out.push('✗ 没进新赛季'); break; }
        }
      }
      out.push('共 ' + (Date.now() - t0) + 'ms');
      out.push('历届冠军 ' + L.history.length + ' 条');
      // 打到 2056 会不会停
      let stopAt = 0;
      for (let y = 0; y < 40 && !isLastSeason(); y++) {
        for (let i = 0; i < SEASON.ROUNDS; i++) advanceSeason();
        let g = 0; while (L.phase === 'playoff' && g++ < 8) advanceSeason();
        advanceSeason();
        stopAt = L.year;
      }
      out.push('最终年份=' + L.year + ' 已到终点=' + (isLastSeason() ? '✓' : '✗'));
      out.push('历届冠军总 ' + L.history.length + ' 条');
      if (q.get('shot')) { switchTab('battle'); crView = 'rank'; renderBattle(); }
      document.title = 'YEAR ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'YEAR-ERR ' + e.message; }
})();

/* =============================================================
   历史记录 / 冠军墙（v1.3）
   -------------------------------------------------------------
   31 个赛季打下来，过去的冠军、MVP、生涯数据全都没地方看。
   这里逐年记录，做成"冠军墙"。
   ============================================================= */
function historyState() {
  if (!S.history) S.history = [];
  return S.history;
}
/** 赛季结束时记一笔 */
function histRecord(year, champ, mvp, myResult) {
  const h = historyState();
  const rec = {
    year, champ: champ || '', mvp: mvp || '',
    mine: champ === SEASON.MY_KEY,
    result: myResult || '',            // 我的战绩文字
  };
  const i = h.findIndex((x) => x.year === year);
  if (i >= 0) h[i] = rec; else h.push(rec);
  h.sort((a, b) => b.year - a.year);
  if (h.length > 60) h.length = 60;
  save && save();
}
function historyHTML() {
  const h = historyState();
  const titles = h.filter((x) => x.mine).length;
  const st = (typeof qsStats === 'function') ? qsStats() : {};
  if (!h.length) {
    return `<div class="hs-wrap"><div class="hs-empty">
      还没有历史记录<br><span>打完第一个赛季就会出现在这里</span></div></div>`;
  }
  return `
    <div class="hs-wrap">
      <div class="hs-top">
        <div class="hs-cell"><b>${titles}</b><span>总冠军</span></div>
        <div class="hs-cell"><b>${h.length}</b><span>已打赛季</span></div>
        <div class="hs-cell"><b>${st.wins || 0}</b><span>生涯胜场</span></div>
        <div class="hs-cell"><b>${st.maxStreak || 0}</b><span>最长连胜</span></div>
        <div class="hs-cell hof-cell" id="hsHofBtn"><b>🏛️</b><span>名人堂 ${
          (typeof hofList === 'function' ? hofList().length : 0)} 人</span></div>
      </div>
      <div class="hs-wall">
        ${h.map((x) => `
          <div class="hs-year${x.mine ? ' mine' : ''}">
            <div class="hs-y">${x.year}</div>
            <div class="hs-champ">${x.mine ? '🏆 我的球队' : (x.champ || '—')}</div>
            ${x.mvp ? `<div class="hs-mvp">MVP ${x.mvp}</div>` : ''}
            ${x.result ? `<div class="hs-res">${x.result}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
}
function bindHistory() {}

/* =============================================================
   赛程页 + 对手预览 + 季后赛对阵图（v1.5）
   ============================================================= */

/** 对手实力速览：OVR / 教练风格 / 战绩 */
function oppBrief(key) {
  const L = seasonState();
  if (key === SEASON.MY_KEY) {
    return { name: S.teamName || '我的球队', ovr: myTeamOvr(),
      style: '我的球队', w: myRecord().w, l: myRecord().l, mine: true };
  }
  const t = TEAM_BY_KEY[key];
  const st = L.teams[key] || { wins: 0, loses: 0 };
  const cs = (typeof coachStyle === 'function') ? coachStyle(key)
    : { name: '常规' };
  return {
    name: t ? t.name : key, abbr: t ? t.abbr : '', c1: t ? t.c1 : '#888',
    ovr: Math.round(anyTeamOvr(key)), style: cs.name,
    w: st.wins || 0, l: st.loses || 0, mine: false,
  };
}

/** 赛程页 UI */
function scheduleHTML() {
  const L = seasonState();
  const full = myFullSchedule();
  const rec = myRecord();
  const played = full.filter((x) => x.done).length;
  const total = full.length || SEASON.GAMES;
  const curRound = L.round;

  // 按轮次显示整季：已打显示比分，未打显示对手（2K 式固定赛程）
  // 高亮"第一场还没打的"（比精确匹配轮次更稳）
  const firstTodo = (full.filter((x) => !x.done)[0] || {}).round;
  const rows = full.map((g) => {
    const o = oppBrief(g.opp);
    const isNext = !g.done && g.round === firstTodo;
    const cls = g.done ? (g.win ? ' win' : ' lose') : (isNext ? ' next' : ' todo');
    return `<div class="sc-row${cls}" data-fx="${g.round}"
        data-opp2="${g.opp}">
      <b class="sc-rd">${g.round}</b>
      <div class="sc-opp">
        <span class="sc-tm">${g.home ? '主' : '客'} vs ${o.name}</span>
        <em>综合 ${o.ovr} · ${o.style}</em>
      </div>
      <div class="sc-res">
        ${g.done ? `<b>${g.my} : ${g.opp2}</b><em>${g.win ? '胜' : '负'}</em>`
          : `<b class="sc-vs">— : —</b><em class="sc-todo">${
              isNext ? '下一场' : '未打'}</em>`}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="sc-wrap">
      <div class="sc-top">
        <div class="sc-cell"><b>${rec.w}</b><span>胜</span></div>
        <div class="sc-cell"><b>${rec.l}</b><span>负</span></div>
        <div class="sc-cell"><b>${(rec.w / Math.max(1, rec.n) * 100).toFixed(0)}%</b>
          <span>胜率</span></div>
        <div class="sc-cell"><b>${played}/${total}</b><span>进度</span></div>
      </div>
      ${(() => {
        const rr = firstTodo || curRound;
        const fx = myFixture(rr);
        if (L.phase !== 'regular' || curRound > SEASON.ROUNDS) return '';
        if (!fx) return `<div class="sc-next">
          <div class="sc-next-t">第 ${curRound} 轮 · 轮空</div>
          <div class="sc-next-b"><span class="sc-done">这一轮没有比赛，直接推进</span></div>
          <button class="sc-adv" id="scAdv">推进第 ${curRound} 轮 ▸</button></div>`;
        const o = oppBrief(fx.opp);
        return `<div class="sc-next">
          <div class="sc-next-t">第 ${curRound} 轮 · ${fx.home ? '主场' : '客场'}</div>
          <div class="sc-next-b">
            <b class="sc-next-opp">${o.name}</b>
            <span class="sc-next-meta">综合 ${o.ovr} · ${o.w}胜${o.l}负 · ${o.style}</span>
          </div>
          <div class="sc-next-btns">
            <button class="sc-adv" id="scAdv">模拟本轮 ▸</button>
            <button class="sc-play" id="scPlay">⚔️ 亲自打这一场</button>
          </div>
        </div>`;
      })()}
      <div class="sc-list-t">整季赛程（${total} 场）</div>
      <div class="sc-list">${rows || '<div class="sc-empty">赛程生成中</div>'}</div>
    </div>`;
}
function bindSchedule() {
  const b = document.getElementById('scAdv');
  if (b) b.onclick = () => {
    Sfx.reveal('gold');
    const r = advanceSeason();
    toast(r.roundResult ? `第 ${r.round} 轮结束` : '已推进');
    try { renderMarket(); } catch (e) {}
  };
  // 亲自打这一场
  const p = document.getElementById('scPlay');
  if (p) p.onclick = () => {
    // 打"下一场还没打的"，而不是当前轮（可能已经打过了）
    const rr = (typeof nextUnplayedRound === 'function'
      && nextUnplayedRound()) || seasonState().round;
    const fx = myFixture(rr);
    if (!fx) { toast('这一轮轮空，点「模拟本轮」推进'); return; }
    Sfx.click();
    try { showOppPreview(fx.opp); }
    catch (e) { toast('打开失败：' + e.message); }
  };
  // 点未来场次看对手
  document.querySelectorAll('.sc-row[data-opp2]').forEach((r) => {
    r.onclick = () => { Sfx.click(); showOppPreview(r.dataset.opp2); };
  });
}

/** 对手预览弹窗：看阵容 + 直接开打 */
function showOppPreview(key, atRound, mode) {
  const o = oppBrief(key);
  const L = seasonState();
  const st = L.teams[key];
  const roster = (st && st.roster) ? st.roster : [];
  const bm = (typeof teamBrkMap === 'function') ? (teamBrkMap(key) || {}) : {};
  const ps = roster.slice(0, 10).map((id) => {
    const c = CARD_BY_ID[id];
    if (!c) return null;
    const brk = bm[id] || 0;
    return { c, brk, ovr: statsOf(c, brk).ovr };
  }).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const starters = ps.slice(0, 5);
  const bench = ps.slice(5);
  const cs = (typeof coachStyle === 'function') ? coachStyle(key) : null;

  const el = document.getElementById('oppLayer');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="op-mask"></div>
    <div class="op-box">
      <div class="op-head">
        <div class="op-tm">${o.name}</div>
        <div class="op-meta">综合 <b>${o.ovr}</b> · 战绩 ${o.w}胜${o.l}负${
          cs ? ' · 风格「' + cs.name + '」' : ''}</div>
        <div class="op-tac">惯用：进攻 ${
          (OFF_TACTICS[cs ? cs.off : 'balanced'] || {}).name || '均衡'} ／ 防守 ${
          (DEF_TACTICS[cs ? cs.def : 'man'] || {}).name || '人盯人'}</div>
      </div>
      <div class="op-sec">首发 5 人</div>
      <div class="op-list">
        ${starters.map((p) => opRow(p)).join('')}
      </div>
      ${bench.length ? `<div class="op-sec">替补席</div>
      <div class="op-list">${bench.map((p) => opRow(p)).join('')}</div>` : ''}
      <div class="op-btns">
        <button class="op-cancel" id="opCancel">关 闭</button>
        ${mode === 'view' ? `
          <div class="op-viewnote">${
            isPlayoffPhase() ? '我的球队已淘汰，只能观看' : '常规赛期间不能打季后赛'}
            <br><span>82 场常规赛结束后，进了季后赛才能开打</span></div>`
        : `<button class="op-go" id="opGo">⚔️ 开始比赛</button>`}
      </div>
    </div>`;
  const close = () => { el.classList.add('hidden'); el.innerHTML = ''; };
  el.querySelector('.op-mask').onclick = close;
  const cc = document.getElementById('opCancel');
  if (cc) cc.onclick = () => { Sfx.click(); close(); };
  const gg = document.getElementById('opGo');
  if (gg) gg.onclick = () => {
    close();
    Sfx.reveal('gold');
    BT.oppTeam = key;
    switchTab('battle');
    setTimeout(() => {
      try {
        /* 把是不是季后赛比赛直接告诉 startBattle，
           否则 startBattle 里那句 `if (mode !== 'playoff') BT.isPlayoffGame = false`
           会把它清掉。 */
        startBattle(mode === 'playoff' ? 'playoff' : 'live', key, atRound);
      } catch (e) { toast('开赛失败：' + e.message); }
    }, 120);
  };
}
function opRow(p) {
  const t = TIERS[p.c.tier];
  return `<div class="op-row" style="--tc:${t.c1}">
    <div class="op-img"><img src="${p.c.photo}" alt=""
      onerror="this.parentNode.style.visibility='hidden'"></div>
    <div class="op-info">
      <div class="op-nm">${p.c.name}</div>
      <div class="op-pos">${p.c.pos} · ${t.name}${p.brk
        ? (p.brk >= ((typeof MAX_BREAK !== 'undefined') ? MAX_BREAK : 8)
          ? ' · MAX' : ' · ' + p.brk + ' 阶突破') : ''}</div>
    </div>
    <b class="op-ovr">${p.ovr}</b>
  </div>`;
}

/** 季后赛对阵图（可点我的系列赛开打） */
function bracketHTML() {
  const L = seasonState();
  const po = L.playoff;
  if (!po) {
    const seeds = {};
    try {
      ['东', '西'].forEach((c) => { seeds[c] = confStandings(c).slice(0, 8); });
    } catch (e) {}
    return `<div class="bk-wrap">
      <div class="bk-pre">
        <div class="bk-pre-t">🏆 季后赛</div>
        <div class="bk-pre-b">常规赛结束后，东西部前 8 名进入季后赛。<br>
          每轮 <b>7 战 4 胜</b>，赢 4 场晋级。</div>
        ${['东', '西'].map((c) => `
          <div class="bk-sec">${c}部前 8 种子（当前）</div>
          <div class="bk-seeds">${(seeds[c] || []).map((x, i) => {
            const o = oppBrief(x.key);
            return `<div class="bk-seed${x.key === SEASON.MY_KEY ? ' mine' : ''}"
              data-opp="${x.key}">
              <b>${i + 1}</b><span>${o.name}</span><em>${o.w}-${o.l}</em>
            </div>`;
          }).join('') || '<div class="bk-empty">还没数据</div>'}</div>`).join('')}
      </div></div>`;
  }
  const rounds = ['首轮', '分区半决赛', '分区决赛', '总决赛'];
  const byRound = {};
  (po.series || []).forEach((s) => {
    (byRound[s.round] = byRound[s.round] || []).push(s);
  });
  const series = (s) => {
    const hi = oppBrief(s.hi), lo = oppBrief(s.lo);
    const mine = s.hi === SEASON.MY_KEY || s.lo === SEASON.MY_KEY;
    return `<div class="bk-series${s.done ? ' done' : ''}${mine ? ' mine' : ''}"
      data-series="${s.round}:${s.hi}:${s.lo}">
      <div class="bk-t ${s.hi === s.winner ? 'w' : ''}">
        <span>${s.hiSeed || ''}. ${hi.name}</span>
        <em class="bk-rec">${hi.w}-${hi.l}</em><b>${s.hw}</b></div>
      <div class="bk-t ${s.lo === s.winner ? 'w' : ''}">
        <span>${s.loSeed || ''}. ${lo.name}</span>
        <em class="bk-rec">${lo.w}-${lo.l}</em><b>${s.lw}</b></div>
      ${mine && !s.done ? '<em class="bk-live">可点开打</em>' : ''}
    </div>`;
  };
  return `
    <div class="bk-wrap">
      <div class="bk-head">
        <b>🏆 ${rounds[po.round] || '季后赛'}</b>
        <span>${po.champion ? '总冠军：' + oppBrief(po.champion).name
          : '第 ' + (po.round + 1) + ' 轮进行中'}</span>
      </div>
      ${po.champion === SEASON.MY_KEY ? `
        <div class="bk-champ">🏆🏆 我的球队拿下总冠军！</div>` : ''}
      <div class="bk-rounds">
        ${[0, 1, 2, 3].map((r) => {
          const list = byRound[r];
          if (!list || !list.length) return '';
          return `<div class="bk-round">
            <div class="bk-rt">${rounds[r]}</div>
            ${list.map(series).join('')}
          </div>`;
        }).join('')}
      </div>
      ${(function () {
        const aw = (L.awards || []).filter((x) =>
          ['mvp', 'dpoy', 'sixth', 'mip', 'coy'].indexOf(x.kind) >= 0);
        if (!aw.length) return '';
        const KN = { mvp: 'MVP', dpoy: '最佳防守', sixth: '最佳第六人',
          mip: '最快进步', coy: '最佳教练' };
        return `<div class="bk-aw">
          <div class="bk-aw-t">🏅 本赛季年度奖项</div>
          <div class="bk-aw-list">${aw.map((x) => {
            const tt = (typeof anyTeamInfo === 'function') ? anyTeamInfo(x.team) : null;
            const nm = x.name || (x.pid && CARD_BY_ID[x.pid] ? CARD_BY_ID[x.pid].name : '') || '—';
            return `<div class="bk-aw-row${x.team === SEASON.MY_KEY ? ' mine' : ''}">
              <i>${KN[x.kind] || x.kind}</i><b>${nm}</b>
              <em>${x.team === SEASON.MY_KEY ? '我的球队'
                : (tt ? tt.name : '')}</em></div>`;
          }).join('')}</div></div>`;
      })()}
      <div class="bk-note">点自己的系列赛可以查看对手阵容并开打</div>
    </div>`;
}
function bindBracket() {
  /* ★ 门禁：只有「已经进季后赛 + 没被淘汰 + 这是我的系列赛」才能开打，
     其余一律只读预览。
     用户明确要求：82 场常规赛没打完、没拿到季后赛资格之前，
     绝不能点季后赛就开始比赛。 */
  const canPlay = (typeof canPlayPlayoff === 'function') && canPlayPlayoff();
  // 东西部前 8 种子 → 永远只读
  document.querySelectorAll('[data-opp]').forEach((b) => {
    b.onclick = () => { Sfx.click(); showOppPreview(b.dataset.opp, null, 'view'); };
  });
  // 系列赛 → 我的且已晋级才可打
  document.querySelectorAll('[data-series]').forEach((b) => {
    b.onclick = () => {
      const parts = b.dataset.series.split(':');
      const hi = parts[1], lo = parts[2];
      const isMine = hi === SEASON.MY_KEY || lo === SEASON.MY_KEY;
      const opp = hi === SEASON.MY_KEY ? lo : hi;
      Sfx.click();
      const ok = isMine && canPlay;
      showOppPreview(opp, ok ? poNextRound() : null, ok ? 'playoff' : 'view');
    };
  });
}

/* ---------- 调试：?v15test=1 v1.5 赛季模式自检 ---------- */
(function v15Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('v15test')) return;
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      const L = seasonState();
      out.push('初始阶段=' + L.phase + ' 轮次=' + L.round);
      // ① 推进几轮，看赛程有没有记上
      for (let i = 0; i < 6; i++) advanceSeason();
      const sch = mySchedule();
      const rec = myRecord();
      out.push('推进 6 轮后 赛程记录=' + sch.length + ' 场 战绩 ' +
        rec.w + '胜' + rec.l + '负');
      out.push('赛程字段检查=' + (sch.length && sch[0].round != null &&
        sch[0].opp != null && sch[0].win != null ? '✓ 完整' : '✗'));
      // ② 赛程页渲染
      crView = 'sched'; switchTab('battle'); renderBattle();
      setTimeout(() => {
        const box = (document.getElementById('lgBody') || document.getElementById('scr-battle') || document.createElement('div'));
        const rows = box.querySelectorAll('.sc-row').length;
        const cells = box.querySelectorAll('.sc-cell').length;
        out.push('赛程页：' + rows + ' 行记录 / ' + cells + ' 个统计格' +
          (rows > 0 && cells === 4 ? ' ✓' : ' ✗'));
        const advBtn = document.getElementById('scAdv');
        out.push('赛程页推进按钮=' + (advBtn ? '✓' : '✗'));
        // ③ 对手预览
        const opp = sch[0].opp;
        showOppPreview(opp);
        setTimeout(() => {
          const ol = document.getElementById('oppLayer');
          const orows = ol.querySelectorAll('.op-row').length;
          out.push('对手预览=' + (ol && !ol.classList.contains('hidden') ? '✓' : '✗') +
            ' 阵容 ' + orows + ' 人');
          out.push('预览内容：' + (ol.querySelector('.op-meta')
            ? ol.querySelector('.op-meta').textContent.trim().slice(0, 30) : '?'));
          out.push('开打按钮=' + (document.getElementById('opGo') ? '✓' : '✗'));
          document.getElementById('opCancel').click();

          // ④ 季后赛对阵图
          L.playoff = null; L.phase = 'regular';
          // 强行把轮次推到季后赛
          L.round = SEASON.ROUNDS - 1;
          advanceSeason();
          advanceSeason();
          const po = seasonState().playoff;
          out.push('季后赛已生成=' + (po ? '✓ 第' + (po.round + 1) + '轮' : '✗'));
          if (po) {
            out.push('首轮系列赛 ' + po.series.filter((x) => x.round === 0).length +
              ' 组（东西各4组=8）');
            lgTab = 'playoff'; renderBattle();
            setTimeout(() => {
              const bb = (document.getElementById('lgBody') || document.getElementById('scr-battle') || document.createElement('div'));
              out.push('对阵图渲染=' + bb.querySelectorAll('.bk-series').length +
                ' 组系列赛');
              out.push('我的系列赛高亮=' +
                (bb.querySelectorAll('.bk-series.mine').length > 0 ? '✓' : '（未进季后赛）'));
              document.title = 'V15 ' + out.join(' | ');
            }, 400);
          } else document.title = 'V15 ' + out.join(' | ');
        }, 500);
      }, 500);
    }, 900);
  } catch (e) { document.title = 'V15-ERR ' + e.message; }
})();

/* ---------- 调试：?v16test=1 固定赛程 + 手动比赛写回 ---------- */
(function v16Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('v16test')) return;
    setTimeout(() => {
      const out = [];
      const L = seasonState();
      // ① 整季赛程提前生成
      const full = myFullSchedule();
      out.push('整季赛程=' + full.length + ' 场' +
        (full.length === SEASON.GAMES ? ' ✓正好 82 场' : ' ✗应为82'));
      const r1 = full[0], r40 = full[39];
      out.push('第1轮 对手=' + oppBrief(r1.opp).name + '(' + (r1.home ? '主' : '客') + ')');
      out.push('第40轮 对手=' + oppBrief(r40.opp).name +
        ' —— 赛前就能看到 ✓');
      // 对手分布是否合理（不会同一队打太多次）
      const cnt = {};
      full.forEach((g) => { cnt[g.opp] = (cnt[g.opp] || 0) + 1; });
      const vals = Object.keys(cnt).map((k) => cnt[k]);
      out.push('对手种类=' + vals.length + ' 队，每队交手 ' +
        Math.min(...vals) + '~' + Math.max(...vals) + ' 次');
      // ② 手动比赛写回（模拟赢一场）
      switchTab('battle');
      setTimeout(() => {
        const before = myRecord();
        out.push('打之前 战绩 ' + before.w + '胜' + before.l + '负');
        const fx = myFixture(seasonState().round);
        BT.oppTeam = fx.opp;
        startBattle('live', fx.opp);
        // 直接把比分设成赢
        BT.myTeam.score = 110; BT.aiTeam.score = 100;
        BT.gs.done = true;
        endBattle(true);
        setTimeout(() => {
          const after = myRecord();
          out.push('赢一场后 战绩 ' + after.w + '胜' + after.l + '负' +
            (after.w === before.w + 1 ? ' ✓显示了这一胜' : ' ✗没记上'));
          // ③ 赛程页应显示这条结果
          const full2 = myFullSchedule();
          const doneN = full2.filter((x) => x.done).length;
          out.push('赛程里已打=' + doneN + ' 场' +
            (doneN >= 1 ? ' ✓' : ' ✗'));
          const g0 = full2.filter((x) => x.done)[0];
          out.push('记录：第' + g0.round + '轮 ' + (g0.home ? '主' : '客') +
            ' vs ' + oppBrief(g0.opp).name + ' ' + g0.my + ':' + g0.opp2 +
            ' ' + (g0.win ? '胜' : '负'));
          // ④ 界面
          crView = 'sched'; switchTab('battle'); renderBattle();
          setTimeout(() => {
            const box = (document.getElementById('lgBody') || document.getElementById('scr-battle') || document.createElement('div'));
            const rows = box.querySelectorAll('.sc-row').length;
            const nextRow = box.querySelectorAll('.sc-row.next').length;
            const playBtn = document.getElementById('scPlay');
            out.push('赛程页 ' + rows + ' 行（整季）/' + nextRow + ' 行高亮下一场');
            out.push('「亲自打这一场」按钮=' + (playBtn ? '✓' : '✗'));
            document.title = 'V16 ' + out.join(' | ');
          }, 500);
        }, 600);
      }, 700);
    }, 900);
  } catch (e) { document.title = 'V16-ERR ' + e.message; }
})();


/* ---------- 调试：?scplaytest=1 「亲自打这一场」自检 ---------- */
(function scPlayTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('scplaytest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    setTimeout(() => {
      const out = [];
      crView = 'sched'; switchTab('battle'); renderBattle();
      setTimeout(() => {
        const btn = document.getElementById('scPlay');
        out.push('按钮存在=' + (btn ? '✓' : '✗'));
        if (!btn) { document.title = 'SCPLAY ' + out.join(' | '); return; }
        btn.click();
        setTimeout(() => {
          const ol = document.getElementById('oppLayer');
          const open = ol && !ol.classList.contains('hidden');
          out.push('点按钮 → 对手浮层=' + (open ? '✓' : '✗'));
          if (open) {
            out.push('对手=' + (ol.querySelector('.op-tm')
              ? ol.querySelector('.op-tm').textContent : '?'));
          }
          const go = document.getElementById('opGo');
          out.push('开打按钮=' + (go ? '✓' : '✗'));
          if (go) {
            go.click();
            setTimeout(() => {
              const bs = document.getElementById('scr-battle');
              out.push('切到对战页=' +
                (bs && bs.classList.contains('active') ? '✓' : '✗'));
              out.push('比赛已开始=' +
                (BT.phase === 'live' || BT.phase === 'done' ? '✓ phase=' + BT.phase : '✗'));
              out.push('比分=' + BT.myTeam.score + ':' + BT.aiTeam.score +
                '（开局应为 0:0）');
              out.push('对手=' + (BT.aiTeam ? BT.aiTeam.name : '?'));
              out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(';') : '无 ✓'));
              document.title = 'SCPLAY ' + out.join(' | ');
            }, 1000);
          } else document.title = 'SCPLAY ' + out.join(' | ');
        }, 700);
      }, 600);
    }, 900);
  } catch (e) { document.title = 'SCPLAY-ERR ' + e.message; }
})();

/* ---------- 调试：?sched3=1 连打 3 场验证赛程与战绩 ---------- */
(function schedTest3() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('sched3')) return;
    setTimeout(() => {
      const out = [];
      const full = myFullSchedule();
      // 检查有没有连续两轮打同一队
      let dup = 0;
      for (let i = 1; i < full.length; i++) {
        if (full[i].opp === full[i - 1].opp) dup++;
      }
      out.push('连续同对手=' + dup + ' 次' + (dup <= 1 ? ' ✓' : ' ⚠'));
      out.push('赛程前 5 轮对手: ' + full.slice(0, 5).map((g) =>
        g.round + '.' + oppBrief(g.opp).name.slice(0, 4) +
        (g.home ? '(主)' : '(客)')).join(' '));
      // 连打 3 场
      for (let i = 0; i < 3; i++) {
        const rr = nextUnplayedRound();
        const fx = myFixture(rr);
        const expect = fx ? oppBrief(fx.opp).name : '?';
        BT.practice = false;
        startBattle('live', fx.opp);
        BT.myTeam.score = 110; BT.aiTeam.score = 100;
        BT.gs.done = true;
        endBattle(true);
        const rec = myRecord();
        out.push('第' + i + '场: 赛程第' + rr + '轮 应打「' + expect +
          '」实际打「' + BT.aiTeam.name + '」' +
          (BT.aiTeam.name === expect ? '✓' : '✗对不上') +
          ' → 战绩 ' + rec.w + '胜' + rec.l + '负');
      }
      // 战绩是否实时反映在赛程页
      crView = 'sched'; switchTab('battle'); renderBattle();
      setTimeout(() => {
        const box = (document.getElementById('lgBody') || document.getElementById('scr-battle') || document.createElement('div'));
        // 生涯模式顶部战绩（赛程页已并入生涯）
        const wl = box.querySelector('.cr-wl');
        const shown = wl ? wl.textContent.replace(/\D/g, '') : '?';
        const rec2 = myRecord();
        out.push('顶部战绩显示=' + (wl ? wl.textContent.replace(/\s+/g, '') : '?') +
          '（实际 ' + rec2.w + '胜' + rec2.l + '负）' +
          (String(rec2.w) === shown ? '✓实时' : '⚠'));
        const cells2 = box.querySelectorAll('.cr-cell');
        out.push('月历格子=' + cells2.length);
        const doneRows = box.querySelectorAll('.cr-cell.win, .cr-cell.lose').length;
        out.push('月历已打标记=' + doneRows + ' 格');
        const nextRow = box.querySelector('.cr-cell.today .cr-d');
        out.push('今天高亮=第' + (nextRow ? nextRow.textContent : '?') + '格');
        document.title = 'SCHED3 ' + out.join(' | ');
      }, 500);
    }, 900);
  } catch (e) { document.title = 'SCHED3-ERR ' + e.message; }
})();

/* =============================================================
   玩家手动打季后赛（v2.7）
   -------------------------------------------------------------
   原来季后赛完全是"推进模拟"，玩家一场都打不了：
     · 生涯页的「挑战」按钮在季后赛阶段查不到赛程 → 直接返回
     · 就算打完了，结果也完全没写进系列赛比分
   这里补上完整的"一场一场打"能力。
   ============================================================= */
/** 我在当前轮的系列赛（没有就返回 null） */
function myPlayoffSeries() {
  const L = seasonState();
  const po = L.playoff;
  if (!po || L.phase !== 'playoff') return null;
  return po.series.filter((s) => s.round === po.round &&
    (s.hi === SEASON.MY_KEY || s.lo === SEASON.MY_KEY))[0] || null;
}
/** 系列赛对手 */
function myPlayoffOpp() {
  const s = myPlayoffSeries();
  if (!s) return null;
  return s.hi === SEASON.MY_KEY ? s.lo : s.hi;
}
/** 系列赛还剩几场 / 现在第几场 */
function mySeriesInfo() {
  const s = myPlayoffSeries();
  if (!s) return null;
  const need = SEASON.SERIES_WINS;
  const n = (s.hw || 0) + (s.lw || 0);
  const homeOrder = [s.hi, s.hi, s.lo, s.lo, s.hi, s.lo, s.hi];
  const hk = homeOrder[Math.min(n, 6)];
  return {
    series: s, gameNo: n + 1, done: !!s.done,
    myWins: s.hi === SEASON.MY_KEY ? s.hw : s.lw,
    oppWins: s.hi === SEASON.MY_KEY ? s.lw : s.hw,
    iAmHome: hk === SEASON.MY_KEY,
    opp: myPlayoffOpp(), winner: s.winner,
    clinch: (s.hi === SEASON.MY_KEY ? s.hw : s.lw) >= need,
    out: (s.hi === SEASON.MY_KEY ? s.lw : s.hw) >= need,
  };
}
/** 玩家手动打完一场季后赛 → 写进系列赛 */
function poManualGame(win, myScore, oppScore) {
  const L = seasonState();
  const po = L.playoff;
  if (!po || L.phase !== 'playoff') return false;
  const s = myPlayoffSeries();
  if (!s || s.done) return false;
  const need = SEASON.SERIES_WINS;
  const n = (s.hw || 0) + (s.lw || 0);
  const homeOrder = [s.hi, s.hi, s.lo, s.lo, s.hi, s.lo, s.hi];
  const hk = homeOrder[Math.min(n, 6)];
  const ak = hk === s.hi ? s.lo : s.hi;
  const iAmHi = s.hi === SEASON.MY_KEY;
  const my = myScore || 0, op = oppScore || 0;
  if (win) { if (iAmHi) s.hw++; else s.lw++; }
  else { if (iAmHi) s.lw++; else s.hw++; }
  s.games = s.games || [];
  s.games.push({
    hk, ak,
    hs: hk === SEASON.MY_KEY ? my : op,
    as: hk === SEASON.MY_KEY ? op : my,
    hWin: hk === SEASON.MY_KEY ? win : !win,
    manual: true,
  });
  try { recordStats(hk, my); recordStats(ak, op); } catch (e) {}
  if (s.hw >= need || s.lw >= need) {
    s.done = true;
    s.winner = s.hw >= need ? s.hi : s.lo;
    try { payAdvance(po.round, s.winner); } catch (e) {}
    const w = s.winner === SEASON.MY_KEY;
    pushNews(w
      ? `🏀 我的球队以 ${Math.max(s.hw, s.lw)}:${Math.min(s.hw, s.lw)} 拿下系列赛！`
      : `😞 我的球队系列赛 ${Math.min(s.hw, s.lw)}:${Math.max(s.hw, s.lw)} 被淘汰。`,
      w ? 'deal' : 'game', { mine: true });
    if (!w) {
      // 被淘汰 → 允许直接推进
      pushNews('本赛季结束，可以点「赛季切换」进入下一年。', 'info');
    }
  }
  save && save();
  return true;
}
/** 季后赛："再打一场"还是"推进下一轮" */
/** 当前季后赛轮次序号（0=首轮 … 3=总决赛） */
function poNextRound() {
  const L = seasonState();
  return (L.playoff && typeof L.playoff.round === 'number')
    ? L.playoff.round : 0;
}
/** 当前是不是季后赛阶段 */
function isPlayoffPhase() {
  return (typeof seasonState === 'function') &&
    seasonState().phase === 'playoff';
}
/** 我有没有资格打季后赛（进了且没被淘汰） */
function canPlayPlayoff() {
  if (!isPlayoffPhase()) return false;
  const info = (typeof mySeriesInfo === 'function') ? mySeriesInfo() : null;
  return !!(info && !info.done);
}

function poNextAction() {
  const L = seasonState();
  if (L.phase !== 'playoff') return 'none';
  const info = mySeriesInfo();
  if (!info) return 'spectate';          // 我没进季后赛
  if (info.clinch || info.out) return 'advance';
  return 'play';
}

/* =============================================================
   季后赛争夺（v2.9）
   -------------------------------------------------------------
   用户要求：常规赛打到 50 场之后，季后赛排名开始"生效"，
   并且**实时**根据各队胜负显示谁进谁出、首轮打谁。
   -------------------------------------------------------------
   规则说明：
     · 前 50 场：排名只是参考，显示"争夺尚未开始"
     · 第 50 场起：正式进入季后赛争夺，实时显示晋级线与对阵
     · 82 场结束后：锁定种子，生成正式对阵
   ============================================================= */
const PLAYOFF_RACE_FROM = 50;      // 从第 50 场开始进入季后赛争夺

/** 我打了多少场常规赛 */
function myGamesPlayed() {
  const rec = myRecord();
  return rec.n || (rec.w + rec.l);
}
/** 季后赛争夺是否已开始 */
function playoffRaceStarted() {
  const L = seasonState();
  if (L.phase !== 'regular') return L.phase === 'playoff';
  return myGamesPlayed() >= PLAYOFF_RACE_FROM;
}
/** 前 50 场还剩多少场开始争夺 */
function gamesUntilRace() {
  return Math.max(0, PLAYOFF_RACE_FROM - myGamesPlayed());
}

/** 某分区的实时排名（含玩家），带晋级线标记 */
function liveConfTable(conf) {
  const L = seasonState();
  const MY_CONF = (typeof S !== 'undefined' && S.myConf) ? S.myConf : '西';
  const rows = [];
  NBA_TEAMS.forEach((t) => {
    if (t.conf !== conf) return;
    const st = L.teams[t.key] || { w: 0, l: 0 };
    rows.push({
      key: t.key,
      name: t.name, abbr: t.abbr, c1: t.c1, c2: t.c2,
      w: st.w || 0, l: st.l || 0, mine: false,
      ovr: anyTeamOvr(t.key),
    });
  });
  if (conf === MY_CONF) {
    const me = myLeagueEntry();
    rows.push({
      key: SEASON.MY_KEY, name: S.teamName || '我的球队', abbr: '我',
      w: me.w || 0, l: me.l || 0, mine: true, ovr: myTeamOvr(),
    });
  }
  rows.sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.w - a.w || b.ovr - a.ovr);
  const cut = rows[SEASON.PLAYOFF_SEEDS - 1];
  rows.forEach((r, i) => {
    r.seed = i + 1;
    r.inPlayoff = i < SEASON.PLAYOFF_SEEDS;
    // 与第 8 名的胜场差（正数=落后）
    r.gb = cut ? ((cut.w - r.w) + (r.l - cut.l)) / 2 : 0;
  });
  return rows;
}

/** 实时预测的首轮对阵（按当前战绩） */
function liveBracket() {
  const out = [];
  ['东', '西'].forEach((c) => {
    const t = liveConfTable(c).slice(0, SEASON.PLAYOFF_SEEDS);
    if (t.length < 8) return;
    // 1v8 / 2v7 / 3v6 / 4v5
    [[0, 7], [3, 4], [1, 6], [2, 5]].forEach((p) => {
      out.push({ conf: c, hi: t[p[0]], lo: t[p[1]] });
    });
  });
  return out;
}

/* ---------- 季后赛争夺界面 ---------- */
function raceHTML() {
  const L = seasonState();
  const started = playoffRaceStarted();
  const left = gamesUntilRace();
  const played = myGamesPlayed();
  const rec = myRecord();

  const head = `
    <div class="rc-head">
      <div class="rc-title">🏆 季后赛争夺</div>
      <div class="rc-sub">${L.phase === 'playoff'
        ? '季后赛进行中 — 对阵已锁定'
        : started
          ? '已进入争夺阶段 · 排名随每场胜负实时变化'
          : `常规赛前 ${PLAYOFF_RACE_FROM} 场 — 还差 ${left} 场开始争夺`}</div>
      <div class="rc-prog">
        <div class="rc-bar"><i style="width:${
          Math.round(Math.min(1, played / SEASON.GAMES) * 100)}%"></i></div>
        <span>${played} / ${SEASON.GAMES} 场　我的战绩 ${rec.w}胜${rec.l}负</span>
      </div>
    </div>`;

  if (!started && L.phase === 'regular') {
    // 还没到 50 场：给出提示，排名不生效
    return `<div class="rc-wrap">${head}
      <div class="rc-locked">
        🔒 季后赛排名将在常规赛第 ${PLAYOFF_RACE_FROM} 场后生效<br>
        <span>现在只是参考战绩，还差 <b>${left}</b> 场</span>
      </div>
      ${['东', '西'].map((c) => confTableHTML(c, false)).join('')}
    </div>`;
  }

  const bracket = liveBracket();
  return `<div class="rc-wrap">${head}
    <div class="rc-note">${L.phase === 'playoff'
      ? '以下为已锁定的季后赛对阵'
      : '以下为按当前战绩实时推算的对阵，每打完一轮都会变'}</div>
    <div class="rc-bracket">
      ${bracket.map((m) => `
        <div class="rc-series" data-rcseries="${m.hi.key}:${m.lo.key}">
          <div class="rc-t${m.hi.mine ? ' mine' : ''}">
            <i>${m.hi.seed}</i><span>${shortName(m.hi.name)}</span>
            <em>${m.hi.w}-${m.hi.l}</em></div>
          <div class="rc-t${m.lo.mine ? ' mine' : ''}">
            <i>${m.lo.seed}</i><span>${shortName(m.lo.name)}</span>
            <em>${m.lo.w}-${m.lo.l}</em></div>
        </div>`).join('')}
    </div>
    <div class="rc-cols">
      ${['东', '西'].map((c) => confTableHTML(c, true)).join('')}
    </div>
  </div>`;
}
/* =============================================================
   📛 卡面显示名覆盖表（v9.43）
   -------------------------------------------------------------
   ★ 为什么加在这里而不是 battle.js：
     **`season.js` 的 shortName 加载在后面，会覆盖 battle.js 的同名函数**，
     所以运行时真正生效的是这一个（见工程交接说明第二十七章的教训）。
     把覆盖表加在 battle.js 里是不会生效的 —— 我第一版就踩了这个坑。

   用户点名要求这 4 位在**卡面/比赛**上显示为日常叫法：
     科比·布莱恩特    → 科比
     特雷西·麦克格雷迪  → 麦迪
     扬尼斯·阿德托昆博  → 扬尼斯
     魔术师约翰逊     → 约翰逊

   ★ 只影响显示层；`data.js` 里的全名不动，
     所以详情页顶部仍显示完整全名，信息不丢。
   ★ 以后要加/改，只需在这张表里增删一行。
   ============================================================= */
const SHORT_OVERRIDE = {
  '科比·布莱恩特': '科比',
  '特雷西·麦克格雷迪': '麦迪',
  '扬尼斯·阿德托昆博': '扬尼斯',
  '魔术师约翰逊': '约翰逊',
};

function shortName(full) {
  if (!full) return '';
  /* ① 用户点名的几位：直接返回指定显示名 */
  if (SHORT_OVERRIDE[full]) return SHORT_OVERRIDE[full];
  /* ② 球队名 → 简称 */
  if (typeof shortTeamName === 'function') return shortTeamName(full);
  return full;
}
/** 分区排名表（带晋级线） */
function confTableHTML(conf, showLine) {
  const rows = liveConfTable(conf);
  return `<div class="rc-table">
    <div class="rc-th">${conf}部 <em>${showLine ? '前 8 进季后赛' : '当前战绩'}</em></div>
    ${rows.map((r) => `
      <div class="rc-row${r.inPlayoff && showLine ? ' in' : ''}${
        r.mine ? ' mine' : ''}${showLine && r.seed === 9 ? ' cut' : ''}">
        <b class="rc-seed">${r.seed}</b>
        <span class="rc-nm">${shortName(r.name)}</span>
        <em class="rc-wl">${r.w}-${r.l}</em>
        ${showLine && r.seed > SEASON.PLAYOFF_SEEDS
          ? `<i class="rc-gb">-${r.gb.toFixed(1)}</i>` : ''}
      </div>`).join('')}
  </div>`;
}

/* =============================================================
   赛季轮回（v3.0）
   -------------------------------------------------------------
   用户要求：从 2026 打到 2056 之后，可以**回到 2026 继续玩**。
   注意这不是"回档"—— 收藏的球员卡、金币、突破、徽章、
   历史冠军墙全部保留，只是年份从头开始跑新一轮。
   ============================================================= */
/** 当前是第几轮（第 1 轮 = 2026~2056 的原始赛程） */
function cycleOf() {
  const L = seasonState();
  return L.cycle || 1;
}
/** 是否已经打完最后一季（可以开启新轮回） */
function canStartNewCycle() {
  const L = seasonState();
  return L.year >= SEASON.END_YEAR && L.phase === 'done';
}
/** 开启新一轮：年份回到 2026，其余全部保留 */
function startNewCycle() {
  const L = seasonState();
  const prevCycle = cycleOf();
  // 记录这一轮的收尾
  L.cycleHistory = L.cycleHistory || [];
  L.cycleHistory.push({
    cycle: prevCycle,
    from: SEASON.START_YEAR, to: SEASON.END_YEAR,
    titles: (L.history || []).filter((h) => h.champion === SEASON.MY_KEY).length,
    myW: myRecord().w, myL: myRecord().l,
  });
  L.cycle = prevCycle + 1;
  L.year = SEASON.START_YEAR;
  L.season = (L.season || 1) + 1;
  // 重置赛季结构（和 startNewSeason 一样，但年份回到起点）
  NBA_TEAMS.forEach((t) => {
    const st = L.teams[t.key];
    if (!st) return;
    st.w = 0; st.l = 0; st.pf = 0; st.pa = 0;
    st.buys = 0; st.upgrades = 0;
  });
  const me = myLeagueEntry();
  me.w = 0; me.l = 0; me.pf = 0; me.pa = 0;
  L.round = 1;
  L.phase = 'regular';
  L.playoff = null;
  L.stats = {}; L.wkStats = {}; L.moStats = {};
  L.wkStart = 1; L.moStart = 1;
  L.byes = {};
  L.byePlan = buildByeSchedule();
  L.schedule = buildSeasonSchedule(L.year);
  L.mySched = [];
  L.lastDevGame = 0;
  L.awards = [];
  pushNews(`🔄 第 ${L.cycle} 轮传奇开启！年份回到 ${SEASON.START_YEAR}，` +
    `你的球员卡、金币与荣誉全部保留。`, 'award');
  save && save();
  return { cycle: L.cycle, year: L.year };
}

/* =============================================================
   球员动态成长 / 身价浮动（v3.3）
   -------------------------------------------------------------
   用户要求：
     · 表现好的球员，能力值和徽章会小幅上升
     · 表现差的会小幅滑落
     · 每 10 场评估一次，幅度要合理（不能一下变得很强/很弱）
     · 身价跟着表现和"买的人多不多"实时变动

   设计（刻意保守，避免数值失控）：
     · 每 10 场评估一次
     · 单次单项最多 ±1，单赛季单项累计最多 ±3
     · 徽章每 20 场最多动 1 枚
     · 身价 = 基础价 × (1 + 表现系数 ±18%) × (1 + 需求系数 ±12%)
   ============================================================= */
const DEV_INTERVAL = 10;        // 每 10 场评估一次
const DEV_ATTR_STEP = 1;        // 单次单项最多 ±1
const DEV_ATTR_CAP = 3;         // 单赛季单项累计上限 ±3
const DEV_BADGE_INTERVAL = 20;  // 徽章每 20 场最多动一次

function devState() {
  const L = seasonState();
  if (!L.dev) L.dev = {};        // id -> { adj:{attr:n}, badges:+n, last:round }
  return L.dev;
}
/** 某球员当前的动态调整（加在原始属性上） */
function devAdjOf(id) {
  const d = devState()[id];
  return (d && d.adj) ? d.adj : null;
}
/** 带动态调整的最终属性 */
function effectiveAttrs(card) {
  const base = card.attrs || {};
  const adj = devAdjOf(card.id);
  if (!adj) return base;
  const out = {};
  Object.keys(base).forEach((k) => {
    out[k] = Math.max(25, Math.min(135, base[k] + (adj[k] || 0)));
  });
  return out;
}

/** 球员本赛季的表现（每场平均） */
function playerPerf(id, teamKey) {
  const L = seasonState();
  const s = L.stats[teamKey + '|' + id];
  if (!s || !s.g) return null;
  const g = s.g;
  const ppg = (s.pts || 0) / g, rpg = (s.reb || 0) / g, apg = (s.ast || 0) / g;
  const topg = (s.to || 0) / g;
  const fgp = s.fga ? (s.fgm / s.fga) : 0.45;
  /* 效率值：得分 + 篮板×1.2 + 助攻×1.5 + 命中率奖励 − 失误 */
  const eff = ppg + rpg * 1.2 + apg * 1.5 + (fgp - 0.45) * 30 - topg * 1.5;
  return { g, ppg, rpg, apg, fgp, eff };
}
/** 按综合评分推算"正常水平"（效率值基准）
   校准依据：实测一名综合 113 的球星，场均 25 分 6 板 5 助 48% 命中，
   效率值约 36；综合 95 的角色球员约 15。所以用 20 + (ovr-100)×1.2。
   原来写成 42 + (ovr-100)×0.42（113 → 47.5）明显偏高，
   结果所有球员都被判为"低于预期"，只会降不会升。 */
function devExpect(card) {
  /* 再下调一点：球权分配是"递减"的（DECAY 0.78），
     角色球员触球少、效率天然偏低，用球星基准去衡量会全员"低于预期"。
     实测校准后升降比例接近均衡。 */
  return { eff: 15 + (card.ovr - 100) * 1.05 };
}

/** 身价快照表：id -> 上次快照时的价格 */
function priceSnapState() {
  const L = seasonState();
  if (!L.priceSnap) L.priceSnap = {};
  return L.priceSnap;
}
/** 身价变动日志（每 10 场一批，所有人都记） */
function priceLogState() {
  const L = seasonState();
  if (!L.priceLog) L.priceLog = [];
  return L.priceLog;
}

/** 上一次评估时玩家打到了第几场 */
function lastDevGameState() {
  const L = seasonState();
  if (typeof L.lastDevGame !== 'number') L.lastDevGame = 0;
  return L;
}
/**
 * 按「玩家已打场次」触发能力评估。
 * -------------------------------------------------------------
 * 用户要求：不管是手动打还是扫荡，只要玩家打完 10 场生涯比赛，
 * 转会市场就要有变化 —— 因为别的球队这期间也打了 10 场。
 * 所以这里以 myGamesPlayed() 为准（而不是联赛轮次），
 * 每跨过 10 场的整数倍就评估一次；跨过多档也会逐档补跑。
 * 返回本次跑了几轮评估。
 */
function tickDevelopment() {
  const L = lastDevGameState();
  const played = myGamesPlayed();
  let ran = 0;
  // 每跨过 10 场就评估一次（可能出现一次跳多档，比如扫荡连推）
  while (L.lastDevGame + DEV_INTERVAL <= played) {
    L.lastDevGame += DEV_INTERVAL;
    try { runDevelopment(L.lastDevGame); ran++; }
    catch (e) { window.__devErr = (e && e.message) + ' | ' +
      ((e && e.stack) ? e.stack.split('\n')[1] : ''); }
  }
  if (ran) save && save();
  return ran;
}
/** 距离下一次能力评估还差几场 */
function gamesUntilDev() {
  const L = lastDevGameState();
  return Math.max(0, L.lastDevGame + DEV_INTERVAL - myGamesPlayed());
}

/** 跑一次评估（每 10 场）
    -------------------------------------------------------------
    两件事一起做：
      ① 属性成长（只有表现明显偏离预期的球员才动）
      ② 身价快照（**每一名球员**都记，不管属性有没有变）
    这样转会市场的「能力变动」页既能看到属性 +/−，
    也能看到身价涨跌，所有球队和玩家都查得到。 */
function runDevelopment(round) {
  if (round % DEV_INTERVAL !== 0) return [];
  const L = seasonState();
  const dev = devState();
  const changes = [];
  // 先算全联盟基准（同位置 × 同档次），所有人共用
  let baseline = {};
  try { baseline = leagueBaseline(); } catch (e) {}
  L._scoreCache = L._scoreCache || {};
  const allTeams = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  allTeams.forEach((tk) => {
    const roster = anyTeamRoster(tk);
    roster.forEach((id) => {
      const card = CARD_BY_ID[id];
      if (!card) return;
      // 玩家的球员不参与 AI 成长（玩家自己用重复卡突破）
      if (tk === SEASON.MY_KEY) return;
      /* 用完整评估体系替代原来单一的效率值比较：
         每一项都有数据、基准、z 分数与加权贡献，总分 SCORE 决定升降。 */
      const rep2 = evaluatePlayer(id, tk, baseline);
      if (!rep2) return;
      const perf = playerPerf(id, tk) || { ppg: 0, rpg: 0, apg: 0, fgp: 0,
        eff: 0, g: 0 };
      L._scoreCache = L._scoreCache || {};
      L._scoreCache[id] = rep2.score;
      const gap = rep2.score * 0.5;
      /* ---- 身价快照：不管属性有没有变，每一名球员都记一笔 ---- */
      let priceInfo = null;
      try {
        const snap = priceSnapState();
        // 用本轮的周期算波动，保证同一轮内所有球员的口径一致
        const nowP = (typeof marketPrice === 'function')
          ? (function () {
              const c2 = CARD_BY_ID[id];
              if (!c2) return marketPriceOf(id);
              // 直接复用 marketPrice，它内部会按当前 myGamesPlayed() 取周期
              return marketPriceOf(id);
            })()
          : 0;
        const prev = snap[id];
        if (typeof prev === 'number' && prev > 0) {
          // 只要有上一次快照就记一条（哪怕价格没变，delta=0）
          priceInfo = { before: prev, after: nowP,
            delta: nowP - prev,
            pct: prev ? Math.round((nowP / prev - 1) * 1000) / 10 : 0 };
        } else {
          priceInfo = { before: nowP, after: nowP, delta: 0, pct: 0, first: true };
        }
        snap[id] = nowP;
        /* 每一名球员都记一条身价更新（含持平），转会市场看得到 */
        const pRec = {
          id, name: card.name,
          up: priceInfo.delta > 0, delta: 0,
          why: priceInfo.first ? '身价基准'
            : priceInfo.delta > 0 ? '身价上涨'
            : priceInfo.delta < 0 ? '身价下跌' : '身价持平',
          detail: {}, round: round, price: priceInfo, teamKey: tk,
          priceOnly: true, ovr: 0,
          ppg: Math.round(perf.ppg * 10) / 10,
          rpg: Math.round(perf.rpg * 10) / 10,
          apg: Math.round(perf.apg * 10) / 10,
        };
        L.devLog = L.devLog || [];
        L.devLog.unshift(pRec);
        if (L.devLog.length > 1500) L.devLog.length = 1500;
        changes.push(pRec);
      } catch (e) { /* 身价快照失败不影响成长 */ }
      const o = dev[id] || (dev[id] = { adj: {}, badges: 0, last: round });
      if (o.last === round) return;
      o.last = round;
      // 往哪个方向调
      const up = gap > 0;
      const mag = Math.min(DEV_ATTR_STEP, Math.abs(gap) > 12 ? 2 : 1);
      // 挑该球员最相关的几项来调
      const keys = [];
      /* 这里不再用"期望效率"比较，改成按球员自己的**强弱项**挑要调的属性：
         用评估报告里偏差最大的那几项，涨就继续强化、跌就削弱。 */
      const worst = (rep2.rows || []).slice().sort((a2, b2) =>
        Math.abs(b2.contrib) - Math.abs(a2.contrib))[0];
      const bestKey = worst ? worst.key : 'ppg';
      if (bestKey === 'ppg' || bestKey === 'eff' || bestKey === 'fgp') {
        keys.push('three', 'mid', 'layup', 'close');
      } else if (bestKey === 'rpg') {
        keys.push('dreb', 'oreb', 'boxout');
      } else if (bestKey === 'apg') {
        keys.push('pass', 'handle', 'catch');
      } else if (bestKey === 'spg') {
        keys.push('steal', 'intercept', 'lateral');
      } else if (bestKey === 'bpg') {
        keys.push('block', 'intD', 'strength');
      } else if (bestKey === 'topg') {
        keys.push('handle', 'pass', 'catch');
      } else {
        keys.push('three', 'mid', 'layup');
      }
      if (perf.rpg >= 6) keys.push('dreb', 'oreb', 'boxout');
      if (perf.apg >= 4) keys.push('pass', 'handle', 'catch');
      if (perf.fgp >= 0.5) keys.push('close', 'layup');
      if (perf.fgp < 0.4) keys.push('mid', 'three');
      const uniq = keys.filter((k, i) => keys.indexOf(k) === i).slice(0, 4);
      let touched = 0;
      uniq.forEach((k) => {
        const cur = o.adj[k] || 0;
        if (up && cur >= DEV_ATTR_CAP) return;
        if (!up && cur <= -DEV_ATTR_CAP) return;
        o.adj[k] = cur + (up ? mag : -mag);
        touched++;
      });

      if (touched) {
        const detail = {};
        uniq.forEach((k) => {
          if (o.adj[k]) detail[k] = mag * (up ? 1 : -1);
        });
        const rec = { id, name: card.name, up,
          delta: o.adj[uniq[0]] || 0,
          why: up ? '表现超预期' : '状态低迷',
          detail, round, price: priceInfo,
          teamKey: tk,
          ovr: effectiveOvr(card) - card.ovr,
          ppg: Math.round(perf.ppg * 10) / 10,
          rpg: Math.round(perf.rpg * 10) / 10,
          apg: Math.round(perf.apg * 10) / 10 };
        changes.push(rec);
        // 存进日志，转会市场的「能力变动」页要用
        L.devLog = L.devLog || [];
        L.devLog.unshift(rec);
        if (L.devLog.length > 1200) L.devLog.length = 1200;
      }
      /* 属性没动、但身价变了 → 也记一条（用户要求"每一名球员"都要能看到） */
      // 徽章：每 20 场最多动一枚
      if (round % DEV_BADGE_INTERVAL === 0 && Math.abs(gap) > 9) {
        const bs = badgesOf(card, 0);
        if (bs.length && up && o.badges < 3) o.badges++;
        else if (bs.length && !up && o.badges > -3) o.badges--;
      }
    });
  });
  const priceMoves = changes.filter((x) => x.price && !x.price.first &&
    x.price.delta !== 0).length;
  if (priceMoves) {
    const ups = changes.filter((x) => x.price && x.price.delta > 0).length;
    pushNews(`💰 本轮身价更新：${priceMoves} 名球员身价变动` +
      `（涨 ${ups} / 跌 ${priceMoves - ups}），可在转会市场查看`, 'deal');
  }
  if (changes.length) {
    // 只发一条新闻，避免刷屏
    const top = changes.slice().sort((a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta))[0];
    if (top) {
      pushNews(`📈 ${top.name} 本赛季${top.why}，` +
        `能力值${top.up ? '上调' : '下滑'}（${changes.length} 名球员有变化）`,
        'deal', { card: top.id });
    }
    save && save();
  }
  return changes;
}

/** 带动态调整的综合评分 */
function effectiveOvr(card) {
  if (!card) return 0;
  const adj = devAdjOf(card.id);
  if (!adj) return card.ovr;
  let sum = 0, n = 0;
  Object.keys(adj).forEach((k) => { sum += adj[k]; n++; });
  if (!n) return card.ovr;
  // 每项属性的调整换算成约 0.5 点综合（30 项属性 → 15 点满权重）
  return Math.round(card.ovr + sum * 0.5);
}
/** 找一名球员现在在哪支球队（联赛里的实际归属，不是卡面上的历史球队） */
function currentTeamOf(id) {
  const L = seasonState();
  const keys = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  for (let i = 0; i < keys.length; i++) {
    if (L.stats && L.stats[keys[i] + '|' + id]) return keys[i];
  }
  return null;
}
/** 用评估 SCORE 直接驱动身价（更透明：分数高就贵，分数低就便宜） */
function scoreMul(id) {
  const L = seasonState();
  const cache = L._scoreCache;
  if (cache && typeof cache[id] === 'number') {
    return Math.max(0.82, Math.min(1.18, 1 + cache[id] / 300));
  }
  return 1;
}
/** 表现系数（用于身价） */
function perfMul(id, teamKey) {
  const card = CARD_BY_ID[id];
  if (!card) return 1;
  /* 关键：要用他在联赛里的**当前球队**去查数据。
     卡面上的 teamKey 是他历史上的球队（比如乔丹=公牛），
     但联赛里他可能被交易到别队了，用旧 key 永远查不到 → 系数恒为 1。 */
  const tk = currentTeamOf(id) || teamKey;
  const perf = playerPerf(id, tk);
  if (!perf || perf.g < 4) return 1;
  const exp = devExpect(card);
  const exp2 = devExpect(card);
  const gap = (perf.eff - exp2.eff) / Math.max(8, exp2.eff);
  // 限制在 ±18%
  return Math.max(0.82, Math.min(1.18, 1 + gap * 0.5));
}
/** 需求系数（买的人多就贵） */
function demandMul(id) {
  const L = seasonState();
  const d = (L.demand && L.demand[id]) || 0;
  return Math.max(0.9, Math.min(1.12, 1 + d * 0.015));
}
/* =============================================================
   市场波动（v3.7）
   -------------------------------------------------------------
   用户要求："每十场所有球员身价都有变化"。
   但前两版里，表现平稳的球员 perfMul ≈ 1、demandMul = 1，
   身价一动不动（界面显示"—"），不符合要求。
   这里加一个**确定性的市场波动**：
     · 每 10 场（一个评估周期）一个档位
     · 同一球员同一周期结果固定（用 id + 周期做哈希，不随刷新变）
     · 幅度 ±0.6% ~ ±4.5%，由"本赛季表现"决定方向权重
   这样每名球员每 10 场都会有身价变化，且不会暴涨暴跌。
   该逻辑与年份无关 —— 2026 到 2056 全程一致。
   ============================================================= */
/* 注意：这个函数**不再参与身价计算**。
   曾经想用它保证"每名球员每 10 场都变价"，但用户明确要求：
   表现平稳的球员身价就应该不变。保留函数仅为兼容旧存档调用。 */
function marketDrift(id, forceRound) {
  return 1;
}
function marketDriftUnused(id, forceRound) {
  const L = seasonState();
  const played = (typeof myGamesPlayed === 'function') ? myGamesPlayed() : 0;
  const rd = (forceRound != null) ? forceRound
    : Math.floor(played / DEV_INTERVAL) * DEV_INTERVAL;
  if (rd <= 0) return 1;                       // 第 10 场之前不波动
  // 用 id + 周期做稳定哈希 → 同周期内不会来回跳
  let h = 2166136261;
  const key = String(id) + '#' + rd;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const r1 = (h % 1000) / 1000;                // 0~1
  const r2 = ((h >>> 10) % 1000) / 1000;       // 0~1
  // 幅度：0.6% ~ 4.5%
  let mag = 0.006 + r1 * 0.039;
  // 方向：表现好偏涨、表现差偏跌；其余按哈希随机
  let dir = r2 < 0.5 ? -1 : 1;
  try {
    const card = CARD_BY_ID[id];
    if (card && typeof playerPerf === 'function') {
      const tk = (typeof currentTeamOf === 'function') ? currentTeamOf(id) : null;
      const perf = tk ? playerPerf(id, tk) : null;
      if (perf && perf.g >= 4) {
        const gap = perf.eff - devExpect(card).eff;
        if (gap > 3) dir = 1;                  // 打得好 → 涨
        else if (gap < -3) dir = -1;           // 打得差 → 跌
      }
    }
  } catch (e) {}
  return 1 + dir * mag;
}

/* =============================================================
   球员评估体系（v3.8）
   -------------------------------------------------------------
   用户要求：表现好 / 不好 / 平稳都要有**数据参考**，
   否则所有人都会是"平稳"，逻辑不成立。
   身价与能力的变化依据：
     ① 比赛数据（得分/篮板/助攻/抢断/盖帽/失误/命中率）
     ② 效率值 PER（对比全联盟同位置基准）
     ③ 能力值（OVR）与徽章
     ④ 比赛作用（球队战绩 + 使用率）
     ⑤ 转会市场购入（需求）

   做法：先算全联盟基准（同位置分组的均值/标准差），
   再对每人算 z 分数，加权成总分 SCORE（−100 ~ +100）：
     SCORE ≥ +18  → 能力↑  身价↑
     SCORE ≤ −18  → 能力↓  身价↓
     中间         → 平稳（不动）
   ============================================================= */

/** 评估用的指标定义：key / 中文名 / 权重（正=越高越好，负=越低越好） */
const EVAL_METRICS = [
  { key: 'ppg',  name: '得分',   w: 1.55 },
  { key: 'rpg',  name: '篮板',   w: 0.85 },
  { key: 'apg',  name: '助攻',   w: 0.95 },
  { key: 'spg',  name: '抢断',   w: 0.70 },
  { key: 'bpg',  name: '盖帽',   w: 0.65 },
  { key: 'topg', name: '失误',   w: -0.60 },
  { key: 'fgp',  name: '命中率', w: 1.10 },
  { key: 'tpp',  name: '三分率', w: 0.55 },
  { key: 'eff',  name: '效率',   w: 1.45 },
];
const EVAL_UP = 18;      // SCORE ≥ 18  → 上调
const EVAL_DOWN = -18;   // SCORE ≤ −18 → 下调

/** 一名球员本赛季的每场数据 */
function seasonLineOf(id, teamKey) {
  const L = seasonState();
  const s = L.stats[teamKey + '|' + id];
  if (!s || !s.g) return null;
  const g = s.g;
  const pts = (s.pts || 0) / g, reb = (s.reb || 0) / g, ast = (s.ast || 0) / g;
  const stl = (s.stl || 0) / g, blk = (s.blk || 0) / g, to = (s.to || 0) / g;
  const fgp = s.fga ? (s.fgm / s.fga) : 0;
  const tpp = s.tpa ? (s.tpm / s.tpa) : 0;
  const eff = pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 - to * 1.5;
  return { g, pts, reb, ast, stl, blk, to, fgp, tpp, eff,
    ppg: pts, rpg: reb, apg: ast, spg: stl, bpg: blk, topg: to };
}

/** 全联盟基准：按「位置组 × OVR 档」分组算均值与标准差
    （同一个位置、同一个档次横向比较才公平） */
function leagueBaseline() {
  const L = seasonState();
  const groups = {};      // key -> { metric -> [values] }
  const allTeams = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  allTeams.forEach((tk) => {
    anyTeamRoster(tk).forEach((id) => {
      const card = CARD_BY_ID[id];
      if (!card) return;
      const ln = seasonLineOf(id, tk);
      if (!ln || ln.g < 5) return;
      const posG = (card.pos === 'PG' || card.pos === 'SG') ? 'G'
        : (card.pos === 'SF') ? 'F' : 'C';
      const tier = card.ovr >= 105 ? 'A' : card.ovr >= 95 ? 'B' : 'C';
      const gk = posG + tier;
      const grp = groups[gk] || (groups[gk] = {});
      EVAL_METRICS.forEach((m) => {
        const v = ln[m.key];
        if (typeof v !== 'number' || !isFinite(v)) return;
        (grp[m.key] = grp[m.key] || []).push(v);
      });
    });
  });
  // 转成 {mean, sd}
  const out = {};
  Object.keys(groups).forEach((gk) => {
    out[gk] = {};
    Object.keys(groups[gk]).forEach((k) => {
      const arr = groups[gk][k];
      const n = arr.length;
      if (n < 3) return;
      const mean = arr.reduce((a, b) => a + b, 0) / n;
      const varr = arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
      out[gk][k] = { mean, sd: Math.max(0.08, Math.sqrt(varr)), n };
    });
  });
  return out;
}

/**
 * 球员评估报告。
 * 返回每一项的数据、基准、z 分数、加权贡献，以及总分 SCORE。
 * 这样界面上就能显示"为什么升/为什么降"的完整依据。
 */
function evaluatePlayer(id, teamKey, baseline) {
  const card = CARD_BY_ID[id];
  if (!card) return null;
  const ln = seasonLineOf(id, teamKey);
  if (!ln || ln.g < 5) return null;
  const posG = (card.pos === 'PG' || card.pos === 'SG') ? 'G'
    : (card.pos === 'SF') ? 'F' : 'C';
  const tier = card.ovr >= 105 ? 'A' : card.ovr >= 95 ? 'B' : 'C';
  const base = (baseline || {})[posG + tier] || {};
  const rows = [];
  let score = 0;
  EVAL_METRICS.forEach((m) => {
    const v = ln[m.key];
    const b = base[m.key];
    if (typeof v !== 'number' || !b) return;
    // 命中率这类比率，标准差太小 → 放宽，避免一个 1% 的差就翻天
    const sd = (m.key === 'fgp' || m.key === 'tpp')
      ? Math.max(0.035, b.sd) : b.sd;
    const z = (v - b.mean) / sd;
    const zc = Math.max(-3, Math.min(3, z));      // 截断，防止个别数据拉爆
    const contrib = zc * m.w * 6.0;               // 换算成 SCORE 的分量
    score += contrib;
    rows.push({ key: m.key, name: m.name, val: v, base: b.mean,
      z: zc, contrib, w: m.w });
  });
  if (!rows.length) return null;
  // 出勤加成：打得多的更可信（不足 10 场时往 0 收缩）
  const sample = Math.min(1, ln.g / 15);
  score = Math.round(score * (0.55 + 0.45 * sample));
  score = Math.max(-100, Math.min(100, score));
  return {
    id, name: card.name, ovr: card.ovr, pos: card.pos, tier, posG,
    g: ln.g, line: ln, rows, score,
    verdict: score >= EVAL_UP ? 'up' : score <= EVAL_DOWN ? 'down' : 'flat',
    // 一句话结论（给界面用）
    why: score >= EVAL_UP
      ? '数据超出同位置基准'
      : score <= EVAL_DOWN ? '数据低于同位置基准' : '数据与基准持平',
  };
}

/** 批量评估全联盟（每 10 场跑一次） */
function evaluateAll() {
  const baseline = leagueBaseline();
  const out = [];
  const allTeams = NBA_TEAMS.map((t) => t.key).concat([SEASON.MY_KEY]);
  allTeams.forEach((tk) => {
    anyTeamRoster(tk).forEach((id) => {
      const r = evaluatePlayer(id, tk, baseline);
      if (r) { r.teamKey = tk; out.push(r); }
    });
  });
  return out;
}
