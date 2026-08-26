(() => {
  if (window.__contactImporterRuntimeFixApplied) return;
  window.__contactImporterRuntimeFixApplied = true;

  const excelFile = document.getElementById('excelFile');
  const uploadZone = document.getElementById('uploadZone');
  const resetBtn = document.getElementById('resetBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const metadataInputs = [
    document.getElementById('eventName'),
    document.getElementById('nameFormat'),
    document.getElementById('source'),
    document.getElementById('category'),
    document.getElementById('additionalNote')
  ].filter(Boolean);

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
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.dataset.xlsxFallback = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Excel parser'));
    document.head.appendChild(script);
  });

  const importFile = async (file) => {
    if (!file) return;

    try {
      if (!window.XLSX) {
        setBadge('Loading Excel parser…');
        await loadFallbackXLSX();
      }

      if (typeof readSpreadsheetFile !== 'function') {
        throw new Error('Spreadsheet reader is not ready');
      }

      readSpreadsheetFile(file);
    } catch (error) {
      console.error(error);
      setBadge('Excel import failed to initialize', 'error');
    }
  };

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof resetProgram === 'function') resetProgram();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (typeof downloadVCF === 'function') downloadVCF();
    });
  }

  if (excelFile) {
    excelFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      importFile(file);
    });
  }

  if (uploadZone && excelFile) {
    uploadZone.addEventListener('click', (event) => {
      if (event.target.closest('button') || event.target.closest('input')) return;
      excelFile.click();
    });

    ['dragenter', 'dragover'].forEach((type) => {
      uploadZone.addEventListener(type, (event) => {
        event.preventDefault();
        uploadZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      uploadZone.addEventListener(type, (event) => {
        event.preventDefault();
        uploadZone.classList.remove('dragover');
      });
    });

    uploadZone.addEventListener('drop', (event) => {
      const file = event.dataTransfer && event.dataTransfer.files[0];
      importFile(file);
    });
  }

  metadataInputs.forEach((element) => {
    const refresh = () => {
      if (typeof updateLiveUI === 'function') updateLiveUI();
    };
    element.addEventListener('input', refresh);
    element.addEventListener('change', refresh);
  });

  setBadge('Ready for Excel import', 'success');
})();
