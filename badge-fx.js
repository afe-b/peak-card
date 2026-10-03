'use strict';
/* =============================================================
   🏅 徽章效果登记表（v9.30 新增）
   -------------------------------------------------------------
   ★ 为什么要有这个文件：
     审计发现 104 枚徽章里只有 21 枚真正进战斗判定，其余 83 枚
     只是卡面装饰 —— 玩家花 64 张卡练满一张紫卡、解锁一堆金徽章，
     其中大部分在比赛里毫无作用。

     根因是徽章效果**散落在各处硬编码**（SIGNATURE_BONUS 一处、
     badgeLv 十一处），加一枚新徽章要记得去五六个地方接线，
     漏一处就变成死代码，而且没有任何检查会发现。

     现在改成**一张登记表**：
       BADGE_FX[key] = { ch: '作用通道', mult: [铜,银,金], ... }
     每枚徽章必须在这里有条目，否则 check.js 会报错 ——
     「徽章变死代码」这个问题从此不能再悄悄发生。

   ★ 作用通道（ch）说明
     ─────────────────────────────────────────────────────────
     出手类：  on_three / on_mid / on_layup / on_dunk / on_post /
               on_floater / on_ft
               命中率乘数（1 + mult × 徽章档位系数）
     防守类：  def_perim / def_int / def_post
               防守值乘数
     回合类：  tpg         失误率乘数（降低被断概率）
               reb_off / reb_def   篮板争夺权重乘数
               ast         助攻转化率乘数
     条件类：  ctx_<情境>  在特定情境下对手上动作额外加成
               （情境由 playPossession 打标，见 CTX_* 常量）
     全队类：  team_off    全队进攻乘数（不叠加，取最高）
     体力类：  sta_max / sta_drain / sta_drain_def / sta_recover / sta_soft
               （这五个在 makeStamina 里处理，不走登记表的乘数逻辑）
     精神类：  mental      在 battle.js 里单独处理（领袖/专注/恶汉/大心脏/关键先生）

   ★ 叠加规则（防止堆叠失控）
     ① 同名徽章不叠加，只取最高档
     ② 同一动作上，条件类徽章最多叠 COND_MAX 枚，超出部分效果减半
     ③ 单项总加成硬上限 OFF_CAP / DEF_CAP
   ============================================================= */

/** 档位系数：铜 / 银 / 金 */
const BADGE_LV_COEF = [0.33, 0.66, 1.0];

/* 情境标记：由 playPossession 在判定前打到 att.ctx 上 */
const CTX = {
  TIGHT: 'tight',        // 贴身干扰（防守人外线防守高）
  DEEP: 'deep',          // 超远三分
  CORNER: 'corner',      // 底角三分
  ASSISTED: 'assisted',  // 有助攻的出手
  FASTBREAK: 'fastbreak',// 快攻
  POST: 'post',          // 背身要位
  RIM: 'rim',            // 篮下强起
  CLUTCH: 'clutch',      // 关键时段
  GARBAGE: 'garbage',    // 垃圾时间
  SECOND: 'second',      // 二次进攻
};

/** 叠加规则参数 */
const BADGE_FX_RULE = {
  COND_MAX: 3,           // 同一动作最多生效的条件类徽章数
  COND_DAMP: 0.5,        // 超出部分的衰减
  OFF_CAP: 0.18,         // 进攻端总加成硬上限
  DEF_CAP: 0.15,         // 防守端总加成硬上限
};

/* =============================================================
   登记表本体
   -------------------------------------------------------------
   mult 是 [铜, 银, 金] 三档的**基础倍率**（不含档位系数）。
   实际加成 = mult[tier] × 徽章档位系数 —— 但为了可读性，
   这里直接写"金徽章时的最终加成"，中间档按比例取。
   ============================================================= */
const BADGE_FX = {
  /* ---------- 投射（7 枚）---------- */
  three:        { ch: 'on_three',   mult: [0.03, 0.06, 0.10], name: '神射手' },
  mid:          { ch: 'on_mid',     mult: [0.03, 0.06, 0.10], name: '中投大师' },
  floater:      { ch: 'on_floater', mult: [0.03, 0.06, 0.10], name: '抛投高手' },
  ft:           { ch: 'on_ft',      mult: [0.02, 0.04, 0.07], name: '罚球机器' },
  deadeye:      { ch: 'on_three',   mult: [0.04, 0.08, 0.13], ctx: CTX.TIGHT, name: '死角猎手' },
  limitless:    { ch: 'on_three',   mult: [0.03, 0.07, 0.11], ctx: CTX.DEEP, name: '无限射程' },
  cornerSpec:   { ch: 'on_three',   mult: [0.03, 0.07, 0.12], ctx: CTX.CORNER, name: '底角专家' },
  catchShoot:   { ch: 'on_three',   mult: [0.03, 0.06, 0.10], ctx: CTX.ASSISTED, name: '接球就投' },
  pickPopper:   { ch: 'on_mid',     mult: [0.03, 0.06, 0.10], ctx: CTX.ASSISTED, name: '挡拆投手' },
  greenMachine: { ch: 'on_three',   mult: [0.02, 0.05, 0.09], ctx: CTX.ASSISTED, name: '绿色机器' },
  middyMagician:{ ch: 'on_mid',     mult: [0.04, 0.08, 0.12], name: '中距离魔术师' },
  fadeAce:      { ch: 'on_post',    mult: [0.03, 0.07, 0.11], ctx: CTX.POST, name: '后仰大师' },
  floatGame:    { ch: 'on_floater', mult: [0.04, 0.08, 0.12], name: '抛投专家' },
  ftAce:        { ch: 'on_ft',      mult: [0.03, 0.06, 0.10], ctx: CTX.CLUTCH, name: '罚球稳手' },
  spaceCreator: { ch: 'team_off',   mult: [0.01, 0.02, 0.035], name: '空间创造者' },

  /* ---------- 终结（12 枚）---------- */
  layup:        { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], name: '篮下终结者' },
  close:        { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], name: '近框杀手' },
  standDunk:    { ch: 'on_dunk',    mult: [0.03, 0.06, 0.10], name: '原地重炮' },
  driveDunk:    { ch: 'on_dunk',    mult: [0.03, 0.06, 0.10], name: '空接暴扣' },
  postControl:  { ch: 'on_post',    mult: [0.03, 0.06, 0.11], name: '低位杀器' },
  postFade:     { ch: 'on_post',    mult: [0.03, 0.06, 0.10], ctx: CTX.POST, name: '背身后仰大师' },
  postHook:     { ch: 'on_post',    mult: [0.03, 0.06, 0.10], name: '勾手大师' },
  posterizer:   { ch: 'on_dunk',    mult: [0.04, 0.08, 0.14], ctx: CTX.TIGHT, name: '海报扣将' },
  slithery:     { ch: 'on_layup',   mult: [0.04, 0.08, 0.12], ctx: CTX.TIGHT, name: '躲闪终结者' },
  aerialWizard: { ch: 'on_dunk',    mult: [0.03, 0.07, 0.12], ctx: CTX.ASSISTED, name: '空接终结者' },
  dreamShake:   { ch: 'on_post',    mult: [0.04, 0.08, 0.12], ctx: CTX.POST, name: '梦幻脚步' },
  hookSpecialist:{ ch: 'on_post',   mult: [0.03, 0.06, 0.10], name: '勾手专家' },
  putbackBoss:  { ch: 'on_dunk',    mult: [0.04, 0.08, 0.13], ctx: CTX.SECOND, name: '补扣专家' },
  acrobat:      { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], name: '杂技终结' },
  layupMix:     { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], ctx: CTX.TIGHT, name: '上篮混合师' },
  giantSlayer:  { ch: 'on_layup',   mult: [0.03, 0.07, 0.11], name: '巨人杀手' },
  bulldozer:    { ch: 'on_dunk',    mult: [0.03, 0.07, 0.11], ctx: CTX.RIM, name: '推土机' },
  fearless:     { ch: 'on_layup',   mult: [0.02, 0.05, 0.09], ctx: CTX.TIGHT, name: '无畏终结者' },
  postSpin:     { ch: 'on_post',    mult: [0.03, 0.06, 0.10], name: '背身转身上篮' },
  riseUp:       { ch: 'on_dunk',    mult: [0.02, 0.05, 0.09], name: '强力起身' },
  fastTwitch:   { ch: 'on_layup',   mult: [0.02, 0.05, 0.09], name: '快速起跳' },

  /* ---------- 防守（11 枚）---------- */
  perimD:       { ch: 'def_perim',  mult: [0.03, 0.06, 0.10], name: '外线铁闸' },
  intD:         { ch: 'def_int',    mult: [0.03, 0.06, 0.10], name: '护框大闸' },
  postD:        { ch: 'def_post',   mult: [0.03, 0.06, 0.10], name: '背身防守专家' },
  block:        { ch: 'def_rim',    mult: [0.04, 0.08, 0.13], name: '盖帽狂魔' },
  lateral:      { ch: 'def_perim',  mult: [0.03, 0.06, 0.10], name: '横移大师' },
  clamps:       { ch: 'def_perim',  mult: [0.04, 0.08, 0.12], name: '贴身防守' },
  anchorD:      { ch: 'def_int',    mult: [0.04, 0.08, 0.12], name: '内线支柱' },
  brickWall:    { ch: 'def_post',   mult: [0.04, 0.08, 0.12], name: '铜墙铁壁' },
  immovable:    { ch: 'def_post',   mult: [0.03, 0.07, 0.11], name: '不可撼动' },
  postLockdown: { ch: 'def_post',   mult: [0.03, 0.06, 0.10], name: '背身防守' },
  pickDodger:   { ch: 'def_perim',  mult: [0.03, 0.06, 0.10], name: '绕掩护专家' },
  challenger:   { ch: 'def_perim',  mult: [0.03, 0.06, 0.10], ctx: CTX.TIGHT, name: '挑战者' },
  menace:       { ch: 'def_perim',  mult: [0.03, 0.06, 0.10], name: '防守威胁' },
  swissArmy:    { ch: 'def_all',    mult: [0.02, 0.04, 0.07], name: '全能防守' },
  defAnchor:    { ch: 'team_def',   mult: [0.01, 0.025, 0.04], name: '防守核心' },
  pogoStick:    { ch: 'def_rim',    mult: [0.03, 0.06, 0.10], name: '盖帽弹簧' },
  offBallPest:  { ch: 'def_perim',  mult: [0.02, 0.05, 0.09], name: '无球纠缠' },

  /* ---------- 抢断 / 失误（8 枚）---------- */
  steal:        { ch: 'steal',      mult: [0.04, 0.08, 0.13], name: '抢断专家' },
  intercept:    { ch: 'steal',      mult: [0.04, 0.08, 0.13], name: '传球拦截者' },
  interceptor:  { ch: 'steal',      mult: [0.04, 0.08, 0.13], name: '传球拦截' },
  glove:        { ch: 'steal',      mult: [0.04, 0.08, 0.13], name: '抢断专家' },
  pickpocket:   { ch: 'steal',      mult: [0.04, 0.08, 0.13], name: '抄球专家' },
  handle:       { ch: 'tpg',        mult: [0.05, 0.10, 0.16], name: '过人如麻' },
  unpluckable:  { ch: 'tpg',        mult: [0.06, 0.12, 0.20], name: '不可抢断' },
  viceGrip:     { ch: 'tpg',        mult: [0.04, 0.08, 0.13], name: '铁腕' },
  handles:      { ch: 'tpg',        mult: [0.04, 0.09, 0.15], name: '控球大师' },
  ankleBreaker: { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], name: '脚踝终结者' },

  /* ---------- 组织（10 枚）---------- */
  pass:         { ch: 'ast',        mult: [0.03, 0.06, 0.10], name: '传球大师' },
  dimer:        { ch: 'ast',        mult: [0.05, 0.10, 0.16], name: '传球大师' },
  floorGeneral: { ch: 'team_off',   mult: [0.01, 0.02, 0.035], name: '场上教练' },
  touchPasser:  { ch: 'ast',        mult: [0.04, 0.08, 0.13], name: '连线专家' },
  relayPasser:  { ch: 'ast',        mult: [0.03, 0.06, 0.10], name: '二次助攻' },
  breakStarter: { ch: 'ast',        mult: [0.03, 0.06, 0.10], ctx: CTX.FASTBREAK, name: '长传发动' },
  postPlaymaker:{ ch: 'ast',        mult: [0.03, 0.06, 0.10], ctx: CTX.POST, name: '背身组织' },
  bailOut:      { ch: 'tpg',        mult: [0.03, 0.06, 0.10], name: '保命传球' },
  engineBadge:  { ch: 'ast',        mult: [0.02, 0.04, 0.07], name: '进攻核心' },
  hyperdrive:   { ch: 'on_layup',   mult: [0.03, 0.06, 0.10], ctx: CTX.FASTBREAK, name: '快攻发动机' },
  speedBooster: { ch: 'on_layup',   mult: [0.02, 0.05, 0.09], ctx: CTX.FASTBREAK, name: '加速器' },

  /* ---------- 篮板（9 枚）---------- */
  oreb:         { ch: 'reb_off',    mult: [0.04, 0.08, 0.13], name: '前场篮板王' },
  dreb:         { ch: 'reb_def',    mult: [0.04, 0.08, 0.13], name: '篮板怪兽' },
  boxout:       { ch: 'reb_off',    mult: [0.03, 0.07, 0.11], name: '卡位大师' },
  reboundChaser:{ ch: 'reb_def',    mult: [0.04, 0.08, 0.13], name: '篮板猎手' },
  boxoutBeast:  { ch: 'reb_off',    mult: [0.04, 0.08, 0.12], name: '卡位大师' },
  offRebounder: { ch: 'reb_off',    mult: [0.04, 0.08, 0.13], name: '前场篮板王' },
  rebInstinct:  { ch: 'reb_def',    mult: [0.03, 0.07, 0.11], name: '篮板嗅觉' },
  worm:         { ch: 'reb_def',    mult: [0.04, 0.08, 0.13], name: '篮板铁人' },
  aerialKing:   { ch: 'reb_off',    mult: [0.02, 0.05, 0.09], name: '空中霸主' },

  /* ---------- 其他属性（6 枚）---------- */
  drawFoul:     { ch: 'foul_draw',  mult: [0.05, 0.10, 0.17], name: '造犯规大师' },
  hustle:       { ch: 'reb_off',    mult: [0.02, 0.05, 0.09], name: '拼命三郎' },
  workHorse:    { ch: 'reb_off',    mult: [0.02, 0.05, 0.09], name: '拼命三郎' },
  strength:     { ch: 'str',        mult: [0.03, 0.06, 0.10], name: '力量碾压' },
  vertical:     { ch: 'vert',       mult: [0.03, 0.06, 0.10], name: '弹跳怪' },
  catch:        { ch: 'on_layup',   mult: [0.02, 0.05, 0.09], ctx: CTX.ASSISTED, name: '接球就投' },
  offBallSpeed: { ch: 'on_three',   mult: [0.02, 0.05, 0.09], ctx: CTX.ASSISTED, name: '无球跑位' },
  onBallSpeed:  { ch: 'on_layup',   mult: [0.02, 0.05, 0.09], name: '持球推进' },
  offBallSpec:  { ch: 'on_three',   mult: [0.02, 0.05, 0.09], ctx: CTX.ASSISTED, name: '无球跑位' },

  /* ---------- 体力类（5 枚）：由 makeStamina 处理 ---------- */
  charged:      { ch: 'sta_max',    mult: [0.06, 0.12, 0.18], name: '电量充满' },
  relentless:   { ch: 'sta_drain_def', mult: [0.12, 0.24, 0.35], name: '不知疲倦' },
  ironman:      { ch: 'sta_drain',  mult: [0.07, 0.15, 0.22], name: '铁人' },
  motor:        { ch: 'sta_recover',mult: [0.25, 0.50, 0.80], name: '永动机' },
  tough:        { ch: 'sta_soft',   mult: [0.20, 0.38, 0.55], name: '硬汉' },

  /* ---------- 精神类（5 枚）：由 battle.js 单独处理 ---------- */
  leader:       { ch: 'mental',     mult: [0.015, 0.03, 0.045], name: '领袖' },
  focus:        { ch: 'mental',     mult: [0.33, 0.66, 1.0],   name: '专注' },
  enforcer:     { ch: 'mental',     mult: [0.018, 0.035, 0.05], name: '恶汉' },
  ice:          { ch: 'mental',     mult: [0.025, 0.05, 0.075], name: '大心脏' },
  clutchGene:   { ch: 'mental',     mult: [0.032, 0.065, 0.10], name: '关键先生' },
  /* ★ 这张表里 clutchGene 被定义了两次（mental 一次、combo 一次），
     后者会覆盖前者。combo 版改名为 clutchGenePro 以免撞键。 */
  clutchGenePro:{ ch: 'on_mid',     mult: [0.03, 0.07, 0.11], ctx: CTX.CLUTCH, name: '关键基因' },
  iceVeins:     { ch: 'on_three',   mult: [0.03, 0.07, 0.11], ctx: CTX.CLUTCH, name: '冷血杀手' },
};

/* =============================================================
   取某枚徽章在某个通道上的加成
   -------------------------------------------------------------
   tier: 'bronze' | 'silver' | 'gold'
   返回小数（0.10 = +10%）；没有登记或档位不对返回 0
   ============================================================= */
const BADGE_TIER_COEF = { bronze: 0, silver: 1, gold: 2 };
function badgeFxOf(tier, key) {
  const fx = BADGE_FX[key];
  if (!fx) return 0;
  const i = BADGE_TIER_COEF[tier];
  if (i == null) return 0;
  return fx.mult[i] || 0;
}

/**
 * 汇总某个球员在某个通道上的加成。
 * @param {Object} badges  mkPlayer 里算好的 { key: tier }
 * @param {string} ch      作用通道
 * @param {Object} [ctxSet] 当前情境集合（可选，用于条件类徽章）
 */
function badgeChOf(badges, ch, ctxSet) {
  if (!badges) return 0;
  let sum = 0, condN = 0;
  for (const key in badges) {
    const fx = BADGE_FX[key];
    if (!fx || fx.ch !== ch) continue;
    /* 条件类：情境不满足就不生效 */
    if (fx.ctx) {
      if (!ctxSet || !ctxSet[fx.ctx]) continue;
      condN++;
      /* 条件类最多叠 COND_MAX 枚，超出部分效果减半（防堆叠） */
      const damp = condN <= BADGE_FX_RULE.COND_MAX ? 1 : BADGE_FX_RULE.COND_DAMP;
      sum += badgeFxOf(badges[key], key) * damp;
    } else {
      sum += badgeFxOf(badges[key], key);
    }
  }
  return sum;
}

/** 把加成夹到硬上限里 */
function capBadgeBonus(v, cap) {
  return Math.max(-cap, Math.min(cap, v));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BADGE_FX, BADGE_TIER_COEF, badgeFxOf, badgeChOf, CTX, BADGE_FX_RULE };
}
