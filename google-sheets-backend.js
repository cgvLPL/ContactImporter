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
            <p>ContactImporter is locked to its production Google Apps Script backend. Contacts are now stored with a campaign relationship so the same person can exist in multiple campaign histories without one campaign overwriting another.</p>
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
            <div class="backend-fixed-icon"><i data-lucide="history"></i></div>
            <div>
              <strong>Campaign history</strong>
              <span>Every sync is related to its campaign. A contact can therefore be saved separately for multiple campaigns.</span>
            </div>
          </div>
          <div class="backend-fixed-row">
            <div class="backend-fixed-icon"><i data-lucide="git-branch"></i></div>
            <div>
              <strong>AppSheet-ready relation</strong>
              <span>The Contacts table stores a campaign_id that relates each contact row to the Campaigns table.</span>
            </div>
          </div>
        </div>

        <div class="settings-actions backend-config-actions">
          <button class="glass-btn" id="backendTest" type="button"><i data-lucide="activity"></i>Test connection</button>
        </div>

        <div class="backend-security-note">
          <i data-lucide="shield-check"></i>
          <div><strong>Managed backend.</strong><span>Spreadsheet parsing remains local. Data is sent only when Sync current contacts is pressed.</span></div>
        </div>
      </div>

      <aside class="backend-sync-card glass">
        <div class="section-kicker">Backend status</div>
        <div class="backend-status-icon busy" id="backendStatusIcon"><i data-lucide="loader-circle"></i></div>
        <h3 id="backendStatusTitle">Checking backend…</h3>
        <p id="backendStatusCopy">ContactImporter is validating the permanent Google Sheets connection.</p>
        <div class="backend-status-badge busy" id="backendStatusBadge">Checking</div>

        <div class="backend-sync-actions">
          <button class="glass-btn primary" id="backendSync" type="button"><i data-lucide="cloud-upload"></i>Sync current campaign</button>
          <button class="glass-btn" id="backendLoad" type="button"><i data-lucide="cloud-download"></i>Load all contacts</button>
        </div>

        <div class="backend-sync-meta" id="backendSyncMeta">Permanent backend · campaign-aware manual sync</div>
      </aside>
    </div>
  `;

  const settingsPanel = document.getElementById('settingsSection');
  if (settingsPanel) tabStage.insertBefore(backendPanel, settingsPanel);
  else tabStage.appendChild(backendPanel);

  const campaignPanel = document.getElementById('campaignSection');
  let campaignHistoryCard = null;
  if (campaignPanel) {
    campaignHistoryCard = document.createElement('section');
    campaignHistoryCard.className = 'campaign-history-card glass';
    campaignHistoryCard.innerHTML = `
      <div class="campaign-history-head">
        <div>
          <div class="section-kicker">Synced campaigns</div>
          <h2>Campaign history</h2>
          <p>Contacts are separated by campaign in the backend. Select a campaign to load only the contacts related to it.</p>
        </div>
        <button class="glass-btn" id="campaignHistoryRefresh" type="button"><i data-lucide="refresh-cw"></i>Refresh history</button>
      </div>
      <div class="campaign-history-summary" id="campaignHistorySummary">Checking saved campaigns…</div>
      <div class="campaign-history-list" id="campaignHistoryList" aria-live="polite">
        <div class="campaign-history-empty">Campaign history will appear here after the backend is available.</div>
      </div>
    `;
    campaignPanel.appendChild(campaignHistoryCard);
  }

  const testButton = document.getElementById('backendTest');
  const syncButton = document.getElementById('backendSync');
  const loadButton = document.getElementById('backendLoad');
  const statusTitle = document.getElementById('backendStatusTitle');
  const statusCopy = document.getElementById('backendStatusCopy');
  const statusBadge = document.getElementById('backendStatusBadge');
  const statusIcon = document.getElementById('backendStatusIcon');
  const syncMeta = document.getElementById('backendSyncMeta');
  const historyRefreshButton = document.getElementById('campaignHistoryRefresh');
  const historySummary = document.getElementById('campaignHistorySummary');
  const historyList = document.getElementById('campaignHistoryList');

  function appVersion() {
    const meta = document.querySelector('meta[name="app-version"]');
    return meta ? String(meta.content || '') : 'local';
  }

  function legacyAccessKey() {
    try {
      return String(localStorage.getItem(LEGACY_STORAGE_KEY) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function getConnection() {
    return Object.freeze({ endpoint: FIXED_ENDPOINT, locked: true });
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
    [testButton, syncButton, loadButton, historyRefreshButton].filter(Boolean).forEach(button => {
      button.disabled = Boolean(busy);
    });
    backendPanel.classList.toggle('backend-busy', Boolean(busy));
    if (campaignHistoryCard) campaignHistoryCard.classList.toggle('backend-busy', Boolean(busy));
  }

  async function postAction(action, payload = {}) {
    const body = { action, clientVersion: appVersion(), ...payload };
    const legacyKey = legacyAccessKey();
    if (legacyKey) body.accessKey = legacyKey;

    const response = await fetch(FIXED_ENDPOINT, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Backend request failed with HTTP ${response.status}.`);

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('The Apps Script response was not JSON. Confirm the deployment is an active Web App using the production /exec URL.');
    }

    if (!result || result.ok !== true) throw new Error((result && result.error) || 'The backend returned an error.');
    return result;
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

  function formatHistoryDate(value) {
    if (!value) return 'No sync time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function escapeHistoryHTML(value) {
    if (typeof escapeHTML === 'function') return escapeHTML(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function aggregateCampaignsFromContacts(rows) {
    const groups = new Map();
    rows.forEach(row => {
      const name = String(row.event || '').trim() || 'Unassigned';
      const id = String(row.campaignId || '').trim() || `legacy:${name.toLocaleLowerCase()}`;
      if (!groups.has(id)) {
        groups.set(id, {
          campaignId: id,
          name,
          source: row.source || '',
          category: row.category || '',
          batchNote: row.batchNote || '',
          nameFormat: row.nameFormat || 'name',
          contactCount: 0,
          createdAt: row.createdAt || '',
          updatedAt: row.updatedAt || '',
          lastSyncedAt: row.lastSyncedAt || '',
          legacy: true,
        });
      }
      const group = groups.get(id);
      group.contactCount += 1;
      if (String(row.lastSyncedAt || '') > String(group.lastSyncedAt || '')) group.lastSyncedAt = row.lastSyncedAt;
    });
    return Array.from(groups.values()).sort((a, b) => String(b.lastSyncedAt || '').localeCompare(String(a.lastSyncedAt || '')));
  }

  function renderCampaignHistory(campaigns) {
    if (!historyList || !historySummary) return;
    const items = Array.isArray(campaigns) ? campaigns : [];
    const totalContacts = items.reduce((sum, campaign) => sum + Number(campaign.contactCount || 0), 0);
    historySummary.textContent = `${items.length} campaign${items.length === 1 ? '' : 's'} · ${totalContacts} saved contact record${totalContacts === 1 ? '' : 's'}`;

    if (!items.length) {
      historyList.innerHTML = '<div class="campaign-history-empty">No synced campaigns yet. Add an Event / Campaign Name, import contacts, then sync the current campaign.</div>';
      return;
    }

    historyList.innerHTML = items.map(campaign => {
      const meta = [campaign.source, campaign.category].filter(Boolean).join(' · ') || 'No source or category';
      return `
        <article class="campaign-history-item">
          <div class="campaign-history-icon"><i data-lucide="megaphone"></i></div>
          <div class="campaign-history-main">
            <div class="campaign-history-name">${escapeHistoryHTML(campaign.name || 'Unassigned')}</div>
            <div class="campaign-history-meta">${escapeHistoryHTML(meta)}</div>
            <div class="campaign-history-time">Last synced ${escapeHistoryHTML(formatHistoryDate(campaign.lastSyncedAt || campaign.updatedAt))}</div>
          </div>
          <div class="campaign-history-count"><strong>${Number(campaign.contactCount || 0)}</strong><span>contacts</span></div>
          <button class="glass-btn campaign-history-load" type="button"
            data-campaign-id="${escapeHistoryHTML(campaign.campaignId || '')}"
            data-campaign-name="${escapeHistoryHTML(campaign.name || 'Unassigned')}">
            <i data-lucide="folder-open"></i>Open
          </button>
        </article>
      `;
    }).join('');

    historyList.querySelectorAll('.campaign-history-load').forEach(button => {
      button.addEventListener('click', () => {
        loadFromGoogleSheet({
          campaignId: button.dataset.campaignId || '',
          campaignName: button.dataset.campaignName || '',
          openContacts: true,
        });
      });
    });

    if (window.lucide) lucide.createIcons();
  }

  async function refreshCampaignHistory(options = {}) {
    const quiet = Boolean(options.quiet);
    if (historySummary) historySummary.textContent = 'Refreshing campaign history…';
    if (historyRefreshButton) historyRefreshButton.disabled = true;

    try {
      let campaigns;
      try {
        const result = await postAction('listCampaigns');
        campaigns = Array.isArray(result.campaigns) ? result.campaigns : [];
      } catch (error) {
        // Backward-compatible fallback while the new Apps Script release has
        // not yet been deployed. It can display old data but cannot recover
        // campaigns that the legacy phone/e-mail upsert already overwrote.
        const result = await postAction('listContacts', { limit: 5000 });
        campaigns = aggregateCampaignsFromContacts(Array.isArray(result.contacts) ? result.contacts : []);
        if (!quiet) console.warn('Using legacy campaign-history fallback:', error);
      }
      renderCampaignHistory(campaigns);
      return campaigns;
    } catch (error) {
      console.error('Campaign history load failed:', error);
      if (historySummary) historySummary.textContent = 'Campaign history unavailable';
      if (historyList) historyList.innerHTML = `<div class="campaign-history-empty">${escapeHistoryHTML(error.message || String(error))}</div>`;
      return [];
    } finally {
      if (historyRefreshButton) historyRefreshButton.disabled = false;
    }
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
      const campaignAware = String(result.version || '').includes('campaign-history');
      setBackendStatus(
        'success',
        'Google Sheets connected',
        campaignAware
          ? `${result.spreadsheetName || 'Google Sheet'} · campaign history enabled · backend ${result.version || ''}`.trim()
          : `${result.spreadsheetName || 'Google Sheet'} · connected, but Apps Script still needs the campaign-history update.`.trim(),
        campaignAware ? 'Connected' : 'Update backend'
      );
      syncMeta.textContent = `Permanent backend · last checked ${new Date().toLocaleTimeString()}`;
      refreshCampaignHistory({ quiet: true });
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

  async function syncCurrentContacts() {
    if (!Array.isArray(contacts) || !contacts.length) {
      setBackendStatus('error', 'Nothing to sync', 'Import or load at least one valid contact first.', 'No contacts');
      return;
    }

    setButtonsBusy(true);
    const settings = currentMarketingSettings();
    const outgoing = contacts.map(contact => backendContact(contact, settings));
    const campaignLabel = settings.event || 'Unassigned';
    let inserted = 0;
    let updated = 0;
    let accepted = 0;
    const requestId = makeRequestId();

    try {
      for (let start = 0; start < outgoing.length; start += MAX_CLIENT_BATCH) {
        const chunk = outgoing.slice(start, start + MAX_CLIENT_BATCH);
        const end = Math.min(start + chunk.length, outgoing.length);
        setBackendStatus('busy', `Syncing ${end} of ${outgoing.length}…`, `Saving contacts under “${campaignLabel}”.`, 'Syncing');
        const result = await postAction('upsertContacts', {
          contacts: chunk,
          requestId: `${requestId}-${Math.floor(start / MAX_CLIENT_BATCH) + 1}`,
        });
        inserted += Number(result.inserted || 0);
        updated += Number(result.updated || 0);
        accepted += Number(result.accepted || 0);
      }

      setBackendStatus('success', 'Campaign synced', `${accepted} contact${accepted === 1 ? '' : 's'} saved under “${campaignLabel}” · ${inserted} new · ${updated} updated.`, 'Synced');
      syncMeta.textContent = `Last sync ${new Date().toLocaleString()} · ${campaignLabel} · ${accepted} contacts`;
      if (typeof setStatus === 'function') setStatus(`${campaignLabel}: ${accepted} contacts synced`, 'success');
      await refreshCampaignHistory({ quiet: true });
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

  function restoreSharedCampaignSettings(items, preferredName = '') {
    const event = preferredName && preferredName !== 'Unassigned' ? preferredName : uniqueSharedValue(items, 'event');
    const source = uniqueSharedValue(items, 'source');
    const category = uniqueSharedValue(items, 'category');
    const batchNote = uniqueSharedValue(items, 'batchNote');
    const nameFormat = uniqueSharedValue(items, 'nameFormat');

    if (eventNameInput) eventNameInput.value = event || '';
    if (sourceInput) sourceInput.value = source || '';
    if (categoryInput) categoryInput.value = category || '';
    if (noteInput) noteInput.value = batchNote || '';
    if (nameFormat && nameFormatInput && Array.from(nameFormatInput.options).some(option => option.value === nameFormat)) {
      nameFormatInput.value = nameFormat;
    }
  }

  async function loadFromGoogleSheet(options = {}) {
    const campaignId = String(options.campaignId || '').trim();
    const campaignName = String(options.campaignName || '').trim();
    const selectedCampaign = Boolean(campaignId || campaignName);

    setButtonsBusy(true);
    setBackendStatus(
      'busy',
      selectedCampaign ? `Loading ${campaignName || 'campaign'}…` : 'Loading contacts…',
      selectedCampaign ? 'Reading only contacts related to this campaign.' : 'Reading all saved contacts from the permanent Google Sheet.',
      'Loading'
    );

    try {
      const payload = { limit: 5000 };
      if (campaignId && !campaignId.startsWith('legacy:')) payload.campaignId = campaignId;
      else if (campaignName && campaignName !== 'Unassigned') payload.campaign = campaignName;

      const result = await postAction('listContacts', payload);
      let rows = Array.isArray(result.contacts) ? result.contacts : [];

      // Older Apps Script versions ignore campaign filters. Filter again in the
      // browser so the UI still opens a single campaign when possible.
      if (selectedCampaign && campaignName) {
        const normalizedName = campaignName.trim().toLocaleLowerCase();
        rows = rows.filter(row => {
          const rowName = String(row.event || '').trim() || 'Unassigned';
          return rowName.toLocaleLowerCase() === normalizedName;
        });
      }

      const loaded = rows
        .map(row => ({
          fullName: typeof normalizeIndonesianName === 'function' ? normalizeIndonesianName(row.fullName) : String(row.fullName || '').trim(),
          phone: typeof cleanPhone === 'function' ? cleanPhone(row.phone) : String(row.phone || '').trim(),
          email: typeof cleanValue === 'function' ? cleanValue(row.email) : String(row.email || '').trim(),
          notes: typeof cleanValue === 'function' ? cleanValue(row.notes) : String(row.notes || '').trim(),
          campaignId: row.campaignId || campaignId || '',
        }))
        .filter(contact => contact.fullName && (contact.phone || contact.email));

      contacts = loaded;
      skippedRows = 0;
      restoreSharedCampaignSettings(rows, campaignName);

      if (typeof updateStats === 'function') updateStats();
      if (typeof updateDownloadState === 'function') updateDownloadState();
      if (typeof updateLiveUI === 'function') updateLiveUI();
      if (typeof renderPreview === 'function') renderPreview();

      const label = selectedCampaign ? campaignName || 'Selected campaign' : 'Google Sheet';
      if (typeof setStatus === 'function') setStatus(`${loaded.length} contacts loaded from ${label}`, 'success');
      setBackendStatus('success', selectedCampaign ? 'Campaign loaded' : 'Contacts loaded', `${loaded.length} valid contact${loaded.length === 1 ? '' : 's'} loaded${selectedCampaign ? ` from “${campaignName}”` : ''}.`, 'Loaded');
      syncMeta.textContent = `Last load ${new Date().toLocaleString()} · ${selectedCampaign ? campaignName : 'all campaigns'} · ${loaded.length} contacts`;

      if (options.openContacts !== false && window.ContactImporterTabs && typeof window.ContactImporterTabs.open === 'function') {
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
  loadButton.addEventListener('click', () => loadFromGoogleSheet({ openContacts: true }));
  if (historyRefreshButton) historyRefreshButton.addEventListener('click', () => refreshCampaignHistory({ quiet: false }));

  if (window.lucide) lucide.createIcons();

  window.ContactImporterBackend = Object.freeze({
    test: testConnection,
    sync: syncCurrentContacts,
    load: loadFromGoogleSheet,
    loadCampaign: (campaignId, campaignName) => loadFromGoogleSheet({ campaignId, campaignName, openContacts: true }),
    campaigns: refreshCampaignHistory,
    getConnection,
  });

  window.setTimeout(() => testConnection({ quiet: true }), 650);
})();