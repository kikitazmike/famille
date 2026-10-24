// Écran de la tablette (affichage fixe à la maison)
import { sb, messageErreur } from './supa.js';
import { state, surChangement, chargerCache, viderCache, toutCharger, temps_reel, arreterTempsReel, ecrire, nouvelId, membre, personnes, liensDe, urlImage, chargerAnniv } from './store.js';
import { JOURS, JOURS_COURTS, MOIS, debutJour, ajouterJours, memeJour, jourIso, debutSemaine, hhmm, isoDate, majuscule, depuis, occurrences, prochainAnniv, prochaineTache, deux } from './dates.js';
import { i, esc } from './icones.js';
import { ecouter, comprendre, voixDisponible } from './voix.js';

const cadre = document.getElementById('cadre');
const scene = document.getElementById('scene');
scene.innerHTML = '<div id="vue"></div><div id="veille"></div><div id="fen"></div><div id="tst" aria-live="polite"></div>';
const vue = document.getElementById('vue');
const zVeille = document.getElementById('veille');
const zFen = document.getElementById('fen');
const zToast = document.getElementById('tst');

const REG = 'famille-tablette';
const reglages = (() => { try { return { pleinEcran: true, veilleDebut: '22:30', veilleFin: '06:30', ...JSON.parse(localStorage.getItem(REG) || '{}') }; } catch (e) { return { pleinEcran: true, veilleDebut: '22:30', veilleFin: '06:30' }; } })();
const sauverReglages = () => { try { localStorage.setItem(REG, JSON.stringify(reglages)); } catch (e) { /* ignore */ } };

const ui = { session: null, pret: false, vue: 'jour', ecoute: false, meteo: null, photos: [], photoIdx: 0, reveilJusqua: 0, veilleForcee: false, auth: { erreur: null, info: null }, rejoindre: { erreur: null } };

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
async function chargerMeteo() {
  try { const c = JSON.parse(localStorage.getItem('famille-meteo') || 'null'); if (c && !ui.meteo) ui.meteo = c; } catch (e) { /* ignore */ }
  const cfg = state.config || { latitude: 47.2184, longitude: -1.5536, ville: 'Nantes' };
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.latitude}&longitude=${cfg.longitude}&current=temperature_2m,weather_code&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2`;
    const r = await fetch(u); if (!r.ok) return;
    const d = await r.json();
    ui.meteo = {
      temp: Math.round(d.current.temperature_2m), code: d.current.weather_code, ville: cfg.ville,
      lever: d.daily.sunrise[0], coucher: d.daily.sunset[0],
      demain: { min: Math.round(d.daily.temperature_2m_min[1]), max: Math.round(d.daily.temperature_2m_max[1]), code: d.daily.weather_code[1], pluie: d.daily.precipitation_probability_max[1] },
      le: Date.now()
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
    meteo = `<div class="meteo">
      <div><span style="color:#D9774A">${i('nuage', 46, 1.4)}</span><div class="col"><span class="temp">${m.temp}°</span><small class="desc">${esc(CODES[m.code] || '')} · ${esc(m.ville || '')}</small></div></div>
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
  const lundi = debutSemaine(new Date()); const auj = debutJour(new Date());
  return `<div class="vue-semaine">${Array.from({ length: 7 }, (_, k) => {
    const j = ajouterJours(lundi, k);
    const occs = occsJour(j).sort((a, b) => a.debut - b.debut);
    return `<div class="j ${memeJour(j, auj) ? 'auj' : ''}"><h3>${JOURS_COURTS[k]} ${j.getDate()}</h3>
      ${occs.slice(0, 7).map((o) => { const ids = liensDe(o.ev.id); return `<div class="e"><i style="background:${tous(ids) ? 'var(--accent)' : couleurDe(ids) || 'var(--accent)'}"></i><span>${o.ev.journee_entiere ? '' : `<b style="font-weight:600">${hhmm(o.debut)}</b> `}${esc(o.ev.titre)}</span></div>`; }).join('')}
      ${occs.length > 7 ? `<span class="vide" style="font-size:12px">+${occs.length - 7} autres</span>` : ''}${!occs.length ? '<span class="vide" style="font-size:13px">Libre</span>' : ''}</div>`;
  }).join('')}</div>`;
}

function vueMois() {
  const n = new Date(); const premier = new Date(n.getFullYear(), n.getMonth(), 1);
  const debut = debutSemaine(premier);
  const cases = Array.from({ length: 42 }, (_, k) => ajouterJours(debut, k));
  const fin = cases.findIndex((d, k) => k % 7 === 0 && d.getMonth() !== n.getMonth() && d > premier);
  const visibles = fin > 0 ? cases.slice(0, fin) : cases;
  return `<div class="vue-mois">${JOURS_COURTS.map((j) => `<div class="t">${j}</div>`).join('')}${visibles.map((d) => {
    const occs = occsJour(d);
    return `<div class="c ${d.getMonth() !== n.getMonth() ? 'hors' : ''} ${memeJour(d, n) ? 'auj' : ''}"><span>${d.getDate()}</span><span class="pts">${occs.slice(0, 6).map((o) => { const ids = liensDe(o.ev.id); return `<i style="background:${memeJour(d, n) ? '#fff' : tous(ids) ? 'var(--accent)' : couleurDe(ids) || 'var(--accent)'}"></i>`; }).join('')}</span></div>`;
  }).join('')}</div>`;
}

function agendaHtml() {
  const auj = debutJour(new Date());
  const jour = ui.vue === 'demain' ? ajouterJours(auj, 1) : auj;
  const occs = occsJour(jour); const n = new Date();
  const enCours = occs.filter((o) => !o.ev.journee_entiere && o.debut <= n && o.fin > n).length;
  const vues = [['jour', 'Aujourd\'hui'], ['demain', 'Demain'], ['semaine', 'Semaine'], ['mois', 'Mois']];
  const titre = ui.vue === 'mois' ? `<span>${majuscule(MOIS[n.getMonth()])} ${n.getFullYear()}</span>` : ui.vue === 'semaine' ? '<span>Cette semaine</span>' : `<span>${occs.length} rendez-vous</span>${ui.vue === 'jour' && enCours ? `<span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>${enCours} en cours</span>` : ''}`;
  const corps = ui.vue === 'semaine' ? vueSemaine() : ui.vue === 'mois' ? vueMois() : vueJour(jour, ui.vue === 'jour');
  return `<section class="agenda" aria-label="Agenda de la famille">
    <div class="barre-outils"><div class="vues" role="tablist">${vues.map(([v, l]) => `<button role="tab" aria-selected="${ui.vue === v}" data-a="vue" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="outils">${titre}
        ${voixDisponible() ? `<button class="btn fort ${ui.ecoute ? 'ecoute' : ''}" data-a="parler">${i('micro', 18, 2)}${ui.ecoute ? 'J\'écoute…' : 'Parler'}</button>` : ''}
        <button class="btn" data-a="ajouterRdv">${i('ajouter', 18, 2.2)}Ajouter</button>
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
    <div class="carte"><h2>Courses <small>· ${courses.length}</small></h2>
      <div class="puces">${courses.slice(0, 9).map((c) => `<span class="puce">${esc(c.nom)}${c.source === 'titus' ? '<span class="etq">Titus</span>' : ''}</span>`).join('')}${courses.length > 9 ? `<span class="puce" style="color:var(--pale)">+${courses.length - 9}</span>` : ''}</div>
      ${!courses.length ? '<span class="vide">Rien à acheter</span>' : ''}</div>
    <div class="carte notes"><h2>Notes</h2>
      ${notes.map((no) => { const a = membre(no.auteur); return `<div class="mininote"><span>${esc(no.texte)}</span><small style="color:${a ? a.couleur : 'var(--pale)'}">${esc(a ? a.prenom : '')} · ${esc(depuis(no.created_at))}</small></div>`; }).join('') || '<span class="vide">Aucune note</span>'}</div>
    <div class="carte"><h2>Rappels</h2>
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
const fermer = () => { zFen.innerHTML = ''; };

function formRdv(pre = {}) {
  const d = pre.debut || (() => { const x = new Date(); x.setHours(Math.min(x.getHours() + 1, 21), 0, 0, 0); return x; })();
  const f = new Date(d.getTime() + 3600000);
  const qui = pre.qui || [];
  fenetre('Nouveau rendez-vous', `<form data-form="rdv" style="display:flex;flex-direction:column;gap:14px">
    <label class="champ">Titre<input name="titre" required maxlength="120" value="${esc(pre.titre || '')}"></label>
    <div class="rangee"><label class="champ">Date<input type="date" name="date" value="${isoDate(d)}" required></label>
      <label class="champ">Début<input type="time" name="h1" value="${pre.journee ? '' : hhmm(d)}"></label><label class="champ">Fin<input type="time" name="h2" value="${pre.journee ? '' : hhmm(f)}"></label></div>
    <div class="champ">Qui ? <span style="font-weight:400;color:var(--pale);font-size:13px">(personne = toute la famille)</span><div class="choix">${personnes().map((p) => `<label><input type="checkbox" name="qui" value="${p.id}" ${qui.includes(p.id) ? 'checked' : ''}><span style="width:12px;height:12px;border-radius:50%;background:${p.couleur}"></span>${esc(p.prenom)}</label>`).join('')}</div></div>
    <div class="rangee"><button class="gros-btn">Enregistrer</button><button type="button" class="gros-btn second" data-a="fermer">Annuler</button></div></form>`);
}

function fenReglages() {
  fenetre('Réglages de la tablette', `
    <div><div style="font-size:15px;color:var(--pale);text-align:center">Code famille</div><div class="code">${esc(state.config ? state.config.code : '')}</div>
      <p style="margin:0;text-align:center;color:var(--pale)">À taper dans l'appli téléphone pour créer un compte.</p></div>
    <button class="gros-btn second" data-a="nouveauCode">Changer le code</button>
    <div class="rangee"><label class="champ">Veille de<input type="time" value="${esc(reglages.veilleDebut)}" data-c="veilleDebut"></label><label class="champ">à<input type="time" value="${esc(reglages.veilleFin)}" data-c="veilleFin"></label></div>
    <div class="rangee"><button class="gros-btn second" data-a="veilleMaintenant">${i('lune', 20)} Veille maintenant</button><button class="gros-btn second" data-a="pleinEcran">${i('plein', 20)} Plein écran</button></div>
    <a class="gros-btn second" href="./" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Ouvrir l'appli téléphone</a>
    <button class="gros-btn danger" data-a="deconnexion">Déconnecter la tablette</button>`);
}

// ---------- Voix ----------
async function parler() {
  if (ui.ecoute) return;
  ui.ecoute = true; rendre();
  let t;
  try { t = await ecouter(); } catch (e) { ui.ecoute = false; rendre(); return toast(e.message); }
  ui.ecoute = false; rendre();
  const c = comprendre(t, personnes().map((p) => p.prenom));
  if (c.type === 'course') {
    const lignes = c.noms.map((nom) => ({ id: nouvelId(), nom: nom.slice(0, 120), source: 'tablette', ajoute_par: state.moi.id, pris: false, created_at: new Date().toISOString() }));
    await ecrire(lignes.map((l) => ({ cle: 'courses', op: 'insert', ligne: l })));
    toast(`Ajouté aux courses : ${c.noms.join(', ')}`, () => ecrire(lignes.map((l) => ({ cle: 'courses', op: 'delete', ligne: { id: l.id } }))));
  } else if (c.type === 'note') {
    const l = { id: nouvelId(), texte: c.texte.slice(0, 2000), auteur: state.moi.id, created_at: new Date().toISOString() };
    await ecrire({ cle: 'notes', op: 'insert', ligne: l });
    toast('Note ajoutée.', () => ecrire({ cle: 'notes', op: 'delete', ligne: { id: l.id } }));
  } else if (c.type === 'rdv') {
    const qui = c.qui.map((p) => personnes().find((x) => x.prenom === p)).filter(Boolean).map((p) => p.id);
    formRdv({ titre: c.titre, debut: c.debut, journee: c.journee, qui });
  } else toast(`Je n'ai pas compris : « ${t} ». Essaie « ajoute du pain » ou « note : … ».`);
}

// ---------- Actions ----------
const actions = {
  annuler() { if (ui.annuler) ui.annuler(); zToast.innerHTML = ''; },
  vue(d) { ui.vue = d.v; rendre(); },
  parler,
  ajouterRdv() { formRdv(); },
  voirRdv(d) {
    const ev = state.evenements.find((x) => x.id === d.id); if (!ev) return;
    const gens = liensDe(ev.id).map(membre).filter(Boolean);
    fenetre(ev.titre, `<p style="margin:0;font-size:18px">${ev.journee_entiere ? 'Toute la journée' : `${hhmm(new Date(ev.debut))}${ev.fin ? ' – ' + hhmm(new Date(ev.fin)) : ''}`}${ev.lieu ? ' · ' + esc(ev.lieu) : ''}</p>
      <p style="margin:0;color:var(--doux)">${esc(gens.length ? gens.map((g) => g.prenom).join(', ') : 'Toute la famille')}</p>${ev.note ? `<p style="margin:0;white-space:pre-wrap">${esc(ev.note)}</p>` : ''}
      <p style="margin:0;color:var(--pale);font-size:14px">Pour modifier, utilise l'appli sur ton téléphone.</p><button class="gros-btn second" data-a="fermer">Fermer</button>`);
  },
  reglages: fenReglages,
  fermer,
  fermerVoile(d, el, e) { if (e.target === el) fermer(); },
  async nouveauCode() { const { data, error } = await sb.rpc('nouveau_code_famille'); if (error) return toast(messageErreur(error)); state.config = { ...state.config, code: data }; fenReglages(); },
  veilleMaintenant() { ui.veilleForcee = true; ui.reveilJusqua = 0; fermer(); rendre(); },
  pleinEcran() { reglages.pleinEcran = true; sauverReglages(); allerPleinEcran(true); fermer(); },
  reveil() { ui.veilleForcee = false; ui.reveilJusqua = Date.now() + 5 * 60000; zVeille.innerHTML = ''; rendre(); },
  async deconnexion() { arreterTempsReel(); await sb.auth.signOut(); viderCache(); ui.session = null; ui.pret = false; fermer(); rendre(); }
};
const changements = {
  veilleDebut(el) { reglages.veilleDebut = el.value; sauverReglages(); },
  veilleFin(el) { reglages.veilleFin = el.value; sauverReglages(); }
};
const formulaires = {
  async connexion(form, sub) {
    const fd = new FormData(form); const email = (fd.get('email') || '').trim(); const mdp = fd.get('mdp') || '';
    const mode = sub && sub.value === 'inscription' ? 'inscription' : 'connexion';
    ui.auth = { erreur: null, info: null };
    const r = mode === 'connexion' ? await sb.auth.signInWithPassword({ email, password: mdp })
      : await sb.auth.signUp({ email, password: mdp, options: { emailRedirectTo: location.href } });
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
    const fd = new FormData(form); const titre = (fd.get('titre') || '').trim(); if (!titre) return;
    const [y, m, j] = fd.get('date').split('-').map(Number);
    const journee = !fd.get('h1');
    const debut = new Date(y, m - 1, j); let fin;
    if (journee) fin = ajouterJours(debut, 1);
    else { const [a, b] = fd.get('h1').split(':').map(Number); debut.setHours(a, b, 0, 0); fin = new Date(debut.getTime() + 3600000); if (fd.get('h2')) { const [c, e] = fd.get('h2').split(':').map(Number); const f2 = new Date(debut); f2.setHours(c, e, 0, 0); if (f2 > debut) fin = f2; } }
    const id = nouvelId();
    const ops = [{ cle: 'evenements', op: 'insert', ligne: { id, titre, debut: debut.toISOString(), fin: fin.toISOString(), journee_entiere: journee, repetition: 'aucune', cree_par: state.moi.id, created_at: new Date().toISOString() } },
      ...fd.getAll('qui').map((mid) => ({ cle: 'liens', op: 'insert', ligne: { evenement_id: id, membre_id: mid } }))];
    fermer();
    await ecrire(ops);
    toast('Rendez-vous ajouté.');
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
  // recharge complète chaque nuit pour récupérer les mises à jour de l'appli
  setInterval(() => { const n = new Date(); if (n.getHours() === 4 && n.getMinutes() === 0) location.reload(); }, 60000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
demarrer();
