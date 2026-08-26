(() => {
  const applyBranding = () => {
    const mobileBrand = document.querySelector('.mobile-brand');
    if (mobileBrand) {
      mobileBrand.innerHTML = '<img class="header-logotype" src="./assets/logo.svg" alt="ContactImporter">';
    }

    const brandHome = document.getElementById('brandHome');
    if (brandHome) {
      brandHome.innerHTML = '<img class="sidebar-logo-mark" src="./assets/logo-mark.svg" alt=""><span class="sidebar-brand-text">ContactImporter</span>';
    }

    if (!document.querySelector('link[rel="icon"]')) {
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/svg+xml';
      favicon.href = './assets/logo-mark.svg';
      document.head.appendChild(favicon);
    }

    document.title = 'ContactImporter';
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

  applyBranding();

  loadScript('./app-core.js')
    .then(() => loadScript('./app-export.js'))
    .then(() => loadScript('./app-runtime-fix.js'))
    .then(() => loadScript('./column-mapping.js'))
    .then(() => loadScript('./tab-ui.js'))
    .catch((error) => {
      console.error(error);
      const badge = document.getElementById('statusBadge');
      if (badge) {
        badge.textContent = 'App failed to initialize';
        badge.className = 'status error';
      }
    });
})();
