<p align="center">
  <img src="./assets/logo.svg" alt="ContactImporter" width="560">
</p>

<p align="center">
  A privacy-first Excel/CSV → VCF bulk contact importer with a liquid-glass interface.
</p>

# ContactImporter

ContactImporter converts spreadsheet contact data into a single `.vcf` file for bulk import into phone/contact applications. All spreadsheet parsing and VCF generation happen locally in the browser.

## Features

- Import `.xlsx`, `.xls`, and `.csv` files.
- Drag-and-drop or file-picker upload.
- Column C → Full Name.
- Column D → Phone Number.
- Column E → E-mail.
- Exports only rows containing a Full Name plus a Phone Number, E-mail, or both.
- Normalizes Indonesian-style name capitalization before export.
- Supports event/campaign name, lead source, category, and additional notes.
- Custom saved-name formats for campaign contacts.
- Live contact preview and import statistics.
- Generates one bulk VCF file entirely in the browser.
- Responsive extreme liquid-glass UI.

## Spreadsheet format

The first row is treated as the header row.

| Column | Field |
| --- | --- |
| C | Full Name |
| D | Phone Number |
| E | E-mail |

A row is included only when it matches this rule:

```text
Full Name AND (Phone Number OR E-mail)
```

Examples:

| Full Name | Phone | E-mail | Exported? |
| --- | --- | --- | --- |
| Budi Santoso | 08123456789 | budi@example.com | Yes |
| Siti Rahma | 08123456789 |  | Yes |
| Andi Pratama |  | andi@example.com | Yes |
| Rina Putri |  |  | No |
|  | 08123456789 | user@example.com | No |

## Name normalization

ContactImporter cleans repeated spaces and normalizes name capitalization before writing the VCF. It preserves common initials and handles common Indonesian/foreign name particles such as `bin`, `binti`, `al`, `van`, and `de` without attempting to guess or replace a person's actual name.

## Campaign metadata

Each exported contact can include:

- Event / Campaign Name
- Lead Source
- Category
- Additional Note

The campaign information can also be appended or prepended to the saved contact name.

## Privacy

ContactImporter is a static browser app. The uploaded spreadsheet is read locally with JavaScript and is not sent to an application server by the app.

External CDN assets currently used by the interface include SheetJS and Lucide Icons.

## Run locally

Because this is a static app, you can open `index.html` directly in a modern browser or serve the repository with any static web server.

Example:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## GitHub Pages deployment

The repository includes a GitHub Actions workflow at:

```text
.github/workflows/pages.yml
```

Every push to `main` triggers a GitHub Pages deployment.

Expected production URL:

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
├── index.html
├── app.js
├── app-core.js
├── app-export.js
├── styles.css
├── styles-1.css
├── styles-2.css
├── styles-3.css
├── styles-4.css
└── styles-brand.css
```

## Logo assets

- `assets/logo.svg` — full ContactImporter logotype.
- `assets/logo-mark.svg` — square icon/favicon mark.

## License

No license has been specified yet.
