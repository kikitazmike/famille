// Reconnaissance vocale (navigateur) et compréhension de phrases simples
import { ajouterJours, debutJour, jourIso, MOIS } from './dates.js';

export const voixDisponible = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export function ecouter({ continu = false } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error('La dictée vocale n\'est pas disponible sur cet appareil (utilise Chrome).'));
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = continu;
    let fini = false;
    r.onresult = (e) => { fini = true; resolve(e.results[0][0].transcript); };
    r.onerror = (e) => {
      fini = true;
      const m = { 'no-speech': 'Je n\'ai rien entendu.', 'not-allowed': 'Autorise le micro pour utiliser la voix.', 'network': 'La dictée a besoin d\'Internet.', 'audio-capture': 'Aucun micro trouvé.' }[e.error];
      reject(new Error(m || 'Dictée interrompue.'));
    };
    r.onend = () => { if (!fini) reject(new Error('Je n\'ai rien entendu.')); };
    r.start();
    ecouter.arreter = () => { try { r.stop(); } catch (e) { /* ignore */ } };
  });
}

const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const JOURS_RE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function trouverDate(t) {
  const n = sansAccent(t);
  const auj = debutJour(new Date());
  let m;
  if (/apres[- ]demain/.test(n)) return { date: ajouterJours(auj, 2), re: /apr[eè]s[- ]demain/i };
  if (/\bdemain\b/.test(n)) return { date: ajouterJours(auj, 1), re: /\bdemain\b/i };
  if (/\baujourd'?hui\b|\bce soir\b|\bce matin\b|\bcet apres[- ]midi\b/.test(n)) return { date: auj, re: /\baujourd'?hui\b/i };
  if ((m = n.match(/\b(le\s+)?(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/))) {
    const mois = MOIS.map(sansAccent).indexOf(m[3]);
    let d = new Date(auj.getFullYear(), mois, Number(m[2]));
    if (d < auj) d = new Date(auj.getFullYear() + 1, mois, Number(m[2]));
    return { date: d, re: new RegExp(`\\b(le\\s+)?${m[2]}\\s+${m[3].replace(/e/g, '[eéè]').replace(/u/g, '[uû]')}\\b`, 'i') };
  }
  for (let i = 0; i < 7; i++) {
    const re = new RegExp(`\\b(${JOURS_RE[i]})( prochain)?\\b`);
    if (re.test(n)) {
      let ecart = (i + 1 - jourIso(auj) + 7) % 7; if (ecart === 0) ecart = 7;
      return { date: ajouterJours(auj, ecart), re: new RegExp(`\\b(ce\\s+|le\\s+)?${JOURS_RE[i]}( prochain)?\\b`, 'i') };
    }
  }
  return null;
}

function trouverHeure(t) {
  const re = /\b(?:à|a|vers)?\s*(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/i;
  const m = t.match(re);
  if (!m) {
    if (/\bmidi\b/i.test(t)) return { h: 12, min: 0, re: /\b(à\s+)?midi\b/i };
    return null;
  }
  const h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return { h, min, re };
}

// Renvoie { type: 'course'|'note'|'rdv'|'inconnu', ... }
export function comprendre(texte, prenoms = []) {
  let t = (texte || '').trim().replace(/\s+/g, ' ');
  const n = sansAccent(t);
  if (!t) return { type: 'inconnu' };

  // Notes
  let m = t.match(/^(?:nouvelle\s+note|prends?\s+(?:une\s+)?note|note|noter|écris|ecris)\s*[:,]?\s*(?:que\s+)?(.+)$/i);
  if (m) return { type: 'note', texte: majuscule(m[1]) };

  // Courses
  m = t.match(/^(?:ajoute|rajoute|mets|met|achète|achete|acheter|il faut|il manque|on n'a plus de|plus de)\s+(?:du\s+|de la\s+|de l'|des\s+|un\s+|une\s+|le\s+|la\s+|les\s+)?(.+?)(?:\s+(?:à|a|dans|sur)\s+la\s+liste(?:\s+de(?:s)?\s+courses?)?|\s+aux\s+courses|\s+dans\s+les\s+courses)?$/i);
  if (m && !/rendez|rdv/.test(n)) {
    const noms = m[1].split(/\s*(?:,|\bet\b)\s*/i).map((x) => x.replace(/^(?:du|de la|de l'|des|un|une|le|la|les)\s+/i, '').trim()).filter(Boolean);
    return { type: 'course', noms: noms.map(majuscule) };
  }

  // Rendez-vous
  const date = trouverDate(t);
  const heure = trouverHeure(t);
  if (/^(rendez[- ]vous|rdv|rappelle|ajoute un rendez|événement|evenement)/.test(n) || (date && heure)) {
    let titre = t;
    if (date) titre = titre.replace(date.re, ' ');
    if (heure) titre = titre.replace(heure.re, ' ');
    titre = titre.replace(/^(ajoute\s+)?(un\s+)?(rendez[- ]vous|rdv|événement|evenement)\s*(avec|chez|pour|de|:)?\s*/i, (x, a, b, c, d) => d ? d + ' ' : '');
    const qui = prenoms.filter((p) => new RegExp(`\\b${sansAccent(p)}\\b`).test(sansAccent(titre)));
    titre = titre.replace(/\s+(pour|avec)\s*$/i, '').replace(/\s+/g, ' ').trim();
    const d = date ? new Date(date.date) : debutJour(new Date());
    if (heure) d.setHours(heure.h, heure.min, 0, 0); else d.setHours(9, 0, 0, 0);
    return { type: 'rdv', titre: majuscule(titre || 'Rendez-vous'), debut: d, journee: !heure, qui };
  }

  // Phrase courte sans verbe : on suppose un article de courses
  if (t.split(' ').length <= 3) return { type: 'course', noms: [majuscule(t)] };
  return { type: 'inconnu', texte: t };
}

function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
