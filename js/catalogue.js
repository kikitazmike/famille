import { state } from './store.js';

// Articles courants par catégorie, avec leur icône (émoji : seul visuel possible dans un menu déroulant)
export const CATEGORIES = [
  { nom: 'Fruits et légumes', icone: '🥕', articles: [['Ail', '🧄'], ['Ananas', '🍍'], ['Avocats', '🥑'], ['Bananes', '🍌'], ['Brocolis', '🥦'], ['Carottes', '🥕'], ['Champignons', '🍄'], ['Citrons', '🍋'], ['Clémentines', '🍊'], ['Concombre', '🥒'], ['Courgettes', '🥒'], ['Endives', '🥬'], ['Épinards', '🥬'], ['Fraises', '🍓'], ['Haricots verts', '🫛'], ['Kiwis', '🥝'], ['Oignons', '🧅'], ['Oranges', '🍊'], ['Pêches', '🍑'], ['Poireaux', '🥬'], ['Poires', '🍐'], ['Poivrons', '🫑'], ['Pommes', '🍎'], ['Pommes de terre', '🥔'], ['Raisin', '🍇'], ['Salade', '🥬'], ['Tomates', '🍅']] },
  { nom: 'Boulangerie', icone: '🥖', articles: [['Baguette', '🥖'], ['Biscottes', '🍞'], ['Brioche', '🍞'], ['Croissants', '🥐'], ['Pain', '🥖'], ['Pain au chocolat', '🥐'], ['Pain de mie', '🍞'], ['Pains au lait', '🥐']] },
  { nom: 'Crèmerie et œufs', icone: '🧀', articles: [['Beurre', '🧈'], ['Crème fraîche', '🥛'], ['Emmental râpé', '🧀'], ['Fromage', '🧀'], ['Fromage blanc', '🥛'], ['Gruyère', '🧀'], ['Lait', '🥛'], ['Mozzarella', '🧀'], ['Oeufs', '🥚'], ['Petits suisses', '🥛'], ['Yaourts', '🥛']] },
  { nom: 'Viandes et poissons', icone: '🥩', articles: [['Blanc de poulet', '🍗'], ['Jambon', '🥓'], ['Lardons', '🥓'], ['Poisson', '🐟'], ['Poulet', '🍗'], ['Saucisses', '🌭'], ['Saumon', '🐟'], ['Steaks hachés', '🥩'], ['Thon', '🐟']] },
  { nom: 'Épicerie salée', icone: '🍝', articles: [['Conserves', '🥫'], ['Farine', '🌾'], ['Lentilles', '🫘'], ['Pâtes', '🍝'], ['Petits pois', '🫛'], ['Riz', '🍚'], ['Sardines', '🐟'], ['Sauce tomate', '🥫'], ['Soupe', '🥣']] },
  { nom: 'Épices et condiments', icone: '🧂', articles: [['Bouillon cube', '🧂'], ['Cannelle', '🧂'], ['Curcuma', '🧂'], ['Curry', '🧂'], ['Herbes de Provence', '🌿'], ['Huile de tournesol', '🫒'], ["Huile d'olive", '🫒'], ['Ketchup', '🍅'], ['Mayonnaise', '🥚'], ['Moutarde', '🌭'], ['Muscade', '🧂'], ['Paprika', '🌶️'], ['Persil', '🌿'], ['Piment', '🌶️'], ['Poivre', '🧂'], ['Sel', '🧂'], ['Thym', '🌿'], ['Vinaigre', '🫙']] },
  { nom: 'Petit-déjeuner et sucré', icone: '☕', articles: [['Café', '☕'], ['Café en dosettes', '☕'], ['Céréales', '🥣'], ['Chocolat', '🍫'], ['Chocolat en poudre', '🍫'], ['Confiture', '🍯'], ['Miel', '🍯'], ['Nutella', '🍫'], ['Sucre', '🍬'], ['Thé', '🍵']] },
  { nom: 'Goûters et biscuits', icone: '🍪', articles: [['Barres de céréales', '🍫'], ['Biscuits', '🍪'], ['Bonbons', '🍬'], ['Compotes', '🍎'], ['Gâteaux', '🍰'], ['Goûters', '🍪'], ['Madeleines', '🧁'], ['Pâte à tartiner', '🍫']] },
  { nom: 'Apéro', icone: '🥜', articles: [['Biscuits apéro', '🥨'], ['Cacahuètes', '🥜'], ['Chips', '🍟'], ['Gâteaux apéro', '🥨'], ['Olives', '🫒'], ['Pistaches', '🥜'], ['Saucisson', '🥓'], ['Tomates cerises', '🍅']] },
  { nom: 'Boissons', icone: '🥤', articles: [['Bière', '🍺'], ['Coca', '🥤'], ['Eau', '💧'], ['Eau gazeuse', '💧'], ["Jus d'orange", '🧃'], ['Jus de pomme', '🧃'], ['Sirop', '🧃'], ['Vin', '🍷']] },
  { nom: 'Surgelés', icone: '🧊', articles: [['Frites surgelées', '🍟'], ['Glaces', '🍨'], ['Légumes surgelés', '🧊'], ['Pizza', '🍕'], ['Poisson pané', '🐟'], ['Surgelés', '🧊']] },
  { nom: 'Hygiène', icone: '🧴', articles: [['Aspirine', '💊'], ['Coton-tiges', '🧴'], ['Dentifrice', '🪥'], ['Déodorant', '🧴'], ['Gel douche', '🧴'], ['Mouchoirs', '🤧'], ['Papier toilette', '🧻'], ['Savon', '🧼'], ['Shampoing', '🧴']] },
  { nom: 'Entretien', icone: '🧽', articles: [['Éponges', '🧽'], ['Essuie-tout', '🧻'], ['Lessive', '🧺'], ['Liquide vaisselle', '🧽'], ['Pastilles lave-vaisselle', '🧽'], ['Produit ménager', '🧴'], ['Sacs poubelle', '🗑️']] },
  { nom: 'Maison et divers', icone: '🏠', articles: [['Allumettes', '🔥'], ['Ampoules', '💡'], ['Film alimentaire', '🎞️'], ['Papier aluminium', '🥡'], ['Piles', '🔋']] },
  { nom: 'Animaux', icone: '🐾', articles: [['Croquettes chat', '🐱'], ['Croquettes chien', '🐶'], ['Litière', '🐱']] }
];
export const CATALOGUE = CATEGORIES.flatMap((c) => c.articles.map(([n]) => n));

const cle = (x) => (x || '').trim().toLowerCase();
const sansAccent = (x) => cle(x).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
const INDEX = new Map();
CATEGORIES.forEach((c) => c.articles.forEach(([n, ic]) => INDEX.set(sansAccent(n), { icone: ic, categorie: c.nom })));
// Mots-clés pour les articles écrits à la main
const MOTS = [
  [/pomme de terre|patate/, '🥔', 'Fruits et légumes'], [/salade|laitue|chou/, '🥬', 'Fruits et légumes'], [/tomate/, '🍅', 'Fruits et légumes'], [/fruit|pomme|poire|peche|abricot|prune|cerise|melon|pasteque/, '🍎', 'Fruits et légumes'], [/legume|carotte|navet|radis|betterave|courge|potiron|aubergine/, '🥕', 'Fruits et légumes'],
  [/croissant|pain au|chocolatine|viennois/, '🥐', 'Boulangerie'], [/pain|baguette|ficelle/, '🥖', 'Boulangerie'],
  [/fromage|comte|camembert|brie|chevre|raclette|parmesan/, '🧀', 'Crèmerie et œufs'], [/oeuf/, '🥚', 'Crèmerie et œufs'], [/lait|creme|yaourt|yogourt|dessert lacte/, '🥛', 'Crèmerie et œufs'], [/beurre/, '🧈', 'Crèmerie et œufs'],
  [/poulet|dinde|volaille/, '🍗', 'Viandes et poissons'], [/boeuf|steak|viande|porc|veau|agneau|roti|cote/, '🥩', 'Viandes et poissons'], [/jambon|lardon|bacon|saucisson/, '🥓', 'Viandes et poissons'], [/poisson|saumon|thon|cabillaud|crevette|moule/, '🐟', 'Viandes et poissons'],
  [/epice|cumin|curry|paprika|poivre|sel|herbe|basilic|thym|origan|piment|muscade|cannelle|gingembre/, '🧂', 'Épices et condiments'], [/huile|vinaigre|sauce|ketchup|mayo|moutarde/, '🫙', 'Épices et condiments'],
  [/apero|chips|cacahuete|olive|crackers|tuc|pistache/, '🥨', 'Apéro'], [/gateau|biscuit|gouter|cookie|madeleine|brownie|gaufre|crepe/, '🍪', 'Goûters et biscuits'], [/bonbon|chocolat|nutella/, '🍫', 'Goûters et biscuits'],
  [/pate|spaghetti|nouille|riz|semoule|quinoa|lentille|haricot|conserve|soupe|farine/, '🍝', 'Épicerie salée'], [/cafe|the |infusion|cereale|confiture|miel|sucre/, '☕', 'Petit-déjeuner et sucré'],
  [/eau|jus|soda|coca|biere|vin|sirop|boisson|limonade/, '🥤', 'Boissons'], [/surgele|glace|congel/, '🧊', 'Surgelés'],
  [/shampo|savon|gel|dentifrice|brosse|deo|rasoir|coton|mouchoir|papier toilette|couche|creme solaire/, '🧴', 'Hygiène'], [/lessive|vaisselle|eponge|menage|javel|nettoy|poubelle|essuie/, '🧽', 'Entretien'],
  [/chat|chien|croquette|litiere|patee/, '🐾', 'Animaux'], [/pile|ampoule|bougie|alu|film|scotch/, '🏠', 'Maison et divers']
];
export function infoArticle(nom) {
  const k = sansAccent(nom);
  const ex = INDEX.get(k) || INDEX.get(k.replace(/s$/, '')) || INDEX.get(k + 's');
  if (ex) return ex;
  const m = MOTS.find(([re]) => re.test(k));
  return m ? { icone: m[1], categorie: m[2] } : { icone: '🛒', categorie: 'Autres' };
}
export const iconeArticle = (nom) => infoArticle(nom).icone;

// Propositions groupées par catégorie (catalogue + articles souvent ajoutés), sans ce qui est déjà à prendre
export function propositionsArticles(aPrendre) {
  const maj = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const dans = new Set(aPrendre.map((c) => sansAccent(c.nom)));
  const masques = new Set(state.habituels.filter((h) => h.masque).map((h) => sansAccent(h.cle)));
  const frequents = new Map(state.habituels.filter((h) => !h.masque && h.nb >= 2).map((h) => [sansAccent(h.cle), h]));
  const noms = new Map();
  CATEGORIES.forEach((c) => c.articles.forEach(([n, ic]) => { const k = sansAccent(n); if (!masques.has(k)) noms.set(k, { nom: n, icone: ic, categorie: c.nom, frequent: frequents.has(k) }); }));
  frequents.forEach((h, k) => { if (!noms.has(k)) { const inf = infoArticle(h.nom); noms.set(k, { nom: maj(h.nom), icone: inf.icone, categorie: inf.categorie, frequent: true }); } });
  const liste = [...noms.entries()].filter(([k]) => !dans.has(k)).map(([, v]) => v);
  const ordre = [...CATEGORIES.map((c) => c.nom), 'Autres'];
  return ordre.map((cat) => ({ categorie: cat, icone: (CATEGORIES.find((c) => c.nom === cat) || { icone: '🛒' }).icone, articles: liste.filter((a) => a.categorie === cat).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })) })).filter((g) => g.articles.length);
}
export const nbPropositions = (groupes) => groupes.reduce((n, g) => n + g.articles.length, 0);
// Options HTML du menu (avec groupes par catégorie)
export function optionsMenu(groupes, esc, plat = false) {
  const opt = (x) => `<option value="${esc(x.nom)}">${x.icone} ${esc(x.nom)}${x.frequent ? ' ★' : ''}</option>`;
  if (plat) return groupes.flatMap((g) => g.articles).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })).map(opt).join('');
  return groupes.map((g) => `<optgroup label="${esc(g.icone + ' ' + g.categorie)}">${g.articles.map((x) => `<option value="${esc(x.nom)}">${x.icone} ${esc(x.nom)}${x.frequent ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('');
}

// Menu des catégories : « Toutes » puis chaque catégorie qui a des propositions
export function optionsCategories(groupes, choix, esc) {
  return `<option value="" ${!choix ? 'selected' : ''}>📋 Toutes les catégories</option>${groupes.map((g) => `<option value="${esc(g.categorie)}" ${choix === g.categorie ? 'selected' : ''}>${esc(g.icone + ' ' + g.categorie)} (${g.articles.length})</option>`).join('')}`;
}
export function filtrerGroupes(groupes, choix) { const f = groupes.filter((g) => g.categorie === choix); return choix && f.length ? f : groupes; }
