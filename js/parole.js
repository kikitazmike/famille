// La tablette parle : synthèse vocale intégrée à Android/Chrome (fonctionne sans Internet si la voix française est installée)
let voixFr = null;
function choisirVoix() {
  const v = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((x) => /^fr/i.test(x.lang));
  voixFr = v.find((x) => x.localService && /fr[-_]FR/i.test(x.lang)) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
}
if (window.speechSynthesis) { choisirVoix(); speechSynthesis.addEventListener('voiceschanged', choisirVoix); }

export const paroleDisponible = () => !!window.speechSynthesis;

let enCours = null; // garde une référence (sinon Chrome peut l'oublier en route)
export function dire(texte, { onErreur, onDebut } = {}) {
  if (!window.speechSynthesis || !texte) { if (onErreur) onErreur('non disponible'); return; }
  try {
    if (!voixFr) choisirVoix();
    const occupe = speechSynthesis.speaking || speechSynthesis.pending;
    if (occupe) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = voixFr ? voixFr.lang : 'fr-FR'; if (voixFr) u.voice = voixFr;
    u.rate = 1; u.pitch = 1; u.volume = 1;
    u.onstart = () => { if (onDebut) onDebut(); };
    u.onerror = (e) => { if (onErreur && e.error !== 'interrupted' && e.error !== 'canceled') onErreur(e.error || 'erreur'); };
    u.onend = () => { if (enCours === u) enCours = null; };
    enCours = u;
    // Sur Android, parler juste après « cancel » échoue parfois : petit délai
    setTimeout(() => { try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { if (onErreur) onErreur(e.message); } }, occupe ? 250 : 30);
  } catch (e) { if (onErreur) onErreur(e.message); }
}
export const nbVoixFr = () => (window.speechSynthesis ? speechSynthesis.getVoices().filter((x) => /^fr/i.test(x.lang)).length : 0);

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
