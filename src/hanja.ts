/**
 * LES HANJA D'UN NOM CORÉEN (tour 15, voie japonais-coréen) : la lecture sino-coréenne des sinogrammes, celle des raisons
 * sociales que les registres et les documents coréens écrivent encore en caractères (« 大輪重工業株式會社 » : Daeryun Heavy
 * Industries, 주식회사 대륜중공업 ; « 瑞林海運 » : Seorim Haeun ; « 白鹿化學 » : Baengnok Hwahak, jeu 19 : cinq paires entre
 * 0,000 et 0,213, lues en mandarin). La quatrième lecture d'un nom en sinogrammes, après le mandarin, le cantonais et le
 * hokkien (`Lecture`, ecritures.ts), posée par `lecturesDe` quand le nom porte une forme coréenne (株式會社 avec le 會
 * traditionnel, 會社), un mot de métier des hanja (商事, 工業, 海運, 化學, 機械, 重工業) ou du hangul. Pure table et
 * fonctions sans état, de la forme de hokkien.ts : ecritures.ts l'importe, elle n'importe rien.
 *
 * La table écrit UNE lecture par caractère, en romanisation révisée (2000), sans la règle de tête : c'est la lecture que le
 * caractère prend à l'intérieur d'un mot (輪 ryun, 林 rim, 女 nyeo). La RÈGLE DU SON INITIAL (두음법칙) s'applique au premier
 * caractère d'un mot (`teteCoreenne`) : ㄹ devant i ou y tombe (李 ri : I ; 輪 ryun : Yun ; 林 rim : Im ; 柳 ryu : Yu), ㄹ
 * devant une autre voyelle devient ㄴ (羅 ra : Na ; 盧 ro : No ; 路 ro : No), ㄴ devant i ou y tombe (女 nyeo : Yeo). Le
 * caractère hors table garde sa lecture mandarine, comme au cantonais. Traditionnels d'abord (les registres coréens n'écrivent
 * pas les simplifiés), et les simplifiés que le japonais partage (産, 学, 会, 気, 械, 鉄) quand un même nom les emprunte.
 */

const TABLE: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les formes et les mots du commerce, caractère par caractère (les mots entiers sont dans GENERIQUES_HANJA, ecritures.ts) */
  "株": "ju", "式": "sik", "會": "hoe", "会": "hoe", "社": "sa", "有": "yu", "限": "han", "合": "hap", "資": "ja", "商": "sang", "事": "sa",
  "工": "gong", "業": "eop", "重": "jung", "海": "hae", "運": "un", "化": "hwa", "學": "hak", "学": "hak", "機": "gi", "械": "gye",
  "電": "jeon", "子": "ja", "氣": "gi", "気": "gi", "精": "jeong", "密": "mil", "產": "san", "産": "san", "食": "sik", "品": "pum",
  "鐵": "cheol", "鉄": "cheol", "鋼": "gang", "物": "mul", "流": "ryu", "纖": "seom", "維": "yu", "製": "je", "藥": "yak", "薬": "yak",
  "紙": "ji", "酒": "ju", "類": "ryu", "造": "jo", "船": "seon", "建": "geon", "設": "seol", "開": "gae", "發": "bal", "発": "bal",
  "貿": "mu", "易": "yeok", "通": "tong", "航": "hang", "空": "gong", "陸": "ryuk", "輸": "su", "送": "song", "倉": "chang", "庫": "go",
  "販": "pan", "賣": "mae", "売": "mae", "生": "saeng", "水": "su", "漁": "eo", "農": "nong", "林": "rim", "牧": "mok", "畜": "chuk",
  "木": "mok", "材": "jae", "石": "seok", "油": "yu", "金": "geum", "屬": "sok", "属": "sok", "銀": "eun", "銅": "dong", "玉": "ok",
  "衣": "ui", "服": "bok", "紡": "bang", "織": "jik", "染": "yeom", "皮": "pi", "革": "hyeok",
  "醫": "ui", "医": "ui", "療": "ryo", "保": "bo", "險": "heom", "証": "jeung", "券": "gwon",
  "自": "ja", "動": "dong", "車": "cha", "技": "gi", "術": "sul", "科": "gwa", "研": "yeon", "究": "gu", "所": "so", "院": "won",
  "投": "tu", "信": "sin", "託": "tak", "貨": "hwa", "興": "heung", "實": "sil", "実": "sil",
  "印": "in", "刷": "swae", "出": "chul", "版": "pan", "情": "jeong", "報": "bo", "放": "bang",
  /* les numéraux */
  "一": "il", "二": "i", "三": "sam", "四": "sa", "五": "o", "六": "yuk", "七": "chil", "八": "pal", "九": "gu", "十": "sip", "百": "baek",
  "千": "cheon", "萬": "man", "万": "man", "億": "eok", "第": "je", "號": "ho", "号": "ho",
  /* les patronymes, sous la lecture d'intérieur de mot (la règle de tête fait 李 I, 柳 Yu, 羅 Na, 盧 No) */
  "李": "ri", "朴": "bak", "崔": "choe", "鄭": "jeong", "姜": "gang", "趙": "jo", "尹": "yun", "張": "jang", "韓": "han", "吳": "o",
  "申": "sin", "徐": "seo", "權": "gwon", "黃": "hwang", "黄": "hwang", "安": "an", "宋": "song", "柳": "ryu", "洪": "hong", "全": "jeon",
  "高": "go", "文": "mun", "孫": "son", "梁": "ryang", "裵": "bae", "白": "baek", "曺": "jo", "曹": "jo", "許": "heo", "南": "nam",
  "沈": "sim", "劉": "ryu", "盧": "ro", "河": "ha", "丁": "jeong", "成": "seong", "具": "gu", "郭": "gwak", "禹": "u", "朱": "ju",
  "任": "im", "田": "jeon", "羅": "ra", "辛": "sin", "閔": "min", "兪": "yu", "陳": "jin", "池": "ji", "嚴": "eom", "元": "won",
  "蔡": "chae", "方": "bang", "楊": "yang", "孔": "gong", "玄": "hyeon", "康": "gang", "咸": "ham", "卞": "byeon", "廉": "yeom",
  "呂": "ryeo", "秋": "chu", "都": "do", "蘇": "so", "薛": "seol", "宣": "seon", "周": "ju", "慶": "gyeong", "表": "pyo", "明": "myeong",
  "奇": "gi", "王": "wang", "琴": "geum", "潘": "ban", "孟": "maeng", "諸": "je", "卓": "tak", "魚": "eo", "牟": "mo",
  "蔣": "jang", "太": "tae", "桂": "gye", "甄": "gyeon", "邊": "byeon", "房": "bang", "睦": "mok", "邵": "so", "唐": "dang", "陰": "eum",
  "溫": "on", "景": "gyeong", "昔": "seok", "芮": "ye", "馬": "ma", "史": "sa", "余": "yeo", "秦": "jin", "章": "jang", "陶": "do",
  "葉": "yeop", "范": "beom", "彭": "paeng", "夏": "ha", "殷": "eun", "簡": "gan", "皇": "hwang", "甫": "bo", "鮮": "seon", "于": "u",
  /* la nature, les lieux, les astres */
  "山": "san", "川": "cheon", "江": "gang", "湖": "ho", "泉": "cheon", "島": "do", "浦": "po", "港": "hang", "灣": "man", "湾": "man",
  "原": "won", "野": "ya", "村": "chon", "里": "ri", "洞": "dong", "城": "seong", "京": "gyeong", "州": "ju", "郡": "gun", "邑": "eup",
  "岩": "am", "巖": "am", "峰": "bong", "峯": "bong", "嶺": "ryeong", "谷": "gok", "溪": "gye", "淵": "yeon", "潭": "dam", "瀧": "rong",
  "天": "cheon", "地": "ji", "日": "il", "月": "wol", "星": "seong", "雲": "un", "雨": "u", "雪": "seol", "風": "pung", "雷": "roe",
  "光": "gwang", "陽": "yang", "春": "chun", "冬": "dong", "東": "dong", "西": "seo", "北": "buk", "中": "jung", "央": "ang",
  "上": "sang", "下": "ha", "内": "nae", "內": "nae", "外": "oe", "前": "jeon", "後": "hu", "新": "sin", "古": "go", "大": "dae", "小": "so",
  "松": "song", "竹": "juk", "梅": "mae", "蘭": "ran", "菊": "guk", "花": "hwa", "草": "cho", "根": "geun", "柏": "baek",
  "桑": "sang", "楓": "pung", "杉": "sam", "桃": "do", "栗": "ryul", "蓮": "ryeon", "荷": "ha", "芝": "ji", "蘆": "ro",
  "龍": "ryong", "竜": "ryong", "鳳": "bong", "虎": "ho", "鹿": "rok", "牛": "u", "鶴": "hak", "鷹": "eung", "燕": "yeon", "鵬": "bung",
  "麒": "gi", "麟": "rin", "龜": "gwi", "亀": "gwi", "鯨": "gyeong", "鳥": "jo",
  /* le bon augure et les vertus, tels que les raisons sociales et les prénoms les composent */
  "平": "pyeong", "和": "hwa", "福": "bok", "壽": "su", "寿": "su", "富": "bu", "貴": "gwi", "榮": "yeong", "栄": "yeong", "華": "hwa",
  "昌": "chang", "盛": "seong", "隆": "ryung", "達": "dal", "進": "jin", "勝": "seung", "利": "ri", "益": "ik", "泰": "tae", "吉": "gil",
  "祥": "sang", "瑞": "seo", "喜": "hui", "樂": "rak", "楽": "rak", "寧": "nyeong", "順": "sun", "德": "deok",
  "徳": "deok", "仁": "in", "義": "ui", "禮": "rye", "礼": "rye", "智": "ji", "忠": "chung", "孝": "hyo", "敬": "gyeong", "愛": "ae",
  "善": "seon", "美": "mi", "貞": "jeong", "淑": "suk", "賢": "hyeon", "哲": "cheol", "勇": "yong", "強": "gang", "健": "geon", "雄": "ung",
  "英": "yeong", "俊": "jun", "秀": "su", "才": "jae", "武": "mu", "士": "sa", "民": "min", "世": "se", "代": "dae", "家": "ga",
  "宗": "jong", "祖": "jo", "眞": "jin", "真": "jin", "正": "jeong", "直": "jik", "誠": "seong", "恩": "eun", "惠": "hye",
  "慧": "hye", "聖": "seong", "神": "sin", "靈": "ryeong", "寶": "bo", "宝": "bo", "珍": "jin", "珠": "ju", "丹": "dan", "彩": "chae",
  "青": "cheong", "靑": "cheong", "赤": "jeok", "紫": "ja", "綠": "rok", "緑": "rok", "黑": "heuk", "黒": "heuk",
  "永": "yeong", "久": "gu", "長": "jang", "遠": "won", "朝": "jo", "曉": "hyo", "旭": "uk",
  "現": "hyeon", "起": "gi", "亞": "a", "亜": "a", "斗": "du",
  "友": "u", "同": "dong", "共": "gong", "協": "hyeop", "聯": "ryeon", "連": "ryeon", "統": "tong", "總": "chong", "総": "chong",
  "本": "bon", "基": "gi", "源": "won", "宇": "u", "宙": "ju",
  "首": "su", "頭": "du", "心": "sim", "力": "ryeok", "能": "neung", "功": "gong", "勞": "ro", "労": "ro",
  "輪": "ryun", "軸": "chuk", "輝": "hwi", "燦": "chan", "煥": "hwan", "炫": "hyeon", "熙": "hui", "昊": "ho", "晟": "seong", "旻": "min",
  "泳": "yeong", "沃": "ok", "洋": "yang", "洙": "su", "淳": "sun", "淸": "cheong", "清": "cheong", "濟": "je", "済": "je", "澤": "taek",
  "沢": "taek", "汎": "beom", "潤": "yun", "浩": "ho", "波": "pa", "濤": "do", "滿": "man", "満": "man",
  "釜": "bu", "蔚": "ul",
  "漢": "han", "麗": "ryeo", "邱": "gu", "畿": "gi", "尙": "sang", "尚": "sang",
}));

/** La lecture sino-coréenne d'un caractère (romanisation révisée, lecture d'intérieur de mot), ou vide s'il n'en a pas. */
export function hanjaDe(caractere: string): string {
  return TABLE.get(caractere) ?? "";
}

/** La lecture d'une suite de caractères, soudée : chaque syllabe sous sa lecture, la première sous la règle du son initial. */
export function hanjaSuite(caracteres: readonly string[]): string {
  return caracteres.map((c, i) => (i === 0 ? teteCoreenne(hanjaDe(c)) : hanjaDe(c))).join("");
}

/** LA RÈGLE DU SON INITIAL du coréen : en tête de mot, ㄹ devant i ou y tombe (ri : i, ryu : yu, rim : im, ryeo : yeo), ㄹ
 *  devant une autre voyelle devient ㄴ (ra : na, ro : no, rae : nae, rok : nok), ㄴ devant i ou y tombe (nyeo : yeo, ni : i). */
export function teteCoreenne(syllabe: string): string {
  if (/^r[iy]/.test(syllabe)) return syllabe.slice(1);
  if (/^r/.test(syllabe)) return "n" + syllabe.slice(1);
  if (/^n[iy]/.test(syllabe)) return syllabe.slice(1);
  return syllabe;
}

/** La NASALISATION de la romanisation révisée, sur une lecture déjà soudée : une occlusive finale devant ㄴ, ㅁ ou ㄹ se nasalise
 *  (백록 baengnok, 국민 gungmin, 십리 simni, 몇리 myeonni), ㄹ après ㅁ ou ㅇ devient ㄴ (종로 jongno, 음료 eumnyo). Le hangul
 *  (`hangulEnLatin`), les hanja et `pliCoreen` (le côté latin écrit lettre à lettre : « Baekrok », « Baengnok », un même mot). */
export function nasaliserCoreen(mot: string): string {
  return mot.replace(/kr/g, "ngn").replace(/tr/g, "nn").replace(/pr/g, "mn").replace(/k(?=[nm])/g, "ng").replace(/t(?=[nm])/g, "n")
    .replace(/p(?=[nm])/g, "m").replace(/(?<=ng|m)r/g, "n");
}
/** L'assimilation entière : la nasalisation, et ㄹ et ㄴ voisins écrits ll (신라 silla, 칼날 kallal). Pour les lectures du hangul et
 *  des hanja seulement, où le ㄴ et le ㄹ sont écrits ; pas pour le pli du côté latin, où « Hyeonrim » et « Hyorim » (현림, 효림)
 *  se rejoindraient par le ll replié (mesuré le 28/09 : une fausse alerte forte). */
export function assimilerCoreen(mot: string): string {
  return nasaliserCoreen(mot).replace(/nr|ln/g, "ll");
}
