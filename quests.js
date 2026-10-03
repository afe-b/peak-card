/* =============================================================
   任务 / 成就 / 图鉴里程碑（v1.2）
   -------------------------------------------------------------
   之前游戏里除了"打 82 场赛季"没有任何短期目标，
   玩家不知道自己该干什么。这里加三层目标：
     ① 每日任务 —— 每天刷新，给稳定的金币来源
     ② 成就     —— 一次性，记录里程碑
     ③ 图鉴里程碑 —— 集齐某队/某档位给大额奖励
   ============================================================= */

/* ---------- 统计计数器（各处 hook 累加） ---------- */
function qsStats() {
  if (!S.stats) {
    S.stats = {
      games: 0, wins: 0, loses: 0, pulls: 0, buys: 0, sells: 0,
      brk: 0, badges: 0, seasonWins: 0, titles: 0, maxStreak: 0,
      streak: 0, coinsEarned: 0, bestScore: 0, threeMade: 0,
    };
  }
  return S.stats;
}
function qsBump(key, n) {
  const st = qsStats();
  st[key] = (st[key] || 0) + (n == null ? 1 : n);
  qsCheckAch();
  save && save();
}

/* ---------- 每日任务 ---------- */
const DAILY_QUESTS = [
  { key: 'd_play', name: '完成 3 场比赛', need: 3, reward: 2600, track: 'games' },
  { key: 'd_win', name: '赢下 2 场比赛', need: 2, reward: 3200, track: 'wins' },
  { key: 'd_pull', name: '招募 5 次', need: 5, reward: 2000, track: 'pulls' },
  { key: 'd_buy', name: '在转会市场签下 1 名球员', need: 1, reward: 2400, track: 'buys' },
];

/* ---------- 成就 ---------- */
const ACHIEVEMENTS = [
  { key: 'a_first_win', name: '首胜', desc: '赢下第一场比赛', need: 1, track: 'wins', reward: 3000 },
  { key: 'a_win10', name: '十胜', desc: '累计赢下 10 场', need: 10, track: 'wins', reward: 8000 },
  { key: 'a_win50', name: '五十胜', desc: '累计赢下 50 场', need: 50, track: 'wins', reward: 30000 },
  { key: 'a_win200', name: '两百胜', desc: '累计赢下 200 场', need: 200, track: 'wins', reward: 120000 },
  { key: 'a_pull100', name: '百抽', desc: '累计招募 100 次', need: 100, track: 'pulls', reward: 20000 },
  { key: 'a_pull500', name: '五百抽', desc: '累计招募 500 次', need: 500, track: 'pulls', reward: 80000 },
  { key: 'a_brk1', name: '初露锋芒', desc: '第一次突破', need: 1, track: 'brk', reward: 3000 },
  { key: 'a_brk20', name: '养成专家', desc: '累计突破 20 阶', need: 20, track: 'brk', reward: 25000 },
  { key: 'a_brk100', name: '点石成金', desc: '累计突破 100 阶', need: 100, track: 'brk', reward: 100000 },
  { key: 'a_streak5', name: '五连胜', desc: '最高连胜达到 5 场', need: 5, track: 'maxStreak', reward: 15000 },
  { key: 'a_streak10', name: '十连胜', desc: '最高连胜达到 10 场', need: 10, track: 'maxStreak', reward: 50000 },
  { key: 'a_sell50', name: '生意人', desc: '累计出售 50 张卡', need: 50, track: 'sells', reward: 12000 },
  { key: 'a_buy50', name: '买手', desc: '累计买入 50 张卡', need: 50, track: 'buys', reward: 12000 },
  { key: 'a_title', name: '总冠军', desc: '拿到第一个总冠军', need: 1, track: 'titles', reward: 60000 },
  { key: 'a_title5', name: '王朝', desc: '拿到 5 个总冠军', need: 5, track: 'titles', reward: 200000 },
];

/* ---------- 图鉴里程碑 ---------- */
const DEX_MILESTONES = [
  { key: 'dex50', name: '收集 50 张', need: 50, reward: 8000 },
  { key: 'dex100', name: '收集 100 张', need: 100, reward: 20000 },
  { key: 'dex200', name: '收集 200 张', need: 200, reward: 50000 },
  { key: 'dex300', name: '收集 300 张', need: 300, reward: 90000 },
  { key: 'dex400', name: '收集 400 张', need: 400, reward: 160000 },
  { key: 'dex500', name: '全图鉴制霸', need: 500, reward: 500000, special: true },
];

/* ---------- 状态 ---------- */
function qsState() {
  if (!S.quest) S.quest = { day: '', daily: {}, claimed: {}, ach: {}, dex: {} };
  if (!S.quest.daily) S.quest.daily = {};
  if (!S.quest.claimed) S.quest.claimed = {};
  if (!S.quest.ach) S.quest.ach = {};
  if (!S.quest.dex) S.quest.dex = {};
  const today = new Date().toISOString().slice(0, 10);
  if (S.quest.day !== today) {
    S.quest.day = today;
    S.quest.daily = {};                       // 每日进度清零
    Object.keys(S.quest.claimed).forEach((k) => {
      if (k.indexOf('d_') === 0) delete S.quest.claimed[k];   // 每日领取记录也清
    });
  }
  return S.quest;
}
/** 某个追踪项的当前进度 */
function qsProgress(track) {
  // 连胜取历史最高，其余取累计
  return qsStats()[track] || 0;
}
/** 每日任务列表（带进度与是否可领） */
function dailyList() {
  const q = qsState();
  return DAILY_QUESTS.map((d) => {
    const cur = Math.min(d.need, q.daily[d.key] || 0);
    return { ...d, cur, done: cur >= d.need, claimed: !!q.claimed[d.key] };
  });
}
/** 成就列表 */
function achList() {
  const q = qsState();
  return ACHIEVEMENTS.map((a) => {
    const cur = Math.min(a.need, qsProgress(a.track));
    return { ...a, cur, done: cur >= a.need, claimed: !!q.claimed[a.key] };
  });
}
/** 图鉴里程碑列表 */
function dexList() {
  const q = qsState();
  const have = Object.keys(S.owned).length;
  return DEX_MILESTONES.map((d) => ({
    ...d, cur: Math.min(d.need, have), done: have >= d.need,
    claimed: !!q.dex[d.key],
  }));
}

/** 领取奖励 */
function qsClaim(kind, key) {
  const q = qsState();
  let item = null;
  if (kind === 'daily') item = dailyList().filter((x) => x.key === key)[0];
  else if (kind === 'ach') item = achList().filter((x) => x.key === key)[0];
  else item = dexList().filter((x) => x.key === key)[0];
  if (!item || !item.done) { Sfx.fail(); toast('还没完成'); return false; }
  if (kind === 'dex') {
    if (q.dex[key]) { Sfx.fail(); toast('已经领过了'); return false; }
    q.dex[key] = true;
  } else {
    if (q.claimed[key]) { Sfx.fail(); toast('已经领过了'); return false; }
    q.claimed[key] = true;
  }
  S.coins += item.reward;
  qsStats().coinsEarned += item.reward;
  Sfx.coin();
  toast(`领取成功！🪙 +${fmt(item.reward)}`);
  pushNews && pushNews(`【任务】完成「${item.name}」，获得 🪙${fmt(item.reward)}`,
    'deal', { mine: true, price: item.reward });
  save && save();
  if (typeof renderLeagueBody === 'function') renderLeagueBody();
  if (typeof renderMine === 'function') renderMine();
  return true;
}

/* =============================================================
   ★ 连胜奖金（v9.27 新增玩法）
   -------------------------------------------------------------
   原来连胜只在任务里计数（五连胜/十连胜成就），除了成就奖励之外
   **没有任何即时反馈** —— 赢了第 4 场和第 1 场拿到的一模一样。

   现在每赢一场，按当前连胜给额外奖金：
     2 连胜起才开始给，每多赢一场多 +8% 基础奖金，最多 +80%（10 连胜封顶）
   配合「补给按钮每日上限」，把收益重心从"挂机点按钮"搬回"亲手打球"。

   ⚠️ 必须在 qsOnBattle() **之后**调用 —— 它负责把 st.streak 加一。
   ============================================================= */
const STREAK_STEP = 0.08;      // 每多一场连胜，多得基础奖金的 8%
const STREAK_MAX = 0.80;       // 封顶 +80%（10 连胜）
const STREAK_FROM = 2;         // 从 2 连胜开始给（1 连胜不额外给，避免无感）

/** 当前连胜能拿多少额外奖金。baseOverride 不传就用 ECO.WIN_BASE */
function streakBonus(baseOverride) {
  const st = qsStats();
  const n = Math.max(0, st.streak || 0);
  if (n < STREAK_FROM) return { n, bonus: 0, mul: 0 };
  const base = baseOverride != null ? baseOverride : ECO.WIN_BASE;
  const mul = Math.min(STREAK_MAX, (n - STREAK_FROM + 1) * STREAK_STEP);
  return { n, bonus: Math.round(base * mul), mul };
}
/** 连胜奖金的文案（比赛结算页用） */
function streakBonusText() {
  const s = streakBonus();
  if (!s.n) return '';
  if (!s.bonus) return `${s.n} 连胜`;
  return `${s.n} 连胜　额外 🪙${fmt(s.bonus)}（+${Math.round(s.mul * 100)}%）`;
}

/** 比赛结束后调用：累加统计 + 刷新每日进度 */
function qsOnBattle(win, myScore, threeMade) {
  const st = qsStats();
  st.games++;
  if (win) {
    st.wins++;
    st.streak = (st.streak || 0) + 1;
    st.maxStreak = Math.max(st.maxStreak || 0, st.streak);
  } else {
    st.loses++;
    st.streak = 0;
  }
  if (myScore > (st.bestScore || 0)) st.bestScore = myScore;
  if (threeMade) st.threeMade += threeMade;
  // 每日进度
  const q = qsState();
  q.daily.d_play = (q.daily.d_play || 0) + 1;
  if (win) q.daily.d_win = (q.daily.d_win || 0) + 1;
  qsCheckAch();
}
function qsOnPull(n) {  const q = qsState();
  q.daily.d_pull = (q.daily.d_pull || 0) + (n || 1);
  qsBump('pulls', n || 1);
}
function qsOnBuy() {
  const q = qsState();
  q.daily.d_buy = (q.daily.d_buy || 0) + 1;
  qsBump('buys', 1);
}
function qsOnSell() { qsBump('sells', 1); }
function qsOnBreak(n) { qsBump('brk', n || 1); }
function qsOnTitle() { qsBump('titles', 1); }

/** 有成就达成时弹提示（只在刚达成的那一刻提示一次） */
function qsCheckAch() {
  const q = qsState();
  ACHIEVEMENTS.forEach((a) => {
    if (q.ach[a.key]) return;
    if (qsProgress(a.track) >= a.need) {
      q.ach[a.key] = true;
      try {
        toast(`🏆 成就达成「${a.name}」！去联赛-任务页领 🪙${fmt(a.reward)}`);
        Sfx.reveal('gold');
      } catch (e) {}
    }
  });
}

/* ---------- 任务页 UI ---------- */
function questHTML() {
  const d = dailyList(), a = achList(), x = dexList();
  const canDaily = d.filter((i) => i.done && !i.claimed).length;
  const canAch = a.filter((i) => i.done && !i.claimed).length;
  const canDex = x.filter((i) => i.done && !i.claimed).length;
  const row = (i, kind) => `
    <div class="qs-row${i.done ? ' done' : ''}${i.claimed ? ' got' : ''}">
      <div class="qs-body">
        <div class="qs-name">${i.name}${
          i.special ? ' <em class="qs-special">终极</em>' : ''}</div>
        <div class="qs-prog">
          <div class="qs-bar"><i style="width:${
            Math.round(Math.min(1, i.cur / i.need) * 100)}%"></i></div>
          <span>${i.cur} / ${i.need}</span>
        </div>
        ${i.desc ? `<div class="qs-desc">${i.desc}</div>` : ''}
      </div>
      <button class="qs-btn${i.done && !i.claimed ? ' hot' : ''}"
        data-qs="${kind}" data-qk="${i.key}"
        ${i.done && !i.claimed ? '' : 'disabled'}>
        ${i.claimed ? '已领取' : i.done ? '🪙 ' + fmt(i.reward) : '🪙 ' + fmt(i.reward)}
      </button>
    </div>`;

  return `
    <div class="qs-wrap">
      <div class="qs-head">
        <b>任 务</b>
        <span>${canDaily + canAch + canDex > 0
          ? `有 <em>${canDaily + canAch + canDex}</em> 个奖励可领取`
          : '完成下方目标即可领取金币'}</span>
      </div>
      <div class="qs-sec">
        <div class="qs-sec-t">📅 今日任务
          <em>每天 0 点刷新</em></div>
        ${d.map((i) => row(i, 'daily')).join('')}
      </div>
      <div class="qs-sec">
        <div class="qs-sec-t">🏆 成就 <em>${a.filter((i) => i.claimed).length}/${
          a.length} 已完成</em></div>
        ${a.map((i) => row(i, 'ach')).join('')}
      </div>
      <div class="qs-sec">
        <div class="qs-sec-t">📖 图鉴里程碑 <em>${
          Object.keys(S.owned).length}/500 已收集</em></div>
        ${x.map((i) => row(i, 'dex')).join('')}
      </div>
    </div>`;
}
function bindQuest() {
  document.querySelectorAll('[data-qs]').forEach((b) => {
    if (b.disabled) return;
    b.onclick = () => qsClaim(b.dataset.qs, b.dataset.qk);
  });
}

/* ---------- 调试：?questtest=1 任务成就系统自检 ---------- */
(function questTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('questtest')) return;
    setTimeout(() => {
      const out = [];
      out.push('每日任务 ' + DAILY_QUESTS.length + ' 个 / 成就 ' +
        ACHIEVEMENTS.length + ' 个 / 图鉴里程碑 ' + DEX_MILESTONES.length + ' 个');
      // ① 初始状态
      const d0 = dailyList();
      out.push('初始可领=' + d0.filter((i) => i.done && !i.claimed).length);
      // ② 模拟打 3 场赢 2 场
      qsOnBattle(true, 110, 12); qsOnBattle(true, 105, 10); qsOnBattle(false, 98, 8);
      const st = qsStats();
      out.push('3 场后：场次' + st.games + ' 胜' + st.wins + ' 连胜' +
        st.streak + ' 最高连胜' + st.maxStreak);
      const d1 = dailyList();
      const doneNow = d1.filter((i) => i.done && !i.claimed);
      out.push('可领每日=' + doneNow.length + ' 个' +
        (doneNow.length >= 2 ? ' ✓' : ' ✗') +
        '（' + doneNow.map((i) => i.name).join('、') + '）');
      // ③ 领奖
      const c0 = S.coins;
      if (doneNow.length) {
        qsClaim('daily', doneNow[0].key);
        out.push('领取「' + doneNow[0].name + '」→ 金币 +' +
          fmt(S.coins - c0) + (S.coins > c0 ? ' ✓' : ' ✗'));
        out.push('重复领取=' + (qsClaim('daily', doneNow[0].key) ? '✗还能领' : '✓被拦下'));
      }
      // ④ 成就自动解锁
      const a1 = achList();
      out.push('成就进度：' + a1.filter((i) => i.done).length + ' 个已达门槛');
      const firstWin = a1.filter((i) => i.key === 'a_first_win')[0];
      out.push('「首胜」成就=' + (firstWin.done ? '✓已达成' : '✗'));
      // ⑤ 招募 / 买卖计数
      qsOnPull(10); qsOnBuy(); qsOnSell(); qsOnBreak(3);
      const st2 = qsStats();
      out.push('招募' + st2.pulls + ' 买入' + st2.buys + ' 卖出' + st2.sells +
        ' 突破' + st2.brk);
      // ⑥ 图鉴里程碑
      const x1 = dexList();
      const have = Object.keys(S.owned).length;
      out.push('图鉴 ' + have + ' 张，已达里程碑 ' +
        x1.filter((i) => i.done).length + ' 个');
      // ⑦ 每日刷新
      const q2 = qsState();
      q2.day = '2000-01-01';
      qsState();
      out.push('跨天后每日进度重置=' +
        (Object.keys(qsState().daily).length === 0 ? '✓' : '✗'));
      // ⑧ 界面
      switchTab('league'); lgTab = 'quest'; renderLeague();
      setTimeout(() => {
        const box = document.getElementById('lgBody');
        const rows = box.querySelectorAll('.qs-row').length;
        const hot = box.querySelectorAll('.qs-btn.hot').length;
        out.push('任务页渲染 ' + rows + ' 行 / 可领按钮 ' + hot + ' 个' +
          (rows > 20 ? ' ✓' : ' ✗'));
        document.title = 'QUEST ' + out.join(' | ');
      }, 500);
    }, 900);
  } catch (e) { document.title = 'QUEST-ERR ' + e.message; }
})();

/* =============================================================
   新手引导（v1.2）
   -------------------------------------------------------------
   一进游戏就是 7 个页签 + 40 个徽章 + 战术克制 + 体力 + 市场，
   新玩家完全不知道从哪开始。这里做 5 步引导，
   每步告诉他"去哪个页签、做什么、为什么"。
   可以随时跳过，跳过之后还能在设置里重新打开。
   ============================================================= */
const TUTORIAL = [
  {
    key: 'welcome', tab: 'home', title: '欢迎来到巅峰球星卡',
    body: '你是一名球队经理。<br>目标：收集球星卡 → 组建阵容 → 打 82 场常规赛 → 冲击总冠军。<br><br>我们先从最简单的开始。',
    action: '知道啦', cta: null,
  },
  {
    key: 'pull', tab: 'home', title: '① 先招募几个球员',
    body: '点下面的<b>「招募十次」</b>，就能得到 10 张球员卡。<br><br>卡片分五档：<br><span class="tt-t silver">银卡</span> <span class="tt-t gold">金卡</span> <span class="tt-t purple">紫卡</span> <span class="tt-t mg">时刻金卡</span> <span class="tt-t mp">时刻紫卡</span><br><br>档位越高，综合评分越高。',
    action: '去招募', cta: 'home',
  },
  {
    key: 'team', tab: 'team', title: '② 把球员排进阵容',
    body: '左边是<b>可用球员</b>，右边是<b>球场</b>。<br><br><b>拖拽</b>球员卡就能换人：<br>· 拖到首发 5 个位置 → 上场比赛<br>· 拖到替补席 → 轮换待命<br><br>点卡片左下角的 <b>✕</b> 可以把人卸下。',
    action: '去看看', cta: 'team',
  },
  {
    key: 'battle', tab: 'battle', title: '③ 打一场比赛',
    body: '比赛是<b>文字直播</b>形式，自动进行。<br><br>你可以随时：<br>· 点<b>战术按钮</b>换打法（进攻 4 种 / 防守 3 种）<br>· 点<b>球员卡</b>看他的详细数据与徽章<br>· 点<b>暂停</b>换人（有 60 秒考虑时间）<br><br>体力会随比赛消耗，累了要换人。',
    action: '去打一场', cta: 'battle',
  },
  {
    key: 'market', tab: 'league', title: '④ 转会市场',
    body: '在这里用金币<b>买卖球员</b>。<br><br>· 买同一名球员的<b>重复卡</b>可以突破，提升能力<br>· 一键清仓可以快速把没用的卡换成金币<br>· 卖球员要扣 20% 手续费<br><br>金币主要来自比赛奖金和任务奖励。',
    action: '去看看', cta: 'league',
  },
  {
    key: 'break', tab: 'mine', title: '⑤ 突破 = 变强的核心',
    body: '点自己的任意一张卡，能看到<b>「突破」</b>按钮。<br><br>每消耗几张重复卡突破一阶：<br>· 全部能力 <b>+4</b>，综合 <b>+2</b><br>· 还能<b>解锁徽章槽位</b>，开启更高品质的徽章<br><br>满突破（8 阶）的球员会强出一大截。<br>练满一张时刻紫卡大约需要 2~3 个赛季。',
    action: '开始游戏', cta: null,
  },
];

function tutState() {
  if (!S.tut) S.tut = { done: false, step: 0 };
  return S.tut;
}
/** 当前是否该显示引导 */
function tutActive() {
  return !tutState().done;
}
/** 打开/刷新引导浮层 */
function renderTutorial() {
  const st = tutState();
  const el = document.getElementById('tutLayer');
  if (!el) return;
  if (st.done) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const t = TUTORIAL[st.step] || TUTORIAL[0];
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="tut-mask"></div>
    <div class="tut-box">
      <div class="tut-dots">${TUTORIAL.map((x, i) =>
        `<i class="${i === st.step ? 'on' : ''}${i < st.step ? ' past' : ''}"></i>`
      ).join('')}</div>
      <div class="tut-title">${t.title}</div>
      <div class="tut-body">${t.body}</div>
      <div class="tut-btns">
        <button class="tut-skip" id="tutSkip">跳过引导</button>
        <button class="tut-next" id="tutNext">${t.action}</button>
      </div>
    </div>`;
  const nx = document.getElementById('tutNext');
  if (nx) nx.onclick = () => tutNext();
  const sk = document.getElementById('tutSkip');
  if (sk) sk.onclick = () => {
    tutState().done = true; save(); Sfx.click();
    renderTutorial();
    toast('已跳过引导，可在设置里重新打开');
  };
}
function tutNext() {
  const st = tutState();
  const t = TUTORIAL[st.step];
  Sfx.click();
  st.step++;
  if (st.step >= TUTORIAL.length) {
    st.done = true;
    save();
    renderTutorial();
    // 引导结束送一份启动物资
    S.coins += 15000;
    save();
    toast('🎉 引导完成！送你 🪙15,000 启动资金');
    Sfx.reveal('gold');
    return;
  }
  save();
  // 跳到该步对应的页签
  const nx = TUTORIAL[st.step];
  if (nx && nx.tab && typeof switchTab === 'function' && nx.tab !== 'home') {
    setTimeout(() => { try { switchTab(nx.tab); } catch (e) {} }, 60);
  }
  renderTutorial();
}
/** 重新打开引导（设置页用） */
function tutRestart() {
  S.tut = { done: false, step: 0 };
  save();
  if (typeof switchTab === 'function') switchTab('home');
  renderTutorial();
  toast('引导已重新开始');
}

/* ---------- 调试：?tuttest=1 新手引导自检 ---------- */
(function tutTest() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('tuttest')) return;
    setTimeout(() => {
      const out = [];
      S.tut = { done: false, step: 0 };
      renderTutorial();
      const el = document.getElementById('tutLayer');
      out.push('引导步骤数=' + TUTORIAL.length +
        (TUTORIAL.length === 5 ? ' ✓' : ''));
      out.push('浮层已显示=' +
        (el && !el.classList.contains('hidden') ? '✓' : '✗'));
      const title = el.querySelector('.tut-title');
      out.push('第 1 步「' + (title ? title.textContent : '?') + '」');
      out.push('进度点=' + el.querySelectorAll('.tut-dots i').length + ' 个');
      // 逐步点完
      const seen = [];
      for (let i = 0; i < TUTORIAL.length; i++) {
        const t2 = el.querySelector('.tut-title');
        seen.push(t2 ? t2.textContent.slice(0, 4) : '?');
        const nx = document.getElementById('tutNext');
        if (nx) nx.click();
      }
      out.push('走完 5 步：' + seen.join('→'));
      out.push('引导结束标记=' + (tutState().done ? '✓' : '✗'));
      out.push('浮层已关闭=' +
        (el.classList.contains('hidden') ? '✓' : '✗'));
      // 跳过功能
      S.tut = { done: false, step: 2 };
      renderTutorial();
      const sk = document.getElementById('tutSkip');
      if (sk) sk.click();
      out.push('跳过按钮=' + (tutState().done ? '✓生效' : '✗'));
      // 重新打开
      tutRestart();
      out.push('设置里重开=' +
        (!tutState().done && tutState().step === 0 ? '✓' : '✗'));
      S.tut.done = true; renderTutorial(); save();
      document.title = 'TUT ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'TUT-ERR ' + e.message; }
})();

/* =============================================================
   阵容预设（v1.3）
   -------------------------------------------------------------
   82 场赛季里经常要换阵容（打强队上主力、垃圾时间练替补）。
   只能存一套太不方便，这里给 3 套槽位，一键切换。
   ============================================================= */
const PRESET_SLOTS = 3;
const PRESET_NAMES = ['主力阵容', '防守阵容', '练兵阵容'];

function presetState() {
  if (!S.presets) S.presets = [];
  while (S.presets.length < PRESET_SLOTS) S.presets.push(null);
  return S.presets;
}
/** 把当前阵容存进第 i 个槽位 */
function presetSave(i) {
  const p = presetState();
  const r = rosterIds();
  const starters = r.starters.filter(Boolean);
  const bench = r.bench.filter(Boolean);
  if (starters.length < 5) {
    Sfx.fail(); toast('首发不足 5 人，先补齐再保存');
    return false;
  }
  p[i] = {
    starters: starters.slice(),
    bench: bench.slice(),
    off: S.offTac || 'balanced',
    def: S.defTac || 'man',
    at: Date.now(),
  };
  save(); Sfx.reveal('gold');
  toast(`已保存到「${PRESET_NAMES[i]}」`);
  renderRoster && renderRoster();
  return true;
}
/** 读取第 i 个槽位的阵容 */
function presetLoad(i) {
  const p = presetState();
  const it = p[i];
  if (!it) { Sfx.fail(); toast('这个槽位还是空的'); return false; }
  // 过滤掉已经不在收藏里的卡（卖掉了之类）
  const ok = (id) => S.owned[id];
  const starters = it.starters.filter(ok).slice(0, ROSTER.starters);
  const bench = it.bench.filter(ok).slice(0, ROSTER.bench);
  if (starters.length < 5) {
    Sfx.fail();
    toast(`「${PRESET_NAMES[i]}」里有人已经不在收藏了，剩下 ${starters.length} 人`);
    return false;
  }
  // 同一球员只能上一张（预设可能是旧规则下存的）
  const seen = new Set();
  const clean = (arr) => arr.filter((id) => {
    const k = playerKeyOf(id);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  S.roster = { starters: clean(starters), bench: clean(bench) };
  S.rosterManual = true;
  if (it.off) S.offTac = it.off;
  if (it.def) S.defTac = it.def;
  save(); Sfx.click();
  toast(`已切换到「${PRESET_NAMES[i]}」`);
  renderRoster && renderRoster();
  renderBattle && renderBattle();
  return true;
}
function presetClear(i) {
  const p = presetState();
  p[i] = null;
  save(); Sfx.click();
  toast(`已清空「${PRESET_NAMES[i]}」`);
  renderRoster && renderRoster();
}
/** 预设条 UI */
function presetBarHTML() {
  const p = presetState();
  return `<div class="ps-bar">
    <span class="ps-label">阵容预设</span>
    ${p.map((it, i) => `
      <div class="ps-slot${it ? ' has' : ''}">
        <button class="ps-use" data-psload="${i}" ${it ? '' : 'disabled'}
          title="${it ? '切换到这套阵容' : '空槽位'}">
          <b>${PRESET_NAMES[i]}</b>
          <em>${it ? it.starters.length + '+' + it.bench.length + ' 人'
            : '未保存'}</em>
        </button>
        <button class="ps-save" data-pssave="${i}"
          title="把当前阵容存到这里">存</button>
        ${it ? `<button class="ps-clr" data-psclr="${i}" title="清空">✕</button>` : ''}
      </div>`).join('')}
  </div>`;
}
function bindPreset() {
  document.querySelectorAll('[data-psload]').forEach((b) => {
    b.onclick = () => presetLoad(parseInt(b.dataset.psload, 10));
  });
  document.querySelectorAll('[data-pssave]').forEach((b) => {
    b.onclick = () => presetSave(parseInt(b.dataset.pssave, 10));
  });
  document.querySelectorAll('[data-psclr]').forEach((b) => {
    b.onclick = () => presetClear(parseInt(b.dataset.psclr, 10));
  });
}

/* =============================================================
   球员对比（v1.3）
   -------------------------------------------------------------
   从"我的"或图鉴里选两张卡并排比较：逐项数值 + 差异高亮 + 徽章差异。
   换人时不用再凭记忆比。
   ============================================================= */
let cmpA = null, cmpB = null;

function renderCompare() {
  const el = document.getElementById('cmpLayer');
  if (!el) return;
  if (!cmpA || !cmpB) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const ca = CARD_BY_ID[cmpA], cb = CARD_BY_ID[cmpB];
  if (!ca || !cb) return;
  const oa = S.owned[cmpA] || { brk: 0 };
  const ob = S.owned[cmpB] || { brk: 0 };
  const sa = statsOf(ca, oa.brk), sb = statsOf(cb, ob.brk);
  const ba = badgesOf(ca, oa.brk), bb = badgesOf(cb, ob.brk);
  const keys = []; const seenK = {};
  ba.concat(bb).forEach((b) => { if (!seenK[b.key]) { seenK[b.key] = 1; keys.push(b.key); } });
  const bmapA = {}, bmapB = {};
  ba.forEach((b) => { bmapA[b.key] = b.tier; });
  bb.forEach((b) => { bmapB[b.key] = b.tier; });

  const head = (c, st, o, side) => `
    <div class="cmp-head" style="${tierVar(c.tier)}">
      <div class="cmp-img"><img src="${c.photo}" alt=""
        onerror="this.parentNode.style.visibility='hidden'"></div>
      <div class="cmp-nm">${c.name}</div>
      <div class="cmp-meta">${TIERS[c.tier].name} · ${c.pos}${
        o.brk ? ' · 突破 ' + o.brk : ''}</div>
      <div class="cmp-ovr">${st.ovr}</div>
      ${side ? `<button class="cmp-clear" data-cmpclr="${side}">换一张</button>` : ''}
    </div>`;

  const rowHTML = (g) => `
    <div class="cmp-group">
      <div class="cmp-gt">${g.name}</div>
      ${g.attrs.map((a) => {
        const va = sa.attrs[a.key] || 0, vb = sb.attrs[a.key] || 0;
        const d = va - vb;
        const cls = d > 0 ? 'win' : d < 0 ? 'lose' : '';
        const col = (v) => v >= 110 ? '#c084fc' : v >= 80 ? '#3fc46a' : '#8b96ad';
        return `<div class="cmp-row">
          <b style="color:${col(va)}">${va}</b>
          <span>${a.name}</span>
          <b style="color:${col(vb)}">${vb}</b>
          <em class="${cls}">${d > 0 ? '+' + d : d < 0 ? d : '—'}</em>
        </div>`;
      }).join('')}
    </div>`;

  // 简化的分组（用 ATTR_GROUPS 的前几组，避免太长）
  const groups = ATTR_GROUPS.filter((g) =>
    g.attrs.some((a) => (sa.attrs[a.key] || 0) !== (sb.attrs[a.key] || 0)));
  const shown = groups.slice(0, 6);

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="cmp-mask"></div>
    <div class="cmp-box">
      <div class="cmp-top">
        ${head(ca, sa, oa)}
        <div class="cmp-vs">VS</div>
        ${head(cb, sb, ob)}
      </div>
      <div class="cmp-total">
        <b class="${sa.ovr > sb.ovr ? 'win' : sa.ovr < sb.ovr ? 'lose' : ''}">
          综合 ${sa.ovr}</b>
        <span>徽章 ${ba.length} : ${bb.length}</span>
        <b class="${sb.ovr > sa.ovr ? 'win' : sb.ovr < sa.ovr ? 'lose' : ''}">
          ${sb.ovr} 综合</b>
      </div>
      <div class="cmp-body">
        ${shown.map(rowHTML).join('')}
        <div class="cmp-group">
          <div class="cmp-gt">徽章差异</div>
          ${keys.length ? keys.map((k) => {
            const da = BADGE_DEFS.filter((d) => d.key === k)[0] || { name: k, icon: '' };
            const ta = bmapA[k], tb = bmapB[k];
            const rank = (t) => t ? BADGE_TIERS[t].rank : 0;
            const cls = rank(ta) > rank(tb) ? 'win' : rank(ta) < rank(tb) ? 'lose' : '';
            const show = (t) => t
              ? `<i style="background:${BADGE_TIERS[t].color}">${BADGE_TIERS[t].rank}</i>`
              : '<i class="none">—</i>';
            return `<div class="cmp-row badge ${cls}">
              ${show(ta)}<span>${da.name}</span>${show(tb)}</div>`;
          }).join('') : '<div class="cmp-none">两张卡都没有徽章</div>'}
        </div>
      </div>
      <button class="cmp-close" id="cmpClose">关 闭</button>
    </div>`;
  const cl = document.getElementById('cmpClose');
  if (cl) cl.onclick = () => { Sfx.click(); cmpA = null; cmpB = null; renderCompare(); };
  el.querySelectorAll('[data-cmpclr]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.cmpclr === 'a') cmpA = null; else cmpB = null;
      Sfx.click(); renderCompare();
      toast('再点一张卡就能继续对比');
    };
  });
  el.querySelector('.cmp-mask').onclick = () => {
    cmpA = null; cmpB = null; renderCompare();
  };
}
/** 把一张卡加进对比（点卡时调用） */
function compareAdd(id) {
  if (!cmpA) cmpA = id;
  else if (!cmpB && id !== cmpA) cmpB = id;
  else { cmpA = id; cmpB = null; }
  renderCompare();
}

/* ---------- 调试：?v13test=1 v1.3 三项功能自检 ---------- */
(function v13Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('v13test')) return;
    setTimeout(() => {
      const out = [];
      // ===== ① 阵容预设 =====
      S.presets = [null, null, null];
      switchTab('team');
      setTimeout(() => {
        const ps = presetState();
        out.push('预设槽位=' + ps.length + (ps.length === 3 ? ' ✓' : ' ✗'));
        // 存第一套
        const r0 = rosterIds();
        presetSave(0);
        out.push('保存「' + PRESET_NAMES[0] + '」=' +
          (presetState()[0] ? '✓ ' + presetState()[0].starters.length + '首发' : '✗'));
        // 换一套再存
        const all = ownedByOvr();
        const pick = [];
        const seen = new Set();
        all.forEach((c) => {
          const k = playerKeyOf(c.id);
          if (seen.has(k) || pick.length >= 10) return;
          seen.add(k); pick.push(c.id);
        });
        if (pick.length >= 5) {
          S.roster = { starters: pick.slice(0, 5), bench: pick.slice(5, 10) };
          S.rosterManual = true;
          presetSave(1);
          out.push('保存「' + PRESET_NAMES[1] + '」=' +
            (presetState()[1] ? '✓' : '✗'));
          // 读回第一套
          S.roster = { starters: [], bench: [] }; S.rosterManual = false;
          presetLoad(0);
          const r1 = rosterIds();
          const same = r1.starters.filter(Boolean).join(',') ===
            r0.starters.filter(Boolean).join(',');
          out.push('读回主力阵容=' + (same ? '✓一致' : '✗不一致'));
        }
        // 清空
        presetClear(1);
        out.push('清空槽位=' + (presetState()[1] === null ? '✓' : '✗'));
        // 界面
        const el1 = document.getElementById('scr-team');
        out.push('预设条渲染=' +
          (el1.querySelectorAll('.ps-slot').length === 3 ? '✓3 个槽' : '✗'));

        // ===== ② 球员对比 =====
        const a = CARDS.filter((c) => S.owned[c.id])[0];
        const b = CARDS.filter((c) => S.owned[c.id] && c.id !== a.id)[0];
        cmpA = a.id; cmpB = b.id; renderCompare();
        setTimeout(() => {
          const cl = document.getElementById('cmpLayer');
          out.push('对比浮层=' +
            (cl && !cl.classList.contains('hidden') ? '✓' : '✗'));
          out.push('对比「' + a.name + '」vs「' + b.name + '」');
          out.push('对比行数=' + cl.querySelectorAll('.cmp-row').length +
            ' 徽章差异=' + cl.querySelectorAll('.cmp-row.badge').length);
          out.push('综合对比=' +
            (cl.querySelector('.cmp-total') ? '✓' : '✗'));
          cmpA = null; cmpB = null; renderCompare();

          // ===== ③ 历史冠军墙 =====
          S.history = [];
          histRecord(2026, SEASON.MY_KEY, '迈克尔·乔丹', '夺冠');
          histRecord(2027, '波士顿凯尔特人', '拉里·伯德', '止步3轮');
          histRecord(2028, SEASON.MY_KEY, '勒布朗·詹姆斯', '夺冠');
          const h = historyState();
          out.push('历史记录=' + h.length + ' 条（倒序 最新=' + h[0].year + '）');
          out.push('我的冠军=' + h.filter((x) => x.mine).length + ' 个');
          switchTab('league'); lgTab = 'history'; renderLeague();
          setTimeout(() => {
            const box = document.getElementById('lgBody');
            out.push('冠军墙渲染=' + box.querySelectorAll('.hs-year').length +
              ' 年 / ' + box.querySelectorAll('.hs-year.mine').length + ' 个冠军高亮' +
              (box.querySelectorAll('.hs-year').length === 3 ? ' ✓' : ' ✗'));
            // 顺便看看任务页和历史页都在
            out.push('联赛子页签含 任务/历史=' +
              (document.querySelector('[data-lgtab="quest"]') &&
               document.querySelector('[data-lgtab="history"]') ? '✓' : '✗'));
            document.title = 'V13 ' + out.join(' | ');
          }, 400);
        }, 400);
      }, 500);
    }, 900);
  } catch (e) { document.title = 'V13-ERR ' + e.message; }
})();

/* =============================================================
   v1.4 深度打磨
   ============================================================= */

/* ---------- ① 练习赛（无风险） ----------
   原来每一场对战都算联赛战绩，想试新战术/新阵容就要付出战绩代价。
   练习赛不计战绩、奖金减半，纯练手。 */

/* ---------- ② AI 教练风格 ----------
   不同球队偏好不同战术，打起来才有"对手个性"。
   勇士爱三分、灰熊爱内线、热火爱联防…… */
const COACH_STYLE = {
  gsw: { off: 'perimeter', def: 'man',     name: '跑轰三分' },
  bos: { off: 'perimeter', def: 'man',     name: '外线强攻' },
  mem: { off: 'inside',    def: 'zone23',  name: '内线绞杀' },
  mia: { off: 'balanced',  def: 'zone23',  name: '铁血联防' },
  den: { off: 'inside',    def: 'man',     name: '内线策应' },
  mil: { off: 'inside',    def: 'zone23',  name: '内线碾压' },
  lal: { off: 'balanced',  def: 'man',     name: '均衡强攻' },
  phx: { off: 'perimeter', def: 'zone32',  name: '中投大队' },
  dal: { off: 'perimeter', def: 'zone32',  name: '持球大核' },
  okc: { off: 'runGun',    def: 'man',     name: '青春风暴' },
  sac: { off: 'runGun',    def: 'man',     name: '快速反击' },
  ind: { off: 'runGun',    def: 'zone32',  name: '跑轰' },
  atl: { off: 'perimeter', def: 'zone32',  name: '挡拆外弹' },
  nyk: { off: 'inside',    def: 'man',     name: '硬碰硬' },
  phi: { off: 'inside',    def: 'man',     name: '内线强攻' },
  cle: { off: 'inside',    def: 'zone23',  name: '双塔' },
  min: { off: 'inside',    def: 'zone23',  name: '内线封锁' },
  nop: { off: 'inside',    def: 'man',     name: '冲击篮下' },
  orl: { off: 'inside',    def: 'zone23',  name: '高大阵容' },
  hou: { off: 'runGun',    def: 'zone32',  name: '无限换防' },
  uta: { off: 'balanced',  def: 'zone23',  name: '体系篮球' },
  sas: { off: 'balanced',  def: 'man',     name: '团队篮球' },
  lac: { off: 'perimeter', def: 'man',     name: '锋线投射' },
  bkn: { off: 'perimeter', def: 'zone32',  name: '外线火力' },
  chi: { off: 'balanced',  def: 'man',     name: '中距离' },
  tor: { off: 'runGun',    def: 'man',     name: '长臂换防' },
  was: { off: 'runGun',    def: 'zone32',  name: '快速攻防' },
  cha: { off: 'perimeter', def: 'zone32',  name: '外线开火' },
  det: { off: 'inside',    def: 'man',     name: '内线冲击' },
  por: { off: 'perimeter', def: 'man',     name: '后场双枪' },
};
function coachStyle(key) {
  return COACH_STYLE[key] || { off: 'balanced', def: 'man', name: '常规' };
}

/* ---------- ③ 战术熟练度 ----------
   同一套战术用得多会越来越顺手（+命中率），
   总换战术则一直是生疏状态。逼玩家形成自己的打法。 */
const TAC_MASTERY_STEP = 0.006;      // 每用一次涨 0.6%
const TAC_MASTERY_MAX = 0.06;        // 最多 +6%
function tacMasteryState() {
  if (!S.tacUse) S.tacUse = { off: {}, def: {} };
  if (!S.tacUse.off) S.tacUse.off = {};
  if (!S.tacUse.def) S.tacUse.def = {};
  return S.tacUse;
}
/** 记一次战术使用 */
function tacBump(offKey, defKey) {
  const t = tacMasteryState();
  if (offKey) t.off[offKey] = (t.off[offKey] || 0) + 1;
  if (defKey) t.def[defKey] = (t.def[defKey] || 0) + 1;
}
/** 取某套进攻战术的熟练度加成 */
function tacMasteryOff(key) {
  const t = tacMasteryState();
  return Math.min(TAC_MASTERY_MAX, (t.off[key] || 0) * TAC_MASTERY_STEP);
}
function tacMasteryDef(key) {
  const t = tacMasteryState();
  return Math.min(TAC_MASTERY_MAX, (t.def[key] || 0) * TAC_MASTERY_STEP);
}
/** 熟练度等级文字 */
function tacMasteryLabel(key, kind) {
  const n = (tacMasteryState()[kind] || {})[key] || 0;
  if (n >= 10) return { txt: '精通', cls: 'm3' };
  if (n >= 5) return { txt: '熟练', cls: 'm2' };
  if (n >= 2) return { txt: '熟悉', cls: 'm1' };
  return { txt: '生疏', cls: 'm0' };
}

/* ---------- ④ 背靠背疲劳 ----------
   连续比赛不休息，体力上限会下降（模拟赛程密集）。 */
function fatigueOf() {
  if (!S.fatigue) S.fatigue = { lastDay: 0, level: 0 };
  return S.fatigue;
}
/** 打了一场之后调用 */
function fatigueAfterGame(day) {
  const f = fatigueOf();
  const gap = day - (f.lastDay || 0);
  if (gap <= 1 && f.lastDay) f.level = Math.min(FATIGUE_MAX_LEVEL, (f.level || 0) + 1);
  else f.level = Math.max(0, (f.level || 0) - 1);
  f.lastDay = day;
  save && save();
  return f.level;
}
/* =============================================================
   体力上限的疲劳扣减（v9.29 加强）
   -------------------------------------------------------------
   原来是每级 4%、最多 3 级 = 满级只掉 12 点上限。
   实测这个量级**完全没有存在感**：
     主力一场打完剩约 60%，满级疲劳也就剩约 48%，
     而自动换人的阈值是 40%（AI_SUB_TIRED）→ 永远不会触发轮换，
     玩家没有任何理由为"背靠背"调整阵容。

   改成每级 8%（满级 −24）：满级时上限 76，打完剩约 36% → 跌破 40%，
   自动换人真的会启动。这样"连打"才变成一个需要管理的资源。

   ⚠️ 别再往下调回来了 —— 调回 4% 就等于这个系统不存在。
      要改先看：满级疲劳下"一场打完剩余体力"是否还高于 40%。
   ============================================================= */
const FATIGUE_PER_LEVEL = 0.08;     // 每级疲劳扣 8% 体力上限
const FATIGUE_MAX_LEVEL = 3;        // 连续比赛最多叠到 3 级（−24%）
function fatiguePenalty() {
  return (fatigueOf().level || 0) * FATIGUE_PER_LEVEL;
}

/* ---------- ⑤ 时刻卡专属技能（v1.4） ----------
   时刻卡本来只是数值更强，没有"传奇感"。
   给每张时刻卡一个独特被动，比赛里真的会触发。 */
const MOMENT_SKILL = {
  'momentPurple': [
    { key: 'mvp_aura', name: 'MVP 光环', desc: '在场时全队命中率 +3%',
      icon: '👑' },
    { key: 'clutch_king', name: '关键之王', desc: '最后两分钟个人命中 +12%',
      icon: '⏱️' },
    { key: 'unstoppable', name: '无解单打', desc: '背身与中距离额外 +8%',
      icon: '🔥' },
    { key: 'iron_wall', name: '铜墙铁壁', desc: '对手在他的防守下命中 −7%',
      icon: '🛡️' },
  ],
  'momentGold': [
    { key: 'hot_streak', name: '手感滚烫', desc: '连中两球后个人命中 +7%',
      icon: '♨️' },
    { key: 'big_heart', name: '大心脏', desc: '关键罚球与三分 +6%',
      icon: '💗' },
    { key: 'engine', name: '永动引擎', desc: '体力消耗 −20%', icon: '⚙️' },
  ],
};
/** 给一名上场球员分配时刻技能（按 id 稳定分配） */
function momentSkillOf(card) {
  if (!card || !card.isMoment) return null;
  const pool = MOMENT_SKILL[card.tier];
  if (!pool || !pool.length) return null;
  let h = 0;
  const id = String(card.id || '');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return pool[h % pool.length];
}
/** 某队有没有 MVP 光环（全队命中加成） */
function teamAuraBonus(team) {
  let b = 0;
  (team && team.players ? team.players : []).forEach((p) => {
    if (p.momentSkill && p.momentSkill.key === 'mvp_aura') b = Math.max(b, 3);
  });
  return b;
}

/* ---------- ⑥ 全明星周末 + 交易截止日（v1.4） ----------
   赛季中段加两个事件，让 82 场不至于太平淡。 */
const SEASON_EVENTS = [
  { day: 35,  key: 'allstar',  name: '全明星周末',
    desc: '票选全明星首发，看你的球员有没有入选' },
  { day: 52,  key: 'deadline', name: '交易截止日',
    desc: '各队集中交易，市场格外热闹' },
];
function eventState() {
  if (!S.events) S.events = {};
  return S.events;
}
/** 某天有没有事件（返回事件对象或 null） */
function eventOnDay(day) {
  const ev = SEASON_EVENTS.filter((e) => e.day === day)[0];
  if (!ev) return null;
  const st = eventState();
  if (st[ev.key + '_' + day]) return null;      // 已经触发过
  return ev;
}
function markEvent(ev, day) {
  eventState()[ev.key + '_' + day] = true;
  save && save();
}
/* =============================================================
   ⭐ 全明星推荐（v9.29）
   -------------------------------------------------------------
   原来「全明星周末」只是 pushNews 一条新闻 —— 玩家没有任何参与感，
   名单是纯黑箱算出来的。

   现在：全明星前你可以从**自己队里推荐 1 人**。被推荐的人
   如果本来就够格（本来就会入选），照常入选；如果差一点，
   推荐票帮他挤进名单。入选者获得**永久体力上限 +6**（"全明星级自律"）。

   ★ 关键约束：评选走 statsOf()，而 statsOf 是全游戏唯一的属性出口。
     如果让这个加成反过来影响 statsOf，评选就会递归。
     所以这里只用一张**独立的加成表** `S.allStarBonus`，
     并且只在 makeStamina() 里读取 —— 绝不在 statsOf 里读。
   ============================================================= */
const ALLSTAR_BONUS_STA = 6;          // 入选者的永久体力上限加成
const ALLSTAR_VOTE_OPEN_DAY = 28;     // 从第 28 天起可以推荐（全明星在第 35 天）

/** 入选者的永久加成表 { 卡id: true } */
function allStarBonusState() {
  if (!S.allStarBonus || typeof S.allStarBonus !== 'object') S.allStarBonus = {};
  return S.allStarBonus;
}
/** 这张卡有没有全明星加成 */
function allStarBonusOf(id) {
  return !!allStarBonusState()[id];
}
/** 某赛季的全明星日（day）是否已经过了 */
function allStarPassed() {
  const L = leagueState();
  const ev = SEASON_EVENTS.filter((e) => e.key === 'allstar')[0];
  if (!ev) return false;
  return (L.day || 0) > ev.day || !!eventState()['allstar_' + ev.day];
}
/** 现在能不能推荐 */
function allStarVoteOpen() {
  const L = leagueState();
  const ev = SEASON_EVENTS.filter((e) => e.key === 'allstar')[0];
  if (!ev) return false;
  return (L.day || 0) >= ALLSTAR_VOTE_OPEN_DAY && !allStarPassed();
}
/** 记录本季推荐（按赛季存，换季要重新推） */
function allStarVoteSet(id) {
  const L = leagueState();
  const season = L.season || 1;
  if (!S.allStarVote || S.allStarVote.season !== season) {
    S.allStarVote = { season, ids: [] };
  }
  if (!Array.isArray(S.allStarVote.ids)) S.allStarVote.ids = [];
  const i = S.allStarVote.ids.indexOf(id);
  if (i >= 0) S.allStarVote.ids.splice(i, 1);       // 再点一次 = 取消
  else S.allStarVote.ids.push(id);
  save();
  return S.allStarVote.ids;
}
/** 本季推荐了谁 */
function allStarVoted() {
  const L = leagueState();
  const season = L.season || 1;
  if (!S.allStarVote || S.allStarVote.season !== season) return [];
  return (S.allStarVote.ids || []).filter((id) => CARD_BY_ID[id]);
}
/** 可推荐的候选：自己队里（收藏中）综合最高的若干张 */
function allStarCandidates(n) {
  const arr = Object.keys(S.owned).map((id) => CARD_BY_ID[id]).filter(Boolean);
  arr.sort((a, b) => {
    const ba = (S.owned[a.id] || {}).brk || 0, bb = (S.owned[b.id] || {}).brk || 0;
    return statsOf(b, bb).ovr - statsOf(a, ba).ovr;
  });
  return arr.slice(0, n || 8);
}

/** 全明星：按综合分选出联盟前 10（大致按位置） */
function allStarPicks() {
  const L = leagueState();
  const all = [];
  Object.keys(L.teams).forEach((k) => {
    const t = L.teams[k];
    (t.roster || []).forEach((id) => {
      const c = CARD_BY_ID[id];
      if (c) all.push({ card: c, teamKey: k, mine: false });
    });
  });
  Object.keys(S.owned).forEach((id) => {
    const c = CARD_BY_ID[id];
    if (c) all.push({ card: c, teamKey: SEASON.MY_KEY, mine: true });
  });
  // 按"实际能力"排（带突破）
  const power = (x) => {
    const brk = x.mine ? ((S.owned[x.card.id] || {}).brk || 0)
      : brkLevelOf(x.teamKey, x.card.id);
    return statsOf(x.card, brk).ovr;
  };
  /* ★ 推荐票：玩家推荐的自己人排到最前，保证入选（这就是"投票"的意义）。
     只提权、不改数值 —— 能力值仍然是真实的。 */
  const voted = allStarVoted();
  const isVoted = (x) => x.mine && voted.indexOf(x.card.id) >= 0;
  all.sort((a, b) => (isVoted(b) ? 1 : 0) - (isVoted(a) ? 1 : 0) || power(b) - power(a));
  const picked = [], seenPos = {};
  all.forEach((x) => {
    if (picked.length >= 10) return;
    const p = x.card.pos;
    seenPos[p] = (seenPos[p] || 0);
    if (seenPos[p] >= 2) return;              // 每个位置最多 2 人
    seenPos[p]++;
    picked.push({ ...x, ovr: power(x) });
  });
  return picked;
}
function allStarHTML() {
  const p = allStarPicks();
  const mine = p.filter((x) => x.mine).length;
  /* ★ v9.29 推荐面板：全明星前可以推自己队里的 1 人进名单 */
  const open = allStarVoteOpen();
  const voted = allStarVoted();
  const cands = open ? allStarCandidates(8) : [];
  const votePanel = open ? `
    <div class="as-vote">
      <div class="as-vote-h">🗳️ 推荐你队里的球员（推荐的人会挤进名单，入选永久 +${
        ALLSTAR_BONUS_STA} 体力上限）</div>
      <div class="as-vote-list">
        ${cands.map((c) => {
          const on = voted.indexOf(c.id) >= 0;
          const brk = (S.owned[c.id] || {}).brk || 0;
          return `<button class="as-vote-c${on ? ' on' : ''}" data-asvote="${c.id}">
            <img src="${c.photo}" alt="" onerror="this.style.display='none'">
            <b>${c.name}</b>
            <span>${statsOf(c, brk).ovr}</span>
            <em>${on ? '已推荐' : '推荐'}</em>
          </button>`;
        }).join('')}
      </div>
      ${voted.length ? `<div class="as-vote-note">已推荐 ${
        voted.map((id) => CARD_BY_ID[id].name).join('、')}　（再点一次可取消）</div>` : ''}
    </div>` : '';
  return `
    <div class="as-wrap">
      <div class="as-head">⭐ 全明星周末</div>
      <div class="as-sub">${mine
        ? `你的球队有 <em>${mine}</em> 人入选全明星！`
        : '这一届没有你的球员入选，继续努力'}</div>
      ${votePanel}
      <div class="as-list">
        ${p.map((x, i) => `
          <div class="as-row${x.mine ? ' mine' : ''}">
            <b class="as-rank">${i + 1}</b>
            <div class="as-img"><img src="${x.card.photo}" alt=""
              onerror="this.parentNode.style.visibility='hidden'"></div>
            <div class="as-info">
              <div class="as-nm">${x.card.name}</div>
              <div class="as-tm">${x.mine ? '我的球队'
                : (TEAM_BY_KEY[x.teamKey] ? TEAM_BY_KEY[x.teamKey].name : '?')}
                · ${x.card.pos}</div>
            </div>
            <b class="as-ovr">${x.ovr}</b>
          </div>`).join('')}
      </div>
    </div>`;
}
function bindAllStar() {
  const box = document.querySelector('.as-vote-list');
  if (!box) return;
  box.querySelectorAll('[data-asvote]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.asvote;
      Sfx.click();
      allStarVoteSet(id);
      // 就地刷新这一块（整页重绘会丢掉滚动位置）
      const wrap = document.querySelector('.as-wrap');
      if (wrap) {
        wrap.outerHTML = allStarHTML();
        bindAllStar();
      }
    };
  });
}

/* ---------- 调试：?v14test=1 v1.4 全部功能自检 ---------- */
(function v14Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('v14test')) return;
    setTimeout(() => {
      const out = [];
      // ① 教练风格
      const styles = Object.keys(COACH_STYLE).length;
      // 球队 key 是小写（和 NBA_TEAMS 一致）
      const gs = coachStyle('gsw'), mem = coachStyle('mem');
      out.push('教练风格 ' + styles + ' 支：勇士=' + gs.name + '(' + gs.off +
        '/' + gs.def + ') 灰熊=' + mem.name + '(' + mem.off + '/' + mem.def + ')');
      const t1 = teamTactics('gsw', []);
      out.push('建队用风格=' + (t1.off === gs.off ? '✓' : '✗'));
      // ② 战术熟练度
      S.tacUse = { off: {}, def: {} };
      out.push('初始熟练度 生疏=' +
        (tacMasteryLabel('perimeter', 'off').txt === '生疏' ? '✓' : '✗'));
      for (let i = 0; i < 12; i++) tacBump('perimeter', 'man');
      out.push('用 12 次后=' + tacMasteryLabel('perimeter', 'off').txt +
        ' 加成+' + (tacMasteryOff('perimeter') * 100).toFixed(1) + '%' +
        (tacMasteryOff('perimeter') > 0.05 ? ' ✓' : ' ✗'));
      // ③ 背靠背疲劳
      S.fatigue = { lastDay: 0, level: 0 };
      fatigueAfterGame(10); fatigueAfterGame(11); fatigueAfterGame(12);
      out.push('连打 3 天 疲劳等级=' + fatigueOf().level +
        ' 体力上限 −' + (fatiguePenalty() * 100).toFixed(0) + '%' +
        (fatiguePenalty() > 0 ? ' ✓' : ' ✗'));
      fatigueAfterGame(20);
      out.push('休息后 疲劳等级=' + fatigueOf().level +
        (fatigueOf().level < 3 ? ' ✓会恢复' : ' ✗'));
      // ④ 时刻卡技能
      const mc = CARDS.filter((c) => c.isMoment);
      const skills = {};
      mc.forEach((c) => {
        const s2 = momentSkillOf(c);
        if (s2) skills[s2.name] = (skills[s2.name] || 0) + 1;
      });
      out.push('时刻卡 ' + mc.length + ' 张，技能 ' +
        Object.keys(skills).length + ' 种：' +
        Object.keys(skills).map((k) => k + '×' + skills[k]).join(' '));
      // ⑤ 赛季事件
      out.push('赛季事件 ' + SEASON_EVENTS.length + ' 个：' +
        SEASON_EVENTS.map((e) => e.name + '(第' + e.day + '天)').join(' '));
      // ⑥ 练习赛
      switchTab('battle');
      setTimeout(() => {
        startBattle('live');
        out.push('训练赛按钮已移除=' +
          (document.getElementById('btPractice') ? '✗还在' : '✓'));
        // 打一场看是否不计战绩
        const w0 = S.btWin || 0, g0 = qsStats().games;
        let guard = 0;
        while (!BT.gs.done && guard++ < 3000) advanceGame(BT.gs, 400);
        endBattle(true);
        out.push('正式比赛 战绩变化=' + ((S.btWin || 0) - w0) +
          '(应为1) 任务场次+' + (qsStats().games - g0) + '(应为1)' +
          ((S.btWin || 0) - w0 === 1 && qsStats().games - g0 === 1 ? ' ✓每场都算' : ' ✗'));
        // ⑦ 全明星
        const picks = allStarPicks();
        out.push('全明星选出 ' + picks.length + ' 人，我的 ' +
          picks.filter((x) => x.mine).length + ' 人' +
          (picks.length >= 5 ? ' ✓' : ' ✗'));
        document.title = 'V14 ' + out.join(' | ');
      }, 600);
    }, 900);
  } catch (e) { document.title = 'V14-ERR ' + e.message; }
})();
