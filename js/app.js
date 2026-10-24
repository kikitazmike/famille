// Appli téléphone Famille
import { sb, messageErreur } from './supa.js';
import {
  state, surChangement, chargerCache, viderCache, toutCharger, temps_reel, arreterTempsReel, ecrire, nouvelId,
  membre, personnes, liensDe, urlImage, reduireImage, chargerAnniv
} from './store.js';
import {
  JOURS, JOURS_COURTS, MOIS, debutJour, ajouterJours, memeJour, jourIso, debutSemaine, hhmm, isoDate, dateLongue,
  majuscule, depuis, occurrences, libelleRepetition, prochainAnniv, prochaineTache, deux
} from './dates.js';
import { i, esc, ICONES_PROFIL, COULEURS_APPLI, COULEURS_PERSO, eclaircir, assombrir, initiales } from './icones.js';
import { ecouter, comprendre, voixDisponible } from './voix.js';
import { FETAMI_SITE } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const contenu = $('#contenu');
const zoneFenetre = $('#zone-fenetre');
const zoneToast = $('#zone-toast');

const ui = {
  session: null, pret: false, chargeErreur: null, recup: false,
  route: 'agenda', jour: debutJour(new Date()), filtre: 'tous', filtreNotes: 'toutes',
  auth: { mode: 'connexion', erreur: null, info: null, occupe: false },
  rejoindre: { code: '', prenoms: null, choisi: null, erreur: null, occupe: false },
  ecoute: false, photos: null, avatars: {}
};

// ---------------- Préférences (thème, couleur, taille du texte) ----------------
const PREFS = 'famille-prefs';
function lirePrefs() { try { return JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch (e) { return {}; } }
function appliquerPrefs(p) {
  const theme = !p.theme || p.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'fonce' : 'clair') : p.theme;
  const r = document.documentElement;
  r.dataset.theme = theme;
  const a = p.accent || '#6D5BD0';
  r.style.setProperty('--accent', a);
  r.style.setProperty('--accent-doux', a + (theme === 'fonce' ? '40' : '1F'));
  r.style.setProperty('--accent-texte', theme === 'fonce' ? eclaircir(a, 0.55) : assombrir(a, 0.22));
  r.style.setProperty('--accent-clair', eclaircir(a, 0.55));
  r.style.setProperty('--zoom', p.zoom || 1);
  const mc = $('meta[name=theme-color]'); if (mc) mc.content = theme === 'fonce' ? '#24222C' : '#FBF7F1';
}
async function majPrefs(changement) {
  const p = { ...lirePrefs(), ...changement };
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) { /* ignore */ }
  appliquerPrefs(p);
  if (state.moi) {
    try { await ecrire({ cle: 'membres', op: 'update', ligne: { id: state.moi.id, prefs: p } }); } catch (e) { /* hors ligne */ }
  }
  rendre();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => appliquerPrefs(lirePrefs()));
appliquerPrefs(lirePrefs());

// ---------------- Petits outils d'affichage ----------------
function toast(message, annuler) {
  zoneToast.innerHTML = `<div class="toast" role="status"><span>${esc(message)}</span>${annuler ? '<button type="button" data-a="annulerToast">Annuler</button>' : ''}</div>`;
  ui.annulerToast = annuler || null;
  clearTimeout(ui.toastMinuteur);
  ui.toastMinuteur = setTimeout(() => { zoneToast.innerHTML = ''; ui.annulerToast = null; }, annuler ? 6000 : 3500);
}
function erreur(e) { toast(messageErreur(e)); }

function avatar(m, petit = false, grand = false) {
  if (!m) return '';
  const cls = 'avatar' + (petit ? ' petit' : '');
  const taille = petit ? 16 : grand ? 34 : 22;
  const dim = grand ? 'width:4.5rem;height:4.5rem;font-size:1.4rem;' : '';
  if (m.avatar_path) {
    const u = ui.avatars[m.avatar_path];
    if (u === undefined) { ui.avatars[m.avatar_path] = null; urlImage('avatars', m.avatar_path).then((url) => { ui.avatars[m.avatar_path] = url || ''; rendre(); }); }
    if (u) return `<span class="${cls}" style="${dim}background-image:url('${esc(u)}');background-color:${esc(m.couleur)}" role="img" aria-label="${esc(m.prenom)}"></span>`;
  }
  if (m.icone) return `<span class="${cls}" style="${dim}background:${esc(m.couleur)}" role="img" aria-label="${esc(m.prenom)}">${i(m.icone, taille, 2)}</span>`;
  return `<span class="${cls}" style="${dim}background:${esc(m.couleur)}" aria-hidden="true">${esc(initiales(m.prenom))}</span>`;
}

function entete(titre, sous) {
  return `<header class="entete"><div><div class="sous">${esc(sous || '')}</div><h1>${esc(titre)}</h1></div>
    <a href="#/reglages" aria-label="Mes réglages" style="text-decoration:none">${avatar(state.moi)}</a></header>`;
}

function onglets() {
  const o = [['agenda', 'Agenda', 'agenda'], ['courses', 'Courses', 'courses'], ['notes', 'Notes', 'notes'], ['anniv', 'Anniv.', 'anniv'], ['plus', 'Plus', 'plus']];
  const actif = ui.route === 'reglages' ? 'plus' : ui.route;
  return `<div class="onglets"><nav aria-label="Navigation">${o.map(([r, l, ic]) =>
    `<a href="#/${r}" ${actif === r ? 'aria-current="page"' : ''}>${i(ic, 24)}${l}</a>`).join('')}</nav></div>`;
}

function bandeau() {
  if (state.enLigne && !state.enAttente) return '';
  const t = !state.enLigne ? 'Hors connexion — tes ajouts partiront au retour du réseau' : `Envoi en cours (${state.enAttente})…`;
  return `<div class="bandeau" role="status">${i('hors_ligne', 16)}${t}</div>`;
}

const nomsDe = (ids) => ids.map((id) => membre(id)).filter(Boolean);
function couleurRdv(ids) {
  const p = nomsDe(ids).filter((m) => m.type === 'personne');
  if (p.length === 1) return p[0].couleur;
  return 'var(--accent)';
}

// ---------------- Écrans ----------------
function ecranAgenda() {
  const lundi = debutSemaine(ui.jour);
  const auj = debutJour(new Date());
  const jours = Array.from({ length: 7 }, (_, k) => ajouterJours(lundi, k));
  const filtrer = (o) => {
    if (ui.filtre === 'tous') return true;
    const ids = liensDe(o.ev.id);
    const cible = ui.filtre === 'moi' ? state.moi && state.moi.id : ui.filtre;
    return ids.length === 0 || ids.includes(cible);
  };
  const occs = (j) => state.evenements.flatMap((ev) => occurrences(ev, j, ajouterJours(j, 1))).filter(filtrer)
    .sort((a, b) => (b.ev.journee_entiere - a.ev.journee_entiere) || (a.debut - b.debut));
  const maintenant = new Date();
  const liste = occs(ui.jour);

  const semaine = `<div class="semaine" role="tablist" aria-label="Jours de la semaine">
    <button class="icone-btn" data-a="semaine" data-v="-7" aria-label="Semaine précédente">${i('gauche')}</button>
    ${jours.map((j, k) => {
      const pts = occs(j).slice(0, 3).map((o) => `<i style="background:${couleurRdv(liensDe(o.ev.id))}"></i>`).join('');
      return `<button class="jour ${memeJour(j, auj) ? 'auj' : ''}" role="tab" aria-selected="${memeJour(j, ui.jour)}" data-a="choisirJour" data-v="${isoDate(j)}" aria-label="${dateLongue(j)}">
        <small>${JOURS_COURTS[k]}</small><b>${j.getDate()}</b><span class="points">${pts}</span></button>`;
    }).join('')}
    <button class="icone-btn" data-a="semaine" data-v="7" aria-label="Semaine suivante">${i('droite')}</button></div>`;

  const filtres = [['tous', 'Tous'], ['moi', 'Moi'], ...personnes().filter((p) => !state.moi || p.id !== state.moi.id).map((p) => [p.id, p.prenom])];
  const puces = `<div class="puces" role="group" aria-label="Filtrer">${filtres.map(([v, l]) =>
    `<button class="puce" aria-pressed="${ui.filtre === v}" data-a="filtre" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;

  const items = liste.map((o) => {
    const ids = liensDe(o.ev.id);
    const gens = nomsDe(ids);
    const passe = o.fin < maintenant;
    const encours = o.debut <= maintenant && o.fin > maintenant && !o.ev.journee_entiere;
    const pct = encours ? Math.round(((maintenant - o.debut) / (o.fin - o.debut)) * 100) : 0;
    const meta = [passe ? '✓ terminé' : '', gens.length ? gens.map((g) => g.prenom).join(', ') : 'Tous', o.ev.lieu, !o.ev.journee_entiere && o.ev.fin ? `jusqu'à ${hhmm(o.fin)}` : '', libelleRepetition(o.ev)].filter(Boolean).join(' · ');
    return `<button class="rdv ${passe ? 'passe' : ''} ${encours ? 'encours' : ''}" data-a="ouvrirRdv" data-id="${o.ev.id}">
      <span class="heure">${o.ev.journee_entiere ? 'Journée' : hhmm(o.debut)}</span>
      <span class="barre" style="background:${couleurRdv(ids)}"></span>
      <span class="corps"><span class="t">${esc(o.ev.titre)}</span><span class="m">${esc(meta)}</span>
        ${encours ? `<span class="progression"><span style="width:${pct}%"></span></span>` : ''}</span>
      ${gens.length > 1 ? `<span class="qui">${gens.map((g) => `<span class="pastille" style="background:${g.couleur}"></span>`).join('')}</span>` : ''}
    </button>`;
  }).join('');

  const titreJour = memeJour(ui.jour, auj) ? 'Aujourd\'hui' : memeJour(ui.jour, ajouterJours(auj, 1)) ? 'Demain' : majuscule(dateLongue(ui.jour));
  return `${entete('Agenda', state.moi ? `Bonjour ${state.moi.prenom}` : '')}${semaine}${puces}
    <h2 class="titre-section">${esc(titreJour)}</h2>
    <div class="liste">${items || '<p class="vide">Rien de prévu ce jour-là.</p>'}</div>
    <div class="flottants">${voixDisponible() ? `<button class="fab rond ${ui.ecoute ? 'ecoute' : ''}" data-a="dicter" data-v="rdv" aria-label="Dicter un rendez-vous">${i('micro', 22, 2)}</button>` : ''}
      <button class="fab" data-a="nouveauRdv" aria-label="Ajouter un rendez-vous">${i('ajouter', 26, 2.2)}</button></div>`;
}

function ecranCourses() {
  const aPrendre = state.courses.filter((c) => !c.pris).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  const pris = state.courses.filter((c) => c.pris).sort((a, b) => (a.pris_le || '') > (b.pris_le || '') ? -1 : 1);
  const ligne = (c) => {
    const m = membre(c.ajoute_par);
    const tag = c.source === 'titus' ? '<span class="etiquette">Titus</span>' : c.source === 'tablette' ? '<span class="etiquette">Tablette</span>' : '';
    return `<div class="article ${c.pris ? 'pris' : ''}">
      <label><input type="checkbox" data-c="prendre" data-id="${c.id}" ${c.pris ? 'checked' : ''}>
        <span style="flex:1;display:flex;flex-direction:column"><span>${esc(c.nom)}</span>${c.quantite ? `<small style="color:var(--pale);font-size:.8rem">${esc(c.quantite)}</small>` : ''}</span></label>
      ${tag}${m && !tag ? `<span class="pastille" style="background:${m.couleur}" title="Ajouté par ${esc(m.prenom)}"></span>` : ''}
      <button class="icone-btn" data-a="supprCourse" data-id="${c.id}" aria-label="Supprimer ${esc(c.nom)}">${i('poubelle', 18)}</button>
    </div>`;
  };
  return `${entete('Courses', aPrendre.length ? `${aPrendre.length} article${aPrendre.length > 1 ? 's' : ''} à prendre` : 'Rien à acheter')}
    <form class="ajout" data-form="ajoutCourse" autocomplete="off">
      <label class="sr" for="nouvelArticle">Ajouter un article</label>
      <input id="nouvelArticle" name="nom" placeholder="Ajouter un article…" enterkeyhint="done" maxlength="120">
      ${voixDisponible() ? `<button type="button" class="icone-btn doux ${ui.ecoute ? 'ecoute' : ''}" data-a="dicter" data-v="course" aria-label="Dicter un article">${i('micro', 20, 2)}</button>` : ''}
      <button type="submit" class="icone-btn doux" aria-label="Ajouter">${i('ajouter', 20, 2.2)}</button>
    </form>
    <h2 class="titre-section">À prendre</h2>
    <div class="liste">${aPrendre.map(ligne).join('') || '<p class="vide">La liste est vide.</p>'}</div>
    ${pris.length ? `<h2 class="titre-section">Déjà pris</h2><div class="liste">${pris.map(ligne).join('')}</div>
    <button class="bouton danger" data-a="viderPris" style="align-self:flex-start">Vider les articles pris</button>` : ''}`;
}

function ecranNotes() {
  const moi = state.moi && state.moi.id;
  let notes = state.notes.slice().sort((a, b) => (b.epingle - a.epingle) || (a.created_at < b.created_at ? 1 : -1));
  if (ui.filtreNotes === 'moi') notes = notes.filter((n) => !n.pour || n.pour === moi);
  if (ui.filtreNotes === 'epingle') notes = notes.filter((n) => n.epingle);
  const f = [['toutes', 'Toutes'], ['moi', 'Pour moi'], ['epingle', 'Épinglées']];
  const cartes = notes.map((n) => {
    const a = membre(n.auteur); const p = n.pour ? membre(n.pour) : null;
    return `<article class="note">
      <div class="haut"><span class="auteur"><span class="pastille" style="background:${a ? a.couleur : 'var(--pale)'}"></span>${esc(a ? a.prenom : 'Quelqu\'un')} · ${esc(depuis(n.created_at))}</span>
        <button class="icone-btn" data-a="epingler" data-id="${n.id}" aria-pressed="${n.epingle}" aria-label="${n.epingle ? 'Désépingler' : 'Épingler'}" style="${n.epingle ? 'color:var(--accent-texte)' : ''}">${i('epingle', 18, n.epingle ? 2.4 : 1.8)}</button></div>
      <p>${esc(n.texte)}</p>
      <div class="bas"><span class="tag">Pour : ${esc(p ? p.prenom : 'Tous')}</span>
        <span><button class="icone-btn" data-a="ouvrirNote" data-id="${n.id}" aria-label="Modifier la note">${i('modifier', 18)}</button>
        <button class="icone-btn" data-a="supprNote" data-id="${n.id}" aria-label="Supprimer la note" style="color:var(--danger)">${i('poubelle', 18)}</button></span></div>
    </article>`;
  }).join('');
  return `${entete('Notes', `${state.notes.length} note${state.notes.length > 1 ? 's' : ''}`)}
    <div class="puces" role="group" aria-label="Filtrer">${f.map(([v, l]) => `<button class="puce" aria-pressed="${ui.filtreNotes === v}" data-a="filtreNotes" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="liste">${cartes || '<p class="vide">Aucune note pour l\'instant.</p>'}</div>
    <div class="flottants">${voixDisponible() ? `<button class="fab rond ${ui.ecoute ? 'ecoute' : ''}" data-a="dicter" data-v="note" aria-label="Dicter une note">${i('micro', 22, 2)}</button>` : ''}
      <button class="fab" data-a="nouvelleNote" aria-label="Ajouter une note">${i('ajouter', 26, 2.2)}</button></div>`;
}

function ecranAnniv() {
  const liste = (state.anniv || []).map((a) => ({ ...a, p: prochainAnniv(a.mois_jour, a.annee) })).filter((a) => a.p).sort((a, b) => a.p.dans - b.p.dans);
  const items = liste.map((a) => {
    const quand = a.p.dans === 0 ? 'Aujourd\'hui !' : a.p.dans === 1 ? 'Demain' : `${a.p.date.getDate()} ${MOIS[a.p.date.getMonth()]}`;
    return `<div class="anniv ${a.p.dans <= 7 ? 'bientot' : ''}">
      <div class="j"><b>${a.p.dans}</b><small>${a.p.dans > 1 ? 'jours' : 'jour'}</small></div>
      <div style="flex:1;min-width:0"><div style="font-size:1.05rem;font-weight:500">${esc(a.nom)}</div>
        <div style="font-size:.85rem;color:var(--pale)">${esc(quand)}${a.p.age ? ` · ${a.p.age} ans` : ''}${a.groupe ? ` · ${esc(a.groupe)}` : ''}</div></div>
    </div>`;
  }).join('');
  return `${entete('Anniversaires', liste.length ? 'Depuis Fetami' : '')}
    ${!state.config || !state.config.fetami_jeton ? '<p class="info">Fetami n\'est pas encore relié.</p>' : ''}
    <div class="liste">${items || '<p class="vide">Aucun anniversaire trouvé.</p>'}</div>
    <p class="aide" style="text-align:center">Pour ajouter ou modifier un anniversaire, utilise <a href="${FETAMI_SITE}" target="_blank" rel="noopener">Fetami</a>.</p>`;
}

function ecranPlus() {
  const taches = state.rappels.filter((r) => r.type === 'tache').map((t) => ({ ...t, prochaine: prochaineTache(t.jour_semaine || 1, t.fait_le) })).sort((a, b) => a.prochaine - b.prochaine);
  const rappels = state.rappels.filter((r) => r.type === 'rappel').sort((a, b) => (!!a.fait_le - !!b.fait_le) || ((a.echeance || '9') < (b.echeance || '9') ? -1 : 1));
  const auj = debutJour(new Date());
  const quand = (d) => { const n = Math.round((d - auj) / 86400000); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : `dans ${n} jours`; };
  const lignesTaches = taches.map((t) => `<div class="article">
      <label><input type="checkbox" data-c="tacheFaite" data-id="${t.id}" data-v="${isoDate(t.prochaine)}">
        <span class="pastille" style="background:${esc(t.couleur || 'var(--accent)')};width:.9rem;height:.9rem"></span>
        <span style="display:flex;flex-direction:column"><span>${esc(t.titre)}</span><small style="color:var(--pale);font-size:.8rem">${JOURS[(t.jour_semaine || 1) - 1]}${t.moment ? ' ' + esc(t.moment) : ''} · ${quand(t.prochaine)}</small></span></label>
      <button class="icone-btn" data-a="ouvrirRappel" data-id="${t.id}" aria-label="Modifier ${esc(t.titre)}">${i('modifier', 18)}</button></div>`).join('');
  const lignesRappels = rappels.map((r) => {
    const p = r.pour ? membre(r.pour) : null;
    let ech = '';
    if (r.echeance) { const d = new Date(r.echeance + 'T00:00:00'); const n = Math.round((d - auj) / 86400000); ech = n < 0 ? `en retard (${d.toLocaleDateString('fr-FR')})` : n === 0 ? 'aujourd\'hui' : `avant le ${d.getDate()} ${MOIS[d.getMonth()]}${n <= 14 ? ` · dans ${n} j` : ''}`; }
    return `<div class="article ${r.fait_le ? 'pris' : ''}">
      <label><input type="checkbox" data-c="rappelFait" data-id="${r.id}" ${r.fait_le ? 'checked' : ''}>
        <span style="display:flex;flex-direction:column"><span>${esc(r.titre)}</span><small style="color:var(--pale);font-size:.8rem">${esc([ech, p ? 'pour ' + p.prenom : ''].filter(Boolean).join(' · '))}</small></span></label>
      <button class="icone-btn" data-a="ouvrirRappel" data-id="${r.id}" aria-label="Modifier ${esc(r.titre)}">${i('modifier', 18)}</button></div>`;
  }).join('');
  if (ui.photos === null) { ui.photos = []; chargerPhotos(); }
  return `${entete('Plus', 'La maison')}
    <h2 class="titre-section">Tâches de la maison</h2>
    <div class="liste">${lignesTaches || '<p class="vide">Aucune tâche.</p>'}</div>
    <button class="bouton second" data-a="nouveauRappel" data-v="tache">${i('ajouter', 18, 2.2)}Ajouter une tâche</button>
    <h2 class="titre-section">Rappels</h2>
    <div class="liste">${lignesRappels || '<p class="vide">Aucun rappel.</p>'}</div>
    <button class="bouton second" data-a="nouveauRappel" data-v="rappel">${i('ajouter', 18, 2.2)}Ajouter un rappel</button>
    <h2 class="titre-section">Photos du mode veille</h2>
    <p class="aide">Elles défilent sur la tablette la nuit.</p>
    <div class="photos">${(ui.photos || []).map((p) => `<figure>${p.url ? `<img src="${esc(p.url)}" alt="">` : ''}<button data-a="supprPhoto" data-v="${esc(p.nom)}" aria-label="Supprimer la photo">${i('fermer', 16, 2.2)}</button></figure>`).join('')}</div>
    <label class="bouton second">${i('image', 18)}Ajouter des photos<input type="file" accept="image/*" multiple class="sr" data-c="ajoutPhotos"></label>
    <h2 class="titre-section">Code famille</h2>
    <div class="carte"><div class="code ${ui.codeVisible ? '' : 'flou'}" ${ui.codeVisible ? '' : 'aria-label="Code masqué"'}>${ui.codeVisible ? esc(state.config ? state.config.code : '') : '888888'}</div>
      <p class="aide" style="text-align:center;margin:0 0 .5rem">À donner à un membre de la famille pour qu'il crée son compte.</p>
      <div class="actions"><button class="bouton second" data-a="basculeCode">${ui.codeVisible ? 'Masquer le code' : 'Afficher le code'}</button>
      <button class="bouton second" data-a="nouveauCode" ${ui.codeVisible ? '' : 'disabled title="Affiche d\'abord le code"'}>Changer le code</button></div></div>
    <div class="groupe">
      <a class="item" href="#/reglages" style="text-decoration:none;color:inherit"><span style="display:flex;gap:.7rem;align-items:center">${i('reglages', 20)}Réglages</span>${i('droite', 18)}</a>
      <a class="item" href="tablette.html" style="text-decoration:none;color:inherit"><span style="display:flex;gap:.7rem;align-items:center">${i('ecran', 20)}Écran de la tablette</span>${i('droite', 18)}</a>
    </div>`;
}

function ecranReglages() {
  const p = lirePrefs();
  const m = state.moi;
  const theme = p.theme || 'auto';
  const accent = p.accent || '#6D5BD0';
  const notifOk = 'Notification' in window && Notification.permission === 'granted' && p.notifs !== false;
  return `<header class="entete"><div><div class="sous">Mon compte</div><h1>Réglages</h1></div>
      <a class="icone-btn" href="#/plus" aria-label="Retour">${i('fermer')}</a></header>
    <section class="carte" aria-label="Profil" style="display:flex;gap:1rem;align-items:center">
      <div>${avatar(m, false, true)}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:.35rem"><span style="font-size:1.25rem;font-weight:500">${esc(m ? m.prenom : '')}</span>
        <label class="lien" style="padding:0;text-align:left;cursor:pointer">Choisir une photo<input type="file" accept="image/*" class="sr" data-c="photoProfil"></label>
        ${m && (m.avatar_path || m.icone) ? '<button class="lien" style="padding:0;text-align:left" data-a="retirerAvatar">Retirer la photo / l\'icône</button>' : ''}</div>
    </section>
    <h2 class="titre-section">Ou une icône</h2>
    <div class="grille-icones" role="radiogroup" aria-label="Icône de profil">${ICONES_PROFIL.map((n) =>
      `<button role="radio" aria-checked="${!!m && m.icone === n && !m.avatar_path}" data-a="icone" data-v="${n}" aria-label="${n}">${i(n, 24)}</button>`).join('')}</div>
    <h2 class="titre-section">Ma couleur dans l'agenda</h2>
    <div class="nuancier" role="radiogroup" aria-label="Ma couleur">${COULEURS_PERSO.map((c) =>
      `<button role="radio" aria-checked="${!!m && m.couleur === c}" data-a="maCouleur" data-v="${c}" style="background:${c};color:${c}" aria-label="Couleur ${c}"></button>`).join('')}</div>
    <h2 class="titre-section">Apparence</h2>
    <div class="carte" style="display:flex;flex-direction:column;gap:1rem">
      <div class="segment" role="radiogroup" aria-label="Thème">${[['clair', 'Clair'], ['fonce', 'Foncé'], ['auto', 'Auto']].map(([v, l]) =>
        `<button role="radio" aria-checked="${theme === v}" data-a="theme" data-v="${v}">${l}</button>`).join('')}</div>
      <div><div style="margin-bottom:.5rem">Couleur de l'appli</div>
        <div class="nuancier" role="radiogroup" aria-label="Couleur de l'appli">${COULEURS_APPLI.map((c) =>
          `<button role="radio" aria-checked="${accent === c.hex}" data-a="accent" data-v="${c.hex}" style="background:${c.hex};color:${c.hex}" aria-label="${c.nom}"></button>`).join('')}</div></div>
      <label class="champ" style="font-weight:400">Taille du texte
        <span class="ligne" style="gap:.8rem"><span aria-hidden="true" style="flex:0;font-size:.85rem">A</span>
        <input type="range" min="0.85" max="1.4" step="0.05" value="${p.zoom || 1}" data-c="zoom" aria-label="Taille du texte">
        <span aria-hidden="true" style="flex:0;font-size:1.4rem">A</span></span></label>
    </div>
    <h2 class="titre-section">Compte</h2>
    <div class="groupe">
      <button class="item" data-a="changerEmail"><span style="display:flex;flex-direction:column"><span>E-mail</span><small style="color:var(--pale)">${esc(ui.session && ui.session.user.email)}</small></span>${i('droite', 18)}</button>
      <button class="item" data-a="changerMdp"><span>Mot de passe</span>${i('droite', 18)}</button>
      <label class="item"><span>Notifications des rappels</span><input type="checkbox" data-c="notifs" ${notifOk ? 'checked' : ''} style="width:1.35rem;height:1.35rem;accent-color:var(--accent)"></label>
      <button class="item" data-a="deconnexion"><span>Se déconnecter</span>${i('sortir', 18)}</button>
    </div>
    <button class="bouton danger" data-a="supprimerCompte">Supprimer mon compte</button>
    <p class="aide" style="text-align:center">Famille · version 1.0</p>`;
}

// ---------------- Connexion / inscription ----------------
function ecranConnexion() {
  const a = ui.auth;
  const titres = { connexion: 'Connexion', inscription: 'Créer mon compte', oubli: 'Mot de passe oublié' };
  return `<div class="accueil">
    <div class="logo">${i('maison', 32)}</div>
    <h1>${a.mode === 'inscription' ? 'Bienvenue' : 'Famille'}</h1>
    <p class="c">${a.mode === 'oubli' ? 'Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.' : 'L\'agenda, les courses et les notes de la maison.'}</p>
    ${a.erreur ? `<p class="erreur" role="alert">${esc(a.erreur)}</p>` : ''}${a.info ? `<p class="info" role="status">${esc(a.info)}</p>` : ''}
    <form data-form="auth" style="display:flex;flex-direction:column;gap:.9rem" novalidate>
      <label class="champ">Adresse e-mail<input type="email" name="email" autocomplete="email" required placeholder="ton.adresse@mail.fr"></label>
      ${a.mode !== 'oubli' ? `<label class="champ">Mot de passe<input type="password" name="mdp" minlength="8" required autocomplete="${a.mode === 'inscription' ? 'new-password' : 'current-password'}" placeholder="8 caractères minimum"></label>` : ''}
      <button class="bouton plein" type="submit" ${a.occupe ? 'disabled' : ''}>${a.occupe ? 'Patiente…' : titres[a.mode] === 'Mot de passe oublié' ? 'Envoyer le lien' : titres[a.mode]}</button>
    </form>
    <div style="display:flex;flex-direction:column;align-items:center">
      ${a.mode !== 'connexion' ? '<button class="lien" data-a="modeAuth" data-v="connexion">J\'ai déjà un compte</button>' : '<button class="lien" data-a="modeAuth" data-v="inscription">Créer un compte</button>'}
      ${a.mode === 'connexion' ? '<button class="lien" data-a="modeAuth" data-v="oubli">Mot de passe oublié ?</button>' : ''}
    </div></div>`;
}

function ecranRejoindre() {
  const r = ui.rejoindre;
  const choix = r.prenoms ? r.prenoms.filter((p) => p.type === 'personne') : null;
  return `<div class="accueil">
    <div class="logo">${i('maison', 32)}</div>
    <h1>Rejoindre la famille</h1>
    <p class="c">${choix ? 'Qui es-tu ?' : 'Tape le code famille. Il s\'affiche sur la tablette, ou dans « Plus » sur le téléphone d\'un membre déjà inscrit.'}</p>
    ${r.erreur ? `<p class="erreur" role="alert">${esc(r.erreur)}</p>` : ''}
    ${!choix ? `<form data-form="code" style="display:flex;flex-direction:column;gap:.9rem">
        <label class="champ">Code famille<input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" required autocomplete="one-time-code" style="font-size:1.6rem;letter-spacing:.5em;text-align:center" value="${esc(r.code)}"></label>
        <button class="bouton plein" ${r.occupe ? 'disabled' : ''}>Continuer</button></form>`
      : `<div class="choix-prenom" role="radiogroup" aria-label="Qui es-tu ?">${choix.map((p) => `<button role="radio" aria-checked="${r.choisi === p.prenom}" ${p.libre ? '' : 'disabled'} data-a="choisirPrenom" data-v="${esc(p.prenom)}">
          <span class="avatar petit" style="background:${esc(p.couleur)}">${esc(initiales(p.prenom))}</span><span>${esc(p.prenom)}</span>${p.libre ? '' : '<small style="font-size:.72rem;color:var(--pale)">déjà inscrit</small>'}</button>`).join('')}</div>
        <button class="bouton plein" data-a="rejoindre" ${!r.choisi || r.occupe ? 'disabled' : ''}>${r.occupe ? 'Patiente…' : 'C\'est moi'}</button>`}
    <button class="lien" data-a="deconnexion" style="align-self:center">Se déconnecter</button></div>`;
}

function ecranNouveauMdp() {
  return `<div class="accueil"><div class="logo">${i('maison', 32)}</div><h1>Nouveau mot de passe</h1>
    <form data-form="nouveauMdp" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">Nouveau mot de passe<input type="password" name="mdp" minlength="8" required autocomplete="new-password"></label>
      <button class="bouton plein">Enregistrer</button></form></div>`;
}

// ---------------- Rendu ----------------
function rendre() {
  const actif = document.activeElement;
  const garder = actif && actif.id && contenu.contains(actif) ? { id: actif.id, v: actif.value, s: actif.selectionStart } : null;
  let html;
  if (ui.recup) html = ecranNouveauMdp();
  else if (!ui.session) html = ecranConnexion();
  else if (!state.moi) {
    html = ui.pret ? ecranRejoindre() : `<div class="accueil"><div class="logo">${i('maison', 32)}</div><p class="c">${ui.chargeErreur ? esc(ui.chargeErreur) : 'Chargement…'}</p></div>`;
  } else if (state.moi.type === 'appareil') {
    html = `<div class="accueil"><div class="logo">${i('ecran', 32)}</div><h1>Compte de la tablette</h1>
      <p class="c">Ce compte sert à l'écran de la maison.</p><a class="bouton plein" href="tablette.html">Ouvrir l'écran tablette</a>
      <button class="lien" data-a="deconnexion" style="align-self:center">Se déconnecter</button></div>`;
  } else {
    const ecrans = { agenda: ecranAgenda, courses: ecranCourses, notes: ecranNotes, anniv: ecranAnniv, plus: ecranPlus, reglages: ecranReglages };
    html = `${bandeau()}<main class="ecran">${(ecrans[ui.route] || ecranAgenda)()}</main>${onglets()}`;
  }
  contenu.innerHTML = html;
  if (garder) {
    const el = document.getElementById(garder.id);
    if (el) { el.value = garder.v; el.focus(); try { el.setSelectionRange(garder.s, garder.s); } catch (e) { /* ignore */ } }
  }
  planifierRappels();
}

// ---------------- Fenêtres (formulaires) ----------------
function ouvrirFenetre(titre, corps, quandPret) {
  zoneFenetre.innerHTML = `<div class="voile" data-a="fermerVoile"><div class="fenetre" role="dialog" aria-modal="true" aria-labelledby="titre-fenetre">
    <div class="haut"><h2 id="titre-fenetre">${esc(titre)}</h2><button class="icone-btn" data-a="fermer" aria-label="Fermer">${i('fermer')}</button></div>
    ${corps}</div></div>`;
  const premier = zoneFenetre.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea');
  if (premier) setTimeout(() => premier.focus(), 50);
  if (quandPret) quandPret(zoneFenetre);
}
const fermerFenetre = () => { zoneFenetre.innerHTML = ''; };

function choixPersonnes(selection, nom = 'qui') {
  return `<div class="puces" role="group" aria-label="Qui ?" style="flex-wrap:wrap">${personnes().map((p) => `
    <label class="puce" style="cursor:pointer"><input type="checkbox" name="${nom}" value="${p.id}" data-c="quiPersonne" ${selection.includes(p.id) ? 'checked' : ''} style="accent-color:${p.couleur};width:1.1rem;height:1.1rem">
    <span class="pastille" style="background:${p.couleur}"></span>${esc(p.prenom)}</label>`).join('')}
    <label class="puce" style="cursor:pointer;border-color:var(--accent)"><input type="checkbox" name="tous" data-c="quiTous" ${personnes().length && personnes().every((p) => selection.includes(p.id)) ? 'checked' : ''} style="accent-color:var(--accent);width:1.1rem;height:1.1rem">
    <span class="pastille" style="background:var(--accent)"></span>Tous</label></div>`;
}

function formulaireRdv(ev, prefill = {}) {
  const neuf = !ev;
  const d = ev ? new Date(ev.debut) : prefill.debut || (() => { const x = new Date(ui.jour); const n = new Date(); x.setHours(Math.min(n.getHours() + 1, 20), 0, 0, 0); return x; })();
  const f = ev && ev.fin ? new Date(ev.fin) : new Date(d.getTime() + 3600000);
  const qui = ev ? liensDe(ev.id) : (prefill.qui || (state.moi ? [state.moi.id] : []));
  const rep = ev ? ev.repetition : 'aucune';
  const jours = ev && ev.jours_semaine && ev.jours_semaine.length ? ev.jours_semaine : [jourIso(d)];
  const journee = ev ? ev.journee_entiere : !!prefill.journee;
  const rappel = ev && ev.rappel_minutes != null ? String(ev.rappel_minutes) : '';
  ouvrirFenetre(neuf ? 'Nouveau rendez-vous' : 'Modifier le rendez-vous', `
    <form data-form="rdv" data-id="${ev ? ev.id : ''}" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">Titre<input name="titre" required maxlength="120" value="${esc(ev ? ev.titre : prefill.titre || '')}" placeholder="Dentiste, foot, repas…"></label>
      <label class="champ">Date<input type="date" name="date" required value="${isoDate(d)}"></label>
      <label class="case"><input type="checkbox" name="journee" ${journee ? 'checked' : ''} data-c="basculeJournee">Toute la journée</label>
      <div class="ligne heures ${journee ? 'cache' : ''}"><label class="champ">Début<input type="time" name="hdebut" value="${hhmm(d)}"></label><label class="champ">Fin<input type="time" name="hfin" value="${hhmm(f)}"></label></div>
      <div class="champ">Qui ?<span class="aide">« Tous » = toute la famille</span>${choixPersonnes(qui)}</div>
      <label class="champ">Lieu<input name="lieu" maxlength="120" value="${esc(ev && ev.lieu || '')}" placeholder="Facultatif"></label>
      <label class="champ">Répétition<select name="repetition" data-c="basculeRepetition">
        ${[['aucune', 'Aucune'], ['jour', 'Tous les jours'], ['semaine', 'Chaque semaine'], ['mois', 'Tous les mois'], ['annee', 'Tous les ans']].map(([v, l]) => `<option value="${v}" ${rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="champ jours-rep ${rep === 'semaine' ? '' : 'cache'}">Les jours<div class="puces" style="flex-wrap:wrap">${JOURS_COURTS.map((j, k) =>
        `<label class="puce" style="cursor:pointer"><input type="checkbox" name="jours" value="${k + 1}" ${jours.includes(k + 1) ? 'checked' : ''} style="accent-color:var(--accent)">${j}</label>`).join('')}</div></div>
      <label class="champ fin-rep ${rep === 'aucune' ? 'cache' : ''}">Jusqu'au (facultatif)<input type="date" name="repfin" value="${esc(ev && ev.repetition_fin || '')}"></label>
      <label class="champ">Rappel<select name="rappel">${[['', 'Aucun'], ['10', '10 minutes avant'], ['30', '30 minutes avant'], ['60', '1 heure avant'], ['1440', 'La veille']].map(([v, l]) => `<option value="${v}" ${rappel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="champ">Note<textarea name="note" maxlength="1000" placeholder="Facultatif">${esc(ev && ev.note || '')}</textarea></label>
      <div class="actions"><button class="bouton" type="submit">Enregistrer</button>${neuf ? '<button class="bouton second" type="button" data-a="fermer">Annuler</button>' : `<button class="bouton danger" type="button" data-a="supprRdv" data-id="${ev.id}">Supprimer</button>`}</div>
    </form>`);
}

async function enregistrerRdv(form) {
  const fd = new FormData(form);
  const titre = (fd.get('titre') || '').trim();
  if (!titre) return toast('Donne un titre au rendez-vous.');
  const journee = !!fd.get('journee');
  const [y, mo, j] = fd.get('date').split('-').map(Number);
  const debut = new Date(y, mo - 1, j);
  let fin;
  if (journee) { fin = ajouterJours(debut, 1); }
  else {
    const [h1, m1] = (fd.get('hdebut') || '09:00').split(':').map(Number);
    const [h2, m2] = (fd.get('hfin') || '').split(':').map(Number);
    debut.setHours(h1, m1, 0, 0);
    fin = new Date(debut); if (!isNaN(h2)) fin.setHours(h2, m2, 0, 0);
    if (fin <= debut) fin = new Date(debut.getTime() + 3600000);
  }
  const rep = fd.get('repetition');
  const jours = fd.getAll('jours').map(Number);
  const id = form.dataset.id || nouvelId();
  const ligne = {
    id, titre, debut: debut.toISOString(), fin: fin.toISOString(), journee_entiere: journee,
    lieu: (fd.get('lieu') || '').trim() || null, note: (fd.get('note') || '').trim() || null,
    repetition: rep, jours_semaine: rep === 'semaine' ? (jours.length ? jours : [jourIso(debut)]) : null,
    repetition_fin: rep !== 'aucune' && fd.get('repfin') ? fd.get('repfin') : null,
    rappel_minutes: fd.get('rappel') ? Number(fd.get('rappel')) : null
  };
  const qui = fd.getAll('qui');
  const avant = form.dataset.id ? liensDe(id) : [];
  const ops = [];
  if (form.dataset.id) ops.push({ cle: 'evenements', op: 'update', ligne });
  else ops.push({ cle: 'evenements', op: 'insert', ligne: { ...ligne, cree_par: state.moi && state.moi.id, created_at: new Date().toISOString() } });
  avant.filter((x) => !qui.includes(x)).forEach((m) => ops.push({ cle: 'liens', op: 'delete', ligne: { evenement_id: id, membre_id: m } }));
  qui.filter((x) => !avant.includes(x)).forEach((m) => ops.push({ cle: 'liens', op: 'insert', ligne: { evenement_id: id, membre_id: m } }));
  fermerFenetre();
  ui.jour = debutJour(debut);
  try { const r = await ecrire(ops); toast(r.hors_ligne ? 'Enregistré sur le téléphone, envoi dès que possible.' : 'Rendez-vous enregistré.'); }
  catch (e) { erreur(e); }
}

function formulaireNote(n, texte = '') {
  ouvrirFenetre(n ? 'Modifier la note' : 'Nouvelle note', `
    <form data-form="note" data-id="${n ? n.id : ''}" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">Note<textarea name="texte" required maxlength="2000" rows="4">${esc(n ? n.texte : texte)}</textarea></label>
      <label class="champ">Pour<select name="pour"><option value="">Tous</option>${personnes().map((p) => `<option value="${p.id}" ${n && n.pour === p.id ? 'selected' : ''}>${esc(p.prenom)}</option>`).join('')}</select></label>
      <label class="case"><input type="checkbox" name="epingle" ${n && n.epingle ? 'checked' : ''}>Épingler en haut</label>
      <div class="actions"><button class="bouton" type="submit">Enregistrer</button><button class="bouton second" type="button" data-a="fermer">Annuler</button></div>
    </form>`);
}

function formulaireRappel(r, type) {
  type = r ? r.type : type;
  const tache = type === 'tache';
  ouvrirFenetre(r ? (tache ? 'Modifier la tâche' : 'Modifier le rappel') : (tache ? 'Nouvelle tâche' : 'Nouveau rappel'), `
    <form data-form="rappel" data-id="${r ? r.id : ''}" data-type="${type}" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">${tache ? 'Tâche' : 'Rappel'}<input name="titre" required maxlength="200" value="${esc(r ? r.titre : '')}" placeholder="${tache ? 'Poubelle jaune, arroser…' : 'Contrôle technique, facture…'}"></label>
      ${tache ? `<div class="ligne"><label class="champ">Jour<select name="jour">${JOURS.map((j, k) => `<option value="${k + 1}" ${r && r.jour_semaine === k + 1 ? 'selected' : ''}>${majuscule(j)}</option>`).join('')}</select></label>
        <label class="champ">Moment<select name="moment">${['soir', 'matin', 'midi', ''].map((v) => `<option value="${v}" ${r && (r.moment || '') === v ? 'selected' : ''}>${v ? majuscule(v) : '—'}</option>`).join('')}</select></label></div>
        <div class="champ">Couleur<div class="nuancier">${['#D8B84A', '#3B6FD8', '#1F8A4C', '#8A8A8A', '#C8446F', '#D9774A'].map((c, k) => `<label style="cursor:pointer"><input type="radio" name="couleur" value="${c}" class="sr" ${(r ? r.couleur === c : k === 0) ? 'checked' : ''}><span style="display:block;width:2.6rem;height:2.6rem;border-radius:50%;background:${c}"></span></label>`).join('')}</div></div>`
      : `<label class="champ">Avant le<input type="date" name="echeance" value="${esc(r && r.echeance || '')}"></label>
        <label class="champ">Pour<select name="pour"><option value="">Tous</option>${personnes().map((p) => `<option value="${p.id}" ${r && r.pour === p.id ? 'selected' : ''}>${esc(p.prenom)}</option>`).join('')}</select></label>`}
      <div class="actions"><button class="bouton" type="submit">Enregistrer</button>${r ? `<button class="bouton danger" type="button" data-a="supprRappel" data-id="${r.id}">Supprimer</button>` : '<button class="bouton second" type="button" data-a="fermer">Annuler</button>'}</div>
    </form>`, (z) => {
      z.querySelectorAll('input[name=couleur]').forEach((inp) => {
        const maj = () => z.querySelectorAll('input[name=couleur]').forEach((x) => { x.nextElementSibling.style.boxShadow = x.checked ? '0 0 0 3px var(--fond), 0 0 0 5px ' + x.value : 'none'; });
        inp.addEventListener('change', maj); maj();
      });
    });
}

function confirmer(titre, texte, libelle, action) {
  ouvrirFenetre(titre, `<p style="margin:0;font-size:1rem">${esc(texte)}</p>
    <div class="actions"><button class="bouton" style="background:var(--danger);color:#fff" data-a="confirmerOui">${esc(libelle)}</button><button class="bouton second" data-a="fermer">Annuler</button></div>`);
  ui.confirmation = action;
}

// ---------------- Photos de veille ----------------
async function chargerPhotos() {
  const { data, error } = await sb.storage.from('photos').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) return;
  ui.photos = (data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ nom: f.name, url: null }));
  rendre();
  for (const p of ui.photos) { p.url = await urlImage('photos', p.nom); }
  rendre();
}

// ---------------- Voix ----------------
async function dicter(contexte) {
  if (ui.ecoute) return;
  ui.ecoute = true; rendre();
  toast('Je t\'écoute…');
  let texte;
  try { texte = await ecouter(); } catch (e) { ui.ecoute = false; rendre(); return toast(e.message); }
  ui.ecoute = false; rendre();
  let c = comprendre(texte, personnes().map((p) => p.prenom));
  if (contexte === 'course' && c.type !== 'course') c = { type: 'course', noms: [majuscule(texte.trim())] };
  if (contexte === 'note' && c.type !== 'note') c = { type: 'note', texte: majuscule(texte.trim()) };
  if (c.type === 'course') {
    const lignes = c.noms.map((nom) => ({ id: nouvelId(), nom: nom.slice(0, 120), source: 'voix', ajoute_par: state.moi.id, pris: false, created_at: new Date().toISOString() }));
    try { await ecrire(lignes.map((l) => ({ cle: 'courses', op: 'insert', ligne: l }))); } catch (e) { return erreur(e); }
    toast(`Ajouté : ${c.noms.join(', ')}`, () => ecrire(lignes.map((l) => ({ cle: 'courses', op: 'delete', ligne: { id: l.id } }))));
  } else if (c.type === 'note') {
    const l = { id: nouvelId(), texte: c.texte.slice(0, 2000), auteur: state.moi.id, created_at: new Date().toISOString() };
    try { await ecrire({ cle: 'notes', op: 'insert', ligne: l }); } catch (e) { return erreur(e); }
    toast('Note ajoutée.', () => ecrire({ cle: 'notes', op: 'delete', ligne: { id: l.id } }));
  } else if (c.type === 'rdv') {
    const qui = c.qui.map((p) => personnes().find((x) => x.prenom === p)).filter(Boolean).map((p) => p.id);
    formulaireRdv(null, { titre: c.titre, debut: c.debut, journee: c.journee, qui: qui.length ? qui : undefined });
  } else {
    toast(`Je n'ai pas compris : « ${texte} »`);
  }
}

// ---------------- Rappels (notifications quand l'appli est ouverte) ----------------
const planifies = new Map();
let minuteurPlan = null;
function planifierRappels() {
  clearTimeout(minuteurPlan);
  minuteurPlan = setTimeout(() => {
    const p = lirePrefs();
    if (!('Notification' in window) || Notification.permission !== 'granted' || p.notifs === false || !state.moi) return;
    const maintenant = new Date(); const fin = new Date(maintenant.getTime() + 26 * 3600000);
    state.evenements.filter((ev) => ev.rappel_minutes != null).forEach((ev) => {
      const ids = liensDe(ev.id);
      if (ids.length && !ids.includes(state.moi.id)) return;
      occurrences(ev, maintenant, fin).forEach((o) => {
        const quand = o.debut.getTime() - ev.rappel_minutes * 60000;
        const cle = ev.id + o.debut.getTime();
        if (quand < Date.now() || planifies.has(cle) || quand - Date.now() > 2147000000) return;
        planifies.set(cle, setTimeout(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          const corps = `${o.ev.journee_entiere ? 'Toute la journée' : hhmm(o.debut)}${o.ev.lieu ? ' · ' + o.ev.lieu : ''}`;
          if (reg) reg.showNotification(o.ev.titre, { body: corps, icon: 'icons/icone-192.png', tag: cle });
          else new Notification(o.ev.titre, { body: corps });
        }, quand - Date.now()));
      });
    });
  }, 500);
}

// ---------------- Actions ----------------
const actions = {
  annulerToast() { if (ui.annulerToast) ui.annulerToast(); zoneToast.innerHTML = ''; ui.annulerToast = null; },
  fermer: fermerFenetre,
  fermerVoile(d, el, e) { if (e.target === el) fermerFenetre(); },
  async confirmerOui() { const a = ui.confirmation; ui.confirmation = null; fermerFenetre(); if (a) { try { await a(); } catch (e) { erreur(e); } } },
  modeAuth(d) { ui.auth = { mode: d.v, erreur: null, info: null }; rendre(); },
  semaine(d) { ui.jour = ajouterJours(ui.jour, Number(d.v)); rendre(); },
  choisirJour(d) { const [y, m, j] = d.v.split('-').map(Number); ui.jour = new Date(y, m - 1, j); rendre(); },
  filtre(d) { ui.filtre = d.v; rendre(); },
  filtreNotes(d) { ui.filtreNotes = d.v; rendre(); },
  nouveauRdv() { formulaireRdv(null); },
  ouvrirRdv(d) { const ev = state.evenements.find((x) => x.id === d.id); if (ev) formulaireRdv(ev); },
  supprRdv(d) {
    const ev = state.evenements.find((x) => x.id === d.id);
    confirmer('Supprimer ce rendez-vous ?', ev && ev.repetition !== 'aucune' ? 'Toutes les répétitions seront supprimées.' : 'Il disparaîtra pour toute la famille.', 'Supprimer',
      async () => { await ecrire({ cle: 'evenements', op: 'delete', ligne: { id: d.id } }); state.liens = state.liens.filter((l) => l.evenement_id !== d.id); toast('Rendez-vous supprimé.'); });
  },
  dicter(d) { dicter(d.v); },
  supprCourse(d) {
    const c = state.courses.find((x) => x.id === d.id); if (!c) return;
    ecrire({ cle: 'courses', op: 'delete', ligne: { id: c.id } }).catch(erreur);
    toast(`« ${c.nom} » supprimé.`, () => ecrire({ cle: 'courses', op: 'insert', ligne: c }));
  },
  viderPris() {
    const pris = state.courses.filter((c) => c.pris);
    confirmer('Vider les articles pris ?', `${pris.length} article(s) seront retirés de la liste.`, 'Vider',
      async () => { await ecrire(pris.map((c) => ({ cle: 'courses', op: 'delete', ligne: { id: c.id } }))); });
  },
  nouvelleNote() { formulaireNote(null); },
  ouvrirNote(d) { const n = state.notes.find((x) => x.id === d.id); if (n) formulaireNote(n); },
  epingler(d) { const n = state.notes.find((x) => x.id === d.id); if (n) ecrire({ cle: 'notes', op: 'update', ligne: { id: n.id, epingle: !n.epingle } }).catch(erreur); },
  supprNote(d) { confirmer('Supprimer cette note ?', 'Elle disparaîtra pour toute la famille.', 'Supprimer', () => ecrire({ cle: 'notes', op: 'delete', ligne: { id: d.id } })); },
  nouveauRappel(d) { formulaireRappel(null, d.v); },
  ouvrirRappel(d) { const r = state.rappels.find((x) => x.id === d.id); if (r) formulaireRappel(r); },
  supprRappel(d) { confirmer('Supprimer ?', 'Cet élément sera supprimé pour toute la famille.', 'Supprimer', () => ecrire({ cle: 'rappels', op: 'delete', ligne: { id: d.id } })); },
  basculeCode() { ui.codeVisible = !ui.codeVisible; rendre(); },
  nouveauCode() {
    if (!ui.codeVisible) return toast('Affiche d\'abord le code.');
    confirmer('Changer le code famille ?', 'L\'ancien code ne marchera plus. Les comptes déjà inscrits ne sont pas touchés.', 'Changer', async () => {
      const { data, error } = await sb.rpc('nouveau_code_famille'); if (error) throw error;
      state.config = { ...state.config, code: data }; rendre(); toast('Nouveau code : ' + data);
    });
  },
  supprPhoto(d) {
    confirmer('Supprimer cette photo ?', 'Elle ne s\'affichera plus sur la tablette.', 'Supprimer', async () => {
      const { error } = await sb.storage.from('photos').remove([d.v]); if (error) throw error;
      ui.photos = ui.photos.filter((p) => p.nom !== d.v); rendre();
    });
  },
  icone(d) { ecrire({ cle: 'membres', op: 'update', ligne: { id: state.moi.id, icone: d.v, avatar_path: null } }).catch(erreur); },
  retirerAvatar() { ecrire({ cle: 'membres', op: 'update', ligne: { id: state.moi.id, icone: null, avatar_path: null } }).catch(erreur); },
  maCouleur(d) { ecrire({ cle: 'membres', op: 'update', ligne: { id: state.moi.id, couleur: d.v } }).catch(erreur); },
  theme(d) { majPrefs({ theme: d.v }); },
  accent(d) { majPrefs({ accent: d.v }); },
  changerEmail() {
    ouvrirFenetre('Changer d\'e-mail', `<form data-form="email" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">Nouvelle adresse<input type="email" name="email" required autocomplete="email"></label>
      <p class="aide" style="margin:0">Un lien de confirmation sera envoyé à la nouvelle adresse.</p>
      <div class="actions"><button class="bouton">Enregistrer</button><button class="bouton second" type="button" data-a="fermer">Annuler</button></div></form>`);
  },
  changerMdp() {
    ouvrirFenetre('Changer de mot de passe', `<form data-form="nouveauMdp" style="display:flex;flex-direction:column;gap:.9rem">
      <label class="champ">Nouveau mot de passe<input type="password" name="mdp" minlength="8" required autocomplete="new-password"></label>
      <div class="actions"><button class="bouton">Enregistrer</button><button class="bouton second" type="button" data-a="fermer">Annuler</button></div></form>`);
  },
  deconnexion() { confirmer('Se déconnecter ?', 'Tu pourras te reconnecter avec ton e-mail et ton mot de passe.', 'Se déconnecter', deconnecter); },
  supprimerCompte() {
    confirmer('Supprimer ton compte ?', 'Ton compte sera supprimé. Tes notes et rendez-vous restent pour la famille. Cette action est définitive.', 'Supprimer définitivement', async () => {
      const { error } = await sb.rpc('supprimer_mon_compte'); if (error) throw error;
      await deconnecter(); toast('Compte supprimé.');
    });
  },
  async choisirPrenom(d) { ui.rejoindre.choisi = d.v; rendre(); },
  async rejoindre() {
    const r = ui.rejoindre; r.occupe = true; r.erreur = null; rendre();
    const { error } = await sb.rpc('rejoindre_famille', { p_code: r.code, p_prenom: r.choisi });
    r.occupe = false;
    if (error) { r.erreur = messageErreur(error); return rendre(); }
    await demarrerDonnees();
    toast(`Bienvenue ${r.choisi} !`);
  }
};

const changements = {
  async prendre(el) {
    const c = state.courses.find((x) => x.id === el.dataset.id); if (!c) return;
    ecrire({ cle: 'courses', op: 'update', ligne: { id: c.id, pris: el.checked, pris_le: el.checked ? new Date().toISOString() : null } }).catch(erreur);
  },
  tacheFaite(el) {
    ecrire({ cle: 'rappels', op: 'update', ligne: { id: el.dataset.id, fait_le: el.dataset.v } }).catch(erreur);
    toast('Bien joué ! C\'est noté pour cette semaine.');
  },
  rappelFait(el) { ecrire({ cle: 'rappels', op: 'update', ligne: { id: el.dataset.id, fait_le: el.checked ? isoDate(new Date()) : null } }).catch(erreur); },
  zoom(el) { majPrefs({ zoom: Number(el.value) }); },
  quiTous(el) { el.form.querySelectorAll('input[name=qui]').forEach((x) => { x.checked = el.checked; }); },
  quiPersonne(el) { const c = [...el.form.querySelectorAll('input[name=qui]')]; const t = el.form.querySelector('input[name=tous]'); if (t) t.checked = c.length > 0 && c.every((x) => x.checked); },
  basculeJournee(el) { el.form.querySelector('.heures').classList.toggle('cache', el.checked); },
  basculeRepetition(el) {
    el.form.querySelector('.jours-rep').classList.toggle('cache', el.value !== 'semaine');
    el.form.querySelector('.fin-rep').classList.toggle('cache', el.value === 'aucune');
  },
  async notifs(el) {
    if (el.checked) {
      if (!('Notification' in window)) { el.checked = false; return toast('Les notifications ne sont pas disponibles ici.'); }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { el.checked = false; return toast('Autorise les notifications dans les réglages du téléphone.'); }
      majPrefs({ notifs: true });
      toast('Tu recevras les rappels quand l\'appli est ouverte ou en arrière-plan.');
    } else majPrefs({ notifs: false });
  },
  async photoProfil(el) {
    const f = el.files && el.files[0]; if (!f) return;
    toast('Envoi de la photo…');
    try {
      const blob = await reduireImage(f, 512);
      const chemin = `${state.moi.id}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('avatars').upload(chemin, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const ancien = state.moi.avatar_path;
      await ecrire({ cle: 'membres', op: 'update', ligne: { id: state.moi.id, avatar_path: chemin, icone: null } });
      if (ancien) sb.storage.from('avatars').remove([ancien]);
      toast('Photo enregistrée.');
    } catch (e) { erreur(e); }
  },
  async ajoutPhotos(el) {
    const fichiers = Array.from(el.files || []); if (!fichiers.length) return;
    toast(`Envoi de ${fichiers.length} photo(s)…`);
    let ok = 0;
    for (const f of fichiers) {
      try {
        const blob = await reduireImage(f, 1920);
        const { error } = await sb.storage.from('photos').upload(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`, blob, { contentType: 'image/jpeg' });
        if (!error) ok++;
      } catch (e) { /* on continue */ }
    }
    toast(`${ok} photo(s) ajoutée(s).`);
    ui.photos = null; rendre();
  }
};

const formulaires = {
  async auth(form) {
    const fd = new FormData(form); const a = ui.auth;
    const email = (fd.get('email') || '').trim(); const mdp = fd.get('mdp') || '';
    if (!email) { a.erreur = 'Indique ton adresse e-mail.'; return rendre(); }
    if (a.mode !== 'oubli' && mdp.length < 8) { a.erreur = 'Le mot de passe doit faire au moins 8 caractères.'; return rendre(); }
    a.occupe = true; a.erreur = null; a.info = null; rendre();
    let r;
    if (a.mode === 'connexion') r = await sb.auth.signInWithPassword({ email, password: mdp });
    else if (a.mode === 'inscription') r = await sb.auth.signUp({ email, password: mdp, options: { emailRedirectTo: location.origin + location.pathname, data: { app: 'famille' } } });
    else r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    a.occupe = false;
    if (r.error) { a.erreur = messageErreur(r.error); return rendre(); }
    if (a.mode === 'inscription' && !r.data.session) { ui.auth = { mode: 'connexion', info: 'Compte créé ! Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.' }; }
    if (a.mode === 'oubli') { ui.auth = { mode: 'connexion', info: 'Si un compte existe, un e-mail vient de partir. Ouvre le lien pour choisir un nouveau mot de passe.' }; }
    rendre();
  },
  async code(form) {
    const r = ui.rejoindre; r.code = (new FormData(form).get('code') || '').trim();
    if (!/^\d{6}$/.test(r.code)) { r.erreur = 'Le code fait 6 chiffres.'; return rendre(); }
    r.occupe = true; r.erreur = null; rendre();
    const { data, error } = await sb.rpc('prenoms_libres', { p_code: r.code });
    r.occupe = false;
    if (error) { r.erreur = messageErreur(error); return rendre(); }
    r.prenoms = data; rendre();
  },
  async nouveauMdp(form) {
    const mdp = new FormData(form).get('mdp') || '';
    if (mdp.length < 8) return toast('8 caractères minimum.');
    const { error } = await sb.auth.updateUser({ password: mdp });
    if (error) return erreur(error);
    ui.recup = false; fermerFenetre(); history.replaceState(null, '', location.pathname + '#/agenda'); rendre(); toast('Mot de passe enregistré.');
  },
  async email(form) {
    const email = (new FormData(form).get('email') || '').trim();
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname });
    if (error) return erreur(error);
    fermerFenetre(); toast('Ouvre le lien reçu sur la nouvelle adresse pour confirmer.');
  },
  async ajoutCourse(form) {
    const input = form.querySelector('input[name=nom]');
    const noms = (input.value || '').split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
    if (!noms.length) return;
    input.value = '';
    const lignes = noms.map((nom) => ({ id: nouvelId(), nom: majuscule(nom).slice(0, 120), source: 'app', ajoute_par: state.moi.id, pris: false, created_at: new Date().toISOString() }));
    ecrire(lignes.map((l) => ({ cle: 'courses', op: 'insert', ligne: l }))).catch(erreur);
    setTimeout(() => { const el = $('#nouvelArticle'); if (el) el.focus(); }, 30);
  },
  rdv: enregistrerRdv,
  async note(form) {
    const fd = new FormData(form); const texte = (fd.get('texte') || '').trim();
    if (!texte) return toast('La note est vide.');
    const ligne = { texte, pour: fd.get('pour') || null, epingle: !!fd.get('epingle') };
    fermerFenetre();
    try {
      if (form.dataset.id) await ecrire({ cle: 'notes', op: 'update', ligne: { id: form.dataset.id, ...ligne } });
      else await ecrire({ cle: 'notes', op: 'insert', ligne: { id: nouvelId(), auteur: state.moi.id, created_at: new Date().toISOString(), ...ligne } });
    } catch (e) { erreur(e); }
  },
  async rappel(form) {
    const fd = new FormData(form); const titre = (fd.get('titre') || '').trim();
    if (!titre) return toast('Donne un titre.');
    const type = form.dataset.type;
    const ligne = type === 'tache'
      ? { titre, type, jour_semaine: Number(fd.get('jour')), moment: fd.get('moment') || null, couleur: fd.get('couleur') || null }
      : { titre, type, echeance: fd.get('echeance') || null, pour: fd.get('pour') || null };
    fermerFenetre();
    try {
      if (form.dataset.id) await ecrire({ cle: 'rappels', op: 'update', ligne: { id: form.dataset.id, ...ligne } });
      else await ecrire({ cle: 'rappels', op: 'insert', ligne: { id: nouvelId(), cree_par: state.moi.id, created_at: new Date().toISOString(), ...ligne } });
    } catch (e) { erreur(e); }
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const f = actions[el.dataset.a];
  if (!f) return;
  if (el.dataset.a === 'fermerVoile' && e.target !== el) return;
  e.preventDefault();
  Promise.resolve(f(el.dataset, el, e)).catch(erreur);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-c]');
  if (el && changements[el.dataset.c]) Promise.resolve(changements[el.dataset.c](el)).catch(erreur);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f || !formulaires[f.dataset.form]) return;
  e.preventDefault();
  Promise.resolve(formulaires[f.dataset.form](f)).catch(erreur);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && zoneFenetre.innerHTML) fermerFenetre(); });

// ---------------- Navigation ----------------
function lireRoute() {
  const r = (location.hash.replace(/^#\/?/, '') || 'agenda').split('?')[0];
  ui.route = ['agenda', 'courses', 'notes', 'anniv', 'plus', 'reglages'].includes(r) ? r : 'agenda';
  if (ui.route === 'plus') ui.photos = null;
  ui.codeVisible = false;
  if (ui.route === 'anniv') chargerAnniv();
  window.scrollTo(0, 0);
  rendre();
}
window.addEventListener('hashchange', lireRoute);

// ---------------- Démarrage ----------------
async function demarrerDonnees() {
  try {
    await toutCharger(ui.session.user.id);
    ui.pret = true; ui.chargeErreur = null;
    if (state.moi && state.moi.prefs && Object.keys(state.moi.prefs).length) {
      try { localStorage.setItem(PREFS, JSON.stringify(state.moi.prefs)); } catch (e) { /* ignore */ }
      appliquerPrefs(state.moi.prefs);
    }
    temps_reel();
  } catch (e) {
    ui.pret = state.membres.length > 0;
    ui.chargeErreur = messageErreur(e);
  }
  rendre();
}

async function deconnecter() {
  arreterTempsReel();
  await sb.auth.signOut();
  viderCache();
  ui.session = null; ui.pret = false; ui.rejoindre = { code: '', prenoms: null, choisi: null }; ui.photos = null;
  rendre();
}

async function demarrer() {
  chargerCache();
  const { data } = await sb.auth.getSession();
  ui.session = data.session;
  if (ui.session) { state.userId = ui.session.user.id; chargerCache(); ui.pret = state.membres.length > 0; }
  surChangement(() => rendre());
  sb.auth.onAuthStateChange((evt, session) => {
    if (evt === 'PASSWORD_RECOVERY') { ui.recup = true; }
    const avant = ui.session && ui.session.user.id;
    ui.session = session;
    if (session && session.user.id !== avant) { state.userId = session.user.id; demarrerDonnees(); }
    if (!session) rendre();
    else if (evt === 'PASSWORD_RECOVERY') rendre();
  });
  lireRoute();
  if (ui.session) demarrerDonnees();
  setInterval(() => { if (ui.route === 'agenda' && !zoneFenetre.innerHTML) rendre(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.session) demarrerDonnees(); });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
demarrer();
