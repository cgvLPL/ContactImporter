/* Shared client-side contact validation, duplicate review, and registration totals. */
(function (root) {
  'use strict';
  function digits(value) { return String(value == null ? '' : value).replace(/\D/g, ''); }
  function normalizePhone(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    let number = raw.replace(/[^\d+]/g, '');
    if (number.startsWith('0062')) number = '+62' + number.slice(4);
    else if (number.startsWith('62')) number = '+' + number;
    else if (number.startsWith('0') && number[1] === '8') number = '+62' + number.slice(1);
    else if (number.startsWith('8')) number = '+62' + number;
    else if (number.startsWith('+')) number = '+' + number.slice(1).replace(/\D/g, '');
    else number = number.replace(/\D/g, '');
    return number;
  }
  function validPhone(value) {
    const phone = normalizePhone(value);
    if (!phone) return false;
    if (phone.startsWith('+62')) return /^\+628\d{8,11}$/.test(phone);
    return /^\+[1-9]\d{7,14}$/.test(phone); // International E.164 range.
  }
  function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
  function validEmail(value) {
    const email = normalizeEmail(value);
    return email.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email);
  }
  function contactIssues(item) {
    const issues = [];
    if (!String(item.fullName || '').trim()) issues.push('Missing name');
    if (item.phone && !validPhone(item.phone)) issues.push('Check phone number');
    if (item.email && !validEmail(item.email)) issues.push('Check e-mail');
    if (!validPhone(item.phone) && !validEmail(item.email)) issues.push('No valid contact method');
    if (item.duplicate) issues.push('Possible duplicate');
    return issues;
  }
  function eligible(item) {
    return !!item && !item.excluded && !!String(item.fullName || '').trim() &&
      (validPhone(item.phone) || validEmail(item.email));
  }
  function duplicateGroups(items) {
    const parent = items.map((_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function unite(a, b) { const pa = find(a), pb = find(b); if (pa !== pb) parent[pb] = pa; }
    const phones = new Map(), emails = new Map();
    items.forEach((item, index) => {
      if (validPhone(item.phone)) {
        const key = normalizePhone(item.phone);
        if (phones.has(key)) unite(index, phones.get(key));
        else phones.set(key, index);
      }
      if (validEmail(item.email)) {
        const key = normalizeEmail(item.email);
        if (emails.has(key)) unite(index, emails.get(key));
        else emails.set(key, index);
      }
    });
    const groups = new Map();
    items.forEach((_, i) => { const key = find(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i); });
    return Array.from(groups.values()).filter(group => group.length > 1);
  }
  function attendeeCount(item) {
    const direct = Number(item.attendees);
    if (item.attendees !== '' && item.attendees != null && Number.isInteger(direct) && direct > 0 && direct <= 1000) return direct;
    const match = String(item.note || item.notes || '').match(/(?:jumlah\s+(?:penonton|peserta|tiket|orang)|(?:ticket|guest|attendee)\s+(?:count|quantity|qty))[^\r\n:]*:\s*(\d+)\b/i);
    const parsed = match ? Number(match[1]) : NaN;
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 1000 ? parsed : null;
  }
  function audit(items) {
    const groups = duplicateGroups(items);
    const duplicateRows = new Set(groups.flat());
    let review = 0, exportable = 0, seats = 0, unknownAttendance = 0, invalidPhones = 0;
    items.forEach((item, index) => {
      if (eligible(item)) exportable++;
      if (contactIssues(item).some(issue => issue !== 'Possible duplicate') || duplicateRows.has(index)) review++;
      if (item.phone && !validPhone(item.phone)) invalidPhones++;
      if (item.excluded) return;
      const count = attendeeCount(item);
      if (count == null) { seats += 1; unknownAttendance++; }
      else seats += count;
    });
    return { registrations: items.filter(item => !item.excluded).length, exportable, review,
      invalidPhones, duplicateGroups: groups, duplicateRows: duplicateRows.size,
      minimumSeats: seats, unknownAttendance };
  }
  const api = { normalizePhone, validPhone, normalizeEmail, validEmail, contactIssues,
    eligible, duplicateGroups, attendeeCount, audit };
  root.ContactImporterQuality = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
