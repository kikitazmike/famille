// « Qu'est-ce que je peux faire ? » : recettes possibles avec ce qu'on a (frigo, placard)
import { state } from './store.js';
import { CATEGORIES, infoArticle } from './catalogue.js';
import { sucreRecette } from './sucre.js';

const sansAccent = (x) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/’/g, "'").trim();
// Noms composés gardés en un seul mot (« pommes » ne doit pas couvrir « pommes de terre »)
const COMPOSES = [
  [/pommes? de terre|patates?/g, 'pdt'], [/lait de coco/g, 'laitcoco'], [/fromage blanc/g, 'fromageblanc'], [/fromage frais/g, 'fromagefrais'],
  [/pain de mie/g, 'paindemie'], [/petits? pois/g, 'petitpois'], [/haricots? verts?/g, 'haricotvert'], [/sauce tomate/g, 'saucetomate'],
  [/sauce soja/g, 'saucesoja'], [/fruits? rouges?/g, 'fruitrouge'], [/petit sale/g, 'petitsale'], [/poissons? panes?/g, 'poissonpane'],
  [/pates? a tartiner/g, 'patetartiner'], [/pates? feuilletees?|pates? brisees?|pates? sablees?/g, 'patetarte'], [/creme de marron/g, 'cremarron'], [/steaks?(?: haches?)?|viande hachee/g, 'boeuf'], [/pates? a pizza/g, 'patepizza']
];
// Mots qui précisent sans changer l'aliment (« blanc de poulet », « tomates concassées »)
const VIDES = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et', 'un', 'une', 'blanc', 'cuisse', 'escalope', 'filet', 'rape', 'frais', 'fraiche', 'fume', 'hache', 'boite', 'tranche', 'surgele', 'concasse', 'entier', 'demi', 'ecreme', 'gros', 'petit', 'grand', 'jeune', 'nouvelle', 'nouveau', 'bio', 'braiser', 'cube', 'corail', 'cuit', 'cru', 'sec', 'seche', 'olive', 'tournesol', 'gousse', 'paquet', 'pot', 'sachet']);
// Familles : un mot choisi couvre les autres de sa famille
const FAMILLES = [
  ['fromage', 'emmental', 'gruyere', 'comte', 'mozzarella', 'parmesan', 'raclette', 'cheddar', 'chevre', 'feta', 'camembert', 'brie', 'reblochon'],
  ['poisson', 'cabillaud', 'colin', 'merlu', 'lieu', 'saumon', 'truite', 'dorade', 'sole', 'thon'],
  ['viande', 'boeuf', 'porc', 'veau', 'agneau'],
  ['saucisse', 'chipolata', 'merguez', 'knack'],
  ['charcuterie', 'jambon', 'lardon', 'bacon', 'saucisson'],
  ['oignon', 'echalote'],
  ['pate', 'spaghetti', 'tagliatelle', 'penne', 'coquillette', 'macaroni', 'fusilli', 'nouille'],
  ['galette', 'tortilla', 'wrap'],
  ['volaille', 'poulet', 'dinde', 'canard']
];
const FAMILLE = new Map(); FAMILLES.forEach((f) => f.forEach((m) => FAMILLE.set(m, f[0])));
// Toujours supposés être à la maison
const BASES = /^(sel|poivre|huile|beurre|eau|epices?|herbes?|bouillon|thym|persil|laurier|basilic|ciboulette|coriandre|origan|romarin|menthe|curry|paprika|cannelle|muscade|curcuma|cumin|piment|gingembre|vinaigre|moutarde|sucre vanille|vanille|levure|maizena)\b/;
export const TEXTE_BASES = 'Sel, poivre, huile, beurre, épices, herbes et bouillon sont supposés être là.';

const pluriel = (m) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m);
function mots(nom) {
  let k = sansAccent(nom).replace(/[^a-z0-9' ]/g, ' ');
  COMPOSES.forEach(([re, v]) => { k = k.replace(re, v); });
  return k.split(/[\s']+/).map(pluriel).filter((m) => m && !VIDES.has(m));
}
const famille = (m) => FAMILLE.get(m) || null;
export const estBase = (nom) => BASES.test(sansAccent(nom));
// L'aliment choisi couvre-t-il cet ingrédient ?
export function couvre(choisi, ingredient) {
  const a = mots(choisi); const b = mots(ingredient);
  // Même mot, ou mot général qui couvre sa famille (« fromage » → emmental), ou l'inverse (emmental → « fromage »)
  return a.some((m) => b.some((x) => x === m || (famille(x) === m && FAMILLE.get(m) === m) || (famille(m) === x && FAMILLE.get(x) === x)));
}

// Liste d'aliments du menu : catalogue (nourriture) + ingrédients des recettes, par catégorie
const NON_ALIMENTAIRE = new Set(['Hygiène', 'Entretien', 'Maison et divers', 'Animaux', 'Boissons']);
export function alimentsProposes(dejaChoisis = []) {
  const pris = new Set(dejaChoisis.map((x) => sansAccent(x)));
  const vus = new Map();
  const ajoute = (nom) => {
    const n = (nom || '').trim(); if (!n || estBase(n) || n.length > 40) return;
    const k = mots(n).join(' '); if (!k || vus.has(k) || pris.has(sansAccent(n))) return;
    const inf = infoArticle(n); if (NON_ALIMENTAIRE.has(inf.categorie)) return;
    vus.set(k, { nom: n.charAt(0).toUpperCase() + n.slice(1), icone: inf.icone, categorie: inf.categorie });
  };
  CATEGORIES.forEach((c) => c.articles.forEach(([n]) => ajoute(n)));
  state.recettes.forEach((r) => (Array.isArray(r.ingredients) ? r.ingredients : []).forEach((x) => x && ajoute(x.nom)));
  const l = [...vus.values()];
  const ordre = [...CATEGORIES.map((c) => c.nom), 'Autres'];
  return ordre.map((cat) => ({ categorie: cat, icone: (CATEGORIES.find((c) => c.nom === cat) || { icone: '🛒' }).icone, articles: l.filter((a) => a.categorie === cat).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })) })).filter((g) => g.articles.length);
}

// « œufs, du jambon et du fromage » → ['Œufs', 'Jambon', 'Fromage']
export function lireAliments(texte) {
  return (texte || '').split(/\s*(?:,|;|\n|\bet\b|\bavec\b|\bplus\b)\s*/i)
    .map((x) => x.trim().replace(/^(?:des |du |de la |de l'|de l’|d'|d’|les |le |la |l'|l’|un |une |quelques |un peu de |un reste de |des restes de |reste de )/i, '').replace(/[.?!]+$/, '').trim())
    .filter((x) => /[\p{L}]/u.test(x) && x.length <= 40).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).slice(0, 30);
}
// Ajoute sans doublon (même aliment écrit autrement)
export function ajouterAliments(liste, nouveaux) {
  const l = [...liste]; const cles = new Set(l.map((x) => mots(x).join(' ') || sansAccent(x)));
  nouveaux.forEach((n) => { const k = mots(n).join(' ') || sansAccent(n); if (k && !cles.has(k)) { cles.add(k); l.push(n); } });
  return l.slice(0, 30);
}

// Recettes possibles, en 3 groupes, les moins sucrées d'abord
export function queFaire(choisis) {
  const res = { tout: [], peu: [], plus: [] };
  if (!choisis.length) return res;
  const rang = { vert: 0, orange: 1, rouge: 2 };
  state.recettes.forEach((r) => {
    const ing = (Array.isArray(r.ingredients) ? r.ingredients : []).filter((x) => x && typeof x.nom === 'string' && x.nom.trim() && !estBase(x.nom));
    if (!ing.length) return;
    const avec = []; const manque = [];
    ing.forEach((x) => { const c = choisis.find((ch) => couvre(ch, x.nom)); if (c) avec.push(x.nom); else manque.push({ nom: x.nom, q: x.q == null ? '' : String(x.q) }); });
    if (!avec.length) return;
    const s = sucreRecette(r);
    const item = { r, avec, manque, sucre: s, ordre: rang[s.niveau] ?? 1 };
    if (!manque.length) res.tout.push(item); else if (manque.length <= 2 && avec.length >= manque.length) res.peu.push(item); else if (avec.length >= 2 || avec.length / ing.length >= 0.4) res.plus.push(item);
  });
  const tri = (a, b) => a.manque.length - b.manque.length || a.ordre - b.ordre || a.sucre.total - b.sucre.total || b.avec.length - a.avec.length || a.r.nom.localeCompare(b.r.nom, 'fr');
  res.tout.sort(tri); res.peu.sort(tri); res.plus.sort((a, b) => b.avec.length / (b.avec.length + b.manque.length) - a.avec.length / (a.avec.length + a.manque.length) || tri(a, b));
  res.plus = res.plus.slice(0, 6);
  return res;
}

// Phrase courte pour la voix de la tablette
export function phraseQueFaire(res) {
  const noms = (l) => l.map((x) => x.r.nom);
  const enum_ = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`);
  if (res.tout.length) {
    const t = noms(res.tout).slice(0, 3);
    return `Tu peux faire ${enum_(t)}${res.tout.length > 3 ? `, et ${res.tout.length - 3} autre${res.tout.length > 4 ? 's' : ''}` : ''}.${res.peu.length ? ` Il manque peu de choses pour ${res.peu[0].r.nom}.` : ''}`;
  }
  if (res.peu.length) { const p = res.peu[0]; return `Rien de complet, mais pour ${p.r.nom} il manque juste ${enum_(p.manque.map((m) => m.nom.toLowerCase()))}.`; }
  if (res.plus.length) return `Il manque plusieurs choses. Le plus proche : ${res.plus[0].r.nom}.`;
  return 'Je ne trouve aucune recette avec ces ingrédients.';
}

// Choix gardés sur l'appareil (pratique pour revenir sur la page)
const CLE = 'famille-frigo';
export function lireChoix() { try { const v = JSON.parse(localStorage.getItem(CLE) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, 30) : []; } catch (e) { return []; } }
export function garderChoix(l) { try { localStorage.setItem(CLE, JSON.stringify(l.slice(0, 30))); } catch (e) { /* ignore */ } }
