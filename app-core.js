let contacts = [];
    let skippedRows = 0;

    const excelFile = document.getElementById("excelFile");
    const uploadZone = document.getElementById("uploadZone");
    const browseBtn = document.getElementById("browseBtn");
    const demoBtn = document.getElementById("demoBtn");
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
      if (targetId === "overviewSection") setStatus("Overview", "");
      if (targetId === "contactsSection") setStatus(contacts.length ? `${contacts.length} contacts ready` : "Contacts preview", contacts.length ? "success" : "");
      if (targetId === "campaignSection") setStatus("Campaign section", "");
      if (targetId === "importSection") setStatus("Import section", "");
      if (targetId === "settingsSection") setStatus("Settings section", "");
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
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) setActiveNav(visible[0].target.id);
      }, {
        root: null,
        rootMargin: "-15% 0px -65% 0px",
        threshold: [0.01, 0.15, 0.35]
      });
      observedSections.forEach(section => sectionObserver.observe(section));
    }

    browseBtn.addEventListener("click", function(event) {
      event.stopPropagation();
      excelFile.click();
    });

    demoBtn.addEventListener("click", function(event) {
      event.stopPropagation();
      loadDemoData();
    });

    refreshBtn.addEventListener("click", function() {
      if (!contacts.length) {
        setStatus("Nothing to refresh yet", "error");
        return;
      }
      renderPreview();
      setStatus("Preview refreshed", "success");
    });

    resetBtn.addEventListener("click", resetProgram);
    downloadBtn.addEventListener("click", downloadVCF);

    uploadZone.addEventListener("click", function(event) {
      if (event.target.closest("button") || event.target.closest("input")) return;
      excelFile.click();
    });

    excelFile.addEventListener("change", function(event) {
      const file = event.target.files && event.target.files[0];
      if (file) readSpreadsheetFile(file);
    });

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

    [eventNameInput, nameFormatInput, sourceInput, categoryInput, noteInput].forEach(el => {
      el.addEventListener("input", updateLiveUI);
      el.addEventListener("change", updateLiveUI);
    });

    function readSpreadsheetFile(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellText: true,
            cellDates: false
          });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            raw: false,
            defval: ""
          });
          parseRows(rows);
          fileChip.style.display = "block";
          fileChip.textContent = file.name;
          updateStats();
          updateDownloadState();
          if (contacts.length) {
            renderPreview();
            setStatus(contacts.length + " contacts ready", "success");
          } else {
            clearPreview("No valid contacts found. Each contact must have a Full Name and either a Phone Number, E-mail, or both.");
            setStatus("No valid contacts found", "error");
          }
        } catch (error) {
          console.error(error);
          clearPreview("The spreadsheet could not be read. Please verify the file type and make sure the first sheet contains your data.");
          setStatus("Could not read file", "error");
          updateStats();
          updateDownloadState();
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
        const phone = cleanPhone(row[3]);
        const email = cleanValue(row[4]);
        if (!fullName && !phone && !email) continue;
        if (!fullName || (!phone && !email)) {
          skippedRows++;
          continue;
        }
        contacts.push({ fullName, phone, email });
      }
    }

    function loadDemoData() {
      contacts = [
        { fullName: normalizeIndonesianName("sophia caldwell"), phone: "+628123456789", email: "sophia@example.com" },
        { fullName: normalizeIndonesianName("emily davis"), phone: "", email: "emily@company.com" },
        { fullName: normalizeIndonesianName("michael brown"), phone: "+628777654321", email: "" },
        { fullName: normalizeIndonesianName("john smith"), phone: "+628112223334", email: "john.smith@example.com" }
      ];
      skippedRows = 2;
      fileChip.style.display = "block";
      fileChip.textContent = "Demo data loaded";
      updateStats();
      updateDownloadState();
      renderPreview();
      setStatus("Demo data loaded", "success");
    }

    function cleanValue(value) {
      if (value === null || value === undefined) return "";
      return String(value).trim();
    }

    function normalizeIndonesianName(value) {
      let name = cleanValue(value);
      if (!name) return "";
      name = name.replace(/\s+/g, " ");
      const lowerParticles = new Set(["bin", "binti", "ibn", "van", "von", "de", "da", "del", "der", "al", "el"]);
      const normalizeSegment = segment => {
        if (!segment) return segment;
        if (/^[A-Za-z]\.?$/.test(segment)) {
          return segment.charAt(0).toUpperCase() + (segment.endsWith(".") ? "." : "");
        }
        if (/^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/.test(segment)) return segment.toUpperCase();
        const lower = segment.toLocaleLowerCase("id-ID");
        return lower.split(/([\-’'])/).map(part => {
          if (part === "-" || part === "'" || part === "’") return part;
          if (!part) return part;
          return part.charAt(0).toLocaleUpperCase("id-ID") + part.slice(1);
        }).join("");
      };
      return name.split(" ").map((word, index) => {
        const plain = word.replace(/[.,]+$/g, "").toLocaleLowerCase("id-ID");
        if (index > 0 && lowerParticles.has(plain)) {
          const suffixMatch = word.match(/[.,]+$/);
          return plain + (suffixMatch ? suffixMatch[0] : "");
        }
        return normalizeSegment(word);
      }).join(" ");
    }
