const CONTACT_IMPORTER = Object.freeze({
  name: 'ContactImporter Google Sheets Backend',
  version: '2026.08.26-v2-permanent',
  timezone: 'Asia/Jakarta',
  contactsSheet: 'Contacts',
  syncLogSheet: 'SyncLog',
  maxBatchSize: 250,
  writeLockTimeoutMs: 30000,
});

const CONTACT_HEADERS = Object.freeze([
  'contact_key',
  'full_name',
  'saved_name',
  'phone',
  'email',
  'notes',
  'event_campaign',
  'lead_source',
  'category',
  'batch_note',
  'name_format',
  'created_at',
  'updated_at',
  'last_synced_at',
]);

const SYNC_LOG_HEADERS = Object.freeze([
  'timestamp',
  'request_id',
  'action',
  'received',
  'inserted',
  'updated',
  'client_version',
]);

const API_ACTIONS = Object.freeze({
  health: health_,
  listContacts: listContacts_,
  upsertContacts: upsertContacts_,
});

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || 'health').trim();
    const payload = {
      action: action,
      limit: Number((event && event.parameter && event.parameter.limit) || 1000),
    };
    return json_(dispatch_(payload));
  } catch (error) {
    return json_(errorResponse_(error));
  }
}

function doPost(event) {
  try {
    const body = parseBody_(event);
    return json_(dispatch_(body));
  } catch (error) {
    return json_(errorResponse_(error));
  }
}

function dispatch_(body) {
  const action = String(body.action || '').trim();
  if (!Object.prototype.hasOwnProperty.call(API_ACTIONS, action)) {
    throw new Error('Unsupported action.');
  }
  return withMeta_(API_ACTIONS[action](body));
}

/**
 * Run this once from the Apps Script editor after attaching the script to the
 * Google Sheet that should store ContactImporter data.
 *
 * The function creates the required sheets and permanently binds this Apps
 * Script project to the current spreadsheet. ContactImporter now uses one fixed
 * production Web App endpoint, so there is no frontend-editable access key.
 */
function setupContactImporterBackend() {
  const spreadsheet = activeSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(CONTACT_IMPORTER.timezone);

  const contactsSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.contactsSheet, CONTACT_HEADERS);
  const syncLogSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.syncLogSheet, SYNC_LOG_HEADERS);

  formatSheet_(contactsSheet, CONTACT_HEADERS.length);
  formatSheet_(syncLogSheet, SYNC_LOG_HEADERS.length);

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('CONTACTIMPORTER_SPREADSHEET_ID', spreadsheet.getId());
  properties.deleteProperty('CONTACTIMPORTER_ACCESS_KEY');

  const result = {
    ok: true,
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
    mode: 'permanent',
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    contactsSheet: CONTACT_IMPORTER.contactsSheet,
    syncLogSheet: CONTACT_IMPORTER.syncLogSheet,
  };

  console.log(JSON.stringify(result));
  return result;
}

/**
 * Compatibility helper for installations created before the permanent backend
 * release. Running it simply removes the legacy access-key property.
 */
function removeLegacyContactImporterAccessKey() {
  PropertiesService.getScriptProperties().deleteProperty('CONTACTIMPORTER_ACCESS_KEY');
  return { ok: true, mode: 'permanent' };
}

function health_() {
  const spreadsheet = spreadsheet_();
  const contactsSheet = spreadsheet.getSheetByName(CONTACT_IMPORTER.contactsSheet);
  const syncLogSheet = spreadsheet.getSheetByName(CONTACT_IMPORTER.syncLogSheet);

  return {
    ok: Boolean(contactsSheet && syncLogSheet),
    ready: Boolean(contactsSheet && syncLogSheet),
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
    mode: 'permanent',
    spreadsheetName: spreadsheet.getName(),
    contactsSheet: CONTACT_IMPORTER.contactsSheet,
    authRequired: false,
    authenticated: true,
    now: new Date().toISOString(),
  };
}

function listContacts_(body) {
  const sheet = getContactsSheet_();
  const rows = rowsAsObjects_(sheet, CONTACT_HEADERS);
  const requestedLimit = Number(body.limit || 1000);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 1000, 5000));

  const contacts = rows
    .slice(0, limit)
    .map(function (row) {
      return {
        fullName: plainCell_(row.full_name),
        savedName: plainCell_(row.saved_name),
        phone: plainCell_(row.phone),
        email: plainCell_(row.email),
        notes: plainCell_(row.notes),
        event: plainCell_(row.event_campaign),
        source: plainCell_(row.lead_source),
        category: plainCell_(row.category),
        batchNote: plainCell_(row.batch_note),
        nameFormat: plainCell_(row.name_format),
        createdAt: isoCell_(row.created_at),
        updatedAt: isoCell_(row.updated_at),
        lastSyncedAt: isoCell_(row.last_synced_at),
      };
    });

  return {
    ok: true,
    count: contacts.length,
    total: rows.length,
    contacts: contacts,
  };
}

function upsertContacts_(body) {
  const incoming = Array.isArray(body.contacts) ? body.contacts : [];
  if (!incoming.length) throw new Error('No contacts were provided.');
  if (incoming.length > CONTACT_IMPORTER.maxBatchSize) {
    throw new Error('Batch exceeds ' + CONTACT_IMPORTER.maxBatchSize + ' contacts.');
  }

  const sanitized = incoming.map(normalizeIncomingContact_).filter(function (contact) {
    return Boolean(contact.contactKey && contact.fullName && (contact.phone || contact.email));
  });

  if (!sanitized.length) throw new Error('No valid contacts were provided.');

  const requestId = safeText_(body.requestId || Utilities.getUuid(), 120);
  const clientVersion = safeText_(body.clientVersion || '', 120);

  return withScriptLock_(CONTACT_IMPORTER.writeLockTimeoutMs, function () {
    const sheet = getContactsSheet_();
    const existingRows = rowsAsObjects_(sheet, CONTACT_HEADERS);
    const byKey = Object.create(null);

    existingRows.forEach(function (row) {
      const key = plainCell_(row.contact_key);
      if (key) byKey[key] = row.__row;
    });

    let inserted = 0;
    let updated = 0;
    const now = new Date();

    sanitized.forEach(function (contact) {
      const rowNumber = byKey[contact.contactKey];
      const createdAt = rowNumber
        ? sheet.getRange(rowNumber, CONTACT_HEADERS.indexOf('created_at') + 1).getValue() || now
        : now;

      const values = [
        safeCell_(contact.contactKey),
        safeCell_(contact.fullName),
        safeCell_(contact.savedName),
        safeCell_(contact.phone),
        safeCell_(contact.email),
        safeCell_(contact.notes),
        safeCell_(contact.event),
        safeCell_(contact.source),
        safeCell_(contact.category),
        safeCell_(contact.batchNote),
        safeCell_(contact.nameFormat),
        createdAt,
        now,
        now,
      ];

      if (rowNumber) {
        sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
        updated += 1;
      } else {
        sheet.appendRow(values);
        byKey[contact.contactKey] = sheet.getLastRow();
        inserted += 1;
      }
    });

    appendSyncLog_(requestId, 'upsertContacts', incoming.length, inserted, updated, clientVersion);
    SpreadsheetApp.flush();

    return {
      ok: true,
      received: incoming.length,
      accepted: sanitized.length,
      inserted: inserted,
      updated: updated,
      requestId: requestId,
    };
  });
}

function normalizeIncomingContact_(contact) {
  const fullName = safeText_(contact && contact.fullName, 300);
  const phone = safeText_(contact && contact.phone, 120);
  const email = safeText_(contact && contact.email, 320).toLowerCase();
  const contactKey = makeContactKey_(phone, email);

  return {
    contactKey: contactKey,
    fullName: fullName,
    savedName: safeText_(contact && contact.savedName, 500) || fullName,
    phone: phone,
    email: email,
    notes: safeText_(contact && contact.notes, 8000),
    event: safeText_(contact && contact.event, 500),
    source: safeText_(contact && contact.source, 500),
    category: safeText_(contact && contact.category, 500),
    batchNote: safeText_(contact && contact.batchNote, 8000),
    nameFormat: safeText_(contact && contact.nameFormat, 120),
  };
}

function makeContactKey_(phone, email) {
  const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '');
  if (normalizedPhone) return 'phone:' + normalizedPhone;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail) return 'email:' + normalizedEmail;
  return '';
}

function spreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const id = String(properties.getProperty('CONTACTIMPORTER_SPREADSHEET_ID') || '').trim();
  if (id) return SpreadsheetApp.openById(id);
  return activeSpreadsheet_();
}

function activeSpreadsheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No Google Sheet is attached. Create this Apps Script from Extensions > Apps Script inside the target Sheet.');
  }
  return spreadsheet;
}

function getContactsSheet_() {
  const spreadsheet = spreadsheet_();
  return ensureSheet_(spreadsheet, CONTACT_IMPORTER.contactsSheet, CONTACT_HEADERS);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const current = headerRange.getValues()[0].map(String);
  if (current.join('\u0001') !== headers.join('\u0001')) {
    headerRange.setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function formatSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  const header = sheet.getRange(1, 1, 1, columnCount);
  header.setFontWeight('bold');
  header.setBackground('#131516');
  header.setFontColor('#f8f8f6');
  header.setWrap(true);
  sheet.autoResizeColumns(1, columnCount);
}

function rowsAsObjects_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, index) {
    const object = { __row: index + 2 };
    headers.forEach(function (header, columnIndex) {
      object[header] = row[columnIndex];
    });
    return object;
  });
}

function appendSyncLog_(requestId, action, received, inserted, updated, clientVersion) {
  const spreadsheet = spreadsheet_();
  const sheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.syncLogSheet, SYNC_LOG_HEADERS);
  sheet.appendRow([
    new Date(),
    safeCell_(requestId),
    safeCell_(action),
    Number(received || 0),
    Number(inserted || 0),
    Number(updated || 0),
    safeCell_(clientVersion),
  ]);
}

function withScriptLock_(timeoutMs, callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function parseBody_(event) {
  if (!event || !event.postData || typeof event.postData.contents !== 'string') {
    throw new Error('Request body is required.');
  }
  const raw = event.postData.contents;
  if (!raw.trim()) throw new Error('Request body is empty.');
  let body;
  try {
    body = JSON.parse(raw);
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.');
  }
  return body;
}

function safeText_(value, maxLength) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text.slice(0, maxLength || 1000);
}

function safeCell_(value) {
  const text = value instanceof Date ? value : String(value === null || value === undefined ? '' : value);
  if (text instanceof Date) return text;
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}

function plainCell_(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (text.charAt(0) === "'" && /^[=+\-@]/.test(text.charAt(1))) text = text.slice(1);
  return text;
}

function isoCell_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function withMeta_(payload) {
  return Object.assign({}, payload, {
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
  });
}

function errorResponse_(error) {
  console.error(error && error.stack ? error.stack : error);
  return {
    ok: false,
    error: error && error.message ? error.message : String(error || 'Unknown error'),
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
  };
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
