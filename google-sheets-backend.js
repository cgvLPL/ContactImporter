(() => {
  if (window.__contactImporterSheetsBackend) return;
  window.__contactImporterSheetsBackend = true;

  const FIXED_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyLKEpsopYNkJlMf_65tfOyyPwTeOXUnl-Juk7gXX4R9nSOj4PmGpdT3ILL0cO-v_5fsw/exec';
  const LEGACY_STORAGE_KEY = 'contactImporter.googleSheets.accessKey';
  const MAX_CLIENT_BATCH = 200;

  const tabStage = document.querySelector('.tab-stage');
  const nav = document.querySelector('.nav');
  if (!tabStage || !nav) return;

  const settingsButton = nav.querySelector('[data-target="settingsSection"]');
  const backendButton = document.createElement('button');
  backendButton.type = 'button';
  backendButton.className = 'nav-item nav-button';
  backendButton.dataset.target = 'backendSection';
  backendButton.setAttribute('role', 'tab');
  backendButton.setAttribute('aria-controls', 'backendSection');
  backendButton.setAttribute('aria-selected', 'false');
  backendButton.innerHTML = '<i data-lucide="database"></i><span>Backend</span>';

  if (settingsButton) nav.insertBefore(backendButton, settingsButton);
  else nav.appendChild(backendButton);

  const backendPanel = document.createElement('section');
  backendPanel.className = 'tab-panel';
  backendPanel.id = 'backendSection';
  backendPanel.setAttribute('role', 'tabpanel');
  backendPanel.setAttribute('aria-label', 'Google Sheets Backend');
  backendPanel.hidden = true;
  backendPanel.innerHTML = `
    <div class="backend-layout">
      <div class="backend-config-card glass">
        <div class="settings-heading backend-heading">
          <div>
            <div class="section-kicker">Google Sheets backend</div>
            <h2>Permanent managed connection</h2>
            <p>ContactImporter is locked to its production Google Apps Script backend. Users cannot replace, disconnect, or edit the backend from this application.</p>
          </div>
          <div class="settings-icon"><i data-lucide="database"></i></div>
        </div>

        <div class="backend-fixed-summary">
          <div class="backend-fixed-row">
            <div class="backend-fixed-icon"><i data-lucide="lock-keyhole"></i></div>
            <div>
              <strong>Backend locked</strong>
              <span>The production endpoint is built into ContactImporter and is not exposed as an editable setting.</span>
            </div>
          </div>
          <div class="backend-fixed-row">
            <div class="backend-fixed-icon"><i data-lucide="sheet"></i></div>
            <div>
              <strong>Google Sheets storage</strong>
              <span>Validated contacts can be synchronized to the Google Sheet connected to the deployed Apps Script project.</span>
            </div>
          </div>
          <div class="backend-fixed-row">
            <div class="backend-fixed-icon"><i data-lucide="mouse-pointer-click"></i></div>
            <div>
              <strong>Manual data transfer</strong>
              <span>Spreadsheet parsing remains local. Contact data is sent only when Sync current contacts is pressed.</span>
            </div>
          </div>
        </div>

        <div class="settings-actions backend-config-actions">
          <button class="glass-btn" id="backendTest" type="button"><i data-lucide="activity"></i>Test connection</button>
        </div>

        <div class="backend-security-note">
          <i data-lucide="shield-check"></i>
          <div><strong>Managed backend.</strong><span>The endpoint cannot be changed through the ContactImporter interface. Changing it requires a new application deployment from the repository.</span></div>
        </div>
      </div>

      <aside class="backend-sync-card glass">
        <div class="section-kicker">Backend status</div>
        <div class="backend-status-icon busy" id="backendStatusIcon"><i data-lucide="loader-circle"></i></div>
        <h3 id="backendStatusTitle">Checking backend…</h3>
        <p id="backendStatusCopy">ContactImporter is validating the permanent Google Sheets connection.</p>
        <div class="backend-status-badge busy" id="backendStatusBadge">Checking</div>

        <div class="backend-sync-actions">
          <button class="glass-btn primary" id="backendSync" type="button"><i data-lucide="cloud-upload"></i>Sync current contacts</button>
          <button class="glass-btn" id="backendLoad" type="button"><i data-lucide="cloud-download"></i>Load from Google Sheet</button>
        </div>

        <div class="backend-sync-meta" id="backendSyncMeta">Permanent backend · manual sync</div>
      </aside>
    </div>
  `;

  const settingsPanel = document.getElementById('settingsSection');
  if (settingsPanel) tabStage.insertBefore(backendPanel, settingsPanel);
  else tabStage.appendChild(backendPanel);

  const testButton = document.getElementById('backendTest');
  const syncButton = document.getElementById('backendSync');
  const loadButton = document.getElementById('backendLoad');
  const statusTitle = document.getElementById('backendStatusTitle');
  const statusCopy = document.getElementById('backendStatusCopy');
  const statusBadge = document.getElementById('backendStatusBadge');
  const statusIcon = document.getElementById('backendStatusIcon');
  const syncMeta = document.getElementById('backendSyncMeta');

  const sidebarPrivacy = document.querySelector('.sidebar-card p');
  if (sidebarPrivacy) {
    sidebarPrivacy.textContent = 'Your spreadsheet stays in this browser unless you explicitly sync validated contacts to the permanent Google Sheets backend.';
  }

  function appVersion() {
    const meta = document.querySelector('meta[name="app-version"]');
    return meta ? String(meta.content || '') : 'local';
  }

  function legacyAccessKey() {
    // Backward compatibility only for browsers that were configured before the
    // backend became permanent. There is intentionally no UI for changing it.
    try {
      return String(localStorage.getItem(LEGACY_STORAGE_KEY) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function getConnection() {
    return Object.freeze({
      endpoint: FIXED_ENDPOINT,
      locked: true,
    });
  }

  function setBackendStatus(state, title, copy, badge) {
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
    statusBadge.textContent = badge;
    statusBadge.className = `backend-status-badge ${state || ''}`.trim();
    statusIcon.className = `backend-status-icon ${state || ''}`.trim();

    const icon = state === 'success' ? 'cloud-check' : state === 'busy' ? 'loader-circle' : state === 'error' ? 'cloud-alert' : 'cloud';
    statusIcon.innerHTML = `<i data-lucide="${icon}"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  function setButtonsBusy(busy) {
    [testButton, syncButton, loadButton].forEach(button => {
      if (button) button.disabled = Boolean(busy);
    });
    backendPanel.classList.toggle('backend-busy', Boolean(busy));
  }

  async function postAction(action, payload = {}) {
    const body = {
      action,
      clientVersion: appVersion(),
      ...payload,
    };

    const legacyKey = legacyAccessKey();
    if (legacyKey) body.accessKey = legacyKey;

    const response = await fetch(FIXED_ENDPOINT, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Backend request failed with HTTP ${response.status}.`);

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('The Apps Script response was not JSON. Confirm the deployment is an active Web App using the production /exec URL.');
    }

    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || 'The backend returned an error.');
    }
    return result;
  }

  async function testConnection(options = {}) {
    const quiet = Boolean(options.quiet);
    setButtonsBusy(true);
    setBackendStatus('busy', 'Checking backend…', 'Contacting the permanent Google Apps Script deployment.', 'Checking');

    try {
      const result = await postAction('health');
      if (result.authRequired && !result.authenticated) {
        throw new Error('The deployed Apps Script is still using the legacy access-key backend. Update it to the permanent backend release or retain the previously configured browser credential.');
      }
      setBackendStatus('success', 'Google Sheets connected', `${result.spreadsheetName || 'Google Sheet'} · ${result.contactsSheet || 'Contacts'} · backend ${result.version || ''}`.trim(), 'Connected');
      syncMeta.textContent = `Permanent backend · last checked ${new Date().toLocaleTimeString()}`;
      return true;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      setBackendStatus('error', 'Backend unavailable', error.message || String(error), 'Error');
      if (!quiet && typeof setStatus === 'function') setStatus('Google Sheets backend unavailable', 'error');
      return false;
    } finally {
      setButtonsBusy(false);
    }
  }

  function currentMarketingSettings() {
    if (typeof getMarketingSettings === 'function') return getMarketingSettings();
    return {
      event: eventNameInput ? eventNameInput.value.trim() : '',
      nameFormat: nameFormatInput ? nameFormatInput.value : 'name',
      source: sourceInput ? sourceInput.value.trim() : '',
      category: categoryInput ? categoryInput.value.trim() : '',
      note: noteInput ? noteInput.value.trim() : '',
    };
  }

  function backendContact(contact, settings) {
    const savedName = typeof buildContactName === 'function'
      ? buildContactName(contact.fullName, settings.event, settings.nameFormat)
      : contact.fullName;

    return {
      fullName: contact.fullName || '',
      savedName,
      phone: contact.phone || '',
      email: contact.email || '',
      notes: contact.notes || '',
      event: settings.event || '',
      source: settings.source || '',
      category: settings.category || '',
      batchNote: settings.note || '',
      nameFormat: settings.nameFormat || 'name',
    };
  }

  function makeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `ci-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function syncCurrentContacts() {
    if (!Array.isArray(contacts) || !contacts.length) {
      setBackendStatus('error', 'Nothing to sync', 'Import or load at least one valid contact first.', 'No contacts');
      return;
    }

    setButtonsBusy(true);
    const settings = currentMarketingSettings();
    const outgoing = contacts.map(contact => backendContact(contact, settings));
    let inserted = 0;
    let updated = 0;
    let accepted = 0;
    const requestId = makeRequestId();

    try {
      for (let start = 0; start < outgoing.length; start += MAX_CLIENT_BATCH) {
        const chunk = outgoing.slice(start, start + MAX_CLIENT_BATCH);
        const end = Math.min(start + chunk.length, outgoing.length);
        setBackendStatus('busy', `Syncing ${end} of ${outgoing.length}…`, 'Writing validated contacts to the permanent Google Sheet.', 'Syncing');
        const result = await postAction('upsertContacts', {
          contacts: chunk,
          requestId: `${requestId}-${Math.floor(start / MAX_CLIENT_BATCH) + 1}`,
        });
        inserted += Number(result.inserted || 0);
        updated += Number(result.updated || 0);
        accepted += Number(result.accepted || 0);
      }

      setBackendStatus('success', 'Contacts synced', `${accepted} contact${accepted === 1 ? '' : 's'} saved · ${inserted} new · ${updated} updated.`, 'Synced');
      syncMeta.textContent = `Permanent backend · last sync ${new Date().toLocaleString()} · ${accepted} contacts`;
      if (typeof setStatus === 'function') setStatus(`${accepted} contacts synced to Google Sheets`, 'success');
    } catch (error) {
      console.error('Google Sheets sync failed:', error);
      setBackendStatus('error', 'Sync failed', error.message || String(error), 'Error');
      if (typeof setStatus === 'function') setStatus('Google Sheets sync failed', 'error');
    } finally {
      setButtonsBusy(false);
    }
  }

  function uniqueSharedValue(items, key) {
    const values = Array.from(new Set(items.map(item => String(item[key] || '').trim()).filter(Boolean)));
    return values.length === 1 ? values[0] : '';
  }

  function restoreSharedCampaignSettings(items) {
    const event = uniqueSharedValue(items, 'event');
    const source = uniqueSharedValue(items, 'source');
    const category = uniqueSharedValue(items, 'category');
    const batchNote = uniqueSharedValue(items, 'batchNote');
    const nameFormat = uniqueSharedValue(items, 'nameFormat');

    if (event && eventNameInput) eventNameInput.value = event;
    if (source && sourceInput) sourceInput.value = source;
    if (category && categoryInput) categoryInput.value = category;
    if (batchNote && noteInput) noteInput.value = batchNote;
    if (nameFormat && nameFormatInput && Array.from(nameFormatInput.options).some(option => option.value === nameFormat)) {
      nameFormatInput.value = nameFormat;
    }
  }

  async function loadFromGoogleSheet() {
    setButtonsBusy(true);
    setBackendStatus('busy', 'Loading contacts…', 'Reading saved contacts from the permanent Google Sheet.', 'Loading');

    try {
      const result = await postAction('listContacts', { limit: 5000 });
      const rows = Array.isArray(result.contacts) ? result.contacts : [];
      const loaded = rows
        .map(row => ({
          fullName: typeof normalizeIndonesianName === 'function' ? normalizeIndonesianName(row.fullName) : String(row.fullName || '').trim(),
          phone: typeof cleanPhone === 'function' ? cleanPhone(row.phone) : String(row.phone || '').trim(),
          email: typeof cleanValue === 'function' ? cleanValue(row.email) : String(row.email || '').trim(),
          notes: typeof cleanValue === 'function' ? cleanValue(row.notes) : String(row.notes || '').trim(),
        }))
        .filter(contact => contact.fullName && (contact.phone || contact.email));

      contacts = loaded;
      skippedRows = 0;
      restoreSharedCampaignSettings(rows);

      if (typeof updateStats === 'function') updateStats();
      if (typeof updateDownloadState === 'function') updateDownloadState();
      if (typeof updateLiveUI === 'function') updateLiveUI();
      if (typeof renderPreview === 'function') renderPreview();
      if (typeof setStatus === 'function') setStatus(`${loaded.length} contacts loaded from Google Sheet`, 'success');

      setBackendStatus('success', 'Contacts loaded', `${loaded.length} valid contact${loaded.length === 1 ? '' : 's'} loaded into the current workspace.`, 'Loaded');
      syncMeta.textContent = `Permanent backend · last load ${new Date().toLocaleString()} · ${loaded.length} contacts`;

      if (window.ContactImporterTabs && typeof window.ContactImporterTabs.open === 'function') {
        window.ContactImporterTabs.open('contactsSection');
      }
    } catch (error) {
      console.error('Google Sheets load failed:', error);
      setBackendStatus('error', 'Load failed', error.message || String(error), 'Error');
      if (typeof setStatus === 'function') setStatus('Could not load Google Sheets contacts', 'error');
    } finally {
      setButtonsBusy(false);
    }
  }

  testButton.addEventListener('click', () => testConnection({ quiet: false }));
  syncButton.addEventListener('click', syncCurrentContacts);
  loadButton.addEventListener('click', loadFromGoogleSheet);

  if (window.lucide) lucide.createIcons();

  window.ContactImporterBackend = Object.freeze({
    test: testConnection,
    sync: syncCurrentContacts,
    load: loadFromGoogleSheet,
    getConnection,
  });

  window.setTimeout(() => testConnection({ quiet: true }), 650);
})();