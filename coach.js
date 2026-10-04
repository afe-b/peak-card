'use strict';
/* =============================================================
   🧠 教练系统（v9.38 新增）
   -------------------------------------------------------------
   用户需求：
     「教练系统把自动换人系统顶替掉，教练是可以根据球员体力、
       比赛影响力、能力、还是效率，选择自动更换球员……
       玩家只要点击这个教练选项以后，这个教练选项就可以自动进行
       比赛安排……要做得智能一点……玩家可以选择开启或者关闭」

   ★ 设计定位
     教练不是"更聪明的自动换人"，而是**比赛中的决策者**，负责四件事：
       ① 换人（顶替原来的「自动换人」按钮）
       ② 叫暂停
       ③ 调整战术（复用 AI 那套 aiAdjust 的判断）
       ④ 判断"谁该多打"（影响力而不是单纯体力）

   ★ 为什么不放在 battle.js
     以后要做**教练卡**，所以核心逻辑独立成文件：
     教练是"一种可更换的策略集"，用 COACH_PROFILES 表描述。
     现在只有 1 个默认教练（免费），加教练卡时只要往表里加条目、
     在 S 里记玩家拥有哪个，其余逻辑不用改。

   ★ 依赖（都在 battle.js，加载顺序在前）
     SLOT_POS / POS_NEED / SUB_COOLDOWN / subScore / posFit
     applyOutOfPosPenalty / counterBonus / OFF_TACTICS / DEF_TACTICS
     QUARTERS / ROUNDS_PER_QUARTER / QUARTER_SEC
   ============================================================= */

/* =============================================================
   ① 教练资料表（教练卡的接口雏形）
   -------------------------------------------------------------
   每个字段都会真的影响决策，不是装饰：
     subTol       换人容忍度：越小越保守（让主力多打）
     subGain      替补要"强多少"才值得换（防抖阈值）
     timeoutAggr  叫暂停的积极程度
     adaptTactic  是否主动针对对手战术换阵
     focus        决策侧重：'impact' 看影响力 / 'stamina' 看体力 /
                  'efficiency' 看效率 / 'balanced' 综合
   ============================================================= */
const COACH_PROFILES = {
  default: {
    key: 'default', name: '智能教练', short: '教练',
    desc: '综合判断体力、影响力、能力与效率，自动换人 / 叫暂停 / 调战术',
    subTol: 1.00, subGain: 2.0, timeoutAggr: 1.00, adaptTactic: true,
    focus: 'balanced', rarity: 'free',
  },
  /* ---- 以下为「教练卡」预留位（暂未开放获取）---- */
  offense: {
    key: 'offense', name: '进攻大师', short: '进攻',
    desc: '偏爱手感火热与高效率的球员，容忍防守弱点；进攻不顺时果断换阵',
    subTol: 0.92, subGain: 1.4, timeoutAggr: 0.85, adaptTactic: true,
    focus: 'efficiency', rarity: 'locked',
  },
  defense: {
    key: 'defense', name: '防守大师', short: '防守',
    desc: '优先保证防守强度，宁可牺牲一点进攻；对位被打爆立刻调整',
    subTol: 0.88, subGain: 2.6, timeoutAggr: 1.25, adaptTactic: true,
    focus: 'impact', rarity: 'locked',
  },
  rotation: {
    key: 'rotation', name: '轮换大师', short: '轮换',
    desc: '严格控制主力出场时间，全队体力长期保持高位',
    subTol: 1.18, subGain: 1.0, timeoutAggr: 1.00, adaptTactic: false,
    focus: 'stamina', rarity: 'locked',
  },
};

/** 取当前生效的教练资料（以后教练卡就从 S.coachKey 读） */
function coachProfileOf() {
  const k = (typeof S !== 'undefined' && S && S.coachKey) ? S.coachKey : 'default';
  return COACH_PROFILES[k] || COACH_PROFILES.default;
}

/* =============================================================
   ② 球员评估模型（用户要求的四个维度）
   -------------------------------------------------------------
     stamina     体力：当前比例
     impact      比赛影响力：这一场到目前为止的实际贡献
     ability     能力：**该位置**需要的能力（不是裸综合）
     efficiency  效率：真实命中率 TS% 与失误控制

   ★ 为什么"影响力"和"效率"要分开
     效率只看得分质量，影响力包含篮板/助攻/防守。
     一个 5 投 5 中的角色球员效率满分，但影响力可能不如
     15 投 8 中 + 8 篮板 + 6 助攻的核心 —— 教练要能区分这两者。
   ============================================================= */
function coachPlayerEval(p, slot, team, foe) {
  const st = p.stat || {};
  const min = Math.max(0, (p.stamina ? p.stamina.cur / p.stamina.max : 1));

  /* ---- 效率：真实命中率 TS% = PTS / (2 × (FGA + 0.44 × FTA)) ----
     我们没有罚球出手统计，用 fta≈pf×0.6 近似（被犯规大多会罚球）。
     出手少于 3 次时样本太小，用联盟基准 0.55 代替，避免"1 投 0 中"被判死。 */
  const fga = st.fga || 0;
  const fta = Math.max(0, (st.pf || 0) * 0.6);
  const tsDen = 2 * (fga + 0.44 * fta);
  const ts = (fga >= 3 && tsDen > 0) ? (st.pts || 0) / tsDen : 0.55;
  /* 失误率：每回合的失误（我们的 to 是绝对值，用参与度归一） */
  const usage = Math.max(1, fga + (st.ast || 0) + (st.to || 0));
  const toRate = (st.to || 0) / usage;
  /* 效率分：TS 相对基准的偏离 − 失误惩罚，单位"分" */
  const effScore = (ts - 0.55) * 30 - toRate * 12;

  /* ---- 影响力：本场实际产出（含防守与组织）---- */
  const impact =
    (st.pts || 0) * 0.90 +
    (st.ast || 0) * 1.80 +
    (st.reb || 0) * 0.75 +
    (st.stl || 0) * 2.20 +
    (st.blk || 0) * 1.90 +
    (st.to || 0) * (-1.50) +
    ((st.fgm || 0) - (st.fga || 0)) * 0.35;   // 打铁惩罚

  /* ---- 能力：该位置需要的能力（POS_NEED 加权）---- */
  const need = POS_NEED[slot] || POS_NEED.SF;
  let abil = 0, wsum = 0;
  Object.keys(need).forEach((k) => {
    abil += (p.attrs[k] || 50) * need[k];
    wsum += need[k];
  });
  abil = wsum ? abil / wsum : 60;

  /* ---- 犯规麻烦 ---- */
  const pf = st.pf || 0;
  const foulRisk = pf >= 5 ? 1 : pf >= 4 ? 0.7 : pf >= 3 ? 0.35 : 0;

  /* ---- 对位压力：对手最烫的人与我方防守能力 ---- */
  let matchupStress = 0;
  if (foe && foe.players && foe.players.length) {
    const hotP = foe.players.slice().sort((a, b) => (b.hot || 0) - (a.hot || 0))[0];
    const hotLv = hotP ? (hotP.hot || 0) : 0;
    if (hotLv >= 3) {
      const myDef = ((p.attrs.perimD || 60) + (p.attrs.lateral || 60) + (p.attrs.intD || 60)) / 3;
      matchupStress = hotLv >= 4 ? Math.max(0, 90 - myDef) / 90 : 0;
    }
  }

  return {
    p, min, ts, toRate, effScore, impact, abil, foulRisk, matchupStress,
    /* 综合"该不该留在场上"的分数 —— 教练决策的主输入。
       四项按 focus 加权，见 coachWeights()。 */
  };
}

/** 按教练侧重返回四项权重 */
function coachWeights(profile) {
  const f = profile ? profile.focus : 'balanced';
  if (f === 'stamina') return { stamina: 46, impact: 22, ability: 20, eff: 12 };
  if (f === 'efficiency') return { stamina: 30, impact: 20, ability: 20, eff: 30 };
  if (f === 'impact') return { stamina: 32, impact: 34, ability: 22, eff: 12 };
  return { stamina: 36, impact: 26, ability: 22, eff: 16 };   // balanced
}

/** 把评估结果压成一个可比分数 */
function coachScore(ev, weights) {
  const w = weights || coachWeights();
  /* 各维度归一到 0~100 量级再加权 */
  const staPts = ev.min * 100;
  const impPts = Math.max(0, Math.min(100, 50 + ev.impact * 2.2));
  const abiPts = Math.max(0, Math.min(100, ev.abil));
  const effPts = Math.max(0, Math.min(100, 50 + ev.effScore * 2.0));
  const raw = (staPts * w.stamina + impPts * w.impact
    + abiPts * w.ability + effPts * w.eff)
    / (w.stamina + w.impact + w.ability + w.eff);
  /* 犯规麻烦与对位压力是**减法**（再强也不能留在场上送罚球） */
  return raw - ev.foulRisk * 22 - ev.matchupStress * 15;
}

/* =============================================================
   ③ 比赛情境判断
   ============================================================= */
function coachContext(gs) {
  const t = gs.myTeam, foe = gs.aiTeam;
  const diff = (t.score || 0) - (foe ? foe.score || 0 : 0);
  const remain = (QUARTERS - gs.q - 1) * QUARTER_SEC + (gs.clock || 0);
  const clutch = gs.q >= 3 && remain < 240 && Math.abs(diff) <= 8;
  const garbage = Math.abs(diff) >= 20;
  const blowoutWin = diff >= 20;
  const blowoutLose = diff <= -20;
  return { diff, remain, clutch, garbage, blowoutWin, blowoutLose, q: gs.q };
}

/* =============================================================
   ④ 教练决策：换人
   -------------------------------------------------------------
   与旧「自动换人」的核心差别：
     旧：只看"体力低于阈值就换"，选人时看位置适配 + 体力
     新：看**四维综合分**，并且能识别
           · 手感火热的球员（就算累一点也让他多打）
           · 打得差的球员（体力还行也该下来冷静）
           · 关键时段（让最强阵容留在场上）
   ============================================================= */
function coachDecideSubs(gs) {
  const prof = coachProfileOf();
  const t = gs.myTeam, foe = gs.aiTeam;
  if (!t || !t.players || !t.bench || !t.bench.length) return null;
  const ctx = coachContext(gs);
  const W = coachWeights(prof);
  const now = gs.possession || 0;
  const SUB_CD = (typeof SUB_COOLDOWN === 'number') ? SUB_COOLDOWN : 8;

  /* =============================================================
     ⏱️ 换人节奏控制（v9.38.2 改为分层）
     -------------------------------------------------------------
     用户要求：「教练系统必须**实时**运作，只要打开就会自动实时
     根据场上情况运作」。

     原来我加的是一道**全局 4 回合硬间隔** —— 结果是"每 4 回合才
     睁一次眼"，不符合"实时"的要求。

     现在改成**分层判断**（教练每回合都会完整评估所有人）：
       · 【紧急】体力 ≤ 0.25 或 5 犯 → **立刻换，不受任何间隔限制**
       · 【正常】体力/犯规 → 受 COACH_SUB_GAP 约束（避免刷换人）
       · 【软性】手感差/对位被打爆 → 用更长的 COACH_SOFT_GAP
         （这类问题不该频繁换人，换太勤反而打乱轮换）

     这样教练是"每回合都在看"，只是"动手"有轻重缓急。
     ============================================================= */
  const COACH_SUB_GAP = 3;      // 正常换人的最小间隔
  const COACH_SOFT_GAP = 6;     // 软性问题（手感/对位）的最小间隔
  const gapOk = (gs.lastCoachSub == null) || (now - gs.lastCoachSub >= COACH_SUB_GAP);
  const softOk = (gs.lastCoachSub == null) || (now - gs.lastCoachSub >= COACH_SOFT_GAP);

  const outList = [];
  t.players.forEach((p, i) => {
    if (!p || !p.stamina || !p.card) return;
    const slot = p.slotPos || SLOT_POS[i] || p.pos;
    const ev = coachPlayerEval(p, slot, t, foe);
    const curSc = coachScore(ev, W);
    const reasons = [];
    let urgent = false;      // 紧急：绕过所有间隔限制

    /* ---- 该不该换下：四类理由 ---- */
    /* ① 体力见底（阈值随教练容忍度浮动） */
    const staGate = (ctx.clutch ? 0.40 : ctx.garbage ? 0.86 : 0.74) * (2 - prof.subTol);
    if (ev.min <= staGate) reasons.push('体力 ' + Math.round(ev.min * 100) + '%');
    if (ev.min <= 0.25) urgent = true;          // 真的撑不住了
    /* ② 打得差且样本够（效率维度）—— 软性问题，受长间隔约束 */
    if (!ctx.garbage && (p.stat.fga || 0) >= 5 && ev.effScore < -3.5) {
      if (softOk) reasons.push('手感差 ' + (p.stat.fgm || 0) + '/' + (p.stat.fga || 0));
    }
    /* ③ 犯规麻烦
       ★ 门槛取 0.35（即 **3 犯就开始留意**）—— 现代篮球 3 犯就是信号，
         4 犯必须保护、5 犯已经罚下。原来我写 0.7 等于只在 4 犯时才动，
         太迟钝（实测 3 犯的球员不会被换下）。 */
    if (ev.foulRisk >= 0.35 && !ctx.clutch) reasons.push((p.stat.pf || 0) + ' 次犯规');
    if ((p.stat.pf || 0) >= 5) urgent = true;    // 5 犯必须立刻下
    /* ④ 对位被打爆（影响力/能力维度）—— 软性问题 */
    if (ev.matchupStress > 0.15 && !ctx.clutch && softOk) reasons.push('对位被打爆');

    if (!reasons.length) return;
    /* ---- 间隔门禁：非紧急的换人受节奏约束 ---- */
    if (!urgent && !gapOk) return;

    /* ---- 关键时段：打得好的球员即使累也不换（除非真的撑不住） ---- */
    if (ctx.clutch && ev.min > 0.28 && curSc >= 62) return;

    /* ---- 选替补：用同一套评分，要求位置合法 ---- */
    let best = -1, bestV = -1;
    let fb = -1, fbV = -1;
    t.bench.forEach((b, j) => {
      if (!b || !b.stamina || !b.card) return;
      if (b.subCool != null && now - b.subCool < SUB_CD) return;   // 冷却中
      const bEv = coachPlayerEval(b, slot, t, foe);
      /* 替补没上过场，impact/eff 都是 0 —— 用"能力"和"体力"当主输入，
         这也是教练对替补的唯一可靠判断依据（和真实教练一样）。 */
      const fit = posFit(b.card, slot);
      if (fit === 'out') {
        const v = coachScore(bEv, W);
        if (v > fbV) { fbV = v; fb = j; }
        return;
      }
      const fitBonus = fit === 'primary' ? 6 : 3;
      const v = coachScore(bEv, W) + fitBonus;
      if (v > bestV) { bestV = v; best = j; }
    });

    /* ---- 防抖：替补必须真的更好才换 ---- */
    if (best >= 0 && bestV < curSc + prof.subGain) best = -1;
    /* ---- 客串兜底：只在撑不住时（同 v9.36 的取舍） ---- */
    if (best < 0 && fb >= 0 && ev.min <= 0.25) best = fb;

    if (best < 0) return;
    const inn = t.bench[best];
    outList.push({
      i, j: best, out: p, inn,
      why: reasons[0],
      /* 决策依据（写进解说，让玩家看得懂教练在想什么） */
      note: reasons[0] + '（评分 ' + Math.round(curSc) + '→' + Math.round(bestV) + '）',
      slot, fit: posFit(inn.card, slot),
    });
  });

  if (!outList.length) return null;
  /* 一次最多换 2 人（关键时段只换 1 人，保持阵容稳定） */
  const maxN = ctx.clutch ? 1 : 2;
  gs.lastCoachSub = now;               // ⏱️ 记下时点，供下次的间隔判断
  return outList.sort((a, b) => b.inn.ovr - a.inn.ovr).slice(0, maxN);
}

/* =============================================================
   ⑤ 教练决策：战术调整
   -------------------------------------------------------------
   直接复用 AI 那套 aiAdjust（它已经处理了
   手感火热 / 犯规过多 / 体力吃紧 / 被克制 / 分差 等情形），
   只把"AI 队"换成"我的队"。这样双方用的是同一套篮球智商，
   不会出现"AI 会针对我、我的教练却不会"的不公平。
   ============================================================= */
function coachDecideTactics(gs) {
  const prof = coachProfileOf();
  if (!prof.adaptTactic) return null;
  if (typeof aiAdjust !== 'function') return null;
  const t = gs.myTeam, foe = gs.aiTeam;
  if (!t || !foe) return null;
  return aiAdjust(t, foe, gs.q, gs.clock || 0);
}

/* =============================================================
   ⑥ 教练决策：叫暂停
   -------------------------------------------------------------
   复用 aiTimeoutCheck 的思路，但作用在我的队上。
   aiTimeoutCheck 内部写死了 `gs.aiTeam` 是"要叫暂停的一方"，
   所以这里做一个轻量的临时交换（不改它的代码）。
   ============================================================= */
function coachDecideTimeout(gs, ev) {
  const prof = coachProfileOf();
  const t = gs.myTeam, foe = gs.aiTeam;
  if (!t || !foe) return null;
  if (!t.timeouts || t.timeouts <= 0) return null;
  if (gs.myTimeoutCd > 0) { gs.myTimeoutCd--; return null; }

  /* ---- 我的判断逻辑（不借用 aiTimeoutCheck）----
     ★ 为什么自己写：aiTimeoutCheck 内部写死了 `gs.aiTeam` 是"叫暂停的一方"，
       借用它得临时交换双方队伍（易错、且会污染 AI 的冷却计数）。
       暂停的判断条件本身很简单，自己写更清晰。
     真实教练叫暂停的时机： */
  const diff = (t.score || 0) - (foe.score || 0);
  const remain = (QUARTERS - gs.q - 1) * QUARTER_SEC + (gs.clock || 0);
  const ctx = coachContext(gs);
  const reasons = [];

  /* ① 被对手打出一波流（最近连续丢分） */
  if (foe.runStreak >= 8) reasons.push('对手打出 ' + foe.runStreak + ' 分高潮');
  /* ② 自己进攻连续不中 */
  const fga = t.players.reduce((a, p2) => a + ((p2.stat && p2.stat.fga) || 0), 0);
  const fgm = t.players.reduce((a, p2) => a + ((p2.stat && p2.stat.fgm) || 0), 0);
  if (fga >= 10 && fgm / fga < 0.32) reasons.push('全队命中率仅 ' + Math.round(100 * fgm / fga) + '%');
  /* ③ 分差被拉开 */
  if (diff <= -10 && diff > -22) reasons.push('落后 ' + (-diff) + ' 分');
  /* ④ 全队体力吃紧（教练需要布置轮换） */
  const tired = t.players.filter((p2) => p2.stamina
    && p2.stamina.cur / p2.stamina.max < 0.45).length;
  if (tired >= 3) reasons.push(tired + ' 人需要喘口气');
  /* ⑤ 末节关键时段，比分胶着 → 布置最后一攻 */
  if (ctx.clutch && remain < 150) reasons.push('关键时段布置战术');

  if (!reasons.length) return null;
  /* 教练的积极程度：<1 时按概率过滤（保守教练不会每个机会都叫） */
  if (prof.timeoutAggr < 1 && Math.random() > prof.timeoutAggr) return null;
  /* 叫了之后要等一段时间才能再叫，不然一回合叫一次 */
  gs.myTimeoutCd = 10;
  return { why: reasons[0], all: reasons };
}

/* =============================================================
   ⑦ 教练总入口：每个回合被调用一次
   -------------------------------------------------------------
   返回 { subs, tactics, timeout } 里实际发生的动作，
   供 UI 写进解说（让玩家看到教练在想什么）。
   ============================================================= */
function coachTick(gs, ev) {
  const out = { subs: null, tactics: null, timeout: null };
  if (!gs || !gs.myTeam) return out;
  /* 教练开关：S.coachOn（玩家可随时开/关） */
  if (typeof S !== 'undefined' && S && S.coachOn === false) return out;

  /* ① 战术调整（每回合都可以，代价为零） */
  const tac = coachDecideTactics(gs);
  if (tac) {
    gs.myTeam.off = tac.off;
    gs.myTeam.def = tac.def;
    if (typeof S !== 'undefined' && S) { S.offTac = tac.off; S.defTac = tac.def; }
    out.tactics = tac;
  }
  /* ② 暂停 */
  const to = coachDecideTimeout(gs, ev);
  if (to) out.timeout = to;
  /* ③ 换人 */
  const subs = coachDecideSubs(gs);
  if (subs && subs.length) {
    subs.forEach((sv) => {
      const b = gs.myTeam.bench[sv.j];
      const outgoing = gs.myTeam.players[sv.i];
      b.slotPos = outgoing.slotPos;
      applyOutOfPosPenalty(b, b.slotPos);
      outgoing.slotPos = '';
      applyOutOfPosPenalty(outgoing, '');
      outgoing.subCool = gs.possession || 0;
      b.subCool = null;
      gs.myTeam.bench[sv.j] = outgoing;
      gs.myTeam.players[sv.i] = b;
    });
    out.subs = subs;
  }

  /* =============================================================
     📋 记录"教练最近一次决策"（v9.38.1）
     -------------------------------------------------------------
     玩家反馈"看不到教练在工作" —— 因为它的决策都混在滚动的解说里。
     这里把最近一次决策挂在 gs 上，由记分条常驻显示，
     于是"教练一直在跑"变成**随时可见**。
     ============================================================= */
  /* =============================================================
     📡 实时观察（v9.38.2）
     -------------------------------------------------------------
     用户要求「教练必须**实时**运作」。

     除了"动手"，教练每回合还会产出一句**当前观察**：
     它在盯什么、场上什么最需要处理。
     这样即使没有动作，玩家也能看到教练在实时工作，
     而不是"一片安静 = 没在干活"。
     ============================================================= */
  const obs = coachObserve(gs);
  if (obs) { gs.coachObs = obs; gs.coachObsAt = gs.possession || 0; }

  let last = null;
  if (out.subs) {
    last = '换人：' + out.subs[0].out.name + '↓ / ' + out.subs[0].inn.name + '↑（' + out.subs[0].why + '）';
  } else if (out.timeout) {
    last = '叫暂停：' + out.timeout.why;
  } else if (out.tactics) {
    last = '调整战术：' + out.tactics.why;
  }
  if (last) { gs.coachLast = last; gs.coachLastAt = gs.possession || 0; }
  return out;
}

/* =============================================================
   📡 实时观察：教练这一刻在看什么
   -------------------------------------------------------------
   按"需要处理的紧急程度"挑一条最有价值的说出来。
   没有问题时也明说"场上正常" —— 让玩家知道它在看。
   ============================================================= */
function coachObserve(gs) {
  const t = gs.myTeam, foe = gs.aiTeam;
  if (!t || !t.players || !t.players.length) return null;
  const ctx = coachContext(gs);
  const items = [];

  /* ① 最累的球员 */
  let tired = null, tiredMin = 1;
  t.players.forEach((p) => {
    if (!p || !p.stamina) return;
    const m = p.stamina.cur / p.stamina.max;
    if (m < tiredMin) { tiredMin = m; tired = p; }
  });
  if (tired && tiredMin <= 0.55) {
    items.push({ pri: tiredMin <= 0.30 ? 3 : 2,
      txt: '盯着 ' + tired.name + ' 的体力（' + Math.round(tiredMin * 100) + '%）' });
  }
  /* ② 犯规麻烦 */
  t.players.forEach((p) => {
    const pf = (p.stat && p.stat.pf) || 0;
    if (pf >= 4) items.push({ pri: 3, txt: p.name + ' 已 ' + pf + ' 犯，注意保护' });
    else if (pf === 3) items.push({ pri: 1, txt: p.name + ' 3 犯，开始留意' });
  });
  /* ③ 手感 */
  const fga = t.players.reduce((a, p) => a + ((p.stat && p.stat.fga) || 0), 0);
  const fgm = t.players.reduce((a, p) => a + ((p.stat && p.stat.fgm) || 0), 0);
  if (fga >= 8) {
    const r = fgm / fga;
    if (r < 0.35) items.push({ pri: 2, txt: '全队命中率 ' + Math.round(r * 100) + '%，偏低' });
    else if (r > 0.55) items.push({ pri: 0, txt: '全队命中率 ' + Math.round(r * 100) + '%，手感不错' });
  }
  /* ④ 对手势头 */
  if (foe && foe.runStreak >= 6) {
    items.push({ pri: 3, txt: '对手打出 ' + foe.runStreak + ' 分高潮，要打断' });
  }
  /* ⑤ 分差与时段 */
  if (ctx.clutch) items.push({ pri: 2, txt: '关键时段（剩 ' + Math.round(ctx.remain / 60) + ' 分钟，差 ' + Math.abs(ctx.diff) + ' 分）' });
  else if (ctx.garbage) items.push({ pri: 1, txt: '垃圾时间，多给替补机会' });
  /* ⑥ 战术被克制 */
  if (foe && typeof counterBonus === 'function') {
    const cb = counterBonus(t.off, foe.def);
    if (cb < -0.03) items.push({ pri: 2, txt: '战术被对面克制（' + Math.round(cb * 100) + '%）' });
  }

  if (!items.length) {
    const avg = t.players.reduce((a, p) => a + (p.stamina ? p.stamina.cur / p.stamina.max : 1), 0) / t.players.length;
    return '场上正常（体力均值 ' + Math.round(avg * 100) + '%）';
  }
  items.sort((a, b) => b.pri - a.pri);
  return items[0].txt;
}

/* =============================================================
   ⑧ 教练开关
   ============================================================= */
function coachIsOn() {
  return !(typeof S !== 'undefined' && S && S.coachOn === false);
}
function coachToggle() {
  if (typeof S === 'undefined' || !S) return false;
  S.coachOn = !coachIsOn();
  /* 与旧的 S.autoSub 保持同步（旧代码路径仍在读它，避免中途失效） */
  S.autoSub = S.coachOn;
  /* ★ 开启时立刻允许多换一次（清掉中场开启时的间隔锁） */
  if (S.coachOn && typeof BT !== 'undefined' && BT && BT.gs) {
    BT.gs.lastCoachSub = null;
    BT.gs.coachLast = '已接管，正在观察场上形势…';
  }
  try { if (typeof save === 'function') save(); } catch (e) {}
  return S.coachOn;
}
