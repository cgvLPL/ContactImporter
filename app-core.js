let contacts = [];
let skippedRows = 0;

const excelFile = document.getElementById("excelFile");
const uploadZone = document.getElementById("uploadZone");
const browseBtn = document.getElementById("browseBtn");
const downloadBtn = document.getElementById("downloadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resetBtn = document.getElementById("resetBtn");
const fileChip = document.getElementById("fileChip");

const previewTable = document.getElementById("previewTable");
const previewBody = document.getElementById("previewBody");
const emptyState = document.getElementById("emptyState");
const statusBadge = document.getElementById("statusBadge");

const validCountBox = document.getElementById("validCount");
const phoneCountBox = document.getElementById("phoneCount");
const emailCountBox = document.getElementById("emailCount");
const skippedCountBox = document.getElementById("skippedCount");

const eventNameInput = document.getElementById("eventName");
const nameFormatInput = document.getElementById("nameFormat");
const sourceInput = document.getElementById("source");
const categoryInput = document.getElementById("category");
const noteInput = document.getElementById("additionalNote");

const heroEvent = document.getElementById("heroEvent");
const heroSource = document.getElementById("heroSource");
const heroCategory = document.getElementById("heroCategory");

const navButtons = Array.from(document.querySelectorAll(".nav-button"));
const brandHome = document.getElementById("brandHome");

function initIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

initIcons();

function setActiveNav(targetId) {
  navButtons.forEach(button => {
    const isActive = button.dataset.target === targetId;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function goToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  setActiveNav(targetId);
  target.scrollIntoView({ behavior: "smooth", block: "start" });

  if (typeof setStatus === "function") {
    if (targetId === "overviewSection") setStatus("Overview", "");
    if (targetId === "contactsSection") setStatus(contacts.length ? `${contacts.length} contacts ready` : "Contacts preview", contacts.length ? "success" : "");
    if (targetId === "campaignSection") setStatus("Campaign section", "");
    if (targetId === "importSection") setStatus("Import section", "");
    if (targetId === "settingsSection") setStatus("Settings section", "");
  }
}

navButtons.forEach(button => {
  button.addEventListener("click", () => goToSection(button.dataset.target));
});

if (brandHome) {
  brandHome.addEventListener("click", () => goToSection("overviewSection"));
}

const observedSections = [
  "overviewSection",
  "importSection",
  "campaignSection",
  "settingsSection",
  "contactsSection"
].map(id => document.getElementById(id)).filter(Boolean);

if ("IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visible.length) setActiveNav(visible[0].target.id);
  }, {
    root: null,
    rootMargin: "-15% 0px -65% 0px",
    threshold: [0.01, 0.15, 0.35]
  });

  observedSections.forEach(section => sectionObserver.observe(section));
}

if (browseBtn && excelFile) {
  browseBtn.addEventListener("click", function(event) {
    event.stopPropagation();
    // Clear the input so choosing the same file again still triggers change.
    excelFile.value = "";
    excelFile.click();
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", function() {
    if (!contacts.length) {
      if (typeof setStatus === "function") setStatus("Nothing to refresh yet", "error");
      return;
    }

    if (typeof renderPreview === "function") renderPreview();
    if (typeof setStatus === "function") setStatus("Preview refreshed", "success");
  });
}

// app-export.js loads after this file. Resolve these functions only when clicked,
// instead of referencing them while app-core.js is still initializing.
if (resetBtn) {
  resetBtn.addEventListener("click", function() {
    if (typeof resetProgram === "function") resetProgram();
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", function() {
    if (typeof downloadVCF === "function") downloadVCF();
  });
}

if (uploadZone && excelFile) {
  uploadZone.addEventListener("click", function(event) {
    if (event.target.closest("button") || event.target.closest("input")) return;
    excelFile.value = "";
    excelFile.click();
  });
}

if (excelFile) {
  excelFile.addEventListener("change", function(event) {
    const file = event.target.files && event.target.files[0];
    if (file) readSpreadsheetFile(file);
  });
}

if (uploadZone) {
  ["dragenter", "dragover"].forEach(type => {
    uploadZone.addEventListener(type, function(event) {
      event.preventDefault();
      uploadZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    uploadZone.addEventListener(type, function(event) {
      event.preventDefault();
      uploadZone.classList.remove("dragover");
    });
  });

  uploadZone.addEventListener("drop", function(event) {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) readSpreadsheetFile(file);
  });
}

[eventNameInput, nameFormatInput, sourceInput, categoryInput, noteInput]
  .filter(Boolean)
  .forEach(el => {
    const refresh = () => {
      if (typeof updateLiveUI === "function") updateLiveUI();
    };
    el.addEventListener("input", refresh);
    el.addEventListener("change", refresh);
  });

function readSpreadsheetFile(file) {
  if (!file) return;

  if (fileChip) {
    fileChip.style.display = "block";
    fileChip.textContent = `Reading ${file.name}…`;
  }

  if (typeof setStatus === "function") {
    setStatus(`Reading ${file.name}…`, "");
  }

  if (!window.XLSX) {
    console.error("SheetJS XLSX parser is not available.");
    if (fileChip) fileChip.textContent = file.name;
    if (typeof clearPreview === "function") {
      clearPreview("The Excel parser could not load. Please refresh the page and try again.");
    }
    if (typeof setStatus === "function") {
      setStatus("Excel parser unavailable — refresh required", "error");
    }
    return;
  }

  const reader = new FileReader();

  reader.onerror = function() {
    console.error("FileReader failed while reading:", file.name);
    if (fileChip) fileChip.textContent = file.name;
    if (typeof clearPreview === "function") {
      clearPreview("The selected file could not be read by your browser.");
    }
    if (typeof setStatus === "function") setStatus("Could not read file", "error");
  };

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = window.XLSX.read(data, {
        type: "array",
        cellText: true,
        cellDates: false
      });

      if (!workbook.SheetNames || !workbook.SheetNames.length) {
        throw new Error("Spreadsheet has no worksheets");
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        raw: false,
        defval: ""
      });

      if (!rows.length) {
        throw new Error("Spreadsheet is empty");
      }

      parseRows(rows);

      if (fileChip) {
        fileChip.style.display = "block";
        fileChip.textContent = file.name;
      }

      if (typeof updateStats === "function") updateStats();
      if (typeof updateDownloadState === "function") updateDownloadState();

      if (contacts.length) {
        if (typeof renderPreview === "function") renderPreview();
        if (typeof setStatus === "function") {
          setStatus(`${contacts.length} contact${contacts.length === 1 ? "" : "s"} ready`, "success");
        }
      } else {
        if (typeof clearPreview === "function") {
          clearPreview("The file loaded, but no valid contacts match the selected column mapping. Choose the Name, Phone, and E-mail columns below.");
        }
        if (typeof setStatus === "function") setStatus("File loaded — check column mapping", "error");
      }
    } catch (error) {
      console.error("Spreadsheet import error:", error);
      if (fileChip) fileChip.textContent = file.name;
      if (typeof clearPreview === "function") {
        clearPreview("The spreadsheet could not be processed. Verify the file format and column mapping, then try again.");
      }
      if (typeof setStatus === "function") setStatus("Could not process spreadsheet", "error");
      if (typeof updateStats === "function") updateStats();
      if (typeof updateDownloadState === "function") updateDownloadState();
    }
  };

  reader.readAsArrayBuffer(file);
}

function parseRows(rows) {
  contacts = [];
  skippedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const fullName = normalizeIndonesianName(row[2]);
    const phone = typeof cleanPhone === "function" ? cleanPhone(row[3]) : cleanValue(row[3]);
    const email = cleanValue(row[4]);

    if (!fullName && !phone && !email) continue;

    if (!fullName || (!phone && !email)) {
      skippedRows++;
      continue;
    }

    contacts.push({ fullName, phone, email });
  }
}

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeIndonesianName(value) {
  let name = cleanValue(value);
  if (!name) return "";

  name = name.replace(/\s+/g, " ");

  const lowerParticles = new Set([
    "bin", "binti", "ibn", "van", "von", "de", "da", "del", "der", "al", "el"
  ]);

  const normalizeSegment = segment => {
    if (!segment) return segment;

    if (/^[A-Za-z]\.?$/.test(segment)) {
      return segment.charAt(0).toUpperCase() + (segment.endsWith(".") ? "." : "");
    }

    if (/^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/.test(segment)) {
      return segment.toUpperCase();
    }

    const lower = segment.toLocaleLowerCase("id-ID");

    return lower
      .split(/([\-’'])/)
      .map(part => {
        if (part === "-" || part === "'" || part === "’") return part;
        if (!part) return part;
        return part.charAt(0).toLocaleUpperCase("id-ID") + part.slice(1);
      })
      .join("");
  };

  return name
    .split(" ")
    .map((word, index) => {
      const plain = word.replace(/[.,]+$/g, "").toLocaleLowerCase("id-ID");

      if (index > 0 && lowerParticles.has(plain)) {
        const suffixMatch = word.match(/[.,]+$/);
        return plain + (suffixMatch ? suffixMatch[0] : "");
      }

      return normalizeSegment(word);
    })
    .join(" ");
}
