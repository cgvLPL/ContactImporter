# ContactImporter Google Sheets backend

This optional backend stores ContactImporter contacts in a Google Sheet through a Google Apps Script Web App. Spreadsheet parsing still happens in the browser; contacts are sent to Google Sheets only when the user explicitly presses **Sync current contacts**.

## 1. Create the Google Sheet

Create a new Google Sheet that will be dedicated to ContactImporter.

From that Sheet, open:

**Extensions → Apps Script**

Replace the default script with the contents of `Code.gs` from this folder.

If you use the Apps Script project manifest, enable **Show appsscript.json manifest file in editor** in Project Settings and copy `appsscript.json` as well.

## 2. Initialize the backend

In the Apps Script editor, select and run:

```text
setupContactImporterBackend
```

Approve the Google authorization prompt. The setup function creates:

- `Contacts`
- `SyncLog`

It also creates a backend access key and stores the target Spreadsheet ID in Script Properties.

Open **Executions** or the execution log and copy the value printed after:

```text
ContactImporter backend access key:
```

You can rotate the key later by running:

```text
rotateContactImporterAccessKey
```

## 3. Deploy as a Web App

In Apps Script choose:

**Deploy → New deployment → Web app**

Recommended settings:

- **Execute as:** Me
- **Who has access:** Anyone

Deploy and copy the Web App URL. Use the final `/exec` URL, for example:

```text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

## 4. Connect ContactImporter

Open the ContactImporter web app and go to the **Backend** tab.

Paste:

1. the Apps Script Web App `/exec` URL
2. the backend access key generated during setup

Press **Save settings**, then **Test connection**.

## Available operations

The frontend uses these backend actions:

- `health` — checks deployment and authentication state
- `upsertContacts` — inserts new contacts and updates matches
- `listContacts` — loads stored contacts back into ContactImporter

Contacts are de-duplicated during backend sync using phone number first, then e-mail when no phone number is available.

The `Contacts` sheet stores:

- Full Name
- Saved Name
- Phone
- E-mail
- Notes
- Event / Campaign
- Lead Source
- Category
- Batch Note
- Saved-name format
- Created / updated / last-synced timestamps

## Security note

The access key is a practical write/read guard for a lightweight Apps Script backend. In ContactImporter it is stored only in that browser's `localStorage`; it is not committed to this repository. It should not be treated as equivalent to OAuth or a server-side secret because a user who has access to the configured browser session can inspect it.

For a stricter corporate deployment, use Google Identity / Workspace authentication or place the Apps Script API behind an authenticated service.
