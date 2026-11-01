// Mot de réveil « Hé tablette » : écoute continue, 100 % locale (Vosk), limitée à quelques mots
import { preparerVoixLocale } from './voix-locale.js';

const GRAMMAIRE = JSON.stringify(['hé tablette', 'eh tablette', 'et tablette', 'hey tablette', 'ok tablette', 'tablette', '[unk]']);
let actif = null;
export const reveilActif = () => !!actif;

// onMot() est appelé quand « tablette » est entendu ; l'écoute s'arrête alors (on la relance après)
export async function demarrerReveil(onMot) {
  if (actif) return;
  actif = { stop: () => {} };
  try {
    const modele = await preparerVoixLocale();
    const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (!actif) { flux.getTracks().forEach((t) => t.stop()); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(flux);
    const reco = new modele.KaldiRecognizer(ctx.sampleRate, GRAMMAIRE);
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
    const entendu = (t) => { if (!fini && /\btablette\b/.test(t || '')) { stop(); actif = null; onMot(); } };
    reco.on('partialresult', (m) => entendu(m.result && m.result.partial));
    reco.on('result', (m) => entendu(m.result && m.result.text));
    noeud.onaudioprocess = (e) => { if (!fini) { try { reco.acceptWaveform(e.inputBuffer); } catch (x) { /* ignore */ } } };
    source.connect(noeud); noeud.connect(ctx.destination);
    flux.getTracks().forEach((t) => t.addEventListener('ended', () => { stop(); actif = null; }));
  } catch (e) { actif = null; throw e; }
}
export function arreterReveil() { if (actif) { const a = actif; actif = null; a.stop(); } }
