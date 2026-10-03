'use strict';
/* =============================================================
   数据层：NBA 球星卡（真实球员 + 历史名宿 + 荣耀时刻卡）
   -------------------------------------------------------------
   · 共 500 张卡：银卡170 / 金卡145 / 紫卡125 / 时刻金卡30 / 时刻紫卡30
   · 能力值体系参考 NBA 2K：5 大类 21 项
   · 球员照片来自 Wikimedia Commons（自由授权），署名见 CREDITS.md
   · 本文件由 tools/gen-data.js 自动生成，请勿手改
   ============================================================= */

/* ---------- 卡牌档位 ---------- */
const TIERS = {
  "silver": {
    "key": "silver",
    "name": "银卡",
    "short": "SIL",
    "stars": 1,
    "ovr": [
      72,
      82
    ],
    "c1": "#e8edf7",
    "c2": "#8b95ab",
    "c3": "#4a5268",
    "glow": "#c9d3e6",
    "theme": "silver",
    "ovrGen": [
      72,
      82
    ]
  },
  "gold": {
    "key": "gold",
    "name": "金卡",
    "short": "GLD",
    "stars": 2,
    "ovr": [
      83,
      89
    ],
    "c1": "#ffe08a",
    "c2": "#e0a020",
    "c3": "#7a4a00",
    "glow": "#ffc23d",
    "theme": "gold",
    "ovrGen": [
      83,
      89
    ]
  },
  "purple": {
    "key": "purple",
    "name": "紫卡",
    "short": "PPL",
    "stars": 3,
    "ovr": [
      90,
      95
    ],
    "c1": "#d9a8ff",
    "c2": "#8b3ce0",
    "c3": "#3d1070",
    "glow": "#b45cff",
    "theme": "purple",
    "ovrGen": [
      90,
      95
    ]
  },
  "legendPurple": {
    "key": "legendPurple",
    "name": "名宿紫卡",
    "short": "LGD",
    "stars": 4,
    "ovr": [
      96,
      101
    ],
    "c1": "#b06bff",
    "c2": "#5b1fa8",
    "c3": "#2e0d55",
    "glow": "#c9a0ff",
    "theme": "legend",
    "ovrGen": [
      96,
      101
    ]
  },
  "momentGold": {
    "key": "momentGold",
    "name": "时刻金卡",
    "short": "MGL",
    "stars": 4,
    "ovr": [
      102,
      107
    ],
    "c1": "#fff0b0",
    "c2": "#f0a818",
    "c3": "#6b3400",
    "glow": "#ffb020",
    "theme": "momentGold",
    "ovrGen": [
      102,
      107
    ]
  },
  "momentPurple": {
    "key": "momentPurple",
    "name": "时刻紫卡",
    "short": "MPL",
    "stars": 5,
    "ovr": [
      108,
      113
    ],
    "c1": "#ffd6ff",
    "c2": "#c04cff",
    "c3": "#2a0a55",
    "glow": "#e05cff",
    "theme": "momentPurple",
    "ovrGen": [
      108,
      113
    ]
  }
};
const TIER_ORDER = ["silver","gold","purple","legendPurple","momentGold","momentPurple"];

/* ---------- 能力值体系 ---------- */
const ATTR_GROUPS = [
  {
    "key": "shot",
    "name": "投射",
    "en": "Shooting",
    "attrs": [
      {
        "key": "mid",
        "name": "中投",
        "en": "MID"
      },
      {
        "key": "three",
        "name": "三分",
        "en": "3PT"
      },
      {
        "key": "floater",
        "name": "抛投",
        "en": "FLOATER"
      },
      {
        "key": "ft",
        "name": "罚球",
        "en": "FT"
      }
    ]
  },
  {
    "key": "finish",
    "name": "终结",
    "en": "Finishing",
    "attrs": [
      {
        "key": "close",
        "name": "近投",
        "en": "CLOSE"
      },
      {
        "key": "layup",
        "name": "上篮",
        "en": "LAYUP"
      },
      {
        "key": "standDunk",
        "name": "原地灌篮",
        "en": "STAND DUNK"
      },
      {
        "key": "driveDunk",
        "name": "突破灌篮",
        "en": "DRIVE DUNK"
      },
      {
        "key": "drawFoul",
        "name": "造犯规",
        "en": "DRAW FOUL"
      }
    ]
  },
  {
    "key": "pdef",
    "name": "外防",
    "en": "Perimeter D",
    "attrs": [
      {
        "key": "intercept",
        "name": "拦截",
        "en": "INTERCEPT"
      },
      {
        "key": "steal",
        "name": "抢断",
        "en": "STEAL"
      },
      {
        "key": "perimD",
        "name": "外线防守",
        "en": "PERIM D"
      },
      {
        "key": "hustle",
        "name": "争抢",
        "en": "HUSTLE"
      },
      {
        "key": "lateral",
        "name": "横移速度",
        "en": "LATERAL"
      }
    ]
  },
  {
    "key": "idef",
    "name": "内防",
    "en": "Interior D",
    "attrs": [
      {
        "key": "block",
        "name": "盖帽",
        "en": "BLOCK"
      },
      {
        "key": "intD",
        "name": "内线防守",
        "en": "INT D"
      },
      {
        "key": "postD",
        "name": "背身防守",
        "en": "POST D"
      }
    ]
  },
  {
    "key": "post",
    "name": "背身",
    "en": "Post",
    "attrs": [
      {
        "key": "postFade",
        "name": "背身后仰",
        "en": "POST FADE"
      },
      {
        "key": "postControl",
        "name": "背身控制",
        "en": "POST CONTROL"
      },
      {
        "key": "postHook",
        "name": "背身勾射",
        "en": "POST HOOK"
      },
      {
        "key": "strength",
        "name": "力量",
        "en": "STRENGTH"
      }
    ]
  },
  {
    "key": "play",
    "name": "组织",
    "en": "Playmaking",
    "attrs": [
      {
        "key": "handle",
        "name": "控球",
        "en": "HANDLE"
      },
      {
        "key": "catch",
        "name": "接球",
        "en": "CATCH"
      },
      {
        "key": "pass",
        "name": "传球",
        "en": "PASS"
      }
    ]
  },
  {
    "key": "ath",
    "name": "运动",
    "en": "Athleticism",
    "attrs": [
      {
        "key": "offBallSpeed",
        "name": "无球速度",
        "en": "OFF-BALL SPD"
      },
      {
        "key": "onBallSpeed",
        "name": "持球速度",
        "en": "ON-BALL SPD"
      },
      {
        "key": "vertical",
        "name": "弹跳",
        "en": "VERTICAL"
      }
    ]
  },
  {
    "key": "reb",
    "name": "篮板",
    "en": "Rebounding",
    "attrs": [
      {
        "key": "oreb",
        "name": "进攻篮板",
        "en": "OREB"
      },
      {
        "key": "dreb",
        "name": "防守篮板",
        "en": "DREB"
      },
      {
        "key": "boxout",
        "name": "卡位",
        "en": "BOXOUT"
      }
    ]
  }
];
const DERIVE = {
  floater:  (a) => a.mid - 6,
  close:    (a) => a.layup - 3,
  standDunk:(a) => a.dunk - 3,
  driveDunk:(a) => a.dunk + 3,
  drawFoul: (a) => a.foul,
  intercept:(a) => a.pd + 7,
  perimD:   (a) => a.pd,
  hustle:   (a) => Math.round((a.pd + a.reb) / 2) + 4,
  lateral:  (a) => a.acc,
  block:    (a) => a.block,
  intD:     (a) => a.id,
  postD:    (a) => a.id - 5,
  postFade: (a) => a.post - 3,
  postControl: (a) => a.post,
  postHook: (a) => a.post - 7,
  strength: (a) => a.str,
  handle:   (a) => a.handle,
  catch:    (a) => a.catch,
  pass:     (a) => a.pass,
  offBallSpeed: (a) => a.spd,
  onBallSpeed:  (a) => a.handle > 85 ? a.spd : a.spd - 3,
  vertical: (a) => a.vert,
  oreb:     (a) => a.reb - 5,
  dreb:     (a) => a.reb + 3,
  boxout:   (a) => a.reb + 4,
  mid:      (a) => a.mid,
  three:    (a) => a.three,
  ft:       (a) => a.ft,
  layup:    (a) => a.layup,
  steal:    (a) => a.steal,
};

const ATTRS = ATTR_GROUPS.reduce((a, g) => a.concat(g.attrs), []);
const ATTR_NAME = {}, ATTR_GROUP_OF = {};
/** 21 项基础属性 → 30 项展示属性 */
function expandAttrs(base) {
  const o = {};
  ATTRS.forEach((a) => {
    const f = DERIVE[a.key];
    const raw = f ? f(base) : (base[a.key] != null ? base[a.key] : 70);
    o[a.key] = Math.max(25, Math.min(99, Math.round(raw)));
  });
  return o;
}
ATTRS.forEach((a) => { ATTR_NAME[a.key] = a.name; });
ATTR_GROUPS.forEach((g) => g.attrs.forEach((a) => { ATTR_GROUP_OF[a.key] = g; }));

const OVR_WEIGHTS = {"G":{"three":13,"mid":9,"ft":4,"catch":6,"layup":9,"dunk":3,"post":2,"foul":5,"pass":9,"handle":9,"vision":7,"pd":7,"id":1,"steal":5,"block":1,"reb":2,"spd":6,"acc":5,"str":1,"vert":2,"sta":3},"F":{"three":9,"mid":7,"ft":3,"catch":5,"layup":8,"dunk":8,"post":6,"foul":5,"pass":5,"handle":5,"vision":4,"pd":7,"id":6,"steal":4,"block":4,"reb":7,"spd":4,"acc":3,"str":4,"vert":4,"sta":3},"C":{"three":4,"mid":4,"ft":3,"catch":5,"layup":9,"dunk":9,"post":11,"foul":6,"pass":4,"handle":2,"vision":3,"pd":3,"id":12,"steal":2,"block":9,"reb":12,"spd":2,"acc":1,"str":6,"vert":4,"sta":2}};
const posGroup = (pos) => (pos === 'PG' || pos === 'SG' ? 'G' : pos === 'C' ? 'C' : 'F');

/** 综合评分：位置加权 + 弱项下限（低于综合 26 分的项按 26 分计入） */
function computeOvr(attrs, pos) {
  const w = OVR_WEIGHTS[posGroup(pos)];
  let tot = 0;
  for (const k in w) tot += w[k];
  let ovr = 75;
  for (let i = 0; i < 24; i++) {
    const floor = ovr - 26;
    let sum = 0;
    for (const k in w) {
      const v = attrs[k] != null ? attrs[k] : 70;
      sum += Math.max(v, floor) * w[k];
    }
    const next = Math.round(sum / tot);
    if (next === ovr) break;
    ovr = next;
  }
  return ovr;
}
/** 五大类均分（雷达图用） */
function groupScores(attrs) {
  const out = {};
  ATTR_GROUPS.forEach((g) => {
    const vals = g.attrs.map((a) => (attrs[a.key] != null ? attrs[a.key] : 70));
    out[g.key] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  });
  return out;
}
/** 数值 → 字母评级（雷达图用，参考巅峰对决的 S / A+ / A …） */
function gradeOf(v) {
  if (v >= 95) return 'S';
  if (v >= 90) return 'A+';
  if (v >= 85) return 'A';
  if (v >= 80) return 'A-';
  if (v >= 75) return 'B+';
  if (v >= 70) return 'B';
  if (v >= 65) return 'B-';
  if (v >= 60) return 'C+';
  if (v >= 55) return 'C';
  return 'D';
}
/** 身价：由综合分推算，用于详情页的"身价"栏 */
// 身价：对齐现实 NBA 的量级
//   银卡(76-86)   约 100~300 万（底薪/轮换）
//   金卡(89-100)  约 500~900 万（主力）
//   紫卡(101-108) 约 1200~1800 万（球星）
//   满突破(129)   约 1.1 亿（超级顶薪级别）
const valueOf = (ovr) => Math.round(8e5 * Math.exp((Math.max(60, ovr) - 72) / 11.5));
/** 旧的基础工资公式（按综合分算）—— v9.1 起已被 salaryOfTier 取代，
    只为兼容老存档/老调用保留，新代码一律用 salaryOfTier。 */
const salaryOf = (ovr) => Math.min(5e7, Math.round(valueOf(ovr) * 0.4 / 1e4) * 1e4);

/* =============================================================
   基础工资与工资帽（v9.1）
   -------------------------------------------------------------
   用户要求：工资不再按综合分算，改成**按档位固定**：
     银卡 800 万 / 金卡（含时刻金卡）3000 万 / 紫卡（含名宿紫、时刻紫）4500 万

   工资帽 4 亿。阵容 12 人（5 首发 + 7 替补）全员计入 ——
   替补也拿工资，和真实 NBA 一样。
     参考：5 紫 + 5 金 + 2 银 = 5×4500 + 5×3000 + 2×800 = 3.91 亿，刚好卡进 4 亿；
          再多一张紫卡（6 紫 + 5 金 + 1 银 = 4.28 亿）就超帽了。
   ============================================================= */
const SALARY_BY_TIER = {
  silver:       8000000,    // 800 万
  gold:         30000000,   // 3000 万
  momentGold:   30000000,   // 时刻金卡 → 同金卡
  purple:       45000000,   // 4500 万
  legendPurple: 45000000,   // 名宿紫卡 → 同紫卡
  momentPurple: 45000000,   // 时刻紫卡 → 同紫卡
};
/** 某个档位的基础工资 */
function salaryOfTier(tier) {
  return SALARY_BY_TIER[tier] != null ? SALARY_BY_TIER[tier] : SALARY_BY_TIER.silver;
}
/** 工资帽：4 亿 */
const SALARY_CAP = 400000000;
/** 算一组卡 id 的工资合计（null 空位自动跳过） */
function salarySumOf(ids) {
  if (typeof CARD_BY_ID === 'undefined') return 0;
  return (ids || []).reduce((s, id) => {
    const c = id && CARD_BY_ID[id];
    return s + (c ? salaryOfTier(c.tier) : 0);
  }, 0);
}
const BADGE_DEFS_JSON = null;

/* ---------- 招募卡池 ---------- */
const POOLS = [
  {
    "id": "regular",
    "name": "球员招募",
    "sub": "REGULAR RECRUIT",
    "desc": "全档位开放，银卡为主，适合补图鉴",
    "cost": 300,
    "cost10": 2700,
    "theme": "blue",
    "rates": {
        "silver": 58,
        "gold": 30,
        "purple": 8.5,
        "legendPurple": 2.6,
        "momentGold": 0.8,
        "momentPurple": 0.1
    },
    "pity10": "purple"
  },
  {
    "id": "glory",
    "name": "荣耀球员招募",
    "sub": "GLORY MOMENT",
    "desc": "时刻卡概率大幅提升，传奇名宿的巅峰赛季",
    "cost": 388,
    "cost10": 1888,
    "theme": "gold",
    "rates": {
        "silver": 0,
        "gold": 46.0,
        "purple": 30,
        "legendPurple": 14,
        "momentGold": 8,
        "momentPurple": 2
    },
    "pity10": "purple"
  },
  {
    "id": "legend",
    "name": "名宿招募",
    "sub": "LEGEND RECRUIT",
    "desc": "只出金卡及以上，历史名宿概率翻倍",
    "cost": 388,
    "cost10": 1888,
    "theme": "purple",
    "rates": {
        "silver": 0,
        "gold": 42,
        "purple": 34,
        "legendPurple": 14,
        "momentGold": 8,
        "momentPurple": 2
    },
    "pity10": "momentGold"
  }
];
/* =============================================================
   保底（pity）系统
   -------------------------------------------------------------
   三条独立的保底线，各自计数、各自清零：
     紫卡     —— 每 30 抽必得一张紫卡及以上
     名宿紫卡 —— 每 60 抽必得一张名宿紫卡及以上
     时刻卡   —— 每 90 抽必得一张时刻紫卡
   界面会实时显示"还差几抽"，抽一次就减一，抽中对应档位就归零。
   ============================================================= */
const PITY = { purpleEvery: 30, legendEvery: 60, momentEvery: 90 };
/* =============================================================
   突破成本（v1.1 平衡修复）
   -------------------------------------------------------------
   原来所有档位统一 8 阶 × 8 张 = 64 张。按市价推算：
     时刻紫卡 ~49,700/张 × 64 = 318 万金币
     而一个赛季收入只有 6.5~16.5 万
   → 练满一张顶级卡要 19~49 个赛季，而游戏只有 31 个赛季。
   所以高档卡必须降门槛，让"练满"在几个赛季内可达。
   ============================================================= */
const BREAK_PER_TIER = {
  silver:       7,    // 银卡：9 阶 × 7 = 63 张消耗，+ 本体 = 64 张满突破
  gold:         7,    // 金卡：同上
  purple:       5,    // 紫卡：9 阶 × 5 = 45 张消耗（+ 本体 46）
  legendPurple: 4,    // 名宿紫：9 阶 × 4 = 36 张（+ 本体 37）
  momentGold:   3,    // 时刻金：9 阶 × 3 = 27 张（+ 本体 28）
  momentPurple: 3,    // 时刻紫：同上
};
/** 取某个档位的每阶消耗张数 */
function breakPerOf(tier) { return BREAK_PER_TIER[tier] || 7; }
/** 取某个档位满突破需要**消耗**的总张数（不含保留的本体那张） */
function breakTotalOf(tier) { return breakPerOf(tier) * BREAK.stages; }
/** 取某个档位满突破需要**持有**的总张数（= 消耗 + 本体那张） */
function breakOwnOf(tier) { return breakTotalOf(tier) + 1; }

/* =============================================================
   突破阶数（v9.0：8 → 9 阶）
   -------------------------------------------------------------
   1~8 阶用数字显示，第 9 阶是「满突破」（界面显示 MAX）。
   每阶的能力加成**不再线性**（前两阶小、后面大），
   这样 9 阶的总增幅仍然是 +32 能力 / +16 综合 ——
   和旧版 8 阶满突完全一致，数值上限（能力 135 / 综合 129）不用动。
   ============================================================= */
const BREAK = {"stages":9,"per":7,"total":63,"attr":4,"ovr":2};
const BREAK_LABEL = ["未突破","1 阶","2 阶","3 阶","4 阶","5 阶","6 阶","7 阶","8 阶","满突破"];
/* 累计加成表：下标 = 突破阶数，9 阶总和仍是 +32 / +16 */
const BREAK_ATTR_AT = [0, 2, 4, 8, 12, 16, 20, 24, 28, 32];
const BREAK_OVR_AT  = [0, 1, 2, 4,  6,  8, 10, 12, 14, 16];
/** 某阶突破累计加多少能力 */
function breakAttrAt(b) {
  const n = Math.max(0, Math.min(BREAK.stages, b || 0));
  return BREAK_ATTR_AT[n] || 0;
}
/** 某阶突破累计加多少综合 */
function breakOvrAt(b) {
  const n = Math.max(0, Math.min(BREAK.stages, b || 0));
  return BREAK_OVR_AT[n] || 0;
}

/* ---------- 500 张卡 ---------- */
/* [英文名, 中文名, 位置, 副位置, 身高, 体重, 球队, 档次, 球风, 综合, 属性21项, 赛季, 时刻说明] */
const RAW_CARDS = [
    ["Kobe Bryant", "科比·布莱恩特", "SG", "PG", 198, 96, "洛杉矶湖人", "#fdb927", "#552583", "momentPurple", "scorer", 112, [88, 78, 82, 88, 83, 86, 79, 85, 84, 83, 71, 77, 75, 88, 53, 63, 58, 83, 86, 79, 59, 88, 88, 76, 88, 88, 79, 60, 67, 68], "2005-06", "场均35.4分·单场81分赛季", "img/kobe-bryant.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/977.png"],
    ["LeBron James", "勒布朗·詹姆斯", "SF", "PF", 206, 113, "克利夫兰骑士", "#fdbb30", "#860038", "legendPurple", "point_forward", 100, [89, 71, 83, 68, 85, 88, 81, 87, 89, 89, 87, 82, 90, 89, 54, 79, 74, 86, 89, 82, 85, 89, 75, 86, 79, 79, 81, 84, 91, 92], "", "", "img/lebron-james.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png"],
    ["Shaquille O'Neal", "沙奎尔·奥尼尔", "C", "PF", 212, 147, "洛杉矶湖人", "#fdb927", "#552583", "legendPurple", "anchor", 97, [66, 25, 60, 42, 84, 87, 83, 90, 85, 66, 65, 59, 75, 66, 80, 87, 82, 84, 87, 80, 87, 63, 74, 74, 70, 67, 87, 77, 85, 86], "", "", "img/shaquille-o-neal.webp", 0, "https://commons.wikimedia.org/wiki/File:Shaquille_O%27Neal_October_2017_%28cropped%29.jpg"],
    ["Larry Bird", "拉里·伯德", "SF", "PG", 206, 100, "波士顿凯尔特人", "#00a758", "#007a33", "legendPurple", "scorer", 100, [92, 86, 81, 83, 86, 89, 86, 91, 89, 88, 79, 81, 84, 89, 44, 57, 52, 76, 79, 72, 66, 89, 89, 84, 89, 89, 88, 74, 81, 82], "", "", "img/larry-bird.webp", 0, "https://commons.wikimedia.org/wiki/File:Larrybird.jpg"],
    ["Stephen Curry", "斯蒂芬·库里", "PG", "SG", 188, 86, "金州勇士", "#ffc72c", "#1d428a", "legendPurple", "sniper", 100, [84, 96, 79, 87, 83, 86, 56, 62, 74, 91, 73, 85, 74, 89, 44, 55, 50, 51, 54, 47, 54, 87, 89, 84, 89, 89, 67, 50, 58, 59], "", "", "img/stephen-curry.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png"],
    ["Kevin Durant", "凯文·杜兰特", "SF", "PG", 208, 109, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "legendPurple", "scorer", 101, [89, 85, 83, 85, 81, 84, 87, 92, 90, 96, 80, 90, 82, 90, 47, 65, 60, 79, 81, 75, 70, 90, 84, 89, 90, 90, 90, 62, 69, 70], "", "", "img/kevin-durant.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201142.png"],
    ["Tim Duncan", "蒂姆·邓肯", "PF", "SF", 211, 113, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "legendPurple", "skilled_big", 97, [75, 80, 69, 87, 84, 87, 84, 89, 81, 64, 71, 57, 74, 68, 80, 84, 79, 82, 85, 78, 87, 77, 79, 87, 66, 66, 77, 77, 85, 86], "", "", "img/tim-duncan.webp", 0, "https://commons.wikimedia.org/wiki/File:Tim_Duncan.jpg"],
    ["Giannis Antetokounmpo", "扬尼斯·阿德托昆博", "PF", "C", 211, 110, "密尔沃基雄鹿", "#eee1c6", "#00471b", "purple", "freak_forward", 91, [55, 25, 49, 49, 79, 82, 80, 92, 84, 90, 74, 84, 87, 84, 74, 79, 74, 71, 74, 67, 82, 73, 59, 70, 74, 74, 84, 79, 86, 87], "", "", "img/giannis-antetokounmpo.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203507.png"],
    ["Dirk Nowitzki", "德克·诺维茨基", "PF", "SF", 213, 115, "达拉斯独行侠", "#00538c", "#002b5e", "legendPurple", "skilled_big", 97, [86, 82, 80, 82, 84, 87, 82, 88, 79, 62, 68, 55, 75, 66, 73, 82, 77, 78, 81, 75, 87, 75, 77, 87, 66, 66, 75, 82, 89, 90], "", "", "img/dirk-nowitzki.webp", 0, "https://commons.wikimedia.org/wiki/File:Dirk_Nowitzki_-_2019202181209_2019-07-21_Champions_for_Charity_-_1829_-_B70I1864.jpg"],
    ["Yao Ming", "姚明", "C", "PF", 229, 140, "休斯顿火箭", "#ce1141", "#1a1a1a", "gold", "skilled_big", 88, [62, 25, 57, 75, 69, 72, 69, 74, 80, 54, 65, 47, 64, 41, 73, 82, 77, 76, 90, 72, 82, 40, 55, 53, 43, 40, 77, 69, 76, 77], "", "", "img/yao-ming.webp", 0, "https://commons.wikimedia.org/wiki/File:YaoMingonoffense2.jpg"],
    ["Karl Malone", "卡尔·马龙", "PF", "SF", 206, 116, "犹他爵士", "#f9a01b", "#002b5c", "purple", "skilled_big", 95, [78, 75, 73, 85, 82, 85, 77, 83, 81, 64, 67, 58, 72, 65, 78, 85, 80, 79, 82, 75, 82, 73, 81, 85, 67, 67, 74, 74, 81, 82], "", "", "img/karl-malone.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/252.png"],
    ["Dwyane Wade", "德维恩·韦德", "SG", "PG", 193, 100, "迈阿密热火", "#f9a01b", "#98002e", "legendPurple", "slasher", 97, [77, 76, 71, 84, 82, 85, 80, 86, 85, 81, 80, 75, 69, 87, 71, 49, 44, 54, 57, 50, 72, 87, 74, 74, 87, 87, 87, 51, 59, 60], "", "", "img/dwyane-wade.webp", 0, "NBA 官方定妆照（热火白衫）"],
    ["Allen Iverson", "阿伦·艾弗森", "SG", "PG", 183, 75, "费城76人", "#ed174c", "#006bb6", "legendPurple", "slasher", 98, [81, 72, 76, 87, 81, 84, 85, 90, 88, 84, 81, 78, 73, 86, 52, 58, 53, 60, 63, 56, 77, 92, 81, 77, 86, 86, 88, 56, 64, 65], "", "", "img/allen-iverson.webp", 0, "https://commons.wikimedia.org/wiki/File:Allen_Iverson_headshot.jpg"],
    ["Dražen Petrović", "德拉任·彼得罗维奇", "SG", "SF", 196, 91, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "gold", "sniper", 87, [77, 79, 72, 79, 69, 72, 40, 46, 59, 74, 54, 67, 57, 82, 25, 40, 35, 36, 39, 32, 41, 75, 84, 68, 74, 74, 54, 32, 40, 41], "", "", "img/drazen-petrovic.webp", 0, "https://commons.wikimedia.org/wiki/File:Lipofsky-JDra%C5%BEen_Petrovi%C4%87.jpg"],
    ["Luka Dončić", "卢卡·东契奇", "PG", "SF", 201, 104, "达拉斯独行侠", "#00538c", "#002b5e", "legendPurple", "point_forward", 98, [82, 78, 77, 85, 85, 88, 68, 74, 88, 79, 74, 73, 82, 81, 36, 64, 59, 78, 81, 75, 87, 87, 78, 86, 65, 65, 53, 79, 87, 88], "", "", "img/luka-doncic.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png"],
    ["Derrick Rose", "德里克·罗斯", "PG", "SF", 191, 86, "芝加哥公牛", "#ce1141", "#1a1a1a", "legendPurple", "slasher", 98, [83, 82, 78, 84, 82, 85, 78, 84, 88, 81, 71, 75, 70, 86, 45, 57, 52, 59, 62, 55, 77, 84, 79, 75, 86, 86, 88, 52, 60, 61], "", "", "img/derrick-rose.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201565.png"],
    ["Chris Paul", "克里斯·保罗", "PG", "SG", 183, 79, "洛杉矶快船", "#c8102e", "#1d428a", "legendPurple", "floor_gen", 98, [83, 88, 78, 88, 85, 88, 40, 46, 70, 77, 83, 70, 62, 83, 25, 37, 32, 46, 49, 42, 49, 85, 87, 87, 83, 83, 60, 40, 48, 49], "", "", "img/chris-paul.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/101108.png"],
    ["Arvydas Sabonis", "阿维达斯·萨博尼斯", "C", "PF", 220, 127, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "skilled_big", 87, [73, 68, 67, 74, 78, 81, 66, 72, 67, 48, 51, 41, 63, 52, 63, 69, 64, 76, 79, 73, 72, 62, 63, 77, 53, 50, 62, 73, 80, 81], "", "", "img/arvydas-sabonis.webp", 0, "https://commons.wikimedia.org/wiki/File:Arvydas_Sabonis.jpg"],
    ["Pau Gasol", "保罗·加索尔", "C", "PF", 215, 113, "孟菲斯灰熊", "#5d76a9", "#12173f", "gold", "skilled_big", 87, [74, 63, 68, 75, 76, 79, 68, 74, 65, 49, 51, 42, 63, 47, 63, 71, 66, 76, 79, 73, 72, 62, 64, 72, 54, 51, 61, 71, 78, 79], "", "", "img/pau-gasol.webp", 0, "https://commons.wikimedia.org/wiki/File:Pau_Gasol_2022_%28cropped%29.png"],
    ["Russell Westbrook", "拉塞尔·威斯布鲁克", "PG", "SF", 194, 87, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "legendPurple", "slasher", 98, [81, 59, 76, 88, 85, 88, 82, 88, 88, 86, 75, 79, 81, 86, 50, 58, 53, 66, 68, 62, 77, 88, 82, 81, 86, 86, 88, 71, 78, 79], "", "", "img/russell-westbrook.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201566.png"],
    ["Tony Parker", "托尼·帕克", "PG", "SF", 188, 81, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "scorer", 88, [73, 76, 67, 76, 78, 81, 68, 74, 69, 67, 58, 61, 53, 78, 25, 33, 28, 56, 59, 52, 46, 74, 75, 75, 78, 78, 69, 32, 40, 41], "", "", "img/tony-parker.webp", 0, "https://commons.wikimedia.org/wiki/File:Tony_Parker_2011-01_%28cropped%29.jpg"],
    ["Kyrie Irving", "凯里·欧文", "PG", "SF", 188, 88, "克利夫兰骑士", "#fdbb30", "#860038", "legendPurple", "scorer", 99, [83, 80, 78, 88, 84, 87, 79, 84, 86, 80, 70, 74, 68, 89, 40, 47, 42, 68, 70, 64, 62, 89, 89, 79, 89, 89, 79, 50, 58, 59], "", "", "img/kyrie-irving.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202681.png"],
    ["James Harden", "詹姆斯·哈登", "SG", "PG", 196, 100, "休斯顿火箭", "#ce1141", "#1a1a1a", "legendPurple", "scorer", 99, [89, 84, 83, 82, 85, 88, 78, 83, 88, 79, 68, 72, 66, 85, 35, 45, 40, 64, 67, 60, 59, 86, 84, 82, 86, 86, 79, 46, 54, 55], "", "", "img/james-harden.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201935.png"],
    ["Kevin Garnett", "凯文·加内特", "PF", "SF", 211, 114, "明尼苏达森林狼", "#78be20", "#0c2340", "legendPurple", "skilled_big", 100, [81, 80, 76, 89, 87, 90, 87, 92, 87, 88, 69, 81, 88, 65, 81, 87, 82, 87, 90, 83, 88, 74, 79, 78, 71, 69, 77, 81, 89, 90], "", "", "img/kevin-garnett.webp", 0, "https://commons.wikimedia.org/wiki/File:Kevin_Garnett_2008-01-13.jpg"],
    ["Steve Nash", "史蒂夫·纳什", "PG", "SG", 190, 89, "菲尼克斯太阳", "#e56020", "#1d1160", "legendPurple", "floor_gen", 101, [91, 86, 85, 87, 87, 90, 49, 55, 70, 80, 80, 73, 68, 87, 30, 48, 43, 54, 57, 50, 56, 86, 91, 90, 88, 88, 64, 49, 57, 58], "", "", "img/steve-nash.webp", 0, "https://commons.wikimedia.org/wiki/File:SteveNash2014.jpg"],
    ["Carmelo Anthony", "卡梅隆·安东尼", "SF", "PG", 203, 100, "丹佛掘金", "#fec524", "#0e2240", "purple", "scorer", 95, [82, 76, 76, 86, 83, 86, 82, 87, 79, 86, 72, 79, 72, 86, 42, 51, 46, 76, 79, 73, 66, 86, 86, 84, 86, 86, 82, 51, 59, 60], "", "", "img/carmelo-anthony.webp", 0, "https://commons.wikimedia.org/wiki/File:Carmelo_Anthony_-_51958670372_%28cropped%29.jpg"],
    ["Nikola Jokić", "尼古拉·约基奇", "C", "PF", 208, 113, "丹佛掘金", "#fec524", "#0e2240", "legendPurple", "skilled_big", 97, [86, 76, 80, 85, 82, 85, 62, 67, 78, 61, 67, 54, 73, 61, 73, 85, 80, 85, 88, 81, 88, 73, 76, 93, 63, 60, 77, 78, 86, 87], "", "", "img/nikola-jokic.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203999.png"],
    ["Julius Erving", "朱利叶斯·欧文", "SF", "PF", 201, 93, "费城76人", "#ed174c", "#006bb6", "purple", "point_forward", 93, [74, 78, 68, 79, 78, 81, 79, 85, 79, 67, 64, 61, 73, 72, 40, 60, 55, 80, 83, 76, 75, 84, 77, 84, 72, 72, 81, 73, 80, 81], "", "", "img/julius-erving.webp", 0, "https://commons.wikimedia.org/wiki/File:Julius_Erving_%E2%80%93_76ers_%281%29.jpeg"],
    ["John Stockton", "约翰·斯托克顿", "PG", "SG", 185, 77, "犹他爵士", "#f9a01b", "#002b5c", "purple", "floor_gen", 93, [83, 74, 77, 84, 76, 79, 40, 46, 66, 70, 79, 63, 60, 80, 25, 32, 27, 40, 43, 36, 48, 84, 83, 84, 80, 80, 54, 42, 50, 51], "", "", "img/john-stockton.webp", 0, "https://commons.wikimedia.org/wiki/File:John_Stockton_2022.jpg"],
    ["Anthony Davis", "安东尼·戴维斯", "PF", "SF", 211, 115, "新奥尔良鹈鹕", "#e31837", "#0c2340", "legendPurple", "two_way", 96, [75, 77, 69, 77, 80, 83, 78, 84, 70, 93, 80, 87, 88, 84, 82, 84, 79, 63, 66, 59, 74, 78, 77, 75, 78, 78, 79, 76, 83, 84], "", "", "img/anthony-davis.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203076.png"],
    ["Blake Griffin", "布雷克·格里芬", "PF", "SF", 208, 114, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "skilled_big", 88, [76, 70, 71, 76, 80, 83, 71, 76, 71, 53, 57, 46, 67, 55, 64, 75, 70, 82, 85, 78, 79, 63, 71, 77, 55, 52, 66, 75, 83, 84], "", "", "img/blake-griffin.webp", 0, "https://commons.wikimedia.org/wiki/File:Blake_Griffin_Clippers.jpg"],
    ["Ray Allen", "雷·阿伦", "SG", "SF", 196, 96, "波士顿凯尔特人", "#007a33", "#ba9653", "purple", "sniper", 93, [75, 82, 70, 81, 75, 78, 51, 57, 66, 79, 63, 73, 64, 84, 36, 45, 40, 46, 49, 42, 56, 84, 82, 77, 83, 83, 63, 42, 50, 51], "", "", "img/ray-allen.webp", 0, "https://commons.wikimedia.org/wiki/File:Ray_Allen_2008-01-13.jpg"],
    ["Kawhi Leonard", "科怀·伦纳德", "SF", "PF", 201, 104, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "purple", "point_forward", 93, [80, 76, 74, 78, 80, 83, 64, 70, 83, 88, 78, 82, 81, 74, 34, 61, 56, 73, 75, 69, 79, 84, 81, 84, 69, 69, 65, 68, 75, 76], "", "", "img/kawhi-leonard.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202695.png"],
    ["Dwight Howard", "德怀特·霍华德", "C", "PF", 208, 125, "奥兰多魔术", "#0077c0", "#1a1a1a", "purple", "anchor", 93, [62, 53, 56, 39, 81, 84, 78, 84, 82, 64, 62, 58, 74, 62, 81, 80, 75, 81, 84, 77, 81, 56, 65, 70, 64, 62, 84, 76, 84, 85], "", "", "img/dwight-howard.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201575.png"],
    ["Klay Thompson", "克莱·汤普森", "SG", "SF", 201, 93, "金州勇士", "#ffc72c", "#1d428a", "purple", "sniper", 93, [84, 82, 78, 75, 77, 80, 48, 54, 66, 80, 63, 74, 65, 84, 34, 43, 38, 49, 52, 45, 53, 84, 83, 75, 84, 84, 61, 44, 52, 53], "", "", "img/klay-thompson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202691.png"],
    ["Paul Pierce", "保罗·皮尔斯", "SF", "PG", 201, 107, "波士顿凯尔特人", "#00a758", "#007a33", "purple", "scorer", 93, [84, 84, 78, 84, 81, 84, 78, 84, 84, 83, 68, 76, 68, 84, 40, 53, 48, 72, 74, 68, 59, 84, 84, 74, 84, 84, 80, 47, 55, 56], "", "", "img/paul-pierce.webp", 0, "https://commons.wikimedia.org/wiki/File:Paul_Pierce_2008-01-13_%28cropped%29.jpg"],
    ["Dikembe Mutombo", "迪肯贝·穆托姆博", "C", "PF", 218, 111, "亚特兰大老鹰", "#e03a3e", "#26282a", "purple", "anchor", 94, [55, 25, 49, 73, 82, 85, 82, 87, 83, 61, 60, 54, 72, 63, 84, 83, 78, 79, 82, 75, 85, 52, 64, 65, 64, 62, 85, 76, 84, 85], "", "", "img/dikembe-mutombo.webp", 0, "https://commons.wikimedia.org/wiki/File:Dikembe_Mutombo_at_the_Aspire4Sport_Congress_in_Doha._crop.jpg"],
    ["Vlade Divac", "弗拉德·迪瓦茨", "C", "PF", 217, 118, "洛杉矶湖人", "#fdb927", "#552583", "gold", "anchor", 86, [42, 36, 36, 59, 64, 67, 72, 77, 65, 45, 48, 38, 65, 50, 84, 84, 79, 68, 71, 64, 84, 40, 51, 53, 50, 47, 71, 79, 86, 87], "", "", "img/vlade-divac.webp", 0, "https://commons.wikimedia.org/wiki/File:Vlade_Divac_2016-mc.rs_%28cropped%29.jpg"],
    ["Jeremy Lin", "林书豪", "PG", "SG", 191, 91, "纽约尼克斯", "#f58426", "#006bb6", "gold", "floor_gen", 86, [77, 68, 72, 82, 68, 71, 33, 39, 55, 65, 63, 59, 53, 74, 25, 25, 25, 31, 34, 27, 35, 74, 75, 72, 74, 74, 48, 33, 41, 42], "", "", "img/jeremy-lin.webp", 0, "https://commons.wikimedia.org/wiki/File:Jeremy_Lin_with_the_Knicks_and_reporters_%28cropped%29.jpg"],
    ["Chris Bosh", "克里斯·波什", "PF", "SF", 211, 107, "迈阿密热火", "#f9a01b", "#98002e", "gold", "skilled_big", 87, [76, 69, 71, 74, 82, 85, 70, 75, 73, 50, 52, 43, 64, 55, 69, 75, 71, 72, 75, 68, 79, 62, 66, 76, 55, 52, 66, 70, 77, 78], "", "", "img/chris-bosh.webp", 0, "https://commons.wikimedia.org/wiki/File:Chris_Bosh_e1.jpg"],
    ["David Robinson", "大卫·罗宾逊", "C", "PF", 216, 107, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "purple", "anchor", 94, [57, 49, 51, 72, 81, 84, 76, 82, 81, 61, 61, 54, 71, 64, 82, 81, 76, 79, 82, 75, 85, 55, 67, 67, 69, 66, 85, 75, 83, 84], "", "", "img/david-robinson.webp", 0, "https://commons.wikimedia.org/wiki/File:David_Robinson_%28Team_USA%29.jpg"],
    ["Manu Ginóbili", "马努·吉诺比利", "SG", "PG", 187, 93, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "scorer", 87, [79, 76, 74, 74, 72, 75, 62, 67, 76, 67, 73, 61, 52, 74, 25, 31, 26, 56, 59, 52, 47, 78, 73, 59, 72, 72, 64, 29, 37, 38], "", "", "img/manu-ginobili.webp", 0, "https://commons.wikimedia.org/wiki/File:Manu_Ginobili_Spurs-Magic011_%28cropped%29.jpg"],
    ["Reggie Miller", "雷吉·米勒", "SG", "SF", 201, 84, "印第安纳步行者", "#fdbb30", "#002d62", "purple", "sniper", 95, [86, 90, 80, 82, 74, 76, 53, 59, 79, 80, 65, 74, 65, 85, 29, 47, 42, 47, 50, 43, 55, 84, 83, 75, 86, 86, 60, 42, 50, 51], "", "", "img/reggie-miller.webp", 0, "https://commons.wikimedia.org/wiki/File:Reggie_Miller_TNT_cropped.jpg"],
    ["Damian Lillard", "达米安·利拉德", "PG", "SF", 188, 88, "波特兰开拓者", "#e03a3e", "#1a1a1a", "legendPurple", "sniper", 96, [87, 83, 81, 82, 80, 83, 54, 60, 80, 83, 66, 77, 68, 87, 39, 48, 43, 49, 52, 45, 54, 81, 87, 76, 87, 87, 66, 47, 55, 56], "", "", "img/damian-lillard.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203081.png"],
    ["Tracy McGrady", "特雷西·麦克格雷迪", "SG", "SF", 203, 101, "奥兰多魔术", "#0077c0", "#1a1a1a", "purple", "point_forward", 95, [81, 77, 76, 75, 77, 80, 78, 84, 82, 66, 69, 60, 72, 73, 34, 54, 49, 74, 76, 70, 79, 80, 80, 86, 79, 79, 64, 72, 79, 80], "", "", "img/tracy-mcgrady.webp", 0, "https://commons.wikimedia.org/wiki/File:Tracy_McGrady_2008-02-13.jpg"],
    ["Toni Kukoč", "托尼·库科奇", "SF", "SG", 207, 87, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "three_d", 87, [73, 75, 67, 81, 73, 75, 60, 65, 57, 91, 77, 85, 78, 81, 48, 63, 58, 38, 41, 34, 68, 68, 85, 76, 82, 79, 73, 59, 66, 67], "", "", "img/toni-kukoc.webp", 0, "https://commons.wikimedia.org/wiki/File:Toni_Kukoc_081423_cropped_%28cropped1%29.jpg"],
    ["Marc Gasol", "马克·加索尔", "PF", "SF", 216, 120, "孟菲斯灰熊", "#5d76a9", "#12173f", "purple", "two_way", 92, [76, 79, 71, 78, 74, 77, 74, 80, 70, 89, 83, 83, 83, 76, 58, 71, 66, 58, 61, 54, 73, 74, 75, 68, 82, 82, 74, 70, 77, 78], "", "", "img/marc-gasol.webp", 0, "https://commons.wikimedia.org/wiki/File:Marc_Gasol-jul_2018.jpg"],
    ["Metta Sandiford-Artest", "梅塔·世界和平", "SG", "SF", 201, 118, "洛杉矶湖人", "#fdb927", "#552583", "purple", "point_forward", 92, [76, 80, 71, 74, 77, 80, 63, 69, 81, 68, 65, 62, 69, 68, 33, 56, 51, 75, 78, 72, 76, 80, 73, 84, 68, 68, 58, 64, 72, 73], "", "", "img/metta-sandiford-artest.webp", 0, "https://commons.wikimedia.org/wiki/File:Metta_World_Peace.jpg"],
    ["Ricky Rubio", "里基·卢比奥", "PG", "SF", 193, 86, "明尼苏达森林狼", "#78be20", "#0c2340", "purple", "scorer", 92, [83, 78, 77, 77, 79, 82, 66, 72, 77, 72, 62, 65, 59, 78, 29, 37, 32, 62, 64, 58, 49, 84, 81, 70, 81, 81, 68, 38, 46, 47], "", "", "img/ricky-rubio.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201937.png"],
    ["Vince Carter", "文斯·卡特", "SG", "PG", 198, 100, "多伦多猛龙", "#ce1141", "#1a1a1a", "purple", "slasher", 92, [74, 74, 68, 74, 80, 83, 81, 86, 83, 75, 63, 69, 63, 84, 41, 43, 38, 49, 52, 45, 67, 84, 72, 70, 84, 84, 83, 45, 53, 54], "", "", "img/vince-carter.webp", 0, "https://commons.wikimedia.org/wiki/File:Lipofsky_Vince_Carter.jpg"],
    ["Patrick Ewing", "帕特里克·尤因", "C", "PF", 213, 109, "纽约尼克斯", "#f58426", "#006bb6", "purple", "skilled_big", 92, [74, 65, 69, 73, 78, 81, 74, 79, 72, 48, 51, 41, 64, 51, 80, 79, 74, 77, 80, 74, 77, 62, 65, 79, 55, 52, 65, 74, 81, 82], "", "", "img/patrick-ewing.webp", 0, "https://commons.wikimedia.org/wiki/File:Patrick_Ewing_Magic_cropped.jpg"],
    ["Paul George", "保罗·乔治", "SF", "PF", 203, 100, "印第安纳步行者", "#fdbb30", "#002d62", "purple", "point_forward", 92, [80, 80, 74, 78, 79, 82, 65, 71, 84, 69, 67, 63, 72, 73, 40, 61, 56, 80, 83, 76, 80, 84, 82, 84, 72, 72, 62, 69, 76, 77], "", "", "img/paul-george.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202331.png"],
    ["Devin Booker", "德文·布克", "SG", "PG", 198, 93, "菲尼克斯太阳", "#e56020", "#1d1160", "purple", "scorer", 94, [83, 77, 77, 79, 81, 84, 75, 80, 78, 75, 64, 68, 63, 80, 33, 43, 38, 64, 66, 60, 51, 86, 77, 72, 81, 81, 74, 44, 52, 53], "", "", "img/devin-booker.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626164.png"],
    ["Shai Gilgeous-Alexander", "谢伊·吉尔杰斯-亚历山大", "PG", "SF", 198, 82, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "purple", "scorer", 94, [83, 78, 77, 79, 81, 84, 71, 76, 77, 72, 81, 65, 61, 83, 28, 40, 35, 59, 62, 55, 49, 84, 77, 72, 78, 78, 70, 42, 50, 51], "", "", "img/shai-gilgeous-alexander.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629023.png"],
    ["Hidayet Türkoğlu", "希达耶特·特科格鲁", "SF", "C", 208, 100, "奥兰多魔术", "#0077c0", "#1a1a1a", "purple", "freak_forward", 94, [64, 44, 58, 62, 83, 86, 83, 88, 85, 79, 69, 73, 83, 86, 84, 85, 80, 80, 83, 76, 86, 81, 58, 76, 85, 85, 85, 81, 88, 89], "", "", "img/hidayet-turkoglu.webp", 0, "https://commons.wikimedia.org/wiki/File:Hedo_Turkoglu.jpg"],
    ["Rajon Rondo", "拉简·隆多", "PG", "SG", 185, 84, "波士顿凯尔特人", "#00a758", "#007a33", "gold", "floor_gen", 87, [76, 77, 71, 77, 72, 75, 30, 36, 52, 62, 62, 55, 49, 74, 25, 25, 25, 30, 33, 26, 33, 79, 77, 83, 68, 68, 45, 30, 38, 39], "", "", "img/rajon-rondo.webp", 0, "https://commons.wikimedia.org/wiki/File:Rajon_Rondo_Media_Day.jpg"],
    ["Jason Kidd", "贾森·基德", "PG", "SG", 193, 93, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "purple", "floor_gen", 94, [85, 72, 79, 86, 81, 84, 40, 46, 62, 70, 79, 64, 71, 82, 25, 33, 28, 45, 48, 41, 47, 86, 86, 84, 79, 79, 52, 65, 73, 74], "", "", "img/jason-kidd.webp", 0, "https://commons.wikimedia.org/wiki/File:Jason_Kidd.jpg"],
    ["Peja Stojaković", "佩贾·斯托贾科维奇", "SF", "PF", 206, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "sniper", 87, [86, 82, 80, 81, 80, 83, 55, 61, 70, 85, 61, 78, 67, 86, 34, 46, 41, 44, 47, 40, 53, 86, 82, 77, 86, 86, 61, 43, 51, 52], "", "", "img/peja-stojakovic.webp", 0, ""],
    ["Andrei Kirilenko", "安德烈·基里连科", "SF", "PG", 209, 102, "犹他爵士", "#f9a01b", "#002b5c", "gold", "slasher", 88, [71, 75, 65, 74, 83, 86, 83, 88, 82, 76, 65, 70, 65, 86, 40, 44, 39, 49, 52, 45, 65, 84, 72, 70, 86, 86, 86, 45, 53, 54], "", "", "img/andrei-kirilenko.webp", 0, "https://commons.wikimedia.org/wiki/File:Andrei_Kirilenko_in_2011.jpg"],
    ["Kevin Love", "凯文·乐福", "PF", "C", 203, 118, "克利夫兰骑士", "#fdbb30", "#860038", "purple", "freak_forward", 94, [59, 42, 53, 66, 82, 85, 81, 87, 86, 79, 65, 73, 83, 84, 82, 86, 81, 79, 82, 76, 84, 80, 61, 77, 85, 85, 84, 81, 88, 89], "", "", "img/kevin-love.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201567.png"],
    ["Andre Iguodala", "安德烈·伊戈达拉", "SG", "SF", 198, 98, "金州勇士", "#ffc72c", "#1d428a", "purple", "sniper", 94, [86, 86, 80, 86, 76, 78, 47, 53, 62, 83, 63, 76, 64, 86, 28, 44, 39, 44, 47, 40, 50, 83, 86, 71, 86, 86, 58, 37, 45, 46], "", "", "img/andre-iguodala.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/2738.png"],
    ["Gilbert Arenas", "吉尔伯特·阿里纳斯", "PG", "SG", 193, 87, "华盛顿奇才", "#e31837", "#002b5c", "gold", "floor_gen", 88, [76, 80, 70, 79, 65, 68, 28, 34, 77, 65, 57, 58, 50, 67, 25, 25, 25, 33, 36, 29, 35, 79, 75, 84, 65, 65, 42, 29, 37, 38], "", "", "img/gilbert-arenas.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/2240.png"],
    ["Jimmy Butler", "吉米·巴特勒", "SF", "PG", 201, 105, "迈阿密热火", "#f9a01b", "#98002e", "purple", "scorer", 94, [76, 86, 70, 86, 83, 86, 79, 85, 80, 87, 71, 80, 73, 86, 37, 47, 42, 69, 72, 65, 61, 86, 86, 76, 86, 86, 84, 52, 60, 61], "", "", "img/jimmy-butler.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202710.png"],
    ["Luol Deng", "罗尔·邓", "SF", "C", 206, 100, "芝加哥公牛", "#ce1141", "#1a1a1a", "purple", "freak_forward", 94, [63, 43, 57, 64, 83, 86, 83, 88, 85, 81, 66, 75, 84, 85, 84, 86, 81, 76, 79, 73, 86, 76, 58, 76, 84, 84, 86, 80, 87, 88], "", "", "img/luol-deng.webp", 0, ""],
    ["Draymond Green", "德雷蒙德·格林", "PF", "SF", 198, 104, "金州勇士", "#ffc72c", "#1d428a", "purple", "two_way", 94, [78, 63, 73, 79, 77, 80, 79, 85, 72, 89, 80, 83, 84, 81, 61, 77, 73, 65, 67, 61, 75, 76, 82, 79, 85, 85, 82, 72, 79, 80], "", "", "img/draymond-green.webp", 0, ""],
    ["Jayson Tatum", "杰森·塔图姆", "SF", "PG", 202, 93, "波士顿凯尔特人", "#00a758", "#007a33", "legendPurple", "scorer", 96, [79, 79, 74, 88, 77, 79, 75, 80, 88, 83, 80, 77, 75, 88, 44, 59, 54, 79, 82, 76, 67, 88, 88, 86, 88, 88, 88, 61, 68, 69], "", "", "img/jayson-tatum.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628369.png"],
    ["Joakim Noah", "乔金·诺阿", "C", "PF", 211, 105, "芝加哥公牛", "#ce1141", "#1a1a1a", "purple", "anchor", 95, [58, 46, 52, 69, 79, 82, 84, 89, 78, 60, 60, 53, 74, 59, 87, 87, 82, 77, 79, 73, 87, 52, 61, 66, 66, 64, 87, 82, 89, 90], "", "", "img/joakim-noah.webp", 0, ""],
    ["Serge Ibaka", "塞尔吉·伊巴卡", "C", "SF", 210, 120, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "gold", "freak_forward", 89, [51, 29, 45, 53, 76, 79, 76, 82, 79, 73, 55, 67, 78, 74, 72, 77, 72, 67, 70, 63, 76, 68, 53, 64, 77, 74, 77, 76, 83, 84], "", "", "img/serge-ibaka.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201586.png"],
    ["Miloš Teodosić", "米洛什·特奥多西奇", "PG", "SG", 195, 89, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "floor_gen", 89, [75, 75, 70, 82, 70, 72, 35, 41, 56, 69, 65, 62, 55, 73, 25, 27, 25, 38, 41, 34, 36, 82, 81, 82, 72, 72, 45, 34, 42, 43], "", "", "img/milos-teodosic.webp", 0, ""],
    ["Bojan Bogdanović", "博扬·博格达诺维奇", "SG", "SF", 202, 98, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "purple", "point_forward", 91, [78, 74, 73, 73, 80, 83, 62, 67, 79, 68, 62, 62, 71, 67, 29, 56, 51, 71, 74, 67, 76, 79, 74, 78, 69, 69, 56, 67, 74, 75], "", "", "img/bojan-bogdanovic.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202711.png"],
    ["Lamar Odom", "拉马尔·奥多姆", "SF", "PG", 208, 100, "洛杉矶湖人", "#fdb927", "#552583", "gold", "scorer", 89, [82, 82, 76, 82, 79, 82, 72, 78, 79, 73, 64, 67, 61, 82, 31, 40, 35, 63, 66, 60, 54, 82, 81, 73, 82, 82, 78, 43, 51, 52], "", "", "img/lamar-odom.webp", 0, ""],
    ["Victor Wembanyama", "维克托·文班亚马", "C", "PF", 234, 108, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "purple", "anchor", 91, [50, 71, 44, 64, 78, 81, 73, 78, 71, 59, 54, 52, 72, 59, 84, 82, 77, 74, 76, 70, 84, 44, 57, 61, 57, 54, 79, 79, 86, 87], "", "", "img/victor-wembanyama.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1641705.png"],
    ["Gary Payton", "加里·佩顿", "PG", "SG", 193, 82, "西雅图超音速", "#00653a", "#ffc200", "gold", "floor_gen", 89, [79, 79, 73, 82, 72, 75, 29, 35, 52, 64, 63, 58, 49, 74, 25, 28, 25, 38, 41, 34, 38, 80, 77, 82, 72, 72, 43, 27, 35, 36], "", "", "img/gary-payton.webp", 0, ""],
    ["Dominique Wilkins", "多米尼克·威尔金斯", "SF", "PF", 201, 91, "亚特兰大老鹰", "#e03a3e", "#26282a", "gold", "two_way", 89, [73, 77, 68, 72, 74, 77, 78, 83, 68, 88, 76, 82, 80, 72, 56, 64, 60, 56, 59, 52, 68, 71, 71, 68, 73, 73, 71, 65, 72, 73], "", "", "img/dominique-wilkins.webp", 0, ""],
    ["Rasheed Wallace", "拉希德·华莱士", "PF", "SF", 211, 102, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "two_way", 87, [73, 72, 67, 74, 71, 74, 69, 75, 65, 85, 72, 78, 78, 78, 58, 65, 60, 56, 59, 52, 66, 72, 72, 66, 76, 74, 73, 65, 73, 74], "", "", "img/rasheed-wallace.webp", 0, ""],
    ["Amar'e Stoudemire", "阿玛雷·斯塔德迈尔", "PF", "SF", 208, 111, "菲尼克斯太阳", "#e56020", "#1d1160", "gold", "skilled_big", 87, [76, 68, 70, 77, 77, 80, 79, 85, 72, 49, 58, 42, 64, 51, 62, 73, 68, 73, 76, 69, 75, 63, 66, 76, 57, 54, 61, 71, 78, 79], "", "", "img/amar-e-stoudemire.webp", 0, ""],
    ["Rudy Gobert", "鲁迪·戈贝尔", "C", "PF", 216, 111, "犹他爵士", "#f9a01b", "#002b5c", "gold", "anchor", 88, [41, 25, 35, 64, 69, 72, 79, 85, 65, 50, 49, 43, 67, 53, 90, 84, 79, 71, 74, 67, 86, 43, 51, 57, 51, 48, 75, 77, 85, 86], "", "", "img/rudy-gobert.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203497.png"],
    ["Juan Carlos Navarro", "胡安·卡洛斯·纳瓦罗", "PG", "SG", 192, 91, "孟菲斯灰熊", "#5d76a9", "#12173f", "gold", "floor_gen", 89, [76, 80, 71, 82, 73, 76, 33, 39, 59, 66, 61, 60, 51, 75, 25, 30, 25, 36, 39, 32, 36, 79, 80, 81, 72, 72, 50, 29, 37, 38], "", "", "img/juan-carlos-navarro.webp", 0, ""],
    ["Shawn Marion", "肖恩·马里昂", "SF", "SG", 201, 100, "迈阿密热火", "#f9a01b", "#98002e", "gold", "three_d", 87, [75, 86, 69, 79, 69, 72, 59, 65, 59, 92, 81, 86, 77, 80, 45, 60, 55, 36, 39, 32, 68, 66, 86, 63, 78, 76, 72, 56, 64, 65], "", "", "img/shawn-marion.webp", 0, ""],
    ["José Calderón", "何塞·卡尔德隆", "PG", "SF", 191, 95, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "point_forward", 89, [77, 76, 72, 70, 76, 79, 56, 61, 78, 62, 60, 56, 65, 67, 31, 51, 46, 72, 74, 68, 72, 79, 74, 75, 61, 61, 58, 62, 70, 71], "", "", "img/jose-calderon.webp", 0, ""],
    ["Jrue Holiday", "朱·霍勒迪", "PG", "SF", 193, 82, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "scorer", 87, [79, 75, 74, 77, 77, 80, 64, 69, 70, 66, 57, 60, 53, 76, 27, 37, 32, 59, 62, 55, 45, 79, 74, 65, 75, 75, 67, 32, 40, 41], "", "", "img/jrue-holiday.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201950.png"],
    ["Zaza Pachulia", "扎扎·帕楚里亚", "PF", "SF", 211, 129, "亚特兰大老鹰", "#e03a3e", "#26282a", "gold", "skilled_big", 89, [77, 69, 72, 73, 79, 82, 74, 80, 74, 51, 59, 44, 67, 54, 66, 72, 68, 79, 82, 75, 80, 63, 71, 82, 56, 53, 62, 76, 83, 84], "", "", "img/zaza-pachulia.webp", 0, ""],
    ["Clyde Drexler", "克莱德·德雷克斯勒", "SG", "SF", 201, 95, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "point_forward", 89, [75, 75, 70, 71, 74, 77, 76, 82, 72, 61, 60, 55, 65, 65, 31, 47, 42, 71, 73, 67, 70, 75, 73, 73, 75, 75, 52, 62, 70, 71], "", "", "img/clyde-drexler.webp", 0, ""],
    ["Chris Mullin", "克里斯·穆林", "SF", "PF", 201, 91, "金州勇士", "#ffc72c", "#1d428a", "purple", "two_way", 92, [76, 78, 71, 75, 75, 77, 75, 81, 66, 91, 82, 85, 81, 78, 62, 66, 62, 64, 66, 60, 73, 74, 81, 67, 80, 80, 78, 65, 73, 74], "", "", "img/chris-mullin.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/904.png"],
    ["Enes Kanter Freedom", "埃内斯·坎特", "C", "PF", 211, 121, "波特兰开拓者", "#e03a3e", "#1a1a1a", "purple", "skilled_big", 92, [80, 69, 75, 76, 77, 80, 73, 78, 76, 54, 58, 47, 68, 53, 64, 74, 69, 80, 83, 76, 81, 67, 72, 78, 56, 53, 64, 76, 84, 85], "", "", "img/enes-kanter-freedom.webp", 0, ""],
    ["Deron Williams", "德隆·威廉姆斯", "PG", "SF", 191, 91, "犹他爵士", "#f9a01b", "#002b5c", "gold", "scorer", 87, [79, 75, 74, 78, 76, 78, 65, 70, 74, 72, 57, 65, 56, 78, 26, 34, 29, 55, 58, 51, 45, 75, 77, 63, 74, 74, 66, 33, 41, 42], "", "", "img/deron-williams.webp", 0, ""],
    ["Alonzo Mourning", "阿隆佐·莫宁", "C", "PF", 208, 109, "迈阿密热火", "#f9a01b", "#98002e", "purple", "anchor", 92, [57, 50, 51, 69, 78, 81, 82, 87, 78, 61, 56, 54, 70, 58, 82, 81, 76, 80, 83, 76, 80, 53, 60, 62, 65, 63, 82, 74, 81, 82], "", "", "img/alonzo-mourning.webp", 0, ""],
    ["Andrew Bogut", "安德鲁·博古特", "C", "PF", 213, 118, "密尔沃基雄鹿", "#eee1c6", "#00471b", "purple", "skilled_big", 92, [80, 71, 75, 79, 82, 85, 76, 82, 72, 57, 56, 50, 69, 52, 64, 73, 68, 78, 81, 75, 80, 62, 70, 79, 60, 57, 65, 75, 83, 84], "", "", "img/andrew-bogut.webp", 0, ""],
    ["DeMar DeRozan", "德玛尔·德罗赞", "SF", "PF", 201, 100, "多伦多猛龙", "#ce1141", "#1a1a1a", "purple", "point_forward", 93, [83, 79, 77, 81, 83, 86, 67, 73, 86, 74, 69, 67, 76, 76, 38, 56, 51, 72, 75, 68, 80, 86, 81, 86, 73, 73, 63, 72, 79, 80], "", "", "img/demar-derozan.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201942.png"],
    ["Goran Dragić", "戈兰·德拉季奇", "PG", "SF", 190, 86, "迈阿密热火", "#f9a01b", "#98002e", "gold", "spark", 87, [75, 75, 69, 75, 74, 76, 62, 67, 66, 69, 64, 63, 55, 82, 25, 33, 28, 34, 37, 30, 46, 75, 76, 65, 77, 77, 71, 34, 42, 43], "", "", "img/goran-dragic.webp", 0, ""],
    ["Darko Miličić", "达科·米里西奇", "PF", "SF", 213, 113, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "big_man", 87, [51, 40, 45, 69, 83, 86, 83, 88, 78, 56, 56, 49, 72, 68, 86, 86, 81, 77, 80, 74, 86, 46, 60, 62, 69, 66, 86, 81, 88, 89], "", "", "img/darko-milicic.webp", 0, ""],
    ["Ben Wallace", "本·华莱士", "C", "PF", 206, 109, "底特律活塞", "#c8102e", "#1d42ba", "gold", "anchor", 87, [40, 25, 34, 59, 69, 72, 78, 84, 70, 48, 51, 41, 67, 52, 83, 90, 80, 68, 71, 65, 83, 42, 48, 52, 50, 47, 75, 79, 87, 87], "", "", "img/ben-wallace.webp", 0, ""],
    ["Tayshaun Prince", "泰夏安·普林斯", "SF", "PG", 206, 98, "底特律活塞", "#c8102e", "#1d42ba", "gold", "slasher", 88, [76, 68, 70, 78, 84, 87, 84, 89, 82, 77, 63, 70, 64, 87, 42, 44, 39, 49, 52, 45, 65, 83, 71, 69, 87, 87, 87, 44, 52, 53], "", "", "img/tayshaun-prince.webp", 0, ""],
    ["Karl-Anthony Towns", "卡尔-安东尼·唐斯", "C", "PF", 211, 113, "明尼苏达森林狼", "#78be20", "#0c2340", "purple", "skilled_big", 93, [79, 78, 74, 81, 83, 86, 76, 82, 76, 53, 61, 46, 66, 59, 65, 78, 74, 74, 76, 70, 77, 67, 71, 83, 55, 52, 69, 73, 80, 81], "", "", "img/karl-anthony-towns.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626157.png"],
    ["Ja Morant", "贾·莫兰特", "PG", "SF", 191, 79, "孟菲斯灰熊", "#5d76a9", "#12173f", "purple", "slasher", 93, [76, 61, 71, 81, 83, 86, 81, 87, 86, 79, 68, 73, 68, 86, 43, 50, 45, 57, 60, 53, 72, 81, 78, 74, 86, 86, 85, 51, 59, 60], "", "", "img/ja-morant.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629630.png"],
    ["Kevin McHale", "凯文·麦克海尔", "PF", "SF", 208, 95, "波士顿凯尔特人", "#00a758", "#007a33", "gold", "skilled_big", 88, [77, 66, 72, 75, 80, 83, 71, 77, 73, 55, 53, 48, 68, 51, 65, 75, 70, 83, 86, 79, 80, 63, 66, 82, 57, 54, 66, 75, 82, 83], "", "", "img/kevin-mchale.webp", 0, ""],
    ["Leandro Barbosa", "莱昂德罗·巴博萨", "PG", "SG", 192, 91, "菲尼克斯太阳", "#e56020", "#1d1160", "gold", "floor_gen", 88, [77, 77, 72, 77, 68, 71, 30, 36, 51, 64, 62, 57, 48, 70, 25, 27, 25, 34, 37, 30, 34, 83, 77, 84, 72, 72, 41, 26, 34, 35], "", "", "img/leandro-barbosa.webp", 0, ""],
    ["Grant Hill", "格兰特·希尔", "SF", "C", 203, 102, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "freak_forward", 89, [72, 33, 66, 56, 72, 75, 79, 84, 81, 78, 61, 72, 78, 77, 77, 79, 74, 72, 74, 68, 81, 70, 52, 75, 78, 78, 80, 72, 80, 81], "", "", "img/grant-hill.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/255.png"],
    ["Robert Parish", "罗伯特·帕里什", "C", "PF", 213, 105, "波士顿凯尔特人", "#007a33", "#ba9653", "gold", "anchor", 88, [46, 38, 40, 59, 67, 70, 77, 83, 66, 49, 45, 42, 69, 52, 87, 87, 82, 69, 72, 66, 87, 42, 48, 53, 50, 47, 72, 82, 89, 90], "", "", "img/robert-parish.webp", 0, ""],
    ["LaMarcus Aldridge", "拉马库斯·阿尔德里奇", "PF", "SF", 211, 109, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "skilled_big", 86, [73, 66, 67, 73, 78, 81, 72, 77, 69, 50, 54, 43, 65, 48, 61, 76, 71, 78, 81, 75, 75, 60, 70, 76, 55, 52, 66, 73, 80, 81], "", "", "img/lamarcus-aldridge.webp", 0, ""],
    ["Ersan İlyasova", "艾森·伊利亚索瓦", "SF", "SG", 206, 107, "密尔沃基雄鹿", "#eee1c6", "#00471b", "gold", "three_d", 86, [75, 84, 69, 78, 68, 71, 60, 65, 56, 92, 76, 86, 78, 78, 44, 62, 57, 32, 35, 28, 65, 65, 86, 60, 82, 79, 68, 59, 66, 67], "", "", "img/ersan-ilyasova.webp", 0, ""],
    ["Andrea Bargnani", "安德里亚·巴格纳尼", "PF", "SF", 213, 111, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "big_man", 86, [51, 42, 45, 68, 83, 86, 83, 88, 81, 55, 51, 48, 71, 63, 86, 86, 81, 75, 77, 71, 86, 47, 61, 57, 66, 64, 86, 81, 88, 89], "", "", "img/andrea-bargnani.webp", 0, ""],
    ["Jonas Valančiūnas", "约纳斯·瓦兰丘纳斯", "C", "PF", 211, 111, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "big_man", 86, [40, 25, 34, 60, 74, 76, 77, 83, 67, 45, 42, 38, 66, 53, 75, 81, 76, 67, 70, 64, 82, 36, 50, 45, 52, 49, 76, 81, 88, 89], "", "", "img/jonas-valanciunas.webp", 0, ""],
    ["Aleksandar Đorđević", "亚历山大·乔尔杰维奇", "PG", "SG", 188, 80, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "floor_gen", 86, [76, 76, 70, 76, 67, 70, 25, 31, 51, 60, 60, 53, 47, 67, 25, 25, 25, 32, 35, 28, 32, 82, 73, 83, 69, 69, 39, 28, 36, 37], "", "", "img/aleksandar-or-evic.webp", 0, ""],
    ["Tyson Chandler", "泰森·钱德勒", "C", "PF", 218, 109, "达拉斯独行侠", "#00538c", "#002b5e", "gold", "big_man", 87, [38, 30, 32, 59, 72, 75, 82, 88, 70, 42, 44, 35, 64, 53, 80, 84, 79, 66, 69, 63, 85, 34, 44, 46, 56, 53, 77, 78, 86, 87], "", "", "img/tyson-chandler.webp", 0, ""],
    ["Domantas Sabonis", "多曼塔斯·萨博尼斯", "C", "PF", 208, 95, "印第安纳步行者", "#fdbb30", "#002d62", "gold", "anchor", 88, [47, 36, 41, 62, 71, 73, 73, 79, 71, 53, 52, 46, 67, 55, 82, 82, 77, 72, 74, 68, 82, 39, 52, 71, 56, 53, 75, 75, 83, 83], "", "", "img/domantas-sabonis.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627734.png"],
    ["Joel Embiid", "乔尔·恩比德", "C", "PF", 213, 113, "费城76人", "#ed174c", "#006bb6", "purple", "skilled_big", 90, [75, 67, 70, 75, 77, 80, 74, 80, 72, 50, 54, 43, 64, 49, 61, 79, 74, 79, 82, 75, 74, 63, 66, 81, 55, 52, 64, 73, 80, 81], "", "", "img/joel-embiid.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203954.png"],
    ["Žydrūnas Ilgauskas", "扎伊德鲁纳斯·伊尔格斯卡斯", "C", "PF", 221, 108, "克利夫兰骑士", "#fdbb30", "#860038", "gold", "big_man", 87, [38, 30, 32, 57, 77, 80, 81, 87, 67, 49, 39, 42, 69, 51, 82, 86, 81, 63, 66, 59, 83, 34, 47, 45, 58, 55, 75, 82, 89, 90], "", "", "img/zydrunas-ilgauskas.webp", 0, ""],
    ["Carlos Boozer", "卡洛斯·布泽尔", "PF", "SF", 206, 121, "洛杉矶湖人", "#fdb927", "#552583", "gold", "skilled_big", 87, [77, 67, 72, 74, 77, 79, 74, 79, 71, 50, 54, 43, 66, 53, 66, 77, 72, 81, 84, 77, 77, 62, 67, 77, 56, 53, 66, 76, 83, 84], "", "", "img/carlos-boozer.webp", 0, ""],
    ["Marcin Gortat", "马尔钦·戈塔特", "C", "PF", 211, 116, "华盛顿奇才", "#e31837", "#002b5c", "gold", "big_man", 87, [39, 27, 33, 56, 74, 77, 79, 85, 70, 44, 45, 37, 66, 55, 82, 84, 79, 65, 67, 61, 85, 32, 48, 47, 56, 53, 74, 82, 89, 90], "", "", "img/marcin-gortat.webp", 0, ""],
    ["Rudy Fernández", "鲁迪·费尔南德斯", "SG", "PG", 195, 87, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "scorer", 87, [80, 73, 75, 77, 70, 73, 66, 71, 73, 70, 58, 64, 55, 77, 25, 33, 28, 53, 56, 49, 46, 76, 74, 62, 76, 76, 66, 32, 40, 41], "", "", "img/rudy-fernandez.webp", 0, ""],
    ["JaVale McGee", "加瓦勒·麦吉", "PF", "SF", 213, 122, "洛杉矶湖人", "#fdb927", "#552583", "gold", "big_man", 87, [50, 38, 44, 67, 84, 87, 84, 89, 81, 57, 53, 50, 73, 63, 87, 87, 82, 76, 78, 72, 87, 45, 64, 58, 69, 66, 87, 82, 89, 90], "", "", "img/javale-mcgee.webp", 0, ""],
    ["Šarūnas Jasikevičius", "萨鲁纳斯·贾斯科维休斯", "PG", "SG", 193, 89, "印第安纳步行者", "#fdbb30", "#002d62", "gold", "floor_gen", 87, [76, 76, 70, 76, 69, 72, 25, 30, 54, 61, 58, 54, 48, 73, 25, 27, 25, 31, 34, 27, 31, 79, 77, 82, 69, 69, 39, 29, 37, 38], "", "", "img/sarunas-jasikevicius.webp", 0, ""],
    ["Boris Diaw", "伯利斯·迪奥", "PG", "SF", 203, 113, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "point_forward", 85, [72, 68, 66, 67, 73, 76, 51, 57, 69, 58, 54, 51, 64, 62, 25, 44, 39, 65, 68, 62, 66, 76, 69, 78, 62, 62, 49, 63, 70, 71], "", "", "img/boris-diaw.webp", 0, ""],
    ["Alexey Shved", "阿列克谢·施韦德", "PG", "SG", 198, 86, "纽约尼克斯", "#f58426", "#006bb6", "gold", "floor_gen", 85, [71, 73, 65, 80, 65, 68, 25, 31, 52, 61, 57, 54, 48, 69, 25, 26, 25, 29, 32, 25, 31, 77, 75, 84, 65, 65, 42, 29, 37, 38], "", "", "img/alexey-shved.webp", 0, ""],
    ["Nicolas Batum", "尼古拉·巴通姆", "SG", "SF", 203, 95, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "point_forward", 85, [75, 67, 69, 65, 73, 76, 50, 56, 74, 58, 57, 51, 62, 65, 28, 49, 44, 69, 72, 65, 69, 77, 65, 78, 61, 61, 49, 59, 66, 67], "", "", "img/nicolas-batum.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201587.png"],
    ["Andrew Wiggins", "安德鲁·威金斯", "SF", "PG", 203, 91, "明尼苏达森林狼", "#78be20", "#0c2340", "gold", "slasher", 85, [73, 67, 67, 74, 83, 86, 81, 87, 77, 73, 57, 66, 60, 86, 38, 39, 34, 45, 48, 41, 63, 81, 68, 63, 86, 86, 84, 40, 48, 49], "", "", "img/andrew-wiggins.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203952.png"],
    ["Dennis Schröder", "丹尼斯·施罗德", "PG", "SF", 186, 78, "亚特兰大老鹰", "#e03a3e", "#26282a", "gold", "scorer", 86, [80, 74, 75, 74, 73, 76, 66, 71, 71, 66, 52, 59, 54, 76, 25, 34, 29, 53, 56, 49, 47, 77, 73, 65, 73, 73, 65, 35, 43, 44], "", "", "img/dennis-schroder.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203471.png"],
    ["Kristaps Porziņģis", "克里斯塔普斯·波尔津吉斯", "PF", "SF", 218, 112, "纽约尼克斯", "#f58426", "#006bb6", "gold", "big_man", 86, [53, 41, 47, 68, 84, 87, 84, 89, 77, 55, 52, 48, 72, 66, 87, 87, 82, 74, 77, 70, 87, 41, 59, 56, 68, 66, 86, 82, 89, 90], "", "", "img/kristaps-porzingis.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/204001.png"],
    ["Jaylen Brown", "贾伦·布朗", "SG", "SF", 201, 101, "波士顿凯尔特人", "#00a758", "#007a33", "purple", "point_forward", 90, [79, 74, 74, 76, 74, 76, 60, 65, 77, 67, 64, 61, 68, 65, 31, 50, 45, 72, 74, 68, 71, 82, 75, 78, 63, 63, 58, 63, 71, 72], "", "", "img/jaylen-brown.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627759.png"],
    ["Joe Johnson", "乔·约翰逊", "SG", "SF", 201, 109, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "gold", "point_forward", 86, [73, 70, 67, 69, 70, 73, 55, 61, 72, 63, 57, 56, 64, 66, 25, 47, 42, 64, 66, 60, 70, 76, 69, 81, 59, 59, 53, 58, 66, 66], "", "", "img/joe-johnson.webp", 0, ""],
    ["Dino Rađa", "迪诺·拉贾", "PF", "SF", 211, 120, "波士顿凯尔特人", "#00a758", "#007a33", "gold", "big_man", 86, [49, 37, 43, 70, 84, 87, 84, 89, 77, 55, 53, 48, 72, 66, 87, 87, 82, 77, 79, 73, 87, 42, 59, 57, 67, 65, 86, 82, 89, 90], "", "", "img/dino-ra-a.webp", 0, ""],
    ["Elton Brand", "埃尔顿·布兰德", "PF", "SF", 203, 115, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "big_man", 86, [52, 38, 46, 66, 82, 85, 84, 89, 77, 58, 54, 51, 73, 65, 86, 87, 82, 77, 79, 73, 87, 45, 57, 56, 64, 61, 83, 82, 89, 90], "", "", "img/elton-brand.webp", 0, ""],
    ["Mike Bibby", "迈克·毕比", "PG", "SF", 185, 86, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "scorer", 86, [77, 76, 72, 77, 75, 77, 63, 68, 67, 67, 56, 61, 52, 75, 25, 32, 27, 57, 60, 53, 45, 75, 71, 65, 76, 76, 65, 30, 38, 39], "", "", "img/mike-bibby.webp", 0, ""],
    ["Marco Belinelli", "马科·贝里内利", "SG", "PG", 196, 74, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "scorer", 86, [82, 75, 77, 77, 74, 77, 66, 71, 72, 66, 52, 60, 52, 74, 25, 34, 29, 54, 57, 50, 43, 73, 77, 66, 72, 69, 67, 31, 39, 40], "", "", "img/marco-belinelli.webp", 0, ""],
    ["Richard Hamilton", "理查德·汉密尔顿", "SG", "SF", 198, 84, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "sniper", 85, [80, 87, 75, 85, 61, 64, 34, 40, 51, 66, 52, 59, 52, 73, 25, 32, 27, 28, 31, 25, 39, 74, 85, 63, 70, 67, 46, 31, 39, 40], "", "", "img/richard-hamilton.webp", 0, ""],
    ["Nate Robinson", "内特·罗宾逊", "PG", "SF", 175, 82, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "spark", 86, [71, 74, 66, 78, 73, 76, 66, 71, 68, 66, 61, 59, 52, 77, 25, 31, 26, 33, 36, 29, 43, 77, 77, 66, 77, 77, 68, 32, 40, 41], "", "", "img/nate-robinson.webp", 0, ""],
    ["Emeka Okafor", "埃米卡·奥卡福", "PF", "SF", 208, 114, "华盛顿奇才", "#e31837", "#002b5c", "gold", "skilled_big", 86, [76, 64, 70, 73, 77, 80, 69, 75, 71, 52, 57, 45, 67, 49, 64, 72, 67, 81, 84, 77, 74, 62, 65, 79, 53, 50, 66, 77, 84, 85], "", "", "img/emeka-okafor.webp", 0, ""],
    ["Álex Abrines", "阿莱克斯·阿布里恩斯", "SG", "PG", 198, 86, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "gold", "scorer", 86, [77, 75, 71, 75, 70, 73, 61, 66, 70, 64, 56, 57, 52, 74, 25, 34, 29, 50, 53, 46, 47, 77, 74, 64, 76, 76, 66, 34, 42, 43], "", "", "img/alex-abrines.webp", 0, ""],
    ["Zach LaVine", "扎克·拉文", "SG", "PG", 196, 91, "芝加哥公牛", "#ce1141", "#1a1a1a", "purple", "slasher", 90, [68, 73, 63, 70, 81, 84, 77, 83, 81, 74, 60, 68, 60, 84, 34, 39, 34, 50, 53, 46, 67, 84, 69, 64, 84, 84, 83, 38, 46, 47], "", "", "img/zach-lavine.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203897.png"],
    ["Bam Adebayo", "巴姆·阿德巴约", "C", "SF", 208, 118, "迈阿密热火", "#f9a01b", "#98002e", "purple", "freak_forward", 90, [51, 34, 45, 57, 74, 76, 73, 78, 80, 74, 57, 68, 78, 80, 78, 79, 74, 73, 75, 69, 79, 68, 49, 66, 78, 75, 78, 76, 84, 85], "", "", "img/bam-adebayo.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628389.png"],
    ["Lonzo Ball", "朗素·波尔", "PG", "SF", 188, 86, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "scorer", 86, [80, 77, 75, 78, 73, 76, 66, 71, 74, 66, 53, 60, 54, 75, 25, 36, 31, 55, 58, 51, 45, 75, 74, 61, 72, 72, 65, 35, 43, 44], "", "", "img/lonzo-ball.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629065.png"],
    ["Tyrese Haliburton", "泰雷塞·哈利伯顿", "PG", "SG", 196, 78, "印第安纳步行者", "#fdbb30", "#002d62", "purple", "floor_gen", 90, [79, 75, 74, 82, 74, 77, 30, 36, 56, 67, 63, 61, 53, 75, 25, 28, 25, 33, 36, 29, 37, 84, 79, 83, 75, 75, 44, 32, 40, 41], "", "", "img/tyrese-haliburton.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630241.png"],
    ["Jusuf Nurkić", "尤素夫·努尔基奇", "C", "PF", 212, 123, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "skilled_big", 85, [67, 57, 62, 67, 77, 79, 69, 75, 68, 48, 46, 41, 63, 46, 60, 68, 64, 79, 82, 76, 71, 54, 62, 73, 48, 45, 59, 70, 77, 78], "", "", "img/jusuf-nurkic.webp", 0, ""],
    ["Timofey Mozgov", "季莫费·莫兹戈夫", "C", "PF", 216, 113, "丹佛掘金", "#fec524", "#0e2240", "gold", "skilled_big", 85, [68, 60, 63, 67, 76, 78, 68, 74, 66, 44, 49, 37, 62, 45, 61, 67, 63, 76, 78, 72, 72, 59, 64, 74, 48, 45, 59, 73, 80, 81], "", "", "img/timofey-mozgov.webp", 0, ""],
    ["Nenê", "内内", "PF", "SF", 211, 113, "休斯顿火箭", "#ce1141", "#1a1a1a", "gold", "skilled_big", 87, [76, 67, 70, 76, 79, 82, 71, 77, 72, 54, 51, 47, 67, 49, 61, 74, 69, 81, 84, 78, 78, 61, 67, 78, 53, 50, 64, 73, 80, 81], "", "", "img/nene.webp", 0, ""],
    ["DeMarcus Cousins", "德马库斯·考辛斯", "C", "PF", 211, 122, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "big_man", 85, [41, 25, 35, 59, 77, 79, 80, 86, 70, 41, 38, 34, 65, 50, 76, 80, 76, 60, 63, 56, 84, 30, 49, 41, 55, 52, 76, 80, 88, 88], "", "", "img/demarcus-cousins.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/202326.png"],
    ["Brandon Roy", "布兰顿·罗伊", "SG", "PG", 196, 98, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "scorer", 85, [77, 73, 72, 77, 71, 74, 62, 67, 69, 66, 59, 60, 52, 72, 25, 30, 25, 51, 54, 47, 45, 75, 74, 60, 71, 71, 68, 31, 39, 40], "", "", "img/brandon-roy.webp", 0, ""],
    ["Greg Oden", "格雷格·奥登", "C", "PF", 213, 129, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "anchor", 85, [40, 30, 34, 57, 69, 72, 69, 75, 65, 46, 43, 39, 66, 44, 87, 87, 82, 66, 69, 63, 82, 32, 50, 52, 50, 47, 66, 78, 86, 87], "", "", "img/greg-oden.webp", 0, ""],
    ["Michael Redd", "迈克尔·里德", "SG", "PG", 198, 100, "密尔沃基雄鹿", "#eee1c6", "#00471b", "gold", "scorer", 85, [77, 70, 72, 78, 73, 76, 64, 69, 71, 66, 58, 60, 51, 77, 25, 34, 29, 57, 60, 53, 44, 75, 70, 62, 74, 74, 66, 29, 37, 38], "", "", "img/michael-redd.webp", 0, ""],
    ["Jermaine O'Neal", "杰梅因·奥尼尔", "PF", "SF", 211, 113, "印第安纳步行者", "#fdbb30", "#002d62", "gold", "skilled_big", 85, [72, 65, 66, 72, 78, 81, 73, 78, 68, 47, 54, 40, 64, 48, 60, 73, 68, 81, 84, 77, 72, 61, 65, 77, 54, 51, 60, 74, 81, 82], "", "", "img/jermaine-o-neal.webp", 0, ""],
    ["Luis Scola", "路易斯·斯科拉", "PF", "SF", 206, 111, "休斯顿火箭", "#ce1141", "#1a1a1a", "gold", "big_man", 85, [51, 36, 45, 63, 81, 84, 84, 89, 79, 52, 50, 45, 70, 64, 84, 87, 82, 76, 78, 72, 87, 41, 58, 57, 62, 59, 85, 82, 89, 90], "", "", "img/luis-scola.webp", 0, ""],
    ["Sasha Vujačić", "萨沙·武亚契奇", "SG", "SF", 201, 93, "洛杉矶湖人", "#fdb927", "#552583", "gold", "point_forward", 86, [73, 73, 67, 68, 71, 74, 54, 60, 69, 58, 60, 51, 62, 63, 28, 50, 45, 70, 73, 67, 67, 78, 67, 80, 58, 58, 54, 59, 67, 67], "", "", "img/sasha-vujacic.webp", 0, ""],
    ["Gerald Wallace", "杰拉德·华莱士", "SF", "PG", 202, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "slasher", 86, [73, 66, 67, 75, 85, 88, 85, 90, 76, 72, 59, 66, 61, 84, 35, 37, 32, 50, 53, 46, 64, 79, 68, 67, 88, 88, 86, 42, 50, 51], "", "", "img/gerald-wallace.webp", 0, ""],
    ["Penny Hardaway", "安芬尼·哈达威", "PG", "SF", 201, 100, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "point_forward", 88, [73, 72, 68, 71, 76, 79, 56, 61, 79, 61, 58, 55, 64, 64, 27, 52, 47, 67, 70, 63, 72, 77, 71, 78, 63, 63, 54, 61, 69, 70], "", "", "img/penny-hardaway.webp", 0, ""],
    ["Nikola Mirotić", "尼克拉·米罗蒂奇", "PF", "SF", 208, 108, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "big_man", 86, [49, 39, 43, 67, 85, 88, 85, 90, 79, 59, 50, 52, 74, 66, 88, 88, 83, 75, 78, 71, 88, 44, 59, 55, 67, 64, 87, 83, 90, 91], "", "", "img/nikola-mirotic.webp", 0, ""],
    ["Ömer Aşık", "欧米尔·阿西克", "C", "PF", 213, 116, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "anchor", 86, [43, 33, 37, 53, 66, 68, 76, 81, 64, 42, 43, 35, 67, 48, 88, 86, 81, 66, 68, 62, 82, 33, 51, 54, 49, 46, 67, 83, 90, 91], "", "", "img/omer-as-k.webp", 0, ""],
    ["Kyle Lowry", "凯尔·洛里", "PG", "SF", 183, 79, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "spark", 86, [72, 74, 67, 79, 75, 78, 60, 66, 68, 66, 60, 59, 52, 83, 25, 34, 29, 35, 38, 31, 48, 79, 74, 66, 78, 78, 67, 32, 40, 41], "", "", "img/kyle-lowry.webp", 0, ""],
    ["Cedi Osman", "切迪·奥斯曼", "PG", "SF", 204, 98, "克利夫兰骑士", "#fdbb30", "#860038", "gold", "point_forward", 84, [70, 71, 65, 67, 72, 75, 51, 57, 74, 61, 55, 54, 62, 65, 27, 48, 43, 69, 72, 66, 68, 79, 70, 77, 59, 59, 47, 56, 64, 65], "", "", "img/cedi-osman.webp", 0, ""],
    ["Jalen Brunson", "杰伦·布朗森", "PG", "SF", 188, 90, "纽约尼克斯", "#f58426", "#006bb6", "purple", "point_forward", 90, [79, 71, 74, 74, 74, 77, 61, 66, 75, 63, 61, 56, 68, 65, 33, 54, 49, 72, 74, 68, 74, 78, 75, 82, 67, 67, 61, 68, 75, 76], "", "", "img/jalen-brunson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png"],
    ["Jamal Murray", "贾迈尔·穆雷", "PG", "SF", 193, 94, "丹佛掘金", "#fec524", "#0e2240", "purple", "point_forward", 91, [76, 75, 71, 73, 79, 82, 64, 69, 80, 67, 65, 61, 68, 71, 32, 57, 52, 75, 77, 71, 76, 81, 75, 79, 64, 64, 55, 64, 71, 72], "", "", "img/jamal-murray.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627750.png"],
    ["Donovan Mitchell", "多诺万·米契尔", "SG", "PG", 191, 97, "犹他爵士", "#f9a01b", "#002b5c", "purple", "slasher", 91, [72, 75, 66, 75, 80, 83, 75, 80, 77, 76, 59, 70, 64, 85, 36, 43, 38, 47, 50, 43, 66, 84, 67, 66, 77, 77, 85, 44, 52, 53], "", "", "img/donovan-mitchell.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628378.png"],
    ["Danilo Gallinari", "达尼罗·加里纳利", "SF", "PG", 209, 106, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "slasher", 84, [70, 69, 65, 71, 82, 85, 84, 89, 75, 69, 61, 63, 58, 88, 35, 42, 37, 48, 51, 44, 65, 86, 68, 63, 83, 83, 88, 39, 47, 48], "", "", "img/danilo-gallinari.webp", 0, ""],
    ["DeAndre Jordan", "德安德烈·乔丹", "C", "PF", 211, 120, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "anchor", 84, [41, 33, 35, 56, 68, 71, 69, 75, 64, 46, 44, 39, 66, 47, 88, 86, 81, 62, 65, 58, 83, 33, 47, 52, 46, 43, 66, 78, 86, 87], "", "", "img/deandre-jordan.webp", 0, ""],
    ["Tiago Splitter", "蒂亚戈·斯普利特", "PF", "SF", 211, 111, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "two_way", 84, [73, 69, 67, 71, 70, 73, 68, 74, 63, 82, 71, 76, 74, 76, 55, 64, 59, 56, 59, 52, 64, 69, 70, 64, 71, 68, 72, 60, 67, 68], "", "", "img/tiago-splitter.webp", 0, ""],
    ["Baron Davis", "拜伦·戴维斯", "PG", "SF", 191, 95, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "spark", 84, [71, 72, 66, 78, 71, 74, 62, 67, 67, 64, 56, 57, 54, 78, 25, 32, 27, 33, 36, 29, 45, 76, 77, 60, 79, 79, 70, 37, 45, 46], "", "", "img/baron-davis.webp", 0, ""],
    ["Jorge Garbajosa", "乔治·贾巴尤萨", "PF", "SF", 206, 111, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "skilled_big", 84, [72, 63, 67, 75, 77, 79, 72, 78, 72, 50, 51, 43, 65, 52, 64, 70, 66, 80, 83, 77, 76, 58, 67, 78, 56, 53, 65, 72, 79, 80], "", "", "img/jorge-garbajosa.webp", 0, ""],
    ["Khris Middleton", "克里斯·米德尔顿", "SF", "PG", 203, 106, "密尔沃基雄鹿", "#eee1c6", "#00471b", "gold", "slasher", 84, [69, 67, 64, 72, 82, 85, 81, 87, 78, 73, 62, 67, 59, 85, 32, 38, 33, 49, 52, 45, 61, 80, 70, 67, 84, 84, 84, 38, 46, 47], "", "", "img/khris-middleton.webp", 0, ""],
    ["Mehmet Okur", "梅米特·奥库", "PF", "SF", 211, 113, "犹他爵士", "#f9a01b", "#002b5c", "gold", "big_man", 84, [48, 40, 42, 65, 83, 86, 85, 90, 78, 54, 50, 47, 72, 66, 85, 88, 83, 74, 77, 70, 88, 44, 59, 55, 63, 60, 85, 83, 90, 91], "", "", "img/mehmet-okur.webp", 0, ""],
    ["Isaiah Thomas", "以赛亚·托马斯", "PG", "SF", 175, 84, "华盛顿奇才", "#e31837", "#002b5c", "gold", "spark", 84, [72, 75, 67, 74, 72, 75, 61, 67, 65, 66, 57, 59, 53, 80, 25, 35, 30, 37, 40, 33, 48, 77, 71, 66, 77, 77, 71, 33, 41, 42], "", "", "img/isaiah-thomas.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/202738.png"],
    ["Stephon Marbury", "斯蒂芬·马布里", "PG", "SF", 188, 82, "纽约尼克斯", "#f58426", "#006bb6", "gold", "scorer", 85, [81, 74, 76, 76, 71, 74, 66, 71, 69, 64, 53, 57, 50, 72, 25, 33, 28, 53, 56, 49, 42, 78, 75, 62, 75, 75, 67, 30, 38, 39], "", "", "img/stephon-marbury.webp", 0, ""],
    ["John Wall", "约翰·沃尔", "PG", "SF", 193, 89, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "spark", 85, [70, 76, 65, 78, 76, 79, 64, 69, 68, 67, 58, 60, 55, 79, 25, 34, 29, 31, 34, 27, 48, 78, 73, 64, 80, 80, 68, 37, 45, 46], "", "", "img/john-wall.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/202322.png"],
    ["Shareef Abdur-Rahim", "谢里夫·阿布杜·拉希姆", "PF", "SF", 202, 102, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "skilled_big", 85, [76, 66, 70, 72, 79, 81, 74, 79, 69, 52, 56, 45, 67, 49, 64, 72, 68, 80, 83, 77, 78, 63, 65, 81, 52, 49, 60, 74, 81, 82], "", "", "img/shareef-abdur-rahim.webp", 0, ""],
    ["Patty Mills", "帕蒂·米尔斯", "PG", "SG", 183, 84, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "floor_gen", 85, [76, 73, 70, 79, 67, 69, 25, 30, 53, 64, 59, 57, 48, 71, 25, 25, 25, 29, 32, 25, 35, 78, 76, 85, 67, 67, 41, 25, 33, 34], "", "", "img/patty-mills.webp", 0, ""],
    ["Evan Fournier", "埃文·福尼尔", "SG", "SF", 198, 93, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "sniper", 85, [79, 89, 74, 84, 64, 67, 40, 46, 52, 68, 53, 61, 52, 74, 25, 33, 28, 34, 37, 30, 40, 72, 87, 63, 72, 69, 47, 30, 38, 39], "", "", "img/evan-fournier.webp", 0, ""],
    ["Aaron Gordon", "阿隆·戈登", "SF", "SG", 206, 100, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "three_d", 83, [73, 86, 67, 81, 68, 71, 58, 64, 49, 89, 73, 83, 76, 76, 39, 59, 54, 35, 38, 31, 61, 68, 86, 62, 76, 73, 69, 55, 63, 64], "", "", "img/aaron-gordon.webp", 0, ""],
    ["Lauri Markkanen", "劳里·马尔卡宁", "PF", "SF", 213, 104, "芝加哥公牛", "#ce1141", "#1a1a1a", "purple", "skilled_big", 91, [77, 76, 72, 77, 82, 85, 76, 82, 75, 53, 58, 46, 70, 54, 65, 78, 74, 82, 85, 78, 78, 64, 73, 85, 59, 56, 65, 80, 87, 88], "", "", "img/lauri-markkanen.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628374.png"],
    ["Pascal Siakam", "帕斯卡·席亚康", "PF", "C", 208, 103, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "freak_forward", 88, [58, 37, 52, 56, 80, 83, 75, 81, 81, 73, 63, 67, 77, 79, 74, 83, 78, 69, 72, 65, 81, 71, 51, 70, 66, 66, 80, 75, 83, 84], "", "", "img/pascal-siakam.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627783.png"],
    ["Jason Richardson", "贾森·理查德森", "SG", "PG", 198, 102, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "slasher", 85, [69, 64, 64, 72, 84, 87, 80, 86, 73, 67, 56, 60, 57, 82, 34, 39, 34, 46, 49, 42, 61, 79, 64, 63, 82, 82, 84, 40, 48, 49], "", "", "img/jason-richardson.webp", 0, ""],
    ["Chris Kaman", "克里斯·卡曼", "C", "PF", 213, 120, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "big_man", 85, [39, 30, 33, 57, 74, 77, 79, 85, 68, 45, 41, 38, 68, 55, 79, 79, 75, 67, 69, 63, 84, 31, 50, 48, 54, 51, 76, 83, 90, 91], "", "", "img/chris-kaman.webp", 0, ""],
    ["Sergio Rodríguez", "塞尔吉奥·罗德里格斯", "PG", "SF", 192, 76, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "scorer", 84, [82, 71, 77, 75, 71, 74, 61, 67, 70, 67, 54, 60, 52, 74, 25, 30, 25, 51, 54, 47, 44, 79, 74, 59, 76, 76, 66, 31, 39, 40], "", "", "img/sergio-rodriguez.webp", 0, ""],
    ["Jan Veselý", "扬·韦塞利", "PF", "SF", 213, 110, "华盛顿奇才", "#e31837", "#002b5c", "gold", "skilled_big", 85, [71, 62, 66, 77, 80, 83, 75, 80, 74, 50, 52, 43, 66, 50, 65, 71, 67, 79, 81, 75, 73, 64, 66, 80, 51, 48, 62, 75, 82, 83], "", "", "img/jan-vesely.webp", 0, ""],
    ["Kemba Walker", "肯巴·沃克", "PG", "SF", 185, 84, "夏洛特黄蜂", "#1d1160", "#00788c", "gold", "scorer", 84, [82, 73, 77, 74, 74, 77, 61, 67, 68, 68, 56, 61, 53, 71, 25, 29, 25, 55, 58, 51, 43, 72, 75, 63, 76, 73, 66, 32, 40, 41], "", "", "img/kemba-walker.webp", 0, ""],
    ["Eric Gordon", "埃里克·戈登", "SG", "PG", 191, 101, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "slasher", 84, [70, 63, 65, 70, 79, 82, 82, 88, 75, 66, 53, 59, 56, 85, 29, 35, 30, 48, 51, 44, 59, 79, 65, 59, 81, 81, 84, 40, 48, 49], "", "", "img/eric-gordon.webp", 0, ""],
    ["David Andersen", "大卫·安德森", "PF", "SF", 211, 113, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "two_way", 85, [73, 73, 68, 69, 73, 76, 68, 74, 65, 88, 73, 81, 79, 77, 50, 64, 59, 54, 57, 50, 63, 66, 70, 63, 73, 70, 73, 63, 70, 71], "", "", "img/david-andersen.webp", 0, ""],
    ["Gheorghe Mureșan", "乔治·穆雷桑", "C", "PF", 231, 138, "华盛顿奇才", "#e31837", "#002b5c", "gold", "big_man", 84, [40, 29, 34, 56, 75, 78, 81, 87, 68, 44, 42, 37, 65, 49, 76, 82, 78, 67, 69, 63, 84, 31, 43, 43, 54, 51, 76, 78, 85, 86], "", "", "img/gheorghe-muresan.webp", 0, ""],
    ["Brook Lopez", "布鲁克·洛佩斯", "C", "PF", 213, 118, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "gold", "anchor", 84, [41, 34, 35, 53, 64, 67, 71, 77, 62, 41, 43, 34, 66, 45, 89, 89, 84, 62, 65, 58, 83, 37, 45, 51, 49, 46, 68, 82, 90, 90], "", "", "img/brook-lopez.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201572.png"],
    ["Rudy Gay", "鲁迪·盖伊", "SF", "C", 203, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "freak_forward", 84, [49, 31, 43, 54, 77, 79, 78, 83, 74, 73, 58, 67, 76, 76, 70, 76, 71, 69, 72, 66, 79, 73, 49, 64, 75, 72, 82, 72, 79, 80], "", "", "img/rudy-gay.webp", 0, ""],
    ["Harrison Barnes", "哈里森·巴恩斯", "SF", "SG", 203, 95, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "three_d", 84, [72, 85, 67, 82, 66, 68, 60, 66, 50, 94, 77, 88, 79, 76, 44, 54, 49, 37, 40, 33, 65, 69, 86, 59, 79, 76, 67, 59, 67, 68], "", "", "img/harrison-barnes.webp", 0, ""],
    ["Joe Dumars", "乔·杜马斯", "SG", "PG", 190, 86, "底特律活塞", "#c8102e", "#1d42ba", "gold", "slasher", 84, [66, 65, 60, 68, 81, 84, 80, 86, 70, 70, 53, 64, 55, 85, 33, 37, 32, 41, 44, 37, 61, 80, 62, 58, 81, 81, 81, 32, 40, 41], "", "", "img/joe-dumars.webp", 0, ""],
    ["Carlos Delfino", "卡洛斯·德尔菲诺", "SG", "PG", 198, 104, "密尔沃基雄鹿", "#eee1c6", "#00471b", "gold", "slasher", 84, [65, 63, 59, 70, 80, 83, 80, 86, 71, 64, 53, 57, 53, 81, 31, 40, 35, 47, 50, 43, 56, 79, 64, 64, 83, 83, 83, 36, 44, 45], "", "", "img/carlos-delfino.webp", 0, ""],
    ["Nikola Vučević", "尼古拉·武切维奇", "C", "PF", 213, 118, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "anchor", 84, [38, 30, 32, 53, 67, 69, 72, 78, 64, 42, 43, 35, 66, 42, 87, 87, 82, 66, 68, 62, 85, 36, 45, 47, 50, 47, 66, 82, 90, 90], "", "", "img/nikola-vucevic.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202696.png"],
    ["Willy Hernangómez", "吉列尔莫·埃尔南戈麦斯", "PF", "SF", 208, 113, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "big_man", 83, [48, 34, 42, 68, 83, 86, 86, 91, 75, 51, 49, 44, 71, 61, 85, 87, 82, 71, 74, 68, 89, 41, 56, 54, 68, 65, 83, 84, 91, 92], "", "", "img/willy-hernangomez.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627823.png"],
    ["Dario Šarić", "达里奥·萨利奇", "PF", "SF", 206, 104, "费城76人", "#ed174c", "#006bb6", "gold", "big_man", 83, [44, 38, 38, 67, 86, 89, 85, 90, 76, 52, 49, 45, 71, 64, 88, 87, 82, 68, 71, 65, 89, 41, 56, 56, 64, 61, 82, 84, 91, 92], "", "", "img/dario-saric.webp", 0, ""],
    ["Alex Len", "亚历克斯·莱恩", "C", "PF", 213, 113, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "anchor", 85, [41, 37, 35, 56, 64, 67, 71, 77, 65, 46, 46, 39, 68, 48, 88, 88, 83, 67, 69, 63, 87, 37, 45, 53, 49, 46, 67, 81, 89, 90], "", "", "img/alex-len.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/203458.png"],
    ["Steven Adams", "史蒂文·亚当斯", "C", "PF", 211, 113, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "skilled_big", 83, [70, 56, 65, 66, 75, 78, 68, 74, 65, 43, 46, 36, 59, 42, 55, 68, 64, 77, 79, 73, 71, 52, 63, 74, 48, 45, 59, 68, 76, 77], "", "", "img/steven-adams.webp", 0, ""],
    ["Ben Simmons", "宾·施蒙斯", "SF", "PF", 202, 104, "费城76人", "#ed174c", "#006bb6", "silver", "point_forward", 82, [73, 73, 67, 66, 74, 77, 56, 62, 70, 61, 61, 54, 66, 63, 28, 48, 43, 70, 73, 67, 67, 78, 70, 81, 60, 60, 55, 64, 71, 72], "", "", "img/ben-simmons.webp", 0, ""],
    ["Rui Hachimura", "八村垒", "SF", "PG", 204, 106, "洛杉矶湖人", "#fdb927", "#552583", "gold", "slasher", 83, [70, 68, 65, 70, 82, 85, 79, 84, 74, 70, 56, 64, 59, 88, 36, 37, 32, 49, 52, 45, 60, 79, 66, 66, 86, 86, 87, 40, 48, 49], "", "", "img/rui-hachimura.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629060.png"],
    ["Trae Young", "特雷·杨", "PG", "SG", 190, 74, "亚特兰大老鹰", "#e03a3e", "#26282a", "purple", "floor_gen", 91, [82, 77, 76, 79, 75, 78, 38, 44, 63, 47, 68, 40, 44, 80, 25, 34, 29, 41, 44, 37, 42, 85, 84, 90, 76, 76, 50, 35, 43, 44], "", "", "img/trae-young.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629027.png"],
    ["Zion Williamson", "蔡恩·威廉森", "PF", "C", 198, 129, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "freak_forward", 88, [57, 25, 51, 57, 77, 80, 78, 84, 82, 70, 62, 63, 77, 77, 79, 81, 76, 73, 76, 70, 81, 72, 49, 69, 79, 79, 78, 78, 85, 86], "", "", "img/zion-williamson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629627.png"],
    ["Shawn Bradley", "肖恩·布拉德利", "C", "PF", 229, 125, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "skilled_big", 82, [71, 57, 66, 71, 72, 75, 67, 72, 63, 46, 47, 39, 61, 47, 55, 64, 59, 78, 80, 74, 70, 52, 58, 70, 44, 41, 59, 68, 76, 77], "", "", "img/shawn-bradley.webp", 0, ""],
    ["Tim Hardaway", "蒂姆·哈达威", "PG", "SG", 183, 79, "迈阿密热火", "#f9a01b", "#98002e", "silver", "floor_gen", 82, [71, 70, 66, 74, 63, 66, 25, 26, 50, 61, 54, 54, 46, 66, 25, 25, 25, 30, 33, 26, 33, 78, 73, 81, 68, 68, 35, 25, 33, 34], "", "", "img/tim-hardaway.webp", 0, ""],
    ["Jeff Green", "杰夫·格林", "SF", "C", 206, 103, "洛杉矶快船", "#c8102e", "#1d428a", "silver", "freak_forward", 82, [50, 28, 44, 55, 78, 80, 78, 84, 73, 69, 52, 63, 73, 71, 75, 73, 68, 65, 67, 61, 77, 70, 45, 66, 70, 67, 81, 70, 78, 78], "", "", "img/jeff-green.webp", 0, ""],
    ["Earl Boykins", "厄尔·博伊金斯", "PG", "SG", 165, 60, "丹佛掘金", "#fec524", "#0e2240", "silver", "scorer", 82, [76, 73, 70, 73, 67, 70, 63, 68, 65, 66, 55, 59, 50, 72, 25, 29, 25, 48, 51, 44, 43, 71, 71, 62, 69, 67, 65, 28, 36, 37], "", "", "img/earl-boykins.webp", 0, ""],
    ["Danny Green", "丹尼·格林", "SG", "PG", 198, 98, "洛杉矶湖人", "#fdb927", "#552583", "silver", "scorer", 82, [78, 71, 73, 75, 71, 74, 57, 63, 66, 66, 51, 59, 50, 69, 25, 32, 27, 51, 54, 47, 42, 72, 73, 60, 69, 67, 64, 27, 35, 36], "", "", "img/danny-green.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201980.png"],
    ["Andrew Bynum", "安德鲁·拜纳姆", "C", "PF", 213, 130, "洛杉矶湖人", "#fdb927", "#552583", "silver", "big_man", 82, [38, 25, 32, 58, 73, 76, 77, 82, 68, 40, 39, 33, 63, 52, 73, 78, 73, 60, 63, 56, 86, 29, 44, 46, 51, 48, 75, 78, 86, 87], "", "", "img/andrew-bynum.webp", 0, ""],
    ["JJ Redick", "J·J·雷迪克", "SG", "PG", 193, 86, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "scorer", 84, [78, 75, 72, 74, 69, 72, 63, 69, 72, 67, 57, 60, 52, 76, 25, 32, 27, 51, 54, 47, 43, 78, 70, 60, 76, 76, 64, 31, 39, 40], "", "", "img/jj-redick.webp", 0, ""],
    ["Jameer Nelson", "杰米尔·尼尔森", "PG", "SG", 183, 86, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "three_d", 81, [65, 75, 59, 76, 59, 62, 48, 54, 45, 87, 71, 81, 72, 74, 39, 53, 48, 26, 29, 25, 56, 58, 79, 56, 73, 71, 62, 50, 58, 59], "", "", "img/jameer-nelson.webp", 0, ""],
    ["Danny Granger", "丹尼·格兰杰", "SF", "C", 203, 100, "印第安纳步行者", "#fdbb30", "#002d62", "silver", "freak_forward", 81, [50, 30, 44, 51, 77, 80, 77, 82, 73, 71, 53, 64, 73, 72, 71, 73, 69, 66, 69, 62, 78, 66, 44, 61, 73, 71, 80, 70, 77, 78], "", "", "img/danny-granger.webp", 0, ""],
    ["Richard Jefferson", "理查德·谢佛逊", "SF", "SG", 201, 101, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "three_d", 81, [72, 82, 67, 77, 67, 70, 53, 59, 50, 88, 71, 82, 74, 76, 43, 53, 48, 31, 34, 27, 62, 65, 87, 57, 75, 72, 66, 53, 61, 62], "", "", "img/richard-jefferson.webp", 0, ""],
    ["Kyle Korver", "凯尔·科沃尔", "SG", "SF", 201, 96, "费城76人", "#ed174c", "#006bb6", "silver", "point_forward", 80, [66, 64, 60, 66, 71, 73, 50, 56, 69, 59, 56, 52, 62, 56, 25, 46, 41, 66, 69, 62, 67, 77, 65, 73, 60, 57, 45, 58, 66, 67], "", "", "img/kyle-korver.webp", 0, ""],
    ["Al Horford", "艾尔·霍弗德", "PF", "SF", 208, 111, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "big_man", 81, [45, 32, 39, 60, 82, 85, 85, 91, 72, 49, 45, 42, 71, 59, 81, 88, 83, 66, 69, 62, 90, 36, 50, 52, 59, 56, 84, 87, 94, 95], "", "", "img/al-horford.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201143.png"],
    ["Bradley Beal", "布莱德利·比尔", "SG", "PG", 190, 94, "华盛顿奇才", "#e31837", "#002b5c", "silver", "spark", 80, [70, 71, 64, 71, 71, 73, 57, 63, 60, 60, 52, 53, 49, 73, 25, 31, 26, 26, 29, 25, 42, 70, 72, 56, 76, 73, 64, 31, 39, 40], "", "", "img/bradley-beal.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203078.png"],
    ["Gordon Hayward", "戈登·海沃德", "SG", "SF", 199, 96, "犹他爵士", "#f9a01b", "#002b5c", "silver", "three_d", 80, [66, 76, 60, 74, 62, 65, 50, 56, 43, 84, 69, 78, 71, 71, 35, 53, 48, 28, 31, 25, 60, 57, 81, 55, 71, 69, 59, 50, 58, 59], "", "", "img/gordon-hayward.webp", 0, ""],
    ["Tomáš Satoranský", "托马什·萨托兰斯基", "SG", "SF", 201, 95, "华盛顿奇才", "#e31837", "#002b5c", "silver", "point_forward", 80, [65, 65, 59, 61, 71, 74, 52, 58, 67, 54, 55, 47, 57, 61, 25, 41, 36, 65, 68, 61, 61, 76, 64, 73, 53, 50, 49, 53, 61, 62], "", "", "img/tomas-satoransky.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629001.png"],
    ["Anthony Bennett", "安东尼·贝内特", "PF", "SF", 203, 111, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "big_man", 81, [43, 34, 37, 65, 81, 83, 83, 89, 76, 52, 43, 45, 71, 58, 83, 89, 84, 70, 72, 66, 87, 36, 50, 48, 64, 61, 82, 84, 92, 93], "", "", "img/anthony-bennett.webp", 0, ""],
    ["Marcus Smart", "马库斯·斯马特", "PG", "SG", 193, 100, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "floor_gen", 80, [67, 67, 61, 75, 61, 64, 25, 26, 47, 58, 55, 51, 43, 69, 25, 25, 25, 25, 27, 25, 32, 76, 67, 81, 67, 64, 35, 25, 29, 30], "", "", "img/marcus-smart.webp", 0, ""],
    ["D'Angelo Russell", "德安杰洛·罗素", "PG", "SF", 191, 88, "洛杉矶湖人", "#fdb927", "#552583", "silver", "spark", 80, [66, 69, 60, 74, 72, 75, 57, 63, 60, 64, 53, 57, 51, 74, 25, 27, 25, 28, 31, 25, 44, 71, 71, 63, 73, 71, 65, 31, 39, 40], "", "", "img/d-angelo-russell.webp", 0, ""],
    ["Brandon Ingram", "班顿·恩格林", "SF", "C", 211, 88, "多伦多猛龙", "#ce1141", "#1a1a1a", "silver", "freak_forward", 80, [49, 25, 43, 49, 77, 80, 77, 82, 71, 69, 53, 62, 71, 71, 71, 73, 69, 66, 69, 62, 78, 63, 43, 61, 73, 71, 78, 69, 76, 77], "", "", "img/brandon-ingram.webp", 0, ""],
    ["LaMelo Ball", "拉梅洛·鲍尔", "PG", "SG", 188, 73, "夏洛特黄蜂", "#1d1160", "#00788c", "gold", "floor_gen", 88, [79, 72, 73, 83, 75, 78, 32, 38, 56, 65, 66, 59, 53, 75, 25, 30, 25, 34, 37, 30, 39, 75, 79, 78, 72, 72, 48, 34, 42, 43], "", "", "img/lamelo-ball.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630163.png"],
    ["Derrick White", "德里克·怀特", "PG", "SF", 196, 91, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "scorer", 83, [80, 71, 75, 73, 73, 76, 62, 68, 66, 63, 54, 56, 50, 74, 25, 31, 26, 53, 56, 49, 43, 72, 71, 60, 70, 68, 68, 30, 38, 39], "", "", "img/derrick-white.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628401.png"],
    ["Tornike Shengelia", "Tornike Shengelia", "SF", "PF", 206, 109, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "two_way", 80, [66, 65, 60, 66, 64, 67, 61, 67, 56, 85, 71, 79, 75, 70, 51, 58, 53, 52, 55, 48, 62, 67, 69, 59, 71, 69, 65, 59, 67, 68], "", "", "img/tornike-shengelia.webp", 0, ""],
    ["Michael Beasley", "迈克尔·比斯利", "SF", "C", 208, 107, "孟菲斯灰熊", "#5d76a9", "#12173f", "silver", "freak_forward", 80, [48, 25, 42, 47, 75, 78, 74, 80, 73, 69, 48, 62, 71, 74, 70, 74, 70, 64, 67, 60, 77, 67, 46, 62, 70, 67, 74, 66, 73, 74], "", "", "img/michael-beasley.webp", 0, ""],
    ["Jason Terry", "贾森·特里", "PG", "SF", 188, 82, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "spark", 80, [67, 69, 61, 72, 70, 72, 60, 66, 63, 61, 55, 54, 47, 76, 25, 27, 25, 31, 34, 27, 41, 73, 71, 62, 72, 70, 67, 27, 35, 36], "", "", "img/jason-terry.webp", 0, ""],
    ["Rashard Lewis", "拉沙德·路易斯", "SF", "PF", 208, 104, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "two_way", 79, [69, 63, 63, 70, 69, 71, 61, 67, 56, 81, 71, 74, 71, 68, 46, 54, 49, 50, 53, 46, 61, 64, 69, 55, 69, 66, 62, 56, 64, 65], "", "", "img/rashard-lewis.webp", 0, ""],
    ["Trevor Ariza", "特雷沃·阿里扎", "SF", "PF", 203, 95, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "two_way", 80, [69, 67, 63, 66, 70, 72, 60, 66, 56, 83, 67, 77, 74, 69, 47, 59, 54, 52, 55, 48, 63, 62, 66, 57, 72, 70, 65, 58, 66, 67], "", "", "img/trevor-ariza.webp", 0, ""],
    ["Jamal Crawford", "贾马尔·克劳福德", "PG", "SG", 196, 90, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "three_d", 80, [65, 79, 59, 72, 60, 63, 50, 56, 48, 85, 70, 79, 71, 71, 35, 45, 40, 26, 29, 25, 59, 57, 81, 52, 68, 65, 62, 51, 59, 60], "", "", "img/jamal-crawford.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/2037.png"],
    ["Robert Horry", "罗伯特·霍里", "PF", "SF", 208, 100, "洛杉矶湖人", "#fdb927", "#552583", "silver", "two_way", 81, [67, 78, 61, 66, 64, 67, 63, 68, 59, 82, 70, 76, 73, 72, 70, 58, 53, 50, 53, 46, 59, 63, 65, 60, 72, 69, 67, 57, 65, 66], "", "", "img/robert-horry.webp", 0, ""],
    ["Nando de Colo", "南多·德科洛", "PG", "SG", 196, 85, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "silver", "three_d", 79, [64, 79, 58, 73, 61, 64, 49, 55, 45, 85, 70, 79, 70, 71, 34, 50, 45, 28, 31, 25, 56, 55, 79, 50, 67, 64, 57, 46, 54, 55], "", "", "img/nando-de-colo.webp", 0, ""],
    ["Viktor Khryapa", "维克特·卡亚帕", "SF", "C", 206, 95, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "freak_forward", 79, [47, 27, 41, 49, 78, 81, 76, 82, 73, 63, 54, 56, 68, 71, 69, 70, 65, 67, 70, 63, 77, 65, 42, 60, 71, 69, 80, 66, 73, 74], "", "", "img/viktor-khryapa.webp", 0, ""],
    ["Mario Chalmers", "马里奥·查尔默斯", "PG", "SG", 185, 88, "迈阿密热火", "#f9a01b", "#98002e", "silver", "floor_gen", 81, [69, 72, 63, 72, 63, 66, 25, 27, 45, 62, 58, 55, 46, 68, 25, 25, 25, 25, 28, 25, 27, 74, 72, 82, 67, 64, 35, 25, 32, 33], "", "", "img/mario-chalmers.webp", 0, ""],
    ["Ben Gordon", "本·戈登", "SG", "SF", 191, 91, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "three_d", 79, [65, 77, 59, 71, 57, 60, 49, 55, 45, 81, 66, 74, 67, 72, 34, 49, 44, 25, 25, 25, 56, 57, 77, 54, 69, 66, 62, 46, 54, 55], "", "", "img/ben-gordon.webp", 0, ""],
    ["Antonio McDyess", "安东尼奥·麦克戴斯", "PF", "SF", 206, 100, "纽约尼克斯", "#f58426", "#006bb6", "silver", "big_man", 79, [43, 33, 37, 64, 77, 80, 83, 89, 74, 49, 44, 42, 70, 56, 81, 85, 81, 66, 69, 62, 89, 36, 54, 51, 56, 53, 81, 83, 91, 92], "", "", "img/antonio-mcdyess.webp", 0, ""],
    ["Darius Songaila", "达瑞斯·桑贾拉", "PF", "SF", 206, 113, "新奥尔良鹈鹕", "#e31837", "#0c2340", "silver", "big_man", 79, [46, 30, 40, 62, 80, 82, 82, 88, 73, 45, 42, 38, 67, 58, 82, 84, 80, 71, 73, 67, 87, 36, 51, 47, 57, 54, 82, 82, 89, 90], "", "", "img/darius-songaila.webp", 0, ""],
    ["Shane Battier", "肖恩·巴蒂尔", "SG", "SF", 203, 100, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "point_forward", 79, [68, 63, 62, 61, 71, 74, 51, 57, 68, 52, 49, 45, 58, 54, 25, 45, 40, 62, 65, 58, 63, 76, 65, 74, 52, 49, 43, 57, 65, 66], "", "", "img/shane-battier.webp", 0, ""],
    ["Josh Smith", "约什·史密斯", "PF", "SF", 206, 107, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "big_man", 84, [45, 34, 39, 69, 83, 86, 87, 92, 77, 53, 51, 46, 72, 61, 89, 90, 85, 74, 77, 70, 90, 43, 60, 58, 64, 61, 82, 85, 92, 93], "", "", "img/josh-smith.webp", 0, ""],
    ["Christian Laettner", "克里斯汀·莱特纳", "PF", "SF", 211, 110, "迈阿密热火", "#f9a01b", "#98002e", "silver", "two_way", 79, [69, 70, 63, 71, 65, 68, 63, 69, 61, 82, 71, 75, 73, 67, 45, 55, 50, 48, 51, 44, 59, 61, 69, 58, 66, 63, 66, 58, 66, 67], "", "", "img/christian-laettner.webp", 0, ""],
    ["Joe Ingles", "乔·英格尔斯", "SG", "SF", 203, 98, "犹他爵士", "#f9a01b", "#002b5c", "silver", "point_forward", 79, [70, 67, 64, 67, 66, 69, 47, 53, 65, 53, 54, 46, 56, 61, 25, 44, 39, 63, 66, 59, 61, 72, 66, 75, 53, 50, 46, 53, 61, 62], "", "", "img/joe-ingles.webp", 0, ""],
    ["Boban Marjanović", "博班·马扬诺维奇", "C", "PF", 222, 132, "达拉斯独行侠", "#00538c", "#002b5e", "silver", "anchor", 79, [31, 27, 25, 50, 62, 65, 66, 71, 57, 36, 40, 29, 61, 37, 81, 81, 76, 61, 64, 57, 76, 32, 42, 46, 40, 37, 61, 78, 85, 86], "", "", "img/boban-marjanovic.webp", 0, ""],
    ["Mario Hezonja", "马里奥·赫祖加", "SG", "SF", 202, 91, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "point_forward", 79, [66, 63, 60, 61, 69, 71, 50, 56, 65, 52, 50, 45, 55, 61, 25, 43, 38, 63, 66, 59, 64, 74, 63, 76, 58, 55, 49, 51, 59, 60], "", "", "img/mario-hezonja.webp", 0, ""],
    ["Matthew Dellavedova", "马修·德拉维多瓦", "PG", "SG", 193, 94, "密尔沃基雄鹿", "#eee1c6", "#00471b", "silver", "floor_gen", 80, [70, 68, 64, 73, 61, 64, 25, 25, 44, 54, 55, 47, 43, 70, 25, 25, 25, 28, 31, 25, 30, 79, 72, 80, 64, 61, 37, 25, 33, 34], "", "", "img/matthew-dellavedova.webp", 0, ""],
    ["Kelly Olynyk", "凯利·奥利尼克", "PF", "SF", 213, 108, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "two_way", 80, [68, 72, 62, 67, 65, 68, 67, 72, 58, 81, 69, 74, 72, 72, 46, 55, 50, 49, 52, 45, 58, 64, 71, 64, 69, 66, 68, 55, 63, 64], "", "", "img/kelly-olynyk.webp", 0, ""],
    ["Dante Exum", "丹特·艾克森", "PG", "SG", 198, 86, "犹他爵士", "#f9a01b", "#002b5c", "silver", "floor_gen", 80, [67, 71, 61, 72, 63, 66, 25, 31, 45, 55, 58, 48, 42, 67, 25, 25, 25, 25, 26, 25, 25, 73, 72, 80, 64, 61, 34, 25, 30, 31], "", "", "img/dante-exum.webp", 0, ""],
    ["Julius Randle", "朱利叶斯·兰德尔", "PF", "SF", 206, 113, "洛杉矶湖人", "#fdb927", "#552583", "silver", "big_man", 80, [45, 30, 39, 60, 78, 81, 84, 90, 73, 49, 47, 42, 70, 60, 81, 87, 83, 68, 71, 64, 92, 37, 52, 52, 58, 55, 79, 83, 91, 92], "", "", "img/julius-randle.webp", 0, ""],
    ["Franz Wagner", "弗朗兹·瓦格纳", "SF", "PG", 203, 80, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "scorer", 88, [83, 80, 77, 83, 71, 73, 73, 79, 79, 74, 62, 68, 61, 83, 30, 46, 41, 63, 66, 60, 57, 83, 83, 72, 83, 83, 75, 40, 48, 49], "", "", "img/franz-wagner.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630532.png"],
    ["Tony Allen", "托尼·阿伦", "SG", "PG", 193, 97, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "spark", 81, [68, 73, 62, 71, 72, 74, 57, 63, 63, 65, 55, 58, 51, 77, 25, 31, 26, 33, 36, 29, 46, 72, 71, 62, 73, 71, 69, 30, 38, 39], "", "", "img/tony-allen.webp", 0, ""],
    ["Nikola Peković", "尼古拉·佩科维奇", "C", "PF", 211, 132, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "big_man", 81, [35, 25, 29, 53, 73, 76, 75, 81, 63, 43, 36, 36, 65, 50, 78, 77, 73, 60, 63, 56, 80, 28, 44, 40, 53, 50, 72, 79, 86, 87], "", "", "img/nikola-pekovic.webp", 0, ""],
    ["Mark Eaton", "马克·伊顿", "C", "PF", 224, 125, "犹他爵士", "#f9a01b", "#002b5c", "silver", "anchor", 78, [30, 28, 25, 46, 61, 64, 68, 73, 59, 34, 34, 27, 60, 41, 82, 83, 79, 55, 58, 51, 78, 31, 38, 43, 39, 36, 62, 78, 85, 86], "", "", "img/mark-eaton.webp", 0, ""],
    ["Jordan Farmar", "乔丹·法玛尔", "PG", "SG", 188, 81, "洛杉矶湖人", "#fdb927", "#552583", "silver", "three_d", 78, [64, 75, 58, 71, 56, 59, 50, 56, 44, 82, 67, 76, 69, 68, 32, 48, 43, 25, 26, 25, 56, 57, 79, 52, 70, 67, 62, 47, 55, 56], "", "", "img/jordan-farmar.webp", 0, ""],
    ["Andrés Nocioni", "安迪斯·诺西奥尼", "SF", "C", 203, 102, "芝加哥公牛", "#ce1141", "#1a1a1a", "silver", "freak_forward", 78, [47, 26, 41, 45, 73, 76, 77, 82, 71, 64, 52, 57, 69, 67, 67, 74, 70, 64, 67, 60, 73, 63, 40, 57, 66, 63, 78, 67, 74, 75], "", "", "img/andres-nocioni.webp", 0, ""],
    ["Jonas Jerebko", "约纳斯·杰雷布科", "SF", "PF", 206, 105, "犹他爵士", "#f9a01b", "#002b5c", "silver", "two_way", 78, [63, 66, 57, 64, 62, 65, 64, 70, 55, 82, 71, 75, 71, 69, 47, 59, 54, 45, 48, 41, 55, 63, 64, 57, 67, 64, 67, 53, 61, 62], "", "", "img/jonas-jerebko.webp", 0, ""],
    ["Kirk Hinrich", "柯克·辛里奇", "PG", "SG", 193, 86, "芝加哥公牛", "#ce1141", "#1a1a1a", "silver", "three_d", 78, [64, 76, 58, 72, 60, 63, 47, 53, 40, 84, 66, 78, 68, 65, 33, 49, 44, 25, 25, 25, 53, 55, 79, 54, 68, 65, 61, 44, 52, 53], "", "", "img/kirk-hinrich.webp", 0, ""],
    ["Brandon Jennings", "布兰登·詹宁斯", "PG", "SF", 185, 77, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "spark", 78, [69, 69, 63, 72, 70, 72, 59, 65, 58, 61, 54, 54, 47, 72, 25, 30, 25, 30, 33, 26, 41, 73, 68, 54, 70, 67, 61, 27, 35, 36], "", "", "img/brandon-jennings.webp", 0, ""],
    ["Fabricio Oberto", "法夫里西奥·奥韦尔托", "PF", "SG", 208, 111, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "silver", "three_d", 78, [71, 82, 66, 72, 64, 67, 50, 56, 45, 87, 69, 81, 71, 71, 38, 53, 48, 25, 27, 25, 62, 57, 81, 57, 73, 71, 61, 47, 55, 56], "", "", "img/fabricio-oberto.webp", 0, ""],
    ["Anderson Varejão", "安德森·瓦雷让", "PF", "SF", 211, 126, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "two_way", 78, [66, 68, 60, 66, 65, 68, 60, 66, 54, 79, 69, 72, 71, 66, 49, 55, 50, 47, 50, 43, 61, 60, 69, 61, 70, 67, 61, 56, 64, 65], "", "", "img/anderson-varejao.webp", 0, ""],
    ["Caron Butler", "卡隆·巴特勒", "SG", "SF", 200, 100, "华盛顿奇才", "#e31837", "#002b5c", "silver", "point_forward", 78, [69, 66, 63, 64, 65, 68, 51, 57, 67, 56, 50, 49, 59, 57, 25, 38, 33, 62, 65, 58, 63, 71, 65, 71, 52, 49, 43, 55, 63, 64], "", "", "img/caron-butler.webp", 0, ""],
    ["J. J. Barea", "何塞·胡安·巴雷亚", "PG", "SG", 183, 84, "达拉斯独行侠", "#00538c", "#002b5e", "silver", "floor_gen", 77, [66, 66, 60, 72, 61, 64, 25, 25, 43, 56, 49, 49, 41, 67, 25, 25, 25, 25, 25, 25, 25, 75, 70, 78, 60, 57, 31, 25, 27, 28], "", "", "img/j-j-barea.webp", 0, ""],
    ["Pero Antić", "佩罗·安蒂奇", "PF", "SG", 210, 118, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "three_d", 78, [67, 78, 61, 73, 65, 68, 54, 60, 44, 88, 68, 82, 71, 74, 34, 52, 47, 27, 30, 25, 58, 63, 81, 54, 72, 70, 64, 48, 56, 57], "", "", "img/pero-antic.webp", 0, ""],
    ["Kwame Brown", "夸梅·布朗", "PF", "SF", 211, 123, "洛杉矶湖人", "#fdb927", "#552583", "silver", "two_way", 79, [64, 68, 58, 69, 69, 72, 59, 65, 60, 80, 71, 73, 72, 67, 44, 57, 52, 47, 50, 43, 59, 63, 66, 58, 69, 66, 65, 56, 64, 65], "", "", "img/kwame-brown.webp", 0, ""],
    ["Andris Biedriņš", "安德里斯·比耶德林斯", "C", "PF", 211, 111, "金州勇士", "#ffc72c", "#1d428a", "silver", "big_man", 77, [30, 25, 25, 52, 68, 71, 76, 82, 59, 37, 32, 30, 58, 44, 71, 72, 68, 57, 60, 53, 75, 28, 41, 35, 50, 47, 72, 72, 80, 81], "", "", "img/andris-biedrins.webp", 0, ""],
    ["Jason Kapono", "杰森·卡波诺", "SF", "PF", 203, 97, "迈阿密热火", "#f9a01b", "#98002e", "silver", "two_way", 77, [68, 65, 62, 61, 62, 65, 61, 67, 53, 80, 68, 73, 71, 65, 45, 53, 48, 48, 51, 44, 56, 61, 67, 58, 70, 67, 61, 57, 65, 66], "", "", "img/jason-kapono.webp", 0, ""],
    ["Mike Miller", "迈克·米勒", "SG", "SF", 203, 99, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "point_forward", 77, [64, 60, 58, 63, 65, 68, 48, 54, 66, 55, 53, 48, 57, 55, 25, 38, 33, 59, 62, 55, 63, 73, 62, 76, 52, 49, 43, 53, 61, 62], "", "", "img/mike-miller.webp", 0, ""],
    ["Glen Davis", "格伦·戴维斯", "PF", "SF", 206, 131, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "two_way", 79, [69, 68, 63, 65, 69, 72, 64, 70, 56, 79, 68, 72, 69, 70, 43, 59, 54, 49, 52, 45, 60, 60, 67, 60, 69, 66, 64, 52, 60, 61], "", "", "img/glen-davis.webp", 0, ""],
    ["Taj Gibson", "泰·吉布森", "PF", "SG", 206, 102, "芝加哥公牛", "#ce1141", "#1a1a1a", "silver", "three_d", 80, [73, 82, 67, 78, 65, 68, 53, 59, 48, 85, 70, 79, 73, 77, 42, 50, 45, 33, 36, 29, 58, 61, 85, 56, 76, 73, 67, 54, 62, 63], "", "", "img/taj-gibson.webp", 0, ""],
    ["Sergei Monia", "瑟盖·蒙尼亚", "SG", "SF", 202, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "point_forward", 77, [63, 64, 57, 64, 70, 72, 48, 54, 65, 52, 47, 45, 56, 54, 25, 38, 33, 58, 61, 54, 63, 71, 62, 71, 54, 51, 42, 54, 62, 63], "", "", "img/sergei-monia.webp", 0, ""],
    ["Aron Baynes", "阿隆·贝恩斯", "PF", "SF", 208, 110, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "silver", "big_man", 77, [40, 26, 34, 57, 76, 79, 82, 87, 72, 47, 39, 40, 67, 52, 82, 81, 76, 68, 71, 64, 88, 32, 51, 47, 56, 53, 79, 80, 87, 88], "", "", "img/aron-baynes.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/203382.png"],
    ["Chris Andersen", "克里斯·安德森", "PF", "SF", 208, 111, "丹佛掘金", "#fec524", "#0e2240", "silver", "big_man", 77, [38, 30, 32, 59, 77, 80, 80, 85, 73, 44, 45, 37, 69, 58, 78, 82, 78, 64, 67, 60, 84, 33, 52, 49, 57, 54, 76, 85, 93, 93], "", "", "img/chris-andersen.webp", 0, ""],
    ["Al-Farouq Aminu", "艾尔·法鲁克·阿米奴", "SF", "PF", 206, 100, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "two_way", 77, [64, 65, 58, 67, 61, 64, 60, 66, 55, 77, 68, 71, 70, 68, 43, 57, 52, 45, 48, 41, 54, 62, 69, 59, 69, 66, 66, 55, 63, 64], "", "", "img/al-farouq-aminu.webp", 0, ""],
    ["J. R. Smith", "J·R·史密斯", "SG", "SF", 198, 100, "新奥尔良鹈鹕", "#e31837", "#0c2340", "silver", "sniper", 77, [73, 82, 68, 76, 54, 57, 32, 38, 42, 60, 45, 53, 45, 69, 25, 25, 25, 26, 29, 25, 29, 68, 81, 55, 66, 63, 40, 25, 31, 32], "", "", "img/j-r-smith.webp", 0, ""],
    ["Dāvis Bertāns", "戴维斯·贝尔坦斯", "SF", "PG", 208, 95, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "silver", "spark", 78, [74, 73, 69, 79, 72, 74, 66, 72, 65, 66, 63, 59, 55, 78, 25, 33, 28, 34, 37, 30, 47, 76, 73, 62, 79, 76, 72, 37, 45, 46], "", "", "img/davis-bertans.webp", 0, ""],
    ["Patrick Beverley", "派翠克·贝弗利", "PG", "SF", 188, 82, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "spark", 78, [68, 68, 62, 70, 68, 71, 53, 59, 60, 63, 51, 56, 49, 73, 25, 27, 25, 30, 33, 26, 40, 71, 65, 55, 71, 68, 65, 28, 36, 37], "", "", "img/patrick-beverley.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201976.png"],
    ["Kenneth Faried", "肯尼斯·法里德", "PF", "SG", 203, 103, "丹佛掘金", "#fec524", "#0e2240", "silver", "three_d", 78, [67, 80, 61, 72, 59, 62, 53, 59, 45, 83, 74, 77, 72, 71, 34, 54, 49, 28, 31, 25, 57, 59, 83, 52, 75, 72, 61, 53, 61, 62], "", "", "img/kenneth-faried.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/202702.png"],
    ["Yi Jianlian", "易建联", "PF", "SG", 211, 113, "新泽西篮网", "#003da5", "#cd1041", "silver", "three_d", 78, [70, 81, 64, 75, 62, 65, 54, 60, 49, 88, 72, 82, 72, 73, 37, 48, 43, 26, 29, 25, 62, 62, 81, 52, 70, 67, 63, 47, 55, 56], "", "", "img/yi-jianlian.webp", 0, ""],
    ["Bismack Biyombo", "俾斯麦·比永博", "PF", "SF", 206, 110, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "big_man", 79, [41, 30, 35, 63, 77, 80, 87, 93, 71, 46, 45, 39, 68, 56, 79, 86, 82, 68, 71, 64, 90, 36, 53, 49, 59, 56, 81, 83, 90, 91], "", "", "img/bismack-biyombo.webp", 0, ""],
    ["Jason Collins", "杰森·科林斯", "C", "PF", 213, 116, "新泽西篮网", "#003da5", "#cd1041", "silver", "big_man", 76, [28, 25, 25, 47, 67, 70, 72, 78, 58, 36, 36, 29, 57, 45, 68, 78, 73, 56, 59, 52, 77, 25, 37, 36, 47, 44, 68, 71, 79, 80], "", "", "img/jason-collins.webp", 0, ""],
    ["Kentavious Caldwell-Pope", "肯塔维奥斯·卡德维尔-波普", "SG", "PG", 198, 93, "洛杉矶湖人", "#fdb927", "#552583", "silver", "spark", 79, [67, 73, 61, 70, 69, 72, 56, 62, 61, 61, 56, 54, 48, 75, 25, 26, 25, 33, 36, 29, 41, 70, 68, 61, 73, 71, 65, 29, 37, 38], "", "", "img/kentavious-caldwell-pope.webp", 0, ""],
    ["Anthony Edwards", "安东尼·爱德华兹", "SG", "PG", 196, 102, "明尼苏达森林狼", "#78be20", "#0c2340", "gold", "scorer", 88, [78, 72, 73, 76, 74, 77, 79, 84, 74, 65, 59, 59, 54, 79, 25, 35, 30, 55, 58, 51, 50, 77, 73, 65, 78, 78, 80, 35, 43, 44], "", "", "img/anthony-edwards.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630162.png"],
    ["Alperen Şengün", "阿尔佩伦·申京", "C", "PF", 212, 106, "休斯顿火箭", "#ce1141", "#1a1a1a", "purple", "anchor", 91, [49, 43, 43, 65, 73, 76, 82, 87, 70, 53, 51, 46, 66, 53, 86, 86, 81, 77, 80, 74, 86, 43, 61, 76, 59, 56, 76, 73, 80, 81], "", "", "img/alperen-sengun.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630578.png"],
    ["Mo Williams", "莫里斯·威廉姆斯", "PG", "SG", 185, 90, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "floor_gen", 76, [65, 65, 59, 72, 58, 61, 25, 25, 42, 49, 46, 42, 37, 65, 25, 25, 25, 25, 25, 25, 26, 74, 68, 77, 63, 60, 30, 25, 26, 27], "", "", "img/mo-williams.webp", 0, ""],
    ["Kendrick Perkins", "肯德里克·帕金斯", "C", "PF", 208, 120, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "big_man", 76, [28, 25, 25, 46, 65, 68, 73, 79, 61, 33, 32, 26, 58, 43, 67, 72, 68, 55, 58, 51, 80, 25, 35, 37, 43, 40, 66, 75, 82, 83], "", "", "img/kendrick-perkins.webp", 0, ""],
    ["Zach Randolph", "扎克·兰多夫", "PF", "SF", 206, 118, "孟菲斯灰熊", "#5d76a9", "#12173f", "silver", "two_way", 76, [62, 65, 56, 64, 63, 66, 56, 62, 56, 78, 67, 71, 71, 65, 46, 56, 51, 46, 49, 42, 59, 59, 65, 58, 63, 60, 61, 56, 64, 65], "", "", "img/zach-randolph.webp", 0, ""],
    ["Hasheem Thabeet", "哈希姆·泰比特", "C", "PF", 221, 120, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "anchor", 76, [32, 28, 26, 47, 58, 61, 61, 67, 53, 39, 31, 32, 59, 36, 78, 82, 77, 57, 60, 53, 74, 29, 39, 42, 38, 35, 61, 72, 80, 81], "", "", "img/hasheem-thabeet.webp", 0, ""],
    ["Rasho Nesterović", "拉多斯拉夫·内斯特洛维奇", "C", "PF", 213, 113, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "big_man", 79, [29, 25, 25, 53, 69, 72, 76, 82, 63, 38, 36, 31, 61, 48, 74, 76, 72, 59, 62, 55, 81, 25, 41, 35, 50, 47, 67, 76, 84, 84], "", "", "img/rasho-nesterovic.webp", 0, ""],
    ["Pablo Prigioni", "巴勃罗·普里吉奥尼", "PG", "SG", 193, 88, "纽约尼克斯", "#f58426", "#006bb6", "silver", "floor_gen", 79, [70, 70, 64, 74, 63, 66, 25, 28, 42, 56, 50, 49, 41, 66, 25, 25, 25, 25, 27, 25, 30, 73, 71, 81, 62, 59, 36, 25, 27, 28], "", "", "img/pablo-prigioni.webp", 0, ""],
    ["Raül López", "劳尔·洛佩兹", "PG", "SG", 182, 84, "犹他爵士", "#f9a01b", "#002b5c", "silver", "three_d", 76, [63, 74, 57, 71, 56, 59, 44, 50, 38, 79, 65, 72, 65, 65, 33, 48, 43, 25, 26, 25, 54, 55, 73, 49, 70, 67, 55, 43, 51, 52], "", "", "img/raul-lopez.webp", 0, ""],
    ["Sam Cassell", "萨姆·卡塞尔", "PG", "SF", 190, 84, "洛杉矶快船", "#c8102e", "#1d428a", "silver", "spark", 77, [68, 70, 62, 69, 66, 69, 54, 60, 62, 60, 49, 53, 47, 72, 25, 25, 25, 29, 32, 25, 36, 70, 70, 57, 70, 67, 60, 27, 35, 36], "", "", "img/sam-cassell.webp", 0, ""],
    ["Marcus Camby", "马库斯·坎比", "PF", "SF", 211, 100, "丹佛掘金", "#fec524", "#0e2240", "silver", "two_way", 77, [66, 66, 60, 61, 66, 69, 61, 67, 57, 76, 68, 70, 69, 69, 41, 53, 48, 47, 50, 43, 53, 62, 65, 58, 69, 66, 64, 54, 62, 63], "", "", "img/marcus-camby.webp", 0, ""],
    ["Derek Fisher", "德里克·费舍尔", "PG", "SF", 185, 91, "洛杉矶湖人", "#fdb927", "#552583", "silver", "spark", 81, [69, 70, 64, 73, 72, 75, 61, 67, 63, 66, 58, 59, 50, 73, 25, 32, 27, 30, 33, 26, 39, 75, 70, 59, 73, 70, 66, 27, 35, 36], "", "", "img/derek-fisher.webp", 0, ""],
    ["Kenyon Martin", "肯杨·马丁", "PF", "SF", 206, 106, "丹佛掘金", "#fec524", "#0e2240", "silver", "big_man", 77, [41, 26, 35, 57, 74, 77, 84, 90, 70, 47, 45, 40, 68, 53, 78, 83, 79, 66, 69, 62, 87, 31, 48, 45, 55, 52, 78, 81, 88, 89], "", "", "img/kenyon-martin.webp", 0, ""],
    ["Kris Humphries", "克里斯·哈弗里斯", "PF", "SF", 207, 107, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "big_man", 77, [38, 27, 32, 59, 78, 81, 83, 88, 70, 47, 44, 40, 67, 51, 82, 82, 77, 67, 70, 63, 87, 37, 45, 44, 57, 54, 73, 79, 86, 87], "", "", "img/kris-humphries.webp", 0, ""],
    ["Vassilis Spanoulis", "瓦斯里斯·斯潘诺里斯", "PG", "SG", 193, 89, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "three_d", 77, [62, 76, 56, 69, 59, 62, 45, 51, 43, 80, 69, 73, 67, 71, 33, 43, 38, 25, 25, 25, 54, 53, 79, 50, 71, 68, 60, 46, 54, 55], "", "", "img/vassilis-spanoulis.webp", 0, ""],
    ["Steve Smith", "史蒂夫·德拉诺·史密斯", "SG", "SF", 203, 91, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "point_forward", 77, [64, 63, 58, 62, 67, 70, 45, 51, 66, 55, 47, 48, 58, 59, 25, 42, 37, 61, 64, 57, 62, 71, 61, 72, 55, 52, 47, 55, 63, 64], "", "", "img/steve-smith.webp", 0, ""],
    ["Sasha Kaun", "萨沙·考恩", "C", "PF", 211, 111, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "big_man", 77, [33, 25, 27, 51, 71, 73, 71, 76, 59, 39, 35, 32, 59, 43, 73, 72, 68, 59, 62, 55, 79, 26, 41, 35, 46, 43, 71, 72, 80, 81], "", "", "img/sasha-kaun.webp", 0, ""],
    ["Udonis Haslem", "乌杜尼斯·哈斯勒姆", "PF", "SF", 208, 106, "迈阿密热火", "#f9a01b", "#98002e", "silver", "two_way", 77, [63, 68, 57, 63, 63, 66, 62, 68, 58, 79, 68, 72, 70, 67, 43, 53, 48, 47, 50, 43, 54, 62, 68, 60, 69, 66, 62, 54, 62, 63], "", "", "img/udonis-haslem.webp", 0, ""],
    ["Ryan Anderson", "莱恩·安德森", "SF", "PF", 208, 106, "新奥尔良鹈鹕", "#e31837", "#0c2340", "silver", "two_way", 77, [63, 66, 57, 65, 67, 70, 58, 64, 58, 80, 67, 73, 69, 70, 46, 56, 51, 46, 49, 42, 56, 61, 67, 55, 64, 61, 62, 51, 59, 60], "", "", "img/ryan-anderson.webp", 0, ""],
    ["Igor Rakočević", "伊戈尔·拉科塞维奇", "PG", "SF", 191, 83, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "spark", 77, [66, 66, 60, 71, 69, 72, 54, 60, 58, 61, 53, 54, 47, 72, 25, 25, 25, 28, 31, 25, 40, 70, 69, 59, 73, 71, 61, 26, 34, 35], "", "", "img/igor-rakocevic.webp", 0, ""],
    ["Monta Ellis", "蒙塔·埃利斯", "SG", "PG", 190, 84, "金州勇士", "#ffc72c", "#1d428a", "silver", "slasher", 81, [66, 63, 60, 65, 74, 77, 74, 79, 71, 66, 52, 59, 51, 83, 26, 34, 29, 42, 45, 38, 55, 74, 58, 57, 78, 76, 77, 30, 38, 39], "", "", "img/monta-ellis.webp", 0, ""],
    ["Adam Morrison", "亚当·莫里森", "SF", "C", 203, 93, "夏洛特黄蜂", "#1d1160", "#00788c", "silver", "freak_forward", 75, [42, 25, 36, 47, 73, 76, 74, 80, 66, 61, 48, 54, 65, 65, 65, 71, 66, 57, 60, 53, 71, 61, 37, 57, 64, 61, 76, 63, 71, 71], "", "", "img/adam-morrison.webp", 0, ""],
    ["Horace Grant", "霍雷斯·格兰特", "PF", "SF", 208, 98, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "two_way", 78, [63, 66, 57, 67, 62, 65, 58, 64, 58, 82, 71, 75, 71, 69, 45, 56, 51, 44, 47, 40, 59, 65, 64, 61, 67, 64, 64, 53, 61, 62], "", "", "img/horace-grant.webp", 0, ""],
    ["Mike Conley Jr.", "小迈克·康利", "PG", "SF", 185, 82, "孟菲斯灰熊", "#5d76a9", "#12173f", "silver", "spark", 75, [67, 68, 61, 66, 67, 70, 52, 58, 59, 54, 50, 47, 44, 71, 25, 25, 25, 25, 27, 25, 34, 66, 67, 53, 71, 69, 61, 27, 35, 36], "", "", "img/mike-conley-jr.webp", 0, ""],
    ["Tristan Thompson", "特里斯坦·汤普森", "PF", "SF", 206, 108, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "two_way", 78, [66, 68, 60, 65, 67, 70, 59, 65, 58, 83, 66, 76, 73, 71, 49, 58, 53, 46, 49, 42, 57, 59, 64, 57, 65, 62, 64, 58, 66, 67], "", "", "img/tristan-thompson.webp", 0, ""],
    ["Tobias Harris", "托比亚斯·哈里斯", "SF", "PG", 206, 107, "费城76人", "#ed174c", "#006bb6", "silver", "spark", 75, [68, 71, 62, 76, 69, 71, 57, 63, 64, 63, 56, 56, 52, 79, 25, 33, 28, 34, 37, 30, 46, 72, 72, 61, 77, 74, 65, 35, 43, 44], "", "", "img/tobias-harris.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202699.png"],
    ["CJ McCollum", "C·J·麦科勒姆", "SG", "PG", 191, 89, "波特兰开拓者", "#e03a3e", "#1a1a1a", "gold", "scorer", 83, [74, 74, 69, 70, 69, 72, 60, 66, 69, 69, 55, 62, 52, 72, 25, 29, 25, 52, 55, 48, 43, 71, 74, 60, 72, 69, 67, 28, 36, 37], "", "", "img/cj-mccollum.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203468.png"],
    ["Sviatoslav Mykhailiuk", "斯维亚托斯拉夫·米哈伊柳克", "SG", "SF", 203, 93, "洛杉矶湖人", "#fdb927", "#552583", "silver", "point_forward", 78, [67, 63, 61, 63, 66, 69, 45, 51, 64, 51, 53, 44, 55, 58, 25, 41, 36, 59, 62, 55, 65, 73, 63, 72, 57, 54, 47, 52, 60, 61], "", "", "img/sviatoslav-mykhailiuk.webp", 0, ""],
    ["Juan Hernangómez", "胡安·埃尔南高梅兹", "PF", "SF", 206, 97, "丹佛掘金", "#fec524", "#0e2240", "silver", "two_way", 78, [68, 66, 62, 67, 67, 70, 61, 67, 58, 83, 66, 76, 71, 70, 46, 57, 52, 46, 49, 42, 60, 60, 64, 57, 70, 67, 67, 52, 60, 61], "", "", "img/juan-hernangomez.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627820.png"],
    ["Džanan Musa", "札南·穆萨", "SF", "PF", 204, 101, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "two_way", 75, [62, 66, 56, 66, 61, 64, 58, 64, 54, 80, 65, 73, 71, 63, 46, 51, 46, 42, 45, 38, 53, 60, 64, 52, 66, 63, 58, 55, 63, 64], "", "", "img/dzanan-musa.webp", 0, ""],
    ["Cade Cunningham", "凯德·康宁汉", "PG", "SF", 188, 100, "底特律活塞", "#c8102e", "#1d42ba", "purple", "scorer", 91, [76, 81, 71, 81, 77, 80, 69, 75, 74, 72, 58, 65, 59, 76, 25, 36, 31, 57, 60, 53, 49, 77, 79, 78, 78, 78, 72, 38, 46, 47], "", "", "img/cade-cunningham.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630595.png"],
    ["Detlef Schrempf", "德特夫·史伦夫", "SF", "PF", 206, 97, "西雅图超音速", "#00653a", "#ffc200", "silver", "two_way", 75, [64, 63, 58, 64, 62, 65, 59, 65, 57, 76, 69, 70, 66, 65, 46, 53, 48, 42, 45, 38, 54, 63, 61, 56, 65, 62, 60, 49, 57, 58], "", "", "img/detlef-schrempf.webp", 0, ""],
    ["Antawn Jamison", "安托万·贾米森", "SF", "PG", 203, 101, "华盛顿奇才", "#e31837", "#002b5c", "silver", "spark", 76, [67, 73, 61, 72, 71, 73, 63, 69, 66, 63, 60, 56, 51, 74, 25, 29, 25, 34, 37, 30, 40, 73, 73, 63, 74, 72, 67, 33, 41, 42], "", "", "img/antawn-jamison.webp", 0, ""],
    ["James Jones", "詹姆斯·琼斯", "SG", "SF", 203, 102, "迈阿密热火", "#f9a01b", "#98002e", "silver", "point_forward", 76, [63, 62, 57, 63, 69, 72, 48, 54, 67, 54, 46, 47, 57, 53, 25, 39, 34, 59, 62, 55, 63, 67, 60, 72, 50, 47, 46, 54, 62, 63], "", "", "img/james-jones.webp", 0, ""],
    ["Nenad Krstić", "内纳德·科斯蒂奇", "C", "PF", 213, 110, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "big_man", 76, [28, 25, 25, 49, 69, 72, 70, 75, 61, 31, 29, 25, 56, 43, 67, 74, 70, 54, 57, 50, 78, 25, 39, 35, 44, 41, 65, 73, 81, 82], "", "", "img/nenad-krstic.webp", 0, ""],
    ["Evan Turner", "埃文·特纳", "SG", "PG", 198, 95, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "spark", 76, [66, 69, 60, 67, 68, 71, 54, 60, 56, 56, 50, 49, 45, 72, 25, 26, 25, 25, 27, 25, 35, 71, 69, 57, 71, 68, 63, 28, 36, 37], "", "", "img/evan-turner.webp", 0, ""],
    ["Steve Francis", "史蒂夫·弗朗西斯", "PG", "SG", 191, 95, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "floor_gen", 76, [64, 63, 58, 67, 61, 64, 25, 25, 46, 55, 54, 48, 40, 64, 25, 25, 25, 25, 26, 25, 25, 76, 69, 74, 61, 58, 36, 25, 26, 27], "", "", "img/steve-francis.webp", 0, ""],
    ["Vladimir Radmanović", "弗拉迪米尔·拉德马诺维奇", "SF", "PF", 208, 103, "洛杉矶湖人", "#fdb927", "#552583", "silver", "two_way", 76, [62, 66, 56, 64, 62, 65, 57, 63, 54, 77, 67, 71, 69, 68, 44, 53, 48, 46, 49, 42, 58, 62, 68, 56, 65, 62, 60, 53, 61, 62], "", "", "img/vladimir-radmanovic.webp", 0, ""],
    ["Brandon Bass", "布兰顿·巴斯", "PF", "SF", 203, 108, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "two_way", 76, [64, 62, 58, 65, 61, 64, 57, 63, 56, 77, 69, 71, 69, 68, 48, 55, 50, 50, 53, 46, 59, 59, 62, 56, 71, 68, 65, 53, 61, 62], "", "", "img/brandon-bass.webp", 0, ""],
    ["Glen Rice", "格伦·莱斯", "SG", "SF", 201, 98, "迈阿密热火", "#f9a01b", "#98002e", "silver", "point_forward", 76, [65, 64, 59, 59, 63, 66, 47, 53, 61, 51, 50, 44, 55, 55, 25, 35, 30, 62, 65, 58, 57, 69, 62, 71, 55, 52, 39, 53, 61, 62], "", "", "img/glen-rice.webp", 0, ""],
    ["Walter Herrmann", "沃尔特·赫尔曼", "SF", "C", 206, 102, "底特律活塞", "#c8102e", "#1d42ba", "silver", "freak_forward", 76, [44, 25, 38, 47, 72, 74, 73, 79, 70, 60, 50, 53, 66, 70, 64, 66, 61, 60, 63, 56, 74, 61, 40, 58, 69, 66, 72, 65, 72, 73], "", "", "img/walter-herrmann.webp", 0, ""],
    ["David Lee", "大卫·李", "PF", "SF", 206, 113, "纽约尼克斯", "#f58426", "#006bb6", "silver", "big_man", 74, [41, 28, 35, 54, 73, 76, 77, 82, 69, 44, 39, 37, 64, 52, 75, 82, 77, 64, 67, 60, 82, 34, 45, 42, 52, 49, 74, 77, 84, 85], "", "", "img/david-lee.webp", 0, ""],
    ["Larry Johnson", "拉里·约翰逊", "SF", "PF", 198, 114, "纽约尼克斯", "#f58426", "#006bb6", "silver", "two_way", 76, [65, 61, 59, 64, 66, 69, 61, 67, 55, 76, 63, 70, 67, 69, 42, 57, 52, 48, 51, 44, 58, 63, 65, 54, 69, 66, 64, 50, 58, 59], "", "", "img/larry-johnson.webp", 0, ""],
    ["Raymond Felton", "雷蒙德·费尔顿", "PG", "SG", 185, 90, "夏洛特黄蜂", "#1d1160", "#00788c", "silver", "floor_gen", 74, [65, 63, 59, 69, 57, 60, 25, 25, 37, 52, 46, 45, 37, 57, 25, 25, 25, 25, 25, 25, 25, 70, 65, 74, 60, 57, 32, 25, 25, 25], "", "", "img/raymond-felton.webp", 0, ""],
    ["Andre Drummond", "安达·祖蒙特", "C", "PF", 212, 127, "底特律活塞", "#c8102e", "#1d42ba", "silver", "anchor", 74, [28, 25, 25, 48, 59, 62, 63, 69, 50, 38, 34, 31, 60, 33, 76, 77, 72, 53, 56, 49, 74, 25, 35, 42, 36, 33, 63, 74, 82, 82], "", "", "img/andre-drummond.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203083.png"],
    ["Derrick Favors", "德里克·费佛斯", "PF", "SG", 208, 120, "犹他爵士", "#f9a01b", "#002b5c", "silver", "three_d", 74, [64, 76, 58, 71, 60, 63, 49, 55, 44, 81, 67, 74, 66, 67, 33, 48, 43, 25, 27, 25, 56, 54, 79, 53, 71, 69, 63, 43, 51, 52], "", "", "img/derrick-favors.webp", 0, ""],
    ["Paul Millsap", "保罗·米尔萨普", "PF", "SG", 203, 112, "犹他爵士", "#f9a01b", "#002b5c", "silver", "three_d", 76, [65, 79, 59, 74, 59, 62, 51, 57, 47, 83, 66, 76, 70, 72, 32, 47, 42, 27, 30, 25, 56, 60, 79, 55, 70, 67, 58, 50, 58, 59], "", "", "img/paul-millsap.webp", 0, ""],
    ["Joel Anthony", "乔尔·安东尼", "C", "PF", 208, 111, "迈阿密热火", "#f9a01b", "#98002e", "silver", "anchor", 75, [33, 25, 27, 47, 57, 60, 61, 67, 57, 39, 37, 32, 58, 37, 81, 78, 73, 55, 58, 51, 74, 29, 38, 38, 35, 32, 59, 71, 78, 79], "", "", "img/joel-anthony.webp", 0, ""],
    ["Ty Lawson", "泰·劳森", "PG", "SF", 180, 88, "丹佛掘金", "#fec524", "#0e2240", "silver", "spark", 76, [67, 64, 61, 71, 65, 68, 56, 62, 58, 55, 54, 48, 45, 75, 25, 27, 25, 27, 30, 25, 34, 70, 69, 54, 71, 68, 64, 28, 36, 37], "", "", "img/ty-lawson.webp", 0, ""],
    ["Greg Monroe", "格雷格·门罗", "PF", "SF", 211, 120, "底特律活塞", "#c8102e", "#1d42ba", "silver", "big_man", 75, [40, 25, 34, 58, 72, 75, 83, 88, 70, 42, 40, 35, 65, 52, 79, 80, 75, 63, 66, 59, 85, 33, 44, 48, 54, 51, 78, 80, 87, 88], "", "", "img/greg-monroe.webp", 0, ""],
    ["Rick Fox", "里克·福克斯", "SG", "SF", 196, 104, "洛杉矶湖人", "#fdb927", "#552583", "silver", "three_d", 75, [60, 73, 54, 67, 56, 59, 48, 54, 39, 82, 64, 75, 68, 65, 31, 44, 39, 25, 26, 25, 51, 56, 75, 46, 68, 65, 53, 46, 54, 55], "", "", "img/rick-fox.webp", 0, ""],
    ["Víctor Claver", "维克多·克拉夫", "SF", "PG", 207, 107, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "spark", 75, [71, 72, 65, 71, 70, 72, 62, 68, 65, 66, 57, 59, 52, 79, 25, 28, 25, 32, 35, 28, 43, 73, 72, 59, 76, 73, 63, 32, 40, 41], "", "", "img/victor-claver.webp", 0, ""],
    ["Nick Calathes", "尼克·卡拉塞斯", "PG", "SF", 198, 97, "孟菲斯灰熊", "#5d76a9", "#12173f", "silver", "spark", 75, [65, 69, 59, 65, 66, 69, 52, 58, 57, 54, 52, 47, 41, 71, 25, 25, 25, 26, 29, 25, 34, 66, 67, 56, 69, 66, 63, 25, 30, 31], "", "", "img/nick-calathes.webp", 0, ""],
    ["Iman Shumpert", "伊曼·尚波特", "PG", "SF", 196, 100, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "spark", 75, [65, 66, 59, 72, 65, 68, 55, 61, 55, 58, 48, 51, 46, 69, 25, 25, 25, 28, 31, 25, 36, 65, 68, 57, 69, 66, 60, 27, 35, 36], "", "", "img/iman-shumpert.webp", 0, ""],
    ["Mahmoud Abdul-Rauf", "马翰默德·劳夫", "PG", "SG", 185, 73, "丹佛掘金", "#fec524", "#0e2240", "silver", "floor_gen", 75, [66, 68, 60, 71, 55, 58, 25, 25, 40, 55, 53, 48, 39, 60, 25, 25, 25, 25, 25, 25, 25, 72, 63, 72, 57, 54, 33, 25, 25, 25], "", "", "img/mahmoud-abdul-rauf.webp", 0, ""],
    ["Daniel Theis", "丹尼尔·泰斯", "PF", "SF", 204, 110, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "big_man", 75, [40, 28, 34, 60, 72, 75, 78, 83, 69, 43, 40, 36, 66, 55, 76, 83, 79, 62, 65, 58, 87, 32, 50, 46, 51, 48, 74, 81, 88, 89], "", "", "img/daniel-theis.webp", 0, ""],
    ["Zoran Dragić", "佐兰·德拉吉奇", "SG", "SF", 196, 91, "迈阿密热火", "#f9a01b", "#98002e", "silver", "three_d", 75, [63, 72, 57, 69, 54, 57, 43, 49, 42, 79, 66, 72, 66, 64, 28, 41, 36, 25, 25, 25, 54, 54, 72, 45, 68, 65, 53, 45, 53, 54], "", "", "img/zoran-dragic.webp", 0, ""],
    ["Nemanja Nedović", "内马尼亚·内多维奇", "PG", "SF", 191, 87, "金州勇士", "#ffc72c", "#1d428a", "silver", "spark", 75, [61, 67, 55, 66, 65, 68, 53, 59, 58, 57, 53, 50, 43, 70, 25, 25, 25, 25, 28, 25, 38, 67, 68, 52, 71, 68, 58, 25, 30, 31], "", "", "img/nemanja-nedovic.webp", 0, ""],
    ["Jerami Grant", "杰拉米·格兰特", "SF", "C", 203, 95, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "freak_forward", 72, [41, 25, 35, 42, 68, 70, 70, 75, 65, 61, 45, 54, 63, 67, 59, 65, 60, 59, 62, 55, 70, 59, 35, 54, 60, 57, 70, 58, 66, 67], "", "", "img/jerami-grant.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203924.png"],
    ["Seth Curry", "萨夫·居里", "PG", "SG", 188, 79, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "floor_gen", 75, [67, 65, 61, 67, 58, 61, 25, 25, 40, 50, 50, 43, 36, 62, 25, 25, 25, 25, 25, 25, 26, 72, 65, 77, 58, 55, 30, 25, 25, 25], "", "", "img/seth-curry.webp", 0, ""],
    ["Victor Oladipo", "维克托·奥拉迪波", "SG", "SF", 193, 97, "印第安纳步行者", "#fdbb30", "#002d62", "silver", "sniper", 73, [69, 78, 63, 77, 52, 55, 25, 27, 42, 59, 35, 52, 42, 66, 25, 25, 25, 25, 25, 25, 28, 59, 78, 53, 65, 62, 34, 25, 26, 27], "", "", "img/victor-oladipo.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/203506.png"],
    ["Fred VanVleet", "弗雷德·范弗利特", "PG", "SF", 183, 88, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "scorer", 83, [77, 70, 71, 74, 70, 73, 61, 67, 67, 65, 52, 58, 52, 72, 25, 35, 30, 56, 59, 52, 45, 75, 72, 64, 76, 73, 65, 33, 41, 42], "", "", "img/fred-vanvleet.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627832.png"],
    ["Norman Powell", "诺曼·鲍威尔", "SG", "PG", 193, 98, "多伦多猛龙", "#ce1141", "#1a1a1a", "silver", "scorer", 82, [76, 71, 70, 73, 68, 71, 59, 65, 69, 64, 52, 57, 49, 69, 25, 34, 29, 51, 54, 47, 44, 70, 74, 57, 74, 71, 66, 27, 35, 36], "", "", "img/norman-powell.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626181.png"],
    ["Deandre Ayton", "德安德烈·艾顿", "C", "PF", 216, 118, "菲尼克斯太阳", "#e56020", "#1d1160", "silver", "anchor", 73, [27, 25, 25, 43, 57, 60, 62, 68, 50, 32, 31, 25, 54, 35, 75, 76, 71, 56, 59, 52, 77, 25, 34, 41, 37, 34, 57, 70, 77, 78], "", "", "img/deandre-ayton.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629028.png"],
    ["Frank Ntilikina", "法兰克·尼利基纳", "PG", "SF", 193, 90, "纽约尼克斯", "#f58426", "#006bb6", "silver", "spark", 73, [63, 61, 57, 65, 65, 68, 51, 57, 56, 53, 45, 46, 40, 66, 25, 25, 25, 26, 29, 25, 34, 68, 66, 55, 65, 62, 55, 25, 29, 30], "", "", "img/frank-ntilikina.webp", 0, ""],
    ["Ivica Zubac", "伊维察·祖巴茨", "C", "PF", 216, 120, "洛杉矶快船", "#c8102e", "#1d428a", "gold", "anchor", 83, [36, 30, 30, 57, 64, 67, 71, 77, 62, 42, 42, 35, 64, 42, 86, 84, 80, 63, 66, 59, 82, 34, 49, 52, 46, 43, 71, 79, 86, 87], "", "", "img/ivica-zubac.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627826.png"],
    ["Alex Caruso", "亚历克斯·卡鲁索", "PG", "SG", 188, 83, "洛杉矶湖人", "#fdb927", "#552583", "silver", "floor_gen", 74, [62, 62, 56, 70, 60, 63, 25, 25, 42, 53, 46, 46, 38, 63, 25, 25, 25, 25, 25, 25, 25, 71, 66, 77, 56, 53, 28, 25, 25, 26], "", "", "img/alex-caruso.webp", 0, ""],
    ["Ronny Turiaf", "罗尼·图里亚夫", "PF", "SF", 208, 113, "洛杉矶湖人", "#fdb927", "#552583", "silver", "two_way", 74, [62, 63, 56, 63, 63, 66, 58, 64, 55, 74, 64, 68, 68, 61, 42, 54, 49, 44, 47, 40, 56, 60, 63, 52, 63, 60, 57, 54, 62, 63], "", "", "img/ronny-turiaf.webp", 0, ""],
    ["Al Jefferson", "艾尔·杰弗逊", "PF", "SG", 208, 131, "明尼苏达森林狼", "#78be20", "#0c2340", "silver", "three_d", 74, [65, 74, 59, 73, 59, 62, 48, 54, 41, 83, 67, 77, 69, 68, 31, 49, 44, 26, 29, 25, 58, 58, 75, 50, 65, 62, 62, 47, 55, 56], "", "", "img/al-jefferson.webp", 0, ""],
    ["Jimmer Fredette", "吉默·弗雷戴特", "PG", "SG", 188, 88, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "three_d", 74, [60, 72, 54, 68, 53, 56, 41, 47, 37, 79, 65, 72, 65, 62, 30, 43, 38, 25, 25, 25, 51, 56, 74, 50, 64, 61, 56, 43, 51, 52], "", "", "img/jimmer-fredette.webp", 0, ""],
    ["Devin Harris", "德文·哈里斯", "PG", "SG", 190, 87, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "three_d", 74, [60, 74, 54, 68, 54, 57, 45, 51, 39, 77, 65, 71, 62, 63, 32, 41, 36, 25, 26, 25, 49, 50, 74, 46, 68, 65, 57, 40, 48, 49], "", "", "img/devin-harris.webp", 0, ""],
    ["Predrag Danilović", "萨沙·达尼洛维奇", "SG", "SF", 196, 91, "迈阿密热火", "#f9a01b", "#98002e", "silver", "sniper", 74, [71, 77, 65, 78, 56, 59, 29, 35, 40, 60, 38, 53, 42, 62, 25, 25, 25, 25, 25, 25, 28, 65, 78, 50, 61, 58, 41, 25, 25, 26], "", "", "img/predrag-danilovic.webp", 0, ""],
    ["Jeff Teague", "杰夫·蒂格", "PG", "SF", 188, 82, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "spark", 74, [61, 66, 55, 67, 65, 68, 52, 58, 55, 60, 47, 53, 44, 67, 25, 26, 25, 27, 30, 25, 39, 64, 62, 52, 71, 68, 56, 25, 29, 30], "", "", "img/jeff-teague.webp", 0, ""],
    ["Semih Erden", "赛米·埃尔登", "C", "PF", 213, 109, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "anchor", 74, [32, 25, 26, 45, 58, 61, 60, 66, 56, 37, 34, 30, 58, 35, 79, 77, 72, 51, 54, 47, 76, 25, 39, 42, 35, 32, 56, 72, 80, 81], "", "", "img/semih-erden.webp", 0, ""],
    ["Courtney Lee", "考特尼·李", "SG", "SF", 196, 91, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "sniper", 74, [72, 78, 66, 79, 50, 53, 25, 30, 42, 59, 37, 52, 41, 67, 25, 25, 25, 25, 25, 25, 28, 63, 81, 51, 61, 58, 36, 25, 25, 25], "", "", "img/courtney-lee.webp", 0, ""],
    ["Tyreke Evans", "泰瑞克·埃文斯", "PG", "SG", 198, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "three_d", 74, [59, 71, 53, 70, 55, 58, 42, 48, 36, 78, 65, 72, 63, 66, 28, 46, 41, 25, 25, 25, 52, 53, 74, 50, 65, 62, 56, 41, 49, 50], "", "", "img/tyreke-evans.webp", 0, ""],
    ["Spud Webb", "安东尼·韦伯", "PG", "SG", 168, 60, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "three_d", 74, [58, 75, 52, 64, 56, 59, 42, 48, 41, 77, 64, 71, 64, 63, 26, 43, 38, 25, 25, 25, 49, 50, 73, 49, 68, 65, 56, 43, 51, 52], "", "", "img/spud-webb.webp", 0, ""],
    ["Mickaël Piétrus", "迈克尔·皮特鲁斯", "SG", "SF", 198, 98, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "sniper", 74, [70, 80, 64, 78, 53, 56, 25, 28, 41, 59, 40, 52, 41, 67, 25, 25, 25, 25, 25, 25, 27, 65, 79, 49, 59, 56, 34, 25, 25, 25], "", "", "img/mickael-pietrus.webp", 0, ""],
    ["Drew Gooden", "德鲁·古登", "PF", "SF", 208, 113, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "big_man", 74, [38, 25, 32, 58, 76, 79, 82, 87, 68, 40, 38, 33, 62, 53, 75, 77, 72, 65, 68, 61, 86, 27, 46, 43, 53, 50, 76, 76, 83, 84], "", "", "img/drew-gooden.webp", 0, ""],
    ["Samuel Dalembert", "萨缪尔·戴勒姆波特", "C", "PF", 211, 114, "费城76人", "#ed174c", "#006bb6", "silver", "big_man", 72, [25, 25, 25, 43, 66, 69, 71, 76, 54, 32, 28, 25, 54, 37, 63, 67, 62, 52, 55, 48, 75, 25, 33, 31, 44, 41, 64, 69, 76, 77], "", "", "img/samuel-dalembert.webp", 0, ""],
    ["Jason Williams", "杰森·威廉姆斯", "PG", "SG", 185, 86, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "floor_gen", 82, [74, 70, 68, 74, 67, 69, 25, 31, 50, 59, 58, 52, 46, 70, 25, 25, 25, 26, 29, 25, 26, 78, 74, 81, 62, 62, 36, 26, 34, 35], "", "", "img/jason-williams.webp", 0, ""],
    ["Rodrigue Beaubois", "罗德里格·布博瓦", "PG", "SF", 188, 84, "达拉斯独行侠", "#00538c", "#002b5e", "silver", "spark", 74, [62, 62, 56, 66, 66, 69, 49, 55, 57, 53, 48, 46, 41, 69, 25, 25, 25, 25, 25, 25, 37, 69, 62, 51, 69, 66, 60, 25, 31, 32], "", "", "img/rodrigue-beaubois.webp", 0, ""],
    ["Hanno Möttölä", "汉诺·莫托拉", "PF", "SG", 209, 112, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "three_d", 75, [66, 76, 60, 72, 61, 64, 50, 56, 43, 82, 70, 75, 67, 70, 35, 46, 41, 25, 26, 25, 55, 57, 76, 52, 72, 69, 59, 45, 53, 54], "", "", "img/hanno-mottola.webp", 0, ""],
    ["Rik Smits", "里克·施密茨", "C", "PF", 224, 114, "印第安纳步行者", "#fdbb30", "#002d62", "silver", "big_man", 75, [26, 25, 25, 44, 63, 66, 73, 79, 61, 32, 33, 25, 56, 43, 66, 70, 65, 56, 59, 52, 76, 25, 39, 36, 42, 39, 68, 73, 80, 81], "", "", "img/rik-smits.webp", 0, ""],
    ["Sergey Karasev", "塞尔吉·卡拉塞夫", "SG", "SF", 203, 95, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "point_forward", 72, [63, 55, 57, 55, 64, 67, 39, 45, 60, 47, 45, 40, 51, 47, 25, 36, 31, 53, 56, 49, 54, 70, 54, 66, 48, 45, 40, 49, 57, 58], "", "", "img/sergey-karasev.webp", 0, ""],
    ["Thabo Sefolosha", "萨博·塞福罗萨", "SG", "SF", 201, 100, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "silver", "point_forward", 73, [59, 59, 53, 58, 61, 64, 43, 49, 60, 51, 44, 44, 53, 52, 25, 33, 28, 57, 60, 53, 60, 69, 56, 71, 48, 45, 36, 49, 57, 58], "", "", "img/thabo-sefolosha.webp", 0, ""],
    ["Jerry Stackhouse", "杰里·斯塔克豪斯", "SG", "SF", 198, 99, "底特律活塞", "#c8102e", "#1d42ba", "silver", "three_d", 73, [63, 71, 57, 67, 51, 54, 43, 49, 36, 77, 62, 71, 62, 64, 27, 40, 35, 25, 25, 25, 48, 51, 74, 48, 66, 63, 54, 39, 47, 48], "", "", "img/jerry-stackhouse.webp", 0, ""],
    ["Avery Bradley", "艾弗里·布拉德利", "PG", "SG", 188, 82, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "three_d", 73, [58, 71, 52, 65, 53, 56, 41, 47, 39, 80, 62, 73, 65, 61, 30, 41, 36, 25, 25, 25, 51, 54, 71, 44, 63, 60, 56, 42, 50, 51], "", "", "img/avery-bradley.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/202340.png"],
    ["Donatas Motiejūnas", "多纳塔斯·莫泰尤纳斯", "PF", "SF", 213, 99, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "two_way", 73, [59, 62, 53, 65, 60, 63, 57, 63, 51, 77, 61, 71, 69, 61, 41, 50, 45, 47, 50, 43, 53, 56, 59, 56, 61, 58, 60, 53, 61, 62], "", "", "img/donatas-motiejunas.webp", 0, ""],
    ["D. J. Augustin", "D·J·奥古斯丁", "PG", "SF", 183, 83, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "spark", 73, [61, 61, 55, 65, 63, 66, 50, 56, 54, 56, 50, 49, 42, 66, 25, 25, 25, 25, 26, 25, 37, 67, 62, 55, 70, 67, 62, 25, 29, 30], "", "", "img/d-j-augustin.webp", 0, ""],
    ["Elvin Hayes", "埃尔文·海耶斯", "PF", "C", 206, 107, "华盛顿奇才", "#e31837", "#002b5c", "gold", "freak_forward", 88, [55, 35, 49, 58, 80, 83, 77, 83, 81, 72, 59, 65, 77, 79, 76, 78, 73, 73, 76, 70, 77, 74, 50, 70, 80, 80, 82, 76, 84, 84], "", "", "img/elvin-hayes.webp", 0, ""],
    ["Lou Williams", "路·威廉姆斯", "PG", "SF", 185, 80, "费城76人", "#ed174c", "#006bb6", "silver", "spark", 73, [59, 64, 53, 67, 63, 66, 48, 54, 57, 55, 45, 48, 42, 69, 25, 25, 25, 25, 28, 25, 33, 68, 67, 52, 66, 63, 57, 25, 30, 31], "", "", "img/lou-williams.webp", 0, ""],
    ["Cory Joseph", "科里·约瑟夫", "PG", "SG", 188, 90, "萨克拉门托国王", "#5a2d81", "#63727a", "silver", "three_d", 73, [63, 68, 57, 67, 55, 58, 44, 50, 35, 80, 64, 73, 63, 62, 25, 39, 34, 25, 25, 25, 50, 53, 72, 45, 65, 62, 50, 39, 47, 48], "", "", "img/cory-joseph.webp", 0, ""],
    ["Robert Archibald", "罗伯特·阿奇巴尔德", "PF", "SF", 211, 113, "多伦多猛龙", "#ce1141", "#1a1a1a", "silver", "big_man", 73, [33, 28, 27, 55, 73, 76, 78, 83, 65, 39, 36, 32, 63, 50, 72, 81, 76, 63, 66, 59, 86, 30, 41, 43, 51, 48, 76, 80, 87, 88], "", "", "img/robert-archibald.webp", 0, ""],
    ["Tim Hardaway Jr.", "小蒂姆·哈达威", "SG", "SF", 196, 93, "纽约尼克斯", "#f58426", "#006bb6", "silver", "sniper", 73, [72, 77, 67, 74, 54, 57, 26, 32, 42, 59, 33, 52, 41, 62, 25, 25, 25, 25, 25, 25, 27, 64, 74, 52, 63, 60, 37, 25, 25, 25], "", "", "img/tim-hardaway-jr.webp", 0, ""],
    ["Kyle Anderson", "李凯尔", "SF", "C", 206, 104, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "silver", "freak_forward", 73, [43, 25, 37, 42, 67, 70, 73, 79, 69, 63, 42, 56, 65, 68, 65, 69, 64, 57, 60, 53, 72, 56, 36, 54, 64, 61, 72, 60, 68, 69], "", "", "img/kyle-anderson.webp", 0, ""],
    ["Jordan Clarkson", "乔丹·克拉克森", "PG", "SG", 196, 86, "洛杉矶湖人", "#fdb927", "#552583", "silver", "three_d", 72, [59, 69, 53, 67, 53, 56, 45, 51, 34, 79, 58, 72, 64, 66, 30, 44, 39, 25, 25, 25, 48, 52, 72, 47, 62, 59, 55, 42, 50, 51], "", "", "img/jordan-clarkson.webp", 0, ""],
    ["Bronny James", "布朗尼·詹姆斯", "SF", "SG", 187, 95, "洛杉矶湖人", "#fdb927", "#552583", "silver", "three_d", 72, [61, 77, 55, 71, 57, 60, 46, 52, 42, 79, 64, 72, 66, 68, 32, 47, 42, 25, 27, 25, 51, 53, 74, 53, 68, 65, 55, 45, 53, 54], "", "", "img/bronny-james.webp", 0, ""],
    ["Jordan Poole", "乔丹·波尔", "SG", "SF", 193, 86, "华盛顿奇才", "#e31837", "#002b5c", "silver", "three_d", 73, [61, 73, 55, 66, 53, 56, 41, 47, 36, 74, 64, 68, 60, 64, 29, 41, 36, 25, 25, 25, 48, 50, 74, 43, 64, 61, 52, 39, 47, 48], "", "", "img/jordan-poole.webp", 0, ""],
    ["Darius Garland", "大流士·加兰", "PG", "SF", 188, 79, "克利夫兰骑士", "#fdbb30", "#860038", "purple", "scorer", 91, [85, 75, 79, 81, 78, 81, 72, 77, 75, 70, 61, 64, 58, 78, 25, 39, 34, 63, 65, 59, 53, 80, 80, 70, 80, 80, 72, 38, 46, 47], "", "", "img/darius-garland.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629636.png"],
    ["Jalen Green", "杰伦·格林", "SG", "SF", 196, 84, "休斯顿火箭", "#ce1141", "#1a1a1a", "gold", "sniper", 83, [80, 84, 75, 81, 60, 63, 36, 42, 48, 66, 49, 59, 49, 75, 25, 26, 25, 27, 30, 25, 35, 69, 90, 63, 69, 67, 50, 25, 33, 34], "", "", "img/jalen-green.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630224.png"],
    ["Thaddeus Young", "赛迪斯·扬", "SF", "C", 203, 99, "费城76人", "#ed174c", "#006bb6", "silver", "freak_forward", 72, [39, 25, 33, 45, 71, 73, 67, 72, 67, 62, 43, 55, 64, 64, 62, 64, 59, 59, 62, 55, 68, 56, 37, 52, 61, 58, 72, 59, 67, 68], "", "", "img/thaddeus-young.webp", 0, ""],
    ["Zoran Planinić", "Zoran Planinić", "PG", "SF", 201, 88, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "silver", "point_forward", 72, [61, 55, 55, 55, 63, 66, 40, 46, 58, 45, 47, 38, 48, 50, 25, 32, 27, 55, 58, 51, 57, 70, 55, 66, 50, 47, 36, 45, 53, 54], "", "", "img/zoran-planinic.webp", 0, ""],
    ["Aaron Brooks", "阿伦·布鲁克斯", "PG", "SF", 183, 73, "休斯顿火箭", "#ce1141", "#1a1a1a", "silver", "spark", 73, [61, 66, 55, 66, 64, 67, 52, 58, 58, 53, 47, 46, 40, 66, 25, 25, 25, 25, 26, 25, 30, 63, 66, 51, 69, 66, 53, 25, 29, 30], "", "", "img/aaron-brooks.webp", 0, ""],
    ["Mikal Bridges", "麦凯·布里吉斯", "SF", "SG", 198, 95, "菲尼克斯太阳", "#e56020", "#1d1160", "gold", "three_d", 83, [73, 85, 68, 80, 65, 68, 55, 61, 55, 93, 73, 87, 79, 74, 42, 52, 47, 30, 33, 26, 62, 65, 84, 62, 74, 71, 69, 57, 65, 66], "", "", "img/mikal-bridges.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628969.png"],
    ["Paolo Banchero", "保罗·班凯罗", "PF", "SF", 207, 113, "奥兰多魔术", "#0077c0", "#1a1a1a", "purple", "skilled_big", 91, [77, 69, 72, 80, 82, 85, 80, 86, 79, 59, 59, 52, 72, 56, 67, 76, 72, 74, 76, 70, 86, 69, 76, 68, 61, 58, 70, 79, 87, 87], "", "", "img/paolo-banchero.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1631094.png"],
    ["Josh Hart", "乔许·哈特", "SG", "PG", 198, 93, "纽约尼克斯", "#f58426", "#006bb6", "gold", "scorer", 83, [79, 72, 73, 72, 70, 73, 65, 70, 67, 66, 53, 59, 51, 75, 25, 28, 25, 51, 54, 47, 40, 75, 69, 59, 75, 72, 63, 30, 38, 39], "", "", "img/josh-hart.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628425.png"],
    ["OG Anunoby", "OG·阿努诺比", "SF", "C", 203, 107, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "freak_forward", 83, [53, 31, 47, 52, 78, 81, 76, 81, 73, 70, 54, 63, 75, 77, 71, 75, 70, 68, 70, 64, 82, 71, 46, 64, 70, 67, 83, 75, 82, 83], "", "", "img/og-anunoby.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628384.png"],
    ["Jaren Jackson Jr.", "小贾伦·杰克逊", "PF", "C", 211, 103, "孟菲斯灰熊", "#5d76a9", "#12173f", "gold", "freak_forward", 88, [51, 68, 45, 53, 73, 76, 75, 81, 80, 70, 60, 63, 75, 73, 79, 80, 75, 72, 74, 68, 75, 69, 48, 70, 74, 72, 81, 75, 83, 84], "", "", "img/jaren-jackson-jr.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628991.png"],
    ["Austin Reaves", "奥斯汀·里夫斯", "SF", "PG", 202, 96, "洛杉矶湖人", "#fdb927", "#552583", "gold", "slasher", 84, [70, 71, 65, 72, 81, 83, 81, 86, 80, 72, 59, 66, 59, 87, 38, 42, 37, 48, 51, 44, 59, 85, 69, 64, 86, 86, 84, 38, 46, 47], "", "", "img/austin-reaves.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630559.png"],
    ["Myles Turner", "迈尔斯·特纳", "C", "PF", 211, 110, "印第安纳步行者", "#fdbb30", "#002d62", "silver", "skilled_big", 81, [67, 59, 61, 66, 73, 76, 66, 71, 60, 42, 43, 35, 58, 41, 58, 62, 57, 77, 79, 73, 71, 51, 62, 68, 47, 44, 56, 68, 75, 76], "", "", "img/myles-turner.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626167.png"],
    ["Jarrett Allen", "贾勒特·艾伦", "C", "PF", 211, 104, "布鲁克林篮网", "#c9ced4", "#1a1a1a", "gold", "anchor", 84, [43, 37, 37, 56, 68, 70, 73, 79, 63, 42, 46, 35, 64, 44, 85, 87, 82, 63, 66, 59, 83, 40, 51, 48, 52, 49, 72, 79, 86, 87], "", "", "img/jarrett-allen.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628386.png"],
    ["RJ Barrett", "R·J·巴瑞特", "SG", "SF", 201, 84, "纽约尼克斯", "#f58426", "#006bb6", "silver", "point_forward", 81, [72, 68, 67, 66, 68, 71, 53, 59, 72, 55, 51, 48, 59, 60, 25, 45, 40, 63, 66, 59, 66, 73, 66, 78, 57, 54, 46, 57, 65, 66], "", "", "img/rj-barrett.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629628.png"],
    ["Desmond Bane", "德斯蒙德·巴恩", "SG", "PG", 198, 98, "孟菲斯灰熊", "#5d76a9", "#12173f", "gold", "slasher", 88, [65, 76, 60, 69, 77, 80, 80, 85, 78, 72, 60, 65, 59, 79, 30, 39, 34, 48, 51, 44, 62, 79, 77, 63, 78, 78, 80, 39, 47, 48], "", "", "img/desmond-bane.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630217.png"],
    ["Coby White", "柯比·怀特", "SG", "PG", 196, 87, "芝加哥公牛", "#ce1141", "#1a1a1a", "silver", "scorer", 81, [74, 68, 68, 71, 70, 73, 59, 65, 69, 65, 53, 58, 48, 75, 25, 33, 28, 52, 55, 48, 42, 71, 72, 56, 71, 68, 61, 25, 33, 34], "", "", "img/coby-white.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629632.png"],
    ["Jalen Williams", "杰伦·威廉斯", "SF", "PF", 198, 92, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "gold", "two_way", 89, [74, 75, 69, 77, 73, 75, 73, 78, 66, 88, 76, 82, 79, 74, 59, 65, 61, 58, 61, 54, 66, 72, 74, 66, 75, 75, 71, 64, 72, 73], "", "", "img/jalen-williams.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1631114.png"],
    ["Wang Zhizhi", "王治郅", "C", "PF", 213, 116, "迈阿密热火", "#f9a01b", "#98002e", "silver", "big_man", 72, [29, 25, 25, 42, 65, 68, 70, 75, 56, 33, 28, 26, 55, 39, 67, 67, 62, 50, 53, 46, 75, 25, 31, 33, 42, 39, 67, 70, 77, 78], "", "", "img/wang-zhizhi.webp", 0, ""],
    ["Artis Gilmore", "阿蒂斯·吉尔摩尔", "C", "PF", 218, 109, "芝加哥公牛", "#ce1141", "#1a1a1a", "gold", "anchor", 88, [46, 36, 40, 60, 74, 76, 77, 83, 68, 48, 47, 41, 67, 52, 84, 84, 79, 70, 73, 66, 84, 40, 54, 55, 51, 48, 75, 79, 86, 87], "", "", "img/artis-gilmore.webp", 0, ""],
    ["Jalen Johnson", "杰伦·强森", "SF", "PG", 202, 96, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "slasher", 81, [67, 63, 61, 70, 79, 82, 78, 83, 74, 70, 59, 64, 56, 86, 29, 35, 30, 46, 49, 42, 56, 79, 68, 59, 82, 82, 82, 34, 42, 43], "", "", "img/jalen-johnson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630552.png"],
    ["Brandon Miller", "布兰登·米勒", "SF", "SG", 202, 96, "夏洛特黄蜂", "#1d1160", "#00788c", "silver", "three_d", 81, [70, 85, 65, 75, 66, 68, 56, 62, 51, 87, 71, 80, 73, 73, 39, 51, 46, 30, 33, 26, 62, 63, 83, 60, 76, 73, 68, 52, 60, 61], "", "", "img/brandon-miller.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1641706.png"],
    ["Scoot Henderson", "斯库特·亨德森", "SF", "SG", 202, 96, "波特兰开拓者", "#e03a3e", "#1a1a1a", "silver", "three_d", 81, [68, 83, 63, 79, 65, 68, 54, 60, 49, 90, 74, 84, 75, 72, 36, 51, 46, 32, 35, 28, 65, 64, 81, 58, 77, 74, 68, 52, 60, 61], "", "", "img/scoot-henderson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1641733.png"],
    ["Ausar Thompson", "奥萨尔·汤普森", "SF", "PG", 202, 96, "底特律活塞", "#c8102e", "#1d42ba", "silver", "slasher", 81, [67, 63, 61, 68, 83, 86, 83, 89, 72, 68, 56, 61, 54, 82, 33, 37, 32, 46, 49, 42, 58, 81, 63, 59, 83, 83, 81, 34, 42, 43], "", "", "img/ausar-thompson.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1641723.png"],
    ["Kobe Bryant", "科比·布莱恩特", "SG", "PG", 198, 96, "洛杉矶湖人", "#fdb927", "#552583", "momentPurple", "scorer", 112, [96, 95, 90, 96, 93, 96, 93, 98, 96, 99, 87, 93, 91, 96, 70, 79, 75, 93, 96, 89, 75, 96, 96, 92, 96, 96, 96, 76, 84, 85], "2005-06", "场均35.4分·单场81分赛季", "img/kobe-bryant-m.webp", 0, "https://commons.wikimedia.org/wiki/File:KBryant8.jpg"],
    ["LeBron James", "勒布朗·詹姆斯", "SF", "PF", 206, 113, "迈阿密热火", "#f9a01b", "#98002e", "momentPurple", "point_forward", 112, [96, 87, 90, 84, 93, 96, 93, 98, 96, 102, 96, 96, 99, 96, 71, 95, 90, 93, 96, 89, 96, 96, 91, 96, 95, 95, 96, 91, 98, 99], "2012-13", "27连胜·常规赛MVP+FMVP", "img/lebron-james-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png"],
    ["Stephen Curry", "斯蒂芬·库里", "PG", "SG", 188, 86, "金州勇士", "#ffc72c", "#1d428a", "momentPurple", "sniper", 108, [93, 96, 87, 93, 90, 93, 69, 74, 86, 99, 85, 93, 84, 93, 57, 68, 63, 64, 67, 60, 67, 93, 93, 93, 93, 93, 79, 63, 71, 72], "2015-16", "全票MVP·单季402记三分", "img/stephen-curry-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png"],
    ["Shaquille O'Neal", "沙奎尔·奥尼尔", "C", "PF", 212, 147, "洛杉矶湖人", "#fdb927", "#552583", "momentPurple", "anchor", 108, [79, 29, 73, 56, 91, 94, 91, 96, 94, 79, 78, 73, 87, 80, 94, 94, 89, 91, 94, 87, 94, 76, 94, 94, 84, 81, 94, 89, 96, 97], "1999-00", "常规赛MVP+FMVP·最具统治力一季", "img/shaquille-o-neal-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Shaquille_O%27Neal_October_2017_%28cropped%29.jpg"],
    ["Tim Duncan", "蒂姆·邓肯", "PF", "SF", 211, 113, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "momentPurple", "skilled_big", 109, [89, 94, 84, 94, 91, 94, 91, 96, 94, 78, 85, 72, 86, 83, 94, 94, 89, 91, 94, 87, 94, 92, 94, 94, 80, 80, 92, 89, 96, 97], "2002-03", "单核夺冠·总决赛准四双", "img/tim-duncan-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Tim_Duncan.jpg"],
    ["Larry Bird", "拉里·伯德", "SF", "PG", 206, 100, "波士顿凯尔特人", "#00a758", "#007a33", "momentPurple", "scorer", 110, [95, 95, 89, 95, 92, 95, 92, 97, 95, 101, 94, 95, 97, 95, 59, 72, 67, 90, 93, 86, 80, 95, 95, 95, 95, 95, 95, 88, 96, 96], "1985-86", "三连MVP·凯尔特人王朝", "img/larry-bird-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/1449.png"],
    ["Giannis Antetokounmpo", "扬尼斯·阿德托昆博", "PF", "C", 211, 110, "密尔沃基雄鹿", "#eee1c6", "#00471b", "momentPurple", "freak_forward", 108, [76, 41, 71, 71, 93, 96, 93, 98, 96, 102, 96, 96, 99, 96, 95, 96, 91, 93, 96, 89, 96, 94, 80, 91, 95, 95, 96, 91, 98, 99], "2020-21", "总决赛50分·FMVP", "img/giannis-antetokounmpo-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203507.png"],
    ["Nikola Jokić", "尼古拉·约基奇", "C", "PF", 208, 113, "丹佛掘金", "#fec524", "#0e2240", "momentPurple", "skilled_big", 110, [95, 92, 89, 95, 92, 95, 78, 84, 95, 77, 83, 71, 86, 77, 89, 95, 90, 92, 95, 88, 95, 89, 92, 95, 79, 79, 95, 90, 97, 98], "2022-23", "总决赛场均30+14+7·FMVP", "img/nikola-jokic-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203999.png"],
    ["Luka Dončić", "卢卡·东契奇", "PG", "SF", 201, 104, "达拉斯独行侠", "#00538c", "#002b5e", "momentPurple", "point_forward", 111, [96, 94, 90, 96, 93, 96, 84, 89, 96, 95, 89, 88, 96, 96, 52, 79, 75, 93, 96, 89, 96, 96, 93, 96, 80, 80, 69, 91, 98, 99], "2023-24", "得分王·带队杀进总决赛", "img/luka-doncic-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png"],
    ["Kevin Durant", "凯文·杜兰特", "SF", "PG", 208, 109, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "momentPurple", "scorer", 111, [96, 96, 90, 96, 93, 96, 93, 98, 96, 102, 95, 96, 93, 96, 63, 80, 75, 93, 96, 89, 86, 96, 96, 96, 96, 96, 96, 77, 85, 86], "2013-14", "常规赛MVP·场均32分", "img/kevin-durant-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201142.png"],
    ["Allen Iverson", "阿伦·艾弗森", "SG", "PG", 183, 75, "费城76人", "#ed174c", "#006bb6", "momentPurple", "slasher", 113, [97, 90, 91, 97, 94, 97, 94, 99, 97, 102, 97, 96, 91, 97, 71, 76, 72, 78, 81, 75, 95, 97, 97, 95, 97, 97, 97, 75, 82, 83], "2000-01", "MVP+得分王·一人扛进总决赛", "img/allen-iverson-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Allen_Iverson_headshot.jpg"],
    ["Dwyane Wade", "德维恩·韦德", "SG", "PG", 193, 100, "迈阿密热火", "#f9a01b", "#98002e", "momentPurple", "slasher", 113, [97, 95, 91, 97, 94, 97, 94, 99, 97, 100, 97, 94, 88, 97, 90, 69, 64, 74, 76, 70, 91, 97, 93, 93, 97, 97, 97, 71, 78, 79], "2005-06", "总决赛场均34.7分·FMVP", "img/dwyane-wade-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Dwyane_Wade_e1.jpg（黑色 HEAT 3 球衣）"],
    ["Dirk Nowitzki", "德克·诺维茨基", "PF", "SF", 213, 115, "达拉斯独行侠", "#00538c", "#002b5e", "momentPurple", "skilled_big", 111, [96, 96, 90, 96, 93, 96, 93, 98, 96, 79, 86, 73, 88, 84, 90, 96, 91, 93, 96, 89, 96, 92, 94, 96, 83, 83, 92, 91, 98, 99], "2010-11", "单核夺冠·FMVP", "img/dirk-nowitzki-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Dirk_Nowitzki_-_2019202181209_2019-07-21_Champions_for_Charity_-_1829_-_B70I1864.jpg"],
    ["Kevin Garnett", "凯文·加内特", "PF", "SF", 211, 114, "明尼苏达森林狼", "#78be20", "#0c2340", "momentPurple", "skilled_big", 111, [96, 93, 90, 96, 93, 96, 93, 98, 96, 102, 81, 96, 99, 77, 94, 96, 91, 93, 96, 89, 96, 86, 91, 90, 84, 84, 89, 91, 98, 99], "2003-04", "常规赛MVP·场均24+14+5", "img/kevin-garnett-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Kevin_Garnett_2008-01-13.jpg"],
    ["David Robinson", "大卫·罗宾逊", "C", "PF", 216, 107, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "momentPurple", "anchor", 109, [75, 68, 70, 95, 92, 95, 92, 97, 95, 79, 79, 73, 87, 83, 95, 95, 90, 92, 95, 88, 95, 74, 85, 85, 95, 92, 95, 90, 97, 98], "1994-95", "常规赛MVP·场均27.6分", "img/david-robinson-m.webp", 0, "https://commons.wikimedia.org/wiki/File:David_Robinson_%28Team_USA%29.jpg"],
    ["Karl Malone", "卡尔·马龙", "PF", "SF", 206, 116, "犹他爵士", "#f9a01b", "#002b5c", "momentPurple", "skilled_big", 112, [97, 94, 91, 97, 94, 97, 94, 99, 97, 83, 86, 76, 90, 84, 97, 97, 92, 94, 97, 90, 97, 91, 97, 97, 86, 86, 92, 92, 99, 100], "1996-97", "常规赛MVP·邮差", "img/karl-malone-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/252.png"],
    ["Patrick Ewing", "帕特里克·尤因", "C", "PF", 213, 109, "纽约尼克斯", "#f58426", "#006bb6", "momentPurple", "skilled_big", 109, [95, 81, 89, 95, 92, 95, 92, 97, 95, 64, 67, 57, 80, 67, 95, 95, 90, 92, 95, 88, 95, 77, 81, 95, 71, 68, 81, 90, 97, 98], "1993-94", "总决赛·纽约之王", "img/patrick-ewing-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Patrick_Ewing_Magic_cropped.jpg"],
    ["Kawhi Leonard", "科怀·伦纳德", "SF", "PF", 201, 104, "多伦多猛龙", "#ce1141", "#1a1a1a", "momentPurple", "point_forward", 109, [95, 94, 89, 95, 92, 95, 82, 87, 95, 101, 95, 95, 96, 92, 52, 78, 74, 90, 93, 86, 95, 95, 95, 95, 86, 86, 83, 85, 93, 94], "2018-19", "抢七绝杀·FMVP", "img/kawhi-leonard-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/202695.png"],
    ["Russell Westbrook", "拉塞尔·威斯布鲁克", "PG", "SF", 194, 87, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "momentPurple", "slasher", 109, [95, 73, 89, 95, 92, 95, 92, 97, 95, 99, 88, 93, 95, 95, 64, 72, 67, 79, 82, 75, 90, 95, 95, 95, 95, 95, 95, 85, 92, 93], "2016-17", "场均三双·常规赛MVP", "img/russell-westbrook-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201566.png"],
    ["James Harden", "詹姆斯·哈登", "SG", "PG", 196, 100, "休斯顿火箭", "#ce1141", "#1a1a1a", "momentPurple", "scorer", 110, [96, 96, 90, 96, 93, 96, 93, 98, 96, 90, 80, 84, 77, 96, 47, 57, 52, 75, 78, 72, 71, 96, 96, 96, 96, 96, 90, 58, 66, 67], "2017-18", "常规赛MVP·场均30.4分", "img/james-harden-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/201935.png"],
    ["Yao Ming", "姚明", "C", "PF", 229, 140, "休斯顿火箭", "#ce1141", "#1a1a1a", "momentGold", "skilled_big", 107, [82, 35, 76, 95, 92, 95, 92, 97, 95, 74, 95, 67, 85, 61, 95, 95, 90, 92, 95, 88, 95, 60, 74, 73, 63, 60, 95, 90, 97, 98], "2006-07", "场均25分9.4篮板·中国长城", "img/yao-ming-m.webp", 0, "https://commons.wikimedia.org/wiki/File:YaoMingonoffense2.jpg"],
    ["Tracy McGrady", "特雷西·麦克格雷迪", "SG", "SF", 203, 101, "奥兰多魔术", "#0077c0", "#1a1a1a", "momentGold", "point_forward", 107, [95, 91, 89, 85, 91, 94, 92, 97, 95, 76, 79, 70, 82, 83, 44, 64, 59, 84, 86, 80, 93, 94, 94, 95, 93, 93, 74, 82, 89, 90], "2002-03", "得分王·35秒13分", "img/tracy-mcgrady-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Tracy_McGrady_2008-02-13.jpg"],
    ["Vince Carter", "文斯·卡特", "SG", "PG", 198, 100, "多伦多猛龙", "#ce1141", "#1a1a1a", "momentGold", "slasher", 104, [89, 89, 83, 89, 90, 93, 90, 95, 93, 86, 74, 80, 74, 93, 52, 54, 49, 60, 63, 56, 78, 93, 87, 81, 93, 93, 93, 56, 64, 65], "1999-00", "扣篮大赛传奇·半人半神", "img/vince-carter-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Lipofsky_Vince_Carter.jpg"],
    ["Paul Pierce", "保罗·皮尔斯", "SF", "PG", 201, 107, "波士顿凯尔特人", "#00a758", "#007a33", "momentGold", "scorer", 107, [95, 95, 89, 95, 92, 95, 92, 97, 95, 98, 84, 92, 84, 95, 56, 69, 64, 87, 90, 84, 74, 95, 95, 90, 95, 95, 95, 63, 71, 72], "2007-08", "总决赛MVP·真理", "img/paul-pierce-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Paul_Pierce_2008-01-13_%28cropped%29.jpg"],
    ["Ray Allen", "雷·阿伦", "SG", "SF", 196, 96, "西雅图超音速", "#00653a", "#ffc200", "momentGold", "sniper", 105, [88, 94, 83, 94, 88, 91, 62, 68, 77, 92, 74, 85, 76, 94, 47, 56, 51, 57, 60, 53, 67, 94, 94, 90, 94, 94, 73, 53, 61, 62], "2004-05", "超音速双子星·三分大师", "img/ray-allen-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Ray_Allen_2008-01-13.jpg"],
    ["Steve Nash", "史蒂夫·纳什", "PG", "SG", 190, 89, "菲尼克斯太阳", "#e56020", "#1d1160", "momentGold", "floor_gen", 105, [94, 92, 88, 93, 91, 94, 53, 59, 74, 84, 85, 77, 72, 93, 34, 52, 47, 58, 61, 54, 60, 92, 94, 94, 94, 94, 68, 53, 61, 62], "2004-05", "蝉联MVP·跑轰太阳", "img/steve-nash-m.webp", 0, "https://commons.wikimedia.org/wiki/File:SteveNash2014.jpg"],
    ["Jason Kidd", "贾森·基德", "PG", "SG", 193, 93, "新泽西篮网", "#003da5", "#cd1041", "momentGold", "floor_gen", 105, [94, 88, 88, 94, 91, 94, 50, 56, 72, 80, 94, 73, 81, 94, 34, 43, 38, 55, 58, 51, 57, 94, 94, 94, 94, 94, 62, 75, 83, 84], "2001-02", "联盟第一控卫·带队两进总决赛", "img/jason-kidd-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Jason_Kidd.jpg"],
    ["Reggie Miller", "雷吉·米勒", "SG", "SF", 201, 84, "印第安纳步行者", "#fdbb30", "#002d62", "momentGold", "sniper", 106, [95, 95, 89, 94, 85, 88, 63, 69, 91, 90, 74, 84, 74, 95, 39, 57, 52, 57, 60, 53, 65, 95, 95, 86, 95, 95, 70, 52, 60, 61], "1994-95", "8.9秒8分·米勒时刻", "img/reggie-miller-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Reggie_Miller_TNT_cropped.jpg"],
    ["Gary Payton", "加里·佩顿", "PG", "SG", 193, 82, "西雅图超音速", "#00653a", "#ffc200", "momentGold", "floor_gen", 106, [95, 95, 89, 95, 92, 95, 44, 50, 67, 79, 85, 73, 64, 95, 31, 43, 38, 53, 56, 49, 53, 95, 95, 95, 94, 94, 58, 42, 50, 51], "1995-96", "最佳防守球员·手套", "img/gary-payton-m.webp", 0, ""],
    ["Chris Paul", "克里斯·保罗", "PG", "SG", 183, 79, "新奥尔良黄蜂", "#0d5e4a", "#c8a24a", "momentGold", "floor_gen", 106, [91, 95, 85, 95, 92, 95, 47, 53, 77, 84, 91, 77, 69, 91, 29, 44, 39, 53, 56, 49, 56, 93, 95, 95, 91, 91, 67, 47, 55, 56], "2007-08", "MVP票选第二·控卫之神", "img/chris-paul-m.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/101108.png"],
    ["Dwight Howard", "德怀特·霍华德", "C", "PF", 208, 125, "奥兰多魔术", "#0077c0", "#1a1a1a", "momentGold", "anchor", 103, [71, 62, 65, 48, 90, 93, 89, 94, 93, 73, 71, 67, 83, 71, 92, 91, 86, 90, 93, 86, 92, 65, 76, 81, 73, 71, 93, 87, 94, 95], "2008-09", "最佳防守球员·单核总决赛", "img/dwight-howard-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201575.png"],
    ["Derrick Rose", "德里克·罗斯", "PG", "SF", 191, 86, "芝加哥公牛", "#ce1141", "#1a1a1a", "momentGold", "slasher", 106, [91, 90, 85, 92, 91, 94, 86, 92, 95, 88, 78, 82, 77, 95, 52, 64, 59, 66, 69, 62, 84, 92, 87, 82, 95, 95, 95, 59, 67, 68], "2010-11", "最年轻MVP", "img/derrick-rose-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/201565.png"],
    ["Tony Parker", "托尼·帕克", "PG", "SF", 188, 81, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "momentGold", "scorer", 104, [90, 94, 84, 94, 91, 94, 85, 91, 86, 78, 69, 72, 64, 94, 36, 44, 39, 67, 70, 63, 57, 91, 92, 92, 94, 94, 80, 43, 51, 52], "2006-07", "总决赛MVP·法国跑车", "img/tony-parker-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Tony_Parker_2011-01_%28cropped%29.jpg"],
    ["Manu Ginóbili", "马努·吉诺比利", "SG", "PG", 187, 93, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "momentGold", "scorer", 104, [94, 94, 88, 93, 91, 94, 81, 86, 94, 79, 92, 73, 64, 93, 34, 43, 38, 68, 71, 64, 59, 94, 92, 71, 91, 91, 75, 41, 49, 50], "2004-05", "妖刀·阿根廷飞人", "img/manu-ginobili-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Manu_Ginobili_Spurs-Magic011_%28cropped%29.jpg"],
    ["Pau Gasol", "保罗·加索尔", "C", "PF", 215, 113, "洛杉矶湖人", "#fdb927", "#552583", "momentGold", "skilled_big", 104, [94, 75, 88, 94, 91, 94, 88, 94, 85, 62, 64, 55, 79, 60, 75, 91, 86, 91, 94, 87, 92, 74, 77, 92, 67, 64, 73, 89, 96, 97], "2008-09", "总冠军二当家", "img/pau-gasol-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Pau_Gasol_2022_%28cropped%29.png"],
    ["Chris Bosh", "克里斯·波什", "PF", "SF", 211, 107, "迈阿密热火", "#f9a01b", "#98002e", "momentGold", "skilled_big", 104, [94, 84, 88, 94, 91, 94, 91, 96, 94, 66, 68, 59, 81, 71, 84, 94, 89, 91, 94, 87, 94, 77, 82, 94, 71, 68, 82, 89, 96, 97], "2012-13", "关键篮板·龙王", "img/chris-bosh-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Chris_Bosh_Heat_vs_Wizards_2010.jpg"],
    ["Amar'e Stoudemire", "阿玛雷·斯塔德迈尔", "PF", "SF", 208, 111, "菲尼克斯太阳", "#e56020", "#1d1160", "momentGold", "skilled_big", 103, [94, 81, 88, 94, 91, 94, 91, 96, 94, 62, 71, 55, 79, 64, 74, 94, 89, 91, 94, 87, 94, 75, 79, 94, 70, 67, 73, 89, 96, 97], "2004-05", "小霸王·挡拆终结者", "img/amar-e-stoudemire-m.webp", 0, ""],
    ["Shawn Marion", "肖恩·马里昂", "SF", "PG", 201, 100, "菲尼克斯太阳", "#e56020", "#1d1160", "momentGold", "scorer", 103, [94, 94, 88, 94, 91, 94, 75, 81, 75, 100, 94, 94, 89, 94, 62, 76, 72, 53, 56, 49, 94, 83, 94, 79, 94, 94, 94, 73, 80, 81], "2005-06", "骇客·全能锋线", "img/shawn-marion-m.webp", 0, ""],
    ["Ben Wallace", "本·华莱士", "C", "PF", 206, 109, "底特律活塞", "#c8102e", "#1d42ba", "momentGold", "anchor", 103, [53, 27, 47, 83, 91, 94, 91, 96, 94, 61, 64, 54, 78, 65, 94, 94, 89, 91, 94, 87, 94, 55, 61, 76, 63, 60, 94, 89, 96, 97], "2003-04", "四届最佳防守球员", "img/ben-wallace-m.webp", 0, ""],
    ["Carmelo Anthony", "卡梅隆·安东尼", "SF", "PG", 203, 100, "纽约尼克斯", "#f58426", "#006bb6", "momentGold", "scorer", 105, [95, 85, 89, 95, 92, 95, 92, 97, 88, 95, 81, 88, 81, 95, 51, 60, 55, 85, 88, 82, 75, 95, 95, 95, 95, 95, 95, 60, 68, 69], "2012-13", "得分王·甜瓜", "img/carmelo-anthony-m.webp", 0, "用户提供透明底照片库（carmelo-anthony__kindpng-07）"],
    ["Grant Hill", "格兰特·希尔", "SF", "C", 203, 102, "底特律活塞", "#c8102e", "#1d42ba", "momentGold", "freak_forward", 104, [85, 47, 80, 70, 90, 93, 92, 97, 95, 92, 74, 85, 94, 95, 95, 95, 90, 85, 88, 82, 95, 84, 66, 93, 95, 95, 95, 90, 97, 98], "1996-97", "全能前锋·活塞希望", "img/grant-hill-m.webp", 0, "https://a.espncdn.com/i/headshots/nba/players/full/336.png"],
    ["Penny Hardaway", "安芬尼·哈达威", "PG", "SF", 201, 100, "奥兰多魔术", "#0077c0", "#1a1a1a", "momentGold", "point_forward", 102, [88, 87, 83, 85, 91, 94, 69, 74, 94, 74, 71, 68, 77, 77, 40, 65, 60, 82, 84, 78, 87, 92, 85, 93, 76, 76, 67, 74, 82, 83], "1995-96", "便士·魔术双核", "img/penny-hardaway-m.webp", 0, ""],
    ["Alonzo Mourning", "阿隆佐·莫宁", "C", "PF", 208, 109, "迈阿密热火", "#f9a01b", "#98002e", "momentGold", "anchor", 102, [66, 59, 60, 80, 89, 92, 91, 96, 89, 70, 65, 63, 80, 67, 93, 92, 87, 91, 94, 87, 91, 62, 69, 71, 76, 73, 93, 84, 92, 93], "1999-00", "最佳防守球员·铁血中锋", "img/alonzo-mourning-m.webp", 0, ""],
    ["Dikembe Mutombo", "迪肯贝·穆托姆博", "C", "PF", 218, 111, "丹佛掘金", "#fec524", "#0e2240", "momentGold", "anchor", 105, [65, 25, 59, 85, 92, 95, 92, 97, 95, 71, 70, 64, 83, 73, 95, 95, 90, 91, 94, 87, 95, 62, 74, 77, 74, 72, 95, 88, 96, 96], "1993-94", "黑八奇迹·摇手指", "img/dikembe-mutombo-m.webp", 0, "https://commons.wikimedia.org/wiki/File:Dikembe_Mutombo_at_the_Aspire4Sport_Congress_in_Doha._crop.jpg"],
    ["Gilbert Arenas", "吉尔伯特·阿里纳斯", "PG", "SG", 193, 87, "华盛顿奇才", "#e31837", "#002b5c", "momentGold", "floor_gen", 103, [93, 95, 87, 95, 83, 85, 39, 45, 95, 75, 68, 69, 61, 85, 25, 33, 28, 44, 47, 40, 46, 95, 92, 95, 83, 83, 53, 40, 48, 49], "2005-06", "零号特工·场均29.3分", "img/gilbert-arenas-m.webp", 0, "https://a.espncdn.com/i/headshots/nba/players/full/974.png"],
    ["Hakeem Olajuwon", "哈基姆·奥拉朱旺", "C", "PF", 213, 116, "休斯顿火箭", "#ce1141", "#1a1a1a", "momentPurple", "skilled_big", 110, [95, 85, 89, 95, 92, 95, 92, 97, 87, 74, 95, 67, 85, 74, 95, 95, 90, 92, 95, 88, 95, 80, 88, 95, 73, 70, 83, 90, 97, 98], "1993-94", "MVP+DPOY+FMVP·梦幻脚步", "img/hakeem-olajuwon-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/165.png"],
    ["Magic Johnson", "魔术师约翰逊", "PG", "SF", 206, 100, "洛杉矶湖人", "#fdb927", "#552583", "momentPurple", "point_forward", 113, [97, 97, 91, 97, 94, 97, 87, 92, 97, 91, 88, 85, 94, 97, 58, 79, 75, 91, 94, 87, 97, 97, 97, 97, 93, 93, 82, 91, 98, 99], "1986-87", "常规赛MVP+FMVP·Showtime巅峰", "img/magic-johnson-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/77142.png"],
    ["Michael Jordan", "迈克尔·乔丹", "SG", "PG", 198, 90, "芝加哥公牛", "#ce1141", "#1a1a1a", "momentPurple", "scorer", 111, [95, 89, 89, 95, 92, 95, 92, 97, 95, 96, 95, 89, 90, 95, 69, 60, 55, 92, 95, 88, 87, 95, 95, 89, 95, 95, 95, 79, 86, 87], "1995-96", "72胜公牛·常规赛MVP+得分王+FMVP", "img/michael-jordan-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/893.png"],
    ["Charles Barkley", "查尔斯·巴克利", "PF", "SF", 195, 114, "菲尼克斯太阳", "#e56020", "#1d1160", "momentPurple", "skilled_big", 112, [97, 82, 91, 97, 94, 97, 94, 99, 97, 88, 87, 82, 93, 84, 96, 97, 92, 94, 97, 90, 97, 97, 97, 97, 89, 89, 97, 92, 99, 100], "1992-93", "常规赛MVP·飞猪", "img/charles-barkley-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/787.png"],
    ["Scottie Pippen", "斯科蒂·皮蓬", "SF", "PF", 204, 103, "芝加哥公牛", "#ce1141", "#1a1a1a", "momentPurple", "point_forward", 109, [97, 97, 91, 96, 87, 90, 80, 86, 97, 101, 92, 95, 98, 93, 52, 77, 73, 92, 95, 88, 97, 97, 97, 90, 89, 89, 83, 89, 97, 98], "1993-94", "乔丹退役年的全能表现", "img/scottie-pippen-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/937.png"],
    ["Shawn Kemp", "肖恩·坎普", "PF", "SF", 208, 104, "西雅图超音速", "#00653a", "#ffc200", "momentGold", "skilled_big", 102, [94, 78, 88, 94, 91, 94, 91, 96, 93, 64, 66, 57, 80, 63, 78, 84, 79, 91, 94, 87, 94, 73, 78, 94, 71, 68, 94, 89, 96, 97], "1995-96", "雨人·暴力美学", "img/shawn-kemp-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/431.png"],
    ["Chris Webber", "克里斯·韦伯", "PF", "C", 206, 111, "萨克拉门托国王", "#5a2d81", "#63727a", "momentGold", "freak_forward", 103, [84, 47, 78, 69, 92, 95, 92, 97, 94, 85, 70, 79, 90, 95, 92, 95, 90, 90, 93, 86, 95, 92, 65, 87, 87, 87, 95, 88, 96, 96], "2001-02", "国王核心·华丽传球", "img/chris-webber-m.webp", 0, "https://cdn.nba.com/headshots/nba/latest/1040x760/185.png"],
    ["Chauncey Billups", "昌西·比卢普斯", "PG", "SG", 191, 95, "底特律活塞", "#c8102e", "#1d42ba", "momentGold", "floor_gen", 105, [88, 90, 83, 92, 88, 91, 52, 58, 76, 86, 86, 79, 74, 96, 31, 46, 41, 56, 59, 52, 57, 97, 97, 88, 95, 95, 64, 54, 62, 63], "2003-04", "总决赛MVP·关键先生", "img/chauncey-billups-m.webp", 0, "https://a.espncdn.com/i/headshots/nba/players/full/63.png"],
    ["Chet Holmgren", "切特·霍姆格伦", "C", "PF", 216, 94, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "gold", "anchor", 88, [39, 37, 33, 60, 72, 75, 76, 81, 63, 49, 50, 42, 72, 51, 88, 91, 87, 70, 73, 66, 85, 37, 50, 50, 53, 50, 72, 87, 94, 95], "", "", "img/chet-holmgren.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1631096.png"],
    ["Evan Mobley", "埃文·莫布利", "C", "PF", 211, 98, "克利夫兰骑士", "#fdbb30", "#860038", "gold", "skilled_big", 89, [75, 64, 69, 76, 78, 81, 75, 80, 72, 52, 50, 45, 68, 55, 61, 70, 65, 84, 87, 80, 77, 64, 69, 78, 53, 50, 62, 77, 85, 86], "", "", "img/evan-mobley.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630596.png"],
    ["Scottie Barnes", "斯科蒂·巴恩斯", "SF", "PF", 203, 102, "多伦多猛龙", "#ce1141", "#1a1a1a", "gold", "freak_forward", 88, [59, 31, 53, 57, 83, 86, 83, 88, 84, 76, 59, 70, 80, 77, 76, 79, 75, 71, 74, 67, 84, 74, 54, 68, 76, 73, 84, 78, 86, 87], "", "", "img/scottie-barnes.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630567.png"],
    ["Tyrese Maxey", "泰瑞斯·马克西", "PG", "SG", 188, 91, "费城76人", "#ed174c", "#006bb6", "gold", "floor_gen", 89, [78, 76, 73, 85, 75, 77, 29, 35, 56, 69, 62, 62, 54, 74, 25, 30, 25, 33, 36, 29, 41, 83, 78, 88, 75, 72, 45, 33, 41, 42], "", "", "img/tyrese-maxey.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1630178.png"],
    ["Tyler Herro", "泰勒·希罗", "SG", "PG", 196, 93, "迈阿密热火", "#f9a01b", "#98002e", "gold", "sniper", 86, [84, 91, 78, 86, 67, 70, 37, 43, 54, 68, 49, 61, 50, 76, 25, 31, 26, 35, 38, 31, 40, 76, 87, 65, 72, 69, 47, 25, 33, 34], "", "", "img/tyler-herro.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629639.png"],
    ["Clint Capela", "克林特·卡佩拉", "C", "PF", 208, 116, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "big_man", 81, [33, 25, 27, 53, 72, 75, 77, 83, 68, 42, 40, 35, 63, 49, 73, 80, 76, 59, 62, 55, 83, 33, 47, 42, 54, 51, 72, 76, 84, 85], "", "", "img/clint-capela.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/203991.png"],
    ["Malcolm Brogdon", "马尔科姆·布罗格登", "PG", "SG", 196, 104, "印第安纳步行者", "#fdbb30", "#002d62", "silver", "three_d", 80, [70, 79, 64, 73, 60, 63, 48, 54, 44, 85, 66, 78, 69, 73, 35, 49, 44, 29, 32, 25, 56, 57, 82, 53, 72, 69, 65, 45, 53, 54], "", "", "img/malcolm-brogdon.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1627763.png"],
    ["Terry Rozier", "特里·罗齐尔", "PG", "SG", 185, 86, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "three_d", 79, [63, 76, 57, 76, 61, 64, 50, 56, 45, 87, 70, 81, 72, 70, 31, 45, 40, 25, 26, 25, 60, 60, 80, 51, 69, 66, 59, 49, 57, 58], "", "", "img/terry-rozier.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626179.png"],
    ["Kelly Oubre Jr.", "小凯利·乌布雷", "SF", "SG", 201, 92, "金州勇士", "#ffc72c", "#1d428a", "silver", "two_way", 78, [65, 65, 59, 68, 66, 69, 61, 67, 55, 79, 70, 73, 72, 69, 44, 59, 54, 45, 48, 41, 54, 63, 63, 59, 65, 62, 65, 57, 65, 66], "", "", "img/kelly-oubre-jr.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626162.png"],
    ["Robert Williams III", "罗伯特·威廉姆斯", "C", "PF", 206, 108, "波士顿凯尔特人", "#00a758", "#007a33", "silver", "big_man", 78, [31, 25, 25, 50, 66, 69, 73, 78, 59, 40, 36, 33, 60, 46, 75, 78, 74, 56, 59, 52, 82, 25, 42, 39, 46, 43, 70, 74, 81, 82], "", "", "img/robert-williams-iii.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1629057.png"],
    ["Christian Wood", "克里斯蒂安·伍德", "C", "PF", 208, 97, "底特律活塞", "#c8102e", "#1d42ba", "silver", "big_man", 76, [28, 25, 25, 46, 64, 67, 75, 80, 60, 35, 36, 28, 56, 42, 72, 74, 69, 55, 58, 51, 80, 27, 38, 33, 45, 42, 67, 71, 78, 79], "", "", "img/christian-wood.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1626174.png"],
    ["Marvin Bagley III", "马文·巴格利三世", "PF", "C", 211, 107, "底特律活塞", "#c8102e", "#1d42ba", "silver", "big_man", 75, [36, 28, 30, 54, 73, 76, 83, 88, 71, 40, 37, 33, 64, 55, 80, 84, 79, 60, 63, 56, 87, 29, 49, 44, 54, 51, 73, 80, 87, 88], "", "", "img/marvin-bagley-iii.webp", 1, "https://cdn.nba.com/headshots/nba/latest/1040x760/1628963.png"],
  ["Dennis Rodman","丹尼斯·罗德曼","SF","PF",201,100,"芝加哥公牛","#ce1141","#1a1a1a","legendPurple","anchor",96,[99,69,93,99,96,99,96,102,99,90,99,83,95,99,99,99,94,96,99,92,99,99,99,99,99,99,99,94,102,103],"","","img/dennis-rodman.webp",0,"用户提供透明底照片"],
  ["Moses Malone","摩西·马龙","C","PF",208,118,"费城76人","#ed174c","#006bb6","legendPurple","big_man",96,[70,59,64,99,96,99,96,102,99,75,99,68,88,99,99,99,94,96,99,92,99,63,99,99,99,96,99,94,102,103],"","","img/moses-malone.webp",0,"用户提供透明底照片"],
  ["James Worthy","詹姆斯·沃西","SF","PF",206,102,"洛杉矶湖人","#fdb927","#552583","legendPurple","slasher",96,[99,99,93,99,96,99,96,102,99,103,99,99,93,99,70,77,72,96,99,92,99,99,99,99,99,99,99,74,82,83],"","","img/james-worthy.webp",0,"用户提供透明底照片"],
  ["Bernard King","伯纳德·金","SF","PF",201,93,"纽约尼克斯","#f58426","#006bb6","purple","scorer",92,[99,99,93,99,96,99,96,102,99,103,91,97,87,99,55,65,60,87,90,83,76,99,99,97,99,99,96,63,71,72],"","","img/bernard-king.webp",0,"用户提供透明底照片"],
  ["Otis Thorpe","奥蒂斯·索普","PF","C",208,102,"休斯顿火箭","#ce1141","#1a1a1a","silver","big_man",76,[57,46,51,75,92,95,96,102,84,63,59,56,82,68,95,99,94,80,83,76,99,50,62,62,74,71,91,94,102,103],"","","img/otis-thorpe.webp",0,"用户提供透明底照片"],
  ["Mitch Richmond","米奇·里奇蒙德","SG","SF",196,98,"萨克拉门托国王","#5a2d81","#63727a","legendPurple","scorer",98,[99,99,93,99,96,99,96,102,99,103,96,98,93,99,58,70,65,91,94,87,85,99,99,99,99,99,99,74,82,83],"","","img/mitch-richmond.webp",0,"用户提供透明底照片"],
  ["Kevin Johnson","凯文·约翰逊","PG","SG",185,86,"菲尼克斯太阳","#e56020","#1d1160","purple","floor_gen",94,[99,99,93,99,96,99,55,61,82,95,90,88,77,99,41,52,47,60,63,56,62,99,99,99,98,98,72,53,61,62],"","","img/kevin-johnson.webp",0,"用户提供透明底照片"],
  ["Dan Majerle","丹·马尔利","SG","SF",198,98,"菲尼克斯太阳","#e56020","#1d1160","purple","three_d",94,[99,99,93,99,96,99,80,86,79,103,99,99,96,99,65,82,77,62,65,58,88,92,99,88,99,99,91,79,87,88],"","","img/dan-majerle.webp",0,"用户提供透明底照片"],
  ["Eddie Jones","埃迪·琼斯","SG","SF",198,91,"迈阿密热火","#f9a01b","#98002e","purple","two_way",91,[93,96,87,92,89,92,90,96,84,103,93,99,98,92,75,85,80,71,74,67,87,91,92,84,93,93,90,83,91,92],"","","img/eddie-jones.webp",0,"用户提供透明底照片"],
  ["Allan Houston","阿兰·休斯顿","SG","SF",198,93,"纽约尼克斯","#f58426","#006bb6","purple","sniper",92,[99,99,93,99,89,92,65,71,81,100,81,93,80,99,49,59,54,59,62,55,67,99,99,91,99,99,76,53,61,62],"","","img/allan-houston.webp",0,"用户提供透明底照片"],
  ["Jeff Hornacek","杰夫·霍纳塞克","SG","SF",193,86,"犹他爵士","#f9a01b","#002b5c","purple","sniper",95,[99,99,93,99,96,99,72,78,86,103,81,96,85,99,53,63,58,69,72,65,74,99,99,99,99,99,85,61,69,70],"","","img/jeff-hornacek.webp",0,"用户提供透明底照片"],
  ["Charles Oakley","查尔斯·奥克利","PF","C",203,111,"纽约尼克斯","#f58426","#006bb6","purple","big_man",90,[73,62,67,99,96,99,96,102,99,74,74,67,87,99,99,99,94,96,99,92,99,68,99,86,99,96,99,94,102,103],"","","img/charles-oakley.webp",0,"用户提供透明底照片"],
  ["Derrick Coleman","德里克·科尔曼","PF","C",208,104,"布鲁克林篮网","#c9ced4","#1a1a1a","purple","skilled_big",93,[99,93,93,99,96,99,96,102,96,75,81,68,88,77,89,98,93,96,99,92,99,91,92,99,84,84,92,94,102,103],"","","img/derrick-coleman.webp",0,"用户提供透明底照片"],
  ["Steve Kerr","史蒂夫·科尔","PG","SG",191,79,"芝加哥公牛","#ce1141","#1a1a1a","gold","sniper",85,[99,99,93,99,79,82,54,60,68,88,72,81,71,92,37,49,44,51,54,47,55,94,99,78,89,89,64,47,55,56],"","","img/steve-kerr.webp",0,"用户提供透明底照片"],
  ["Nick Van Exel","尼克·范埃克塞尔","PG","SG",185,86,"洛杉矶湖人","#fdb927","#552583","gold","spark",84,[90,89,84,96,90,93,75,81,82,79,76,72,66,97,35,48,43,46,49,42,59,90,93,75,95,95,81,47,55,56],"","","img/nick-van-exel.webp",0,"用户提供透明底照片"],
  ["Bruce Bowen","布鲁斯·鲍文","SF","PF",201,84,"圣安东尼奥马刺","#c4ced4","#1a1a1a","gold","three_d",89,[98,99,92,99,92,95,80,86,79,103,98,99,96,99,63,81,76,57,60,53,91,87,99,86,99,99,90,80,88,89],"","","img/bruce-bowen.webp",0,"用户提供透明底照片"],
  ["David West","大卫·韦斯特","PF","C",206,113,"新奥尔良鹈鹕","#e31837","#0c2340","purple","skilled_big",94,[99,93,93,99,96,99,96,102,99,80,86,73,90,80,93,99,94,96,99,92,99,94,94,99,84,84,92,94,102,103],"","","img/david-west.webp",0,"用户提供透明底照片"],
  ["Jalen Rose","杰伦·罗斯","SF","PF",203,95,"印第安纳步行者","#fdbb30","#002d62","purple","scorer",94,[99,99,93,99,96,99,96,102,99,103,90,96,89,99,57,72,67,94,97,90,86,99,99,99,99,99,99,68,76,77],"","","img/jalen-rose.webp",0,"用户提供透明底照片"],
  ["Andre Miller","安德烈·米勒","PG","SG",188,91,"丹佛掘金","#fec524","#0e2240","silver","floor_gen",76,[82,83,76,81,74,77,33,39,56,69,63,62,54,80,25,29,25,38,41,34,40,86,78,90,75,75,50,32,40,41],"","","img/andre-miller.webp",0,"用户提供透明底照片"],
  ["Brad Miller","布拉德·米勒","C","PF",211,118,"萨克拉门托国王","#5a2d81","#63727a","silver","skilled_big",78,[81,67,75,77,81,84,78,84,76,53,55,46,70,54,66,77,72,89,92,85,85,65,74,83,55,52,67,80,88,89],"","","img/brad-miller.webp",0,"用户提供透明底照片"],
  ["Matt Barnes","马特·巴恩斯","SF","PF",201,103,"金州勇士","#ffc72c","#1d428a","silver","two_way",75,[78,79,72,79,80,83,71,77,67,91,84,84,84,84,61,66,61,60,63,56,73,74,79,74,78,75,75,71,79,80],"","","img/matt-barnes.webp",0,"用户提供透明底照片"],
  ["Raja Bell","拉加·贝尔","SG","SF",196,95,"菲尼克斯太阳","#e56020","#1d1160","silver","three_d",75,[78,91,72,85,68,71,59,65,54,96,75,89,81,81,43,57,52,35,38,31,66,66,90,62,77,74,70,60,68,69],"","","img/raja-bell.webp",0,"用户提供透明底照片"],
  ["Larry Hughes","拉里·休斯","SG","SF",196,84,"华盛顿奇才","#e31837","#002b5c","silver","two_way",81,[82,83,76,82,84,87,77,83,75,97,85,90,89,83,65,73,68,63,66,59,75,78,83,72,82,79,81,74,82,83],"","","img/larry-hughes.webp",0,"用户提供透明底照片"],
  ["Eddy Curry","埃迪·科里","C","PF",211,129,"纽约尼克斯","#f58426","#006bb6","silver","big_man",81,[50,41,44,70,89,92,92,98,83,56,52,49,78,66,87,94,89,73,76,69,98,46,58,57,68,65,87,93,101,102],"","","img/eddy-curry.webp",0,"用户提供透明底照片"],
  ["Brian Scalabrine","布莱恩·斯卡拉布莱恩","PF","C",206,107,"波士顿凯尔特人","#00a758","#007a33","silver","three_d",80,[84,96,78,90,79,82,69,75,61,103,87,99,90,88,57,67,62,42,45,38,74,78,99,75,88,85,84,68,76,77],"","","img/brian-scalabrine.webp",0,"用户提供透明底照片"],
  ["Luke Walton","卢克·沃尔顿","SF","PF",203,107,"洛杉矶湖人","#fdb927","#552583","silver","point_forward",81,[90,85,84,82,86,89,72,78,89,74,71,67,78,79,38,61,56,83,86,79,86,92,86,99,77,77,64,75,83,84],"","","img/luke-walton.webp",0,"用户提供透明底照片"],
  ["Tyronn Lue","泰伦·卢","PG","SG",183,79,"洛杉矶湖人","#fdb927","#552583","silver","spark",76,[79,83,73,88,81,84,70,76,73,70,64,63,59,90,27,42,37,40,43,36,52,82,84,73,84,81,76,41,49,50],"","","img/tyronn-lue.webp",0,"用户提供透明底照片"],
  ["Carlos Arroyo","卡洛斯·阿罗约","PG","SG",188,92,"犹他爵士","#f9a01b","#002b5c","silver","floor_gen",80,[88,88,82,86,79,82,36,42,63,72,71,65,58,80,25,34,29,43,46,39,44,89,85,98,78,78,54,38,46,47],"","","img/carlos-arroyo.webp",0,"用户提供透明底照片"],
  ["Shaun Livingston","肖恩·利文斯顿","PG","SG",201,87,"金州勇士","#ffc72c","#1d428a","gold","floor_gen",87,[96,94,90,94,90,93,42,48,69,81,76,74,67,87,27,42,37,47,50,43,48,98,94,99,85,85,58,47,55,56],"","","img/shaun-livingston.webp",0,"用户提供透明底照片"],
  ["Nick Young","尼克·杨","SG","SF",201,95,"洛杉矶湖人","#fdb927","#552583","gold","spark",87,[91,92,85,94,93,96,83,89,84,82,75,75,70,99,40,48,43,55,58,51,65,97,90,83,97,97,89,52,60,61],"","","img/nick-young.webp",0,"用户提供透明底照片"],
  ["Lance Stephenson","兰斯·史蒂芬森","SG","SF",196,104,"印第安纳步行者","#fdbb30","#002d62","gold","spark",87,[93,91,87,93,89,92,83,89,88,86,80,79,73,97,38,49,44,53,56,49,62,97,92,81,97,97,88,53,61,62],"","","img/lance-stephenson.webp",0,"用户提供透明底照片"],
  ["Robin Lopez","罗宾·洛佩斯","C","PF",213,127,"波特兰开拓者","#e03a3e","#1a1a1a","gold","big_man",86,[58,41,52,75,94,97,95,101,87,58,55,51,79,72,98,99,94,83,86,79,99,49,64,58,74,71,96,94,102,103],"","","img/robin-lopez.webp",0,"用户提供透明底照片"],
  ["Corey Brewer","科里·布鲁尔","SF","PF",206,84,"明尼苏达森林狼","#78be20","#0c2340","silver","slasher",76,[75,77,69,82,95,98,90,96,87,80,69,73,65,95,39,49,44,56,59,52,67,93,78,68,95,95,92,43,51,52],"","","img/corey-brewer.webp",0,"用户提供透明底照片"],
  ["Chandler Parsons","钱德勒·帕森斯","SF","PF",206,104,"休斯顿火箭","#ce1141","#1a1a1a","gold","three_d",87,[94,99,88,99,91,94,78,84,70,103,95,99,95,99,60,77,72,56,59,52,88,88,99,83,97,97,92,77,85,86],"","","img/chandler-parsons.webp",0,"用户提供透明底照片"],
  ["Reggie Jackson","雷吉·杰克逊","PG","SG",188,94,"底特律活塞","#c8102e","#1d42ba","gold","spark",88,[89,93,83,94,91,94,79,85,85,88,80,81,74,96,39,53,48,50,53,46,64,96,95,85,98,98,88,53,61,62],"","","img/reggie-jackson.webp",0,"用户提供透明底照片"],
  ["Hassan Whiteside","哈桑·怀特塞德","C","PF",213,120,"迈阿密热火","#f9a01b","#98002e","gold","anchor",86,[60,54,54,72,89,92,92,98,81,62,65,55,81,68,99,99,94,86,89,82,99,57,66,72,66,63,89,94,102,103],"","","img/hassan-whiteside.webp",0,"用户提供透明底照片"],
  ["Darren Collison","达伦·科里森","PG","SG",183,79,"印第安纳步行者","#fdbb30","#002d62","silver","floor_gen",79,[83,83,77,87,81,84,36,42,62,70,67,63,58,78,25,36,31,44,47,40,46,95,83,94,77,77,53,39,47,48],"","","img/darren-collison.webp",0,"用户提供透明底照片"],
  ["Jared Dudley","贾莱德·杜德利","PF","C",201,108,"菲尼克斯太阳","#e56020","#1d1160","silver","three_d",79,[84,95,78,90,77,80,67,73,62,103,85,99,90,89,53,68,63,47,50,43,73,74,99,72,90,87,81,68,76,77],"","","img/jared-dudley.webp",0,"用户提供透明底照片"],
  ["Channing Frye","钱宁·弗莱","PF","C",211,111,"菲尼克斯太阳","#e56020","#1d1160","silver","three_d",80,[89,96,83,95,78,81,73,79,65,103,85,97,88,87,51,65,60,46,49,42,77,82,99,70,92,89,83,65,73,74],"","","img/channing-frye.webp",0,"用户提供透明底照片"],
  ["Ish Smith","伊斯梅尔·史密斯","PG","SG",183,79,"底特律活塞","#c8102e","#1d42ba","silver","spark",75,[77,79,71,84,79,82,69,75,75,74,66,67,60,85,25,38,33,38,41,34,49,82,81,71,83,80,76,39,47,48],"","","img/ish-smith.webp",0,"用户提供透明底照片"],
  ["Buddy Hield", "巴迪·希尔德", "SG", "SF", 193, 100, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "sniper", 85, [99, 99, 93, 99, 80, 83, 51, 57, 69, 88, 67, 81, 71, 92, 33, 49, 44, 50, 53, 46, 53, 89, 99, 78, 89, 89, 68, 47, 55, 56], "", "", "img/buddy-hield.webp", 1, "用户提供透明底照片"],
  ["Bobby Portis","鲍比·波蒂斯","PF","C",208,113,"密尔沃基雄鹿","#eee1c6","#00471b","gold","big_man",84,[61,52,55,99,96,99,96,102,99,69,70,62,85,75,99,99,94,96,99,92,99,57,75,70,94,91,99,94,102,103],"","","img/bobby-portis.webp",1,"用户提供透明底照片"],
  ["Caris LeVert","卡里斯·勒弗特","SG","SF",198,93,"克利夫兰骑士","#fdbb30","#860038","silver","spark",75,[80,78,74,84,82,85,67,73,72,69,68,62,59,83,25,40,35,42,45,38,49,82,78,71,86,83,73,42,50,51],"","","img/caris-levert.webp",1,"用户提供透明底照片"],
  ["Kevon Looney","凯文·卢尼","C","PF",206,100,"金州勇士","#ffc72c","#1d428a","silver","big_man",80,[51,40,45,65,85,88,92,98,83,54,49,47,76,62,86,97,92,73,76,69,98,45,56,57,68,65,89,91,99,100],"","","img/kevon-looney.webp",1,"用户提供透明底照片"],
  ["Dorian Finney-Smith", "多利安·芬尼-史密斯", "SF", "PF", 201, 100, "达拉斯独行侠", "#00538c", "#002b5e", "gold", "three_d", 85, [94, 99, 88, 99, 86, 89, 73, 79, 70, 103, 96, 99, 94, 95, 63, 75, 70, 49, 52, 45, 82, 84, 99, 81, 95, 92, 87, 75, 83, 84], "", "", "img/dorian-finney-smith.webp", 1, "用户提供透明底照片"],
  ["Gary Payton II","加里·佩顿二世","SG","SF",188,88,"金州勇士","#ffc72c","#1d428a","gold","two_way",86,[86,86,80,91,88,91,86,92,77,101,89,94,92,89,67,76,71,72,75,68,80,86,88,81,89,89,85,76,84,85],"","","img/gary-payton-ii.webp",1,"用户提供透明底照片"],
  ["T.J. McConnell","T.J.麦康奈尔","PG","SG",188,86,"印第安纳步行者","#fdbb30","#002d62","gold","floor_gen",88,[94,95,88,99,87,90,48,54,72,78,79,71,65,87,25,40,35,47,50,43,55,99,95,99,89,89,63,45,53,54],"","","img/t-j-mcconnell.webp",1,"用户提供透明底照片"],
  ["Larry Nance Jr.","小拉里·南斯","PF","C",203,111,"克利夫兰骑士","#fdbb30","#860038","silver","two_way",78,[78,79,72,79,79,82,75,81,69,100,86,93,87,86,60,73,68,63,66,59,76,75,84,75,85,82,77,68,76,77],"","","img/larry-nance-jr.webp",1,"用户提供透明底照片"],
  ["Derrick Jones Jr.","小德里克·琼斯","SF","PF",198,95,"迈阿密热火","#f9a01b","#98002e","gold","slasher",88,[91,92,85,97,96,99,96,102,99,92,82,85,81,99,55,64,59,71,74,67,84,99,91,89,99,99,99,63,71,72],"","","img/derrick-jones-jr.webp",1,"用户提供透明底照片"],
  ["Luke Kennard","卢克·肯纳德","SG","SF",196,93,"孟菲斯灰熊","#5d76a9","#12173f","silver","sniper",75,[88,98,82,91,67,70,42,48,56,74,51,67,56,81,25,36,31,33,36,29,46,82,94,71,76,73,51,31,39,40],"","","img/luke-kennard.webp",1,"用户提供透明底照片"],
  ["Malik Monk","马利克·蒙克","SG","SF",191,91,"萨克拉门托国王","#5a2d81","#63727a","silver","spark",82,[88,86,82,89,89,92,77,83,76,81,73,74,66,93,32,47,42,45,48,41,59,93,85,76,92,92,80,45,53,54],"","","img/malik-monk.webp",1,"用户提供透明底照片"],
  ["Mitchell Robinson","米切尔·罗宾逊","C","PF",213,109,"纽约尼克斯","#f58426","#006bb6","gold","anchor",88,[64,56,58,81,92,95,96,102,87,69,64,62,85,71,99,99,94,91,94,87,99,61,68,70,71,68,94,94,102,103],"","","img/mitchell-robinson.webp",1,"用户提供透明底照片"],
  ["Duncan Robinson","邓肯·罗宾逊","SF","PF",201,98,"迈阿密热火","#f9a01b","#98002e","silver","sniper",79,[99,99,93,99,86,89,56,62,70,93,67,86,75,96,40,51,46,55,58,51,60,95,99,82,93,93,70,51,59,60],"","","img/duncan-robinson.webp",1,"用户提供透明底照片"],
  ["Collin Sexton","科林·塞克斯顿","PG","SG",185,86,"克利夫兰骑士","#fdbb30","#860038","silver","spark",77,[82,84,76,86,81,84,70,76,78,74,68,67,62,87,29,44,39,40,43,36,54,85,81,71,83,80,74,44,52,53],"","","img/collin-sexton.webp",1,"用户提供透明底照片"],
  ["Donte DiVincenzo","丹特·迪文森佐","SG","SF",193,92,"纽约尼克斯","#f58426","#006bb6","silver","two_way",77,[77,79,71,82,76,79,73,79,71,95,82,88,86,83,59,66,61,62,65,58,72,77,79,70,81,78,75,70,78,79],"","","img/donte-divincenzo.webp",1,"用户提供透明底照片"],
  ["Wendell Carter Jr.","小温德尔·卡特","C","PF",208,122,"奥兰多魔术","#0077c0","#1a1a1a","gold","big_man",88,[60,45,54,77,96,99,96,102,88,68,59,61,84,73,99,99,94,88,91,84,99,54,68,69,74,71,96,94,102,103],"","","img/wendell-carter-jr.webp",1,"用户提供透明底照片"],
  ["Luguentz Dort","卢根茨·多特","SG","SF",193,100,"俄克拉荷马雷霆","#ef3b24","#007ac1","gold","three_d",87,[91,99,85,92,79,82,73,79,69,103,89,99,92,92,54,72,67,46,49,42,82,81,99,77,94,91,84,71,79,80],"","","img/luguentz-dort.webp",1,"用户提供透明底照片"],
  ["Grayson Allen","格雷森·阿伦","SG","SF",193,90,"菲尼克斯太阳","#e56020","#1d1160","gold","sniper",88,[99,99,93,99,88,91,59,65,72,88,74,81,73,98,38,53,48,51,54,47,62,98,99,81,94,94,69,52,60,61],"","","img/grayson-allen.webp",1,"用户提供透明底照片"],
  ["Daniel Gafford","丹尼尔·加福德","C","PF",208,106,"达拉斯独行侠","#00538c","#002b5e","gold","big_man",85,[56,48,50,74,90,93,96,102,83,59,59,52,80,72,99,99,94,80,83,76,99,51,64,65,71,68,96,94,102,103],"","","img/daniel-gafford.webp",1,"用户提供透明底照片"],
  ["Cameron Johnson","卡梅隆·约翰逊","PF","C",203,95,"布鲁克林篮网","#c9ced4","#1a1a1a","silver","three_d",78,[85,98,79,90,79,82,64,70,64,102,83,95,87,91,49,66,61,46,49,42,77,78,99,68,89,86,79,65,73,74],"","","img/cameron-johnson.webp",1,"用户提供透明底照片"],
  ["Max Strus","马克斯·斯特鲁斯","SF","PF",196,98,"克利夫兰骑士","#fdbb30","#860038","silver","three_d",78,[86,98,80,89,74,77,66,72,59,101,84,94,88,91,54,66,61,45,48,41,74,77,99,67,87,84,75,68,76,77],"","","img/max-strus.webp",1,"用户提供透明底照片"],
  ["Matisse Thybulle","马蒂斯·赛布尔","SF","PF",196,91,"波特兰开拓者","#e03a3e","#1a1a1a","silver","three_d",79,[83,99,77,90,78,81,71,77,62,103,86,98,89,90,52,68,63,42,45,38,77,80,98,72,87,84,75,66,74,75],"","","img/matisse-thybulle.webp",1,"用户提供透明底照片"],
  ["Miles Bridges","迈尔斯·布里奇斯","SF","PF",201,102,"夏洛特黄蜂","#1d1160","#00788c","gold","slasher",87,[90,90,84,94,96,99,96,102,99,95,82,88,82,99,56,62,57,68,71,64,82,99,87,88,99,99,99,62,70,71],"","","img/miles-bridges.webp",1,"用户提供透明底照片"],
  ["Payton Pritchard","佩顿·普里查德","PG","SG",185,88,"波士顿凯尔特人","#00a758","#007a33","gold","spark",86,[88,94,82,94,90,93,79,85,81,83,76,76,69,99,36,47,42,50,53,46,62,94,93,79,97,97,85,48,56,57],"","","img/payton-pritchard.webp",1,"用户提供透明底照片"],
  ["Naz Reid","纳兹·里德","C","PF",206,120,"明尼苏达森林狼","#78be20","#0c2340","gold","skilled_big",88,[87,81,81,93,96,99,85,91,85,66,68,59,83,64,79,85,80,96,99,92,93,75,82,94,69,66,75,94,102,103],"","","img/naz-reid.webp",1,"用户提供透明底照片"],
  ["Moritz Wagner","莫里茨·瓦格纳","C","PF",211,111,"奥兰多魔术","#0077c0","#1a1a1a","silver","big_man",82,[52,38,46,68,87,90,92,98,79,53,54,46,76,65,94,96,91,79,82,75,97,44,60,54,68,65,91,92,100,101],"","","img/moritz-wagner.webp",1,"用户提供透明底照片"],
  ["Dwight Powell","德怀特·鲍威尔","C","PF",208,109,"达拉斯独行侠","#00538c","#002b5e","silver","big_man",80,[51,41,45,68,85,88,90,96,82,58,49,51,77,62,90,96,91,75,78,71,98,44,60,54,63,60,86,90,98,99],"","","img/dwight-powell.webp",1,"用户提供透明底照片"],
  ["Tyus Jones","泰厄斯·琼斯","PG","SG",188,88,"菲尼克斯太阳","#e56020","#1d1160","silver","floor_gen",75,[84,82,78,87,74,77,33,39,59,64,63,57,52,75,25,30,25,32,35,28,39,89,80,88,74,74,48,33,41,42],"","","img/tyus-jones.webp",1,"用户提供透明底照片"],
  ["Pat Connaughton","帕特·康诺顿","SG","SF",196,95,"密尔沃基雄鹿","#eee1c6","#00471b","silver","three_d",80,[81,94,75,89,78,81,64,70,62,98,82,91,84,83,51,64,59,44,47,40,69,74,97,69,87,84,76,64,72,73],"","","img/pat-connaughton.webp",1,"用户提供透明底照片"],
  ["Josh Okogie","约什·奥科吉","SG","SF",193,97,"菲尼克斯太阳","#e56020","#1d1160","silver","two_way",80,[82,84,76,81,78,81,74,80,71,99,85,92,89,80,59,73,68,59,62,55,72,75,82,72,84,81,80,73,81,82],"","","img/josh-okogie.webp",1,"用户提供透明底照片"],
  ["Stephen Jackson", "斯蒂芬·杰克逊", "SF", "PF", 203, 100, "金州勇士", "#ffc72c", "#1d428a", "gold", "two_way", 85, [87, 91, 81, 87, 89, 92, 80, 86, 76, 103, 93, 98, 94, 88, 65, 78, 73, 67, 70, 63, 81, 86, 85, 81, 90, 90, 85, 76, 84, 85], "", "", "img/stephen-jackson.webp", 0, "用户提供透明底照片"],
  ["Cuttino Mobley", "卡蒂诺·莫布里", "SG", "SF", 193, 86, "休斯顿火箭", "#ce1141", "#1a1a1a", "gold", "sniper", 86, [99, 99, 93, 99, 81, 84, 58, 64, 70, 85, 65, 78, 70, 92, 38, 48, 43, 48, 51, 44, 55, 94, 99, 83, 92, 92, 65, 48, 56, 57], "", "", "img/cuttino-mobley.webp", 0, "用户提供透明底照片"],
  ["Juwan Howard", "朱万·霍华德", "PF", "C", 206, 113, "华盛顿奇才", "#e31837", "#002b5c", "gold", "skilled_big", 84, [88, 80, 82, 91, 93, 96, 83, 89, 87, 63, 68, 56, 78, 67, 80, 88, 83, 94, 97, 90, 89, 75, 81, 92, 67, 64, 80, 87, 95, 96], "", "", "img/juwan-howard.webp", 0, "用户提供透明底照片"],
  ["Josh Howard", "乔什·霍华德", "SF", "PF", 201, 95, "达拉斯独行侠", "#00538c", "#002b5e", "gold", "scorer", 88, [99, 99, 93, 99, 96, 99, 92, 98, 95, 90, 78, 83, 79, 99, 47, 59, 54, 78, 81, 74, 68, 99, 98, 88, 99, 99, 94, 61, 69, 70], "", "", "img/josh-howard.webp", 0, "用户提供透明底照片"],
  ["Kevin Martin", "凯文·马丁", "SG", "SF", 201, 84, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "scorer", 84, [93, 89, 87, 95, 89, 92, 81, 87, 85, 84, 68, 77, 67, 91, 35, 50, 45, 71, 74, 67, 60, 88, 90, 77, 91, 91, 78, 44, 52, 53], "", "", "img/kevin-martin.webp", 0, "用户提供透明底照片"],
  ["Doug Christie", "道格·克里斯蒂", "SG", "SF", 198, 93, "萨克拉门托国王", "#5a2d81", "#63727a", "gold", "two_way", 88, [87, 89, 81, 92, 87, 90, 84, 90, 77, 103, 94, 99, 96, 89, 70, 81, 76, 71, 74, 67, 82, 87, 88, 84, 93, 93, 86, 80, 88, 89], "", "", "img/doug-christie.webp", 0, "用户提供透明底照片"],
  ["Al Harrington", "艾尔·哈林顿", "PF", "C", 206, 111, "金州勇士", "#ffc72c", "#1d428a", "gold", "scorer", 85, [99, 97, 93, 98, 94, 97, 83, 89, 91, 92, 74, 85, 75, 99, 42, 54, 49, 72, 75, 68, 62, 99, 98, 83, 97, 97, 90, 51, 59, 60], "", "", "img/al-harrington.webp", 0, "用户提供透明底照片"],
  ["Troy Murphy", "特洛伊·墨菲", "PF", "C", 211, 111, "金州勇士", "#ffc72c", "#1d428a", "silver", "sniper", 81, [99, 99, 93, 99, 90, 93, 62, 68, 73, 91, 75, 84, 74, 99, 41, 57, 52, 56, 59, 52, 65, 99, 99, 86, 96, 96, 69, 51, 59, 60], "", "", "img/troy-murphy.webp", 0, "用户提供透明底照片"],
  ["Erick Dampier", "埃里克·丹皮尔", "C", "PF", 211, 120, "达拉斯独行侠", "#00538c", "#002b5e", "silver", "big_man", 76, [44, 35, 38, 64, 82, 85, 86, 92, 76, 53, 49, 46, 74, 62, 83, 89, 84, 70, 73, 66, 97, 39, 53, 56, 59, 56, 83, 88, 96, 97], "", "", "img/erick-dampier.webp", 0, "用户提供透明底照片"],
  ["Antonio Daniels", "安东尼奥·丹尼尔斯", "PG", "SG", 193, 93, "华盛顿奇才", "#e31837", "#002b5c", "silver", "floor_gen", 78, [82, 81, 76, 86, 75, 78, 33, 39, 60, 73, 66, 66, 58, 83, 25, 32, 27, 38, 41, 34, 40, 89, 82, 93, 79, 79, 49, 36, 44, 45], "", "", "img/antonio-daniels.webp", 0, "用户提供透明底照片"],
  ["Earl Watson", "厄尔·沃特森", "PG", "SG", 185, 88, "西雅图超音速", "#00653a", "#ffc200", "silver", "floor_gen", 76, [81, 81, 75, 83, 73, 76, 34, 40, 58, 70, 68, 63, 54, 75, 25, 26, 25, 38, 41, 34, 43, 85, 83, 94, 76, 73, 48, 31, 39, 40], "", "", "img/earl-watson.webp", 0, "用户提供透明底照片"],
  ["Darius Miles", "达柳斯·迈尔斯", "SF", "PF", 206, 95, "洛杉矶快船", "#c8102e", "#1d428a", "silver", "slasher", 76, [77, 74, 71, 81, 91, 94, 90, 96, 86, 77, 67, 70, 66, 94, 45, 45, 40, 56, 59, 52, 73, 88, 79, 71, 92, 92, 92, 48, 56, 57], "", "", "img/darius-miles.webp", 0, "用户提供透明底照片"],
  ["Desmond Mason", "德斯蒙德·梅森", "SG", "SF", 196, 100, "密尔沃基雄鹿", "#eee1c6", "#00471b", "silver", "slasher", 76, [74, 74, 68, 71, 90, 93, 88, 94, 83, 71, 61, 64, 60, 89, 37, 42, 37, 48, 51, 44, 61, 85, 73, 65, 92, 89, 89, 42, 50, 51], "", "", "img/desmond-mason.webp", 0, "用户提供透明底照片"],
  ["Ricky Davis", "里基·戴维斯", "SG", "SF", 198, 88, "克利夫兰骑士", "#fdbb30", "#860038", "silver", "spark", 75, [77, 83, 71, 84, 81, 84, 67, 73, 71, 74, 67, 67, 61, 86, 26, 41, 36, 43, 46, 39, 55, 81, 81, 69, 83, 80, 78, 41, 49, 50], "", "", "img/ricky-davis.webp", 0, "用户提供透明底照片"],
  ["De'Aaron Fox", "德阿隆·福克斯", "PG", "SG", 191, 84, "萨克拉门托国王", "#5a2d81", "#63727a", "purple", "floor_gen", 91, [98, 97, 92, 99, 91, 94, 53, 59, 73, 85, 84, 78, 72, 98, 34, 49, 44, 52, 55, 48, 57, 99, 99, 99, 96, 96, 66, 52, 60, 61], "", "", "img/deaaron-fox.webp", 1, "用户提供透明底照片"],
  ["Kyle Kuzma", "凯尔·库兹马", "PF", "C", 206, 100, "洛杉矶湖人", "#fdb927", "#552583", "gold", "scorer", 88, [99, 99, 93, 99, 96, 99, 90, 96, 96, 93, 81, 86, 79, 99, 47, 60, 55, 81, 84, 77, 68, 99, 97, 86, 98, 98, 93, 59, 67, 68], "", "", "img/kyle-kuzma.webp", 1, "用户提供透明底照片"],
  ["Michael Porter Jr.", "小迈克尔·波特", "SF", "PF", 208, 99, "丹佛掘金", "#fec524", "#0e2240", "gold", "sniper", 84, [99, 99, 93, 99, 89, 92, 62, 68, 82, 99, 81, 92, 81, 99, 45, 57, 52, 59, 62, 55, 69, 99, 99, 93, 99, 99, 76, 56, 64, 65], "", "", "img/michael-porter-jr.webp", 1, "用户提供透明底照片"],
  ["Jonathan Kuminga", "乔纳森·库明加", "SF", "PF", 203, 102, "金州勇士", "#ffc72c", "#1d428a", "gold", "slasher", 88, [92, 90, 86, 99, 96, 99, 96, 102, 99, 99, 82, 92, 84, 99, 56, 62, 57, 69, 72, 65, 87, 99, 92, 88, 99, 99, 99, 62, 70, 71], "", "", "img/jonathan-kuminga.webp", 1, "用户提供透明底照片"],
  ["Jalen Suggs", "杰伦·萨格斯", "PG", "SG", 193, 93, "奥兰多魔术", "#0077c0", "#1a1a1a", "gold", "two_way", 88, [90, 90, 84, 92, 87, 90, 81, 87, 81, 101, 89, 94, 91, 89, 68, 81, 76, 71, 74, 67, 81, 89, 89, 82, 89, 89, 90, 75, 83, 84], "", "", "img/jalen-suggs.webp", 1, "用户提供透明底照片"],
  ["Josh Giddey", "乔什·吉迪", "PG", "SG", 203, 95, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "gold", "floor_gen", 86, [92, 91, 86, 95, 83, 86, 45, 51, 68, 79, 74, 72, 64, 85, 28, 36, 31, 45, 48, 41, 48, 98, 94, 99, 88, 88, 60, 42, 50, 51], "", "", "img/josh-giddey.webp", 1, "用户提供透明底照片"],
  ["Dyson Daniels", "戴森·丹尼尔斯", "SG", "SF", 201, 90, "亚特兰大老鹰", "#e03a3e", "#26282a", "gold", "two_way", 87, [87, 91, 81, 90, 88, 91, 83, 89, 81, 101, 92, 94, 91, 94, 71, 77, 72, 71, 74, 67, 79, 83, 89, 79, 94, 91, 86, 75, 83, 84], "", "", "img/dyson-daniels.webp", 1, "用户提供透明底照片"],
  ["Bogdan Bogdanovic", "博格丹·博格达诺维奇", "SG", "SF", 196, 100, "亚特兰大老鹰", "#e03a3e", "#26282a", "gold", "sniper", 86, [99, 99, 93, 99, 81, 84, 53, 59, 69, 88, 71, 81, 70, 92, 36, 47, 42, 49, 52, 45, 61, 93, 99, 79, 93, 93, 68, 46, 54, 55], "", "", "img/bogdan-bogdanovic.webp", 1, "用户提供透明底照片"],
  ["Devin Vassell", "德文·瓦塞尔", "SG", "SF", 196, 91, "圣安东尼奥马刺", "#c4ced4", "#1a1a1a", "gold", "three_d", 86, [92, 99, 86, 93, 84, 87, 73, 79, 67, 103, 87, 99, 90, 89, 56, 71, 66, 46, 49, 42, 79, 82, 99, 72, 89, 86, 80, 67, 75, 76], "", "", "img/devin-vassell.webp", 1, "用户提供透明底照片"],
  ["Herbert Jones", "赫伯特·琼斯", "SF", "PF", 201, 93, "新奥尔良鹈鹕", "#e31837", "#0c2340", "gold", "three_d", 85, [90, 99, 84, 98, 84, 87, 77, 83, 73, 103, 93, 99, 93, 95, 57, 72, 67, 53, 56, 49, 83, 85, 99, 81, 98, 95, 84, 74, 82, 83], "", "", "img/herbert-jones.webp", 1, "用户提供透明底照片"],
  ["Jaden McDaniels", "杰登·麦克丹尼尔斯", "SF", "PF", 206, 84, "明尼苏达森林狼", "#78be20", "#0c2340", "gold", "three_d", 86, [95, 99, 89, 99, 87, 90, 79, 85, 70, 103, 97, 99, 93, 98, 63, 75, 70, 49, 52, 45, 79, 85, 99, 81, 96, 93, 88, 73, 81, 82], "", "", "img/jaden-mcdaniels.webp", 1, "用户提供透明底照片"],
  ["Onyeka Okongwu", "奥涅卡·奥孔古", "C", "PF", 203, 107, "亚特兰大老鹰", "#e03a3e", "#26282a", "silver", "big_man", 76, [45, 35, 39, 61, 87, 90, 87, 93, 78, 49, 48, 42, 72, 61, 84, 88, 83, 70, 73, 66, 92, 37, 55, 53, 61, 58, 87, 88, 96, 97], "", "", "img/onyeka-okongwu.webp", 1, "用户提供透明底照片"],
  ["Jonathan Isaac", "乔纳森·艾萨克", "PF", "C", 208, 104, "奥兰多魔术", "#0077c0", "#1a1a1a", "silver", "anchor", 76, [58, 50, 52, 72, 81, 84, 90, 96, 80, 61, 63, 54, 81, 62, 99, 99, 94, 81, 84, 77, 99, 54, 66, 69, 67, 64, 88, 94, 102, 103], "", "", "img/jonathan-isaac.webp", 1, "用户提供透明底照片"],
  ["Zach Edey", "扎克·伊迪", "C", "PF", 224, 138, "孟菲斯灰熊", "#5d76a9", "#12173f", "silver", "big_man", 79, [46, 38, 40, 66, 85, 88, 93, 99, 77, 51, 47, 44, 73, 63, 88, 94, 89, 72, 75, 68, 99, 44, 55, 51, 63, 60, 82, 89, 97, 98], "", "", "img/zach-edey.webp", 1, "用户提供透明底照片"],
  ["Kyrie Irving", "凯里·欧文", "PG", "SG", 188, 88, "克利夫兰骑士", "#fdbb30", "#860038", "momentPurple", "floor_gen", 108, [99, 99, 93, 99, 96, 99, 66, 72, 85, 97, 96, 90, 85, 99, 60, 60, 60, 68, 71, 64, 70, 99, 99, 99, 99, 99, 76, 66, 74, 75], "2015-16", "总决赛G7准绝杀·骑士首冠", "img/kyrie-irving-m.webp", 1, "用户提供透明底照片库（ESPN 半身照）"],
  ["Damian Lillard", "达米安·利拉德", "PG", "SG", 188, 88, "波特兰开拓者", "#e03a3e", "#1a1a1a", "momentPurple", "scorer", 109, [99, 99, 93, 99, 96, 99, 96, 102, 99, 103, 93, 99, 91, 99, 63, 71, 66, 90, 93, 86, 85, 99, 99, 99, 99, 99, 99, 69, 77, 78], "2018-19", "首轮G5超远三分绝杀雷霆", "img/damian-lillard-m.webp", 1, "用户提供透明底照片库（ESPN 半身照）"],
  ["Shai Gilgeous-Alexander", "谢伊·吉尔杰斯-亚历山大", "PG", "SG", 198, 88, "俄克拉荷马雷霆", "#ef3b24", "#007ac1", "momentGold", "scorer", 102, [99, 99, 93, 99, 96, 99, 96, 102, 99, 103, 94, 98, 93, 99, 61, 72, 67, 91, 94, 87, 81, 99, 99, 99, 99, 99, 99, 74, 82, 83], "2024-25", "常规赛MVP+总决赛MVP·雷霆首冠", "img/shai-gilgeous-alexander-m.webp", 1, "用户提供透明底照片库（ESPN 半身照）"],
  ["Klay Thompson", "克莱·汤普森", "SG", "SF", 198, 98, "金州勇士", "#ffc72c", "#1d428a", "momentGold", "sniper", 103, [99, 99, 93, 99, 96, 99, 66, 72, 85, 102, 81, 95, 85, 99, 60, 61, 60, 67, 70, 63, 71, 99, 99, 95, 99, 99, 79, 62, 70, 71], "2015-16", "西决G6 11记三分·单节37分", "img/klay-thompson-m.webp", 1, "用户提供透明底照片库（ESPN 半身照）"],
  ["Devin Booker", "德文·布克", "SG", "PG", 196, 95, "菲尼克斯太阳", "#e56020", "#1d1160", "momentGold", "scorer", 104, [99, 99, 93, 99, 96, 99, 96, 102, 99, 103, 93, 99, 93, 99, 62, 72, 67, 93, 96, 89, 81, 99, 99, 99, 99, 99, 99, 73, 81, 82], "2020-21", "总决赛连续40+·首进总决赛", "img/devin-booker-m.webp", 1, "用户提供透明底照片库（ESPN 半身照）"],
  ["Tracy McGrady", "特雷西·麦克格雷迪", "SG", "SF", 203, 101, "奥兰多魔术", "#0077c0", "#1a1a1a", "momentPurple", "scorer", 110, [99, 99, 93, 99, 96, 99, 96, 102, 99, 103, 92, 99, 92, 99, 60, 70, 65, 95, 98, 91, 85, 99, 99, 99, 99, 99, 99, 72, 80, 81], "2002-03", "得分王·场均32.1分·最佳阵容一阵", "img/tracy-mcgrady-x.webp", 1, "NBA 官方定妆照（图库无魔术时期素材，按用户指示用定妆照）"],
];
const ATTR_KEYS = ["mid","three","floater","ft","close","layup","standDunk","driveDunk","drawFoul","intercept","steal","perimD","hustle","lateral","block","intD","postD","postFade","postControl","postHook","strength","handle","catch","pass","offBallSpeed","onBallSpeed","vertical","oreb","dreb","boxout"];

/* =============================================================
   已下架卡牌（墓碑机制）
   -------------------------------------------------------------
   下面这几张卡的照片不合格 —— 要么抠图失败（检测不到人脸），
   要么是合影、混进了别人的脸，而照片库里又没有可替换的素材，
   所以按用户要求下架。

   ★ 为什么不直接从 RAW_CARDS 里删行：
     卡牌 id 是按**数组下标**生成的（`id: 'c' + i`），
     从中间删行会让后面所有卡的 id 前移，
     老存档里的 S.owned / 阵容 / 图鉴进度会**全部错位**。
     所以这里只把这些下标"墓碑化"，构建 CARDS 时跳过 ——
     id 保持稳定，存档不受影响。
   ============================================================= */
const REMOVED_CARDS = new Set([
  112,  // 萨鲁纳斯·贾斯科维休斯 gold    —— 合影（2 张脸）
  146,  // 欧米尔·阿西克        gold    —— 合影（2 张脸）
  156,  // 乔治·贾巴尤萨        gold    —— 抠图失败（0 张脸）
  235,  // 托尼·阿伦           silver  —— 合影（2 张脸）
  288,  // 霍雷斯·格兰特        silver  —— 抠图失败（0 张脸）
  337,  // 萨沙·达尼洛维奇       silver  —— 合影（11 张脸）
  342,  // 安东尼·韦伯（土豆）   silver  —— 合影（2 张脸）
  382,  // 王治郅              silver  —— 合影（4 张脸）
  424,  // 阿玛雷·斯塔德迈尔     momentGold —— 合影（2 张脸）
        //   ↑ 只下架这张时刻卡，他的金卡 c75 照片没问题，保留
  237,  // 马克·伊顿           silver  —— 照片是一张古典油画肖像，根本不是他；照片库无替代素材
  2,    // 沙奎尔·奥尼尔        legendPurple —— 用户要求只留时刻奥尼尔，名宿紫卡下架
        //   ↑ 他的时刻紫卡 c391 保留（1999-00 湖人，已换成湖人时期定妆照）
  44,   // 特雷西·麦克格雷迪     purple      —— 用户要求麦迪重做成一张时刻紫卡
  409,  // 特雷西·麦克格雷迪     momentGold  —— 同上，时刻金卡一并下架
        //   ↑ 新建的 c556 时刻紫卡（2002-03 魔术）取代这两张
  388,  // 科比·布莱恩特        momentPurple —— 用户要求科比只留一张时刻卡
        //   ↑ 保留 c0（并把它的时刻改成 2005-06 单场81分，即科比最标志性的赛季）
  23,   // 凯文·加内特          legendPurple —— 与科比同样处理：删名宿紫卡，只留时刻卡
        //   ↑ 保留 c401（2003-04 森林狼，常规赛MVP·场均24+14+5，正是他的巅峰赛季）
]);

const CARDS = RAW_CARDS
  .map((r, i) => {
    if (REMOVED_CARDS.has(i)) return null;   // 墓碑：跳过，但 id 仍按原下标算
    const attrs = {};
    ATTR_KEYS.forEach((k, j) => { attrs[k] = r[12][j]; });
    return {
      id: 'c' + i,
      en: r[0], name: r[1], pos: r[2], pos2: r[3], height: r[4], weight: r[5],
      team: r[6], tc1: r[7], tc2: r[8], tier: r[9], arch: r[10], ovr: r[11],
      attrs, season: r[13], momentDesc: r[14], photo: r[15], current: !!r[16], credit: r[17],
      isMoment: r[9] === 'momentGold' || r[9] === 'momentPurple',
    };
  })
  .filter(Boolean);
const CARD_BY_ID = {};
CARDS.forEach((c) => { CARD_BY_ID[c.id] = c; });

/* =============================================================
   球员身份（同一名球员可能有多张卡）
   -------------------------------------------------------------
   500 张卡里有 60 名球员各有 2 张（现役版 + 时刻版）。
   比赛阵容里**同一名球员只能上一张** —— 不能同时派上
   「时刻名宿科比」和「时刻科比」。
   身份用英文名判定（中文名有译名差异，英文名唯一）。
   ============================================================= */
const PLAYER_KEY_OF = {};
CARDS.forEach((c) => {
  const k = String(c.en || c.name || c.id).toLowerCase().replace(/[^a-z0-9]/g, '');
  PLAYER_KEY_OF[c.id] = k || String(c.id);
});
/** 取某张卡对应的球员身份 */
function playerKeyOf(id) {
  if (PLAYER_KEY_OF[id]) return PLAYER_KEY_OF[id];
  const c = CARD_BY_ID[id];
  if (!c) return String(id);
  return String(c.en || c.name || id).toLowerCase().replace(/[^a-z0-9]/g, '') || String(id);
}
/** 这两张卡是不是同一名球员 */
function samePlayer(idA, idB) {
  return !!idA && !!idB && idA !== idB && playerKeyOf(idA) === playerKeyOf(idB);
}
/** 同一名球员的所有卡（用于提示） */
function cardsOfPlayer(id) {
  const k = playerKeyOf(id);
  return CARDS.filter((c) => PLAYER_KEY_OF[c.id] === k);
}
const cardsOfTier = (t) => CARDS.filter((c) => c.tier === t);

/* ---------- 徽章系统 ----------
   每个能力项对应一枚徽章，按数值分铜 / 银 / 金三档：
     铜 85+  银 90+  金 95+
   卡片档位决定徽章数量上限与可出现的最高品质：
     银卡最多 1 枚（只有铜），金卡最多 3 枚（铜/银），紫卡最多 5 枚，
     时刻金卡最多 6 枚，时刻紫卡最多 7 枚（可出金徽章）。
   所以银卡经常没有徽章，而乔丹这种满身 95+ 的时刻紫卡会挂满金徽章。 */
const BADGE_DEFS = [
  { key: 'three', name: '神射手', icon: '🎯', desc: '三分投篮命中率额外提升' },
  { key: 'mid', name: '中投大师', icon: '🪄', desc: '中距离跳投命中率额外提升' },
  { key: 'floater', name: '抛投高手', icon: '🏹', desc: '抛投与跑投命中率额外提升' },
  { key: 'ft', name: '罚球机器', icon: '🧊', desc: '罚球稳定性大幅提升' },
  { key: 'close', name: '近框杀手', icon: '🔪', desc: '篮下近距离终结命中率提升' },
  { key: 'layup', name: '篮下终结者', icon: '🏀', desc: '上篮抗干扰能力提升' },
  { key: 'standDunk', name: '原地重炮', icon: '💪', desc: '原地起跳灌篮成功率提升' },
  { key: 'driveDunk', name: '空接暴扣', icon: '💥', desc: '突破灌篮与空中接力成功率提升' },
  { key: 'drawFoul', name: '造犯规大师', icon: '😤', desc: '对抗中造犯规概率提升' },
  { key: 'intercept', name: '传球拦截者', icon: '✋', desc: '预判传球路线、增加拦截概率' },
  { key: 'steal', name: '抢断专家', icon: '🖐️', desc: '掏球成功率提升' },
  { key: 'perimD', name: '外线铁闸', icon: '🔒', desc: '外线单防限制命中率' },
  { key: 'hustle', name: '拼命三郎', icon: '🔥', desc: '地板球与五五开球争抢提升' },
  { key: 'lateral', name: '横移大师', icon: '👟', desc: '防守横移速度提升' },
  { key: 'block', name: '盖帽狂魔', icon: '🚫', desc: '封盖成功率提升' },
  { key: 'intD', name: '护框大闸', icon: '🚧', desc: '禁区防守降低对手命中率' },
  { key: 'postD', name: '背身防守专家', icon: '🛡️', desc: '低位顶防成功率提升' },
  { key: 'postFade', name: '背身后仰大师', icon: '🌀', desc: '背身后仰跳投命中率提升' },
  { key: 'postControl', name: '低位杀器', icon: '🗿', desc: '低位单打成功率提升' },
  { key: 'postHook', name: '勾手大师', icon: '🪝', desc: '背身勾射命中率提升' },
  { key: 'strength', name: '力量碾压', icon: '🦍', desc: '身体对抗中占据优势' },
  { key: 'handle', name: '过人如麻', icon: '⚡', desc: '运球过人成功率提升' },
  { key: 'catch', name: '接球就投', icon: '🎽', desc: '接球出手速度与命中率提升' },
  { key: 'pass', name: '传球大师', icon: '🎩', desc: '传球准确性与出球速度提升' },
  { key: 'offBallSpeed', name: '无球跑位', icon: '💨', desc: '无球状态移动速度提升' },
  { key: 'onBallSpeed', name: '持球推进', icon: '🏃', desc: '持球状态移动速度提升' },
  { key: 'vertical', name: '弹跳怪', icon: '🦘', desc: '起跳高度与争抢高度提升' },
  { key: 'oreb', name: '前场篮板王', icon: '🧲', desc: '进攻篮板争抢成功率提升' },
  { key: 'dreb', name: '篮板怪兽', icon: '🪣', desc: '防守篮板保护能力提升' },
  { key: 'boxout', name: '卡位大师', icon: '🧱', desc: '卡位与顶人能力提升' },

  /* =========================================================
     体力与精神类徽章
     ---------------------------------------------------------
     这一组不看单项能力值，而是看「体力(stamina) + 相关能力」的组合，
     判定规则在 mentalTierOf() 里 —— 因为像「不知疲倦」这种徽章，
     现实里靠的是体能储备和防守习惯，不是某一项技术数值。
     ========================================================= */
  { key: 'charged', name: '电量充满', icon: '🔋', kind: 'mental',
    desc: '体能储备惊人，上场体力上限额外提升' },
  { key: 'relentless', name: '不知疲倦', icon: '♾️', kind: 'mental',
    desc: '防守端体力消耗显著降低，越防越来劲' },
  { key: 'ironman', name: '铁人', icon: '🦾', kind: 'mental',
    desc: '全场体力消耗降低，第四节依然能跑' },
  { key: 'motor', name: '永动机', icon: '⚙️', kind: 'mental',
    desc: '节间休息恢复更快，暂停回来满血' },
  { key: 'tough', name: '硬汉', icon: '🪨', kind: 'mental',
    desc: '体力透支时表现下滑更少' },
  { key: 'clutchGene', name: '关键先生', icon: '⏱️', kind: 'mental',
    desc: '第四节最后两分钟命中率大幅提升' },
  { key: 'ice', name: '大心脏', icon: '🧊', kind: 'mental',
    desc: '关键时刻罚球不失手，压力越大越准' },
  { key: 'leader', name: '领袖', icon: '👑', kind: 'mental',
    desc: '在场时全队进攻效率提升' },
  { key: 'enforcer', name: '恶汉', icon: '😠', kind: 'mental',
    desc: '对抗中更凶，造犯规与篮板争抢加成' },
  { key: 'focus', name: '专注', icon: '🎯', kind: 'mental',
    desc: '不易受对手垃圾话与气势影响' },

    { key: 'aerialWizard', name: '空接终结者', icon: '🪂', desc: '空接与空中接力终结成功率大幅提升', kind: 'combo', cat: 'finish' },
    { key: 'posterizer', name: '海报扣将', icon: '🖼️', desc: '隔人暴扣成功率提升，扣篮更难被封盖', kind: 'combo', cat: 'finish' },
    { key: 'slithery', name: '躲闪终结者', icon: '🐍', desc: '上篮时躲避封盖的能力提升', kind: 'combo', cat: 'finish' },
    { key: 'fearless', name: '无畏终结者', icon: '🦁', desc: '对抗中强起终结的命中率提升', kind: 'combo', cat: 'finish' },
    { key: 'fastTwitch', name: '快速起跳', icon: '⚡', desc: '篮下二次起跳速度更快', kind: 'combo', cat: 'finish' },
    { key: 'riseUp', name: '强力起身', icon: '⬆️', desc: '原地强起灌篮成功率提升', kind: 'combo', cat: 'finish' },
    { key: 'layupMix', name: '上篮混合师', icon: '🌀', desc: '各种花式上篮动作命中率提升', kind: 'combo', cat: 'finish' },
    { key: 'giantSlayer', name: '巨人杀手', icon: '🗡️', desc: '面对高大防守者时终结命中率提升', kind: 'combo', cat: 'finish' },
    { key: 'bulldozer', name: '推土机', icon: '🚜', desc: '用身体顶开防守者完成终结', kind: 'combo', cat: 'finish' },
    { key: 'acrobat', name: '杂技终结', icon: '🤸', desc: '空中调整身体完成高难度上篮', kind: 'combo', cat: 'finish' },
    { key: 'postSpin', name: '背身转身上篮', icon: '🔄', desc: '背身转身后的终结成功率提升', kind: 'combo', cat: 'finish' },
    { key: 'dreamShake', name: '梦幻脚步', icon: '💫', desc: '背身假动作晃开防守者的成功率提升', kind: 'combo', cat: 'finish' },
    { key: 'hookSpecialist', name: '勾手大师', icon: '🪝', desc: '勾手与天勾命中率大幅提升', kind: 'combo', cat: 'finish' },
    { key: 'putbackBoss', name: '补扣专家', icon: '🔨', desc: '抢下前场篮板后直接补扣成功率提升', kind: 'combo', cat: 'finish' },
    { key: 'deadeye', name: '死角猎手', icon: '👁️', desc: '有防守干扰时的投篮命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'limitless', name: '无限射程', icon: '♾️', desc: '超远三分射程与命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'catchShoot', name: '接球就投', icon: '🤲', desc: '接球后立刻出手的命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'cornerSpec', name: '底角专家', icon: '📐', desc: '底角三分命中率大幅提升', kind: 'combo', cat: 'shot' },
    { key: 'greenMachine', name: '绿色机器', icon: '💚', desc: '连续命中后的手感加成更持久', kind: 'combo', cat: 'shot' },
    { key: 'pickPopper', name: '挡拆投手', icon: '🧱', desc: '挡拆后外弹投篮命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'fadeAce', name: '后仰大师', icon: '🌙', desc: '后仰跳投命中率与抗干扰提升', kind: 'combo', cat: 'shot' },
    { key: 'middyMagician', name: '中距离魔术师', icon: '🎩', desc: '中距离各类跳投命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'floatGame', name: '抛投专家', icon: '🎈', desc: '抛投与跑投命中率提升', kind: 'combo', cat: 'shot' },
    { key: 'ftAce', name: '罚球稳手', icon: '🎯', desc: '罚球命中率大幅提升', kind: 'combo', cat: 'shot' },
    { key: 'spaceCreator', name: '空间创造者', icon: '🌌', desc: '运球创造投篮空间的效率提升', kind: 'combo', cat: 'shot' },
    { key: 'iceVeins', name: '冷血杀手', icon: '🧊', desc: '关键时刻罚球几乎不失手', kind: 'combo', cat: 'shot' },
    { key: 'clutchGenePro', name: '关键基因', icon: '⏱️', desc: '第四节最后时刻各项能力提升', kind: 'combo', cat: 'shot' },
    { key: 'offBallSpec', name: '无球跑位', icon: '🏃', desc: '无球跑动摆脱防守的能力提升', kind: 'combo', cat: 'shot' },
    { key: 'ankleBreaker', name: '脚踝终结者', icon: '🦶', desc: '运球变向晃倒防守者的概率提升', kind: 'combo', cat: 'play' },
    { key: 'dimer', name: '传球大师', icon: '🎁', desc: '传球后队友命中率提升', kind: 'combo', cat: 'play' },
    { key: 'handles', name: '控球大师', icon: '🏀', desc: '运球抗抢断能力提升', kind: 'combo', cat: 'play' },
    { key: 'hyperdrive', name: '快攻发动机', icon: '🚀', desc: '加速突破的启动速度更快', kind: 'combo', cat: 'play' },
    { key: 'touchPasser', name: '连线专家', icon: '🤝', desc: '快速传导球失误率降低', kind: 'combo', cat: 'play' },
    { key: 'breakStarter', name: '长传发动', icon: '📡', desc: '抢下篮板后长传快攻的成功率提升', kind: 'combo', cat: 'play' },
    { key: 'viceGrip', name: '铁腕', icon: '✊', desc: '接球稳固程度提升，不易被拍掉', kind: 'combo', cat: 'play' },
    { key: 'postPlaymaker', name: '背身组织', icon: '🎪', desc: '背身状态下传球的质量提升', kind: 'combo', cat: 'play' },
    { key: 'relayPasser', name: '二次助攻', icon: '🔗', desc: '转移球后形成的助攻机会更多', kind: 'combo', cat: 'play' },
    { key: 'speedBooster', name: '加速器', icon: '💨', desc: '持球推进速度提升', kind: 'combo', cat: 'play' },
    { key: 'bailOut', name: '保命传球', icon: '🆘', desc: '被包夹时传出好球的能力提升', kind: 'combo', cat: 'play' },
    { key: 'floorGeneral', name: '场上教练', icon: '🧠', desc: '提升全队进攻效率', kind: 'combo', cat: 'play' },
    { key: 'unpluckable', name: '不可抢断', icon: '🔐', desc: '运球时极难被抢断', kind: 'combo', cat: 'play' },
    { key: 'engineBadge', name: '进攻核心', icon: '⚙️', desc: '作为战术发起点时全队加成', kind: 'combo', cat: 'play' },
    { key: 'clamps', name: '贴身防守', icon: '🔒', desc: '一对一外线防守限制命中率', kind: 'combo', cat: 'defense' },
    { key: 'pickDodger', name: '绕掩护专家', icon: '🚧', desc: '绕过掩护追上持球人的速度提升', kind: 'combo', cat: 'defense' },
    { key: 'interceptor', name: '传球拦截', icon: '✋', desc: '预判传球路线完成拦截', kind: 'combo', cat: 'defense' },
    { key: 'glove', name: '抢断专家', icon: '🖐️', desc: '掏球成功率提升', kind: 'combo', cat: 'defense' },
    { key: 'challenger', name: '挑战者', icon: '🙌', desc: '干扰投篮时降低对方命中率', kind: 'combo', cat: 'defense' },
    { key: 'menace', name: '防守威胁', icon: '😈', desc: '贴身施压造成对方失误', kind: 'combo', cat: 'defense' },
    { key: 'offBallPest', name: '无球纠缠', icon: '🐝', desc: '无球端干扰对手跑位', kind: 'combo', cat: 'defense' },
    { key: 'workHorse', name: '拼命三郎', icon: '🔥', desc: '地板球与五五开球争抢提升', kind: 'combo', cat: 'defense' },
    { key: 'pogoStick', name: '盖帽弹簧', icon: '🦘', desc: '连续起跳封盖的能力提升', kind: 'combo', cat: 'defense' },
    { key: 'anchorD', name: '内线支柱', icon: '⚓', desc: '护框时降低对手篮下命中率', kind: 'combo', cat: 'defense' },
    { key: 'brickWall', name: '铜墙铁壁', icon: '🧱', desc: '挡拆与卡位时更难被顶开', kind: 'combo', cat: 'defense' },
    { key: 'immovable', name: '不可撼动', icon: '🗿', desc: '对抗中极难被推开', kind: 'combo', cat: 'defense' },
    { key: 'postLockdown', name: '背身防守', icon: '🚫', desc: '限制对手背身单打效率', kind: 'combo', cat: 'defense' },
    { key: 'pickpocket', name: '抄球专家', icon: '👐', desc: '从持球人手中直接掏球', kind: 'combo', cat: 'defense' },
    { key: 'swissArmy', name: '全能防守', icon: '🛡️', desc: '可从一号位防到五号位', kind: 'combo', cat: 'defense' },
    { key: 'defAnchor', name: '防守核心', icon: '🏰', desc: '提升全队防守效率', kind: 'combo', cat: 'defense' },
    { key: 'reboundChaser', name: '篮板猎手', icon: '🧲', desc: '争抢篮板时的落点预判提升', kind: 'combo', cat: 'rebound' },
    { key: 'boxoutBeast', name: '卡位大师', icon: '🧍', desc: '卡位成功率大幅提升', kind: 'combo', cat: 'rebound' },
    { key: 'offRebounder', name: '前场篮板王', icon: '♻️', desc: '争抢前场篮板的成功率提升', kind: 'combo', cat: 'rebound' },
    { key: 'rebInstinct', name: '篮板嗅觉', icon: '👃', desc: '长篮板与弹远篮板的判断提升', kind: 'combo', cat: 'rebound' },
    { key: 'aerialKing', name: '空中霸主', icon: '👑', desc: '高空争抢篮板的成功率提升', kind: 'combo', cat: 'rebound' },
    { key: 'worm', name: '篮板铁人', icon: '🪱', desc: '连续起跳拼抢篮板的耐力提升', kind: 'combo', cat: 'rebound' },
  ];

/* ---------- 体力/精神徽章的判定 ----------
   组合「体力 + 相关能力 + 综合分」来定档，保证体能够硬的球员
   才拿得到这些徽章，而不是随便谁都有。 */
const MENTAL_RULE = {
  // key: [体力权重, 关联能力, 该能力的权重, 基础门槛]
  charged:    { sta: 1.0, attr: 'vertical',  attrW: 0.15, base: 82 },
  relentless: { sta: 1.0, attr: 'perimD',    attrW: 0.25, base: 80 },
  ironman:    { sta: 1.0, attr: 'strength',  attrW: 0.2,  base: 84 },
  motor:      { sta: 1.0, attr: 'hustle',    attrW: 0.3,  base: 80 },
  tough:      { sta: 0.9, attr: 'strength',  attrW: 0.35, base: 82 },
  clutchGenePro: { sta: 0.5, attr: 'three',     attrW: 0.4,  base: 88 },
  ice:        { sta: 0.3, attr: 'ft',        attrW: 0.7,  base: 90 },
  leader:     { sta: 0.6, attr: 'pass',      attrW: 0.45, base: 86 },
  enforcer:   { sta: 0.7, attr: 'strength',  attrW: 0.5,  base: 84 },
  focus:      { sta: 0.8, attr: 'lateral',   attrW: 0.35, base: 80 },
};
/* ---------- 体力（sta）----------
   属性表里本来没有体力项，这里从「身体条件 + 跑动能力」推导出来，
   再叠加一点随机差异（同一份数据每次生成都一样，保证可复现）。
   现实里体能好的人，通常是横移快、跑动多、对抗强的类型。 */
const STA_W = {
  hustle: 0.26,        // 拼劲 —— 最能代表"愿不愿意跑"
  lateral: 0.20,       // 横移
  onBallSpeed: 0.16,   // 持球推进
  offBallSpeed: 0.14,  // 无球跑位
  strength: 0.14,      // 对抗
  vertical: 0.10,      // 弹跳
};
/** 取一名球员的体力值（0~135 口径，和别的属性一致） */
function staminaOf(card) {
  if (card._sta != null) return card._sta;
  const A = card.attrs || {};
  let v = 0;
  Object.keys(STA_W).forEach((k) => { v += (A[k] == null ? 70 : A[k]) * STA_W[k]; });
  // 位置修正：内线普遍更耐操，后卫消耗更大
  const pos = card.pos;
  if (pos === 'C') v += 3.5;
  else if (pos === 'PF') v += 2;
  else if (pos === 'PG') v -= 1.5;
  // 用 id 做稳定扰动（±3），让同类型球员也有差异
  let h = 0;
  const id = String(card.id || '');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  v += (h % 61) / 10 - 3;
  card._sta = Math.round(Math.max(58, Math.min(135, v)) * 10) / 10;
  return card._sta;
}

/** 体力/精神类徽章的专属门槛（组合分的分布和单项能力不同） */
const MENTAL_MIN = { gold: 96, silver: 88, bronze: 80 };

/** 算某个精神徽章的"等效分值"，再套用门槛 */
function mentalScore(card, key) {
  const r = MENTAL_RULE[key];
  if (!r) return null;
  const sta = staminaOf(card);
  const av = card.attrs[r.attr] == null ? 70 : card.attrs[r.attr];
  return sta * r.sta + av * r.attrW + (r.base - 80) * 0.8;
}
const BADGE_TIERS = {
  bronze: { key: 'bronze', name: '铜徽章', color: '#c87f3a', c2: '#6b3d12', rank: 1, min: 85 },
  silver: { key: 'silver', name: '银徽章', color: '#cdd6e6', c2: '#6b7488', rank: 2, min: 90 },
  gold:   { key: 'gold',   name: '金徽章', color: '#f5c451', c2: '#8a5c00', rank: 3, min: 95 },
};
/** 各档位在「满突破」时能拥有的徽章数量上限与最高品质（这是天花板，不是初始值） */
const BADGE_CAP = {
  silver:       { max: 4,  top: 'bronze' },   // 银卡：最多 4 枚，且只到铜
  gold:         { max: 7,  top: 'silver' },   // 金卡：最多 7 枚，最高银
  purple:       { max: 12, top: 'gold' },     // 紫卡：可以出金
  legendPurple: { max: 15, top: 'gold' },     // 名宿紫：槽位更多
  momentGold:   { max: 18, top: 'gold' },
  momentPurple: { max: 22, top: 'gold' },
};

/* ---------- 徽章随突破解锁 ----------
   裸卡不给太多徽章，突破一阶解锁一个槽位；品质也要靠突破才能开：
     0~2 阶只能出铜徽章 → 3 阶解锁银 → 6 阶解锁金 → 满突破才拿满全部槽位。
   所以「一张裸的时刻紫卡只有 1 枚铜徽章」，想满身金徽章必须练满。 */
const BADGE_UNLOCK = [
  { n: 1,  top: 'bronze' },   // 0 阶 未突破
  { n: 2,  top: 'bronze' },   // 1 阶
  { n: 3,  top: 'bronze' },   // 2 阶
  { n: 5,  top: 'silver' },   // 3 阶 解锁银徽章
  { n: 6,  top: 'silver' },   // 4 阶
  { n: 8,  top: 'silver' },   // 5 阶
  { n: 11, top: 'gold' },     // 6 阶 解锁金徽章
  { n: 15, top: 'gold' },     // 7 阶
  { n: 19, top: 'gold' },     // 8 阶
  { n: 22, top: 'gold' },     // 9 阶 满突破（最高档拿满 22 枚）
];
/** 某张卡在某个突破阶段的徽章槽位与最高品质 */
function badgeSlots(tier, brk) {
  const cap = BADGE_CAP[tier] || BADGE_CAP.silver;
  const b = Math.max(0, Math.min(BREAK.stages, brk || 0));
  const u = BADGE_UNLOCK[b];
  const top = BADGE_TIERS[cap.top].rank <= BADGE_TIERS[u.top].rank ? cap.top : u.top;
  const max = Math.min(cap.max, u.n);
  const full = Math.min(cap.max, BADGE_UNLOCK[BREAK.stages].n);
  return { max, top, full, locked: Math.max(0, full - max) };
}
/* =============================================================
   球风 → 招牌徽章（参考 2K 的分配逻辑）
   -------------------------------------------------------------
   每名球员的球风决定他「该有」哪些徽章。
   在列表里的徽章走标准门槛（铜 83 / 银 90 / 金 97）；
   不在列表里的属于"不属于他的徽章"，要高出 8~10 点才可能拿到，
   而且最高只到银 —— 这样就不会出现：
     · 蓝领中锋顶着「神射手」
     · 纯射手拿着「盖帽狂魔」
     · 银卡球员一身金徽章
   ============================================================= */
/* =============================================================
   组合徽章（2K 风格）
   -------------------------------------------------------------
   2K 的徽章不是"某一项能力高就有"，而是几项能力的组合：
     「海报扣将」= 突破灌篮 + 力量 + 弹跳
     「贴身防守」= 外线防守 + 横移
   这里用加权平均判定，权重合计 = 1。
   ============================================================= */
const BADGE_COMBO = {
  aerialWizard:[['vertical',.4],['driveDunk',.35],['layup',.25]],
  posterizer:[['driveDunk',.5],['strength',.3],['vertical',.2]],
  slithery:[['layup',.45],['handle',.3],['onBallSpeed',.25]],
  fearless:[['layup',.45],['strength',.3],['drawFoul',.25]],
  fastTwitch:[['close',.4],['layup',.35],['vertical',.25]],
  riseUp:[['standDunk',.6],['strength',.4]],
  layupMix:[['layup',.5],['close',.3],['handle',.2]],
  giantSlayer:[['layup',.45],['close',.3],['offBallSpeed',.25]],
  bulldozer:[['strength',.5],['driveDunk',.3],['drawFoul',.2]],
  acrobat:[['layup',.45],['vertical',.3],['handle',.25]],
  postSpin:[['postControl',.55],['strength',.45]],
  dreamShake:[['postControl',.5],['postFade',.5]],
  hookSpecialist:[['postHook',.6],['postControl',.4]],
  putbackBoss:[['oreb',.55],['standDunk',.45]],
  deadeye:[['three',.5],['mid',.5]],
  limitless:[['three',.75],['offBallSpeed',.25]],
  catchShoot:[['catch',.5],['three',.5]],
  cornerSpec:[['three',.7],['catch',.3]],
  greenMachine:[['three',.6],['ft',.4]],
  pickPopper:[['mid',.5],['three',.5]],
  fadeAce:[['postFade',.6],['mid',.4]],
  middyMagician:[['mid',.75],['floater',.25]],
  floatGame:[['floater',.7],['close',.3]],
  ftAce:[['ft',.85],['mid',.15]],
  spaceCreator:[['three',.5],['handle',.5]],
  iceVeins:[['ft',.7],['mid',.3]],
  offBallSpec:[['offBallSpeed',.6],['three',.4]],
  ankleBreaker:[['handle',.55],['onBallSpeed',.45]],
  dimer:[['pass',.8],['catch',.2]],
  handles:[['handle',.8],['strength',.2]],
  hyperdrive:[['onBallSpeed',.6],['handle',.4]],
  touchPasser:[['pass',.6],['catch',.4]],
  breakStarter:[['pass',.55],['dreb',.45]],
  viceGrip:[['strength',.5],['catch',.5]],
  postPlaymaker:[['postControl',.5],['pass',.5]],
  relayPasser:[['pass',.6],['offBallSpeed',.4]],
  speedBooster:[['onBallSpeed',.7],['handle',.3]],
  bailOut:[['pass',.6],['drawFoul',.4]],
  floorGeneral:[['pass',.7],['three',.3]],
  unpluckable:[['handle',.6],['strength',.4]],
  engineBadge:[['pass',.45],['handle',.3],['three',.25]],
  clamps:[['perimD',.5],['lateral',.5]],
  pickDodger:[['lateral',.6],['hustle',.4]],
  interceptor:[['intercept',.75],['lateral',.25]],
  glove:[['steal',.8],['lateral',.2]],
  challenger:[['perimD',.6],['vertical',.4]],
  menace:[['perimD',.5],['steal',.5]],
  offBallPest:[['perimD',.55],['hustle',.45]],
  workHorse:[['hustle',.65],['strength',.35]],
  pogoStick:[['block',.6],['vertical',.4]],
  anchorD:[['intD',.55],['block',.45]],
  brickWall:[['strength',.6],['intD',.4]],
  immovable:[['strength',.7],['postD',.3]],
  postLockdown:[['postD',.65],['strength',.35]],
  pickpocket:[['steal',.65],['intercept',.35]],
  swissArmy:[['perimD',.4],['intD',.35],['lateral',.25]],
  defAnchor:[['intD',.45],['block',.3],['dreb',.25]],
  reboundChaser:[['dreb',.55],['oreb',.45]],
  boxoutBeast:[['boxout',.6],['strength',.4]],
  offRebounder:[['oreb',.65],['vertical',.35]],
  rebInstinct:[['dreb',.6],['hustle',.4]],
  aerialKing:[['oreb',.4],['vertical',.35],['strength',.25]],
  worm:[['boxout',.6],['hustle',.4]],
};
/** 组合徽章的加权分数 */
function comboScore(card, key) {
  const w = BADGE_COMBO[key];
  if (!w) return null;
  let sum = 0, tw = 0;
  w.forEach((pr) => {
    const v = card.attrs[pr[0]];
    if (v == null) return;
    sum += v * pr[1]; tw += pr[1];
  });
  return tw ? sum / tw : null;
}
const ARCH_BADGES = {
    sniper: ['limitless','catchShoot','cornerSpec','deadeye','middyMagician','ftAce','iceVeins','offBallSpec'],
    scorer: ['deadeye','middyMagician','fadeAce','posterizer','spaceCreator','clutchGenePro','greenMachine'],
    slasher: ['posterizer','slithery','fearless','acrobat','giantSlayer','ankleBreaker','layupMix'],
    floor_gen: ['dimer','ankleBreaker','handles','hyperdrive','touchPasser','floorGeneral','pickDodger','relayPasser'],
    two_way: ['clamps','interceptor','glove','challenger','menace','swissArmy','pickDodger'],
    anchor: ['anchorD','pogoStick','brickWall','postLockdown','defAnchor','reboundChaser','boxoutBeast','immovable'],
    skilled_big: ['dreamShake','hookSpecialist','postSpin','postPlaymaker','fadeAce','putbackBoss'],
    big_man: ['posterizer','riseUp','putbackBoss','reboundChaser','boxoutBeast','brickWall','aerialKing'],
    three_d: ['cornerSpec','catchShoot','clamps','offBallPest','pickpocket','limitless'],
    spark: ['ankleBreaker','slithery','acrobat','spaceCreator','speedBooster','hyperdrive'],
    freak_forward: ['posterizer','bulldozer','aerialWizard','pogoStick','swissArmy','putbackBoss'],
    point_forward: ['postPlaymaker','floorGeneral','dimer','viceGrip','breakStarter','unpluckable'],
};

/**
 * 徽章档次用绝对阈值判定。
 * 不用"相对综合分"是因为综合分带弱项下限，像库里这种均衡球星的
 * 综合(108) 反而高于他最准的一项(97)，相对判定会让他连招牌徽章都拿不到。
 * 所以：能力本身够不够硬，才是徽章的标准。
 */
const BADGE_MIN = { gold: 88, silver: 80, bronze: 72 };
function tierOfValue(v) {
  if (v >= BADGE_MIN.gold) return 'gold';
  if (v >= BADGE_MIN.silver) return 'silver';
  if (v >= BADGE_MIN.bronze) return 'bronze';
  return null;
}
function badgesOf(card, brk) {
  const slots = badgeSlots(card.tier, brk);
  const cap = { max: slots.max, top: slots.top };
  const topRank = BADGE_TIERS[cap.top].rank;
  const list = [];
  /* 这名球员的招牌徽章（球风决定） */
  const fav = ARCH_BADGES[card.arch] || [];
  // 非招牌徽章的准入门槛：高出一大截，而且最高只到银
  const OFF_MIN = { gold: 98, silver: 89, bronze: 80 };
  BADGE_DEFS.forEach((d) => {
    if (d.kind === 'mental') return;      // 精神类下面单独处理
      /* 组合徽章（2K 风格）：多项能力加权判定，单独走一条路 */
      if (d.kind === 'combo') {
        const cs = comboScore(card, d.key);
        if (cs == null) return;
        const isFavC = fav.indexOf(d.key) >= 0;
        let tc = tierOfValue(cs);
        if (!tc) return;
        if (!isFavC) {
          tc = tc === 'gold' ? 'silver' : tc === 'silver' ? 'bronze' : null;
          if (!tc) return;
        }
        if (BADGE_TIERS[tc].rank > topRank) tc = cap.top;
        list.push({ key: d.key, name: d.name, icon: d.icon, desc: d.desc,
          tier: tc, value: Math.round(cs), combo: true, off: !isFavC });
        return;
      }
    const v = card.attrs[d.key];
    if (v == null) return;
    const isFav = fav.indexOf(d.key) >= 0;
    let t = isFav ? tierOfValue(v)
      : (v >= OFF_MIN.gold ? 'silver'      // 非招牌最多给到银
        : v >= OFF_MIN.silver ? 'silver'
        : v >= OFF_MIN.bronze ? 'bronze' : null);
    if (!t) return;
    // 档位不够就先降级，而不是直接丢掉
    if (BADGE_TIERS[t].rank > topRank) t = cap.top;
    list.push({ key: d.key, name: d.name, icon: d.icon, desc: d.desc,
      tier: t, value: v, off: !isFav });
  });
  // 体力/精神类徽章：用组合规则判定，和属性徽章一起排序竞争槽位
  BADGE_DEFS.forEach((d) => {
    if (d.kind !== 'mental') return;
    const sc = mentalScore(card, d.key);
    if (sc == null) return;
    // 体力徽章用单独的门槛：组合分和单项属性不是一个分布
    let t = sc >= MENTAL_MIN.gold ? 'gold'
      : sc >= MENTAL_MIN.silver ? 'silver'
      : sc >= MENTAL_MIN.bronze ? 'bronze' : null;
    if (!t) return;
    // 精神类徽章同样看球风：不是这名球员类型的，降一档处理
    const isFavM = fav.indexOf(d.key) >= 0;
    if (!isFavM) {
      t = t === 'gold' ? 'silver' : t === 'silver' ? 'bronze' : null;
      if (!t) return;
    }
    if (BADGE_TIERS[t].rank > topRank) t = cap.top;
    list.push({ key: d.key, name: d.name, icon: d.icon, desc: d.desc,
      tier: t, value: Math.round(sc), mental: true, sta: staminaOf(card) });
  });
  // 排序：品质优先；同品质时**招牌徽章优先于非招牌**，再看数值
  list.sort((a, b) =>
    BADGE_TIERS[b.tier].rank - BADGE_TIERS[a.tier].rank
    || (a.off ? 1 : 0) - (b.off ? 1 : 0)
    || b.value - a.value);
  return list.slice(0, cap.max);
}
/** 查某张卡某个徽章的品质（没有就返回 null） */
function badgeTierOf(card, brk, key) {
  const hit = badgesOf(card, brk).filter((b) => b.key === key)[0];
  return hit ? hit.tier : null;
}
/** 徽章品质的数值系数：铜 1 / 银 2 / 金 3（没有 0） */
function badgeRank(card, brk, key) {
  const t = badgeTierOf(card, brk, key);
  return t ? BADGE_TIERS[t].rank : 0;
}

/* =============================================================
   徽章分类（参考 2K 的分类方式）
   -------------------------------------------------------------
   投射 / 终结 / 组织 / 防守 / 体能 五大类，
   详情页的「徽章」页签按这个分类展示，点左边看右边。
   ============================================================= */
  const BADGE_CATS = [
    { key: 'shot', name: '投射', en: 'Shooting', color: '#3fc46a', c2: '#1c6b38',
      icon: '🎯', badges: ['three','mid','floater','ft','catch','deadeye','limitless',
        'catchShoot','cornerSpec','greenMachine','pickPopper','fadeAce','middyMagician',
        'floatGame','ftAce','spaceCreator','iceVeins','clutchGenePro','offBallSpec','ice',
        'charged'] },
    { key: 'finish', name: '终结', en: 'Finishing', color: '#e0233f', c2: '#7a0f20',
      icon: '💥', badges: ['close','layup','standDunk','driveDunk','drawFoul','postFade',
        'postControl','postHook','strength','vertical','aerialWizard','posterizer',
        'slithery','fearless','fastTwitch','riseUp','layupMix','giantSlayer','bulldozer',
        'acrobat','postSpin','dreamShake','hookSpecialist','putbackBoss','tough'] },
    { key: 'play', name: '组织', en: 'Playmaking', color: '#f5c451', c2: '#8a5c00',
      icon: '🎩', badges: ['handle','pass','offBallSpeed','onBallSpeed','leader','motor',
        'ankleBreaker','dimer','handles','hyperdrive','touchPasser','breakStarter',
        'viceGrip','postPlaymaker','relayPasser','speedBooster','bailOut','floorGeneral',
        'unpluckable','engineBadge'] },
    { key: 'defense', name: '防守', en: 'Defense', color: '#4a9eff', c2: '#1b4d8a',
      icon: '🛡️', badges: ['perimD','steal','intercept','block','intD','postD','lateral',
        'hustle','clamps','pickDodger','interceptor','glove','challenger','menace',
        'offBallPest','workHorse','pogoStick','anchorD','brickWall','immovable',
        'postLockdown','pickpocket','swissArmy','defAnchor'] },
    { key: 'rebound', name: '篮板', en: 'Rebounding', color: '#c084fc', c2: '#5b1fa8',
      icon: '🧲', badges: ['oreb','dreb','boxout','reboundChaser','boxoutBeast',
        'offRebounder','rebInstinct','aerialKing','worm'] },
  ];
/* =============================================================
   徽章图标（每个徽章一套专属图案，不是统一的占位图）
   -------------------------------------------------------------
   用 24×24 视口的 SVG path，配合六边形底托一起显示。
   按功能区分：投射类画篮筐/球，终结类画扣篮/力量，
   组织类画传球/脚步，防守类画盾牌/手掌，体能类画电量/心脏。
   ============================================================= */
const BADGE_ICON = {
  /* ---- 投射 ---- */
  three:      'M12 3a7 7 0 0 0-7 7h3a4 4 0 0 1 8 0h3a7 7 0 0 0-7-7zm-8 9v9h16v-9H4zm2 2h12v5H6v-5z',
  mid:        'M12 2 4 10h3v10h10V10h3L12 2zm0 3.8L15.2 9H14v9h-4V9H8.8L12 5.8z',
  floater:    'M12 3c-3.9 0-7 3.1-7 7 0 2.6 1.4 4.9 3.5 6.1V21h7v-4.9C17.6 14.9 19 12.6 19 10c0-3.9-3.1-7-7-7zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  ft:         'M5 4h14v3H5V4zm0 5h14v3H5V9zm0 5h14v3H5v-3zm3 5h8v2H8v-2z',
  catch:      'M6 3h9l4 4v14H6V3zm2 2v14h9V8h-3V5H8zm2 5h6v2h-6v-2zm0 4h6v2h-6v-2z',
  clutchGene: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3v7l5 3-1.5 2.5L10 14V5h2z',
  clutchGenePro: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3v7l5 3-1.5 2.5L10 14V5h2z',
  ice:        'M12 2v20M2 12h20M5 5l14 14M19 5 5 19M12 5l3 3-3 3-3-3 3-3z',
  /* ---- 终结 ---- */
  close:      'M12 3 3 10v11h18V10L12 3zm0 3.5L18 11v7H6v-7l6-4.5z',
  layup:      'M4 20h16v-2H4v2zM7 9a5 5 0 0 1 10 0v6h-2V9a3 3 0 0 0-6 0v6H7V9z',
  standDunk:  'M12 2 8 8h2v6h4V8h2l-4-6zM6 16h12v2H6v-2zm0 3h12v2H6v-2z',
  driveDunk:  'M13 2 4 13h6v9l9-11h-6V2z',
  drawFoul:   'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4zm0 3.2 5 2.5V12c0 3.3-2.1 6.3-5 7-2.9-.7-5-3.7-5-7V7.7l5-2.5zM11 8h2v4h3l-4 4-4-4h3V8z',
  postFade:   'M5 20h14v-2H5v2zM12 3 6 9l2 2 3-3v9h2v-9l3 3 2-2-6-6z',
  postControl:'M4 20h16v-2H4v2zM8 4h8v3H8V4zm-2 5h12v3H6V9zm-2 5h16v3H4v-3z',
  postHook:   'M12 2C7 2 3 6 3 11h3a6 6 0 0 1 12 0h3c0-5-4-9-9-9zm-1 11h2v9h-2v-9z',
  strength:   'M4 9h3v6H4V9zm13 0h3v6h-3V9zM8 7h8v10H8V7zm2 2v6h4V9h-4z',
  vertical:   'M12 2 7 8h3v5h4V8h3l-5-6zM7 15h10v2H7v-2zm-2 3h14v2H5v-2z',
  /* ---- 组织 ---- */
  handle:     'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-1 7h2l4 5-1.6 1.2L13 13v8h-2v-8l-2.4 3.2L7 15l4-5z',
  pass:       'M2 12h13l-4-4 1.4-1.4L20 12l-7.6 5.4L11 16l4-4H2z',
  offBallSpeed:'M13 2 4 13h6l-1 9 9-11h-6l1-9z',
  onBallSpeed:'M4 18h16v2H4v-2zM12 3 6 9h3v6h6V9h3l-6-6z',
  leader:     'M3 18h18v2H3v-2zM5 8l3.5 3L12 5l3.5 6L19 8v8H5V8z',
  /* ---- 防守 ---- */
  intercept:  'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4zm0 3.2 5 2.5V12c0 3.3-2.1 6.3-5 7-2.9-.7-5-3.7-5-7V7.7l5-2.5z',
  steal:      'M9 3h6v3h-2v4h3l4 5-2 2-3-3v7h-2v-9H9v-3h2V6H9V3z',
  perimD:     'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4zm0 4 1.8 3.6 4 .6-2.9 2.8.7 4L12 15l-3.6 1.9.7-4L6.2 10l4-.6L12 6z',
  hustle:     'M12 2c1.7 0 2.5 1.3 2.9 2.4.9-.4 2.3-.2 3 .7.7.9.5 2.2 0 3 .9.6 1.4 1.9.9 3-.4.9-1.4 1.4-2.4 1.5.1 1-.4 2.2-1.5 2.7-1.1.5-2.3.1-3-.7-.7.9-2 1.3-3.1.8-1.1-.5-1.6-1.7-1.4-2.8-1-.1-2-.6-2.4-1.5-.5-1.1 0-2.4.9-3-.5-.8-.7-2.1 0-3 .7-.9 2.1-1.1 3-.7C9.3 3.3 10.1 2 12 2zm0 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  lateral:    'M3 12h4l3-6 4 12 3-6h4v2h-2.8l-4.2 8-4-12-1.8 4H3v-2z',
  block:      'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4zm5 8v3H7v-3h10z',
  intD:       'M12 2 3 6v7c0 5.2 3.8 9.4 9 10 5.2-.6 9-4.8 9-10V6l-9-4zm0 3 6 2.4V13c0 3.7-2.6 6.8-6 7.4-3.4-.6-6-3.7-6-7.4V7.4L12 5z',
  postD:      'M4 20h16v-2H4v2zM12 3 5 9l2 2 4-4v8h2V7l4 4 2-2-7-6z',
  oreb:       'M12 2v9H8l4 5 4-5h-4V2h0zM4 16h16v2H4v-2zm2 3h12v2H6v-2z',
  dreb:       'M6 3h12v18H6V3zm2 2v14h8V5H8zm2 3h4v2h-4V8zm0 4h4v2h-4v-2z',
  boxout:     'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
  enforcer:   'M12 2a8 8 0 0 0-8 8c0 3.1 1.8 5.8 4.4 7.2L9 22h6l.6-4.8A8 8 0 0 0 12 2zm-2.5 5h5l-1 4h2L11 19l.8-5H9.5L11 7h-1.5z',
  focus:      'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  /* ---- 体能 ---- */
  charged:    'M4 8h11v8H4V8zm12 2h2l2 2-2 2h-2v-4zM6 10v4h2v-4H6zm3 0v4h2v-4H9zm3 0v4h2v-4h-2z',
  relentless: 'M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21zm0-11-2 3h3l-2 3 4-4h-3l2-2h-2z',
  ironman:    'M12 2 4 5v7c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V5l-8-3zm0 3.2L18 7v5c0 3.3-2.1 6.3-6 7-3.9-.7-6-3.7-6-7V7l6-1.8zM11 8h2v4h3l-4 4-4-4h3V8z',
  motor:      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3a6 6 0 0 1 6 6h-3a3 3 0 0 0-3-3V6zM4 12h3a5 5 0 0 1 5-5v3a2 2 0 0 0-2 2H4z',
  tough:      'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4zm0 4 5 2v4c0 3.3-2.1 6.3-5 7-2.9-.7-5-3.7-5-7V8l5-2zm-1 3v6h2V9h-2z',
};

/** 取某个徽章的图标 path（找不到就用通用盾牌） */
function badgeIconPath(key) {
  return BADGE_ICON[key] || 'M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4z';
}

/** 徽章 key → 分类 */
const BADGE_CAT_OF = {};
BADGE_CATS.forEach((c) => c.badges.forEach((k) => { BADGE_CAT_OF[k] = c; }));
/** 某个分类里，这名球员拥有哪些徽章 */
function badgesInCat(card, brk, catKey) {
  const cat = BADGE_CATS.filter((c) => c.key === catKey)[0];
  if (!cat) return [];
  const owned = badgesOf(card, brk).filter((b) => cat.badges.indexOf(b.key) >= 0);
  // 按铜→银→金排序，同档按分值
  const order = { gold: 3, silver: 2, bronze: 1 };
  return owned.sort((a, b) =>
    order[b.tier] - order[a.tier] || (b.value || 0) - (a.value || 0));
}
/** 各分类的徽章数量（详情页左侧用） */
function badgeCatCounts(card, brk) {
  const out = {};
  BADGE_CATS.forEach((c) => { out[c.key] = badgesInCat(card, brk, c.key).length; });
  return out;
}

/** 徽章按大类归类，用于详情页左侧的"投射 8 / 终结 11"统计 */
function badgeStats(card) {
  const out = {};
  ATTR_GROUPS.forEach((g) => { out[g.key] = { name: g.name, color: g.color, n: 0, total: g.attrs.length }; });
  badgesOf(card).forEach((b) => {
    const g = ATTR_GROUP_OF[b.key];
    if (g) out[g.key].n++;
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TIERS, TIER_ORDER, ATTR_GROUPS, ATTRS, ATTR_NAME, ATTR_KEYS, BREAK, BREAK_LABEL,
    BREAK_PER_TIER, breakPerOf, breakTotalOf, breakOwnOf, breakAttrAt, breakOvrAt,
    BREAK_ATTR_AT, BREAK_OVR_AT,
    CARDS, CARD_BY_ID, POOLS, PITY,
    computeOvr, groupScores, badgesOf, cardsOfTier, posGroup,
    expandAttrs, gradeOf, valueOf, salaryOf, salaryOfTier, SALARY_BY_TIER, SALARY_CAP, salarySumOf, ATTR_GROUPS, ATTR_GROUP_OF, badgesOf, badgeStats, tierOfValue, BADGE_MIN, BADGE_DEFS, BADGE_TIERS, BADGE_CAP, BADGE_UNLOCK, badgeSlots,
    BASE_KEYS: ['three','mid','ft','catch','layup','dunk','post','foul','pass','handle','vision',
      'pd','id','steal','block','reb','spd','acc','str','vert','sta'] };
}

/* ---------- 调试：?badgelogic=1 徽章分配合理性自检 ----------
   注意：data.js 也会在 Node（tools/check.js、打包脚本）里被执行，
   那里没有 document，所以必须先判断环境，否则整个构建会崩。 */
(function badgeLogicTest() {
  if (typeof document === 'undefined' || typeof location === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('badgelogic')) return;
    setTimeout(() => {
      const out = [];
      // ① 银卡不该有金徽章
      let bad = 0, checked = 0;
      CARDS.filter((c) => c.tier === 'silver').forEach((c) => {
        badgesOf(c, 8).forEach((b) => {
          checked++;
          if (BADGE_TIERS[b.tier].rank > BADGE_TIERS[BADGE_CAP.silver.top].rank) bad++;
        });
      });
      out.push('银卡满突破 ' + checked + ' 枚徽章，超品质 ' + bad + ' 枚' +
        (bad === 0 ? ' ✓' : ' ✗'));

      // ② 金卡不该有金徽章
      let bad2 = 0, n2 = 0;
      CARDS.filter((c) => c.tier === 'gold').forEach((c) => {
        badgesOf(c, 8).forEach((b) => {
          n2++;
          if (BADGE_TIERS[b.tier].rank > BADGE_TIERS[BADGE_CAP.gold.top].rank) bad2++;
        });
      });
      out.push('金卡满突破 ' + n2 + ' 枚，超品质 ' + bad2 + ' 枚' +
        (bad2 === 0 ? ' ✓' : ' ✗'));

      // ③ 球风不匹配的徽章（抽查几个典型）
      const cases = [
        ['big_man', 'three', '蓝领中锋不该有神射手'],
        ['sniper', 'block', '射手不该有盖帽狂魔'],
        ['anchor', 'three', '护框中锋不该有神射手'],
        ['floor_gen', 'postHook', '组织核心不该有勾手大师'],
      ];
      cases.forEach(([arch, key, desc]) => {
        const cs = CARDS.filter((c) => c.arch === arch);
        let hit = 0, gold = 0;
        cs.forEach((c) => {
          badgesOf(c, 8).forEach((b) => {
            if (b.key === key) { hit++; if (b.tier === 'gold') gold++; }
          });
        });
        out.push(desc + '：' + cs.length + '人中有 ' + hit + ' 人拿到（金 ' + gold +
          '）' + (gold === 0 ? ' ✓无金' : ' ✗有金'));
      });

      // ④ 招牌徽章占比
      let favN = 0, totN = 0;
      CARDS.filter((c) => c.tier === 'purple').slice(0, 60).forEach((c) => {
        badgesOf(c, 8).forEach((b) => {
          totN++;
          if (!b.off) favN++;
        });
      });
      out.push('紫卡徽章里招牌技能占 ' + Math.round(favN / totN * 100) + '%' +
        (favN / totN > 0.6 ? ' ✓' : ' ⚠'));
      document.title = 'BADGELOGIC ' + out.join(' | ');
    }, 900);
  } catch (e) { document.title = 'BADGELOGIC-ERR ' + e.message; }
})();

/* ---------- 调试：?badge2=1 徽章系统自检 ---------- */
(function badge2Test() {
  if (typeof document === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search);
    if (!q.get('badge2')) return;
    const out = [];
    setTimeout(() => {
      out.push('徽章总数=' + BADGE_DEFS.length);
      const cats = {};
      BADGE_DEFS.forEach((d) => {
        const c = (BADGE_CAT_OF[d.key] || {}).name || '未分类';
        cats[c] = (cats[c] || 0) + 1;
      });
      out.push('分类: ' + Object.keys(cats).map((k) => k + cats[k]).join(' '));
      const combos = BADGE_DEFS.filter((d) => d.kind === 'combo').length;
      out.push('组合徽章=' + combos + ' 枚');
      // 拿几张代表性球员看徽章
      const test = ['Stephen Curry', 'Larry Bird', 'Rudy Gobert', 'Tim Duncan'];
      test.forEach((en) => {
        const c = CARDS.filter((x) => x.en === en).sort(
          (a, b2) => tierIdx(b2.tier) - tierIdx(a.tier))[0];
        if (!c) return;
        const bs = badgesOf(c, 8);
        const gold = bs.filter((b2) => b2.tier === 'gold').length;
        out.push(c.name + '(' + c.tier + ') ' + bs.length + ' 枚/金' + gold +
          ': ' + bs.slice(0, 6).map((b2) => b2.name).join('、'));
      });
      document.title = 'BADGE2 ' + out.join(' | ');
    }, 1200);
  } catch (e) { document.title = 'BADGE2-ERR ' + e.message; }
})();
