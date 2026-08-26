# ContactImporter

A browser-based Excel/CSV to VCF contact importer with a liquid-glass UI.

## Data mapping

- Column C: Full Name
- Column D: Phone Number
- Column E: E-mail
- A contact is exported only when Full Name is present and Phone Number or E-mail is present.
- Names are normalized for Indonesian-style capitalization before export.

## Marketing metadata

The app can attach an event/campaign name, lead source, category, and additional note to exported vCards.

## Privacy

Spreadsheet processing happens locally in the browser. The page does not upload the contact spreadsheet to a server.

## Deployment

GitHub Pages deployment is handled by `.github/workflows/pages.yml` on every push to `main`.

Expected Pages URL: `https://cgvlpl.github.io/ContactImporter/`
