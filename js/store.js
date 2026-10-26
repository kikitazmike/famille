// Données partagées : cache local, temps réel et file d'attente hors connexion
import { sb } from './supa.js';
import { FETAMI_URL, FETAMI_CLE } from './config.js';

const CACHE = 'famille-cache-v1';
const OUTBOX = 'famille-outbox-v1';
const TABLES = {
  membres: 'membres', evenements: 'evenements', liens: 'evenement_membres',
  courses: 'courses', notes: 'notes', rappels: 'rappels',
  habituels: 'courses_habituels', messages: 'famille_messages',
  ptypes: 'planning_types', pjours: 'planning_jours',
  recettes: 'recettes', repas: 'repas_prevus'
};

export const state = {
  membres: [], evenements: [], liens: [], courses: [], notes: [], rappels: [], habituels: [], messages: [], ptypes: [], pjours: [], recettes: [], repas: [],
  config: null, anniv: [], moi: null, userId: null, enLigne: navigator.onLine, enAttente: 0
};

const ecouteurs = new Set();
export const surChangement = (f) => { ecouteurs.add(f); return () => ecouteurs.delete(f); };
let rafEmis = false;
function emettre() {
  if (rafEmis) return;
  rafEmis = true;
  queueMicrotask(() => {
    rafEmis = false;
    sauverCache();
    ecouteurs.forEach((f) => { try { f(state); } catch (e) { console.error(e); } });
  });
}

function sauverCache() {
  try {
    const { moi, userId, enAttente, enLigne, config, ...reste } = state;
    // Le code famille et le jeton Fetami ne sont pas gardés sur l'appareil
    reste.config = config ? (({ code, fetami_jeton, ...c }) => c)(config) : null;
    localStorage.setItem(CACHE, JSON.stringify(reste));
  } catch (e) { /* stockage plein ou bloqué */ }
}
export function chargerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && typeof c === 'object') {
      delete c.userId; delete c.enAttente;
      // Cache abîmé : on ne garde que les listes qui sont bien des listes
      // Seules les clés connues sont reprises (listes des tables + config + anniversaires)
      const permis = new Set([...Object.keys(TABLES), 'config', 'anniv']);
      Object.keys(c).forEach((k) => { if (!permis.has(k) || (Array.isArray(state[k]) && !Array.isArray(c[k]))) delete c[k]; else if (Array.isArray(c[k])) c[k] = c[k].filter((x) => x && typeof x === 'object' && !Array.isArray(x)); });
      if (c.config !== undefined && (c.config === null || typeof c.config !== 'object' || Array.isArray(c.config))) c.config = null;
      Object.assign(state, c, { enLigne: navigator.onLine }); propre('membres', state.membres); propre('rappels', state.rappels); propre('ptypes', state.ptypes);
    }
  } catch (e) { /* ignore */ }
  try { majMoi(); } catch (e) {
    // Cache inutilisable : on l'efface, mais on garde les écritures en attente
    try { localStorage.removeItem(CACHE); } catch (x) { /* ignore */ }
    const f = lireFile(); viderCache(); ecrireFile(f);
  }
}
export function viderCache() {
  try { localStorage.removeItem(CACHE); localStorage.removeItem(OUTBOX); } catch (e) { /* ignore */ }
  Object.assign(state, { membres: [], evenements: [], liens: [], courses: [], notes: [], rappels: [], habituels: [], messages: [], ptypes: [], pjours: [], recettes: [], repas: [], config: null, anniv: [], moi: null });
}

function majMoi() {
  state.moi = state.membres.find((m) => m.user_id && m.user_id === state.userId) || null;
}
export const membre = (id) => state.membres.find((m) => m.id === id) || null;
export const personnes = () => state.membres.filter((m) => m.type === 'personne').sort((a, b) => a.prenom.localeCompare(b.prenom));
export const liensDe = (evId) => state.liens.filter((l) => l.evenement_id === evId).map((l) => l.membre_id);

// Couleurs : on n'accepte que #RRGGBB (protège les attributs style)
const HEX = /^#[0-9A-Fa-f]{6}$/;
function propre(cle, lignes) {
  if (cle === 'membres' || cle === 'rappels' || cle === 'ptypes') lignes.forEach((l) => { if (l.couleur && !HEX.test(l.couleur)) l.couleur = null; });
  if (cle === 'membres') lignes.forEach((l) => { if (!l.couleur) l.couleur = '#6D5BD0'; });
  return lignes;
}
async function rafraichir(cle) {
  const { data, error } = await sb.from(TABLES[cle]).select('*');
  if (error) throw error;
  state[cle] = propre(cle, data || []);
  // Les écritures encore en attente restent visibles
  lireFile().forEach((o) => { if (o.cle === cle) appliquerLocal(o.cle, o.op, o.ligne); });
}

export async function toutCharger(userId) {
  state.userId = userId;
  await vider();
  await Promise.all(Object.keys(TABLES).map((k) => rafraichir(k).catch((e) => console.warn(k, e))));
  const { data } = await sb.from('famille_config').select('*').maybeSingle();
  if (data) state.config = data;
  majMoi();
  emettre();
  chargerAnniv();
  return state;
}

let canal = null;
const minuteries = {};
export function temps_reel() {
  if (canal) return;
  canal = sb.channel('famille-direct');
  for (const [cle, table] of Object.entries(TABLES)) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      clearTimeout(minuteries[cle]);
      minuteries[cle] = setTimeout(async () => {
        try { await rafraichir(cle); majMoi(); emettre(); } catch (e) { /* hors ligne */ }
      }, 200);
    });
  }
  canal.on('postgres_changes', { event: '*', schema: 'public', table: 'famille_config' }, async () => {
    const { data } = await sb.from('famille_config').select('*').maybeSingle();
    if (data) { state.config = data; emettre(); }
  });
  canal.subscribe();
}
export function arreterTempsReel() { if (canal) { sb.removeChannel(canal); canal = null; } }

// ---------- Écritures ----------
const lireFile = () => { try { const f = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); return Array.isArray(f) ? f.filter((o) => o && Object.prototype.hasOwnProperty.call(TABLES, o.cle) && ['insert', 'update', 'delete'].includes(o.op) && o.ligne && typeof o.ligne === 'object' && !Array.isArray(o.ligne)) : []; } catch (e) { return []; } };
const ecrireFile = (f) => { try { localStorage.setItem(OUTBOX, JSON.stringify(f)); } catch (e) { /* ignore */ } state.enAttente = f.length; };

function appliquerLocal(cle, op, ligne) {
  const liste = state[cle];
  if (cle === 'liens') {
    const i = liste.findIndex((l) => l.evenement_id === ligne.evenement_id && l.membre_id === ligne.membre_id);
    if (op === 'insert' && i < 0) liste.push(ligne);
    if (op === 'delete' && i >= 0) liste.splice(i, 1);
    return;
  }
  const i = liste.findIndex((x) => x.id === ligne.id);
  if (op === 'insert') { if (i < 0) liste.push(ligne); else liste[i] = { ...liste[i], ...ligne }; }
  if (op === 'update' && i >= 0) liste[i] = { ...liste[i], ...ligne };
  if (op === 'delete' && i >= 0) liste.splice(i, 1);
}

const estReseau = (e) => !navigator.onLine || /Failed to fetch|NetworkError|network|Load failed|timeout/i.test(String(e && (e.message || e)));

async function envoyer({ cle, op, ligne }) {
  const t = sb.from(TABLES[cle]);
  let r;
  if (op === 'insert') r = await t.upsert(ligne, { onConflict: cle === 'liens' ? 'evenement_id,membre_id' : 'id', ignoreDuplicates: cle === 'liens' });
  else if (op === 'update') { const { id, ...reste } = ligne; r = await t.update(reste).eq('id', id); }
  else if (op === 'delete') {
    r = cle === 'liens'
      ? await t.delete().eq('evenement_id', ligne.evenement_id).eq('membre_id', ligne.membre_id)
      : await t.delete().eq('id', ligne.id);
  }
  if (r && r.error) { const err = new Error(r.error.message); err.reseau = estReseau(r.error); err.status = r.status; throw err; }
}

let envoiEnCours = null; let relance = null;
function planifierRelance() { if (!relance) relance = setTimeout(() => { relance = null; vider(); }, 30000); }
export async function vider() {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    // On relit la file à chaque tour : des écritures peuvent s'ajouter pendant l'envoi (elles vont toujours à la fin)
    let file = lireFile(); let bloque = false;
    while (file.length && navigator.onLine) {
      try { await envoyer(file[0]); ecrireFile(lireFile().slice(1)); }
      catch (e) {
        // On ne jette que les refus définitifs (données invalides, interdit) ; le reste (session expirée, serveur) est réessayé plus tard
        if (e.reseau || !e.status || e.status === 401 || e.status >= 500) { bloque = true; break; }
        console.warn('Écriture abandonnée', e); ecrireFile(lireFile().slice(1));
      }
      file = lireFile();
    }
    state.enAttente = file.length;
    // Serveur indisponible alors qu'on est en ligne : nouvel essai dans 30 s
    if (bloque && file.length) planifierRelance();
  })();
  try { await envoiEnCours; } finally { envoiEnCours = null; }
}

// Écrit une suite d'opérations dans l'ordre (ex. : événement puis ses participants)
export async function ecrire(ops) {
  if (!Array.isArray(ops)) ops = [ops];
  ops.forEach((o) => appliquerLocal(o.cle, o.op, o.ligne));
  emettre();
  const file = lireFile();
  if (file.length || !navigator.onLine) { ecrireFile(file.concat(ops)); emettre(); vider(); return { hors_ligne: true }; }
  for (let i = 0; i < ops.length; i++) {
    try { await envoyer(ops[i]); }
    catch (e) {
      if (e.reseau || !e.status || e.status === 401 || e.status >= 500) { ecrireFile(lireFile().concat(ops.slice(i))); emettre(); planifierRelance(); return { hors_ligne: true }; }
      try { await Promise.all([...new Set(ops.map((o) => o.cle))].map((k) => rafraichir(k))); majMoi(); emettre(); } catch (x) { /* ignore */ }
      throw e;
    }
  }
  return { ok: true };
}

export const nouvelId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
}));

window.addEventListener('online', () => { state.enLigne = true; emettre(); vider().then(() => emettre()); });
window.addEventListener('offline', () => { state.enLigne = false; emettre(); });

// ---------- Anniversaires (Fetami, lecture seule) ----------
export async function chargerAnniv() {
  const jeton = state.config && state.config.fetami_jeton;
  if (!jeton || !navigator.onLine) return;
  try {
    const r = await fetch(`${FETAMI_URL}/rest/v1/rpc/fetami_flux_anniversaires`, {
      method: 'POST',
      headers: { apikey: FETAMI_CLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_jeton: jeton })
    });
    if (r.ok) { state.anniv = await r.json(); emettre(); }
  } catch (e) { /* hors ligne : on garde le cache */ }
}

// ---------- Images privées (photo de profil, photos de veille) ----------
const urlCache = new Map();
export async function urlImage(seau, chemin) {
  if (!chemin) return null;
  const c = urlCache.get(seau + chemin);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from(seau).createSignedUrl(chemin, 3600 * 6);
  if (error) return null;
  urlCache.set(seau + chemin, { url: data.signedUrl, exp: Date.now() + 3600 * 5 * 1000 });
  return data.signedUrl;
}

export async function reduireImage(fichier, max) {
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(fichier);
  });
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
}
