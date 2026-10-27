// Fonctionnement hors connexion : l'appli est gardée en cache, les données passent par le réseau
const VERSION = 'famille-v1.13.2';
const FICHIERS = [
  './', 'index.html', 'tablette.html', 'manifest.webmanifest', 'tablette.webmanifest',
  'css/app.css', 'css/tablette.css',
  'js/app.js', 'js/tablette.js', 'js/store.js', 'js/supa.js', 'js/config.js', 'js/dates.js', 'js/voix.js', 'js/theme.js', 'js/parole.js', 'js/voix-locale.js', 'js/planning.js', 'js/catalogue.js', 'js/repas.js', 'js/frigo.js', 'js/sucre.js', 'js/effets.js', 'js/icones.js',
  'icons/icone-192.png', 'icons/icone-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',
  'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(FICHIERS.map((f) => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== VERSION && x !== 'famille-vosk').map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Données Supabase, météo : jamais en cache ici (l'appli garde sa propre copie)
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('open-meteo')) return;
  const memeSite = url.origin === self.location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname.includes('fonts.g');
  if (!memeSite && !cdn) return;
  // Modèle vocal (gros fichier qui ne change pas) : cache d'abord, dans un cache séparé gardé entre versions
  if (memeSite && url.pathname.includes('/vosk/')) {
    e.respondWith(caches.open('famille-vosk').then((c) => c.match(req).then((r) => r || fetch(req).then((rep) => { if (rep.ok) c.put(req, rep.clone()); return rep; }))));
    return;
  }
  // Pages et scripts de l'appli : réseau d'abord (mises à jour rapides), cache si hors ligne
  if (memeSite) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(url.pathname.includes('tablette') ? 'tablette.html' : 'index.html'))));
    return;
  }
  // Bibliothèques et polices : cache d'abord
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((rep) => {
    if (rep.ok || rep.type === 'opaque') { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); } return rep;
  })));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((l) => (l[0] ? l[0].focus() : self.clients.openWindow('./#/agenda'))));
});
