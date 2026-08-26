(() => {
  if (window.__contactImporterCampaignSelector) return;
  window.__contactImporterCampaignSelector = true;

  const historyList = document.getElementById('campaignHistoryList');
  const historyCard = document.querySelector('.campaign-history-card');
  if (!historyList || !historyCard) return;

  const picker = document.createElement('div');
  picker.className = 'campaign-history-picker';
  picker.innerHTML = `
    <div class="campaign-history-picker-field">
      <label for="campaignHistorySelect">Select campaign</label>
      <select id="campaignHistorySelect" aria-label="Select a synced campaign">
        <option value="">Choose a campaign…</option>
        <option value="__all__">All campaigns</option>
      </select>
      <span id="campaignHistorySelectMeta">Choose a saved campaign or use the cards below.</span>
    </div>
    <button class="glass-btn primary campaign-history-picker-open" id="campaignHistoryOpenSelected" type="button" disabled>
      <i data-lucide="folder-open"></i>
      Open selected
    </button>
  `;

  const summary = document.getElementById('campaignHistorySummary');
  if (summary) historyCard.insertBefore(picker, summary);
  else historyCard.insertBefore(picker, historyList);

  const select = document.getElementById('campaignHistorySelect');
  const openButton = document.getElementById('campaignHistoryOpenSelected');
  const selectMeta = document.getElementById('campaignHistorySelectMeta');

  function cardCampaigns() {
    return Array.from(historyList.querySelectorAll('.campaign-history-load')).map(button => {
      const item = button.closest('.campaign-history-item');
      const count = item ? item.querySelector('.campaign-history-count strong')?.textContent?.trim() : '';
      const meta = item ? item.querySelector('.campaign-history-meta')?.textContent?.trim() : '';
      return {
        id: button.dataset.campaignId || '',
        name: button.dataset.campaignName || 'Unassigned',
        count: Number(count || 0),
        meta: meta || '',
      };
    });
  }

  function syncDropdownFromCards() {
    if (!select) return;
    const current = select.value;
    const campaigns = cardCampaigns();

    select.innerHTML = `
      <option value="">Choose a campaign…</option>
      <option value="__all__">All campaigns</option>
      ${campaigns.map(campaign => {
        const label = `${campaign.name} — ${campaign.count} contact${campaign.count === 1 ? '' : 's'}`;
        return `<option value="${escapeOption(campaign.id)}" data-name="${escapeOption(campaign.name)}" data-count="${campaign.count}">${escapeOption(label)}</option>`;
      }).join('')}
    `;

    if (current && Array.from(select.options).some(option => option.value === current)) {
      select.value = current;
    }

    updatePickerState();
  }

  function escapeOption(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updatePickerState() {
    if (!select || !openButton || !selectMeta) return;
    const option = select.options[select.selectedIndex];
    const hasSelection = Boolean(select.value);
    openButton.disabled = !hasSelection;

    if (!hasSelection) {
      selectMeta.textContent = 'Choose a saved campaign or use the cards below.';
      return;
    }

    if (select.value === '__all__') {
      const total = cardCampaigns().reduce((sum, campaign) => sum + campaign.count, 0);
      selectMeta.textContent = `Load all saved campaigns · ${total} contact record${total === 1 ? '' : 's'}`;
      return;
    }

    const count = Number(option?.dataset.count || 0);
    selectMeta.textContent = `${option?.dataset.name || option?.textContent || 'Selected campaign'} · ${count} contact${count === 1 ? '' : 's'}`;
  }

  async function openSelected() {
    if (!select || !select.value || !window.ContactImporterBackend) return;

    openButton.disabled = true;
    try {
      if (select.value === '__all__') {
        await window.ContactImporterBackend.load({ openContacts: true });
        return;
      }

      const option = select.options[select.selectedIndex];
      const name = option?.dataset.name || option?.textContent || 'Selected campaign';
      await window.ContactImporterBackend.loadCampaign(select.value, name);
    } finally {
      updatePickerState();
    }
  }

  select.addEventListener('change', updatePickerState);
  openButton.addEventListener('click', openSelected);
  select.addEventListener('keydown', event => {
    if (event.key === 'Enter' && select.value) {
      event.preventDefault();
      openSelected();
    }
  });

  const observer = new MutationObserver(syncDropdownFromCards);
  observer.observe(historyList, { childList: true, subtree: true });

  syncDropdownFromCards();
  if (window.lucide) lucide.createIcons();
})();
