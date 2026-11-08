// Musique de la tablette : radios en direct (annuaire libre radio-browser) et YouTube (recherche via Supabase)
import { sb } from './supa.js';

const SERVEURS_RADIO = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];
// Radios proposées (le nom sert à la recherche dans l'annuaire)
export const RADIOS = [
  { nom: 'France Inter', cherche: 'France Inter', ic: '🎙️' }, { nom: 'franceinfo', cherche: 'franceinfo', ic: '📰' },
  { nom: 'RTL', cherche: 'RTL', ic: '📻' },
  { nom: 'RTL2', cherche: 'RTL2', ic: '🎸', urls: ['https://streamer-02.rtl.fr/rtl2-1-44-128', 'https://icecast.rtl2.fr/rtl2-1-44-128?listen=webCwsBCggNCQgLDQUGBAcGBg', 'https://streaming.radio.rtl2.fr/rtl2-1-44-128'] },
  { nom: 'NRJ', cherche: 'NRJ', ic: '⚡' }, { nom: 'Nostalgie', cherche: 'Nostalgie', ic: '🕺' }, { nom: 'Chérie FM', cherche: 'Cherie FM', ic: '💖' },
  { nom: 'RFM', cherche: 'RFM', ic: '🎶' }, { nom: 'Europe 1', cherche: 'Europe 1', ic: '🗞️' }, { nom: 'Fun Radio', cherche: 'Fun Radio', ic: '🎉' },
  { nom: 'Skyrock', cherche: 'Skyrock', ic: '🎤' },
  { nom: 'NTI', cherche: 'NTI', ic: '🎧', exact: true, urls: ['https://manager11.streamradio.fr:3635/stream', 'https://proxy.webradio.tools/51.15.166.151:80/nti-128.mp3'] }, // flux officiel de radionti.com (Nantes 93.4)
  { nom: 'Hit West', cherche: 'hitwest', ic: '🌊', exact: true, urls: ['https://stream.rcs.revma.com/nvsuedfwcy3vv'] },
];
const sansAccent = (x) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function radioConnue(texte) {
  const t = sansAccent(texte).replace(/^(la |radio )+/, '').replace(/\bouest\b/, 'west').replace(/^n t i$/, 'nti');
  return RADIOS.find((r) => sansAccent(r.nom) === t || sansAccent(r.cherche) === t || t === sansAccent(r.nom).replace(/ /g, '')) || null;
}

let etat = { mode: null, titre: '', sous: '', pause: false, taille: 'petit', liste: [], index: 0, volume: 100 };
let audio = null; let cadreYt = null; let surChange = () => {}; let baisse = false;
export const etatMusique = () => etat;
export function quandMusiqueChange(f) { surChange = f; }
const prevenir = () => { try { surChange(etat); } catch (e) { /* ignore */ } };

// ---------- Radio ----------
async function chercherStation(nom) {
  const cache = (() => { try { return JSON.parse(localStorage.getItem('famille-radios') || '{}'); } catch (e) { return {}; } })();
  if (cache[nom]) return cache[nom];
  for (const base of SERVEURS_RADIO) {
    try {
      const u = `${base}/json/stations/search?name=${encodeURIComponent(nom)}&countrycode=FR&hidebroken=true&order=clickcount&reverse=true&limit=10`;
      const r = await fetch(u, { signal: AbortSignal.timeout(6000) }); if (!r.ok) continue;
      const l = (await r.json()).filter((s) => /^https?:/.test(s.url_resolved || '')).map((s) => ({ ...s, url_resolved: s.url_resolved.replace(/^http:/, 'https:') }));
      if (!l.length) continue;
      const s = { nom: l[0].name.trim(), url: l[0].url_resolved };
      cache[nom] = s; try { localStorage.setItem('famille-radios', JSON.stringify(cache)); } catch (e) { /* ignore */ }
      return s;
    } catch (e) { /* serveur suivant */ }
  }
  return null;
}
// Essaie une adresse : réussi si le son démarre dans les 8 secondes
function essayer(url) {
  return new Promise((ok, ko) => {
    const a = new Audio(); let fini = false;
    const fin = (r) => { if (fini) return; fini = true; clearTimeout(t); r ? ok(a) : (a.pause(), a.removeAttribute('src'), a.load(), ko(new Error('muette'))); };
    const t = setTimeout(() => fin(false), 8000);
    a.addEventListener('playing', () => fin(true), { once: true });
    a.addEventListener('error', () => fin(false), { once: true });
    a.src = url; a.volume = (baisse ? 0.35 : 1) * etat.volume / 100;
    a.play().catch((e) => { if (e && e.name === 'NotAllowedError') { fini = true; clearTimeout(t); ko(e); } });
  });
}
export async function jouerRadio(nom) {
  if (!nom) { try { nom = localStorage.getItem('famille-derniere-radio') || 'NRJ'; } catch (e) { nom = 'NRJ'; } }
  const connue = radioConnue(nom); const cherche = connue ? connue.cherche : nom;
  arreterMusique(false);
  const essais = [...((connue && connue.urls) || [])];
  // Radio à adresse officielle connue : pas de recherche dans l'annuaire (évite de tomber sur une radio du même nom)
  const trouvee = connue && connue.exact ? null : await chercherStation(cherche); if (trouvee && !essais.includes(trouvee.url)) essais.push(trouvee.url);
  if (!essais.length) throw new Error(`Je ne trouve pas la radio ${nom}.`);
  etat = { ...etat, mode: 'radio', titre: connue ? connue.nom : (trouvee ? trouvee.nom : nom), sous: 'Connexion…', ic: connue ? connue.ic : '📻', pause: false, erreur: '' }; prevenir();
  for (const url of essais) {
    try {
      audio = await essayer(url);
      if (etat.mode !== 'radio') { audio.pause(); audio = null; return ''; }
      audio.addEventListener('error', () => { if (etat.mode === 'radio') { etat.erreur = 'La radio a coupé.'; prevenir(); } });
      etat.sous = 'Radio en direct'; prevenir();
      try { localStorage.setItem('famille-derniere-radio', connue ? connue.nom : nom); } catch (e) { /* ignore */ }
      return etat.titre;
    } catch (e) { if (e && e.name === 'NotAllowedError') { arreterMusique(); throw e; } }
  }
  try { const c = JSON.parse(localStorage.getItem('famille-radios') || '{}'); delete c[cherche]; localStorage.setItem('famille-radios', JSON.stringify(c)); } catch (e) { /* ignore */ }
  arreterMusique();
  throw new Error(`${connue ? connue.nom : nom} ne répond pas pour le moment.`);
}

// ---------- YouTube ----------
export async function chercherYoutube(q) {
  const { data, error } = await sb.functions.invoke('youtube', { body: { q } });
  if (error) {
    let code = ''; try { code = (await error.context.json()).erreur; } catch (e) { /* ignore */ }
    throw new Error(code === 'quota_ou_cle' ? 'YouTube refuse la recherche (clé ou quota du jour).' : code === 'cle_absente' ? 'La clé YouTube n\'est pas encore rangée dans Supabase.' : 'Recherche YouTube impossible pour le moment.');
  }
  return (data && data.videos) || [];
}
function envoyerYt(func, args = []) {
  if (cadreYt && cadreYt.contentWindow) cadreYt.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}
let ecouteYt = null; let recuYt = false;
window.addEventListener('message', (e) => {
  if (!cadreYt || e.source !== cadreYt.contentWindow) return;
  let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
  if (!d || !d.info) return;
  recuYt = true;
  const i = d.info; let change = false;
  // Titre affiché : celui de la vidéo réellement jouée (YouTube peut sauter une vidéo indisponible)
  const vd = i.videoData;
  if (vd && vd.video_id) {
    const k = etat.liste.findIndex((v) => v.id === vd.video_id);
    const titre = (vd.title || (k >= 0 ? etat.liste[k].titre : '')).trim(); const sous = (k >= 0 ? etat.liste[k].chaine : vd.author || '') || '';
    if (k >= 0 && k !== etat.index) { etat.index = k; change = true; }
    if (titre && titre !== etat.titre) { etat.titre = titre; etat.sous = sous; change = true; }
  } else if (typeof i.playlistIndex === 'number' && i.playlistIndex !== etat.index && etat.liste[i.playlistIndex]) { etat.index = i.playlistIndex; etat.titre = etat.liste[i.playlistIndex].titre; etat.sous = etat.liste[i.playlistIndex].chaine; change = true; }
  if (typeof i.playerState === 'number') { const p = i.playerState === 2; if (p !== etat.pause) { etat.pause = p; change = true; } }
  if (change) prevenir();
});
// conteneur : élément où placer la vidéo
export async function jouerYoutube(q, conteneur) {
  const l = await chercherYoutube(q);
  if (!l.length) throw new Error(`Rien trouvé sur YouTube pour « ${q} ».`);
  return jouerListe(l, conteneur, q);
}
// Joue une liste de vidéos déjà connues ({ id, titre, chaine }), à partir de « depart »
export function jouerListe(l0, conteneur, nomListe = '', depart = 0) {
  const l = [...l0.slice(depart), ...l0.slice(0, depart)];
  if (!l.length) throw new Error('Liste vide.');
  const q = nomListe;
  arreterMusique(false);
  const ids = l.map((v) => v.id);
  cadreYt = document.createElement('iframe');
  cadreYt.allow = 'autoplay; encrypted-media; picture-in-picture';
  cadreYt.title = 'Lecteur YouTube';
  cadreYt.referrerPolicy = 'strict-origin-when-cross-origin'; // YouTube exige l'adresse du site (sinon erreur 153)
  cadreYt.src = `https://www.youtube-nocookie.com/embed/${ids[0]}?autoplay=1&enablejsapi=1&rel=0&playsinline=1&playlist=${ids.slice(1).join(',')}&origin=${encodeURIComponent(location.origin)}`;
  cadreYt.addEventListener('load', () => {
    // On demande à YouTube de nous tenir au courant (titre en cours…), en insistant tant qu'il n'a pas répondu
    recuYt = false; clearInterval(ecouteYt); let n = 0;
    const demander = () => { if (!cadreYt || recuYt || ++n > 15) { clearInterval(ecouteYt); return; } cadreYt.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); };
    demander(); ecouteYt = setInterval(demander, 1000);
    setTimeout(() => envoyerYt('setVolume', [baisse ? Math.round(etat.volume * 0.35) : etat.volume]), 800);
  });
  conteneur.innerHTML = ''; conteneur.appendChild(cadreYt);
  etat = { ...etat, mode: 'yt', liste: l, index: 0, titre: l[0].titre, sous: l[0].chaine, ic: '▶️', pause: false, taille: 'grand', recherche: q, erreur: '' };
  prevenir();
  return l[0].titre;
}
// Vidéo en cours ({ id, titre, chaine }) ou null
export const videoEnCours = () => (etat.mode === 'yt' ? etat.liste[etat.index] || null : null);

// ---------- Commandes ----------
export function pauseMusique() { if (etat.mode === 'radio' && audio) audio.pause(); if (etat.mode === 'yt') envoyerYt('pauseVideo'); etat.pause = true; prevenir(); }
export function reprendreMusique() { if (etat.mode === 'radio' && audio) audio.play().catch(() => {}); if (etat.mode === 'yt') envoyerYt('playVideo'); etat.pause = false; prevenir(); }
export function suivant() { if (etat.mode === 'yt') envoyerYt('nextVideo'); }
export function precedent() { if (etat.mode === 'yt') envoyerYt('previousVideo'); }
export function volumeMusique(delta) {
  etat.volume = Math.max(10, Math.min(100, etat.volume + delta));
  if (audio) audio.volume = etat.volume / 100;
  envoyerYt('setVolume', [etat.volume]); prevenir();
  return etat.volume;
}
// Baisse le son pendant qu'on parle à la tablette, puis le remet
export function baisserMusique(oui) {
  baisse = oui;
  if (audio) audio.volume = (oui ? 0.35 : 1) * etat.volume / 100;
  envoyerYt('setVolume', [oui ? Math.round(etat.volume * 0.35) : etat.volume]);
}
export function tailleVideo(t) { etat.taille = t || (etat.taille === 'grand' ? 'petit' : 'grand'); prevenir(); }
export function arreterMusique(prev = true) {
  if (audio) { audio.pause(); audio.src = ''; audio = null; }
  if (cadreYt) { cadreYt.remove(); cadreYt = null; }
  etat = { ...etat, mode: null, titre: '', sous: '', pause: false, liste: [], index: 0, erreur: '' };
  if (prev) prevenir();
}
export const musiqueEnCours = () => !!etat.mode && !etat.pause;
