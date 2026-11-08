// La tablette parle : synthèse vocale intégrée à Android/Chrome (fonctionne sans Internet si la voix française est installée)
let voixFr = null;
function choisirVoix() {
  const v = (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter((x) => /^fr/i.test(x.lang));
  voixFr = v.find((x) => x.localService && /fr[-_]FR/i.test(x.lang)) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
}
if (window.speechSynthesis) { choisirVoix(); speechSynthesis.addEventListener('voiceschanged', choisirVoix); }

export const paroleDisponible = () => !!window.speechSynthesis;

let enCours = null; // garde une référence (sinon Chrome peut l'oublier en route)
export function dire(texte, { onErreur, onDebut, onFin } = {}) {
  if (!window.speechSynthesis || !texte) { if (onErreur) onErreur('non disponible'); if (onFin) onFin(); return; }
  try {
    if (!voixFr) choisirVoix();
    const occupe = speechSynthesis.speaking || speechSynthesis.pending;
    if (occupe) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = voixFr ? voixFr.lang : 'fr-FR'; if (voixFr) u.voice = voixFr;
    u.rate = 1; u.pitch = 1; u.volume = 1;
    u.onstart = () => { if (onDebut) onDebut(); };
    u.onerror = (e) => { if (onErreur && e.error !== 'interrupted' && e.error !== 'canceled') onErreur(e.error || 'erreur'); if (onFin) onFin(); };
    u.onend = () => { if (enCours === u) enCours = null; if (onFin) onFin(); };
    enCours = u;
    // Sur Android, parler juste après « cancel » échoue parfois : petit délai
    setTimeout(() => { try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { if (onErreur) onErreur(e.message); } }, occupe ? 250 : 30);
  } catch (e) { if (onErreur) onErreur(e.message); if (onFin) onFin(); }
}
// Parle puis attend la fin de la phrase (avec une sécurité si Android ne prévient pas)
export function direEtAttendre(texte) {
  return new Promise((ok) => {
    let fait = false; const debut = Date.now();
    const fin = () => { if (!fait) { fait = true; setTimeout(ok, 300); } };
    // Sécurité : si Android ne prévient pas de la fin, on attend que la voix se taise vraiment (15 s maximum)
    const verifier = () => { if (fait) return; if (window.speechSynthesis && speechSynthesis.speaking && Date.now() - debut < 15000) setTimeout(verifier, 200); else fin(); };
    setTimeout(verifier, 900 + (texte || '').length * 60);
    dire(texte, { onFin: fin });
  });
}
export const nbVoixFr = () => (window.speechSynthesis ? speechSynthesis.getVoices().filter((x) => /^fr/i.test(x.lang)).length : 0);

export const taire = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ } };

// « 14 h 30 » → « 14 heures 30 », « 9 h 00 » → « 9 heures »
export function heureParlee(d) {
  const h = d.getHours(); const m = d.getMinutes();
  if (h === 12 && m === 0) return 'midi';
  if (h === 0) return m ? `minuit ${m}` : 'minuit';
  return `${h} heure${h > 1 ? 's' : ''}${m ? ' ' + m : ''}`;
}

// « pain, lait et café »
export function enumerer(l) {
  if (l.length <= 1) return l.join('');
  return l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1];
}
