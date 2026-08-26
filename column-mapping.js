(() => {
  if (window.__contactImporterColumnMapping) return;
  window.__contactImporterColumnMapping = true;

  let lastSpreadsheetRows = null;
  let headersSignature = '';

  const uploadZone = document.getElementById('uploadZone');
  const importPanel = document.getElementById('importSection');
  if (!uploadZone || !importPanel || typeof parseRows !== 'function') return;

  const mappingPanel = document.createElement('div');
  mappingPanel.id = 'columnMappingPanel';
  mappingPanel.className = 'mapping-panel glass';
  mappingPanel.innerHTML = `
    <div class="mapping-head">
      <div>
        <h3>Choose spreadsheet columns</h3>
        <p>After uploading a file, map your own columns to Name, Phone Number, and E-mail.</p>
      </div>
      <div class="mapping-state" id="mappingState">Waiting for file</div>
    </div>

    <div class="mapping-grid">
      <div class="mapping-field">
        <label for="mapName"><i data-lucide="user-round"></i> Name *</label>
        <select id="mapName" class="mapping-select" disabled>
          <option value="">Upload a file first</option>
        </select>
      </div>

      <div class="mapping-field">
        <label for="mapPhone"><i data-lucide="phone"></i> Phone Number</label>
        <select id="mapPhone" class="mapping-select" disabled>
          <option value="-1">Not used</option>
        </select>
      </div>

      <div class="mapping-field">
        <label for="mapEmail"><i data-lucide="mail"></i> E-mail</label>
        <select id="mapEmail" class="mapping-select" disabled>
          <option value="-1">Not used</option>
        </select>
      </div>
    </div>

    <div class="mapping-help">
      <strong>Required:</strong> choose a Name column and at least one contact method (Phone or E-mail). The three mapped fields must use different columns.
    </div>
  `;

  const ruleBox = importPanel.querySelector('.rule');
  if (ruleBox) {
    importPanel.insertBefore(mappingPanel, ruleBox);
  } else {
    uploadZone.insertAdjacentElement('afterend', mappingPanel);
  }

  const mapName = document.getElementById('mapName');
  const mapPhone = document.getElementById('mapPhone');
  const mapEmail = document.getElementById('mapEmail');
  const mappingState = document.getElementById('mappingState');
  const mappingSummaryPill = document.querySelector('.top-pills .pill:last-child');
  const importSubtitle = importPanel.querySelector('.panel-title p');

  if (window.lucide) lucide.createIcons();

  function columnLetter(index) {
    let n = Number(index) + 1;
    let result = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  }

  function cleanHeader(value) {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('id-ID')
      .replace(/[._/\\-]+/g, ' ')
      .replace(/[^a-z0-9@ ]/g, '')
      .replace(/\s+/g, ' ');
  }

  function bestHeaderMatch(headers, kind) {
    const patterns = {
      name: [
        'full name', 'nama lengkap', 'nama', 'name', 'contact name', 'customer name', 'nama customer', 'nama pelanggan'
      ],
      phone: [
        'phone number', 'nomor hp', 'no hp', 'nomor handphone', 'handphone', 'mobile number', 'mobile',
        'nomor telepon', 'no telepon', 'telepon', 'telp', 'whatsapp', 'nomor whatsapp', 'no whatsapp', 'wa', 'phone', 'hp'
      ],
      email: [
        'email address', 'e mail', 'email', 'alamat email', 'surel', 'mail'
      ]
    };

    const normalized = headers.map(cleanHeader);
    const list = patterns[kind];

    for (const pattern of list) {
      const exact = normalized.findIndex(header => header === pattern);
      if (exact >= 0) return exact;
    }

    for (const pattern of list) {
      const partial = normalized.findIndex(header => header.includes(pattern));
      if (partial >= 0) return partial;
    }

    return -1;
  }

  function getColumnCount(rows) {
    return rows.slice(0, 30).reduce((max, row) => {
      return Math.max(max, Array.isArray(row) ? row.length : 0);
    }, 0);
  }

  function makeColumnOptions(headers, columnCount, includeNotUsed) {
    let html = includeNotUsed
      ? '<option value="-1">Not used</option>'
      : '<option value="">Select name column</option>';

    for (let i = 0; i < columnCount; i++) {
      const header = String(headers[i] ?? '').trim();
      const label = header || 'Untitled column';
      html += `<option value="${i}">${columnLetter(i)} — ${escapeHTML(label)}</option>`;
    }
    return html;
  }

  function setupMapping(rows) {
    const headers = Array.isArray(rows[0]) ? rows[0] : [];
    const columnCount = getColumnCount(rows);
    const signature = JSON.stringify(headers) + ':' + columnCount;

    if (signature === headersSignature) return;
    headersSignature = signature;

    mapName.innerHTML = makeColumnOptions(headers, columnCount, false);
    mapPhone.innerHTML = makeColumnOptions(headers, columnCount, true);
    mapEmail.innerHTML = makeColumnOptions(headers, columnCount, true);

    mapName.disabled = false;
    mapPhone.disabled = false;
    mapEmail.disabled = false;

    let nameIndex = bestHeaderMatch(headers, 'name');
    let phoneIndex = bestHeaderMatch(headers, 'phone');
    let emailIndex = bestHeaderMatch(headers, 'email');

    // Preserve the original C/D/E behavior as a fallback when headers are not recognizable.
    if (nameIndex < 0 && columnCount > 2) nameIndex = 2;
    if (phoneIndex < 0 && columnCount > 3) phoneIndex = 3;
    if (emailIndex < 0 && columnCount > 4) emailIndex = 4;

    mapName.value = nameIndex >= 0 ? String(nameIndex) : '';
    mapPhone.value = phoneIndex >= 0 ? String(phoneIndex) : '-1';
    mapEmail.value = emailIndex >= 0 ? String(emailIndex) : '-1';

    mappingState.textContent = 'Auto-detected';
    mappingState.className = 'mapping-state ready';
    updateMappingSummary();
  }

  function getMapping() {
    return {
      name: mapName.value === '' ? -1 : Number(mapName.value),
      phone: Number(mapPhone.value),
      email: Number(mapEmail.value)
    };
  }

  function validateMapping(mapping) {
    if (mapping.name < 0) return 'Choose a Name column.';
    if (mapping.phone < 0 && mapping.email < 0) return 'Choose a Phone Number or E-mail column.';

    const used = [mapping.name, mapping.phone, mapping.email].filter(index => index >= 0);
    if (new Set(used).size !== used.length) return 'Each mapped field must use a different column.';

    return '';
  }

  function applyMapping(rows) {
    const mapping = getMapping();
    const error = validateMapping(mapping);

    contacts = [];
    skippedRows = 0;

    if (error) {
      mappingState.textContent = 'Needs mapping';
      mappingState.className = 'mapping-state';
      updateMappingSummary();
      return error;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = Array.isArray(rows[i]) ? rows[i] : [];
      const fullName = normalizeIndonesianName(row[mapping.name]);
      const phone = mapping.phone >= 0 ? cleanPhone(row[mapping.phone]) : '';
      const email = mapping.email >= 0 ? cleanValue(row[mapping.email]) : '';

      if (!fullName && !phone && !email) continue;

      if (!fullName || (!phone && !email)) {
        skippedRows++;
        continue;
      }

      contacts.push({ fullName, phone, email });
    }

    mappingState.textContent = 'Mapping active';
    mappingState.className = 'mapping-state ready';
    updateMappingSummary();
    return '';
  }

  function updateMappingSummary() {
    const mapping = getMapping();
    const nameLabel = mapping.name >= 0 ? `${columnLetter(mapping.name)} = Name` : 'Name not mapped';
    const phoneLabel = mapping.phone >= 0 ? `${columnLetter(mapping.phone)} = Phone` : 'No phone';
    const emailLabel = mapping.email >= 0 ? `${columnLetter(mapping.email)} = E-mail` : 'No e-mail';

    if (mappingSummaryPill) {
      mappingSummaryPill.textContent = `${nameLabel} · ${phoneLabel} · ${emailLabel}`;
    }
  }

  function refreshFromMapping() {
    if (!lastSpreadsheetRows) return;

    const error = applyMapping(lastSpreadsheetRows);
    updateStats();
    updateDownloadState();

    if (error) {
      clearPreview(error);
      setStatus(error, 'error');
      return;
    }

    if (contacts.length) {
      renderPreview();
      setStatus(`${contacts.length} contacts ready`, 'success');
    } else {
      clearPreview('No valid contacts found with the selected column mapping.');
      setStatus('No valid contacts found', 'error');
    }
  }

  // Replace the original fixed C/D/E parser with the user-selected mapping parser.
  parseRows = function(rows) {
    lastSpreadsheetRows = rows;
    setupMapping(rows);
    applyMapping(rows);
  };

  [mapName, mapPhone, mapEmail].forEach(select => {
    select.addEventListener('change', () => {
      mappingState.textContent = 'Custom mapping';
      mappingState.className = 'mapping-state ready';
      refreshFromMapping();
    });
  });

  if (importSubtitle) {
    importSubtitle.textContent = 'Row 1 is treated as the header. Upload first, then choose which columns contain Name, Phone Number, and E-mail.';
  }

  if (mappingSummaryPill) {
    mappingSummaryPill.textContent = 'Custom column mapping';
  }

  window.ContactImporterMapping = {
    getMapping,
    refresh: refreshFromMapping
  };
})();
