/**
 * LE HOKKIEN ET LE TEOCHEW DE SINGAPOUR ET DE MALAISIE (tour 9, voie écritures) : la troisième lecture d'un nom en
 * sinogrammes, après le mandarin (pinyin) et le cantonais (jyutping). Les registres de Singapour et de Malaisie écrivent
 * les raisons sociales et les patronymes chinois dans la romanisation d'usage des dialectes du Fujian et du Chaoshan
 * (« 金福隆 » : Kim Hock Leong ; « 联发 » : Lian Huat ; « 张兴 » : Teo Heng), jamais en pinyin ni en jyutping.
 * Pure table et fonction sans état : ecritures.ts l'importe, elle n'importe rien.
 *
 * PROVENANCE : aucune base publique ne porte ces lectures (ni Unihan, ni ICU : voir CARTE.md). La table est écrite à la
 * main, caractère par caractère, dans la GRAPHIE D'USAGE des registres (celle des enseignes et des cartes d'identité :
 * Tan, Lim, Hock, Leong, Huat), pas en pe̍h-ōe-jī : c'est la graphie que le côté latin d'une paire écrit. Elle couvre ce
 * qui NOMME une société ou une personne : les patronymes des Cent Familles tels que Singapour les écrit, et les
 * caractères de bon augure et du commerce dont ces noms se composent (福 Hock, 兴 Heng, 发 Huat, 成 Seng, 利 Lee, 和 Ho,
 * 泰 Thye, 源 Guan, 顺 Soon, 合 Hup, 万 Ban, 新 Sin, 隆 Leong, 联 Lian, 荣 Eng, 丰 Hong). Simplifiés et traditionnels.
 * UNE lecture par caractère : le hokkien et le teochew divergent sur quelques patronymes (陈 Tan et Tang, 郑 Tay et Teh,
 * 张 Teoh et Teo) et l'usage flotte (Hock, Hok ; Leong, Liong ; Teoh, Teo) ; la table écrit la graphie la plus courante
 * des registres de Singapour, et `pliCantonais` (mots.ts), sous lequel cette lecture se compare, replie ces flottements
 * (ck et k, eo et io, oa et ua, le h final). Un caractère hors table garde sa lecture mandarine, comme au cantonais.
 */

const TABLE: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les patronymes, dans la graphie de Singapour */
  "陈": "tan", "陳": "tan", "林": "lim", "黄": "ng", "黃": "ng", "李": "lee", "王": "ong", "吴": "goh", "吳": "goh", "张": "teo", "張": "teo",
  "刘": "lau", "劉": "lau", "蔡": "chua", "杨": "yeo", "楊": "yeo", "郭": "kwek", "洪": "ang", "许": "koh", "許": "koh", "郑": "tay", "鄭": "tay",
  "谢": "chia", "謝": "chia", "曾": "chan", "邱": "khoo", "周": "chew", "叶": "yap", "葉": "yap", "苏": "soh", "蘇": "soh", "庄": "chng", "莊": "chng",
  "赖": "lua", "賴": "lua", "徐": "chee", "何": "ho", "沈": "sim", "潘": "phua", "卢": "loh", "盧": "loh", "翁": "ang", "颜": "gan", "顏": "gan",
  "柯": "kua", "江": "kang", "高": "ko", "石": "chio", "施": "see", "方": "png", "胡": "oh", "罗": "loh", "羅": "loh", "梁": "neo", "温": "oon", "溫": "oon",
  "游": "yew", "白": "peh", "朱": "choo", "蓝": "nah", "藍": "nah", "吕": "lu", "呂": "lu", "连": "lian", "連": "lian", "简": "kan", "簡": "kan",
  "董": "tang", "唐": "tng", "姚": "yeo", "戴": "tay", "萧": "seow", "蕭": "seow", "侯": "kau", "孙": "sng", "孫": "sng", "马": "beh", "馬": "beh",
  "赵": "teo", "趙": "teo", "韩": "han", "韓": "han", "冯": "pang", "馮": "pang", "曹": "chow", "彭": "phey", "范": "huan", "魏": "gui", "钟": "cheng",
  "鍾": "cheng", "廖": "leow", "邓": "teng", "鄧": "teng", "陆": "loke", "陸": "loke", "严": "giam", "嚴": "giam", "尤": "yew", "汤": "thng", "湯": "thng",
  "薛": "see", "任": "jim", "余": "ee", "傅": "poh", "钱": "chee", "錢": "chee", "龚": "keng", "龔": "keng", "陶": "to", "丁": "teng", "章": "cheong",
  "卓": "toh", "詹": "chiam", "邹": "chow", "鄒": "chow", "熊": "him", "秦": "chin", "尹": "oon", "姜": "kang", "阮": "goan", "卫": "wee", "衛": "wee",
  "官": "kuan", "甘": "kam", "巫": "boo", "涂": "thoo", "骆": "loh", "駱": "loh", "纪": "kee", "紀": "kee", "丘": "khoo", "柳": "liew", "欧": "au", "歐": "au",
  "区": "au", "區": "au",
  /* le bon augure et le commerce, tels que les raisons sociales les composent */
  "金": "kim", "福": "hock", "隆": "leong", "联": "lian", "聯": "lian", "发": "huat", "發": "huat", "荣": "eng", "榮": "eng", "丰": "hong", "豐": "hong",
  "兴": "heng", "興": "heng", "成": "seng", "利": "lee", "和": "ho", "泰": "thye", "源": "guan", "通": "thong", "安": "ann", "顺": "soon", "順": "soon",
  "合": "hup", "万": "ban", "萬": "ban", "大": "tua", "新": "sin", "长": "tiong", "長": "tiong", "东": "tong", "東": "tong", "南": "lam", "华": "hua",
  "華": "hua", "中": "tiong", "国": "kok", "國": "kok", "光": "kong", "明": "beng", "昌": "chiong", "盛": "seng", "益": "aik", "裕": "joo", "祥": "siang",
  "吉": "kiat", "宝": "poh", "寶": "poh", "春": "choon", "亚": "ah", "亞": "ah", "洲": "chew", "海": "hai", "山": "san", "水": "chui", "木": "bok",
  "天": "thian", "文": "boon", "武": "boo", "德": "teck", "义": "ghee", "義": "ghee", "信": "sin", "仁": "jin", "忠": "tiong", "广": "kong", "廣": "kong",
  "建": "kian", "业": "giap", "業": "giap", "达": "tat", "達": "tat", "展": "tian", "鸿": "hong", "鴻": "hong", "凤": "hong", "鳳": "hong", "麒": "kee",
  "麟": "lin", "玉": "giok", "珠": "choo", "贵": "kwee", "貴": "kwee", "富": "hoo", "庆": "kheng", "慶": "kheng", "喜": "hee", "乐": "lok", "樂": "lok",
  "康": "khong", "宁": "leng", "寧": "leng", "平": "peng", "强": "kiong", "強": "kiong", "胜": "seng", "勝": "seng", "进": "chin", "進": "chin",
  "财": "chai", "財": "chai", "锦": "gim", "錦": "gim", "美": "bee", "佳": "kai", "良": "liong", "恒": "heng", "恆": "heng", "久": "kew", "远": "wan",
  "遠": "wan", "伟": "wee", "偉": "wee", "汉": "han", "漢": "han", "生": "seng", "星": "seng", "太": "thai", "立": "lip", "永": "eng", "宏": "hong",
  "泉": "chuan", "旺": "ong", "升": "seng", "昇": "seng", "上": "siong", "全": "chuan", "元": "guan", "记": "kee", "記": "kee", "号": "ho", "號": "ho",
  "行": "hang", "栈": "chan", "棧": "chan", "园": "hng", "園": "hng", "城": "seng", "港": "kang", "州": "chew", "岛": "to", "島": "to", "河": "ho",
  "湖": "oh", "溪": "khe", "松": "siong", "柏": "peh", "桂": "kwee", "兰": "lan", "蘭": "lan", "菊": "kiok", "竹": "tek", "梅": "mui", "莲": "lian",
  "蓮": "lian", "花": "hway", "树": "chew", "樹": "chew", "森": "sim", "岩": "giam", "铁": "thih", "鐵": "thih", "银": "gin", "銀": "gin", "龙": "leong",
  "龍": "leong", "虎": "hor", "狮": "sai", "獅": "sai", "牛": "gu", "鱼": "hu", "魚": "hu", "云": "hun", "雲": "hun", "风": "hong", "風": "hong",
  "雷": "lui", "电": "tian", "電": "tian", "日": "jit", "月": "gwee", "阳": "yong", "陽": "yong", "秋": "chew", "冬": "tang", "年": "nee", "世": "say",
  "家": "kay", "堂": "tong", "田": "chan", "农": "long", "農": "long", "工": "kang", "商": "siong", "贸": "boh", "貿": "boh", "易": "ek", "公": "kong",
  "司": "su", "有": "yu", "限": "han", "三": "sar", "五": "goh", "六": "lak", "八": "poeh", "九": "kau", "十": "chap", "百": "pek", "千": "cheng",
  "一": "it", "二": "jee", "四": "see", "七": "chit", "恩": "un", "宗": "chong", "祖": "chor", "承": "seng", "宪": "hian", "憲": "hian", "瑞": "swee",
  "彩": "chai", "添": "thiam", "满": "buan", "滿": "buan", "堆": "tui", "集": "chip", "团": "thuan", "團": "thuan", "友": "yew", "协": "hiap", "協": "hiap",
  "同": "tong", "共": "kiong", "谦": "khiam", "謙": "khiam", "礼": "lee", "禮": "lee", "智": "tee", "勇": "yong", "健": "kian", "寿": "siew", "壽": "siew",
  "禄": "lok", "祿": "lok", "赐": "su", "賜": "su", "恭": "kiong", "敬": "keng", "爱": "ai", "愛": "ai", "亲": "chin", "親": "chin",
  "民": "bin", "众": "cheng", "眾": "cheng", "香": "hiong", "茶": "teh", "米": "bee", "油": "yew", "盐": "iam", "鹽": "iam", "糖": "thng", "酒": "chiu",
  "船": "chun", "车": "chia", "車": "chia", "路": "loh", "桥": "kio", "橋": "kio", "门": "mui", "門": "mui", "厝": "chu", "屋": "ok", "店": "tiam",
}));

/** La lecture hokkien d'un caractère, dans la graphie de Singapour, ou vide s'il n'en a pas dans la table. */
export function hokkienDe(caractere: string): string {
  return TABLE.get(caractere) ?? "";
}
