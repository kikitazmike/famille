// Applique le thème avant l'affichage pour éviter un flash
  try {
    var p = JSON.parse(localStorage.getItem('famille-prefs') || '{}');
    var t = p.theme === 'auto' || !p.theme ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'fonce' : 'clair') : p.theme;
    document.documentElement.dataset.theme = t;
    if (p.zoom) document.documentElement.style.setProperty('--zoom', p.zoom);
  } catch (e) {}

// Interdit l'affichage de l'appli dans un cadre d'un autre site (protection contre le « clickjacking »)
try { if (window.top !== window.self) window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; }
