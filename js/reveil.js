// Mot de réveil « Hé tablette » : écoute continue, 100 % locale (Vosk).
// On reconnaît librement la phrase (pas de grammaire imposée, qui faisait réagir à n'importe quel bruit),
// puis on vérifie que « tablette » est dit en début de phrase, avec une bonne confiance.
import { preparerVoixLocale } from './voix-locale.js';

let actif = null;
export const reveilActif = () => !!actif;

// Analyse une phrase reconnue : renvoie null, ou { reste } (la demande dite juste après « tablette »)
export function analyserReveil(texte, mots) {
  const l = (texte || '').toLowerCase().split(/\s+/).filter(Boolean);
  const k = l.findIndex((w) => /^tablettes?$/.test(w));
  if (k < 0 || k > 2) return null; // « tablette » doit être au début (« hé tablette », « ok tablette »)
  if (Array.isArray(mots)) { const m = mots.find((x) => /^tablettes?$/.test(x.word || '')); if (m && typeof m.conf === 'number' && m.conf < 0.6) return null; }
  return { reste: l.slice(k + 1).join(' ') };
}

// onMot(reste) est appelé au réveil ; l'écoute s'arrête alors (on la relance après)
export async function demarrerReveil(onMot) {
  if (actif) return;
  actif = { stop: () => {} };
  try {
    const modele = await preparerVoixLocale();
    const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
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
    reco.on('result', (m) => {
      if (fini) return;
      const r = m.result || {}; const a = analyserReveil(r.text, r.result);
      if (a) { stop(); actif = null; onMot(a.reste); }
    });
    noeud.onaudioprocess = (e) => { if (!fini) { try { reco.acceptWaveform(e.inputBuffer); } catch (x) { /* ignore */ } } };
    source.connect(noeud); noeud.connect(ctx.destination);
    flux.getTracks().forEach((t) => t.addEventListener('ended', () => { stop(); actif = null; }));
  } catch (e) { actif = null; throw e; }
}
export function arreterReveil() { if (actif) { const a = actif; actif = null; a.stop(); } }
