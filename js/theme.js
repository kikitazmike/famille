// Applique le thème avant l'affichage pour éviter un flash
  try {
    var p = JSON.parse(localStorage.getItem('famille-prefs') || '{}');
    var t = p.theme === 'auto' || !p.theme ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'fonce' : 'clair') : p.theme;
    document.documentElement.dataset.theme = t;
    if (p.zoom) document.documentElement.style.setProperty('--zoom', p.zoom);
  } catch (e) {}
