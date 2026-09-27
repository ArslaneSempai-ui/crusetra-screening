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
  "第一": "daiichi", "第二": "daini", "第三": "daisan", "第五": "daigo", "第八": "daihachi", "第十": "daiju", "丸": "maru",
  "霜月": "shimotsuki", "睦月": "mutsuki", "如月": "kisaragi", "弥生": "yayoi", "卯月": "uzuki", "皐月": "satsuki", "水無月": "minazuki",
  "文月": "fumizuki", "葉月": "hazuki", "長月": "nagatsuki", "神無月": "kannazuki", "師走": "shiwasu",
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
  "幸": "yuki", "清": "kiyo", "黒": "kuro", "白": "shiro", "赤": "aka", "青": "ao", "池": "ike", "泉": "izumi", "滝": "taki", "波": "nami",
  "風": "kaze", "雲": "kumo", "春": "haru", "夏": "natsu", "秋": "aki", "冬": "fuyu", "朝": "asa", "空": "sora", "水": "mizu", "火": "hi",
  "土": "tsuchi", "米": "kome", "塩": "shio", "魚": "uo", "鳥": "tori", "馬": "uma", "牛": "ushi", "虎": "tora", "鷹": "taka", "熊": "kuma",
  "鹿": "shika", "岩": "iwa", "坂": "saka", "阪": "saka", "堀": "hori", "倉": "kura", "蔵": "kura", "庄": "sho", "郷": "go", "里": "sato",
  "町": "machi", "市": "ichi", "国": "kuni", "内": "uchi", "外": "soto", "前": "mae", "奥": "oku", "元": "moto", "末": "sue", "久": "hisa",
  "永": "naga", "長": "naga", "広": "hiro", "太": "ta", "正": "masa", "真": "ma", "直": "nao", "義": "yoshi", "信": "nobu", "忠": "tada",
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
}));
