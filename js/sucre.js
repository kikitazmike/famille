// Sucre : teneur des aliments et boissons courants, niveau 🟢🟠🔴, calcul des recettes, recherche Open Food Facts
// Valeurs moyennes en grammes de sucres pour 100 g (ou 100 ml pour les boissons). Ce sont des estimations.
import { state } from './store.js';

const sa = (x) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[’`]/g, "'").trim();

// [motif, sucre /100, type ('b' boisson, 'a' aliment), portion (g ou ml), libellé portion, naturel (fruit, légume, lait nature), poids d'une pièce]
// L'ordre compte : les plus précis d'abord (« coca zéro » avant « coca », « jus d'orange » avant « orange »).
const T = [
  // Boissons sans sucre
  [/\b(coca|pepsi|soda|fanta|sprite|orangina|schweppes|ice ?tea|limonade|oasis)\b.*\b(zero|light|sans sucres?)\b|\b(zero|light)\b.*\b(coca|pepsi|soda)/, 0, 'b', 330, 'une canette'],
  [/\beau\b(?!.*\b(sucree|aromatisee|de vie|de coco)\b)|\bperrier\b|\bbadoit\b|\bsan pellegrino\b|\bvittel\b|\bevian\b|\bcristaline\b|\bvolvic\b(?!.*(juicy|fruit))/, 0, 'b', 250, 'un verre'],
  [/\beau (aromatisee|sucree)\b|\bvolvic (juicy|fruit)/, 5, 'b', 330, 'une bouteille'],
  [/\b(cafe|expresso|espresso)\b(?!.*\b(sucre|latte|cappuccino|frappe|liegeois)\b)/, 0, 'b', 100, 'une tasse'],
  [/\b(the|tisane|infusion)\b(?!.*\b(glace|sucre)\b)/, 0, 'b', 250, 'une tasse'],
  [/\bcappuccino\b|\blatte\b|\bcafe au lait\b/, 4, 'b', 250, 'une tasse'],
  // Sodas et boissons sucrées
  [/\b(coca|pepsi|cola)\b/, 10.6, 'b', 330, 'une canette'],
  [/\bfanta\b/, 7.8, 'b', 330, 'une canette'], [/\bsprite\b|\b7 ?up\b/, 6.6, 'b', 330, 'une canette'],
  [/\borangina\b/, 9.4, 'b', 250, 'une bouteille'], [/\bschweppes\b|\btonic\b/, 8, 'b', 250, 'un verre'],
  [/\bice ?tea\b|\bthe glace\b|\bfuze ?tea\b/, 4.3, 'b', 330, 'une canette'], [/\boasis\b/, 7.8, 'b', 330, 'une canette'],
  [/\blimonade\b/, 9, 'b', 250, 'un verre'], [/\bsoda\b/, 10, 'b', 330, 'une canette'],
  [/\b(red ?bull|monster|boisson energisante)\b/, 11, 'b', 250, 'une canette'],
  [/\bsirop\b/, 9, 'b', 250, 'un verre dilué'],
  [/\bjus de raisin\b/, 15, 'b', 200, 'un verre'], [/\bjus de pomme\b/, 10, 'b', 200, 'un verre'],
  [/\bjus d'?orange\b|\bjus de fruits?\b|\bjus multi/, 9, 'b', 200, 'un verre'], [/\bjus de tomate\b/, 3, 'b', 200, 'un verre'],
  [/\bnectar\b/, 12, 'b', 200, 'un verre'], [/\bsmoothie\b/, 11, 'b', 250, 'une bouteille'], [/\bjus\b/, 9, 'b', 200, 'un verre'],
  [/\bkombucha\b/, 3, 'b', 330, 'une bouteille'],
  [/\bchocolat chaud\b|\bboisson chocolatee\b|\bnesquik\b|\bbanania\b|\bpoulain\b|\blait (au )?chocolat/, 9, 'b', 250, 'un bol'],
  [/\blait de coco\b/, 2, 'a', 100, '10 cl'],
  [/\blait (d'amande|d'avoine|de soja|de riz|vegetal)\b/, 3.5, 'b', 250, 'un verre'],
  [/^(?!.*\b(chocolat|cafe|concentre|riz au|pains? au|coco|amande|avoine|soja|fraise|banane)\b).*\blait\b/, 4.8, 'b', 250, 'un bol', true],
  [/\blait concentre\b/, 55, 'a', 20, 'une cuillère'],
  // Alcools
  [/\bbiere sans alcool\b/, 3, 'b', 250, 'un verre'], [/\bbiere\b|\bpanache\b/, 0.3, 'b', 250, 'un verre'],
  [/\bcidre\b/, 4.5, 'b', 250, 'un verre'], [/\bchampagne\b|\bcremant\b|\bmousseux\b/, 1.5, 'b', 125, 'une coupe'],
  [/\bvin (blanc )?(moelleux|liquoreux|doux)\b|\bmuscat\b|\bporto\b|\bmartini\b/, 10, 'b', 80, 'un verre'],
  [/\bvin\b|\brose\b/, 0.8, 'b', 125, 'un verre'], [/\bpastis\b|\bricard\b|\bwhisky\b|\bvodka\b|\brhum\b/, 0.2, 'b', 40, 'un verre'],
  [/\bliqueur\b|\bget 27\b|\bbaileys\b/, 30, 'b', 40, 'un verre'], [/\bcocktail\b|\bpunch\b|\bmojito\b|\bsangria\b/, 12, 'b', 200, 'un verre'],
  // Sucres et produits sucrés
  [/\bsans sucres? ajoutes?\b.*\bcompote\b|\bcompote\b.*\bsans sucres? ajoutes?\b/, 11, 'a', 100, 'une coupelle', true],
  [/\bcompote\b/, 15, 'a', 100, 'une coupelle'],
  [/\b(cafe|the|tisane|infusion)\b.*\bsucre/, 5, 'b', 100, 'une tasse avec un sucre'],
  [/\b(sucre|cassonade|vergeoise)\b/, 100, 'a', 5, 'un morceau'], [/\bmiel\b/, 82, 'a', 10, 'une cuillère'],
  [/\b(confiture|gelee|marmelade)\b/, 55, 'a', 20, 'une tartine'],
  [/\b(nutella|pate a tartiner)\b/, 56, 'a', 15, 'une tartine'], [/\bsirop d'erable\b|\bsirop d'agave\b/, 65, 'a', 15, 'une cuillère'],
  [/\bchocolat noir\b|\bchocolat (a|au) (70|85)/, 28, 'a', 20, 'deux carrés'], [/\bchocolat blanc\b/, 58, 'a', 20, 'deux carrés'],
  [/\bchocolat au lait\b|\bkinder\b|\bbarre chocolatee\b|\bmars\b|\bsnickers\b|\btwix\b|\bbounty\b|\bkitkat\b/, 52, 'a', 40, 'une barre'],
  [/\bpain au chocolat\b|\bchocolatine\b/, 13, 'a', 70, 'un pain au chocolat', false, 70],
  [/\bmousse au chocolat\b/, 25, 'a', 100, 'une coupelle'],
  [/\bchocolat\b/, 45, 'a', 20, 'deux carrés'],
  [/\b(bonbons?|confiseries?|guimauves?|marshmallow|caramels?|haribo|dragees?|sucettes?)\b/, 60, 'a', 30, 'une poignée'],
  [/\b(glaces?|sorbets?|esquimaux?|crème glacee|magnum)\b/, 22, 'a', 100, 'deux boules'],
  [/\b(gateau|cake|brownie|quatre[- ]quarts|fondant|muffin|cupcake)\b/, 35, 'a', 80, 'une part'],
  [/\btarte\b(?!.*\b(salee|poireaux?|thon|tomates?|flamb)\b)/, 20, 'a', 120, 'une part'], [/\btiramisu\b/, 20, 'a', 100, 'une part'],
  [/\b(flan|creme dessert|danette|creme brulee|creme caramel|ile flottante|riz au lait)\b/, 17, 'a', 115, 'un pot'],
  [/\b(madeleines?|cookies?|biscuits?|petits? beurres?|gaufrettes?|sables?|palmiers?|prince|bn|pepito|speculoos)\b/, 30, 'a', 30, 'trois biscuits'],
  [/\b(gaufres?)\b/, 20, 'a', 60, 'une gaufre', false, 60], [/\b(crepes?)\b/, 10, 'a', 60, 'une crêpe', false, 60],
  [/\b(croissants?)\b/, 10, 'a', 60, 'un croissant', false, 60], [/\b(brioches?|pains? au lait|viennoiseries?)\b/, 15, 'a', 50, 'une tranche'],
  [/\b(cereales?|corn flakes|chocapic|tresor|special k|frosties)\b/, 25, 'a', 40, 'un bol'], [/\bmuesli\b|\bgranola\b/, 20, 'a', 50, 'un bol'],
  [/\byaourts? (a boire|aux fruits|sucres?|aromatises?)\b|\bfruits? mixes?\b|\bdanonino\b|\bpetits? suisses? sucres?/, 13, 'a', 125, 'un pot'],
  [/\b(yaourts?|yogourts?|fromage blanc|faisselle|skyr|petits? suisses?)\b/, 4, 'a', 125, 'un pot', true],
  [/\bketchup\b/, 22, 'a', 15, 'une cuillère'], [/\bsauce (barbecue|bbq|aigre[- ]douce|teriyaki)\b/, 30, 'a', 15, 'une cuillère'],
  [/\bsauce tomate\b|\bcoulis\b|\bpulpe de tomates?\b|\bpassata\b/, 5, 'a', 100, 'une portion', true, 420],
  [/\btomates? (concassees|pelees)\b/, 4, 'a', 100, 'une portion', true, 400],
  [/\bvinaigrette\b|\bsauce salade\b/, 6, 'a', 15, 'une cuillère'], [/\bmayonnaise\b|\bmayo\b/, 1, 'a', 15, 'une cuillère'],
  [/\bmoutarde\b/, 2, 'a', 10, 'une cuillère'], [/\bsauce soja\b/, 5, 'a', 10, 'une cuillère'],
  // Fruits (sucre naturel)
  [/\bfruits? secs?\b|\braisins? secs?\b|\bdattes?\b|\bfigues? seches?\b|\bpruneaux?\b|\babricots? secs?\b/, 60, 'a', 30, 'une poignée', true],
  [/\bbananes?\b/, 17, 'a', 120, 'une banane', true, 120], [/\braisins?\b/, 16, 'a', 125, 'une grappe', true],
  [/\bmangues?\b/, 14, 'a', 150, 'une demi-mangue', true, 300], [/\bcerises?\b/, 13, 'a', 125, 'une poignée', true],
  [/\bfigues?\b/, 16, 'a', 50, 'une figue', true, 50], [/\bpommes?\b(?! de terre)/, 11, 'a', 150, 'une pomme', true, 150],
  [/\bpoires?\b/, 10, 'a', 150, 'une poire', true, 150], [/\bananas\b/, 10, 'a', 150, 'une tranche épaisse', true, 1000],
  [/\b(clementines?|mandarines?)\b/, 9, 'a', 70, 'une clémentine', true, 70], [/\boranges?\b/, 9, 'a', 150, 'une orange', true, 150],
  [/\bkiwis?\b/, 9, 'a', 75, 'un kiwi', true, 75], [/\b(peches?|nectarines?|brugnons?)\b/, 9, 'a', 150, 'une pêche', true, 150],
  [/\babricots?\b/, 9, 'a', 45, 'un abricot', true, 45], [/\bprunes?\b|\bmirabelles?\b/, 10, 'a', 30, 'une prune', true, 30],
  [/\bmelons?\b/, 8, 'a', 200, 'une tranche', true, 1000], [/\bpasteques?\b/, 7, 'a', 250, 'une tranche', true],
  [/\b(fraises?|framboises?|myrtilles?|mures?|groseilles?|fruits rouges)\b/, 5, 'a', 125, 'une barquette', true],
  [/\b(citrons?|citrons? verts?)\b/, 2.5, 'a', 100, 'un citron', true, 100], [/\bavocats?\b/, 0.7, 'a', 100, 'un demi-avocat', true, 200],
  [/\bfruits?\b/, 10, 'a', 150, 'un fruit', true, 150],
  // Légumes (sucre naturel)
  [/\bpommes? de terre\b|\bpatates?\b(?! douces?)/, 0.8, 'a', 200, 'une portion', true, 150], [/\bpatates? douces?\b/, 4.2, 'a', 200, 'une portion', true, 250],
  [/\bcarottes?\b/, 5, 'a', 100, 'une portion', true, 100], [/\bbetteraves?\b/, 7, 'a', 100, 'une portion', true, 150],
  [/\btomates?\b/, 3, 'a', 120, 'une tomate', true, 120], [/\boignons?\b|\becha?lotes?\b/, 5, 'a', 100, 'un oignon', true, 100],
  [/\bpoivrons?\b/, 4, 'a', 150, 'un poivron', true, 150], [/\bmais\b/, 4, 'a', 100, 'une portion', true, 285],
  [/\bpetits? pois\b/, 4, 'a', 150, 'une portion', true, 400], [/\bpoireaux?\b/, 3, 'a', 200, 'un poireau', true, 200],
  [/\bnavets?\b/, 3, 'a', 150, 'un navet', true, 150], [/\bcourges?\b|\bpotirons?\b|\bbutternut\b|\bcitrouilles?\b/, 3, 'a', 200, 'une portion', true, 1000],
  [/\bcourgettes?\b|\baubergines?\b/, 2.5, 'a', 200, 'une portion', true, 250], [/\bconcombres?\b/, 1.7, 'a', 100, 'une portion', true, 300],
  [/\bharicots? verts?\b/, 2, 'a', 150, 'une portion', true], [/\bharicots? rouges?\b|\blentilles?\b|\bpois chiches?\b|\bflageolets?\b/, 1, 'a', 150, 'une portion', true, 400],
  [/\b(salades?|laitues?|mache|roquette|epinards?|endives?|chou|choux|brocolis?|chou[- ]fleur|celeri|asperges?|radis|haricots?)\b/, 1.5, 'a', 150, 'une portion', true, 300],
  [/\bchampignons?\b/, 0.5, 'a', 100, 'une portion', true], [/\bail\b/, 1, 'a', 5, 'une gousse', true, 5],
  [/\bsoupe\b|\bvelout/, 2, 'a', 250, 'un bol'],
  // Féculents, pains
  [/\bpain de mie\b/, 6, 'a', 50, 'deux tranches', false, 25], [/\bpain d'epices?\b/, 45, 'a', 30, 'une tranche'],
  [/\bpain\b|\bbaguette\b|\bbiscottes?\b/, 3, 'a', 50, 'un morceau'],
  [/\bfrites?\b/, 0.5, 'a', 150, 'une portion'], [/\bchips\b/, 1, 'a', 30, 'un bol'],
  [/\bpates? (a pizza|brisee|feuilletee|sablee)\b/, 2, 'a', 50, 'une part', false, 230],
  [/\bpates?\b|\bspaghettis?\b|\bnouilles?\b|\btagliatelles?\b|\blasagnes?\b|\bcoquillettes?\b|\bmacaronis?\b/, 2, 'a', 100, 'une assiette', true, 500],
  [/\briz\b|\bsemoule\b|\bboulgour\b|\bquinoa\b|\bfarine\b|\bpolenta\b/, 0.5, 'a', 80, 'une portion', true],
  // Produits laitiers, matières grasses
  [/\bcreme (fraiche|liquide|epaisse)\b|\bcreme\b/, 3, 'a', 30, 'une cuillère'], [/\bbeurre\b/, 0.6, 'a', 10, 'une noix'],
  [/\b(fromages?|emmental|gruyere|comte|parmesan|mozzarella|reblochon|raclette|camembert|brie|chevre|feta|cantal)\b/, 0.5, 'a', 30, 'une portion', true, 125],
  [/\boeufs?\b/, 0.5, 'a', 60, 'un œuf', true, 60], [/\bhuiles?\b/, 0, 'a', 10, 'une cuillère'],
  // Viandes, poissons, plats
  [/\b(jambon|lardons?|bacon|saucisses?|saucissons?|charcuteries?|chorizo|pate|rillettes)\b/, 1, 'a', 50, 'une portion', false, 40],
  [/\b(poulets?|dinde|boeuf|veau|porc|agneau|steaks?|viandes?|canard|roti|escalopes?|cotes?|blanc de poulet|hache)\b/, 0, 'a', 150, 'une portion', false, 125],
  [/\b(poissons?|saumon|thon|cabillaud|colin|crevettes?|moules?|sardines?|maquereaux?|truite)\b/, 0, 'a', 150, 'une portion', false, 125],
  [/\bpizzas?\b/, 4, 'a', 300, 'une demi-pizza'], [/\bquiches?\b|\btartes? salees?\b/, 2, 'a', 150, 'une part'],
  [/\b(hamburgers?|burgers?|cheeseburgers?)\b/, 6, 'a', 200, 'un burger'], [/\bkebabs?\b|\btacos\b/, 3, 'a', 300, 'un kebab'],
  [/\bsushis?\b|\bmakis?\b/, 5, 'a', 200, 'une portion'],
  // Épices, bouillons
  [/\b(sel|poivre|curry|paprika|cumin|muscade|thym|laurier|herbes?|persil|basilic|epices?|bouillon|cubes?)\b/, 0, 'a', 2, 'une pincée', false, 10],
  [/\bolives?\b|\bcornichons?\b|\bcapres\b/, 0.5, 'a', 30, 'une poignée']
];

// Seuils (étiquetage nutritionnel « feux tricolores ») et limite conseillée : 25 g de sucres ajoutés par jour
export const LIMITE_JOUR = 25;
const SEUILS = { a: [5, 22.5], b: [2.5, 11.25] };
export const COULEUR = { vert: '#2E9E5B', orange: '#E08A1E', rouge: '#D3392F' };
export const EMOJI = { vert: '🟢', orange: '🟠', rouge: '🔴' };

export function niveau(s100, type, portion, naturel) {
  const [bas, haut] = SEUILS[type] || SEUILS.a;
  const parPortion = s100 * (portion || 100) / 100;
  let n = s100 > haut || parPortion > 13.5 ? 'rouge' : s100 <= bas && parPortion <= 5 ? 'vert' : 'orange';
  if (naturel && n === 'rouge') n = 'orange'; // sucre naturel des fruits entiers, légumes, lait nature
  return n;
}

// Aliment ou boisson connu ? → { nom, s100, type, portion, libelle, naturel, piece, niveau }
const cache = new Map();
export function infoSucre(nom) {
  const k = sa(nom); if (!k) return null;
  if (cache.has(k)) return cache.get(k);
  const e = T.find(([re]) => re.test(k));
  const r = e ? { nom, s100: e[1], type: e[2], portion: e[3], libelle: e[4], naturel: !!e[5], piece: e[6] || null } : null;
  if (r) r.niveau = niveau(r.s100, r.type, r.portion, r.naturel);
  cache.set(k, r); return r;
}

// Quantité d'un ingrédient en grammes (ou ml) : « 500 g », « 20 cl », « 1 L », « 3 », « 2 boîtes », « 4 tranches »
const CONTENANT = { boite: 400, boites: 400, pot: 420, pots: 420, paquet: 500, paquets: 500, brique: 200, briques: 200, sachet: 10, sachets: 10, tranche: 30, tranches: 30, gousse: 5, gousses: 5, 'c. a soupe': 15, 'c. a cafe': 5, 'c. a s.': 15, 'c. a c.': 5, cuillere: 15, cuilleres: 15, pincee: 1, pincees: 1, verre: 200, verres: 200, bol: 250, pave: 125, paves: 125 };
function grammes(q, info) {
  const t = sa(q); if (!t) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/); if (!m) return null;
  let v = parseFloat(m[1].replace(',', '.')); if (m[2]) v /= Number(m[2]);
  const u = m[3].trim();
  if (/^(kg|kilos?)\b/.test(u)) return v * 1000;
  if (/^(g|gr|grammes?)\b/.test(u)) return v;
  if (/^(l|litres?)\b/.test(u)) return v * 1000;
  if (/^cl\b/.test(u)) return v * 10;
  if (/^dl\b/.test(u)) return v * 100;
  if (/^ml\b/.test(u)) return v;
  const c = Object.keys(CONTENANT).find((x) => u.startsWith(x));
  if (c) {
    if ((c.startsWith('tranche')) && info && info.piece) return v * info.piece;
    if ((c.startsWith('boite') || c.startsWith('pot') || c.startsWith('paquet')) && info && info.piece && info.piece >= 200) return v * info.piece;
    return v * CONTENANT[c];
  }
  if (!u || /^(pieces?|unites?)\b/.test(u)) return v * ((info && info.piece) || 100);
  return null;
}

// Sucre d'une recette par portion → { total, ajoute, niveau, inconnus }
export function sucreRecette(r, pers) {
  const p = Math.max(1, Number(r.personnes) || 4);
  let total = 0; let ajoute = 0; const inconnus = [];
  (Array.isArray(r.ingredients) ? r.ingredients : []).forEach((x) => {
    if (!x || typeof x.nom !== 'string') return;
    const info = infoSucre(x.nom);
    if (!info) { inconnus.push(x.nom); return; }
    const g = grammes(x.q == null ? '' : String(x.q), info);
    if (g == null) { if (info.s100 >= 10) inconnus.push(x.nom); return; }
    const s = g * info.s100 / 100; total += s; if (!info.naturel) ajoute += s;
  });
  total /= p; ajoute /= p;
  const n = ajoute > 13.5 || total > LIMITE_JOUR ? 'rouge' : ajoute <= 5 && total <= 15 ? 'vert' : 'orange';
  return { total: Math.round(total), ajoute: Math.round(ajoute), niveau: n, inconnus, pers: pers || p };
}

// ---------- Open Food Facts (produits de marque) ----------
const CLE_OFF = 'famille-off';
function lireOff() { try { const o = JSON.parse(localStorage.getItem(CLE_OFF) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
export async function chercherOff(nom) {
  const k = sa(nom); if (!k) return null;
  const c = lireOff(); if (c[k] !== undefined) return c[k];
  if (!navigator.onLine) return null;
  const ctl = new AbortController(); const minut = setTimeout(() => ctl.abort(), 8000);
  try {
    const u = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(nom.slice(0, 80))}&search_simple=1&action=process&json=1&page_size=10&lc=fr&cc=fr&fields=product_name,product_name_fr,brands,nutriments,categories_tags,quantity`;
    const r = await fetch(u, { signal: ctl.signal }); if (!r.ok) return null;
    const d = await r.json();
    const p = (d.products || []).find((x) => x && x.nutriments && typeof x.nutriments.sugars_100g === 'number');
    let res = null;
    if (p) {
      const boisson = (p.categories_tags || []).some((t) => /beverages|boissons|drinks|sodas|juices/.test(t));
      const s100 = Math.round(p.nutriments.sugars_100g * 10) / 10;
      const portion = boisson ? 250 : 100;
      res = { nom: String(p.product_name_fr || p.product_name || nom).slice(0, 80), marque: String(p.brands || '').split(',')[0].slice(0, 40), s100, type: boisson ? 'b' : 'a', portion, libelle: boisson ? 'un verre (25 cl)' : '100 g', naturel: false, source: 'off' };
      res.niveau = niveau(s100, res.type, portion, false);
    }
    c[k] = res; const cles = Object.keys(c); if (cles.length > 150) delete c[cles[0]];
    try { localStorage.setItem(CLE_OFF, JSON.stringify(c)); } catch (e) { /* ignore */ }
    return res;
  } catch (e) { return null; } finally { clearTimeout(minut); }
}

// ---------- Réponse « est-ce bon pour moi ? » ----------
const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const VERDICT = {
  vert: 'Oui, c\'est bon côté sucre.',
  orange: 'Avec modération.',
  rouge: 'À éviter, ou très occasionnellement.'
};
export function phraseAliment(i) {
  const unite = i.type === 'b' ? '100 ml' : '100 g';
  const parPortion = i.s100 * i.portion / 100;
  const titre = i.marque ? i.nom + ' (' + i.marque + ')' : majuscule(i.nom);
  if (!i.s100) return `${titre} : ${VERDICT.vert} Pas de sucre.`;
  let t = `${titre} : ${VERDICT[i.niveau]} Environ ${fmt(i.s100)} g de sucre pour ${unite}`;
  if (i.portion && i.portion !== 100) t += `, soit ${fmt(parPortion)} g pour ${i.libelle}`;
  t += '.';
  if (i.naturel && i.niveau !== 'vert') t += ' C\'est du sucre naturel, mieux qu\'un sucre ajouté.';
  if (i.niveau === 'rouge' && !i.naturel) t += ` Ta limite conseillée est de ${LIMITE_JOUR} g de sucres ajoutés par jour.`;
  if (i.niveau === 'rouge' && i.type === 'b') t += ' Prends plutôt de l\'eau, de l\'eau pétillante ou une version zéro.';
  return t;
}
export function phraseRecette(r, s) {
  let t = `${r.nom} : ${VERDICT[s.niveau]} Environ ${s.total} g de sucre par portion`;
  t += s.ajoute ? `, dont ${s.ajoute} g de sucre ajouté.` : ', sans sucre ajouté.';
  if (s.inconnus.length) t += ` Je ne connais pas tous les ingrédients (${s.inconnus.slice(0, 3).join(', ')}).`;
  return t;
}
const majuscule = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);

// Cherche une recette, puis la liste intégrée, puis Open Food Facts → { texte, niveau }
export async function avisSucre(nom) {
  const k = sa(nom);
  const rec = (state.recettes || []).find((r) => sa(r.nom) === k) || (state.recettes || []).find((r) => k.length >= 4 && (sa(r.nom).startsWith(k) || k.startsWith(sa(r.nom))));
  if (rec) { const s = sucreRecette(rec); return { texte: phraseRecette(rec, s), niveau: s.niveau }; }
  const i = infoSucre(nom);
  if (i) return { texte: phraseAliment({ ...i, nom }), niveau: i.niveau };
  const o = await chercherOff(nom);
  if (o) return { texte: phraseAliment(o) + ' (d\'après Open Food Facts)', niveau: o.niveau };
  return { texte: navigator.onLine ? `Je ne trouve pas « ${nom} ». Essaie avec un autre nom.` : `Je ne connais pas « ${nom} », et sans Internet je ne peux pas chercher.`, niveau: null };
}

// Petite pastille ronde pour les listes
export function pastilleSucre(n, titre) {
  if (!n) return '';
  return `<span class="sucre-pt" style="background:${COULEUR[n]}" title="${titre || 'Sucre : ' + (n === 'vert' ? 'peu' : n === 'orange' ? 'moyen' : 'élevé')}" aria-label="Sucre ${n === 'vert' ? 'faible' : n === 'orange' ? 'moyen' : 'élevé'}"></span>`;
}
