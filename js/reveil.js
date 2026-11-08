// Mot de réveil « Hé tablette » : écoute continue, 100 % locale (Vosk).
// On reconnaît librement la phrase (pas de grammaire imposée, qui faisait réagir à n'importe quel bruit),
// puis on vérifie que « tablette » est dit en début de phrase, avec une bonne confiance.
import { preparerVoixLocale } from './voix-locale.js';

let actif = null;
export const reveilActif = () => !!actif;

// Analyse une phrase reconnue : renvoie null, ou { reste } (la demande dite juste après « tablette »)
export function analyserReveil(texte, mots, souple = false) {
  const l = (texte || '').toLowerCase().split(/\s+/).filter(Boolean);
  const k = l.findIndex((w) => /^tablettes?$/.test(w));
  // Avec de la musique, le micro entend aussi les paroles : on accepte « tablette » un peu plus loin dans la phrase
  if (k < 0 || k > (souple ? 5 : 2)) return null; // « tablette » doit être au début (« hé tablette », « ok tablette »)
  if (Array.isArray(mots)) { const m = mots.find((x) => /^tablettes?$/.test(x.word || '')); if (m && typeof m.conf === 'number' && m.conf < (souple ? 0.45 : 0.6)) return null; }
  return { reste: l.slice(k + 1).join(' ') };
}

// onMot(reste) est appelé au réveil ; l'écoute s'arrête alors (on la relance après)
export async function demarrerReveil(onMot, { souple = () => false } = {}) {
  if (actif) return;
  actif = { stop: () => {} };
  try {
    const modele = await preparerVoixLocale();
    const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 } }) // sans « annulation d'écho » : sinon Android passe en mode appel et le son de la musique devient faible et mauvais;
    if (!actif) { flux.getTracks().forEach((t) => t.stop()); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(flux);
    const reco = new modele.KaldiRecognizer(ctx.sampleRate);
    try { reco.setWords(true); } catch (e) { /* ancienne version */ }
    const noeud = ctx.createScriptProcessor(4096, 1, 1);
    let fini = false;
    const stop = () => {
      if (fini) return; fini = true;
      try { noeud.disconnect(); source.disconnect(); } catch (e) { /* ignore */ }
      flux.getTracks().forEach((t) => t.stop());
      try { ctx.close(); } catch (e) { /* ignore */ }
      try { reco.remove(); } catch (e) { /* ignore */ }
    };
    actif.stop = stop;
    // Plus rapide : si « tablette » est entendu en début de phrase et que la phrase ne bouge plus pendant 0,6 s, on réagit sans attendre la fin
    let attente = null; let dernier = '';
    reco.on('partialresult', (m) => {
      if (fini) return;
      const p = (m.result && m.result.partial || '').trim(); if (!p || p === dernier) return; dernier = p;
      clearTimeout(attente);
      const a = analyserReveil(p, null, souple());
      if (a && !a.reste) attente = setTimeout(() => { if (!fini && dernier === p) { stop(); actif = null; onMot('', p); } }, 600);
    });
    reco.on('result', (m) => {
      if (fini) return;
      clearTimeout(attente); dernier = '';
      const r = m.result || {}; const a = analyserReveil(r.text, r.result, souple());
      if (a) { stop(); actif = null; onMot(a.reste, r.text); }
    });
    noeud.onaudioprocess = (e) => { if (!fini) { try { reco.acceptWaveform(e.inputBuffer); } catch (x) { /* ignore */ } } };
    source.connect(noeud); noeud.connect(ctx.destination);
    flux.getTracks().forEach((t) => t.addEventListener('ended', () => { stop(); actif = null; }));
  } catch (e) { actif = null; throw e; }
}
export function arreterReveil() { if (actif) { const a = actif; actif = null; a.stop(); } }
