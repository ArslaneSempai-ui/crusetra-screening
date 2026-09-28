/**
 * LES KANA D'UN NOM JAPONAIS (tour 15, voie japonais-coréen) : hiragana et katakana, ramenés au Hepburn sans macron, celui
 * que le nom anglais d'un navire ou d'une société écrit (« LNGツクヨミ » : LNG Tsukuyomi ; « フェリーみずかがみ » : Ferry
 * Mizukagami ; « マルシンジュウキ株式会社 » : Marushin Juki K.K., jeu 19 : quatre paires à 0,000, les kana traversant tels quels
 * en un seul mot rare). Pure table et fonctions sans état : ecritures.ts les importe, elles n'importent rien.
 *
 * Deux tables. Les GÉNÉRIQUES_KANA sont les mots que le katakana épelle et que le côté latin écrit dans leur langue : les
 * mots anglais des noms de navires (ハイウェイ highway, スター star, バルカー bulker, フェリー ferry, エース ace), dont la
 * transcription japonaise ne se replie sur aucune règle (haiwei, sutaa, barukaa), comme les mots anglais écrits en hangul
 * (GENERIQUES_HANGUL) ; et les mots de métier des raisons sociales japonaises écrits en katakana (ショウジ shoji, コウギョウ
 * kogyo, カブシキガイシャ kabushiki kaisha), sous la graphie romanisée que kanji.ts donne aux mêmes mots en kanji, pour que
 * « マルシンジュウキ » et « 丸信重機 » se coupent aux mêmes mots. Deux kana au moins par clé. Le reste, le nom propre, se lit
 * kana par kana : le yōon (キャ kya, シャ sha), le sokuon (ッ, la consonne doublée), le trait long (ー, la voyelle répétée),
 * le point médian (・, une frontière de mot), les petites voyelles des emprunts (ティ ti, ファ fa, ウェ we, ヴァ va). Une
 * lecture sans macron ni apostrophe, celle que `pliJaponais` replie ensuite avec le côté latin (Kōgyō : kogyo ; Sen'i : seni).
 */

/** Les mots que le katakana épelle : anglais des navires et du commerce, métiers japonais des raisons sociales. */
export const GENERIQUES_KANA: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les formes et les métiers japonais, sous la romanisation de kanji.ts */
  "カブシキガイシャ": "kabushiki kaisha", "カブシキカイシャ": "kabushiki kaisha", "ユウゲンガイシャ": "yugen kaisha", "ユウゲンカイシャ": "yugen kaisha",
  "ゴウドウガイシャ": "godo kaisha", "ゴウドウカイシャ": "godo kaisha", "ショウジ": "shoji", "コウギョウ": "kogyo", "サンギョウ": "sangyo",
  "デンキ": "denki", "カガク": "kagaku", "セイコウ": "seiko", "セイサクショ": "seisakusho", "スイサン": "suisan", "カイウン": "kaiun",
  "ウンユ": "unyu", "キカイ": "kikai", "ショウカイ": "shokai", "ショウテン": "shoten", "ジュウキ": "juki", "カセイ": "kasei",
  "ボウエキ": "boeki", "ツウショウ": "tsusho", "ブッサン": "bussan", "ケンセツ": "kensetsu", "テッコウ": "tekko", "ゾウセン": "zosen",
  "ショクヒン": "shokuhin", "セイヤク": "seiyaku", "セイシ": "seishi", "センイ": "seni", "キンゾク": "kinzoku", "デンシ": "denshi",
  "ツウシン": "tsushin", "ジドウシャ": "jidosha", "カイハツ": "kaihatsu", "フドウサン": "fudosan", "セキユ": "sekiyu", "ソウコ": "soko",
  "コウウン": "koun", "ジュウコウギョウ": "jukogyo", "ジュウコウ": "juko", "シュゾウ": "shuzo", "セイキ": "seiki", "ギョギョウ": "gyogyo",
  "カイサン": "kaisan", "セイゾウ": "seizo", "ハンバイ": "hanbai", "コウサン": "kosan", "ジツギョウ": "jitsugyo", "ソウギョウ": "sogyo",
  /* les mots anglais des navires et des sociétés, tels que le katakana les épelle */
  "ハイウェイ": "highway", "ハイウエイ": "highway", "スター": "star", "バルカー": "bulker", "フェリー": "ferry", "エース": "ace",
  "コバルト": "cobalt", "マリン": "marine", "オーシャン": "ocean", "パイオニア": "pioneer", "グローバル": "global", "パシフィック": "pacific",
  "エクスプレス": "express", "キャリア": "carrier", "キャリアー": "carrier", "フロンティア": "frontier", "ハーモニー": "harmony",
  "ビクトリー": "victory", "チャレンジャー": "challenger", "ナビゲーター": "navigator", "パワー": "power", "ロジスティクス": "logistics",
  "シッピング": "shipping", "ライン": "line", "ラインズ": "lines", "タンカー": "tanker", "トレーディング": "trading", "インダストリー": "industry",
  "テクノロジー": "technology", "サービス": "service", "センター": "center", "カンパニー": "company", "コーポレーション": "corporation",
  "スチール": "steel", "スティール": "steel", "ケミカル": "chemical", "オート": "auto", "モータース": "motors", "エレクトロニクス": "electronics",
  "フーズ": "foods", "フード": "food", "パートナーズ": "partners", "リーダー": "leader", "ドリーム": "dream", "ブルー": "blue", "ゴールデン": "golden",
  "ゴールド": "gold", "シルバー": "silver", "ダイヤモンド": "diamond", "クリスタル": "crystal", "イーグル": "eagle", "タイガー": "tiger",
  "ドラゴン": "dragon", "フェニックス": "phoenix", "ユニバーサル": "universal", "グリーン": "green", "ブリッジ": "bridge", "ハーバー": "harbor",
  "アイランド": "island", "オリエント": "orient", "イースタン": "eastern", "ウエスタン": "western", "ウェスタン": "western", "プライム": "prime",
  "ロイヤル": "royal", "プリンス": "prince", "プリンセス": "princess", "スピリット": "spirit", "ホープ": "hope", "ギャラクシー": "galaxy",
  "グローリー": "glory", "フォーチュン": "fortune", "ラッキー": "lucky", "サンライズ": "sunrise", "サンシャイン": "sunshine", "スカイ": "sky",
  "ムーン": "moon", "ウィング": "wing", "ホライズン": "horizon", "エンタープライズ": "enterprise", "ベンチャー": "venture", "クレスト": "crest",
  "リライアンス": "reliance", "プログレス": "progress", "カーゴ": "cargo", "トランスポート": "transport", "ホールディングス": "holdings",
  "インターナショナル": "international", "ジャパン": "japan", "アジア": "asia", "コリア": "korea", "エナジー": "energy", "エネルギー": "energy",
  "グループ": "group", "システム": "system", "システムズ": "systems", "サプライ": "supply", "エンジニアリング": "engineering",
  "マリタイム": "maritime", "シップ": "ship", "ボート": "boat", "クルーズ": "cruise", "ハピネス": "happiness", "ビューティー": "beauty",
  "パール": "pearl", "ルビー": "ruby", "サファイア": "sapphire", "エメラルド": "emerald", "コーラル": "coral", "ロータス": "lotus",
  "サクセス": "success", "トラスト": "trust", "フレンド": "friend", "フレンドシップ": "friendship", "ピース": "peace", "ジョイ": "joy",
  "サミット": "summit", "ハイランド": "highland", "リバー": "river", "レイク": "lake", "ベイ": "bay", "ポート": "port", "キャピタル": "capital",
  "セントラル": "central", "ノーザン": "northern", "サザン": "southern", "アトランティック": "atlantic", "インディアン": "indian",
  "アフリカ": "africa", "ヨーロッパ": "europe", "アメリカ": "america", "ワールド": "world", "ネプチューン": "neptune", "オリオン": "orion",
  "ジュピター": "jupiter", "マーキュリー": "mercury", "ビーナス": "venus", "アポロ": "apollo", "アトラス": "atlas", "タイタン": "titan",
  "ヒーロー": "hero", "チャンピオン": "champion", "リバティ": "liberty", "フリーダム": "freedom", "ユニティ": "unity", "ビジョン": "vision",
  "ミレニアム": "millennium", "センチュリー": "century", "ジェネシス": "genesis", "オデッセイ": "odyssey", "ボイジャー": "voyager",
  "エクスプローラー": "explorer", "ディスカバリー": "discovery", "アドベンチャー": "adventure", "スプレンダー": "splendor", "グレース": "grace",
  "エレガンス": "elegance", "プレステージ": "prestige", "マジェスティ": "majesty", "エンパイア": "empire", "キングダム": "kingdom",
  "クイーン": "queen", "キング": "king", "レディ": "lady", "エンジェル": "angel", "レインボー": "rainbow", "オーロラ": "aurora",
  "ブリーズ": "breeze", "ウェーブ": "wave", "タイド": "tide", "ストーム": "storm", "サンダー": "thunder", "ライトニング": "lightning",
  "フレーム": "flame", "ファイヤー": "fire", "アイス": "ice", "スノー": "snow", "クラウド": "cloud", "ノース": "north",
  "サウス": "south", "イースト": "east", "ウエスト": "west", "ウェスト": "west", "セント": "saint", "ニュー": "new", "グランド": "grand",
  "グレート": "great", "ビッグ": "big", "ベスト": "best", "トップ": "top", "ファースト": "first", "スーパー": "super", "ハイパー": "hyper",
  "マスター": "master", "キャプテン": "captain", "アドミラル": "admiral", "コマンダー": "commander", "ガーディアン": "guardian",
  "ハンター": "hunter", "レンジャー": "ranger", "ナイト": "knight", "ウォリアー": "warrior", "ファルコン": "falcon", "ホーク": "hawk",
  "コンドル": "condor", "アルバトロス": "albatross", "スワン": "swan", "ドルフィン": "dolphin", "ホエール": "whale", "シャーク": "shark",
  "マーリン": "marlin", "ライオン": "lion", "パンサー": "panther", "レオパード": "leopard", "ジャガー": "jaguar", "ベア": "bear", "ウルフ": "wolf",
  "スタリオン": "stallion", "ペガサス": "pegasus", "ユニコーン": "unicorn", "グリフィン": "griffin", "ヴィーナス": "venus",
}));

/** Les kana un à un, sous le Hepburn ; les katakana se ramènent aux hiragana avant la lecture. */
const KANA: ReadonlyMap<string, string> = new Map(Object.entries({
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o", "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
  "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so", "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
  "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no", "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo", "や": "ya", "ゆ": "yu", "よ": "yo",
  "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro", "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go", "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
  "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do", "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
  "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po", "ゔ": "vu", "ゎ": "wa",
  /* les petits kana des noms de lieux (ヶ, ヵ : 千鳥ヶ瀬 Chidorigase, 三ヵ日 Mikkabi) */
  "ゕ": "ka", "ゖ": "ga",
}));
const PETITES_VOYELLES: ReadonlyMap<string, string> = new Map([["ぁ", "a"], ["ぃ", "i"], ["ぅ", "u"], ["ぇ", "e"], ["ぉ", "o"]]);
const PETITS_YOON: ReadonlyMap<string, string> = new Map([["ゃ", "a"], ["ゅ", "u"], ["ょ", "o"]]);
const SOKUON = "っ", TRAIT_LONG = "ー", POINT_MEDIAN = "・";

/** Un katakana ramené à son hiragana (U+30A1 à U+30F6 : U+3041 à U+3096) ; ヵ et ヶ ont leur petit hiragana ; le reste inchangé. */
function enHiragana(c: string): string {
  const cp = c.codePointAt(0)!;
  return cp >= 0x30a1 && cp <= 0x30f6 ? String.fromCodePoint(cp - 0x60) : c;
}

/** Une suite de kana, en Hepburn sans macron ; le point médian rend une espace. */
export function kanaEnLatin(suite: string): string {
  let sortie = "";
  let sokuon = false;
  const dernier = () => sortie.match(/[a-z]+$/)?.[0] ?? "";
  for (const brut of suite) {
    const c = enHiragana(brut);
    if (c === POINT_MEDIAN) { sortie += " "; sokuon = false; continue; }
    if (c === SOKUON) { sokuon = true; continue; }
    if (c === TRAIT_LONG) { const v = /[aeiou](?=[^aeiou]*$)/.exec(dernier())?.[0]; if (v) sortie += v; continue; }
    const yoon = PETITS_YOON.get(c);
    if (yoon !== undefined) {
      /* le yōon : la syllabe en i perd son i (ki + ya : kya ; shi + ya : sha ; chi + yu : chu ; ji + yo : jo) ; テュ, デュ, フュ aussi */
      const s = dernier();
      const base = s.replace(/[ie]$/, "");
      if (base === s || base === "") { sortie += "y" + yoon; continue; }
      sortie = sortie.slice(0, sortie.length - s.length) + base + (/(?:sh|ch|j)$/.test(base) ? "" : "y") + yoon;
      continue;
    }
    const petite = PETITES_VOYELLES.get(c);
    if (petite !== undefined) {
      /* les petites voyelles des emprunts : ティ ti, ディ di, ファ fa, フォ fo, シェ she, チェ che, ジェ je, ツァ tsa, トゥ tu, ウィ wi, ウェ we, ヴァ va, イェ ye */
      const s = dernier();
      if (s === "u") { sortie = sortie.slice(0, -1) + "w" + petite; continue; }
      if (s === "i") { sortie = sortie.slice(0, -1) + "y" + petite; continue; }
      const base = s.replace(/[aeiou]$/, "");
      if (base === s || base === "") { sortie += petite; continue; }
      sortie = sortie.slice(0, sortie.length - s.length) + base + petite;
      continue;
    }
    const lu = KANA.get(c);
    if (lu === undefined) { sortie += brut; sokuon = false; continue; }
    /* le sokuon double la consonne qui suit (ッ + ka : kka ; ッ + chi : tchi) ; devant une voyelle, il ne s'écrit pas */
    if (sokuon) { sortie += lu.startsWith("ch") ? "t" : /^[aeiou]/.test(lu) ? "" : lu[0]!; sokuon = false; }
    sortie += lu;
  }
  return sortie;
}

/** Les kana d'une écriture : hiragana, katakana, leurs petits, le trait long, les marques d'itération. */
export const KANA_SUITE = /[ぁ-ゖゝゞァ-ヺー-ヾ]+/gu;
const CLES_KANA = new RegExp([...GENERIQUES_KANA.keys()].sort((a, b) => b.length - a.length).join("|"), "gu");

/** Un nom qui porte des kana : les mots génériques d'abord, puis chaque suite de kana lue en Hepburn, chacune un mot. */
export function kana(nom: string): string {
  return nom.replace(CLES_KANA, (m) => ` ${GENERIQUES_KANA.get(m) ?? m} `).replace(/・/gu, " ")
    .replace(KANA_SUITE, (suite) => ` ${kanaEnLatin(suite)} `);
}
