// Écran de la tablette (affichage fixe à la maison)
import { sb, messageErreur } from './supa.js';
import { state, surChangement, chargerCache, viderCache, toutCharger, temps_reel, arreterTempsReel, ecrire, nouvelId, membre, personnes, liensDe, urlImage, chargerAnniv } from './store.js';
import { JOURS, JOURS_COURTS, MOIS, debutJour, ajouterJours, memeJour, jourIso, debutSemaine, hhmm, isoDate, majuscule, depuis, occurrences, prochainAnniv, prochaineTache, deux } from './dates.js';
import { i, esc } from './icones.js';
import { ecouter, comprendre, voixDisponible } from './voix.js';
import { dire, taire, heureParlee, enumerer, paroleDisponible } from './parole.js';
import { ecouterLocal, preparerVoixLocale, etatVoixLocale } from './voix-locale.js';
const micro = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const voixOk = () => (reglages.voix === 'google' ? voixDisponible() : micro() || voixDisponible());

const cadre = document.getElementById('cadre');
const scene = document.getElementById('scene');
scene.innerHTML = '<div id="vue"></div><div id="page"></div><div id="veille"></div><div id="fen"></div><div id="alerte"></div><div id="tst" aria-live="polite"></div>';
const vue = document.getElementById('vue');
const zVeille = document.getElementById('veille');
const zFen = document.getElementById('fen');
const zToast = document.getElementById('tst');
const zPage = document.getElementById('page');
const zAlerte = document.getElementById('alerte');

const REG = 'famille-tablette';
const reglages = (() => { try { return { pleinEcran: true, veilleDebut: '22:30', veilleFin: '06:30', voix: 'locale', parole: true, annonces: true, ...JSON.parse(localStorage.getItem(REG) || '{}') }; } catch (e) { return { pleinEcran: true, veilleDebut: '22:30', veilleFin: '06:30', voix: 'locale', parole: true, annonces: true }; } })();
const sauverReglages = () => { try { localStorage.setItem(REG, JSON.stringify(reglages)); } catch (e) { /* ignore */ } };

const ui = { session: null, pret: false, vue: 'jour', ref: debutJour(new Date()), page: null, derniere: Date.now(), alerte: null, ecoute: false, meteo: null, photos: [], photoIdx: 0, reveilJusqua: 0, veilleForcee: false, auth: { erreur: null, info: null }, rejoindre: { erreur: null } };

// ---------- Mise à l'échelle 1280 × 800 ----------
function echelle() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  scene.style.transform = `scale(${s})`;
}
window.addEventListener('resize', echelle);
echelle();

// ---------- Fond selon le moment de la journée ----------
const FONDS = { matin: '#FDEDE8', journee: '#FBF7F1', coucher: '#FCE9DC', soir: '#ECEBF7' };
function moment() {
  const m = ui.meteo; const n = new Date();
  const lever = m && m.lever ? new Date(m.lever) : (() => { const d = new Date(); d.setHours(7, 30, 0, 0); return d; })();
  const coucher = m && m.coucher ? new Date(m.coucher) : (() => { const d = new Date(); d.setHours(19, 0, 0, 0); return d; })();
  const onze = new Date(); onze.setHours(11, 0, 0, 0);
  if (n >= lever && n < onze) return 'matin';
  if (n >= onze && n < new Date(coucher.getTime() - 3600000)) return 'journee';
  if (n >= new Date(coucher.getTime() - 3600000) && n < new Date(coucher.getTime() + 45 * 60000)) return 'coucher';
  return n < lever && n.getHours() >= 5 ? 'matin' : 'soir';
}

// ---------- Météo (Open-Meteo, gratuit, sans clé) ----------
const CODES = { 0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Éclaircies', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte', 61: 'Pluie faible', 63: 'Pluie', 65: 'Forte pluie', 66: 'Pluie verglaçante', 67: 'Pluie verglaçante', 71: 'Neige faible', 73: 'Neige', 75: 'Forte neige', 77: 'Grains de neige', 80: 'Averses', 81: 'Averses', 82: 'Fortes averses', 85: 'Averses de neige', 86: 'Averses de neige', 95: 'Orage', 96: 'Orage et grêle', 99: 'Orage et grêle' };
// Icône selon le code météo
const iconeMeteo = (c) => (c === 0 ? 'soleil' : c <= 2 ? 'nuage' : c === 3 ? 'couvert' : c <= 48 ? 'brouillard' : c >= 95 ? 'orage' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'neige' : 'pluie');
const couleurMeteo = (c) => (c <= 2 ? '#D9774A' : c >= 95 ? '#7A5BC9' : c >= 51 ? '#3E7CB1' : '#7D8794');
async function chargerMeteo() {
  try { const c = JSON.parse(localStorage.getItem('famille-meteo') || 'null'); if (c && !ui.meteo) ui.meteo = c; } catch (e) { /* ignore */ }
  const cfg = state.config || { latitude: 47.2184, longitude: -1.5536, ville: 'Nantes' };
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.latitude}&longitude=${cfg.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max&timezone=auto&forecast_days=7`;
    const r = await fetch(u); if (!r.ok) return;
    const d = await r.json();
    const dl = d.daily; const rd = (x) => (x == null ? null : Math.round(x));
    const jours = (dl.time || []).map((t, k) => ({ date: t, code: dl.weather_code[k], min: rd(dl.temperature_2m_min[k]), max: rd(dl.temperature_2m_max[k]), pluie: dl.precipitation_probability_max ? rd(dl.precipitation_probability_max[k]) : null, mm: dl.precipitation_sum ? dl.precipitation_sum[k] : null, vent: dl.wind_speed_10m_max ? rd(dl.wind_speed_10m_max[k]) : null, uv: dl.uv_index_max ? rd(dl.uv_index_max[k]) : null, lever: dl.sunrise[k], coucher: dl.sunset[k] }));
    const h = d.hourly || {};
    const heures = (h.time || []).slice(0, 48).map((t, k) => ({ t, temp: rd(h.temperature_2m[k]), code: h.weather_code[k], pluie: h.precipitation_probability ? rd(h.precipitation_probability[k]) : null }));
    const cur = d.current || {};
    ui.meteo = {
      temp: rd(cur.temperature_2m), code: cur.weather_code, ville: cfg.ville, ressenti: rd(cur.apparent_temperature), humidite: rd(cur.relative_humidity_2m), vent: rd(cur.wind_speed_10m),
      lever: dl.sunrise[0], coucher: dl.sunset[0],
      demain: jours[1] ? { min: jours[1].min, max: jours[1].max, code: jours[1].code, pluie: jours[1].pluie } : null,
      jours, heures, le: Date.now()
    };
    localStorage.setItem('famille-meteo', JSON.stringify(ui.meteo));
    rendre();
  } catch (e) { /* hors ligne */ }
}

// ---------- Outils ----------
function toast(m, annuler) {
  zToast.innerHTML = `<div class="toast" role="status"><span>${esc(m)}</span>${annuler ? '<button data-a="annuler">Annuler</button>' : ''}</div>`;
  ui.annuler = annuler || null;
  clearTimeout(ui.tm); ui.tm = setTimeout(() => { zToast.innerHTML = ''; ui.annuler = null; }, annuler ? 7000 : 4000);
}
const couleurDe = (ids) => { const p = ids.map(membre).filter((m) => m && m.type === 'personne'); return p.length === 1 ? p[0].couleur : null; };
const tous = (ids) => { const p = personnes(); return ids.length === 0 || (p.length > 1 && p.every((x) => ids.includes(x.id))); };

// ---------- Rendu principal ----------
function enteteHtml() {
  const n = new Date();
  const taches = state.rappels.filter((r) => r.type === 'tache').map((t) => ({ ...t, d: prochaineTache(t.jour_semaine || 1, t.fait_le) }))
    .filter((t) => (t.d - debutJour(n)) / 86400000 < 7).sort((a, b) => a.d - b.d).slice(0, 3);
  const pp = taches.map((t) => {
    const ajd = memeJour(t.d, n);
    const quand = ajd ? `ce ${t.moment || 'jour'}` : `${JOURS[jourIso(t.d) - 1].slice(0, 3)}. ${t.moment || ''}`;
    return `<span class="pp ${ajd ? 'ajd' : ''}">${i('poubelle', 14, 2)}<span class="pt" style="background:${esc(t.couleur || '#8A8A8A')}"></span>${esc(majuscule(t.titre.replace(/^poubelle\s+/i, '')))} · ${esc(quand.trim())}</span>`;
  }).join('');
  const m = ui.meteo;
  let meteo = '';
  if (m) {
    const lever = m.lever ? new Date(m.lever) : null; const coucher = m.coucher ? new Date(m.coucher) : null;
    const duree = lever && coucher ? Math.round((coucher - lever) / 60000) : null;
    meteo = `<div class="meteo clic" data-a="ouvrirPage" data-v="meteo" role="button" tabindex="0" aria-label="Ouvrir la météo">
      <div><span style="color:${couleurMeteo(m.code)}">${i(iconeMeteo(m.code), 46, 1.4)}</span><div class="col"><span class="temp">${m.temp}°</span><small class="desc">${esc(CODES[m.code] || '')} · ${esc(m.ville || '')}</small></div></div>
      <div class="sep"></div>
      ${lever ? `<div><span style="color:#D9774A">${i('lever', 34, 1.6)}</span><div class="col"><small>Lever</small><strong>${hhmm(lever)}</strong></div></div>` : ''}
      ${coucher ? `<div><span style="color:#D9774A">${i('coucher', 34, 1.6)}</span><div class="col"><small>Coucher</small><strong>${hhmm(coucher)}</strong></div></div>` : ''}
      ${duree ? `<div class="sep"></div><div class="col" style="justify-content:center"><small>Durée du jour</small><strong>${Math.floor(duree / 60)} h ${deux(duree % 60)}</strong></div>` : ''}
    </div>`;
  }
  return `<header class="haut"><div class="horloge"><span class="heure">${deux(n.getHours())}<span class="dp">:</span>${deux(n.getMinutes())}</span>
      <div class="date"><b>${majuscule(JOURS[jourIso(n) - 1])}</b><span>${n.getDate()} ${MOIS[n.getMonth()]} ${n.getFullYear()}</span>
      <div class="pastilles">${pp}</div></div></div>${meteo}</header>`;
}

function occsJour(jour) {
  return state.evenements.flatMap((ev) => occurrences(ev, jour, ajouterJours(jour, 1)));
}

function vueJour(jour, estAujourdhui) {
  const n = new Date();
  const occs = occsJour(jour);
  let h0 = 7, h1 = 23;
  occs.forEach((o) => { if (!o.ev.journee_entiere) { const a = o.debut < jour ? 0 : o.debut.getHours(); const b = o.fin > ajouterJours(jour, 1) ? 24 : o.fin.getHours() + (o.fin.getMinutes() ? 1 : 0); h0 = Math.min(h0, a); h1 = Math.max(h1, b); } });
  const plage = (h1 - h0) * 3600000;
  const t0 = new Date(jour); t0.setHours(h0, 0, 0, 0);
  const pct = (d) => Math.max(0, Math.min(100, ((d - t0) / plage) * 100));
  const lever = ui.meteo && ui.meteo.lever ? new Date(ui.meteo.lever) : null;
  const coucher = ui.meteo && ui.meteo.coucher ? new Date(ui.meteo.coucher) : null;
  const decal = (d) => { if (!d) return null; const x = new Date(jour); x.setHours(d.getHours(), d.getMinutes(), 0, 0); return x; };
  const lv = decal(lever), cc = decal(coucher);
  const pas = h1 - h0 > 16 ? 3 : 2;
  const traits = []; for (let h = h0 + 1; h < h1; h++) traits.push(`<div class="trait-h" style="left:${((h - h0) / (h1 - h0)) * 100}%"></div>`);
  const nuit = `${lv ? `<div class="nuit" style="left:0;width:${pct(lv)}%"></div>` : ''}${cc ? `<div class="nuit" style="left:${pct(cc)}%;right:0"></div>` : ''}`;
  const lignes = [...personnes().map((p) => ({ id: p.id, nom: p.prenom, couleur: p.couleur })), { id: '_tous', nom: 'Tous', couleur: 'var(--accent)' }];
  const parLigne = {};
  lignes.forEach((l) => { parLigne[l.id] = []; });
  const journee = [];
  occs.forEach((o) => {
    const ids = liensDe(o.ev.id);
    if (o.ev.journee_entiere) { journee.push(o); return; }
    if (tous(ids)) parLigne._tous.push(o);
    else ids.forEach((id) => { if (parLigne[id]) parLigne[id].push(o); });
  });
  const pill = (o, coul, rang, nb) => {
    const passe = o.fin < n; const encours = o.debut <= n && o.fin > n;
    const g = pct(o.debut); const w = Math.max(pct(o.fin) - g, 5.5);
    const fondClair = passe;
    const style = `left:${g}%;width:${w}%;top:${nb > 1 ? 5 + rang * (44 / nb) + '%' : '5px'};${nb > 1 ? `height:${88 / nb}%` : 'bottom:5px'};background:${fondClair ? `color-mix(in srgb, ${coul} 18%, white)` : coul};color:${fondClair ? `color-mix(in srgb, ${coul} 80%, black)` : '#fff'}`;
    const prog = encours ? `<div class="prog" style="width:${((n - o.debut) / (o.fin - o.debut)) * 100}%"></div>` : '';
    const heure = `${passe ? i('coche', 12, 2.5) : ''}${hhmm(o.debut)}${o.ev.fin ? ' – ' + hhmm(o.fin) : ''}${o.ev.lieu ? ' · ' + esc(o.ev.lieu) : ''}`;
    return `<button class="rdv" style="${style}" data-a="voirRdv" data-id="${o.ev.id}">${nb > 1 ? '' : `<span>${heure}</span>`}<b>${esc(o.ev.titre)}</b>${prog}</button>`;
  };
  const couloirs = lignes.map((l) => {
    const liste = parLigne[l.id].sort((a, b) => a.debut - b.debut);
    // rangées pour les rendez-vous qui se chevauchent
    const fins = []; const rangs = liste.map((o) => { let r = fins.findIndex((f) => f <= o.debut); if (r < 0) { r = fins.length; fins.push(o.fin); } else fins[r] = o.fin; return r; });
    const nb = Math.min(Math.max(fins.length, 1), 3);
    const nbRdv = liste.length + journee.filter((o) => { const ids = liensDe(o.ev.id); return l.id === '_tous' ? tous(ids) : ids.includes(l.id) && !tous(ids); }).length;
    return `<div class="couloir"><div class="nom"><b><i style="background:${l.couleur}"></i>${esc(l.nom)}</b><small>${l.id === '_tous' ? 'en famille' : nbRdv ? nbRdv + ' rdv' : 'libre'}</small></div>
      <div class="piste">${nuit}${traits.join('')}${liste.map((o, k) => pill(o, l.id === '_tous' ? 'var(--accent)' : (couleurDe(liensDe(o.ev.id)) || l.couleur), Math.min(rangs[k], 2), nb)).join('')}</div></div>`;
  }).join('');
  const labels = []; for (let h = h0; h <= h1; h += pas) labels.push(`<span style="left:${((h - h0) / (h1 - h0)) * 100}%;${h === h0 ? 'transform:none' : h + pas > h1 && h === h1 ? 'transform:translateX(-100%)' : ''}">${h}h</span>`);
  const soleil = `${lv && pct(lv) > 0 && pct(lv) < 100 ? `<span class="soleil" style="left:${pct(lv)}%">${i('lever', 14, 2)}${hhmm(lever)}</span>` : ''}${cc && pct(cc) > 0 && pct(cc) < 100 ? `<span class="soleil" style="left:${pct(cc)}%;color:#A8481F">${i('coucher', 14, 2)}${hhmm(coucher)}</span>` : ''}`;
  const maint = estAujourdhui && n >= t0 && pct(n) < 100 ? `<span class="maint" style="left:${pct(n)}%">MAINTENANT</span>` : '';
  const ligneMaint = estAujourdhui && n >= t0 && pct(n) < 100 ? `<div class="ligne-maint" style="left:calc(132px + (100% - 132px) * ${pct(n) / 100})"></div>` : '';
  const jt = journee.length ? `<div style="display:flex;gap:8px;margin-left:132px;flex-wrap:wrap">${journee.map((o) => `<span class="puce" style="font-size:14px;padding:4px 12px">${esc(o.ev.titre)} · journée</span>`).join('')}</div>` : '';
  return `${jt}<div class="axe">${labels.join('')}${soleil}${maint}</div><div class="couloirs">${couloirs}${ligneMaint}</div>`;
}

function vueSemaine() {
  const lundi = debutSemaine(ui.ref); const auj = debutJour(new Date());
  return `<div class="vue-semaine">${Array.from({ length: 7 }, (_, k) => {
    const j = ajouterJours(lundi, k);
    const occs = occsJour(j).sort((a, b) => a.debut - b.debut);
    return `<div class="j ${memeJour(j, auj) ? 'auj' : ''}" data-a="allerJour" data-v="${isoDate(j)}" role="button" tabindex="0" aria-label="Voir le ${JOURS[k]} ${j.getDate()}"><h3>${JOURS_COURTS[k]} ${j.getDate()}</h3>
      ${occs.slice(0, 7).map((o) => { const ids = liensDe(o.ev.id); return `<div class="e"><i style="background:${tous(ids) ? 'var(--accent)' : couleurDe(ids) || 'var(--accent)'}"></i><span>${o.ev.journee_entiere ? '' : `<b style="font-weight:600">${hhmm(o.debut)}</b> `}${esc(o.ev.titre)}</span></div>`; }).join('')}
      ${occs.length > 7 ? `<span class="vide" style="font-size:12px">+${occs.length - 7} autres</span>` : ''}${!occs.length ? '<span class="vide" style="font-size:13px">Libre</span>' : ''}</div>`;
  }).join('')}</div>`;
}

function vueMois() {
  const n = new Date(); const r = ui.ref; const premier = new Date(r.getFullYear(), r.getMonth(), 1);
  const debut = debutSemaine(premier);
  const cases = Array.from({ length: 42 }, (_, k) => ajouterJours(debut, k));
  const fin = cases.findIndex((d, k) => k % 7 === 0 && d.getMonth() !== r.getMonth() && d > premier);
  const visibles = fin > 0 ? cases.slice(0, fin) : cases;
  return `<div class="vue-mois">${JOURS_COURTS.map((j) => `<div class="t">${j}</div>`).join('')}${visibles.map((d) => {
    const occs = occsJour(d);
    return `<div class="c ${d.getMonth() !== r.getMonth() ? 'hors' : ''} ${memeJour(d, n) ? 'auj' : ''}" data-a="allerJour" data-v="${isoDate(d)}" role="button" tabindex="0" aria-label="Voir le ${d.getDate()} ${MOIS[d.getMonth()]}"><span>${d.getDate()}</span><span class="pts">${occs.slice(0, 6).map((o) => { const ids = liensDe(o.ev.id); return `<i style="background:${memeJour(d, n) ? '#fff' : tous(ids) ? 'var(--accent)' : couleurDe(ids) || 'var(--accent)'}"></i>`; }).join('')}</span></div>`;
  }).join('')}</div>`;
}

function agendaHtml() {
  const auj = debutJour(new Date()); const n = new Date();
  const enJour = ui.vue === 'jour';
  const jour = ui.ref;
  const occs = enJour ? occsJour(jour) : [];
  const enCours = occs.filter((o) => !o.ev.journee_entiere && o.debut <= n && o.fin > n).length;
  const onglet = enJour ? (memeJour(jour, auj) ? 'auj' : memeJour(jour, ajouterJours(auj, 1)) ? 'demain' : '') : ui.vue;
  const vues = [['auj', 'Aujourd\'hui'], ['demain', 'Demain'], ['semaine', 'Semaine'], ['mois', 'Mois']];
  let titre = ''; let periode = '';
  if (ui.vue === 'mois') periode = `<b class="periode">${majuscule(MOIS[ui.ref.getMonth()])} ${ui.ref.getFullYear()}</b>`;
  else if (ui.vue === 'semaine') { const l = debutSemaine(ui.ref); const d = ajouterJours(l, 6); periode = `<b class="periode">${memeJour(l, debutSemaine(n)) ? 'Cette semaine' : `Du ${l.getDate()} ${l.getMonth() !== d.getMonth() ? MOIS[l.getMonth()].slice(0, 3) + '.' : ''} au ${d.getDate()} ${MOIS[d.getMonth()].slice(0, 3)}.`}</b>`; }
  else { if (!onglet) periode = `<b class="periode">${majuscule(JOURS[jourIso(jour) - 1])} ${jour.getDate()} ${MOIS[jour.getMonth()]}</b>`; titre = `<span>${occs.length} rdv</span>${memeJour(jour, auj) && enCours ? `<span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>${enCours} en cours</span>` : ''}`; }
  const corps = ui.vue === 'semaine' ? vueSemaine() : ui.vue === 'mois' ? vueMois() : vueJour(jour, memeJour(jour, auj));
  const nom = ui.vue === 'semaine' ? 'semaine' : ui.vue === 'mois' ? 'mois' : 'jour';
  return `<section class="agenda" aria-label="Agenda de la famille">
    <div class="barre-outils"><div class="gauche"><div class="vues" role="tablist">${vues.map(([v, l]) => `<button role="tab" aria-selected="${onglet === v}" data-a="vue" data-v="${v}">${l}</button>`).join('')}</div>${periode}</div>
      <div class="outils">${titre}
        ${voixOk() ? `<button class="btn fort ${ui.ecoute ? 'ecoute' : ''}" data-a="parler">${i('micro', 18, 2)}${ui.ecoute ? 'J\'écoute…' : 'Parler'}</button>` : ''}
        <button class="btn" data-a="ajouterRdv">${i('ajouter', 18, 2.2)}Ajouter</button>
        <span class="fleches"><button class="btn rond" data-a="decaler" data-v="-1" aria-label="${nom === 'semaine' ? 'Semaine précédente' : nom === 'mois' ? 'Mois précédent' : 'Jour précédent'}">${i('gauche', 22, 2)}</button><button class="btn rond" data-a="decaler" data-v="1" aria-label="${nom === 'semaine' ? 'Semaine suivante' : nom === 'mois' ? 'Mois suivant' : 'Jour suivant'}">${i('droite', 22, 2)}</button></span>
        <button class="btn rond" data-a="reglages" aria-label="Réglages de la tablette">${i('reglages', 20)}</button></div></div>
    ${corps}</section>`;
}

function cartesHtml() {
  const courses = state.courses.filter((c) => !c.pris).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  const notes = state.notes.slice().sort((a, b) => (b.epingle - a.epingle) || (a.created_at < b.created_at ? 1 : -1)).slice(0, 2);
  const auj = debutJour(new Date());
  const rappels = state.rappels.filter((r) => r.type === 'rappel' && !r.fait_le).sort((a, b) => (a.echeance || '9') < (b.echeance || '9') ? -1 : 1).slice(0, 2);
  const anniv = (state.anniv || []).map((a) => ({ ...a, p: prochainAnniv(a.mois_jour, a.annee) })).filter((a) => a.p).sort((a, b) => a.p.dans - b.p.dans);
  const a0 = anniv[0]; const a1 = anniv[1];
  return `<section class="cartes">
    <div class="carte clic" data-a="ouvrirPage" data-v="courses" role="button" tabindex="0" aria-label="Ouvrir les courses"><h2>Courses <small>· ${courses.length}</small></h2>
      <div class="puces">${courses.slice(0, 9).map((c) => `<span class="puce">${esc(c.nom)}${c.source === 'titus' ? '<span class="etq">Titus</span>' : ''}</span>`).join('')}${courses.length > 9 ? `<span class="puce" style="color:var(--pale)">+${courses.length - 9}</span>` : ''}</div>
      ${!courses.length ? '<span class="vide">Rien à acheter</span>' : ''}</div>
    <div class="carte notes clic" data-a="ouvrirPage" data-v="notes" role="button" tabindex="0" aria-label="Ouvrir les notes"><h2>Notes</h2>
      ${notes.map((no) => { const a = membre(no.auteur); return `<div class="mininote"><span>${esc(no.texte)}</span><small style="color:${a ? a.couleur : 'var(--pale)'}">${esc(a ? a.prenom : '')} · ${esc(depuis(no.created_at))}</small></div>`; }).join('') || '<span class="vide">Aucune note</span>'}</div>
    <div class="carte clic" data-a="ouvrirPage" data-v="rappels" role="button" tabindex="0" aria-label="Ouvrir les rappels"><h2>Rappels</h2>
      ${rappels.map((r) => {
        let s = ''; if (r.echeance) { const d = new Date(r.echeance + 'T00:00:00'); const k = Math.round((d - auj) / 86400000); s = k < 0 ? 'En retard' : k === 0 ? 'Aujourd\'hui' : k <= 14 ? `Dans ${k} jours` : `Avant le ${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`; }
        const p = r.pour ? membre(r.pour) : null;
        return `<div class="rap"><span class="ic">${i('cloche', 20)}</span><span class="tx"><b>${esc(r.titre)}</b><small${s === 'En retard' ? ' style="color:#A8481F;font-weight:500"' : ''}>${esc([s, p ? p.prenom : ''].filter(Boolean).join(' · '))}</small></span></div>`;
      }).join('') || '<span class="vide">Rien à signaler</span>'}</div>
    <div class="carte anniv"><h2>Anniversaires</h2>
      ${a0 ? `<div class="gros"><b>${a0.p.dans}</b><div style="display:flex;flex-direction:column"><span style="font-size:14px;color:#7A3E1E">${a0.p.dans === 0 ? 'C\'est aujourd\'hui !' : a0.p.dans === 1 ? 'jour avant' : 'jours avant'}${a0.p.age ? ` · ${a0.p.age} ans` : ''}</span><span style="font-size:19px;font-weight:500">${esc(a0.nom)}</span></div></div>
        ${a1 ? `<span style="font-size:14px;color:#7A3E1E">Puis ${esc(a1.nom)} · ${a1.p.date.getDate()} ${a1.p.date.toLocaleDateString('fr-FR', { month: 'short' })}</span>` : ''}` : '<span class="vide" style="color:#7A3E1E">Aucun anniversaire</span>'}</div>
  </section>`;
}

function accueilHtml() {
  if (!ui.session) {
    const a = ui.auth;
    return `<div class="accueil"><div class="boite"><h1>Écran Famille</h1><p>Connecte la tablette avec son compte (ou crée-le).</p>
      ${a.erreur ? `<p class="erreur">${esc(a.erreur)}</p>` : ''}${a.info ? `<p class="info">${esc(a.info)}</p>` : ''}
      <form data-form="connexion" style="display:flex;flex-direction:column;gap:14px">
        <label class="champ">E-mail du compte tablette<input type="email" name="email" required autocomplete="username"></label>
        <label class="champ">Mot de passe<input type="password" name="mdp" required minlength="8" autocomplete="current-password"></label>
        <div class="rangee"><button class="gros-btn" type="submit" name="mode" value="connexion">Se connecter</button><button class="gros-btn second" type="submit" name="mode" value="inscription">Créer le compte</button></div>
      </form></div></div>`;
  }
  const r = ui.rejoindre;
  return `<div class="accueil"><div class="boite"><h1>Relier la tablette</h1><p>Tape le code famille (visible dans « Plus » sur le téléphone d'un membre).</p>
    ${r.erreur ? `<p class="erreur">${esc(r.erreur)}</p>` : ''}
    <form data-form="code" style="display:flex;flex-direction:column;gap:14px">
      <label class="champ">Code famille<input name="code" inputmode="numeric" maxlength="6" required style="font-size:32px;letter-spacing:.5em;text-align:center"></label>
      <button class="gros-btn">Relier cette tablette</button></form>
    <button class="gros-btn danger" data-a="deconnexion">Se déconnecter</button></div></div>`;
}

function rendre() {
  cadre.style.background = FONDS[moment()];
  if (!ui.session || !state.moi) {
    vue.innerHTML = ui.session && !ui.pret ? '<div class="accueil"><p>Chargement…</p></div>' : accueilHtml();
    zVeille.innerHTML = '';
    return;
  }
  vue.innerHTML = `<div class="ecran">${enteteHtml()}${agendaHtml()}${cartesHtml()}</div>`;
  rendrePage();
  rendreVeille();
}

// ---------- Mode veille photo ----------
const hm = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
function enVeille() {
  if (ui.veilleForcee) return true;
  if (Date.now() < ui.reveilJusqua) return false;
  const n = new Date(); const t = n.getHours() * 60 + n.getMinutes();
  const a = hm(reglages.veilleDebut), b = hm(reglages.veilleFin);
  return a > b ? (t >= a || t < b) : (t >= a && t < b);
}
function rendreVeille() {
  if (!enVeille()) { zVeille.innerHTML = ''; return; }
  const n = new Date(); const demain = ajouterJours(debutJour(n), 1);
  const occs = (n.getHours() < 6 ? occsJour(debutJour(n)) : occsJour(demain)).sort((a, b) => a.debut - b.debut).slice(0, 3);
  const photo = ui.photos.length ? ui.photos[ui.photoIdx % ui.photos.length] : null;
  const existante = zVeille.querySelector('.veille');
  const contenuInfo = `
    <div class="bulle" style="top:32px;right:40px;padding:10px 18px;border-radius:999px;font-size:16px;display:flex;gap:14px;align-items:center">
      ${ui.meteo ? `<span>${ui.meteo.temp}° · ${esc(CODES[ui.meteo.code] || '')}</span>` : ''}${ui.meteo && ui.meteo.demain ? `<span style="opacity:.6">|</span><span>Demain ${ui.meteo.demain.min}°/${ui.meteo.demain.max}°${ui.meteo.demain.pluie >= 50 ? ' · pluie' : ''}</span>` : ''}</div>
    <div class="bulle" style="left:40px;bottom:40px"><div class="h">${deux(n.getHours())}<span class="dp">:</span>${deux(n.getMinutes())}</div><div style="font-size:20px;font-weight:300;margin-top:6px">${majuscule(JOURS[jourIso(n) - 1])} ${n.getDate()} ${MOIS[n.getMonth()]}</div></div>
    <div class="bulle" style="right:40px;bottom:40px;width:380px;display:flex;flex-direction:column;gap:12px">
      <span style="font-size:13px;font-weight:600;letter-spacing:1.5px;color:#F4D9A8">${n.getHours() < 6 ? 'AUJOURD\'HUI' : 'DEMAIN'}</span>
      ${occs.map((o) => { const ids = liensDe(o.ev.id); return `<div style="display:flex;align-items:center;gap:12px"><span style="width:10px;height:10px;border-radius:50%;background:${tous(ids) ? '#B7ADF5' : couleurDe(ids) || '#B7ADF5'}"></span><span style="font-size:17px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.ev.titre)}</span><span style="font-size:16px;font-weight:500">${o.ev.journee_entiere ? 'journée' : hhmm(o.debut)}</span></div>`; }).join('') || '<span style="font-size:16px;opacity:.8">Rien de prévu</span>'}
      <span style="font-size:13px;color:#E6DDD2">Touchez l'écran pour revenir</span></div>`;
  if (!existante) {
    zVeille.innerHTML = `<div class="veille" data-a="reveil"><div class="photo" id="ph1"></div><div class="photo" id="ph2"></div><div id="vinfo">${contenuInfo}</div></div>`;
    if (photo) { const p = zVeille.querySelector('#ph1'); p.style.backgroundImage = `url('${photo}')`; p.classList.add('vis'); }
  } else {
    zVeille.querySelector('#vinfo').innerHTML = contenuInfo;
  }
}
function photoSuivante() {
  if (!enVeille() || ui.photos.length < 2) return;
  ui.photoIdx = (ui.photoIdx + 1) % ui.photos.length;
  const a = zVeille.querySelector('#ph1'); const b = zVeille.querySelector('#ph2'); if (!a || !b) return;
  const [vis, cache] = a.classList.contains('vis') ? [a, b] : [b, a];
  cache.style.backgroundImage = `url('${ui.photos[ui.photoIdx]}')`;
  cache.classList.add('vis'); vis.classList.remove('vis');
}
async function chargerPhotos() {
  const { data } = await sb.storage.from('photos').list('', { limit: 100 });
  const noms = (data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => f.name);
  const urls = [];
  for (const nom of noms) { const u = await urlImage('photos', nom); if (u) urls.push(u); }
  for (let k = urls.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [urls[k], urls[j]] = [urls[j], urls[k]]; }
  ui.photos = urls;
}

// ---------- Fenêtres ----------
function fenetre(titre, corps) {
  zFen.innerHTML = `<div class="voile" data-a="fermerVoile"><div class="fen" role="dialog" aria-modal="true"><h2>${esc(titre)}<button class="btn rond" data-a="fermer" aria-label="Fermer">${i('fermer')}</button></h2>${corps}</div></div>`;
}
const fermer = () => { zFen.innerHTML = ''; ui.codeVisible = false; };

function formRdv(pre = {}, ev = null) {
  const d = ev ? new Date(ev.debut) : pre.debut || (() => { const x = new Date(ui.ref); const h = new Date().getHours(); x.setHours(Math.min(h + 1, 21), 0, 0, 0); return x; })();
  const f = ev && ev.fin ? new Date(ev.fin) : new Date(d.getTime() + 3600000);
  const journee = ev ? ev.journee_entiere : !!pre.journee;
  const qui = ev ? liensDe(ev.id) : pre.qui || [];
  const rep = ev ? ev.repetition || 'aucune' : 'aucune';
  fenetre(ev ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous', `<form data-form="rdv" data-id="${ev ? ev.id : ''}" style="display:flex;flex-direction:column;gap:14px">
    <label class="champ">Titre<input name="titre" required maxlength="120" value="${esc(ev ? ev.titre : pre.titre || '')}"></label>
    <div class="rangee"><label class="champ">Date<input type="date" name="date" value="${isoDate(d)}" required></label>
      <label class="champ">Début<input type="time" name="h1" value="${journee ? '' : hhmm(d)}"></label><label class="champ">Fin<input type="time" name="h2" value="${journee ? '' : hhmm(f)}"></label></div>
    <p style="margin:-6px 0 0;font-size:13px;color:var(--pale)">Laisse « Début » vide pour toute la journée.</p>
    <div class="champ">Qui ? <span style="font-weight:400;color:var(--pale);font-size:13px">(« Tous » = toute la famille)</span><div class="choix">${personnes().map((p) => `<label><input type="checkbox" name="qui" value="${p.id}" data-c="quiPersonne" ${qui.includes(p.id) ? 'checked' : ''}><span style="width:12px;height:12px;border-radius:50%;background:${p.couleur}"></span>${esc(p.prenom)}</label>`).join('')}
      <label style="border-color:var(--accent)"><input type="checkbox" name="tous" data-c="quiTous" ${personnes().length && personnes().every((p) => qui.includes(p.id)) ? 'checked' : ''}><span style="width:12px;height:12px;border-radius:50%;background:var(--accent)"></span>Tous</label></div></div>
    <div class="rangee"><label class="champ">Lieu<input name="lieu" maxlength="120" value="${esc(ev && ev.lieu || '')}" placeholder="Facultatif"></label>
      <label class="champ">Répétition<select name="repetition">${[['aucune', 'Aucune'], ['jour', 'Tous les jours'], ['semaine', 'Chaque semaine'], ['mois', 'Tous les mois'], ['annee', 'Tous les ans']].map(([v, l]) => `<option value="${v}" ${rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    ${ev && rep !== 'aucune' ? '<p style="margin:0;font-size:14px;color:var(--doux)">Ce rendez-vous se répète : la modification s\'applique à toutes les fois.</p>' : ''}
    <div class="rangee"><button class="gros-btn">Enregistrer</button>${ev ? `<button type="button" class="gros-btn danger" data-a="supprRdv" data-id="${ev.id}">Supprimer</button>` : ''}<button type="button" class="gros-btn second" data-a="fermer">Annuler</button></div></form>`);
}

function confirmer(titre, texte, libelle, action) {
  fenetre(titre, `<p style="margin:0;font-size:18px">${esc(texte)}</p>
    <div class="rangee"><button class="gros-btn" style="background:#B3261E" data-a="confirmerOui">${esc(libelle)}</button><button class="gros-btn second" data-a="fermer">Annuler</button></div>`);
  ui.confirmation = action;
}

// ---------- Pages (courses, notes, rappels) ----------
function pageCourses() {
  const aPrendre = state.courses.filter((c) => !c.pris).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  const pris = state.courses.filter((c) => c.pris).sort((a, b) => (a.pris_le || '') > (b.pris_le || '') ? -1 : 1);
  const ligne = (c) => { const m = membre(c.ajoute_par); return `<div class="ligne-p ${c.pris ? 'fait' : ''}">
    <label><input type="checkbox" data-c="prendre" data-id="${c.id}" ${c.pris ? 'checked' : ''}><span class="tx"><b>${esc(c.nom)}</b>${c.quantite ? `<small>${esc(c.quantite)}</small>` : ''}</span></label>
    ${c.source === 'titus' ? '<span class="etq">Titus</span>' : m ? `<span class="pt" style="background:${m.couleur}" title="${esc(m.prenom)}"></span>` : ''}
    <button class="btn rond" data-a="modifCourse" data-id="${c.id}" aria-label="Modifier ${esc(c.nom)}">${i('modifier', 20)}</button>
    <button class="btn rond rouge" data-a="supprCourse" data-id="${c.id}" aria-label="Supprimer ${esc(c.nom)}">${i('poubelle', 20)}</button></div>`; };
  return { titre: `Courses <small>· ${aPrendre.length} à prendre</small>`, outils: `${voixOk() ? `<button class="btn fort ${ui.ecoute ? 'ecoute' : ''}" data-a="parler">${i('micro', 18, 2)}Parler</button>` : ''}`,
    corps: `<form class="ajout-p" data-form="ajoutCourse" autocomplete="off"><input name="nom" maxlength="120" placeholder="Ajouter un article (plusieurs : séparés par des virgules)" aria-label="Nouvel article"><button class="gros-btn">${i('ajouter', 20, 2.2)} Ajouter</button></form>
    <div class="colonnes"><div><h3>À prendre</h3>${aPrendre.map(ligne).join('') || '<p class="vide">La liste est vide.</p>'}</div>
      <div><h3>Déjà pris</h3>${pris.map(ligne).join('') || '<p class="vide">Rien pour l\'instant.</p>'}${pris.length ? '<button class="gros-btn danger" data-a="viderPris">Vider les articles pris</button>' : ''}</div></div>` };
}
function pageNotes() {
  const notes = state.notes.slice().sort((a, b) => (b.epingle - a.epingle) || (a.created_at < b.created_at ? 1 : -1));
  return { titre: `Notes <small>· ${notes.length}</small>`, outils: `<button class="btn fort" data-a="nouvelleNote">${i('ajouter', 18, 2.2)}Nouvelle note</button>`,
    corps: `<div class="grille-notes">${notes.map((n) => { const a = membre(n.auteur); const p = n.pour ? membre(n.pour) : null; return `<article class="note-p">
      <div class="haut-n"><small style="color:${a ? a.couleur : 'var(--pale)'}">${esc(a ? a.prenom : '')} · ${esc(depuis(n.created_at))}</small>
        <button class="btn rond ${n.epingle ? 'actif' : ''}" data-a="epingler" data-id="${n.id}" aria-pressed="${n.epingle}" aria-label="${n.epingle ? 'Désépingler' : 'Épingler'}">${i('epingle', 18, n.epingle ? 2.4 : 1.8)}</button></div>
      <p>${esc(n.texte)}</p>
      <div class="bas-n"><span class="etiq">Pour : ${esc(p ? p.prenom : 'Tous')}</span><span><button class="btn rond" data-a="modifNote" data-id="${n.id}" aria-label="Modifier la note">${i('modifier', 18)}</button><button class="btn rond rouge" data-a="supprNote" data-id="${n.id}" aria-label="Supprimer la note">${i('poubelle', 18)}</button></span></div>
    </article>`; }).join('') || '<p class="vide">Aucune note. Touche « Nouvelle note » pour en ajouter une.</p>'}</div>` };
}
function pageRappels() {
  const auj = debutJour(new Date());
  const taches = state.rappels.filter((r) => r.type === 'tache').map((t) => ({ ...t, d: prochaineTache(t.jour_semaine || 1, t.fait_le) })).sort((a, b) => a.d - b.d);
  const rappels = state.rappels.filter((r) => r.type === 'rappel').sort((a, b) => (!!a.fait_le - !!b.fait_le) || ((a.echeance || '9') < (b.echeance || '9') ? -1 : 1));
  const quand = (d) => { const k = Math.round((d - auj) / 86400000); return k === 0 ? 'aujourd\'hui' : k === 1 ? 'demain' : `dans ${k} jours`; };
  const lt = taches.map((t) => `<div class="ligne-p"><label><input type="checkbox" data-c="tacheFaite" data-id="${t.id}" data-v="${isoDate(t.d)}"><span class="pt" style="background:${esc(t.couleur || 'var(--accent)')};width:14px;height:14px"></span><span class="tx"><b>${esc(t.titre)}</b><small>${JOURS[(t.jour_semaine || 1) - 1]}${t.moment ? ' ' + esc(t.moment) : ''} · ${quand(t.d)}</small></span></label>
    <button class="btn rond" data-a="modifRappel" data-id="${t.id}" aria-label="Modifier ${esc(t.titre)}">${i('modifier', 20)}</button><button class="btn rond rouge" data-a="supprRappel" data-id="${t.id}" aria-label="Supprimer ${esc(t.titre)}">${i('poubelle', 20)}</button></div>`).join('');
  const lr = rappels.map((r) => { const p = r.pour ? membre(r.pour) : null; let e = ''; if (r.echeance) { const d = new Date(r.echeance + 'T00:00:00'); const k = Math.round((d - auj) / 86400000); e = k < 0 ? 'en retard' : `avant le ${d.getDate()} ${MOIS[d.getMonth()]}${k <= 14 ? ` · ${quand(d)}` : ''}`; }
    return `<div class="ligne-p ${r.fait_le ? 'fait' : ''}"><label><input type="checkbox" data-c="rappelFait" data-id="${r.id}" ${r.fait_le ? 'checked' : ''}><span class="tx"><b>${esc(r.titre)}</b><small>${esc([e, p ? 'pour ' + p.prenom : ''].filter(Boolean).join(' · '))}</small></span></label>
    <button class="btn rond" data-a="modifRappel" data-id="${r.id}" aria-label="Modifier ${esc(r.titre)}">${i('modifier', 20)}</button><button class="btn rond rouge" data-a="supprRappel" data-id="${r.id}" aria-label="Supprimer ${esc(r.titre)}">${i('poubelle', 20)}</button></div>`; }).join('');
  return { titre: 'Rappels et maison', outils: '',
    corps: `<div class="colonnes"><div><h3>Tâches de la maison</h3>${lt || '<p class="vide">Aucune tâche.</p>'}<button class="gros-btn second" data-a="nouveauRappel" data-v="tache">${i('ajouter', 20, 2.2)} Ajouter une tâche</button></div>
      <div><h3>Rappels</h3>${lr || '<p class="vide">Aucun rappel.</p>'}<button class="gros-btn second" data-a="nouveauRappel" data-v="rappel">${i('ajouter', 20, 2.2)} Ajouter un rappel</button></div></div>` };
}
function pageMeteo() {
  const m = ui.meteo; const vue = ui.meteoVue || '2j';
  const outils = `<div class="vues" role="tablist"><button role="tab" aria-selected="${vue === '2j'}" data-a="meteoVue" data-v="2j">Aujourd'hui et demain</button><button role="tab" aria-selected="${vue === 'sem'}" data-a="meteoVue" data-v="sem">Semaine</button></div>`;
  if (!m || !m.jours) return { titre: 'Météo', outils, corps: '<p class="vide" style="font-size:20px">Météo indisponible pour le moment (pas d\'Internet ?).</p>' };
  const titre = `Météo <small>· ${esc(m.ville || '')}</small>`;
  const ico = (c, t) => `<span style="color:${couleurMeteo(c)}">${i(iconeMeteo(c), t, 1.5)}</span>`;
  const nomJour = (iso, k) => { const d = new Date(iso + 'T12:00:00'); return k === 0 ? 'Aujourd\'hui' : k === 1 ? 'Demain' : `${majuscule(JOURS[jourIso(d) - 1])} ${d.getDate()}`; };
  const maj = `<p style="margin:0;color:var(--pale);font-size:14px">Mise à jour à ${hhmm(new Date(m.le))} · source Open-Meteo</p>`;
  if (vue === 'sem') {
    const corps = `<div class="meteo-sem">${m.jours.map((j, k) => `<div class="mj ${k === 0 ? 'auj' : ''}">
      <b>${nomJour(j.date, k)}</b>${ico(j.code, 56)}<span class="desc">${esc(CODES[j.code] || '')}</span>
      <span class="mm"><strong>${j.max}°</strong> <span>${j.min}°</span></span>
      <small>${i('goutte', 15)} ${j.pluie ?? '–'} %</small><small>${i('vent', 15)} ${j.vent ?? '–'} km/h</small></div>`).join('')}</div>${maj}`;
    return { titre, outils, corps };
  }
  const maintenant = Date.now();
  const bloc = (k) => {
    const j = m.jours[k]; if (!j) return '';
    const debut = new Date(j.date + 'T00:00:00').getTime(); const fin = debut + 86400000;
    const hs = (m.heures || []).filter((x) => { const t = new Date(x.t).getTime(); return t >= debut && t < fin && t >= maintenant - 3600000 && new Date(x.t).getHours() >= 6 && new Date(x.t).getHours() % 2 === 0; }).slice(0, 9);
    const lever = j.lever ? hhmm(new Date(j.lever)) : '–'; const coucher = j.coucher ? hhmm(new Date(j.coucher)) : '–';
    const actuel = k === 0 && m.temp != null;
    return `<div class="mcarte">
      <div class="mhaut">${ico(actuel ? m.code : j.code, 92)}<div class="col"><h2>${nomJour(j.date, k)}</h2>
        <span class="grand">${actuel ? m.temp + '°' : j.max + '°'}</span><span class="desc">${esc(CODES[actuel ? m.code : j.code] || '')}</span></div>
        <div class="infos">
          <span>${i('thermo', 20)} Max <b>${j.max}°</b> · Min <b>${j.min}°</b></span>
          ${actuel && m.ressenti != null ? `<span>${i('thermo', 20)} Ressenti <b>${m.ressenti}°</b></span>` : ''}
          <span>${i('goutte', 20)} Pluie <b>${j.pluie ?? '–'} %</b>${j.mm ? ` · ${String(Math.round(j.mm * 10) / 10).replace('.', ',')} mm` : ''}</span>
          <span>${i('vent', 20)} Vent <b>${actuel && m.vent != null ? m.vent : j.vent ?? '–'} km/h</b></span>
          ${actuel && m.humidite != null ? `<span>${i('goutte', 20)} Humidité <b>${m.humidite} %</b></span>` : ''}
          <span>${i('lever', 20)} ${lever} · ${i('coucher', 20)} ${coucher}</span>
        </div></div>
      ${hs.length ? `<div class="mheures">${hs.map((x) => `<div><small>${new Date(x.t).getHours()} h</small>${ico(x.code, 30)}<b>${x.temp}°</b><small>${x.pluie ?? 0} %</small></div>`).join('')}</div>` : ''}
    </div>`;
  };
  return { titre, outils, corps: `<div class="meteo-2j">${bloc(0)}${bloc(1)}</div>${maj}` };
}

function rendrePage() {
  if (!ui.page) { zPage.innerHTML = ''; return; }
  const act = document.activeElement;
  if (act && zPage.contains(act) && act.tagName === 'INPUT' && act.type === 'text' && act.value) return; // on ne coupe pas une saisie
  const p = ui.page === 'courses' ? pageCourses() : ui.page === 'notes' ? pageNotes() : ui.page === 'meteo' ? pageMeteo() : pageRappels();
  const garder = zPage.querySelector('.page-corps'); const defil = garder ? garder.scrollTop : 0;
  zPage.innerHTML = `<div class="page" role="dialog" aria-modal="true" aria-label="${ui.page}"><header><h1>${p.titre}</h1><div class="outils">${p.outils}<button class="btn rond grand" data-a="fermerPage" aria-label="Fermer et revenir à l'accueil">${i('fermer', 26, 2.2)}</button></div></header><div class="page-corps">${p.corps}</div></div>`;
  const c = zPage.querySelector('.page-corps'); if (c) c.scrollTop = defil;
}

function formCourse(c) {
  fenetre('Modifier l\'article', `<form data-form="course" data-id="${c.id}" style="display:flex;flex-direction:column;gap:14px">
    <label class="champ">Article<input name="nom" required maxlength="120" value="${esc(c.nom)}"></label>
    <label class="champ">Quantité ou précision<input name="quantite" maxlength="60" value="${esc(c.quantite || '')}" placeholder="Facultatif"></label>
    <div class="rangee"><button class="gros-btn">Enregistrer</button><button type="button" class="gros-btn second" data-a="fermer">Annuler</button></div></form>`);
}
function formNote(n) {
  fenetre(n ? 'Modifier la note' : 'Nouvelle note', `<form data-form="note" data-id="${n ? n.id : ''}" style="display:flex;flex-direction:column;gap:14px">
    <label class="champ">Note<textarea name="texte" required maxlength="2000" rows="4" style="padding:12px 16px;border-radius:14px;border:1px solid #DCD2C3;font-size:18px">${esc(n ? n.texte : '')}</textarea></label>
    <div class="rangee"><label class="champ">Pour<select name="pour"><option value="">Tous</option>${personnes().map((p) => `<option value="${p.id}" ${n && n.pour === p.id ? 'selected' : ''}>${esc(p.prenom)}</option>`).join('')}</select></label>
      <div class="champ">&nbsp;<div class="choix"><label><input type="checkbox" name="epingle" ${n && n.epingle ? 'checked' : ''}>Épingler</label></div></div></div>
    <div class="rangee"><button class="gros-btn">Enregistrer</button><button type="button" class="gros-btn second" data-a="fermer">Annuler</button></div></form>`);
}
function formRappel(r, type) {
  type = r ? r.type : type; const tache = type === 'tache';
  fenetre(r ? (tache ? 'Modifier la tâche' : 'Modifier le rappel') : (tache ? 'Nouvelle tâche' : 'Nouveau rappel'), `<form data-form="rappel" data-id="${r ? r.id : ''}" data-type="${type}" style="display:flex;flex-direction:column;gap:14px">
    <label class="champ">${tache ? 'Tâche' : 'Rappel'}<input name="titre" required maxlength="200" value="${esc(r ? r.titre : '')}" placeholder="${tache ? 'Poubelle jaune, arroser…' : 'Contrôle technique, facture…'}"></label>
    ${tache ? `<div class="rangee"><label class="champ">Jour<select name="jour">${JOURS.map((j, k) => `<option value="${k + 1}" ${r && r.jour_semaine === k + 1 ? 'selected' : ''}>${majuscule(j)}</option>`).join('')}</select></label>
      <label class="champ">Moment<select name="moment">${['soir', 'matin', 'midi', ''].map((v) => `<option value="${v}" ${r && (r.moment || '') === v ? 'selected' : ''}>${v ? majuscule(v) : '—'}</option>`).join('')}</select></label></div>
      <div class="champ">Couleur<div class="choix">${[['#D8B84A', 'Jaune'], ['#3B6FD8', 'Bleu'], ['#1F8A4C', 'Vert'], ['#8A8A8A', 'Gris'], ['#D9774A', 'Orange']].map(([c, l], k) => `<label><input type="radio" name="couleur" value="${c}" ${(r ? r.couleur === c : k === 0) ? 'checked' : ''}><span style="width:16px;height:16px;border-radius:50%;background:${c}"></span>${l}</label>`).join('')}</div></div>`
    : `<div class="rangee"><label class="champ">Avant le<input type="date" name="echeance" value="${esc(r && r.echeance || '')}"></label>
      <label class="champ">Pour<select name="pour"><option value="">Tous</option>${personnes().map((p) => `<option value="${p.id}" ${r && r.pour === p.id ? 'selected' : ''}>${esc(p.prenom)}</option>`).join('')}</select></label></div>`}
    <div class="rangee"><button class="gros-btn">Enregistrer</button><button type="button" class="gros-btn second" data-a="fermer">Annuler</button></div></form>`);
}

// ---------- Retour automatique à l'accueil ----------
const horsAccueil = () => !!ui.page || !!zFen.innerHTML || ui.vue !== 'jour' || !memeJour(ui.ref, debutJour(new Date()));
function retourAccueil() {
  ui.page = null; ui.vue = 'jour'; ui.ref = debutJour(new Date()); ui.alerte = null;
  zFen.innerHTML = ''; zAlerte.innerHTML = ''; rendre();
}
function verifierInactivite() {
  if (!state.moi || enVeille()) return;
  const calme = Date.now() - ui.derniere;
  if (ui.alerte) { if (Date.now() - ui.alerte > 60000) retourAccueil(); return; }
  if (horsAccueil() && calme > 4 * 60000) {
    ui.alerte = Date.now();
    zAlerte.innerHTML = `<div class="voile" style="z-index:50"><div class="fen" role="alertdialog" aria-modal="true" style="width:520px;align-items:center;text-align:center">
      <h2 style="justify-content:center">Toujours là ?</h2><p style="margin:0;font-size:18px;color:var(--doux)">Sans réponse, l'écran revient à l'accueil dans une minute.</p>
      <div class="rangee" style="width:100%"><button class="gros-btn" data-a="toujoursLa">Oui, je continue</button><button class="gros-btn second" data-a="retourAccueil">Revenir à l'accueil</button></div></div></div>`;
  }
}
['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, () => { ui.derniere = Date.now(); }, { capture: true }));

function fenReglages() {
  fenetre('Réglages de la tablette', `
    <div><div style="font-size:15px;color:var(--pale);text-align:center">Code famille</div><div class="code ${ui.codeVisible ? '' : 'flou'}" ${ui.codeVisible ? '' : 'aria-label="Code masqué"'}>${ui.codeVisible ? esc(state.config ? state.config.code : '') : '888888'}</div>
      <p style="margin:0;text-align:center;color:var(--pale)">À taper dans l'appli téléphone pour créer un compte.</p></div>
    <div class="rangee"><button class="gros-btn second" data-a="basculeCode">${ui.codeVisible ? 'Masquer le code' : 'Afficher le code'}</button>
      <button class="gros-btn second" data-a="nouveauCode" ${ui.codeVisible ? '' : 'disabled'}>Changer le code</button></div>
    <div class="rangee"><label class="champ">Veille de<input type="time" value="${esc(reglages.veilleDebut)}" data-c="veilleDebut"></label><label class="champ">à<input type="time" value="${esc(reglages.veilleFin)}" data-c="veilleFin"></label></div>
    <label class="champ">Reconnaissance vocale<select data-c="modeVoix"><option value="locale" ${reglages.voix !== 'google' ? 'selected' : ''}>Locale sur la tablette (Vosk, sans Internet)</option><option value="google" ${reglages.voix === 'google' ? 'selected' : ''}>Google (plus précise, besoin d'Internet)</option></select></label>
    <div class="rangee"><label class="champ">Voix de la tablette<select data-c="parole"><option value="1" ${reglages.parole ? 'selected' : ''}>Activée</option><option value="0" ${reglages.parole ? '' : 'selected'}>Coupée (muet)</option></select></label>
      <label class="champ">Annonces automatiques<select data-c="annonces"><option value="1" ${reglages.annonces ? 'selected' : ''}>Oui (rdv, poubelles, anniv.)</option><option value="0" ${reglages.annonces ? '' : 'selected'}>Non</option></select></label></div>
    <div class="rangee">${paroleDisponible() ? `<button class="gros-btn second" data-a="testerVoix">${i('micro', 20)} Test voix</button>` : ''}<button class="gros-btn second" data-a="veilleMaintenant">${i('lune', 20)} Veille</button><button class="gros-btn second" data-a="pleinEcran">${i('plein', 20)} Plein écran</button></div>
    <a class="gros-btn second" href="./" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Ouvrir l'appli téléphone</a>
    <button class="gros-btn danger" data-a="deconnexion">Déconnecter la tablette</button>`);
}

// ---------- Voix ----------
async function parler() {
  if (ui.ecoute) { [ecouterLocal.arreter, ecouter.arreter].forEach((a) => a && a()); return; }
  ui.ecoute = true; rendre();
  let t;
  try {
    if (reglages.voix !== 'google' && micro()) {
      if (etatVoixLocale() !== 'pret') toast('Préparation de la voix… (la 1re fois, environ 40 Mo)');
      try { t = await ecouterLocal({ onPartiel: (p) => toast('… ' + p) }); }
      catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'NotFoundError')) throw new Error(e.name === 'NotFoundError' ? 'Aucun micro trouvé.' : 'Autorise le micro pour utiliser la voix.');
        if (e && /rien entendu|arrêtée/.test(e.message) || !voixDisponible()) throw e;
        toast('Voix locale indisponible, j\'utilise Google.'); t = await ecouter();
      }
    } else t = await ecouter();
  } catch (e) { ui.ecoute = false; rendre(); return toast(e.message); }
  ui.ecoute = false; zToast.innerHTML = ''; rendre();
  const c = comprendre(t, personnes().map((p) => p.prenom));
  if (c.type === 'course') {
    const lignes = c.noms.map((nom) => ({ id: nouvelId(), nom: nom.slice(0, 120), source: 'tablette', ajoute_par: state.moi.id, pris: false, created_at: new Date().toISOString() }));
    await ecrire(lignes.map((l) => ({ cle: 'courses', op: 'insert', ligne: l })));
    parlerSi(`J'ai ajouté ${enumerer(c.noms)} aux courses.`);
    toast(`Ajouté aux courses : ${c.noms.join(', ')}`, () => ecrire(lignes.map((l) => ({ cle: 'courses', op: 'delete', ligne: { id: l.id } }))));
  } else if (c.type === 'note') {
    const l = { id: nouvelId(), texte: c.texte.slice(0, 2000), auteur: state.moi.id, created_at: new Date().toISOString() };
    await ecrire({ cle: 'notes', op: 'insert', ligne: l });
    parlerSi('Note enregistrée.');
    toast('Note ajoutée.', () => ecrire({ cle: 'notes', op: 'delete', ligne: { id: l.id } }));
  } else if (c.type === 'rdv') {
    const qui = c.qui.map((p) => personnes().find((x) => x.prenom === p)).filter(Boolean).map((p) => p.id);
    formRdv({ titre: c.titre, debut: c.debut, journee: c.journee, qui });
    parlerSi(`Rendez-vous ${c.titre}, ${jourParle(debutJour(c.debut))}${c.journee ? '' : ' à ' + heureParlee(c.debut)}. Vérifie et appuie sur Enregistrer.`);
  } else if (c.type === 'question') {
    const r = repondre(c); toast(r); parlerSi(r);
  } else { parlerSi('Je n\'ai pas compris.'); toast(`Je n'ai pas compris : « ${t} ». Essaie « ajoute du pain » ou « note : … ».`); }
}

// ---------- La tablette parle ----------
const veilleOuMuet = () => !reglages.parole || enVeille();
function parlerSi(t) { if (reglages.parole) dire(t); }
function jourParle(d) {
  const auj = debutJour(new Date());
  if (memeJour(d, auj)) return 'aujourd\'hui';
  if (memeJour(d, ajouterJours(auj, 1))) return 'demain';
  if (memeJour(d, ajouterJours(auj, 2))) return 'après-demain';
  return `${JOURS[jourIso(d) - 1].toLowerCase()} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]}`;
}
function quiParle(ev) {
  const ids = liensDe(ev.id); const ps = personnes();
  if (!ids.length || (ps.length && ps.every((p) => ids.includes(p.id)))) return '';
  return ' pour ' + enumerer(ids.map((id) => membre(id)).filter(Boolean).map((m) => m.prenom));
}
function rdvParles(occs) {
  return occs.sort((a, b) => a.debut - b.debut).map((o) => `${o.ev.journee_entiere ? 'toute la journée' : 'à ' + heureParlee(o.debut)}, ${o.ev.titre}${quiParle(o.ev)}`);
}
function repondre(c) {
  const auj = debutJour(new Date());
  const sansAcc = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (c.sujet === 'meteo') {
    const m = ui.meteo;
    if (!m || !m.jours) return 'Je n\'ai pas la météo pour le moment.';
    const dit = (j, k) => `${k === 0 ? 'Aujourd\'hui' : k === 1 ? 'Demain' : majuscule(JOURS[jourIso(new Date(j.date + 'T12:00:00')) - 1])} : ${(CODES[j.code] || '').toLowerCase()}, maximum ${j.max} degrés, minimum ${j.min}${j.pluie != null ? `, ${j.pluie} % de risque de pluie` : ''}`;
    if (c.semaine) return m.jours.map((j, k) => dit(j, k)).join('. ') + '.';
    const k = c.date ? Math.round((debutJour(c.date) - auj) / 86400000) : 0;
    const j = m.jours[k];
    if (!j) return 'Je n\'ai la météo que pour les 7 prochains jours.';
    if (k === 0 && m.temp != null) return `En ce moment à ${m.ville || 'la maison'}, il fait ${m.temp} degrés, ${(CODES[m.code] || '').toLowerCase()}. ${dit(j, 0)}.`;
    return dit(j, k) + '.';
  }
  if (c.sujet === 'courses') {
    const l = state.courses.filter((x) => !x.pris).map((x) => x.nom);
    if (!l.length) return 'La liste de courses est vide.';
    return `Sur la liste, il y a ${l.length} article${l.length > 1 ? 's' : ''} : ${enumerer(l.slice(0, 15))}${l.length > 15 ? ', et d\'autres' : ''}.`;
  }
  if (c.sujet === 'notes') {
    const l = [...state.notes].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 3);
    if (!l.length) return 'Il n\'y a aucune note.';
    return `${l.length > 1 ? 'Les dernières notes' : 'La dernière note'} : ${l.map((x) => x.texte).join('. ')}.`;
  }
  if (c.sujet === 'poubelle') {
    const l = state.rappels.filter((r) => r.type === 'tache').map((t) => ({ ...t, d: prochaineTache(t.jour_semaine || 1, t.fait_le) })).sort((a, b) => a.d - b.d);
    if (!l.length) return 'Aucune poubelle n\'est programmée.';
    return l.slice(0, 2).map((t) => `${memeJour(t.d, auj) ? 'Ce' + (t.moment ? ' ' + t.moment : ' jour') : (memeJour(t.d, ajouterJours(auj, 1)) ? 'Demain' : majuscule(JOURS[jourIso(t.d) - 1])) + (t.moment ? ' ' + t.moment : '')}, ${t.titre.toLowerCase()}`).join('. ') + '.';
  }
  if (c.sujet === 'anniv') {
    const l = (state.anniv || []).map((a) => ({ ...a, p: prochainAnniv(a.mois_jour, a.annee) })).filter((a) => a.p).sort((a, b) => a.p.dans - b.p.dans);
    if (!l.length) return 'Je ne connais aucun anniversaire.';
    const q = sansAcc(c.texte);
    const vise = l.find((a) => sansAcc(a.nom).split(/\s+/).some((mot) => mot.length > 2 && new RegExp(`\\b${mot}\\b`).test(q)));
    const phrase = (a) => `l'anniversaire de ${a.nom}, ${a.p.dans === 0 ? 'c\'est aujourd\'hui' : a.p.dans === 1 ? 'c\'est demain' : `c'est ${jourParle(a.p.date)}, dans ${a.p.dans} jours`}${a.p.age ? `, pour ses ${a.p.age} ans` : ''}`;
    if (vise) return majuscule(phrase(vise)) + '.';
    return 'Le prochain, ' + l.slice(0, 3).map(phrase).join('. Ensuite, ') + '.';
  }
  // Agenda
  if (c.semaine) {
    const l = debutSemaine(c.date || auj); const parties = [];
    for (let k = 0; k < 7; k++) { const j = ajouterJours(l, k); if (j < auj) continue; const o = rdvParles(occsJour(j)); if (o.length) parties.push(`${majuscule(jourParle(j))} : ${o.join(' ; ')}`); }
    return parties.length ? parties.join('. ') + '.' : 'Rien de prévu cette semaine.';
  }
  const j = c.date || auj;
  const o = rdvParles(occsJour(j));
  if (!o.length) return `Rien de prévu ${jourParle(j)}.`;
  return `${majuscule(jourParle(j))}, ${o.length} rendez-vous : ${o.join(' ; ')}.`;
}

// Annonces automatiques : rendez-vous, poubelles, anniversaires
const DEJA = 'famille-annonces';
function dejaAnnonce(cle) {
  let l = []; try { l = JSON.parse(localStorage.getItem(DEJA) || '[]'); } catch (e) { l = []; }
  if (l.includes(cle)) return true;
  l.push(cle); try { localStorage.setItem(DEJA, JSON.stringify(l.slice(-200))); } catch (e) { /* ignore */ }
  return false;
}
function annonces() {
  if (!state.moi || !reglages.annonces || veilleOuMuet()) return;
  const n = new Date(); const auj = debutJour(n); const jourCle = isoDate(auj);
  // Rendez-vous : 15 min avant (ou le rappel choisi)
  for (const o of occsJour(auj)) {
    if (o.ev.journee_entiere) continue;
    const avance = (o.ev.rappel_minutes != null && o.ev.rappel_minutes >= 0 ? o.ev.rappel_minutes : 15) * 60000;
    if (n >= o.debut - avance && n < o.debut && !dejaAnnonce(`rdv:${o.ev.id}:${o.debut.getTime()}`)) {
      const mn = Math.max(1, Math.round((o.debut - n) / 60000));
      dire(`Rappel : ${o.ev.titre}${quiParle(o.ev)}, dans ${mn} minute${mn > 1 ? 's' : ''}, à ${heureParlee(o.debut)}.`); return;
    }
  }
  // Poubelles : le soir à 19 h, le matin à 7 h 30
  for (const t of state.rappels.filter((r) => r.type === 'tache')) {
    const d = prochaineTache(t.jour_semaine || 1, t.fait_le);
    if (!memeJour(d, auj)) continue;
    const h = /matin/i.test(t.moment || '') ? 7.5 : /midi/i.test(t.moment || '') ? 11.5 : 19;
    if (n.getHours() + n.getMinutes() / 60 >= h && !dejaAnnonce(`tache:${t.id}:${jourCle}`)) {
      dire(`${/soir/i.test(t.moment || '') || h === 19 ? 'Ce soir' : 'Aujourd\'hui'}, pensez à sortir la ${t.titre.toLowerCase().replace(/^la\s+/, '')}.`); return;
    }
  }
  // Anniversaires du jour, à 9 h
  if (n.getHours() >= 9) {
    for (const a of (state.anniv || [])) {
      const p = prochainAnniv(a.mois_jour, a.annee);
      if (p && p.dans === 0 && !dejaAnnonce(`anniv:${a.nom}:${jourCle}`)) { dire(`Aujourd'hui, c'est l'anniversaire de ${a.nom}${p.age ? `, ${p.age} ans` : ''} !`); return; }
    }
  }
}

// ---------- Actions ----------
const actions = {
  annuler() { if (ui.annuler) ui.annuler(); zToast.innerHTML = ''; },
  vue(d) { const auj = debutJour(new Date()); if (d.v === 'auj') { ui.vue = 'jour'; ui.ref = auj; } else if (d.v === 'demain') { ui.vue = 'jour'; ui.ref = ajouterJours(auj, 1); } else { ui.vue = d.v; ui.ref = auj; } rendre(); },
  parler,
  ajouterRdv() { formRdv(); },
  voirRdv(d) {
    const ev = state.evenements.find((x) => x.id === d.id); if (!ev) return;
    const gens = liensDe(ev.id).map(membre).filter(Boolean);
    const lib = { jour: 'Tous les jours', semaine: 'Chaque semaine', mois: 'Tous les mois', annee: 'Tous les ans' }[ev.repetition];
    fenetre(ev.titre, `<p style="margin:0;font-size:20px">${ev.journee_entiere ? 'Toute la journée' : `${hhmm(new Date(ev.debut))}${ev.fin ? ' – ' + hhmm(new Date(ev.fin)) : ''}`}${ev.lieu ? ' · ' + esc(ev.lieu) : ''}</p>
      <p style="margin:0;font-size:17px;color:var(--doux)">${esc(gens.length ? gens.map((g) => g.prenom).join(', ') : 'Toute la famille')}${lib ? ' · ' + lib : ''}</p>${ev.note ? `<p style="margin:0;white-space:pre-wrap;font-size:17px">${esc(ev.note)}</p>` : ''}
      <div class="rangee"><button class="gros-btn" data-a="modifRdv" data-id="${ev.id}">${i('modifier', 20)} Modifier</button><button class="gros-btn danger" data-a="supprRdv" data-id="${ev.id}">${i('poubelle', 20)} Supprimer</button><button class="gros-btn second" data-a="fermer">Fermer</button></div>`);
  },
  modifRdv(d) { const ev = state.evenements.find((x) => x.id === d.id); if (ev) formRdv({}, ev); },
  supprRdv(d) {
    const ev = state.evenements.find((x) => x.id === d.id); if (!ev) return;
    confirmer('Supprimer ce rendez-vous ?', ev.repetition && ev.repetition !== 'aucune' ? `« ${ev.titre} » se répète : toutes les fois seront supprimées.` : `« ${ev.titre} » sera supprimé pour toute la famille.`, 'Supprimer',
      async () => { await ecrire({ cle: 'evenements', op: 'delete', ligne: { id: ev.id } }); state.liens = state.liens.filter((l) => l.evenement_id !== ev.id); rendre(); toast('Rendez-vous supprimé.'); });
  },
  async confirmerOui() { const a = ui.confirmation; ui.confirmation = null; fermer(); if (a) await a(); },
  decaler(d) {
    const k = Number(d.v);
    if (ui.vue === 'semaine') ui.ref = ajouterJours(ui.ref, 7 * k);
    else if (ui.vue === 'mois') ui.ref = new Date(ui.ref.getFullYear(), ui.ref.getMonth() + k, 1);
    else ui.ref = ajouterJours(ui.ref, k);
    rendre();
  },
  allerJour(d) { const [y, m, j] = d.v.split('-').map(Number); ui.ref = new Date(y, m - 1, j); ui.vue = 'jour'; rendre(); },
  ouvrirPage(d) { ui.page = d.v; if (d.v === 'meteo') { ui.meteoVue = '2j'; if (!ui.meteo || Date.now() - (ui.meteo.le || 0) > 20 * 60000) chargerMeteo(); } rendre(); },
  meteoVue(d) { ui.meteoVue = d.v; rendre(); },
  fermerPage() { ui.page = null; rendre(); },
  toujoursLa() { ui.alerte = null; ui.derniere = Date.now(); zAlerte.innerHTML = ''; },
  retourAccueil,
  testerVoix() { dire('Bonjour ! Je suis la tablette de la famille.'); },
  modifCourse(d) { const c = state.courses.find((x) => x.id === d.id); if (c) formCourse(c); },
  supprCourse(d) { const c = state.courses.find((x) => x.id === d.id); if (c) confirmer('Supprimer cet article ?', `« ${c.nom} » sera retiré de la liste.`, 'Supprimer', () => ecrire({ cle: 'courses', op: 'delete', ligne: { id: c.id } })); },
  viderPris() { const pris = state.courses.filter((c) => c.pris); confirmer('Vider les articles pris ?', `${pris.length} article(s) seront retirés de la liste.`, 'Vider', () => ecrire(pris.map((c) => ({ cle: 'courses', op: 'delete', ligne: { id: c.id } })))); },
  nouvelleNote() { formNote(null); },
  modifNote(d) { const n = state.notes.find((x) => x.id === d.id); if (n) formNote(n); },
  epingler(d) { const n = state.notes.find((x) => x.id === d.id); if (n) ecrire({ cle: 'notes', op: 'update', ligne: { id: n.id, epingle: !n.epingle } }); },
  supprNote(d) { confirmer('Supprimer cette note ?', 'Elle disparaîtra pour toute la famille.', 'Supprimer', () => ecrire({ cle: 'notes', op: 'delete', ligne: { id: d.id } })); },
  nouveauRappel(d) { formRappel(null, d.v); },
  modifRappel(d) { const r = state.rappels.find((x) => x.id === d.id); if (r) formRappel(r); },
  supprRappel(d) { const r = state.rappels.find((x) => x.id === d.id); if (r) confirmer('Supprimer ?', `« ${r.titre} » sera supprimé pour toute la famille.`, 'Supprimer', () => ecrire({ cle: 'rappels', op: 'delete', ligne: { id: r.id } })); },
  reglages() { ui.codeVisible = false; fenReglages(); },
  fermer,
  fermerVoile(d, el, e) { if (e.target === el) fermer(); },
  basculeCode() { ui.codeVisible = !ui.codeVisible; fenReglages(); },
  nouveauCode() {
    if (!ui.codeVisible) return toast('Affiche d\'abord le code.');
    confirmer('Changer le code famille ?', 'L\'ancien code ne marchera plus. Les comptes déjà inscrits ne sont pas touchés.', 'Changer le code', async () => {
      const { data, error } = await sb.rpc('nouveau_code_famille'); if (error) return toast(messageErreur(error));
      state.config = { ...state.config, code: data }; ui.codeVisible = true; fenReglages(); toast('Nouveau code : ' + data);
    });
  },
  veilleMaintenant() { ui.veilleForcee = true; ui.reveilJusqua = 0; fermer(); rendre(); },
  pleinEcran() { reglages.pleinEcran = true; sauverReglages(); allerPleinEcran(true); fermer(); },
  reveil() { ui.veilleForcee = false; ui.reveilJusqua = Date.now() + 5 * 60000; zVeille.innerHTML = ''; rendre(); },
  async deconnexion() { arreterTempsReel(); await sb.auth.signOut(); viderCache(); ui.session = null; ui.pret = false; fermer(); rendre(); }
};
const changements = {
  prendre(el) { ecrire({ cle: 'courses', op: 'update', ligne: { id: el.dataset.id, pris: el.checked, pris_le: el.checked ? new Date().toISOString() : null } }); },
  tacheFaite(el) { ecrire({ cle: 'rappels', op: 'update', ligne: { id: el.dataset.id, fait_le: el.dataset.v } }); toast('Bien joué ! C\'est noté pour cette semaine.'); },
  rappelFait(el) { ecrire({ cle: 'rappels', op: 'update', ligne: { id: el.dataset.id, fait_le: el.checked ? isoDate(new Date()) : null } }); },
  quiTous(el) { el.form.querySelectorAll('input[name=qui]').forEach((x) => { x.checked = el.checked; }); },
  quiPersonne(el) { const c = [...el.form.querySelectorAll('input[name=qui]')]; el.form.querySelector('input[name=tous]').checked = c.length > 0 && c.every((x) => x.checked); },
  veilleDebut(el) { reglages.veilleDebut = el.value; sauverReglages(); },
  veilleFin(el) { reglages.veilleFin = el.value; sauverReglages(); },
  parole(el) { reglages.parole = el.value === '1'; sauverReglages(); if (!reglages.parole) taire(); },
  annonces(el) { reglages.annonces = el.value === '1'; sauverReglages(); },
  modeVoix(el) { reglages.voix = el.value; sauverReglages(); if (el.value === 'locale') preparerVoixLocale().catch(() => {}); rendre(); }
};
const formulaires = {
  async connexion(form, sub) {
    const fd = new FormData(form); const email = (fd.get('email') || '').trim(); const mdp = fd.get('mdp') || '';
    const mode = sub && sub.value === 'inscription' ? 'inscription' : 'connexion';
    ui.auth = { erreur: null, info: null };
    const r = mode === 'connexion' ? await sb.auth.signInWithPassword({ email, password: mdp })
      : await sb.auth.signUp({ email, password: mdp, options: { emailRedirectTo: location.href, data: { app: 'famille' } } });
    if (r.error) ui.auth.erreur = messageErreur(r.error);
    else if (mode === 'inscription' && !r.data.session) ui.auth.info = 'Compte créé. Ouvre le lien reçu par e-mail, puis reviens te connecter ici.';
    rendre();
  },
  async code(form) {
    const code = (new FormData(form).get('code') || '').trim();
    const { error } = await sb.rpc('rejoindre_famille', { p_code: code, p_prenom: 'Maison' });
    if (error) { ui.rejoindre.erreur = messageErreur(error); return rendre(); }
    await demarrerDonnees();
  },
  async rdv(form) {
    const fd = new FormData(form); const titre = (fd.get('titre') || '').trim(); if (!titre) return toast('Donne un titre au rendez-vous.');
    const [y, m, j] = fd.get('date').split('-').map(Number);
    const journee = !fd.get('h1');
    const debut = new Date(y, m - 1, j); let fin;
    if (journee) fin = ajouterJours(debut, 1);
    else { const [a, b] = fd.get('h1').split(':').map(Number); debut.setHours(a, b, 0, 0); fin = new Date(debut.getTime() + 3600000); if (fd.get('h2')) { const [c, e] = fd.get('h2').split(':').map(Number); const f2 = new Date(debut); f2.setHours(c, e, 0, 0); if (f2 > debut) fin = f2; } }
    const rep = fd.get('repetition') || 'aucune';
    const id = form.dataset.id || nouvelId();
    const ancien = form.dataset.id ? state.evenements.find((x) => x.id === id) : null;
    const ligne = { id, titre, debut: debut.toISOString(), fin: fin.toISOString(), journee_entiere: journee, lieu: (fd.get('lieu') || '').trim() || null, repetition: rep,
      jours_semaine: rep === 'semaine' ? (ancien && ancien.repetition === 'semaine' && ancien.jours_semaine ? ancien.jours_semaine : [jourIso(debut)]) : null };
    const qui = fd.getAll('qui'); const avant = ancien ? liensDe(id) : [];
    const ops = [ancien ? { cle: 'evenements', op: 'update', ligne } : { cle: 'evenements', op: 'insert', ligne: { ...ligne, cree_par: state.moi.id, created_at: new Date().toISOString() } }];
    avant.filter((x) => !qui.includes(x)).forEach((mid) => ops.push({ cle: 'liens', op: 'delete', ligne: { evenement_id: id, membre_id: mid } }));
    qui.filter((x) => !avant.includes(x)).forEach((mid) => ops.push({ cle: 'liens', op: 'insert', ligne: { evenement_id: id, membre_id: mid } }));
    fermer();
    await ecrire(ops);
    toast(ancien ? 'Rendez-vous modifié.' : 'Rendez-vous ajouté.');
  },
  async ajoutCourse(form) {
    const input = form.querySelector('input[name=nom]');
    const noms = (input.value || '').split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean); if (!noms.length) return;
    input.value = ''; input.blur();
    await ecrire(noms.map((nom) => ({ cle: 'courses', op: 'insert', ligne: { id: nouvelId(), nom: majuscule(nom).slice(0, 120), source: 'tablette', ajoute_par: state.moi.id, pris: false, created_at: new Date().toISOString() } })));
    rendre();
  },
  async course(form) {
    const fd = new FormData(form); const nom = (fd.get('nom') || '').trim(); if (!nom) return;
    fermer(); await ecrire({ cle: 'courses', op: 'update', ligne: { id: form.dataset.id, nom: nom.slice(0, 120), quantite: (fd.get('quantite') || '').trim() || null } });
  },
  async note(form) {
    const fd = new FormData(form); const texte = (fd.get('texte') || '').trim(); if (!texte) return toast('La note est vide.');
    const ligne = { texte, pour: fd.get('pour') || null, epingle: !!fd.get('epingle') };
    fermer();
    if (form.dataset.id) await ecrire({ cle: 'notes', op: 'update', ligne: { id: form.dataset.id, ...ligne } });
    else await ecrire({ cle: 'notes', op: 'insert', ligne: { id: nouvelId(), auteur: state.moi.id, created_at: new Date().toISOString(), ...ligne } });
  },
  async rappel(form) {
    const fd = new FormData(form); const titre = (fd.get('titre') || '').trim(); if (!titre) return toast('Donne un titre.');
    const type = form.dataset.type;
    const ligne = type === 'tache' ? { titre, type, jour_semaine: Number(fd.get('jour')), moment: fd.get('moment') || null, couleur: fd.get('couleur') || null }
      : { titre, type, echeance: fd.get('echeance') || null, pour: fd.get('pour') || null };
    fermer();
    if (form.dataset.id) await ecrire({ cle: 'rappels', op: 'update', ligne: { id: form.dataset.id, ...ligne } });
    else await ecrire({ cle: 'rappels', op: 'insert', ligne: { id: nouvelId(), cree_par: state.moi.id, created_at: new Date().toISOString(), ...ligne } });
  }
};

scene.addEventListener('click', (e) => {
  reveillerSiBesoin();
  const el = e.target.closest('[data-a]'); if (!el || !actions[el.dataset.a]) return;
  if (el.dataset.a === 'fermerVoile' && e.target !== el) return;
  e.preventDefault();
  Promise.resolve(actions[el.dataset.a](el.dataset, el, e)).catch((x) => toast(messageErreur(x)));
});
scene.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && changements[el.dataset.c]) changements[el.dataset.c](el); });
scene.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f || !formulaires[f.dataset.form]) return;
  e.preventDefault();
  Promise.resolve(formulaires[f.dataset.form](f, e.submitter)).catch((x) => toast(messageErreur(x)));
});

// ---------- Écran toujours allumé + plein écran ----------
let verrou = null;
async function garderAllume() {
  try { if ('wakeLock' in navigator && !verrou) { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } } catch (e) { /* refusé */ }
}
function allerPleinEcran(force) {
  if ((reglages.pleinEcran || force) && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}
function reveillerSiBesoin() { garderAllume(); allerPleinEcran(false); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { garderAllume(); if (ui.session) demarrerDonnees(); } });

// ---------- Démarrage ----------
async function demarrerDonnees() {
  try { await toutCharger(ui.session.user.id); ui.pret = true; temps_reel(); } catch (e) { ui.pret = state.membres.length > 0; }
  chargerMeteo(); chargerPhotos();
  rendre();
}
async function demarrer() {
  chargerCache();
  const { data } = await sb.auth.getSession();
  ui.session = data.session;
  if (ui.session) { state.userId = ui.session.user.id; chargerCache(); ui.pret = state.membres.length > 0; }
  surChangement(() => rendre());
  sb.auth.onAuthStateChange((evt, s) => {
    const avant = ui.session && ui.session.user.id; ui.session = s;
    if (s && s.user.id !== avant) { state.userId = s.user.id; demarrerDonnees(); } else if (!s) rendre();
  });
  rendre();
  if (ui.session) demarrerDonnees();
  // horloge et mises à jour régulières
  let derniereMinute = -1;
  setInterval(() => { const m = new Date().getMinutes(); if (m !== derniereMinute) { derniereMinute = m; if (!zFen.innerHTML) rendre(); else rendreVeille(); } }, 5000);
  setInterval(chargerMeteo, 30 * 60000);
  setInterval(() => { chargerAnniv(); chargerPhotos(); }, 6 * 3600000);
  setInterval(photoSuivante, 30000);
  setInterval(verifierInactivite, 10000);
  setInterval(annonces, 20000);
  // recharge complète chaque nuit pour récupérer les mises à jour de l'appli
  setInterval(() => { const n = new Date(); if (n.getHours() === 4 && n.getMinutes() === 0) location.reload(); }, 60000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
demarrer();

// Prépare la voix locale en arrière-plan pour que le 1er « Parler » soit rapide
if (reglages.voix !== 'google' && micro()) setTimeout(() => preparerVoixLocale().catch(() => {}), 8000);
