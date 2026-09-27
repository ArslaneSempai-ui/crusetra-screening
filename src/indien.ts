/**
 * LES NOMS INDIENS SOUS DEUX GRAPHIES (tour 9, voie romanisations) : le patronyme bengali dans sa forme sanskrite et
 * dans la forme que l'administration anglaise en a faite, le patronyme du nord dont la finale hésite d'un registre à
 * l'autre, la ville et le fleuve sous leur nom d'aujourd'hui et sous celui du Raj. Une table du monde, pas du jeu : la
 * forme anglicisée et la forme d'origine nomment la même famille ou le même lieu, quel que soit le nom qui les porte.
 * Pure table : la préparation l'importe, elle n'importe rien.
 */

/** Chaque graphie et la forme sous laquelle la préparation la range (jeu 13, 28/09 : « Bandyopadhyay Trading House » face à
 *  « Banerjee Trading House » à 0,460, « Chatterjee » face à « Chattopadhyay » à 0,626, « Rathore » face à « Rathod » à 0,689,
 *  « Kaveri » face à « Cauvery » à 0,643 : aucun squelette ne rejoint deux formes qui ne partagent que leurs premières
 *  lettres). La forme retenue est la plus courante dans les registres ; peu importe laquelle, pourvu que ce soit une seule. */
export const GRAPHIES_INDIENNES: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les patronymes bengalis : -opadhyay (le sanskrit upādhyāya, le maître) et sa forme anglaise en -erjee, -erji ;
     Gangopadhyay a donné Ganguly ; Bhattacharya s'écrit aussi en -jee ; Chakraborty sous toutes ses voyelles */
  bandyopadhyay: "banerjee", bandopadhyay: "banerjee", banerji: "banerjee", bannerjee: "banerjee", banerjea: "banerjee",
  chattopadhyay: "chatterjee", chattopadhyaya: "chatterjee", chatterji: "chatterjee", chatterjea: "chatterjee",
  mukhopadhyay: "mukherjee", mukhopadhyaya: "mukherjee", mukherji: "mukherjee", mookerjee: "mukherjee", mookherjee: "mukherjee", mukherjea: "mukherjee",
  gangopadhyay: "ganguly", gangopadhyaya: "ganguly", ganguli: "ganguly", gangooly: "ganguly", gangulee: "ganguly",
  bhattacharjee: "bhattacharya", bhattacharyya: "bhattacharya", bhattacharji: "bhattacharya", bhattacharje: "bhattacharya", bhattacharyay: "bhattacharya",
  chakrabarti: "chakraborty", chakrabarty: "chakraborty", chakravarti: "chakraborty", chakravarty: "chakraborty", chakravorty: "chakraborty", chakraverti: "chakraborty",
  /* le nord : Rathore, Rathod, Rathor, Rathour sont un clan rajpoute ; Chaudhary, Chowdhury, Chaudhry un même titre */
  rathod: "rathore", rathor: "rathore", rathour: "rathore", rathaur: "rathore",
  /* le Sud : le titre tamoul ஐயர் s'écrit Iyer, Iyar, Aiyar, Ayyar, Aiyer ; ஐயங்கார் Iyengar, Aiyangar, Ayyangar (tour 10, jeu 14 :
     « Iyer & Subramaniam Exports » face à « Iyar & Subramaniam Exports » à 0,742, e et a deux voyelles sans marque de romanisation) */
  iyar: "iyer", aiyar: "iyer", ayyar: "iyer", aiyer: "iyer", aiyangar: "iyengar", ayyangar: "iyengar", ayengar: "iyengar",
  chaudhry: "chaudhary", chaudhari: "chaudhary", chaudhuri: "chaudhary", choudhary: "chaudhary", choudhury: "chaudhary", chowdhury: "chaudhary",
  chowdhary: "chaudhary", choudhry: "chaudhary", chaudhury: "chaudhary", choudhari: "chaudhary",
  /* les fleuves et les villes : le nom d'aujourd'hui et celui du Raj, que les registres anciens et les enseignes gardent */
  cauvery: "kaveri", ganges: "ganga", tinnevelly: "tirunelveli", trichinopoly: "tiruchirappalli", tiruchirapalli: "tiruchirappalli",
  trichy: "tiruchirappalli", tuticorin: "thoothukudi", bombay: "mumbai", madras: "chennai", calcutta: "kolkata", bangalore: "bengaluru",
  poona: "pune", cochin: "kochi", calicut: "kozhikode", trivandrum: "thiruvananthapuram", baroda: "vadodara", cawnpore: "kanpur",
  benares: "varanasi", banaras: "varanasi", simla: "shimla", pondicherry: "puducherry", orissa: "odisha", mysore: "mysuru",
  mangalore: "mangaluru", belgaum: "belagavi", hubli: "hubballi", alleppey: "alappuzha", quilon: "kollam", cannanore: "kannur",
  tellicherry: "thalassery", palghat: "palakkad", trichur: "thrissur", ootacamund: "udhagamandalam", ooty: "udhagamandalam",
  negapatam: "nagapattinam", masulipatam: "machilipatnam", vizag: "visakhapatnam", vishakhapatnam: "visakhapatnam", waltair: "visakhapatnam",
  cuddapah: "kadapa", bezwada: "vijayawada", allahabad: "prayagraj", gurgaon: "gurugram", jubbulpore: "jabalpur", nagpore: "nagpur",
  jullundur: "jalandhar", umballa: "ambala", muttra: "mathura", panjim: "panaji", dacca: "dhaka", chittagong: "chattogram",
}));
