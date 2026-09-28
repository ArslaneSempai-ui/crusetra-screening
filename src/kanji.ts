/**
 * LES KANJI QUI NOMMENT UNE SOCIÉTÉ JAPONAISE (tour 9, voie écritures) : pas un dictionnaire, la petite table de ce qu'une
 * raison sociale japonaise met devant sa forme. « 株式会社霜月水産 » et « Shimotsuki Suisan Co., Ltd. » (jeu 13) : la forme
 * (株式会社, Kabushiki Kaisha), un mot de métier en lecture sino-japonaise (水産 suisan, que TRADUCTIONS_JAPONAISES rend
 * « fisheries » des deux côtés), et un nom propre en lecture japonaise, kanji par kanji (霜 shimo, 月 tsuki). Pures tables
 * et fonctions sans état : ecritures.ts les importe, elles n'importent rien.
 *
 * Trois tables, lues de la plus longue clé à la plus courte : les FORMES, les MOTS (métiers, lieux, mots faits : ceux-là se
 * lisent d'un bloc, parce que 東洋 est Toyo et non Higashi-Hitsuji), puis les KANJI un à un, chacun sous LA lecture qu'il
 * prend dans un nom (le kun des patronymes et des mots de la nature : 山 yama, 川 kawa, 田 ta, 松 matsu). Un kanji a
 * plusieurs lectures et un nom propre choisit la sienne : la table ne donne que la plus fréquente dans les raisons
 * sociales, et ce qu'elle rate reste ce qu'il était (un kanji hors table traverse inchangé, le mot ne rencontre rien de
 * plus qu'avant). Le rendaku (山田 yamada, pas yamata) se replie au squelette (d et t, g et k, b et p), qui ne sépare pas
 * ces consonnes. Les longues s'écrivent sans macron, comme le nom anglais de la société (Kōgyō : kogyo).
 */

/** Les formes, telles que LOCUTIONS et FORMES les connaissent romanisées. */
export const FORMES_KANJI: ReadonlyMap<string, string> = new Map(Object.entries({
  "株式会社": "kabushiki kaisha", "有限会社": "yugen kaisha", "合同会社": "godo kaisha", "合資会社": "goshi kaisha", "合名会社": "gomei kaisha",
  "株式會社": "kabushiki kaisha", "有限會社": "yugen kaisha",
  /* les formes abrégées entre parenthèses, (株) (有) (同), et leurs formes encerclées ㈱ ㈲ que la compatibilité Unicode y ramène (tour 15) */
  "(株)": "kabushiki kaisha", "(有)": "yugen kaisha", "(同)": "godo kaisha",
}));

/** Les mots faits : métiers (en lecture sino-japonaise, ceux de TRADUCTIONS_JAPONAISES et de MARQUEURS_JAPONAIS), lieux,
 *  et les composés que l'usage lit d'un bloc. */
export const MOTS_KANJI: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les métiers */ "水産": "suisan", "水產": "suisan", "工業": "kogyo", "産業": "sangyo", "商事": "shoji", "物産": "bussan", "海運": "kaiun",
  "運輸": "unyu", "造船": "zosen", "鉄工": "tekko", "鉄工所": "tekkosho", "機械": "kikai", "電機": "denki", "電気": "denki", "食品": "shokuhin",
  "建設": "kensetsu", "商会": "shokai", "商店": "shoten", "興業": "kogyo", "通商": "tsusho", "貿易": "boeki", "化学": "kagaku", "精機": "seiki",
  "精工": "seiko", "技研": "giken", "汽船": "kisen", "倉庫": "soko", "港運": "koun", "漁業": "gyogyo", "製作所": "seisakusho", "製鋼": "seiko",
  "製薬": "seiyaku", "自動車": "jidosha", "開発": "kaihatsu", "不動産": "fudosan", "金属": "kinzoku", "石油": "sekiyu", "船舶": "senpaku",
  "組合": "kumiai", "協会": "kyokai", "光学": "kogaku", "重工業": "jukogyo", "重工": "juko", "製紙": "seishi", "紡績": "boseki", "繊維": "seni",
  "印刷": "insatsu", "電子": "denshi", "通信": "tsushin", "情報": "joho", "設備": "setsubi", "塗料": "toryo", "硝子": "garasu", "木材": "mokuzai",
  "林業": "ringyo", "農業": "nogyo", "酒造": "shuzo", "醸造": "jozo", "製菓": "seika", "製粉": "seifun", "製氷": "seihyo", "冷蔵": "reizo",
  "冷凍": "reito", "加工": "kako", "販売": "hanbai", "商社": "shosha", "興産": "kosan", "実業": "jitsugyo", "企画": "kikaku", "総業": "sogyo",
  "総合": "sogo", "建材": "kenzai", "建築": "kenchiku", "土木": "doboku", "工務店": "komuten", "運送": "unso", "陸運": "rikuun", "航空": "koku",
  "観光": "kanko", "電力": "denryoku", "鉄道": "tetsudo", "電鉄": "dentetsu", "銀行": "ginko", "証券": "shoken", "保険": "hoken", "商工": "shoko",
  "海産": "kaisan", "魚類": "gyorui", "冷凍食品": "reito shokuhin", "船具": "sengu", "漁網": "gyomo", "海事": "kaiji", "曳船": "eisen",
  "港湾": "kowan", "回漕": "kaiso", "回漕店": "kaisoten", "海陸": "kairiku", "運輸倉庫": "unyu soko", "石材": "sekizai", "陶器": "toki",
  /* les lieux et les mots faits que l'usage lit d'un bloc */ "東洋": "toyo", "日本": "nippon", "大和": "yamato", "太平洋": "taiheiyo",
  "日新": "nisshin", "東海": "tokai", "北海": "hokkai", "北海道": "hokkaido", "関西": "kansai", "関東": "kanto", "九州": "kyushu", "四国": "shikoku",
  "北陸": "hokuriku", "中部": "chubu", "東北": "tohoku", "阪神": "hanshin", "京阪": "keihan", "京浜": "keihin", "神戸": "kobe", "横浜": "yokohama",
  "名古屋": "nagoya", "大阪": "osaka", "東京": "tokyo", "京都": "kyoto", "福岡": "fukuoka", "広島": "hiroshima", "仙台": "sendai", "札幌": "sapporo",
  "新潟": "niigata", "千葉": "chiba", "静岡": "shizuoka", "長崎": "nagasaki", "鹿児島": "kagoshima", "沖縄": "okinawa", "瀬戸": "seto",
  "明石": "akashi", "尾道": "onomichi", "今治": "imabari", "舞鶴": "maizuru", "函館": "hakodate", "釧路": "kushiro", "気仙沼": "kesennuma",
  "焼津": "yaizu", "八戸": "hachinohe", "銚子": "choshi", "境港": "sakaiminato", "下関": "shimonoseki", "門司": "moji", "呉": "kure",
  "佐世保": "sasebo", "石巻": "ishinomaki", "塩釜": "shiogama", "枕崎": "makurazaki", "三崎": "misaki", "室蘭": "muroran", "小樽": "otaru",
  "稚内": "wakkanai", "根室": "nemuro", "宮城": "miyagi", "青森": "aomori", "岩手": "iwate", "福島": "fukushima", "茨城": "ibaraki", "神奈川": "kanagawa",
  "愛知": "aichi", "三重": "mie", "兵庫": "hyogo", "和歌山": "wakayama", "岡山": "okayama", "山口": "yamaguchi", "愛媛": "ehime", "高知": "kochi",
  "熊本": "kumamoto", "宮崎": "miyazaki", "大分": "oita", "佐賀": "saga", "富山": "toyama", "石川": "ishikawa", "福井": "fukui", "島根": "shimane",
  "鳥取": "tottori", "香川": "kagawa", "徳島": "tokushima", "秋田": "akita", "山形": "yamagata", "群馬": "gunma", "栃木": "tochigi", "埼玉": "saitama",
  "山梨": "yamanashi", "長野": "nagano", "岐阜": "gifu", "滋賀": "shiga", "奈良": "nara", "三菱": "mitsubishi", "三井": "mitsui", "住友": "sumitomo",
  "日立": "hitachi", "東芝": "toshiba", "川崎": "kawasaki", "日産": "nissan", "日野": "hino", "富士": "fuji", "旭": "asahi", "朝日": "asahi",
  "霜月": "shimotsuki", "睦月": "mutsuki", "如月": "kisaragi", "弥生": "yayoi", "卯月": "uzuki", "皐月": "satsuki", "水無月": "minazuki",
  "文月": "fumizuki", "葉月": "hazuki", "長月": "nagatsuki", "神無月": "kannazuki", "師走": "shiwasu",
  /* tour 15 (jeu 19) : les métiers et les mots faits que les paires ont apportés (化成 kasei, 重機 juki), les mots composés dont
     la lecture n'est pas la somme des kanji (霧雨 kirisame, 海幸 umisachi, 昭和 showa, 大丸 daimaru), les ères, les maisons de
     commerce (丸紅, 日商), les mentions d'établissement (支店 shiten, 営業所 eigyosho, 工場 kojo : voir SUCCURSALES_COLLEES,
     preparation.ts) et les civilités d'un pli (御中 onchu, 様 sama : voir HONORIFIQUES_JAPONAIS) */
  "化成": "kasei", "重機": "juki", "霧雨": "kirisame", "海幸": "umisachi", "昭和": "showa", "平成": "heisei", "令和": "reiwa",
  "大正": "taisho", "明治": "meiji", "大丸": "daimaru", "丸紅": "marubeni", "丸善": "maruzen", "日東": "nitto", "日商": "nissho",
  "日通": "nittsu", "日鉄": "nittetsu", "三和": "sanwa", "三共": "sankyo", "三洋": "sanyo", "三陽": "sanyo", "三幸": "sanko",
  "三光": "sanko", "協和": "kyowa", "共和": "kyowa", "大同": "daido", "大成": "taisei", "太陽": "taiyo", "太洋": "taiyo", "大洋": "taiyo",
  "光洋": "koyo", "東亜": "toa", "東邦": "toho", "東和": "towa", "南海": "nankai", "北洋": "hokuyo", "共同": "kyodo", "国際": "kokusai",
  "中央": "chuo", "山陽": "sanyo", "山陰": "sanin", "信越": "shinetsu", "信州": "shinshu", "紀州": "kishu", "本州": "honshu",
  "阪急": "hankyu", "近鉄": "kintetsu", "海王": "kaio", "海洋": "kaiyo", "海神": "kaijin", "海龍": "kairyu", "海宝": "kaiho",
  "旭日": "kyokujitsu", "日章": "nissho", "興亜": "koa", "宝来": "horai", "福寿": "fukuju", "永久": "eikyu", "栄光": "eiko",
  "光栄": "koei", "瑞穂": "mizuho", "瑞鳳": "zuiho", "飛龍": "hiryu", "翔鶴": "shokaku", "海老": "ebi", "五十嵐": "igarashi",
  "支店": "shiten", "営業所": "eigyosho", "営業部": "eigyobu", "工場": "kojo", "支社": "shisha", "出張所": "shutchojo", "事業所": "jigyosho",
  "本社": "honsha", "本店": "honten", "御中": "onchu", "様": "sama", "殿": "dono",
}));

/** Les kanji un à un, sous la lecture qu'ils prennent dans un patronyme ou un nom de la nature (kun, sauf là où l'usage
 *  lit l'on : 新 shin, 大 dai devant un mot sino-japonais est rare dans un patronyme). */
export const KANJI: ReadonlyMap<string, string> = new Map(Object.entries({
  "霜": "shimo", "月": "tsuki", "山": "yama", "川": "kawa", "田": "ta", "中": "naka", "本": "moto", "木": "ki", "林": "hayashi", "森": "mori",
  "村": "mura", "島": "shima", "嶋": "shima", "井": "i", "上": "kami", "下": "shimo", "大": "o", "小": "ko", "東": "higashi", "西": "nishi",
  "南": "minami", "北": "kita", "新": "shin", "松": "matsu", "竹": "take", "梅": "ume", "石": "ishi", "岡": "oka", "橋": "hashi", "野": "no",
  "原": "hara", "沢": "sawa", "澤": "sawa", "谷": "tani", "藤": "fuji", "佐": "sa", "高": "taka", "宮": "miya", "崎": "saki", "﨑": "saki",
  "浜": "hama", "濱": "hama", "港": "minato", "海": "umi", "光": "hikari", "日": "hi", "金": "kane", "富": "tomi", "三": "mi", "一": "ichi",
  "千": "chi", "星": "hoshi", "雪": "yuki", "花": "hana", "桜": "sakura", "鶴": "tsuru", "亀": "kame", "龍": "ryu", "竜": "ryu", "神": "kami",
  "戸": "to", "城": "shiro", "津": "tsu", "尾": "o", "平": "hira", "和": "wa", "栄": "sakae", "豊": "toyo", "吉": "yoshi", "福": "fuku",
  "幸": "yuki", "清": "kiyo", "黒": "kuro", "白": "shira", "赤": "aka", "青": "ao", "池": "ike", "泉": "izumi", "滝": "taki", "波": "nami",
  "風": "kaze", "雲": "kumo", "春": "haru", "夏": "natsu", "秋": "aki", "冬": "fuyu", "朝": "asa", "空": "sora", "水": "mizu", "火": "hi",
  "土": "tsuchi", "米": "kome", "塩": "shio", "魚": "uo", "鳥": "tori", "馬": "uma", "牛": "ushi", "虎": "tora", "鷹": "taka", "熊": "kuma",
  "鹿": "shika", "岩": "iwa", "坂": "saka", "阪": "saka", "堀": "hori", "倉": "kura", "蔵": "kura", "庄": "sho", "郷": "go", "里": "sato",
  "町": "machi", "市": "ichi", "国": "kuni", "内": "uchi", "外": "soto", "前": "mae", "奥": "oku", "元": "moto", "末": "sue", "久": "hisa",
  "永": "naga", "長": "naga", "広": "hiro", "太": "ta", "正": "masa", "真": "ma", "直": "nao", "義": "yoshi", "信": "shin", "忠": "tada",
  "孝": "taka", "徳": "toku", "英": "hide", "秀": "hide", "勝": "katsu", "武": "take", "文": "fumi", "宝": "takara", "玉": "tama", "根": "ne",
  "枝": "eda", "葉": "ha", "実": "mi", "菊": "kiku", "蘭": "ran", "柳": "yanagi", "杉": "sugi", "桐": "kiri", "楠": "kusu", "榊": "sakaki",
  "笹": "sasa", "萩": "hagi", "藪": "yabu", "畑": "hata", "畠": "hata", "岸": "kishi", "浦": "ura", "潟": "kata", "洲": "su", "瀬": "se",
  "淵": "fuchi", "沼": "numa", "湊": "minato", "浪": "nami", "潮": "shio", "渡": "watari", "船": "fune", "帆": "ho", "網": "ami", "釣": "tsuri",
  "丘": "oka", "峰": "mine", "嶺": "mine", "岳": "take", "麓": "fumoto", "門": "kado", "家": "ie", "屋": "ya",
  "堂": "do", "宿": "shuku", "関": "seki", "道": "michi", "辻": "tsuji", "角": "kado", "王": "o", "御": "mi", "多": "ta",
  "見": "mi", "美": "mi", "喜": "ki", "加": "ka", "香": "ka", "佳": "ka", "生": "o", "友": "tomo", "知": "chi", "志": "shi", "紀": "ki",
  "貴": "taka", "隆": "taka", "康": "yasu", "安": "yasu", "保": "yasu", "健": "take", "剛": "go", "力": "riki", "勇": "isamu", "誠": "makoto",
  "明": "aki", "昭": "aki", "晴": "haru", "陽": "yo", "暁": "akatsuki", "曙": "akebono", "旭": "asahi", "夕": "yu", "夜": "yo", "宵": "yoi",
  "銀": "gin", "銅": "do", "鉄": "tetsu", "鋼": "hagane", "錦": "nishiki", "絹": "kinu", "糸": "ito", "布": "nuno", "紙": "kami", "酒": "sake",
  "茶": "cha", "麦": "mugi", "豆": "mame", "栗": "kuri", "柿": "kaki", "梨": "nashi", "桃": "momo", "橘": "tachibana", "柚": "yuzu",
  "鮎": "ayu", "鯛": "tai", "鯨": "kujira", "鰹": "katsuo", "鮭": "sake", "鱒": "masu", "蟹": "kani", "貝": "kai", "珠": "tama", 
  /* tour 15 (jeu 19) : les kanji des noms de navires et de sociétés que le jeu a apportés (駒 koma, 若 waka, 鷲 washi, 鳴 naru,
     凪 nagi, 岬 misaki, 鳩 hato, 助 suke, 淀 yodo, 舟 fune, 早 haya), et les autres noms de la nature, des couleurs, des bêtes,
     des lieux, des nombres et des vertus, chacun sous la lecture qu'il prend dans un nom. 丸 se lit ici (maru) dans un nom
     de société (丸信 Marushin) et à part en queue d'un nom de navire (voir `japonais`, ecritures.ts) */
  "丸": "maru", "駒": "koma", "若": "waka", "蒼": "so", "鷲": "washi", "鳴": "naru", "之": "no", "江": "e", "凪": "nagi", "岬": "misaki",
  "鳩": "hato", "助": "suke", "霧": "kiri", "雨": "ame", "淀": "yodo", "舟": "fune", "早": "haya", "八": "ya", "二": "ni", "四": "yo",
  "五": "go", "六": "roku", "七": "nana", "九": "ku", "十": "to", "百": "momo", "万": "man", "号": "go",
  "峠": "toge", "磯": "iso", "灘": "nada", "沖": "oki", "洋": "yo", "湾": "wan", "渕": "fuchi", "洞": "hora", "穴": "ana", "嶽": "take",
  "草": "kusa", "苔": "koke", "葦": "ashi", "椿": "tsubaki", "楓": "kaede", "檜": "hinoki", "桧": "hinoki", "樫": "kashi", "欅": "keyaki",
  "樹": "ki", "桂": "katsura", "楢": "nara", "柏": "kashiwa", "榎": "enoki", "梶": "kaji", "椎": "shii", "櫻": "sakura", "蔦": "tsuta",
  "葛": "kuzu", "芦": "ashi", "荻": "ogi", "稲": "ine", "稻": "ine", "穂": "ho", "粟": "awa", "芋": "imo", "瓜": "uri", "麻": "asa",
  "綿": "wata", "桑": "kuwa", "苺": "ichigo", "蓮": "hasu",
  "鷺": "sagi", "鴨": "kamo", "雁": "kari", "鶯": "uguisu", "燕": "tsubame", "雀": "suzume", "鳶": "tobi", "隼": "hayabusa", "鴻": "ko",
  "鵜": "u", "鷗": "kamome", "鴎": "kamome", "兎": "usagi", "猿": "saru", "狐": "kitsune", "狸": "tanuki", "猫": "neko", "犬": "inu",
  "羊": "hitsuji", "象": "zo", "獅": "shishi", "蝶": "cho", "蜂": "hachi", "鮪": "maguro", "鰤": "buri", "鯖": "saba", "鰯": "iwashi",
  "鰻": "unagi", "鱈": "tara", "鮫": "same", "鯉": "koi", "鮒": "funa", "蛸": "tako", "烏": "karasu", "鵬": "ho", "鳳": "ho", "麒": "ki",
  "麟": "rin", "汐": "shio", "渚": "nagisa", "濤": "nami", "舵": "kaji", "錨": "ikari", "碇": "ikari", "天": "ten", "虹": "niji",
  "霞": "kasumi", "露": "tsuyu", "嵐": "arashi", "昴": "subaru", "輝": "teru", "翔": "sho",
  "央": "o", "後": "go", "横": "yoko", "辺": "be", "邊": "be", "隅": "sumi", "端": "hata",
  "男": "o", "女": "me", "子": "ko", "郎": "ro", "夫": "o", "雄": "o", "彦": "hiko", "介": "suke", "也": "ya", "哉": "ya", "造": "zo",
  "治": "ji", "次": "ji", "智": "tomo", "恵": "e", "惠": "e", "愛": "ai", "夢": "yume", "希": "ki", "繁": "shige", "茂": "shige",
  "盛": "mori", "昌": "masa", "晶": "aki", "彰": "aki", "亮": "ryo", "涼": "ryo", "良": "yoshi", "嘉": "yoshi", "芳": "yoshi",
  "恒": "tsune", "常": "tsune", "典": "nori", "法": "nori", "則": "nori", "憲": "nori", "範": "nori", "寛": "hiro", "弘": "hiro",
  "博": "hiro", "浩": "hiro", "宏": "hiro", "豪": "go", "猛": "take", "寿": "kotobuki", "禄": "roku", "祥": "sho", "瑞": "mizu",
  "賀": "ga", "楽": "raku",
  "錫": "suzu", "鈴": "suzu", "鐘": "kane", "剣": "tsurugi", "弓": "yumi", "矢": "ya", "盾": "tate", "旗": "hata", "鏡": "kagami",
  "扇": "ogi", "笠": "kasa", "傘": "kasa", "帯": "obi", "綾": "aya", "紅": "beni", "紺": "kon", "藍": "ai", "緑": "midori", "翠": "midori",
  "碧": "ao", "黄": "ki", "灰": "hai", "紫": "murasaki",
  "館": "kan", "舎": "sha", "亭": "tei", "庵": "an", "苑": "en", "園": "en", "庭": "niwa", "窓": "mado", "塔": "to", "路": "ji",
  "街": "machi", "都": "to", "府": "fu", "県": "ken", "州": "su", "京": "kyo", "社": "sha", "寺": "tera", "塚": "tsuka", "荘": "so",
  "駅": "eki", "場": "ba", "所": "sho", "商": "sho", "産": "san", "業": "gyo", "会": "kai", "組": "kumi", "協": "kyo", "連": "ren",
  "合": "go", "同": "do", "共": "kyo", "総": "so", "興": "ko", "成": "nari", "製": "sei",
  "昼": "hiru", "古": "furu", "初": "hatsu", "年": "toshi", "歳": "toshi", "代": "shiro", "飛": "tobi",
}));

/* ─────────────────────────── les numéraux des navires (tour 15) ─────────────────────────── */

/** Les chiffres en kanji d'un numéro de navire (第八 : 8 ; 第十一 : 11 ; 第二十八 : 28), ou undefined si la suite n'en est pas un. */
export function numeralKanji(suite: string): number | undefined {
  const UNITES: ReadonlyMap<string, number> = new Map([["一", 1], ["二", 2], ["三", 3], ["四", 4], ["五", 5], ["六", 6], ["七", 7], ["八", 8], ["九", 9]]);
  const m = /^([一二三四五六七八九]?)(十?)([一二三四五六七八九]?)$/u.exec(suite);
  if (!m || suite === "") return undefined;
  const dizaine = m[2] === "十" ? (m[1] === "" ? 1 : UNITES.get(m[1]!)!) * 10 : m[1] === "" ? 0 : UNITES.get(m[1]!)!;
  if (m[2] === "" && m[3] !== "") return undefined;
  return dizaine + (m[3] === "" ? 0 : UNITES.get(m[3]!)!);
}
const ROMAJI_UNITES = ["", "ichi", "ni", "san", "yon", "go", "roku", "nana", "hachi", "kyu"];
/** Un numéro en lecture japonaise, sans macron (8 : hachi ; 11 : juichi ; 28 : nijuhachi), celle que « Dai-hachi » écrit. */
export function romajiNumeral(n: number): string {
  if (n < 1 || n > 99) return String(n);
  const d = Math.floor(n / 10), u = n % 10;
  return (d === 0 ? "" : (d === 1 ? "" : ROMAJI_UNITES[d]) + "ju") + ROMAJI_UNITES[u];
}
/** Le numéro que dit un mot « dai… » (第 et son numéral : daihachi 8, daijuichi 11, dai-san 3), sous le Hepburn (hachi, shichi,
 *  ju) ou le Kunrei (hati, siti, zyu, kyuu), ou undefined s'il n'en est pas un. */
export function numeroDai(mot: string): number | undefined {
  const m = /^dai-?(.+)$/.exec(mot.replace(/tsu/g, "tu").replace(/chi/g, "ti").replace(/shi/g, "si").replace(/zy/g, "j").replace(/uu/g, "u").replace(/ou/g, "o"));
  if (!m) return undefined;
  const UNITES: ReadonlyMap<string, number> = new Map([["iti", 1], ["ni", 2], ["san", 3], ["yon", 4], ["si", 4], ["go", 5], ["roku", 6], ["nana", 7], ["siti", 7],
    ["hati", 8], ["kyu", 9], ["ku", 9]]);
  const unite = [...UNITES.keys()].join("|");
  const r = new RegExp(`^(?:(${unite})?(ju))?(${unite})?$`).exec(m[1]!);
  if (!r || m[1] === "") return undefined;
  const dizaine = r[2] ? (r[1] ? UNITES.get(r[1])! : 1) * 10 : 0;
  return dizaine + (r[3] ? UNITES.get(r[3])! : 0);
}
