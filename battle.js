'use strict';
/* =============================================================
   卡牌对战 · 文字模拟 NBA 比赛
   ---------------------------------------------------------------
   规则：4 节 × 6 回合，每回合两队各攻一次（共 48 次进攻）
   判定：进攻方的相关能力 vs 防守方的相关能力 + 随机浮动
        结果可能是 命中(2/3分) / 不中 / 被封盖 / 被抢断 / 失误 / 造犯规罚球
   机制：体力（会累，需要轮换）、徽章加成、关键球、节间士气
   ============================================================= */

/* =============================================================
   ⚙️ 战斗配置（必须在文件最顶部，任何加载期常量之前）
   -------------------------------------------------------------
   ROSTER / SLOT_POS / FA 是**模块求值时就要求值**的配置常量。

   ★ v9.29 踩的坑（会让整个游戏白屏，务必记住）：
     原来这些常量声明在 1600 行左右，而 `const AI_SUB_TIRED` 在 847 行
     就写了 `(typeof FA !== 'undefined' && FA.SUB_TIRED) ? …`。
     **`typeof` 对处于 TDZ 的 const 会直接抛 ReferenceError**，
     它只在"变量从未声明"时才安全返回 'undefined'。
     于是 battle.js 一加载就抛 "Cannot access 'FA' before initialization"，
     整个对战模块失效 → 游戏白屏。
     修法：配置常量一律放在文件最前面，早于任何读取它们的代码。
   ============================================================= */
/* =============================================================
   ⚙️ 战斗配置（必须放在文件最前面）
   -------------------------------------------------------------
   ROSTER / SLOT_POS / FA 都是**模块加载时就要求值**的配置常量。
   它们原来声明在 1600 行左右，而 finalizeRoster() 在 2800 行 ——
   看起来在后面没关系，但任何在**加载期**调用 finalizeRoster 的代码
   都会踩 TDZ（Cannot access 'ROSTER' before initialization）。
   v9.29 加疲劳标定脚本时就撞上了这个。挪到最前面一次解决。
   ============================================================= */
/* 阵容规模：5 首发 + 7 替补（UI 一直按 7 个替补格渲染，改回 5 会静默失效）
   ★ 前置到这里是因为 finalizeRoster() 在文件更靠前的位置就会读它 ——
     原来它声明在下面，任何在上半部分调用 finalizeRoster 的代码
     都会踩 TDZ（Cannot access 'ROSTER' before initialization）。 */
const ROSTER = { starters: 5, bench: 7, total: 12 };
const SLOT_POS = ['PG', 'SG', 'SF', 'PF', 'C'];

/* =============================================================
   🎯 各位置最看重的能力（换人选人 + 位置评分用）
   -------------------------------------------------------------
   用户要求「优先换该位置能力值比较强的球员」——
   但"强"要按位置定义：控卫看组织与投射，中锋看护筐与篮板。
   权重不需要归一化（评分里会自己除总和）。
   ============================================================= */
const POS_NEED = {
  PG: { pass: 2.0, handle: 1.8, three: 1.4, mid: 1.0, perimD: 1.2, steal: 1.0, offBallSpeed: 0.8 },
  SG: { three: 2.0, mid: 1.4, perimD: 1.5, layup: 1.0, offBallSpeed: 1.0, steal: 1.0, handle: 0.8 },
  SF: { mid: 1.4, three: 1.3, perimD: 1.6, layup: 1.2, intD: 1.0, strength: 1.0, dreb: 1.0 },
  PF: { intD: 1.8, postD: 1.4, dreb: 1.8, oreb: 1.4, strength: 1.5, layup: 1.2, block: 1.2 },
  C:  { intD: 2.0, block: 1.8, dreb: 2.0, oreb: 1.6, strength: 1.8, postD: 1.4, standDunk: 1.0 },
};

/* =============================================================
   ⏳ 换人冷却回合数（v9.36）
   -------------------------------------------------------------
   ★ 这个常量必须是**模块级** —— 它被 aiRotate 和 manualAutoSub
     两个函数共用。我第一版把它写成了 aiRotate 内部的局部常量，
     结果用户点「自动换人」（走 manualAutoSub）时直接
     ReferenceError: SUB_COOLDOWN is not defined。

   作用：刚被换下的球员在这么多回合内不能再上场，
   防止"同一位置来回对调"（勒布朗 ↔ 格里芬 反复换）。
   ============================================================= */
const SUB_COOLDOWN = 8;

/* =============================================================
   🎯 换人选人评分（v9.36，aiRotate 与 manualAutoSub 共用）
   -------------------------------------------------------------
   用户要求：「换人优先换主副位」「优先换该位置能力值比较强的球员」。

   ★ 为什么提成函数：这段逻辑原来在两个换人函数里各写一遍，
     改一处漏一处（v9.34 的 slotPos 就是这么漏的）。

   评分构成：
     ① 位置适配（硬门槛）：本位 60 / 副位 38 / 客串 0（只作兜底）
     ② 该位置能力：按 POS_NEED 加权
     ③ 体力：越足越好
     ④ 综合
   ============================================================= */
function subScore(p, slot, bonus) {
  const need = POS_NEED[slot] || POS_NEED.SF;
  let abil = 0, wsum = 0;
  Object.keys(need).forEach((k) => {
    abil += (p.attrs[k] || 50) * need[k];
    wsum += need[k];
  });
  abil = wsum ? abil / wsum : 60;
  const fit = posFit(p.card, slot);
  const fitW = fit === 'primary' ? 60 : fit === 'secondary' ? 38 : 0;
  let v = fitW + abil * 0.75 + (p.stamina.cur / p.stamina.max) * 60
    + (p.ovr || 0) * 0.22;
  if (bonus) v += bonus(p);
  return { v, fit, abil };
}

/* =============================================================
   🎯 位置槽标记（v9.34 提为共享函数）
   -------------------------------------------------------------
   首发 5 人按顺序对应 PG/SG/SF/PF/C；替补席是"可用名单"，
   没有固定位置（slotPos 留空），换人时接手被换下那位的位。

   ★ 为什么提成函数：我方 `buildTeam` 和 AI 的
     `buildLeagueOpponent`（在 league.js）是**两套独立实现**。
     之前只给我方加了 slotPos，AI 队没加 —— 结果比赛界面
     只有我方显示位置徽章、对方一片空白（用户反馈的 bug）。
     现在两边都调这个函数，不会再走偏。
   ============================================================= */
/* =============================================================
   ⚠️ 客串惩罚（v9.35 新增）
   -------------------------------------------------------------
   用户要求：「比赛球员不在主位置和副位置打球的球员，
             能力值会大幅度削弱百分之六十」。

   规则：
     · 打**本位**（card.pos）  → 无惩罚
     · 打**副位**（card.pos2） → 无惩罚（双能位球员的第二位置）
     · 打**非本位非副位**     → 全部能力值 × 0.40（即削弱 60%）
     · 惩罚是**幂等**的：重复调用同一名球员不会叠乘（用 p.oop 记录）

   实现要点：
     直接缩放 p.attrs 的每一项。p.attrs 是**唯一出口** ——
     attackValue / defendValue / 五项防守 / 篮板判定 / 造犯规
     全都从它读，所以缩放一次就全局生效，不需要在战斗代码里
     到处插入判断（那样容易漏）。

     ★ 为什么不做成 statsOf() 的修正：
       statsOf 是卡级函数（图鉴 / 市场价 / 雷达图都用它，
       它们不涉及"打哪个位置"），把位置相关逻辑塞进去会污染它们。
       mkPlayer 是**上场球员**级，位置信息在这一层才存在。

     ⚠️ 不缩放的部分（刻意的）：
       · p.ovr  —— 保留"纸面综合"，否则玩家看不出他本来多强
       · stamina —— 体能不受位置影响
       · badges  —— 徽章判定用的是属性，属性降了效果自然跟着降
    ============================================================= */
const OOP_PENALTY = 0.60;          // 最大削弱 60%（最远的位置距离）
const OOP_MIN_MULT = 0.05;         // 防止属性归零

/* =============================================================
   ⚠️ 客串惩罚分档（v9.36 优化）
   -------------------------------------------------------------
   用户要求保留惩罚，但要「优化」。

   原版是一刀切 -60% —— 库里打 SF 和打 C 惩罚完全一样，不合理：
   他是个 188cm 的控卫，被顶到小前锋只是"尺寸吃亏"，
   被顶到中锋是"完全错位"。真实篮球里这两种情况的代价差很多。

   现在按**场上位置距离**分档（位置序号 0=PG … 4=C）：
     距离 1（相邻）  → 保留 75%（-25%）
     距离 2          → 保留 55%（-45%）
     距离 3          → 保留 42%（-58%）
     距离 4（两端）  → 保留 40%（-60%，与用户要求一致）

   距离取球员两个位置里**较近**的那个：
   库里(PG+SG) 打 SF → 从 SG 到 SF 距离 1 → -25%
   库里(PG+SG) 打 C  → 从 SG 到 C  距离 3 → -58%
   姚明(C+PF)  打 PG → 从 PF 到 PG 距离 3 → -58%

   ★ 用户要求的"削弱 60%"作为**上限**保留 —— 最错位的情况仍然是 -60%。
   ============================================================= */
const OOP_TIER_MULT = [1, 0.75, 0.55, 0.42, 0.40];   // 下标 = 位置距离

/** 场上位置距离：取球员两个位置里离 slot 较近的那个 */
function posDistance(card, slot) {
  if (!card || !slot) return 4;
  const a = SLOT_POS.indexOf(card.pos);
  const b = SLOT_POS.indexOf(card.pos2);
  const t = SLOT_POS.indexOf(slot);
  if (t < 0) return 4;
  let d = 4;
  if (a >= 0) d = Math.min(d, Math.abs(a - t));
  if (b >= 0) d = Math.min(d, Math.abs(b - t));
  return d;
}

/**
 * 给一名球员施加/撤销客串惩罚。
 * @param {Object} p    球员对象（mkPlayer 产物）
 * @param {string} slot 他实际打的位置（'' 表示不在场上）
 */
function applyOutOfPosPenalty(p, slot) {
  if (!p || !p.attrs) return p;
  /* 先撤销上一次的惩罚（重建基础属性），保证幂等 */
  if (p.oop && p.oop.baseAttrs) {
    p.attrs = Object.assign({}, p.oop.baseAttrs);
    p.oop = null;
  }
  if (!slot) return p;                       // 不在场上 → 无惩罚

  const fit = posFit(p.card, slot);
  if (fit !== 'out') return p;               // 本位 / 副位 → 无惩罚

  /* 记下原始属性，之后可以精确撤销 */
  const base = Object.assign({}, p.attrs);
  /* ★ v9.36：按位置距离分档，而不是一刀切 -60% */
  const dist = posDistance(p.card, slot);
  const mult = Math.max(OOP_MIN_MULT, OOP_TIER_MULT[dist] != null ? OOP_TIER_MULT[dist] : 0.40);
  const scaled = {};
  Object.keys(p.attrs).forEach((k) => {
    const v = p.attrs[k];
    scaled[k] = (typeof v === 'number') ? Math.round(v * mult) : v;
  });
  p.attrs = scaled;
  p.oop = { fit: 'out', slot, mult, dist,
    penalty: Math.round((1 - mult) * 100) / 100, baseAttrs: base };
  return p;
}

/* =============================================================
   🎯 最优首发匹配（v9.35 新增）
   -------------------------------------------------------------
   背景：原来排首发是**贪心**的 —— 按 PG→SG→SF→PF→C 顺序，
   每个位置挑"当前剩下里最强的合法球员"。

   贪心会遇到这种情况：先挑的位置吃掉了后面的资源。
   审计结果：全联盟 30 队里有 **4 队、共 7 个位置**被迫客串，
   最惨的骑士队 3 个位置：
     SG←勒布朗(SF+PF)  SF←凯文·乐福(PF+C)  C←大流士·加兰(PG+SF)

   现在改成**回溯搜索最优匹配**：找出"每个位置都有合法球员"的
   分配里综合值最高的那个。5 个位置 × 10 人的规模极小，
   搜索瞬间完成。

   搜索策略（按优先级）：
     ① 最大化"合法位置数"（尽量不客串）—— 这是首要目标
     ② 同等合法数下，最大化首发综合值
     ③ 同等综合下，让每名球员都在自己的**本位**（而不是副位）

   @param {Array} cards 候选卡（会按 ovr 降序排好）
   @returns {{starters: Array<card|null>, filled: Object, oopCount: number}}
   ============================================================= */
/* =============================================================
   ★★★ v9.51 修复：首发分配忽略了突破等级（用户实测踩到）
   -------------------------------------------------------------
   现象：6 突破的时刻科比（真实综合 122）被排在替补，
         0 突破的时刻韦德（真实综合 113）却占了首发。

   根因：bestStarterAssignment() 里两处都用了**卡片的基础 ovr**
   （`c.ovr` = 卡面写死的值，不含突破加成）：
        .sort((a, b) => (b.ovr||0) - (a.ovr||0))   ← 排序
        ovr += (c.ovr || 0);                        ← 评分
   而韦德 113 / 科比 112（基础值科比更低）→ 韦德被排在前面。

   而 smartLineup 选池子时用的是**真实综合**（statsOf(c, brk)），
   所以是"选人的时候对、排首发的时候错"，两套口径不一致。

   修法：这个函数只认 `ovr` 字段，那就在调用前把真实综合**注入**进去。
   用轻量包装对象（不比 [...cards] 重），并把真实值写进 `ovr`。
   ============================================================= */
/**
 * 给卡片的 ovr 注入"含突破的真实综合值"，供 bestStarterAssignment 使用。
 * @param {Array} cards 卡片对象数组
 * @returns {Array} 包装后的数组（每项是 {card, pos, pos2, ovr, ...} 的浅拷贝）
 */
function withRealOvr(cards) {
  return (cards || []).filter(Boolean).map((c) => {
    let ovr = c.ovr || 0;
    try {
      if (typeof statsOf === 'function') {
        const o = (typeof S !== 'undefined' && S.owned) ? S.owned[c.id] : null;
        const brk = o ? (o.brk || 0) : 0;
        ovr = statsOf(c, brk).ovr;
      }
    } catch (e) { /* 拿不到就退回基础值 */ }
    /* 浅拷贝 + 覆盖 ovr。pos / pos2 等字段保持原样，canPlayPos 才认得 */
    return Object.assign({}, c, { ovr, card: c });
  });
}

function bestStarterAssignment(cards) {
  /* ★ 性能：候选池必须剪枝。
     一盘 542 张卡里"能打某个位置"的球员可能有 200+ 个，
     如果每个位置都遍历整个池子，分支数会到 200^5 —— 直接卡死
     （v9.35 第一版就是这么写的，120 场模拟跑 10 分钟没跑完）。

     剪枝依据：我们只需要 5 名首发，所以**只可能从综合最高的
     前 OOP_POOL 名里选**。前 16 名足够覆盖"每个位置都有人能打"
     的所有现实情况（最坏情况：每个位置只有 2 个候选 = 10 人）。
     再配合记忆化，状态数被压到极小。 */
  const OOP_POOL = 16;
  const sorted = (cards || []).filter(Boolean).slice()
    .sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
  const pool = sorted.slice(0, OOP_POOL);
  const P = pool.length;
  const N = SLOT_POS.length;
  if (!P) {
    return { starters: new Array(N).fill(null), filled: {}, oopCount: 0 };
  }
  /* 预计算每名球员能打的位置（用位掩码加速 5 个槽位） */
  const mask = new Array(P).fill(0);
  for (let k = 0; k < P; k++) {
    let m = 0;
    for (let i = 0; i < N; i++) {
      if (canPlayPos(pool[k], SLOT_POS[i])) m |= (1 << i);
    }
    mask[k] = m;
  }
  /* 记忆化：mem[i][used] = 只考虑位置 i..N-1 且 used 已占用时的最大合法数
     used 是球员位掩码（P ≤ 16 → 最多 65536 个状态） */
  const memo = new Map();
  const dfsLegal = (i, used) => {
    if (i === N) return 0;
    const key = i * 65536 + used;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let bestv = dfsLegal(i + 1, used);              // 这个位置先空着
    for (let k = 0; k < P; k++) {
      if (used & (1 << k)) continue;
      if (!(mask[k] & (1 << i))) continue;          // 不能打这个位置
      const v = 1 + dfsLegal(i + 1, used | (1 << k));
      if (v > bestv) bestv = v;
    }
    memo.set(key, bestv);
    return bestv;
  };
  const target = dfsLegal(0, 0);   // 最多能填几个合法位置

  /* 在"合法数 = target"的前提下，挑综合值最高的一组；
     同分再比"本位"数量（让球员尽量打本位而不是副位）。
     贪心 + 回溯：按位置顺序，优先选综合高的球员。 */
  let bestArr = null, bestScore = null;
  const cur = new Array(N).fill(null);
  const curUsed = new Set();
  const scoreOf = (arr) => {
    let legal = 0, ovr = 0, primary = 0;
    for (let i = 0; i < N; i++) {
      const c = arr[i];
      if (!c) continue;
      const f = posFit(c, SLOT_POS[i]);
      if (f !== 'out') legal++;
      if (f === 'primary') primary++;
      ovr += (c.ovr || 0);
    }
    return { legal, ovr, primary };
  };
  const better = (a, b) => {
    if (!b) return true;
    if (a.legal !== b.legal) return a.legal > b.legal;
    if (a.ovr !== b.ovr) return a.ovr > b.ovr;
    return a.primary > b.primary;
  };
  const dfsPick = (i, used) => {
    if (i === N) {
      const sc = scoreOf(cur);
      if (sc.legal === target && better(sc, bestScore)) {
        bestScore = sc; bestArr = cur.slice();
      }
      return;
    }
    /* "这个位置空着"分支 */
    dfsPick(i + 1, used);
    /* 选人分支：pool 已按 ovr 降序，先试强的 */
    for (let k = 0; k < P; k++) {
      if (used & (1 << k)) continue;
      if (!(mask[k] & (1 << i))) continue;
      cur[i] = pool[k];
      dfsPick(i + 1, used | (1 << k));
      cur[i] = null;
    }
  };
  dfsPick(0, 0);

  const arr = (bestArr || cur).slice();
  const filled = {};
  let oopCount = 0;
  arr.forEach((c, i) => {
    if (!c) return;
    const f = posFit(c, SLOT_POS[i]);
    filled[SLOT_POS[i]] = f;
    if (f === 'out') oopCount++;
  });
  return { starters: arr, filled, oopCount };
}

function markSlotPos(players) {
  (players || []).forEach((p, i) => {
    p.slotPos = SLOT_POS[i] || '';
    /* ★ 标位置的同时施加客串惩罚 —— 保证"位置"和"能力"永远同步，
       不会出现"标了位置但忘了惩罚"的漏网情况 */
    applyOutOfPosPenalty(p, p.slotPos);
  });
  return players;
}

/* =============================================================
   🎯 位置合法性（v9.32 新增）
   -------------------------------------------------------------
   规则（用户要求）：
     · 每个球员只能打**自己的位置**
     · 双能位球员可以打两个位置（数据和现实一致）
         PG+SG → 能打 PG 和 SG
         C+PF  → 能打 C 和 PF
     · 首发五个位置（PG/SG/SF/PF/C）必须**各有一个合法球员**
     · 替补席不限制位置（它是"可用名单"，不是场上位置）

   ★ 数据核对：542 张卡**全部**都有 pos 和 pos2，且两者不同，
     所以每张卡恰好能打两个位置，不存在单位置球员。
     如果以后加了单位置球员（pos2 === pos 或为空），
     canPlayPos / posFit 依然正确（会退化成只能打一个位置）。

   适配度分三档，用于 UI 着色与提示：
     'primary'   本位（slot === card.pos）        → 绿
     'secondary' 副位（slot === card.pos2）       → 黄
     'out'       不能打这个位置                    → 红（会被拦截）
   ============================================================= */
/** 某张卡能打的位置列表（去重，最多 2 个） */
function positionsOf(card) {
  if (!card) return [];
  const out = [];
  if (card.pos) out.push(card.pos);
  if (card.pos2 && card.pos2 !== card.pos) out.push(card.pos2);
  return out;
}
/** 这张卡能不能打 slot 位置 */
function canPlayPos(card, slot) {
  if (!card || !slot) return false;
  return card.pos === slot || card.pos2 === slot;
}
/** 适配度：'primary' | 'secondary' | 'out' */
function posFit(card, slot) {
  if (!card || !slot) return 'out';
  if (card.pos === slot) return 'primary';
  if (card.pos2 === slot) return 'secondary';
  return 'out';
}
/** 位置适配度的中文说明（给 toast / 提示用） */
function posFitText(card, slot) {
  const f = posFit(card, slot);
  if (f === 'primary') return '本位';
  if (f === 'secondary') return '副位';
  return '不能打' + (SLOT_CN[slot] || slot);
}
/** 某名球员所有可打位置的字符串（提示用） */
function posListText(card) {
  return positionsOf(card).map((x) => x + '（' + (SLOT_CN[x] || x) + '）').join(' 或 ');
}

const FA = {
  /* =============================================================
     基础消耗乘数（v9.31 重新标定）
     -------------------------------------------------------------
     ★ 上一版（v9.29）标到 12.3 / 9.2，标定目标是"最累者终场 50~60%"。
       但那个目标本身是错的 —— 它按"12 人分摊 48 次进攻"算，
       可实际上每个首发一场只参与约 5 次进攻，掉得**很集中**：
       个别球员会掉到 60% 以下，而全队均值还有 95%。
       结果就是玩家看到的"**有些人掉得太快**"，同时
       因为轮换阈值 0.40 太低，又"**怎么都不换人**"。

     ★ 现在的标定目标（按"场上 5 人"而不是"全队 12 人"衡量）：
         终场场上均值   92~95%（累了但还能打）
         整场最低       50~58%（个别球员会明显喘，才会触发换人）
         场均自动换人   1.5~2.5 次，且四节都有

       实测 k=1.2 → 12.3×1.2≈14.8 / 9.2×1.2≈11.0 命中该区间
       （终场均值 93%、最低 54%、场均换人 1.7 次、四节分布 0.1/0.3/0.5/0.8）。

     ⚠️ 改这两个值必须重跑体力标定（工程交接说明第十二章有脚本说明），
        并且**必须按"场上 5 人"衡量**，不能看全队 12 人均值 —— 会得出错误结论。
     ============================================================= */
  /* ★ v9.36 再次下调：用户反馈"体力掉得太快"。
     扫描过 0.55 / 0.65 / 0.75 / 0.85 四档（各 30 场）：
       0.55 → 终场均值 93%、整场最低 53%、场均换人 4.2
       0.65 → 终场均值 91%、整场最低 49%、场均换人 4.1  ← 采用
       0.75 → 终场均值 88%、整场最低 43%、场均换人 4.5
       0.85 → 终场均值 86%、整场最低 38%、场均换人 5.0
     0.65 这一档比上一版（14.8/11.0）明显缓和：
       终场均值 85% → 91%，整场最低 38% → 49%。 */
  DRAIN_ATK: 9.6,        // 进攻端基础消耗乘数（= 14.8 × 0.65）
  DRAIN_DEF: 7.2,        // 防守端基础消耗乘数（= 11.0 × 0.65）
  /* ---- 体力 → 能力衰减 ---- */
  DIP: 0.60,             // 体力低于这个比例才开始影响能力
  FLOOR: 0.62,           // 体力耗尽时的能力系数下限（×0.62）
  TIP: 0.30,             // 低于此比例进入"透支"：防守选位失灵、更容易被针对
  /* ---- 自动轮换阈值 ----
     ★ v9.31 重要修正：原来 SUB_TIRED = 0.40，但实测一场比赛里
       首发体力**最低只到 62%**（12 人分摊 48 次进攻，单人参与很少），
       永远够不到 40% —— 于是「自动换人」按钮点了没反应、AI 也几乎不换人。
       而 0.40 本身也不合理：真实篮球在 60% 左右就该轮换了。

       查出来的矛盾是：如果为了触发 0.40 而加大体力消耗，
       终场就会掉到 30%（玩家反馈的"体力掉太快"）。
       两个诉求（体力别掉太快 / 换人要触发）只能靠**提高阈值**同时满足。

       现在 SUB_TIRED = 0.70。扫描过 0.66 / 0.70 / 0.74 / 0.78 / 0.82
       五档（各 40 场），全部满足「40 场里没有一场出现 0 次换人」：
         0.66 → 场均 3.9 次 / 终场均值 85%
         0.70 → 场均 4.3 次 / 终场均值 88%  ← 采用（换人最可靠、体力最稳）
         0.74 → 场均 4.2 次 / 终场均值 87%
       ⚠️ 别调到 0.63 以下：那个值太贴边，实测会出现"整场一次都不换"。 */
  /* ★ v9.36：消耗下调后，阈值同步微调（换人仍然会触发，但不再频繁） */
  SUB_TIRED: 0.74,       // 自动换人的体力阈值
  SUB_CLUTCH: 0.58,      // 关键时段放宽（让主力多撑一会儿）
  SUB_GARBAGE: 0.86,     // 垃圾时间收紧（多给替补机会）
  Q_REST_ON: 0.10,       // 节间休息：场上球员恢复（占上限比例）
  Q_REST_OFF: 0.20,      // 节间休息：场下球员恢复（坐板凳回得快 —— 轮换的回报）
  TO_REST: 0.16,         // 暂停恢复
};

/* =============================================================
   球队
   ============================================================= */
/* ★ 替补 7 人：球队管理页一直按 7 个替补格渲染
   （renderTeamUI 里 concat([null×7]).slice(0,7)，一键换人的提示也写着「首发 5 + 替补 7」），
   但这里原来写的是 5，导致 rosterIds()/finalizeRoster() 每次读取都把第 6、7 个替补截掉 ——
   表现就是「拖到替补 6 / 替补 7 没反应」，assignToSlot 还返回 true，属于静默失败。 */


/** 拥有的卡按综合分从高到低 */
function ownedByOvr() {
  return CARDS.filter((c) => S.owned[c.id])
    .sort((a, b) => statsOf(b, S.owned[b.id].brk).ovr - statsOf(a, S.owned[a.id].brk).ovr);
}

/** 自动排 12 人名单：首发尽量按位置齐整，剩下按综合分补 */
function autoLineup() {
  /* 同一名球员只保留综合分最高的那一张（ownedByOvr 已按分数降序），
     其余的卡不参与排阵 —— 这样自动补阵永远不会出现两个科比。 */
  const seenPlayer = new Set();
  const owned = ownedByOvr().filter((c) => {
    const k = playerKeyOf(c.id);
    if (seenPlayer.has(k)) return false;
    seenPlayer.add(k);
    return true;
  });
  /* =============================================================
     🎯 按位置排首发（v9.32）
     -------------------------------------------------------------
     原来的写法有个隐患：某个位置没人能打时，后面的兜底会把
     "剩下综合最高的"直接塞进去 —— 于是控卫位置可能出现一个中锋。

     现在分两步：
       ① 先按位置挑**合法球员**（本位优先，其次副位）
       ② 只有当某个位置**确实没人能打**时，才用剩下最好的填，
          并在位置标记上显示为"客串"（红色），让玩家看得见问题
     ============================================================= */
  const used = new Set(), starters = [], bench = [];
  /* ★ v9.35：改用**最优匹配**（回溯搜索）代替原来的三步贪心。
     贪心会让先挑的位置吃掉后面的资源，导致本可避免的客串
     （审计发现全联盟 30 队里 4 队、共 7 个客串位置）。 */
  const asg = bestStarterAssignment(withRealOvr(owned));
  const filled = asg.filled;
  asg.starters.forEach((c) => {
    if (c) { used.add(c.id); starters.push(c); }
    else starters.push(null);
  });
  /* 兜底：确实没人能打这个位置（人才库里就是缺）→ 用剩下最好的客串。
     这种情况无法避免，但会被标红 + 触发 -60% 惩罚。 */
  SLOT_POS.forEach((pos, i) => {
    if (starters[i]) return;
    const spare = owned.find((c) => !used.has(c.id));
    if (!spare) return;
    used.add(spare.id); starters[i] = spare; filled[pos] = 'out';
  });
  starters.forEach((id, i) => {
    if (id && !filled[SLOT_POS[i]]) {
      filled[SLOT_POS[i]] = posFit(CARD_BY_ID[id], SLOT_POS[i]);
    }
  });
  owned.forEach((c) => {
    if (bench.length >= ROSTER.bench || used.has(c.id)) return;
    used.add(c.id); bench.push(c.id);
  });
  /* ★ 返回值必须统一成「id | null」的数组。
     上面第一步 push 的是 id，第二/三步 push 的是**卡片对象** ——
     混着两种类型会让 rosterIds() 里的 CARD_BY_ID[id] 拿到 undefined，
     直接抛 "Cannot read properties of undefined (reading 'pos')" 崩掉渲染。
     （v9.32 自己踩的，浏览器冒烟才抓到。） */
  const starterIds = starters.map((x) => (x && x.id ? x.id : (x || null)));
  /* 非法首发的数量（用于提示"你的阵容有位置问题"） */
  const illegal = starterIds.filter((id, i) =>
    id && CARD_BY_ID[id] && posFit(CARD_BY_ID[id], SLOT_POS[i]) === 'out').length;
  return { starters: starterIds, bench: bench.map((x) => (x && x.id ? x.id : x)),
    filled, illegal };
}


/* =============================================================
   智能一键换人（v9.2）—— 会算工资帽的自动排阵
   -------------------------------------------------------------
   用户要求：一键换人不能只堆高综合的卡，还要
     ① 卡在工资帽以内
     ② 尽量凑成「5 紫 + 5 金 + 2 银」这个最优形状
     ③ 首发按位置摆，各位置挑能力值最高的

   做法分四步：
     1. 同一名球员只留综合最高的那一张（和 autoLineup 一致，
        避免阵容里同时出现两个科比）
     2. 按「工资档位」分成三组：紫（紫/名宿紫/时刻紫）、
        金（金/时刻金）、银。组内按综合降序
     3. 按 5 紫 + 5 金 + 2 银 的配额取人，**每次加人都先验工资**，
        超出工资帽就跳过这一张。某个档位存货不够时，
        用别的档位补（先补便宜的银，再金，最后紫）
     4. 首发按 PG/SG/SF/PF/C 依次挑：先找本位精确匹配的，
        没有就找副位置匹配的，都没有就拿剩下里综合最高的
   ============================================================= */
/** 一张卡属于哪个「工资档位」：紫 / 金 / 银 */
function salaryClassOf(card) {
  const t = card && card.tier;
  if (t === 'silver') return 'silver';
  if (t === 'gold' || t === 'momentGold') return 'gold';
  return 'purple';        // purple / legendPurple / momentPurple 都是 4500 万
}

/**
 * 智能排阵：返回 { starters, bench, salary, comp }
 * comp 里记录最终拿到几紫几金几银，方便界面提示。
 */
function smartLineup() {
  const cap = (typeof SALARY_CAP !== 'undefined') ? SALARY_CAP : 400000000;
  const priceOf = (c) => salaryOfTier(c.tier);

  /* ---- 1. 同一名球员只留综合最高的一张 ---- */
  const seen = new Set();
  const pool = ownedByOvr().filter((c) => {
    const k = playerKeyOf(c.id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  /* ---- 2. 按工资档位分组（ownedByOvr 已是综合降序，分组后仍有序）---- */
  const groups = { purple: [], gold: [], silver: [] };
  pool.forEach((c) => { groups[salaryClassOf(c)].push(c); });

  /* ---- 3. 按 5/5/2 配额取人，全程验工资帽 ---- */
  const picked = [];
  const used = new Set();
  let total = 0;
  const takeMore = (grp, n) => {
    let got = 0;
    for (const c of groups[grp]) {
      if (got >= n) break;
      if (used.has(c.id)) continue;
      const p = priceOf(c);
      if (total + p > cap) continue;          // ★ 加他就超帽 → 跳过
      used.add(c.id); picked.push(c); total += p; got++;
    }
    return got;
  };

  /* 目标形状：5 紫 + 5 金 + 2 银（= 3.91 亿，正好卡进 4 亿） */
  const WANT = { purple: 5, gold: 5, silver: 2 };
  let short = ROSTER.total;
  ['purple', 'gold', 'silver'].forEach((g) => {
    short -= takeMore(g, Math.min(WANT[g], short));
  });

  /* 存货不够就用别的档位补：先补便宜的银，再金，最后紫（贵的放最后） */
  if (short > 0) {
    ['silver', 'gold', 'purple'].forEach((g) => {
      if (short > 0) short -= takeMore(g, short);
    });
  }
  /* 还有缺口（比如全是超帽的紫卡）→ 从整个池子里挑还放得下的 */
  if (short > 0) {
    for (const c of pool) {
      if (short <= 0) break;
      if (used.has(c.id)) continue;
      const p = priceOf(c);
      if (total + p > cap) continue;
      used.add(c.id); picked.push(c); total += p; short--;
    }
  }

  /* ---- 3.5 升级：还有工资空间就换成更强的 ----
     典型场景：玩家一张紫卡都没有，只凑出「5金+7银 = 2.06亿」，
     白白剩 1.94 亿没花。这里把阵容里最弱的卡，
     换成池子里还放得下的最强卡（换完工资不超帽才换）。
     正常情况（5紫+5金+2银 = 3.91亿）只剩 900 万空间，
     银→金要 +2200 万，换不动，所以形状不会被破坏。 */
  {
    const ovrOf = (c) => statsOf(c, S.owned[c.id] ? S.owned[c.id].brk : 0).ovr;
    const spare = pool.filter((c) => !used.has(c.id));   // 已按综合降序
    for (const c of spare) {
      const p = priceOf(c);
      let worst = -1, worstOvr = Infinity;
      for (let i = 0; i < picked.length; i++) {
        const o = ovrOf(picked[i]);
        if (o < worstOvr && total - priceOf(picked[i]) + p <= cap) {
          worstOvr = o; worst = i;
        }
      }
      if (worst < 0) continue;
      if (ovrOf(c) <= worstOvr) continue;      // 换上去没更强就不换
      const old = picked[worst];
      total = total - priceOf(old) + p;
      used.delete(old.id);
      used.add(c.id);
      picked[worst] = c;
    }
  }

  /* ---- 4. 首发按位置挑，剩下进替补 ---- */
  picked.sort((a, b) => statsOf(b, S.owned[b.id] ? S.owned[b.id].brk : 0).ovr
    - statsOf(a, S.owned[a.id] ? S.owned[a.id].brk : 0).ovr);
  /* ★ v9.35：与 autoLineup 共用**最优匹配**（回溯搜索），
     保证"能在合法位置打球的人一定被排进合法位置"。 */
  const asg2 = bestStarterAssignment(withRealOvr(picked));
  const starters = asg2.starters.slice();
  const smartFilled = asg2.filled;
  const starterTaken = new Set();
  starters.forEach((c) => { if (c) starterTaken.add(c.id); });
  const rest = picked.filter((c) => !starterTaken.has(c.id));
  /* 兜底：真没人能打这个位置 → 客串并标红（会触发 -60% 惩罚） */
  SLOT_POS.forEach((pos, i) => {
    if (starters[i] || !rest.length) return;
    const spare = rest.shift();
    starters[i] = spare; smartFilled[pos] = 'out';
  });
  /* 首发不足 5 人（卡太少）时用空位补齐 */
  while (starters.length < ROSTER.starters) starters.push(null);
  /* 注：bench 在下面的"补满 12 人"之后才算 —— 否则补进来的人不会进替补席 */

  /* =============================================================
     ★ 补满到 12 人（v9.32 修）
     -------------------------------------------------------------
     原来 smartLineup 只排到"5 紫 + 5 金 + 2 银"的配额就返回，
     实际只给出 **10 人**（5 首发 + 5 替补），而游戏需要 12 人。

     后果是一条死锁链：
       ① 一键换人 → smartLineup 排出 3.90 亿的合规 10 人
       ② finalizeRoster 发现缺 2 人 → 从池子里补
       ③ 补进来的是贵的（紫/金）→ 总工资冲到 4.80 亿 > 4 亿
       ④ salaryGuard 拦截 → **玩家看到"阵容排好了但开不了赛"**

     现在 smartLineup 自己补满：在帽子内**优先用便宜的**填满 12 人，
     放不下就宁可留空位（空位不计工资，比赛照样能打）。
     ============================================================= */
  const wantTotal = ROSTER.total;
  const takenIds = new Set(picked.map((c) => c.id));
  const cheapPool = pool.filter((c) => !takenIds.has(c.id))
    .sort((a, b) => priceOf(a) - priceOf(b)
      || statsOf(b, S.owned[b.id] ? S.owned[b.id].brk : 0).ovr
       - statsOf(a, S.owned[a.id] ? S.owned[a.id].brk : 0).ovr);
  for (const c of cheapPool) {
    if (picked.length >= wantTotal) break;
    const p = priceOf(c);
    if (total + p > cap) continue;          // ★ 会超帽 → 跳过
    picked.push(c); total += p;
  }
  /* ★ bench 必须在这里算：首发占掉的人要从替补里排除，
     否则首发会被重复放进替补席（也修掉了"补进来的人不进替补"的问题） */
  const starterIdSet = new Set(starters.filter(Boolean).map((c) => c.id));
  const bench = picked.filter((c) => !starterIdSet.has(c.id)).slice(0, ROSTER.bench);

  const comp = { purple: 0, gold: 0, silver: 0 };
  picked.forEach((c) => { comp[salaryClassOf(c)]++; });

  const smartIllegal = starters.filter((c, i) =>
    !!(c && posFit(c, SLOT_POS[i]) === 'out')).length;
  return { starters: starters.map((c) => (c ? c.id : null)),
    bench: bench.map((c) => c.id), salary: total, comp,
    filled: smartFilled, illegal: smartIllegal,
    over: total > cap };
}

/** 一键回到智能自动补满（会算工资帽） */
function refillSmartRoster() {
  const r = smartLineup();
  S.rosterManual = false;
  S.roster = { starters: r.starters.filter(Boolean), bench: r.bench.filter(Boolean) };
  save();
  try { Sfx.reveal('gold'); } catch (e) {}
  const w = (v) => (v / 1e8).toFixed(3) + '亿';
  const c = r.comp;
  toast('已智能排阵：' + c.purple + '紫 + ' + c.gold + '金 + ' + c.silver
    + '银 · 工资 ' + w(r.salary) + (r.over ? '（仍超帽）' : ''));
  renderRoster();
  renderBattle();
  if (typeof renderTeamUI === 'function') renderTeamUI();
  return r;
}

/** 取当前名单，自动补齐缺失位置、剔除已不存在的卡 */
/* =============================================================
   同一名球员只能上一张卡
   -------------------------------------------------------------
   500 张卡里有 60 名球员各有多张（现役 + 时刻，档位可能不同）。
   阵容（首发 + 替补）里同一名球员**只能出现一次**。
   不论银卡/金卡/时刻金卡/紫卡/时刻紫卡，一律适用。
   ============================================================= */
/** 阵容里是否已经有这名球员的**另一张**卡 */
function playerConflictInRoster(cardId, ignoreId) {
  if (!cardId) return null;
  const r = rosterIds();
  const all = r.starters.concat(r.bench).filter(Boolean);
  for (let i = 0; i < all.length; i++) {
    const other = all[i];
    if (other === cardId) continue;                 // 自己不算冲突
    if (ignoreId && other === ignoreId) continue;   // 被替换掉的那个也不算
    if (samePlayer(other, cardId)) return other;
  }
  return null;
}
/** 冲突提示的统一文案 */
function conflictMsg(cardId, otherId) {
  const a = CARD_BY_ID[cardId], b = CARD_BY_ID[otherId];
  if (!a || !b) return '同一名球员只能上一张卡';
  return `⚠️ ${a.name} 已经在阵容里了\n\n` +
    `阵容中已有：${TIERS[b.tier].name} · ${b.name}\n` +
    `要上的是：${TIERS[a.tier].name} · ${a.name}\n\n` +
    `同一名球员只能上一张卡（任何档位都一样），请先把原来那张换下。`;
}
/** 尝试把人放进阵容，有冲突就弹提示并返回 false */
function guardSamePlayer(cardId, ignoreId) {
  const hit = playerConflictInRoster(cardId, ignoreId);
  if (!hit) return true;
  const a = CARD_BY_ID[cardId], b = CARD_BY_ID[hit];
  Sfx.fail();
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  toast(`⚠️ 阵容里已经有相同球员：${b ? b.name : ''}` +
    `（${b ? TIERS[b.tier].name : ''}）\n同一名球员只能上一张卡`);
  // 详情浮层里给出完整说明
  showConflictDialog(cardId, hit);
  return false;
}

function rosterIds() {
  const auto = autoLineup();
  /* =============================================================
     🧮 补人池必须用 smartLineup（v9.35 修）
     -------------------------------------------------------------
     `autoLineup()` **完全不看工资帽** —— 拿它当补人池会出事：
       ① 玩家点「一键换人」→ smartLineup 排出 3.90 亿合规阵容
       ② finalizeRoster 发现人数不足 → 从 autoLineup 补人
       ③ 补进来的是贵卡 → 总工资冲到 5.25 亿 > 4 亿
       ④ salaryGuard 拦截 → **打不了比赛**
     （v9.32 只给补人加了价格检查，但源头池子就是错的，仍会踩。）

     现在补人池改用 smartLineup()：它自己就带工资帽约束，
     且在帽内**优先用便宜的**填满 12 人。
     autoLineup 只作为"连 smartLineup 都排不出来"时的最后兜底。
     ============================================================= */
  const smart = (() => {
    try { return smartLineup(); } catch (e) { return null; }
  })();
  if (!S.roster || !Array.isArray(S.roster.starters)) {
    S.roster = auto; S.rosterManual = false;
  }
  /* -------------------------------------------------------------
     手动模式：用户自己卸下过球员
     这时**完全按他摆的位置来**，空位就空着，不自动补人 ——
     否则一卸下就立刻被替补/池子里的人顶回来，没法"留空"。
     ------------------------------------------------------------- */
  if (S.rosterManual) {
    const used = new Set();
    const clean = (arr, max) => Array.from({ length: max }, (_, i) => {
      const id = (arr || [])[i];
      if (!id || !S.owned[id] || used.has(id)) return null;
      used.add(id); return id;
    });
    return {
      starters: clean(S.roster.starters, ROSTER.starters),
      bench: clean(S.roster.bench, ROSTER.bench),
    };
  }
  const seen = new Set();
  const keep = (arr, max) => (arr || []).filter((id) => {
    if (!S.owned[id] || seen.has(id)) return false;
    seen.add(id); return true;
  }).slice(0, max);
  let starters = keep(S.roster.starters, ROSTER.starters);
  let bench = keep(S.roster.bench, ROSTER.bench);
  /* =============================================================
     🧮 补人时必须看工资帽（v9.32 修）
     -------------------------------------------------------------
     原来补人池来自 autoLineup()，而 **autoLineup 完全不看工资帽**。
     于是出现过这种死锁：
       ① 玩家点「一键换人」→ smartLineup 排出 3.90 亿的合规阵容（10 人）
       ② finalizeRoster 发现只有 10 人，从 autoLineup 补 2 张贵卡
       ③ 总工资 4.80 亿 > 4 亿上限 → salaryGuard 拦截 → **打不了比赛**
     玩家看到的是「排好阵容却开不了赛」，而且不知道该删谁。

     现在按工资从低到高补人：优先便宜的（银卡），够了就停；
     实在放不下就留空位（空位不计工资，比赛仍可进行）。
     ============================================================= */
  const cap = (typeof SALARY_CAP !== 'undefined') ? SALARY_CAP : 400000000;
  let spent = starters.concat(bench).reduce((sum, id) => {
    const c = CARD_BY_ID[id];
    return sum + (c ? salaryOfTier(c.tier) : 0);
  }, 0);
  /* 补人池：优先用 smartLineup 的结果（带工资帽），不够再并上 autoLineup */
  const pool = smart
    ? smart.starters.concat(smart.bench).concat(auto.starters).concat(auto.bench)
    : auto.starters.concat(auto.bench);
  for (const pos of SLOT_POS) {
    if (starters.length >= ROSTER.starters) break;
    /* 加固：pool 里可能有失效 id（下架卡的存档残留），
       必须判存在，否则 CARD_BY_ID[id].pos 会抛错（v9.32 踩过） */
    const hit = pool.find((id) => !seen.has(id) && CARD_BY_ID[id]
      && (CARD_BY_ID[id].pos === pos || CARD_BY_ID[id].pos2 === pos));
    if (hit) { seen.add(hit); starters.push(hit); }
  }
  /* 按"工资从低到高"排序后再补，优先补便宜的，避免把帽子撑爆 */
  const cheapFirst = pool.slice().sort((a, b) => {
    const ca = CARD_BY_ID[a], cb = CARD_BY_ID[b];
    const pa = ca ? salaryOfTier(ca.tier) : 0;
    const pb = cb ? salaryOfTier(cb.tier) : 0;
    return pa - pb;
  });
  cheapFirst.forEach((id) => {
    if (starters.length >= ROSTER.starters || seen.has(id)) return;
    const c = CARD_BY_ID[id];
    if (!c) return;
    const p = salaryOfTier(c.tier);
    if (spent + p > cap) return;                 // ★ 会超帽 → 跳过
    seen.add(id); starters.push(id); spent += p;
  });
  cheapFirst.forEach((id) => {
    if (bench.length >= ROSTER.bench || seen.has(id)) return;
    const c = CARD_BY_ID[id];
    if (!c) return;
    const p = salaryOfTier(c.tier);
    if (spent + p > cap) return;                 // ★ 会超帽 → 跳过（宁留空位）
    seen.add(id); bench.push(id); spent += p;
  });
  // 硬去重：首发内部、替补内部、以及两者之间都不能有同一个人
  const finalSeen = new Set();
  const dedupe = (arr) => arr.filter((id) => {
    if (!id || finalSeen.has(id)) return false;
    finalSeen.add(id); return true;
  });
  const fStarters = dedupe(starters).slice(0, ROSTER.starters);
  const fBench = dedupe(bench).slice(0, ROSTER.bench);

  /* 兜底补满：不管前面哪一步漏了，只要还拥有的卡够，就补到 12 人。
     （之前换人后 indices 会被 filter 挤掉，可能出现空位和不满 12 人的情况）

     ★ v9.35 修：这一段原来**完全不看工资帽** —— 是整个死锁的最后一块拼图：
       ① smartLineup 排出 3.90 亿的合规 10 人
       ② 上面那些带工资检查的补人循环都正确地"跳过"了（放不下）
       ③ 但这一段无视工资帽硬补到 12 人 → 4.80 亿
       ④ salaryGuard 拦截 → **玩家看到"阵容排好了却开不了赛"**，
          而且完全不知道该删谁

     现在改成：**超帽的卡宁愿不补**，留空位（空位不计工资，比赛照样能打）。
     玩家会在球队页看到空位，知道要补便宜的卡，而不是被静默卡死。 */
  if (fStarters.length + fBench.length < ROSTER.total) {
    for (const c of ownedByOvr()) {
      if (fStarters.length + fBench.length >= ROSTER.total) break;
      if (finalSeen.has(c.id)) continue;
      const pr = salaryOfTier(c.tier);
      if (spent + pr > cap) continue;            // ★ 会超帽 → 不补
      finalSeen.add(c.id);
      spent += pr;
      if (fStarters.length < ROSTER.starters) fStarters.push(c.id);
      else fBench.push(c.id);
    }
  }
  S.roster = { starters: fStarters, bench: fBench };
  return S.roster;
}

/** 名单综合分 */
function rosterOvr(ids) {
  const list = (ids || []).map((id) => battleStats(id)).filter(Boolean);
  if (!list.length) return 0;
  return Math.round(list.reduce((s2, p) => s2 + p.ovr, 0) / list.length);
}

/* =============================================================
   疲劳总参数表（v9.29）
   -------------------------------------------------------------
   全部疲劳相关的可调参数集中在这里，改平衡只动这一处。
   ⚠️ 改完必须跑体力标定脚本，确认：
        首发最累者终场 50~60% ／ 跌破 60% 的场次约 70% ／ 跌破 40% 约 5~10%
      这三个数是"疲劳真的影响比赛、但不至于人人累垮"的区间。
   ============================================================= */

/* ---------------- 进攻手段 ---------------- */
const ATK_TYPES = [
  { key: 'three',      vs: 'perimD', pts: 3, base: 0.296, name: '三分',   tag: 'three' },
  { key: 'mid',        vs: 'perimD', pts: 2, base: 0.378, name: '中投',   tag: 'mid' },
  { key: 'layup',      vs: 'intD',   pts: 2, base: 0.455, name: '上篮',   tag: 'inside' },
  { key: 'driveDunk',  vs: 'intD',   pts: 2, base: 0.489, name: '突破暴扣', tag: 'inside' },
  { key: 'postControl',vs: 'postD',  pts: 2, base: 0.412, name: '背身单打', tag: 'post' },
  { key: 'floater',    vs: 'intD',   pts: 2, base: 0.362, name: '抛投',   tag: 'mid' },
];
/** 各位置的出手偏好（数值越高越爱这么打） */
const POS_TASTE = {
  PG: { three: 1.30, mid: 1.15, layup: 1.25, driveDunk: 0.55, postControl: 0.35, floater: 1.20 },
  SG: { three: 1.35, mid: 1.30, layup: 1.10, driveDunk: 0.75, postControl: 0.45, floater: 0.90 },
  SF: { three: 1.05, mid: 1.15, layup: 1.15, driveDunk: 1.10, postControl: 0.85, floater: 0.80 },
  PF: { three: 0.60, mid: 0.85, layup: 1.10, driveDunk: 1.30, postControl: 1.25, floater: 0.50 },
  C:  { three: 0.25, mid: 0.55, layup: 1.20, driveDunk: 1.45, postControl: 1.45, floater: 0.35 },
};

/* ---------------- 解说文案 ---------------- */
const SAY = {
  /* ---------- 三分（1.8%）---------- */
  made3: [
    '三分线外出手 —— 有了！网都没怎么动！',
    '干拔三分，稳！这球太远了吧！',
    '接球就投，三分命中！防守人扑了个空。',
    '后撤步三分！弧线漂亮得像画出来的。',
    '又是他！三分线外一步就敢开火，进了！',
    '底角三分，空心入网！',
    '超远三分！他踩着 logo 就出手了！',
    '三分线外两步，拔起来就投 —— 刷！',
    '绕掩护出来接球，抬手就有！',
    '出手时防守人的手已经糊到脸上了，还是进！',
    '连续第三次三分！他今天是装了瞄准镜吧！',
    '挡拆之后撤到三分线外，稳稳命中！',
    '球在篮筐上弹了一下，还是落进去了 —— 三分有效！',
    '转换进攻，落位就是三分，太舒服了。',
    '这个距离对别人是超远，对他是常规操作。',
    '手起刀落，三分线外一剑封喉。',
    '顶着两个人的扑防，三分照进不误！',
    '球馆沸腾了！这一记三分把气氛点燃了！',
    '三分命中！分差瞬间被拉开。',
    '他在三分线外晃了一下，防守人飞了，然后 —— 进！',
    '三分出手，全场屏息，然后爆发出欢呼！',
    '这球的弧度高得离谱，落下来正好穿网。',
    '出手很随意，结果很致命。',
    '底角埋伏，接球、起跳、出手，一气呵成。',
    '三分！他今天的外线手感烫得吓人。',
    '三分再中！防守人的手都举酸了吧。',
    '又是底角！他们到底谁在盯底角？',
    '这记三分投得太轻松了，防守形同虚设。',
    '离三分线还有一步，照样进 —— 这防守没法玩了。',
    '连续两记三分，教练该叫暂停了吧？',
    '三分命中，分差又回到两位数。',
  ,
    '三分再中！外线今天是开了光。','又是底角三分，防守人该盯人了。','这记三分把分差拉开到两位数。','撤步三分，防守人扑都来不及。','三分线外一步就敢投，还真进。','连续两记三分，教练该叫暂停了。',
    '三分命中，这波进攻太顺了。','底角埋伏，接球就投。','外线手感烫得吓人。','这球难防，太快了。'],
  /* ---------- 中投（4%）---------- */
  made2: [
    '中距离跳投，命中！',
    '急停跳投，手感火热！',
    '稳稳的中投，两分到手。',
    '挡拆之后中投，干干净净。',
    '罚球线附近起跳，进了！',
    '翻身跳投！这脚步太干净了。',
    '运一步急停，中投命中！',
    '迎着防守的干拔中投，进！',
    '罚球线一步的位置，他最熟。',
    '假动作点飞防守，中投空位命中！',
    '打板中投！角度算得刚刚好。',
    '撤步中投，防守人只能看着。',
    '中距离是他最舒服的区域，稳稳命中。',
    '挡拆后没有下顺，选择中投 —— 进！',
    '这个位置的命中率，他生涯一直很高。',
    '一个试探步，防守人退了半步，他就出手了。',
    '中投命中！不花哨，但很致命。',
    '球在最高点出手，防守人够不到。',
    '连续两个假动作，防守人重心丢了，中投命中。',
    '这就是老将的节奏，慢慢悠悠把球放进。',
    '肘区接球，转身跳投，教科书般的动作。',
    '中投！他用最简单的方式拿分。',
    '防守人贴得很紧，他还是找到了出手空间。',
    '这球出手点太高了，根本盖不到。',
    '两分到手，节奏完全在他手里。',
    '急停后仰，这球难度不小，但进了。',
    '中距离跳投，篮网都没怎么动。',
    '他用一个节奏变化就创造出了空间。',
    '中投再来一个，这位置他今天投疯了。',
    '又是这个位置！防守人怎么还不调整？',
    '稳稳命中，他的中投今天没失手过。',
    '一个简单的挡拆就出了空位，防守太松了。',
  ,
    '中投再中，他今天的手感真是顺。','挡拆之后一个急停，防守人跟不上。','这个位置他已经投进三个了。','稳稳的中距离，两分轻松到手。','翻身跳投再进，脚步太干净了。','连续两个中投，防守必须调整了。'],
  /* ---------- 篮下（2.9%）---------- */
  madeInside: [
    '强起上篮，打板命中！',
    '一步过掉防守，轻松放进！',
    '空中接力！这球太暴力了！',
    '篮下强吃，2 分！',
    '突破分球没分，自己上了，进！',
    '对抗中把球放进，还有加罚机会？',
    '拉杆上篮！身体都拧成麻花了还能进！',
    '反手上篮，从篮筐另一侧擦板进！',
    '一条龙快攻，直接从后场杀到篮下！',
    '欧洲步！两步跨过去防守人就找不着人了。',
    '篮下拉杆躲过封盖，进！',
    '抢下前场板，二次进攻直接补进！',
    '从人缝里钻进去，手指轻轻一拨 —— 进！',
    '顶着两个人的身体把球放进去，还有哨！',
    '小抛投！这手感太柔和了。',
    '面对补防，他把球从左手换到右手，进了。',
    '快攻二打一，他选择自己终结 —— 进！',
    '篮下的球感太好了，怎么扭都能进。',
    '突破到篮下，一个假传把防守人骗飞了。',
    '转换进攻，他跑在最前面，轻松吃饼！',
    '这球在篮筐上转了两圈，终于滚进去了！',
    '强硬的终结！被撞了一下还是把球放进了。',
    '突破分球没找到人，他自己来 —— 有了！',
    '篮下的小勾手，防守人只能干看着。',
    '贴着底线溜进去，反手放进！',
    '这球进得太轻松了，防守形同虚设。',
    '他在空中做了个换手，然后轻轻放进。',
    '突破后的短距离抛投，进！',
    '内线要位成功，转身就是两分。',
    '篮下终结！这球的手感太细了。',
    '又一次轻松上篮，内线防守跟纸糊的一样。',
    '这球进得太容易了，篮下居然没人补防。',
    '突破上篮打进，防守人还在原地发呆。',
    '篮下二次进攻补进，篮板保护做得太差了。',
  ,
    '轻松上篮，内线防守跟纸糊的一样。','篮下二次进攻补进，篮板保护太差。','突破上篮打进，防守人还在原地发呆。','又一次篮下得手，这防守形同虚设。','小抛投再进，手感太柔和了。','从人缝里钻进去，这球上得太巧。'],
  /* ---------- 背身（1.1%）---------- */
  madePost: [
    '背身单打，翻身勾手，进！',
    '低位要位，转身就是两分。',
    '背打到底线，后仰跳投命中！',
    '硬吃内线，这球顶进去了！',
    '勾手！这一手手感太柔和了。',
    '连续两个假动作，防守人跳了，轻松放进！',
    '背身碾压到篮下，转身就是一记重扣！',
    '翻身小勾手，球在篮筐上弹了一下还是进了。',
    '低位单打，肩部一晃就骗开了空间。',
    '他在低位要球的那一刻，防守人就已经输了。',
    '背身强吃，防守人被顶得一步步后退。',
    '天勾！这一手现在很少有人会了。',
    '低位脚步太扎实了，晃得防守人找不到北。',
    '转身后仰，这球难度极高，但他是这方面的专家。',
    '背身单打，力量差距太明显了。',
    '他在低位拿球，包夹就来了，但他还是打进了。',
    '翻身跳投，这球出手点高得离谱。',
    '低位背打，一下两下三下，然后转身 —— 进！',
    '这球全靠身体硬吃，防守人毫无办法。',
    '勾手擦板，角度刁钻。',
    '背身单打打进，还造成了犯规！',
    '他在低位的耐心太好了，等到防守人失位才出手。',
    '低位又要到球了，这防守人不换防吗？',
    '转身勾手再中，内线完全被吃穿。',
    '背身单打打进，防守人已经放弃抵抗了。',
  ,
    '低位再进一个，内线完全被吃穿。','转身勾手，这一手太柔和了。','背身单打打进，防守人已经放弃抵抗。','他在低位的耐心太好了。'],
  /* ---------- 暴扣（0.3%）---------- */
  dunk: [
    '暴扣！篮筐都在晃！',
    '起飞了！这弹跳太夸张了！',
    '双手重扣！整个球馆都炸了！',
    '空中转体扣篮！这是打比赛还是扣篮大赛？',
    '一步起跳，单手劈扣！',
    '篮下强起，把球狠狠砸进去！',
    '这球扣得太狠了，篮板都在抖！',
    '大风车！他还有余力做个花活！',
    '双手挂框！这是要把篮筐拆了！',
    '快攻一条龙，最后一步直接起飞 —— 暴扣！',
    '他从罚球线内一步起跳，这弹跳太吓人了！',
    '空中接力暴扣！配合太默契了！',
    '这记扣篮的力度，隔着屏幕都能感觉到。',
    '篮筐发出一声闷响，全场欢呼！',
    '他起跳的时候，防守人已经放弃了。',
    '单手劈扣！手臂青筋都爆出来了！',
    '这球扣完他自己都笑了。',
    '暴扣得手，气势完全打出来了！',
    '又是一记暴扣！防守人连跳都懒得跳了。',
    '这球扣得太轻松，篮下根本没人拦。',
    '空中接力再来一次，防守像在放水。',
  ,
    '又是一记暴扣，篮筐都在晃。','双手重扣，整个球馆都炸了。','这球扣得太轻松，篮下没人拦。','空中接力暴扣，配合太默契。'],
  /* ---------- 隔扣（1.4%）---------- */
  poster: [
    '隔扣！！！人直接被扣飞出去了！',
    '在他头上扣！这是要上海报的球！',
    '海报级隔扣！防守人成了背景板！',
    '起跳、对抗、扣进 —— 防守人被顶翻在地！',
    '这球太残暴了！防守人只能仰头看着！',
    '隔人暴扣！全场都站起来了！',
    '正面硬扣！防守人的手都拍到他脸上了，照扣不误！',
    '年度最佳扣篮预定！防守人现在只想找个地缝钻进去。',
    '起飞！他直接跨过了防守人！',
    '这是扣篮还是行刑？防守人被扣得坐在地上！',
    '身体对抗之后还能把球砸进去，这力量太可怕了。',
    '隔扣！球馆的天花板都快被掀翻了！',
    '防守人已经站好位置了，但一点用都没有。',
    '他起跳的瞬间，防守人的表情就变了。',
    '这球扣完，防守人需要缓一会儿。',
    '隔扣得手！这一球足够上整周的集锦！',
    '两个人的身体在空中撞在一起，然后球被砸了进去！',
    '这记隔扣直接把对手的气势扣没了。',
    '从罚球线内一步起飞，越过防守人，双手重扣！',
    '被隔扣的那位，现在只想赶紧发个边线球。',
    '又被隔扣了！这防守人今晚别想睡了。',
    '隔扣再+1，防守人的信心已经被扣碎了。',
    '这记隔扣太解气了，防守人只能低头往回跑。',
    '又一次在他头上扣篮，这已经不是技术问题了。',
  ,
    '又被隔扣了！防守人今晚要失眠。','隔扣再+1，防守人的信心被扣碎了。','这记隔扣太残暴，防守人只能低头往回跑。','在他头上扣篮，这已经不是技术问题。','全场起立，这一球要上集锦了。','两个人的身体在空中对撞，球被砸进去。'],
  /* ---------- 背身隔扣（0.4%）---------- */
  posterize: [
    '背身转身直接起扣！防守人根本没反应过来！',
    '低位转身隔扣！这力量太夸张了！',
    '背打转身就是一记重扣，防守人被撞得后退两步！',
    '背身硬吃之后直接起跳扣篮，太不讲道理了！',
    '低位要位，转身起飞 —— 防守人只能犯规或者看着！',
    '他在篮下的统治力太强了，转身就是暴扣。',
    '背身单打打成隔扣，这球太伤士气了。',
    '防守人已经用尽全力顶他了，结果还是被扣了。',
    '转身隔扣！这球的力量和速度结合得太完美。',
    '从背身到扣篮只用了两个动作，太快了。',
    '低位的王！这一球完全是碾压。',
    '背身转身重扣，篮筐发出一声巨响！',
  ,
    '背身转身直接起扣，防守人没反应过来。','低位转身隔扣，这力量太夸张。','背打转身就是一记重扣。','这球完全是碾压，太伤士气了。'],
  /* ---------- 过人（2.3%）---------- */
  crossover: [
    '变向！防守人的脚踝要没了！',
    '一个胯下运球就把人晃倒了！',
    '晃倒！防守人坐在地上看着他把球放进！',
    '变向过人，防守人重心直接丢了！',
    '背后运球过人！这球感太丝滑了！',
    '一个眼神假动作就骗开了，轻松上篮！',
    '连续变向，防守人脚步全乱了！',
    '穿裆过人！这也太羞辱人了！',
    '转身过人！防守人被转得找不着北！',
    '体前变向 + 加速，防守人只能看着他的背影。',
    '双背后运球！这控球技术太华丽了！',
    '一个急停，防守人冲过去了，然后他再加速。',
    '拜佛假动作！防守人真的跳起来了！',
    '他连续三次变向，防守人的膝盖都在打颤。',
    '这球他晃开了两个人，然后轻松上篮。',
    '球像粘在他手上一样，怎么变都不会丢。',
    '防守人贴得很紧，他一个转身就把人甩在身后。',
    '加速！一步过掉！防守人连手都没伸出来。',
    '这记过人太干净了，防守人像个木桩。',
    '节奏变换太突然，防守人完全跟不上。',
    '胯下换手 + 后撤，防守人直接被晃倒在地！',
    '他从两个人的包夹中钻了出来，太灵活了。',
    '这球他运了七八下，防守人始终摸不到球。',
    '一个假投真突，防守人飞了，他轻松上篮。',
    '又晃倒一个！防守人的脚踝今晚要废。',
    '连续变向再过一人，防守完全跟不上节奏。',
    '这球过得太轻松了，防守人像在跳广场舞。',
    '一个变向就甩开了，防守人的重心根本收不住。',
  ,
    '又晃倒一个！脚踝终结者上线。','一个变向就甩开了，防守人重心全丢。','这球过得太轻松，像在过人桩。','连续变向再过一人，防守跟不上节奏。','背后运球过人，这球感太丝滑。','防守人被他晃得原地转圈。'],
  /* ---------- 打铁（53%）---------- */
  miss: [
    '出手 —— 不中！篮筐弹出来了。',
    '这球有点急，打铁。',
    '投短了，前框。',
    '出手被封到脸上，偏出。',
    '手感不好，又是打铁。',
    '出手……偏了，差一点。',
    '力度大了，后框弹出来。',
    '这球涮了一圈又出来了！',
    '空位都没进，他自己都不敢相信。',
    '出手太正了，砸在篮脖子上。',
    '这球投得像是在扔铅球。',
    '三不沾！这球偏得有点离谱。',
    '明明是好机会，可惜了。',
    '出手很坚决，结果很残酷。',
    '球在篮筐上弹了两下，还是出来了。',
    '这球力量明显小了，前框。',
    '他摇了摇头，这球确实该进的。',
    '防守干扰到位，出手变形了。',
    '球打在篮板上，但角度太偏，没进。',
    '这球出手的时候身体已经失去平衡了。',
    '机会出来了，但手感不在。',
    '他本赛季这个位置命中率很高，这次没进。',
    '球滑了一下，出手点歪了。',
    '这记投篮的弧线太平，砸在篮筐前沿。',
    '防守人没有失位，这球很难。',
    '他又一次打铁，今天的投篮手感确实冰凉。',
    '这球出手太仓促了，进攻时间快到了。',
    '裁判没有吹哨，但这球确实有接触。',
    '投丢了，篮板球成了关键。',
    '这球他平时能进一百次，今天就是差一点。',
    '出手的瞬间他就知道偏了。',
    '球磕在篮筐上弹得很高，双方都在等落点。',
    '这球被干扰得很厉害，能碰到篮筐已经不错了。',
    '又是一次无功而返的进攻。',
    '弧线没问题，力度差了一点。',
    '他连续两次出手都没进，得调整一下了。',
    '这球打手了，但裁判没吹。',
    '出手很漂亮，结果很遗憾。',
    '篮筐今天对他不太友好。',
    '这球转了半天，最后从筐里滑了出来。',
    '他被防得很不舒服，勉强出手，不进。',
    '球弹到罚球线附近，双方开始争抢。',
    '这球出手点被顶掉了，完全变形。',
    '球砸在篮板上弹回来，没碰到筐。',
    '空位三分不进，教练在场边直摇头。',
    '这球他有点犹豫，出手晚了一拍。',
    '力度和角度都差了一点点。',
    '防守人贴得太紧，他只能强行出手。',
    '又是一记打铁，进攻端需要有人站出来。',
    '球在筐上转了一圈，全场都以为进了。',
    '又是打铁，这手感今天是真的凉。',
    '这球投得毫无道理，队友都摊手了。',
    '空位三分不中，教练在场边直摇头。',
    '球砸在篮筐上弹得老高，双方又是一通乱抢。',
    '这球出手太勉强了，进攻时间还有一半呢。',
    '投丢了不说，还被对手打成快攻。',
    '又是三不沾，今天的投篮训练白做了。',
    '这记中投短得离谱，连网都没碰到。',
    '他今天的手感，篮筐像是盖了盖子。',
    '这球投完之后他自己都在摇头。',
    '又一次无功而返，进攻端需要有人站出来。',
    '球在筐上转了半圈还是出来了，太可惜。',
  ,
    '又一次打铁，这进攻打得毫无耐心。','球弹框而出，篮下顿时一片混战。','这记投篮偏得有点多，队友都懒得跑位了。','出手太急了，进攻时间还有十几秒呢。','空位都没投进，他今天手感是真的差。','球砸在篮筐前沿，进攻又白费一次。','这一节他已经投丢六个了。','投丢之后被对手打成反击，太伤了。','这球投得像是随手一抛。','又一次三不沾，场边球迷都叹气了。','力度不够，球连网都没碰到。','他出手那一刻我就知道偏了。','防守人根本没跳，他自己投丢了。','这球涮筐一圈又出来了，太不走运。',
    '这球投得毫无道理，队友都摊手了。','又一次无功而返，进攻需要有人站出来。','球在筐上转半圈还是出来了。','今天的篮筐像是盖了盖子。','他投完自己都在摇头。'],
  /* ---------- 普通盖帽（11%）---------- */
  block: [
    '大帽！这球被扇到观众席去了！',
    '封盖！他从哪冒出来的！',
    '追身大帽！太残暴了！',
    '一巴掌把球扇飞，球权立马易主！',
    '盖帽！出手点被完全吃掉了！',
    '这球刚离手就被按下来了！',
    '补防到位，直接把球扇出边线！',
    '他跳得比出手的人还高，这球没法打。',
    '封盖！这记防守太提士气了！',
    '球被打得飞向中场，快攻机会！',
    '他的手直接盖在球上，干净利落。',
    '这球他提前判断了出手时机。',
    '一巴掌拍下来，进攻方一脸懵。',
    '协防及时，这球被扇了个正着。',
    '他从弱侧飞过来，一个大帽！',
    '封盖之后他自己都把球捡走了。',
    '这球出手角度太平，正好被盖。',
    '防守强度上来了，这一记大帽就是证明。',
    '又是一记封盖！他的进攻完全被封死了。',
    '这球被扇得老远，快攻机会来了。',
    '盖帽！进攻人这次是真的没辙了。',
    '一巴掌拍下来，进攻人整个人都懵了。',
  ,
    '又是一记大帽，进攻端彻底哑火。','球被扇向中场，快攻机会。','这记封盖太干净了，一点没碰到人。','进攻人这次是真的没辙了。','一巴掌拍下来，全场都沸腾了。','协防来得太及时，这球必盖。',
    '球被扇得老远，快攻机会来了。','这记封盖把进攻彻底按死了。','防守强度上来了。','出手点被完全吃掉。'],
  /* ---------- 钉板（3%）---------- */
  pin: [
    '钉板大帽！球被死死按在篮板上！',
    '追身钉板！这是要上十佳球第一的！',
    '球都快进筐了，被从板上抠下来！',
    '钉板！他跑了大半个场就为了这一个帽！',
    '篮板上的手印就是最好的证明！',
    '他从后面追上来，一巴掌把球按在板上！',
    '这记追身大帽太解气了，全场都疯了！',
    '球已经越过他了，但他还是追了回来。',
    '钉板！这一球的防守意志太强了。',
    '他从三分线外就开始追，最后真的追上了。',
    '球贴在篮板上，然后掉了下来 —— 好帽！',
    '这球防守人跑得比进攻人还快。',
    '又一个钉板！进攻人今晚别想上篮了。',
    '追身钉板再来一记，这防守太提士气。',
  ,
    '又一个钉板！进攻人今晚别想上篮。','追身钉板再添一记，太提士气了。','球被死死按在篮板上，好帽。','他从三分线外追回来就是为了这一下。'],
  /* ---------- 抓帽（1.2%）---------- */
  snatch: [
    '抓帽！单手直接把球抓下来了！',
    '这不是盖帽，这是抢！球被他一把抓住！',
    '抓帽！球像被吸过去一样到了他手里！',
    '单手抓帽！这手掌也太大了！',
    '抓帽之后直接发动快攻，一石二鸟！',
    '他跳起来，单手把球从空中摘了下来。',
    '这球他根本没打出去，直接没收了！',
    '抓帽！连球带气势一起拿走了。',
    '他的手掌像钳子一样，球根本掉不了。',
    '这记抓帽太漂亮了，干净得不像是防守。',
    '抓下来之后他自己都愣了一下，然后发动快攻。',
    '球在他手里，进攻方只能往回跑。',
    '单手抓帽，这身体素质太夸张了。',
    '这球他是从下往上抓的，太难了。',
    '又抓帽了！这手掌简直像吸盘。',
    '单手摘下，进攻人只能干瞪眼。',
  ,
    '又抓帽了！这手掌像吸盘。','单手摘下，进攻人只能干瞪眼。','这不是盖帽，这是抢。','球像被吸过去一样到了他手里。'],
  /* ---------- 大火锅（1.7%）---------- */
  rejection: [
    '大火锅！！！这球被扇到第三排去了！',
    '火锅盛宴！这记封盖太残暴了！',
    '大帽！他跳起来的时候头都超过篮筐了！',
    '这是盖帽还是扣杀？球被打得嗡嗡响！',
    '火锅！防守人整个人都压上去了！',
    '这记大帽直接把对手的气势打没了！',
    '球被打得飞向观众席，前排球迷赶紧躲！',
    '他跳得太高了，进攻人只能仰头看着。',
    '这记封盖的力量，球都快变形了。',
    '大火锅！这一球值一张门票钱。',
    '他从罚球线内一步起飞，把球扇了出去。',
    '这球被封得连方向都找不到了。',
    '禁飞区！这里不允许起跳！',
    '这记盖帽太震撼了，全场起立鼓掌。',
    '球被打出边线，进攻方只能重新组织。',
    '他盖完这球之后，进攻方明显不敢往里冲了。',
    '又是一记大火锅！禁飞区警告。',
    '这球被扇到观众席第二排了！',
    '大帽！进攻人起跳的瞬间就该后悔了。',
    '火锅再次开张，进攻方现在只能在外线飘着投。',
  ,
    '又是一记大火锅！禁飞区警告。','这球被扇到观众席去了。','进攻人起跳那刻就该后悔了。','火锅再次开张，进攻方只能在外线飘着投。','这记封盖的力量，球都快变形了。','他跳起来的时候头都超过篮筐了。'],
  /* ---------- 抢断（4.3%）---------- */
  steal: [
    '抢断！他早就看穿了这个传球！',
    '掏球成功！直接断下来了！',
    '生抢！球被硬生生抠走！',
    '预判到位，抢断得手！',
    '从背后把球拍掉，快攻走起！',
    '传球路线被他读得一清二楚！',
    '抢断了！一条龙反击，直接扣！',
    '这球从手里被偷走，进攻方一脸茫然。',
    '半场紧逼奏效，直接抢断！',
    '下手又快又准，裁判都没看清！',
    '他伸手一掏，球就没了。',
    '这记抢断太关键了，直接改变了比赛节奏。',
    '他提前移动到了传球路线上，教科书般的预判。',
    '球刚离手就被断了，传球太随意了。',
    '抢断之后他没有停，直接冲向篮筐！',
    '这球他等了很久，终于等到了。',
    '从背后偷袭成功，进攻方完全没察觉。',
    '抢断！他把球拍给了队友，快攻！',
    '这记抢断太干净了，一点都没碰到人。',
    '他连续两次伸手，第二次成功了。',
    '球被断了，进攻方只能犯规阻止快攻。',
    '他在底线附近完成了这次抢断。',
    '又断了！这传球路线被读得死死的。',
    '抢断再+1，进攻方的组织完全乱了。',
    '这球被断得太轻松，传球太随意了。',
    '连续两次抢断，气势完全倒向这边了。',
  ,
    '又断了！这一节第二次抢断。','传球路线被完全读穿。','抢断之后一条龙，防守人只能犯规。','这球掏得太干净，裁判都没吹。','预判精准，直接断下发动快攻。','连续两次抢断，气势完全倒过来了。',
    '这球断得太干净了。','进攻方完全没反应过来。','抢断后直接快下。','这记抢断改变了节奏。'],
  /* ---------- 失误（2.5%）---------- */
  turnover: [
    '传球失误！直接送给对手。',
    '走步了！这个失误太低级。',
    '球没控住，出界。',
    '被夹击了，球丢了。',
    '这球传得莫名其妙，队友都愣了。',
    '运球砸到自己脚上了，太尴尬。',
    '想传空接，结果传给了观众。',
    '持球时间太长，24 秒违例。',
    '背后传球玩脱了，白白送一次球权。',
    '被逼到边线，只能仓促出手 —— 失误。',
    '这球他跳起来想传，结果没找到人就落地了。',
    '进攻犯规！他推人了。',
    '球被拍掉，滚出边线。',
    '传球太用力，队友没接住。',
    '他在空中做了个传球动作，但球权已经没了。',
    '这球他明显犹豫了，机会就没了。',
    '带球撞人！进攻犯规，球权转换。',
    '他想做个漂亮的传球，结果失误了。',
    '球从他手里滑了出去，太可惜了。',
    '被包夹之后他找不到出球点，只能强投 —— 失误。',
    '这记传球太高了，队友跳起来都没够到。',
    '他运球的时候被从后面掏了一下。',
    '又是失误！这球传得队友都接不到。',
    '球权又丢了，进攻端毫无章法。',
    '这已经是本节第三次失误了。',
    '球被生生打出边线，进攻又白费了。',
  ,
    '又是失误，这传球太随意了。','球权又丢，进攻端毫无章法。','这已经是他本场第四次失误。','球被打出边线，进攻又白费。','传球太高，队友跳起来都没够到。','持球太久，24 秒违例。'],
  /* ---------- 篮板（进攻篮板）---------- */
  rebound: [
    '前场篮板！二次进攻机会！',
    '拼下进攻篮板，还能再打一次！',
    '这个篮板抢得太关键了。',
    '在人堆里把球点出来，二次进攻！',
    '卡位卡得好，篮板稳稳到手。',
    '这球抢得跟命一样，太拼了！',
    '他从三个人中间把篮板摘了下来！',
    '篮板球！进攻方还有机会。',
    '他跳得比别人都高，篮板是他的。',
    '这记进攻篮板价值连城。',
    '球被打出来，他第一时间冲了上去。',
    '他连续点了两次，终于把球控制住了。',
    '篮板到手，进攻时间重新开始。',
    '这个篮板完全是靠意志力抢下来的。',
    '又是前场篮板！二次进攻再来一次。',
    '篮板球又被抢走，内线卡位太差了。',
    '在人堆里硬生生把球拨出来，太拼了。',
  ,
    '又是前场篮板，二次进攻机会来了。','篮板球被硬生生拨出来，太拼了。','内线卡位太差，又丢一个篮板。','在人堆里把球摘下来，这力量真强。'],
  /* ---------- 罚球（8.6%）---------- */
  freethrow: [
    '被犯规了，两罚全中。',
    '站上罚球线，稳稳命中。',
    '造犯规成功，罚球得分。',
    '哨响了，罚球线上拿分。',
    '顶着全场噪音，两罚都进。',
    '罚球线上手都不抖，太稳了。',
    '他罚球的时候全场都在挥手干扰，没用。',
    '两罚全中，这两分拿得很稳。',
    '造犯规！他冲进去就是为了这个。',
    '罚球命中，比分继续扩大。',
    '他深吸一口气，然后稳稳投进。',
    '这是关键的两次罚球，他都进了。',
    '身体对抗之后获得的罚球机会，他没有浪费。',
    '罚球线上的表现太稳定了。',
    '两罚两中，压力之下毫不手软。',
    '又是两罚全中，这罚球太稳了。',
    '造犯规成功，罚球线上继续拿分。',
    '他站上罚球线就没有失手过。',
  ,
    '又是两罚全中，罚球线上太稳了。','造犯规成功，这两分拿得太轻松。','他站上罚球线就没让人失望过。','哨响，罚球线上再添两分。','顶着全场噪音两罚都进，心态真好。','这已经是他本场第六次罚球了。'],
  ftMiss: [
    '罚球……不中，可惜。',
    '第一罚没进。',
    '罚球打铁，这分送得太可惜了。',
    '两罚一中，多少有点亏。',
    '罚球线上的手感也不在线。',
    '这记罚球明显短了。',
    '他拍了拍球，重新调整，但第二罚还是没进。',
    '关键罚球失手，这可能会有影响。',
    '两罚全丢，太伤了。',
    '罚球不中，篮板球要抢。',
    '他自己都很懊恼，这球不该丢的。',
    '罚球线上丢分，这在关键时刻很致命。',
    '罚球又丢了，这些分送得太可惜。',
    '两罚不中，关键时刻这是要命的。',
    '罚球线上再次失手，他自己也很懊恼。',
  ,
    '罚球又丢，这些分送得太可惜。','两罚不中，关键时刻要命。','他自己都很懊恼，这球不该丢。','罚球线上再次失手，太伤了。'],
  /* ---------- 关键球 ---------- */
  clutch: [
    '这是关键球！全场都站起来了！',
    '最后时刻，球在他手里！',
    '生死一投 ——',
    '全场屏住呼吸，就看他这一下了。',
    '这种时候，防守人只能祈祷他手滑。',
    '球馆安静得能听见心跳。',
    '他把球抱在怀里，等时间一点点走完。',
    '所有人拉开，球权完全交给他。',
    '这是巨星的时刻，也是巨星的舞台。',
    '教练在场边比划着战术，但球最终还是在他手里。',
    '防守人贴得死死的，但他还是找到了出手机会。',
    '这一球，可能会决定整场比赛的走向。',
    '时间不多了，他必须做点什么。',
    '全场观众都站起来了，这是属于英雄的时刻。',
    '时间不多了，球又交到他手上。',
    '全场起立，这一攻决定胜负。',
    '防守人贴得死死的，但他还是找到了出手点。',
  ,
    '时间不多了，这一攻至关重要。','全场起立，这是属于英雄的时刻。','球又交到他手上，所有人拉开。','防守人贴得死死的，但他还是找到出手点。','这一球可能决定整场走向。','教练在场边比划战术，球还是在他手里。'],
  quarterEnd: [
    '第一节结束！',
    '第二节结束，双方回更衣室。',
    '半场结束，回更衣室了。',
    '第三节打完，进入决胜节！',
    '第四节结束，全场结束！',
  ],
};

/* ---------------- 球员台词 ---------------- */
const QUOTES = {
  made2: ['稳。', '这就是手感。', '挡拆之后就是空位。', '节奏在我手里。',
    '中投是门艺术。', '别离我这么近，没用的。', '这位置我闭着眼都能进。',
    '这防守，我闭着眼都能进。','你贴这么近干嘛？','再来一次还是这样。',
    '中距离就是我的节奏。','这位置我练了十年。','简单，再来。','你防不住的。',
    '稳。','就这样打。','有手感。'],
  made3: ['这就是我的射程。', '给我一点空间就够了。', '三分线？那只是热身距离。',
    '手起刀落。', '你扑得再快也没用。', '这里就是我的投篮训练。',
    '退这么深？那我就不客气了。',
    '退这么远？那我练投篮了。','你们的防守像在放我投。','三分线外就是我的家。',
    '这距离对我来说太近了。','放我投？那就别怪我。','三分线是我的地盘。','手起刀落。',
    '进了！','这球太远了。','挡不住。'],
  madeInside: ['太软了。', '篮下是我的地盘。', '让开，我要扣了。', '这球你们拦不住。',
    '就这？', '篮下是我的家。', '你们的内线形同虚设。',
    '内线随便进，你们不设防吗？','这也叫防守？','篮下没人？那我就不客气了。',
    '篮下没人？那我上篮了。','这也叫护框？','太轻松了。','内线随便走。'],
  madePost: ['低位没有人能防我。', '转身就知道了。', '再来一次也一样。',
    '背身？那是我的招牌。', '你顶不动我的。',
    '低位？我一个打你们俩。','你顶不动我的，别费劲了。','转身就是分，学着点。',
    '低位给我球就行了。','你顶不动我。','转身就是两分。','这招你学不会。'],
  dunk: ['篮筐借我用一下。', '这才叫扣篮。', '看到了吗？',
    '篮筐该换个结实点的了。','让开，我要起飞了。',
    '篮筐要换了。','起飞！','让开点。','这球我要扣了。',
    '起！','太爽了。','再来一个。'],
  poster: ['让开！挡我者死！', '你只是我海报上的背景。', '这就是差距。',
    '站起来啊，别躺着。', '下次记得躲开点。', '抱歉，把你的气势扣没了。',
    '回去看看录像吧，你上电视了。','这就是我们之间的差距。','下次记得躲开，别丢人了。','别挡路，你挡不住的。','把你的信心也一起扣碎了。',
    '回去看录像吧。','你上电视了，背景板。','这就是差距。','别挡路。','信心也一起扣碎了。','下次记得躲。','你拦不住我的。'],
  posterize: ['背身也能扣，你防不住。', '低位的王。', '力量差距太明显了。',
    '低位也是我的地盘。','你连拉都拉不住我。',
    '低位也是我的地盘。','你拉都拉不住。','这球太简单了。'],
  crossover: ['脚踝还好吗？', '过你就像清晨的马路。', '重心稳住啊。',
    '你的脚踝我收下了。', '这就是速度。', '再练两年吧。',
    '脚踝还好吧？要扶你一下吗？','重心稳一点啊，站都站不稳。','你追得上我吗？','谢谢让路。','这就是速度的差距。',
    '脚踝还好吗？','站都站不稳。','你追不上我。','谢谢让路。','重心稳一点啊。','这就是速度差距。','看好我的球。',
    '拜拜。','你慢了一步。','跟不上吧。'],
  block: ['滚出去！', '这里不欢迎你。', '不是我的对手。', '记住了。',
    '这是我的禁区。', '想在我头上得分？',
    '想在我头上得分？做梦。','回去练练再来。','这里不欢迎你。',
    '想在我头上得分？','回去练练。','这里不欢迎你。','做梦。','太天真了。'],
  pin: ['球留下，人走吧。', '钉在板上给你看看。', '追的就是你。',
    '球我留下，你走吧。','钉在板上给你留个纪念。',
    '球我留下。','钉个纪念。','别想上篮。'],
  snatch: ['球是我的了，谢谢。', '这球抓得漂亮吧？', '一只手就够。',
    '这球我收下了，不客气。','一只手就够了。',
    '我收下了。','一只手就够。','谢谢传球。'],
  rejection: ['别在我面前起跳！', '回家吧。', '这是禁飞区！',
    '气势？我一起扇飞。', '再来一次我还盖。',
    '别在我面前起跳！','这是禁飞区，懂吗？','回家吧，今晚不适合你。',
    '别在我面前起跳！','禁飞区懂吗？','回家吧。','今晚不适合你。','这球我包了。',
    '这里不行！','换个地方投吧。','我的地盘。'],
  steal: ['我看到了。', '球是我的了。', '早就等着你这一下。',
    '谢谢惠顾。', '你的传球太好猜了。', '下次护好球。',
    '球给我，谢谢。','你的传球太好猜了。','早就等着你这一下了。',
    '球给我。','你的传球太好猜。','早等着你了。','谢谢。',
    '拿来吧你。','谢谢惠顾。','太明显了。'],
  miss: ['这球该进的……', '我的，下一球补回来。', '手感还没热。',
    '差一点。', '再来。', '投丢了也是我的球。',
    '这球我该进的。','下一个一定进。','手感还没来，别急。',
    '再给我一次机会。','这球不算，下一个。','我得调整一下节奏。','别急，手感会回来的。',
    '手有点凉。','再来！','这球怪我。','下次一定进。'],
  turnover: ['我的失误，抱歉。', '别急，稳一下。', '这球怪我。', '下次注意。',
    '我的错，下次注意。','稳一下，别慌。',
    '我的错。','稳一下。','别慌。','下次注意。'],
  rebound: ['篮板归我！', '拼下来！', '这球是我的。', '卡位到位。',
    '篮板是我的。','这球归我。',
    '篮板是我的。','这球归我。','我的地盘。'],
  clutch: ['把球给我。', '这种球我投过一万次。', '让开，我来。',
    '最后一投交给我。', '我从不手软。',
    '把球给我，我来解决。','这种球我进过太多回了。','别挡着我。',
    '把球给我。','我来解决。','这种球我进过。','别挡着我。','看好了。',
    '交给我。','这球我要了。','相信我。','看好了。'],
  lead: ['稳住，别松。', '就这么打。', '别给他们机会。',
    '稳住，别给他们机会。','就这么打，别松劲。','他们还差得远呢。',
    '稳住，别松劲。','就这么打。','他们还差得远。','继续压。','别给他们机会。','赢定了。',
    '再来一波！','压住他们。','这节奏对了。','别放松。','继续扩大优势。','他们快崩了。'],
  behind: ['还没结束呢。', '追！一分一分来。', '别慌，能追。',
    '还没完呢，追！','一分一分来，别急。','比赛还有时间。',
    '还没完呢。','一分一分来。','追！','比赛还有时间。','别放弃。','我们能翻。',
    '别慌，还有机会。','咬住比分。','一波流就能追回来。','相信我。','稳住阵脚。','我们还没输。'],
  win: ['这就是我们的实力。', '下一个。', '赢了，但还不够。',
    '赢得漂亮。', '这才刚开始。',
    '这就是实力差距。','下一个是谁？','赢得还不够漂亮。',
    '这就是实力。','下一个是谁？','赢得不够漂亮。','太轻松了。','还有谁？','这才刚开始。',
    '收工。','打得好。','继续。'],
  lose: ['下次不会了。', '我们还会回来的。', '记住这个感觉。',
    '这不算完。', '下次赢回来。',
    '下次不会再输了。','记住今天，我们会回来的。','这不算完。',
    '下次不会了。','记住今天。','我们会回来的。','这不算完。','下次赢回来。','别高兴太早。',
    '下一场见。','我们会调整的。','输一场不算什么。','记住这个感觉。','再来一次。'],
};

/* =============================================================
   互喷垃圾话（双方对喷）
   -------------------------------------------------------------
   每当有技术统计类事件（得分／抢断／盖帽／隔扣／晃倒…）发生时，
   有概率触发一次「挑衅 + 回击」：
     得手的一方先开喷，被打的一方立刻喷回去。
   和单人台词（QUOTES）是两套：这个是**两个人一来一回**。
   ============================================================= */
const TAUNT = {
  made3: [
    ['这距离对我来说太近了。', '有种你再来一个。'],
    ['放我投？那就别怪我。', '下一个我贴到你脸上。'],
    ['三分线外是我的地盘。', '你的地盘？我踩进来了。'],
    ['手起刀落。', '刀还没开刃呢。'],
    ['你们外线是没人了吗？', '你再投一次试试。'],
  ],
  made2: [
    ['这位置我练了十年。', '练十年也就这样。'],
    ['简单，再来。', '别得意，比赛还长。'],
    ['你防不住我的。', '下一次不会了。'],
    ['中距离就是我的节奏。', '节奏？我看是运气。'],
  ],
  madeInside: [
    ['篮下没人？那我上篮了。', '下次我送你上罚球线。'],
    ['这也叫护框？', '你再说一遍？'],
    ['内线随便走。', '走着瞧。'],
  ],
  madePost: [
    ['低位给我球就行了。', '你顶得动我再说。'],
    ['你顶不动我。', '换个姿势再试。'],
    ['转身就是两分，学着点。', '用不着你教。'],
  ],
  dunk: [
    ['篮筐该换了。', '你再飞一次试试。'],
    ['起飞！', '落地小心点。'],
    ['让开点。', '路是你家的？'],
  ],
  poster: [
    ['回去看录像吧，你上电视了。', '闭嘴，下一个就是你。'],
    ['这就是我们之间的差距。', '差距？比分可没差多少。'],
    ['别挡路，你挡不住的。', '我下次直接把你撞飞。'],
    ['把你的信心也一起扣碎了。', '我的信心你扣不碎。'],
    ['下次记得躲开。', '我从不躲。'],
  ],
  posterize: [
    ['低位也是我的地盘。', '你也就欺负欺负我。'],
    ['你连拉都拉不住我。', '那就别怪我不客气。'],
  ],
  crossover: [
    ['脚踝还好吧？要扶你一下吗？', '再来一次我倒要看看。'],
    ['站都站不稳。', '你少得意。'],
    ['谢谢让路。', '路是你让的？'],
    ['你追得上我吗？', '我追不上，但我能盖你。'],
    ['这就是速度差距。', '速度不代表一切。'],
  ],
  block: [
    ['想在我头上得分？做梦。', '下次我扣你脸上。'],
    ['回去练练再来。', '你也就这一下。'],
    ['这里不欢迎你。', '我偏要来。'],
  ],
  pin: [
    ['球我留下，你走吧。', '板上的印子记得擦。'],
    ['别想上篮。', '那我就在你头上扣。'],
  ],
  snatch: [
    ['这球我收下了。', '你手真大，可惜脑子小。'],
    ['一只手就够了。', '一只手也配？'],
  ],
  rejection: [
    ['别在我面前起跳！', '下次我照扣不误。'],
    ['这是禁飞区，懂吗？', '禁飞区？我买了机票。'],
    ['回家吧，今晚不适合你。', '你家才不适合我。'],
    ['这球我包了。', '你包得起吗？'],
  ],
  steal: [
    ['球给我，谢谢。', '你就偷吧，偷一辈子。'],
    ['你的传球太好猜了。', '下一个你就猜不到。'],
    ['早就等着你这一下了。', '等很久了吧？'],
    ['拿来吧你。', '手别伸太长。'],
    ['谢谢惠顾。', '下次请早。'],
  ],
  turnover: [
    ['球都拿不稳？', '你行你上啊。'],
    ['这也叫控卫？', '闭嘴，看着就行。'],
    ['送得挺好啊。', '一次失误而已。'],
  ],
  rebound: [
    ['篮板是我的。', '你也就抢抢板。'],
    ['这球归我。', '下次我卡住你。'],
  ],
  miss: [
    ['就这？', '下一个必进。'],
    ['篮筐都替你疼。', '你防得也就那样。'],
    ['再来啊，我看好你。', '别急，会让你闭嘴的。'],
    ['手感凉了？', '凉的是你的防守。'],
  ],
  freethrow: [
    ['犯规也没用。', '下次直接把你撞翻。'],
    ['这两分我拿了。', '拿去吧，反正要还的。'],
  ],
  ftMiss: [
    ['罚球都进不了？', '总比你犯规强。'],
    ['白送的分都不要。', '你等着。'],
  ],
};

/* =============================================================
   战术
   ---------------------------------------------------------------
   进攻：平衡 / 主攻外线 / 主攻内线 / 跑轰
   防守：人盯人 / 2-3 联防 / 3-2 联防
   彼此有克制关系，克制方的命中率会明显更好 —— 所以阵容弱的一方
   靠战术猜对也能赢，不是数值大就一定赢。
   ============================================================= */
const OFF_TACTICS = {
  balanced: { key: 'balanced', name: '平衡进攻', short: '平衡',
    desc: '内外均衡，专克联防；没有短板也没有惊喜',
    /* ★ v9.30：原本 hit 和 w 都是空表 → 出手分布完全随球风走，
       导致它的期望得分由"球员球风"决定，而不是由战术决定。
       现在给一个中性的出手权重与小幅命中补偿，让它成为"稳定的基准线"。 */
    w: { three: 1.00, mid: 1.00, floater: 1.00, layup: 1.00, driveDunk: 1.00, postControl: 1.00 },
    /* ★ 命中补偿经标定为 −0.04（±8000 回合测）：
       平均 0.956 分/回合，接近基准 1.004；给 w 全 1 之后出手分布偏内线，
       必须用负补偿把它拉回来，否则它会变成最强解（实测 +9.4%）。 */
    hit: { three: -0.040, mid: -0.040, floater: -0.040, layup: -0.040, driveDunk: -0.040, postControl: -0.040 },
    pace: 1, stamina: 1 },
  perimeter: { key: 'perimeter', name: '主攻外线', short: '外线',
    desc: '大量三分与中距离，专克收缩的 2-3 联防',
    w: { three: 1.85, mid: 1.4, floater: 0.95, layup: 0.6, driveDunk: 0.45, postControl: 0.4 },
    /* ★ v9.30 平衡：实测（4000 回合/格）这套的期望得分比基准低 5.5%，
       原因是三分占比高、命中率天然低。补 1.4% 命中把它的**平均**拉平，
       于是"选外线"变成"押注对手用 2-3"而不是"纯吃亏"。 */
    hit: { three: 0.046, mid: 0.036, floater: 0.014, layup: 0.014, driveDunk: 0.014 },
    pace: 1, stamina: 1.05, orebMul: 0.92 },
  inside: { key: 'inside', name: '主攻内线', short: '内线',
    desc: '强攻篮下与背身，专克外扩的 3-2 联防',
    w: { three: 0.38, mid: 0.6, floater: 0.7, layup: 1.5, driveDunk: 1.65, postControl: 1.75 },
    /* ★ v9.30 平衡：这套原本平均高出基准 4.3%（内线出手命中率高），
       下调命中补偿，并保留体能代价（stamina 1.1）+ 前场篮板收益（orebMul 1.14）。 */
    hit: { three: -0.006, mid: -0.004, floater: 0.020, layup: 0.016, driveDunk: 0.022, postControl: 0.020 },
    pace: 0.95, stamina: 1.1,
    orebMul: 1.14, drawFoulMul: 1.12 },
  runGun: { key: 'runGun', name: '跑轰战术', short: '跑轰',
    desc: '回合数大幅增加，靠体能拖垮人盯人；怕联防',
    w: { three: 1.55, layup: 1.45, driveDunk: 1.32, mid: 1.18 },
    /* ★ v9.29 平衡：
       · stamina 1.5 → 1.30（1.5 时每回合消耗是平衡的 2.1 倍，实测首发掉到 12%，
         等于全队报废 —— 不是"用体能换节奏"而是自杀）
       · 同时把出手权重整体调高（three 1.35→1.55 等），让跑轰**真的能得分**。
         原来它只是"更累且不得分"：实测胜率仅 31%，是个陷阱选项。
       设计意图：跑轰 = 用体能换节奏与出手量，
       代价是末节主力掉到 44% 左右（需要靠轮换深度和硬汉徽章撑）。 */
    /* hit 是直接加在命中率上的百分点（不是倍率）——
       跑轰出手快、防守来不及落位，所以命中率也给一点补偿。
       加这两个百分点 + 上面的出手权重，跑轰的胜率才从 33% 拉回 ~50%。 */
    /* ★ v9.30 平衡：这套原本平均低 9%（toMul 1.22 的失误惩罚 + 三分占比高）。
       把失误惩罚收敛到 1.10，并给足命中补偿 —— 代价保留在体能上（stamina 1.15）。 */
    hit: { three: 0.052, mid: 0.044, floater: 0.038, layup: 0.046, driveDunk: 0.042, postControl: 0.040 },
    /* stamina 1.30 → 1.15（标定，v9.29）
       实测（对手用平衡，各 60 场）：
         1.30 → 终场最累 42.2%、胜率 33%（陷阱选项）
         1.15 → 终场最累 46.9%、胜率 47%（健康的取舍）← 采用
         0.90 → 终场最累 51.2%、胜率 57%（反而变成最优解，不行）
       所以 1.15 是"用体能换节奏、需要轮换深度支撑"的甜点。 */
    pace: 0.6, stamina: 1.15, toMul: 1.10 },
};
const DEF_TACTICS = {
  man: { key: 'man', name: '人盯人', short: '盯人',
    desc: '最均衡，抢断与压迫更强，但被跑轰拖体能',
    vs: { perimD: 1.0, intD: 1.0, postD: 1.0 }, stealMul: 1.22, foulMul: 1.16,
    pace: 1, drebMul: 1.0, orebMul: 1.0 },
  zone23: { key: 'zone23', name: '2-3 联防', short: '2-3',
    desc: '收缩护筐，内线防守大增，但外线会漏',
    vs: { perimD: 0.82, intD: 1.20, postD: 1.22 }, stealMul: 0.92, foulMul: 0.90,
    pace: 1.02, drebMul: 0.88, orebMul: 1.10 },
  zone32: { key: 'zone32', name: '3-2 联防', short: '3-2',
    desc: '外扩干扰投篮，外线防守大增，但内线空虚',
    vs: { perimD: 1.21, intD: 0.82, postD: 0.80 }, stealMul: 1.10, foulMul: 0.94,
    pace: 1.0, drebMul: 1.10, orebMul: 0.86 },
};
/* =============================================================
   战术克制矩阵（v9.30 补齐）
   -------------------------------------------------------------
   原来的问题：
     · 平衡进攻对三种防守全是 0 —— 它成了"无风险也无收益"的默认值，
       玩家没有理由主动选它，也没有理由不选
     · 盯人防守**不被任何进攻克制**（跑轰 +0.046 是单向的）
     · 2-3 与 3-2 之间没有任何关系

   现在补成闭环，每套战术都有明确的"克谁 / 被谁克"：

     进攻 \ 防守     人盯人    2-3联防   3-2联防   战绩
     平衡进攻       -0.026   +0.050   +0.038   克 2 / 被克 1
     主攻外线       -0.034   +0.068   -0.072   克 2 / 被克 1
     主攻内线       +0.030   -0.064   +0.072   克 2 / 被克 1
     跑轰战术       +0.046   -0.042   -0.040   克 2 / 被克 1

   ★ 完全对称：每种进攻都是「克 2 种、被 1 种克」，
     反过来说每种防守也是「被 2 种克、克 2 种」—— 没有任何一套通吃：
       人盯人  ← 被 主攻内线 / 跑轰 克
       2-3    ← 被 平衡 / 外线 克
       3-2    ← 被 平衡 / 内线 克
     配合各自的 pace / stealMul / foulMul 差异形成真正的取舍：
     · 盯人：抢断强（stealMul 1.22）但犯规多（foulMul 1.16）、被跑轰拖体能
     · 2-3：护筐强（intD/postD ×1.2）但漏外线，且后场篮板差（drebMul 0.88）
     · 3-2：外扩强（perimD ×1.21）但护筐差，前场篮板差（orebMul 0.86）
     · 平衡进攻：克两种联防，但被盯人克 —— 不是"无脑最优"也不再是纯劣势
   ★ 数值上限定在 ±0.072（约 7 个百分点命中率）—— 见 check.js 的
     「克制修正幅度合理」断言，别把它调大到能一票否决。
   ============================================================= */
const COUNTER = {
  balanced:  { man: -0.026, zone23: 0.050,  zone32: 0.038 },
  perimeter: { man: -0.034, zone23: 0.068,  zone32: -0.072 },
  inside:    { man: 0.030,  zone23: -0.064, zone32: 0.072 },
  runGun:    { man: 0.046,  zone23: -0.042, zone32: -0.040 },
};
function counterBonus(offTac, defTac) {
  const row = COUNTER[offTac] || COUNTER.balanced;
  return row[defTac] || 0;
}
/**
 * AI 临场应变：根据比分、剩余时间、对方手感和犯规情况换战术。
 * 返回新的战术（没变就返回 null），并附一句解说用的说明。
 */
/* =============================================================
   AI 轮换（按体力换替补）
   -------------------------------------------------------------
   真实教练怎么轮换：
     · 主力体力掉到 40% 以下就该歇了
     · 换上来的人优先同位置、且体力最足的
     · 垃圾时间（领先/落后很多）多给替补机会
     · 关键时段（末节胶着）宁可让主力硬撑
   体力消耗本身按球员能力算：有体力徽章（电量充满/不知疲倦/
   铁人）的掉得慢，没有的掉得快 —— 这套已经在 makeStamina 里，
   所以 AI 也必须跟着轮换，否则球星会被活活累死。
   ============================================================= */
/* 低于这个体力比例就该换下。v9.29 起统一从 FA 表读，
   避免"注释里一个数、代码里另一个数"的历史问题。 */
const AI_SUB_TIRED = (typeof FA !== 'undefined' && FA.SUB_TIRED) ? FA.SUB_TIRED : 0.40;

/** 算一名球员的"当前贡献值"：命中率 + 手感 + 犯规麻烦 */
function playerImpact(p) {
  if (!p || !p.stat) return 0;
  const fga = p.stat.fga || 0, fgm = p.stat.fgm || 0;
  const fg = fga >= 3 ? fgm / fga : 0.45;          // 样本太小就按平均算
  const hot = (p.hot || 0) * 0.06;                  // 手感火热加分
  const foul = (p.stat.pf || 0) >= 4 ? -0.35 : 0;   // 犯规麻烦扣分
  const sta = p.stamina ? p.stamina.cur / p.stamina.max : 1;
  return fg + hot + foul + sta * 0.25;
}

function aiRotate(gs, force, side) {
  const t = side === 'my' ? gs.myTeam : gs.aiTeam;
  const foe = side === 'my' ? gs.aiTeam : gs.myTeam;
  if (!t || !t.players || !t.bench || !t.bench.length) return null;
  const diff = t.score - (foe ? foe.score : 0);
  const remain = (QUARTERS - gs.q - 1) * QUARTER_SEC + gs.clock;
  const clutch = gs.q >= 3 && remain < 240 && Math.abs(diff) <= 8;
  const garbage = Math.abs(diff) >= 20;
  // 该换下的门槛：关键时段让主力多撑一会儿
  const limit = clutch ? FA.SUB_CLUTCH : garbage ? FA.SUB_GARBAGE : AI_SUB_TIRED;
  // 对手最烫的那个人，用来做针对性换人
  const foeHot = foe && foe.players
    ? foe.players.slice().sort((a, b) => (b.hot || 0) - (a.hot || 0))[0] : null;
  const foeHotLv = foeHot ? (foeHot.hot || 0) : 0;

  /* =============================================================
     ⏳ 换人冷却（v9.36 防抖）
     -------------------------------------------------------------
     只加"替补必须更强"还不够 —— 被换下的人休息几回合体力就回来了，
     立刻又变成最优解，于是同一个位置来回对调：
       PF 勒布朗 → 格里芬 → 勒布朗 → 格里芬 …
     现在：**刚被换下的球员 8 个回合内不能再上场**。
     ============================================================= */
  const outList = [];
  t.players.forEach((p, i) => {
    if (!p || !p.stamina) return;
    const ratio = p.stamina.cur / p.stamina.max;
    const pf = (p.stat && p.stat.pf) || 0;
    const reasons = [];
    // ① 体力见底
    if (ratio <= limit) reasons.push('体力 ' + Math.round(ratio * 100) + '%');
    // ② 犯规麻烦：4 犯以上先保护起来（关键时段除外）
    if (pf >= 4 && !clutch) reasons.push(pf + ' 次犯规');
    // ③ 手感冰凉＋打了不少铁 → 换个人试试（垃圾时间不做）
    if (!garbage && !clutch && p.stat && p.stat.fga >= 6
        && (p.stat.fgm / p.stat.fga) < 0.28) {
      reasons.push('手感冰凉 ' + p.stat.fgm + '/' + p.stat.fga);
    }
    // ④ 对手有人打疯了 → 换个防守更好的上去
    if (foeHotLv >= 3 && !clutch && i < 5) {
      const myDef = (p.attrs.perimD + p.attrs.lateral + p.attrs.intD) / 3;
      if (myDef < 85) reasons.push('对位被打爆');
    }
    if (!reasons.length) return;

    /* =============================================================
       🎯 换人选人评分（v9.36 重写）
       -------------------------------------------------------------
       用户要求：「换人优先换主副位」「优先换该位置能力值比较强的球员」。

       ★ 原来有个 bug：同位置判断比的是**被换下球员自己的位置**
         （p.pos / p.card.pos2），而不是**他要打的场上位置** ——
         于是可能换上一个打不了这个位置的人，直接吃 -60% 客串惩罚。

       现在按四层来评分：
         ① 位置适配（硬门槛）：本位 60 分 / 副位 38 分 /
            客串 0 分，并且客串的**只在完全没人可用时才考虑**
         ② 该位置能力：按这个 slot 最看重的能力加权（见 POS_NEED）
         ③ 体力：越足越好（这是换人的初衷）
         ④ 综合：同等条件下用更强的
       ============================================================= */
    const slot = p.slotPos || SLOT_POS[i] || p.pos;
    /* 针对性换人的额外加分（抽成一个 bonus 回调，供双方共用） */
    const bonus = (pl) => {
      let v2 = 0;
      if (reasons.indexOf('对位被打爆') >= 0) {
        v2 += ((pl.attrs.perimD + pl.attrs.lateral + pl.attrs.intD) / 3) * 1.2;
      }
      if (reasons.indexOf('手感冰凉') >= 0) {
        v2 += ((pl.attrs.three + pl.attrs.mid + pl.attrs.layup) / 3) * 0.6;
      }
      return v2;
    };
    const curSc = subScore(p, slot, bonus);
    let best = -1, bestV = -1, bestFallback = -1, bestFallbackV = -1;
    t.bench.forEach((b, j) => {
      if (!b || !b.stamina || !b.card) return;
      if (b.subCool != null && (gs.possession || 0) - b.subCool < SUB_COOLDOWN) return;   // ⏳ 冷却中
      const sc = subScore(b, slot, bonus);
      if (sc.fit === 'out') {
        /* 客串的只留作兜底，不给正选 */
        if (sc.v > bestFallbackV) { bestFallbackV = sc.v; bestFallback = j; }
        return;
      }
      if (sc.v > bestV) { bestV = sc.v; best = j; }
    });
    /* =============================================================
       ★ 关键：换上来的人必须**确实比场上这位强**（v9.36 新增）
       -------------------------------------------------------------
       原来只判断"要不要换下"，不判断"换上来的是否更好" ——
       于是同一个位置会来回对调：
         PF 勒布朗(80) → 格里芬(76) → 勒布朗(80) → 格里芬(76) …
       实测 20 场里出现 3 次这种无意义抖动。

       现在要求替补得分超过场上球员 **2 分**（hysteresis，防抖），
       不够好就不换 —— 宁可让主力多打一会儿。
       ============================================================= */
    const SUB_GAIN = 2;
    if (best >= 0 && bestV < curSc.v + SUB_GAIN) best = -1;
    /* =============================================================
       ★ 客串兜底：只处理**真正撑不住**的情况（v9.36 定稿）
       -------------------------------------------------------------
       试过两版都不对：
         宽松版（limit×0.85）：客串上位从 8% 飙到 33%，
           换上来的球员在该位置的能力平均低 14.7 点 —— 得不偿失
         收紧版（limit×0.72）：仍然有 28%，因为防守端掉得快

       ★ 根本矛盾：如果替补席上**没有**能打这个位置的人，
         那么"换个客串上来"（能力 -12 点）往往不如"让场上的人
         继续打"（体力低导致能力 -20%）。两者差不多，但前者还会
         浪费一次换人机会、打乱轮换。

       定稿策略：客串兜底只在**紧急**时启用 —— 体力比例 ≤ 0.25
       （此时能力系数已掉到 0.7 以下，换谁上来都更好）。
       其余情况下"这个位置换不了人"就不换。
       ============================================================= */
    if (best < 0 && bestFallback >= 0
        && (p.stamina.cur / p.stamina.max) <= 0.25) {
      best = bestFallback; bestV = bestFallbackV;
    }
    if (best < 0) return;
    const innP = t.bench[best];
    const innFit = posFit(innP.card, slot);
    outList.push({ i, j: best, out: p, inn: innP, ratio,
      why: reasons[0], slot, fit: innFit });
  });

  if (!outList.length) return null;
  const subs = force ? outList.slice(0, 3) : outList.slice(0, 2);
  subs.forEach((sv) => {
    const b = t.bench[sv.j];
    const outgoing = t.players[sv.i];
    /* ★ 位置槽交接：替补上场后打的就是被换下那位的位（v9.32）
       ★ v9.35：位置变了就要重算客串惩罚 ——
         上场的人可能不适合这个位置（-60%），下场的人要恢复正常属性。 */
    b.slotPos = outgoing.slotPos;
    applyOutOfPosPenalty(b, b.slotPos);
    outgoing.slotPos = '';
    applyOutOfPosPenalty(outgoing, '');
    outgoing.subCool = (gs && gs.possession) || 0;   // ⏳ 记下被换下的时点
    b.subCool = null;                                // 上场的清除冷却
    t.bench[sv.j] = outgoing;
    t.players[sv.i] = b;
  });
  return subs;
}

/* =============================================================
   玩家端"自动换人"按钮
   -------------------------------------------------------------
   玩家点一下，就按**当前场上情况**立刻换人（只动我方）：
     · 体力低于 65% 就考虑换（比 AI 的 40% 更积极，因为是手动触发）
     · 4 次犯规保护
     · 手感冰凉（投 5 个进不到 1.5 个）
     · 对位被打爆（对手有人手感热而我的防守能力低）
   替补优先选：同位置 > 体力足 > 综合高。
   ============================================================= */
function manualAutoSub() {
  const t = BT.myTeam;
  if (!t || !t.players || !t.bench || !t.bench.length) return null;
  const gs = BT.gs;
  const diff = t.score - (gs ? gs.aiTeam.score : 0);
  const remain = gs ? ((QUARTERS - gs.q - 1) * QUARTER_SEC + gs.clock) : 999;
  const clutch = gs && gs.q >= 3 && remain < 240 && Math.abs(diff) <= 8;
  const limit = clutch ? FA.SUB_CLUTCH : FA.SUB_GARBAGE;
  const foe = gs ? gs.aiTeam : null;
  const foeHotP = foe && foe.players
    ? foe.players.slice().sort((a, b) => (b.hot || 0) - (a.hot || 0))[0] : null;
  const foeHotLv = foeHotP ? (foeHotP.hot || 0) : 0;

  const outList = [];
  t.players.forEach((p, i) => {
    if (!p || !p.stamina) return;
    const ratio = p.stamina.cur / p.stamina.max;
    const pf = (p.stat && p.stat.pf) || 0;
    const reasons = [];
    if (ratio <= limit) reasons.push('体力 ' + Math.round(ratio * 100) + '%');
    if (pf >= 4 && !clutch) reasons.push(pf + ' 次犯规');
    if (p.stat && p.stat.fga >= 5 && (p.stat.fgm / p.stat.fga) < 0.30) {
      reasons.push('手感冰凉 ' + p.stat.fgm + '/' + p.stat.fga);
    }
    if (foeHotLv >= 3) {
      const myDef = (p.attrs.perimD + p.attrs.lateral + p.attrs.intD) / 3;
      if (myDef < 88) reasons.push('对位被打爆');
    }
    if (!reasons.length) return;

    /* ★ v9.36：与 aiRotate 用同一套评分（位置适配硬门槛 + 该位置能力加权）。
       原来这里也是"比被换下球员自己的位置"，会换上打不了这个位置的人。 */
    const slot = p.slotPos || SLOT_POS[i] || p.pos;
    const bonus2 = (pl) => {
      let v2 = 0;
      if (reasons.indexOf('对位被打爆') >= 0) {
        v2 += ((pl.attrs.perimD + pl.attrs.lateral + pl.attrs.intD) / 3) * 1.2;
      }
      if (reasons.indexOf('手感冰凉') >= 0) {
        v2 += ((pl.attrs.three + pl.attrs.mid + pl.attrs.layup) / 3) * 0.6;
      }
      return v2;
    };
    const curSc2 = subScore(p, slot, bonus2);
    let best = -1, bestV = -1, bestFallback = -1, bestFallbackV = -1;
    t.bench.forEach((b, j) => {
      if (!b || !b.stamina || !b.card) return;
      if (b.subCool != null && (gs.possession || 0) - b.subCool < SUB_COOLDOWN) return;   // ⏳ 冷却中
      const sc = subScore(b, slot, bonus2);
      if (sc.fit === 'out') {
        if (sc.v > bestFallbackV) { bestFallbackV = sc.v; bestFallback = j; }
        return;
      }
      if (sc.v > bestV) { bestV = sc.v; best = j; }
    });
    /* ★ v9.36：防抖 —— 替补要确实更强才换（同 aiRotate） */
    const SUB_GAIN2 = 2;
    if (best >= 0 && bestV < curSc2.v + SUB_GAIN2) best = -1;
    /* ★ 客串兜底：只在紧急情况（体力 ≤ 25%）启用，同 aiRotate */
    if (best < 0 && bestFallback >= 0
        && (p.stamina.cur / p.stamina.max) <= 0.25) {
      best = bestFallback; bestV = bestFallbackV;
    }
    if (best < 0) return;
    outList.push({ i, j: best, out: p, inn: t.bench[best], why: reasons[0],
      slot, fit: posFit(t.bench[best].card, slot) });
  });

  if (!outList.length) return null;
  const subs = outList.slice(0, 3);
  subs.forEach((sv) => {
    const b = t.bench[sv.j];
    const outgoing = t.players[sv.i];
    /* ★ 位置槽交接：替补上场后打的就是被换下那位的位（v9.32）
       ★ v9.35：位置变了就要重算客串惩罚 ——
         上场的人可能不适合这个位置（-60%），下场的人要恢复正常属性。 */
    b.slotPos = outgoing.slotPos;
    applyOutOfPosPenalty(b, b.slotPos);
    outgoing.slotPos = '';
    applyOutOfPosPenalty(outgoing, '');
    outgoing.subCool = (gs && gs.possession) || 0;   // ⏳ 记下被换下的时点
    b.subCool = null;                                // 上场的清除冷却
    t.bench[sv.j] = outgoing;
    t.players[sv.i] = b;
  });
  return subs;
}

/* =============================================================
   AI 叫暂停
   -------------------------------------------------------------
   参考真实教练的暂停时机：
     · 被对手打出一波流（连丢 3 球以上）
     · 短时间内分差被拉开
     · 自己进攻连续打铁、势头掉到谷底
     · 末节关键时段，比分胶着 → 布置最后一攻
     · 刚被隔扣/大帽，气势受挫
   暂停效果和玩家一样：全队回体力 + 打断对手势头 + 换战术。
   带冷却，不会一回合叫一次。
   ============================================================= */
const AI_TIMEOUT_COOLDOWN = 6;      // 至少间隔几个回合才能再叫
function aiTimeoutCheck(gs, ev) {
  const ai = gs.aiTeam, foe = gs.myTeam;
  if (!ai || !foe) return null;
  if (ai.timeouts <= 0) return null;
  if (gs.aiTimeoutCd > 0) { gs.aiTimeoutCd--; return null; }
  if (gs.breakLeft > 0) return null;

  const diff = ai.score - foe.score;
  const remain = (QUARTERS - gs.q - 1) * QUARTER_SEC + gs.clock;
  const reasons = [];

  // ① 被打出一波流
  if ((foe.runStreak || 0) >= 3) reasons.push('被对面连拿 ' + foe.runStreak + ' 球');
  // ② 势头崩了
  if ((ai.momentum || 0) <= -3) reasons.push('进攻完全打不出来');
  // ③ 短时间被拉开
  if (diff <= -8 && gs.q >= 1) reasons.push('分差被拉开到 ' + (-diff) + ' 分');
  // ④ 刚被隔扣/大帽，气势受挫
  if (ev && (ev.kind === 'poster' || ev.kind === 'posterize' ||
    ev.kind === 'rejection' || ev.kind === 'pin') && !ev.mine) {
    reasons.push('刚被隔扣，得稳一下');
  }
  // ⑤ 末节胶着，布置关键球
  if (gs.q >= 3 && remain < 150 && Math.abs(diff) <= 5 && !gs.aiLateTO) {
    reasons.push('最后时刻，布置关键一攻');
  }
  if (!reasons.length) return null;

  // 叫暂停
  ai.timeouts--;
  gs.aiTimeoutCd = AI_TIMEOUT_COOLDOWN;
  if (gs.q >= 3 && remain < 150) gs.aiLateTO = 1;

  // 效果 1：全队回体力
  ai.players.forEach((p) => {
    if (!p.stamina) return;
    const rec = p.stamina.recover || 1;
    p.stamina.cur = Math.min(p.stamina.max,
      p.stamina.cur + p.stamina.max * 0.16 * rec);
  });
  // 效果 2：打断对手势头
  foe.momentum = (foe.momentum || 0) * 0.3;
  ai.momentum = (ai.momentum || 0) * 0.5 + 1.2;
  ai.runStreak = 0;

  // 效果 3：暂停后一定会调整战术（用同一套 aiAdjust 逻辑，但强制生效）
  let adj = aiAdjust(ai, foe, gs.q, gs.clock);
  if (!adj) {
    // 没触发条件也要换个不一样的，别白叫
    const offs = ['perimeter', 'inside', 'runGun', 'balanced'].filter((k) => k !== ai.off);
    const defs = ['man', 'zone23', 'zone32'].filter((k) => k !== ai.def);
    adj = {
      off: pickR(offs), def: pickR(defs),
      why: '暂停布置新战术',
    };
  } else {
    adj.why = '暂停布置：' + adj.why;
  }
  applyTactic(ai, adj);

  return { reasons, adj, left: ai.timeouts };
}

/** 把一套战术应用到球队上（AI 暂停后调用，必生效） */
function applyTactic(team, adj) {
  if (!team || !adj) return;
  if (adj.off) team.off = adj.off;
  if (adj.def) team.def = adj.def;
  try {
    refreshLiveTac();
    pushFeedLine(`<b>对方调整</b>：进攻「${
      (OFF_TACTICS[team.off] || {}).name || '?'}」防守「${
      (DEF_TACTICS[team.def] || {}).name || '?'}」`, 'tac');
  } catch (e) { /* 界面没准备好就算了 */ }
}

function aiAdjust(ai, foe, quarter, clock) {
  const diff = ai.score - foe.score;              // 正数=AI 领先
  const remain = (QUARTERS - quarter - 1) * QUARTER_SEC + clock;
  const late = quarter >= 2;
  const cur = { off: ai.off, def: ai.def };

  /* ---- 先看场上形势，形势比"固定套路"更重要 ---- */
  const myFg = (() => {
    let m = 0, a = 0;
    ai.players.forEach((p) => { m += p.stat.fgm || 0; a += p.stat.fga || 0; });
    return a >= 8 ? m / a : 0.45;
  })();
  const foeHotP = foe.players.slice().sort((a, b) => (b.hot || 0) - (a.hot || 0))[0];
  const foeHot = foeHotP && (foeHotP.hot || 0) >= 3;
  const myFouls = ai.players.reduce((a, p) => a + ((p.stat && p.stat.pf) || 0), 0);
  const myTired = ai.players.filter((p) =>
    p.stamina && p.stamina.cur / p.stamina.max < 0.45).length;

  // ---------- 防守调整 ----------
  let def = ai.def, defWhy = '';
  if (foeHot && ai.def === 'man') {
    def = 'zone23'; defWhy = '对面 ' + foeHotP.name + ' 手感太热，收缩成 2-3 联防';
  } else if (myFouls >= 9 && ai.def !== 'zone23') {
    // 全队犯规太多 → 收缩联防，别送罚球
    def = 'zone23'; defWhy = '犯规太多（' + myFouls + ' 次），改联防少送罚球';
  } else if (myTired >= 3 && ai.def !== 'zone32') {
    // 大半支队伍跑不动了 → 用 3-2 省点体力
    def = 'zone32'; defWhy = '体力吃紧，改 3-2 省点力气';
  } else if (diff < -10 && late && remain < 8 * 60) {
    def = 'man'; defWhy = '落后太多，改人盯人全场逼抢';
  } else if (diff > 12 && late) {
    def = 'zone23'; defWhy = '领先了，收缩联防稳一手';
  }

  // ---------- 进攻调整 ----------
  let off = ai.off, offWhy = '';
  if (myFg < 0.35 && ai.players.length) {
    // 全队打铁 → 往内线打，造杀伤或者更容易的出手
    const big = ai.players.slice().sort((a, b) =>
      ((b.attrs.postControl + b.attrs.layup) / 2)
      - ((a.attrs.postControl + a.attrs.layup) / 2))[0];
    off = 'inside';
    offWhy = '全队命中率只有 ' + Math.round(myFg * 100) + '%，改打内线';
    if (big) offWhy += '（主打 ' + big.name + '）';
  } else if (diff < -12 && remain < 6 * 60) {
    off = 'runGun'; offWhy = '时间不多了，改炮轰抢分';
  } else if (diff > 14 && late) {
    off = 'balanced'; offWhy = '领先多了，稳着打';
  } else if (myTired >= 3) {
    off = 'perimeter'; offWhy = '体力不济，减少内线肉搏，多投外线';
  } else if (counterBonus(ai.off, foe.def) < 0.01) {
    // 现在的战术被对面克，换一个能克的
    let bestK = ai.off, bestV = counterBonus(ai.off, foe.def);
    Object.keys(OFF_TACTICS).forEach((k) => {
      const v = counterBonus(k, foe.def);
      if (v > bestV + 0.005) { bestV = v; bestK = k; }
    });
    if (bestK !== ai.off) {
      off = bestK;
      offWhy = '对面摆的是' + (DEF_TACTICS[foe.def] || {}).name + '，换' +
        (OFF_TACTICS[bestK] || {}).name + '针对';
    }
  }
  if (off === cur.off && def === cur.def) return null;
  return { off, def, why: [offWhy, defWhy].filter(Boolean).join('；') };
}

/** AI 选战术：一部分概率专门克制你，一部分随机，所以不是必胜 */
function aiPickTactics(myOff, myDef) {
  const offKeys = Object.keys(OFF_TACTICS);
  const defKeys = Object.keys(DEF_TACTICS);
  // 找能克制我方防守的进攻战术
  let bestOff = 'balanced', bestV = -9;
  offKeys.forEach((k) => {
    const v = counterBonus(k, myDef) + Math.random() * 0.05;
    if (v > bestV) { bestV = v; bestOff = k; }
  });
  // 找能克制我方进攻的防守战术
  let bestDef = 'man', bestD = -9;
  defKeys.forEach((k) => {
    const v = -counterBonus(myOff, k) + Math.random() * 0.05;
    if (v > bestD) { bestD = v; bestDef = k; }
  });
  const clever = Math.random() < 0.42;      // 只有四成概率会针对你，其余乱选
  return {
    off: clever ? bestOff : pickR(offKeys),
    def: clever ? bestDef : pickR(defKeys),
  };
}

/* =============================================================
   垃圾话 / 连击台词
   ---------------------------------------------------------------
   按"连得多少分"分级：2 球是嘚瑟，3 球开始喷，4 球以上是暴击。
   对手连击时用同一套，只是主语换成对面。
   ============================================================= */
const TRASH = {
  2: [
    '这球稳了吧。', '手感来了。', '再来一个。', '简单。',
    '就这防守？', '我还没热身呢。',
  ],
  3: [
    '过你就像清晨的马路。',
    '你太弱了，让你奶奶来跟我打吧。',
    '这防守水平，我闭着眼都能进。',
    '你们的防守呢？人去哪了？',
    '篮球不是这么打的，兄弟。',
    '刚才那球是给你的教学。',
    '五个人一起上啊，别客气。',
  ],
  4: [
    '我站在这里就是得分。',
    '这篮筐对我来说像大海一样。',
    '回家练两年再来吧。',
    '太轻松了，我都没喘气。',
    '看清楚了，这叫技术。',
    '你们教练该换人了。',
    '我建议你们直接认输。',
    '这球进了要不要给你签个名？',
  ],
};
/** 团队连击（全队连续得分）时的大字提示 */
const TEAM_RUN = [
  '打出一波流！', '气势完全起来了！', '对面叫暂停都来不及了！',
  '这波攻势挡不住！', '分差要拉开了！',
];

/* ---------------- 工具 ---------------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const pickR = (arr) => (Array.isArray(arr) && arr.length)
  ? arr[Math.floor(Math.random() * arr.length)] : '……';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/**
 * 软上限：把能力差压缩到 ±k 以内（tanh 饱和）。
 * 没有它的话，紫卡打银卡就是 100% 胜率 —— 数值一高就没有悬念了。
 * 有了它，再大的差距最多折算成约 ±30 的有效差，弱队总有机会。
 */
const softCap = (x, k) => k * Math.tanh(x / k);

/** 从卡库里取出这张卡的当前能力（含突破加成） */
function battleStats(cardId) {
  const card = CARD_BY_ID[cardId];
  const o = S.owned[cardId];
  if (!card || !o) return null;
  const st = statsOf(card, o.brk);
  return { card, attrs: st.attrs, ovr: st.ovr, brk: st.brk };
}

/** 体力：0~100，参与攻防都会掉，休息会回 */
/* =============================================================
   体力系统
   -------------------------------------------------------------
   基础值来自 sta（体力）属性，再叠加体力类徽章：
     · 电量充满 —— 体力上限更高（金 +18 / 银 +12 / 铜 +7）
     · 不知疲倦 —— 防守端消耗大幅降低（最高 −35%）
     · 铁人     —— 全场消耗降低（最高 −22%）
     · 永动机   —— 节间恢复更快（最高 +80%）
     · 硬汉     —— 累了也不掉状态（削弱体力对命中率的影响）
   ============================================================= */
function makeStamina(card, brk) {
  const base = staminaOf(card);
  const b = brk || 0;
  const rCharged = badgeRank(card, b, 'charged');
  const rRelent = badgeRank(card, b, 'relentless');
  const rIron = badgeRank(card, b, 'ironman');
  const rMotor = badgeRank(card, b, 'motor');
  const rTough = badgeRank(card, b, 'tough');
  // 上限：电量充满每级 +6
  /* ★ v9.29 全明星加成：入选过全明星的球员永久 +6 体力上限。
     刻意在这里读、而**不**在 statsOf 里读 —— allStarPicks() 用 statsOf 排名，
     写进 statsOf 会让评选递归。 */
  const asBonus = (typeof allStarBonusOf === 'function' && allStarBonusOf(card.id))
    ? ALLSTAR_BONUS_STA : 0;
  const max = 100 + rCharged * 6 + asBonus;
  // 基础消耗：体力属性越好越省
  let drain = clamp(1.35 - base / 130, 0.42, 1.0);
  drain *= 1 - rIron * 0.073;                    // 铁人：全场省力
  return {
    cur: max, max,
    drain,                                        // 进攻端消耗系数
    drainDef: drain * (1 - rRelent * 0.117),      // 防守端：不知疲倦再降
    recover: 1 + rMotor * 0.27,                   // 节间恢复倍率
    /* 体力对能力的惩罚倍率：1.00(无) / 0.80(铜) / 0.62(银) / 0.45(金)
       —— 直接压平 staminaFactor 的下滑斜率，见那里的说明 */
    tough: 1 - rTough * 0.183,
    brk: { charged: rCharged, relentless: rRelent, ironman: rIron,
      motor: rMotor, tough: rTough },
  };
}

function mkPlayer(id) {
  const st = battleStats(id);
  if (!st) return null;
  return {
    id, card: st.card, attrs: st.attrs, ovr: st.ovr, brk: st.brk,
    pos: st.card.pos, name: st.card.name, photo: st.card.photo,
    stamina: (() => {
      const s0 = makeStamina(st.card, st.brk);
      /* 背靠背疲劳：连续比赛会让体力上限下降。
         v9.29 从「每级 4%、满级 −12%」提到「每级 8%、满级 −24%」——
         旧数值下满级疲劳打完一场仍剩 48%，高于 40% 的换人阈值，
         等于这个系统不存在。详见 quests.js 的 fatiguePenalty()。 */
      const FATIGUE_DESC = '（最多 -' +
        Math.round((typeof FATIGUE_PER_LEVEL === 'number' ? FATIGUE_PER_LEVEL : 0.08) * 100 *
        (typeof FATIGUE_MAX_LEVEL === 'number' ? FATIGUE_MAX_LEVEL : 3)) + '%）';
      if (typeof fatiguePenalty === 'function') {
        const pen = fatiguePenalty();
        if (pen > 0) {
          s0.max = Math.round(s0.max * (1 - pen));
          s0.cur = s0.max;
        }
      }
      return s0;
    })(),
    // 上场时把这名球员实际能拿到的徽章（key → 品质）固定下来
    badges: (() => {
      const m = {};
      badgesOf(st.card, st.brk).forEach((b) => { m[b.key] = b.tier; });
      return m;
    })(),
    /* =============================================================
       🏅 徽章效果预计算（v9.30）
       -------------------------------------------------------------
       把「徽章 → 各通道加成」在**上场时算一次**，之后热循环直接读数值。
       原来徽章效果散落在 attackValue/defendValue 里硬编码，
       且只有 21 枚真正接线；现在 104 枚全部走 badge-fx.js 的登记表。

       注意：条件类徽章（ctx_*）需要知道"当前情境"（贴身/底角/快攻…），
       所以这里按"情境单独算"再求和 —— 由 sumShotFx() 在判定时选通道。
       ============================================================= */
    fx: (() => {
      const m = {};
      badgesOf(st.card, st.brk).forEach((b) => { m[b.key] = b.tier; });
      const F = (typeof badgeChOf === 'function') ? badgeChOf : null;
      if (!F) return { has: false };
      const chans = ['on_three','on_mid','on_layup','on_dunk','on_post','on_floater','on_ft',
        'def_perim','def_int','def_post','def_rim','def_all','team_off','team_def',
        'steal','tpg','reb_off','reb_def','ast','foul_draw','str','vert'];
      const o = { has: true };
      chans.forEach((c) => { o[c] = F(m, c); });
      return o;
    })(),
    stat: { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, to: 0, pf: 0 },
    hot: 0, acting: false, scoredNow: false,
  };
}

/** cardIds 传 12 个：前 5 个首发，后 7 个替补 */
function buildTeam(cardIds, name, isAI) {
  const all = cardIds.map(mkPlayer).filter(Boolean);
  const players = all.slice(0, ROSTER.starters);
  const bench = all.slice(ROSTER.starters);
  /* ★ v9.32：把「现在打哪个位置」标到球员对象上。
     替补席是"可用名单"，没有固定位置，所以 slotPos 为空；
     换人时（aiRotate / manualAutoSub）incoming 会接管 outgoing 的位置槽。
     ★ v9.34：改用共享的 markSlotPos()，AI 队也调同一个函数。 */
  markSlotPos(players);
  const ovr = players.length
    ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length) : 0;
  /* 领袖徽章：场上只要有一个「领袖」，全队进攻都受益。
     品质越高加成越大（金 4.5% / 银 3% / 铜 1.5%），不叠加，取最高。 */
  let leaderBonus = 0;
  players.forEach((p) => {
    const lv = badgeLv(p, 'leader');
    leaderBonus = Math.max(leaderBonus, lv * 0.045);
  });
  return {
    name, players, bench, ovr, isAI, score: 0, quarterScores: [], timeouts: 3, morale: 0,
    off: 'balanced', def: 'man', momentum: 0, runStreak: 0, leaderBonus,
    form: 0.90 + Math.random() * 0.20,
  };
}

/* =============================================================
   体力系数：疲劳 → 比赛能力的唯一传导口（v9.29 重做）
   -------------------------------------------------------------
   分段曲线（参数见 FA）：
     体力 ≥ DIP(60%)          → 1.00        不受影响
     TIP(30%) ~ DIP(60%)      → 线性下滑到 0.62
     体力 < TIP(30%)          → 保持 0.62 的**能力**下限，但进入"透支"状态
                                （防守选位失灵 + 更容易被针对，见 playPossession）
   ★ 为什么能力下限不继续往下掉：那样会让球星在末节彻底变成废物，
     比赛结果被体力单因素决定。透支的代价改用"结构性的"惩罚表达 ——
     你能出手但防不住，这才是真实的疲劳。

   硬汉徽章（tough）：体力透支时下滑更少（向 1 靠近）。
   返回 1 表示"体力满"，所以调用方无需额外判断。
   ============================================================= */
function staminaFactor(p) {
  const cfg = (typeof FA !== 'undefined') ? FA
    : { DIP: 0.60, FLOOR: 0.62, TIP: 0.30 };
  const s = p.stamina.cur / p.stamina.max;
  if (s >= cfg.DIP) return 1;
  /* 60% → 1.00 线性降到 30% → FLOOR，30% 以下保持 FLOOR */
  const span = Math.max(0.01, cfg.DIP - cfg.TIP);
  const t = Math.max(0, Math.min(1, (s - cfg.TIP) / span));    // 0(见底) ~ 1(刚到60%)
  /* ★ 硬汉徽章：不该只是在"耗尽"时少掉一点 ——
     实测体力到 20% 以下的机会极少，那样徽章等于死物。
     现在改成**压平整条下滑曲线**（黄金徽章让衰减斜率只剩 45%），
     于是 30~60% 这个真正决定比赛的区间就能拉开差距。
     slope 越小 → 同样体力下能力越高。 */
  const soft = p.stamina.tough == null ? 1 : p.stamina.tough;   // 1.00 / 0.83 / 0.66 / 0.49
  const slope = (1 - cfg.FLOOR) * soft;
  return Math.max(cfg.FLOOR, 1 - (1 - t) * slope);
}

/** 这名球员是不是在"透支"（体力低于 FA.TIP）—— 防守端会被针对 */
function isGassed(p) {
  if (!p || !p.stamina) return false;
  const cfg = (typeof FA !== 'undefined') ? FA : { TIP: 0.30 };
  return p.stamina.cur / p.stamina.max < cfg.TIP;
}

/** 徽章加成：某项能力过了门槛就额外加成（和详情页的徽章同一套阈值） */
/* =============================================================
   徽章对比赛的加成
   -------------------------------------------------------------
   注意：加成看的是球员**实际拥有的徽章品质**，不是原始属性。
   同样 97 的三分，紫卡满突破能拿金徽章（+10%），
   银卡裸卡只有铜徽章（+3%）—— 这样"练卡"才有意义。
   球员上场时会把他那一档能拿到的徽章算好存进 p.badges。
   ============================================================= */
function SIGNATURE_BONUS(p, key) {
  const t = p.badges ? p.badges[key] : null;
  if (t === 'gold') return 0.10;
  if (t === 'silver') return 0.06;
  if (t === 'bronze') return 0.03;
  return 0;
}
/** 取某枚徽章的档位系数：金 1 / 银 0.66 / 铜 0.33 / 无 0 */
function badgeLv(p, key) {
  const t = p.badges ? p.badges[key] : null;
  return t === 'gold' ? 1 : t === 'silver' ? 0.66 : t === 'bronze' ? 0.33 : 0;
}

/* 进攻手段 key → 徽章通道名 */
const ATK_FX_CH = {
  three: 'on_three', mid: 'on_mid', layup: 'on_layup',
  driveDunk: 'on_dunk', postControl: 'on_post', floater: 'on_floater',
};

function attackValue(p, type, team, opts) {
  /* ★ v9.30：上篮用 close、扣篮用 standDunk 参与判定（原来完全没用）
     · 上篮：layup 0.65 + close 0.35 —— 区分"突破上篮"与"篮下放篮"
     · 扣篮：driveDunk 0.65 + standDunk 0.35 —— 区分"空接"与"原地起"
     · 对抗：strength 与防守人的 strength 差值 → 小幅修正命中
     · 接球：有助攻时 catch 参与（接不住球 → 命中略降） */
  let a2 = p.attrs[type.key] || 60;
  if (type.key === 'layup') a2 = (p.attrs.layup || 60) * 0.65 + (p.attrs.close || 60) * 0.35;
  if (type.key === 'driveDunk') a2 = (p.attrs.driveDunk || 60) * 0.65 + (p.attrs.standDunk || 60) * 0.35;
  if (type.key === 'postControl') a2 = (p.attrs.postControl || 60) * 0.7 + (p.attrs.postHook || 60) * 0.3;
  /* ★ v9.30：徽章加成改走登记表（badge-fx.js）。
     原来只有 SIGNATURE_BONUS(p, type.key) 这一条通道 —— 也就是
     "同名的属性徽章"生效；combo 徽章（海报扣将/死角猎手/无限射程…）完全没有出口。
     现在 p.fx 已经把所有通道预计算好了，这里按当前出手手段取对应通道。
     加成与 tacticHit 是**相乘**关系（见下面 pRaw 的 shotFx）。 */
  const sig = SIGNATURE_BONUS(p, type.key);
  /* 条件类徽章需要按**当前情境**求和，所以这里用徽章表现算一次；
     静态部分（无情境的徽章）已在 p.fx 里预计算，两者取"含情境的完整值"。
     为性能考虑：只有当这名球员真的有条件类徽章时才现算。 */
  let chBonus = (p.fx && p.fx.has) ? (p.fx[ATK_FX_CH[type.key]] || 0) : 0;
  if (p.badges && p.ctx && typeof badgeChOf === 'function') {
    chBonus = badgeChOf(p.badges, ATK_FX_CH[type.key], p.ctx);
  }
  const shotFx = capBadgeBonus(chBonus + sig, BADGE_FX_RULE.OFF_CAP);
  const form = (team && typeof team.form === 'number') ? team.form : 1;
  const sw = (team && team.swing) || 1;
  /* ★ v9.30：对抗修正 —— strength 参与背身/突破/篮下（原来完全没用）。
     只在"有身体接触"的手段上生效，跳投不受影响（这才是真实篮球）。 */
  let strAdj = 0;
  if (opts && opts.dfd && (type.tag === 'inside' || type.tag === 'post')) {
    strAdj = clamp(((p.attrs.strength || 70) - (opts.dfd.attrs.strength || 70)) * 0.0012, -0.06, 0.06);
  }
  let v = a2 * (1 + shotFx) * (1 + strAdj) * staminaFactor(p) * (1 + p.hot * 0.012) * form * rnd(0.76, 1.24);
  /* ---- 精神类徽章对进攻的影响 ---- */
  // 领袖：在场时全队进攻都受益（这里算的是"队友有没有领袖"）
  v *= 1 + (team && team.leaderBonus ? team.leaderBonus : 0);
  // 专注：不被对手的势头带跑（抵消一部分负面势头）
  if (team && team.momentum < 0) {
    v *= 1 - Math.abs(team.momentum) * 0.008 * (1 - badgeLv(p, 'focus'));
  }
  // 恶汉：对抗更凶，进攻端更容易顶开防守
  v *= 1 + badgeLv(p, 'enforcer') * 0.035;
  // 纸面实力弱的一方"搏进攻"：有一成多概率手感爆发。
  // 只加在上尾，所以它是真的给了弱队一条活路，而不是单纯放大波动。
  if (sw > 1 && Math.random() < 0.17 * sw) v *= rnd(1.12, 1.62);
  return v;
}

function defendValue(p, type, team) {
  const d = p.attrs[type.vs] || 60;
  const DEF_FX_CH = { perimD: 'def_perim', intD: 'def_int', postD: 'def_post' };
  const SIG_DEF = SIGNATURE_BONUS(p, type.vs);
  const tac = team ? (DEF_TACTICS[team.def] || DEF_TACTICS.man) : DEF_TACTICS.man;
  const mul = tac.vs[type.vs] != null ? tac.vs[type.vs] : 1;
  const form = (team && typeof team.form === 'number') ? (2 - team.form) : 1;
  const sw = (team && team.swing) || 1;
  const relax = 1 + (sw - 1) * 0.10;   // 搏进攻的代价很小，否则爆发会被抵消掉
  /* ★ v9.30：防守徽章通道 + 盖帽（def_rim）/全能防守（def_all） */
  let dCh = (p.fx && p.fx.has)
    ? ((p.fx[DEF_FX_CH[type.vs]] || 0) + (p.fx.def_rim || 0) + (p.fx.def_all || 0)) : 0;
  if (p.badges && p.ctx && typeof badgeChOf === 'function') {
    dCh = badgeChOf(p.badges, DEF_FX_CH[type.vs], p.ctx)
      + badgeChOf(p.badges, 'def_rim', p.ctx)
      + badgeChOf(p.badges, 'def_all', p.ctx);
  }
  const defFx = capBadgeBonus(dCh + SIG_DEF, BADGE_FX_RULE.DEF_CAP);
  let dv = d * mul * (1 + defFx) * staminaFactor(p) * form * rnd(0.76, 1.24) / relax;
  dv *= 1 + badgeLv(p, 'enforcer') * 0.03;          // 恶汉：防守也更硬
  /* ★ 透支惩罚（v9.29）：体力低于 FA.TIP 时"腿跟不上脑子"——
     防守选位失灵，被针对时更容易失分。这是"透支"区别于"能力下滑"的地方：
     低体力只是让你投不准，透支是让你**防不住**。 */
  if (typeof isGassed === 'function' && isGassed(p)) dv *= 0.90;
  // 时刻技能「铜墙铁壁」：对手在他的防守下命中 −7%
  if (p.momentSkill && p.momentSkill.key === 'iron_wall') dv *= 1.07;
  return dv;
}

/**
 * 抢篮板：按篮板能力加权抽签，而不是固定给最强的那个人。
 * 之前是 sort 取第一，结果一个人一场能抢 39 个板，数据完全失真。
 */
/* =============================================================
   篮板争夺（v9.30 重做）
   -------------------------------------------------------------
   原来只有：主属性 × 0.7 + boxout × 0.3 + 身高。
   两个问题：
     ① boxout / hustle / vertical 都是"死属性"或没有徽章出口
     ② 篮板类徽章（篮板猎手/卡位大师/篮板铁人/空中霸主…共 9 枚）
        完全没有出口 —— 练出"篮板铁人"金徽章，抢板概率一点不变

   现在按位置分组加权：
     进攻篮板 → oreb（主）+ boxout（卡位）+ hustle（拼抢）+ vertical（弹跳）
     防守篮板 → dreb（主）+ boxout + strength（顶人）+ vertical
   再乘上对应通道的徽章加成（reb_off / reb_def / vert / str）。
   ============================================================= */
function pickRebounder(team, key) {
  const pool = team.players;
  const isOff = key === 'oreb';
  const w = pool.map((p) => {
    const A = p.attrs;
    const main = A[key] || 50;
    /* 副属性按攻/防分档：抢前场板更靠拼劲与弹跳，守后场板更靠顶人与卡位 */
    const sub = isOff
      ? (A.boxout || 50) * 0.18 + (A.hustle || 50) * 0.14 + (A.vertical || 50) * 0.10
      : (A.boxout || 50) * 0.18 + (A.strength || 50) * 0.14 + (A.vertical || 50) * 0.08;
    let v = main * 0.58 + sub;
    /* 徽章通道 */
    if (p.fx && p.fx.has && typeof badgeChOf === 'function' && p.badges) {
      const ch = isOff ? 'reb_off' : 'reb_def';
      const b = badgeChOf(p.badges, ch, p.ctx)
        + badgeChOf(p.badges, 'vert', p.ctx)
        + (isOff ? badgeChOf(p.badges, 'str', p.ctx) * 0.5 : badgeChOf(p.badges, 'str', p.ctx));
      v *= (1 + b);
    }
    // 身高也影响：内线卡位更容易拿到板
    const hb = 1 + clamp((p.card.height - 195) / 100, -0.25, 0.35);
    return Math.max(1, (v - 40) * hb * (0.6 + Math.random() * 0.8));
  });
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** 选一个进攻球员：能力越高、体力越足、越可能拿球 */
function chooseAttacker(team) {
  const live = team.players.filter((p) => p.stamina.cur > 12);
  if (!live.length) return team.players[0];
  const w = live.map((p) => {
    const off = (p.attrs.three + p.attrs.mid + p.attrs.layup + p.attrs.driveDunk) / 4;
    return Math.max(1, off * staminaFactor(p) * (1 + p.hot * 0.02) - 45);
  });
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < live.length; i++) { r -= w[i]; if (r <= 0) return live[i]; }
  return live[live.length - 1];
}
/** 选一个进攻手段：看这名球员的偏好 + 场上形势 */
function chooseType(att, team, opp, quarter) {
  const taste = POS_TASTE[att.pos] || POS_TASTE.SF;
  const tac = OFF_TACTICS[team.off] || OFF_TACTICS.balanced;
  const behind = team.score - opp.score;
  const late = quarter >= 3;
  /* =============================================================
     出战手段权重（v9.30：把 4 项"死属性"接上）
     -------------------------------------------------------------
     原来只用 attrs[t.key]（three/mid/layup/driveDunk/postControl/floater）。
     现在补进：
       · 上篮 → close（近框终结）参与加权，区分"突破上篮"和"篮下放篮"
       · 扣篮 → standDunk（原地重炮）参与加权，区分"空接"和"原地起"
       · 突破 → onBallSpeed（持球推进）越高越爱突
       · 造犯规倾向 → drawFoul 越高越爱冲击篮下（造罚球）
     这样这 4 项能力值第一次真正影响"球员怎么打球"。
     ============================================================= */
  const A = att.attrs;
  const driveTaste = 0.85 + (A.onBallSpeed || 70) / 70 * 0.30;   // 0.85~1.15
  const foulTaste = 0.85 + (A.drawFoul || 70) / 70 * 0.30;
  const w = ATK_TYPES.map((t) => {
    let x = taste[t.tag === 'three' ? 'three' : t.key] || 1;
    let base = A[t.key] || 50;
    if (t.key === 'layup') base = (A.layup || 50) * 0.7 + (A.close || 50) * 0.3;
    if (t.key === 'driveDunk') base = (A.driveDunk || 50) * 0.7 + (A.standDunk || 50) * 0.3;
    x *= 0.5 + base / 70;
    x *= (tac.w[t.key] != null ? tac.w[t.key] : 1);        // 战术权重
    if (t.key === 'layup' || t.key === 'driveDunk') x *= driveTaste * foulTaste;
    if (t.key === 'three') x *= 0.9 + (A.offBallSpeed || 70) / 70 * 0.20;
    if (t.pts === 3 && behind < -6 && late) x *= 1.9;      // 落后且末节 → 抢三分
    if (t.pts === 2 && behind > 8 && late) x *= 0.7;       // 领先 → 稳一点
    return Math.max(0.02, x);
  });
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < ATK_TYPES.length; i++) { r -= w[i]; if (r <= 0) return ATK_TYPES[i]; }
  return ATK_TYPES[1];
}

/* =============================================================
   🎯 针对疲劳对位（v9.29）
   -------------------------------------------------------------
   这是让「疲劳」真正影响**比赛走势**而不只是数值的那一环。

   原来的出手选择完全看不到防守人是谁（chooseType 先跑、chooseDefender 后跑），
   所以"对面那个人已经累瘫了"这件事在战术上没有任何意义。

   现在选完防守人之后再看一眼：
     · 对位人体力 < TIP（透支）→ 往他防不住的那一侧打，权重 ×1.25
     · 对位人体力 < DIP（已下滑）→ 温和针对，权重 ×1.10
   —— 于是"把对手主力耗干"从一句空话变成可执行的比赛计划：
      跑轰拖体能 → 对面主力透支 → 你的进攻自动往他身上打。
   ============================================================= */
function retargetByFatigue(type, dfd) {
  if (!dfd || !dfd.stamina) return type;
  const cfg = (typeof FA !== 'undefined') ? FA : { DIP: 0.60, TIP: 0.30 };
  const ratio = dfd.stamina.cur / dfd.stamina.max;
  if (ratio >= cfg.DIP) return type;
  const gassed = ratio < cfg.TIP;
  const key = type.vs;                       // 这一球考验的防守项
  const weak = (dfd.attrs[key] || 50) <= 72; // 他这项防守本来就一般
  if (!gassed && !weak) return type;
  /* 用同一套权重逻辑重挑一次，但把"打他弱点"放大 */
  const taste = POS_TASTE[dfd.pos] || POS_TASTE.SF;
  const mul = (t) => {
    let x = (t.vs === key) ? (gassed ? 1.25 : 1.10) : 1;
    return x;
  };
  const w = ATK_TYPES.map((t) => Math.max(0.02, mul(t)));
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < ATK_TYPES.length; i++) { r -= w[i]; if (r <= 0) return ATK_TYPES[i]; }
  return type;
}
/** 防守方派谁防：内线手段用内线，外线手段用外线 */
function chooseDefender(defTeam, type) {
  const live = defTeam.players.filter((p) => p.stamina.cur > 12);
  const pool = live.length ? live : defTeam.players;
  const key = type.vs;
  return pool.slice().sort((a, b) => {
    const va = (a.attrs[key] || 50) * staminaFactor(a) * rnd(0.92, 1.08);
    const vb = (b.attrs[key] || 50) * staminaFactor(b) * rnd(0.92, 1.08);
    return vb - va;
  })[0];
}

/**
 * 打一个回合。返回事件对象（给解说和 UI 用）
 */
function playPossession(off, def, quarter, round, isClutch) {
  const att = chooseAttacker(off);
  let type = chooseType(att, off, def, quarter);
  const dfd = chooseDefender(def, type);
  /* 🎯 看到对位人之后再决定打哪 —— 针对累垮的防守者（v9.29） */
  if (typeof retargetByFatigue === 'function') type = retargetByFatigue(type, dfd);

  /* =============================================================
     🏷️ 情境标记（v9.30）
     -------------------------------------------------------------
     条件类徽章（死角猎手/无限射程/底角专家/快攻发动机/补扣专家…）
     需要知道"这一球是什么情境"才能决定生不生效。
     这里在判定前把情境打到 att.ctx 上，attackValue 读它。
     ============================================================= */
  (function tagContext() {
    const set = {};
    /* 贴身干扰：对位人的这项防守明显高于我方进攻能力 */
    const dvKey = type.vs;
    if ((dfd.attrs[dvKey] || 0) >= (att.attrs[type.key] || 0) + 4) set.tight = 1;
    /* 超远三分：三分且投篮能力偏高（射手被放得远） */
    if (type.key === 'three' && (att.attrs.three || 0) >= 92) set.deep = 1;
    /* 底角：三分 + 该球员位置偏侧翼/内线（借位置近似） */
    if (type.key === 'three' && (att.pos === 'SF' || att.pos === 'PF' || att.pos === 'SG')) set.corner = 1;
    /* 快攻：跑轰战术下的出手 */
    if ((OFF_TACTICS[off.off] || {}).pace < 0.8) set.fastbreak = 1;
    /* 背身要位 */
    if (type.key === 'postControl' || type.tag === 'post') set.post = 1;
    /* 篮下强起 */
    if (type.tag === 'inside') set.rim = 1;
    /* 关键时段 / 垃圾时间 */
    if (isClutch) set.clutch = 1;
    if (Math.abs(off.score - def.score) >= 20) set.garbage = 1;
    att.ctx = set;
    dfd.ctx = set;
  })();

  const av = attackValue(att, type, off, { dfd });
  const dv = defendValue(dfd, type, def);
  // 势头：连得分的一方越打越顺，被连打的会手冷
  const momBonus = (off.momentum || 0) * 2.6 - (def.momentum || 0) * 1.8;
  /* ★ 必须是 let：下面关键时刻会追加「关键先生」徽章的命中修正。
     原来写成 const，导致第四节最后两分钟分差接近时抛
     "Assignment to constant variable" —— 表现就是"扫荡到关键时刻必崩"。 */
  let diff = softCap(av - dv, 30) + momBonus;
  // 战术克制：直接加在命中率上
  const tacBonus = counterBonus(off.off, def.def);
  // 战术熟练度：同一套战术用得多会有额外加成（最多 +6%）
  const mastery = (typeof tacMasteryOff === 'function')
    ? tacMasteryOff(off.off) * 100 : 0;
  /* ---- 时刻卡专属技能 ---- */
  let skillBonus = 0;
  if (typeof teamAuraBonus === 'function') skillBonus += teamAuraBonus(off) / 100;
  const msk = att.momentSkill;
  if (msk) {
    if (msk.key === 'clutch_king' && isClutch) skillBonus += 0.12;
    if (msk.key === 'unstoppable' &&
        (type.key === 'postControl' || type.key === 'mid' || type.key === 'postFade')) {
      skillBonus += 0.08;
    }
    if (msk.key === 'hot_streak' && (att.hot || 0) >= 2) skillBonus += 0.07;
    if (msk.key === 'big_heart' && isClutch &&
        (type.key === 'three' || type.key === 'ft')) skillBonus += 0.06;
  }

  const offTac2 = OFF_TACTICS[off.off] || OFF_TACTICS.balanced;
  // 记一次战术使用，累积熟练度（只记玩家的队）
  if (typeof tacBump === 'function' && off === (BT && BT.myTeam)) {
    try { tacBump(off.off, def.def); } catch (e) {}
  }
  // 进攻端与防守端分开算：不知疲倦只降防守端消耗
  /* 消耗系数说明：
     一场约 85 回合，每回合 1 攻 1 守共 2 人参与，
     所以每人平均参与 ~34 回合。乘数取 4.2 时约掉 45~55 点，
     再算上节间恢复，全场打完主力大致剩 55%~65%，
     正好形成"该换人了"的压力。 */
  /* =============================================================
     体力消耗模型（v9.29 重做）
     -------------------------------------------------------------
     ★ 为什么重做：原来的公式是 `drain × 4.2`，标定下来一场只掉
       ~20 点，首发终场还剩 84% —— 而 staminaFactor() 要**低于 60%**
       才开始扣能力。结果整条疲劳链是断的：
         · 疲劳对比赛能力的影响 ≈ 0
         · 40% 的自动换人阈值从不触发 → 替补 7 人整场参与 0 次
         · 轮换、战术、球员搭配全都无从影响比赛

     ★ 新模型分三个因子：
       ① 位置与球风基础耗（drain / drainDef，来自体能属性 + 徽章）
       ② 这一次进攻的"费力程度"（背身/突破比定点三分累得多）
       ③ 攻防节奏（OWN_PACE 管自己进攻耗，OPP_PACE 管自己防守耗）
          —— ③ 是让"战术"真正咬进体力经济的关键：
             你打跑轰 → 你自己更累；**对手打跑轰 → 你的防守更累**。
             所以跑轰是"用体能压制对手"的战术，克制它要靠轮换深度。

     ★ 标定目标（见 tools 里的体力标定脚本）：
         首发最累者终场落在 50~60%，约 70% 的比赛会跌破 60%
         （即能力开始受影响），约 5~10% 的比赛跌破 40%（触发换人）。
     ============================================================= */
  /* ② 动作费力系数：越靠内线、越对抗越费体力 */
  const EFFORT = {
    three: 0.85, mid: 1.00, floater: 1.05,
    layup: 1.15, driveDunk: 1.35, postControl: 1.45,
  };
  const eff = EFFORT[type.key] || 1.0;
  /* ③ 战术节奏 —— 「战术」真正咬进体力经济的地方
     ------------------------------------------------------------
     ⚠️ OFF_TACTICS 的 `pace` 语义是**反的**：0.6 = 回合更快（跑轰）。
        跑轰那套的 UI 提示就写着「回合数 +60%」。
        所以"每回合消耗"要用 (2 - pace)：
          跑轰 (2-0.6)=1.4 → 每回合更累 ✓
          平衡 (2-1.0)=1.0 → 基准
          内线 (2-0.95)=1.05 → 略累
        （v9.29 第一版直接把 pace 当乘数用，结果跑轰反而更省 —— 方向反了。）

     另一个因子是战术自带的 `stamina` 系数（跑轰 1.5 = 体能消耗大），
     这个字段**原来定义了却从来没被读取过**，现在把它接上。

     组合起来：
       自己打跑轰 → 自己进攻每回合 ×1.4 ×1.5（真的累）
       对手打跑轰 → **我的防守**每回合 ×1.4 ×1.5（被拖体能）
     —— 于是"跑轰"是一个用体能压制对手的战术，
        而克制它的办法是轮换深度 + 硬汉/铁人类徽章。 */
  const offTacOf = (t) => OFF_TACTICS[t] || OFF_TACTICS.balanced;
  const ownT = offTacOf(off.off), oppT = offTacOf(def.off);
  const ownPaceCost = (2 - (ownT.pace || 1)) * (ownT.stamina || 1);
  const oppPaceCost = (2 - (oppT.pace || 1)) * (oppT.stamina || 1);
  const FAK = (typeof FA !== 'undefined') ? FA : { DRAIN_ATK: 12.3, DRAIN_DEF: 9.2 };
  att.stamina.cur = Math.max(0,
    att.stamina.cur - att.stamina.drain * FAK.DRAIN_ATK * eff * ownPaceCost);
  dfd.stamina.cur = Math.max(0,
    dfd.stamina.cur - (dfd.stamina.drainDef || dfd.stamina.drain)
      * FAK.DRAIN_DEF * (0.9 + 0.1 * eff) * oppPaceCost);
  att.stat.fga++;
  if (type.pts === 3) att.stat.tpa++;

  const ev = { quarter, round, att, dfd, type, off, def, isClutch, pops: [] };
  const pop = (pl, text, cls) => ev.pops.push({ pid: pl.id, text, cls });

  // ---------- ① 失误 / 抢断 ----------
  const defTac = DEF_TACTICS[def.def] || DEF_TACTICS.man;
  const offTac3 = OFF_TACTICS[off.off] || OFF_TACTICS.balanced;
  /* ★ v9.30：失误率接入徽章
     · 护球类（过人如麻/不可抢断/铁腕/控球大师/保命传球）→ 降低失误率
       —— 这几枚原来在战斗里完全没有出口
     · 抢断类（抢断专家/传球拦截者/抄球专家/铁手套…）→ 提高"被断"而非
       "普通失误"的比例：失误总数不变，但抢断数据归谁变了 ——
       这正是现实中抢断高手的价值。 */
  const holdFx = (att.fx && att.fx.has)
    ? (typeof badgeChOf === 'function' && att.badges
      ? badgeChOf(att.badges, 'tpg', att.ctx) : (att.fx.tpg || 0))
    : 0;
  let toRisk = clamp((0.085 - (att.attrs.handle - 70) * 0.0012
    + (dfd.attrs.steal - 70) * 0.0009) * defTac.stealMul * (offTac3.toMul || 1),
    0.015, 0.24);
  toRisk = clamp(toRisk * (1 - holdFx), 0.008, 0.24);
  const stealFx = (dfd.fx && dfd.fx.has)
    ? (typeof badgeChOf === 'function' && dfd.badges
      ? badgeChOf(dfd.badges, 'steal', dfd.ctx) : (dfd.fx.steal || 0))
    : 0;
  if (Math.random() < toRisk) {
    const isSteal = Math.random() < clamp(0.62 * (1 + stealFx), 0.30, 0.92);
    att.stat.to++;
    if (isSteal) dfd.stat.stl++;
    ev.kind = isSteal ? 'steal' : 'turnover';
    ev.pts = 0;
    ev.spokenBy = isSteal ? dfd : att;
    if (isSteal) { pop(dfd, '抢断 +1', 'stl'); att.streak = 0; }
    else pop(att, '失误', 'to');
    return ev;
  }

  // ---------- ② 封盖 ----------
  /* ★ v9.30：封盖接入 vertical（弹跳）—— 原来只看 block，弹跳怪完全没用。
     def_rim 通道（盖帽弹簧等）也已算进 dv，这里再乘一次弹跳修正。 */
  const vertAdj = (typeof isGassed === 'function' && isGassed(dfd)) ? 0.88 : 1;
  const blockRisk = clamp((dv - av) * 0.0045 - 0.02, 0, 0.20)
    * (type.tag === 'inside' ? 1.5 : type.tag === 'post' ? 1.2 : 0.55)
    * (0.85 + (dfd.attrs.vertical || 70) / 70 * 0.30) * vertAdj;
  if (Math.random() < blockRisk) {
    dfd.stat.blk++;
    // ---- 盖帽细分：抓帽 / 大火锅 / 钉板 ----
    const blkGap = (dfd.attrs.block || 70)
      - Math.max(att.attrs.layup || 70, att.attrs.driveDunk || 70);
    if ((dfd.attrs.block || 0) >= 92 && blkGap >= 8 && Math.random() < 0.62) {
      ev.kind = 'rejection';                    // 大火锅：封盖能力明显压制
    } else if ((dfd.attrs.block || 0) >= 88 && Math.random() < 0.38) {
      ev.kind = 'snatch';                       // 抓帽：单手把球抓下来
    } else if (Math.random() < 0.22) {
      ev.kind = 'pin';                          // 钉板大帽
    } else {
      ev.kind = 'block';
    }
    ev.blocker = dfd.id;
    ev.pts = 0;
    ev.spokenBy = dfd;
    pop(dfd, '盖帽 +1', 'blk');
    pop(att, '被盖', 'to');
    ev.shake = att.id;                     // 被盖的人卡面抖一下
    att.streak = 0;
    return ev;
  }

  // ---------- ③ 造犯规罚球 ----------
  /* ★ v9.30：造犯规接入 · drawFoul 徽章通道 · strength（强吃篮下更容易造到） */
  const foulFx = (att.fx && att.fx.has)
    ? (typeof badgeChOf === 'function' && att.badges
      ? badgeChOf(att.badges, 'foul_draw', att.ctx) : (att.fx.foul_draw || 0))
    : 0;
  const strGap = ((att.attrs.strength || 70) - (dfd.attrs.strength || 70)) * 0.0008;
  const foulRisk = clamp((0.05 + (att.attrs.drawFoul - 70) * 0.0016
    - (dfd.attrs.postD - 70) * 0.0006 + strGap) * (1 + foulFx)
    * defTac.foulMul * (offTac3.drawFoulMul || 1),
    0.02, 0.22);
  if (Math.random() < foulRisk) {
    const ft = att.attrs.ft || 70;
    /* 罚球命中率：
       基础 42% + 罚球属性；再叠加「罚球机器」徽章；
       关键球时刻「大心脏」徽章额外生效（压力越大越准）。 */
    let rate = 0.42 + ft * 0.0045;
    rate += badgeLv(att, 'ft') * 0.035;                 // 罚球机器
    if (isClutch) rate += badgeLv(att, 'ice') * 0.075;  // 大心脏
    rate = clamp(rate, 0.45, 0.97);
    let made = 0;
    for (let i = 0; i < 2; i++) if (Math.random() < rate) made++;
    dfd.stat.pf++;
    att.stat.pts += made;
    off.score += made;
    if (made) { att.hot = Math.min(6, att.hot + 1); } else { att.hot = 0; }
    ev.kind = made ? 'freethrow' : 'ftMiss';
    ev.pts = made;
    ev.made = made;
    ev.spokenBy = made ? att : null;
    if (made) pop(att, `罚球 +${made}`, 'ft');
    return ev;
  }

  // ---------- ④ 正常出手 ----------
  const tac = OFF_TACTICS[off.off] || OFF_TACTICS.balanced;
  const tacticHit = tac.hit[type.key] || 0;
  // 每 1 点能力差只折算 0.62% 命中率。
  // 之前用 1.15%，结果 7 点差距就被放大成 26 分血洗，太"数值决定论"了。
  const pRaw = type.base + diff * 0.0062 + tacBonus + tacticHit + mastery
    + skillBonus * 100
    + (isClutch ? -0.03 : 0) + rnd(-0.085, 0.085);
  // 关键先生：第四节最后两分钟命中率大幅提升
  if (isClutch) diff += badgeLv(att, 'clutchGene') * 6.5;
  const p = clamp(pRaw, 0.05, 0.92);
  if (Math.random() < p) {
    att.stat.fgm++;
    if (type.pts === 3) att.stat.tpm++;
    att.stat.pts += type.pts;
    off.score += type.pts;
    att.hot = Math.min(6, att.hot + 1);
    dfd.hot = 0;
    // 助攻：按队友的传球能力加权，越会传的越可能拿到这次助攻
    const mates = off.players.filter((p2) => p2 !== att);
    /* ★ v9.30：助攻转化率接入传球类徽章（传球大师/连线专家/二次助攻…）
       原来只有固定 0.58 概率，那 10 枚组织徽章完全没有出口。 */
    const astW = mates.map((p2) => {
      const pb = (p2.fx && p2.fx.has)
        ? (typeof badgeChOf === 'function' && p2.badges
          ? badgeChOf(p2.badges, 'ast', p2.ctx) : (p2.fx.ast || 0))
        : 0;
      return Math.max(1, ((p2.attrs.pass || 50) - 35) * (1 + pb));
    });
    const astTot = astW.reduce((a2, b2) => a2 + b2, 0);
    const astBase = clamp(0.58 * (1 + (att.fx && att.fx.has
      ? (typeof badgeChOf === 'function' && att.badges
        ? badgeChOf(att.badges, 'ast', att.ctx) : (att.fx.ast || 0)) : 0)), 0.20, 0.85);
    if (astTot > 0 && Math.random() < astBase) {
      let rr = Math.random() * astTot;
      for (let i2 = 0; i2 < mates.length; i2++) {
        rr -= astW[i2];
        if (rr <= 0) {
          mates[i2].stat.ast++;
          ev.assist = mates[i2];
          pop(mates[i2], '助攻 +1', 'ast');
          break;
        }
      }
    }
    ev.kind = type.pts === 3 ? 'made3' : type.tag === 'inside' ? 'madeInside'
      : type.tag === 'post' ? 'madePost' : 'made2';
    // ---- 细分花样：隔扣 / 过人 / 篮下强吃 ----
    if (type.key === 'driveDunk') {
      // 隔扣：扣篮时防守人就在面前，按双方内线能力决定概率
      const posterP = clamp(0.42 - (dfd.attrs.intD - 82) * 0.007
        + (att.attrs.driveDunk - 85) * 0.004, 0.10, 0.62);
      if (Math.random() < posterP) { ev.kind = 'poster'; ev.poster = dfd.id; }
      else if (Math.random() < 0.30) ev.kind = 'dunk';
    } else if (type.key === 'layup' || type.key === 'floater') {
      // 过人：速度快、控球好的球员更容易晃开防守
      const crossP = clamp(0.20 + ((att.attrs.onBallSpeed || 75) - 80) * 0.006
        + ((att.attrs.handle || 75) - 80) * 0.005, 0.06, 0.55);
      if (Math.random() < crossP) { ev.kind = 'crossover'; ev.ankle = dfd.id; }
    } else if (type.key === 'postControl') {
      if (Math.random() < 0.28) ev.kind = 'posterize';
    }
    ev.pts = type.pts;
    ev.spokenBy = att;
    pop(att, `+${type.pts}`, type.pts === 3 ? 'p3' : 'p2');
    if (type.tag === 'inside' && type.key === 'driveDunk') ev.slam = att.id;
    // 连击计数
    att.streak = (att.streak || 0) + 1;
    att.streakPts = (att.streakPts || 0) + type.pts;
    if (att.streak >= 2) {
      const tier = att.streak >= 4 ? 4 : att.streak >= 3 ? 3 : 2;
      ev.streak = { pid: att.id, name: att.name, n: att.streak,
        pts: att.streakPts, line: pickR(TRASH[tier]), mine: ev.mine };
      if (att.streak >= 3 && ev.mine) Sfx.reveal('momentGold');
    }
    return ev;
  }

  // ---------- ⑤ 不中 + 前场篮板 ----------
  att.hot = Math.max(-3, att.hot - 1);
  att.streak = 0; att.streakPts = 0;
  ev.kind = 'miss';
  ev.pts = 0;
  const offT = OFF_TACTICS[off.off] || OFF_TACTICS.balanced;
  const defT = DEF_TACTICS[def.def] || DEF_TACTICS.man;
  const oreb = (att.attrs.oreb || 50) * (offT.orebMul || 1);
  const dreb = (dfd.attrs.dreb || 60) * (defT.drebMul || 1);
  if (Math.random() < clamp(0.20 + (oreb - dreb) * 0.0035, 0.06, 0.46)) {
    ev.rebound = true;
    const rb = pickRebounder(off, 'oreb');
    rb.stat.reb++;
    ev.rebounder = rb;
    ev.spokenBy = rb;
    pop(rb, '篮板 +1', 'reb');
  } else {
    const rb2 = pickRebounder(def, 'dreb');
    rb2.stat.reb++;
    pop(rb2, '篮板 +1', 'reb');
  }
  return ev;
}

/* =============================================================
   一整场比赛
   ============================================================= */
const QUARTERS = 4, ROUNDS_PER_Q = 6;

function simulateGame(myTeam, aiTeam, onEvent) {
  const log = [];
  let possession = Math.random() < 0.5 ? 0 : 1;   // 0=我方先攻
  for (let q = 0; q < QUARTERS; q++) {
    let myQ = 0, aiQ = 0;
    for (let r = 0; r < ROUNDS_PER_Q; r++) {
      const clutch = (q === QUARTERS - 1 && r >= ROUNDS_PER_Q - 2
        && Math.abs(myTeam.score - aiTeam.score) <= 6);
      /* 这一个回合（两次进攻）里参与过攻防的球员 —— 他们不回体力。
         ★ 原来这里写的是 `if (ev && ev.att)`，但 ev 是**上面 for 里的
           const**，出了循环就没了作用域 → 一旦有人调用 simulateGame()
           就抛 ReferenceError: ev is not defined。
           （原始 v9.25 就有这个 bug；因为正式比赛不走 simulateGame，
            所以一直没暴露。这里改成在循环内收集参与者的 id。） */
      const played = {};
      for (let k = 0; k < 2; k++) {
        const mine = (possession + k) % 2 === 0;
        const off = mine ? myTeam : aiTeam;
        const def = mine ? aiTeam : myTeam;
        const ev = playPossession(off, def, q, r, clutch);
        ev.mine = mine;
        log.push(ev);
        if (ev.att) played[ev.att.id] = 1;
        if (ev.dfd) played[ev.dfd.id] = 1;
        if (onEvent) onEvent(ev);
      }
      // 参与的球员不回体力，其余小幅恢复
      const inv2 = played;
      [myTeam, aiTeam].forEach((t) => t.players.forEach((p) => {
        if (inv2[p.id]) return;
        p.stamina.cur = Math.min(p.stamina.max, p.stamina.cur + 0.15);
      }));
    }
    myTeam.quarterScores.push(myQ);
    aiTeam.quarterScores.push(aiQ);
  }
  return log;
}

/* =============================================================
   对手
   ============================================================= */


/* =============================================================
   对战界面
   ============================================================= */
let BT = { phase: 'setup', myTeam: null, aiTeam: null, log: [], idx: 0,
  timer: null, speed: 900, lastEvent: null,
  oppTeam: 'lal' };      // 默认对手：洛杉矶湖人

function lineupIds() { return rosterIds(); }

/**
 * 阵容槽位：直接用完整卡面（和抽到的卡长得一模一样），
 * 左上角盖一个位置徽章，点一下就能换人。
 */
function slotHTML(id, pos, i, kind) {
  if (!id) {
    return `<button class="bt-slot empty" data-slot="${kind}:${i}">
      <span class="bt-slot-pos">${pos || '替补'}</span>
      <i>＋ 点击选人</i></button>`;
  }
  const st = battleStats(id);
  if (!st) return '';
  const posBadge = kind === 'starters' ? SLOT_POS[i] : st.card.pos;
  return `<div class="bt-slot${kind === 'starters' ? ' starter' : ''}" data-slot="${kind}:${i}">
    <div class="bt-slot-face">${cardHTML(st.card, {})}</div>
    <span class="bt-slot-pos">${posBadge}</span>
    <button class="bt-slot-edit" data-slot="${kind}:${i}">换</button>
  </div>`;
}

/**
 * 球队管理：中间是场上的 5 个位置（按控卫→中锋排布），
 * 下面是"备用名单"（我拥有的球员）。
 * 先点中间的位置槽，再点下面的球员，就换上去了。
 */
let tmSlot = null;          // 当前激活的位置槽索引
let tmFilter = 'ALL';       // 备用名单的位置筛选
let tmScrollTop = false;    // 翻页后把列表滚回顶部
let tmPage = 0;             // 分页

const SLOT_CN = { PG: '控球后卫', SG: '得分后卫', SF: '小前锋', PF: '大前锋', C: '中锋' };
// 每页 6 人（横版 2 列 × 3 行），卡片更大，不滚动，纯翻页
const PER_PAGE = 6;

function renderRoster() {
  /* 阵容一变，之前那张"冲突提示"就该失效 ——
     比如玩家把重复的那名球员拿下了，弹窗要自己消失。 */
  if (typeof closeConflictDialog === 'function') closeConflictDialog(); renderTeamSys(); }

/**
 * 独立的球队管理系统（顶栏「球队」标签页）。
 * 和对战系统共享同一份 S.roster / S.offTac / S.defTac，改完立刻生效。
 */
let tmTab = 'lineup';
function renderTeamSys() {
    /* 新版球队管理（1:1 复刻 2K MyTeam 阵容页）在 teamui.js 里。
       留个开关，出问题时可以回退旧版：window.__oldTeamUI = true */
    if (typeof renderTeamUI === 'function' && !window.__oldTeamUI) {
      return renderTeamUI();
    }
  const el = $('#scr-team');
  if (!el) return;
  const r = rosterIds();
  const all = r.starters.concat(r.bench);
  const onCourt = r.starters;

  // 备用名单：所有拥有的卡，排除已经在这 12 人名单里的
  const allIds = new Set(all);
  let pool = ownedByOvr().filter((c) => !allIds.has(c.id));
  if (tmFilter !== 'ALL') {
    pool = pool.filter((c) => c.pos === tmFilter || c.pos2 === tmFilter);
  }
  const pages = Math.max(1, Math.ceil(pool.length / PER_PAGE));
  if (tmPage >= pages) tmPage = pages - 1;
  const pageList = pool.slice(tmPage * PER_PAGE, tmPage * PER_PAGE + PER_PAGE);

  // 注意：卸下球员后 onCourt 里会有 null 空位，必须先过滤掉
  /* v9.1：工资按档位固定（银 800万 / 金 3000万 / 紫 4500万） */
  const caps = salarySumOf(onCourt.filter(Boolean));
  el.innerHTML = `<div class="tm">
    ${presetBarHTML()}
      <div class="tm-head">
      <div class="tm-head-l">
        <b>球 队 管 理</b>
        <span>${S.teamName || '我的球队'} · 综合 <i>${rosterOvr(onCourt)}</i>
          · ${all.length}/12 人 · 薪资 ${fmt(Math.round(caps))}</span>
      </div>
      <div class="tm-tabs">
        <button class="${tmTab === 'lineup' ? 'on' : ''}" data-tmtab="lineup">阵容</button>
        <button class="${tmTab === 'tactic' ? 'on' : ''}" data-tmtab="tactic">战术</button>
        <button class="${tmTab === 'info' ? 'on' : ''}" data-tmtab="info">球队</button>
      </div>
      <button id="tmRefill" class="mini" title="按综合评分自动补满阵容">自动补满</button>
      <button id="tmGo" class="ok">去对战</button>
    </div>

    <div class="tm-body">
      <!-- ============ 阵容 ============ -->
      <div class="tm-pane${tmTab === 'lineup' ? ' on' : ''}" data-pane="lineup">
        <div class="tm-court">
          <div class="tm-court-bg"></div>
          <div class="tm-row top">
            ${[2, 4, 3].map((i2) => tmSlotHTML(onCourt[i2], i2)).join('')}
          </div>
          <div class="tm-row bot">
            ${[0, 1].map((i2) => tmSlotHTML(onCourt[i2], i2)).join('')}
          </div>
          <div class="tm-benchline">
            <span class="tm-benchline-t">替 补 席 ${r.bench.length}/${ROSTER.bench}</span>
            <div class="tm-bench-row top">
              ${[0, 1].map((i2) => tmBenchSlotHTML(r.bench[i2], i2)).join('')}
            </div>
            <div class="tm-bench-row bot">
              ${[2, 3, 4].map((i2) => tmBenchSlotHTML(r.bench[i2], i2)).join('')}
            </div>
          </div>
        </div>

        <div class="tm-benchbar">
          <span class="tm-bench-t">可用球员 <i>${pool.length}</i></span>
          <span class="tm-sort">综合分从高到低 ↓</span>
          <div class="tm-filter">
            ${['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map((k) =>
              `<button class="${tmFilter === k ? 'on' : ''}" data-tmf="${k}">${
                k === 'ALL' ? '全部' : k}</button>`).join('')}
          </div>
        </div>

        <div class="tm-pool" id="tmPool">
          ${pageList.length ? pageList.map((c) => tmPoolCard(c)).join('')
            : '<div class="bt-none">这个位置没有其他球员了</div>'}
        </div>

        <div class="tm-pager${pages > 1 ? '' : ' solo'}">
          <button id="tmPrev" ${tmPage === 0 ? 'disabled' : ''}>◀</button>
          <div class="tm-pageinfo">
            <b>第 ${tmPage + 1} / ${pages} 页</b>
            <span>${pool.length ? (tmPage * PER_PAGE + 1) + '–' +
              Math.min(pool.length, (tmPage + 1) * PER_PAGE) + ' / 共 ' + pool.length + ' 人'
              : '没有符合条件的球员'}</span>
          </div>
          <button id="tmNext" ${tmPage >= pages - 1 ? 'disabled' : ''}>▶</button>
        </div>

        <div class="tm-tip">
          ${tmSlot == null
            ? '先点中间的<b>位置</b>，再点下面的球员，就能换上去了'
            : `已选中 <b>${SLOT_CN[SLOT_POS[tmSlot]]}</b>，点下面的球员放上去`}
        </div>
      </div>

      <!-- ============ 战术 ============ -->
      <div class="tm-pane${tmTab === 'info' ? ' on' : ''}" data-pane="info">
        <div class="tm-info">
          <div class="tm-info-hero">
            <div class="tm-info-name">${S.teamName || '我的球队'}</div>
            <div class="tm-info-ovr">${rosterOvr(onCourt)}</div>
            <div class="tm-info-sub">阵容综合分</div>
          </div>
          <div class="tm-info-grid">
            <div class="tm-info-cell"><span>名单</span><b>${all.length}/12</b></div>
            <div class="tm-info-cell"><span>战绩</span><b>${S.btWin || 0} 胜 ${S.btLose || 0} 负</b></div>
            <div class="tm-info-cell"><span>拥有卡</span><b>${Object.keys(S.owned).length} 张</b></div>
            <div class="tm-info-cell"><span>首发薪资</span><b>${fmt(Math.round(caps))}</b></div>
          </div>
          <div class="sec-title" style="margin-top:16px">首 发 五 人</div>
          <div class="tm-info-list">
            ${SLOT_POS.map((pos, i) => {
              const id = onCourt[i];
              if (!id) return `<div class="tm-info-row empty"><span>${pos}</span><i>空缺</i></div>`;
              const st = battleStats(id);
              return `<div class="tm-info-row" data-i="${i}">
                <span class="p">${pos}</span>
                <b>${st.card.name}</b>
                <i>突破 ${st.brk} · ${st.card.team}</i>
                <em>${st.ovr}</em>
              </div>`;
            }).join('')}
          </div>
          <div class="tm-info-tip">
            阵容和战术改完会<b>立刻生效</b>到对战系统 —— 两边共用同一份名单。
          </div>
        </div>
      </div>

      <div class="tm-pane${tmTab === 'tactic' ? ' on' : ''}" data-pane="tactic">
        <div class="sec-title">进 攻 战 术</div>
        <div class="bt-tacs">
          ${Object.values(OFF_TACTICS).map((t) => `
            <button class="bt-tac${S.offTac === t.key ? ' on' : ''}" data-off="${t.key}">
              <b>${t.name}</b><i>${t.desc}</i><span>${tacTags('off', t.key)}</span>
            </button>`).join('')}
        </div>
        <div class="sec-title" style="margin-top:16px">防 守 战 术</div>
        <div class="bt-tacs">
          ${Object.values(DEF_TACTICS).map((t) => `
            <button class="bt-tac${S.defTac === t.key ? ' on' : ''}" data-def="${t.key}">
              <b>${t.name}</b><i>${t.desc}</i><span>${tacTags('def', t.key)}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  const go = $('#tmGo');
  if (go) go.onclick = () => { Sfx.click(); switchTab('battle'); };
  const au = $('#tmAuto');
  if (au) au.onclick = () => {
    Sfx.click(); S.roster = autoLineup(); tmSlot = null; tmPage = 0;
    save(); renderTeamSys(); toast('已按综合分和位置自动排阵');
  };
  $$('.tm-tabs button', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); tmTab = b.dataset.tmtab; renderTeamSys(); };
  });
  // 点位置槽 → 激活（首发 0-4，替补 100+）
  $$('.tm-slot', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      const i2 = parseInt(b.dataset.i, 10);
      tmSlot = tmSlot === i2 ? null : i2;
      renderRoster();
    };
  });
  $$('.tm-bslot', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      const i2 = 100 + parseInt(b.dataset.bi, 10);
      tmSlot = tmSlot === i2 ? null : i2;
      renderRoster();
    };
  });
  // 锁定按钮
  try { bindPreset(); } catch (e) {}
  $$('.lockbtn', el).forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleLock(b.dataset.lock);
    };
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
  });

  // 卸下按钮（点一下把人拿掉，回到可用球员池）
  $$('.tm-unload', el).forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      unloadSlot(b.dataset.unload, parseInt(b.dataset.ui, 10));
    };
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
  });

  // 拖拽：备用名单、首发、替补三种卡都能拖，拖到任意槽位直接替换
  $$('.tm-pcard, .tm-slot, .tm-bslot', el).forEach((b) => {
    b.addEventListener('pointerdown', onPointerDown);
  });
  el.addEventListener('touchmove', onTouchMoveBlock, { passive: false });
  // 点备用球员 → 放进激活的位置；没激活就自动选一个合适的位置
  $$('.tm-pcard', el).forEach((b) => {
    b.onclick = () => {
      if (suppressTap) return;          // 刚拖完，别又触发点击
      const id = b.dataset.id;
      if (tmSlot == null) {
        const c = CARD_BY_ID[id];
        const byPos = SLOT_POS.findIndex((pos, i2) =>
          !onCourt[i2] || CARD_BY_ID[onCourt[i2]].pos !== pos);
        const same = SLOT_POS.indexOf(c.pos);
        tmSlot = same >= 0 ? same : (byPos >= 0 ? byPos : 100);
      }
      if (tmSlot >= 100) putOnBench(id, tmSlot - 100);
      else putOnCourt(id, tmSlot);
    };
    const info = b.querySelector('.info');
    if (info) info.onclick = (e) => {
      e.stopPropagation();
      window.pickTarget = { fromPool: true };   // 详情页会出现「选入阵容」
      openDetail(b.dataset.id, false);
    };
  });
  $$('.tm-filter button', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); tmFilter = b.dataset.tmf; tmPage = 0; renderRoster(); };
  });
  const pv = $('#tmPrev'), nx = $('#tmNext');
  if (pv) pv.onclick = () => { Sfx.click(); tmPage--; tmScrollTop = true; renderRoster(); };
  if (nx) nx.onclick = () => { Sfx.click(); tmPage++; tmScrollTop = true; renderRoster(); };
  layoutTeamSys();
  $$('.bt-tac[data-off]', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); S.offTac = b.dataset.off; save(); renderRoster(); };
  });
  $$('.bt-tac[data-def]', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); S.defTac = b.dataset.def; save(); renderRoster(); };
  });
}

/* =============================================================
   拖拽放卡
   ---------------------------------------------------------------
   长按 180ms 起拖（避免和列表滚动抢手势），拖到中间的位置槽上松手即换上。
   拖动过程中用 touchmove 的 preventDefault 锁住页面滚动。
   ============================================================= */
let drag = null;          // { id, srcEl, x0, y0, active, timer, ghost, over }
let dragLayer = null;     // 跟随手指的浮层
let suppressTap = false;

function dragLayerEl() {
  if (!dragLayer) {
    dragLayer = document.createElement('div');
    dragLayer.id = 'tmDragLayer';
    document.body.appendChild(dragLayer);
  }
  return dragLayer;
}

function startDrag(e) {
  const card = drag.srcEl;
  const r = card.getBoundingClientRect();
  card.classList.add('dragging');
  $$('.tm-slot').forEach((x) => x.classList.add('droppable'));
  $$('.tm-bslot').forEach((x) => x.classList.add('droppable'));
  drag.active = true;
  drag.offX = r.width / 2;
  drag.offY = r.height / 2;
  const g = card.cloneNode(true);
  g.className = 'tm-ghost';
  g.style.width = r.width + 'px';
  g.style.height = r.height + 'px';
  drag.ghost = g;
  dragLayerEl().appendChild(g);
  moveGhost(e.clientX, e.clientY);
  if (navigator.vibrate) navigator.vibrate(18);
}

function moveGhost(x, y) {
  if (!drag || !drag.ghost) return;
  drag.ghost.style.left = (x - drag.offX) + 'px';
  drag.ghost.style.top = (y - drag.offY) + 'px';
}

/** 命中哪个槽位：首发返回 0-4，替补返回 100+ */
function slotAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.closest) return null;
  const st = el.closest('.tm-slot');
  if (st) return parseInt(st.dataset.i, 10);
  const bs = el.closest('.tm-bslot');
  if (bs) return 100 + parseInt(bs.dataset.bi, 10);
  return null;
}

function setOverSlot(i) {
  if (drag.over === i) return;
  drag.over = i;
  $$('.tm-slot').forEach((x) =>
    x.classList.toggle('over', parseInt(x.dataset.i, 10) === i));
  $$('.tm-bslot').forEach((x) =>
    x.classList.toggle('over', 100 + parseInt(x.dataset.bi, 10) === i));
}

function cleanupDrag() {
  if (drag && drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
  if (drag && drag.srcEl) drag.srcEl.classList.remove('dragging');
  $$('.tm-slot,.tm-bslot').forEach((x) => x.classList.remove('droppable', 'over'));
  if (drag) { drag.ghost = null; drag.active = false; }
  if (dragLayer) dragLayer.innerHTML = '';
}

function onPointerDown(e) {
  const card = e.target.closest && e.target.closest('.tm-pcard, .tm-slot, .tm-bslot');
  if (!card) return;
  if (e.target.closest('.info')) return;          // 点 ⓘ 不进入拖拽
  if (e.target.closest('.empty')) return;         // 空槽没得拖
  if (e.button != null && e.button !== 0) return;
  const id = card.dataset.id;
  if (!id) return;
  // 记住来源：备用名单 / 首发第 i 位 / 替补第 i 格
  let from = 'pool';
  if (card.classList.contains('tm-slot')) from = 'court:' + card.dataset.i;
  else if (card.classList.contains('tm-bslot')) from = 'bench:' + card.dataset.bi;
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  drag = { id, from, srcEl: card, x0: e.clientX, y0: e.clientY,
    active: false, over: null, timer: null, touch };
  // 触摸用更短的长按（140ms），鼠标 180ms
  drag.timer = setTimeout(() => {
    if (drag) startDrag({ clientX: drag.lastX || drag.x0, clientY: drag.lastY || drag.y0 });
  }, touch ? 140 : 180);
}

function onPointerMove(e) {
  if (!drag) return;
  drag.lastX = e.clientX; drag.lastY = e.clientY;
  if (!drag.active) {
    const d = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    // 手机上页面不滚动，所以手指一动就直接起拖（更跟手）
    if (drag.touch && d > 6) {
      clearTimeout(drag.timer);
      startDrag({ clientX: e.clientX, clientY: e.clientY });
      return;
    }
    // 鼠标：移太多说明是在滚动列表，取消长按
    if (!drag.touch && d > 12) { clearTimeout(drag.timer); drag = null; }
    return;
  }
  if (e.cancelable) e.preventDefault();
  moveGhost(e.clientX, e.clientY);
  setOverSlot(slotAtPoint(e.clientX, e.clientY));
}

function onPointerUp(e) {
  if (!drag) return;
  clearTimeout(drag.timer);
  if (drag.active) {
    suppressTap = true;
    setTimeout(() => { suppressTap = false; }, 320);
    const i = slotAtPoint(e.clientX, e.clientY);
    const id = drag.id;
    const from = drag.from;
    cleanupDrag();
    drag = null;
    if (i == null) { toast('没放到位置上，卡牌已归位'); return; }
    // 放回原位：什么都不用做
    if (from === 'court:' + i || from === 'bench:' + (i - 100)) return;
    if (i >= 100) putOnBench(id, i - 100);
    else putOnCourt(id, i);
    return;
  }
  drag = null;
}

/** 拖动过程中锁住页面滚动 */
function onTouchMoveBlock(e) { if (drag && drag.active && e.cancelable) e.preventDefault(); }

/* 球队页的卡片尺寸随窗口变化重算 */
if (typeof window !== 'undefined' && !window.__tmResizeBound) {
  window.__tmResizeBound = true;
  let rzT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => { if (typeof layoutTeamSys === 'function') layoutTeamSys(); }, 140);
  });
}

/* 全局只绑一次：拖拽的移动与松手 */
if (typeof document !== 'undefined' && !window.__tmDragBound) {
  window.__tmDragBound = true;
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

/**
 * 按可用空间算出场上的卡和列表卡该多大。
 * ---------------------------------------------------------------
 * 之前列表卡用 height:100% 填满网格行，窗口一高就被纵向拉长，
 * 照片变形、名字被切。改成算出一个固定尺寸再居中，
 * 卡片永远保持宽高比，窗口再高再矮都不会变形。
 */
function layoutTeamSys() {
  const pane = document.querySelector('.tm-pane.on');
  if (!pane) return;
  const court = document.querySelector('.tm-court');
  const pool = document.getElementById('tmPool');
  const pgap = 7, cgap = 7;

  // ---- 球场：两排首发 + 一排替补，取宽度和高度算出来的较小值 ----
  if (court) {
    const cw = court.clientWidth - 24;      // 减去内边距
    const ch = court.clientHeight - 20;
    // 纵向预算：上场两排 + 替补席（含标题和分隔线）
    // 首发 2 排 + 替补 1 排，竖向空间是共享的，所以三个尺寸一起解：
    //   h = w * kh（kh 由卡面比例决定）
    //   2 * kh * sw + kh * sb + 间隙 + 替补标题 + 边距 = 可用高度
    //   sb = sw * 0.9（替补比首发小一成）
    const AR = 5 / 5.9;                      // 球场卡用略扁的比例
    const kh = 1 / AR;
    // 竖向一共 4 排卡：首发 2 排 + 替补 2 排（上 2 下 3）
    const fixed = cgap * 2 + 4 + 12;         // 排间距×2 + 分隔线 + 上下边距
    const usable = ch - fixed;
    // 替补 / 首发 的比例：调大一点，替补变大、首发略缩，但首发始终更大
    const RATIO_B = 0.92;
    const swRaw = usable / (2 * kh + 2 * kh * RATIO_B);
    // 上限放开到 240：1920 宽的电脑版能把球场填满，手机端本来也到不了这个数
    const sw = Math.max(34, Math.min((cw - cgap * 2) / 3, swRaw, 240));
    const sb = Math.max(30, Math.min((cw - cgap * 2) / 3, sw * RATIO_B));
    court.style.setProperty('--slot-w', sw.toFixed(1) + 'px');
    court.style.setProperty('--bslot-w', sb.toFixed(1) + 'px');
  }

  // ---- 球员列表：一页 6 张，自动挑"卡面最大"的排法 ----
  // 竖着排不下就横过来排，手机（矮）和电脑（高）都能得到最大的卡
  if (pool) {
    const pw = pool.clientWidth - 24;
    const ph = pool.clientHeight - 4;
    const n = PER_PAGE;
    let best = { cols: 2, w: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const byW = (pw - (cols - 1) * pgap) / cols;
      const byH = ((ph - (rows - 1) * pgap) / rows) * (5 / 6.4);
      // 卡面超过 210px 就不再靠"减少列数"来变大（大屏会变成两张巨大的卡）
      const w = Math.min(byW, byH, 210);
      if (w > best.w + 0.5) best = { cols, w };
    }
    const cw = Math.max(40, Math.min(best.w, 230));
    pool.style.setProperty('--pcw', cw.toFixed(1) + 'px');
    pool.style.setProperty('--pcols', best.cols);
  }
}

/** 场上的一个位置槽 */
function tmSlotHTML(id, i) {
  const pos = SLOT_POS[i];
  const st = id ? battleStats(id) : null;
  const active = tmSlot === i;
  // 位置做成卡片内的角标（缩写 + 中文），不再挂在卡片下面 ——
  // 挂外面会被下一条分隔线压住，看不清
  return `<div class="tm-slot${active ? ' active' : ''}${st ? '' : ' empty'}"
      data-i="${i}" data-id="${id || ''}"${st ? ' draggable="true"' : ''}
      style="${st ? tierVar(st.card.tier) : ''}">
    ${st ? `<div class="tm-slot-face">${cardHTML(st.card, { shortName: true })}</div>
      <div class="tm-slot-pos ${posFit(st.card, pos)}" title="${
        st.card.name}：现在打 ${pos}（${SLOT_CN[pos]}）· ${posFitText(st.card, pos)}　他能打 ${posListText(st.card)}">
        <b>${pos}</b><i>${SLOT_CN[pos]}</i>${
        posFit(st.card, pos) !== 'primary'
          ? `<em>${posFit(st.card, pos) === 'secondary' ? '副位' : '客串'}</em>` : ''}
      </div>
      ${brkBadgeHTML(st.brk)}
      <button class="tm-unload" data-unload="court" data-ui="${i}"
        title="卸下">✕</button>` : `<span class="tm-slot-add">＋</span>
      <div class="tm-slot-need">需要 <b>${pos}</b><i>${SLOT_CN[pos]}</i></div>`}
  </div>`;
}

/** 替补席上的一个位置：和首发同一种卡面，只是小一号 */
function tmBenchSlotHTML(id, i) {
  const st = id ? battleStats(id) : null;
  const active = tmSlot === 100 + i;
  return `<div class="tm-bslot${active ? ' active' : ''}${st ? '' : ' empty'}"
      data-bi="${i}" data-id="${id || ''}"${st ? ' draggable="true"' : ''}
      style="${st ? tierVar(st.card.tier) : ''}">
    ${st ? `<div class="tm-bslot-face">${cardHTML(st.card, { shortName: true })}</div>
      ${brkBadgeHTML(st.brk)}
      <button class="tm-unload" data-unload="bench" data-ui="${i}"
        title="卸下">✕</button>`
    : '<span class="add">＋</span>'}
    </div>`;
}

/** 备用名单里的一张球员卡 */
function tmPoolCard(c) {
  const st = battleStats(c.id);
  const T = TIERS[c.tier];
  const r0 = rosterIds();
  const onCourtIdx = r0.starters.indexOf(c.id);
  const inRoster = onCourtIdx >= 0 || r0.bench.indexOf(c.id) >= 0;
  /* 这名球员的**另一张卡**是不是已经在阵容里了？
     是的话在池子里就先标出来，别等玩家拖进去才被拦。 */
  const clashId = inRoster ? null : playerConflictInRoster(c.id);
  const clash = clashId ? CARD_BY_ID[clashId] : null;
  return `<div class="tm-pcard${inRoster ? ' used' : ''}${
      clash ? ' clash' : ''}" data-id="${c.id}"
      style="${tierVar(c.tier)}">
    <div class="tm-pcard-img"><img src="${c.photo}" alt=""
      onerror="this.parentNode.style.visibility='hidden'"></div>
    <b class="tm-pcard-ovr">${st.ovr}</b>
    <div class="tm-pcard-plate">
      <span>${shortName(c.name)}</span>
      <i>${c.pos}</i>
    </div>
    ${inRoster ? '<u class="tm-pcard-in">名单中</u>' : ''}
    ${clash ? `<u class="tm-pcard-clash" title="阵容里已有同球员：${
      TIERS[clash.tier].name} · ${clash.name}">⚠️ 同球员在阵容</u>` : ''}
    ${isLocked(c.id) ? '<u class="tm-pcard-lock">🔒</u>' : ''}
    <button class="info" title="看能力与徽章">ⓘ</button>
    <button class="lockbtn${isLocked(c.id) ? ' on' : ''}" data-lock="${c.id}"
      title="${isLocked(c.id) ? '已锁定（不可出售）' : '点一下锁定，锁定后不可出售'}">${
      isLocked(c.id) ? '🔒' : '🔓'}</button>
  </div>`;
}

/** 把 id 放到替补席第 i 位；原本在那儿的人回备用名单 */
/**
 * 把球员放到替补席第 i 格。
 * ---------------------------------------------------------------
 * 规则：**只替换这一格，其他人一个都不挪。**
 * （旧实现用 bench.unshift(id)，结果不管放第几格都插到最前面，
 *   后面所有人往后串一位 —— 就是"球员位移"的根源。）
 *   · 他本来在首发 → 和首发那个位置对调
 *   · 他本来在替补席别格 → 两格对调
 *   · 他从备用名单来 → 被顶下的人回备用名单
 */
function putOnBench(id, i) {
  const r = rosterIds();
    /* ★ 阵容内挪位是合法操作：先把自己从原位置摘掉，免得被"同球员"校验拦下 */
    const fromBench0 = r.bench.indexOf(id);
    const fromStart0 = r.starters.indexOf(id);
    if (fromBench0 >= 0) r.bench[fromBench0] = null;
  const prev = r.bench[i];
  if (prev === id) { tmSlot = null; renderRoster(); return; }
  // 同一名球员只能上一张（目标格原来那张会被换下，忽略它）
  if (!guardSamePlayer(id, prev)) return;

  const fromStart = r.starters.indexOf(id);
  r.bench[i] = id;                       // 直接占据第 i 格
  if (fromStart >= 0 && prev) {
    r.starters[fromStart] = prev;        // 被换下的人顶上首发那个位置
  }
  finalizeRoster(r);
  S.roster = r;                          // ★ 必须写回！（手动模式下 r 是新对象）
  save();
  Sfx.reveal('gold');
  toast(`${CARD_BY_ID[id].name} 进入替补席`);
  tmSlot = null;
  renderRoster();
}

/**
 * 卸下球员：把他从这个位置拿掉，回到「可用球员」池子，位置留空。
 * 和"替换"不同 —— 替换是有人顶上来，卸下就是单纯拿掉。
 */
function unloadSlot(kind, i) {
  const r = rosterIds();
  /* ★ 'starters' 和 'court' 都表示首发。
     这里原来只认 'court'，而 assignToSlot() 传的是 'starters' ——
     于是它掉进 else 分支，把**替补席第 i 格**清空了（清错位置），
     首发本人根本没被摘下来；紧接着 guardSamePlayer 发现他还在阵容里，
     就把整次「首发换位」判成同球员冲突直接拦掉。
     表现就是：首发之间互相拖、或把首发拖去替补席，全都没反应。 */
  const onCourt = (kind === 'court' || kind === 'starters');
  if (onCourt) {
    if (!r.starters[i]) return;
    r.starters[i] = null;
  } else {
    if (!r.bench[i]) return;
    r.bench[i] = null;
  }
  S.roster = r;
  S.rosterManual = true;        // 进入手动模式，空位不再被自动补上
  tmSlot = null;
  save();
  Sfx.click();
  if (navigator.vibrate) navigator.vibrate(15);
  const n = onCourt ? r.starters.filter(Boolean).length
    : r.bench.filter(Boolean).length;
  toast(onCourt
    ? `已卸下，首发还差 ${ROSTER.starters - n} 人`
    : `已卸下，替补还差 ${ROSTER.bench - n} 人`);
  renderRoster();
  renderBattle();
}

/** 一键回到自动补满 */
function refillRoster() {
  S.rosterManual = false;
  S.roster = autoLineup();
  save();
  Sfx.reveal('gold');
  toast('已按综合评分自动补满阵容');
  renderRoster();
  renderBattle();
}

/* =============================================================
   球员锁定
   -------------------------------------------------------------
   锁定后的球员**不可出售**（单卖、一键清仓都会被拦下），
   但仍然可以正常上阵、突破。用来保护辛苦练满的主力。
   ============================================================= */
function isLocked(id) { return !!(S.locked && S.locked[id]); }
function toggleLock(id) {
  if (!S.locked) S.locked = {};
  if (S.locked[id]) delete S.locked[id];
  else S.locked[id] = true;
  save();
  Sfx.click();
  const c = CARD_BY_ID[id];
  toast(isLocked(id)
    ? `${c ? c.name : ''} 已锁定 🔒（不可出售）`
    : `${c ? c.name : ''} 已解锁 🔓`);
  renderRoster();
  renderMine && renderMine();
}
function lockedCount() {
  return Object.keys(S.locked || {}).filter((id) => S.owned[id]).length;
}

/** 测试用：换人但不重绘 */
function putOnCourtSilent(id, i) { putOnCourt(id, i, true); }
function putOnBenchSilent(id, i) {
  const r = rosterIds();
  const prev = r.bench[i];
  if (prev === id) return;
  const fromStart = r.starters.indexOf(id);
  r.bench[i] = id;
  if (fromStart >= 0 && prev) r.starters[fromStart] = prev;
  finalizeRoster(r);
  S.roster = r;
  save();
}

/** 把 id 放到场上第 i 位；原来的首发回到备用名单 */
/**
 * 阵容收尾：补空位、去重、补足人数。
 * **关键：不改变已有球员的位置**，只在真的有空位时才补人。
 */
function finalizeRoster(r) {
  r.starters = Array.from({ length: ROSTER.starters }, (_, k) => r.starters[k] || null);
  /* 手动模式下只做去重和截断，**绝不自动补人** ——
     否则用户刚卸下的空位会立刻被顶回来，或者新放的人被挤走。 */
  if (S.rosterManual) {
    const used2 = new Set();
    const clean = (arr, max) => Array.from({ length: max }, (_, k) => {
      const id = arr[k];
      if (!id || !S.owned[id] || used2.has(id)) return null;
      used2.add(id); return id;
    });
    r.starters = clean(r.starters, ROSTER.starters);
    r.bench = clean(r.bench, ROSTER.bench);
    return r;
  }
  // 先按"球员"去重：同一名球员在整套阵容里只能留一张（留第一个出现的）
  {
    const seenP = new Set();
    const dedupePlayer = (arr) => arr.map((id) => {
      if (!id) return null;
      const k = playerKeyOf(id);
      if (seenP.has(k)) return null;      // 重复球员 → 空出这个位置
      seenP.add(k);
      return id;
    });
    r.starters = dedupePlayer(r.starters);
    r.bench = dedupePlayer(r.bench);
  }
  const used = new Set(r.starters.filter(Boolean));
  // 首发有空位才按位置从替补席挑（正常替换不会走到这里）
  for (let k = 0; k < ROSTER.starters; k++) {
    if (r.starters[k]) continue;
    const pos = SLOT_POS[k];
    let hit = r.bench.find((x) => x && !used.has(x) && CARD_BY_ID[x]
      && (CARD_BY_ID[x].pos === pos || CARD_BY_ID[x].pos2 === pos));
    if (!hit) hit = r.bench.find((x) => x && !used.has(x) && CARD_BY_ID[x]);
    if (hit) { r.starters[k] = hit; used.add(hit); }
  }
  r.starters = r.starters.filter(Boolean);
  // 替补席：去掉空位和与首发重复的，保持原有顺序
  r.bench = r.bench.filter((x) => x && !r.starters.includes(x));
  r.bench.forEach((x) => used.add(x));
  // 不够 5 人就用综合分最高的补到**末尾**，不动前面的人
  ownedByOvr().forEach((c) => {
    if (r.bench.length >= ROSTER.bench) return;
    if (used.has(c.id)) return;
    used.add(c.id); r.bench.push(c.id);
  });
  r.bench = r.bench.slice(0, ROSTER.bench);
  return r;
}

/**
 * 把球员放到场上第 i 位。
 * ---------------------------------------------------------------
 * 同样只替换这一位，其他人不挪窝：
 *   · 他本来在首发别的位置 → 两位对调
 *   · 他本来在替补席某一格 → 和那一格对调
 *   · 他从备用名单来 → 被顶下的首发接管替补席最后一格（前面几格不动）
 */
function putOnCourt(id, i, silent) {
  const r = rosterIds();
  const prev = r.starters[i];
  if (prev === id) { tmSlot = null; renderRoster(); return; }
  // 同一名球员只能上一张：目标格原来那张会被换下，所以忽略它
  if (!silent && !guardSamePlayer(id, prev)) return;

  /* =============================================================
     🎯 位置合法性校验（v9.32）
     -------------------------------------------------------------
     用户要求：「PG 就只能在 PG 的位置上，SG 就只能在 SG 的位置上……
     但拥有双能位的球员除外」。

     规则：
       · 首发五个位置必须由**能打该位置**的球员担任
       · 能打 = card.pos 或 card.pos2 命中该位置（双能位）
       · 不能打就被**拦截**，并提示这名球员实际能打哪两个位置

     ⚠️ silent = true 时跳过（自动排阵 / 一键换人的内部调用）——
        否则自动逻辑会被自己的校验反复打断。但自动逻辑也会
        优先挑合法球员（见 autoLineup / smartLineup）。
     ============================================================= */
  /* ★ v9.35：从"拦截"改为"允许但明确警告"。
     因为现在有了客串惩罚机制 —— 玩家仍然可以强行把球员放在
     不适合的位置（有时是应急需要），但能力值会被削弱 60%，
     所以必须让他清楚知道代价。 */
  let oopWarn = '';
  if (!silent) {
    const card = CARD_BY_ID[id];
    const slot = SLOT_POS[i];
    if (card && !canPlayPos(card, slot)) {
      oopWarn = `⚠️ ${card.name} 不能打 ${slot}（${SLOT_CN[slot]}）——` +
        `他只能打 ${posListText(card)}。\n` +
        `强行放这里会让他的能力值削弱 60%！`;
      Sfx.fail();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    }
  }

  const fromStart = r.starters.indexOf(id);
  const fromBench = r.bench.indexOf(id);

  r.starters[i] = id;
  if (fromStart >= 0 && fromStart !== i) {
    r.starters[fromStart] = prev || null;              // 首发内部对调
  } else if (fromBench >= 0) {
    r.bench[fromBench] = prev || null;                 // 替补席原位换回
  } else if (prev) {
    // 从备用名单进来：让被顶下的人接管最后一格，避免整排往后串
    if (r.bench.length < ROSTER.bench) r.bench.push(prev);
    else r.bench[ROSTER.bench - 1] = prev;
  }
  finalizeRoster(r);
  S.roster = r;                          // ★ 必须写回！（手动模式下 r 是新对象）
  save();
  Sfx.reveal('gold');
  if (!silent) {
    const card = CARD_BY_ID[id];
    const slot = SLOT_POS[i];
    const fit = posFit(card, slot);
    if (fit === 'out') {
      toast(oopWarn || `${card.name} 客串 ${slot}，能力值 -60%`);
    } else {
      toast(`${card.name} 进入首发 · ${slot}（${SLOT_CN[slot]}）` +
        (fit === 'secondary' ? '　副位' : ''));
    }
    tmSlot = null;
    renderRoster();
  }
}

function openRoster() {
  const el = $('#rosterLayer');
  if (!el) return;
  tmSlot = null; tmPage = 0;
  el.classList.remove('hidden');
  renderRoster();
}
function closeRoster() {
  const el = $('#rosterLayer');
  if (el) el.classList.add('hidden');
  window.pickTarget = null;
  renderBattle();
}

/**
 * 详情页里的「选入阵容」：放到当前激活的位置，
 * 没激活就按他的位置自动找一位。
 */
  /**
   * 把球员放进某个位置。
   * @param id   球员卡 id
   * @param slot 0~4 = 首发位置；100~106 = 替补第 N 位；不传则按位置自动选
   */
  function assignToSlot(id, slot) {
    /* 同一名球员只能上一张。
       ★ 但"把已经在阵容里的他挪到另一个位置"是合法操作，
       不能算冲突 —— 所以先把自己从当前位置摘掉再校验
       （ignoreId 让他不会和自己冲突）。 */
    const r0 = rosterIds();
    const si0 = r0.starters.indexOf(id);
    const bi0 = r0.bench.indexOf(id);
    if (si0 >= 0 || bi0 >= 0) {
      /* 只是「把他挪到别的位置」，不是「卸下」。
         所以不能走 unloadSlot()：那会把 rosterManual 打开（之后空位永不再自动补人）、
         弹一句「已卸下」、还在半路重绘一次。
         这里只做纯粹的摘除，后续 putOnCourt/putOnBench 会把他放到新位置。 */
      if (si0 >= 0) r0.starters[si0] = null;
      if (bi0 >= 0) r0.bench[bi0] = null;
      S.roster = r0;
    }
    if (!guardSamePlayer(id, id)) return false;
    let i = (slot == null) ? tmSlot : slot;
    if (i == null) {
      const c = CARD_BY_ID[id];
      const byPos = SLOT_POS.indexOf(c.pos);
      i = byPos >= 0 ? byPos : 0;
    }
    window.pickTarget = null;
    /* 替补位：100+i → 第 i 个替补。
       putOnBench 只替换目标槽位，不动其他人（用户明确要求过）。 */
    if (i >= 100) {
      const bi = i - 100;
      if (typeof putOnBench === 'function') { putOnBench(id, bi); return true; }
      return false;
    }
    putOnCourt(id, i);
    return true;
  }

  function closePick() { const el = $('#pickLayer'); if (el) el.classList.add('hidden'); }

function renderBattle() {
  const el = $('#scr-battle');
  if (!el) return;
  if (BT.phase === 'live') { renderBattleLive(); return; }
  if (BT.phase === 'done') { renderBattleDone(); return; }

  const lu = lineupIds();          // 每次进对战页都重新读球队系统的名单
  if (!lu.starters.length) {
    el.innerHTML = `<div class="pad"><div class="sec-title">生 涯 模 式</div>
      <div class="bt-empty">还没有球员卡，先去「招募」页抽几张吧 🏀<br>
        至少要凑齐一套首发阵容才能比赛。</div></div>`;
    return;
  }
  /* 生涯模式：月历 + 对手面板（版式参考 2K MyCareer）
     原来的"对手选择 + 战术设置"整页被它取代。 */
  if (typeof careerHTML === 'function') {
    el.innerHTML = careerHTML();
    bindCareer();
    return;
  }
  const team = buildTeam(lu.starters, '我的球队', false);
  const ai = buildLeagueOpponent(BT.oppTeam);
  const power = Math.round(team.ovr);
  const aiPower = Math.round(ai.ovr);
  const odds = clamp(0.5 + (power - aiPower) * 0.022, 0.08, 0.92);

  el.innerHTML = `<div class="pad">
    <div class="sec-title">卡 牌 对 战
      <span style="float:right;color:#cfdcff;font-size:11.5px;font-weight:400">
        联赛战绩 ${S.leagueMyW || 0} 胜 ${S.leagueMyL || 0} 负 ·
        支票 🪙${fmt(S.coins)}</span></div>

    <div class="bt-myteam">
      <div class="bt-head">
        <div><b>我的球队</b><span>综合 ${power} · ${lu.starters.length + lu.bench.length}/${ROSTER.total} 人</span></div>
        <button class="bt-mini" id="btEdit">编辑阵容</button>
      </div>
      <div class="bt-lineup">
        ${lu.starters.map((id) => btPlayerChip(id)).join('')}
      </div>
      <div class="bt-bench-row">
        <span class="bt-bench-tag">替补 ${lu.bench.length}</span>
        <div class="bt-bench-cards">
          ${lu.bench.map((id) => btBenchChip(id)).join('') || '<i class="bt-none">还没有替补，点「编辑阵容」加人</i>'}
        </div>
      </div>
    </div>

    <div class="bt-tacbar">
      <div class="bt-tacbar-l">
        <span>进攻 <b>${(OFF_TACTICS[S.offTac] || OFF_TACTICS.balanced).name}</b></span>
        <span>防守 <b>${(DEF_TACTICS[S.defTac] || DEF_TACTICS.man).name}</b></span>
      </div>
      <button class="bt-mini" id="btEdit2">改战术</button>
    </div>

    <div class="sec-title" style="margin-top:14px">选 择 对 手
      <span style="float:right;font-size:11px;color:#7f8ca8;font-weight:400">
        30 支 NBA 球队 · 每天自动互相对战</span></div>
    <div class="bt-opp-grid">
      ${NBA_TEAMS.map((t) => {
        const st = leagueState().teams[t.key] || { w: 0, l: 0 };
        const ovr = rosterOvr(st.roster || []);
        const on = BT.oppTeam === t.key;
        return `<div class="bt-opp${on ? ' on' : ''}" data-oppteam="${t.key}"
            style="--oc1:${t.c1};--oc2:${t.c2}">
          ${lgBadge(t, 26)}
          <div class="bt-opp-t">
            <b>${t.name}</b>
            <em>${st.w}胜${st.l}负 · ${t.conf}部</em>
          </div>
          <span class="bt-opp-ovr">${ovr.toFixed(0)}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="bt-opp-info">
      <div class="bt-opp-info-l">
        <b>${TEAM_BY_KEY[BT.oppTeam] ? TEAM_BY_KEY[BT.oppTeam].name : '洛杉矶湖人'}</b>
        <span>综合 ${aiPower} · 战绩 ${(leagueState().teams[BT.oppTeam] || {}).w || 0} 胜
          ${(leagueState().teams[BT.oppTeam] || {}).l || 0} 负 ·
          预估奖金 🪙 ${typeof rewardPreviewText === 'function'
            ? rewardPreviewText(aiPower)
            : fmt(rewardBase ? rewardBase(aiPower) : 0)}</span>
      </div>
      <div class="bt-opp-roster">
        ${ai.players.slice(0, 5).map((p) => `<span class="bt-opp-chip">
          <b>${p.ovr}</b>${shortName(p.name)}</span>`).join('')}
      </div>
    </div>

    <div class="bt-vs">
      <div class="bt-vs-side"><b>${power}</b><span>我的球队</span></div>
      <div class="bt-vs-mid">
        <div class="bt-odds">胜率预估 <b style="color:${odds > 0.6 ? '#5ee08a' : odds > 0.4 ? '#f5c451' : '#ff6b7f'}">${(odds * 100).toFixed(0)}%</b></div>
        <div class="bt-posbar"><i style="width:${(odds * 100).toFixed(0)}%"></i></div>
      </div>
      <div class="bt-vs-side"><b>${aiPower}</b><span>${ai.name}</span></div>
    </div>

    <div class="bt-startrow">
      <button class="bt-start live" id="btStartLive">🏀 现 场 比 赛</button>
      <button class="bt-start quick" id="btStartQuick">⚡ 一键扫荡</button>
    </div>
    <div class="bt-tip">现场比赛：一节 12 分钟（比赛时间）压缩到现实约 2 分钟，可暂停、可 1x/2x/4x 加速。<br>
      一键扫荡：不播过程，直接出比分和技术统计。</div>
    <div class="bt-rule">
      <b>规则</b>：4 节 × 6 回合，每回合两队各攻一次。得分方式与现实中一致
      （三分 3 分、中投/内线 2 分、造犯规罚球 1 分），
      还有抢断、盖帽、进攻篮板二次进攻、失误。
      每次攻防由<b>进攻方相应能力 vs 防守方相应能力</b>决定结果，徽章与体力都会影响命中率。
    </div>
  </div>`;

  $$('.bt-opp', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      BT.oppTeam = b.dataset.oppteam;
      save(); renderBattle();
    };
  });
  $$('.bt-tac[data-off]', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); S.offTac = b.dataset.off; save(); renderBattle(); };
  });
  $$('.bt-tac[data-def]', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); S.defTac = b.dataset.def; save(); renderBattle(); };
  });
  const eb = $('#btEdit');
  if (eb) eb.onclick = () => { Sfx.click(); switchTab('team'); };   // 跳到独立的球队系统
  const eb2 = $('#btEdit2');
  if (eb2) eb2.onclick = () => { Sfx.click(); switchTab('team'); };
  const sl = $('#btStartLive');
  if (sl) sl.onclick = () => startBattle('live');
  const sq = $('#btStartQuick');
  if (sq) sq.onclick = () => startBattle('quick');
}

/** 战术卡上的小标签：克制谁、被谁克 */
function tacTags(kind, key) {
  const out = [];
  if (kind === 'off') {
    Object.keys(DEF_TACTICS).forEach((d) => {
      const v = counterBonus(key, d);
      if (v > 0.02) out.push(`<em class="up">克 ${DEF_TACTICS[d].short}</em>`);
      if (v < -0.02) out.push(`<em class="dn">怕 ${DEF_TACTICS[d].short}</em>`);
    });
    if (OFF_TACTICS[key].pace < 0.8) out.push('<em class="neu">回合数 +60%</em>');
    if (OFF_TACTICS[key].stamina > 1.2) out.push('<em class="dn">体力消耗大</em>');
  } else {
    Object.keys(OFF_TACTICS).forEach((o) => {
      const v = counterBonus(o, key);
      if (v > 0.02) out.push(`<em class="dn">怕 ${OFF_TACTICS[o].short}</em>`);
      if (v < -0.02) out.push(`<em class="up">克 ${OFF_TACTICS[o].short}</em>`);
    });
  }
  return out.join('');
}

/**
 * 对战时的球员卡：抠像 + 评分 + 名字 + 实时得分 + 体力条
 * 正在持球/出手的人会高亮，得分的瞬间会闪一下
 */
/**
 * 窄栏里的短名：中文取"·"后面的姓，英文取最后一个词。
 * 直接截前 4 个字会变成"迈克尔""勒布朗"这种，认不出是谁。
 */
function shortName(name) {
  if (!name) return '';
  if (/[\u4e00-\u9fa5]/.test(name)) {
    // 中文名按 · 和 - 切开取最后一段，比如
    // 「卡里姆·阿卜杜勒-贾巴尔」→ 贾巴尔，「谢伊·吉尔杰斯-亚历山大」→ 亚历山大
    const parts = name.split(/[·\-–—]/).filter(Boolean);
    const sur = parts[parts.length - 1] || name;
    return sur.length > 5 ? sur.slice(0, 5) : sur;
  }
  // 英文名取最后一个词（姓）
  const w = name.trim().split(/\s+/);
  return w[w.length - 1] || name;
}

function btLiveCard(p, side) {
  const sta = p.stamina.cur;
  const hot = p.hot >= 3;
  const st = p.stat;
  // 五项数据：分 / 板 / 助 / 断 / 帽
  const cells = [['分', st.pts], ['板', st.reb], ['助', st.ast],
    ['断', st.stl], ['帽', st.blk]];
  /* =============================================================
     🎯 场上位置标注（v9.32）
     -------------------------------------------------------------
     用户要求：「比赛时场上的球员位置要标明，要让人知道
     目前这个球员是在什么位置上」。

     做法：每张比赛卡左上角一枚位置徽章，显示**他现在打的位置**，
     并按适配度着色：
        · 本位（绿）—— 这就是他的主位置
        · 副位（黄）—— 双能位的第二位置
        · 客串（红）—— 不该打这个位置（自动排阵兜底才会出现）
     徽章下方带球员自己的位置（如 "PG|SG"），一眼看出他能不能打。
     ============================================================= */
  const slot = p.slotPos || '';
  const fit = slot ? posFit(p.card, slot) : '';
  const fitCn = fit === 'primary' ? '本位' : fit === 'secondary' ? '副位' : fit === 'out' ? '客串' : '';
  const ownPos = positionsOf(p.card).join('|');
  /* ★ v9.35：客串要显示 -60%，让玩家一眼看懂他为什么打得这么差 */
  const oopTag = (p.oop && p.oop.penalty)
    ? `<i class="oop">-${Math.round(p.oop.penalty * 100)}%</i>` : '';
  const posTag = slot ? `<div class="bt-pc-pos ${fit}${
    p.oop ? ' oop-on' : ''}" title="${
    p.name}：现在打 ${slot}（${SLOT_CN[slot] || slot}）· ${fitCn}　他能打 ${posListText(p.card)}${
    p.oop ? '　⚠️ 客串惩罚：全部能力值 -' + Math.round(p.oop.penalty * 100) + '%' : ''}">
      <b>${slot}</b>${fitCn && fit !== 'primary' ? `<i>${fitCn}</i>` : ''}${oopTag}
      <em>${ownPos}</em>
    </div>` : '';
  return `<div class="bt-pc${p.acting ? ' acting' : ''}${p.scoredNow ? ' scored' : ''}"
      data-pid="${p.id}" style="${tierVar(p.card.tier)}">
    ${posTag}
    <div class="bt-pc-img"><img src="${p.card.photo}" alt=""
      onerror="this.parentNode.style.visibility='hidden'"></div>
    ${hot ? '<i class="bt-pc-hot">🔥</i>' : ''}
    ${brkBadgeHTML(p.brk)}
    <div class="bt-pc-info">
      <span class="bt-pc-nm">${shortName(p.name)}</span>
      <b class="bt-pc-ovr">${p.ovr}</b>
      <em class="bt-pc-pts">${st.pts}</em>
    </div>
    <div class="bt-pc-stats">
      ${cells.map(([k, v], i) => `<div class="bt-st${v > 0 ? ' has' : ''}${
        i === 0 ? ' main' : ''}"><i>${k}</i><b>${v}</b></div>`).join('')}
    </div>
    <i class="bt-pc-sta"><b style="width:${sta.toFixed(0)}%;background:${
      sta > 60 ? '#3fc46a' : sta > 30 ? '#f5c451' : '#e0233f'}"></b></i>
  </div>`;
}

/** 一支球队的竖列：队名 + 5 张卡 */
function btTeamCol(team, side) {
  const mine = side === 'my';
  const ot = OFF_TACTICS[team.off] || OFF_TACTICS.balanced;
  const dt = DEF_TACTICS[team.def] || DEF_TACTICS.man;
  return `<div class="bt-col ${mine ? 'my' : 'foe'}">
    <div class="bt-col-head">
      <span class="bt-col-name">${team.name}</span>
      <span class="bt-col-tac">${ot.short}/${dt.short}</span>
    </div>
    <div class="bt-col-cards">${team.players.map((p) => btLiveCard(p, side)).join('')}</div>
  </div>`;
}

function btBenchChip(id) {
  const st = battleStats(id);
  if (!st) return '';
  return `<div class="bt-bchip" style="${tierVar(st.card.tier)}" title="${st.card.name}">
    <img src="${st.card.photo}" alt="" onerror="this.style.visibility='hidden'">
    <b>${st.ovr}</b><i>${shortName(st.card.name)}</i>
  </div>`;
}

function btPlayerChip(id) {
  const st = battleStats(id);
  if (!st) return '';
  const T = TIERS[st.card.tier];
  return `<div class="bt-chip" style="${tierVar(st.card.tier)}">
      <div class="bt-chip-img"><img src="${st.card.photo}" alt=""
        onerror="this.parentNode.style.display='none'"></div>
      <b>${st.ovr}</b>
      <span>${st.card.pos}</span>
      <i>${st.card.name.length > 5 ? st.card.name.slice(0, 5) + '…' : st.card.name}</i>
    </div>`;
}

/* =============================================================
   实时比赛循环
   ---------------------------------------------------------------
   一节 12 分钟（比赛时间），压缩到现实约 2 分钟 → 6 倍速。
   比赛时钟连续走动，每到一个进攻回合结束就结算一次球权。
   同时提供 1x / 2x / 4x 倍速和一键扫荡。
   ============================================================= */
const QUARTER_SEC = 12 * 60;          // 一节 720 秒比赛时间
const REAL_PER_QUARTER = 120;         // 现实里一节约 2 分钟
const TIME_SCALE = QUARTER_SEC / REAL_PER_QUARTER;   // 6：比赛秒 / 现实秒
const TICK_MS = 100;

/** 一次进攻消耗的比赛时间（秒）：快攻少、阵地战多 */
function rollPossessionLen(off, def, quarter) {
  const offTac = OFF_TACTICS[off.off] || OFF_TACTICS.balanced;
  const defTac = DEF_TACTICS[def.def] || DEF_TACTICS.man;
  /* 一次进攻耗时。
     原来基础值是 8~22 秒（平均 15），再乘上战术 pace ——
     跑轰 pace=0.6 时只剩 5 秒，一场能打 340+ 回合，
     而 NBA 一场两队合计约 200 回合（每回合约 14~16 秒）。
     所以把基础抬高、并把战术系数**压缩到 0.9~1.15**，
     让快慢节奏有区别但不会离谱。 */
  let pace = 13 + Math.random() * 11;                  // 13~24 秒，平均 18.5
  pace *= 0.90 + (offTac.pace || 1) * 0.10;            // 跑轰 0.96 / 均衡 1.0
  pace *= 0.93 + (defTac.pace || 1) * 0.07;            // 联防略快一点点
  /* ★ 必须是 let：下面关键时刻会给它加上「关键先生」徽章的命中修正。
     之前写成 const，一到第四节最后两分钟的分差接近局面就抛
     "Assignment to constant variable"，表现为"扫荡到关键时刻必崩"。 */
  let diff = off.score - def.score;
  const late = quarter >= 3;
  if (late && diff < -8) pace *= 0.72;                 // 落后末节抢时间
  if (late && diff > 8) pace *= 1.18;                  // 领先拖时间
  return Math.max(7, Math.min(26, pace));
}

function newGameState(myTeam, aiTeam) {
  /* ★ 开局必须把两队比分清零。
     原来这里没清，导致 quickSimulate 在一场已经打过的比赛上继续累加，
     出现 183:104 / 195:151 这种离谱比分（正常约 100:100）。 */
  if (myTeam) myTeam.score = 0;
  if (aiTeam) aiTeam.score = 0;
  if (myTeam) myTeam.quarterScores = [];
  if (aiTeam) aiTeam.quarterScores = [];
  return {
    q: 0, k: 0,
    clock: QUARTER_SEC,                 // 本节剩余比赛秒
    possLeft: 4 + Math.random() * 6,    // 本次进攻剩余秒
    possession: Math.random() < 0.5 ? 0 : 1,
    myTeam, aiTeam, done: false,
    running: false, speed: 1, breakLeft: 0,
  };
}

/** 推进 dt 现实秒 */
function advanceGame(gs, dtReal) {
  if (gs.done) return [];
  const out = [];
  let dt = dtReal * TIME_SCALE * gs.speed;        // 换算成比赛秒

  // 节间暂停：只走暂停计时，不消耗比赛时间
  if (gs.breakLeft > 0) {
    gs.breakLeft -= dtReal * gs.speed;
    if (gs.breakLeft <= 0) { gs.breakLeft = 0; gs.clock = QUARTER_SEC; }
    return out;
  }

  let guard = 0;
  while (dt > 0 && !gs.done && guard++ < 40) {
    const step = Math.min(dt, gs.possLeft, gs.clock);
    gs.possLeft -= step;
    gs.clock -= step;
    dt -= step;

    if (gs.possLeft <= 0.001) {
      const clutch = (gs.q === QUARTERS - 1 && gs.clock <= 150
        && Math.abs(gs.myTeam.score - gs.aiTeam.score) <= 6);
      const mine = gs.possession % 2 === 0;
      const off = mine ? gs.myTeam : gs.aiTeam;
      const def = mine ? gs.aiTeam : gs.myTeam;
      const ev = playPossession(off, def, gs.q, 0, clutch);
      ev.mine = mine;
      // 更新势头：得分 +，被打 +，每次攻防都朝 0 回落
      const scored = ev.pts > 0;
      off.momentum = clamp((off.momentum || 0) + (scored ? 1 : -0.35), -4, 5);
      def.momentum = clamp((def.momentum || 0) + (scored ? -0.6 : 0.15), -4, 5);
      ev.momentum = off.momentum >= 2.5 ? 'hot' : off.momentum <= -2.5 ? 'cold' : null;
      // 全队连续得分：记在球队上，够 3 次就提示一波流
      if (ev.pts > 0) {
        off.runStreak = (off.runStreak || 0) + 1;
        def.runStreak = 0;
        if (off.runStreak === 3) ev.teamRun = pickR(TEAM_RUN);
      } else if (ev.kind !== 'freethrow') {
        off.runStreak = 0;
      }
      // 标记本回合的攻防球员，界面上会高亮，得分的那位会闪一下
      [gs.myTeam, gs.aiTeam].forEach((t) => t.players.forEach((pl) => {
        pl.acting = false; pl.scoredNow = false;
      }));
      ev.att.acting = true; ev.dfd.acting = true;
      if (ev.pts > 0) ev.att.scoredNow = true;
      // 卡面浮字与特效
      (ev.pops || []).forEach((q2, i2) => setTimeout(() => spawnPop(q2.pid, q2.text, q2.cls), i2 * 130));
      if (ev.shake) setTimeout(() => shakeCard(ev.shake), 120);
      if (ev.slam) setTimeout(() => slamFx(ev.slam), 120);
      if (ev.streak) setTimeout(() => showStreak(ev), 300);
      if (ev.teamRun) setTimeout(() => showTeamRun(ev.teamRun), 120);
      ev.clock = gs.clock;
      out.push(ev);
      gs.possession++;
      gs.possLeft = rollPossessionLen(off, def, gs.q);

      /* =============================================================
         🧠 教练接管我方（v9.38）
         -------------------------------------------------------------
         我方的一切"比赛安排"由 coachTick 决定：
           ① 战术调整  ② 叫暂停  ③ 换人
         它**顶替**了原来的「自动换人」（aiRotate(gs,false,'my')）——
         换人只由教练做一次，不会重复执行。

         教练的评估模型看四个维度（体力/影响力/能力/效率），
         比旧的"只看体力阈值"智能得多：手感火热的球员即使累一点
         也会让他多打，打得差的即使体力还行也会换下来。

         玩家可以用「🧠 教练」按钮随时开/关（S.coachOn）。
         ============================================================= */
      if (typeof coachTick === 'function') {
        const act = coachTick(gs, ev);
        if (act.tactics) {
          try {
            pushFeedLine('🧠 <b>教练调整战术</b>：' + act.tactics.why, 'tac');
          } catch (e) {}
        }
        if (act.timeout) {
          try {
            gs.myWantTimeout = act.timeout;      // 交给外层真正叫暂停
          } catch (e) {}
        }
        if (act.subs && act.subs.length) {
          act.subs.forEach((sv) => {
            out.push({ kind: 'sub', mine: true, qEnd: false, pts: 0,
              quarter: gs.q, att: null, dfd: null, spokenBy: null,
              outName: sv.out.name, inName: sv.inn.name, why: sv.why,
              clock: gs.clock });
          });
          try {
            pushFeedLine('🧠 <b>教练换人</b>（' + act.subs[0].why + '）：' +
              act.subs.map((sv) => `${sv.out.name} ↓ / ${sv.inn.name} ↑`).join('　'), 'sub');
          } catch (e) {}
        }
      }
      /* 旧的自动换人：教练关闭时作为兜底（保持"关了也有人管"的兜底体验）。
         ★ 只在 S.coachOn === false 时生效，避免和教练重复换人。 */
      gs.aiSubCd = (gs.aiSubCd || 0) - 1;
      if (gs.aiSubCd <= 0) {
        if (S.coachOn === false && S.autoSub !== false) {
          const ms = aiRotate(gs, false, 'my');
          if (ms && ms.length) {
            ms.forEach((sv) => {
              out.push({ kind: 'sub', mine: true, qEnd: false, pts: 0,
                quarter: gs.q, att: null, dfd: null, spokenBy: null,
                outName: sv.out.name, inName: sv.inn.name, why: sv.why,
                clock: gs.clock });
            });
            try {
              pushFeedLine('🔄 <b>我方换人</b>（' + ms[0].why + '）：' +
                ms.map((sv) => `${sv.out.name} ↓ / ${sv.inn.name} ↑`).join('　'), 'sub');
            } catch (e) {}
          }
        }
        const subs = aiRotate(gs, false);
        if (subs && subs.length) {
          gs.aiSubCd = 4;                      // 几次回合内不再换，避免频繁
          subs.forEach((sv) => {
            out.push({ kind: 'sub', aiSub: true, mine: false, qEnd: false,
              pts: 0, quarter: gs.q, att: null, dfd: null, spokenBy: null,
              outName: sv.out.name, inName: sv.inn.name, why: sv.why,
              clock: gs.clock });
          });
          try {
            pushFeedLine('🔄 <b>对方换人</b>（' + subs[0].why + '）：' +
              subs.map((sv) => `${sv.out.name} ↓ / ${sv.inn.name} ↑`).join('　'), 'sub');
          } catch (e) {}
        }
      }

      /* AI 叫暂停：每回合检查一次（带冷却），
         会回体力、打断我方势头、并强制换一套战术。 */
      const to = aiTimeoutCheck(gs, ev);
      if (to) {
        try {
          pushFeedLine(`⏸ <b>对方请求暂停</b>（${to.reasons[0]}）` +
            `　剩余暂停 ${to.left} 次`, 'timeout');
          Sfx.whistle();
        } catch (e) {}
        out.push({ kind: 'timeout', aiTimeout: true, mine: false,
          reasons: to.reasons, left: to.left, qEnd: false, pts: 0,
          quarter: gs.q, att: null, dfd: null, spokenBy: null,
          clock: gs.clock });
      }
      /* 体力：只给「本回合没参与」的球员回一点气。
         原来这里是**全员**每个回合 +1.6，而参与回合的两人只掉约 1.3，
         恢复大于消耗，导致打满全场体力还是 100。
         现在参与攻防的人不回，其余人小幅恢复（模拟无球跑动少、喘口气）。 */
      const involved = {};
      if (ev.att) involved[ev.att.id] = 1;
      if (ev.dfd) involved[ev.dfd.id] = 1;
      [gs.myTeam, gs.aiTeam].forEach((t) => t.players.forEach((p) => {
        if (involved[p.id]) return;
        p.stamina.cur = Math.min(p.stamina.max, p.stamina.cur + 0.15);
      }));
    }

    if (gs.clock <= 0.001) {
      gs.clock = 0;
      // 节间：AI 教练看形势调整战术（玩家也可以在暂停里改）
      const adj = aiAdjust(gs.aiTeam, gs.myTeam, gs.q, gs.clock);
      if (adj) {   // aiAdjust 返回 {off,def,why} 或 null
        try {
          refreshLiveTac();
          pushFeedLine(`<b>对方调整</b>：进攻「${
            (OFF_TACTICS[gs.aiTeam.off] || {}).name || '?'}」防守「${
            (DEF_TACTICS[gs.aiTeam.def] || {}).name || '?'}」`, 'tac');
        } catch (e) { /* 界面没准备好就算了 */ }
      }
      if (adj && Math.random() < 0.72) {
        gs.aiTeam.off = adj.off; gs.aiTeam.def = adj.def;
        gs.aiTeam.tacticNote = { quarter: gs.q, why: adj.why,
          off: OFF_TACTICS[adj.off].name, def: DEF_TACTICS[adj.def].name };
      }
      gs.myTeam.quarterScores.push(gs.myTeam.score);
      gs.aiTeam.quarterScores.push(gs.aiTeam.score);
      const ended = { kind: 'quarterEnd', qEnd: true, quarter: gs.q,
        myScore: gs.myTeam.score, aiScore: gs.aiTeam.score, pts: 0,
        aiTactic: gs.aiTeam.tacticNote, myTactic: gs.myTeam.tacticNote };
      gs.aiTeam.tacticNote = null; gs.myTeam.tacticNote = null;
      out.push(ended);
      gs.q++;
      if (gs.q >= QUARTERS) { gs.done = true; }
      else { gs.breakLeft = 2.2; gs.clock = QUARTER_SEC; }   // 节间停 2.2 秒
      /* 节间：AI 重置"本节已用"标记，并按体力做一轮轮换 */
      {
        const at = gs.aiTeam;
        if (at && at.bench) {
          at.bench.forEach((b) => { if (b) b._usedThisQuarter = false; });
          const mt = gs.myTeam;
          if (mt && mt.bench && S.autoSub !== false) {
            mt.bench.forEach((b) => { if (b) b._usedThisQuarter = false; });
            const ms2 = aiRotate(gs, true, 'my');
            if (ms2 && ms2.length) {
              ms2.forEach((sv) => {
                out.push({ kind: 'sub', mine: true, qEnd: false, pts: 0,
                  quarter: gs.q, att: null, dfd: null, spokenBy: null,
                  outName: sv.out.name, inName: sv.inn.name,
                why: sv.why, clock: 0 });
              });
            }
          }
          const subs2 = aiRotate(gs, true);
          if (subs2 && subs2.length) {
            subs2.forEach((sv) => {
              out.push({ kind: 'sub', aiSub: true, mine: false, qEnd: false,
                pts: 0, quarter: gs.q, att: null, dfd: null, spokenBy: null,
                outName: sv.out.name, inName: sv.inn.name,
                why: sv.why, clock: 0 });
            });
          }
        }
      }
      /* 节间休息（v9.29 重做）
         ------------------------------------------------------------
         原来场上场下**恢复一样多**（都 10%），所以"把主力换下来歇一节"
         没有任何额外收益 —— 轮换在经济上是白做的。

         现在分开：
           场上球员 恢复 FA.Q_REST_ON  (10%)
           场下球员 恢复 FA.Q_REST_OFF (20%)  ← 坐板凳回得快，这才是轮换的回报
         永动机徽章（recover）对两者都乘算。
         */
      const REST_ON = (typeof FA !== 'undefined') ? FA.Q_REST_ON : 0.10;
      const REST_OFF = (typeof FA !== 'undefined') ? FA.Q_REST_OFF : 0.20;
      [gs.myTeam, gs.aiTeam].forEach((tm2) => {
        if (!tm2) return;
        const bump = (pl, rate) => {
          if (!pl || !pl.stamina) return;
          const rec = pl.stamina.recover || 1;
          pl.stamina.cur = Math.min(pl.stamina.max,
            pl.stamina.cur + pl.stamina.max * rate * rec);
        };
        (tm2.players || []).forEach((pl) => bump(pl, REST_ON));
        (tm2.bench || []).forEach((pl) => bump(pl, REST_OFF));
      });
      break;
    }
  }
  return out;
}

/** 一键扫荡：不跑时钟，直接把整场算完 */
function quickSimulate(myTeam, aiTeam) {
  const gap = myTeam.ovr - aiTeam.ovr;
  myTeam.swing = gap < 0 ? clamp(1 + (-gap) * 0.022, 1, 1.45) : 1;
  aiTeam.swing = gap > 0 ? clamp(1 + gap * 0.022, 1, 1.45) : 1;
  const gs = newGameState(myTeam, aiTeam);
  const all = [];
  let guard = 0;
  /* ★ 这里原来写着 gs.possLeft = 0.0001，想让"每次调用都推进一个回合"。
     但 advanceGame 里 step = min(dt, possLeft, clock)，possLeft 被压到
     0.0001 后**比赛时钟每回合只走 0.0001 秒**，一节 720 秒要走 720 万回合。
     guard 只跑到 5000×40 就退出，于是打了远超正常数量的回合 ——
     比分才会出现 183:104 这种离谱数字（正常约 100:100）。
     正确做法：让引擎按真实节奏跑，只需要反复给它时间片、并把节间跳过。 */
  while (!gs.done && guard++ < 20000) {
    if (gs.breakLeft > 0) { gs.breakLeft = 0; gs.clock = QUARTER_SEC; }
    const evs = advanceGame(gs, 30);        // 30 现实秒 = 180 比赛秒
    all.push(...evs);
  }
  // 诊断信息挂到全局，方便自检
  window.__quick = { calls: guard, q: gs.q, done: gs.done,
    poss: all.filter((e) => !e.qEnd).length,
    my: myTeam.score, ai: aiTeam.score };
  return all;
}

/* =============================================================
   开赛 / 时钟循环 / 界面
   ============================================================= */
/* =============================================================
   工资帽检查（v9.1）
   -------------------------------------------------------------
   工资按档位固定：银 800万 / 金（含时刻金）3000万 / 紫（含名宿紫、时刻紫）4500万。
   阵容 12 人全员计入，工资帽 4 亿。
   超过就**不允许开始比赛**，并告诉玩家超了多少、怎么降。
   ============================================================= */
/** 我当前阵容的工资合计 */
function mySalaryTotal() {
  try {
    const r = rosterIds();
    return salarySumOf((r.starters || []).concat(r.bench || []).filter(Boolean));
  } catch (e) { return 0; }
}
/** 超帽时弹窗并返回 false；没超返回 true */
function salaryGuard() {
  const total = mySalaryTotal();
  const cap = (typeof SALARY_CAP !== 'undefined') ? SALARY_CAP : 400000000;
  if (total <= cap) return true;
  const over = total - cap;
  const w = (v) => (v / 1e8).toFixed(3) + ' 亿';
  const msg = '当前工资 ' + w(total) + '，超出工资帽 ' + w(over) + '。\n'
    + '上限 ' + w(cap) + '，超出的部分必须先降下来。\n\n'
    + '去「球队管理」把高薪球员换成低档卡：\n'
    + '· 银卡只要 800 万（金卡 3000 万 / 紫卡 4500 万）\n'
    + '· 或者把用不上的球员从名单里卸下';
  try { Sfx.fail(); } catch (e) {}
  /* 用工程自带的 uiConfirm，iOS 上原生 alert 会被屏蔽 */
  if (typeof uiConfirm === 'function') {
    uiConfirm({ title: '💰 超出工资帽', body: msg, yes: '知道了', no: '去调整' })
      .then((v) => { if (v === false) { try { switchTab('team'); } catch (e) {} } });
  } else {
    toast('💰 超出工资帽 ' + w(over) + '，无法开始比赛');
  }
  return false;
}

function startBattle(mode, oppKey, atRound) {
  /* ★ v9.1 工资帽：超帽一律不许开赛（生涯 / 快速对战都走这里）。
     工资按档位固定：银 800万 / 金 3000万 / 紫 4500万，帽子 4 亿。 */
  if (typeof salaryGuard === 'function' && !salaryGuard()) return;
  // 只有从"训练赛"按钮进来的才保持练习标记，其余一律重置
  const lu = lineupIds();
  if (oppKey) BT.oppTeam = oppKey;
  BT.myTeam = buildTeam(lu.starters.concat(lu.bench), '我的球队', false);
  // 只跟 30 支 NBA 球队打 —— 对手阵容直接从联赛里取
  BT.aiTeam = buildLeagueOpponent(BT.oppTeam);
  if (!BT.myTeam.players.length) { toast('阵容不完整'); return; }
  BT.mode = mode || 'live';
  if (BT.gs) { BT.gs.aiTimeoutCd = 0; BT.gs.aiLateTO = 0; BT.gs.aiSubCd = 0; }
  // 开赛：观众入场，场馆底噪起来
  try { Sfx.whistle(); Sfx.ambienceOn(); Sfx.clap(10, 0.1); } catch (e) {}
  const myOff = S.offTac || 'balanced', myDef = S.defTac || 'man';
  BT.myTeam.off = myOff; BT.myTeam.def = myDef;
  // 纸面实力弱的一方波动更大 —— "搏一把"，冷门由此而来
  const gap = BT.myTeam.ovr - BT.aiTeam.ovr;
  BT.myTeam.swing = gap < 0 ? clamp(1 + (-gap) * 0.022, 1, 1.45) : 1;
  BT.aiTeam.swing = gap > 0 ? clamp(1 + gap * 0.022, 1, 1.45) : 1;
  const aiTac = aiPickTactics(myOff, myDef);
  BT.aiTeam.off = aiTac.off; BT.aiTeam.def = aiTac.def;
  BT.log = []; BT.phase = 'live'; BT.lastEvent = null; BT.reward = 0;
  // mode='playoff' 表示这是季后赛系列赛的一场
  BT.isPlayoffGame = (mode === 'playoff');
  /* ★ 记下"这一场对应赛程的第几轮"。
     赛程页的「亲自打这一场」打的是 nextUnplayedRound()，
     而 L.round 可能停在别的轮次 —— 结算时必须用这个值，
     否则战绩会记到错误的轮次上，导致那一轮永远显示"没打"，
     于是每次都在打同一个对手。 */
  try {
    // 指定了轮次就用指定的（赛程页点某一天挑战），否则用下一场未打的
    BT.myRound = atRound || (typeof nextUnplayedRound === 'function'
      && nextUnplayedRound()) || (typeof seasonState === 'function'
      && seasonState().round) || 1;
  } catch (e) { BT.myRound = atRound || 1; }
  // 开赛一律清零比分，避免上一场的分数残留
  BT.myTeam.score = 0; BT.aiTeam.score = 0;
  BT.myTeam.quarterScores = []; BT.aiTeam.quarterScores = [];
  Sfx.unlock();

  if (BT.mode === 'quick') {
    quickSimulate(BT.myTeam, BT.aiTeam);
    endBattle(true);
    return;
  }
  BT.gs = newGameState(BT.myTeam, BT.aiTeam);
  BT.gs.running = true;
  Sfx.reveal('gold');
  renderBattle();
  startClock();
}

/* 用 setInterval 而不是 requestAnimationFrame：
   rAF 在页面被判定为不可见时（切后台、headless）完全停摆，
   而比赛时钟需要持续走动。setInterval 最多被降频到 1 秒，不会停。 */
let clockTimer = null, lastT = 0;
function startClock() {
  stopClock();
  lastT = Date.now();
  clockTimer = setInterval(() => {
    if (!BT.gs || BT.phase !== 'live') { stopClock(); return; }
    const now = Date.now();
    const dtReal = Math.min(0.6, (now - lastT) / 1000);
    lastT = now;
    if (!BT.gs.running) return;
    // 观众底噪随分差收窄而升高，越紧张越吵
    if (BT.ambTick === undefined) BT.ambTick = 0;
    if (++BT.ambTick % 40 === 0 && BT.gs.myTeam && BT.gs.aiTeam) {
      const gap = Math.abs(BT.gs.myTeam.score - BT.gs.aiTeam.score);
      Sfx.ambienceLevel(gap <= 5 ? 0.24 : gap <= 12 ? 0.16 : 0.10);
    }
    const evs = advanceGame(BT.gs, dtReal);
    if (evs.length) {
      evs.forEach((ev) => {
        BT.log.push(ev);
        BT.lastEvent = ev;
        if (!ev.qEnd) playEventSound(ev);
      });
      if (evs.some((e) => e.qEnd)) onQuarterEnd();
      appendFeed(evs);
    }
    updateClockUI();
  bindBattleCardClick();
    if (BT.gs.done) endBattle();
  }, TICK_MS);
}
function stopClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }

function onQuarterEnd() {
  const last = BT.log[BT.log.length - 1];
  if (!last || !last.qEnd) return;
  playQuarterSound(!!last.done);
  Sfx.reveal('silver');
  if (BT.gs.done) return;
  toast(`${['第一节', '第二节', '第三节'][last.quarter] || ''}结束　${BT.myTeam.score} : ${BT.aiTeam.score}`);
}

/**
 * 暂停面板：比赛中最重要的一块。
 * 可以换人（场上 5 人 ↔ 替补席）、改战术，每次暂停消耗一次暂停次数。
 */
let subSel = null;
/* =============================================================
   暂停：60 秒布置时间
   -------------------------------------------------------------
   真实比赛一次暂停 60 秒，这里也一样 —— 比赛时钟停住，
   给你 60 秒考虑换人。倒计时结束自动继续，
   想好了也可以点「结束暂停」立刻回去打。
   ============================================================= */
const TIMEOUT_SECONDS = 60;
let timeoutTimer = null;
function openTimeout() {
  const t = BT.myTeam;
  if (!t) return;
  if (t.timeouts <= 0) { toast('暂停次数已经用完了'); return; }
  t.timeouts--;
  BT.gs.running = false;              // 比赛时钟停住
  BT.timeoutLeft = TIMEOUT_SECONDS;   // 60 秒布置时间
  Sfx.reveal('silver');
  Sfx.whistle();
  subSel = null;
  renderSubPanel();
  startTimeoutClock();
  // 暂停期间全队喘口气（和 AI 叫暂停一样的收益）
  try {
    t.players.forEach((p) => {
      if (!p.stamina) return;
      const rec = p.stamina.recover || 1;
      p.stamina.cur = Math.min(p.stamina.max,
        p.stamina.cur + p.stamina.max * 0.16 * rec);
    });
  } catch (e) {}
}
/** 暂停倒计时：每秒刷新一次界面 */
function startTimeoutClock() {
  stopTimeoutClock();
  timeoutTimer = setInterval(() => {
    if (BT.timeoutLeft == null) { stopTimeoutClock(); return; }
    BT.timeoutLeft--;
    const cd = document.getElementById('subCount');
    if (cd) {
      cd.textContent = BT.timeoutLeft;
      cd.classList.toggle('hot', BT.timeoutLeft <= 10);
    }
    if (BT.timeoutLeft <= 0) {
      stopTimeoutClock();
      Sfx.buzzer();
      closeTimeout();
    }
  }, 1000);
}
function stopTimeoutClock() {
  if (timeoutTimer) { clearInterval(timeoutTimer); timeoutTimer = null; }
}
/** 结束暂停，回到比赛 */
function closeTimeout() {
  stopTimeoutClock();
  BT.timeoutLeft = null;
  const el = $('#subLayer');
  if (el) el.classList.add('hidden');
  if (BT.gs && BT.phase === 'live') { BT.gs.running = true; lastT = Date.now(); }
  Sfx.click();
  renderBattleLive && renderBattleLive();
}
function renderSubPanel() {
  const t = BT.myTeam;
  const el = $('#subLayer');
  el.classList.remove('hidden');
  const onCourt = t.players;
  const bench = t.bench || [];
  el.innerHTML = `<div class="bt-sub">
    <div class="bt-sub-head">
      <b>暂 停</b>
      <span class="bt-sub-cd">布置时间
        <i id="subCount" class="${(BT.timeoutLeft || 0) <= 10 ? 'hot' : ''}">${
          BT.timeoutLeft != null ? BT.timeoutLeft : TIMEOUT_SECONDS}</i> 秒
        <em>· 点击场上球员与替补交换 · 剩余暂停 ${t.timeouts} 次</em></span>
      <button id="subClose">▶ 结束暂停</button>
    </div>
    <div class="bt-sub-body">
      <div class="sec-title">场 上 5 人</div>
      <div class="bt-sub-list">
        ${onCourt.map((p, i) => subRowHTML(p, 'court', i)).join('')}
      </div>
      <div class="sec-title" style="margin-top:14px">替 补 席 ${bench.length} 人</div>
      <div class="bt-sub-list">
        ${bench.length ? bench.map((p, i) => subRowHTML(p, 'bench', i)).join('')
          : '<div class="bt-none">没有替补球员，先去「编辑阵容」加人</div>'}
      </div>
      <div class="sec-title" style="margin-top:16px">调 整 战 术</div>
      <div class="bt-tacs sub">
        ${Object.values(OFF_TACTICS).map((x) => `
          <button class="bt-tac${t.off === x.key ? ' on' : ''}" data-soff="${x.key}">
            <b>${x.name}</b><i>${x.desc}</i></button>`).join('')}
      </div>
      <div class="bt-tacs sub" style="margin-top:7px">
        ${Object.values(DEF_TACTICS).map((x) => `
          <button class="bt-tac${t.def === x.key ? ' on' : ''}" data-sdef="${x.key}">
            <b>${x.name}</b><i>${x.desc}</i></button>`).join('')}
      </div>
    </div>
  </div>`;

  $('#subClose').onclick = () => {
    // 一键结束暂停，立刻回去打（不用等满 60 秒）
    closeTimeout();
    renderBattleLive();
  };
  $$('.bt-sub-row', el).forEach((b) => {
    b.onclick = () => {
      const side = b.dataset.side, i = parseInt(b.dataset.i, 10);
      if (subSel && subSel.side !== side) {
        // 一上一下，执行换人
        if (side === 'bench') doSub(subSel.i, i);
        Sfx.reveal('gold');
        subSel = null;
        renderSubPanel();
        return;
      }
      Sfx.click();
      subSel = (subSel && subSel.side === side && subSel.i === i) ? null : { side, i };
      renderSubPanel();
    };
  });
  $$('.bt-tac[data-soff]', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      t.off = b.dataset.soff;
      t.tacticNote = { off: OFF_TACTICS[t.off].name, def: DEF_TACTICS[t.def].name,
        why: '我方教练调整战术' };
      // AI 立刻针对新战术做一次反应
      if (Math.random() < 0.45) {
        const nx = aiPickTactics(t.off, t.def);
        BT.aiTeam.off = nx.off; BT.aiTeam.def = nx.def;
        toast('对方教练也跟着调整了战术');
      }
      renderSubPanel();
    };
  });
  $$('.bt-tac[data-sdef]', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      t.def = b.dataset.sdef;
      t.tacticNote = { off: OFF_TACTICS[t.off].name, def: DEF_TACTICS[t.def].name,
        why: '我方教练调整战术' };
      renderSubPanel();
    };
  });
}

function subRowHTML(p, side, i) {
  const sta = p.stamina.cur;
  const sel = subSel && subSel.side === side && subSel.i === i;
  return `<button class="bt-sub-row${sel ? ' sel' : ''}${side === 'bench' ? ' bench' : ''}"
      data-side="${side}" data-i="${i}" style="${tierVar(p.card.tier)}">
    <div class="bt-sub-img"><img src="${p.card.photo}" alt=""
      onerror="this.parentNode.style.visibility='hidden'"></div>
    <div class="bt-sub-tx">
      <b>${p.name}</b>
      <i>${p.pos} · 突破 ${p.brk} · 本场 ${p.stat.pts} 分 ${p.stat.reb} 板 ${p.stat.ast} 助</i>
      <span class="bt-sub-sta"><b style="width:${sta.toFixed(0)}%;background:${
        sta > 60 ? '#3fc46a' : sta > 30 ? '#f5c451' : '#e0233f'}"></b></span>
    </div>
    <em>${p.ovr}</em>
  </button>`;
}

/** 换人：场上 i 下，替补 j 上 */
function doSub(courtIdx, benchIdx) {
  const t = BT.myTeam;
  if (!t.bench[benchIdx]) return;
  const down = t.players[courtIdx], up = t.bench[benchIdx];
  t.players[courtIdx] = up;
  t.bench[benchIdx] = down;
  down.acting = false; down.scoredNow = false;
  up.acting = false; up.scoredNow = false;
  up.stamina.cur = Math.max(up.stamina.cur, 72);   // 刚上场的体力
  toast(`${up.name} 替补登场，换下 ${down.name}`);
  if (navigator.vibrate) navigator.vibrate(20);
}

/* =============================================================
   比赛音效：按事件类型播放，尽量还原真实赛场
   -------------------------------------------------------------
   命中 → 空心入网「唰」；打铁 → 篮筐金属声 + 全场惋惜
   扣篮 → 重击 + 篮筐震颤 + 观众炸开；盖帽 → 一巴掌 + 惊呼
   抢断 → 球鞋摩擦；罚球 → 哨声；节末 → 蜂鸣器
   观众鼓掌/欢呼/嘘声按现场气氛随机叠上去。
   ============================================================= */
function playEventSound(ev) {
  try {
    switch (ev.kind) {
      case 'made3':
        Sfx.swish();
        Sfx.cheer(1.0, 0.34, 0.05);
        Sfx.clap(10, 0.11);
        break;
      case 'made2':
        Sfx.swish();
        Sfx.cheer(0.6, 0.22, 0.05);
        break;
      case 'madeInside':
        Sfx.swish();
        Sfx.clap(6, 0.09);
        break;
      case 'madePost':
        Sfx.swish();
        Sfx.clap(5, 0.08);
        break;
      case 'dunk':
        Sfx.dunk();                       // 内部already带欢呼
        Sfx.clap(14, 0.13);
        break;
      case 'poster':
      case 'posterize':
        Sfx.dunk();
        Sfx.cheer(1.4, 0.42, 0.08);
        Sfx.clap(18, 0.15);
        break;
      case 'miss':
      case 'ftMiss': {
        // 一半打铁一半打板，声音不一样
        if (Math.random() < 0.55) Sfx.rim(); else Sfx.board();
        if (ev.pts === 0 && Math.random() < 0.45) Sfx.ooh(0.5);
        break;
      }
      case 'block':
        Sfx.blockSfx();
        break;
      case 'pin':
      case 'snatch':
      case 'rejection':
        Sfx.blockSfx();
        Sfx.cheer(1.2, 0.38, 0.06);
        Sfx.clap(14, 0.13);
        break;
      case 'steal':
        Sfx.stealSfx();
        Sfx.ooh(0.7);
        break;
      case 'crossover':
        Sfx.steps(4);
        Sfx.ooh(0.85);
        break;
      case 'turnover':
        Sfx.whistle();
        Sfx.ooh(0.4);
        break;
      case 'freethrow':
        Sfx.whistle();
        Sfx.swish();
        break;
      case 'rebound':
        Sfx.rim();
        break;
      default:
        if (ev.pts >= 2) Sfx.swish();
        else if (ev.pts === 1) { Sfx.whistle(); Sfx.swish(); }
    }
    // 罚球线/关键球额外加点紧张感
    if (ev.isClutch) { Sfx.ooh(0.6); }
  } catch (e) { /* 音效失败不能影响比赛 */ }
}

/** 节末蜂鸣器 + 全场反应 */
function playQuarterSound(isFinal) {
  try {
    Sfx.buzzer();
    if (isFinal) { Sfx.cheer(1.5, 0.4, 0.2); Sfx.clap(16, 0.13); }
    else Sfx.clap(8, 0.09);
  } catch (e) {}
}

/**
 * 比赛中的实时战术条。
 * 点一下立刻生效 —— 下一回合就按新战术打，不用等暂停。
 * 人机也会自己换（aiAdjust），换完会在这里的「对方」标签上体现。
 */
function liveTacHTML() {
  const t = BT.myTeam;
  const off = OFF_TACTICS[t.off] || OFF_TACTICS.balanced;
  const def = DEF_TACTICS[t.def] || DEF_TACTICS.man;
  const ai = BT.aiTeam;
  const aoff = OFF_TACTICS[ai.off] || OFF_TACTICS.balanced;
  const adef = DEF_TACTICS[ai.def] || DEF_TACTICS.man;
  const offKeys = ['perimeter', 'inside', 'runGun', 'balanced'];
  const defKeys = ['man', 'zone23', 'zone32'];
  return `<div class="bt-livetac">
    <span class="bt-lt-g">进攻</span>
    ${offKeys.map((k) => `<button class="bt-lt${t.off === k ? ' on' : ''}"
      data-ltoff="${k}">${OFF_TACTICS[k].short}</button>`).join('')}
    <span class="bt-lt-g">防守</span>
    ${defKeys.map((k) => `<button class="bt-lt${t.def === k ? ' on' : ''}"
      data-ltdef="${k}">${DEF_TACTICS[k].short}</button>`).join('')}
    <span class="bt-lt-ai" id="btLtAi">对方 ${aoff.short}/${adef.short}</span>
  </div>`;
}

/** 绑定实时战术按钮（只改按钮状态，不整页重绘，避免闪） */
function bindLiveTac() {
  const el = document.getElementById('scr-battle');
  if (!el || !BT.myTeam) return;
  const t = BT.myTeam;
  el.querySelectorAll('.bt-lt[data-ltoff]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.ltoff;
      if (t.off === k) return;
      t.off = k;
      S.offTac = k; Sfx.click(); save();
      refreshLiveTac();
      pushFeedLine(`<b>战术调整</b>：进攻改为「${OFF_TACTICS[k].name}」`, 'tac');
    };
  });
  el.querySelectorAll('.bt-lt[data-ltdef]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.ltdef;
      if (t.def === k) return;
      t.def = k;
      S.defTac = k; Sfx.click(); save();
      refreshLiveTac();
      pushFeedLine(`<b>战术调整</b>：防守改为「${DEF_TACTICS[k].name}」`, 'tac');
    };
  });
}

/** 刷新战术条的选中态（不重绘整页） */
/* =============================================================
   🧠 教练状态常驻行（v9.38.1）
   -------------------------------------------------------------
   玩家反馈"看不到教练在工作" —— 它的决策都混在滚动解说里。
   这里在记分条下方常驻一行，显示教练状态 + 最近一次决策。

   ★ 为什么单独成函数、在 renderBattleLive 里调用：
     第一版我把它塞进了 refreshLiveTac()，但那个函数在
     `BT.gs.breakLeft > 0`（节间）等情况下会提前 return，
     于是状态行经常根本没被创建。现在挂在每次重绘都会走的路径上。
   ============================================================= */
function renderCoachBar() {
  const el = document.getElementById('scr-battle');
  if (!el || !BT.myTeam || !BT.gs) return;
  /* =============================================================
     ★ v9.40.1：教练行放在**倒计时正下方**（中央时钟区内部）
     -------------------------------------------------------------
     用户反馈两次：
       ① 「智能教练不要移动的太下方，就在倒计时下面就行了」
       ② 「因为你的移动，我中间的文字信息被压缩了，
           还是保持原有的界面，只是把智能教练放在倒计时下面，
           整体界面不要改动」

     所以：**不动记分条的整体结构**，只把教练行塞进 `.bt-sb-clock`
     里，让它以 `flex-basis:100%` 独占第二行 ——
     即「第一行：节次 + 倒计时」「第二行：教练状态」。
     不占用下方空间，中间的文字区不会被压。

     节次标签用 `order:-1` 排在左，教练行用 `order:9` 排在最后，
     所以 DOM 顺序怎么放都不影响视觉。
     ============================================================= */
  const clockBox = el.querySelector('.bt-sb-clock');
  if (!clockBox) return;
  let bar = clockBox.querySelector('.bt-coachbar');
  if (!bar) {
    bar = document.createElement('i');
    bar.className = 'bt-coachbar';
    clockBox.appendChild(bar);
  }
  const on = (typeof coachIsOn === 'function') ? coachIsOn() : true;
  const prof = (typeof coachProfileOf === 'function') ? coachProfileOf() : { name: '教练' };
  if (!on) {
    bar.className = 'bt-coachbar off';
    bar.textContent = '🧠 ' + prof.name + ' 已关闭（你自己安排换人与战术）';
    return;
  }
  /* ★ v9.38.2：优先显示**刚发生的动作**（更有信息量），
     没有动作时显示**实时观察**（证明教练在实时工作）。
     两者都带回合号，玩家能看出它在每个回合都更新。 */
  const lastAct = BT.gs.coachLast;
  const actAt = BT.gs.coachLastAt || 0;
  const nowAt = BT.gs.possession || 0;
  const obs = BT.gs.coachObs || '正在观察场上形势…';
  let txt;
  if (lastAct && nowAt - actAt <= 2) {
    txt = lastAct;                                  // 刚做的动作
  } else {
    txt = '👁 ' + obs;                              // 实时观察
  }
  bar.className = 'bt-coachbar on';
  bar.textContent = '🧠 ' + prof.name + '　' + txt + '　（第 ' + nowAt + ' 回合）';
}

function refreshLiveTac() {
  const el = document.getElementById('scr-battle');
  if (!el || !BT.myTeam) return;
  el.querySelectorAll('.bt-lt[data-ltoff]').forEach((b) => {
    b.classList.toggle('on', b.dataset.ltoff === BT.myTeam.off);
  });
  el.querySelectorAll('.bt-lt[data-ltdef]').forEach((b) => {
    b.classList.toggle('on', b.dataset.ltdef === BT.myTeam.def);
  });
  // 记分条上的战术文字也同步
  const mt = el.querySelector('.bt-sb-side.my .bt-sb-tac');
  if (mt) mt.textContent = (DEF_TACTICS[BT.myTeam.def] || DEF_TACTICS.man).short +
    ' / ' + (OFF_TACTICS[BT.myTeam.off] || OFF_TACTICS.balanced).short;
  /* =============================================================
     🎯 实时克制提示（v9.30）
     -------------------------------------------------------------
     战术按钮上虽然标了"克谁/怕谁"，但那是**静态**的。
     玩家真正需要知道的是：「**此刻**我正在被对手克制吗」。
     这里算出双方当前的克制净收益，直接摆在记分条上 ——
     于是"看到对手换 3-2 → 我立刻改打内线"变成一个可执行的操作。
     ============================================================= */
  (function liveCounter() {
    const box = el.querySelector('.bt-sb-tac');
    if (!box || !BT.aiTeam) return;
    const myGain = counterBonus(BT.myTeam.off, BT.aiTeam.def);   // 我进攻对他的防守
    const hisGain = counterBonus(BT.aiTeam.off, BT.myTeam.def);  // 他进攻对我的防守
    const net = myGain - hisGain;                                // 净收益
    const pct = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
    let tip;
    if (Math.abs(net) < 0.008) tip = '⚖ 战术均势';
    else if (net > 0) tip = '🔥 我克制对手 ' + pct(net);
    else tip = '⚠ 我被对手克制 ' + pct(net);
    box.textContent = tip;
    box.className = 'bt-sb-tac' + (net > 0.008 ? ' up' : net < -0.008 ? ' dn' : '');
  })();
  const ft = el.querySelector('.bt-sb-side.foe .bt-sb-tac');
  if (ft) ft.textContent = (DEF_TACTICS[BT.aiTeam.def] || DEF_TACTICS.man).short +
    ' / ' + (OFF_TACTICS[BT.aiTeam.off] || OFF_TACTICS.balanced).short;
  // 对方剩余暂停数：让玩家知道 AI 还能叫几次
  let ftTo = el.querySelector('.bt-sb-side.foe .bt-sb-to');
  if (!ftTo) {
    const host = el.querySelector('.bt-sb-side.foe');
    if (host) {
      ftTo = document.createElement('i');
      ftTo.className = 'bt-sb-to';
      host.appendChild(ftTo);
    }
  }
  if (ftTo && BT.aiTeam) {
    ftTo.textContent = '⏸ ' + (BT.aiTeam.timeouts != null ? BT.aiTeam.timeouts : 0);
  }
  const ai = document.getElementById('btLtAi');
  if (ai) {
    ai.textContent = '对方 ' +
      (OFF_TACTICS[BT.aiTeam.off] || OFF_TACTICS.balanced).short + '/' +
      (DEF_TACTICS[BT.aiTeam.def] || DEF_TACTICS.man).short;
  }
}

/** 往解说流里插一条（战术调整提示用） */
function pushFeedLine(html, cls) {
  const f = document.getElementById('btFeed');
  if (!f) return;
  const d = document.createElement('div');
  d.className = 'bt-line bt-line-sys' + (cls ? ' ' + cls : '');
  d.innerHTML = html;
  f.insertBefore(d, f.firstChild);
  while (f.children.length > 40) f.removeChild(f.lastChild);
}

/** 在球员卡上冒一个浮字（篮板+1 / 助攻+1 / +3 …），飘上去淡出 */
function spawnPop(pid, text, cls) {
  const card = document.querySelector(`.bt-pc[data-pid="${pid}"]`);
  if (!card) return;
  const el = document.createElement('div');
  el.className = 'bt-pop ' + (cls || '');
  el.textContent = text;
  card.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
/** 卡面抖动（被盖、被断时） */
function shakeCard(pid) {
  const card = document.querySelector(`.bt-pc[data-pid="${pid}"]`);
  if (!card) return;
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 600);
}
/** 暴扣：全屏一次的冲击环 */
function slamFx(pid) {
  const card = document.querySelector(`.bt-pc[data-pid="${pid}"]`);
  if (!card) return;
  const r = card.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'bt-slam';
  el.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
  if (navigator.vibrate) navigator.vibrate(28);
}

/**
 * 对话气泡：从该球员的卡面位置"说出来"。
 * 对手在左栏 → 气泡往右伸；我方在右栏 → 气泡往左伸。
 * 气泡挂在 .bt-stage 上做绝对定位，这样不会被卡片的 overflow:hidden 裁掉。
 */
function sayFromCard(pid, text, mine, tier, meta) {
  const card = document.querySelector(`.bt-pc[data-pid="${pid}"]`);
  const stage = document.querySelector('.bt-stage');
  if (!card || !stage) return;
  const old = stage.querySelector(`.bt-say[data-pid="${pid}"]`);
  if (old) old.remove();

  const cr = card.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'bt-say ' + (mine ? 'mine' : 'foe') + ' t' + (tier || 1);
  el.dataset.pid = pid;
  el.innerHTML = (meta ? `<div class="bt-say-meta">${meta}</div>` : '')
    + `<div class="bt-say-txt">“${text}”</div>`;
  // 竖直方向对齐卡片中心
  el.style.top = (cr.top - sr.top + cr.height / 2) + 'px';
  // 方向：按"卡片在上半场还是下半场"决定气泡朝哪边伸。
  //   · 上半场的球队（对手）→ 气泡挂在卡牌**下方**，朝中间伸
  //   · 下半场的球队（我方）→ 气泡挂在卡牌**上方**，朝中间伸
  // 这样两支球队的气泡都朝向中间解说区，不会顶到屏幕边缘。
  const cardMidY = cr.top + cr.height / 2;
  const stageMidY = sr.top + sr.height / 2;
  const goDown = cardMidY < stageMidY;
  const gap = 7;
  el.style.top = 'auto';
  el.style.bottom = 'auto';
  el.style.left = 'auto';
  el.style.right = 'auto';
  if (goDown) {
    el.style.top = (cr.bottom - sr.top + gap) + 'px';
    // 水平方向尽量对齐卡片
    el.style.left = Math.max(6, cr.left - sr.left) + 'px';
  } else {
    el.style.bottom = (sr.bottom - cr.top + gap) + 'px';
    el.style.left = Math.max(6, cr.left - sr.left) + 'px';
  }
  el.classList.add(goDown ? 'arrow-up' : 'arrow-down');
  stage.appendChild(el);

  // 气泡不能超出场地左右：按可用宽度收一下
  const avail = sr.width - Math.max(6, cr.left - sr.left) - 12;
  el.style.maxWidth = Math.max(140, Math.min(avail, sr.width * 0.92)) + 'px';

  // 说话的球员卡面也动一下
  card.classList.remove('speaking'); void card.offsetWidth; card.classList.add('speaking');

  setTimeout(() => { el.classList.add('out'); }, 1900);
  setTimeout(() => { el.remove(); card.classList.remove('speaking'); }, 2400);
}

/** 连击触发：以球员口吻说一句 */
function showStreak(ev) {
  if (!ev.streak) return;
  const st = ev.streak;
  const tier = st.n >= 4 ? 3 : st.n >= 3 ? 2 : 1;
  const meta = st.mine
    ? `<b>${shortName(st.name)}</b> 连得 ${st.pts} 分 · ${st.n} 连中`
    : `<b>${shortName(st.name)}</b>（对方）连得 ${st.pts} 分 · ${st.n} 连中`;
  sayFromCard(st.pid, st.line, st.mine, tier, meta);
  if (tier >= 2 && st.mine) {
    confetti(['#ffd23f', '#ff6a00', '#ffffff'], 40, { power: 8 });
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

/** 团队打出一波流时的横幅（这个是全队的事，放中间） */
function showTeamRun(text) {
  const box = $('#btStreak');
  if (!box) return;
  box.className = 'bt-streak show mine';
  box.innerHTML = `<div class="bt-streak-line">${text}</div>`;
  clearTimeout(showTeamRun._t);
  showTeamRun._t = setTimeout(() => { box.className = 'bt-streak'; }, 1800);
}

function setSpeed(mult) {
  if (!BT.gs) return;
  BT.gs.speed = mult;
  renderBattleLive();
}
function togglePause() {
  if (!BT.gs) return;
  BT.gs.running = !BT.gs.running;
  Sfx.click();
  renderBattleLive();
}

function endBattle(instant) {
  stopClock();
  BT.phase = 'done';
  try {
    Sfx.ambienceOff();                  // 观众散场
    Sfx.buzzer();
    const win0 = BT.myTeam.score > BT.aiTeam.score;
    if (win0) { Sfx.cheer(1.6, 0.44, 0.15); Sfx.clap(20, 0.14); }
    else { Sfx.boo(); Sfx.clap(6, 0.07); }
  } catch (e) {}
  // 任务统计：场次/胜负/连胜
  try { qsOnBattle(BT.myTeam.score > BT.aiTeam.score, BT.myTeam.score); } catch (e) {}
  const win = BT.myTeam.score > BT.aiTeam.score;
  if (win) S.btWin = (S.btWin || 0) + 1; else S.btLose = (S.btLose || 0) + 1;
  // 奖金按「对手有多强」算：打强队赢球给得多，输球也有出场费
  const oppOvr = BT.aiTeam.ovr || 100;
  const margin = Math.abs(BT.myTeam.score - BT.aiTeam.score);
  /* v9.27：改走 league.js 的 battleReward() 唯一出口 ——
     修复「预览比实发少 13~19%」的口径分叉（见 league.js 注释）。 */
  const pay = (typeof battleReward === 'function')
    ? battleReward(oppOvr, win, margin)
    : Math.round((win ? 1 : 0.34) * (ECO.WIN_BASE + (oppOvr - 80) * ECO.WIN_PER_OVR));
  /* ★ v9.27 连胜奖金：亲手打出来的连胜才有 —— 强化「主动打比赛」
     的正反馈，避免玩家靠挂机补给攒钱（补给现在有每日上限了）。 */
  const streakInfo = win ? (typeof streakBonus === 'function'
    ? streakBonus() : { n: 0, bonus: 0 }) : { n: 0, bonus: 0 };
  const total = pay + streakInfo.bonus;
  /* 每一场都是正式比赛：计入个人战绩、写入联赛（影响排名）、累积疲劳 */
  S.coins += total;
  BT.reward = total;
  BT.streak = streakInfo.n;
  BT.streakBonus = streakInfo.bonus;
  BT.win = win;
  /* 季后赛：把这一场写进系列赛比分（普通常规赛走 settleLeagueMatch） */
  if (BT.isPlayoffGame) {
    try {
      if (typeof poManualGame === 'function') {
        poManualGame(win, BT.myTeam.score, BT.aiTeam.score);
      }
    } catch (e) { /* 季后赛模块异常不能影响比赛结算 */ }
  } else {
    try {
      settleLeagueMatch(BT.oppTeam, win, BT.myTeam.score, BT.aiTeam.score, BT.reward);
    } catch (e) { /* 联赛模块异常不能影响比赛结算 */ }
  }
  try {
    if (typeof fatigueAfterGame === 'function') fatigueAfterGame(leagueState().day);
  } catch (e) {}
  save();
  Sfx.reveal(win ? 'momentGold' : 'silver');
  renderBattleDone();
}

/* ---------- 时间显示 ---------- */
function clockText(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function scoreboardHTML() {
  const my = BT.myTeam, ai = BT.aiTeam;
  const ot = OFF_TACTICS[my.off] || OFF_TACTICS.balanced;
  const dt = DEF_TACTICS[my.def] || DEF_TACTICS.man;
  const aot = OFF_TACTICS[ai.off] || OFF_TACTICS.balanced;
  const adt = DEF_TACTICS[ai.def] || DEF_TACTICS.man;
  const gs = BT.gs;
  const q = Math.min(4, gs.q + 1);
  const inBreak = gs.breakLeft > 0;
  return `<div class="bt-board">
    <div class="bt-score ${my.score >= ai.score ? 'lead' : ''}">
      <b>${my.score}</b><span>我的球队</span></div>
    <div class="bt-mid">
      <div class="bt-clock-big">${inBreak ? '节间' : clockText(gs.clock)}</div>
      <div class="bt-clock">第 ${q} 节${gs.breakLeft > 0 ? ' · 节间' : ''}</div>
      <div class="bt-tacline">我 ${ot.short}/${dt.short}</div>
      <div class="bt-tacline foe">敌 ${aot.short}/${adt.short}</div>
      <div class="bt-qbar">${Array.from({ length: QUARTERS }, (_, i) =>
        `<i class="${i < gs.q ? 'done' : i === gs.q ? 'now' : ''}"></i>`).join('')}</div>
    </div>
    <div class="bt-score ${ai.score > my.score ? 'lead' : ''}">
      <b>${ai.score}</b><span>${ai.name}</span></div>
  </div>`;
}

/** 只更新时钟和比分，不重建整个 DOM（每帧都重建会卡） */
function updateClockUI() {
  const gs = BT.gs;
  if (!gs) return;
  const board = $('#btBoard');
  if (!board) return;
  // 时钟
  const cb = $('#btClock');
  if (cb) cb.textContent = gs.breakLeft > 0 ? '节间' : clockText(gs.clock);
  const q = $('#btQ');
  if (q) q.textContent = `第 ${Math.min(4, gs.q + 1)} 节`;
  board.querySelectorAll('.bt-qdots u').forEach((el, i) => {
    el.className = i < gs.q ? 'done' : i === gs.q ? 'now' : '';
  });
  // 比分
  [['my', BT.myTeam], ['foe', BT.aiTeam]].forEach(([side, t]) => {
    const el = board.querySelector(`[data-score="${side}"]`);
    if (el && el.textContent !== String(t.score)) {
      el.textContent = t.score;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
  });
  // 球员卡的得分与体力
  // ★ 必须按队分栏查找！如果同一张卡（比如麦迪）在两队都有，
  //   用 board.querySelector 只会命中先出现的那一张，
  //   另一张就永远不刷新 —— 这就是"某些球员不实时显示数据"的原因。
  [['my', BT.myTeam], ['foe', BT.aiTeam]].forEach(([side, t]) => {
    const scope = board.querySelector('.bt-col.' + side) || board;
    t.players.forEach((p) => {
      const box = scope.querySelector(`.bt-pc[data-pid="${p.id}"]`);
      if (!box) return;
      const pts = box.querySelector('.bt-pc-pts');
      if (pts && pts.textContent !== String(p.stat.pts)) pts.textContent = p.stat.pts;
      // ---- 五项数据实时刷新（分 / 板 / 助 / 断 / 帽）----
      // 每 TICK_MS(100ms) 跑一次，所以得分、篮板、助攻、抢断、盖帽
      // 一发生就立刻显示，不用等快进或重绘。
      const cells = box.querySelectorAll('.bt-pc-stats .bt-st');
      if (cells.length === 5) {
        const vals = [p.stat.pts, p.stat.reb, p.stat.ast, p.stat.stl, p.stat.blk];
        for (let i = 0; i < 5; i++) {
          const b = cells[i].querySelector('b');
          if (!b) continue;
          const nv = String(vals[i] || 0);
          if (b.textContent === nv) continue;
          b.textContent = nv;
          cells[i].classList.toggle('has', vals[i] > 0);
          // 数字变了就弹一下，一眼能看出是谁刚拿的数据
          if (vals[i] > 0) {
            b.classList.remove('bump');
            void b.offsetWidth;
            b.classList.add('bump');
          }
        }
      }
      const sta = box.querySelector('.bt-pc-sta b');
      if (sta) {
        sta.style.width = p.stamina.cur.toFixed(0) + '%';
        sta.style.background = p.stamina.cur > 60 ? '#3fc46a'
          : p.stamina.cur > 30 ? '#f5c451' : '#e0233f';
      }
      box.classList.toggle('acting', !!p.acting);
    });
  });
}

/* ---------- 解说 ---------- */
function eventLineHTML(ev, withQuote) {
  /* 换人 */
  if (ev && ev.kind === 'sub') {
    return `<div class="bt-line bt-sub${ev.mine ? '' : ' foe'}">
      <div class="bt-line-txt">🔄 <b>${ev.aiSub ? '对方换人' : '我方换人'}</b>
        ${ev.why ? `<em class="bt-sub-why">${ev.why}</em>` : ''}
        <span class="bt-sub-pair">${ev.outName} ↓　${ev.inName} ↑</span>
      </div></div>`;
  }
  /* AI 叫暂停：单独一条醒目提示 */
  if (ev && ev.aiTimeout) {
    return `<div class="bt-line bt-timeout${ev.mine ? '' : ' foe'}">
      <div class="bt-line-txt">⏸ <b>对方请求暂停</b>
        <span class="bt-to-why">${(ev.reasons || []).join(' · ')}</span>
        <em class="bt-to-left">剩余 ${ev.left != null ? ev.left : ''} 次</em>
      </div></div>`;
  }
  if (ev.qEnd) {
    const label = ['第一节', '第二节', '第三节', '全场'][Math.min(3, ev.quarter)] || '';
    let tac = '';
    if (ev.aiTactic) {
      tac += `<div class="bt-line-tac foe">对方教练：
        <b>${ev.aiTactic.off} / ${ev.aiTactic.def}</b>
        <i>${ev.aiTactic.why || '调整战术'}</i></div>`;
    }
    if (ev.myTactic) {
      tac += `<div class="bt-line-tac my">我方教练：
        <b>${ev.myTactic.off} / ${ev.myTactic.def}</b>
        <i>${ev.myTactic.why || '调整战术'}</i></div>`;
    }
    return `<div class="bt-line bt-qend">
      <div class="bt-line-txt">${label}结束　<b>${ev.myScore} : ${ev.aiScore}</b></div>${tac}</div>`;
  }
  const who = ev.mine ? '' : '【对方】';
  // 得分类（含各种花样）和盖帽类都要在台词前加自己的前缀
  const MADE = ['made3', 'made2', 'madeInside', 'madePost', 'dunk', 'poster',
    'posterize', 'crossover'];
  const BLOCKED = ['block', 'pin', 'snatch', 'rejection'];
  const raw = SAY[ev.kind] || SAY.miss;
  let text = pickR(raw);
  const nm = ev.att.name;
  if (MADE.indexOf(ev.kind) >= 0) {
    // 花样得分用专门的动词，普通得分用投篮方式名
    const verb = ev.kind === 'poster' ? '隔扣'
      : ev.kind === 'posterize' ? '背身隔扣'
      : ev.kind === 'dunk' ? '暴扣'
      : ev.kind === 'crossover' ? '变向过人后上篮'
      : ev.type.name;
    text = `${who}${nm} ${verb} —— ${text}`;
    if (ev.kind === 'poster' && ev.dfd) text = `${who}${nm} 隔扣 ${ev.dfd.name}！${text}`;
    if (ev.kind === 'crossover' && ev.dfd) text = `${who}${nm} 晃开 ${ev.dfd.name}！${text}`;
  } else if (ev.kind === 'miss') {
    text = ev.type.pts === 3
      ? `${who}${nm} 三分出手${text}`
      : `${who}${nm} ${ev.type.name}${text}`;
  } else if (BLOCKED.indexOf(ev.kind) >= 0) {
    const label = ev.kind === 'rejection' ? '大火锅'
      : ev.kind === 'snatch' ? '抓帽'
      : ev.kind === 'pin' ? '钉板大帽' : '大帽';
    text = `${who}${ev.dfd.name} ${label} ${nm}！${text}`;
    // 抓帽额外提示球权直接转换
    if (ev.kind === 'snatch') text += ' （球直接被没收）';
  } else if (ev.kind === 'steal') {
    text = `${who}${ev.dfd.name} 抢断 ${nm}！${text}`;
  } else text = `${who}${nm} ${text}`;
  if (ev.rebound && ev.rebounder) text += ` ${ev.rebounder.name}拼下篮板。`;
  if (ev.assist) text += ` （${ev.assist.name}助攻）`;

  const pts = ev.pts > 0 ? `<em class="bt-pts">+${ev.pts}</em>` : '';
  const clutch = ev.isClutch ? '<em class="bt-clutch">关键球</em>' : '';
  let quote = '';
  if (withQuote && ev.spokenBy && Math.random() < 0.6) {
    const qk = QUOTES[ev.kind] || QUOTES.made2;
    quote = `<div class="bt-quote"><b>${ev.spokenBy.name}</b>：“${pickR(qk)}”</div>`;
  }
  /* ---- 互喷垃圾话：有概率触发一次「挑衅 + 回击」 ----
     得手的人先开喷，被打的人立刻喷回去，两人一来一回。 */
  if (withQuote && ev.spokenBy && !ev.qEnd && Math.random() < TAUNT_RATE) {
    const tk = TAUNT[ev.kind];
    if (tk && tk.length) {
      const pair = pickR(tk);
      const rival = pickRivalPlayer(ev);
      if (rival && rival.id !== ev.spokenBy.id) {
        quote +=
          `<div class="bt-taunt">` +
            `<div class="tt-a"><b>${ev.spokenBy.name}</b>：“${pair[0]}”</div>` +
            `<div class="tt-b"><b>${rival.name}</b>：“${pair[1]}”</div>` +
          `</div>`;
      }
    }
  }
  return `<div class="bt-line bt-${ev.kind}${ev.mine ? '' : ' foe'}">
      <div class="bt-line-txt">${clutch}${text}${pts}</div>${quote}</div>`;
}
const TAUNT_RATE = 0.30;      // 每次统计类事件有 30% 概率触发互喷

/** 从「没得手的那一方」里随机挑一个球员来接话 */
function pickRivalPlayer(ev) {
  const gs = BT.gs;
  if (!gs) return null;
  // 事件是"我"打成的 → 对手接话；反之亦然
  const side = ev.mine ? gs.aiTeam : gs.myTeam;
  if (!side || !side.players || !side.players.length) return null;
  const pool = side.players.filter((p) => p && p.onCourt !== false);
  const list = pool.length ? pool : side.players;
  return pickR(side.players.filter(Boolean)) || null;
}

function appendFeed(evs) {
  const feed = $('#btFeed');
  if (!feed) return;
  const html = evs.map((e) => eventLineHTML(e, true)).join('');
  feed.insertAdjacentHTML('afterbegin', html);
  while (feed.children.length > 60) feed.removeChild(feed.lastChild);
}

/* ---------- 比赛界面 ---------- */
/** 比赛里的球员卡：点一下跳到该球员的信息页（双方都能点） */
function bindBattleCardClick() {
  const el = document.getElementById('scr-battle');
  if (!el || el._cardClickBound) return;
  el._cardClickBound = true;
  el.addEventListener('click', (e) => {
    const pc = e.target.closest && e.target.closest('.bt-pc[data-pid]');
    if (!pc) return;
    const pid = pc.dataset.pid;
    if (!pid) return;
    /* 我方球员通常自己有；对手球员没有 → forceView 只读查看。
       同时把他在场上的**真实突破等级**传进去，
       否则会显示成裸卡、徽章全空，看不出真实实力。 */
    Sfx.click();
    const all = (BT.myTeam ? BT.myTeam.players : [])
      .concat(BT.aiTeam ? BT.aiTeam.players : []);
    const hit = all.filter((x) => x && x.id === pid)[0];
    openDetail(pid, false, true, hit ? hit.brk : 0);
  });
}

function renderBattleLive() {
  const el = $('#scr-battle');
  if (!el) return;
  const gs = BT.gs;
  const inBreak = gs.breakLeft > 0;
  el.innerHTML = `
    <div id="btBoard" class="bt-stage">
      <div class="bt-scorebar">
        <div class="bt-sb-side foe">
          <span class="bt-sb-name">${BT.aiTeam.name}</span>
          <b class="bt-sb-score" data-score="foe">${BT.aiTeam.score}</b>
          <i class="bt-sb-tac">${(DEF_TACTICS[BT.aiTeam.def] || DEF_TACTICS.man).short} / ${
            (OFF_TACTICS[BT.aiTeam.off] || OFF_TACTICS.balanced).short}</i>
          <i class="bt-sb-to">⏸ ${BT.aiTeam.timeouts != null ? BT.aiTeam.timeouts : 0}</i>
        </div>
        <div class="bt-sb-clock">
          <b id="btClock">${inBreak ? '节间' : clockText(gs.clock)}</b>
          <span id="btQ">第 ${Math.min(4, gs.q + 1)} 节</span>
          <i class="bt-qdots">${Array.from({ length: QUARTERS }, (_, i) =>
            `<u class="${i < gs.q ? 'done' : i === gs.q ? 'now' : ''}"></u>`).join('')}</i>
        </div>
        <div class="bt-sb-side my">
          <span class="bt-sb-name">我的球队</span>
          <b class="bt-sb-score" data-score="my">${BT.myTeam.score}</b>
          <i class="bt-sb-tac">${(DEF_TACTICS[BT.myTeam.def] || DEF_TACTICS.man).short} / ${
            (OFF_TACTICS[BT.myTeam.off] || OFF_TACTICS.balanced).short}</i>
        </div>
      </div>
      <div class="bt-cols">
        ${btTeamCol(BT.aiTeam, 'foe')}
        <div class="bt-middle">
          <div class="bt-feed" id="btFeed">
            ${BT.log.slice().reverse().slice(0, 40).map((e) => eventLineHTML(e, true)).join('')}
          </div>
        </div>
        ${btTeamCol(BT.myTeam, 'my')}
      </div>
    </div>
    ${liveTacHTML()}
    <div class="bt-actions">
      <button class="bt-step" id="btTimeout">⏸ 暂停 <i>${BT.myTeam.timeouts}</i></button>
      <button class="bt-resume" id="btPause">${gs.running ? '▶' : '⏸'}</button>
      <div class="bt-speeds">
        ${[1, 2, 4].map((m) => `<button class="bt-sp${gs.speed === m ? ' on' : ''}"
          data-sp="${m}">${m}x</button>`).join('')}
      </div>
      <button class="bt-step${coachIsOn() ? ' on' : ''}" id="btCoach"
        title="教练接管：自动换人 / 叫暂停 / 调战术（点击可开或关）">${
        coachIsOn() ? '🧠 教练已接管' : '🧠 教练已关闭'}</button>
      <button class="bt-quit" id="btSkip">一键扫荡</button>
    </div>`;

  try { renderCoachBar(); } catch (e) {}
  bindLiveTac();
  const pb = $('#btPause');
  if (pb) pb.onclick = () => togglePause();
  const tb = $('#btTimeout');
  if (tb) tb.onclick = () => openTimeout();
  $$('.bt-sp', el).forEach((b) => {
    b.onclick = () => { Sfx.click(); setSpeed(parseInt(b.dataset.sp, 10)); };
  });
  const asb = $('#btCoach');
  if (asb) asb.onclick = () => {
    const on = coachToggle();
    Sfx.click();
    /* =============================================================
       ★ v9.38.1 修：按钮**只负责开关，不再"立刻执行一次"**
       -------------------------------------------------------------
       原来开启时会在 handler 里直接调一次 coachTick，本意是"让玩家
       马上看到教练工作"，但结果是：
         · 每次点按钮都强制产生一次换人/战术动作
         · 玩家因此以为"**只有点按钮教练才工作**"（实际它一直在跑）
       现在去掉了这个即时执行 —— 教练由比赛循环每回合驱动。

       改为在解说里**明确告知教练已接管**，让"持续运作"可见。
       ============================================================= */
    if (on) {
      toast('🧠 教练已接管：会自动换人 / 叫暂停 / 调战术（比赛进行中持续生效）');
      try {
        pushFeedLine('🧠 <b>教练接管比赛</b>　他会根据'
          + '<b>体力 / 影响力 / 能力 / 效率</b>持续调整阵容与战术', 'tac');
      } catch (e) {}
    } else {
      toast('🧠 教练已关闭（自己安排换人与战术；基础轮换仍会兜底）');
      try {
        pushFeedLine('🧠 <b>教练已关闭</b>　接下来由你自己安排', 'tac');
      } catch (e) {}
    }
    /* ★ 立刻同步按钮文案与状态类。
       只调 renderBattleLive() 在暂停时不会重绘（该函数开头会 return），
       所以这里直接改按钮本身，保证点了就有反馈。 */
    asb.textContent = on ? '🧠 教练已接管' : '🧠 教练已关闭';
    asb.classList.toggle('on', on);
    renderBattleLive();
  };
  const sk = $('#btSkip');
  if (sk) sk.onclick = () => {
    Sfx.click();
    stopClock();
    // 把剩下的比赛时间直接推完
    let guard = 0;
    while (!BT.gs.done && guard++ < 8000) {
      BT.gs.breakLeft = 0;
      const evs = advanceGame(BT.gs, 1000);
      evs.forEach((ev) => { BT.log.push(ev); if (!ev.qEnd) BT.lastEvent = ev; });
    }
    renderBattleLive();
    endBattle(true);
  };
}

/* ---------- 赛后 ---------- */
/** 全队汇总条：比分之外一眼能看出的几项对比 */
function statSummaryHTML(team) {
  const t = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0 };
  team.players.forEach((p) => Object.keys(t).forEach((k) => { t[k] += p.stat[k] || 0; }));
  const fgp = t.fga ? Math.round((t.fgm / t.fga) * 100) : 0;
  const tpp = t.tpa ? Math.round((t.tpm / t.tpa) * 100) : 0;
  const items = [
    ['得分', t.pts], ['篮板', t.reb], ['助攻', t.ast],
    ['抢断', t.stl], ['盖帽', t.blk], ['失误', t.to],
    ['投篮', t.fgm + '/' + t.fga], ['命中率', fgp + '%'],
    ['三分', t.tpm + '/' + t.tpa], ['三分率', tpp + '%'],
  ];
  return `<div class="bt-sum-grid">${items.map(([k, v]) =>
    `<div class="bt-sum-i"><i>${k}</i><b>${v}</b></div>`).join('')}</div>`;
}

/** 一支球队的技术统计表（含全队合计行） */
function statsTableHTML(team) {
  const tot = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0 };
  const rows = team.players.map((p) => {
    const st = p.stat;
    ['pts', 'reb', 'ast', 'stl', 'blk', 'to', 'fgm', 'fga', 'tpm', 'tpa']
      .forEach((k) => { tot[k] += st[k] || 0; });
    return `<tr>
      <td class="nm">${p.name}</td>
      <td>${st.pts}</td><td>${st.reb}</td><td>${st.ast}</td>
      <td>${st.stl}</td><td>${st.blk}</td><td>${st.to}</td>
      <td>${st.fgm}/${st.fga}</td>
      <td>${st.tpm}/${st.tpa}</td></tr>`;
  }).join('');
  const pct = (m, a) => a ? (m / a * 100).toFixed(0) + '%' : '—';
  const teamRow = team.bench && team.bench.length ? `
    <div class="bt-bench-note">未上场替补 ${team.bench.length} 人：
      ${team.bench.map((p) => shortName(p.name)).join('、')}</div>` : '';
  return `<div class="bt-stats-wrap"><table class="bt-stats">
      <thead><tr><th>球员</th><th>分</th><th>板</th><th>助</th><th>断</th><th>帽</th>
        <th>失</th><th>投篮</th><th>三分</th></tr></thead>
      <tbody>${rows}
        <tr class="bt-total">
          <td class="nm">全队</td>
          <td>${tot.pts}</td><td>${tot.reb}</td><td>${tot.ast}</td>
          <td>${tot.stl}</td><td>${tot.blk}</td><td>${tot.to}</td>
          <td>${tot.fgm}/${tot.fga} <i>${pct(tot.fgm, tot.fga)}</i></td>
          <td>${tot.tpm}/${tot.tpa} <i>${pct(tot.tpm, tot.tpa)}</i></td>
        </tr>
      </tbody>
    </table></div>${teamRow}`;
}

function renderBattleDone() {
  const el = $('#scr-battle');
  const my = BT.myTeam, ai = BT.aiTeam;
  const win = BT.win;
  const mvp = my.players.slice().sort((a, b) =>
    (b.stat.pts * 2 + b.stat.reb + b.stat.stl * 2 + b.stat.blk * 2) -
    (a.stat.pts * 2 + a.stat.reb + a.stat.stl * 2 + a.stat.blk * 2))[0];
  const line = (p) => `<tr>
      <td class="nm">${p.name}</td>
      <td>${p.stat.pts}</td><td>${p.stat.reb}</td><td>${p.stat.ast}</td><td>${p.stat.stl}</td>
      <td>${p.stat.blk}</td><td>${p.stat.to}</td>
      <td>${p.stat.fgm}/${p.stat.fga}</td>
      <td>${p.stat.tpm}/${p.stat.tpa}</td></tr>`;
  el.innerHTML = `<div class="pad">
    <div class="bt-result ${win ? 'win' : 'lose'}">
      <b>${win ? '胜 利' : '失 利'}</b>
      <div class="bt-final">${my.score} : ${ai.score}</div>
      <span>${win ? '干得漂亮，继续下一场' : '再来一次，调整一下阵容'}</span>
      ${win ? `<div class="bt-reward">奖金 🪙${fmt(BT.reward || 0)}${
        BT.streakBonus ? `<em class="bt-streak">🔥 ${typeof streakBonusText === 'function'
          ? streakBonusText() : (BT.streak + ' 连胜')}</em>` : ''}</div>` : ''}
    </div>

    <div class="bt-qtable">
      <div class="bt-qrow head"><span>节次</span>${[1, 2, 3, 4].map((i) => `<span>${i}</span>`).join('')}<span>总分</span></div>
      <div class="bt-qrow"><span>我方</span>${[0, 1, 2, 3].map((i) => `<span>${my.quarterScores[i] || 0}</span>`).join('')}<span><b>${my.score}</b></span></div>
      <div class="bt-qrow"><span>对方</span>${[0, 1, 2, 3].map((i) => `<span>${ai.quarterScores[i] || 0}</span>`).join('')}<span><b>${ai.score}</b></span></div>
    </div>

    <div class="bt-mvp">
      🏅 全场最佳：<b>${mvp ? mvp.name : '—'}</b>
      ${mvp ? `（${mvp.stat.pts} 分 ${mvp.stat.reb} 篮板 ${mvp.stat.ast} 助攻 ${mvp.stat.stl} 抢断 ${mvp.stat.blk} 盖帽）` : ''}
      ${mvp ? `<div class="bt-quote"><b>${mvp.name}</b>：“${pickR(win ? QUOTES.win : QUOTES.lose)}”</div>` : ''}
    </div>

    <div class="bt-stat-head">
      <span class="sec-title" style="margin:0">技 术 统 计</span>
      <!-- 两块数据：我的 / 对方的，点标签切换 -->
      <div class="bt-stat-tabs" role="tablist">
        <button class="bt-stat-tab on" data-team="my" role="tab">
          <b>我的数据</b><em>我的球队</em></button>
        <button class="bt-stat-tab" data-team="foe" role="tab">
          <b>对方数据</b><em>${ai.name}</em></button>
      </div>
    </div>
    <div class="bt-stat-sum" id="btStatSum">${statSummaryHTML(my)}</div>
    <div id="btStatBox">${statsTableHTML(my)}</div>

    <div class="bt-reward">比赛奖金 <b>🪙 +${fmt(BT.reward)}</b>
      <span>（${win ? '胜利全额 + 分差加成' : '失利 32%'}）</span></div>

    <div class="bt-actions2">
      <button class="bt-again" id="btAgain">继续生涯 ▸</button>
      <button class="bt-back" id="btBack">再打一场</button>
    </div>
    <div class="bt-rule">比分与结果由球员能力值、徽章、体力与随机波动共同决定。
      照片来源 Wikimedia Commons。</div>
  </div>`;
  // 技术统计切换：我方 / 对面
  $$('.bt-stat-tab', el).forEach((b) => {
    b.onclick = () => {
      Sfx.click();
      $$('.bt-stat-tab', el).forEach((x) => x.classList.toggle('on', x === b));
      const who = b.dataset.team === 'my' ? my : ai;
      $('#btStatBox').innerHTML = statsTableHTML(who);
      const sum = $('#btStatSum');
      if (sum) sum.innerHTML = statSummaryHTML(who);
    };
  });
  /* 赛后一定回到生涯模式 —— 否则玩家会卡在赛后页面，
     看不到下一个对手，也没法再点「挑战」。 */
  const backToCareer = () => {
    BT.phase = 'setup';
    BT.myRound = null;
    crSelRound = null;
    renderBattle();
  };
  const ag = $('#btAgain');
  if (ag) ag.onclick = () => { Sfx.click(); backToCareer(); };
  const bk = $('#btBack');
  if (bk) bk.onclick = () => {
    Sfx.click();
    // 直接打赛程里的下一场
    try {
      const nx = (typeof nextUnplayedRound === 'function') && nextUnplayedRound();
      const fx = nx && myFixture(nx);
      if (fx) { startBattle('live', fx.opp); return; }
    } catch (e) {}
    backToCareer();
  };
}

/* ---------- 调试：?tactest=1 实时换战术自检 ---------- */
(function liveTacTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('tactest')) return;
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          const btns = el.querySelectorAll('.bt-lt');
          out.push('战术按钮=' + btns.length + '个（应为 7）');
          const on = el.querySelectorAll('.bt-lt.on');
          out.push('初始选中=' + on.length + '个');
          // 点「外线」
          const per = el.querySelector('.bt-lt[data-ltoff="perimeter"]');
          per.click();
          out.push('点外线 → team.off=' + BT.myTeam.off +
            (BT.myTeam.off === 'perimeter' ? ' ✓' : ' ✗'));
          out.push('  S.offTac=' + S.offTac + (S.offTac === 'perimeter' ? ' ✓' : ' ✗'));
          out.push('  按钮高亮=' +
            (el.querySelector('.bt-lt[data-ltoff="perimeter"]').classList.contains('on') ? '✓' : '✗'));
          // 点「2-3 联防」
          el.querySelector('.bt-lt[data-ltdef="zone23"]').click();
          out.push('点2-3 → team.def=' + BT.myTeam.def +
            (BT.myTeam.def === 'zone23' ? ' ✓' : ' ✗'));
          // 解说流里应有战术提示
          const sys = el.querySelectorAll('.bt-line-sys').length;
          out.push('解说流战术提示=' + sys + '条' + (sys >= 2 ? ' ✓' : ' ✗'));
          // 记分条同步
          const mt = el.querySelector('.bt-sb-side.my .bt-sb-tac');
          out.push('记分条显示「' + (mt ? mt.textContent : '?') + '」' +
            (mt && mt.textContent.indexOf('2-3') >= 0 ? ' ✓' : ' ✗'));
          // 真的影响比赛：换战术后继续打，看是否还在跑
          const c0 = BT.gs.clock;
          setTimeout(() => {
            out.push('换战术后时钟继续=' + (BT.gs.clock !== c0 ? '✓' : '✗'));
            out.push('比分 ' + BT.myTeam.score + ':' + BT.aiTeam.score);
            // AI 会不会自己换
            let aiChanged = false;
            const a0 = BT.aiTeam.off + '/' + BT.aiTeam.def;
            for (let i = 0; i < 40 && !aiChanged; i++) {
              aiAdjust(BT.aiTeam, BT.myTeam, 3, 200);
              if (BT.aiTeam.off + '/' + BT.aiTeam.def !== a0) aiChanged = true;
            }
            out.push('AI能自主换战术=' + (aiChanged ? '✓' : '（本局没触发）'));
            document.title = 'TAC ' + out.join(' | ');
          }, 1500);
        }, 700);
      }, 500);
    }, 700);
  } catch (e) { document.title = 'TAC-ERR ' + e.message; }
})();

/* ---------- 调试：?saytest=1 统计一场比赛里各种事件出现次数 ---------- */
(function sayTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('saytest')) return;
    setTimeout(() => {
      // 直接模拟很多回合，统计事件分布
      const r = rosterIds();
      const mine = buildTeam(r.starters.concat(r.bench), '我的球队', false);
      const opp = buildLeagueOpponent(q.get('oppteam') || 'lal');
      const gs = newGameState(mine, opp);
      const cnt = {};
      for (let i = 0; i < 4000; i++) {
        const ev = playPossession(gs.myTeam, gs.aiTeam, true);
        if (ev) cnt[ev.kind || 'unknown'] = (cnt[ev.kind || 'unknown'] || 0) + 1;
        const ev2 = playPossession(gs.aiTeam, gs.myTeam, false);
        if (ev2) cnt[ev2.kind || 'unknown'] = (cnt[ev2.kind || 'unknown'] || 0) + 1;
      }
      const total = Object.keys(cnt).reduce((s, k) => s + cnt[k], 0);
      const rows = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])
        .map((k) => k + ':' + cnt[k] + '(' + (cnt[k] / total * 100).toFixed(1) + '%)');
      // 每种事件是否都有台词
      const missing = Object.keys(cnt).filter((k) => !SAY[k]);
      document.title = 'SAY ' + total + '回合 | ' + rows.join(' ') +
        ' | 缺台词=' + (missing.length ? missing.join(',') : '无 ✓');
    }, 900);
  } catch (e) { document.title = 'SAY-ERR ' + e.message; }
})();

/* ---------- 调试：?rttest=1 数据实时刷新自检 ---------- */
(function realTimeStatTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('rttest')) return;
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          const card0 = el.querySelector('.bt-pc[data-pid]');
          if (!card0) { document.title = 'RT 找不到球员卡'; return; }
          const cells = card0.querySelectorAll('.bt-pc-stats .bt-st');
          out.push('数据格=' + cells.length + '个（应为 5）');
          // 采样 3 秒内 DOM 上的数字变化次数
          const snap = () => [...el.querySelectorAll('.bt-pc-stats .bt-st b')]
            .map((b) => b.textContent).join(',');
          let changes = 0, last = snap();
          const t0 = Date.now();
          const iv = setInterval(() => {
            const now = snap();
            if (now !== last) { changes++; last = now; }
            if (Date.now() - t0 > 4000) {
              clearInterval(iv);
              out.push('4秒内全场数据变化 ' + changes + ' 次' +
                (changes > 0 ? ' ✓ 实时刷新' : ' ✗ 没变'));
              // 全队有没有人拿到数据
              const all = [...el.querySelectorAll('.bt-myTeam .bt-pc, .bt-pc')];
              let got = 0;
              el.querySelectorAll('.bt-pc-stats .bt-st b').forEach((b) => {
                if (parseInt(b.textContent, 10) > 0) got++;
              });
              out.push('全场有数据的格子=' + got + '个' + (got > 0 ? ' ✓' : ' ✗'));
              // 得分和卡片上显示的一致
              let mismatch = 0;
              [BT.myTeam, BT.aiTeam].forEach((t) => {
                t.players.forEach((p) => {
                  const c = el.querySelector(`.bt-pc[data-pid="${p.id}"]`);
                  if (!c) return;
                  const b = c.querySelector('.bt-pc-stats .bt-st.main b');
                  if (b && parseInt(b.textContent, 10) !== p.stat.pts) mismatch++;
                });
              });
              out.push('卡面得分与数据一致=' + (mismatch === 0 ? '✓' : '✗ ' + mismatch + '处不符'));
              out.push('比分 ' + BT.myTeam.score + ':' + BT.aiTeam.score);
              document.title = 'RT ' + out.join(' | ');
            }
          }, 250);
        }, 900);
      }, 500);
    }, 600);
  } catch (e) { document.title = 'RT-ERR ' + e.message; }
})();

/* ---------- 调试：?unloadtest=1 卸下球员自检 ---------- */
(function unloadTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('unloadtest')) return;
    setTimeout(() => {
      const out = [];
      switchTab('team');
      setTimeout(() => {
        const r0 = rosterIds();
        const st0 = r0.starters.filter(Boolean).length;
        const bn0 = r0.bench.filter(Boolean).length;
        out.push('初始 首发' + st0 + ' 替补' + bn0);
        const removed = r0.starters[2];
        out.push('要卸下 首发第3位=' +
          (removed ? CARD_BY_ID[removed].name : '空'));

        // ① 卸下首发
        unloadSlot('court', 2);
        let r1 = rosterIds();
        out.push('卸下后 首发' + r1.starters.filter(Boolean).length +
          ' 第3位=' + (r1.starters[2] ? CARD_BY_ID[r1.starters[2]].name : '空') +
          (r1.starters[2] === null ? ' ✓留空' : ' ✗被自动补上了'));
        // ② 这个人应该回到可用池
        const inRoster = r1.starters.includes(removed) || r1.bench.includes(removed);
        out.push('回到可用球员池=' + (!inRoster ? '✓' : '✗'));
        // ③ 总数少 1
        out.push('名单 ' + (st0 + bn0) + '→' +
          (r1.starters.filter(Boolean).length + r1.bench.filter(Boolean).length) +
          (r1.starters.filter(Boolean).length + r1.bench.filter(Boolean).length === st0 + bn0 - 1 ? ' ✓' : ' ✗'));
        // ④ 卸下替补
        const bRm = r1.bench[1];
        unloadSlot('bench', 1);
        const r2 = rosterIds();
        out.push('卸下替补1格=' + (r2.bench[1] === null ? '✓留空' : '✗'));
        // ⑤ 唯一性
        const all = r2.starters.concat(r2.bench).filter(Boolean);
        out.push('唯一性=' + (new Set(all).size === all.length ? '✓' : '✗'));
        // ⑥ 界面上的 ✕ 按钮
        switchTab('team');
        setTimeout(() => {
          const btns = document.querySelectorAll('.tm-unload');
          out.push('界面 ✕ 按钮=' + btns.length + '个（应等于当前场上人数）');
          // ⑦ 自动补满
          refillRoster();
          const r3 = rosterIds();
          out.push('自动补满后 首发' + r3.starters.filter(Boolean).length +
            ' 替补' + r3.bench.filter(Boolean).length +
            (r3.starters.filter(Boolean).length === 5 ? ' ✓' : ' ✗'));
          document.title = 'UNLOAD ' + out.join(' | ');
        }, 400);
      }, 600);
    }, 700);
  } catch (e) { document.title = 'UNLOAD-ERR ' + e.message; }
})();

/* ---------- 调试：?replacetest=1 卸下后再放回去的完整流程 ---------- */
(function replaceTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('replacetest')) return;
    setTimeout(() => {
      const out = [];
      const nm = (id) => (id ? shortName(CARD_BY_ID[id].name) : '空');
      switchTab('team');
      setTimeout(() => {
        // ① 先卸下一个首发
        let r = rosterIds();
        const victim = r.starters[1];
        unloadSlot('court', 1);
        r = rosterIds();
        out.push('卸下 ' + nm(victim) + ' → 首发第2位=' + nm(r.starters[1]) +
          (r.starters[1] === null ? ' ✓' : ' ✗'));

        // ② 从可用球员池里挑一个新人放回去
        const all = ownedByOvr().filter((c) =>
          !r.starters.includes(c.id) && !r.bench.includes(c.id));
        const fresh = all[0];
        out.push('从池子里放回 ' + nm(fresh.id));
        putOnCourtSilent(fresh.id, 1);
        r = rosterIds();
        out.push('放回后 首发第2位=' + nm(r.starters[1]) +
          (r.starters[1] === fresh.id ? ' ✓真的放进去了' : ' ✗没放进去'));
        out.push('  存档里也是=' + ((S.roster.starters || [])[1] === fresh.id ? '✓' : '✗'));

        // ③ 卸下再放回，用点击按钮的方式（非 silent）
        r = rosterIds();
        const v2 = r.starters[3];
        unloadSlot('court', 3);
        r = rosterIds();
        out.push('再卸下 ' + nm(v2) + ' → 第4位=' + nm(r.starters[3]) +
          (r.starters[3] === null ? ' ✓' : ' ✗'));
        putOnCourt(v2, 3);
        r = rosterIds();
        out.push('原人放回 第4位=' + nm(r.starters[3]) +
          (r.starters[3] === v2 ? ' ✓' : ' ✗'));

        // ④ 卸下首发 → 放到替补
        r = rosterIds();
        const v3 = r.starters[4];
        unloadSlot('court', 4);
        r = rosterIds();
        const emptyBench = r.bench.indexOf(null);
        putOnBench(v3, emptyBench >= 0 ? emptyBench : 0);
        r = rosterIds();
        const inBench = r.bench.includes(v3);
        out.push('首发卸下后放替补 ' + nm(v3) + ' → ' +
          (inBench ? '✓在替补席' : '✗没进替补'));
        out.push('  首发第5位=' + nm(r.starters[4]) +
          (r.starters[4] === null ? ' ✓留空' : ' ✗'));

        // ⑤ 唯一性 + 界面
        const ids = r.starters.concat(r.bench).filter(Boolean);
        out.push('唯一性=' + (new Set(ids).size === ids.length ? '✓' : '✗') +
          ' 共' + ids.length + '人');

        switchTab('team');
        setTimeout(() => {
          const el = document.getElementById('scr-team');
          const st = el.querySelectorAll('.tm-slot-face').length;
          const bn = el.querySelectorAll('.tm-bslot-face').length;
          out.push('界面 首发卡=' + st + ' 替补卡=' + bn);
          out.push('无异常');
          document.title = 'REPLACE ' + out.join(' | ');
        }, 500);
      }, 600);
    }, 700);
  } catch (e) { document.title = 'REPLACE-ERR ' + e.message; }
})();

/* ---------- 调试：?rt2test=1 两队同名球员都要实时刷新 ---------- */
(function rt2Test() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('rt2test')) return;
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          // 找出两队都有的同一张卡
          const myIds = BT.myTeam.players.map((p) => p.id);
          const foeIds = BT.aiTeam.players.map((p) => p.id);
          const dup = myIds.filter((x) => foeIds.includes(x));
          out.push('两队重复球员 ' + dup.length + ' 个' +
            (dup.length ? '（' + dup.map((x) => shortName(CARD_BY_ID[x].name)).join(',') + '）' : ''));
          // 每张卡是否能被各自分栏找到
          let miss = 0;
          [['my', BT.myTeam], ['foe', BT.aiTeam]].forEach(([side, t]) => {
            const scope = el.querySelector('.bt-col.' + side);
            if (!scope) { miss += 5; return; }
            t.players.forEach((p) => {
              if (!scope.querySelector('.bt-pc[data-pid="' + p.id + '"]')) miss++;
            });
          });
          out.push('分栏内找不到的卡 ' + miss + ' 张' + (miss === 0 ? ' ✓' : ' ✗'));
          // 采样：两队所有卡的数据是否都在变
          const snap = () => [...el.querySelectorAll('.bt-pc-stats .bt-st b')]
            .map((b) => b.textContent).join(',');
          let last = snap(), changes = 0;
          const t0 = Date.now();
          const iv = setInterval(() => {
            const n = snap();
            if (n !== last) { changes++; last = n; }
            if (Date.now() - t0 > 5000) {
              clearInterval(iv);
              out.push('5秒内数据变化 ' + changes + ' 次' +
                (changes > 0 ? ' ✓' : ' ✗'));
              // 每张卡的数字是否与玩家数据一致
              let bad = 0;
              [['my', BT.myTeam], ['foe', BT.aiTeam]].forEach(([side, t]) => {
                const scope = el.querySelector('.bt-col.' + side);
                t.players.forEach((p) => {
                  const c = scope.querySelector('.bt-pc[data-pid="' + p.id + '"]');
                  if (!c) return;
                  const b = c.querySelector('.bt-pc-stats .bt-st.main b');
                  if (b && parseInt(b.textContent, 10) !== p.stat.pts) bad++;
                });
              });
              out.push('卡面得分与数据一致 ' + (bad === 0 ? '✓' : '✗' + bad + '处'));
              out.push('比分 ' + BT.myTeam.score + ':' + BT.aiTeam.score);
              document.title = 'RT2 ' + out.join(' | ');
            }
          }, 250);
        }, 900);
      }, 500);
    }, 600);
  } catch (e) { document.title = 'RT2-ERR ' + e.message; }
})();

/* ---------- 调试：?locktest=1 球员锁定自检 ---------- */
(function lockTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('locktest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    const oc = window.confirm; window.confirm = () => true;
    setTimeout(() => {
      const out = [];
      const top = CARDS.slice(0, 5);
      top.forEach((c) => { S.owned[c.id] = { got: 3, dup: 2, brk: 0 }; });
      S.locked = {};
      S.coins = 1000;
      const A = top[0].id, B = top[1].id;
      out.push('初始 锁定数=' + lockedCount());

      // ① 锁定 A
      toggleLock(A);
      out.push('锁定 A ' + CARD_BY_ID[A].name + ' → 锁定数=' + lockedCount() +
        (isLocked(A) ? ' ✓' : ' ✗'));

      // ② 单卖被拦
      const r1 = sellPlayer(A);
      out.push('单卖锁定球员=' + (r1.ok ? '✗竟然卖了' : '✓被拦下') +
        ' 「' + (r1.why || '') + '」');

      // ③ 一键清仓跳过锁定球员
      const before = holdings(A).total;
      const r2 = sellAllOfTier('purple', { protectLineup: false });
      out.push('一键清仓后 ' + CARD_BY_ID[A].name + ' 持有 ' +
        before + '→' + holdings(A).total +
        (holdings(A).total === before ? ' ✓没被动' : ' ✗被卖了'));

      // ④ 未锁定的能正常卖
      const r3 = sellPlayer(B);
      out.push('卖未锁定的 ' + CARD_BY_ID[B].name + '=' +
        (r3.ok ? '✓成功' : '✗' + r3.why));
      removeOneCopy(B);
      out.push('  持有 3→' + holdings(B).total +
        (holdings(B).total === 2 ? ' ✓' : ' ✗'));

      // ⑤ 解锁后能卖
      toggleLock(A);
      out.push('解锁 A → 锁定数=' + lockedCount() +
        (isLocked(A) ? ' ✗' : ' ✓'));
      const r4 = sellPlayer(A);
      out.push('解锁后单卖=' + (r4.ok ? '✓成功' : '✗' + r4.why));

      // ⑥ 界面按钮
      switchTab('team');
      setTimeout(() => {
        const btns = document.querySelectorAll('.lockbtn');
        out.push('界面锁定按钮=' + btns.length + '个');
        const on = document.querySelectorAll('.lockbtn.on').length;
        out.push('已锁定高亮=' + on + '个');
        out.push('异常=' + (errs.length ? '✗ ' + errs.join(';') : '无 ✓'));
        window.confirm = oc;
        document.title = 'LOCK ' + out.join(' | ');
      }, 500);
    }, 800);
  } catch (e) { document.title = 'LOCK-ERR ' + e.message; }
})();

/* ---------- 调试：?taunttest=1 互喷垃圾话自检 ---------- */
(function tauntTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('taunttest')) return;
    setTimeout(() => {
      const out = [];
      // TAUNT 数据完整性
      const keys = Object.keys(TAUNT);
      let pairs = 0, bad = 0;
      keys.forEach((k) => {
        (TAUNT[k] || []).forEach((p) => {
          if (!Array.isArray(p) || p.length !== 2 || !p[0] || !p[1]) bad++;
          else pairs++;
        });
      });
      out.push('互喷类别 ' + keys.length + ' 类 / ' + pairs + ' 组（每组一问一答）' +
        (bad === 0 ? ' ✓' : ' ✗' + bad + '组格式错误'));
      // 每个统计类事件都有对喷可触发吗
      const kinds = Object.keys(SAY);
      const missK = kinds.filter((k) => !TAUNT[k] && k !== 'quarterEnd' && k !== 'clutch');
      out.push('缺少对喷台词的事件: ' + (missK.length ? missK.join(',') : '无 ✓'));
      // 实战：跑一局看有没有真的喷起来
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          const taunts = el.querySelectorAll('.bt-taunt');
          out.push('回合计 ' + (BT.log ? BT.log.length : 0));
          out.push('本局互喷 ' + taunts.length + ' 次' +
            (taunts.length > 0 ? ' ✓' : '（本局运气低，属正常）'));
          if (taunts.length) {
            const t0 = taunts[0];
            const A = t0.querySelector('.tt-a'), B = t0.querySelector('.tt-b');
            out.push('示例: ' + (A ? A.textContent.trim().slice(0, 26) : '?') +
              ' ⟷ ' + (B ? B.textContent.trim().slice(0, 26) : '?'));
            out.push('双方名字不同=' +
              (A && B && A.textContent !== B.textContent ? '✓' : '✗'));
          }
          document.title = 'TAUNT ' + out.join(' | ');
        }, 16000);
      }, 500);
    }, 800);
  } catch (e) { document.title = 'TAUNT-ERR ' + e.message; }
})();

/* ---------- 调试：?staminatest=1 体力系统 + 徽章自检 ---------- */
(function staminaTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('staminatest')) return;
    setTimeout(() => {
      const out = [];
      out.push('徽章总数=' + BADGE_DEFS.length +
        '（体力精神类 ' + BADGE_DEFS.filter((d) => d.kind === 'mental').length + '）');

      // ① 找几个不同体力的球员，看拿不拿得到体力徽章
      const bySta = CARDS.slice().sort((a, b) => (b.attrs.sta || 0) - (a.attrs.sta || 0));
      const hi = bySta[0], lo = bySta[bySta.length - 1];
      const f = (c) => {
        const bs = badgesOf(c, 8).filter((b) => b.mental);
        return c.name + '(sta' + c.attrs.sta + ') → ' +
          (bs.length ? bs.slice(0, 3).map((b) => b.name + '·' +
            BADGE_TIERS[b.tier].name[0]).join(' ') : '无');
      };
      out.push('体力最高 ' + f(hi));
      out.push('体力最低 ' + f(lo));

      // ② 电量充满：上限更高
      const s0 = makeStamina(hi.attrs ? hi : hi, 8);
      const s1 = makeStamina(lo, 8);
      out.push('体力上限 ' + hi.name + '=' + s0.max + ' vs ' + lo.name + '=' + s1.max);
      out.push('消耗系数 ' + s0.drain.toFixed(2) + ' vs ' + s1.drain.toFixed(2) +
        (s0.drain < s1.drain ? ' ✓强者更省' : ''));

      // ③ 实战：打完一节看体力掉多少
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const t = BT.myTeam;
          const st = t.players.map((p) => p.name.slice(-3) + ':' +
            Math.round(p.stamina.cur) + '/' + p.stamina.max);
          out.push('回合数=' + (BT.log ? BT.log.length : 0));
          out.push('体力 ' + st.join(' '));
          const avg = t.players.reduce((a, p) => a + p.stamina.cur / p.stamina.max, 0) / t.players.length;
          out.push('平均剩余 ' + Math.round(avg * 100) + '%' +
            (avg < 1 ? ' ✓有消耗' : ' ✗没消耗'));
          // ④ 体力低时命中率下降
          const p0 = t.players[0];
          const save = p0.stamina.cur;
          p0.stamina.cur = p0.stamina.max; const fFull = staminaFactor(p0);
          p0.stamina.cur = p0.stamina.max * 0.2; const fLow = staminaFactor(p0);
          p0.stamina.cur = save;
          out.push('体力满/低 命中系数 ' + fFull.toFixed(2) + '/' + fLow.toFixed(2) +
            (fLow < fFull ? ' ✓累了会掉' : ' ✗没影响'));
          // ⑤ 完整一场（快进）看终场体力
          startBattle('quick');
          setTimeout(() => {
            const t2 = BT.myTeam;
            const arr = t2.players.map((p) => p.name.slice(-3) + ':' +
              Math.round(p.stamina.cur / p.stamina.max * 100) + '%');
            out.push('全场结束体力 ' + arr.join(' '));
            const avg2 = t2.players.reduce((a, p) => a + p.stamina.cur / p.stamina.max, 0) / t2.players.length;
            out.push('平均剩余 ' + Math.round(avg2 * 100) + '%' +
              (avg2 < 0.85 && avg2 > 0.35 ? ' ✓合理区间' : ' ⚠需调参'));
            document.title = 'STAMINA ' + out.join(' | ');
          }, 9000);
        }, 45000);
      }, 500);
    }, 900);
  } catch (e) { document.title = 'STAMINA-ERR ' + e.message; }
})();

/* ---------- 调试：?badgefx=1 徽章对比赛的实际影响 ---------- */
(function badgeEffectTest() {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('badgefx')) return;
    setTimeout(() => {
      const out = [];
      const c = CARDS.filter((x) => x.tier === 'momentPurple')[0];
      // 同一个球员：裸卡 vs 满突破，徽章差距有多大
      // mkPlayer 读的是玩家实际拥有的突破等级，所以先造两张再分别建人
      const keep = S.owned[c.id];
      S.owned[c.id] = { got: 64, dup: 0, brk: 0 };
      const p0 = mkPlayer(c.id);               // 裸卡
      S.owned[c.id] = { got: 64, dup: 0, brk: 8 };
      const p8 = mkPlayer(c.id);               // 满突破
      if (!p0 || !p8) { document.title = 'BADGEFX 建人失败'; return; }
      const cnt = (p) => Object.keys(p.badges || {}).length;
      out.push(c.name + ' 裸卡徽章' + cnt(p0) + ' 满突破徽章' + cnt(p8));
      // 同一项能力的加成差距
      const keys = ['three', 'mid', 'layup', 'block', 'steal'];
      const diffs = keys.map((k) => k + ' ' +
        (SIGNATURE_BONUS(p0, k) * 100).toFixed(0) + '%→' +
        (SIGNATURE_BONUS(p8, k) * 100).toFixed(0) + '%');
      out.push('招牌加成 ' + diffs.join(' '));
      const better = keys.some((k) => SIGNATURE_BONUS(p8, k) > SIGNATURE_BONUS(p0, k));
      out.push('满突破加成更高=' + (better ? '✓' : '✗'));

      // 体力徽章实际生效
      out.push('体力上限 ' + p0.stamina.max + '→' + p8.stamina.max +
        (p8.stamina.max >= p0.stamina.max ? ' ✓' : ''));
      out.push('防守消耗 ' + p0.stamina.drainDef.toFixed(2) + '→' +
        p8.stamina.drainDef.toFixed(2) +
        (p8.stamina.drainDef <= p0.stamina.drainDef ? ' ✓不知疲倦生效' : ' ✗'));

      // 精神类徽章
      const mental = ['clutchGene', 'ice', 'leader', 'enforcer', 'focus', 'tough'];
      const m8 = mental.filter((k) => p8.badges[k]).map((k) =>
        (BADGE_DEFS.filter((d) => d.key === k)[0] || {}).name + '·' +
        BADGE_TIERS[p8.badges[k]].name[0]);
      out.push('满突破精神徽章 ' + (m8.length ? m8.join(' ') : '无'));

      // 实战对照：两支完全相同战绩的队，一支裸卡一支满突破
      const ids = CARDS.filter((x) => x.tier === 'purple').slice(0, 5).map((x) => x.id);
      const saveAll = ids.map((id) => S.owned[id]);
      ids.forEach((id) => { S.owned[id] = { got: 64, dup: 0, brk: 0 }; });
      const tA = buildTeam(ids, '裸卡', true);
      ids.forEach((id) => { S.owned[id] = { got: 64, dup: 0, brk: 8 }; });
      const tB = buildTeam(ids, '满突破', true);
      ids.forEach((id, i) => { S.owned[id] = saveAll[i]; });
      S.owned[c.id] = keep;
      out.push('裸卡队 OVR=' + tA.ovr + ' 满突破队 OVR=' + tB.ovr +
        (tB.ovr > tA.ovr ? ' ✓' : ' ✗'));
      out.push('领袖加成 裸=' + (tA.leaderBonus || 0).toFixed(3) +
        ' 满=' + (tB.leaderBonus || 0).toFixed(3));

      // 跑 200 回合看实际命中率差异
      const rate = (team, opp, n) => {
        let made = 0;
        for (let i = 0; i < n; i++) {
          const a = team.players[i % team.players.length];
          const d = opp.players[i % opp.players.length];
          const v = attackValue(a, ATK_TYPES[i % ATK_TYPES.length], team);
          const dv = defendValue(d, ATK_TYPES[i % ATK_TYPES.length], opp);
          if (v - dv > 0) made++;
        }
        return made / n;
      };
      const rA = rate(tA, tB, 400), rB = rate(tB, tA, 400);
      out.push('攻防对拼命中率 裸卡=' + (rA * 100).toFixed(1) + '% 满突破=' +
        (rB * 100).toFixed(1) + '%' +
        (rB > rA ? ' ✓满突破更强' : ' ✗没差别'));
      document.title = 'BADGEFX ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'BADGEFX-ERR ' + e.message; }
})();

/* ---------- 调试：?clicktest=1 卡牌点击跳转自检 ---------- */
(function cardClickTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('clicktest')) return;
    setTimeout(() => {
      const out = [];
      // ① 比赛卡片
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          const foe = el.querySelector('.bt-col.foe .bt-pc[data-pid]');
          const my = el.querySelector('.bt-col.my .bt-pc[data-pid]');
          out.push('我方卡=' + (my ? '✓' : '✗') + ' 对方卡=' + (foe ? '✓' : '✗'));
          if (foe) {
            const pid = foe.dataset.pid;
            foe.click();
            setTimeout(() => {
              const lay = document.getElementById('detailLayer');
              const open = !lay.classList.contains('hidden');
              out.push('点对方卡 → 打开=' + (open ? '✓' : '✗') +
                ' 球员=' + (CARD_BY_ID[pid] ? CARD_BY_ID[pid].name : '?'));
              // 只读提示
              out.push('只读提示=' +
                (lay.querySelector('.dview-tip') ? '✓' : '✗'));
              // 徽章页能看
              detailTab = 'badge'; openDetail(pid, true, true);
              setTimeout(() => {
                const cats = lay.querySelectorAll('.bd-cat').length;
                const items = lay.querySelectorAll('.bd-item').length;
                out.push('徽章分类=' + cats + ' 徽章卡=' + items +
                  (cats === 4 ? ' ✓' : ' ✗'));
                // 关闭要清掉临时记录
                const btn = document.getElementById('btnCloseDetail');
                if (btn) btn.click();
                setTimeout(() => {
                  out.push('关闭后已清理=' +
                    (!S.owned[pid] ? '✓' : '✗'));
                  // ② 转会市场
                  S.coins = 999999;
                  switchTab('league'); lgTab = 'market'; lgMarketMode = 'buy';
                  try { renderMarket(); } catch (e) {}
                  setTimeout(() => {
                    const box = document.getElementById('lgBody');
                    const mc = box.querySelector('.lg-mk-card');
                    if (mc) {
                      const mid = mc.dataset.lgid;
                      const owned0 = !!S.owned[mid];
                      mc.click();
                      setTimeout(() => {
                        const l2 = document.getElementById('detailLayer');
                        out.push('市场点卡 球员=' +
                          (CARD_BY_ID[mid] ? CARD_BY_ID[mid].name : '?') +
                          '(原持有=' + owned0 + ') 打开=' +
                          (!l2.classList.contains('hidden') ? '✓' : '✗'));
                        const b2 = document.getElementById('btnCloseDetail');
                        if (b2) b2.click();
                        setTimeout(() => {
                          out.push('市场查看后已清理=' +
                            (owned0 === !!S.owned[mid] ? '✓' : '✗'));
                          document.title = 'CLICK ' + out.join(' | ');
                        }, 300);
                      }, 600);
                    } else { out.push('市场没有卡片 ✗'); document.title = 'CLICK ' + out.join(' | '); }
                  }, 500);
                }, 400);
              }, 500);
            }, 600);
          } else document.title = 'CLICK ' + out.join(' | ');
        }, 700);
      }, 500);
    }, 800);
  } catch (e) { document.title = 'CLICK-ERR ' + e.message; }
})();

/* ---------- 调试：?aitest=1 AI 叫暂停 + 换战术自检 ---------- */
(function aiSmartTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('aitest')) return;
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        // 直接快速推完整场（用 advanceGame 大步长），统计 AI 行为
        let toTotal = 0, tacTotal = 0, games = 0;
        const samples = [];
        for (let g = 0; g < 3; g++) {
          startBattle('live');
          const gs = BT.gs;
          if (!gs) break;
          games++;
          const to0 = gs.aiTeam.timeouts;
          const seen = {};
          let guard = 0;
          while (!gs.done && guard++ < 4000) {
            const evs = advanceGame(gs, 400);   // 一大步
            evs.forEach((e) => {
              if (e.aiTimeout) {
                (e.reasons || []).forEach((r) => { seen[r] = (seen[r] || 0) + 1; });
              }
            });
          }
          toTotal += (to0 - gs.aiTeam.timeouts);
          tacTotal += Object.keys(seen).length;
          if (g === 0) samples.push(Object.keys(seen).slice(0, 3).join('；'));
        }
        out.push(games + ' 场比赛，AI 共叫暂停 ' + toTotal + ' 次' +
          (toTotal > 0 ? ' ✓会叫暂停' : ' ✗一次没叫'));
        out.push('AI 暂停理由示例：' + (samples[0] || '无'));
        out.push('AI 换战术（本场出现的调整类型）' + tacTotal + ' 类' +
          (tacTotal > 0 ? ' ✓实时调整' : ' ⚠'));
        // 界面上渲染一条看看
        startBattle('live');
        const gs2 = BT.gs;
        let guard2 = 0;
        while (!gs2.done && guard2++ < 60) advanceGame(gs2, 400);
        renderBattleLive && renderBattleLive();
        renderBattle();
        setTimeout(() => {
          const el = document.getElementById('scr-battle');
          const sbTo = el.querySelector('.bt-sb-to');
          out.push('记分条显示对方暂停=' +
            (sbTo ? '✓「' + sbTo.textContent + '」' : '✗'));
          document.title = 'AI ' + out.join(' | ');
        }, 400);
      }, 500);
    }, 800);
  } catch (e) { document.title = 'AI-ERR ' + e.message; }
})();

/* ---------- 调试：?rotatetest=1 体力消耗 + AI 轮换自检 ---------- */
(function rotateTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('rotatetest')) return;
    setTimeout(() => {
      const out = [];
      // ① 体力消耗按徽章分档
      const all = CARDS.filter((c) => c.tier === 'purple');
      const withBadge = [], noBadge = [];
      all.forEach((c) => {
        S.owned[c.id] = { got: 64, dup: 0, brk: 8 };
        const st = makeStamina(c, 8);
        const bs = badgesOf(c, 8).filter((b) => b.mental).map((b) => b.key);
        if (bs.indexOf('ironman') >= 0 || bs.indexOf('relentless') >= 0 ||
            bs.indexOf('charged') >= 0) withBadge.push(st.drainDef);
        else noBadge.push(st.drainDef);
      });
      const avg = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
      out.push('有体力徽章 ' + withBadge.length + ' 人，防守消耗均值 ' +
        avg(withBadge).toFixed(3));
      out.push('无体力徽章 ' + noBadge.length + ' 人，防守消耗均值 ' +
        avg(noBadge).toFixed(3) +
        (avg(withBadge) < avg(noBadge) ? ' ✓徽章更省体力' : ' ✗没差别'));
      // ② 打完整场：AI 轮换次数 + 双方体力
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        const gs = BT.gs;
        let subs = 0, tos = 0, guard = 0;
        const log0 = [];
        while (!gs.done && guard++ < 5000) {
          const evs = advanceGame(gs, 400);
          evs.forEach((e) => {
            if (e.kind === 'sub' && e.aiSub) { subs++; }
            if (e.aiTimeout) tos++;
          });
        }
        out.push('整场 AI 换人 ' + subs + ' 次' + (subs > 0 ? ' ✓会轮换' : ' ✗没换过'));
        out.push('整场 AI 暂停 ' + tos + ' 次');
        const avgSta = (t) => t.players.length
          ? Math.round(t.players.reduce((a, p) =>
            a + p.stamina.cur / p.stamina.max, 0) / t.players.length * 100) : 0;
        out.push('终场体力 我方 ' + avgSta(gs.myTeam) + '% / 对方 ' +
          avgSta(gs.aiTeam) + '%');
        const anyTired = gs.myTeam.players.some((p) =>
          p.stamina.cur / p.stamina.max < 0.75);
        out.push('我方有人掉到 75% 以下=' + (anyTired ? '✓体力真的在消耗' : '✗'));
        // ③ 有徽章的球员是不是掉得慢
        const mSta = gs.myTeam.players.map((p) => {
          const bs = Object.keys(p.badges || {}).filter((k) =>
            ['ironman', 'relentless', 'charged'].indexOf(k) >= 0);
          return { n: p.name.slice(-3), r: Math.round(p.stamina.cur / p.stamina.max * 100),
            b: bs.length };
        }).sort((a, b) => b.r - a.r);
        out.push('终场体力排行 ' + mSta.map((x) => x.n + x.r + '%' +
          (x.b ? '(徽章' + x.b + ')' : '')).join(' '));
        document.title = 'ROTATE ' + out.join(' | ');
      }, 500);
    }, 800);
  } catch (e) { document.title = 'ROTATE-ERR ' + e.message; }
})();

/* ---------- 调试：?totest=1 暂停 60 秒 + 一键结束自检 ---------- */
(function timeoutDurationTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('totest')) return;
    setTimeout(() => {
      const out = [];
      out.push('暂停时长设定=' + TIMEOUT_SECONDS + ' 秒' +
        (TIMEOUT_SECONDS === 60 ? ' ✓' : ' ✗'));
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const t = BT.myTeam;
          const to0 = t.timeouts;
          openTimeout();
          setTimeout(() => {
            const el = document.getElementById('subLayer');
            const cd = document.getElementById('subCount');
            out.push('暂停后 比赛时钟停=' +
              (BT.gs.running === false ? '✓' : '✗'));
            out.push('剩余暂停 ' + to0 + '→' + t.timeouts +
              (t.timeouts === to0 - 1 ? ' ✓' : ' ✗'));
            out.push('倒计时元素=' + (cd ? '✓「' + cd.textContent + ' 秒」' : '✗'));
            out.push('面板已开=' +
              (el && !el.classList.contains('hidden') ? '✓' : '✗'));
            // 等 3 秒看倒计时是否在走
            setTimeout(() => {
              const c2 = document.getElementById('subCount');
              out.push('3 秒后倒计时=' + (c2 ? c2.textContent : '?') +
                (c2 && parseInt(c2.textContent, 10) < 60 ? ' ✓在走' : ' ✗没动'));
              // 一键结束
              const btn = document.getElementById('subClose');
              out.push('按钮文案「' + (btn ? btn.textContent.trim() : '?') + '」');
              if (btn) btn.click();
              setTimeout(() => {
                out.push('点结束后 时钟恢复=' +
                  (BT.gs.running === true ? '✓' : '✗'));
                out.push('面板已关=' +
                  (document.getElementById('subLayer').classList
                    .contains('hidden') ? '✓' : '✗'));
                out.push('倒计时已停=' +
                  (BT.timeoutLeft == null ? '✓' : '✗'));
                document.title = 'TO ' + out.join(' | ');
              }, 400);
            }, 3000);
          }, 600);
        }, 1200);
      }, 400);
    }, 800);
  } catch (e) { document.title = 'TO-ERR ' + e.message; }
})();

/* ---------- 调试：?aismart=1 AI 决策智能度自检 ---------- */
(function aiSmartTest2() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('aismart')) return;
    setTimeout(() => {
      const out = [];
      let subTotal = 0, toTotal = 0, tacKinds = {}, subWhy = {};
      for (let g = 0; g < 3; g++) {
        startBattle('live');
        const gs = BT.gs;
        if (!gs) break;
        let guard = 0;
        while (!gs.done && guard++ < 5000) {
          const evs = advanceGame(gs, 400);
          evs.forEach((e) => {
            if (e.kind === 'sub' && e.aiSub) {
              subTotal++;
              if (e.why) subWhy[e.why] = (subWhy[e.why] || 0) + 1;
            }
            if (e.aiTimeout) {
              toTotal++;
              (e.reasons || []).forEach((r) => { tacKinds[r] = 1; });
            }
          });
        }
      }
      out.push('3 场：AI 换人 ' + subTotal + ' 次 / 暂停 ' + toTotal + ' 次');
      out.push('换人原因分布：' +
        (Object.keys(subWhy).length
          ? Object.keys(subWhy).map((k) => k + '×' + subWhy[k]).join(' ')
          : '（都是体力原因）'));
      out.push('暂停理由种类 ' + Object.keys(tacKinds).length + ' 类' +
        (Object.keys(tacKinds).length ? ' ✓会看形势' : ''));
      // 决策函数单测：造几个特定局面
      const mk = (o) => Object.assign({
        score: 0, off: 'balanced', def: 'man', momentum: 0, runStreak: 0,
        players: CARDS.slice(0, 5).map((c) => {
          const p = mkAIPlayer(c.id, 4) || {};
          p.stat = { fgm: 2, fga: 10, pf: 2 };
          p.hot = 0;
          p.stamina = { cur: 80, max: 100 };
          return p;
        }),
      }, o);
      S.owned[CARDS[0].id] = { got: 3, dup: 2, brk: 4 };
      const foe1 = mk({ score: 0 });
      foe1.players[0].hot = 4;
      const r1 = aiAdjust(mk({ score: 0, def: 'man' }), foe1, 2, 300);
      out.push('对手有人手感热 → ' +
        (r1 && r1.def === 'zone23' ? '✓改联防：' + r1.why : '✗' + JSON.stringify(r1)));
      const ai2 = mk({ score: 0 });
      ai2.players.forEach((p) => { p.stat.fga = 10; p.stat.fgm = 2; p.stat.pf = 0; });
      const r2 = aiAdjust(ai2, mk({ score: 5 }), 1, 300);
      out.push('全队打铁 → ' +
        (r2 && r2.off === 'inside' ? '✓改内线：' + r2.why : '✗' + JSON.stringify(r2)));
      const ai3 = mk({ score: 0 });
      ai3.players.forEach((p) => { p.stat.pf = 3; });
      const r3 = aiAdjust(ai3, mk({ score: 0 }), 1, 300);
      out.push('犯规过多 → ' +
        (r3 && r3.def === 'zone23' ? '✓改联防：' + r3.why : '✗' + JSON.stringify(r3)));
      document.title = 'AISMART ' + out.join(' | ');
    }, 800);
  } catch (e) { document.title = 'AISMART-ERR ' + e.message; }
})();

/* ---------- 调试：?sweeptest=1 一键扫荡自检 ---------- */
(function sweepTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('sweeptest2')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          out.push('比赛已开 阶段=' + BT.phase + ' 比分 ' +
            BT.myTeam.score + ':' + BT.aiTeam.score);
          const sk = document.getElementById('btSkip');
          out.push('扫荡按钮=' + (sk ? '✓' : '✗'));
          if (!sk) { document.title = 'SWEEP ' + out.join(' | '); return; }
          // 先跑几个回合，模拟"打到一半再扫荡"
          for (let i = 0; i < 30; i++) advanceGame(BT.gs, 300);
          out.push('中途 第' + (BT.gs.q + 1) + '节 ' + BT.myTeam.score +
            ':' + BT.aiTeam.score);
          const logN = BT.log.length;
          sk.click();
          setTimeout(() => {
            out.push('扫荡后 阶段=' + BT.phase);
            out.push('比分 ' + BT.myTeam.score + ':' + BT.aiTeam.score);
            out.push('解说 ' + logN + '→' + BT.log.length + ' 条');
            out.push('比赛结束=' + (BT.gs.done ? '✓' : '✗'));
            out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join('; ') : '无 ✓'));
            document.title = 'SWEEP ' + out.join(' | ');
          }, 800);
        }, 1200);
      }, 400);
    }, 800);
  } catch (e) { document.title = 'SWEEP-ERR ' + e.message; }
})();


/* ---------- 调试：?sweeptest=1 设置页一键扫荡自检 ---------- */
(function sweepTest2() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('sweeptest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        const btn = document.getElementById('btStartQuick');
        out.push('设置页扫荡按钮=' + (btn ? '✓「' + btn.textContent.trim() + '」' : '✗'));
        if (!btn) { document.title = 'SWEEP2 ' + out.join(' | '); return; }
        const c0 = S.coins;
        btn.click();
        setTimeout(() => {
          out.push('阶段=' + BT.phase);
          out.push('比分 ' + BT.myTeam.score + ':' + BT.aiTeam.score);
          out.push('奖金 +' + fmt(S.coins - c0));
          out.push('比赛结束=' + (BT.gs && BT.gs.done ? '✓' : '（gs 未标记）'));
          out.push('节数=' + (BT.gs ? BT.gs.q : '?') + '/4');
          // 检查进攻回合数是否合理（NBA 一场约 100 回合/队）
          let poss = 0;
          (BT.log || []).forEach((e) => { if (!e.qEnd) poss++; });
          const qk = window.__quick || {};
          out.push('模拟调用=' + qk.calls + ' 次 打到第' + ((qk.q||0)+1) +
            '节 done=' + qk.done);
          out.push('总回合=' + qk.poss + '（NBA 两队共约 200）');
          out.push('每回合得分=' + (qk.poss
            ? ((qk.my + qk.ai) / qk.poss).toFixed(2) : '?') + '（NBA 约 1.1）');
          const fga = BT.myTeam.players.reduce((a2, x) => a2 + (x.stat.fga || 0), 0);
          out.push('我队出手=' + fga + ' 次（NBA 约 88 次）');
          out.push('两队总分=' + (BT.myTeam.score + BT.aiTeam.score) +
            '（NBA 约 220）');
          out.push('联赛战绩已写=' + ((S.leagueMyW || 0) + (S.leagueMyL || 0) > 0 ? '✓' : '✗'));
          const rec = myRecord();
          out.push('我的赛程 ' + rec.w + '胜' + rec.l + '负');
          out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(' ; ') : '无 ✓'));
          document.title = 'SWEEP2 ' + out.join(' | ');
        }, 1200);
      }, 500);
    }, 800);
  } catch (e) { document.title = 'SWEEP2-ERR ' + e.message; }
})();


/* ---------- 调试：?autosubtest=1 自动换人按钮自检 ---------- */
(function autoSubTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('autosubtest')) return;
    const errs = [];
    window.addEventListener('error', (e) => errs.push(e.message));
    setTimeout(() => {
      const out = [];
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        setTimeout(() => {
          const btn = document.getElementById('btCoach');
          out.push('按钮=' + (btn ? '✓「' + btn.textContent.trim() + '」' : '✗'));
          if (!btn) { document.title = 'AUTOSUB ' + out.join(' | '); return; }
          // ① 全队状态好时点 → 应该提示不用换
          const before0 = BT.myTeam.players.map((p) => p.id).join(',');
          btn.click();
          out.push('开局满体力点按钮：阵容变化=' +
            (BT.myTeam.players.map((p) => p.id).join(',') === before0 ? '无（正确）' : '有'));
          // ② 把两人体力压低再点 → 应该换人
          BT.myTeam.players[1].stamina.cur = BT.myTeam.players[1].stamina.max * 0.35;
          BT.myTeam.players[3].stamina.cur = BT.myTeam.players[3].stamina.max * 0.40;
          const tired = [BT.myTeam.players[1].name, BT.myTeam.players[3].name];
          const before = BT.myTeam.players.map((p) => p.id).join(',');
          const benchBefore = BT.myTeam.bench.map((p) => p.id).join(',');
          btn.click();
          const after = BT.myTeam.players.map((p) => p.id).join(',');
          out.push('体力 35%/40% 时点按钮：' +
            (after !== before ? '✓换人了' : '✗没换'));
          out.push('  换下的人原体力：' +
            tired.map((n) => n.slice(-3)).join(' '));
          out.push('  场上新人：' +
            BT.myTeam.players.filter((p) => p.stamina.cur / p.stamina.max > 0.9)
              .map((p) => p.name.slice(-3)).join(' '));
          out.push('  替补席也同步换过=' +
            (BT.myTeam.bench.map((p) => p.id).join(',') !== benchBefore ? '✓' : '✗'));
          out.push('  阵容仍是 5 人=' + (BT.myTeam.players.length === 5 ? '✓' : '✗'));
          // ③ 犯规麻烦
          BT.myTeam.players[0].stat.pf = 5;
          BT.myTeam.players[1].stat.pf = 5;
          const b2 = BT.myTeam.players.map((p) => p.id).join(',');
          btn.click();
          out.push('5 次犯规时点按钮：' +
            (BT.myTeam.players.map((p) => p.id).join(',') !== b2 ? '✓保护了' : '✗没换'));
          out.push('异常=' + (errs.length ? '✗ ' + errs.slice(0,2).join(';') : '无 ✓'));
          document.title = 'AUTOSUB ' + out.join(' | ');
        }, 1400);
      }, 400);
    }, 800);
  } catch (e) { document.title = 'AUTOSUB-ERR ' + e.message; }
})();
