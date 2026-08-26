(() => {
  const CGV_LOGO_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/CGV_logo.svg';

  const brandLockup = (variant) => `
    <span class="brand-lockup brand-lockup-${variant}" aria-label="CGV | ContactImporter">
      <img class="brand-cgv-logo" src="${CGV_LOGO_URL}" alt="CGV" decoding="async">
      <span class="brand-lockup-divider" aria-hidden="true"></span>
      <span class="brand-product-name">ContactImporter</span>
    </span>
  `;

  const applyBranding = () => {
    const mobileBrand = document.querySelector('.mobile-brand');
    if (mobileBrand) {
      mobileBrand.innerHTML = brandLockup('header');
      mobileBrand.setAttribute('aria-label', 'CGV | ContactImporter');
    }

    const brandHome = document.getElementById('brandHome');
    if (brandHome) {
      brandHome.innerHTML = brandLockup('sidebar');
      brandHome.setAttribute('aria-label', 'CGV | ContactImporter — Open overview');
    }

    if (!document.querySelector('link[rel="icon"]')) {
      const favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/svg+xml';
      favicon.href = './assets/logo-mark.svg';
      document.head.appendChild(favicon);
    }

    document.title = 'CGV | ContactImporter';
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
    .then(() => loadScript('./google-sheets-backend.js'))
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
