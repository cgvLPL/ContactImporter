function cleanPhone(phone) {
      if (!phone) return "";
      let cleaned = String(phone).trim().replace(/[^\d+]/g, "");
      if (!cleaned) return "";
      if (cleaned.includes("+")) {
        cleaned = "+" + cleaned.replace(/\+/g, "");
      }
      return cleaned;
    }

    function getMarketingSettings() {
      return {
        event: eventNameInput.value.trim(),
        nameFormat: nameFormatInput.value,
        source: sourceInput.value.trim(),
        category: categoryInput.value.trim(),
        note: noteInput.value.trim()
      };
    }

    function buildContactName(originalName, event, format) {
      originalName = normalizeIndonesianName(originalName);
      if (!event) return originalName;
      switch (format) {
        case "event-name":
          return event + " — " + originalName;
        case "name-event":
          return originalName + " — " + event;
        case "event-bracket":
          return originalName + " [" + event + "]";
        default:
          return originalName;
      }
    }

    function escapeVCF(value) {
      if (!value) return "";
      return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
    }

    function contactNoteValue(contact) {
      if (!contact) return "";
      return cleanValue(contact.note || contact.notes || "");
    }

    function buildMarketingNote(settings, contactNote) {
      const lines = [];
      if (contactNote) lines.push("Contact Note: " + contactNote);
      if (settings.event) lines.push("Event/Campaign: " + settings.event);
      if (settings.source) lines.push("Lead Source: " + settings.source);
      if (settings.category) lines.push("Category: " + settings.category);
      if (settings.note) lines.push("Additional Info: " + settings.note);
      return lines.join("\n");
    }

    function createVCF() {
      const settings = getMarketingSettings();
      let vcf = "";
      contacts.forEach(contact => {
        if (!contact.fullName || (!contact.phone && !contact.email)) return;
        const savedName = buildContactName(contact.fullName, settings.event, settings.nameFormat);
        const note = buildMarketingNote(settings, contactNoteValue(contact));
        vcf += "BEGIN:VCARD\r\n";
        vcf += "VERSION:3.0\r\n";
        vcf += "N:;" + escapeVCF(savedName) + ";;;\r\n";
        vcf += "FN:" + escapeVCF(savedName) + "\r\n";
        if (contact.phone) {
          vcf += "TEL;TYPE=CELL:" + escapeVCF(contact.phone) + "\r\n";
        }
        if (contact.email) {
          vcf += "EMAIL;TYPE=INTERNET:" + escapeVCF(contact.email) + "\r\n";
        }
        if (settings.event) {
          vcf += "ORG:" + escapeVCF(settings.event) + "\r\n";
        }
        if (settings.category) {
          vcf += "CATEGORIES:" + escapeVCF(settings.category) + "\r\n";
        }
        if (note) {
          vcf += "NOTE:" + escapeVCF(note) + "\r\n";
        }
        vcf += "END:VCARD\r\n";
      });
      return vcf;
    }

    function downloadVCF() {
      if (!contacts.length) {
        setStatus("There are no contacts to export", "error");
        return;
      }
      const content = createVCF();
      if (!content.trim()) {
        setStatus("The VCF is empty", "error");
        return;
      }
      const settings = getMarketingSettings();
      let filename = settings.event || "Marketing_Contacts";
      filename = filename.replace(/[^a-z0-9_-]/gi, "_").replace(/_+/g, "_");
      const blob = new Blob([content], { type: "text/vcard;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename + ".vcf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(contacts.length + " contacts exported", "success");
    }

    function renderPreview() {
      const settings = getMarketingSettings();
      previewBody.innerHTML = "";
      contacts.forEach((contact, index) => {
        const savedName = buildContactName(contact.fullName, settings.event, settings.nameFormat);
        const tr = document.createElement("tr");
        const phoneHTML = contact.phone ? escapeHTML(contact.phone) : '<span class="mini-badge">No phone</span>';
        const emailHTML = contact.email ? escapeHTML(contact.email) : '<span class="mini-badge">No e-mail</span>';
        const contactNote = contactNoteValue(contact);
        const noteHTML = contactNote ? escapeHTML(contactNote) : '<span class="mini-badge">No notes</span>';
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>
            <div class="name-cell">
              <div class="avatar">${escapeHTML(getInitials(savedName))}</div>
              <span>${escapeHTML(savedName)}</span>
            </div>
          </td>
          <td>${phoneHTML}</td>
          <td>${emailHTML}</td>
          <td>${noteHTML}</td>
          <td>${settings.event ? escapeHTML(settings.event) : "—"}</td>
          <td>${settings.source ? escapeHTML(settings.source) : "—"}</td>
          <td>${settings.category ? escapeHTML(settings.category) : "—"}</td>
        `;
        previewBody.appendChild(tr);
      });
      previewTable.style.display = contacts.length ? "table" : "none";
      emptyState.style.display = contacts.length ? "none" : "block";
    }

    function clearPreview(message) {
      previewBody.innerHTML = "";
      previewTable.style.display = "none";
      emptyState.style.display = "block";
      emptyState.textContent = message || "No preview available.";
    }

    function updateStats() {
      const phoneCount = contacts.filter(item => item.phone).length;
      const emailCount = contacts.filter(item => item.email).length;
      validCountBox.textContent = contacts.length;
      phoneCountBox.textContent = phoneCount;
      emailCountBox.textContent = emailCount;
      skippedCountBox.textContent = skippedRows;
    }

    function updateDownloadState() {
      downloadBtn.disabled = !contacts.length;
    }

    function updateLiveUI() {
      const settings = getMarketingSettings();
      heroEvent.textContent = settings.event || "Untitled campaign";
      heroSource.textContent = settings.source || "No source";
      heroCategory.textContent = settings.category || "No category";
      if (contacts.length) renderPreview();
    }

    function setStatus(message, type) {
      statusBadge.textContent = message;
      statusBadge.className = "status";
      if (type) statusBadge.classList.add(type);
    }

    function getInitials(name) {
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "?";
    }

    function escapeHTML(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function resetProgram() {
      contacts = [];
      skippedRows = 0;
      excelFile.value = "";
      fileChip.style.display = "none";
      fileChip.textContent = "";
      eventNameInput.value = "";
      nameFormatInput.value = "name";
      sourceInput.value = "";
      categoryInput.value = "";
      noteInput.value = "";
      updateStats();
      updateDownloadState();
      updateLiveUI();
      clearPreview("Import a spreadsheet to begin. Valid contacts will appear here after column mapping.");
      setStatus("Waiting for file");
    }

    resetProgram();
    initIcons();