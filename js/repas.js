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
export function quantite(q, base, pers) {
  if (!q || !base || base === pers) return q || '';
  const f = pers / base;
  const fmt = (v) => { v = v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100; return String(v).replace('.', ','); };
  const nb = (x) => parseFloat(x.replace(',', '.'));
  // Fraction « 1/2 kg »
  let m = q.match(/^\s*(\d+)\s*\/\s*(\d+)(.*)$/);
  if (m && Number(m[2])) return `${fmt(Number(m[1]) / Number(m[2]) * f)}${m[3]}`;
  // Fourchette « 2-3 » ou « 2 à 3 »
  m = q.match(/^\s*(\d+(?:[.,]\d+)?)\s*(-|–|à)\s*(\d+(?:[.,]\d+)?)(.*)$/);
  if (m) return `${fmt(nb(m[1]) * f)}${m[2] === 'à' ? ' à ' : '-'}${fmt(nb(m[3]) * f)}${m[4]}`;
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
// Ajoute des ingrédients aux courses (sans doublon avec ce qui est déjà à prendre)
export function opsCourses(liste, source, auteur) {
  const dans = new Set(state.courses.filter((c) => !c.pris).map((c) => sansAccent(c.nom)));
  const vus = new Set(); const ops = [];
  for (const x of liste) {
    const k = sansAccent(x.nom); if (!k || dans.has(k) || vus.has(k)) continue; vus.add(k);
    ops.push({ cle: 'courses', op: 'insert', ligne: { id: nouvelId(), nom: x.nom.slice(0, 120), quantite: x.q ? String(x.q).slice(0, 60) : null, source, ajoute_par: auteur, pris: false, created_at: new Date().toISOString() } });
  }
  return ops;
}
export function prevoir(recetteId, jour, pers, auteur) {
  return ecrire({ cle: 'repas', op: 'insert', ligne: { id: nouvelId(), recette_id: recetteId, jour: jour || null, personnes: pers, fait: false, ajoute_par: auteur, created_at: new Date().toISOString() } });
}
// Tous les ingrédients des repas à cuisiner, fusionnés
export function ingredientsAFaire() {
  return repasAFaire().flatMap((p) => { const r = recette(p.recette_id); return r ? ingredients(r, p.personnes).filter((x) => !x.dans) : []; });
}
// « Nom, quantité » ou « Nom - quantité » par ligne → [{nom, q}]
export function lireIngredients(texte) {
  return (texte || '').split(/\n|;/).map((l) => l.trim()).filter((l) => /[\p{L}\p{N}]/u.test(l)).map((l) => {
    const m = l.match(/^(.+?)\s*(?:,|\s-\s|:)\s*(.+)$/);
    const nom = (m ? m[1] : l).trim().slice(0, 120); const q = m ? m[2].trim().slice(0, 60) : '';
    return { nom: nom.charAt(0).toUpperCase() + nom.slice(1), q };
  }).filter((x) => /[\p{L}\p{N}]/u.test(x.nom)).slice(0, 60);
}
// Dictée « hachis parmentier : pommes de terre, bœuf haché, lait »
export function lireDictee(t) {
  const m = (t || '').match(/^(.+?)\s*(?::|avec|il faut)\s*(.+)$/i);
  if (!m) return null;
  return { nom: m[1].trim().replace(/^(recette|nouvelle recette)\s*/i, ''), ingredients: m[2].split(/\s*(?:,|\bet\b)\s*/).map((n) => n.trim()).filter(Boolean).map((n) => ({ nom: n.charAt(0).toUpperCase() + n.slice(1), q: '' })) };
}
