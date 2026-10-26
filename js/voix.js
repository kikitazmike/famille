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

const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
const JOURS_RE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function trouverDate(t) {
  const n = sansAccent(t);
  const auj = debutJour(new Date());
  let m;
  if (/apres[- ]demain/.test(n)) return { date: ajouterJours(auj, 2), re: /apr[eè]s[- ]demain/i };
  if (/\bdemain\b/.test(n)) return { date: ajouterJours(auj, 1), re: /\bdemain\b/i };
  if (/\baujourd'?hui\b|\bce soir\b|\bce matin\b|\bcet apres[- ]midi\b/.test(n)) return { date: auj, re: /\baujourd'?hui\b|\bce soir\b|\bce matin\b|\bcet apr[eè]s[- ]midi\b/i };
  if ((m = n.match(/\b(le\s+)?(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/))) {
    const mois = MOIS.map(sansAccent).indexOf(m[3]);
    let d = new Date(auj.getFullYear(), mois, Number(m[2]));
    if (d < auj) d = new Date(auj.getFullYear() + 1, mois, Number(m[2]));
    // 29 février d'une année non bissextile, 31 avril… : date impossible, on l'ignore
    if (d.getMonth() !== mois) return { date: null, invalide: true, re: /$^/ };
    return { date: d, re: new RegExp(`\\b(le\\s+)?${m[2]}(?:er)?\\s+${m[3].replace(/e/g, '[eéè]').replace(/u/g, '[uû]')}\\b`, 'i') };
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
  const re = /(?:(?:^|\s)(?:à|a|vers)\s+|\b)(\d{1,2})\s*(?:heures?|h|:)\s*(\d{2})?(?![\d])/i;
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
  if (/^\d+$/.test(txt.trim())) return Number(txt);
  let total = 0;
  for (const m of txt.toLowerCase().split(/[\s-]+/)) { if (m in UNITES) total += UNITES[m]; }
  return total;
}
export function chiffrer(t) {
  const MOIS_RE = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre';
  // « quatorze heures trente », « neuf heures et quart », « dix heures moins le quart »
  t = t.replace(new RegExp(`\\b(${NB}|\\d{1,2})\\s*(?:heures?|h)(?:\\s+(et quart|et demie|moins le quart|moins quart|${NB}|[0-5]\\d))?(?![\\wà-ÿ])`, 'gi'), (x, h, m) => {
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

const ARTICLES = /^(?:de l'|d'|l'|(?:du|de la|des|de|un|une|le|la|les)\s+)/i;
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

  // Sucre : « est-ce que le Coca c'est bon pour moi ? », « je peux manger une banane ? », « combien de sucre dans les lasagnes ? »
  {
    const q = nb0.replace(/\?/g, '').replace(/\s+/g, ' ').trim();
    const motifs = [
      /^(?:est[- ]ce que |est[- ]ce qu')?(?:je peux|j'ai le droit de|j'ai droit a|on peut|je pourrais|puis[- ]je)\s+(?:manger|boire|prendre|avaler|grignoter)\s+(.+?)(?:\s+(?:ou pas|ou non))?$/,
      /^(?:est[- ]ce que |est[- ]ce qu')?(.+?)\s*,?\s*(?:c'?est|c est|est[- ]ce|est|sont|ce sont|ca reste|il est|elle est)\s+(?:bon|bien|ok|autorise|permis|mauvais|interdit|conseille|trop sucre|sucres?|tres sucres?|riche en sucre)\s*(?:pour moi|pour ma sante|pour mon regime)?(?:\s+(?:ou pas|ou non))?$/,
      /^(?:est[- ]ce que |est[- ]ce qu')?(.+?)\s+(?:est[- ]il|est[- ]elle|sont[- ]ils|sont[- ]elles)\s+(?:bon|bons|bonne|bonnes|bien|ok|autorises?|permis|mauvais|trop sucres?|sucres?|tres sucres?)\s*(?:pour moi|pour ma sante)?$/,
      /^(?:c'?est|est[- ]ce que c'?est|y a[- ]t[- ]il)\s+(?:bon|trop sucre|sucre|beaucoup de sucre)\s+(?:pour moi\s+)?(?:le |la |les |l'|un |une |du |de la |des |dans (?:le |la |les |l')?)?(.+)$/,
      /^(?:combien (?:de |y a[- ]t[- ]il de |il y a de |ya de )?(?:grammes? de )?sucres?|quelle quantite de sucre|y a[- ]t[- ]il (?:du|beaucoup de) sucre|il y a (?:du|beaucoup de) sucre|(?:le |la )?(?:taux|teneur|quantite) (?:de|en) sucre)\s+(?:y a[- ]t[- ]il\s+|il y a\s+)?(?:dans|pour|du|de la|des|de l'|de)\s+(.+)$/,
      /^(?:sucre|niveau de sucre|teneur en sucre)\s*:?\s+(?:du |de la |des |de l'|dans )?(.+)$/
    ];
    for (const re of motifs) {
      const mm = q.match(re);
      if (!mm) continue;
      let nom = mm[1].replace(/^(?:le |la |les |l'|un |une |du |de la |des |de l'|d'|de |mon |ma |mes |ce |cette |ces )/, '')
        .replace(/^(?:verre|canette|bouteille|tasse|bol|part|morceau|tranche|carre|cuillere|poignee|pot|assiette|portion)s? (?:de |d')/, '')
        .replace(/^(?:le |la |les |l'|du |de la |des )/, '').replace(/\s+(?:ce soir|ce midi|aujourd'hui|demain|maintenant|le soir|le matin)$/, '').trim();
      if (!nom || nom.length > 60 || /^(rendez|rdv|la table|ca|cela|ceci)\b/.test(nom)) continue;
      // On reprend les mots d'origine (avec accents) pour l'affichage
      const mots = brut.replace(/\?/g, '').split(/\s+/); const cles = mots.map((w) => sansAccent(w)); const cible = nom.split(' ');
      let affiche = nom;
      for (let i = 0; i + cible.length <= cles.length; i++) { if (cible.every((w, j) => cles[i + j] === w)) { affiche = mots.slice(i, i + cible.length).join(' '); break; } }
      return { type: 'sucre', nom: affiche, texte: brut };
    }
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
      if (!texteMsg || /^(de|d'|que|qu'|qu)$/i.test(texteMsg)) return { type: 'inconnu', texte: brut };
      return { type: 'message', pour: p, texte: majuscule(texteMsg), texteBrut: brut };
    }
  }

  let t = chiffrer(brut);
  const n = sansAccent(t);

  // Repas : « ajoute les ingrédients des lasagnes », « montre les recettes », « qu'est-ce qu'on mange ce soir ? »
  {
    const mi = nb0.match(/^(?:ajoute|ajouter|mets|mettre|met|rajoute)\s+(?:tous\s+)?(?:les\s+)?ingredients\s+(?:de la |de l'|des |du |de |d'|pour (?:la |le |les |l')?)\s*(.+)$/);
    if (mi) return { type: 'repas', action: 'ingredients', nom: mi[1].trim(), texte: brut };
    if (/^(montre|montrer|affiche|afficher|ouvre|ouvrir|voir|fais voir)[- ]?(moi|nous)?\s+(les\s+|la\s+|le\s+)?(repas|recettes?|menus?|liste des repas)\b/.test(n)) return { type: 'question', sujet: 'repas', montrer: true, texte: t };
  }

  // « Météo », « la météo de demain »
  const montrer = /^(montre|montrer|affiche|afficher|ouvre|ouvrir|voir|fais voir|regarde)\b/.test(n);
  const nm = n.replace(/^(montre|montrer|affiche|afficher|ouvre|ouvrir|voir|fais voir|regarde|donne|dis)[- ]?(moi|nous)?\s+/, '');
  if (/^(la\s+|le\s+|les\s+)?(meteo|temps|previsions?)\b/.test(nm) && (/meteo|previsions?/.test(nm) || /^(le\s+)?temps\b(\s+(qu'il|de|du|pour|d'|cette|ce|aujourd|demain|apres)|$)/.test(nm))) {
    const d = trouverDate(t);
    return { type: 'question', sujet: 'meteo', date: d ? d.date : null, semaine: /\bsemaine\b/.test(n), montrer, texte: t };
  }
  // Questions : « qu'est-ce qu'on a demain ? », « c'est quand l'anniversaire de Lucas ? »…
  const nq = n.replace(/\?/g, '').trim();
  const DEBUT_Q = /^(qu'?\s*est[- ]?ce|qu'?y a[- ]t[- ]il|qu'avons|quoi|quand|c'?est quand|c'?est quoi|quel|quelle|quels|quelles|est[- ]?ce qu(?:e|')|on a quoi|j'ai quoi|ai[- ]je|avons[- ]nous|y a[- ]t[- ]il|il y a quoi|y a quoi|dis[- ]?moi|donne[- ]?moi|lis|lire|relis|montre|affiche|afficher|ouvre|ouvrir|fais voir|combien|on fait quoi|on mange|qui|quelle heure|il est quelle heure|il va|il fait|va[- ]t[- ]il|fait[- ]il|(le\s+)?programme\s+(de|d'|pour|du)|quoi de (prevu|neuf))\b/;
  if (DEBUT_Q.test(nq) || /\b(on a quoi|il y a quoi|c'?est quand|y a[- ]t[- ]il|de prevu|est prevu)\b/.test(nq) || /\?\s*$/.test(t)) {
    const d = trouverDate(t);
    let sujet = 'agenda';
    if (/meteo|quel temps|temps fait|temps va|temps demain|pleuv|pleu|pluie|temperature|degres|froid|chaud|soleil|neige|beau|moche|nuage|vent|parapluie/.test(nq)) sujet = 'meteo';
    else if (/anniv/.test(nq)) sujet = 'anniv';
    else if (/poubelle|ordure|dechet|tri\b/.test(nq)) sujet = 'poubelle';
    else if (/\bon mange\b|\bmanger\b|\brepas\b|\bmenu\b|\brecette|a cuisiner|au diner|pour le diner|pour diner/.test(nq)) sujet = 'repas';
    else if (/course|acheter|liste|manque|frigo|placard/.test(nq)) sujet = 'courses';
    else if (/\bnotes?\b|memo|pense[- ]bete/.test(nq)) sujet = 'notes';
    else if (/message/.test(nq)) sujet = 'messages';
    else if (/tache|corvee|menage|vaisselle|aspirateur|ranger/.test(nq)) sujet = 'taches';
    else if (/minuteur|minuterie|chrono/.test(nq)) sujet = 'minuteur';
    else if (/quelle heure|l'heure qu'il|il est quelle heure/.test(nq)) sujet = 'heure';
    else if (/reglage|parametre/.test(nq)) sujet = 'reglages';
    else if (/planning|horaire|travail|bosse/.test(nq)) sujet = 'planning';
    const semaine = /\bsemaine\b/.test(nq);
    return { type: 'question', sujet, date: d ? d.date : null, semaine, montrer, texte: t };
  }

  // Notes
  let m = brut.match(DEBUT_NOTE);
  if (m) return { type: 'note', texte: majuscule(m[1].trim()) };

  // Courses
  const ACTIONS = /^(mets|met|mettre)\s+(la table|le couvert|la musique|la radio|la tele|la television)\b/;
  m = !/rendez|rdv|reunion|evenement/.test(n) && !/^(il )?faut qu/.test(n) && !ACTIONS.test(n) && !/\b(a|vers)\s+\d{1,2}\s*h/.test(n) && brut.match(RE_COURSE);
  if (m) {
    const reste = m[1].replace(FIN_LISTE, '').trim();
    if (reste) {
      const noms = reste.split(/\s*(?:,|\bet\b|\bpuis\b|\bavec\b)\s*/i).map((x) => x.replace(ARTICLES, '').trim()).filter(Boolean);
      if (noms.length) return { type: 'course', noms: noms.map(majuscule) };
    }
  }

  // Rendez-vous
  const dt = trouverDate(t); if (dt && dt.invalide) return { type: 'inconnu', texte: t, raison: 'date' };
  const date = dt;
  // Plage « de 14 h à 16 h », « entre 9 h et 11 h 30 »
  const rp = /\b(?:de|entre)\s+(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\s*(?:à|a|-|et|jusqu'à)\s+(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?\b/i;
  const pl = t.match(rp);
  // Durée « pendant 2 heures », « pendant 45 minutes » (retirée avant de chercher l'heure)
  const rdur = /\s*\bpendant\s+(\d{1,3})\s*(h|heures?|min|minutes?|mn)(?:\s*(\d{2}))?\b/i;
  const pd = t.match(rdur);
  const dureeMin = pd ? (/^h/i.test(pd[2]) ? Number(pd[1]) * 60 + Number(pd[3] || 0) : Number(pd[1])) : 0;
  let heure = trouverHeure(pd ? t.replace(rdur, ' ') : t); let finH = null;
  if (pl && Number(pl[1]) < 24 && Number(pl[3]) < 24) { heure = { h: Number(pl[1]), min: Number(pl[2] || 0), re: rp }; finH = { h: Number(pl[3]), min: Number(pl[4] || 0) }; }
  const motsT = brut.split(/\s+/).length;
  // « pain pour demain » : un article pour un jour, pas un rendez-vous
  const articlePourJour = motsT <= 4 && /\bpour\s+(demain|apres[- ]demain|ce soir|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(n);
  if (DEBUT_RDV.test(t) || (date && heure) || (heure && (pl || /(?:^|\s)(a|à|vers)\s+\d{1,2}\s*h/i.test(t)) && motsT <= 8) || (date && !articlePourJour && motsT >= 2 && motsT <= 8)) {
    let titre = t;
    if (date) titre = titre.replace(date.re, ' ');
    if (heure) titre = titre.replace(heure.re, ' ');
    if (pd) titre = titre.replace(rdur, ' ');
    if (!/^r[ée]union/i.test(titre.trim())) titre = titre.trim().replace(DEBUT_RDV, '').trim();
    titre = titre.replace(/^(?:(?:avec|chez|pour|de)\b|:)\s*/i, (x) => (/^(avec|chez)/i.test(x) ? x : ''));
    titre = titre.replace(/^(?:de\s+|d')/i, '');
    const qui = prenoms.filter((p) => new RegExp(`\\b${sansAccent(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(sansAccent(titre)));
    titre = titre.replace(/\s+(pour|avec|le|à|a)\s*$/i, '').replace(/\s+/g, ' ').trim();
    const d = date ? new Date(date.date) : debutJour(new Date());
    if (heure) d.setHours(heure.h, heure.min, 0, 0); else d.setHours(9, 0, 0, 0);
    let fin = null;
    if (heure && finH) { fin = new Date(d); fin.setHours(finH.h, finH.min, 0, 0); if (fin <= d) fin = null; }
    if (heure && !fin && dureeMin > 0 && dureeMin <= 24 * 60) fin = new Date(d.getTime() + dureeMin * 60000);
    return { type: 'rdv', titre: majuscule(titre || 'Rendez-vous'), debut: d, fin, journee: !heure, qui };
  }

  // Phrase courte sans verbe : on suppose un article de courses
  if (ACTIONS.test(n)) return { type: 'inconnu', texte: t };
  const MOTS_ACTION = /^(note|notes|ajoute|ajouter|rajoute|mets|met|tablette|aide|help|merci|oui|non|ok|okay|stop|annule|rien|bonjour|salut|test|essai|courses?|liste|agenda|rendez[- ]vous|rdv|message|messages|minuteur|meteo|reglages?|parametres)$/;
  if (MOTS_ACTION.test(n.trim())) return { type: 'inconnu', texte: t };
  if (/^(mets|met|mettre|fais|fait|range|ranger|appelle|appeler|va|vas|sors|sortir|ferme|ouvre)\b/.test(n) && !RE_COURSE.test(brut)) return { type: 'inconnu', texte: t };
  if (t.split(' ').length <= 4) { const nom = t.replace(/\s+pour\s+(demain|apr[eè]s[- ]demain|ce soir|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*$/i, '').replace(ARTICLES, ''); if (nom.split(' ').length <= 3) return { type: 'course', noms: [majuscule(nom)] }; }
  return { type: 'inconnu', texte: t };
}

function majuscule(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
