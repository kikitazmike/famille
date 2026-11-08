// Savoir : fiches Wikipédia et définitions du Wiktionnaire (gratuit, sans clé, sans IA)

const WIKI = 'https://fr.wikipedia.org';
const WIKT = 'https://fr.wiktionary.org';
const attendre = (url) => fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });

// Première phrase(s) d'un texte, pour la lecture à voix haute
export function debutTexte(t, max = 2) {
  const p = (t || '').replace(/\s*\([^)]*\)/g, '').match(/[^.!?]+[.!?]+/g) || [t || ''];
  return p.slice(0, max).join(' ').trim();
}

// → { titre, texte, image, lien } ou null
export async function ficheWikipedia(q) {
  const r = await attendre(`${WIKI}/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=5`);
  for (const p of (r.pages || [])) {
    try {
      const f = await attendre(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`);
      if (!f || f.type === 'disambiguation' || !f.extract) continue;
      return { titre: f.title, sousTitre: f.description || p.description || '', texte: f.extract, image: (f.thumbnail && f.thumbnail.source) || (f.originalimage && f.originalimage.source) || '', lien: (f.content_urls && f.content_urls.desktop && f.content_urls.desktop.page) || `${WIKI}/wiki/${encodeURIComponent(p.key)}` };
    } catch (e) { /* suivante */ }
  }
  return null;
}

// Nettoie le code du Wiktionnaire
function nettoyer(x) {
  return x
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\{\{(?:lien|l|w|lien web|nom w pc)\|([^|}]+)[^}]*\}\}/g, '$1')
    .replace(/\{\{term\|([^|}]+)[^}]*\}\}/g, '($1)')
    .replace(/\{\{(figuré|familier|populaire|vieilli|littéraire|péjoratif|ironique|soutenu|argot|désuet|rare|par extension|sens figuré)[^}]*\}\}/gi, '($1)')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
}
const NATURES = { nom: 'Nom', verbe: 'Verbe', adjectif: 'Adjectif', adj: 'Adjectif', adverbe: 'Adverbe', adv: 'Adverbe', interjection: 'Interjection', 'locution-phrase': 'Expression', 'nom propre': 'Nom propre', préposition: 'Préposition', pronom: 'Pronom', conjonction: 'Conjonction' };
// → { mot, sens: [{ nature, definitions: [] }], lien } ou null
export async function definition(mot) {
  for (const essai of [...new Set([mot, mot.toLowerCase()])]) {
    let r;
    try { r = await attendre(`${WIKT}/w/api.php?action=parse&page=${encodeURIComponent(essai)}&prop=wikitext&format=json&formatversion=2&redirects=1&origin=*`); } catch (e) { continue; }
    const w = r && r.parse && r.parse.wikitext; if (!w) continue;
    const debut = w.search(/==\s*\{\{langue\|fr\}\}\s*==/); if (debut < 0) continue;
    const reste = w.slice(debut + 10); const fin = reste.search(/\n==\s*\{\{langue\|/);
    const fr = fin >= 0 ? reste.slice(0, fin) : reste;
    const sens = []; let courant = null;
    fr.split('\n').forEach((l) => {
      const s = l.match(/^===\s*\{\{S\|([^|}]+)\|fr/);
      if (s) { const n = NATURES[s[1].toLowerCase()]; courant = n ? { nature: n, definitions: [] } : null; if (courant) sens.push(courant); return; }
      const d = l.match(/^#(?![*:#])\s*(.+)/);
      if (d && courant && courant.definitions.length < 4) { const t = nettoyer(d[1]); if (t.length > 2) courant.definitions.push(t.charAt(0).toUpperCase() + t.slice(1)); }
    });
    const bons = sens.filter((x) => x.definitions.length).slice(0, 3);
    if (bons.length) return { mot: r.parse.title || essai, sens: bons, lien: `${WIKT}/wiki/${encodeURIComponent(r.parse.title || essai)}` };
  }
  return null;
}
