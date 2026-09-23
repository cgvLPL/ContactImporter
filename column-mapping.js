(() => {
  if (window.__contactImporterColumnMapping) return;
  window.__contactImporterColumnMapping = true;

  let lastSpreadsheetRows = null;
  let headersSignature = '';
  let workbookSheets = [];
  let selectedSheet = null;
  let headerRowIndex = 0;
  let firstRowNumber = 1;
  let selectedHeaders = [];


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
        <p>After uploading a file, map your own columns to Name, Phone Number, E-mail, and Notes.</p>
      </div>
      <div class="mapping-state" id="mappingState">Waiting for file</div>
    </div>

    <div class="mapping-source" id="mappingSource" hidden>
      <div class="mapping-field">
        <label for="mapSheet"><i data-lucide="layers"></i> Worksheet</label>
        <select id="mapSheet" class="mapping-select" aria-label="Choose worksheet"></select>
      </div>
      <div class="mapping-field">
        <label for="mapHeaderRow"><i data-lucide="rows-3"></i> Header row</label>
        <select id="mapHeaderRow" class="mapping-select" aria-label="Choose header row"></select>
      </div>
      <div class="mapping-detected" id="mappingDetected" aria-live="polite"></div>
      <button type="button" class="glass-btn mapping-campaign-button" id="mappingUseTitle" hidden>Use event title for campaign</button>
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

      <div class="mapping-field">
        <label for="mapNotes"><i data-lucide="notebook-pen"></i> Notes</label>
        <select id="mapNotes" class="mapping-select" disabled>
          <option value="-1">Not used</option>
        </select>
      </div>

      <div class="mapping-field">
        <label for="mapExtra"><i data-lucide="ticket"></i> Extra registration detail</label>
        <select id="mapExtra" class="mapping-select" disabled>
          <option value="-1">Not used</option>
        </select>
      </div>
    </div>

    <div class="mapping-help">
      <strong>Required:</strong> choose a Name column and at least one contact method (Phone or E-mail). Notes and registration details are optional. All mapped fields must use different columns. Extra registration details (for example, Jumlah Penonton) are saved in the contact note.
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
  const mapNotes = document.getElementById('mapNotes');
  const mapExtra = document.getElementById('mapExtra');
  const mapSheet = document.getElementById('mapSheet');
  const mapHeaderRow = document.getElementById('mapHeaderRow');
  const mappingSource = document.getElementById('mappingSource');
  const mappingDetected = document.getElementById('mappingDetected');
  const mappingUseTitle = document.getElementById('mappingUseTitle');
  const spreadsheet = window.ContactImporterSpreadsheet;
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

  function bestHeaderMatch(headers, kind) {
    return spreadsheet ? spreadsheet.bestHeaderMatch(headers, kind) : -1;
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
    const headers = headerRowIndex >= 0 && Array.isArray(rows[headerRowIndex])
      ? rows[headerRowIndex] : [];
    const columnCount = getColumnCount(rows);
    selectedHeaders = headers;
    const signature = JSON.stringify(headers) + ':' + columnCount + ':' + headerRowIndex;
    if (signature === headersSignature) return;
    headersSignature = signature;

    mapName.innerHTML = makeColumnOptions(headers, columnCount, false);
    mapPhone.innerHTML = makeColumnOptions(headers, columnCount, true);
    mapEmail.innerHTML = makeColumnOptions(headers, columnCount, true);
    mapNotes.innerHTML = makeColumnOptions(headers, columnCount, true);
    mapExtra.innerHTML = makeColumnOptions(headers, columnCount, true);

    [mapName, mapPhone, mapEmail, mapNotes, mapExtra].forEach(select => {
      select.disabled = false;
    });

    const nameIndex = bestHeaderMatch(headers, 'name');
    const phoneIndex = bestHeaderMatch(headers, 'phone');
    const emailIndex = bestHeaderMatch(headers, 'email');
    const notesIndex = bestHeaderMatch(headers, 'notes');
    const extraIndex = bestHeaderMatch(headers, 'extra');

    // Unknown fields require an explicit choice. In particular, never guess
    // that a registration count is an e-mail or a "No" serial is a phone.
    mapName.value = nameIndex >= 0 ? String(nameIndex) : '';
    mapPhone.value = phoneIndex >= 0 ? String(phoneIndex) : '-1';
    mapEmail.value = emailIndex >= 0 ? String(emailIndex) : '-1';
    mapNotes.value = notesIndex >= 0 ? String(notesIndex) : '-1';
    mapExtra.value = extraIndex >= 0 && extraIndex !== notesIndex
      ? String(extraIndex) : '-1';

    mappingState.textContent = nameIndex >= 0 && (phoneIndex >= 0 || emailIndex >= 0)
      ? 'Auto-detected' : 'Choose columns';
    mappingState.className = mappingState.textContent === 'Auto-detected'
      ? 'mapping-state ready' : 'mapping-state';
    updateMappingSummary();
  }

  function getMapping() {
    return {
      name: mapName.value === '' ? -1 : Number(mapName.value),
      phone: Number(mapPhone.value),
      email: Number(mapEmail.value),
      notes: Number(mapNotes.value),
      extra: Number(mapExtra.value)
    };
  }

  function validateMapping(mapping) {
    if (mapping.name < 0) return 'Choose a Name column.';
    if (mapping.phone < 0 && mapping.email < 0) return 'Choose a Phone Number or E-mail column.';

    const used = [mapping.name, mapping.phone, mapping.email, mapping.notes, mapping.extra].filter(index => index >= 0);
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

    const dataStart = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    for (let i = dataStart; i < rows.length; i++) {
      const row = Array.isArray(rows[i]) ? rows[i] : [];
      const fullName = normalizeIndonesianName(row[mapping.name]);
      const phone = mapping.phone >= 0 ? cleanPhone(row[mapping.phone]) : '';
      const email = mapping.email >= 0 ? cleanValue(row[mapping.email]) : '';
      const noteParts = [];
      const regularNote = mapping.notes >= 0 ? cleanValue(row[mapping.notes]) : '';
      const extraValue = mapping.extra >= 0 ? cleanValue(row[mapping.extra]) : '';
      if (regularNote) noteParts.push(regularNote);
      if (extraValue) {
        const extraLabel = cleanValue(selectedHeaders[mapping.extra]) || 'Registration detail';
        noteParts.push(extraLabel + ': ' + extraValue);
      }
      const note = noteParts.join('\n');

      if (!fullName && !phone && !email && !note) continue;

      if (!fullName || (!phone && !email)) {
        skippedRows++;
        continue;
      }

      // Keep `note` for the local preview/VCF path and `notes` for the
      // Google Sheets backend payload, so the mapped value survives both paths.
      contacts.push({ fullName, phone, email, note, notes: note });
    }

    mappingState.textContent = contacts.length + ' ready';
    mappingState.className = 'mapping-state ready';
    updateMappingSummary();
    return '';
  }

  function updateMappingSummary() {
    const mapping = getMapping();
    const nameLabel = mapping.name >= 0 ? `${columnLetter(mapping.name)} = Name` : 'Name not mapped';
    const phoneLabel = mapping.phone >= 0 ? `${columnLetter(mapping.phone)} = Phone` : 'No phone';
    const emailLabel = mapping.email >= 0 ? `${columnLetter(mapping.email)} = E-mail` : 'No e-mail';
    const notesLabel = mapping.notes >= 0 ? columnLetter(mapping.notes) + ' = Notes' : 'No notes';
    const extraLabel = mapping.extra >= 0 ? columnLetter(mapping.extra) + ' = Extra' : 'No extra detail';

    if (mappingSummaryPill) {
      mappingSummaryPill.textContent = [nameLabel, phoneLabel, emailLabel, notesLabel, extraLabel].join(' · ');
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

  function showHeaderRows(sheet) {
    mapHeaderRow.innerHTML = '';
    const noHeader = document.createElement('option');
    noHeader.value = '-1';
    noHeader.textContent = 'No header (first row is data)';
    mapHeaderRow.appendChild(noHeader);
    const limit = Math.min(sheet.rows.length, 20);
    for (let index = 0; index < limit; index++) {
      const row = sheet.rows[index] || [];
      if (!row.some(value => String(value == null ? '' : value).trim())) continue;
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'Row ' + (sheet.firstRowNumber + index);
      mapHeaderRow.appendChild(option);
    }
    mapHeaderRow.value = String(headerRowIndex);
  }

  function useSheet(name) {
    selectedSheet = workbookSheets.find(sheet => sheet.name === name) || null;
    if (!selectedSheet) return;
    lastSpreadsheetRows = selectedSheet.rows;
    firstRowNumber = selectedSheet.firstRowNumber;
    headerRowIndex = selectedSheet.headerIndex;
    // Reflect a manual worksheet change in the uploaded file label as well.
    const uploadedFileChip = document.getElementById('fileChip');
    if (uploadedFileChip && uploadedFileChip.textContent && !uploadedFileChip.textContent.startsWith('Reading ')) {
      const fileLabel = uploadedFileChip.textContent.split(' · ')[0];
      uploadedFileChip.textContent = fileLabel + ' · ' + selectedSheet.name;
    }
    headersSignature = '';
    showHeaderRows(selectedSheet);
    setupMapping(lastSpreadsheetRows);
    showSourceDetails();
    refreshFromMapping();
  }

  function showSourceDetails() {
    if (!selectedSheet) return;
    const header = headerRowIndex < 0
      ? 'No headers detected'
      : 'Headers on row ' + (firstRowNumber + headerRowIndex);
    const firstDataIndex = headerRowIndex < 0 ? 0 : headerRowIndex + 1;
    const responseRows = selectedSheet.rows.slice(firstDataIndex)
      .filter(row => Array.isArray(row) && row.some(v => String(v == null ? '' : v).trim())).length;
    mappingDetected.textContent = header + ' · ' + responseRows + ' response rows';
    if (selectedSheet.title) mappingDetected.textContent += ' · Event title detected';
    mappingUseTitle.hidden = !selectedSheet.title;
    if (selectedSheet.title) mappingUseTitle.title = selectedSheet.title;
  }

  function loadWorkbook(workbook) {
    if (!spreadsheet) return false;
    const sheets = spreadsheet.analyzeWorkbook(workbook);
    if (!sheets.length) throw new Error('No usable worksheet in spreadsheet');
    workbookSheets = sheets;
    mappingSource.hidden = false;
    mapSheet.innerHTML = '';
    sheets.forEach(sheet => {
      const option = document.createElement('option');
      option.value = sheet.name;
      option.textContent = sheet.name;
      mapSheet.appendChild(option);
    });
    mapSheet.value = sheets[0].name;
    useSheet(sheets[0].name);
    return true;
  }

  function resetMapping() {
    lastSpreadsheetRows = null;
    workbookSheets = [];
    selectedSheet = null;
    firstRowNumber = 1;
    headerRowIndex = 0;
    selectedHeaders = [];
    headersSignature = '';
    mappingSource.hidden = true;
    mappingDetected.textContent = '';
    mappingUseTitle.hidden = true;
    mapSheet.innerHTML = '';
    mapHeaderRow.innerHTML = '';

    mapName.innerHTML = '<option value="">Upload a file first</option>';
    mapPhone.innerHTML = '<option value="-1">Not used</option>';
    mapEmail.innerHTML = '<option value="-1">Not used</option>';
    mapNotes.innerHTML = '<option value="-1">Not used</option>';
    mapExtra.innerHTML = '<option value="-1">Not used</option>';

    [mapName, mapPhone, mapEmail, mapNotes, mapExtra].forEach(select => {
      select.disabled = true;
    });

    mappingState.textContent = 'Waiting for file';
    mappingState.className = 'mapping-state';
    if (mappingSummaryPill) mappingSummaryPill.textContent = 'Custom column mapping';
  }

  // Retain support for older callers that pass one worksheet as rows.
  parseRows = function(rows) {
    lastSpreadsheetRows = rows;
    const layout = spreadsheet ? spreadsheet.analyzeRows(rows) : { headerIndex: 0 };
    headerRowIndex = layout.headerIndex;
    firstRowNumber = 1;
    headersSignature = '';
    setupMapping(rows);
    applyMapping(rows);
  };

  [mapName, mapPhone, mapEmail, mapNotes, mapExtra].forEach(select => {
    select.addEventListener('change', () => {
      mappingState.textContent = 'Custom mapping';
      mappingState.className = 'mapping-state ready';
      refreshFromMapping();
    });
  });

  mapSheet.addEventListener('change', () => useSheet(mapSheet.value));
  mapHeaderRow.addEventListener('change', () => {
    headerRowIndex = Number(mapHeaderRow.value);
    headersSignature = '';
    setupMapping(lastSpreadsheetRows);
    showSourceDetails();
    refreshFromMapping();
  });
  mappingUseTitle.addEventListener('click', () => {
    if (!selectedSheet || !selectedSheet.title) return;
    const eventName = document.getElementById('eventName');
    if (!eventName) return;
    eventName.value = selectedSheet.title;
    eventName.dispatchEvent(new Event('input', { bubbles: true }));
    eventName.dispatchEvent(new Event('change', { bubbles: true }));
    mappingUseTitle.textContent = 'Campaign name filled';
  });

  if (importSubtitle) {
    importSubtitle.textContent = 'Upload a spreadsheet or registration-form export. Worksheet, header row, Indonesian field names, and attendee counts can be detected automatically.';
  }

  if (mappingSummaryPill) {
    mappingSummaryPill.textContent = 'Custom column mapping';
  }

  window.ContactImporterMapping = {
    getMapping,
    loadWorkbook,
    refresh: refreshFromMapping,
    reset: resetMapping
  };
})();
