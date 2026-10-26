// Recettes et repas prévus (avec ou sans jour), communs au téléphone et à la tablette
import { state, ecrire, nouvelId } from './store.js';

export const TAGS = [['rapide', 'Rapide'], ['dimanche', 'Plat du dimanche'], ['cookeo', 'Cookeo'], ['companion', 'Companion']];
export const ICONES_RECETTE = ['🍝', '🍲', '🍛', '🥔', '🧀', '🍗', '🥩', '🐟', '🍕', '🥧', '🥗', '🥣', '🌶️', '🍚', '🥪', '🥚', '🥞', '🍫', '🍰', '🍽️'];

const sansAccent = (x) => (x || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
export const cleNom = sansAccent;
const pad = (n) => String(n).padStart(2, '0');
export const isoJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const recettesTriees = () => [...state.recettes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
export const recette = (id) => state.recettes.find((r) => r.id === id) || null;
export function chercherRecette(texte) {
  const k = sansAccent(texte); if (!k) return null;
  const l = recettesTriees();
  return l.find((r) => sansAccent(r.nom) === k) || l.find((r) => sansAccent(r.nom).startsWith(k)) || l.find((r) => sansAccent(r.nom).includes(k)) || l.find((r) => k.includes(sansAccent(r.nom))) || null;
}
export const repasAFaire = () => state.repas.filter((r) => !r.fait && recette(r.recette_id)).sort((a, b) => ((a.jour || '9') < (b.jour || '9') ? -1 : (a.jour || '9') > (b.jour || '9') ? 1 : (a.created_at < b.created_at ? -1 : 1)));
export const repasDuJour = (jourIso) => repasAFaire().filter((r) => r.jour === jourIso);

// Quantité adaptée au nombre de personnes : « 500 g » pour 4 → « 750 g » pour 6
// Unités de mesure (le reste se compte : œufs, boîtes, tranches… → arrondi au supérieur)
const MESURE = /^\s*(g|gr|grammes?|kg|kilos?|mg|cl|ml|dl|l|litres?|c\.?\s*(à|a)\s*[sc]\.?|cuill\S*|pinc\S*|tasses?|verres?|bols?|filets?|traits?|noix|zestes?|brins?|bottes?|%)(?![a-zà-ÿ])/i;
export function quantite(q, base, pers) {
  if (!q || !base || base === pers) return q || '';
  const f = pers / base;
  const reste0 = q.replace(/^\s*[\d.,/\s\-–à]+/, '');
  const compte = !MESURE.test(reste0);
  const fmt = (v) => { if (compte) return String(Math.max(1, Math.ceil(v - 1e-9))); v = v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100; return String(v).replace('.', ','); };
  const nb = (x) => parseFloat(x.replace(',', '.'));
  // Nombre mixte « 1 1/2 »
  let m = q.match(/^\s*(\d+)\s+(\d+)\s*\/\s*(\d+)(.*)$/);
  if (m && Number(m[3])) return `${fmt((Number(m[1]) + Number(m[2]) / Number(m[3])) * f)}${m[4]}`;
  // Fraction « 1/2 kg »
  m = q.match(/^\s*(\d+)\s*\/\s*(\d+)(.*)$/);
  if (m && Number(m[2])) return `${fmt(Number(m[1]) / Number(m[2]) * f)}${m[3]}`;
  // Fourchette « 2-3 » ou « 2 à 3 »
  m = q.match(/^\s*(\d+(?:[.,]\d+)?)\s*(-|–|à)\s*(\d+(?:[.,]\d+)?)(.*)$/);
  if (m) { const a = fmt(nb(m[1]) * f); const b = fmt(nb(m[3]) * f); return a === b ? `${a}${m[4]}` : `${a}${m[2] === 'à' ? ' à ' : '-'}${b}${m[4]}`; }
  m = q.match(/^\s*(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return q;
  return `${fmt(nb(m[1]) * f)}${m[2]}`;
}
// Ingrédients d'une recette, avec indication « déjà dans la liste »
export function ingredients(r, pers) {
  const dans = new Set(state.courses.filter((c) => !c.pris).map((c) => sansAccent(c.nom)));
  return (Array.isArray(r.ingredients) ? r.ingredients : []).map((x, k) => ({ x, k })).filter(({ x }) => x && typeof x.nom === 'string' && x.nom.trim())
    .map(({ x, k }) => ({ k, nom: x.nom.slice(0, 120), q: quantite(x.q == null ? '' : String(x.q).slice(0, 60), r.personnes, pers || r.personnes), dans: dans.has(sansAccent(x.nom)) }));
}
// Articles pas encore dans la liste (sans tenir compte des majuscules, accents ou pluriel simple)
// On garde les accents (« pâté » ≠ « pâtes ») mais pas les majuscules ni le pluriel simple
const cleArticle = (x) => (x || '').trim().toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/\s+/g, ' ').replace(/s$/, '');
export function sansDoublons(noms) {
  const dans = new Set(state.courses.filter((c) => !c.pris).map((c) => cleArticle(c.nom)));
  const nouveaux = []; const deja = [];
  for (const n of noms) { const k = cleArticle(n); if (!k) continue; if (dans.has(k)) deja.push(n); else { dans.add(k); nouveaux.push(n); } }
  return { nouveaux, deja };
}
export const dejaDansListe = (nom) => sansDoublons([nom]).deja.length > 0;
// Ajoute des ingrédients aux courses (sans doublon avec ce qui est déjà à prendre)
export function opsCourses(liste, source, auteur) {
  const dans = new Set(state.courses.filter((c) => !c.pris).map((c) => cleArticle(c.nom)));
  const vus = new Map(); const ops = [];
  for (const x of liste) {
    const k = cleArticle(x.nom); if (!k || dans.has(k)) continue;
    // Même ingrédient venant de deux recettes : on additionne (même unité) ou on met bout à bout
    if (vus.has(k)) { const l = vus.get(k).ligne; l.quantite = additionner(l.quantite, x.q ? String(x.q) : '') || null; continue; }
    ops.push({ cle: 'courses', op: 'insert', ligne: { id: nouvelId(), nom: x.nom.slice(0, 120), quantite: x.q ? String(x.q).slice(0, 60) : null, source, ajoute_par: auteur, pris: false, created_at: new Date().toISOString() } });
    vus.set(k, ops[ops.length - 1]);
  }
  return ops;
}
export function additionner(a, b) {
  if (!a) return b ? b.slice(0, 60) : ''; if (!b) return a;
  const re = /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/; const ma = a.match(re); const mb = b.match(re);
  if (ma && mb && ma[2].trim().toLowerCase().replace(/s$/, '') === mb[2].trim().toLowerCase().replace(/s$/, '')) {
    const v = Math.round((parseFloat(ma[1].replace(',', '.')) + parseFloat(mb[1].replace(',', '.'))) * 100) / 100;
    return `${String(v).replace('.', ',')}${ma[2] ? (/^\s/.test(a.slice(ma[1].length)) ? ' ' : '') + ma[2].trim() : ''}`.slice(0, 60);
  }
  return `${a} + ${b}`.slice(0, 60);
}
export function prevoir(recetteId, jour, pers, auteur) {
  return ecrire({ cle: 'repas', op: 'insert', ligne: { id: nouvelId(), recette_id: recetteId, jour: jour || null, personnes: pers, fait: false, ajoute_par: auteur, created_at: new Date().toISOString() } });
}
// Tous les ingrédients des repas à cuisiner, fusionnés
export function ingredientsAFaire() {
  const m = new Map();
  repasAFaire().forEach((p) => { const r = recette(p.recette_id); if (!r) return; ingredients(r, p.personnes).filter((x) => !x.dans).forEach((x) => {
    const k = cleArticle(x.nom); if (m.has(k)) { const y = m.get(k); y.q = additionner(y.q, x.q); } else m.set(k, { ...x });
  }); });
  return [...m.values()];
}
// « Nom, quantité » ou « Nom - quantité » par ligne → [{nom, q}]
export function lireIngredients(texte) {
  return (texte || '').split(/\n|;/).map((l) => l.trim()).filter((l) => /[\p{L}\p{N}]/u.test(l)).map((l) => {
    const m = l.match(/^(.+?)\s*(?:,|\s-\s|:)\s*(.+)$/);
    let nom = (m ? m[1] : l).trim(); let q = m ? m[2].trim() : '';
    // Quantité écrite devant : « 2 tomates », « 1/2 kg de farine », « 200 g de beurre »
    const d = !m && nom.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(g|gr|kg|mg|cl|ml|dl|l|litres?|c\.?\s*(?:à|a)\s*[sc]\.?|cuill[eè]res?\s+(?:à|a)\s+(?:soupe|café)|pincées?|sachets?|boîtes?|tranches?|gousses?|pots?|briques?|paquets?)?\s+(?:de\s+|d')?(.+)$/i);
    if (d && !/^(g|gr|kg|mg|cl|ml|dl|l|litres?)$/i.test(d[3].trim())) { q = d[2] ? `${d[1]} ${d[2]}` : d[1]; nom = d[3]; }
    nom = nom.slice(0, 120); q = q.slice(0, 60);
    return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), q };
  }).filter((x) => /[\p{L}\p{N}]/u.test(x.nom)).slice(0, 60);
}
// Dictée « hachis parmentier : pommes de terre, bœuf haché, lait »
export function lireDictee(t) {
  const m = (t || '').match(/^(.+?)\s*(?::|avec|il faut)\s*(.+)$/i);
  if (!m) return null;
  return { nom: m[1].trim().replace(/^(recette|nouvelle recette)\s*/i, ''), ingredients: m[2].split(/\s*(?:,|\bet\b)\s*/).map((n) => n.trim()).filter(Boolean).map((n) => ({ nom: n.charAt(0).toUpperCase() + n.slice(1), q: '' })) };
}
