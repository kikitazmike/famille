// Icônes au trait (SVG). i('nom', taille)
const P = {
  agenda: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  courses: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  notes: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h4"/>',
  anniv: '<path d="M4 21h16M5 21v-7h14v7M12 14v-4M12 7.5c-1-1-1-2.2 0-3.5 1 1.3 1 2.5 0 3.5z"/>',
  plus: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  ajouter: '<path d="M12 5v14M5 12h14"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  poubelle: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  modifier: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  epingle: '<path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3z"/>',
  coche: '<path d="m5 12 5 5 9-10"/>',
  gauche: '<path d="m15 6-6 6 6 6"/>',
  droite: '<path d="m9 6 6 6-6 6"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
  cloche: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  lever: '<path d="M2 18h20M6 18a6 6 0 0 1 12 0"/><path d="M12 3v5M9.5 5.5 12 3l2.5 2.5"/>',
  coucher: '<path d="M2 18h20M6 18a6 6 0 0 1 12 0"/><path d="M12 8V3M9.5 5.5 12 8l2.5-2.5"/>',
  nuage: '<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M3.5 9H2M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 20h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.4A3.3 3.3 0 0 0 8 20z"/>',
  maison: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
  ecran: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sortir: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  plein: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  lune: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  hors_ligne: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18"/>',
  // Icônes de profil
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  etoile: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  coeur: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  eclair: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  chat: '<path d="M5 20V9l-1-5 4 3h8l4-3-1 5v11z"/><path d="M9 13h.01M15 13h.01M10.5 16.5h3"/>',
  chien: '<path d="M6 8 3 6v6l3 1M18 8l3-2v6l-3 1"/><path d="M6 8h12v6a6 6 0 0 1-12 0z"/><path d="M10 12h.01M14 12h.01M11 15.5h2"/>',
  ballon: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
  guitare: '<path d="m14 10 6-6M17 3l4 4"/><path d="M11 9.5a4 4 0 0 0-5.5 1.5 3 3 0 0 0-2.2 4.5 4 4 0 0 0 5.2 5.2 3 3 0 0 0 4.5-2.2A4 4 0 0 0 14.5 13z"/>',
  manette: '<path d="M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 13H9l-1.6 1.8A3 3 0 0 1 2 13v-1a4 4 0 0 1 4-4z"/><path d="M7 10.5v3M5.5 12h3M16 11h.01M18 13h.01"/>',
  fleur: '<circle cx="12" cy="9" r="2.5"/><path d="M12 6.5a3 3 0 1 1 2.5-4 3 3 0 1 1 1.5 5 3 3 0 1 1-1 4.5 3 3 0 1 1-6 0 3 3 0 1 1-1-4.5 3 3 0 1 1 1.5-5 3 3 0 1 1 2.5 4zM12 14v8M12 18c2-2 4-2 5-2"/>',
  voiture: '<path d="M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v2M17 19v2"/>',
  cafe: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 2v4M12 2v4"/>'
};
export const ICONES_PROFIL = ['soleil', 'etoile', 'coeur', 'eclair', 'chat', 'chien', 'ballon', 'guitare', 'manette', 'fleur', 'voiture', 'cafe'];

export function i(nom, taille = 22, epaisseur = 1.8) {
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${epaisseur}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nom] || ''}</svg>`;
}

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const COULEURS_APPLI = [
  { nom: 'Violet', hex: '#6D5BD0' }, { nom: 'Bleu', hex: '#2F80ED' }, { nom: 'Vert', hex: '#1F8A4C' },
  { nom: 'Corail', hex: '#D9774A' }, { nom: 'Rose', hex: '#C8446F' }, { nom: 'Ardoise', hex: '#4A5568' }
];
export const COULEURS_PERSO = ['#2F80ED', '#C8446F', '#1F8A4C', '#D9774A', '#6D5BD0', '#0E8C8C', '#B5651D', '#4A5568'];

// Mélange une couleur hex avec du blanc (t entre 0 et 1)
export function eclaircir(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * t);
  return '#' + [m(r), m(g), m(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function assombrir(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c * (1 - t));
  return '#' + [m(r), m(g), m(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const initiales = (p) => (p || '?').slice(0, 2);
