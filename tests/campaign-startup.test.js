const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    value: '', textContent: '', innerHTML: '', style: {}, listeners: {}, open: false,
    classList: { add() {}, remove() {} },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    dispatchEvent() {}, setAttribute() {}, insertBefore() {}, insertAdjacentElement() {},
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; },
    setCustomValidity(value) { this.validity = value; }, reportValidity() {},
    showModal() { this.open = true; }, close() { this.open = false; },
  };
}
function workspace() {
  const ids = Object.fromEntries(['campaignSection','campaignWelcomeName','campaignWelcomeForm','campaignWelcomeHistory'].map(id => [id, element()]));
  const history = element();
  ids.campaignSection.querySelector = () => element();
  let openedTab, syncCalls = 0;
  const context = {
    document: {
      getElementById: id => ids[id] || null,
      querySelector: () => history,
      createElement: () => element(),
      body: { appendChild(el) { ids[el.id] = el; } },
    },
    Event: class {}, console,
    contacts: [], skippedRows: 0,
    excelFile: element(), fileChip: element(),
    eventNameInput: element(), nameFormatInput: element(), sourceInput: element(), categoryInput: element(), noteInput: element(),
    window: {
      setTimeout() {},
      ContactImporterTabs: { open(tab) { openedTab = tab; } },
      ContactImporterBackend: { sync() { syncCalls++; } },
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../campaign-workspace-state.js'), 'utf8'), context);
  return { context, ids, history, tab: () => openedTab, syncCalls: () => syncCalls };
}

test('each fresh visit prompts for a new campaign without syncing or restoring contacts', () => {
  for (let i = 0; i < 2; i++) {
    const app = workspace();
    assert.equal(app.ids.campaignWelcomeDialog.open, true);
    assert.equal(app.context.contacts.length, 0);
    assert.equal(app.context.eventNameInput.value, '');
    assert.equal(app.tab(), 'campaignSection');
    assert.equal(app.syncCalls(), 0);
  }
});

test('campaign creation rejects whitespace and applies a trimmed name', () => {
  const app = workspace();
  const submit = app.ids.campaignWelcomeForm.listeners.submit;
  app.ids.campaignWelcomeName.value = '   ';
  submit({ preventDefault() {} });
  assert.equal(app.ids.campaignWelcomeDialog.open, true);
  assert.ok(app.ids.campaignWelcomeName.validity);
  app.ids.campaignWelcomeName.value = '  Jakarta Expo 2026  ';
  submit({ preventDefault() {} });
  assert.equal(app.context.eventNameInput.value, 'Jakarta Expo 2026');
  assert.equal(app.ids.campaignWelcomeDialog.open, false);
  assert.equal(app.context.contacts.length, 0);
});

test('history and Escape dismiss the prompt without loading a past campaign', () => {
  for (const action of ['history', 'escape']) {
    const app = workspace();
    if (action === 'history') app.ids.campaignWelcomeHistory.listeners.click();
    else app.ids.campaignWelcomeDialog.listeners.cancel({ preventDefault() {} });
    assert.equal(app.ids.campaignWelcomeDialog.open, false);
    assert.equal(app.history.focused, true);
    assert.equal(app.history.scrolled, true);
    assert.equal(app.context.contacts.length, 0);
  }
});

test('history arriving asynchronously never selects or opens the latest campaign', async () => {
  let observerCallback, loadCalls = [];
  const select = element();
  select.options = [];
  Object.defineProperty(select, 'innerHTML', {
    set(html) {
      this.options = Array.from(html.matchAll(/<option value="([^"]*)"/g), match => ({ value:match[1], dataset:{name:'Past event',count:'2'} }));
      this.value = '';
    },
  });
  select.selectedIndex = 0;
  const openButton = element();
  const meta = element();
  const ids = { campaignHistorySelect:select, campaignHistoryOpenSelected:openButton, campaignHistorySelectMeta:meta };
  let cards = [];
  ids.campaignHistoryList = { querySelectorAll: () => cards };
  const context = {
    document: { getElementById:id => ids[id], querySelector:()=>element(), createElement:()=>element() },
    MutationObserver: class { constructor(callback) { observerCallback = callback; } observe() {} },
    window: { ContactImporterBackend:{ loadCampaign:async (...args)=>loadCalls.push(args) }, setTimeout:callback=>callback() },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../campaign-selector.js'), 'utf8'), context);
  cards = [{ dataset:{campaignId:'past-1',campaignName:'Past event'}, closest:()=>({querySelector:()=>({textContent:'2'})}) }];
  observerCallback();
  observerCallback();
  assert.equal(loadCalls.length, 0);
  assert.equal(select.value, '');
  assert.equal(openButton.disabled, true);
  select.value = 'past-1';
  select.selectedIndex = 2;
  select.listeners.change();
  assert.equal(openButton.disabled, false);
  await openButton.listeners.click();
  assert.deepEqual(loadCalls, [['past-1','Past event']]);
});
