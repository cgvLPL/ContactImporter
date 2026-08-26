(() => {
  if (window.__contactImporterTabsReady) return;
  window.__contactImporterTabsReady = true;

  const tabButtons = Array.from(document.querySelectorAll('.nav-button[data-target]'));
  const mobileTabButtons = Array.from(document.querySelectorAll('.mobile-workflow-tab[data-target]'));
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
      title: 'Campaign contact workspace',
      subtitle: 'Follow one clear workflow: campaign, import, review, export, then sync when needed.'
    },
    campaignSection: {
      eyebrow: 'Campaigns · Step 1',
      title: 'Campaign workspace',
      subtitle: 'Create a new campaign, reopen previous campaign history, or continue the latest synced campaign.'
    },
    importSection: {
      eyebrow: 'Import · Step 2',
      title: 'Import campaign contacts',
      subtitle: 'Upload a spreadsheet, then map exactly which columns contain Name, Phone, E-mail, and Notes.'
    },
    contactsSection: {
      eyebrow: 'Contacts · Step 3',
      title: 'Review campaign contacts',
      subtitle: 'Inspect the valid contacts attached to the active campaign before exporting or syncing.'
    },
    settingsSection: {
      eyebrow: 'Export · Step 4',
      title: 'Export campaign contacts',
      subtitle: 'Refresh the preview, download the current campaign as a VCF, or reset the active workspace.'
    },
    backendSection: {
      eyebrow: 'System',
      title: 'Google Sheets backend',
      subtitle: 'Sync the active campaign or load campaign history from the permanent managed backend.'
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

    mobileTabButtons.forEach((button) => {
      const active = button.dataset.target === targetId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
      if (!active) button.removeAttribute('aria-current');

      if (active && typeof button.scrollIntoView === 'function') {
        button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
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
        : 'Create a campaign first so imported contacts stay grouped correctly in history.';
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
