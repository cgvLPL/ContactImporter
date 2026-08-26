(() => {
  if (window.__contactImporterTabLayout) return;
  window.__contactImporterTabLayout = true;

  const nav = document.querySelector('.nav');
  const stage = document.querySelector('.tab-stage');
  const topbar = document.querySelector('.workspace-topbar');
  if (!nav || !stage) return;

  const layout = [
    { target: 'overviewSection', label: 'Overview', icon: 'layout-dashboard', step: 'HOME' },
    { target: 'campaignSection', label: 'Campaigns', icon: 'megaphone', step: '1' },
    { target: 'importSection', label: 'Import', icon: 'file-spreadsheet', step: '2' },
    { target: 'contactsSection', label: 'Contacts', icon: 'users-round', step: '3' },
    { target: 'settingsSection', label: 'Export', icon: 'download', step: '4' },
    { target: 'backendSection', label: 'Backend', icon: 'database', step: 'SYS' },
  ];

  const sidebarTitle = document.querySelector('.sidebar-section-title');
  if (sidebarTitle) sidebarTitle.textContent = 'Workflow';

  layout.forEach(item => {
    const button = nav.querySelector(`.nav-button[data-target="${item.target}"]`);
    if (!button) return;

    button.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
    button.dataset.workflowStep = item.step;
    button.setAttribute('aria-label', `${item.label}${/^\d+$/.test(item.step) ? ` · step ${item.step}` : ''}`);
    nav.appendChild(button);
  });

  // app-core.js originally attached scroll navigation handlers to the sidebar.
  // Replace those button nodes before tab-ui.js initializes so the interface is
  // controlled only by the tab system and never falls back to page scrolling.
  Array.from(nav.querySelectorAll('.nav-button[data-target]')).forEach(button => {
    const clean = button.cloneNode(true);
    button.replaceWith(clean);
  });

  const brandHome = document.getElementById('brandHome');
  if (brandHome) {
    const cleanBrand = brandHome.cloneNode(true);
    brandHome.replaceWith(cleanBrand);
  }

  layout.forEach(item => {
    const panel = document.getElementById(item.target);
    if (panel) stage.appendChild(panel);
  });

  const exportPanel = document.getElementById('settingsSection');
  if (exportPanel) exportPanel.setAttribute('aria-label', 'Export');

  const backendPanel = document.getElementById('backendSection');
  if (backendPanel) backendPanel.setAttribute('aria-label', 'Backend');

  // Mirror the same workflow on mobile, where the desktop sidebar is hidden.
  if (topbar && !document.querySelector('.mobile-workflow-tabs')) {
    const mobileTabs = document.createElement('nav');
    mobileTabs.className = 'mobile-workflow-tabs';
    mobileTabs.setAttribute('aria-label', 'ContactImporter workflow');
    mobileTabs.innerHTML = layout.map(item => `
      <button type="button" class="mobile-workflow-tab${item.target === 'overviewSection' ? ' active' : ''}"
        data-open-tab="${item.target}" data-target="${item.target}">
        <span class="mobile-workflow-step">${item.step}</span>
        <i data-lucide="${item.icon}"></i>
        <span>${item.label}</span>
      </button>
    `).join('');
    topbar.insertAdjacentElement('afterend', mobileTabs);
  }

  // Reorder the Overview cards to match the actual workflow: Campaign → Import → Review → Export.
  const overviewGrid = document.querySelector('#overviewSection .overview-grid');
  const campaignCard = overviewGrid && overviewGrid.querySelector('.campaign-summary-card');
  const importCard = overviewGrid && overviewGrid.querySelector('.overview-primary');
  const workflowCard = overviewGrid && Array.from(overviewGrid.children).find(card => card !== campaignCard && card !== importCard);

  if (overviewGrid) {
    if (campaignCard) overviewGrid.appendChild(campaignCard);
    if (importCard) overviewGrid.appendChild(importCard);
    if (workflowCard) overviewGrid.appendChild(workflowCard);
  }

  if (campaignCard) {
    const kicker = campaignCard.querySelector('.section-kicker');
    const action = campaignCard.querySelector('[data-open-tab]');
    if (kicker) kicker.textContent = 'Step 1 · Campaign';
    if (action) action.innerHTML = '<i data-lucide="arrow-right"></i>Open Campaigns';
  }

  if (importCard) {
    const kicker = importCard.querySelector('.section-kicker');
    const heading = importCard.querySelector('h2');
    if (kicker) kicker.textContent = 'Step 2 · Import';
    if (heading) heading.textContent = 'Import campaign contacts';
  }

  const workflowList = document.querySelector('#overviewSection .workflow-list');
  if (workflowList) {
    workflowList.innerHTML = `
      <li><span>1</span><div><strong>Campaign</strong><small>Create a new campaign or reopen campaign history.</small></div></li>
      <li><span>2</span><div><strong>Import & map</strong><small>Upload a spreadsheet and map Name, Phone, E-mail, and Notes.</small></div></li>
      <li><span>3</span><div><strong>Review</strong><small>Verify the valid contacts for the active campaign.</small></div></li>
      <li><span>4</span><div><strong>Export</strong><small>Download the current campaign as one VCF file.</small></div></li>
    `;
  }

  const contactsExportButton = document.querySelector('#contactsSection [data-open-tab="settingsSection"]');
  if (contactsExportButton) {
    contactsExportButton.innerHTML = '<i data-lucide="download"></i>Export contacts';
  }

  if (window.lucide) lucide.createIcons();
})();
