// Écran de repos de la tablette : un effet animé par-dessus l'agenda après 10 min sans activité.
// 1 Bulles zigzag avec traînée · 2 Liquide néon · 3 HUD qui se déplace · 4 Hexagones qui tombent · spécial Confettis (anniversaire)
export const EFFETS = [
  { id: 1, nom: 'Bulles zigzag avec traînée' },
  { id: 2, nom: 'Liquide néon' },
  { id: 3, nom: 'HUD « Jarvis » qui se déplace' },
  { id: 4, nom: 'Hexagones qui tombent' },
  { id: 5, nom: 'Coup de vent' },
  { id: 6, nom: 'Gravité' },
  { id: 7, nom: 'Ondulation' },
  { id: 8, nom: 'Vague de cartes' },
  { id: 9, nom: 'Trou noir' },
  { id: 10, nom: 'Construction de l\'appli' }
];
const W = 1280; const H = 800;
const FAMILLE = ['#1F8A4C', '#3B6FD8', '#C8446F', '#6D5BD0'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Effet du jour : tiré au hasard, mais le même toute la journée et jamais deux jours de suite le même
export function effetDuJour(d = new Date()) {
  const jour = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  const tirage = (j) => { let x = (j * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x % EFFETS.length; };
  let n = tirage(jour);
  if (n === tirage(jour - 1)) n = (n + 1 + (jour % (EFFETS.length - 1))) % EFFETS.length;
  return n + 1;
}

let enCours = null; // { stop() }
export const effetActif = () => !!enCours;
export function arreterEffet() { if (enCours) { try { enCours.stop(); } catch (e) { /* ignore */ } enCours = null; } }

// conteneur : élément de 1280×800 ; n : numéro d'effet ou 'confettis' ; infos() : textes pour le HUD ; noms : prénoms fêtés
export function demarrerEffet(conteneur, n, { infos = () => ({}), noms = [], page = null } = {}) {
  arreterEffet();
  conteneur.innerHTML = '<div class="eff-voile"></div><div class="eff-zone"></div><div class="eff-toucher">Touchez l\'écran pour revenir</div>';
  const zone = conteneur.querySelector('.eff-zone');
  const f = n === 'confettis' ? confettis : [null, bulles, liquide, hud, hexagones, vent, gravite, ondulation, cartes, trouNoir, construction][n] || bulles;
  const arret = f(zone, { infos, noms, page });
  enCours = { stop: () => { arret(); conteneur.innerHTML = ''; } };
}

// Boucle d'animation (30 images/s suffisent, et ça économise la batterie)
function boucle(dessiner) {
  let id = 0; let dernier = 0; const t0 = performance.now(); let actif = true;
  const pas = (t) => {
    if (!actif) return;
    id = requestAnimationFrame(pas);
    if (t - dernier < 32) return;
    const dt = Math.min(0.1, (t - (dernier || t)) / 1000); dernier = t;
    dessiner((t - t0) / 1000, dt);
  };
  id = requestAnimationFrame(pas);
  return () => { actif = false; cancelAnimationFrame(id); };
}
function toile(zone) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.className = 'eff-toile'; zone.appendChild(c);
  return c.getContext('2d');
}
const hasard = (a, b) => a + Math.random() * (b - a);

// ---------- 1 · Bulles zigzag avec traînée ----------
function bulles(zone) {
  const g = toile(zone);
  const B = Array.from({ length: 16 }, (_, k) => {
    const a = hasard(0, Math.PI * 2);
    return { x: hasard(80, W - 80), y: hasard(80, H - 80), vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, r: [23, 30, 37, 45][k % 4], c: FAMILLE[k % 4], cap: a, change: 0, trace: [] };
  });
  const rond = (x, y, r, c, op) => {
    const d = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
    d.addColorStop(0, `rgba(255,255,255,${0.85 * op})`); d.addColorStop(0.3, hexa(c, 0.8 * op)); d.addColorStop(1, hexa(c, 0.4 * op));
    g.fillStyle = d; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  return boucle((t, dt) => {
    g.clearRect(0, 0, W, H);
    for (const b of B) {
      // zigzag : la direction change brusquement de temps en temps
      b.change -= dt;
      if (b.change <= 0) { b.cap += hasard(-1.8, 1.8); b.change = hasard(0.8, 2.5); }
      const v = 70; b.vx += (Math.cos(b.cap) * v - b.vx) * dt * 2; b.vy += (Math.sin(b.cap) * v - b.vy) * dt * 2;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r || b.x > W - b.r) { b.cap = Math.PI - b.cap; b.x = Math.max(b.r, Math.min(W - b.r, b.x)); }
      if (b.y < b.r || b.y > H - b.r) { b.cap = -b.cap; b.y = Math.max(b.r, Math.min(H - b.r, b.y)); }
      b.trace.push([b.x, b.y]); if (b.trace.length > 24) b.trace.shift();
      b.trace.forEach(([x, y], i) => { if (i % 6 === 0 && i < b.trace.length - 1) { const k = i / b.trace.length; rond(x, y, b.r * (0.55 + 0.35 * k), b.c, 0.12 + 0.25 * k); } });
      rond(b.x, b.y, b.r, b.c, 0.55);
    }
  });
}
function hexa(c, a) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------- 2 · Liquide néon ----------
function liquide(zone) {
  const g = toile(zone);
  const T = [['#FF4FD8', 22, 0], ['#5EE7FF', 26, 1.7], ['#7CFFB2', 30, 3.1], ['#8F6BFF', 24, 4.4]];
  return boucle((t) => {
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    T.forEach(([c, p, ph], i) => {
      const x = W / 2 + Math.sin(t * 2 * Math.PI / p + ph) * 460 + Math.sin(t * 0.37 + i) * 80;
      const y = H / 2 + Math.cos(t * 2 * Math.PI / (p * 1.3) + ph * 1.7) * 260;
      const r = 300 + Math.sin(t * 0.5 + i) * 70;
      const d = g.createRadialGradient(x, y, 0, x, y, r);
      d.addColorStop(0, hexa(c, 0.5)); d.addColorStop(0.5, hexa(c, 0.22)); d.addColorStop(1, hexa(c, 0));
      g.fillStyle = d; g.fillRect(0, 0, W, H);
    });
    g.globalCompositeOperation = 'source-over';
  });
}

// ---------- 3 · HUD « Jarvis » qui se déplace ----------
function hud(zone, { infos }) {
  const anneau = (r, w, dash, d, rev, op) => `<svg class="eff-hud-an" width="${2 * r + 20}" height="${2 * r + 20}" style="left:${-r - 10}px;top:${-r - 10}px;animation:${rev ? 'effRotR' : 'effRot'} ${d}s linear infinite"><circle cx="${r + 10}" cy="${r + 10}" r="${r}" fill="none" stroke="#5EE7FF" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} opacity="${op}"/></svg>`;
  zone.innerHTML = `<div class="eff-fonce"></div><div class="eff-hud">${anneau(300, 2, '4 10', 60, false, 0.8)}${anneau(260, 10, '120 40 20 40', 40, true, 0.45)}${anneau(220, 2, '2 6', 30, false, 0.8)}${anneau(190, 4, '300 900', 12, true, 0.9)}${anneau(165, 1, '', 0, false, 0.7)}
    <div class="eff-hud-c"><div class="h"></div><div class="d"></div><div class="p"></div></div><div class="eff-hud-g"></div><div class="eff-hud-dr"></div></div>`;
  const h = zone.querySelector('.eff-hud');
  const maj = () => {
    const i = infos() || {};
    h.querySelector('.h').textContent = i.heure || ''; h.querySelector('.d').textContent = (i.date || '').toUpperCase(); h.querySelector('.p').textContent = (i.ligne || '').toUpperCase();
    h.querySelector('.eff-hud-g').innerHTML = (i.gauche || []).map((x) => `<div>${esc(x)}</div>`).join('');
    h.querySelector('.eff-hud-dr').innerHTML = (i.droite || []).map((x) => `<div>${esc(x)}</div>`).join('');
  };
  maj(); const minuterie = setInterval(maj, 5000);
  const stop = boucle((t) => {
    // trajet lent et irrégulier sur tout l'écran, la taille varie
    const x = W / 2 + Math.sin(t * 0.071) * 330 + Math.sin(t * 0.023 + 1) * 90;
    const y = H / 2 + Math.sin(t * 0.053 + 2) * 170 + Math.cos(t * 0.031) * 50;
    const s = 0.62 + Math.sin(t * 0.04) * 0.1;
    h.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
  });
  return () => { stop(); clearInterval(minuterie); };
}

// ---------- 4 · Hexagones qui tombent ----------
function hexagones(zone) {
  const g = toile(zone);
  const s = 34; const hh = s * Math.sqrt(3);
  const COLS = Math.floor(W / (1.5 * s)) + 2; const ROWS = Math.floor(H / hh) + 2;
  const couleurs = ['#1F8A4C', '#3B6FD8', '#C8446F', '#6D5BD0', '#5EE7FF', '#7CFFB2', '#FF4FD8'];
  let cases = []; let phase = 'chute'; let tPhase = 0; let flash = 0;
  const remplir = () => {
    cases = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const x = c * 1.5 * s; const y = r * hh + (c % 2 ? hh / 2 : 0);
      cases.push({ x, y, cy: -60, vy: 0, posee: false, c: couleurs[Math.floor(Math.random() * couleurs.length)], ordre: -(r + (c % 2 ? 0.5 : 0)) + hasard(-1.6, 1.6), dep: 0, ox: 0, oy: 0, vx: 0, vy2: 0, rot: 0, vr: 0, op: 1 });
    }
    cases.sort((a, b) => a.ordre - b.ordre);
    const n = cases.length; cases.forEach((k, i) => { k.dep = 0.3 + (i / n) * 28.8; });
    phase = 'chute'; tPhase = 0;
  };
  const hex = (x, y, r, c, op, rot) => {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * (r - 2), Math.sin(a) * (r - 2)); }
    g.closePath();
    const d = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r); d.addColorStop(0, `rgba(255,255,255,${0.55 * op})`); d.addColorStop(0.55, hexa(c, 0.42 * op)); d.addColorStop(1, hexa(c, 0.3 * op));
    g.fillStyle = d; g.fill(); g.restore();
  };
  remplir();
  return boucle((t, dt) => {
    tPhase += dt; g.clearRect(0, 0, W, H);
    if (phase === 'chute') {
      let toutes = true;
      for (const k of cases) {
        if (tPhase < k.dep) { toutes = false; continue; }
        if (!k.posee) {
          toutes = false; k.vy += 2200 * dt; k.cy += k.vy * dt;
          if (k.cy >= k.y) { k.cy = k.y; if (Math.abs(k.vy) > 260) k.vy = -k.vy * 0.22; else { k.vy = 0; k.posee = true; } }
        }
        hex(k.x, k.cy, s, k.c, 1, 0);
      }
      if (toutes) { phase = 'plein'; tPhase = 0; }
    } else if (phase === 'plein') {
      cases.forEach((k) => hex(k.x, k.y, s, k.c, 1, 0));
      if (tPhase >= 10) {
        phase = 'boom'; tPhase = 0; flash = 1;
        cases.forEach((k) => { const dx = k.x - W / 2; const dy = k.y - H / 2; const d = Math.hypot(dx, dy) || 1; const f = hasard(350, 750); k.vx = dx / d * f; k.vy2 = dy / d * f; k.vr = hasard(-6, 6); k.ox = k.x; k.oy = k.y; k.rot = 0; k.op = 1; });
      }
    } else if (phase === 'boom') {
      cases.forEach((k) => { k.ox += k.vx * dt; k.oy += k.vy2 * dt; k.rot += k.vr * dt; k.op = Math.max(0, 1 - tPhase / 2); hex(k.ox, k.oy, s * (1 - tPhase * 0.25), k.c, k.op, k.rot); });
      if (tPhase >= 2.2) { phase = 'pause'; tPhase = 0; }
    } else if (phase === 'pause') { if (tPhase >= 1.2) remplir(); }
    if (flash > 0) {
      const r = (1 - flash) * 900 + 60; const d = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
      d.addColorStop(0, `rgba(255,255,255,${0.9 * flash})`); d.addColorStop(0.35, `rgba(94,231,255,${0.45 * flash})`); d.addColorStop(1, 'rgba(94,231,255,0)');
      g.fillStyle = d; g.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt / 1.3);
    }
  });
}

// ---------- Spécial · Confettis (jour d'anniversaire) ----------
function confettis(zone, { noms }) {
  const g = toile(zone);
  const cart = document.createElement('div'); cart.className = 'eff-anniv';
  cart.innerHTML = `<div style="font-size:56px">🎂</div><div class="t">Joyeux anniversaire ${esc(noms.join(' et ') || '')} !</div>`;
  zone.appendChild(cart);
  const C = ['#F2C94C', '#EB5757', '#6D5BD0', '#27AE60', '#2F80ED', '#F2994A'];
  const P = Array.from({ length: 110 }, () => ({ x: hasard(0, W), y: hasard(-H, 0), v: hasard(70, 160), r: hasard(0, 6), vr: hasard(-4, 4), w: hasard(8, 12), h: hasard(13, 19), c: C[Math.floor(Math.random() * C.length)], o: hasard(0, 6) }));
  return boucle((t, dt) => {
    g.clearRect(0, 0, W, H);
    for (const p of P) {
      p.y += p.v * dt; p.x += Math.sin(t * 1.5 + p.o) * 30 * dt; p.r += p.vr * dt;
      if (p.y > H + 20) { p.y = -20; p.x = hasard(0, W); }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r))); g.restore();
    }
  });
}

// ---------- Effets qui animent l'accueil lui-même (n° 5 à 10) ----------
// L'accueil affiché est copié dans des morceaux (chaque morceau montre sa partie de la copie)
function copiePage(page) {
  const src = page && page.firstElementChild;
  const c = src ? src.cloneNode(true) : document.createElement('div');
  c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  c.querySelectorAll('[data-a],[data-c]').forEach((e) => { e.removeAttribute('data-a'); e.removeAttribute('data-c'); });
  // couleur de fond réellement affichée (elle change selon le moment de la journée)
  let fond = ''; for (let e = page; e && !fond; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) fond = b; }
  const w = document.createElement('div'); w.className = 'eff-copie'; w.style.background = fond || '#FBF7F1'; w.appendChild(c);
  return w;
}
function morceaux(zone, page, cols, rows, { parent = zone, classe = 'eff-morceau' } = {}) {
  const modele = copiePage(page); const tw = W / cols; const th = H / rows; const l = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const m = document.createElement('div'); m.className = classe;
    Object.assign(m.style, { left: `${c * tw}px`, top: `${r * th}px`, width: `${tw}px`, height: `${th}px` });
    const k = modele.cloneNode(true); k.style.left = `${-c * tw}px`; k.style.top = `${-r * th}px`; m.appendChild(k);
    parent.appendChild(m); l.push({ el: m, c, r, x: c * tw, y: r * th, w: tw, h: th });
  }
  return l;
}
function grandeHeure(zone, infos, classe = '') {
  const h = document.createElement('div'); h.className = `eff-grande ${classe}`; zone.appendChild(h);
  const maj = () => { const i = infos() || {}; h.innerHTML = `<div class="h">${esc(i.heure || '')}</div><div class="d">${esc(i.date || '')}${i.temp ? ' · ' + esc(i.temp) : ''}</div>`; };
  maj(); const t = setInterval(maj, 5000);
  return { el: h, stop: () => clearInterval(t) };
}
// L'adoucissement s'applique à chaque étape (et non à tout le cycle, ce qui décalerait les moments clés)
const anime = (el, kf, d, opts = {}) => {
  const { easing, ...reste } = opts;
  const k = easing ? kf.map((f) => (f.easing ? f : { ...f, easing })) : kf;
  return el.animate(k, { duration: d * 1000, iterations: Infinity, easing: 'linear', fill: 'both', ...reste });
};

// 5 · Coup de vent : l'accueil s'envole morceau par morceau, la grande heure apparaît, puis il revient
function vent(zone, { infos, page }) {
  zone.classList.add('eff-ciel');
  const T = 30; const hr = grandeHeure(zone, infos);
  anime(hr.el, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.27 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.63 }, { opacity: 0, offset: 0.72 }, { opacity: 0, offset: 1 }], T, { easing: 'ease-in-out' });
  const bloc = document.createElement('div'); bloc.className = 'eff-sombre'; zone.appendChild(bloc);
  morceaux(zone, page, 8, 5, { parent: bloc }).forEach((m) => {
    const dx = hasard(500, 1100); const dy = hasard(-260, 160); const rz = hasard(-120, 120);
    anime(m.el, [{ transform: 'none', opacity: 1, offset: 0 }, { transform: 'none', opacity: 1, offset: 0.08 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rz}deg) scale(.5)`, opacity: 0, offset: 0.28 },
      { transform: `translate(${-dx}px,${dy}px) rotate(${-rz}deg) scale(.5)`, opacity: 0, offset: 0.7 },
      { transform: 'none', opacity: 1, offset: 0.88 }, { transform: 'none', opacity: 1, offset: 1 }], T, { easing: 'ease-in', delay: (m.c * 0.42 + hasard(0, 0.6)) * 1000 });
  });
  const vents = document.createElement('div'); vents.className = 'eff-vents'; zone.appendChild(vents);
  for (let k = 0; k < 22; k++) { const v = document.createElement('i'); v.style.top = `${hasard(20, 780)}px`; v.style.width = `${hasard(120, 360)}px`; vents.appendChild(v); anime(v, [{ transform: 'translateX(-400px)', opacity: 0 }, { opacity: 0.7, offset: 0.1 }, { transform: 'translateX(1700px)', opacity: 0 }], hasard(1.4, 2.8), { delay: -hasard(0, 3) * 1000 }); }
  return () => hr.stop();
}

// 6 · Gravité : l'accueil s'effondre en tas en bas de l'écran, la grande heure apparaît, puis tout remonte
function gravite(zone, { infos, page }) {
  zone.classList.add('eff-nuitfond');
  const T = 28; const hr = grandeHeure(zone, infos, 'haut');
  anime(hr.el, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 1, offset: 0.42 }, { opacity: 1, offset: 0.64 }, { opacity: 0, offset: 0.7 }, { opacity: 0, offset: 1 }], T, { easing: 'ease-in-out' });
  const bloc = document.createElement('div'); bloc.className = 'eff-sombre'; zone.appendChild(bloc);
  const cols = 10; const rows = 6; const pile = new Array(cols).fill(0);
  const l = morceaux(zone, page, cols, rows, { parent: bloc }).sort((a, b) => b.r - a.r);
  l.forEach((m) => {
    const col = pile.indexOf(Math.min(...pile.slice(Math.max(0, m.c - 2), Math.min(cols, m.c + 3))), Math.max(0, m.c - 2));
    const ty = H - (pile[col] + 0.6) * m.h * 0.32 - m.h * 0.3; pile[col]++;
    const dx = (col - m.c) * m.w + hasard(-12, 12); const dy = ty - m.y; const rz = hasard(-35, 35);
    const bas = `translate(${dx}px,${dy}px) rotate(${rz}deg) scale(.42)`;
    anime(m.el, [{ transform: 'none', offset: 0 }, { transform: 'none', offset: 0.06 }, { transform: bas, offset: 0.3, easing: 'ease-out' },
      { transform: `translate(${dx}px,${dy - 14}px) rotate(${rz}deg) scale(.42)`, offset: 0.34 }, { transform: bas, offset: 0.38 }, { transform: bas, offset: 0.68, easing: 'ease-in-out' },
      { transform: 'none', offset: 0.92 }, { transform: 'none', offset: 1 }], T, { easing: 'cubic-bezier(.55,0,1,.45)', delay: ((rows - 1 - m.r) * 0.2 + hasard(0, 0.4)) * 1000 });
  });
  return () => hr.stop();
}

// 7 · Ondulation : l'accueil ondule doucement comme à la surface de l'eau
function ondulation(zone, { page }) {
  zone.classList.add('eff-nuitfond');
  morceaux(zone, page, 20, 1).forEach((m, k) => {
    m.el.style.filter = `brightness(${(0.64 + 0.1 * Math.sin(k / 3)).toFixed(2)})`;
    anime(m.el, [{ transform: 'translateY(-14px) scaleY(1.02)' }, { transform: 'translateY(14px) scaleY(.98)' }, { transform: 'translateY(-14px) scaleY(1.02)' }], 3.2, { easing: 'ease-in-out', delay: -k * 120 });
  });
  return () => {};
}

// 8 · Vague de cartes : les carrés se retournent en vague et montrent la grande heure au dos
function cartes(zone, { infos, page }) {
  zone.classList.add('eff-nuitfond');
  const T = 24; const cols = 8; const rows = 5; const tw = W / cols; const th = H / rows;
  const modele = copiePage(page);
  const dos = document.createElement('div'); dos.className = 'eff-dos';
  const remplirDos = () => { const i = infos() || {}; dos.innerHTML = `<div class="eff-grande"><div class="h">${esc(i.heure || '')}</div><div class="d">${esc(i.date || '')}${i.temp ? ' · ' + esc(i.temp) : ''}</div></div>`; };
  remplirDos();
  const faces = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const m = document.createElement('div'); m.className = 'eff-carte'; Object.assign(m.style, { left: `${c * tw}px`, top: `${r * th}px`, width: `${tw}px`, height: `${th}px` });
    const tour = document.createElement('div'); tour.className = 'eff-tour';
    const av = document.createElement('div'); av.className = 'eff-face'; const k = modele.cloneNode(true); k.style.left = `${-c * tw}px`; k.style.top = `${-r * th}px`; av.appendChild(k); av.style.filter = 'brightness(.7)';
    const ar = document.createElement('div'); ar.className = 'eff-face arriere'; const d = dos.cloneNode(true); d.style.left = `${-c * tw}px`; d.style.top = `${-r * th}px`; ar.appendChild(d); faces.push({ ar, c, r });
    tour.append(av, ar); m.appendChild(tour); zone.appendChild(m);
    anime(tour, [{ transform: 'rotateY(0)', offset: 0 }, { transform: 'rotateY(0)', offset: 0.1 }, { transform: 'rotateY(180deg)', offset: 0.22 }, { transform: 'rotateY(180deg)', offset: 0.62 }, { transform: 'rotateY(360deg)', offset: 0.74 }, { transform: 'rotateY(360deg)', offset: 1 }], T, { easing: 'ease-in-out', delay: (c + r) * 180 });
  }
  const t = setInterval(() => { remplirDos(); faces.forEach((f) => { const d = dos.cloneNode(true); d.style.left = `${-f.c * tw}px`; d.style.top = `${-f.r * th}px`; f.ar.replaceChildren(d); }); }, 30000);
  return () => clearInterval(t);
}

// 9 · Trou noir : chaque morceau est aspiré doucement en spirale, la grande heure apparaît, puis tout ressort
function trouNoir(zone, { infos, page }) {
  zone.classList.add('eff-espace');
  for (let k = 0; k < 90; k++) { const e = document.createElement('span'); e.className = 'eff-etoile'; Object.assign(e.style, { left: `${hasard(0, W)}px`, top: `${hasard(0, H)}px`, opacity: hasard(0.3, 0.9).toFixed(2) }); zone.appendChild(e); }
  const T = 44; const cx = W / 2; const cy = H / 2; const rmax = Math.hypot(cx, cy);
  const grandit = [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)', offset: 0 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(.6)', offset: 0.045 }, { transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.5 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.77 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)', offset: 0.86 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)', offset: 1 }];
  const disque = document.createElement('div'); disque.className = 'eff-disque'; zone.appendChild(disque); anime(disque, grandit, T, { easing: 'ease-in-out' });
  const anneau = document.createElement('div'); anneau.className = 'eff-anneau'; disque.appendChild(anneau); anime(anneau, [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], 9);
  const centre = document.createElement('div'); centre.className = 'eff-centre'; zone.appendChild(centre); anime(centre, grandit, T, { easing: 'ease-in-out' });
  const bloc = document.createElement('div'); bloc.className = 'eff-sombre'; zone.appendChild(bloc);
  morceaux(zone, page, 10, 7, { parent: bloc }).forEach((m) => {
    const tx = m.x + m.w / 2; const ty = m.y + m.h / 2; const r0 = Math.hypot(tx - cx, ty - cy); const a0 = Math.atan2(ty - cy, tx - cx);
    const st = 1 + (r0 / rmax) * 9 + hasard(0, 1.5); const du = 11 + hasard(0, 3);
    const pos = (u) => { const rr = r0 * Math.pow(1 - u, 1.4); const a = a0 + u * 2.4 * Math.PI; return `translate(${(cx + rr * Math.cos(a) - tx).toFixed(0)}px,${(cy + rr * Math.sin(a) - ty).toFixed(0)}px) rotate(${(u * 600).toFixed(0)}deg) scale(${Math.max(0.02, 1 - Math.pow(u, 0.8)).toFixed(3)})`; };
    const kf = [{ transform: 'none', opacity: 1, offset: 0 }, { transform: 'none', opacity: 1, offset: st / T }];
    for (let k = 1; k <= 12; k++) { const u = k / 12; kf.push({ transform: pos(u), opacity: u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.15), offset: (st + du * u) / T }); }
    kf.push({ transform: pos(1), opacity: 0, offset: 35 / T });
    for (let k = 1; k <= 6; k++) { const u = 1 - k / 6; kf.push({ transform: pos(u), opacity: 1, offset: (35 + k * 1.2) / T }); }
    kf.push({ transform: 'none', opacity: 1, offset: 1 });
    anime(m.el, kf, T);
  });
  const hr = grandeHeure(zone, infos, 'devant');
  anime(hr.el, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.57 }, { opacity: 1, offset: 0.75 }, { opacity: 0, offset: 0.8 }, { opacity: 0, offset: 1 }], T, { easing: 'ease-in-out' });
  return () => hr.stop();
}

// 10 · Construction : l'accueil se construit bloc par bloc sur un plan, comme si quelqu'un fabriquait l'appli
function construction(zone, { infos, page }) {
  zone.classList.add('eff-plan');
  const T = 40; const P = (t) => Math.min(1, Math.max(0, t / T));
  const src = page && page.firstElementChild; const ech = (src ? src.getBoundingClientRect().width : W) / W || 1;
  const o = src ? src.getBoundingClientRect() : { left: 0, top: 0 };
  const blocs = [['.haut .horloge', 'Horloge', '<Horloge />'], ['.haut .date', 'Date', '<Date pastilles />'], ['.haut .meteo', 'Météo', '<Meteo ville="Nantes" />'], ['.agenda', 'Agenda', '<Agenda famille />'],
    ['.carte.courses', 'Courses', '<Carte titre="Courses" />'], ['.carte.notes', 'Notes', '<Carte titre="Notes" />'], ['.carte.rappels', 'Rappels', '<Carte titre="Rappels" />'], ['.carte.anniv', 'Anniversaires', '<Carte titre="Anniversaires" />']]
    .map(([sel, nom, code]) => { const e = src && src.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { nom, code, x: (r.left - o.left) / ech, y: (r.top - o.top) / ech, w: r.width / ech, h: r.height / ech }; }).filter(Boolean);
  const modele = copiePage(page);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.classList.add('eff-traits'); zone.appendChild(svg);
  const term = document.createElement('div'); term.className = 'eff-term'; term.innerHTML = '<div class="t">● ● ●  construction de l\'appli…</div>';
  const curseur = document.createElement('div'); curseur.className = 'eff-curseur'; curseur.innerHTML = '<svg width="30" height="34" viewBox="0 0 30 34"><path d="M2 2 L2 26 L9 20 L14 31 L19 29 L14 18 L23 18 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>';
  const kc = [{ transform: 'translate(1180px,720px)', offset: 0 }];
  blocs.forEach((b, i) => {
    const tdes = 0.5 + i * 0.6; const tsq = 6 + i * 2.4; const treel = tsq + 1.2; const per = 2 * (b.w + b.h);
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); Object.entries({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 18, fill: 'none', stroke: '#7CC4FF', 'stroke-width': 2, 'stroke-dasharray': per }).forEach(([k, v]) => r.setAttribute(k, v)); svg.appendChild(r);
    anime(r, [{ strokeDashoffset: per, opacity: 1, offset: 0 }, { strokeDashoffset: per, offset: P(tdes) }, { strokeDashoffset: 0, opacity: 1, offset: P(tdes + 1.6) }, { strokeDashoffset: 0, opacity: 1, offset: P(34) }, { strokeDashoffset: 0, opacity: 0, offset: P(36) }, { strokeDashoffset: per, opacity: 0, offset: P(36.1) }, { strokeDashoffset: per, opacity: 1, offset: 1 }], T);
    const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text'); tx.setAttribute('x', b.x + 12); tx.setAttribute('y', b.y + 20); tx.textContent = b.nom; svg.appendChild(tx);
    const sq = document.createElement('div'); sq.className = 'eff-squelette'; Object.assign(sq.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }); zone.appendChild(sq);
    anime(sq, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: P(tsq) }, { opacity: 1, offset: P(tsq + 0.5) }, { opacity: 1, offset: P(treel + 0.4) }, { opacity: 0, offset: P(treel + 1) }, { opacity: 0, offset: 1 }], T);
    const m = document.createElement('div'); m.className = 'eff-morceau eff-bloc'; Object.assign(m.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    const k = modele.cloneNode(true); k.style.left = `${-b.x}px`; k.style.top = `${-b.y}px`; m.appendChild(k); zone.appendChild(m);
    anime(m, [{ opacity: 0, transform: 'translateY(14px)', offset: 0 }, { opacity: 0, transform: 'translateY(14px)', offset: P(treel) }, { opacity: 1, transform: 'none', offset: P(treel + 0.8) }, { opacity: 1, transform: 'none', offset: P(33) }, { opacity: 0, transform: 'none', offset: P(36) }, { opacity: 0, offset: 1 }], T, { easing: 'ease-out' });
    const cxp = b.x + b.w * 0.6; const cyp = b.y + b.h * 0.6;
    kc.push({ transform: `translate(${cxp}px,${cyp}px)`, offset: P(tsq - 0.6) }, { transform: `translate(${cxp}px,${cyp}px) scale(.85)`, offset: P(tsq - 0.2) }, { transform: `translate(${cxp}px,${cyp}px)`, offset: P(tsq + 0.1) });
    const li = document.createElement('div'); li.className = 'l'; li.textContent = '› ' + b.code; term.appendChild(li);
    anime(li, [{ width: '0px', offset: 0 }, { width: '0px', offset: P(treel - 0.8) }, { width: '330px', offset: P(treel + 0.4) }, { width: '330px', offset: P(35) }, { width: '0px', offset: P(35.1) }, { width: '0px', offset: 1 }], T, { easing: 'steps(30)' });
  });
  kc.push({ transform: 'translate(1180px,720px)', offset: P(30) }, { transform: 'translate(1180px,720px)', offset: 1 });
  const fin = document.createElement('div'); fin.className = 'f'; term.appendChild(fin);
  const majFin = () => { fin.textContent = `✓ Appli Famille prête — ${(infos() || {}).heure || ''}`; }; majFin(); const t = setInterval(majFin, 10000);
  anime(fin, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: P(26) }, { opacity: 1, offset: P(26.5) }, { opacity: 1, offset: P(34) }, { opacity: 0, offset: P(35) }, { opacity: 0, offset: 1 }], T);
  anime(term, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.72 }, { opacity: 0, offset: 0.76 }, { opacity: 0, offset: 0.94 }, { opacity: 1, offset: 0.98 }, { opacity: 1, offset: 1 }], T);
  zone.append(term, curseur); anime(curseur, kc, T, { easing: 'ease-in-out' });
  return () => clearInterval(t);
}
