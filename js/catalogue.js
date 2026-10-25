import { state } from './store.js';
// Articles courants proposés dans le menu des courses (complétés par les articles souvent ajoutés)
export const CATALOGUE = [
  'Ail', 'Allumettes', 'Ampoules', 'Ananas', 'Aspirine', 'Avocats', 'Baguette', 'Bananes', 'Beurre', 'Bière', 'Biscottes',
  'Biscuits', 'Blanc de poulet', 'Bonbons', 'Brioche', 'Brocolis', 'Café', 'Café en dosettes', 'Carottes', 'Céréales',
  'Champignons', 'Chips', 'Chocolat', 'Citrons', 'Compotes', 'Concombre', 'Confiture', 'Coca', 'Coton-tiges', 'Courgettes',
  'Crème fraîche', 'Croquettes chat', 'Croquettes chien', 'Dentifrice', 'Déodorant', 'Eau', 'Eau gazeuse', 'Emmental râpé',
  'Endives', 'Éponges', 'Épinards', 'Essuie-tout', 'Farine', 'Film alimentaire', 'Fraises', 'Fromage', 'Fromage blanc',
  'Gel douche', 'Glaces', 'Gruyère', 'Haricots verts', 'Huile d\'olive', 'Huile de tournesol', 'Jambon', 'Jus d\'orange',
  'Ketchup', 'Kiwis', 'Lait', 'Lardons', 'Lessive', 'Lentilles', 'Liquide vaisselle', 'Mayonnaise', 'Miel', 'Mouchoirs',
  'Moutarde', 'Mozzarella', 'Nutella', 'Oeufs', 'Oignons', 'Oranges', 'Pain', 'Pain de mie', 'Papier aluminium',
  'Papier toilette', 'Pastilles lave-vaisselle', 'Pâtes', 'Pêches', 'Petits pois', 'Piles', 'Pizza', 'Poireaux', 'Poires',
  'Poisson', 'Poivre', 'Poivrons', 'Pommes', 'Pommes de terre', 'Poulet', 'Produit ménager', 'Raisin', 'Riz',
  'Sacs poubelle', 'Salade', 'Sardines', 'Sauce tomate', 'Saucisses', 'Saumon', 'Savon', 'Sel', 'Shampoing', 'Sirop',
  'Steaks hachés', 'Sucre', 'Surgelés', 'Thé', 'Thon', 'Tomates', 'Vin', 'Vinaigre', 'Yaourts'
];

// Catalogue + articles souvent ajoutés (2 fois ou plus), sans ce qui est déjà à prendre, par ordre alphabétique
export function propositionsArticles(aPrendre) {
  const cle = (x) => (x || '').trim().toLowerCase();
  const maj = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const dans = new Set(aPrendre.map((c) => cle(c.nom)));
  const masques = new Set(state.habituels.filter((h) => h.masque).map((h) => h.cle));
  const frequents = new Map(state.habituels.filter((h) => !h.masque && h.nb >= 2).map((h) => [h.cle, h]));
  const noms = new Map();
  CATALOGUE.forEach((n) => { if (!masques.has(cle(n))) noms.set(cle(n), { nom: n, frequent: frequents.has(cle(n)) }); });
  frequents.forEach((h, k) => { noms.set(k, { nom: maj(h.nom), frequent: true }); });
  return [...noms.entries()].filter(([k]) => !dans.has(k)).map(([, v]) => v).sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
}
