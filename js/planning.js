// Planning de travail : désignations (Matin, Nuit…) et jours travaillés, communs au téléphone et à la tablette
import { state, ecrire, nouvelId } from './store.js';

export const COULEURS_PLANNING = [
  ['#FFE1C7', '#8A4310'], ['#D3E6FB', '#1F4E79'], ['#E4DEFB', '#3B2F8F'],
  ['#2F3A66', '#FFFFFF'], ['#EEE9E1', '#6B655C'], ['#F9D5E5', '#8A2350'], ['#D6F0EC', '#1D5C57']
];
const HEX = /^#[0-9A-Fa-f]{6}$/;
export const fondType = (t) => (t && HEX.test(t.couleur || '') ? t.couleur : '#E4DEFB');
export function texteType(t) {
  const c = fondType(t); const trouve = COULEURS_PLANNING.find(([f]) => f.toLowerCase() === c.toLowerCase());
  if (trouve) return trouve[1];
  const n = parseInt(c.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  return l > 150 ? '#2E2A25' : '#FFFFFF';
}

export const BASE = [
  { nom: 'Matin', code: 'M', debut: '06:00', fin: '13:00', couleur: '#FFE1C7' },
  { nom: 'Après-midi', code: 'AM', debut: '13:00', fin: '20:00', couleur: '#D3E6FB' },
  { nom: 'Journée', code: 'J', debut: '08:30', fin: '17:00', couleur: '#E4DEFB' },
  { nom: 'Nuit', code: 'N', debut: '21:00', fin: '05:00', couleur: '#2F3A66' },
  { nom: 'Repos', code: 'R', debut: null, fin: null, couleur: '#EEE9E1', repos: true }
];

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (t) => (t ? t.slice(0, 5) : '');
export function heureCourte(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); return m ? `${h} h ${pad(m)}` : `${h} h`; }
export function horaires(t) { if (!t) return ''; if (t.repos || !t.debut) return 'Repos'; return `${heureCourte(t.debut)} – ${heureCourte(t.fin)}`; }
export function dureeH(t) {
  if (!t || t.repos || !t.debut || !t.fin) return 0;
  const a = t.debut.split(':').map(Number); const b = t.fin.split(':').map(Number);
  let m = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]); if (m <= 0) m += 1440;
  return m / 60;
}

export const typesDe = (membreId) => state.ptypes.filter((t) => t.membre_id === membreId).sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom));
export const typeParId = (id) => state.ptypes.find((t) => t.id === id) || null;
export const ligneJour = (membreId, jourIso) => state.pjours.find((j) => j.membre_id === membreId && j.jour === jourIso) || null;
export const typeDuJour = (membreId, jourIso) => { const l = ligneJour(membreId, jourIso); return l ? typeParId(l.type_id) : null; };

// Opérations pour poser (ou effacer, typeId = null) une désignation sur un jour
export function opsJour(membreId, jourIso, typeId) {
  const l = ligneJour(membreId, jourIso);
  if (!typeId) return l ? [{ cle: 'pjours', op: 'delete', ligne: { id: l.id } }] : [];
  if (l) return l.type_id === typeId ? [] : [{ cle: 'pjours', op: 'update', ligne: { id: l.id, type_id: typeId } }];
  return [{ cle: 'pjours', op: 'insert', ligne: { id: nouvelId(), membre_id: membreId, jour: jourIso, type_id: typeId, created_at: new Date().toISOString() } }];
}
export const poserJour = (membreId, jourIso, typeId) => { const ops = opsJour(membreId, jourIso, typeId); return ops.length ? ecrire(ops) : Promise.resolve(); };

export function creerBase(membreId) {
  const ex = new Set(typesDe(membreId).map((t) => t.code.toUpperCase()));
  const ops = BASE.filter((b) => !ex.has(b.code)).map((b, k) => ({ cle: 'ptypes', op: 'insert', ligne: { id: nouvelId(), membre_id: membreId, ordre: k, repos: !!b.repos, ...b, created_at: new Date().toISOString() } }));
  return ops.length ? ecrire(ops) : Promise.resolve();
}

// ---------- Lecture d'un planning papier (texte reconnu sur la photo) ----------
const JOURS_RE = [['lun', 1], ['mar', 2], ['mer', 3], ['jeu', 4], ['ven', 5], ['sam', 6], ['dim', 7]];
const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function heure(h, m) { h = Number(h); m = Number(m || 0); if (h > 24 || m > 59) return null; return `${pad(h % 24)}:${pad(m)}`; }

// Renvoie [{ jour: 'AAAA-MM-JJ', debut, fin, repos, typeId, doute, brut }]
export function lirePlanning(texte, types, lundi) {
  const res = []; const vus = new Set();
  const lignes = (texte || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const brut of lignes) {
    const n = sansAccent(brut).replace(/[|]/g, ' ');
    let jour = null; let dateOk = false;
    const md = n.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
    if (md) {
      const a = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : lundi.getFullYear();
      const d = new Date(a, Number(md[2]) - 1, Number(md[1]));
      // Date valide seulement (« 6-13 » ou « 6.30 » sont des horaires, pas des dates)
      if (!isNaN(d) && d.getDate() === Number(md[1]) && d.getMonth() === Number(md[2]) - 1) {
        // Planning à cheval sur l'année : « 01/01 » vu depuis fin décembre = l'année suivante
        if (!md[3] && d < lundi - 182 * 86400000) d.setFullYear(d.getFullYear() + 1);
        else if (!md[3] && d > lundi.getTime() + 182 * 86400000) d.setFullYear(d.getFullYear() - 1);
        // Si un jour de la semaine est écrit sur la ligne et ne correspond pas, ce n'était pas une date (« Lundi 6-12 »)
        const jsem = JOURS_RE.find(([p]) => new RegExp(`\\b${p}(?![a-z])|\\b${p}(di|credi|dredi|edi|anche)\\b`).test(n));
        if (!jsem || ((d.getDay() + 6) % 7) + 1 === jsem[1]) { jour = d; dateOk = true; }
      }
    }
    if (!jour) {
      const j = JOURS_RE.find(([p]) => new RegExp(`\\b${p}(?![a-z])|\\b${p}${{ lun: 'di', mar: 'di', mer: 'credi', jeu: 'di', ven: 'dredi', sam: 'edi', dim: 'anche' }[p]}\\b`).test(n));
      if (j) { jour = new Date(lundi); jour.setDate(lundi.getDate() + j[1] - 1); }
    }
    if (!jour) continue;
    const k = iso(jour); if (vus.has(k)) continue;
    let debut = null; let fin = null; let repos = false;
    const sansDate = dateOk ? n.replace(md[0], ' ') : n;
    const h = sansDate.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|–|à|a|>|au|\s)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
    if (h) { debut = heure(h[1], h[2]); fin = heure(h[3], h[4]); }
    if (/\b(repos|rh|rtt|cp|conge|off|ferie|libre)\b/.test(n)) repos = true;
    // Désignation correspondante : mêmes horaires, ou même nom / lettre écrits sur la ligne
    let type = null;
    if (debut && fin) type = types.find((t) => !t.repos && hm(t.debut) === debut && hm(t.fin) === fin) || null;
    if (!type && repos) type = types.find((t) => t.repos) || null;
    if (!type) type = types.find((t) => new RegExp(`\\b${sansAccent(t.nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) || null;
    if (!type) type = types.find((t) => t.code.length >= 2 && new RegExp(`\\b${sansAccent(t.code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) || null;
    vus.add(k);
    res.push({ jour: k, debut, fin, repos, typeId: type ? type.id : '', doute: !type, brut });
  }
  return res.sort((a, b) => (a.jour < b.jour ? -1 : 1));
}

// Reconnaissance du texte sur la photo, sur l'appareil (Tesseract, sans IA en ligne)
let tessPromesse = null;
function chargerTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!tessPromesse) {
    tessPromesse = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = () => ok(); s.onerror = () => { tessPromesse = null; ko(new Error('Impossible de charger la lecture de photo.')); };
      document.head.appendChild(s);
    });
  }
  return tessPromesse;
}
export async function lirePhoto(fichier, progres) {
  await chargerTesseract();
  const worker = await window.Tesseract.createWorker('fra', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int',
    logger: (m) => { if (progres && m.status === 'recognizing text') progres(Math.round(m.progress * 100)); }
  });
  try {
    const { data } = await worker.recognize(fichier);
    return data.text || '';
  } finally { await worker.terminate(); }
}
