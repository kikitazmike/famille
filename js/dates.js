// Outils de dates (heure locale de l'appareil)
export const JOURS_COURTS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const debutJour = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// 1 = lundi … 7 = dimanche
export const jourIso = (d) => ((d.getDay() + 6) % 7) + 1;
export const debutSemaine = (d) => ajouterJours(debutJour(d), 1 - jourIso(d));
export const deux = (n) => String(n).padStart(2, '0');
export const hhmm = (d) => `${deux(d.getHours())}:${deux(d.getMinutes())}`;
export const isoDate = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
export const dateLongue = (d) => `${JOURS[jourIso(d) - 1]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
export const majuscule = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export function depuis(dateIso) {
  const s = Math.round((Date.now() - new Date(dateIso).getTime()) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = Math.floor(s / 86400);
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} jours`;
  return new Date(dateIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Occurrences d'un événement (avec répétition) entre deux instants
export function occurrences(ev, de, a) {
  const debut = new Date(ev.debut);
  const fin = ev.fin ? new Date(ev.fin) : new Date(debut.getTime() + (ev.journee_entiere ? 86400000 : 3600000));
  const duree = Math.max(0, fin - debut);
  const rep = ev.repetition || 'aucune';
  const res = [];
  if (rep === 'aucune') {
    if (debut < a && fin > de) res.push({ ev, debut, fin });
    return res;
  }
  const limite = ev.repetition_fin ? ajouterJours(debutJour(new Date(ev.repetition_fin + 'T00:00:00')), 1) : null;
  const jours = (ev.jours_semaine && ev.jours_semaine.length) ? ev.jours_semaine : [jourIso(debut)];
  let jour = debutJour(new Date(Math.max(de.getTime() - duree, debutJour(debut).getTime())));
  for (let i = 0; i < 400 && jour < a; i++, jour = ajouterJours(jour, 1)) {
    if (limite && jour >= limite) break;
    let ok = false;
    if (rep === 'jour') ok = true;
    else if (rep === 'semaine') ok = jours.includes(jourIso(jour));
    else if (rep === 'mois') ok = jour.getDate() === debut.getDate();
    else if (rep === 'annee') ok = jour.getDate() === debut.getDate() && jour.getMonth() === debut.getMonth();
    if (!ok) continue;
    const d = new Date(jour); d.setHours(debut.getHours(), debut.getMinutes(), 0, 0);
    if (d < debut) continue;
    const f = new Date(d.getTime() + duree);
    if (d < a && f > de) res.push({ ev, debut: d, fin: f });
  }
  return res;
}

export function libelleRepetition(ev) {
  const r = ev.repetition || 'aucune';
  if (r === 'jour') return 'tous les jours';
  if (r === 'semaine') {
    const j = (ev.jours_semaine && ev.jours_semaine.length) ? ev.jours_semaine : [jourIso(new Date(ev.debut))];
    if (j.length === 7) return 'tous les jours';
    if (j.length === 5 && [1, 2, 3, 4, 5].every((x) => j.includes(x))) return 'en semaine';
    return 'chaque ' + j.sort().map((x) => JOURS[x - 1]).join(', ');
  }
  if (r === 'mois') return 'tous les mois';
  if (r === 'annee') return 'tous les ans';
  return '';
}

// Prochain anniversaire à partir de "MM-JJ"
export function prochainAnniv(moisJour, annee) {
  const [m, j] = (moisJour || '').split('-').map(Number);
  if (!m || !j) return null;
  const auj = debutJour(new Date());
  let d = new Date(auj.getFullYear(), m - 1, j);
  if (d < auj) d = new Date(auj.getFullYear() + 1, m - 1, j);
  const dans = Math.round((d - auj) / 86400000);
  const age = annee ? d.getFullYear() - annee : null;
  return { date: d, dans, age };
}

// Prochaine date d'une tâche hebdomadaire (jour 1..7)
export function prochaineTache(jourSemaine, faitLe) {
  const auj = debutJour(new Date());
  let ecart = (jourSemaine - jourIso(auj) + 7) % 7;
  let d = ajouterJours(auj, ecart);
  if (faitLe && isoDate(d) === faitLe) d = ajouterJours(d, 7);
  return d;
}
