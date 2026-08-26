(() => {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

  loadScript('./app-core.js')
    .then(() => loadScript('./app-export.js'))
    .catch((error) => {
      console.error(error);
      const badge = document.getElementById('statusBadge');
      if (badge) {
        badge.textContent = 'App failed to initialize';
        badge.className = 'status error';
      }
    });
})();
