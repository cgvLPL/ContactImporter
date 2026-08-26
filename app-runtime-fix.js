(() => {
  if (window.__contactImporterRuntimeFixApplied) return;
  window.__contactImporterRuntimeFixApplied = true;

  const setBadge = (message, type = '') => {
    const badge = document.getElementById('statusBadge');
    if (!badge) return;
    badge.textContent = message;
    badge.className = 'status';
    if (type) badge.classList.add(type);
  };

  const loadFallbackXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-xlsx-fallback]');
    if (existing) {
      if (window.XLSX) {
        resolve();
        return;
      }
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.dataset.xlsxFallback = 'true';
    script.onload = () => window.XLSX ? resolve() : reject(new Error('Fallback loaded without XLSX global'));
    script.onerror = () => reject(new Error('Failed to load Excel parser fallback'));
    document.head.appendChild(script);
  });

  async function ensureExcelParser() {
    try {
      if (!window.XLSX) {
        setBadge('Loading Excel parser…');
        await loadFallbackXLSX();
      }

      if (window.XLSX) {
        setBadge('Ready for Excel import', 'success');
      } else {
        throw new Error('Excel parser unavailable');
      }
    } catch (error) {
      console.error(error);
      setBadge('Excel parser unavailable — refresh required', 'error');
    }
  }

  // Do not register duplicate file/button listeners here. app-core.js owns
  // those handlers. This file only guarantees a fallback Excel parser.
  ensureExcelParser();
})();
