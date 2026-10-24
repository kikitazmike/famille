// Reconnaissance vocale 100 % locale avec Vosk (aucun son envoyé sur Internet)
// Le modèle français (~40 Mo) est téléchargé une seule fois puis gardé en cache.
const LIB = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const MODELE = new URL('../vosk/vosk-model-small-fr-0.22.tar.gz', import.meta.url).href;

let modelePromesse = null;
let etat = 'inactif'; // inactif | chargement | pret | erreur
export const etatVoixLocale = () => etat;

function chargerScript() {
  if (window.Vosk) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = LIB; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(new Error('Impossible de charger le moteur vocal.'));
    document.head.appendChild(s);
  });
}

export function preparerVoixLocale() {
  if (!modelePromesse) {
    etat = 'chargement';
    modelePromesse = (async () => {
      await chargerScript();
      const modele = await window.Vosk.createModel(MODELE);
      etat = 'pret';
      return modele;
    })().catch((e) => { etat = 'erreur'; modelePromesse = null; throw e; });
  }
  return modelePromesse;
}

// Écoute une phrase et renvoie le texte reconnu.
// options : { onPartiel(texte), dureeMax (ms) }
export async function ecouterLocal({ onPartiel, dureeMax = 9000 } = {}) {
  const modele = await preparerVoixLocale();
  const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(flux);
  const reco = new modele.KaldiRecognizer(ctx.sampleRate);
  const noeud = ctx.createScriptProcessor(4096, 1, 1);
  let fini = false;
  let dernierPartiel = '';
  const arreter = () => {
    if (fini) return; fini = true;
    try { noeud.disconnect(); source.disconnect(); } catch (e) { /* ignore */ }
    flux.getTracks().forEach((t) => t.stop());
    try { ctx.close(); } catch (e) { /* ignore */ }
    try { reco.remove(); } catch (e) { /* ignore */ }
  };
  return new Promise((resolve, reject) => {
    const minuterie = setTimeout(() => { arreter(); dernierPartiel ? resolve(dernierPartiel) : reject(new Error('Je n\'ai rien entendu.')); }, dureeMax);
    reco.on('partialresult', (m) => {
      const t = (m.result && m.result.partial || '').trim();
      if (t) { dernierPartiel = t; if (onPartiel) onPartiel(t); }
    });
    reco.on('result', (m) => {
      const t = (m.result && m.result.text || '').trim();
      if (!t) return;
      clearTimeout(minuterie); arreter(); resolve(t);
    });
    noeud.onaudioprocess = (e) => { if (!fini) { try { reco.acceptWaveform(e.inputBuffer); } catch (x) { /* ignore */ } } };
    source.connect(noeud); noeud.connect(ctx.destination);
    ecouterLocal.arreter = () => { clearTimeout(minuterie); arreter(); dernierPartiel ? resolve(dernierPartiel) : reject(new Error('Écoute arrêtée.')); };
  });
}
