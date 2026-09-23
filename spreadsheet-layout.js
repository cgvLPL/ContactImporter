// Worksheet and header detection for regular spreadsheets and exported registration forms.
// Kept dependency-free so detection can be verified separately from the browser UI.
(function(root) {
  'use strict';

  function normalizeHeader(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('id-ID')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim().replace(/\s+/g, ' ');
  }

  const RULES = {
    name: [
      /^(?:nama lengkap|nama peserta|nama pendaftar|nama pengunjung|nama customer|nama pelanggan|full name|contact name|customer name|participant name|attendee name|first name|nama|name)(?:\b|$)/
    ],
    phone: [
      /^(?:(?:no|nomor|number)\s*)?(?:whatsapp|whats app|wa)(?:\b|$)/,
      /^(?:(?:no|nomor|number)\s*)?(?:hp|handphone|telepon|telpon|telp|ponsel|phone|mobile|cellphone|telephone)(?:\b|$)/,
      /^(?:phone number|mobile number|contact number)(?:\b|$)/
    ],
    email: [/^(?:e mail|email|email address|alamat email|surel|mail)(?:\b|$)/],
    notes: [/^(?:catatan|keterangan|komentar|pesan|additional notes?|contact notes?|notes?|remarks?|comments?)(?:\b|$)/],
    extra: [
      /^(?:jumlah|total|banyaknya|number of|total number of)\s+(?:penonton|peserta|pengunjung|orang|tiket|tickets?|attendees?|guests?|people|pax)(?:\b|$)/,
      /^(?:ticket qty|ticket quantity|jumlah tiket|qty tickets?|guest count|attendee count)(?:\b|$)/
    ]
  };

  function bestHeaderMatch(headers, kind) {
    const rules = RULES[kind] || [];
    let best = -1;
    let bestScore = -Infinity;
    headers.forEach((value, index) => {
      const text = normalizeHeader(value);
      if (!text || /^\d+$/.test(text)) return;
      rules.forEach((rule, rank) => {
        if (!rule.test(text)) return;
        // Prefer a specific exact header to an extended prompt, and more
        // specific rules when two columns happen to match the same field.
        const score = 100 - rank * 5 - Math.min(text.length, 80) / 100;
        if (score > bestScore) { best = index; bestScore = score; }
      });
    });
    return best;
  }

  function matchedColumns(headers) {
    const result = {};
    for (const kind of Object.keys(RULES)) result[kind] = bestHeaderMatch(headers, kind);
    return result;
  }

  function analyzeRows(rows, firstRowNumber = 1) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const columnCount = safeRows.slice(0, 60).reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0
    );
    let chosen = { index: -1, score: -Infinity, matches: null };
    let firstNonEmpty = -1;

    for (let i = 0; i < Math.min(safeRows.length, 20); i++) {
      const row = Array.isArray(safeRows[i]) ? safeRows[i] : [];
      const populated = row.filter(value => String(value == null ? '' : value).trim() !== '');
      if (!populated.length) continue;
      if (firstNonEmpty < 0) firstNonEmpty = i;
      if (populated.length < 2) continue;

      const matches = matchedColumns(row);
      const distinct = new Set(Object.values(matches).filter(index => index >= 0));
      let score = distinct.size * 3;
      if (matches.name >= 0) score += 5;
      if (matches.phone >= 0 || matches.email >= 0) score += 5;
      if (matches.name >= 0 && (matches.phone >= 0 || matches.email >= 0)) score += 12;
      if (matches.phone >= 0 && matches.email >= 0) score += 2;
      if (score > chosen.score) chosen = { index: i, score, matches };
    }

    // If nothing recognizable is present, only assume headers when the first
    // populated row looks like labels, never when it already contains emails.
    let headerIndex = chosen.score >= 8 ? chosen.index : -1;
    if (headerIndex < 0 && firstNonEmpty >= 0) {
      const row = safeRows[firstNonEmpty] || [];
      const populated = row.filter(v => String(v == null ? '' : v).trim() !== '');
      const labelLike = populated.length >= 2 && populated.every(v => {
        const text = String(v).trim();
        return text.length < 65 && /[a-z]/i.test(text) &&
          !/@/.test(text) && !/^(?:\+?\d[\d\s().-]{6,}|\d{4}[-/]\d+)/.test(text);
      });
      if (labelLike) headerIndex = firstNonEmpty;
    }

    const headers = headerIndex >= 0 ? safeRows[headerIndex] || [] : [];
    const matches = matchedColumns(headers);
    const schemaScore = headerIndex < 0 ? 0
      : (matches.name >= 0 ? 12 : 0)
      + (matches.phone >= 0 ? 9 : 0)
      + (matches.email >= 0 ? 9 : 0)
      + (matches.notes >= 0 ? 2 : 0)
      + (matches.extra >= 0 ? 4 : 0);

    let title = '';
    if (headerIndex > 0) {
      for (let i = 0; i < headerIndex; i++) {
        const nonempty = (safeRows[i] || []).map(v => String(v == null ? '' : v).trim()).filter(Boolean);
        if (nonempty.length === 1 && nonempty[0].length >= 12 && nonempty[0].length <= 200) {
          title = nonempty[0];
          break;
        }
      }
    }

    const dataStart = headerIndex >= 0 ? headerIndex + 1 : Math.max(0, firstNonEmpty);
    const dataRows = safeRows.slice(dataStart).filter(row =>
      Array.isArray(row) && row.some(v => String(v == null ? '' : v).trim() !== '')
    ).length;

    return {
      headerIndex,
      headerRowNumber: headerIndex < 0 ? null : firstRowNumber + headerIndex,
      firstRowNumber,
      columnCount,
      matches,
      schemaScore,
      title,
      dataRows
    };
  }

  function analyzeWorkbook(workbook) {
    if (!workbook || !Array.isArray(workbook.SheetNames) || !root.XLSX) return [];
    return workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      if (!sheet || !sheet['!ref']) return null;
      const firstRowNumber = root.XLSX.utils.decode_range(sheet['!ref']).s.r + 1;
      const rows = root.XLSX.utils.sheet_to_json(sheet, {
        header: 1, raw: false, defval: '', blankrows: true
      });
      const layout = analyzeRows(rows, firstRowNumber);
      if (!layout.dataRows || !layout.columnCount) return null;
      return { name, rows, ...layout };
    }).filter(Boolean).sort((a, b) =>
      (b.schemaScore + Math.min(b.dataRows, 500) * 0.005) -
      (a.schemaScore + Math.min(a.dataRows, 500) * 0.005)
    );
  }

  const api = { normalizeHeader, bestHeaderMatch, matchedColumns, analyzeRows, analyzeWorkbook };
  root.ContactImporterSpreadsheet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
