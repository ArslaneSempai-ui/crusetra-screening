/**
 * LES MOTS DU COMMERCE EN SWAHILI (tour 11, voie swahili-ourdou) : ce qu'une société du Kenya ou de Tanzanie écrit dans sa
 * raison sociale swahilie et que son nom anglais traduit (« Kampuni ya Usafirishaji Pwani » est « Pwani Transport Company »,
 * « Wakulima wa Meru » les « Meru Farmers » : jeu 15, 0,494 et 0,544, les mots swahilis orphelins rares). Une table du monde :
 * les mots de métier de la langue, sous la classe nominale que le nom écrit (wa- et m- pour les gens, u- pour l'activité,
 * ki- et vi- pour la chose et les choses), pas ceux du jeu. Pure table : la préparation l'importe, elle n'importe rien.
 *
 * Les particules (wa, ya, za, cha, kwa) sont dans PARTICULES. « Duka » rend « shop » : les enseignes ne passent pas dans les
 * génériques au pluriel (voir ENSEIGNES, preparation.ts), « Shop » et « Shops » restant deux boutiques. Ni « umoja » (l'unité :
 * United), ni « chai », « meli », « mafuta », « dawa », « chuma » : des patronymes ou des noms d'ailleurs (Chai, Meli, Mafuta,
 * Al-Dawa, Chuma) qu'une traduction ferait disparaître d'un seul côté.
 */
export const TRADUCTIONS_SWAHILIES: ReadonlyMap<string, string> = new Map(Object.entries({
  /* la société et ses métiers : « kampuni » est la company, qui ne pèse rien (une forme, comme « syarikat ») */
  kampuni: "company", ushirika: "cooperative", chama: "society", jamii: "community", biashara: "trading",
  wafanyabiashara: "traders", mfanyabiashara: "trader", huduma: "services", bidhaa: "goods", maendeleo: "development",
  /* les activités (u-) et leurs gens (wa-, m-) */
  usafirishaji: "transport", uchukuzi: "transport", usafiri: "transport", ujenzi: "construction", wajenzi: "builders",
  kilimo: "agriculture", wakulima: "farmers", mkulima: "farmer", uvuvi: "fisheries", wavuvi: "fishermen", mvuvi: "fisherman",
  viwanda: "industries", kiwanda: "factory",
  /* les enseignes et les lieux : la côte (« Pwani ») que le nom anglais traduit ou garde */
  duka: "shop", benki: "bank", pwani: "coast",
  /* les marchandises */
  sabuni: "soap", sukari: "sugar", mbao: "timber", madini: "minerals", nafaka: "grain", ngozi: "leather", vifaa: "equipment",
  mbolea: "fertilizer",
}));
