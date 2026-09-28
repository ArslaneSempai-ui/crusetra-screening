# Les limites connues du matcher d'entités

Le registre des paires que la méthode ne passera pas, et pourquoi. Une voie qui retrouve l'une d'elles dans ses ratés
ne la rouvre pas (doc/VOIE.md, règle 11) : `npm run rates-du-jeu` lit cette table et écrit la raison en queue de la
ligne. Une ligne par paire, écrite comme son jeu l'écrit ; le score est celui que `npm run paire -- "a" "b"` donne au
moment de la ligne, et `npm run paire -- --limites` rejoue toute la table et nomme les scores qui ont bougé
(`--corriger` réécrit la colonne). La raison dit en une phrase le mécanisme qu'il faudrait et pourquoi on le refuse :
une convention de l'auteur, le poids des génériques, l'absence de signe de navire, un vrai autre mot. Un nom ne porte
jamais de barre verticale.

Scores relevés le 28/09/2026 (`npm run paire`, poids des listes).

| a | b | set | score | reason |
|---|---|---|---|---|
| Zia Corporation (Pvt) Ltd | Zia Trading Corporation (Pvt) Ltd | 15 | 0.811 | Un générique ajouté (« Trading ») pèse peu à côté du nom rare, par le poids des génériques qui porte le rappel de toute la méthode ; le faire compter serait revenir sur ce poids. |
| Chibuzo Building Supplies | Chibuzo Building Suppliers Limited | 10 | 0.920 | Supplies et Suppliers sont lus comme un même générique du commerce, et le jeu 10 demande l'inverse pour Wholesale/Wholesome : les jeux se contredisent, aucune règle ne sert les deux. |
| Chopra Bros. Enterprises | Chopra Bro. Enterprise | 13 | 0.907 | Bros./Bro. et Enterprises/Enterprise ne diffèrent que par le pluriel d'un générique, un même mot pour la méthode ; deux sociétés est une convention de l'auteur que le nom ne porte pas. |
| Cypress Hollow Mooring LLC | Cyprus Hollow Mooring LLC | 6 | 0.896 | Cypress et Cyprus sont deux mots anglais que l'oreille confond ; les tenir à part demanderait d'annuler le crédit des homophones, posé pour le clavardage où le téléphone corrige. |
| Sinclair Pastoral Pty Ltd | St Clair Pastoral Pty Ltd | 13 | 0.889 | Sinclair et St Clair sont une même suite de lettres à l'espace et à l'abréviation de Saint près ; deux familles est une convention de l'auteur, pas un signe dans le nom. |
| Grand Coal Trader | Grand Coal Traders | 13 | 0.965 | Trader/Traders est le pluriel d'un générique du commerce, un même mot, et rien dans le nom ne dit le navire (ni préfixe ni type) : sans signe de navire, le pluriel ne sépare pas. |
| Pacific Wool Carrier | Pacific Wool Carriers | 13 | 0.965 | Carrier/Carriers, même pluriel d'un générique du commerce, et aucun signe de navire dans le nom. |
| Coral Horizon | Coral Horizan | 13 | 0.897 | « Horizan » n'est pas un mot du dictionnaire, donc une faute de frappe de Horizon ; sans signe de navire, une lettre changée ne fait pas un autre navire. |
| Kilindini Star, Mombasa | Kilindini Stars, Mombasa | 15 | 0.917 | Star/Stars est le pluriel d'un générique et le port en queue n'est pas un signe de navire ; sans préfixe ni type, le pluriel ne sépare pas. |
| Stamatia Horizon | Stamatia Horizons | 17 | 0.909 | Horizon/Horizons, même pluriel d'un générique, sans signe de navire. |
| Theodosia K | Theodosia G | 17 | 0.957 | Une lettre seule en queue est un mot d'une lettre dont le squelette fond K et G ; sans signe de navire, rien ne dit que la lettre numérote une sœur plutôt qu'une initiale. |
| MV Boa Esperança | MV Boa Esperancé | 16 | 0.900 | Le signe de navire est là, mais « esperance » est un mot anglais et la marque de clavardage crédite la correction du téléphone ; ce crédit porte de vrais navires des jeux et se garde. |
| 59:/ACC 0042771 KIRMIZIGUL GIDA LTD STI | Kırmızıgöl Gıda Ltd. Şti. | 12 | 0.881 | Gül et göl sont deux mots turcs à une lettre près dans un mot de dix ; le dictionnaire ne connaît que l'anglais, et tenir une lettre pour un autre mot dans un mot rare casse les fautes de frappe. |
| Talas Dan Azyk LLC | Taraz Dan Azyk LLC | 17 | 0.860 | Talas et Taraz sont deux villes à une lettre près ; il faudrait un répertoire des villes d'Asie centrale, et le dictionnaire ne connaît que l'anglais. |
| Hedland Trader Shipping K.K. | Hedland Traders Shipping K.K. | 13 | 0.964 | Trader/Traders est le pluriel d'un générique du commerce ; deux affréteurs qui ne diffèrent que par lui est une convention de l'auteur. |
| Curtume Bianchi Ltda. | Curtume Bianchini Ltda. | 16 | 0.900 | Bianchi/Bianchini sont deux suffixes italiens sur un même radical, deux familles pour l'auteur, deux lettres dans un mot de neuf pour la méthode ; une table des suffixes italiens casserait les fautes de frappe des mêmes mots. |
| Curtume Fontanelli | Curtume Fontanella | 16 | 0.900 | Fontanelli/Fontanella, même suffixe italien tenu à part par l'auteur ; une lettre dans un mot de dix reste une faute pour la méthode. |
| Curtiduría Pellegrino S.R.L. | Curtiduría Pellegrini S.R.L. | 16 | 0.900 | Pellegrino/Pellegrini, même suffixe italien tenu à part par l'auteur ; une lettre dans un mot de dix reste une faute. |
| Evangelatou Shipping Agencies E.P.E. | Evangelinou Shipping Agencies E.P.E. | 17 | 0.841 | -atou et -inou sont deux suffixes grecs sur un même radical ; deux lettres dans un mot de onze restent une faute, et une table des suffixes grecs serait une convention de l'auteur. |
| Pyrgiotakis Bulk Carriers S.A. | Pyrgiotis Bulk Carriers S.A. | 17 | 0.879 | -akis et -is, même suffixe grec tenu à part par l'auteur ; deux lettres dans un mot de onze restent une faute. |
| Comercio Exterior Watanabe | Comercio Exterior Watanabe Bolivia | 16 | 1.000 | Le pays en queue est lu comme une adresse et ôté ; le garder comme mot demanderait de distinguer la filiale « Watanabe Bolivia » de l'adresse « Watanabe, Bolivia », ce que le nom seul ne dit pas. |
| AdeBayoStores | AdebayoStores | 10 | 1.000 | Identiques à la casse près, 1,000 par construction ; un verdict « différent » sur une chaîne identique n'est pas une question de noms. |
| FemiOlaTraders | FemiolaTraders | 10 | 1.000 | Identiques à la casse près, 1,000 par construction ; le verdict n'est pas une question de noms. |
| ChiOmaVentures | ChiomaVentures | 10 | 1.000 | Identiques à la casse près, 1,000 par construction ; le verdict n'est pas une question de noms. |
| TundeOlaEnterprises | TundeolaEnterprises | 10 | 1.000 | Identiques à la casse près, 1,000 par construction ; le verdict n'est pas une question de noms. |
| NgoziKaStores | NgozikaStores | 10 | 1.000 | Identiques à la casse près, 1,000 par construction ; le verdict n'est pas une question de noms. |
| Jos Tin Miners Co | Jos Plateau Tin and Associated Minerals Mining Company Limited | 10 | 0.499 | Un nom commercial dans une raison sociale est une contenance, au possible au mieux, et elle exige que les mots rares du court soient dans le long ; « Miners » n'y est pas (Mining en est un autre). |
| Aba Leather Works | Aba Leather Tanning and Finished Goods Manufacturing Company Limited | 10 | 0.597 | Même contenance, au possible au mieux ; « Works » n'est pas dans le long, et quatre mots rares y sont d'un seul côté. |
| Warri Fish Exporters | Warri Frozen Fish and Seafood Export Enterprises Limited | 10 | 0.633 | Même contenance, au possible au mieux ; « Exporters » n'est pas dans le long (Export en est un autre), et trois mots rares y sont d'un seul côté. |
| Rheinstahl Rohr | Rheinische Rheinstahl Stahlrohr Import-Export GmbH | 10 | 0.680 | Rohr est contenu dans le composé Stahlrohr ; la contenance ne descend pas dans les composés allemands, et l'ouvrir rapproche tout composé de sa tête. |
| Vogel Kunststoff | Bayerische Vogel Kunststofftechnik Import-Export GmbH | 10 | 0.720 | Kunststoff est la tête du composé Kunststofftechnik ; même contenance, refusée dans les composés allemands. |
| Chinedu Phone Accessories Nigeria Limited | Chinedu Phones | 10 | 0.413 | Deux mots rares du long (Accessories, Nigeria) manquent au court ; faire passer un nom de deux mots dans un nom de cinq ouvrirait chaque « Chinedu » à tout Chinedu. |
| BG BAHARI MUTIARA 12 | bg bahrain mutiara 12 | 9 | 0.653 | Bahari corrigé en Bahrain par le téléphone est un autre mot, un nom de pays ; tenir une lettre ajoutée dans un mot rare pour une faute rapprocherait deux navires à une lettre près. |
| Petrakis Olive Oils Ltd | Petrakis Olive Oild Ltd | 8 | 0.750 | Oils/Oild est un mot court à une lettre près, une raison de douter par construction (Hong Da 1 / Hong Da 8) ; ouvrir les mots courts aux touches voisines ouvre les noms courts de navires. |
| EtsKoffietFreres | Ets Koffi et Freres | 16 | 0.601 | Le décollage suit les capitales et « et » en minuscules reste soudé à Koffi ; deviner un mot-outil dans un mot collé couperait Koffiet de plusieurs façons. |
| Ets Ouattara et Cie | EtsOuattaraetCie | 16 | 0.800 | Même « et » minuscule soudé (Ouattaraet) ; le décollage suit les capitales. |
| DAEGU HANKOOK FIBER CO | Daegu Hankook Fiber S.A. | 7 | 1.000 | « Co » seul n'annonce aucun registre (c'est aussi Company) et S.A. en annonce un ; un conflit exigerait de lire Co comme une forme, ce qu'il n'est pas. |
| AL KHAWANEEJ BLDG MAT TRDG LLC | Al Khawaneej Building Contracting L.L.C. | 14 | 0.857 | Les mots d'activité (materials trading, contracting) sont des génériques de poids faible face au nom rare ; c'est le poids des génériques, qui porte le rappel. |
| Tiwari Grain Traders | Tripathi Grain Traders | 13 | 0.615 | Tiwari et Tripathi sont deux noms d'une même lignée, pas deux graphies d'une même suite de lettres ; il faudrait une table des noms indiens équivalents, une convention et non une lecture. |
| Silver Dune Logistics FZCO | سيلفر ديون للخدمات اللوجستية ش.م.ح | 9 | 0.621 | Un nom anglais transcrit en arabe se lit par ses consonnes (silfr, dyun) et l'arabe ajoute « services » ; il faudrait retranscrire l'anglais vers l'arabe, une table dans l'autre sens que la méthode n'a pas. |
| Hekmat Zoghbi & Co. | Hikmat Zughbi and Company | 14 | 0.667 | Aucun marqueur arabe (article, filiation) ne libère les voyelles de ces deux mots ; les libérer sans marque rapprocherait tout mot d'un autre à une voyelle près, ce que le dictionnaire tient à part exprès (Marlin, Merlin). |
| Youssef Chaouki Négoce | Yusuf Shawqi Trading | 14 | 0.518 | Traduire « négoce » en trading a été essayé et a fait monter deux paires tenues à part ; retiré, et les prénoms restent sans marque arabe. |
| Uzoma Wholesale Trading | Uzoma Wholesome Trading | 10 | 0.530 | Wholesale et Wholesome sont deux mots du dictionnaire à une lettre près, deux mots par la règle (Marlin, Merlin), et le jeu 10 tient Supplies/Suppliers pour deux sociétés : les jeux se contredisent, aucune règle ne sert les deux. |
| Ibrahim Spare Parts | Ibrahim Spare Ports | 10 | 0.572 | Parts et Ports, deux mots du dictionnaire à une lettre près, deux mots par la règle ; l'autocorrection entre deux mots est ce que les jeux se contredisent à demander. |
| Nkechi General Store | Nkechi General Stone | 10 | 0.579 | Store et Stone, deux mots du dictionnaire à une lettre près, deux mots par la règle ; même contradiction des jeux. |
| Fletcher Bull Handling Pty Ltd | Fletcher Bulk Handling Pty Ltd | 13 | 0.606 | Bull et Bulk, deux mots du dictionnaire à une lettre près, deux mots par la règle ; même contradiction des jeux. |
| Harrington Miming Pty Ltd | Harrington Mining Pty Ltd | 13 | 0.481 | Miming et Mining, deux mots du dictionnaire à une lettre près, deux mots par la règle ; même contradiction des jeux. |
| Radcliffe Agri Experts Pty Ltd | Radcliffe Agri Exports Pty Ltd | 13 | 0.616 | Experts et Exports, deux mots du dictionnaire à une lettre près, deux mots par la règle ; même contradiction des jeux. |
| Kalo Panagiotis Crew Services | Kalopanagiotis Ship Services Ltd | 17 | 0.846 | Le nom soudé (Kalopanagiotis) porte presque tout le poids et Crew/Ship sont des génériques de poids faible ; c'est le poids des génériques, qui porte le rappel. |
| YANNOULAT0S TR0F0D0SIAI | Yannoulakis Trofodosiai O.E. | 17 | 0.818 | Les zéros de l'OCR corrigés, -atos et -akis sont deux suffixes grecs sur un même radical ; deux lettres dans un mot de onze restent une faute, et une table des suffixes serait une convention de l'auteur. |
| Akçakoca Güneşi (ex-Azov Lantern) | Azov Lanterns | 17 | 0.891 | L'ancien nom d'un seul côté est la même coque, et Lantern/Lanterns est le pluriel d'un générique sans signe de navire ; sans préfixe ni type, le pluriel ne sépare pas. |
| 株式会社西錦橋商事 代表取締役之印 | Nishikibashi Shoji K.K. | 19 | 0.442 | 西錦橋 se lit Nishi-nishiki-hashi kanji par kanji (西 nishi, 錦 nishiki, 橋 hashi) et « Nishikibashi » n'en garde que 錦橋 : une lecture de l'auteur que ni le kun ni l'on du 西 ne donnent, aucune table du monde ne l'écrit. |
| Nishikibashi Shouji | 西錦橋商事株式会社 | 19 | 0.442 | Même 西錦橋 lu Nishikibashi par l'auteur ; le sceau et le wāpuro (shouji) sont lus, le nom propre ne se rejoint pas. |
| IWAFUNE KAIUN KABUSHIKI KAISHA | IWAFUNE KAIUN SHOJI KABUSHIKI KAISHA | 19 | 0.884 | Un générique ajouté (« Shoji », trading) pèse peu à côté du nom rare, par le poids des génériques qui porte le rappel (voir Zia Trading Corporation). |
| OMIGAWA STEEL CORPORATION | OMIGAWA STEEL TRADING CORPORATION | 19 | 0.895 | Même générique ajouté (« Trading »), même poids des génériques. |
| Kotori Bulker | Kotori Bulkers | 19 | 0.902 | Bulker/Bulkers est le pluriel d'un générique du commerce sans préfixe ni type de navire devant le nom ; sans signe de navire, le pluriel ne sépare pas (voir Grand Coal Trader). |
| Lapis Highway | Lapis Highways | 19 | 0.903 | Highway/Highways, même pluriel d'un générique, sans signe de navire. |
| Lapis Highway (ex Glaucous Leader) | Glaucous Leaders | 19 | 0.908 | L'ancien nom d'un seul côté est la même coque, et Leader/Leaders est le pluriel d'un générique sans signe de navire (voir Akçakoca Güneşi). |
| Takanami Star | Takanami Stars | 19 | 0.917 | Star/Stars, même pluriel d'un générique, sans signe de navire (voir Kilindini Star). |
| Aozora Venture | Aozora Ventures | 19 | 0.958 | Venture/Ventures, même pluriel d'un générique, sans signe de navire. |
| SHIOMIDAI DENKI SEISAKUSHO KK | Shiomidai Electric Works Co., Ltd. | 19 | 0.657 | 製作所 (seisakusho) se traduit « Manufacturing » parce que le jeu 11 l'écrit ainsi (Kitazono Seisakusho, Kitazono Manufacturing) et le jeu 19 l'écrit « Works » : les jeux se contredisent, un seul lemme ne sert pas les deux. |
| hanulbit | Haneulbit Mfg. Co., Ltd. | 19 | 0.616 | Le u d'un clavardage pour le eu de la romanisation révisée vaut le crédit de la voyelle coréenne (0,9), et le seul mot du nom court le porte face à un générique orphelin (Mfg.) ; le lire à 1 rapprocherait ㅜ et ㅡ, deux voyelles. |
