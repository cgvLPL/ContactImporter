(() => {
  if (window.__contactImporterTabsReady) return;
  window.__contactImporterTabsReady = true;

  const tabButtons = Array.from(document.querySelectorAll('.nav-button[data-target]'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
  const quickLinks = Array.from(document.querySelectorAll('[data-open-tab]'));
  const brandHome = document.getElementById('brandHome');

  const tabEyebrow = document.getElementById('tabEyebrow');
  const tabTitle = document.getElementById('tabTitle');
  const tabSubtitle = document.getElementById('tabSubtitle');

  const overviewCampaignName = document.getElementById('overviewCampaignName');
  const overviewCampaignMeta = document.getElementById('overviewCampaignMeta');
  const eventNameInput = document.getElementById('eventName');
  const sourceInput = document.getElementById('source');
  const categoryInput = document.getElementById('category');

  const tabCopy = {
    overviewSection: {
      eyebrow: 'Overview',
      title: 'Contact workspace',
      subtitle: 'Import, review, enrich, and export contacts without leaving the browser.'
    },
    importSection: {
      eyebrow: 'Import',
      title: 'Bring in your spreadsheet',
      subtitle: 'Upload a file, then choose exactly which columns contain the contact fields.'
    },
    contactsSection: {
      eyebrow: 'Contacts',
      title: 'Review valid contacts',
      subtitle: 'Inspect the contacts for the current or loaded campaign before export.'
    },
    campaignSection: {
      eyebrow: 'Campaign',
      title: 'Campaign workspace',
      subtitle: 'Set up a new campaign, review the current campaign, or open a synced campaign from history.'
    },
    backendSection: {
      eyebrow: 'Backend',
      title: 'Google Sheets sync',
      subtitle: 'Use the permanent managed Apps Script backend to save and reload campaign-related contacts.'
    },
    settingsSection: {
      eyebrow: 'Settings',
      title: 'Export controls',
      subtitle: 'Refresh the current preview, download the VCF, or reset the workspace.'
    }
  };

  function updateNavState(targetId) {
    tabButtons.forEach((button) => {
      const active = button.dataset.target === targetId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function updateHeading(targetId) {
    const copy = tabCopy[targetId] || tabCopy.overviewSection;
    if (tabEyebrow) tabEyebrow.textContent = copy.eyebrow;
    if (tabTitle) tabTitle.textContent = copy.title;
    if (tabSubtitle) tabSubtitle.textContent = copy.subtitle;
  }

  function activateTab(targetId, options = {}) {
    const panel = document.getElementById(targetId);
    if (!panel || !panel.classList.contains('tab-panel')) return;

    tabPanels.forEach((item) => {
      const active = item.id === targetId;
      item.hidden = !active;
      item.classList.toggle('active', active);
      item.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    updateNavState(targetId);
    updateHeading(targetId);

    if (options.focusTab) {
      const activeButton = tabButtons.find(button => button.dataset.target === targetId);
      if (activeButton) activeButton.focus({ preventScroll: true });
    }

    const shell = document.querySelector('.shell');
    if (shell && window.scrollY > shell.offsetTop + 80) {
      window.scrollTo({ top: Math.max(shell.offsetTop - 8, 0), behavior: 'auto' });
    }
  }

  window.goToSection = function(targetId) {
    activateTab(targetId);
  };

  window.setActiveNav = function(targetId) {
    const activePanel = document.getElementById(targetId);
    if (activePanel && activePanel.classList.contains('tab-panel') && !activePanel.hidden) {
      updateNavState(targetId);
    }
  };

  quickLinks.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.openTab));
  });

  if (brandHome) {
    brandHome.addEventListener('click', () => activateTab('overviewSection'), true);
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => activateTab(button.dataset.target));

    button.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();

      let nextIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabButtons.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabButtons.length - 1;

      const next = tabButtons[nextIndex];
      activateTab(next.dataset.target, { focusTab: true });
    });
  });

  function updateCampaignSummary() {
    const eventName = eventNameInput ? eventNameInput.value.trim() : '';
    const source = sourceInput ? sourceInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() : '';

    if (overviewCampaignName) {
      overviewCampaignName.textContent = eventName || 'Untitled campaign';
    }

    if (overviewCampaignMeta) {
      const meta = [source, category].filter(Boolean);
      overviewCampaignMeta.textContent = meta.length
        ? meta.join(' · ')
        : 'Set up a campaign to group contacts consistently in history and export.';
    }
  }

  [eventNameInput, sourceInput, categoryInput].filter(Boolean).forEach((input) => {
    input.addEventListener('input', updateCampaignSummary);
    input.addEventListener('change', updateCampaignSummary);
  });

  activateTab('overviewSection');
  updateCampaignSummary();

  if (window.lucide) lucide.createIcons();

  window.ContactImporterTabs = {
    open: activateTab,
    current: () => tabPanels.find(panel => !panel.hidden)?.id || 'overviewSection'
  };
})();
