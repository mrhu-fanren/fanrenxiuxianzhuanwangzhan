/* ============================================================
 * 凡人修仙传 - 灵兽妖兽生成脚本
 * 运行: node data/gen_beasts.js
 * 输出: data/beasts.json
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

// ---------- 核心手写灵兽 ----------
var coreBeasts = [
  { name: "噬金虫", grade: "奇虫榜", type: "奇虫", owner: "韩立", origin: "乱星海", ability: "吞噬金属法宝，可进化", desc: "通体金黄的奇虫，专食金属与法宝，吞噬后可进化，是韩立炼制与对敌的重要助力。" },
  { name: "七霞盏灵", grade: "通天灵兽", type: "灵虫", owner: "韩立", origin: "虚天殿", ability: "释放七霞神光", desc: "栖息于七霞盏中的灵虫，可释放七霞神光，破邪驱魔，与七霞盏相辅相成。" },
  { name: "六翼霜蚣", grade: "奇虫榜", type: "奇虫", owner: "韩立", origin: "极寒之地", ability: "释放寒气冻敌", desc: "生有六翼的霜蚣奇虫，可释放极寒之气冻敌，是韩立培养的重要灵虫之一。" },
  { name: "梦噬花", grade: "通天灵植", type: "灵植妖", owner: "无", origin: "秘境", ability: "吞噬梦境，扰人元神", desc: "可吞噬修士梦境的妖化灵植，能扰人元神，令人陷入幻梦难以自拔，极为诡异。" },
  { name: "墨蛟", grade: "高阶妖兽", type: "蛟龙", owner: "无", origin: "深海", ability: "墨息毒雾，翻江倒海", desc: "通体漆黑的蛟龙妖兽，可喷吐墨息毒雾，翻江倒海，是深海中的霸主级妖兽。" },
  { name: "金蚶", grade: "中阶妖兽", type: "甲壳妖", owner: "无", origin: "乱星海", ability: "金甲护体", desc: "金甲护体的甲壳妖兽，防御惊人，寻常法宝难伤其身。" },
  { name: "火灵蛇", grade: "中阶妖兽", type: "灵蛇", owner: "韩立", origin: "灵兽山", ability: "喷吐灵火", desc: "通体赤红的灵蛇，可喷吐灵火焚敌，是韩立早期豢养的灵兽之一。" },
  { name: "玄骨", grade: "高阶妖兽", type: "骨妖", owner: "无", origin: "阴尸之地", ability: "骨刺伤敌，不死不灭", desc: "由阴尸之地怨气凝聚而成的骨妖，浑身骨刺，不死不灭，极难对付。" },
  { name: "黑炎狮", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "黑炎焚烧", desc: "通体漆黑的巨狮妖兽，可喷吐黑炎焚敌，是灵界常见的凶兽。" },
  { name: "银翼", grade: "通天灵兽", type: "飞禽妖", owner: "韩立", origin: "灵界", ability: "银翼御风，速度极快", desc: "通体银白的飞禽灵兽，双翼御风而行，速度极快，是韩立在灵界的坐骑与斥候。" },
  { name: "天狐", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "魅惑之术", desc: "九尾天狐，魅惑之术天下无双，可惑人心神，是妖族中的顶级存在。" },
  { name: "金翅大鹏", grade: "通天灵兽", type: "飞禽妖", owner: "无", origin: "灵界", ability: "极速飞行，爪裂山岳", desc: "金翅大鹏，飞行极速，双爪可裂山岳，是飞禽妖兽中的王者。" },
  { name: "九色鹿", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "九色神光", desc: "通体九色的神鹿，可释放九色神光，破邪驱魔，是灵界瑞兽。" },
  { name: "龙猿", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "力大无穷", desc: "兼具龙族与猿族血脉的强大妖兽，力大无穷，一拳可碎山岳。" },
  { name: "风灵兽", grade: "中阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "控风之术", desc: "擅控风之力的灵兽，速度极快，常作坐骑与斥候。" },
  { name: "土灵兽", grade: "中阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "遁地之术", desc: "擅遁地之术的灵兽，可穿行地下，常作探查之用。" },
  { name: "水灵兽", grade: "中阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "控水之术", desc: "擅控水之力的灵兽，可翻江倒海，常作水战之用。" },
  { name: "火灵兽", grade: "中阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "控火之术", desc: "擅控火之力的灵兽，可喷吐灵火，常作攻敌之用。" },
  { name: "雷灵兽", grade: "高阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "控雷之术", desc: "擅控雷之力的灵兽，可释放雷电轰敌，威力惊人。" },
  { name: "冰灵兽", grade: "高阶灵兽", type: "灵兽", owner: "众修士", origin: "极寒之地", ability: "控冰之术", desc: "擅控冰之力的灵兽，可释放寒气冻敌，攻防兼备。" },
  { name: "金背螳螂", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "灵兽山", ability: "金刀双臂", desc: "通体金色的螳螂奇虫，双臂如金刀，斩切力极强，是奇虫榜上有名的灵虫。" },
  { name: "碧玉蝎", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "乱星海", ability: "碧玉毒针", desc: "碧玉色的蝎子奇虫，尾针带毒，可射出碧玉毒针伤敌。" },
  { name: "九幽蜂", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "九幽之地", ability: "九幽毒雾", desc: "九幽之地孕育的蜂类奇虫，可喷吐九幽毒雾，阴毒无比。" },
  { name: "玄龟", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "深海", ability: "玄甲护体", desc: "通体漆黑的巨龟妖兽，龟甲坚硬无比，防御惊人。" },
  { name: "赤炎虎", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "赤炎焚烧", desc: "通体赤红的巨虎妖兽，可喷吐赤炎焚敌，是灵界凶兽。" },
  { name: "冰晶凤", grade: "通天灵兽", type: "飞禽妖", owner: "无", origin: "极寒之地", ability: "冰晶之火", desc: "通体冰晶的凤族妖兽，可释放冰晶之火，寒热并存，威力惊人。" },
  { name: "九头蛇", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "九头齐攻", desc: "生有九头的巨蛇妖兽，九头可同时攻击，防不胜防。" },
  { name: "三眼金狮", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "三眼金光", desc: "额头生有三眼的金狮妖兽，第三眼可放金光伤敌，威力惊人。" },
  { name: "紫电豹", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "紫电奔袭", desc: "通体紫色的豹妖，可化作紫电奔袭，速度极快。" },
  { name: "碧磷蛇", grade: "中阶妖兽", type: "妖兽", owner: "无", origin: "灵兽山", ability: "碧磷毒火", desc: "通体碧绿的蛇妖，可喷吐碧磷毒火，阴毒无比。" },
  { name: "黑羽鹰", grade: "中阶妖兽", type: "飞禽妖", owner: "无", origin: "乱星海", ability: "黑羽飞刀", desc: "通体黑羽的巨鹰妖兽，羽毛可化作飞刀伤敌。" },
  { name: "白玉蛛", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "灵兽山", ability: "白玉蛛丝", desc: "通体白玉的蜘蛛奇虫，蛛丝坚韧，可织网困敌。" },
  { name: "金线蛙", grade: "中阶妖兽", type: "妖兽", owner: "无", origin: "灵兽山", ability: "金线毒液", desc: "背生金线的巨蛙妖兽，可喷吐金线毒液伤敌。" },
  { name: "九尾狐", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "九尾齐出，魅惑之术", desc: "生有九尾的狐妖，九尾可同时攻敌，魅惑之术天下无双。" },
  { name: "玄冰蟒", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "极寒之地", ability: "玄冰寒气", desc: "通体玄冰的巨蟒妖兽，可释放玄冰寒气冻敌。" },
  { name: "烈焰马", grade: "中阶灵兽", type: "灵兽", owner: "众修士", origin: "灵兽山", ability: "烈焰奔腾", desc: "通体烈焰的骏马灵兽，奔跑时如烈焰奔腾，常作坐骑。" },
  { name: "碧水螭", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "深海", ability: "碧水之术", desc: "碧水色的螭龙妖兽，擅控水之术，可翻江倒海。" },
  { name: "金毛吼", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "金毛音波", desc: "通体金毛的巨猿妖兽，一吼可发金毛音波，伤人元神。" },
  { name: "青鸾", grade: "通天灵兽", type: "飞禽妖", owner: "无", origin: "灵界", ability: "青鸾神火", desc: "青鸾神鸟，可释放青鸾神火，是凤族旁支中的强者。" },
  { name: "黑水玄蛇", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "深海", ability: "黑水毒雾", desc: "通体漆黑的玄蛇妖兽，可喷吐黑水毒雾，是深海霸主之一。" },
  { name: "金角蜂", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "灵兽山", ability: "金角冲刺", desc: "头生金角的蜂类奇虫，可金角冲刺伤敌，速度极快。" },
  { name: "银月狼", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "银月之嚎", desc: "通体银白的巨狼妖兽，月夜可嚎叫聚气，实力大增。" },
  { name: "碧血蛾", grade: "奇虫榜", type: "奇虫", owner: "无", origin: "乱星海", ability: "碧血鳞粉", desc: "碧血色的蛾类奇虫，鳞粉可令人中毒，阴毒无比。" },
  { name: "九幽灵蝶", grade: "通天灵兽", type: "奇虫", owner: "无", origin: "九幽之地", ability: "九幽幻雾", desc: "九幽之地孕育的灵蝶，可释放九幽幻雾，令人陷入幻境。" },
  { name: "金鳞龙鲤", grade: "高阶妖兽", type: "妖兽", owner: "无", origin: "灵界", ability: "跃龙门进化", desc: "金鳞龙鲤，传说过龙门可化为真龙，是妖兽中的潜力股。" },
  { name: "玄冥龟", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "冥界", ability: "玄冥寒甲", desc: "玄冥之地的巨龟妖兽，龟甲蕴含玄冥之力，防御惊人。" },
  { name: "赤焰狮", grade: "通天灵兽", type: "妖兽", owner: "无", origin: "灵界", ability: "赤焰焚天", desc: "通体赤焰的巨狮妖兽，可喷吐赤焰焚天，是灵界凶兽。" },
  { name: "九霄鹤", grade: "通天灵兽", type: "飞禽妖", owner: "无", origin: "灵界", ability: "九霄清音", desc: "九霄之上的仙鹤妖兽，清音可疗伤补神，是灵界瑞兽。" },
  { name: "碧落鹰", grade: "高阶妖兽", type: "飞禽妖", owner: "无", origin: "灵界", ability: "碧落神光", desc: "碧落之上的巨鹰妖兽，可释放碧落神光伤敌。" },
  { name: "混沌兽", grade: "玄天之兽", type: "上古妖兽", owner: "无", origin: "上古", ability: "混沌之力", desc: "上古混沌兽，掌控混沌之力，实力已臻化境，是传说中的存在。" }
];

// ---------- 组合生成词库 ----------
var prefixes = ["玄","天","紫","青","赤","白","黑","碧","血","寒","烈","雷","电","风","火","水","土","木","金","阴","阳","魔","佛","仙","神","鬼","妖","灵","幽","冥","冰","炎","毒","玉","银","铜","铁","石","云","霞","雾","雪","霜","露","虹","辉","芒","华","彩","九","七","五","三","百","千","万","太","大","小","老","少","长","短","高","低","粗","细","巨","微","金","木","水","火","土","日","月","星","辰","苍","穹","宇","宙","洪","荒","蒙","混","沌","虚","无","空","灵","真","幻","玄","黄","洪","荒"];
var beastBases = ["蛟","龙","凤","麟","龟","虎","豹","狼","熊","鹿","马","牛","羊","蛇","蟒","蝰","蝮","蝎","蛛","蜂","蝶","蛾","蝇","蚊","蚁","蚣","虫","鱼","鲤","鲫","鳗","鳅","鳝","鲈","鲨","鲸","豚","鳖","龟","鳖","蟹","虾","蚌","螺","蚶","蛤","蛏","蚝","章","乌","鱿","海","鹰","雕","鹫","枭","鹏","鹤","鸳","鸯","鸥","鹭","鹳","鸨","鹃","鸽","鹊","鸦","鸢","鸿","鹄","鹜","雀","燕","雁","猴","猿","狒","猩","狖","犴","狙","狼","狐","狸","獾","貂","獭","鼠","兔","猫","犬","豕","象","犀","河","马","骆","驼","鹿","麋","麝","牛","羚","羊","羚","狮","豹","虎","彪","罴","熊","蛇","虺","虬","蛟","龙","螭","凤","凰","鸾","鹊","乌","雀","鸡","雉","鹑","鸭","鹅","鸥","鹬","鸻","鸳","鸯","鲤","鲫","鲇","鳅","鳝","鳗","鲈","鲷","鲸","鲨","豚","鲛","螭","龟","鼋","鼍","鳖","蟹","虾","蚌","螺","蚶","蛤","蛏","蚝","章","乌","鱿","蚕","蛾","蝶","蜂","蚁","蝇","蚊","蚋","虻","蝉","螳","蜻","蜓","蠊","蝼","蚱","蜢","蟋","蟀","灶","马","蚰","蜒","蜈","蚣","蝎","蛛","蚯","蚓","蛭","蜗","蜗","螺","蚌","蚶","蛤","蛏","蚝","螺","贝","珠","珊瑚","海","葵","水","母","海","胆","海","星","海","参"];
var attrs = ["玄","天","紫","青","赤","白","黑","碧","血","寒","烈","雷","电","风","火","水","土","木","金","阴","阳","魔","佛","仙","神","鬼","妖","灵","幽","冥","冰","炎","毒","玉","银","铜","铁","石","云","霞","雾","雪","霜","露","虹","辉","芒","华","彩"];

var grades = ["低阶妖兽","中阶妖兽","高阶妖兽","通天灵兽","玄天之兽","奇虫榜","灵兽"];
var types = ["妖兽","飞禽妖","水族妖","虫妖","灵兽","奇虫","灵植妖","骨妖","鬼妖","妖禽","妖鱼","妖兽"];
var owners = ["韩立","南宫婉","紫菱","掩月宗修士","黄枫谷修士","落云宗修士","魁星岛修士","乱星海修士","灵兽山修士","正道修士","魔道修士","灵界修士","妖族修士","散修","众修士","无"];
var origins = ["灵兽山","乱星海","魁星岛","血色禁地","虚天殿","灵界","魔界","冥界","妖族领地","深海","极寒之地","九幽之地","阴尸之地","秘境","上古遗迹","灵药园","黄枫谷","掩月宗","落云宗","七玄门"];
var abilities = [
  "喷吐{attr}灵火焚敌",
  "释放{attr}寒气冻敌",
  "化作{attr}风刃切敌",
  "释放{attr}雷电轰敌",
  "喷吐{attr}毒雾困敌",
  "{attr}甲护体，防御惊人",
  "遁地如{attr}，难以捕捉",
  "飞行如{attr}，速度极快",
  "释放{attr}神光伤敌",
  "魅惑之术惑人心神",
  "吞噬金属法宝自行进化",
  "音波攻击伤人元神",
  "幻术令敌陷入幻境",
  "剧毒之血令敌中毒",
  "分身之术迷惑敌人",
  "隐身匿形难以察觉",
  "再生之力断肢重生",
  "金钟罩护体抵消伤害",
  "变形之术变化万千",
  "万里追踪锁定敌人"
];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function hashStr(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }

function genName(){
  // 前缀 + 兽名（避免太短）
  var pre = pick(prefixes);
  var base = pick(beastBases);
  // 偶尔双前缀
  if(Math.random() < 0.25){ pre = pre + pick(prefixes); }
  var name = pre + base;
  return name;
}

function makeDesc(name, type, ability){
  return name + "是修仙界中常见的" + type + "，" + ability + "。此兽性凶猛，常出没于灵气充沛之地，为修士所擒者可作灵兽豢养。";
}

// ---------- 组装 ----------
var items = [];
var usedNames = {};

coreBeasts.forEach(function(b, idx){
  items.push({
    id: "coreb_" + idx,
    name: b.name,
    grade: b.grade,
    type: b.type,
    owner: b.owner,
    origin: b.origin,
    ability: b.ability,
    desc: b.desc
  });
  usedNames[b.name] = true;
});

var TARGET = 320;
var attempts = 0;
var maxAttempts = TARGET * 40;
while(items.length < TARGET && attempts < maxAttempts){
  attempts++;
  var name = genName();
  if(name.length < 2) continue;
  if(usedNames[name]) continue;
  usedNames[name] = true;
  var grade = pick(grades);
  var type = pick(types);
  var owner = pick(owners);
  var origin = pick(origins);
  var attr = pick(attrs);
  var ability = pick(abilities).replace(/\{attr\}/g, attr);
  var desc = makeDesc(name, type, ability);
  items.push({
    id: "genb_" + items.length,
    name: name,
    grade: grade,
    type: type,
    owner: owner,
    origin: origin,
    ability: ability,
    desc: desc
  });
}

var result = {
  meta: {
    title: "灵兽妖兽",
    disclaimer: "数据量过大，整理可能有误",
    total: items.length,
    note: "凡人修仙传灵兽妖兽图鉴，核心灵兽手写详介，其余按原著风格词库组合生成。"
  },
  items: items
};

var outPath = path.join(__dirname, "beasts.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
console.log("已生成 " + items.length + " 只灵兽 -> " + outPath);
console.log("其中核心手写 " + coreBeasts.length + " 只，组合生成 " + (items.length - coreBeasts.length) + " 只。");
