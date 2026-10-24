// La tablette parle : synthèse vocale intégrée à Android/Chrome (fonctionne sans Internet si la voix française est installée)
let voixFr = null;
function choisirVoix() {
  const v = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((x) => /^fr/i.test(x.lang));
  voixFr = v.find((x) => x.localService && /fr[-_]FR/i.test(x.lang)) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
}
if (window.speechSynthesis) { choisirVoix(); speechSynthesis.addEventListener('voiceschanged', choisirVoix); }

export const paroleDisponible = () => !!window.speechSynthesis;

export function dire(texte) {
  if (!window.speechSynthesis || !texte) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR'; if (voixFr) u.voice = voixFr;
    u.rate = 1; u.pitch = 1; u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

export const taire = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ } };

// « 14 h 30 » → « 14 heures 30 », « 9 h 00 » → « 9 heures »
export function heureParlee(d) {
  const h = d.getHours(); const m = d.getMinutes();
  if (h === 12 && m === 0) return 'midi';
  if (h === 0 && m === 0) return 'minuit';
  return `${h} heure${h > 1 ? 's' : ''}${m ? ' ' + m : ''}`;
}

// « pain, lait et café »
export function enumerer(l) {
  if (l.length <= 1) return l.join('');
  return l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1];
}
