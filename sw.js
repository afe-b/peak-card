/* =============================================================
   🏀 巅峰球星卡 · Service Worker（离线玩 · v4 极简稳定版）
   -------------------------------------------------------------
   ★ 为什么放弃 v3 的"SW 自己下载 589 张图"
   -------------------------------------------------------------
   v3 让 SW 在后台批量下载全部卡图，并维护一个 IndexedDB 队列。
   实机（iPhone）上彻底失败：
     · iOS 会**随时掐断** SW（省电策略），掐断后重启新实例；
     · 新旧实例同时读写同一个队列 → **竞态**，队列被写坏；
     · 用户看到 **622/621**（超过 100%）、进度 **30%→0%→50%→0%** 乱跳；
     · 队列损坏后浮层永远停在"正在准备离线版"，
       即使显示 100% 也**打不开游戏**。

   ★ v4 的设计：**页面驱动，SW 只负责"存"**
   -------------------------------------------------------------
   · SW 里**没有任何批量下载逻辑**（不跑队列、不写 IndexedDB）。
     它只做两件事：
       ① fetch 拦截：缓存优先；联网拿到的资源顺手存进 Cache Storage；
       ② 离线兜底：没缓存的**图片**返回 SVG 占位卡，**页面**返回首页。
   · 批量下载交给**页面**（app.js）—— 页面是前台任务，不会被 iOS 掐断，
     进度、断点、重试全在页面里，单一数据源，不可能乱跳。
   · SW 与页面之间协议只有一条：
       page → sw : { type:'sw-missing', urls:[...] }
       sw → page : { type:'sw-missing-result', total, cached, missing:[...] }

   ★ 额外好处
   -------------------------------------------------------------
   · SW 代码短，出错面小、易验证；
   · 更新 SW 不需要迁移队列，不会再有"半途状态"；
   · 页面下载时能精确控制并发（iOS 上 4 并发最稳），
     并且能显示**单调递增**的进度。
   ============================================================= */

const VERSION = "385b5997be";
const CACHE = 'peak-card-' + VERSION;

/* 安装时需要拿到的核心文件（保证离线能启动） */
const CORE = ["app.js","arena-audio.js","badge-fx.js","battle.css","battle.js","cards.css","cardv2.css","career.css","career.js","coach.js","compat.css","data.js","hof.js","holo.css","index.html","landscape.css","league.css","league.js","manifest.webmanifest","offline.css","perf.css","platform.css","pwa.css","pwa.js","quests.js","save-portal.js","season.js","teamui.css","teamui.js","viewer.css","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg"];
/* 全部资源（只用于算"还差多少"，不在这里下载） */
const ALL = ["app.js","arena-audio.js","badge-fx.js","battle.css","battle.js","cards.css","cardv2.css","career.css","career.js","coach.js","compat.css","data.js","hof.js","holo.css","index.html","landscape.css","league.css","league.js","manifest.webmanifest","offline.css","perf.css","platform.css","pwa.css","pwa.js","quests.js","save-portal.js","season.js","teamui.css","teamui.js","viewer.css","img/aaron-brooks.webp","img/aaron-gordon.webp","img/adam-morrison.webp","img/al-farouq-aminu.webp","img/al-harrington.webp","img/al-horford.webp","img/al-jefferson.webp","img/aleksandar-or-evic.webp","img/alex-abrines.webp","img/alex-caruso.webp","img/alex-len.webp","img/alexey-shved.webp","img/allan-houston.webp","img/allen-iverson-m.webp","img/allen-iverson.webp","img/alonzo-mourning-m.webp","img/alonzo-mourning.webp","img/alperen-sengun.webp","img/amar-e-stoudemire-m.webp","img/amar-e-stoudemire.webp","img/anderson-varejao.webp","img/andre-drummond.webp","img/andre-iguodala.webp","img/andre-miller.webp","img/andrea-bargnani.webp","img/andrei-kirilenko.webp","img/andres-nocioni.webp","img/andrew-bogut.webp","img/andrew-bynum.webp","img/andrew-wiggins.webp","img/andris-biedrins.webp","img/antawn-jamison.webp","img/anthony-bennett.webp","img/anthony-davis.webp","img/anthony-edwards.webp","img/antonio-daniels.webp","img/antonio-mcdyess.webp","img/aron-baynes.webp","img/artis-gilmore.webp","img/arvydas-sabonis.webp","img/ausar-thompson.webp","img/austin-reaves.webp","img/avery-bradley.webp","img/bam-adebayo.webp","img/baron-davis.webp","img/ben-gordon.webp","img/ben-simmons.webp","img/ben-wallace-m.webp","img/ben-wallace.webp","img/bernard-king.webp","img/bill-bradley.webp","img/bill-russell-m.webp","img/bill-russell.webp","img/bismack-biyombo.webp","img/blake-griffin.webp","img/bob-cousy.webp","img/bob-mcadoo.webp","img/bob-pettit.webp","img/boban-marjanovic.webp","img/bobby-portis.webp","img/bogdan-bogdanovic.webp","img/bojan-bogdanovic.webp","img/boris-diaw.webp","img/brad-miller.webp","img/bradley-beal.webp","img/brandon-bass.webp","img/brandon-ingram.webp","img/brandon-jennings.webp","img/brandon-miller.webp","img/brandon-roy.webp","img/brian-scalabrine.webp","img/bronny-james.webp","img/brook-lopez.webp","img/bruce-bowen.webp","img/buddy-hield.webp","img/cade-cunningham.webp","img/cameron-johnson.webp","img/caris-levert.webp","img/carlos-arroyo.webp","img/carlos-boozer.webp","img/carlos-delfino.webp","img/carmelo-anthony-m.webp","img/carmelo-anthony.webp","img/caron-butler.webp","img/cedi-osman.webp","img/chandler-parsons.webp","img/channing-frye.webp","img/charles-barkley-m.webp","img/charles-oakley.webp","img/chauncey-billups-m.webp","img/chauncey-billups.webp","img/chet-holmgren.webp","img/chris-andersen.webp","img/chris-bosh-m.webp","img/chris-bosh.webp","img/chris-kaman.webp","img/chris-mullin.webp","img/chris-paul-m.webp","img/chris-paul.webp","img/chris-webber-m.webp","img/christian-laettner.webp","img/christian-wood.webp","img/chuck-connors.webp","img/cj-mccollum.webp","img/clint-capela.webp","img/clyde-drexler.webp","img/coby-white.webp","img/collin-sexton.webp","img/corey-brewer.webp","img/cory-joseph.webp","img/courtney-lee.webp","img/cuttino-mobley.webp","img/d-angelo-russell.webp","img/d-j-augustin.webp","img/damian-lillard-m.webp","img/damian-lillard.webp","img/dan-majerle.webp","img/daniel-gafford.webp","img/daniel-theis.webp","img/danilo-gallinari.webp","img/danny-granger.webp","img/danny-green.webp","img/dante-exum.webp","img/dario-saric.webp","img/darius-garland.webp","img/darius-miles.webp","img/darius-songaila.webp","img/darko-milicic.webp","img/darren-collison.webp","img/dave-bing.webp","img/dave-cowens.webp","img/david-andersen.webp","img/david-lee.webp","img/david-robinson-m.webp","img/david-robinson.webp","img/david-west.webp","img/davis-bertans.webp","img/deaaron-fox.webp","img/deandre-ayton.webp","img/deandre-jordan.webp","img/demar-derozan.webp","img/demarcus-cousins.webp","img/dennis-rodman.webp","img/dennis-schroder.webp","img/derek-fisher.webp","img/deron-williams.webp","img/derrick-coleman.webp","img/derrick-favors.webp","img/derrick-jones-jr.webp","img/derrick-rose-m.webp","img/derrick-rose.webp","img/derrick-white.webp","img/desmond-bane.webp","img/desmond-mason.webp","img/detlef-schrempf.webp","img/devin-booker-m.webp","img/devin-booker.webp","img/devin-harris.webp","img/devin-vassell.webp","img/dikembe-mutombo-m.webp","img/dikembe-mutombo.webp","img/dino-ra-a.webp","img/dirk-nowitzki-m.webp","img/dirk-nowitzki.webp","img/dolph-schayes.webp","img/domantas-sabonis.webp","img/dominique-wilkins.webp","img/donatas-motiejunas.webp","img/donovan-mitchell.webp","img/donte-divincenzo.webp","img/dorian-finney-smith.webp","img/doug-christie.webp","img/draymond-green.webp","img/drazen-petrovic.webp","img/drew-gooden.webp","img/duncan-robinson.webp","img/dwight-howard-m.webp","img/dwight-howard.webp","img/dwight-powell.webp","img/dwyane-wade-m.webp","img/dwyane-wade.webp","img/dyson-daniels.webp","img/dzanan-musa.webp","img/earl-boykins.webp","img/earl-watson.webp","img/eddie-jones.webp","img/eddy-curry.webp","img/elgin-baylor.webp","img/elton-brand.webp","img/elvin-hayes.webp","img/emeka-okafor.webp","img/enes-kanter-freedom.webp","img/eric-gordon.webp","img/erick-dampier.webp","img/ersan-ilyasova.webp","img/evan-fournier.webp","img/evan-mobley.webp","img/evan-turner.webp","img/fabricio-oberto.webp","img/frank-ntilikina.webp","img/franz-wagner.webp","img/fred-vanvleet.webp","img/gary-payton-ii.webp","img/gary-payton-m.webp","img/gary-payton.webp","img/george-mikan.webp","img/gerald-wallace.webp","img/gheorghe-muresan.webp","img/giannis-antetokounmpo-m.webp","img/giannis-antetokounmpo.webp","img/gilbert-arenas-m.webp","img/gilbert-arenas.webp","img/glen-davis.webp","img/glen-rice.webp","img/goran-dragic.webp","img/gordon-hayward.webp","img/grant-hill-m.webp","img/grant-hill.webp","img/grayson-allen.webp","img/greg-monroe.webp","img/greg-oden.webp","img/hakeem-olajuwon-m.webp","img/hanno-mottola.webp","img/harrison-barnes.webp","img/hasheem-thabeet.webp","img/hassan-whiteside.webp","img/herbert-jones.webp","img/hidayet-turkoglu.webp","img/horace-grant.webp","img/igor-rakocevic.webp","img/iman-shumpert.webp","img/isaiah-thomas.webp","img/ish-smith.webp","img/ivica-zubac.webp","img/j-j-barea.webp","img/j-r-smith.webp","img/ja-morant.webp","img/jaden-mcdaniels.webp","img/jalen-brunson.webp","img/jalen-green.webp","img/jalen-johnson.webp","img/jalen-rose.webp","img/jalen-suggs.webp","img/jalen-williams.webp","img/jamal-crawford.webp","img/jamal-murray.webp","img/jameer-nelson.webp","img/james-harden-m.webp","img/james-harden.webp","img/james-jones.webp","img/james-worthy.webp","img/jan-vesely.webp","img/jared-dudley.webp","img/jaren-jackson-jr.webp","img/jarrett-allen.webp","img/jason-collins.webp","img/jason-kapono.webp","img/jason-kidd-m.webp","img/jason-kidd.webp","img/jason-richardson.webp","img/jason-terry.webp","img/jason-williams.webp","img/javale-mcgee.webp","img/jaylen-brown.webp","img/jayson-tatum.webp","img/jeff-green.webp","img/jeff-hornacek.webp","img/jeff-teague.webp","img/jerami-grant.webp","img/jeremy-lin.webp","img/jermaine-o-neal.webp","img/jerry-lucas.webp","img/jerry-stackhouse.webp","img/jerry-west-m.webp","img/jerry-west.webp","img/jimmer-fredette.webp","img/jimmy-butler.webp","img/jj-redick.webp","img/jo-jo-white.webp","img/joakim-noah.webp","img/joe-dumars.webp","img/joe-ingles.webp","img/joe-johnson.webp","img/joel-anthony.webp","img/joel-embiid.webp","img/john-havlicek.webp","img/john-stockton.webp","img/john-wall.webp","img/jonas-jerebko.webp","img/jonas-valanciunas.webp","img/jonathan-isaac.webp","img/jonathan-kuminga.webp","img/jordan-clarkson.webp","img/jordan-farmar.webp","img/jordan-poole.webp","img/jorge-garbajosa.webp","img/jose-calderon.webp","img/josh-giddey.webp","img/josh-hart.webp","img/josh-howard.webp","img/josh-okogie.webp","img/josh-smith.webp","img/jrue-holiday.webp","img/juan-carlos-navarro.webp","img/juan-hernangomez.webp","img/julius-erving.webp","img/julius-randle.webp","img/jusuf-nurkic.webp","img/juwan-howard.webp","img/karl-anthony-towns.webp","img/karl-malone-m.webp","img/karl-malone.webp","img/kawhi-leonard-m.webp","img/kawhi-leonard.webp","img/kelly-olynyk.webp","img/kelly-oubre-jr.webp","img/kemba-walker.webp","img/kendrick-perkins.webp","img/kenneth-faried.webp","img/kentavious-caldwell-pope.webp","img/kenyon-martin.webp","img/kevin-durant-m.webp","img/kevin-durant.webp","img/kevin-garnett-m.webp","img/kevin-garnett.webp","img/kevin-johnson.webp","img/kevin-love.webp","img/kevin-martin.webp","img/kevin-mchale.webp","img/kevon-looney.webp","img/khris-middleton.webp","img/kirk-hinrich.webp","img/klay-thompson-m.webp","img/klay-thompson.webp","img/kobe-bryant-m.webp","img/kobe-bryant.webp","img/kris-humphries.webp","img/kristaps-porzingis.webp","img/kwame-brown.webp","img/kyle-anderson.webp","img/kyle-korver.webp","img/kyle-kuzma.webp","img/kyle-lowry.webp","img/kyrie-irving-m.webp","img/kyrie-irving.webp","img/lamar-odom.webp","img/lamarcus-aldridge.webp","img/lamelo-ball.webp","img/lance-stephenson.webp","img/larry-bird-m.webp","img/larry-bird.webp","img/larry-hughes.webp","img/larry-johnson.webp","img/larry-nance-jr.webp","img/lauri-markkanen.webp","img/leandro-barbosa.webp","img/lebron-james-m.webp","img/lebron-james.webp","img/lonzo-ball.webp","img/lou-williams.webp","img/luguentz-dort.webp","img/luis-scola.webp","img/luka-doncic-m.webp","img/luka-doncic.webp","img/luke-kennard.webp","img/luke-walton.webp","img/luol-deng.webp","img/magic-johnson-m.webp","img/mahmoud-abdul-rauf.webp","img/malcolm-brogdon.webp","img/malik-monk.webp","img/manu-ginobili-m.webp","img/manu-ginobili.webp","img/marc-gasol.webp","img/marcin-gortat.webp","img/marco-belinelli.webp","img/marcus-camby.webp","img/marcus-smart.webp","img/mario-chalmers.webp","img/mario-hezonja.webp","img/mark-eaton.webp","img/marvin-bagley-iii.webp","img/matisse-thybulle.webp","img/matt-barnes.webp","img/matthew-dellavedova.webp","img/max-strus.webp","img/mehmet-okur.webp","img/metta-sandiford-artest.webp","img/michael-beasley.webp","img/michael-jordan-m.webp","img/michael-porter-jr.webp","img/michael-redd.webp","img/mickael-pietrus.webp","img/mikal-bridges.webp","img/mike-bibby.webp","img/mike-conley-jr.webp","img/mike-miller.webp","img/miles-bridges.webp","img/milos-teodosic.webp","img/mitch-richmond.webp","img/mitchell-robinson.webp","img/mo-williams.webp","img/monta-ellis.webp","img/moritz-wagner.webp","img/moses-malone.webp","img/myles-turner.webp","img/nando-de-colo.webp","img/nate-robinson.webp","img/nate-thurmond.webp","img/naz-reid.webp","img/nemanja-nedovic.webp","img/nenad-krstic.webp","img/nene.webp","img/nick-calathes.webp","img/nick-van-exel.webp","img/nick-young.webp","img/nicolas-batum.webp","img/nikola-jokic-m.webp","img/nikola-jokic.webp","img/nikola-mirotic.webp","img/nikola-pekovic.webp","img/nikola-vucevic.webp","img/norman-powell.webp","img/og-anunoby.webp","img/omer-as-k.webp","img/onyeka-okongwu.webp","img/oscar-robertson-m.webp","img/oscar-robertson.webp","img/otis-thorpe.webp","img/pablo-prigioni.webp","img/paolo-banchero.webp","img/pascal-siakam.webp","img/pat-connaughton.webp","img/patrick-beverley.webp","img/patrick-ewing-m.webp","img/patrick-ewing.webp","img/patty-mills.webp","img/pau-gasol-m.webp","img/pau-gasol.webp","img/paul-arizin.webp","img/paul-george.webp","img/paul-millsap.webp","img/paul-pierce-m.webp","img/paul-pierce.webp","img/payton-pritchard.webp","img/peja-stojakovic.webp","img/penny-hardaway-m.webp","img/penny-hardaway.webp","img/pero-antic.webp","img/pete-maravich.webp","img/predrag-danilovic.webp","img/raja-bell.webp","img/rajon-rondo.webp","img/rashard-lewis.webp","img/rasheed-wallace.webp","img/rasho-nesterovic.webp","img/raul-lopez.webp","img/ray-allen-m.webp","img/ray-allen.webp","img/raymond-felton.webp","img/reggie-jackson.webp","img/reggie-miller-m.webp","img/reggie-miller.webp","img/richard-hamilton.webp","img/richard-jefferson.webp","img/rick-barry.webp","img/rick-fox.webp","img/ricky-davis.webp","img/ricky-rubio.webp","img/rik-smits.webp","img/rj-barrett.webp","img/robert-archibald.webp","img/robert-horry.webp","img/robert-parish.webp","img/robert-williams-iii.webp","img/robin-lopez.webp","img/rodrigue-beaubois.webp","img/ronny-turiaf.webp","img/rudy-fernandez.webp","img/rudy-gay.webp","img/rudy-gobert.webp","img/rui-hachimura.webp","img/russell-westbrook-m.webp","img/russell-westbrook.webp","img/ryan-anderson.webp","img/sam-cassell.webp","img/sam-jones.webp","img/samuel-dalembert.webp","img/sarunas-jasikevicius.webp","img/sasha-kaun.webp","img/sasha-vujacic.webp","img/scoot-henderson.webp","img/scottie-barnes.webp","img/scottie-pippen-m.webp","img/semih-erden.webp","img/serge-ibaka.webp","img/sergei-monia.webp","img/sergey-karasev.webp","img/sergio-rodriguez.webp","img/seth-curry.webp","img/shai-gilgeous-alexander-m.webp","img/shai-gilgeous-alexander.webp","img/shane-battier.webp","img/shaquille-o-neal-m.webp","img/shaquille-o-neal.webp","img/shareef-abdur-rahim.webp","img/shaun-livingston.webp","img/shawn-bradley.webp","img/shawn-kemp-m.webp","img/shawn-marion-m.webp","img/shawn-marion.webp","img/spud-webb.webp","img/stephen-curry-m.webp","img/stephen-curry.webp","img/stephen-jackson.webp","img/stephon-marbury.webp","img/steve-francis.webp","img/steve-kerr.webp","img/steve-nash-m.webp","img/steve-nash.webp","img/steve-smith.webp","img/steven-adams.webp","img/sviatoslav-mykhailiuk.webp","img/t-j-mcconnell.webp","img/taj-gibson.webp","img/tayshaun-prince.webp","img/terry-rozier.webp","img/thabo-sefolosha.webp","img/thaddeus-young.webp","img/tiago-splitter.webp","img/tim-duncan-m.webp","img/tim-duncan.webp","img/tim-hardaway-jr.webp","img/tim-hardaway.webp","img/timofey-mozgov.webp","img/tobias-harris.webp","img/tomas-satoransky.webp","img/toni-kukoc.webp","img/tony-allen.webp","img/tony-parker-m.webp","img/tony-parker.webp","img/tornike-shengelia.webp","img/tracy-mcgrady-m.webp","img/tracy-mcgrady-x.webp","img/tracy-mcgrady.webp","img/trae-young.webp","img/trevor-ariza.webp","img/tristan-thompson.webp","img/troy-murphy.webp","img/ty-lawson.webp","img/tyler-herro.webp","img/tyreke-evans.webp","img/tyrese-haliburton.webp","img/tyrese-maxey.webp","img/tyronn-lue.webp","img/tyson-chandler.webp","img/tyus-jones.webp","img/udonis-haslem.webp","img/vassilis-spanoulis.webp","img/victor-claver.webp","img/victor-oladipo.webp","img/victor-wembanyama.webp","img/viktor-khryapa.webp","img/vince-carter-m.webp","img/vince-carter.webp","img/vlade-divac.webp","img/vladimir-radmanovic.webp","img/walt-bellamy.webp","img/walt-frazier.webp","img/walter-herrmann.webp","img/wang-zhizhi.webp","img/wendell-carter-jr.webp","img/wes-unseld.webp","img/willis-reed-m.webp","img/willis-reed.webp","img/willy-hernangomez.webp","img/wilt-chamberlain-m.webp","img/wilt-chamberlain.webp","img/yao-ming-m.webp","img/yao-ming.webp","img/yi-jianlian.webp","img/zach-edey.webp","img/zach-lavine.webp","img/zach-randolph.webp","img/zaza-pachulia.webp","img/zion-williamson.webp","img/zoran-dragic.webp","img/zoran-planinic.webp","img/zydrunas-ilgauskas.webp","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg"];

/* -------------------------------------------------------------
   安装：只抓核心文件（约 2 MB，秒完）
   ------------------------------------------------------------- */
self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(new Request(url), res.clone());
      } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

/* -------------------------------------------------------------
   激活：清掉所有旧版本缓存 + v3 遗留的队列数据库
   ------------------------------------------------------------- */
self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('peak-card-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    /* ★ v3 用 IndexedDB 存队列，现在不用了 —— 清掉避免旧逻辑干扰 */
    try { indexedDB.deleteDatabase('peak-card-sw'); } catch (e) {}
    await self.clients.claim();
    /* ★★★ v9.50 修复"更新后横幅不消失、每次打开都弹"
       -------------------------------------------------------------
       根因：页面拿"当前 SW 版本"时，如果问的是**旧** SW（controller
       还没切换），拿到的是旧版本号；而"有新版本"的判定依赖
       `记录版本 ≠ 服务器版本`，于是下次打开**又弹一次**。
       实测：更新成功后 localStorage 里仍是旧版本号。

       修法：新 SW 接管后**主动广播**自己的版本号。
       页面收到后把"记录版本"登记成它 —— 这样记录始终等于服务器版本，
       下次打开就不会误判成有新版本。 */
    try {
      const list = await self.clients.matchAll();
      list.forEach((c) => c.postMessage({ type: 'sw-version', version: VERSION }));
    } catch (e) {}
  })());
});

/* -------------------------------------------------------------
   兜底占位图（离线且没缓存时给一张"卡面"，不裂图）
   ------------------------------------------------------------- */
const _ph = new Map();
function placeholderFor(pathname) {
  if (_ph.has(pathname)) return _ph.get(pathname);
  const slug = decodeURIComponent(String(pathname).split('/').pop().replace(/\.\w+$/, ''));
  const label = (slug.split(/[-_]/).map((w) => w.charAt(0).toUpperCase()).join('') || 'NBA').slice(0, 3);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="340" viewBox="0 0 300 340">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#2b3f78"/><stop offset="100%" stop-color="#16224a"/>' +
    '</linearGradient></defs>' +
    '<rect width="300" height="340" fill="url(#g)"/>' +
    '<circle cx="150" cy="138" r="60" fill="none" stroke="#f5c451" stroke-width="6" opacity="0.5"/>' +
    '<path d="M90 138h120M150 78v120M112 100q38 38 0 76M188 100q-38 38 0 76" ' +
    'stroke="#f5c451" stroke-width="5" fill="none" opacity="0.4"/>' +
    '<text x="150" y="250" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" ' +
    'font-size="40" font-weight="900" fill="#f5c451" opacity="0.85">' + label + '</text>' +
    '<text x="150" y="290" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" ' +
    'font-size="16" fill="#9fb0d0" opacity="0.75">待联网补齐</text>' +
    '</svg>';
  const res = new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  _ph.set(pathname, res);
  return res;
}

/* -------------------------------------------------------------
   取用：缓存优先 → 联网（顺手存）→ 占位图 / 首页
   ------------------------------------------------------------- */
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  /* sw.js 自己不进缓存，否则更新会被自己卡住 */
  if (url.pathname.endsWith('/sw.js')) return;

  ev.respondWith((async () => {
    let cache = null;
    try { cache = await caches.open(CACHE); } catch (e) {}

    if (cache) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
    }

    try {
      const res = await fetch(req);
      /* ★ 只缓存同源、成功、basic 的响应，避免把 304/opaque 写进缓存 */
      if (cache && res && res.ok && res.type === 'basic') {
        try { await cache.put(new Request(url.href), res.clone()); } catch (e) {}
      }
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        if (cache) {
          const idx = (await cache.match('index.html')) || (await cache.match('./'));
          if (idx) return idx;
        }
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>离线</title>' +
          '<body style="font:16px system-ui;background:#05070f;color:#dfe8ff;padding:40px;text-align:center">' +
          '<h2>📴 暂时打不开</h2><p>请先联网打开一次，让游戏完成离线缓存。</p></body>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (req.destination === 'image' || /\.(webp|png|jpe?g|gif|svg)$/i.test(url.pathname)) {
        return placeholderFor(url.pathname);
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

/* -------------------------------------------------------------
   页面消息：只回答"这些 URL 里哪些还没缓存"
   -------------------------------------------------------------
   ★ 下载由**页面**驱动（页面不会被 iOS 掐断），SW 只负责查和存。
     这样彻底消除 v3 那种"多个 SW 实例抢队列"的竞态。
   ============================================================= */
self.addEventListener('message', (ev) => {
  const d = ev.data || {};

  /* 页面问"你是什么版本" —— 用于判断是否有新版。
     ★ 优先用消息里带的 MessagePort 回（页面传了 port 就用 port），
       否则用 ev.source。之前只发 ev.source，页面用 MessageChannel 听
       就永远收不到 —— 这是"版本记录失败"的根因。 */
  if (d.type === 'sw-version') {
    const msg = { type: 'sw-version', version: VERSION };
    try {
      if (ev.ports && ev.ports.length) ev.ports[0].postMessage(msg);
      else if (ev.source) ev.source.postMessage(msg);
    } catch (e) {}
    return;
  }
  /* 用户在更新提醒里点了「立即更新」→ 立刻接管，页面随后刷新 */
  if (d.type === 'sw-skip-waiting') {
    ev.waitUntil(self.skipWaiting());
    return;
  }

  if (d.type !== 'sw-missing') return;
  ev.waitUntil((async () => {
    const reply = (msg) => { try { ev.source && ev.source.postMessage(msg); } catch (e) {} };
    try {
      const cache = await caches.open(CACHE);
      const keys = await cache.keys();
      const have = new Set();
      keys.forEach((r) => {
        try { have.add(new URL(r.url).pathname.replace(/^\/+/, '')); } catch (e) {}
      });
      const list = Array.isArray(d.urls) && d.urls.length ? d.urls : ALL;
      const missing = list.filter((u) => !have.has(u) && !have.has('/' + u));
      reply({
        type: 'sw-missing-result',
        version: VERSION,
        total: list.length,
        cached: list.length - missing.length,
        missing: missing,
      });
    } catch (e) {
      reply({ type: 'sw-missing-result', version: VERSION, error: String((e && e.message) || e) });
    }
  })());
});
