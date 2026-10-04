'use strict';
/* =============================================================
   联赛系统：30 支 NBA 球队 + 转会市场 + 支票经济
   -------------------------------------------------------------
   · 30 支球队用真实队名 / 缩写 / 配色，阵容从各自球队的球员里挑
   · AI 球队每个「联赛日」自动互相对战，胜者拿支票，结果发新闻
   · AI 球队会自动去转会市场买人（花支票，不抽卡）
   · 玩家也能在转会市场买人，买到的球员直接进自己的收藏
   · 经济刻意压住：一场胜利约 600~1400 支票，
     顶级球员要 3~4 万，也就是 30~50 场胜利才买得起
   ============================================================= */

/* ---------- 30 支球队（真实队名 / 缩写 / 主客色 / 分区） ---------- */
const NBA_TEAMS = [
  { key: 'lal', name: '洛杉矶湖人', abbr: 'LAL', c1: '#fdb927', c2: '#552583', conf: '西' },
  { key: 'orl', name: '奥兰多魔术', abbr: 'ORL', c1: '#0077c0', c2: '#1a1a1a', conf: '东' },
  { key: 'por', name: '波特兰开拓者', abbr: 'POR', c1: '#e03a3e', c2: '#1a1a1a', conf: '西' },
  { key: 'mia', name: '迈阿密热火', abbr: 'MIA', c1: '#f9a01b', c2: '#98002e', conf: '东' },
  { key: 'bos', name: '波士顿凯尔特人', abbr: 'BOS', c1: '#00a758', c2: '#007a33', conf: '东' },
  { key: 'chi', name: '芝加哥公牛', abbr: 'CHI', c1: '#ce1141', c2: '#1a1a1a', conf: '东' },
  { key: 'sac', name: '萨克拉门托国王', abbr: 'SAC', c1: '#5a2d81', c2: '#63727a', conf: '西' },
  { key: 'bkn', name: '布鲁克林篮网', abbr: 'BKN', c1: '#c9ced4', c2: '#1a1a1a', conf: '东' },
  { key: 'sas', name: '圣安东尼奥马刺', abbr: 'SAS', c1: '#c4ced4', c2: '#1a1a1a', conf: '西' },
  { key: 'lac', name: '洛杉矶快船', abbr: 'LAC', c1: '#c8102e', c2: '#1d428a', conf: '西' },
  { key: 'was', name: '华盛顿奇才', abbr: 'WAS', c1: '#e31837', c2: '#002b5c', conf: '东' },
  { key: 'hou', name: '休斯顿火箭', abbr: 'HOU', c1: '#ce1141', c2: '#1a1a1a', conf: '西' },
  { key: 'nyk', name: '纽约尼克斯', abbr: 'NYK', c1: '#f58426', c2: '#006bb6', conf: '东' },
  { key: 'uta', name: '犹他爵士', abbr: 'UTA', c1: '#002b5c', c2: '#f9a01b', conf: '西' },
  { key: 'tor', name: '多伦多猛龙', abbr: 'TOR', c1: '#ce1141', c2: '#1a1a1a', conf: '东' },
  { key: 'det', name: '底特律活塞', abbr: 'DET', c1: '#c8102e', c2: '#1d42ba', conf: '东' },
  { key: 'min', name: '明尼苏达森林狼', abbr: 'MIN', c1: '#0c2340', c2: '#236192', conf: '西' },
  { key: 'gsw', name: '金州勇士', abbr: 'GSW', c1: '#ffc72c', c2: '#1d428a', conf: '西' },
  { key: 'phi', name: '费城76人', abbr: 'PHI', c1: '#ed174c', c2: '#006bb6', conf: '东' },
  { key: 'atl', name: '亚特兰大老鹰', abbr: 'ATL', c1: '#e03a3e', c2: '#1a1a1a', conf: '东' },
  { key: 'ind', name: '印第安纳步行者', abbr: 'IND', c1: '#fdbb30', c2: '#002d62', conf: '东' },
  { key: 'nop', name: '新奥尔良鹈鹕', abbr: 'NOP', c1: '#0c2340', c2: '#85714d', conf: '西' },
  { key: 'cle', name: '克利夫兰骑士', abbr: 'CLE', c1: '#fdbb30', c2: '#860038', conf: '东' },
  { key: 'mil', name: '密尔沃基雄鹿', abbr: 'MIL', c1: '#eee1c6', c2: '#00471b', conf: '东' },
  { key: 'mem', name: '孟菲斯灰熊', abbr: 'MEM', c1: '#5d76a9', c2: '#12173f', conf: '西' },
  { key: 'dal', name: '达拉斯独行侠', abbr: 'DAL', c1: '#00538c', c2: '#002b5e', conf: '西' },
  { key: 'den', name: '丹佛掘金', abbr: 'DEN', c1: '#0e2240', c2: '#fec524', conf: '西' },
  { key: 'okc', name: '俄克拉荷马雷霆', abbr: 'OKC', c1: '#ef3b24', c2: '#007ac1', conf: '西' },
  { key: 'phx', name: '菲尼克斯太阳', abbr: 'PHX', c1: '#e56020', c2: '#1d1160', conf: '西' },
  { key: 'cha', name: '夏洛特黄蜂', abbr: 'CHA', c1: '#1d1160', c2: '#00788c', conf: '东' },
];
const TEAM_BY_KEY = {};
NBA_TEAMS.forEach((t) => { TEAM_BY_KEY[t.key] = t; });
const TEAM_BY_NAME = {};
NBA_TEAMS.forEach((t) => { TEAM_BY_NAME[t.name] = t; });

/* ---------- 经济参数（都在这里，方便调平衡） ---------- */
const ECO = {
  TEAM_SIZE: 10,              // 每队 10 人（5 首发 + 5 替补）
  START_COINS: 5000,          // AI 球队初始支票
  /* v1.1 平衡：奖金整体 ×4。
     原来一个赛季只能挣 6.5~16.5 万，练满一张紫卡要 5~13 个赛季，
     练满时刻卡要 19~49 个赛季（而游戏只有 31 个赛季）。
     现在配合"高档卡降门槛"，练满一张顶级卡约 3~5 个赛季。 */
  WIN_BASE: 1150,             // 赢球基础奖金（原 460，×2.5）
  WIN_PER_OVR: 40,            // 对手越强奖金越高（原 16）
  LOSE_BASE: 375,             // 输球也有出场费（原 150）
  HOME_BONUS: 3,              // 主场加成（得分）
  BUY_CHANCE: 0.20,           // 每个联赛日的基础买人概率（越有钱越高，见 aiShopping）
  BUY_CHANCE_MAX: 0.62,       // 买人概率上限（豪门天天盯市场）
  BUY_RESERVE: 0.18,          // 买人后至少留 18% 支票
  /* ★ v9.49 AI 兑换传说档（用户要求）
     AI 球队也能去图鉴兑换所换「时刻金卡 / 时刻紫卡」，
     一天最多 AI_EX_DAILY 张，兑换会写进战报（和买人一样）。 */
  AI_EX_DAILY: 3,             // 每支 AI 球队每天最多兑换几张
  AI_EX_CHANCE: 0.55,         // 每个联赛日去兑换所的概率（有钱才去）
  /* ★ AI 专属价格系数（0.04 = 玩家价的 4%）
     -------------------------------------------------------------
     为什么 AI 要单独定价：
       实测 AI 的中位余额只有 🪙6,200（60 天净增 🪙2,520），
       而玩家价的传说档是 🪙60,000 ~ 130,000 —— 按玩家价，
       AI 跑 300 天**一张都兑不出来**，这个功能等于不存在。

     为什么给 AI 便宜是合理的：
       · AI 没有玩家那些赚钱手段：不能挂机领补给、打比赛抽卡、
         也不能用"闲置重复卡当祭品"抵扣（祭品能抵掉 60% 的价格）
       · AI 的钱还要同时应付买人 + 工资 + 突破，本来就很紧
       · 这个功能的目的是给联赛**增加变数**（偶尔冒出个球星），
         不是为了跟玩家比经济

     0.04 之后：名宿紫 🪙3,600 / 时刻金 🪙2,400 / 时刻紫 🪙5,200
     —— 正落在 AI 的可支配区间（约 🪙5,000）里，能偶尔成交。 */
  AI_EX_PRICE_MUL: 0.04,
  WAGE_PER_POWER: 0.24,       // 每天工资 = 阵容战力总和 × 这个系数（天然的消耗）
  MARKET_SIZE: 28,            // 市场同时挂牌多少球员
  LIST_PER_DAY: 7,            // 每天各队挂牌出售的人数
  MARKET_REFRESH: 1,          // 每几个联赛日换一批
  MAX_NEWS: 60,               // 新闻最多留多少条
  MIN_UPGRADE: 0,             // 新援比队内最弱强一点点就换（否则有钱也花不出去）
  SELL_FEE: 0.20,             // 卖人手续费 20%（买卖双向都收）
  UPGRADE_CHANCE: 0.11,       // 每个联赛日，每队去练球员的概率
  UPGRADE_BASE: 0.34,         // 突破花费 = 身价 × 这个系数 × 1.34^当前等级
  UPGRADE_GROWTH: 1.34,       // 每升一级花费的涨幅
  UPGRADE_RESERVE: 0.34,      // 练完之后至少留 34% 支票
  UPGRADE_MAX_PER_DAY: 1,     // 每队每天最多练 1 次
  FORM: 20,                   // 比赛状态波动（±，越大冷门越多）
  EDGE: 0.70,                 // 实力差换算成得分的系数（越小越随机）
};

/* ---------- 球员身价 ----------
   按 OVR 指数增长，再乘档位系数。
   参考值：OVR80 银卡 ≈ 230，OVR95 金卡 ≈ 1000，
          OVR105 紫卡 ≈ 3700，OVR115 时刻金 ≈ 11600，
          OVR125 时刻紫 ≈ 38000（约等于 40 场胜利）。 */
const TIER_MUL = {
  silver: 0.8, gold: 1.0, purple: 1.55,
  momentGold: 2.0, momentPurple: 2.8,
};
function marketPrice(card) {
  if (!card) return 0;
  /* 身价三要素（v3.3）：
       ① 基础价（按综合评分指数增长）
       ② 档位系数
       ③ 本赛季表现 + 市场需求 —— 实时变动，见 season.js 的 perfMul / demandMul
     表现好、买的人多 → 涨价；表现差 → 跌价。
     幅度控制在表演 ±18% / 需求 ±12%，不会暴涨暴跌。 */
  const ovr = (typeof effectiveOvr === 'function')
    ? effectiveOvr(card) : card.ovr;
  const base = 120 * Math.pow(1.09, Math.max(60, ovr) - 70);
  const mul = TIER_MUL[card.tier] || 1;
  const pm = (typeof perfMul === 'function') ? perfMul(card.id, card.teamKey) : 1;
  const dm = (typeof demandMul === 'function') ? demandMul(card.id) : 1;
  /* 身价只由「本赛季表现 + 市场需求」决定：
       · 表现平稳 → 系数≈1 → 身价不变（这是对的，不额外加随机波动）
       · 表现超预期 → 涨（上限 +18%）
       · 状态低迷   → 跌（下限 −18%）
     2026~2056 全程同一套逻辑，不随年份改变。 */
  /* 表现只用评估 SCORE 一条链（数据 → 评分 → 身价），
     不再叠加 perfMul，避免两个百分比系数相乘超出 ±20%。 */
  const sm = (typeof scoreMul === 'function') ? scoreMul(card.id) : 1;
  const raw = base * mul * dm * sm;
  // 取整到"好看"的数：小于 1000 取 10，大于取 100
  return raw < 1000 ? Math.round(raw / 10) * 10 : Math.round(raw / 100) * 100;
}
/** 记录一次成交需求：买的人越多越贵（上限 +12%） */
function bumpDemand(id, n) {
  const L = leagueState();
  if (!L.demand) L.demand = {};
  L.demand[id] = Math.min(12, (L.demand[id] || 0) + (n || 1));
  save && save();
}
/** 每天让需求缓慢回落，避免价格永久偏高 */
function decayDemand() {
  const L = leagueState();
  if (!L.demand) return;
  Object.keys(L.demand).forEach((k) => {
    L.demand[k] = Math.max(0, L.demand[k] - 1);
    if (!L.demand[k]) delete L.demand[k];
  });
}

/* ---------- 持卡上限 ----------
   ★ v9.0 修：原来上限 = breakTotalOf(tier)，那是「满突破要**消耗**的张数」，
     但玩家还必须留着本体那 1 张 —— 于是银/金卡上限 64 张、
     最多只能消耗 63 张、每阶 8 张 → 卡在 7 阶永远到不了满突。
     正确的上限要 **+1**（把本体算进去）：银/金 = 63 消耗 + 1 本体 = 64 张。 */
const CARD_LIMIT = breakOwnOf('silver');        // 默认上限（银/金卡 = 64）
/** 某张卡自己的持卡上限（消耗张数 + 保留的本体） */
function cardLimitOf(id) {
  const c = CARD_BY_ID[id];
  return breakOwnOf(c ? c.tier : 'silver');
}

/** 某个买家（玩家或 AI 队）已经持有这张卡多少张 */
function copiesOf(buyerKey, id) {
  if (buyerKey === SEASON.MY_KEY) {
    try { return holdings(id).total; } catch (e) { return 0; }
  }
  const st = leagueState().teams[buyerKey];
  if (!st) return 0;
  if (!st.copies) st.copies = {};
  return st.copies[id] || 0;
}
/** 还能再买几张 */
function remainingOf(buyerKey, id) {
  return Math.max(0, cardLimitOf(id) - copiesOf(buyerKey, id));
}
/** 记一次购买 */
function addCopy(buyerKey, id) {
  if (buyerKey === SEASON.MY_KEY) return;
  const st = leagueState().teams[buyerKey];
  if (!st) return;
  if (!st.copies) st.copies = {};
  st.copies[id] = (st.copies[id] || 0) + 1;
}

/* ---------- 阵容工具 ---------- */
const LINEUP_POS = ['PG', 'SG', 'SF', 'PF', 'C'];

/** 把一串球员 id 排成 5 首发（按位置）+ 5 替补 */
/* =============================================================
   AI 阵容排序（v9.35 重写）
   -------------------------------------------------------------
   原来是**贪心**：按 PG→SG→SF→PF→C 顺序挑"当前剩下里最强的合法球员"。
   贪心会让先挑的位置吃掉后面的资源，导致本可避免的客串 ——
   审计发现全联盟 30 队里 4 队、共 7 个位置被迫客串，最惨的骑士队 3 个：
     SG←勒布朗(SF+PF)  SF←凯文·乐福(PF+C)  C←大流士·加兰(PG+SF)

   现在复用 battle.js 的 bestStarterAssignment()（回溯搜索最优匹配，
   优先"合法位置数最多"，其次"综合最高"，再次"本位最多"）。
   battle.js 在 index.html 与 build-single.js 的 JS_FILES 里都排在
   league.js **之前**，所以这里的调用是安全的。

   ★ 仍然存在的客串只可能是**人才库里真的缺这个位置**
     （比如整队只有内线），那时才用剩下最强的兜底 ——
     并且会触发 v9.35 的客串惩罚（能力值 -60%）。
   ============================================================= */
function organizeRoster(ids) {
  const cards = ids.map((id) => CARD_BY_ID[id]).filter(Boolean);
  /* ★ v9.51：必须注入"含突破的真实综合值" ——
     否则会按卡片基础 ovr 排首发，导致高突破的强卡被低突破卡挤到替补
     （用户实测：6 突破科比 < 0 突破韦德）。withRealOvr 在 battle.js 里。 */
  const asg = (typeof withRealOvr === 'function')
    ? bestStarterAssignment(withRealOvr(cards))
    : bestStarterAssignment(cards);
  const used = new Set(), starters = [];
  asg.starters.forEach((c) => {
    if (c) { used.add(c.id); starters.push(c.id); }
  });
  /* 兜底：确实没人能打这个位置 → 用剩下最强的客串（会吃 -60% 惩罚）
     ★ v9.51：这里的排序也要含突破，否则替补顺序同样会错。 */
  const ovrReal = (c) => (typeof withRealOvr === 'function'
    ? withRealOvr([c])[0].ovr : (c.ovr || 0));
  cards.slice().sort((a, b) => ovrReal(b) - ovrReal(a)).forEach((c) => {
    if (starters.length < 5 && !used.has(c.id)) { used.add(c.id); starters.push(c.id); }
  });
  const bench = cards.filter((c) => !used.has(c.id))
    .sort((a, b) => ovrReal(b) - ovrReal(a))
    .slice(0, ECO.TEAM_SIZE - 5).map((c) => c.id);
  return { starters, bench };
}

/** 球队综合评分：首发权重高，替补权重低 */
function rosterOvr(ids, brkMap) {
  const { starters, bench } = organizeRoster(ids);
  const sc = starters.map((id) => cardPower(id, brkMap));
  const bc = bench.map((id) => cardPower(id, brkMap));
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  if (!sc.length) return 0;
  return avg(sc) * 0.82 + avg(bc) * 0.18;
}

/** 某支球队的突破表 { 卡id: 等级 } */
function teamBrkMap(key) {
  const L = seasonState();
  const st = L.teams[key];
  if (!st) return null;
  if (!st.brk) st.brk = {};
  return st.brk;
}
/** 某支球队里某个球员的突破等级（没练过就按档位给默认值） */
function brkLevelOf(key, id) {
  const m = teamBrkMap(key);
  if (m && m[id] != null) return m[id];
  const c = CARD_BY_ID[id];
  return c ? defaultBrk(c) : 0;
}
/** 单卡战力：OVR + 突破加成。可以指定突破等级或整张突破表 */
function cardPower(id, brk) {
  const c = CARD_BY_ID[id];
  if (!c) return 0;
  let b;
  if (brk == null) b = defaultBrk(c);
  else if (typeof brk === 'number') b = brk;
  else b = (brk[id] != null ? brk[id] : defaultBrk(c));
  return c.ovr + b * BREAK.ovr;
}
function defaultBrk(c) {
  return c.tier === 'momentPurple' ? 4 : c.tier === 'momentGold' ? 3
    : c.tier === 'purple' ? 2 : c.tier === 'gold' ? 1 : 0;
}

/* ---------- 初始化：给 30 支球队分阵容 ---------- */
/**
 * 每队优先用「自己球队」的球员，按战力从高到低取 10 个。
 * 卡片不够 10 张的队（黄蜂 4 张、太阳 7 张…）从自由球员里补。
 */
/**
 * 给不满员的 AI 球队补人（v7.1）
 * -------------------------------------------------------------
 * 删掉一批球员后，旧存档里的 AI 阵容会缺人（sanitizeAfterDataChange
 * 只负责"清掉失效的"，不负责"补齐"）。
 * 这里按和 initLeague 一样的规则补到 TEAM_SIZE：
 *   · 从"没有任何球队要的卡"里挑
 *   · 同一名球员在一支球队只能有一张（playerKeyOf 判身份）
 *   · 弱的队先挑，保持联盟竞争性
 *   · 优先补该队自己队史的球员（更像真实球队）
 * 不夸张：只补到满员为止，不会给某队堆一堆超巨。
 */
function refillAIRosters(L) {
  const st = L || (S.league || null);
  if (!st || !st.teams) return { filled: 0, teams: 0 };
  const used = new Set();
  Object.keys(st.teams).forEach((k) => {
    (st.teams[k].roster || []).forEach((id) => { if (CARD_BY_ID[id]) used.add(id); });
  });
  const playerTaken = {};
  Object.keys(st.teams).forEach((k) => {
    const set = playerTaken[k] || (playerTaken[k] = new Set());
    (st.teams[k].roster || []).forEach((id) => {
      if (CARD_BY_ID[id]) set.add(playerKeyOf(id));
    });
  });
  const free = CARDS.filter((c) => !used.has(c.id))
    .sort((a, b) => cardPower(b.id) - cardPower(a.id));
  /* 弱的队先挑 */
  const needy = NBA_TEAMS.filter((t) => {
    const r = st.teams[t.key] && st.teams[t.key].roster;
    return r && r.length < ECO.TEAM_SIZE;
  }).sort((a, b) => {
    const ra = (st.teams[a.key] || {}).roster || [];
    const rb = (st.teams[b.key] || {}).roster || [];
    return rosterOvr(ra) - rosterOvr(rb);
  });
  let fi = 0, filled = 0, teams = 0;
  needy.forEach((t) => {
    const entry = st.teams[t.key];
    if (!entry || !Array.isArray(entry.roster)) return;
    const set = playerTaken[t.key] || (playerTaken[t.key] = new Set());
    let need = ECO.TEAM_SIZE - entry.roster.length;
    if (need <= 0) return;
    const got = [];
    /* 第一轮：优先该队队史上的球员（更像真实球队） */
    for (let i = fi; i < free.length && got.length < need; i++) {
      const c = free[i];
      if (used.has(c.id)) continue;
      if (c.team !== t.name) continue;
      if (set.has(playerKeyOf(c.id))) continue;
      set.add(playerKeyOf(c.id)); used.add(c.id); got.push(c.id);
    }
    /* 第二轮：还缺就按实力从高到低拿（弱队先挑，保持竞争） */
    while (got.length < need && fi < free.length) {
      const c = free[fi]; fi++;
      if (used.has(c.id)) continue;
      if (set.has(playerKeyOf(c.id))) continue;
      set.add(playerKeyOf(c.id)); used.add(c.id); got.push(c.id);
    }
    if (got.length) {
      entry.roster = entry.roster.concat(got);
      filled += got.length; teams++;
    }
  });
  return { filled, teams };
}

function initLeague() {
  const taken = new Set();
  const rosters = {};
  /* 同一名球员在一支球队里只能出现一次（和玩家阵容同一套规则）。
     用 playerKeyOf 判身份 —— 现役版和时刻版算同一个人。 */
  const playerTaken = {};
  const canTake = (teamKey, id) => {
    const set = playerTaken[teamKey] || (playerTaken[teamKey] = new Set());
    const k = playerKeyOf(id);
    if (set.has(k)) return false;
    set.add(k);
    return true;
  };
  // 第一步：各队先拿自己的球员
  NBA_TEAMS.forEach((t) => {
    const own = CARDS.filter((c) => c.team === t.name)
      .sort((a, b) => cardPower(b.id) - cardPower(a.id));
    const ids = [];
    own.forEach((c) => {
      if (ids.length >= ECO.TEAM_SIZE) return;
      if (canTake(t.key, c.id)) { ids.push(c.id); taken.add(c.id); }
    });
    rosters[t.key] = ids;
  });
  // 第二步：按"当前阵容强度"从低到高补给缺人的队（弱的先挑，保持竞争）
  const free = CARDS.filter((c) => !taken.has(c.id))
    .sort((a, b) => cardPower(b.id) - cardPower(a.id));
  const needy = NBA_TEAMS.filter((t) => rosters[t.key].length < ECO.TEAM_SIZE)
    .sort((a, b) => rosterOvr(rosters[a.key]) - rosterOvr(rosters[b.key]));
  let fi = 0;
  needy.forEach((t) => {
    const need = ECO.TEAM_SIZE - rosters[t.key].length;
    let got = 0;
    while (got < need && fi < free.length) {
      const c0 = free[fi]; fi++;
      if (!canTake(t.key, c0.id)) continue;      // 同球员已有 → 跳过
      rosters[t.key].push(c0.id);
      taken.add(c0.id);
      got++;
    }
  });
  // 第三步：还差人的（理论上不会）随便补
  NBA_TEAMS.forEach((t) => {
    while (rosters[t.key].length < ECO.TEAM_SIZE && fi < free.length) {
      const c1 = free[fi]; fi++;
      if (!canTake(t.key, c1.id)) continue;
      rosters[t.key].push(c1.id); taken.add(c1.id);
    }
  });
  // 第四步：剩下的都是自由球员（转会市场的货源）
  const agents = CARDS.filter((c) => !taken.has(c.id)).map((c) => c.id);

  const teams = {};
  NBA_TEAMS.forEach((t) => {
    teams[t.key] = {
      roster: rosters[t.key],
      coins: ECO.START_COINS,
      w: 0, l: 0, buys: 0, spent: 0,
      auto: true,                       // 允许 AI 自动买人
      /* ★ v9.49 AI 兑换计数（每天重置，见 aiExToday）
         exLastTier：上次兑的档位，用来做"档位均摊"（见 aiExchangeShopping） */
      exDay: '', exCount: 0, exLastTier: '',
    };
  });
  return { teams, agents };
}

/* ---------- 联赛状态 ---------- */
function leagueState() {
  if (!S.league || !S.league.teams) {
    const init = initLeague();
    S.league = {
      day: 1,
      teams: init.teams,
      agents: init.agents,
      market: [],
      news: [],
      marketDay: 0,
      lastResults: [],
      auto: false,
    };
    refreshMarket(true);
    pushNews('联赛开幕！30 支球队集结完毕，转会市场同步开启。', 'info');
  }
  return S.league;
}
function teamState(key) { return leagueState().teams[key]; }
function myLeagueTeam() { return S.league && S.league.myTeam ? S.league.myTeam : null; }

/* ---------- 转会市场 ---------- */
/** 挂牌价：身价 + 一点浮动（同一个球员每次上架价格略有不同） */
function listingPrice(id, salt) {
  const base = marketPrice(CARD_BY_ID[id]);
  const jitter = 0.9 + ((Math.abs(hash32(id + ':' + salt)) % 21) / 100);  // 0.90 ~ 1.10
  return Math.round(base * jitter / 10) * 10;
}
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * 刷新市场。
 * 市场 != 自由球员：主要是**各队挂牌出售的球员**，
 * 否则市场上永远只剩各队挑剩的弱卡，AI 攒再多钱也没处花。
 *   来源 A：自由球员（约 1/3）
 *   来源 B：各队挂牌（约 2/3）—— 从队里挑一个"不是绝对核心"的球员挂出来
 */
function refreshMarket(force) {
  const L = leagueState();
  if (!force && L.marketDay && L.day - L.marketDay < ECO.MARKET_REFRESH) return;
  L.marketDay = L.day;

  const items = [];
  const seen = new Set();

  // A. 自由球员：按日期确定性打乱后取一批，保证每天看到的不同
  const pool = L.agents.slice().sort((a, b) =>
    hash32(a + '#' + L.day) - hash32(b + '#' + L.day));
  const wantFree = Math.round(ECO.MARKET_SIZE / 3);
  pool.slice(0, wantFree).forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    items.push({ id, p: listingPrice(id, L.day), from: null });
  });

  // B. 各队挂牌：优先挂"队内第 4~7 好"的球员（核心不卖，但也挂得出好货）
  const keys = NBA_TEAMS.map((t) => t.key)
    .sort((a, b) => hash32(a + '@' + L.day) - hash32(b + '@' + L.day));
  const wantListed = ECO.MARKET_SIZE - items.length;
  let li = 0;
  for (let n = 0; n < wantListed && li < keys.length; n++, li++) {
    const key = keys[li];
    const st = L.teams[key];
    if (!st || key === L.myTeam) { n--; continue; }
    const sorted = st.roster.slice().sort((a, b) => cardPower(b) - cardPower(a));
    if (sorted.length < 6) continue;
    // 小概率挂出队内头牌（巨星转会），否则在"第 4~7 好"里挑
    // 既不是非卖品，也不是没人要的
    const blockbuster = Math.random() < 0.28;   // 提高巨星挂牌率，让市场更活跃
    const lo = Math.min(3, sorted.length - 1);
    const hi = Math.min(sorted.length - 1, 6);
    const pick = blockbuster ? sorted[0]
      : sorted[lo + Math.floor(Math.random() * Math.max(1, hi - lo))];
    if (seen.has(pick)) continue;
    seen.add(pick);
    const mul = blockbuster ? 1.55 : 1.25;
    items.push({ id: pick, p: Math.round(listingPrice(pick, L.day) * mul / 10) * 10,
      from: key, star: blockbuster });
  }

  items.sort((a, b) => a.p - b.p);

  /* =============================================================
     ★ 交易截止日特供（v9.29）
     -------------------------------------------------------------
     原来「交易截止日」只是把市场 refresh 一遍 —— 玩家什么都没得到，
     等于一个空事件。现在当天额外挂 3 张稀缺卡：
       · 从**别队阵容里最好的球员**里挑（平时挂的是"第 4~7 好"）
       · 打 85 折（截止日各队急于出手）
       · 只在当天有效：买了或过了今天就消失（见 buyFromMarket / 下一天刷新）
     ============================================================= */
  /* ⚠️ eventState() 的键是 `deadline_52` 这种「key_日」格式（见 markEvent），
     不能直接取 eventState().deadline —— 那是 undefined，
     特供永远不会生成（v9.29 自己踩过）。从 SEASON_EVENTS 拿天数。 */
  const dlEv = (typeof SEASON_EVENTS !== 'undefined')
    ? SEASON_EVENTS.filter((e) => e.key === 'deadline')[0] : null;
  L.deadlineDay = dlEv ? dlEv.day : 0;
  if (L.deadlineDay === L.day) {
    const cands = [];
    NBA_TEAMS.forEach((t) => {
      if (t.key === L.myTeam) return;
      const st = L.teams[t.key];
      if (!st || !st.roster || st.roster.length < 3) return;
      const sorted = st.roster.slice().sort((a, b) => cardPower(b) - cardPower(a));
      cands.push({ id: sorted[0], from: t.key });
    });
    const shuffled = cands.sort((a, b) => hash32(a.id + '@dl') - hash32(b.id + '@dl'));
    shuffled.slice(0, 3).forEach((x) => {
      if (seen.has(x.id)) return;
      seen.add(x.id);
      items.push({
        id: x.id, from: x.from, deadline: true, star: true,
        p: Math.round(listingPrice(x.id, L.day) * 0.85 / 10) * 10,
      });
    });
  }

  L.market = items;
}

/**
 * 从市场买人：玩家和 AI 共用。
 * 挂牌来自别的球队时走真正的转会：卖方收钱、失去这名球员，
 * 并从自由球员里补一个进队，保证各队人数不变。
 */
function buyFromMarket(buyer, listingId, opts) {
  const L = leagueState();
  const idx = L.market.findIndex((m) => m.id === listingId);
  if (idx < 0) return { ok: false, why: '这名球员已经不在市场上了' };
  const item = L.market[idx];
  const who = (opts && opts.buyerKey) || SEASON.MY_KEY;
  if (remainingOf(who, listingId) <= 0) {
    return { ok: false, why: `已经持有 ${cardLimitOf(listingId)} 张（满突破），不能再买了` };
  }
  if (buyer.coins < item.p) return { ok: false, why: '支票不够' };
  buyer.coins -= item.p;
  try { if (typeof qsOnBuy === 'function') qsOnBuy(); } catch (e) {}
  // 挂牌**不撤下** —— 同一名球员可以一次买多张（最多 64，满突破为止）。
  // 卖方的名额只在第一次成交时处理，后续算联盟内部流通。
  if (!item.dealt) {
    item.dealt = 1;
    if (item.from && L.teams[item.from]) {
      const seller = L.teams[item.from];
      seller.roster = seller.roster.filter((x) => x !== item.id);
      seller.coins += Math.round(item.p * (1 - ECO.SELL_FEE));   // 扣 20% 手续费
      seller.sold = (seller.sold || 0) + 1;
      const filler = L.agents.shift();
      // 补进来的人也不能跟队里已有的重复（同球员不同卡也算）
      if (filler && !seller.roster.some((x) => samePlayer(x, filler))) {
        seller.roster.push(filler);
      }
    } else {
      L.agents = L.agents.filter((x) => x !== item.id);
    }
  }
  /* ★ 交易截止日特供：成交一次就把当天剩余的特供全部下架。
     理由：特供是"截止日各队急于出手"的稀缺机会，不该被反复刷；
     也避免玩家买完一张后市场里还挂着两张同样诱人的卡、
     但当天钱已经花光造成的挫败感。 */
  if (item.deadline) {
    L.market = L.market.filter((m) => !m.deadline);
  }
  return { ok: true, item, card: CARD_BY_ID[item.id], from: item.from || null };
}

/** AI 自动买人：每个联赛日跑一次 */
/* =============================================================
   🎯 AI 球队的图鉴兑换所（v9.49 用户要求）
   -------------------------------------------------------------
   用户要求：
     「AI球队也可以兑换传说档位时刻金卡和时刻紫卡，但是AI球队
       一天只能兑换3张，并且AI球队兑换时，战报信息里要显示，
       就像他们在转会市场购买球员时，战报也会显示一样的。」

   规则：
     · 只能兑换**传说档**（名宿紫 / 时刻金 / 时刻紫），
       与玩家兑换所的传说档定义一致（exIsLegendary）
     · **每支 AI 球队**每天最多 ECO.AI_EX_DAILY 张
     · 花的是球队自己的支票（st.coins），复用玩家那套定价
       （EX_COIN_COST + EX_PRICE_FLOOR），保证"兑换不比硬抽便宜"
     · 兑换结果写进战报（pushNews），格式与买人保持一致

   与买人的区别（为什么要单独做）：
     买人是"从转会市场挑一个别人挂牌的球员"，
     兑换是"花支票直接换指定档位的卡"——不看市场有没有货。
     所以兑换能让 AI 拿到市场上根本刷不出来的顶级卡，
     给联赛增加一点变数。
   ============================================================= */

/** 该 AI 球队今天已经兑换了几张（跨天自动清零） */
function aiExToday(st) {
  const today = localDayKey();
  if (st.exDay !== today) { st.exDay = today; st.exCount = 0; }
  return st.exCount || 0;
}

/**
 * AI 去兑换所换一张传说档球员。
 * @returns {Object|null} { team, card, price } 成功；null 表示这次不换
 */
function aiExchangeShopping(team) {
  const L = leagueState();
  const st = L.teams[team.key];
  if (!st || !st.auto) return null;

  /* ① 今天的配额用完了就不去 */
  if (aiExToday(st) >= ECO.AI_EX_DAILY) return null;

  /* ② 有钱才去：概率随财富提升（和逛市场一个思路） */
  const wealth = Math.min(1, st.coins / 90000);
  const chance = ECO.AI_EX_CHANCE * (0.35 + wealth * 0.65);
  if (Math.random() > chance) return null;

  /* ③ 留一部分支票做周转，不能把家底全砸在一张卡上 */
  const budget = st.coins * (1 - ECO.BUY_RESERVE);
  if (budget < 10000) return null;

  const bm = (typeof teamBrkMap === 'function' ? teamBrkMap(team.key) : null) || {};

  /* ④ 队内最弱的（用来判断值不值得换） */
  const org = organizeRoster(st.roster);
  const all = org.starters.concat(org.bench).filter(Boolean);
  if (!all.length) return null;
  const weakestId = all.slice().sort((a, b) =>
    cardPower(a, bm) - cardPower(b, bm))[0];
  const weakest = cardPower(weakestId, bm);

  /* ⑤ 筛选候选：传说档 + 买得起 + 比队内最弱强 + 还没练满
        -------------------------------------------------------------
        ★ 为什么不能"直接挑最强的"
        实测：只挑最强的话，AI 会**反复兑换同 6 张时刻紫卡**
        （阿伦·艾弗森被兑 29 次、魔术师 27 次、韦德 26 次），
        名宿紫和时刻金**一次都不会出现** —— 因为时刻紫永远最强。

        改成"超值区间内随机"：
          超值比 = (战力 − 队内最弱) / 价格
          只在最强的 5 张里随机挑一张。
        这样贵的卡仍然更容易入选（战力高），但便宜卡也有机会。 */
  const cands = [];
  CARDS.forEach((c) => {
    if (!exIsLegendary(c.tier)) return;                // 只兑传说档
    /* AI 不用祭品抵扣，且走 AI 专属价格（见 ECO.AI_EX_PRICE_MUL 的说明） */
    const cost = Math.round(exCostOf(c, 0) * (ECO.AI_EX_PRICE_MUL || 1));
    if (!(cost > 0) || cost > budget) return;
    if ((st.roster || []).indexOf(c.id) >= 0) return;  // 队里已经有了
    if ((bm[c.id] || 0) >= MAX_BREAK) return;          // 已练满，换了也没用
    const gain = cardPower(c.id, bm) - weakest;
    if (gain < ECO.MIN_UPGRADE) return;
    cands.push({ card: c, cost, gain, value: gain / cost });
  });
  if (!cands.length) return null;

  /* -------------------------------------------------------------
     ★ 三层选择策略（每一层都是为了解决一个实测出来的问题）
     -------------------------------------------------------------
     试过三种排法，记录一下为什么最终是这个：

     ① 只挑最强      → **反复兑同 6 张时刻紫**（艾弗森被兑 29 次），
                        名宿紫/时刻金一次都不出现（时刻紫永远最强）
     ② 按超值比排    → 反过来被便宜的卡霸榜（时刻金 2,400 打爆时刻紫 5,200），
                        时刻紫几乎不出现
     ③ 现在这一版    → **档位均摊 + 战力优先 + 小组随机**

     档位均摊：优先挑"和上次兑的档位不同"的候选（乘 1.25 权重）。
     这样一支队不会连着兑三张时刻紫，三种档位都会出现。
     ============================================================= */
  const lastT = st.exLastTier || '';
  cands.forEach((c) => {
    c.score = c.gain * (c.card.tier === lastT ? 1 : 1.6);
  });
  cands.sort((a, b) => b.score - a.score || b.value - a.value);
  const topN = Math.min(4, cands.length);
  const pickObj = cands[Math.floor(Math.random() * topN)];
  const pick = pickObj.card;
  const pickCost = pickObj.cost;

  /* ⑥ 成交：扣钱、进阵容、计数 +1 */
  st.coins -= pickCost;
  st.spent = (st.spent || 0) + pickCost;
  st.exCount = aiExToday(st) + 1;
  st.exLastTier = pick.tier;            // 档位均摊用
  if (typeof addCopy === 'function') addCopy(team.key, pick.id);
  /* 换掉队内最弱的，保持 10 人 */
  const roster = (st.roster || []).slice();
  const wi = roster.indexOf(weakestId);
  if (wi >= 0) roster[wi] = pick.id;
  else roster.push(pick.id);
  st.roster = roster;

  return { team, card: pick, price: pickCost };
}

function aiShopping(team) {
  const L = leagueState();
  const st = L.teams[team.key];
  if (!st || !st.auto) return null;
  // 越有钱越常逛市场：穷队偶尔看看，豪门天天盯着
  const wealth = Math.min(1, st.coins / 45000);
  const chance = Math.min(ECO.BUY_CHANCE_MAX,
    ECO.BUY_CHANCE + wealth * (ECO.BUY_CHANCE_MAX - ECO.BUY_CHANCE));
  if (Math.random() > chance) return null;
  const budget = st.coins * (1 - ECO.BUY_RESERVE);
  if (budget < 150) return null;

  const { starters, bench } = organizeRoster(st.roster);
  const all = starters.concat(bench);
  // 队内最弱的（用来判断"值不值得换"）
  const bm = teamBrkMap(team.key) || {};
  const weakestId = all.slice().sort((a, b) =>
    cardPower(a, bm) - cardPower(b, bm))[0];
  const weakest = cardPower(weakestId, bm);

  // 在买得起的里面挑最贵的（=最强的）
  let pick = null;
  L.market.forEach((m) => {
    if (m.p > budget) return;
    // 用本队自己的突破表估算他来了之后的战力（没练过就按档位默认值）
    if ((st.roster || []).indexOf(m.id) >= 0) return;  // 队里已经有了
    if (remainingOf(team.key, m.id) <= 0) return;      // 已买满 64 张
    if (cardPower(m.id, bm) < weakest + ECO.MIN_UPGRADE) return;
    if (!pick || cardPower(m.id) > cardPower(pick.id)) pick = m;
  });
  if (!pick) return null;

  const fromKey = pick.from;
  const r = buyFromMarket(st, pick.id, { buyerKey: team.key });
  if (!r.ok) return null;
  addCopy(team.key, pick.id);
  // 换掉最弱的那位，被换下的回到自由球员池（卖方的补人逻辑已在 buyFromMarket 里）
  st.roster = st.roster.filter((x) => x !== weakestId).concat([pick.id]);
  if (fromKey) {
    // 卖方已经被补进一个自由球员，这里把队内最弱的挤回自由池，维持 10 人
    const ss = L.teams[fromKey];
    if (ss && ss.roster.length > ECO.TEAM_SIZE) {
      const worst = ss.roster.slice().sort((a, b) => cardPower(a) - cardPower(b))[0];
      ss.roster = ss.roster.filter((x) => x !== worst);
      L.agents.push(worst);
    }
  } else {
    L.agents = L.agents.filter((x) => x !== pick.id);
  }
  L.agents.push(weakestId);
  st.buys++;
  st.spent += r.item.p;
  return { team, card: r.card, price: r.item.p, dropped: weakestId, from: fromKey };
}

/**
 * 卖球员（玩家和 AI 通用）。
 * 手续费 20%：挂牌价 10000 的球员，卖家实收 8000。
 * @returns {{ok:boolean, why?:string, gross?:number, net?:number, fee?:number}}
 */
function sellPlayer(id, seller) {
  const L = leagueState();
  const card = CARD_BY_ID[id];
  if (!card) return { ok: false, why: '找不到这张卡' };
  // 锁定的球员不可出售
  if (S.locked && S.locked[id]) {
    return { ok: false, why: `🔒 ${card.name} 已锁定，先解锁才能出售` };
  }
  const gross = marketPrice(card);
  const fee = Math.round(gross * ECO.SELL_FEE);
  const net = gross - fee;
  if (seller) seller.coins += net;
  // 卖掉的人回到自由球员池，AI 有机会接手
  if (L.agents.indexOf(id) < 0) L.agents.push(id);
  // 从市场上撤下旧的挂牌（他已经被买走了）
  L.market = L.market.filter((m) => m.id !== id);
  // 卖掉的人**立刻重新上架**，别人（包括 AI）可以马上买走
  L.market.push({ id, p: gross, from: null, sold: true });
  L.market.sort((a, b2) => a.p - b2.p);
  // 市场别无限膨胀：超过 60 人的话，把最便宜的挪回自由池
  if (L.market.length > 60) {
    const drop = L.market.splice(0, L.market.length - 60);
    drop.forEach((m) => { if (L.agents.indexOf(m.id) < 0) L.agents.push(m.id); });
  }
  return { ok: true, gross, fee, net, card };
}

/**
 * AI 球队练球员（突破升级）。
 * 和玩家用重复卡突破是一个道理，只是 AI 直接花支票。
 * 花费随等级指数增长，所以满突破（8 级）也要攒很久。
 */
function upgradeCost(id, level) {
  const base = marketPrice(CARD_BY_ID[id]);
  return Math.round(base * ECO.UPGRADE_BASE *
    Math.pow(ECO.UPGRADE_GROWTH, level) / 10) * 10;
}

function aiUpgrade(team) {
  const L = seasonState();
  const st = L.teams[team.key];
  if (!st || !st.auto || !st.roster || !st.roster.length) return null;
  // 越有钱越常练
  const wealth = Math.min(1, st.coins / 40000);
  const chance = ECO.UPGRADE_CHANCE + wealth * 0.35;
  if (Math.random() > chance) return null;
  const budget = st.coins * (1 - ECO.UPGRADE_RESERVE);
  if (budget < 200) return null;

  const map = teamBrkMap(team.key);
  // 挑「练了最划算」的：优先练队里最强、且还没满级的
  let best = null;
  st.roster.forEach((id) => {
    const c = CARD_BY_ID[id];
    if (!c) return;
    const lv = map[id] != null ? map[id] : defaultBrk(c);
    if (lv >= MAX_BREAK) return;                       // 已满突破
    const cost = upgradeCost(id, lv);
    if (cost > budget) return;
    // 战力越高越值得投资
    const value = cardPower(id, lv) / Math.max(1, cost / 1000);
    if (!best || value > best.value) best = { id, lv, cost, value, card: c };
  });
  if (!best) return null;

  st.coins -= best.cost;
  map[best.id] = best.lv + 1;
  st.upgrades = (st.upgrades || 0) + 1;
  st.spentUpgrade = (st.spentUpgrade || 0) + best.cost;
  return { team, card: best.card, from: best.lv, to: best.lv + 1, cost: best.cost };
}

/**
 * 一键卖光某个档位的所有卡。
 * ---------------------------------------------------------------
 * · 真的会卖：每张都走 sellPlayer()，按市场价扣 20% 手续费后进账
 * · 保护阵容：正在首发/替补里的卡默认不卖（否则一键下去球队就空了）
 * · 同一张卡有多份也会全部卖掉
 */
/**
 * 一键出售的批次定义。
 * 除了基础档位，还支持两个细分：
 *   momentGold   时刻金卡
 *   legendPurple 名宿紫卡（紫卡里的退役球员）
 */
const BULK_GROUPS = [
  { key: 'silver', label: '银卡', test: (c) => c.tier === 'silver' },
  { key: 'gold', label: '金卡', test: (c) => c.tier === 'gold' },
  // 注意：紫卡只算 tier==='purple'（普通紫卡，含现役和历史名宿），
  // **绝对不包含时刻紫卡**（时刻紫卡的 tier 是 momentPurple，是独立档位）
  { key: 'purple', label: '紫卡', test: (c) => c.tier === 'purple' },
  { key: 'momentGold', label: '时刻金卡', test: (c) => c.tier === 'momentGold' },
  { key: 'legendPurple', label: '名宿紫卡',
    test: (c) => c.tier === 'purple' && !c.current },
];
function bulkGroup(key) {
  return BULK_GROUPS.filter((g) => g.key === key)[0] || null;
}
/** 某个批次在「我的收藏」里的张数与到手金额 */
function bulkAgg(key) {
  const g = bulkGroup(key);
  if (!g) return { n: 0, net: 0 };
  let n = 0, net = 0;
  Object.keys(S.owned).forEach((id) => {
    const c = CARD_BY_ID[id];
    if (!c || !g.test(c)) return;
    if (S.locked && S.locked[id]) return;            // 锁定的不计入
    const h = holdings(id);
    if (!h.total) return;
    const price = marketPrice(c);
    n += h.total;
    net += (price - Math.round(price * ECO.SELL_FEE)) * h.total;
  });
  return { n, net };
}

function sellAllOfTier(tier, opts) {
  const o = opts || {};
  const L = leagueState();
  const lineup = new Set();
  try {
    const r = rosterIds();
    r.starters.concat(r.bench).forEach((id) => lineup.add(id));
  } catch (e) { /* 阵容读不到就不保护 */ }

  const grp = bulkGroup(tier);
  const pass = grp ? grp.test : ((c) => c.tier === tier);
  const ids = Object.keys(S.owned)
    .filter((id) => CARD_BY_ID[id] && pass(CARD_BY_ID[id]) && holdings(id).total > 0)
    .filter((id) => !(S.locked && S.locked[id]))     // 锁定的跳过
    .sort((a, b) => marketPrice(CARD_BY_ID[a]) - marketPrice(CARD_BY_ID[b]));

  let sold = 0, gross = 0, net = 0, skipped = 0;
  const skippedNames = [];
  ids.forEach((id) => {
    const h = holdings(id);
    if (!h.total) return;
    if (o.protectLineup !== false && lineup.has(id)) {
      skipped++;
      if (skippedNames.length < 3) skippedNames.push(CARD_BY_ID[id].name);
      return;
    }
    for (let i = 0; i < h.total; i++) {
      const r = sellPlayer(id);
      if (!r.ok) break;
      gross += r.gross; net += r.net; sold++;
    }
    delete S.owned[id];   // 整批卖光，直接移除
  });

  // 卖掉的人进自由池给 AI 接手（批量卖的时候不逐个上架，避免市场被刷爆，
  // 它们会在下一个联赛日随刷新自然出现）
  ids.forEach((id) => { if (L.agents.indexOf(id) < 0) L.agents.push(id); });
  S.coins += net;
  // 阵容里被卖掉的（如果没保护）要清理
  try {
    if (S.roster) {
      const soldSet = new Set(ids.filter((id) => !S.owned[id]));
      S.roster.starters = (S.roster.starters || []).filter((x) => !soldSet.has(x));
      S.roster.bench = (S.roster.bench || []).filter((x) => !soldSet.has(x));
    }
  } catch (e) { /* 阵容异常不影响卖卡 */ }

  if (sold > 0) {
    const label = grp ? grp.label : (TIERS[tier] ? TIERS[tier].name : tier);
    pushNews(`【我的球队】批量出售 ${sold} 张${label}，` +
      `实收 🪙${fmt(net)}（手续费 🪙${fmt(gross - net)}）`, 'deal',
      { mine: true, batch: tier, count: sold, price: net });
  }
  save();
  return { sold, gross, net, fee: gross - net, skipped, skippedNames,
    kinds: ids.length };
}

/**
 * 从收藏里扣掉一张。
 * ---------------------------------------------------------------
 * 注意：老存档里的 S.owned[id] 可能只有 dup / brk 而没有 got，
 * 原来的 `if (o.got > 1) ... else delete` 在 got 未定义时会
 * **直接把整张卡删掉**（undefined > 1 === false），卖 2 张结果全没了。
 * 这里统一处理，优先扣重复张数。
 */
function removeOneCopy(id) {
  const o = S.owned[id];
  if (!o) return false;
  const total = holdings(id).total;
  if (total <= 1) { delete S.owned[id]; return true; }
  if (typeof o.got !== 'number') o.got = total;
  o.got = Math.max(1, o.got - 1);
  if ((o.dup || 0) > 0) o.dup -= 1;
  else if ((o.brk || 0) > 0) { o.brk -= 1; o.dup = (o.dup || 0) + breakPerOf(CARD_BY_ID[id] ? CARD_BY_ID[id].tier : 'silver') - 1; }
  return true;
}

/* ---------- 新闻 ---------- */
function pushNews(text, kind, meta) {
  const L = leagueState();
  L.news.unshift({ d: L.day, t: text, k: kind || 'info', m: meta || null });
  if (L.news.length > ECO.MAX_NEWS) L.news.length = ECO.MAX_NEWS;
}

/* ---------- 比赛模拟（AI vs AI，轻量版） ---------- */
/** 单队得分：实力差 + 状态波动，让冷门真的会发生 */
function simScore(ovr, oppOvr, home) {
  const edge = (ovr - oppOvr) * ECO.EDGE;
  const form = (Math.random() - 0.5) * 2 * ECO.FORM;   // ±FORM 分波动
  const base = 104 + edge + form + (home ? ECO.HOME_BONUS : 0);
  return Math.max(76, Math.min(158, Math.round(base)));
}

/** 一场 AI 比赛，返回结果对象 */
function simGame(homeKey, awayKey) {
  const L = leagueState();
  const h = L.teams[homeKey], a = L.teams[awayKey];
  const ho = rosterOvr(h.roster), ao = rosterOvr(a.roster);
  let hs = simScore(ho, ao, true);
  let as = simScore(ao, ho, false);
  if (hs === as) hs += Math.random() < 0.5 ? 2 : -2;   // 不允许平局
  const homeWin = hs > as;
  const win = homeWin ? h : a, lose = homeWin ? a : h;
  const winOvr = homeWin ? ho : ao, loseOvr = homeWin ? ao : ho;
  // 奖金：赢球和对手强度挂钩，输球有出场费
  const winPay = Math.round(ECO.WIN_BASE + (loseOvr - 80) * ECO.WIN_PER_OVR
    + Math.random() * 160);
  const losePay = Math.round(ECO.LOSE_BASE + (winOvr - 80) * ECO.WIN_PER_OVR * 0.4
    + Math.random() * 90);
  win.coins += Math.max(200, winPay);
  lose.coins += Math.max(80, losePay);
  // 工资：赢球奖金之外的另一半经济，防止支票无限堆积
  [h, a].forEach((t) => {
    const wage = Math.round(t.roster.reduce((x, id) => x + cardPower(id), 0)
      * ECO.WAGE_PER_POWER);
    t.coins = Math.max(0, t.coins - wage);
    t.wage = wage;
  });
  win.w++; lose.l++;
  return {
    home: homeKey, away: awayKey, hs, as, homeWin,
    winKey: homeWin ? homeKey : awayKey,
    winPay: Math.max(200, winPay), losePay: Math.max(80, losePay),
  };
}

/** 本场最佳球员（赢球方得分最高的） */
function gameTopPerformer(winKey) {
  const st = leagueState().teams[winKey];
  const ids = st.roster.slice();
  if (!ids.length) return null;
  // 用战力加权随机，强的更容易当选
  let best = ids[0], bestScore = -1;
  ids.forEach((id) => {
    const sc = cardPower(id) * (0.7 + Math.random() * 0.6);
    if (sc > bestScore) { bestScore = sc; best = id; }
  });
  return { id: best, pts: Math.round(14 + Math.random() * 26) };
}

/* ---------- 推进一个联赛日 ---------- */
/**
 * 一天做三件事：
 *   1. 30 队随机配对打 15 场，结算奖金
 *   2. 各队按概率去转会市场买人
 *   3. 生成几条新闻
 */
function advanceLeagueDay() {
  const L = leagueState();
  L.day++;
  try { if (typeof decayDemand === 'function') decayDemand(); } catch (e) {}
  // 赛季事件：全明星周末 / 交易截止日
  try {
    if (typeof eventOnDay === 'function') {
      const ev = eventOnDay(L.day);
      if (ev) {
        markEvent(ev, L.day);
        if (ev.key === 'allstar') {
          const picks = allStarPicks();
          const mine = picks.filter((x) => x.mine).length;
          /* ★ v9.29：入选者拿永久体力上限加成（见 quests.js 的 allStarBonusState）。
             刻意不写进 statsOf —— 评选本身走 statsOf，写进去会递归。 */
          const votedIn = [];
          picks.forEach((x) => {
            if (!x.mine) return;
            allStarBonusState()[x.card.id] = true;
            if (allStarVoted().indexOf(x.card.id) >= 0) votedIn.push(x.card.name);
          });
          pushNews(`⭐ 全明星周末！${mine
            ? '我的球队有 ' + mine + ' 人入选' + (votedIn.length
              ? '（你推荐的 ' + votedIn.join('、') + ' 成功入选，体力上限 +' + ALLSTAR_BONUS_STA + '）'
              : '')
            : '本届没有我的球员入选'}`, 'award', { mine: true });
          L.allStar = picks.map((x) => x.card.id);
        } else if (ev.key === 'deadline') {
          pushNews('📢 交易截止日到了，各队集中交易，市场格外热闹', 'deal');
          // 截止日：市场大刷新
          L.market = [];
          buildMarket(L);
        }
      }
    }
  } catch (e) {}
  const keys = NBA_TEAMS.map((t) => t.key);
  // 洗牌配对
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const results = [];
  for (let i = 0; i + 1 < keys.length; i += 2) {
    results.push(simGame(keys[i], keys[i + 1]));
  }
  L.lastResults = results;

  // 新闻：挑分差最大的 2 场 + 随机 1 场
  const sorted = results.slice().sort((a, b) =>
    Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as));
  const picked = new Set();
  sorted.slice(0, 2).forEach((r) => picked.add(r));
  if (sorted.length > 2) picked.add(sorted[2 + Math.floor(Math.random() * (sorted.length - 2))]);
  picked.forEach((r) => {
    const w = TEAM_BY_KEY[r.winKey];
    const lk = r.winKey === r.home ? r.away : r.home;
    const l = TEAM_BY_KEY[lk];
    const ws = r.winKey === r.home ? r.hs : r.as;
    const ls = r.winKey === r.home ? r.as : r.hs;
    const top = gameTopPerformer(r.winKey);
    const tn = top ? CARD_BY_ID[top.id].name : '';
    const blow = Math.abs(ws - ls) >= 18;
    pushNews(`${w.name} ${ws}:${ls} ${l.name}${blow ? '（大胜）' : ''}` +
      `　${tn} 砍下 ${top ? top.pts : 20} 分`, 'game',
      { win: w.key, lose: l.key, ws, ls });
  });

  // AI 练球员（突破升级）
  const ups = [];
  NBA_TEAMS.forEach((t) => {
    if (t.key === L.myTeam) return;
    const u = aiUpgrade(t);
    if (u) ups.push(u);
  });
  ups.slice(0, 1).forEach((u) => {
    pushNews(`${u.team.name} 把 ${u.card.name} 练到 突${u.to}` +
      `（${u.from}→${u.to} 级，花费 🪙${fmt(u.cost)}）`, 'deal',
      { team: u.team.key, card: u.card.id, up: u.to });
  });

  // AI 买人
  const deals = [];
  NBA_TEAMS.forEach((t) => {
    if (t.key === L.myTeam) return;              // 玩家自己的队不自动买
    const r = aiShopping(t);
    if (r) deals.push(r);
  });
  deals.slice(0, 2).forEach((d) => {
    const from = d.from ? TEAM_BY_KEY[d.from] : null;
    pushNews(`${d.team.name} 以 🪙${fmt(d.price)} 签下 ${d.card.name}` +
      `（${TIERS[d.card.tier].name} · ${d.card.ovr}）` +
      (from ? `，从 ${from.name} 转会而来` : '，来自自由球员'), 'deal',
      { team: d.team.key, card: d.card.id, price: d.price, from: d.from });
  });

  /* ★ v9.49 AI 兑换传说档（用户要求，战报格式与买人一致）
     放在买人之后，这样同一天里"先逛市场、再逛兑换所"，
     预算已经被买人消耗过一轮，不会两条路径同时把钱花光。 */
  const exDeals = [];
  NBA_TEAMS.forEach((t) => {
    if (t.key === L.myTeam) return;              // 玩家自己的队不自动兑
    const r = aiExchangeShopping(t);
    if (r) exDeals.push(r);
  });
  exDeals.slice(0, 2).forEach((d) => {
    pushNews(`🎯 ${d.team.name} 用图鉴兑换所换到 ${d.card.name}` +
      `（${TIERS[d.card.tier].name} · ${d.card.ovr}），花费 🪙${fmt(d.price)}`, 'deal',
      { team: d.team.key, card: d.card.id, price: d.price, exchange: true });
  });

  if (!deals.length && !exDeals.length && Math.random() < 0.35) {
    pushNews('转会市场今日无重大交易，各队按兵不动。', 'quiet');
  }

  refreshMarket(false);
  S.league = L;
  save();
  return { results, deals, ups, exDeals };
}

/* ---------- 排行榜 ---------- */
function leagueStandings(conf) {
  const L = leagueState();
  return NBA_TEAMS
    .filter((t) => !conf || t.conf === conf)
    .map((t) => {
      const st = L.teams[t.key];
      return { team: t, w: st.w, l: st.l, ovr: rosterOvr(st.roster, st.brk),
        coins: st.coins, buys: st.buys, upgrades: st.upgrades || 0 };
    })
    .sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.ovr - a.ovr);
}

/* ---------- 自由球员 / 市场工具 ---------- */
function marketList() {
  const L = leagueState();
  return L.market.map((m) => ({ ...m, card: CARD_BY_ID[m.id] }));
}
function marketPriceOf(id) { return marketPrice(CARD_BY_ID[id]); }

/* =============================================================
   联赛 UI
   ============================================================= */
let lgTab = 'news';        // news | market | rank
let lgConf = '';           // '' | 东 | 西
let lgMarketPage = 0;
let lgMarketMode = 'buy';   // buy | sell | dev
let dvOnlyChanged = true;   // 能力变动页：只看有变动的 / 全部
let lgQuery = '';           // 搜索词（球员名 / 球队名 / 英文名）
let lgTier = 'all';         // 档位筛选：all|silver|gold|purple|momentGold|momentPurple|history
let lgQty = {};             // 买入时每张卡选了几张
let lgSellQty = {};         // 出售时每张卡选了几张

/** 某张卡最多能买几张：受「手里还差几张到 64」和「钱够买几张」双重限制 */
function lgMaxBuy(id, price) {
  const remain = remainingOf(SEASON.MY_KEY, id);
  if (remain <= 0) return 0;
  const afford = price > 0 ? Math.floor(S.coins / price) : remain;
  return Math.max(0, Math.min(remain, afford));
}
/** 取当前选中的数量（没选过就给 1） */
function lgQtyOf(id, max) {
  const q = lgQty[id] == null ? 1 : lgQty[id];
  return Math.max(1, Math.min(q, Math.max(1, max)));
}

/** 档位筛选项（历史紫卡 = 退役名宿的紫卡） */
const LG_TIERS = [
  ['all', '全部'], ['silver', '银卡'], ['gold', '金卡'], ['purple', '紫卡'],
  ['momentGold', '时刻金卡'], ['momentPurple', '时刻紫卡'], ['history', '历史名宿'],
];

/** 一个球员是否命中搜索条件 */
function lgMatch(card) {
  if (!card) return false;
  if (lgTier === 'history') { if (card.current) return false; }
  else if (lgTier !== 'all' && card.tier !== lgTier) return false;
  const q = lgQuery.trim().toLowerCase();
  if (!q) return true;
  return (card.name || '').toLowerCase().indexOf(q) >= 0
    || (card.en || '').toLowerCase().indexOf(q) >= 0
    || (card.team || '').toLowerCase().indexOf(q) >= 0
    || (card.pos || '').toLowerCase().indexOf(q) >= 0;
}
const LG_PER_PAGE = 8;

/** 球队小标（缩写 + 主色） */
function lgBadge(t, size) {
  const s = size || 30;
  return `<span class="lg-badge" style="width:${s}px;height:${s}px;
    background:linear-gradient(140deg,${t.c1},${t.c2});
    font-size:${Math.round(s * 0.36)}px">${t.abbr}</span>`;
}

function lgTabBtn(k, label, badge) {
  return `<button class="lg-tab${lgTab === k ? ' on' : ''}" data-lgtab="${k}">
    ${label}${badge ? `<i>${badge}</i>` : ''}</button>`;
}

/* =============================================================
   容器查找
   -------------------------------------------------------------
   「联赛」页签取消后，转会市场搬到了独立的 #scr-market 页，
   内容容器从 #lgBody 变成了 #mk-body。
   但买卖按钮的刷新逻辑还在找 #lgBody，拿到 null 就报错，
   表现就是"点了买入没反应 / 市场卡住"。
   这里统一走一个查找函数，两个容器都能用。
   ============================================================= */
function lgBox() {
  return document.getElementById('lgBody')
    || document.getElementById('mk-body')
    || document.getElementById('scr-market')
    || document.createElement('div');
}
/** 转会市场内容容器（旧名 lgBody 的替代） */
function mkBody() {
  return document.getElementById('mk-body')
    || lgBox()
    || document.createElement('div');
}

function renderLeague() {
  // 「联赛」页签已取消，内容并入生涯模式与转会页；
  // 这里做防御，避免残留调用拿到 null 报错。
  if (!document.getElementById('scr-league')) return;
  const el = document.getElementById('scr-league');
  if (!el) return;
  const L = leagueState();
  const myTeam = L.myTeam ? TEAM_BY_KEY[L.myTeam] : null;

  el.innerHTML = `<div class="lg">
    <div class="lg-head">
      <div class="lg-head-l">
        <b>🏆 ${seasonName(L.year)} 赛季
          <em class="lg-season-no">第 ${L.season || 1} / ${
            SEASON.END_YEAR - SEASON.START_YEAR + 1} 季</em></b>
        <span>${lgPhaseText(L)}</span>
      </div>
      <div class="lg-tabs">
        <button class="lg-tab" id="lgToCareer">📅 赛程 →生涯</button>
        ${lgTabBtn('news', '📰 战报', L.news.length)}
        ${lgTabBtn('market', '💰 转会市场', marketList().length)}
        ${lgTabBtn('rank', '📊 排名')}
        ${lgTabBtn('quest', '🎯 任务', dailyList().filter((i) =>
          i.done && !i.claimed).length + achList().filter((i) =>
          i.done && !i.claimed).length + dexList().filter((i) =>
          i.done && !i.claimed).length)}
        ${lgTabBtn('award', '🏅 奖项', (L.awards || []).length)}
        ${lgTabBtn('playoff', '🏆 季后赛')}
        ${lgTabBtn('history', '📜 历史')}
        ${(L.allStar && L.allStar.length)
          ? lgTabBtn('allstar', '⭐ 全明星') : ''}
      </div>
      <button class="lg-adv" id="lgAdv">${lgAdvLabel(L)}</button>
    </div>
    <div class="lg-body" id="lgBody"></div>
  </div>`;

  renderLeagueBody();

  const adv = document.getElementById('lgAdv');
  if (adv) adv.onclick = () => {
    Sfx.reveal('gold');
    const r = advanceSeason();
    let msg = '';
    if (r.newSeason) {
      Sfx.reveal('momentPurple');
      msg = `🎉 ${seasonName(r.newSeason.year)} 赛季开幕！`;
    } else if (r.finished) {
      msg = '已经打完 2056 赛季，传奇落幕 🏁';
    } else if (r.roundResult) {
      msg = `第 ${r.round} 轮结束：15 场比赛`;
    } else if (r.playoff) {
      msg = `${ROUND_NAME[r.playoff.round]}结束`;
    }
    if (r.awards && r.awards.length) msg += ` · 颁发 ${r.awards.length} 个奖项`;
    if (r.seeds) msg = '常规赛结束，季后赛对阵已生成！';
    toast(msg || '已推进');
    renderLeague();
  };
  el.querySelectorAll('.lg-tab').forEach((b) => {
    b.onclick = () => { Sfx.click(); lgTab = b.dataset.lgtab; lgMarketPage = 0; renderLeague(); };
  });
}

function renderLeagueBody() {
  const box = lgBox();
  if (!box) return;
  if (lgTab === 'news') box.innerHTML = lgNewsHTML();
  else if (lgTab === 'market') box.innerHTML = lgMarketHTML();
  else if (lgTab === 'award') box.innerHTML = lgAwardHTML();
  else if (lgTab === 'playoff') box.innerHTML =
    (typeof bracketHTML === 'function') ? bracketHTML() : lgPlayoffHTML();
  else if (lgTab === 'quest') box.innerHTML = questHTML();
  else if (lgTab === 'history') box.innerHTML = historyHTML();
  else if (lgTab === 'allstar') box.innerHTML = allStarHTML();
  else box.innerHTML = lgRankHTML();
  bindLeagueBody();
  if (lgTab === 'quest') bindQuest();
  if (lgTab === 'allstar') bindAllStar();      // ⭐ 全明星推荐（v9.29）
  // 能力变动页的「只看变动 / 全部」切换
  box.querySelectorAll('[data-dvonly]').forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      dvOnlyChanged = (b.dataset.dvonly === '1');
      renderLeagueBody();
    };
  });
  // 能力变动视图：点卡面看球员详情
  box.querySelectorAll('.dv-face[data-crcard]').forEach((f) => {
    f.onclick = () => {
      Sfx.click();
      try { openDetail(f.dataset.crcard, false, true, 0); } catch (e) {}
    };
  });
  const lc = document.getElementById('lgToCareer');
  if (lc) lc.onclick = () => {
    Sfx.click();
    if (typeof switchTab === 'function') switchTab('battle');
    toast('赛程已并入「生涯」页');
  };
  if (lgTab === 'playoff') bindBracket();
}

/* ---------- 战报 ---------- */
function lgNewsHTML() {
  const L = leagueState();
  if (!L.news.length) return '<div class="lg-empty">还没有战报，点右上角「推进联赛日」开始。</div>';
  const icon = { game: '🏀', deal: '💰', info: '📣', quiet: '·' };
  return `<div class="lg-list">${L.news.map((n) => {
    const cls = n.k === 'deal' ? 'deal' : n.k === 'game' ? 'game' : 'info';
    const w = n.m && n.m.win ? TEAM_BY_KEY[n.m.win] : null;
    const l = n.m && n.m.lose ? TEAM_BY_KEY[n.m.lose] : null;
    return `<div class="lg-news ${cls}">
      <span class="lg-news-d">D${n.d}</span>
      <span class="lg-news-i">${icon[n.k] || '·'}</span>
      ${w && l ? lgBadge(w, 22) + lgBadge(l, 22) : ''}
      <span class="lg-news-t">${n.t}</span>
    </div>`;
  }).join('')}</div>`;
}

/* ---------- 转会市场 ---------- */
/* =============================================================
   AI 主动出价（v8.6）
   -------------------------------------------------------------
   原来的转会市场只有玩家单方面买卖 —— 你挂牌、你出价，AI 只是被动接盘。
   这里补一层「收件箱」：AI 球队会主动看中你的球员并报价，你决定卖不卖。

   设计要点：
     · 报价给的是市价的 88%~125%。而「即时出售」要扣 20% 手续费（只拿 80%），
       所以收件箱里的报价通常更划算 —— 这就是玩家愿意等报价的理由。
     · 只对「不在首发五人里、且没上锁」的球员报价，避免 AI 挖你主力。
     · 最多同时挂 3 条；每 2 个联赛日补一批。
   ============================================================= */
const LG_OFFER_MAX = 3;

function lgOffers() {
  if (!Array.isArray(S.tradeOffers)) S.tradeOffers = [];
  return S.tradeOffers;
}

/** 可以被 AI 看上的球员：拥有、非首发、未上锁 */
function lgOfferCandidates() {
  const r = (typeof rosterIds === 'function') ? rosterIds() : { starters: [], bench: [] };
  const keep = {};
  (r.starters || []).forEach((id) => { if (id) keep[id] = 1; });
  return CARDS.filter((c) => {
    if (!S.owned[c.id]) return false;
    if (keep[c.id]) return false;                    // 首发不卖
    if (S.locked && S.locked[c.id]) return false;    // 玩家上锁的不碰
    return true;
  });
}

/** 补一批报价。force=true 时无视「每 2 天」的限制（调试用） */
function lgOffersRefresh(force) {
  const L = leagueState();
  const list = lgOffers();
  /* 卡已经没了（卖了/换出去了）→ 撤掉这条报价 */
  for (let i = list.length - 1; i >= 0; i--) {
    if (!S.owned[list[i].id]) list.splice(i, 1);
  }
  if (list.length >= LG_OFFER_MAX) return 0;
  if (!force && L.day % 2 !== 0) return 0;
  const used = {};
  list.forEach((o) => { used[o.id] = 1; });
  const pool = lgOfferCandidates().filter((c) => !used[c.id]);
  if (!pool.length) return 0;
  const teams = Object.keys(L.teams || {});
  const n = Math.min(LG_OFFER_MAX - list.length, 1 + Math.floor(Math.random() * 2));
  let made = 0;
  for (let i = 0; i < n && pool.length; i++) {
    const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const base = (typeof marketPrice === 'function') ? marketPrice(c) : 1000;
    const mul = 0.88 + Math.random() * 0.37;          // 88% ~ 125%
    const from = teams.length ? teams[Math.floor(Math.random() * teams.length)] : '';
    list.push({
      oid: 'o' + L.day + '_' + Date.now().toString(36) + i,
      id: c.id,
      p: Math.max(10, Math.round(base * mul / 10) * 10),
      from: from,
      day: L.day,
    });
    made++;
  }
  if (made) { S.offerSeen = 0; save(); }
  return made;
}

function lgOfferTeamName(key) {
  if (!key) return '某支球队';
  /* ★ 必须查 TEAM_BY_KEY（球队定义表，有中文 name），
     不能查 leagueState().teams[key] —— 那是**联赛状态**对象（战绩/阵容），
     里面没有 name 字段，取不到就会回退成原始 key，
     界面上就显示成「来自：phx」这种英文缩写。 */
  const t = (typeof TEAM_BY_KEY !== 'undefined') ? TEAM_BY_KEY[key] : null;
  if (t && t.name) return t.name;
  const st = (leagueState().teams || {})[key];
  return (st && st.name) || key;
}

function lgOffersHTML() {
  const list = lgOffers();
  if (!list.length) {
    return `<div class="lg-empty">暂无球队报价。<br>
      推进联赛日程，AI 球队会看中你替补席上的球员并主动出价。</div>`;
  }
  return `<div class="of-list">${list.map((o) => {
    const c = CARD_BY_ID[o.id];
    if (!c) return '';
    const T = TIERS[c.tier];
    const market = (typeof marketPrice === 'function') ? marketPrice(c) : o.p;
    const instant = Math.round(market * 0.8);         // 即时出售能拿到的（扣 20% 手续费）
    const better = o.p - instant;
    return `<div class="of-row" data-of="${o.oid}">
      <div class="of-card">
        <img src="${c.photo}" alt="" loading="lazy"
          onerror="this.style.display='none'">
      </div>
      <div class="of-mid">
        <b>${c.name}</b>
        <span>${c.team} · ${T.name} · 综合 ${c.ovr}</span>
        <em>来自：${lgOfferTeamName(o.from)}</em>
      </div>
      <div class="of-right">
        <div class="of-price">🪙 ${fmt(o.p)}</div>
        <div class="of-cmp${better > 0 ? ' up' : ''}">${
          better > 0 ? '比即时出售多 ' + fmt(better) : '与即时出售相当'}</div>
        <div class="of-btns">
          <button class="of-btn ok" data-ofok="${o.oid}">接受</button>
          <button class="of-btn no" data-ofno="${o.oid}">拒绝</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function lgOfferAccept(oid) {
  const list = lgOffers();
  const i = list.findIndex((o) => o.oid === oid);
  if (i < 0) return false;
  const o = list[i];
  const c = CARD_BY_ID[o.id];
  if (!c || !S.owned[o.id]) {
    list.splice(i, 1); save(); renderLeagueBody();
    toast('这名球员已经不在了');
    return false;
  }
  if (typeof removeOneCopy === 'function') removeOneCopy(o.id);
  else delete S.owned[o.id];
  S.coins += o.p;
  list.splice(i, 1);
  save();
  if (typeof Sfx !== 'undefined' && Sfx.reveal) Sfx.reveal('gold');
  toast('✅ 成交：' + c.name + ' → 金币 +' + fmt(o.p));
  if (typeof renderLeagueBody === 'function') renderLeagueBody();
  return true;
}

function lgOfferDecline(oid) {
  const list = lgOffers();
  const i = list.findIndex((o) => o.oid === oid);
  if (i < 0) return false;
  const c = CARD_BY_ID[list[i].id];
  list.splice(i, 1);
  save();
  Sfx.click();
  toast('已拒绝' + (c ? '：' + c.name : '') + ' 的报价');
  renderLeagueBody();
  return true;
}

function lgMarketHTML() {
  const L = leagueState();
  const search = `<div class="lg-search">
      <span class="lg-search-i">🔍</span>
      <input id="lgQ" type="search" placeholder="搜球员名 / 球队名 / 英文名…"
        value="${lgQuery.replace(/"/g, '&quot;')}" autocomplete="off">
      ${lgQuery ? '<button class="lg-search-x" id="lgQx">✕</button>' : ''}
    </div>
    <div class="lg-tierchips">
      ${LG_TIERS.map(([k, n]) => `<button class="lg-chip${
        lgTier === k ? ' on' : ''}" data-lgtier="${k}">${n}</button>`).join('')}
    </div>`;
    const devN = (seasonState().devLog || []).length;
    const ofN = lgOffers().length;
    const head = `<div class="lg-mk-switch">
      <button class="lg-mks${lgMarketMode === 'buy' ? ' on' : ''}" data-lgmks="buy">
        🛒 买入球员</button>
      <button class="lg-mks${lgMarketMode === 'sell' ? ' on' : ''}" data-lgmks="sell">
        💸 出售球员<i>手续费 20%</i></button>
      <button class="lg-mks${lgMarketMode === 'offers' ? ' on' : ''}" data-lgmks="offers">
        📨 球队出价${ofN ? `<i>${ofN}</i>` : ''}</button>
      <button class="lg-mks${lgMarketMode === 'dev' ? ' on' : ''}" data-lgmks="dev">
        📈 能力变动${devN ? `<i>${devN}</i>` : ''}</button>
    </div>`;
  // 能力变动视图（不需要搜索框和档位筛选）
  if (lgMarketMode === 'dev') {
    return head + (typeof lgDevHTML === 'function'
      ? lgDevHTML() : '<div class="lg-empty">能力变动不可用</div>');
  }
  if (lgMarketMode === 'offers') {
    lgOffersRefresh(false);
    return head + lgOffersHTML();
  }
  if (lgMarketMode === 'sell') return head + search + lgSellHTML();
  const all = marketList();
  const list = all.filter((m) => lgMatch(m.card));
  // 市场本身为空时给个提示（筛选后为空走下面的分支）
  if (!all.length) return head + search +
    '<div class="lg-empty">市场暂时没有挂牌球员，推进一个联赛日再看看。</div>';
  const pages = Math.max(1, Math.ceil(list.length / LG_PER_PAGE));
  if (lgMarketPage >= pages) lgMarketPage = 0;
  const slice = list.slice(lgMarketPage * LG_PER_PAGE, (lgMarketPage + 1) * LG_PER_PAGE);
  if (!list.length) {
    return head + search + `<div class="lg-empty">没有符合条件的球员。<br>
      换个关键词，或者点「全部」看看今日挂牌的 ${all.length} 人。</div>`;
  }
  return head + search + `
    <div class="lg-mk-head">
      <span>${lgQuery || lgTier !== 'all' ? '搜索到' : '今日挂牌'} <b>${list.length}</b> 人${
        lgQuery ? '（关键词「' + lgQuery + '」）' : ''}</span>
      <span class="lg-mk-note">每推进一天刷新一批 · 买到的球员直接进你的收藏</span>
    </div>
    <div class="lg-mk-grid">
      ${slice.map((m) => lgMarketCard(m)).join('')}
    </div>
    ${pages > 1 ? `<div class="lg-pager">
      <button class="lg-pg" data-lgpg="-1" ${lgMarketPage === 0 ? 'disabled' : ''}>‹</button>
      <span>第 ${lgMarketPage + 1} / ${pages} 页</span>
      <button class="lg-pg" data-lgpg="1" ${lgMarketPage >= pages - 1 ? 'disabled' : ''}>›</button>
    </div>` : ''}`;
}

function lgMarketCard(m) {
  const c = m.card;
  const hold = holdings(c.id);
  const own = hold.total;
  const cap = cardLimitOf(c.id);
  const remain = Math.max(0, cap - own);
  const full = remain <= 0;                 // 已买满 64 张（满突破）
  const maxBuy = lgMaxBuy(c.id, m.p);       // 一次最多能买几张
  const qty = lgQtyOf(c.id, maxBuy);        // 当前选中的张数
  const afford = maxBuy > 0 && S.coins >= m.p * qty;
  const t = TIERS[c.tier];
  /* ★ 交易截止日特供标记（v9.29）：只在当天出现，85 折，买一张其余下架 */
  const dl = m.deadline
    ? `<div class="lg-mk-deadline" title="交易截止日特供：只在今天出现，各队急于出手">⏰ 截止日特供 · 85折</div>`
    : '';
  return `<div class="lg-mk-card${m.deadline ? ' deadline' : ''}" data-lgid="${m.id}" style="--t1:${t.c1};--t2:${t.c2}">
    ${dl}
    <div class="lg-mk-img"><img src="${c.photo}" alt="" loading="lazy"
      onerror="this.style.visibility='hidden'"></div>
    <div class="lg-mk-info">
      <div class="lg-mk-nm">${c.name}</div>
      <div class="lg-mk-meta">
        <span class="lg-mk-ovr">${c.ovr}</span>
        <span class="lg-mk-tier" style="color:${t.c1}">${t.name}</span>
        <span class="lg-mk-pos">${c.pos}</span>
        ${own ? `<span class="lg-mk-own">已有×${own}</span>` : ''}
      </div>
      <div class="lg-mk-team">${c.team}</div>
      <div class="lg-mk-quota${full ? ' full' : ''}">
        ${full
          ? `🔒 已满 ${cap}/${cap} 张 · 满突破，不可再买`
          : `可购 <b>${remain}</b>/${cap} 张${
              hold.brk ? ` · 突${hold.brk}/8` : ''}`}
      </div>
    </div>
    ${full ? `<button class="lg-buy no" disabled>已买满</button>` : `
    <div class="lg-buybox">
      <div class="lg-qty">
        <button class="lg-qb" data-lgq="-1" data-lgqid="${m.id}">−</button>
        <input class="lg-qi" id="q_${m.id}" type="number" inputmode="numeric"
          min="1" max="${maxBuy}" value="${qty}" data-lgqid="${m.id}">
        <button class="lg-qb" data-lgq="1" data-lgqid="${m.id}">＋</button>
      </div>
      <button class="lg-buy${afford ? '' : ' no'}" data-lgid="${m.id}"
        data-qty="${qty}">
        ${afford ? '🪙' + fmt(m.p * qty) : '钱不够'}
      </button>
      <span class="lg-qmax" data-lgqmax="${m.id}">最多 ${maxBuy} 张</span>
    </div>`}
  </div>`;
}

/** 出售页：列出玩家自己拥有的球员，标出实收多少 */
function lgSellHTML() {
  const rows = Object.keys(S.owned)
    .map((id) => ({ id, card: CARD_BY_ID[id], hold: holdings(id) }))
    .filter((r) => r.card && r.hold.total > 0 && lgMatch(r.card))
    .sort((a, b) => marketPrice(b.card) - marketPrice(a.card));
  if (!rows.length) {
    const tip = (lgQuery || lgTier !== 'all')
      ? '没有符合条件的球员，换个关键词或点「全部」试试。'
      : '你还没有球员卡，先去「招募」抽几张吧。';
    return `<div class="lg-empty">${tip}</div>`;
  }
  const pages = Math.ceil(rows.length / LG_PER_PAGE);
  if (lgMarketPage >= pages) lgMarketPage = 0;
  const slice = rows.slice(lgMarketPage * LG_PER_PAGE, (lgMarketPage + 1) * LG_PER_PAGE);
  const total = rows.reduce((s, r) => s + marketPrice(r.card) * r.hold.total, 0);
  const netTotal = Math.round(total * (1 - ECO.SELL_FEE));
  return `
    <div class="lg-bulk">
      ${BULK_GROUPS.map((g) => {
        const a = bulkAgg(g.key);
        return `<button class="lg-bulkbtn ${g.key}" data-bulk="${g.key}"
            ${a.n ? '' : 'disabled'}>
          🗑️ 一键卖光${g.label}
          <b>${a.n} 张 · 可得 🪙${fmt(a.net)}</b></button>`;
      }).join('')}
      <span class="lg-bulk-note">阵容里的球员不会被卖掉 · 手续费 20%</span>
    </div>
    <div class="lg-mk-head">
      <span>可出售 <b>${rows.length}</b> 种 · 共 ${rows.reduce((s, r) => s + r.hold.total, 0)} 张</span>
      <span class="lg-mk-note">全部卖出可得 🪙${fmt(netTotal)}（已扣 20% 手续费）</span>
    </div>
    <div class="lg-mk-grid">
      ${slice.map((r) => {
        const gross = marketPrice(r.card);
        const net = gross - Math.round(gross * ECO.SELL_FEE);
        const t = TIERS[r.card.tier];
        const sqty = Math.max(1, Math.min(r.hold.total, lgSellQty[r.id] || 1));
        return `<div class="lg-mk-card sell" data-lgid="${r.id}"
            style="--t1:${t.c1};--t2:${t.c2}">
          <div class="lg-mk-img"><img src="${r.card.photo}" alt="" loading="lazy"
            onerror="this.style.visibility='hidden'"></div>
          <div class="lg-mk-info">
            <div class="lg-mk-nm">${r.card.name}</div>
            <div class="lg-mk-meta">
              <span class="lg-mk-ovr">${r.card.ovr}</span>
              <span class="lg-mk-tier" style="color:${t.c1}">${t.name}</span>
              <span class="lg-mk-own">持有×${r.hold.total}</span>
              ${(S.locked && S.locked[r.id]) ? '<span class="lg-mk-lock">🔒锁定</span>' : ''}
            </div>
            <div class="lg-mk-team">${r.card.team} · 挂牌价 🪙${fmt(gross)}</div>
          </div>
          <div class="lg-buybox">
            <div class="lg-qty">
              <button class="lg-sqb" data-lgsq="-1" data-lgsqid="${r.id}">−</button>
              <input class="lg-sqi" id="s_${r.id}" type="number" inputmode="numeric"
                min="1" max="${r.hold.total}" value="${sqty}" data-lgsqid="${r.id}">
              <button class="lg-sqb" data-lgsq="1" data-lgsqid="${r.id}">＋</button>
            </div>
            <button class="lg-sell" data-lgsell="${r.id}" data-sqty="${sqty}">
              卖 ${sqty} 张 · 🪙${fmt(net * sqty)}</button>
            <span class="lg-qmax">持有 ${r.hold.total} 张</span>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${pages > 1 ? `<div class="lg-pager">
      <button class="lg-pg" data-lgpg="-1" ${lgMarketPage === 0 ? 'disabled' : ''}>‹</button>
      <span>第 ${lgMarketPage + 1} / ${pages} 页</span>
      <button class="lg-pg" data-lgpg="1" ${lgMarketPage >= pages - 1 ? 'disabled' : ''}>›</button>
    </div>` : ''}`;
}

/* ---------- 排名 ---------- */
function lgRankHTML() {
  const L = seasonState();
  const rows = lgConf ? confStandings(lgConf) : leagueStandings().map((r) => ({
    key: r.team.key, w: r.w, l: r.l, ovr: r.ovr, coins: r.coins, buys: r.buys,
  }));
  const myKey = SEASON.MY_KEY;
  return `<div class="lg-rank-tabs">
      <button class="lg-rt${lgConf === '' ? ' on' : ''}" data-lgconf="">全部</button>
      <button class="lg-rt${lgConf === '东' ? ' on' : ''}" data-lgconf="东">东部</button>
      <button class="lg-rt${lgConf === '西' ? ' on' : ''}" data-lgconf="西">西部</button>
      ${lgConf ? '<span class="lg-playoff-cut">前 8 名进季后赛</span>' : ''}
    </div>
    ${(L.history && L.history.length) ? `<div class="lg-history">
      <div class="lg-history-t">📜 历届总冠军</div>
      <div class="lg-history-list">${L.history.map((h) => {
        const champ = h.champion ? anyTeamInfo(h.champion) : null;
        return `<div class="lg-hi${h.champion === SEASON.MY_KEY ? ' mine' : ''}">
          <b>${seasonName(h.year)}</b>
          ${champ ? lgBadge(champ, 18) : ''}
          <span>${champ ? champ.name : '—'}</span>
          <em>我的战绩 ${h.myW}胜${h.myL}负${
            h.mySeed ? ' · 第' + h.mySeed + '种子' : ''}${
            h.awards ? ' · ' + h.awards + '个奖' : ''}</em>
        </div>`;
      }).join('')}</div>
    </div>` : ''}
    <div class="lg-rank">
      <div class="lg-rank-h"><span>#</span><span>球队</span><span>战绩</span>
        <span>评分</span><span>支票</span><span>签/练</span></div>
      ${rows.map((r, i) => {
        const t = anyTeamInfo(r.key);
        const st = L.teams[r.key] || {};
        return `<div class="lg-rk${r.key === myKey ? ' mine' : ''}${
          lgConf && i < 8 ? ' cut' : ''}">
        <span class="lg-rk-i">${i + 1}</span>
        <span class="lg-rk-t">${lgBadge(t, 24)}<b>${t.name}</b>
          <em>${t.conf}部</em></span>
        <span class="lg-rk-w">${r.w}胜 ${r.l}负</span>
        <span class="lg-rk-o">${r.ovr.toFixed(1)}</span>
        <span class="lg-rk-c">${r.key === myKey ? '🪙' + fmt(S.coins)
          : '🪙' + fmt(st.coins || 0)}</span>
        <span class="lg-rk-b">${st.buys || 0}<em>/${st.upgrades || 0}</em></span>
      </div>`; }).join('')}
    </div>`;
}

/** 搜索头（切换买卖时复用） */
function lgSearchHeadHTML() {
  return `<div class="lg-mk-switch">
      <button class="lg-mks${lgMarketMode === 'buy' ? ' on' : ''}" data-lgmks="buy">
        🛒 买入球员</button>
      <button class="lg-mks${lgMarketMode === 'sell' ? ' on' : ''}" data-lgmks="sell">
        💸 出售球员<i>手续费 20%</i></button>
      <button class="lg-mks${lgMarketMode === 'offers' ? ' on' : ''}" data-lgmks="offers">
        📨 球队出价${lgOffers().length ? `<i>${lgOffers().length}</i>` : ''}</button>
    </div>
    <div class="lg-search">
      <span class="lg-search-i">🔍</span>
      <input id="lgQ" type="search" placeholder="搜球员名 / 球队名 / 英文名…"
        value="${lgQuery.replace(/"/g, '&quot;')}" autocomplete="off">
      ${lgQuery ? '<button class="lg-search-x" id="lgQx">✕</button>' : ''}
    </div>
    <div class="lg-tierchips">
      ${LG_TIERS.map(([k, n]) => `<button class="lg-chip${
        lgTier === k ? ' on' : ''}" data-lgtier="${k}">${n}</button>`).join('')}
    </div>`;
}
/** 搜索时只重绑列表里的事件，不动输入框 */
function bindLeagueBodySoft() {
  const box = lgBox();
  if (!box) return;
  bindLeagueBody();
}

/* ---------- 事件绑定 ---------- */
function bindLeagueBody() {
  const box = lgBox();
  if (!box) return;
  // 买人
  box.querySelectorAll('.lg-buy').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.lgid;
      const item = marketList().find((m) => m.id === id);
      if (!item) { toast('这名球员已经被买走了'); renderLeague(); return; }
      const card = item.card;

      // 按选中的数量算总价（不是单价）
      const n = Math.max(1, parseInt(b.dataset.qty, 10) || 1);
      const total = item.p * n;
      if (S.coins < total) {
        Sfx.fail();
        toast(`支票不够：需要 🪙${fmt(total)}，还差 🪙${fmt(total - S.coins)}`);
        return;
      }
      const okCfm = await uiConfirm({ title: "确认签约", body: `签下 ${card.name} × ${n} 张？\n\n` +
        `单价 🪙${fmt(item.p)} × ${n} = 合计 🪙${fmt(total)}\n` +
        `档位 ${TIERS[card.tier].name} · 综合 ${card.ovr}\n\n` +
        `签约后球员直接进入你的收藏，可用于阵容。`, yes: "签 下" });
        if (!okCfm) return;

      // 逐张买（每买一张就扣一次钱、走一次 64 张上限校验）
      const who = { get coins() { return S.coins; }, set coins(v) { S.coins = v; } };
      let done = 0, spent = 0;
      for (let k = 0; k < n; k++) {
        const rr = buyFromMarket(who, id, { buyerKey: SEASON.MY_KEY });
        if (rr.ok) { try { bumpDemand(id, 1); } catch (e2) {} }
        if (!rr.ok) {
          if (k === 0) { Sfx.fail(); toast(rr.why); return; }
          break;   // 买到一半到上限/没钱了就停，已买到的照常入账
        }
        done++; spent += rr.item.p;
      }
      if (!done) { Sfx.fail(); toast('购买失败'); return; }

      // 进收藏
      const cur = S.owned[id] || { got: 0, dup: 0, brk: 0 };
      cur.got = (cur.got || 0) + done;
      cur.dup = (cur.dup || 0) + done;
      S.owned[id] = cur;

      // 发新闻（这里原来引用了已删掉的变量 r，会抛 ReferenceError）
      pushNews(`【我的球队】以 🪙${fmt(spent)} 签下 ${card.name} ×${done}` +
        `（${TIERS[card.tier].name} · ${card.ovr}）`, 'deal',
        { mine: true, card: id, price: spent });

      Sfx.reveal('momentGold');
      toast(`签约成功！${card.name} ×${done} 张（共 🪙${fmt(spent)}）` +
        (done < n ? `，后 ${n - done} 张因上限/余额不足未成交` : '') +
        '，已进入你的收藏');
      lgQty[id] = 1;
      save();
      renderLeagueBody();
    };
  });
  // 数量 −/+ （只重绘这张卡的按钮，不整页刷新）
  box.querySelectorAll('.lg-qb').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.lgqid;
      const m = marketList().filter((x) => x.id === id)[0];
      if (!m) return;
      const mx = lgMaxBuy(id, m.p);
      const cur = lgQtyOf(id, mx);
      const next = Math.max(1, Math.min(mx, cur + parseInt(b.dataset.lgq, 10)));
      if (next === cur) return;
      lgQty[id] = next;
      Sfx.click();
      renderLeagueBody();
    };
  });
  // 手动输入数量
  box.querySelectorAll('.lg-qi').forEach((inp) => {
    inp.onclick = (e) => e.stopPropagation();
    inp.onchange = () => {
      const id = inp.dataset.lgqid;
      const m = marketList().filter((x) => x.id === id)[0];
      if (!m) return;
      const mx = lgMaxBuy(id, m.p);
      let v = parseInt(inp.value, 10) || 1;
      v = Math.max(1, Math.min(mx, v));
      lgQty[id] = v;
      renderLeagueBody();
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
  });
  // 详情（点卡片空白处）
  box.querySelectorAll('.lg-mk-card').forEach((el2) => {
    el2.onclick = (e) => {
      if (e.target.closest('.lg-qty') || e.target.closest('.lg-buy')) return;
      {
        const mid = el2.dataset.lgid;
        const mk = marketList().filter((x) => x.id === mid)[0];
        openDetail(mid, false, true, (mk && mk.brk) || 0);
      };
    };
  });
  // 搜索框（防抖，输入时不重绘整个输入框）
  const qi = document.getElementById('lgQ');
  if (qi) {
    let qt = null;
    qi.oninput = () => {
      clearTimeout(qt);
      qt = setTimeout(() => {
        lgQuery = qi.value;
        lgMarketPage = 0;
        // 只重绘列表部分，输入框保持焦点
        const box2 = lgBox();
        if (box2) {
          box2.innerHTML = lgMarketMode === 'sell'
            ? (lgSearchHeadHTML() + lgSellHTML())
            : lgMarketHTML();
          bindLeagueBodySoft();
        }
      }, 160);
    };
    qi.onkeydown = (e) => { if (e.key === 'Enter') qi.blur(); };
  }
  const qx = document.getElementById('lgQx');
  if (qx) qx.onclick = () => { Sfx.click(); lgQuery = ''; renderLeagueBody(); };
  box.querySelectorAll('.lg-chip').forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      lgTier = b.dataset.lgtier; lgMarketPage = 0; renderLeagueBody();
    };
  });

  // 买入 / 出售 / 球队出价 / 能力变动 切换
  box.querySelectorAll('.lg-mks').forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      lgMarketMode = b.dataset.lgmks; lgMarketPage = 0; renderLeagueBody();
    };
  });
  // 📨 球队出价：接受 / 拒绝（v8.6）
  box.querySelectorAll('.of-btn[data-ofok]').forEach((b) => {
    b.onclick = () => lgOfferAccept(b.dataset.ofok);
  });
  box.querySelectorAll('.of-btn[data-ofno]').forEach((b) => {
    b.onclick = () => lgOfferDecline(b.dataset.ofno);
  });
  // 一键卖光某个批次
  box.querySelectorAll('.lg-bulkbtn[data-bulk]').forEach((b) => {
    if (b.disabled) return;
    const key = b.dataset.bulk;
    const g = bulkGroup(key);
    if (!g) return;
    b.onclick = async () => {
      const agg = bulkAgg(key);
      if (!agg.n) { toast('没有可卖的' + g.label); return; }
      const okCfm = await uiConfirm({ title: "一键清仓", body: `一键卖光所有${g.label}？\n\n` +
        `共 ${agg.n} 张，扣掉 20% 手续费后实收约 🪙${fmt(agg.net)}\n\n` +
        `⚠️ 正在你阵容里的球员会保留，不会卖掉。\n此操作不可撤销。`, yes: "全部卖出" });
        if (!okCfm) return;
      const r = sellAllOfTier(key, { protectLineup: true });
      if (!r.sold) {
        Sfx.fail();
        toast(`没有可卖的${g.label}` +
          (r.skipped ? `（${r.skipped} 张在阵容里，已保留）` : ''));
        renderLeagueBody();
        return;
      }
      Sfx.coin();
      toast(`卖掉 ${r.sold} 张${g.label}，实收 🪙${fmt(r.net)}` +
        (r.skipped ? `（保留 ${r.skipped} 张在阵容里）` : ''));
      renderLeagueBody();
    };
  });

  // 出售数量 −/+
  box.querySelectorAll('.lg-sqb').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.lgsqid;
      const h = holdings(id);
      const cur = Math.max(1, Math.min(h.total, lgSellQty[id] || 1));
      const next = Math.max(1, Math.min(h.total, cur + parseInt(b.dataset.lgsq, 10)));
      if (next === cur) return;
      lgSellQty[id] = next;
      Sfx.click();
      renderLeagueBody();
    };
  });
  box.querySelectorAll('.lg-sqi').forEach((inp) => {
    inp.onclick = (e) => e.stopPropagation();
    inp.onchange = () => {
      const id = inp.dataset.lgsqid;
      const h = holdings(id);
      lgSellQty[id] = Math.max(1, Math.min(h.total, parseInt(inp.value, 10) || 1));
      renderLeagueBody();
    };
    inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
  });

  // 出售球员（扣 20% 手续费）
  box.querySelectorAll('.lg-sell').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.lgsell;
      const card = CARD_BY_ID[id];
      const h = holdings(id);
      if (!h.total) { toast('这张卡已经不在你手上了'); renderLeagueBody(); return; }
      const gross = marketPrice(card);
      const fee = Math.round(gross * ECO.SELL_FEE);
      const net = gross - fee;
      const inLineup = (() => {
        try {
          const r = rosterIds();
          return r.starters.includes(id) || r.bench.includes(id);
        } catch (err) { return false; }
      })();
      const wantN = Math.max(1, Math.min(h.total, parseInt(b.dataset.sqty, 10) || 1));
      if (!confirm(`出售 ${card.name} × ${wantN} 张？\n\n` +
        `单价 🪙${fmt(gross)}（扣 20% 手续费后 🪙${fmt(net)}）\n` +
        `合计实收 🪙${fmt(net * wantN)}\n\n` +
        `持有 ${h.total} 张，卖完还剩 ${h.total - wantN} 张` +
        (inLineup ? '\n\n⚠️ 他正在你的阵容里，卖掉后会自动换人' : ''))) return;
      // 按选中的数量卖
      const want = Math.max(1, Math.min(h.total, parseInt(b.dataset.sqty, 10) || 1));
      let sold = 0, cash = 0, feeSum = 0;
      for (let k = 0; k < want; k++) {
        const rr = sellPlayer(id);
        if (!rr.ok) { if (!k) { Sfx.fail(); toast(rr.why); return; } break; }
        sold++; cash += rr.net; feeSum += rr.fee;
        removeOneCopy(id);
      }
      if (!sold) { Sfx.fail(); toast('出售失败'); return; }
      // 从阵容里移除
      try {
        if (S.roster) {
          S.roster.starters = (S.roster.starters || []).filter((x) => x !== id);
          S.roster.bench = (S.roster.bench || []).filter((x) => x !== id);
        }
      } catch (err) { /* 阵容异常不影响卖卡 */ }
      S.coins += cash;
      pushNews(`【我的球队】出售 ${card.name} ×${sold}，实收 🪙${fmt(cash)}` +
        `（手续费 🪙${fmt(feeSum)}）`, 'deal', { mine: true, card: id, price: cash });
      Sfx.coin();
      toast(`已出售 ${card.name} ×${sold} 张，实收 🪙${fmt(cash)}` +
        `（扣手续费 🪙${fmt(feeSum)}）`);
      lgSellQty[id] = 1;
      save();
      renderLeagueBody();
    };
  });
  // 翻页
  box.querySelectorAll('.lg-pg').forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      lgMarketPage = Math.max(0, lgMarketPage + parseInt(b.dataset.lgpg, 10));
      renderLeagueBody();
    };
  });
  // 分区
  box.querySelectorAll('.lg-rt').forEach((b) => {
    b.onclick = () => { Sfx.click(); lgConf = b.dataset.lgconf; renderLeagueBody(); };
  });
  // 🏛️ 历史页的「名人堂」入口（v9.27）
  const hb = box.querySelector('#hsHofBtn');
  if (hb) hb.onclick = () => {
    Sfx.click();
    if (typeof openHof === 'function') openHof();
    else toast('名人堂模块没加载');
  };
}

/* ---------- 调试参数（?lgtab= / ?lgday= / ?lgtest=） ---------- */
(function leagueDebug() {
  try {
    const q = new URLSearchParams(location.search);
    const wantTab = q.get('lgtab');
    const days = parseInt(q.get('lgday') || '0', 10);
    if (!wantTab && !days && !q.get('lgtest')) return;
    if (wantTab) lgTab = wantTab;
    if (q.get('lgmk')) lgMarketMode = q.get('lgmk');   // buy | sell
    if (q.get('lgq')) lgQuery = q.get('lgq');
    if (q.get('lgtier')) lgTier = q.get('lgtier');
    setTimeout(() => {
      switchTab('league');
      if (days > 0) {
        for (let i = 0; i < days; i++) advanceSeason();
        renderLeague();
      }
      // 经济平衡体检
      if (q.get('lgtest')) {
        const t0 = Date.now();
        const DAYS = parseInt(q.get('lgtest'), 10) || 60;
        const startOvr = leagueStandings().map((r) => r.ovr);
        const sAvg = startOvr.reduce((x, y) => x + y, 0) / startOvr.length;
        for (let i = 0; i < DAYS; i++) advanceSeason();
        renderLeague();
        const L = leagueState();
        const rows = leagueStandings();
        const ovrs = rows.map((r) => r.ovr);
        const coins = rows.map((r) => r.coins);
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const top = rows[0], bot = rows[rows.length - 1];
        const buys = rows.reduce((s, r) => s + r.buys, 0);
        const news = L.news.length;
        // 市场里最贵和最便宜的
        const mk = marketList();
        document.title = 'LG ' + DAYS + '天(' + (Date.now() - t0) + 'ms)' +
          ' | 评分 初' + avg(startOvr).toFixed(1) + '→今' + avg(ovrs).toFixed(1) +
          '(' + Math.min(...ovrs).toFixed(1) + '~' + Math.max(...ovrs).toFixed(1) + ')' +
          ' | 支票 ' + Math.round(Math.min(...coins)) + '~' + Math.round(Math.max(...coins)) +
          '(均' + Math.round(avg(coins)) + ')' +
          ' | 总签约 ' + buys + ' 笔' +
          ' | 榜首 ' + top.team.abbr + ' ' + top.w + '胜' + top.l + '负' +
          ' 末位 ' + bot.team.abbr + ' ' + bot.w + '胜' + bot.l + '负' +
          ' | 市场 ' + mk.length + '人 ' + (mk.length ? ('🪙' + mk[0].p + '~' + mk[mk.length - 1].p) : '') +
          ' | 新闻 ' + news + '条' +
          ' | 自由球员 ' + L.agents.length;
      }
    }, 700);
  } catch (e) { document.title = 'LGERR ' + e.message; }
})();

/* =============================================================
   对战接入：把联赛里的某支球队变成可对战的对手
   ============================================================= */

/**
 * 给 AI 造一个球员对象。
 * 不能用 battleStats()——那个只认玩家**已拥有**的卡，
 * 联赛里的球员玩家大多没有，会全部返回 null 导致阵容为空。
 */
function mkAIPlayer(id, brkLevel) {
  const c = CARD_BY_ID[id];
  if (!c) return null;
  const brk = (brkLevel == null) ? defaultBrk(c) : brkLevel;
  // 只有玩家的卡（会自动加突破）才走 battleStats，AI 的卡用下面的算法
  if (brk === defaultBrk(c)) {
    const own = battleStats(id);
    if (own) return mkPlayer(id);
  }
    /* ★ 走 statsOf，这样「动态成长」（每 10 场的属性涨跌）才会算进比赛。
       之前这里直接读 c.attrs，AI 的能力变动只是显示，比赛里完全不起作用。 */
    const st2 = (typeof statsOf === 'function')
      ? statsOf(c, brk)
      : { attrs: (function () {
          const a2 = {};
          ATTR_KEYS.forEach((k2) => {
            a2[k2] = Math.min(135, c.attrs[k2] + brk * BREAK.attr);
          });
          return a2;
        })(), ovr: c.ovr + brk * BREAK.ovr };
    const attrs = st2.attrs;
    // 徽章也带上（含每 10 场的徽章增减）
    const badgeMap = (function () {
      const m = {};
      try { badgesOf(c, brk).forEach((b2) => { m[b2.key] = b2.tier; }); }
      catch (e2) {}
      return m;
    })();
    const devB = (function () {
      try {
        const d2 = (typeof devState === 'function') ? devState()[id] : null;
        return (d2 && d2.badges) ? d2.badges : 0;
      } catch (e2) { return 0; }
    })();
  return {
    id, card: c, attrs, ovr: st2.ovr, brk,
    pos: c.pos, name: c.name, photo: c.photo,
    stamina: makeStamina(c),
    stat: { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0, fga: 0, fgm: 0,
      tpa: 0, tpm: 0, to: 0, pf: 0 },
    hot: 0, acting: false, scoredNow: false,
  };
}

/** 球队战术：按阵容特点定，让 30 队各有风格 */
function teamTactics(key, players) {
  /* 优先用球队的"教练风格"（COACH_STYLE），这样每支球队打起来
     有固定的性格：勇士爱三分、灰熊爱内线、热火爱联防……
     没定义的队再按属性推导。 */
  if (typeof coachStyle === 'function') {
    const cs = coachStyle(key);
    if (cs && cs.off) return { off: cs.off, def: cs.def };
  }
  const avg = (k) => players.reduce((s, p) => s + (p.attrs[k] || 60), 0) / players.length;
  const three = avg('three'), inside = avg('mid') + avg('layup');
  const off = three > inside * 0.72 ? 'perimeter' : inside > 96 ? 'inside' : 'balanced';
  const h = hash32(key) % 3;
  const def = ['man', 'zone23', 'zone32'][h];
  return { off, def };
}

/** 用联赛阵容构建对手（10 人：5 首发 + 5 替补） */
function buildLeagueOpponent(key) {
  const L = leagueState();
  const t = TEAM_BY_KEY[key] || NBA_TEAMS[0];
  const st = L.teams[t.key];
  let ids = (st && st.roster && st.roster.length >= 5) ? st.roster.slice() : [];
  if (ids.length < 5) ids = CARDS.slice(0, 10).map((c) => c.id);   // 兜底
  // 排成 5 首发（按位置）+ 5 替补
  const org = organizeRoster(ids);
  const ordered = org.starters.concat(org.bench);
  const bm = teamBrkMap(t.key) || {};
  const all = ordered.map((id) => mkAIPlayer(id, brkLevelOf(t.key, id))).filter(Boolean);
  const players = all.slice(0, ROSTER.starters);
  const bench = all.slice(ROSTER.starters);
  /* ★ v9.34：AI 队也要标位置槽。
     之前只有我方 buildTeam 标了 slotPos，AI 队没标 ——
     结果比赛界面只有我方显示位置徽章、对方一片空白。
     现在两边都调 battle.js 里的 markSlotPos()，保证一致。 */
  markSlotPos(players);
  const ovr = players.length
    ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length) : 0;
  const tac = players.length ? teamTactics(t.key, players) : { off: 'balanced', def: 'man' };
  return {
    name: t.name, players, bench, ovr, isAI: true, score: 0,
    quarterScores: [], timeouts: 3, morale: 0,
    off: tac.off, def: tac.def, momentum: 0, runStreak: 0,
    form: 0.90 + Math.random() * 0.20,
    key: t.key, abbr: t.abbr, c1: t.c1, c2: t.c2,
  };
}

/* =============================================================
   比赛奖金：唯一出口（v9.27 修）
   -------------------------------------------------------------
   修之前是两套算法各算各的：
     · 预览 estimateReward() = WIN_BASE + (oppOvr-80)*PER_OVR + 80
     · 实发 battle.js endBattle() = (同上但**没有那个 +80**) × 分差加成
   结果预览**少报 13~19%**（对手越强差得越多），玩家会以为打强队不值。
   现在统一成 battleReward() 一个函数，预览和实发都调它，
   口径再也不会分叉。分差加成上限 1.6 倍（赢 30 分封顶）。
   ============================================================= */
/** 基础奖金（只看对手强度，与输赢无关） */
function rewardBase(oppOvr) {
  return Math.round(ECO.WIN_BASE + ((oppOvr || 100) - 80) * ECO.WIN_PER_OVR);
}
/** 分差加成：赢 10 分 → ×1.2，赢 30 分及以上 → ×1.6（封顶） */
function rewardMarginBonus(margin) {
  return Math.min(1.6, 1 + Math.abs(margin || 0) * 0.02);
}
/**
 * 一场比赛的奖金。预览和实发都走这里，保证「说多少就给多少」。
 * @param {number} oppOvr  对手综合
 * @param {boolean} win    是否赢球
 * @param {number} margin  分差（绝对值，用于取胜时的加成）
 */
function battleReward(oppOvr, win, margin) {
  const base = rewardBase(oppOvr);
  if (!win) return Math.round(base * LOSE_PAY_RATE);       // 输球：出场费，无分差加成
  return Math.round(base * rewardMarginBonus(margin));
}
/** 输球出场费占基础奖金的比例 */
const LOSE_PAY_RATE = 0.34;

/**
 * 预览用：给一个「典型分差」下的奖金区间，而不是单一数字。
 * 玩家在赛前看到的是「赢 5 分 ~ 赢 20 分」分别能拿多少。
 */
function estimateReward(myOvr, oppOvr) {
  return {
    lose: battleReward(oppOvr, false, 0),
    win5: battleReward(oppOvr, true, 5),
    win20: battleReward(oppOvr, true, 20),
  };
}
/** 预览文案（battle.js 直接拼进 HTML） */
function rewardPreviewText(oppOvr) {
  const r = estimateReward(0, oppOvr);
  return '赢 🪙' + fmt(r.win5) + '~' + fmt(r.win20) + ' · 输 🪙' + fmt(r.lose);
}

/** 打完一场联赛对手后：记录战绩 + 发新闻 + 结算支票 */
function settleLeagueMatch(oppKey, win, myScore, oppScore, reward) {
  const L = leagueState();
  const t = TEAM_BY_KEY[oppKey];
  if (!t) return;
  const st = L.teams[t.key];
  if (!st) return;
  if (win) { st.l++; } else { st.w++; }        // 玩家赢 = 对手输
  S.leagueMyW = (S.leagueMyW || 0) + (win ? 1 : 0);
  S.leagueMyL = (S.leagueMyL || 0) + (win ? 0 : 1);
  /* ★ 关键修复：手动打的比赛以前只写对手战绩，不写自己的，
     所以赢了之后赛程页/战绩还是 0:0。
     现在把结果写回"我的赛程"，并且推进一轮，跟模拟的场次对齐。 */
  try {
    if (typeof mySchedulePush === 'function') {
      const L2 = seasonState();
      // ★ 用"这一场实际对应哪一轮"，而不是 L.round
      const myRound = (typeof BT !== 'undefined' && BT.myRound) || L2.round;
      const fx = (typeof myFixture === 'function') ? myFixture(myRound) : null;
      mySchedulePush({
        round: myRound,
        opp: t.key,
        home: fx ? fx.home : true,
        my: myScore,
        opp2: oppScore,
        win: !!win,
        manual: true,
      });
      /* 2K 流程：打完自己的比赛 → 补齐本轮其余场次 → 推进到下一轮 */
      if (typeof finishMyRound === 'function') finishMyRound(myRound);
    }
  } catch (e) {}
  pushNews(`【我的球队】${win ? '击败' : '不敌'} ${t.name} ${myScore}:${oppScore}` +
    `　奖金 🪙${fmt(reward)}`, win ? 'deal' : 'game',
    { mine: true, opp: t.key, win, myScore, oppScore });
  save();
}

/* ---------- 调试：?lgflow=1 联赛全流程自检 ---------- */
(function leagueFlow() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('lgflow')) return;
    setTimeout(() => {
      const out = [];
      const L = leagueState();
      // ① 30 队都有 10 人阵容
      let bad = 0, ovrs = [];
      NBA_TEAMS.forEach((t) => {
        const st = L.teams[t.key];
        if (!st || st.roster.length !== ECO.TEAM_SIZE) bad++;
        else ovrs.push(rosterOvr(st.roster));
        if (new Set(st.roster).size !== st.roster.length) bad++;
      });
      out.push('阵容 ' + (bad ? '异常' + bad : '30队×10人 OK') +
        ' 评分' + Math.min(...ovrs).toFixed(0) + '~' + Math.max(...ovrs).toFixed(0));
      // ② 全联盟球员不重复
      const all = [];
      NBA_TEAMS.forEach((t) => all.push(...L.teams[t.key].roster));
      out.push('唯一性 ' + (new Set(all).size === all.length ? 'OK' : '异常') +
        '(' + new Set(all).size + '/' + all.length + ')');
      // ③ 市场有货、有挂牌来源
      const mk = marketList();
      const listed = mk.filter((m) => m.from).length;
      out.push('市场 ' + mk.length + '人(挂牌' + listed + '/自由' + (mk.length - listed) + ')');
      // ④ 推进 10 天
      const c0 = leagueStandings().reduce((s, r) => s + r.coins, 0);
      for (let i = 0; i < 10; i++) advanceLeagueDay();
      const c1 = leagueStandings().reduce((s, r) => s + r.coins, 0);
      out.push('10天 总支票 ' + Math.round(c0 / 1000) + 'k→' + Math.round(c1 / 1000) + 'k');
      out.push('新闻 ' + L.news.length + '条 最新:' + (L.news[0] ? L.news[0].t.slice(0, 26) : '无'));
      // ⑤ 对战队构建
      const opp = buildLeagueOpponent('lal');
      out.push('对手 湖人 ' + opp.players.length + '首发/' + opp.bench.length + '替补' +
        ' 综合' + opp.ovr + ' 战术' + opp.off + '/' + opp.def);
      // ⑥ 玩家买人
      const before = Object.keys(S.owned).length;
      const cheap = marketList().filter((m) => m.p <= S.coins).sort((a, b) => b.p - a.p)[0];
      if (cheap) {
        const r = buyFromMarket({ get coins() { return S.coins; },
          set coins(v) { S.coins = v; } }, cheap.id);
        if (r.ok) S.owned[cheap.id] = (S.owned[cheap.id] || 0) + 1;
        out.push('买人 ' + (r.ok ? 'OK ' + r.card.name + ' 🪙' + cheap.p +
          ' 收藏' + before + '→' + Object.keys(S.owned).length : '失败:' + r.why));
      } else out.push('买人 没有买得起的');
      // ⑦ 比赛结算写回联赛：玩家赢 → 对手记 1 负
      const lal = L.teams.lal;
      const lw = lal.w, ll = lal.l;
      settleLeagueMatch('lal', true, 112, 98, 500);
      out.push('赢球写回 ' + (lal.l === ll + 1 ? 'OK' : '异常') +
        '(对手 ' + lw + '胜' + lal.l + '负)');
      settleLeagueMatch('lal', false, 90, 105, 300);
      out.push('输球写回 ' + (lal.w === lw + 1 ? 'OK' : '异常') +
        '(对手 ' + lal.w + '胜' + lal.l + '负)');
      out.push('我的联赛战绩 ' + (S.leagueMyW || 0) + '胜' + (S.leagueMyL || 0) + '负');
      // ⑧ 新闻里应该有我的战报
      const mine = L.news.filter((n) => n.m && n.m.mine).length;
      out.push('我的战报 ' + mine + '条');
      document.title = 'LGFLOW ' + out.join(' | ');
    }, 800);
  } catch (e) { document.title = 'LGFLOW-ERR ' + e.message; }
})();

/* =============================================================
   赛季 / 奖项 / 季后赛 UI
   ============================================================= */

/** 顶部状态文案 */
function lgPhaseText(L) {
  const me = myLeagueEntry();
  const base = '支票 🪙' + fmt(S.coins) +
    ' · 我的战绩 ' + me.w + '胜' + me.l + '负';
  if (L.phase === 'regular') {
    return `常规赛 第 <em>${Math.min(L.round, SEASON.ROUNDS)}</em> / ${SEASON.ROUNDS} 轮` +
      ` · ${base}`;
  }
  if (L.phase === 'playoff') {
    const r = L.playoff ? L.playoff.round : 0;
    return `🔥 季后赛 · <em>${ROUND_NAME[r]}</em> · ${base}`;
  }
  const champ = L.playoff && L.playoff.champion;
  return `赛季结束 · 总冠军 <em>${champ ? anyTeamInfo(champ).name : '—'}</em> · ${base}`;
}
function lgAdvLabel(L) {
  if (L.phase === 'regular') {
    return L.round > SEASON.ROUNDS - 3 ? '推进（临近季后赛）▸' : '推进下一轮 ▸';
  }
  if (L.phase === 'playoff') return '打下一轮系列赛 ▸';
  if (isLastSeason()) return '已打完 2056 赛季 🏁';
  return `开启 ${seasonName(L.year + 1)} 赛季 ▸`;
}

/* ---------- 奖项 ---------- */
function lgAwardHTML() {
  const L = seasonState();
  const list = L.awards || [];
  if (!list.length) {
    return `<div class="lg-empty">还没有颁发任何奖项。<br>
      每周会评一次周最佳，每月评月最佳，常规赛结束评 MVP / DPOY / 最佳阵容等。</div>`;
  }
  const kindName = {
    week: '周最佳', month: '月最佳', stat: '数据王', mvp: 'MVP',
    dpoy: '最佳防守', sixth: '最佳第六人', mip: '最快进步',
    coy: '最佳教练', team: '最佳阵容', award: '奖项',
  };
  return `<div class="lg-award-grid">${list.map((a) => {
    if (a.multi) {
      return `<div class="lg-aw team">
        <div class="lg-aw-h"><i>${kindName[a.kind] || '奖项'}</i>
          <b>${a.title}</b><em>第 ${a.d} 轮</em></div>
        <div class="lg-aw-players">${a.multi.map((m) => {
          const c = CARD_BY_ID[m.pid];
          const t = anyTeamInfo(m.team);
          return `<span class="lg-aw-p">${lgBadge(t, 18)}
            <b>${c ? c.name : m.pid}</b><em>${c ? c.ovr : ''}</em></span>`;
        }).join('')}</div>
      </div>`;
    }
    const c = a.pid ? CARD_BY_ID[a.pid] : null;
    const t = anyTeamInfo(a.team);
    const mine = a.team === SEASON.MY_KEY;
    return `<div class="lg-aw${mine ? ' mine' : ''}">
      ${c ? `<div class="lg-aw-img"><img src="${c.photo}" alt="" loading="lazy"
        onerror="this.style.visibility='hidden'"></div>` : ''}
      <div class="lg-aw-body">
        <div class="lg-aw-h"><i>${kindName[a.kind] || '奖项'}</i>
          <b>${a.title}</b><em>第 ${a.d} 轮</em></div>
        <div class="lg-aw-nm">${c ? c.name : anyTeamInfo(a.team).name}</div>
        <div class="lg-aw-note">${lgBadge(t, 16)} ${a.note || ''}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* ---------- 季后赛 ---------- */
function lgPlayoffHTML() {
  const L = seasonState();
  if (L.phase === 'regular') {
    const east = confStandings('东').slice(0, 8);
    const west = confStandings('西').slice(0, 8);
    const seedRow = (rows, cn) => `<div class="lg-po-conf">
      <div class="lg-po-conf-t">${cn}部 季后赛区（前 8）</div>
      ${rows.map((r, i) => `<div class="lg-po-seed${r.key === SEASON.MY_KEY ? ' mine' : ''}">
        <span class="lg-po-n">${i + 1}</span>
        ${lgBadge(anyTeamInfo(r.key), 22)}
        <b>${anyTeamInfo(r.key).name}</b>
        <em>${r.w}胜${r.l}负</em>
        <span class="lg-po-o">${r.ovr.toFixed(1)}</span>
      </div>`).join('')}
    </div>`;
    return `<div class="lg-po-preview">
      <div class="lg-po-tip">常规赛还剩 <b>${Math.max(0, SEASON.ROUNDS - L.round + 1)}</b> 轮，
        分区前 8 名进入季后赛。季后赛四轮全部是 <b>7 战 4 胜淘汰赛</b>。</div>
      <div class="lg-po-cols">${seedRow(east, '东')}${seedRow(west, '西')}</div>
    </div>`;
  }
  const po = L.playoff;
  if (!po) return '<div class="lg-empty">季后赛还没开始。</div>';
  const byRound = [[], [], [], []];
  po.series.forEach((s) => { if (byRound[s.round]) byRound[s.round].push(s); });
  const seriesCard = (s) => {
    const hi = anyTeamInfo(s.hi), lo = anyTeamInfo(s.lo);
    const hiWin = s.done && s.winner === s.hi;
    const loWin = s.done && s.winner === s.lo;
    return `<div class="lg-po-series${s.done ? ' done' : ''}">
      <div class="lg-po-team${hiWin ? ' win' : ''}${s.hi === SEASON.MY_KEY ? ' mine' : ''}">
        ${lgBadge(hi, 20)}<b>${hi.name}</b><em>${s.done ? s.hw : ''}</em></div>
      <div class="lg-po-team${loWin ? ' win' : ''}${s.lo === SEASON.MY_KEY ? ' mine' : ''}">
        ${lgBadge(lo, 20)}<b>${lo.name}</b><em>${s.done ? s.lw : ''}</em></div>
    </div>`;
  };
  return `<div class="lg-po-bracket">
    ${[0, 1, 2, 3].map((r) => {
      const list = byRound[r];
      const label = ROUND_NAME[r] + (r === 3 ? '' : '（东西部各 ' + (8 >> r) + ' 组）');
      return `<div class="lg-po-round">
        <div class="lg-po-round-t">${label}</div>
        ${list.length ? list.map(seriesCard).join('')
          : '<div class="lg-po-wait">待定</div>'}
      </div>`;
    }).join('')}
  </div>
  <div class="lg-po-reward">
    <b>季后赛奖励</b>
    <span>进季后赛 🪙${fmt(PLAYOFF_REWARD.make)}</span>
    <span>过首轮 🪙${fmt(PLAYOFF_REWARD.r1)}</span>
    <span>过分区半决赛 🪙${fmt(PLAYOFF_REWARD.semi)}</span>
    <span>过分区决赛 🪙${fmt(PLAYOFF_REWARD.conf)}</span>
    <span class="champ">总冠军 🪙${fmt(PLAYOFF_REWARD.champ)}</span>
    <span>每赢一场 🪙${fmt(PLAYOFF_REWARD.gameWin)}</span>
  </div>`;
}

/* ---------- 调试：?selltest=1 买卖双向交易自检 ---------- */
(function sellTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('selltest')) return;
    setTimeout(() => {
      const out = [];
      const L = leagueState();
      // 先确保有些卡
      const top = CARDS.slice(0, 8);
      top.forEach((c) => { S.owned[c.id] = { got: 3, dup: 2, brk: 0 }; });
      const myId = top[0].id;
      const c0 = S.coins;
      const h0 = holdings(myId).total;
      const gross = marketPrice(CARD_BY_ID[myId]);
      const expectFee = Math.round(gross * ECO.SELL_FEE);
      const expectNet = gross - expectFee;
      // ① 出售
      const r = sellPlayer(myId);
      if (r.ok) {
        const o = S.owned[myId];
        if (o) { if (o.got > 1) { o.got -= 1; if (o.dup > 0) o.dup -= 1; } else delete S.owned[myId]; }
        S.coins += r.net;
      try { if (typeof qsOnSell === 'function') qsOnSell(); } catch (e) {}
      }
      out.push('出售 ' + r.card.name + ' 挂牌🪙' + gross +
        ' 手续费🪙' + r.fee + '(' + Math.round(ECO.SELL_FEE * 100) + '%)' +
        ' 实收🪙' + r.net);
      out.push('手续费正确=' + (r.fee === expectFee && r.net === expectNet ? '✓' : '✗'));
      out.push('金库 ' + Math.round(c0) + '→' + Math.round(S.coins) +
        ' 增加=' + Math.round(S.coins - c0) + (Math.round(S.coins - c0) === expectNet ? ' ✓' : ' ✗'));
      out.push('持有 ' + h0 + '→' + holdings(myId).total +
        (holdings(myId).total === h0 - 1 ? ' ✓' : ' ✗'));
      out.push('回到自由池=' + (L.agents.includes(myId) ? '✓' : '✗'));
      // ② 卖最后一张要能删干净
      const lastId = top[1].id;
      S.owned[lastId] = { got: 1, dup: 0, brk: 0 };
      sellPlayer(lastId);
      delete S.owned[lastId];
      out.push('卖光后=' + (holdings(lastId).total === 0 ? '✓' : '✗'));
      // ③ 买入流程照旧
      const cheap = marketList().filter((m) => m.p <= S.coins).sort((a, b) => b.p - a.p)[0];
      if (cheap) {
        const before = S.coins;
        const br = buyFromMarket({ get coins() { return S.coins; },
          set coins(v) { S.coins = v; } }, cheap.id);
        if (br.ok) S.owned[cheap.id] = { got: (S.owned[cheap.id] || {}).got || 0 + 1,
          dup: 0, brk: 0 };
        out.push('买入 ' + (br.ok ? '✓ ' + br.card.name + ' 花🪙' + (before - S.coins) : '✗' + br.why));
      }
      // ④ AI 卖人收 20%
      const before = {};
      NBA_TEAMS.slice(0, 6).forEach((t) => { before[t.key] = L.teams[t.key].coins; });
      let aiDeal = 0;
      for (let i = 0; i < 30 && !aiDeal; i++) {
        const d = aiShopping(NBA_TEAMS[i % 30]);
        if (d) aiDeal = 1;
      }
      out.push('AI买人=' + (aiDeal ? '✓' : '（本轮没触发，正常）'));
      document.title = 'SELL ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'SELL-ERR ' + e.message; }
})();

/* ---------- 调试：?bulktest=1 一键出售自检 ---------- */
(function bulkTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('bulktest')) return;
    setTimeout(() => {
      const out = [];
      // 造一批卡：20 张银 + 10 张金，其中 2 张银卡塞进阵容
      const silvers = CARDS.filter((c) => c.tier === 'silver').slice(0, 20);
      const golds = CARDS.filter((c) => c.tier === 'gold').slice(0, 10);
      silvers.forEach((c, i) => {
        S.owned[c.id] = { got: i === 0 ? 3 : 1, dup: i === 0 ? 2 : 0, brk: 0 };
      });
      golds.forEach((c) => { S.owned[c.id] = { got: 1, dup: 0, brk: 0 }; });
      // 把两张银卡放进阵容
      S.roster = { starters: [silvers[0].id, silvers[1].id].concat(
        golds.slice(0, 3).map((c) => c.id)),
        bench: silvers.slice(2, 7).map((c) => c.id) };
      const lineupBefore = rosterIds();
      const c0 = S.coins;
      const silverCount = silvers.reduce((s, c, i) => s + (i === 0 ? 3 : 1), 0);
      out.push('准备 银卡' + silverCount + '张(其中' +
        silvers.slice(0, 7).filter((c) => lineupBefore.starters.concat(lineupBefore.bench)
          .includes(c.id)).length + '个在阵容) 金卡' + golds.length + '张');
      // ① 一键卖银卡
      const r = sellAllOfTier('silver', { protectLineup: true });
      out.push('卖银卡 ' + r.sold + '张 实收🪙' + r.net + ' 手续费🪙' + r.fee +
        ' 保留' + r.skipped + '个');
      out.push('手续费20%=' + (Math.abs(r.fee / (r.gross || 1) - 0.2) < 0.02 ? '✓' : '✗'));
      out.push('金库+' + Math.round(S.coins - c0) + (Math.round(S.coins - c0) === r.net ? ' ✓' : ' ✗'));
      const leftSilver = Object.keys(S.owned)
        .filter((id) => CARD_BY_ID[id] && CARD_BY_ID[id].tier === 'silver').length;
      out.push('剩余银卡种类=' + leftSilver + '（应等于被保护的阵容银卡数）');
      // ② 阵容没被破坏
      const r2 = rosterIds();
      const all = r2.starters.concat(r2.bench);
      out.push('阵容 ' + all.length + '人/唯一' + new Set(all).size +
        (all.length === 10 && new Set(all).size === 10 ? ' ✓' : ' ✗'));
      // ③ 一键卖金卡
      const c1 = S.coins;
      const g = sellAllOfTier('gold', { protectLineup: true });
      out.push('卖金卡 ' + g.sold + '张 实收🪙' + g.net + ' 保留' + g.skipped + '个');
      out.push('金库+' + Math.round(S.coins - c1) + (Math.round(S.coins - c1) === g.net ? ' ✓' : ' ✗'));
      // ④ 按钮真的在界面上
      switchTab('league');
      lgTab = 'market'; lgMarketMode = 'sell';
      renderLeague();
      const bl = document.querySelectorAll('.lg-bulkbtn[data-bulk]');
      out.push('一键按钮=' + bl.length + '个' +
        (bl.length === 4 ? ' ✓' : ' ✗') +
        ' 银卡按钮' + (bl[0] && bl[0].disabled ? '禁用(卖光了)' : '可点'));
      // 给截图用：补一批卡并停在出售页
      if (q.get('shot')) {
        CARDS.filter((c) => c.tier === 'silver').slice(0, 22)
          .forEach((c, i) => { S.owned[c.id] = { got: i < 4 ? 3 : 1, dup: 0, brk: 0 }; });
        CARDS.filter((c) => c.tier === 'gold').slice(0, 12)
          .forEach((c) => { S.owned[c.id] = { got: 1, dup: 0, brk: 0 }; });
        lgTab = 'market'; lgMarketMode = 'sell'; lgMarketPage = 0;
        renderLeague();
      }
      document.title = 'BULK ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'BULK-ERR ' + e.message; }
})();

/* ---------- 调试：?searchtest=1 转会市场搜索 + 卖后上架自检 ---------- */
(function searchTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('searchtest')) return;
    setTimeout(() => {
      const out = [];
      const L = leagueState();
      const all = marketList();
      out.push('市场共 ' + all.length + ' 人');

      // ① 按球员名搜
      const nm = all[0].card.name;
      lgQuery = nm.slice(0, 2); lgTier = 'all';
      let hit = marketList().filter((m) => lgMatch(m.card));
      // 搜索同时匹配中文名和英文名，所以不能用「中文名必须包含」来判定
      const okName = hit.length > 0 && hit.every((m) =>
        m.card.name.indexOf(lgQuery) >= 0 ||
        (m.card.en || '').toLowerCase().indexOf(lgQuery.toLowerCase()) >= 0);
      out.push('搜球员名「' + lgQuery + '」命中 ' + hit.length + ' 人（中/英文名都算）' +
        (okName ? ' ✓' : ' ✗'));

      // ② 按球队名搜
      lgQuery = '洛杉矶湖人';
      hit = marketList().filter((m) => lgMatch(m.card));
      out.push('搜球队「洛杉矶湖人」命中 ' + hit.length + ' 人' +
        (hit.every((m) => m.card.team === '洛杉矶湖人') ? ' ✓' : ' ✗'));

      // ③ 英文名
      const en = (all.find((m) => m.card.en) || {}).card;
      if (en) {
        lgQuery = en.en.slice(0, 4).toLowerCase();
        hit = marketList().filter((m) => lgMatch(m.card));
        out.push('搜英文「' + lgQuery + '」命中 ' + hit.length + ' 人');
      }

      // ④ 各档位筛选
      lgQuery = '';
      const tiers = ['silver', 'gold', 'purple', 'momentGold', 'momentPurple', 'history'];
      const parts = [];
      tiers.forEach((t) => {
        lgTier = t;
        const h = marketList().filter((m) => lgMatch(m.card));
        const ok = t === 'history' ? h.every((m) => !m.card.current)
          : h.every((m) => m.card.tier === t);
        parts.push((LG_TIERS.find((x) => x[0] === t)[1]) + ':' + h.length + (ok ? '' : '✗'));
      });
      out.push('档位筛选 ' + parts.join(' '));
      lgTier = 'all';

      // ⑤ 卖掉球员 → 立刻出现在市场
      const sellId = CARDS.find((c) => c.tier === 'purple').id;
      S.owned[sellId] = { got: 1, dup: 0, brk: 0 };
      const inMarketBefore = marketList().some((m) => m.id === sellId);
      const r = sellPlayer(sellId);
      const inMarketAfter = marketList().some((m) => m.id === sellId);
      out.push('卖掉 ' + r.card.name + ' 后立刻上架=' +
        (inMarketAfter ? '✓' : '✗') + '（卖前在架=' + inMarketBefore + '）');
      out.push('上架价格=🪙' + (marketList().find((m) => m.id === sellId) || {}).p);

      // ⑥ 界面渲染搜索框和 chips
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'buy';
      lgQuery = ''; lgTier = 'all'; renderLeague();
      if (q.get('shot')) { lgQuery = '篮网'; lgTier = 'gold'; renderLeague(); }
      const qi = document.getElementById('lgQ');
      const chips = document.querySelectorAll('.lg-chip');
      out.push('搜索框=' + (qi ? '✓' : '✗') + ' 档位按钮=' + chips.length + '个');
      // 模拟输入
      if (qi) {
        qi.value = '库里'; qi.dispatchEvent(new Event('input'));
        setTimeout(() => {
          const box = lgBox();
          const cards = box.querySelectorAll('.lg-mk-card');
          const txt = box.textContent;
          out.push('输入「库里」→ 卡片' + cards.length + '张 ' +
            (txt.indexOf('库里') >= 0 || cards.length === 0 ? '✓' : '✗'));
          document.title = 'SEARCH ' + out.join(' | ');
        }, 500);
      } else document.title = 'SEARCH ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'SEARCH-ERR ' + e.message; }
})();

/* ---------- 调试：?limittest=1 持卡上限自检 ---------- */
(function limitTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('limittest')) return;
    setTimeout(() => {
      const out = [];
      out.push('上限=' + CARD_LIMIT + '张（银/金满突破 = 9阶×7张消耗 + 本体1张）');
      const id = marketList()[0].id;
      const card = CARD_BY_ID[id];
      // ① 空手时剩余 64
      delete S.owned[id];
      out.push('0张时 可购=' + remainingOf(SEASON.MY_KEY, id));
      // ② 持有 63 张
      S.owned[id] = { got: 63, dup: 0, brk: 7 };
      out.push('63张时 可购=' + remainingOf(SEASON.MY_KEY, id));
      // ③ 持有 64 张 → 不可买
      S.owned[id] = { got: 64, dup: 0, brk: 8 };
      const rem = remainingOf(SEASON.MY_KEY, id);
      const coinsBefore = S.coins;
      const r = buyFromMarket({ get coins() { return S.coins; },
        set coins(v) { S.coins = v; } }, id, { buyerKey: SEASON.MY_KEY });
      out.push('64张时 可购=' + rem + ' 购买=' + (r.ok ? '✗竟然成功了' : '✓被拦下'));
      out.push('拦截原因: ' + (r.why || '-'));
      out.push('钱没被扣=' + (S.coins === coinsBefore ? '✓' : '✗'));
      // ④ 界面显示
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'buy';
      // 截图用：造几种不同持有量，展示配额的三种状态
      if (q.get('shot')) {
        const mk = marketList();
        if (mk[0]) S.owned[mk[0].id] = { got: 64, dup: 0, brk: 8 };
        if (mk[1]) S.owned[mk[1].id] = { got: 40, dup: 0, brk: 5 };
        if (mk[2]) S.owned[mk[2].id] = { got: 12, dup: 0, brk: 1 };
        lgQuery = ''; lgTier = 'all';
      } else { lgQuery = card.name.slice(0, 2); lgTier = 'all'; }
      renderLeague();
      const box = lgBox();
      const quota = box.querySelector('.lg-mk-quota');
      const btn = box.querySelector('.lg-buy');
      out.push('界面配额显示: ' + (quota ? quota.textContent.trim().replace(/\s+/g, ' ') : '无'));
      out.push('按钮=' + (btn ? (btn.disabled ? '已禁用✓' : '仍可点') +
        ' 文案「' + btn.textContent.trim() + '」' : '无'));
      // ⑤ AI 也有同样的上限
      const t = NBA_TEAMS[0];
      const st = L2Get(t.key);
      if (st) {
        st.copies = {}; st.copies[id] = 64;
        out.push('AI(' + t.name + ') 64张时可购=' + remainingOf(t.key, id) +
          (remainingOf(t.key, id) === 0 ? ' ✓' : ' ✗'));
      }
      document.title = 'LIMIT ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'LIMIT-ERR ' + e.message; }
})();
function L2Get(k) { return leagueState().teams[k]; }

/* ---------- 调试：?bulk4=1 四个批次一键出售自检 ---------- */
(function bulkFourTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('bulk4')) return;
    setTimeout(() => {
      const out = [];
      // 造四种卡各若干
      const mk = (tier, n, pred) => CARDS.filter((c) => c.tier === tier && (!pred || pred(c)))
        .slice(0, n);
      const sil = mk('silver', 6);
      const gol = mk('gold', 5);
      const mg = mk('momentGold', 4);
      const lp = mk('purple', 5, (c) => !c.current);
      const cp = mk('purple', 3, (c) => c.current);
      [sil, gol, mg, lp, cp].forEach((arr) => arr.forEach((c) => {
        S.owned[c.id] = { got: 1, dup: 0, brk: 0 };
      }));
      S.roster = { starters: [], bench: [] };
      out.push('准备 银' + sil.length + ' 金' + gol.length +
        ' 时刻金' + mg.length + ' 名宿紫' + lp.length + ' 现役紫' + cp.length);

      BULK_GROUPS.forEach((g) => {
        const a = bulkAgg(g.key);
        out.push(g.label + ' 识别到 ' + a.n + ' 张');
      });
      // 关键：名宿紫卡不能把现役紫卡也算进去
      const lpAgg = bulkAgg('legendPurple');
      out.push('名宿紫卡只算退役=' + (lpAgg.n === lp.length ? '✓' : '✗ 应为' + lp.length));
      // 卖时刻金卡
      const c0 = S.coins;
      const r = sellAllOfTier('momentGold', { protectLineup: true });
      out.push('卖时刻金卡 ' + r.sold + '张 实收🪙' + r.net +
        ' 手续费🪙' + r.fee + (Math.abs(r.fee / (r.gross || 1) - 0.2) < 0.02 ? ' (20%✓)' : ' ✗'));
      out.push('金库+' + Math.round(S.coins - c0) + (Math.round(S.coins - c0) === r.net ? ' ✓' : ' ✗'));
      // 卖名宿紫卡
      const c1 = S.coins;
      const r2 = sellAllOfTier('legendPurple', { protectLineup: true });
      out.push('卖名宿紫卡 ' + r2.sold + '张 实收🪙' + r2.net);
      // 现役紫卡应该还在
      const leftCurrent = Object.keys(S.owned).filter((id) =>
        CARD_BY_ID[id] && CARD_BY_ID[id].tier === 'purple' &&
        CARD_BY_ID[id].current).length;
      // 游戏初始可能已经带了现役紫卡，所以只要「不少于本次放入的数量」就算没误卖
      out.push('现役紫卡剩余 ' + leftCurrent + ' 种（本次放入 ' + cp.length +
        ' 种）' + (leftCurrent >= cp.length ? ' ✓（没被误卖）' : ' ✗'));
      // 界面上按钮数量
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'sell'; renderLeague();
      const btns = document.querySelectorAll('.lg-bulkbtn[data-bulk]');
      out.push('界面按钮 ' + btns.length + ' 个（应为 4）');
      out.push('按钮文案: ' + [...btns].map((b) =>
        b.textContent.trim().split('\n')[0].trim()).join(' / '));
      if (q.get('shot')) {
        // 截图用：补足四种卡
        ['silver', 'gold', 'momentGold'].forEach((t) => {
          CARDS.filter((c) => c.tier === t).slice(0, 5)
            .forEach((c) => { S.owned[c.id] = { got: 2, dup: 1, brk: 0 }; });
        });
        CARDS.filter((c) => c.tier === 'purple' && !c.current).slice(0, 4)
          .forEach((c) => { S.owned[c.id] = { got: 2, dup: 1, brk: 0 }; });
        lgTab = 'market'; lgMarketMode = 'sell'; lgMarketPage = 0;
        renderLeague();
      }
      document.title = 'BULK4 ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'BULK4-ERR ' + e.message; }
})();

/* ---------- 调试：?qtytest=1 批量购买自检 ---------- */
(function qtyTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('qtytest')) return;
    setTimeout(() => {
      const out = [];
      S.coins = 300000;                       // 给足钱
      const mk = marketList();
      const id = mk[mk.length - 1].id;        // 挑最贵的
      const card = CARD_BY_ID[id];
      const price = mk[mk.length - 1].p;
      delete S.owned[id];
      const mx = lgMaxBuy(id, price);
      out.push(card.name + ' 单价🪙' + price + ' 最多可买' + mx + '张' +
        '（上限64/钱够' + Math.floor(S.coins / price) + '）');

      // ① 买 1 张
      const c0 = S.coins;
      let who = { get coins() { return S.coins; }, set coins(v) { S.coins = v; } };
      let r = buyFromMarket(who, id, { buyerKey: SEASON.MY_KEY });
      out.push('买1张 ' + (r.ok ? '✓' : '✗') + ' 花🪙' + (c0 - S.coins));

      // ② 连买 5 张
      const c1 = S.coins;
      let done = 0;
      for (let k = 0; k < 5; k++) {
        const rr = buyFromMarket(who, id, { buyerKey: SEASON.MY_KEY });
        if (!rr.ok) break; done++;
      }
      out.push('连买5张 成功' + done + '张 花🪙' + (c1 - S.coins) +
        (done === 5 ? ' ✓' : ' ✗'));

      // ③ 手上有 6 张后，还能买几张
      S.owned[id] = { got: 6, dup: 0, brk: 0 };
      const mx2 = lgMaxBuy(id, price);
      const expect2 = Math.min(58, Math.floor(S.coins / price));
      out.push('持有6张时 最多可买' + mx2 + '张（上限58，钱够' +
        Math.floor(S.coins / price) + '）' + (mx2 === expect2 ? ' ✓' : ' ✗'));

      // ④ 买满 64 后不能再买
      S.owned[id] = { got: 64, dup: 0, brk: 8 };
      out.push('持有64张时 最多可买' + lgMaxBuy(id, price) +
        '张' + (lgMaxBuy(id, price) === 0 ? ' ✓' : ' ✗'));

      // ⑤ 钱不够时会自动收窄
      S.owned[id] = { got: 0, dup: 0, brk: 0 };
      S.coins = price * 3 + 10;
      const mx3 = lgMaxBuy(id, price);
      out.push('钱只够3张时 最多可买' + mx3 + '张' + (mx3 === 3 ? ' ✓' : ' ✗'));

      // ⑥ 界面上的选择器
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'buy';
      S.coins = 300000; lgQuery = ''; lgTier = 'all'; renderLeague();
      const box = lgBox();
      const qis = box.querySelectorAll('.lg-qi');
      const qbs = box.querySelectorAll('.lg-qb');
      out.push('界面数量框 ' + qis.length + '个 / 加减按钮 ' + qbs.length + '个');
      if (qis.length) {
        const inp = qis[0];
        const qid = inp.dataset.lgqid;
        inp.value = '4';
        inp.onchange();
        out.push('输入4 → lgQty=' + JSON.stringify(lgQty[qid]) +
          (lgQty[qid] === 4 ? ' ✓' : ' ✗'));
        const box2 = lgBox();
        const buy = box2.querySelector('.lg-buy');
        out.push('按钮显示总价「' + (buy ? buy.textContent.trim() : '?') + '」');
      }
      if (q.get('shot')) {
        S.coins = 300000; lgQuery = ''; lgTier = 'all';
        const mk2 = marketList();
        if (mk2[0]) lgQty[mk2[0].id] = 5;
        if (mk2[1]) lgQty[mk2[1].id] = 12;
        renderLeague();
      }
      document.title = 'QTY ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'QTY-ERR ' + e.message; }
})();

/* ---------- 调试：?buytest=1 真实点击购买按钮的端到端测试 ---------- */
(function buyClickTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('buytest')) return;
    // 捕获任何未处理异常
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const origConfirm = window.confirm;
    window.confirm = () => true;              // 自动确认

    setTimeout(() => {
      const out = [];
      S.coins = 500000;
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'buy';
      lgQuery = ''; lgTier = 'all'; lgMarketPage = 0;
      renderLeague();

      const box = lgBox();
      const btns = box.querySelectorAll('.lg-buy');
      out.push('市场买入按钮 ' + btns.length + '个');
      if (!btns.length) { document.title = 'BUY 没有按钮'; return; }

      // ① 买 1 张
      const b0 = btns[0];
      const id0 = b0.dataset.lgid;
      const c0 = S.coins;
      const own0 = holdings(id0).total;
      b0.click();
      setTimeout(() => {
        out.push('买1张 ' + CARD_BY_ID[id0].name +
          ' 花费🪙' + (c0 - S.coins) + ' 持有' + own0 + '→' + holdings(id0).total +
          (holdings(id0).total === own0 + 1 ? ' ✓' : ' ✗'));
        out.push('  save后能读回=' +
          (JSON.parse(Store.read(SAVE_KEY)).owned[id0] ? '✓' : '✗'));

        // ② 选 3 张再买
        const box2 = lgBox();
        const b1 = box2.querySelectorAll('.lg-buy')[1];
        const id1 = b1.dataset.lgid;
        b1.dataset.qty = '3';
        const c1 = S.coins;
        const own1 = holdings(id1).total;
        b1.click();
        setTimeout(() => {
          const got = holdings(id1).total - own1;
          out.push('买3张 ' + CARD_BY_ID[id1].name +
            ' 实到' + got + '张 花费🪙' + (c1 - S.coins) +
            (got === 3 ? ' ✓' : ' ✗'));
          // ③ 界面有没有刷新
          out.push('界面已刷新=' +
            (document.querySelectorAll('#lgBody .lg-buy').length > 0 ? '✓' : '✗'));
          out.push('未捕获异常=' + (errs.length ? '✗ ' + errs.join('; ') : '无 ✓'));
          window.confirm = origConfirm;
          document.title = 'BUY ' + out.join(' | ');
        }, 600);
      }, 600);
    }, 900);
  } catch (e) { document.title = 'BUY-ERR ' + e.message; }
})();

/* ---------- 调试：?sqtytest=1 紫卡一键出售 + 按数量出售自检 ---------- */
(function sellQtyTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('sqtytest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const oc = window.confirm; window.confirm = () => true;
    setTimeout(() => {
      const out = [];
      out.push('一键批次 ' + BULK_GROUPS.map((g) => g.label).join('/'));
      // 造紫卡
      CARDS.filter((c) => c.tier === 'purple').slice(0, 6)
        .forEach((c) => { S.owned[c.id] = { got: 4, dup: 3, brk: 0 }; });
      S.roster = { starters: [], bench: [] };
      S.coins = 5000;
      const pa = bulkAgg('purple');
      out.push('紫卡识别 ' + pa.n + ' 张 可得🪙' + pa.net);
      // 按数量卖 2 张
      switchTab('league'); lgTab = 'market'; lgMarketMode = 'sell';
      lgQuery = ''; lgTier = 'all'; renderLeague();
      const box = lgBox();
      const sell = box.querySelector('.lg-sell');
      if (!sell) { document.title = 'SQTY 没有出售按钮'; return; }
      const id = sell.dataset.lgsell;
      const h0 = holdings(id).total;
      const c0 = S.coins;
      sell.dataset.sqty = '2';
      out.push('按钮sqty=' + sell.dataset.sqty + ' 持有=' + h0 +
        ' 按钮文案=' + sell.textContent.trim());
      out.push('rosterManual=' + S.rosterManual +
        ' 阵容=' + rosterIds().starters.concat(rosterIds().bench).filter(Boolean).length);
      sell.click();
      setTimeout(() => {
        const h1 = holdings(id).total;
        out.push('卖2张 持有' + h0 + '→' + h1 +
          (h1 === h0 - 2 ? ' ✓' : ' ✗') + ' 现金+' + Math.round(S.coins - c0));
        out.push('界面有数量框=' +
          (document.querySelectorAll('#lgBody .lg-sqi').length > 0 ? '✓' : '✗'));
        out.push('异常=' + (errs.length ? '✗ ' + errs.join(';') : '无 ✓'));
        window.confirm = oc;
        document.title = 'SQTY ' + out.join(' | ');
      }, 700);
    }, 900);
  } catch (e) { document.title = 'SQTY-ERR ' + e.message; }
})();

/* ---------- 调试：?purpletest=1 紫卡批次必须不碰时刻紫卡 ---------- */
(function purpleScopeTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('purpletest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    window.confirm = () => true;
    setTimeout(() => {
      const out = [];
      // 造：普通紫卡（现役+历史）、时刻紫卡、时刻金卡
      const pur = CARDS.filter((c) => c.tier === 'purple').slice(0, 4);
      const purHist = CARDS.filter((c) => c.tier === 'purple' && !c.current).slice(0, 3);
      const mp = CARDS.filter((c) => c.tier === 'momentPurple').slice(0, 3);
      const mg = CARDS.filter((c) => c.tier === 'momentGold').slice(0, 3);
      [pur, purHist, mp, mg].forEach((arr) => arr.forEach((c) => {
        S.owned[c.id] = { got: 2, dup: 1, brk: 0 };
      }));
      S.roster = { starters: [], bench: [] };
      S.rosterManual = true;                 // 关掉自动补阵容，避免误保护
      out.push('放入 紫' + (pur.length + purHist.length) +
        ' 时刻紫' + mp.length + ' 时刻金' + mg.length);

      const agg = bulkAgg('purple');
      out.push('紫卡批次识别到 ' + agg.n + ' 张（应为 ' +
        (pur.length + purHist.length) * 2 + '）' +
        (agg.n === (pur.length + purHist.length) * 2 ? ' ✓' : ' ✗'));

      const c0 = S.coins;
      const r = sellAllOfTier('purple', { protectLineup: true });
      out.push('卖紫卡 ' + r.sold + ' 张 实收🪙' + r.net);

      // 关键校验：时刻紫卡必须原封不动
      const leftMP = mp.filter((c) => holdings(c.id).total > 0).length;
      const leftMG = mg.filter((c) => holdings(c.id).total > 0).length;
      out.push('时刻紫卡剩余 ' + leftMP + '/' + mp.length +
        (leftMP === mp.length ? ' ✓没被误卖' : ' ✗被误卖了！'));
      out.push('时刻金卡剩余 ' + leftMG + '/' + mg.length +
        (leftMG === mg.length ? ' ✓没被误卖' : ' ✗被误卖了！'));

      // 普通紫卡应该卖光了
      const leftPur = pur.concat(purHist).filter((c) => holdings(c.id).total > 0).length;
      out.push('普通紫卡剩余 ' + leftPur + (leftPur === 0 ? ' ✓已卖光' : ' ✗'));

      // 其余 4 个批次也确认一下范围
      out.push('批次范围: ' + BULK_GROUPS.map((g) =>
        g.label + '=' + bulkAgg(g.key).n).join(' '));
      out.push('异常=' + (errs.length ? '✗ ' + errs.join(';') : '无 ✓'));
      document.title = 'PURPLE ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'PURPLE-ERR ' + e.message; }
})();

/* =============================================================
   转会市场 · 能力变动视图（v3.4）
   -------------------------------------------------------------
   把「球员能力值变动」放到转会市场里，方便所有球队和玩家查看：
     · 卡面（和「我的」页一样的样式）
     · 综合评分变化 113 → 107（−6）
     · 逐项属性变化，涨用绿色 +，跌用红色 −
     · 徽章变化 ±n
   ============================================================= */
function lgDevHTML() {
  const L = seasonState();
  const log = L.devLog || [];
  const dev = (typeof devState === 'function') ? devState() : {};

  if (!log.length) {
    return `<div class="dv-wrap">
      <div class="dv-empty">
        还没有能力变动记录<br>
        <span>每打完 10 场常规赛，表现超预期或低迷的球员会有小幅调整</span>
      </div>
    </div>`;
  }

  // 按轮次分组（最近的在前）
  const byRound = {};
  log.forEach((r) => {
    (byRound[r.round] = byRound[r.round] || []).push(r);
  });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);

  /* ★ 属性中文名在 data.js 的 ATTR_NAME 里（**对象**，key → 中文名）。
     这里原来写的是 ATTR_LABEL —— 那个东西整个工程**从来没有定义过**，
     于是 typeof 判断永远不成立，一路回退到 `return k`，
     能力变动页每个球员下面就显示成 dreb / three / pass 这些原始英文 key。
     用户看到的就是「一堆乱码」。 */
  const attrName = (k) => {
    if (typeof ATTR_NAME !== 'undefined' && ATTR_NAME && ATTR_NAME[k]) {
      return ATTR_NAME[k];
    }
    /* 兜底：万一以后 ATTR_NAME 改了结构，用 ATTR_KEYS 的下标去试 ATTRS */
    if (typeof ATTR_KEYS !== 'undefined' && typeof ATTRS !== 'undefined') {
      const i = ATTR_KEYS.indexOf(k);
      if (i >= 0 && ATTRS[i] && ATTRS[i].name) return ATTRS[i].name;
    }
    return k;
  };

  const moved = log.filter((x) => (x.price && x.price.delta) ||
    (x.detail && Object.keys(x.detail).length) ||
    (x.price && x.price.first));
  const shown = dvOnlyChanged ? moved : log;
  const shownRounds = {};
  shown.forEach((r) => { (shownRounds[r.round] = shownRounds[r.round] || []).push(r); });
  const rlist = Object.keys(shownRounds).map(Number).sort((a, b) => b - a);

  return `<div class="dv-wrap">
    <div class="dv-head">
      <b>📈 球员能力 / 身价变动</b>
      <span>每 10 场更新一次 · 单项最多 ±${DEV_ATTR_CAP} · 共 ${log.length} 条记录</span>
    </div>
    <div class="dv-modes">
      <button class="dv-mb${dvOnlyChanged ? ' on' : ''}" data-dvonly="1">
        只看有变动 ${moved.length}</button>
      <button class="dv-mb${dvOnlyChanged ? '' : ' on'}" data-dvonly="0">
        全部球员 ${log.length}</button>
    </div>
    ${(function () {
      /* 顶部涨跌榜：让所有球队一眼看到谁涨得最多、谁跌得最狠 */
      const withP = log.filter((x) => x.price && !x.price.first &&
        x.price.delta !== 0);
      if (!withP.length) return '';
      const topUp = withP.slice().sort((a, b) =>
        b.price.pct - a.price.pct).slice(0, 3);
      const topDn = withP.slice().sort((a, b) =>
        a.price.pct - b.price.pct).slice(0, 3);
      const chip = (x, cls) => `<span class="dv-chip ${cls}">${
        x.price.pct > 0 ? '▲' : '▼'} ${x.name}<i>${
        x.price.pct > 0 ? '+' : ''}${x.price.pct}%</i></span>`;
      return `<div class="dv-rank">
        <div class="dv-rank-row"><b>📈 涨幅榜</b>${
          topUp.map((x) => chip(x, 'plus')).join('')}</div>
        <div class="dv-rank-row"><b>📉 跌幅榜</b>${
          topDn.map((x) => chip(x, 'minus')).join('')}</div>
      </div>`;
    })()}
    <div class="dv-legend">
      <i class="up">+ 上升</i><i class="down">− 下滑</i>
      <em>属性为本次调整幅度 · 身价为 10 场前后的变化</em>
    </div>
    ${rlist.slice(0, 6).map((rd) => `
      <div class="dv-group">
        <div class="dv-gt">第 ${rd} 轮评估
          <em>${shownRounds[rd].length} 名球员</em></div>
        <div class="dv-grid">
          ${shownRounds[rd].slice(0, 120)
            .map((r) => lgDevCard(r, attrName)).join('')}
        </div>
      </div>`).join('')}
    ${rlist.length > 6 ? `<div class="dv-more">只显示最近 6 次评估</div>` : ''}
  </div>`;
}
/** 单张变动卡：用和「我的」页一致的卡面 */
function lgDevCard(r, attrName) {
  const c = CARD_BY_ID[r.id];
  if (!c) return '';
  const T = TIERS[c.tier];
  const adj = (devAdjOf(c.id)) || {};
  const nowOvr = (typeof effectiveOvr === 'function') ? effectiveOvr(c) : c.ovr;
  const delta = r.ovr || 0;
  const detail = r.detail || {};
  const keys = Object.keys(detail);
  return `<div class="dv-card${r.up ? ' up' : ' down'}">
    <div class="dv-face" data-crcard="${c.id}">
      <div class="dv-img"><img src="${c.photo}" alt=""
        onerror="this.parentNode.style.visibility='hidden'"></div>
      <div class="dv-tier" style="background:linear-gradient(135deg,${
        T.c1},${T.c2 || T.c1})">${T.name}</div>
      <div class="dv-ovr">${nowOvr}
        <em class="${delta >= 0 ? 'plus' : 'minus'}">${
          delta > 0 ? '▲+' : delta < 0 ? '▼' : '—'}${delta || ''}</em></div>
      <div class="dv-nm">${c.name}</div>
    </div>
    <div class="dv-changes">
      ${keys.map((k) => `<span class="${detail[k] > 0 ? 'plus' : 'minus'}">
        ${detail[k] > 0 ? '▲' : '▼'} ${attrName(k)} ${
        detail[k] > 0 ? '+' : ''}${detail[k]}</span>`).join('')}
    </div>
    ${r.price ? `
      <div class="dv-price ${r.price.delta > 0 ? 'plus' : r.price.delta < 0 ? 'minus' : ''}">
        <span>身价</span>
        <b>🪙${fmt(r.price.before)}</b>
        <i>→</i>
        <b>🪙${fmt(r.price.after)}</b>
        <em>${r.price.first ? '基准'
          : (r.price.delta > 0 ? '▲ +' : r.price.delta < 0 ? '▼ ' : '— ') +
            fmt(r.price.delta) + ' (' + (r.price.pct > 0 ? '+' : '') +
            r.price.pct + '%)'}</em>
      </div>` : ''}
    <div class="dv-foot">
      <span class="dv-why ${r.up ? 'up' : 'down'}">${
        r.up ? '▲' : '▼'} ${r.why}</span>
      <em>${r.ppg}分 ${r.rpg}板 ${r.apg}助</em>
    </div>
    ${(r.rows && r.rows.length) ? `
      <details class="dv-ref">
        <summary>📊 数据依据（综合评分 ${r.score > 0 ? '+' : ''}${
          r.score || 0}）</summary>
        <div class="dv-ref-body">
          <div class="dv-ref-hd"><span>指标</span><span>本人</span>
            <span>基准</span><span>差值</span></div>
          ${r.rows.map((x) => {
            const d = x.val - x.base;
            const isPct = (x.key === 'fgp' || x.key === 'tpp');
            const f = (v) => isPct
              ? (v * 100).toFixed(1) + '%' : v.toFixed(1);
            return `<div class="dv-ref-row${x.contrib > 0 ? ' plus'
              : x.contrib < 0 ? ' minus' : ''}">
              <span>${x.name}</span><span>${f(x.val)}</span>
              <span>${f(x.base)}</span>
              <span>${d > 0 ? '▲+' : d < 0 ? '▼' : ''}${
                isPct ? (d * 100).toFixed(1) + '%' : d.toFixed(1)}</span>
            </div>`;
          }).join('')}
          <div class="dv-ref-note">评分 ≥ +18 上调 · ≤ −18 下调 · 中间平稳不动</div>
        </div>
      </details>` : ''}
    <div class="dv-cum">赛季累计：
      ${Object.keys(adj).length
        ? Object.keys(adj).map((k) => `<i class="${
            adj[k] > 0 ? 'plus' : 'minus'}">${
            adj[k] > 0 ? '▲' : '▼'}${attrName(k)}${
            adj[k] > 0 ? '+' : ''}${adj[k]}</i>`).join('')
        : '<i class="none">无</i>'}
    </div>
  </div>`;
}

/* ---------- 调试：?rostertest=1 AI 阵容满员自检 ---------- */
(function rosterTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('rostertest')) return;
    const out = [];
    setTimeout(() => {
      // 先把所有 AI 阵容砍掉一半，模拟"删卡后缺人"
      const L = leagueState();
      let cut = 0;
      NBA_TEAMS.forEach((t, i) => {
        const e = L.teams[t.key];
        if (e && e.roster && i % 2 === 0) {
          cut += e.roster.length - 4;
          e.roster = e.roster.slice(0, 4);
        }
      });
      out.push('人为砍掉 ' + cut + ' 人（一半球队只剩 4 人）');
      const before = NBA_TEAMS.map((t) => (L.teams[t.key].roster || []).length);
      // 跑补齐
      const r = refillAIRosters(L);
      const after = NBA_TEAMS.map((t) => (L.teams[t.key].roster || []).length);
      out.push('补齐: ' + r.filled + ' 人 / ' + r.teams + ' 队');
      const min = Math.min.apply(null, after), max = Math.max.apply(null, after);
      out.push('补齐后人数 ' + min + '~' + max +
        (min >= 10 ? ' ✓全部满 10 人' : ' ✗还有队不满'));
      // 同球员是否重复
      let dup = 0;
      NBA_TEAMS.forEach((t) => {
        const set = new Set();
        (L.teams[t.key].roster || []).forEach((id) => {
          const k = playerKeyOf(id);
          if (set.has(k)) dup++;
          set.add(k);
        });
      });
      out.push('同队重复球员=' + dup + (dup === 0 ? ' ✓' : ' ✗'));
      // 实力是否合理（不该有队堆一堆超巨）
      const ovrs = NBA_TEAMS.map((t) => rosterOvr(L.teams[t.key].roster || []));
      const avg = Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length);
      out.push('联盟平均阵容评分=' + avg + '（最低 ' +
        Math.min.apply(null, ovrs) + ' 最高 ' + Math.max.apply(null, ovrs) + '）');
      out.push('异常=无');
      document.title = 'ROSTER ' + out.join(' | ');
    }, 1500);
  } catch (e) { document.title = 'ROSTER-ERR ' + e.message; }
})();

/* ---------- 调试：?rosternow=1 当前实际阵容人数 ---------- */
(function rosterNow() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('rosternow')) return;
    setTimeout(() => {
      const L = leagueState();
      const sizes = NBA_TEAMS.map((t) => (L.teams[t.key].roster || []).length);
      const short = NBA_TEAMS.filter((t) =>
        (L.teams[t.key].roster || []).length < 10);
      const out = [];
      out.push('30 队人数 ' + Math.min.apply(null, sizes) + '~' +
        Math.max.apply(null, sizes));
      out.push('不满 10 人的队=' + short.length +
        (short.length === 0 ? ' ✓全部满员' : ' ✗ ' +
          short.map((t) => t.abbr + ':' +
            (L.teams[t.key].roster || []).length).join(' ')));
      const total = sizes.reduce((a, b) => a + b, 0);
      out.push('联盟占用球员=' + total + ' / 卡池 ' + CARDS.length);
      const ovrs = NBA_TEAMS.map((t) => Math.round(rosterOvr(L.teams[t.key].roster || [])));
      out.push('阵容评分 ' + Math.min.apply(null, ovrs) + '~' +
        Math.max.apply(null, ovrs) + ' 平均 ' +
        Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length));
      document.title = 'ROSTERNOW ' + out.join(' | ');
    }, 1800);
  } catch (e) { document.title = 'ROSTERNOW-ERR ' + e.message; }
})();
