<p align="center">
  <img src="./assets/logo.svg" alt="ContactImporter" width="560">
</p>

<p align="center">
  Excel/CSV → VCF contact importer with customizable mapping, campaign metadata, and a permanent Google Sheets backend.
</p>

# ContactImporter

ContactImporter converts spreadsheet contact data into a single `.vcf` file for bulk import into phone/contact applications. Spreadsheet parsing and VCF generation happen in the browser. A permanent Google Apps Script backend can sync validated contacts to the designated Google Sheet when the user explicitly requests it.

## Features

- Import `.xlsx`, `.xls`, and `.csv` files.
- Drag-and-drop or file-picker upload.
- Custom column mapping for **Name**, **Phone Number**, **E-mail**, and **Notes**.
- Auto-detects common Indonesian and English contact headers.
- Exports only rows containing a Full Name plus a Phone Number, E-mail, or both.
- Normalizes Indonesian-style name capitalization before export.
- Supports event/campaign name, lead source, category, batch notes, and per-contact spreadsheet notes.
- Custom saved-name formats for campaign contacts.
- Live contact preview and import statistics.
- Generates one bulk VCF file in the browser.
- Tab-based responsive interface aligned with the CGV Knowledge Academy design system.
- Forced update prompt for newer GitHub Pages deployments.
- Permanent Google Sheets + Apps Script backend with manual push/pull sync.

## Spreadsheet mapping

The first worksheet is used and row 1 is treated as the header row.

After import, choose which spreadsheet columns represent:

- Full Name — required
- Phone Number — optional
- E-mail — optional
- Notes — optional

A row is included only when it matches:

```text
Full Name AND (Phone Number OR E-mail)
```

Notes do not make an otherwise invalid row exportable.

## Name normalization

ContactImporter cleans repeated spaces and normalizes name capitalization before writing the VCF. It preserves common initials and handles common Indonesian/foreign name particles such as `bin`, `binti`, `al`, `van`, and `de` without attempting to guess or replace a person's actual name.

## Campaign metadata

Each exported contact can include:

- Event / Campaign Name
- Lead Source
- Category
- Per-contact mapped Notes
- Batch-level Additional Note

Campaign information can also be appended or prepended to the saved contact name.

## Permanent Google Sheets backend

ContactImporter includes the Google Apps Script backend in:

```text
google-apps-script/
├── Code.gs
├── appsscript.json
└── README.md
```

The production frontend is permanently locked to:

```text
https://script.google.com/macros/s/AKfycbyLKEpsopYNkJlMf_65tfOyyPwTeOXUnl-Juk7gXX4R9nSOj4PmGpdT3ILL0cO-v_5fsw/exec
```

Users cannot replace, edit, save, or disconnect the backend from the ContactImporter interface. Changing the endpoint requires changing the repository and deploying a new ContactImporter build.

The backend supports:

- connection health checks
- upsert/sync of current contacts
- loading saved contacts back into ContactImporter
- sync history logging
- de-duplication by phone first, then e-mail

### Apps Script setup / update

1. Open the Google Sheet that should permanently store ContactImporter data.
2. Open **Extensions → Apps Script**.
3. Copy the current `google-apps-script/Code.gs` into the project.
4. Run `setupContactImporterBackend()` once and authorize it.
5. Use **Deploy → Manage deployments** and update the existing production Web App deployment to the new script version.
6. Keep **Execute as: Me** and **Who has access: Anyone** so the GitHub Pages frontend can call it.
7. Keep the same `/exec` URL shown above.

The permanent backend release no longer requires a frontend-editable access key.

See [`google-apps-script/README.md`](./google-apps-script/README.md) for the full backend guide.

## Privacy

The uploaded spreadsheet is parsed locally in the browser.

Contact data is sent to Google Sheets only when the user explicitly presses **Sync current contacts**. Automatic upload is not enabled.

The backend endpoint is fixed in the public frontend source. UI locking prevents ordinary users from changing it in the app, but it is not an authentication boundary; a public Apps Script endpoint can still be called directly by someone who knows the URL.

External CDN assets currently used by the interface include SheetJS and Lucide Icons.

## Run locally

Because the frontend is static, it can be served with any static web server.

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## GitHub Pages deployment

The repository includes:

```text
.github/workflows/pages.yml
```

Every push to `main` triggers a GitHub Pages deployment.

Production URL:

```text
https://cgvlpl.github.io/ContactImporter/
```

## Project structure

```text
ContactImporter/
├── .github/workflows/pages.yml
├── assets/
│   ├── logo.svg
│   └── logo-mark.svg
├── google-apps-script/
│   ├── Code.gs
│   ├── appsscript.json
│   └── README.md
├── index.html
├── app.js
├── app-core.js
├── app-export.js
├── app-runtime-fix.js
├── column-mapping.js
├── google-sheets-backend.js
├── tab-ui.js
├── update-check.js
├── styles.css
├── styles-1.css
├── styles-2.css
├── styles-3.css
├── styles-4.css
├── styles-brand.css
├── styles-mapping.css
├── styles-tabs.css
├── styles-knowledge-academy.css
├── styles-no-global-header.css
└── styles-backend.css
```

## Logo assets

- `assets/logo.svg` — full ContactImporter logotype.
- `assets/logo-mark.svg` — square icon/favicon mark.

## License

No license has been specified yet.