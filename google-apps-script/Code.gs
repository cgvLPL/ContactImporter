const CONTACT_IMPORTER = Object.freeze({
  name: 'ContactImporter Google Sheets Backend',
  version: '2026.08.26-v3-campaign-history',
  timezone: 'Asia/Jakarta',
  contactsSheet: 'Contacts',
  campaignsSheet: 'Campaigns',
  syncLogSheet: 'SyncLog',
  maxBatchSize: 250,
  writeLockTimeoutMs: 30000,
});

// campaign_id is intentionally appended so existing Contacts rows keep their
// original column positions when an older backend is upgraded.
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
  'campaign_id',
]);

const CAMPAIGN_HEADERS = Object.freeze([
  'campaign_id',
  'campaign_name',
  'lead_source',
  'category',
  'batch_note',
  'name_format',
  'contact_count',
  'created_at',
  'updated_at',
  'last_synced_at',
]);

// Campaign columns are appended for compatibility with existing SyncLog data.
const SYNC_LOG_HEADERS = Object.freeze([
  'timestamp',
  'request_id',
  'action',
  'received',
  'inserted',
  'updated',
  'client_version',
  'campaign_id',
  'campaign_name',
]);

const API_ACTIONS = Object.freeze({
  health: health_,
  listContacts: listContacts_,
  listCampaigns: listCampaigns_,
  upsertContacts: upsertContacts_,
});

function doGet(event) {
  try {
    const action = String((event && event.parameter && event.parameter.action) || 'health').trim();
    const payload = {
      action: action,
      limit: Number((event && event.parameter && event.parameter.limit) || 1000),
      campaignId: String((event && event.parameter && event.parameter.campaignId) || ''),
      campaign: String((event && event.parameter && event.parameter.campaign) || ''),
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
 * Run this after installing or upgrading the backend. It is safe to run again.
 * Existing Contacts and SyncLog data are preserved because new columns are
 * appended, while the Campaigns table is created automatically.
 */
function setupContactImporterBackend() {
  const spreadsheet = activeSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(CONTACT_IMPORTER.timezone);

  const contactsSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.contactsSheet, CONTACT_HEADERS);
  const campaignsSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.campaignsSheet, CAMPAIGN_HEADERS);
  const syncLogSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.syncLogSheet, SYNC_LOG_HEADERS);

  formatSheet_(contactsSheet, CONTACT_HEADERS.length);
  formatSheet_(campaignsSheet, CAMPAIGN_HEADERS.length);
  formatSheet_(syncLogSheet, SYNC_LOG_HEADERS.length);

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('CONTACTIMPORTER_SPREADSHEET_ID', spreadsheet.getId());
  properties.deleteProperty('CONTACTIMPORTER_ACCESS_KEY');

  // Build Campaigns history from any Contacts that existed before v3.
  rebuildCampaignHistory_();

  const result = {
    ok: true,
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
    mode: 'permanent',
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    contactsSheet: CONTACT_IMPORTER.contactsSheet,
    campaignsSheet: CONTACT_IMPORTER.campaignsSheet,
    syncLogSheet: CONTACT_IMPORTER.syncLogSheet,
  };

  console.log(JSON.stringify(result));
  return result;
}

function removeLegacyContactImporterAccessKey() {
  PropertiesService.getScriptProperties().deleteProperty('CONTACTIMPORTER_ACCESS_KEY');
  return { ok: true, mode: 'permanent' };
}

function health_() {
  const spreadsheet = spreadsheet_();
  const contactsSheet = getContactsSheet_();
  const campaignsSheet = getCampaignsSheet_();
  const syncLogSheet = ensureSheet_(spreadsheet, CONTACT_IMPORTER.syncLogSheet, SYNC_LOG_HEADERS);

  return {
    ok: Boolean(contactsSheet && campaignsSheet && syncLogSheet),
    ready: Boolean(contactsSheet && campaignsSheet && syncLogSheet),
    service: CONTACT_IMPORTER.name,
    version: CONTACT_IMPORTER.version,
    mode: 'permanent',
    spreadsheetName: spreadsheet.getName(),
    contactsSheet: CONTACT_IMPORTER.contactsSheet,
    campaignsSheet: CONTACT_IMPORTER.campaignsSheet,
    authRequired: false,
    authenticated: true,
    now: new Date().toISOString(),
  };
}

function listContacts_(body) {
  const sheet = getContactsSheet_();
  let rows = rowsAsObjects_(sheet, CONTACT_HEADERS);
  const requestedLimit = Number(body.limit || 1000);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 1000, 5000));
  const requestedCampaignId = safeText_(body.campaignId, 160);
  const requestedCampaign = safeText_(body.campaign, 500);

  if (requestedCampaignId) {
    rows = rows.filter(function (row) {
      return campaignIdForRow_(row) === requestedCampaignId;
    });
  } else if (requestedCampaign) {
    const normalizedCampaign = normalizeCampaignName_(requestedCampaign);
    rows = rows.filter(function (row) {
      return normalizeCampaignName_(plainCell_(row.event_campaign)) === normalizedCampaign;
    });
  }

  const contacts = rows
    .slice(0, limit)
    .map(function (row) {
      const campaignId = campaignIdForRow_(row);
      return {
        campaignId: campaignId,
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
    campaignId: requestedCampaignId,
    contacts: contacts,
  };
}

function listCampaigns_() {
  const campaignSheet = getCampaignsSheet_();
  let rows = rowsAsObjects_(campaignSheet, CAMPAIGN_HEADERS);

  // Older installations can have Contacts but no Campaigns history yet.
  if (!rows.length) {
    rebuildCampaignHistory_();
    rows = rowsAsObjects_(campaignSheet, CAMPAIGN_HEADERS);
  }

  const campaigns = rows.map(function (row) {
    return {
      campaignId: plainCell_(row.campaign_id),
      name: plainCell_(row.campaign_name) || 'Unassigned',
      source: plainCell_(row.lead_source),
      category: plainCell_(row.category),
      batchNote: plainCell_(row.batch_note),
      nameFormat: plainCell_(row.name_format),
      contactCount: Number(row.contact_count || 0),
      createdAt: isoCell_(row.created_at),
      updatedAt: isoCell_(row.updated_at),
      lastSyncedAt: isoCell_(row.last_synced_at),
    };
  }).sort(function (a, b) {
    return String(b.lastSyncedAt || b.updatedAt || '').localeCompare(String(a.lastSyncedAt || a.updatedAt || ''));
  });

  return {
    ok: true,
    count: campaigns.length,
    campaigns: campaigns,
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

    // Index both the current scoped key and a derived scoped key for old rows.
    // This upgrades legacy records in place instead of creating duplicates.
    existingRows.forEach(function (row) {
      const storedKey = plainCell_(row.contact_key);
      if (storedKey) byKey[storedKey] = row.__row;

      const campaignId = campaignIdForRow_(row);
      const baseKey = makeBaseContactKey_(plainCell_(row.phone), plainCell_(row.email));
      const scopedKey = makeScopedContactKey_(campaignId, baseKey);
      if (scopedKey && !byKey[scopedKey]) byKey[scopedKey] = row.__row;
    });

    let inserted = 0;
    let updated = 0;
    const now = new Date();
    const campaignSamples = Object.create(null);

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
        safeCell_(contact.campaignId),
      ];

      if (rowNumber) {
        sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
        updated += 1;
      } else {
        sheet.appendRow(values);
        byKey[contact.contactKey] = sheet.getLastRow();
        inserted += 1;
      }

      campaignSamples[contact.campaignId] = contact;
    });

    Object.keys(campaignSamples).forEach(function (campaignId) {
      upsertCampaignRecord_(campaignSamples[campaignId], now);
    });

    const firstCampaign = sanitized[0];
    appendSyncLog_(
      requestId,
      'upsertContacts',
      incoming.length,
      inserted,
      updated,
      clientVersion,
      firstCampaign.campaignId,
      firstCampaign.event || 'Unassigned'
    );
    SpreadsheetApp.flush();

    return {
      ok: true,
      received: incoming.length,
      accepted: sanitized.length,
      inserted: inserted,
      updated: updated,
      requestId: requestId,
      campaignId: firstCampaign.campaignId,
      campaign: firstCampaign.event || 'Unassigned',
    };
  });
}

function normalizeIncomingContact_(contact) {
  const fullName = safeText_(contact && contact.fullName, 300);
  const phone = safeText_(contact && contact.phone, 120);
  const email = safeText_(contact && contact.email, 320).toLowerCase();
  const event = safeText_(contact && contact.event, 500);
  const campaignId = safeText_(contact && contact.campaignId, 160) || makeCampaignId_(event);
  const baseKey = makeBaseContactKey_(phone, email);

  return {
    contactKey: makeScopedContactKey_(campaignId, baseKey),
    campaignId: campaignId,
    fullName: fullName,
    savedName: safeText_(contact && contact.savedName, 500) || fullName,
    phone: phone,
    email: email,
    notes: safeText_(contact && contact.notes, 8000),
    event: event,
    source: safeText_(contact && contact.source, 500),
    category: safeText_(contact && contact.category, 500),
    batchNote: safeText_(contact && contact.batchNote, 8000),
    nameFormat: safeText_(contact && contact.nameFormat, 120),
  };
}

function makeBaseContactKey_(phone, email) {
  const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '');
  if (normalizedPhone) return 'phone:' + normalizedPhone;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail) return 'email:' + normalizedEmail;
  return '';
}

function makeScopedContactKey_(campaignId, baseKey) {
  if (!campaignId || !baseKey) return '';
  return campaignId + '|' + baseKey;
}

function normalizeCampaignName_(value) {
  return safeText_(value, 500).toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function makeCampaignId_(eventName) {
  const normalized = normalizeCampaignName_(eventName);
  if (!normalized) return 'campaign-unassigned';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized, Utilities.Charset.UTF_8);
  const token = Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 18);
  return 'campaign-' + token;
}

function campaignIdForRow_(row) {
  return safeText_(row && row.campaign_id, 160) || makeCampaignId_(plainCell_(row && row.event_campaign));
}

function upsertCampaignRecord_(contact, now) {
  const sheet = getCampaignsSheet_();
  const rows = rowsAsObjects_(sheet, CAMPAIGN_HEADERS);
  const row = rows.find(function (item) {
    return plainCell_(item.campaign_id) === contact.campaignId;
  });
  const createdAt = row ? row.created_at || now : now;
  const count = countContactsForCampaign_(contact.campaignId);
  const values = [
    safeCell_(contact.campaignId),
    safeCell_(contact.event || 'Unassigned'),
    safeCell_(contact.source),
    safeCell_(contact.category),
    safeCell_(contact.batchNote),
    safeCell_(contact.nameFormat),
    count,
    createdAt,
    now,
    now,
  ];

  if (row) sheet.getRange(row.__row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function countContactsForCampaign_(campaignId) {
  return rowsAsObjects_(getContactsSheet_(), CONTACT_HEADERS).filter(function (row) {
    return campaignIdForRow_(row) === campaignId;
  }).length;
}

function rebuildCampaignHistory_() {
  const contacts = rowsAsObjects_(getContactsSheet_(), CONTACT_HEADERS);
  if (!contacts.length) return;

  const grouped = Object.create(null);
  contacts.forEach(function (row) {
    const campaignId = campaignIdForRow_(row);
    if (!grouped[campaignId]) {
      grouped[campaignId] = {
        campaignId: campaignId,
        event: plainCell_(row.event_campaign) || 'Unassigned',
        source: plainCell_(row.lead_source),
        category: plainCell_(row.category),
        batchNote: plainCell_(row.batch_note),
        nameFormat: plainCell_(row.name_format),
        createdAt: row.created_at || new Date(),
        updatedAt: row.updated_at || row.last_synced_at || new Date(),
        lastSyncedAt: row.last_synced_at || row.updated_at || new Date(),
        count: 0,
      };
    }
    const item = grouped[campaignId];
    item.count += 1;
    if (row.created_at && new Date(row.created_at) < new Date(item.createdAt)) item.createdAt = row.created_at;
    if (row.updated_at && new Date(row.updated_at) > new Date(item.updatedAt)) item.updatedAt = row.updated_at;
    if (row.last_synced_at && new Date(row.last_synced_at) > new Date(item.lastSyncedAt)) item.lastSyncedAt = row.last_synced_at;
  });

  const sheet = getCampaignsSheet_();
  const existing = rowsAsObjects_(sheet, CAMPAIGN_HEADERS);
  const byId = Object.create(null);
  existing.forEach(function (row) { byId[plainCell_(row.campaign_id)] = row.__row; });

  Object.keys(grouped).forEach(function (campaignId) {
    const item = grouped[campaignId];
    const values = [
      safeCell_(item.campaignId),
      safeCell_(item.event),
      safeCell_(item.source),
      safeCell_(item.category),
      safeCell_(item.batchNote),
      safeCell_(item.nameFormat),
      item.count,
      item.createdAt,
      item.updatedAt,
      item.lastSyncedAt,
    ];
    if (byId[campaignId]) sheet.getRange(byId[campaignId], 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
  });
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
  return ensureSheet_(spreadsheet_(), CONTACT_IMPORTER.contactsSheet, CONTACT_HEADERS);
}

function getCampaignsSheet_() {
  return ensureSheet_(spreadsheet_(), CONTACT_IMPORTER.campaignsSheet, CAMPAIGN_HEADERS);
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

function appendSyncLog_(requestId, action, received, inserted, updated, clientVersion, campaignId, campaignName) {
  const sheet = ensureSheet_(spreadsheet_(), CONTACT_IMPORTER.syncLogSheet, SYNC_LOG_HEADERS);
  sheet.appendRow([
    new Date(),
    safeCell_(requestId),
    safeCell_(action),
    Number(received || 0),
    Number(inserted || 0),
    Number(updated || 0),
    safeCell_(clientVersion),
    safeCell_(campaignId || ''),
    safeCell_(campaignName || ''),
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
