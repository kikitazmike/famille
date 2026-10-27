// Écran de repos de la tablette : un effet animé par-dessus l'agenda après 10 min sans activité.
// 1 Bulles zigzag avec traînée · 2 Liquide néon · 3 HUD qui se déplace · 4 Hexagones qui tombent · spécial Confettis (anniversaire)
export const EFFETS = [
  { id: 1, nom: 'Bulles zigzag avec traînée' },
  { id: 2, nom: 'Liquide néon' },
  { id: 3, nom: 'HUD « Jarvis » qui se déplace' },
  { id: 4, nom: 'Hexagones qui tombent' }
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
export function demarrerEffet(conteneur, n, { infos = () => ({}), noms = [] } = {}) {
  arreterEffet();
  conteneur.innerHTML = '<div class="eff-voile"></div><div class="eff-zone"></div><div class="eff-toucher">Touchez l\'écran pour revenir</div>';
  const zone = conteneur.querySelector('.eff-zone');
  const f = n === 'confettis' ? confettis : [null, bulles, liquide, hud, hexagones][n] || bulles;
  const arret = f(zone, { infos, noms });
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
