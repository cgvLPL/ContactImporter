'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const layout = require('../spreadsheet-layout.js');

const formTitle = 'FREE NOBAR FILM MEMBURU PEMANGSA 18:30 AUDI SATU 24 SEPTEMBER 2026';
const formHeaders = [
  'No', 'Email Address', 'Nama Lengkap', 'No Whatsapp',
  'Jumlah Penonton ( Wajib Berumur 17 Tahun )'
];

test('detects event title above Indonesian registration headers', () => {
  const rows = [
    [formTitle, '', '', '', ''],
    formHeaders,
    ['1', 'someone@example.test', 'Example Person', '081234567890', 2]
  ];
  const result = layout.analyzeRows(rows);
  assert.equal(result.headerIndex, 1);
  assert.equal(result.headerRowNumber, 2);
  assert.equal(result.title, formTitle);
  assert.equal(result.matches.name, 2);
  assert.equal(result.matches.phone, 3);
  assert.equal(result.matches.email, 1);
  assert.equal(result.matches.extra, 4);
  assert.equal(result.dataRows, 1);
});

test('does not mistake headerless response data for headers', () => {
  const result = layout.analyzeRows([
    ['2026-09-23', 'person@example.test', 'Example Person', '0812345678', 2]
  ], 4);
  assert.equal(result.headerIndex, -1);
  assert.equal(result.dataRows, 1);
});

test('preserves ordinary CSV/Excel files with headers in row 1', () => {
  const result = layout.analyzeRows([
    ['Full Name', 'Phone Number', 'E-mail', 'Notes'],
    ['Example Person', '08123456789', 'person@example.test', 'Example']
  ]);
  assert.equal(result.headerIndex, 0);
  assert.equal(result.matches.phone, 1);
  assert.equal(result.matches.email, 2);
  assert.equal(result.matches.notes, 3);
});

function fakeBrowser() {
  class Element {
    constructor(id) {
      this.id = id;
      this.options = [];
      this.events = {};
      this.value = '';
      this.hidden = false;
      this.style = {};
    }
    set innerHTML(value) {
      this.html = value;
      this.options = [];
      const options = Array.from(String(value).matchAll(/<option value="([^"]*)"/g));
      this.value = options.length ? options[0][1] : '';
      this.options = options.map(match => ({ value: match[1] }));
    }
    get innerHTML() { return this.html || ''; }
    addEventListener(event, callback) { this.events[event] = callback; }
    dispatchEvent(event) { if (this.events[event.type]) this.events[event.type](event); }
    appendChild(element) {
      this.options.push(element);
      if (this.options.length === 1) this.value = element.value;
    }
    insertBefore() {}
    querySelector(selector) {
      if (selector === '.rule') return {};
      if (selector === '.panel-title p') return elements.subtitle;
      return null;
    }
  }

  const elements = {};
  for (const id of [
    'uploadZone', 'importSection', 'mapName', 'mapPhone', 'mapEmail',
    'mapNotes', 'mapExtra', 'mapSheet', 'mapHeaderRow', 'mappingSource',
    'mappingDetected', 'mappingUseTitle', 'mappingState', 'eventName', 'subtitle'
  ]) elements[id] = new Element(id);

  const XLSX = {
    utils: {
      decode_range: ref => ({ s: { r: Number(ref.match(/\d+/)[0]) - 1 } }),
      sheet_to_json: sheet => sheet.rows
    }
  };

  const document = {
    getElementById: id => elements[id] || null,
    querySelector: () => null,
    createElement: tag => new Element(tag)
  };
  const context = vm.createContext({
    window: { XLSX }, document, parseRows() {}, contacts: [], skippedRows: 0,
    normalizeIndonesianName: value => String(value == null ? '' : value).trim(),
    cleanPhone: value => String(value == null ? '' : value).replace(/[^\d+]/g, ''),
    cleanValue: value => String(value == null ? '' : value).trim(),
    escapeHTML: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    updateStats() {}, updateDownloadState() {}, renderPreview() {},
    clearPreview() {}, setStatus() {},
    Event: class Event { constructor(type) { this.type = type; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'spreadsheet-layout.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'column-mapping.js'), 'utf8'), context);
  return { context, elements, importer: context.window.ContactImporterMapping };
}

test('picks the registration worksheet and imports 104 of 105 synthetic rows', () => {
  const { context, elements, importer } = fakeBrowser();
  const responses = [
    [formTitle, '', '', '', ''],
    formHeaders,
    ...Array.from({ length: 105 }, (_, i) => [
      String(i + 1),
      'example' + i + '@example.test',
      i === 104 ? '' : 'Example Person ' + i,
      i === 3 ? '' : '08123456' + i,
      i % 3 + 1
    ])
  ];
  const headerless = [
    ['2026-09-23', 'guest@example.test', 'Example Guest', 'guest@example.test', '08123456', 2, 'Interested']
  ];

  assert.equal(importer.loadWorkbook({
    SheetNames: ['Sheet1', 'Form Responses 1'],
    Sheets: {
      Sheet1: { '!ref': 'A4:G4', rows: headerless },
      'Form Responses 1': { '!ref': 'A1:E107', rows: responses }
    }
  }), true);

  const mapping = importer.getMapping();
  assert.equal(elements.mapSheet.value, 'Form Responses 1');
  assert.equal(elements.mapHeaderRow.value, '1');
  assert.equal(mapping.name, 2);
  assert.equal(mapping.phone, 3);
  assert.equal(mapping.email, 1);
  assert.equal(mapping.notes, -1);
  assert.equal(mapping.extra, 4);
  assert.equal(context.contacts.length, 104);
  assert.equal(context.skippedRows, 1);
  assert.match(context.contacts[0].note, /^Jumlah Penonton.*: 1$/);

  elements.mapSheet.value = 'Sheet1';
  elements.mapSheet.dispatchEvent({ type: 'change' });
  assert.equal(elements.mapHeaderRow.value, '-1');
  assert.equal(context.contacts.length, 0);
  elements.mapName.value = '2';
  elements.mapEmail.value = '1';
  elements.mapPhone.value = '4';
  elements.mapExtra.value = '5';
  elements.mapExtra.dispatchEvent({ type: 'change' });
  assert.equal(context.contacts.length, 1);
  assert.match(context.contacts[0].note, /^Registration detail: 2$/);
});

test('combines optional free-text notes with attendance count on separate lines', () => {
  const { context, importer } = fakeBrowser();
  const header = [...formHeaders, 'Catatan'];
  const rows = [header, ['1', 'guest@example.test', 'Example Guest', '0812345678', 2, 'Bring ID']];
  importer.loadWorkbook({
    SheetNames: ['Registration'],
    Sheets: { Registration: { '!ref': 'A1:F2', rows } }
  });
  assert.equal(context.contacts.length, 1);
  assert.equal(context.contacts[0].note, 'Bring ID\nJumlah Penonton ( Wajib Berumur 17 Tahun ): 2');
});
