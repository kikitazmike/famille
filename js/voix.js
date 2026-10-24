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
  const re = /(?:(?:^|\s)(?:à|a|vers)\s+|\b)(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?(?![\d])/i;
  const m = t.match(re);
  if (!m) {
    if (/\bmidi\b/i.test(t)) return { h: 12, min: 0, re: /\s*(?:à\s+|\ba\s+)?midi\b/i };
    return null;
  }
  const h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return { h, min, re };
}

// Nombres écrits en lettres (Vosk) → chiffres, seulement pour les heures et les dates
const UNITES = { zero: 0, 'zéro': 0, un: 1, une: 1, premier: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50 };
const MOT_NB = Object.keys(UNITES).join('|');
const NB = `(?:${MOT_NB})(?:(?:[\\s-]+et[\\s-]+|[\\s-]+)(?:${MOT_NB}))*`;
function valeur(txt) {
  let total = 0;
  for (const m of txt.toLowerCase().split(/[\s-]+/)) { if (m in UNITES) total += UNITES[m]; }
  return total;
}
export function chiffrer(t) {
  const MOIS_RE = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre';
  // « quatorze heures trente », « neuf heures et quart », « dix heures moins le quart »
  t = t.replace(new RegExp(`\\b(${NB})\\s+heures?(?:\\s+(et quart|et demie|moins le quart|moins quart|${NB}))?(?![\\wà-ÿ])`, 'gi'), (x, h, m) => {
    let hh = valeur(h); let mm = 0;
    if (m) {
      const ml = m.toLowerCase();
      if (ml === 'et quart') mm = 15; else if (ml === 'et demie') mm = 30;
      else if (ml.startsWith('moins')) { hh -= 1; mm = 45; } else mm = valeur(m);
    }
    return `${hh} h ${String(mm).padStart(2, '0')}`;
  });
  t = t.replace(/\bmidi et demie?\b/gi, '12 h 30').replace(/\bminuit\b/gi, '0 h 00');
  // « le douze mars », « premier mai »
  t = t.replace(new RegExp(`\\b(${NB})\\s+(${MOIS_RE})\\b`, 'gi'), (x, n, mo) => `${valeur(n)} ${mo}`);
  return t;
}

// Nettoie la phrase : « tablette, est-ce que tu peux ajouter du pain s'il te plaît » → « ajouter du pain »
export function nettoyer(t) {
  t = (t || '').replace(/[’`]/g, "'").replace(/'\s+/g, "'").replace(/\s+/g, ' ').trim();
  t = t.replace(/[.!]+$/, '').trim();
  let avant;
  do {
    avant = t;
    t = t.replace(/^(?:bonjour|salut|coucou|bonsoir)\s*[,]?\s+(?=\S+\s+\S)/i, '')
      .replace(/^(?:(?:ok|dis|hey|eh|allez)\s+)?(?:tablette|maison)\s*[,:]?\s+/i, '')
      .replace(/^(?:est[- ]ce\s+que\s+|est[- ]ce\s+qu')?(?:tu\s+peux|peux[- ]tu|tu\s+pourrais|pourrais[- ]tu|vous\s+pouvez|pouvez[- ]vous|tu\s+veux\s+bien|merci\s+de|merci\s+d')\s*/i, '')
      .replace(/^(?:s'il\s+te\s+pla[iî]t|s'il\s+vous\s+pla[iî]t|stp|svp)\s*[,:]?\s*/i, '')
      .replace(/^(?:je\s+voudrais|j'aimerais|je\s+veux|on\s+voudrait|on\s+veut|j'ai\s+besoin\s+d'|j'ai\s+besoin\s+de)\s+(?=(?:ajouter|rajouter|mettre|acheter|noter|écrire|ecrire|prendre|savoir|connaître|connaitre|un|une|des|du|de|le|la|les)\b)/i, '')
      .replace(/^(?:savoir|connaître|connaitre)\s+/i, '')
      .replace(/^(?:me|nous)\s+(?:dire|donner|lire)\s+/i, 'dis-moi ')
      .replace(/\s*[,]?\s*(?:s'il\s+te\s+pla[iî]t|s'il\s+vous\s+pla[iî]t|stp|svp|merci(?:\s+beaucoup)?)\s*$/i, '')
      .trim();
  } while (t !== avant);
  return t;
}

const ARTICLES = /^(?:(?:du|de la|des|de|un|une|le|la|les)\s+|(?:de l'|d'|l'))/i;
const VERBES_COURSES = [
  "n'oublie pas d'acheter", "oublie pas d'acheter", "n'oublie pas de prendre", "pense à acheter", "penser à acheter", "pense à prendre", 'pense a acheter',
  'il faudrait acheter', 'il faudrait', 'il nous faut', 'il faut acheter', 'il faut racheter', 'il faut', 'faut acheter', 'faut',
  "il n'y a plus de", "il n'y a plus d'", 'il y a plus de', "n'y a plus de", 'y a plus de', "on n'a plus de", "on n'a plus d'", 'on a plus de', "nous n'avons plus de", 'plus de', "plus d'",
  'on a besoin de', "on a besoin d'", 'besoin de', 'il manque', 'manque',
  'ajoute', 'ajouter', 'rajoute', 'rajouter', 'mets', 'met', 'mettre', 'remets', 'achète', 'achete', 'acheter', 'rachète', 'racheter', 'prends', 'prendre',
  'liste de courses', 'liste des courses', 'courses', 'course'
];
const reVerbes = (l) => l.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'").replace(/ /g, '\\s+')).join('|');
const RE_COURSE = new RegExp(`^(?:${reVerbes(VERBES_COURSES)})(?:\\s*[:,]\\s*|\\s+|(?<='))(.+)$`, 'i');
const FIN_LISTE = /\s+(?:à|a|dans|sur|sur\s+la|pour)\s+(?:la\s+|ma\s+|notre\s+)?(?:liste(?:\s+de(?:s)?\s+courses?)?|courses)\s*$|\s+(?:aux|dans\s+les|pour\s+les)\s+courses\s*$/i;

const DEBUT_NOTE = /^(?:ajoute\s+une\s+note|ajouter\s+une\s+note|nouvelle\s+note|fais\s+une\s+note|prends?\s+(?:une\s+)?note|prendre\s+(?:une\s+)?note|note|noter|écris|ecris|écrire|ecrire|mémo|memo|pense[- ]bête|pense[- ]bete|retiens\s+que|retenir\s+que|rappelle[- ]toi\s+que|souviens[- ]toi\s+que|n'oublie\s+pas\s+que|oublie\s+pas\s+que)(?:\s*[:,]\s*|\s+)(?:que\s+|qu')?(.+)$/i;

const DEBUT_RDV = /^(?:ajoute(?:r)?\s+(?:un\s+)?rendez[- ]vous|prends?\s+(?:un\s+)?rendez[- ]vous|prendre\s+(?:un\s+)?rendez[- ]vous|nouveau\s+rendez[- ]vous|rendez[- ]vous|rdv|ajoute(?:r)?\s+(?:un\s+)?(?:événement|evenement)|(?:événement|evenement)|réunion|reunion|rappelle[- ]moi|rappelle[- ]nous|rappelle|programme\s+(?:un|une)|planifie|réserve|reserve|j'ai\s+(?:un\s+|une\s+)?|on\s+a\s+(?:un\s+|une\s+)|nous\s+avons\s+(?:un\s+|une\s+)?)/i;

// Durée d'un minuteur en secondes : « dix minutes », « 1 h 30 », « un quart d'heure », « une heure et demie »
const NBX = `(?:\\d+|${NB})`;
const nb = (x) => (/^\d+$/.test(x) ? Number(x) : valeur(x));
export function duree(texte) {
  const n = sansAccent(texte);
  let s = 0; let ok = false;
  if (/\bquart d'?heure\b/.test(n)) { s += 900; ok = true; }
  if (/\bdemi[- ]heure\b/.test(n)) { s += 1800; ok = true; }
  let m = n.match(new RegExp(`\\b(${NBX})\\s*(?:h|heures?)\\b(?:\\s*(et demie?|et quart|${NBX})(?!\\s*(?:sec|min)))?`));
  if (m) { s += nb(m[1]) * 3600; if (m[2]) s += /demi/.test(m[2]) ? 1800 : /quart/.test(m[2]) ? 900 : nb(m[2]) * 60; ok = true; }
  m = n.match(new RegExp(`\\b(${NBX})\\s*(?:min|minutes?|mn)\\b(?:\\s*(et demie?|${NBX})(?!\\s*(?:h|heure)))?`));
  if (m) { s += nb(m[1]) * 60; if (m[2]) s += /demi/.test(m[2]) ? 30 : nb(m[2]); ok = true; }
  m = n.match(new RegExp(`\\b(${NBX})\\s*(?:s|sec|secondes?)\\b`));
  if (m) { s += nb(m[1]); ok = true; }
  return ok && s > 0 ? Math.min(s, 24 * 3600) : null;
}

// Renvoie { type: 'course'|'note'|'rdv'|'question'|'minuteur'|'message'|'inconnu', ... }
export function comprendre(texte, prenoms = []) {
  const brut = nettoyer(texte);
  if (!brut) return { type: 'inconnu' };
  const nb0 = sansAccent(brut);

  // Résumé du jour, seulement sur demande : « bonjour », « le point de la journée »
  if (/^(bonjour|salut|coucou|bonsoir|hello)(\s+(tablette|la famille|tout le monde|maison))?$/.test(nb0) || /\b(le point|resume|recap)\b.*\b(jour|journee|aujourd'hui)\b|^(c'?est quoi |quelle est )?(ma|notre|la) journee\b|^(le point|resume|recap)$/.test(nb0)) {
    return { type: 'question', sujet: 'resume', texte: brut };
  }

  // Minuteur
  if (/\b(minuteur|minuterie|chrono|timer|compte a rebours)\b/.test(nb0) || /^(sonne|reveille[- ]moi|previens[- ]moi|rappelle[- ]moi)\s+dans\b/.test(nb0)) {
    if (/\b(arrete|stop|annule|supprime|coupe|enleve|efface)\b/.test(nb0)) return { type: 'minuteur', action: 'stop', texte: brut };
    if (/\b(combien|reste|restant)\b/.test(nb0)) return { type: 'minuteur', action: 'reste', texte: brut };
    const sec = duree(brut);
    if (sec) {
      let nom = nb0.replace(new RegExp(`\\b(${NBX})\\s*(?:h|heures?|min|minutes?|mn|s|sec|secondes?)\\b(\\s*(et demie?|et quart|${NBX}))?`, 'g'), ' ')
        .replace(/\b(quart d'?heure|demi[- ]heure|ajoute|lance|mets|met|demarre|programme|un|une|de|d'|du|pour|les|le|la|minuteur|minuterie|chrono|timer|compte a rebours|sonne|reveille[- ]moi|previens[- ]moi|rappelle[- ]moi|dans)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      const motsNom = new Set(nom.split(' ').filter(Boolean));
      nom = brut.split(/\s+/).filter((w) => motsNom.has(sansAccent(w).replace(/[^a-z0-9'-]/g, ''))).join(' ');
      return { type: 'minuteur', action: 'lancer', secondes: sec, nom: nom ? majuscule(nom) : '', texte: brut };
    }
    return { type: 'minuteur', action: 'sansduree', texte: brut };
  }

  // Messages : « dis à Lucas de sortir le chien », « préviens tout le monde que le repas est prêt »
  {
    const qui = `(${[...prenoms.map((p) => sansAccent(p)), 'tout le monde', 'tous', 'toute la famille', 'la famille'].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
    const reM = new RegExp(`^(?:dis|dit|dire|rappelle|previens|prevenir|demande|laisse un message|envoie un message|message|un message)\\s+(?:a|à|au|pour|aux)?\\s*${qui}\\b\\s*[:,]?\\s*(?:de\\s+|d'|que\\s+|qu'|qu\\s+)?(.+)$`);
    const mm = nb0.match(reM);
    if (mm) {
      const cible = mm[1]; const p = prenoms.find((x) => sansAccent(x) === cible) || null;
      // On reprend le texte d'origine (avec accents) à partir de la même position
      const debut = nb0.length - mm[2].length; const texteMsg = brut.slice(debut).trim();
      return { type: 'message', pour: p, texte: majuscule(texteMsg), texteBrut: brut };
    }
  }

  let t = chiffrer(brut);
  const n = sansAccent(t);

  // « Météo », « la météo de demain »
  if (/^(la\s+)?meteo\b/.test(n) || /^(donne|dis)[- ]?moi la meteo/.test(n) || /^(le\s+)?temps\s+(qu'il|de|pour)\b/.test(n)) {
    const d = trouverDate(t);
    return { type: 'question', sujet: 'meteo', date: d ? d.date : null, semaine: /\bsemaine\b/.test(n), texte: t };
  }
  // Questions : « qu'est-ce qu'on a demain ? », « c'est quand l'anniversaire de Lucas ? »…
  const nq = n.replace(/\?/g, '').trim();
  const DEBUT_Q = /^(qu'?\s*est[- ]?ce|qu'?y a[- ]t[- ]il|qu'avons|quoi|quand|c'?est quand|c'?est quoi|quel|quelle|quels|quelles|est[- ]?ce qu(?:e|')|on a quoi|j'ai quoi|ai[- ]je|avons[- ]nous|y a[- ]t[- ]il|il y a quoi|y a quoi|dis[- ]?moi|donne[- ]?moi|lis|lire|relis|montre|combien|on fait quoi|on mange|il va|il fait|va[- ]t[- ]il|fait[- ]il|(le\s+)?programme\s+(de|d'|pour|du)|quoi de (prevu|neuf))\b/;
  if (DEBUT_Q.test(nq) || /\b(on a quoi|il y a quoi|c'?est quand|y a[- ]t[- ]il|de prevu|est prevu)\b/.test(nq) || /\?\s*$/.test(t)) {
    const d = trouverDate(t);
    let sujet = 'agenda';
    if (/meteo|quel temps|temps fait|temps va|temps demain|pleuv|pluie|temperature|degres|froid|chaud|soleil|neige|beau|moche|nuage|vent|parapluie/.test(nq)) sujet = 'meteo';
    else if (/anniv/.test(nq)) sujet = 'anniv';
    else if (/poubelle|ordure|dechet|tri\b/.test(nq)) sujet = 'poubelle';
    else if (/course|acheter|liste|manque|frigo|placard/.test(nq)) sujet = 'courses';
    else if (/\bnotes?\b|memo|pense[- ]bete/.test(nq)) sujet = 'notes';
    else if (/message/.test(nq)) sujet = 'messages';
    else if (/tache|corvee|menage|vaisselle|aspirateur|ranger/.test(nq)) sujet = 'taches';
    else if (/minuteur|minuterie|chrono/.test(nq)) sujet = 'minuteur';
    const semaine = /\bsemaine\b/.test(nq);
    return { type: 'question', sujet, date: d ? d.date : null, semaine, texte: t };
  }

  // Notes
  let m = t.match(DEBUT_NOTE);
  if (m) return { type: 'note', texte: majuscule(m[1].trim()) };

  // Courses
  m = !/rendez|rdv|reunion|evenement/.test(n) && t.match(RE_COURSE);
  if (m) {
    const reste = m[1].replace(FIN_LISTE, '').trim();
    if (reste) {
      const noms = reste.split(/\s*(?:,|\bet\b|\bpuis\b|\bavec\b)\s*/i).map((x) => x.replace(ARTICLES, '').trim()).filter(Boolean);
      if (noms.length) return { type: 'course', noms: noms.map(majuscule) };
    }
  }

  // Rendez-vous
  const date = trouverDate(t);
  const heure = trouverHeure(t);
  if (DEBUT_RDV.test(t) || (date && heure)) {
    let titre = t;
    if (date) titre = titre.replace(date.re, ' ');
    if (heure) titre = titre.replace(heure.re, ' ');
    if (!/^r[ée]union/i.test(titre.trim())) titre = titre.trim().replace(DEBUT_RDV, '').trim();
    titre = titre.replace(/^(?:(?:avec|chez|pour|de)\b|:)\s*/i, (x) => (/^(avec|chez)/i.test(x) ? x : ''));
    titre = titre.replace(/^(?:de\s+|d')/i, '');
    const qui = prenoms.filter((p) => new RegExp(`\\b${sansAccent(p)}\\b`).test(sansAccent(titre)));
    titre = titre.replace(/\s+(pour|avec|le|à|a)\s*$/i, '').replace(/\s+/g, ' ').trim();
    const d = date ? new Date(date.date) : debutJour(new Date());
    if (heure) d.setHours(heure.h, heure.min, 0, 0); else d.setHours(9, 0, 0, 0);
    return { type: 'rdv', titre: majuscule(titre || 'Rendez-vous'), debut: d, journee: !heure, qui };
  }

  // Phrase courte sans verbe : on suppose un article de courses
  if (t.split(' ').length <= 3) return { type: 'course', noms: [majuscule(t.replace(ARTICLES, ''))] };
  return { type: 'inconnu', texte: t };
}

function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
