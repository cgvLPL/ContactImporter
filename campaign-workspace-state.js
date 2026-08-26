(() => {
  if (window.__contactImporterCampaignWorkspaceState) return;
  window.__contactImporterCampaignWorkspaceState = true;

  const campaignPanel = document.getElementById('campaignSection');
  const actions = campaignPanel && campaignPanel.querySelector('.campaign-setup-actions');
  if (!campaignPanel || !actions) return;

  const newCampaignButton = document.createElement('button');
  newCampaignButton.type = 'button';
  newCampaignButton.id = 'newCampaignBtn';
  newCampaignButton.className = 'glass-btn campaign-new-btn';
  newCampaignButton.innerHTML = '<i data-lucide="plus"></i>New campaign';
  actions.insertBefore(newCampaignButton, actions.firstChild);

  const keepNote = document.createElement('div');
  keepNote.className = 'campaign-new-note';
  keepNote.innerHTML = '<i data-lucide="archive"></i><span>Starting a new campaign saves the current campaign first, then clears the local contact workspace. Previously synced campaigns stay available in Campaign History.</span>';
  actions.insertAdjacentElement('afterend', keepNote);

  function dispatchCampaignFieldEvents() {
    [eventNameInput, nameFormatInput, sourceInput, categoryInput, noteInput]
      .filter(Boolean)
      .forEach(input => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
  }

  function clearLocalCampaignWorkspace() {
    contacts = [];
    skippedRows = 0;

    if (excelFile) excelFile.value = '';
    if (fileChip) {
      fileChip.style.display = 'none';
      fileChip.textContent = '';
    }

    if (eventNameInput) eventNameInput.value = '';
    if (nameFormatInput) nameFormatInput.value = 'name';
    if (sourceInput) sourceInput.value = '';
    if (categoryInput) categoryInput.value = '';
    if (noteInput) noteInput.value = '';

    if (window.ContactImporterMapping && typeof window.ContactImporterMapping.reset === 'function') {
      window.ContactImporterMapping.reset();
    }

    if (typeof updateStats === 'function') updateStats();
    if (typeof updateDownloadState === 'function') updateDownloadState();
    if (typeof updateLiveUI === 'function') updateLiveUI();
    if (typeof clearPreview === 'function') {
      clearPreview('This is a new campaign workspace. Import a spreadsheet to add contacts. Previous campaigns remain available in Campaign History.');
    }
    if (typeof setStatus === 'function') setStatus('New campaign ready', 'success');

    dispatchCampaignFieldEvents();

    const campaignSelect = document.getElementById('campaignHistorySelect');
    const campaignSelectMeta = document.getElementById('campaignHistorySelectMeta');
    if (campaignSelect) {
      campaignSelect.value = '';
      campaignSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (campaignSelectMeta) {
      campaignSelectMeta.textContent = 'New campaign workspace · previous campaigns remain saved below.';
    }

    if (window.ContactImporterTabs && typeof window.ContactImporterTabs.open === 'function') {
      window.ContactImporterTabs.open('campaignSection');
    }

    window.setTimeout(() => {
      if (eventNameInput) eventNameInput.focus({ preventScroll: true });
    }, 0);
  }

  async function savePreviousCampaignIfNeeded() {
    if (!Array.isArray(contacts) || !contacts.length) return true;

    if (!window.ContactImporterBackend || typeof window.ContactImporterBackend.sync !== 'function') {
      if (typeof setStatus === 'function') setStatus('Could not preserve current campaign — backend unavailable', 'error');
      return false;
    }

    // The spreadsheet mapper historically used `note` while the backend uses
    // `notes`. Mirror it before saving so per-contact notes are not lost.
    contacts.forEach(contact => {
      if (contact && contact.note && !contact.notes) contact.notes = contact.note;
    });

    const originalLabel = newCampaignButton.innerHTML;
    newCampaignButton.disabled = true;
    newCampaignButton.innerHTML = '<i data-lucide="loader-circle"></i>Saving previous campaign…';
    newCampaignButton.classList.add('busy');
    if (window.lucide) lucide.createIcons();

    try {
      await window.ContactImporterBackend.sync();
      const backendBadge = document.getElementById('backendStatusBadge');
      const synced = backendBadge && backendBadge.textContent.trim().toLocaleLowerCase() === 'synced';

      if (!synced) {
        if (typeof setStatus === 'function') setStatus('Previous campaign was not saved. New campaign was not started.', 'error');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Could not preserve previous campaign before starting new:', error);
      if (typeof setStatus === 'function') setStatus('Previous campaign was not saved. New campaign was not started.', 'error');
      return false;
    } finally {
      newCampaignButton.disabled = false;
      newCampaignButton.innerHTML = originalLabel;
      newCampaignButton.classList.remove('busy');
      if (window.lucide) lucide.createIcons();
    }
  }

  newCampaignButton.addEventListener('click', async () => {
    const preserved = await savePreviousCampaignIfNeeded();
    if (!preserved) return;
    clearLocalCampaignWorkspace();
  });

  if (window.lucide) lucide.createIcons();
})();
