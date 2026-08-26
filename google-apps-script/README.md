# ContactImporter Google Sheets backend

ContactImporter uses one permanent Google Apps Script Web App as its Google Sheets backend. Spreadsheet parsing still happens in the browser; validated contacts are sent to Google Sheets only when the user explicitly presses **Sync current contacts**.

## Production endpoint

The ContactImporter frontend is locked to this Web App URL:

```text
https://script.google.com/macros/s/AKfycbyLKEpsopYNkJlMf_65tfOyyPwTeOXUnl-Juk7gXX4R9nSOj4PmGpdT3ILL0cO-v_5fsw/exec
```

There is no user-editable backend URL, access-key field, Save configuration control, or Disconnect control in the application. Changing the endpoint requires changing the repository and redeploying ContactImporter.

## 1. Attach Apps Script to the target Google Sheet

From the Google Sheet that should permanently store ContactImporter data, open:

**Extensions → Apps Script**

Replace the default script with the current `Code.gs` from this folder.

If you use the Apps Script project manifest, enable **Show appsscript.json manifest file in editor** in Project Settings and copy `appsscript.json` as well.

## 2. Initialize the backend

In Apps Script, run:

```text
setupContactImporterBackend
```

Approve the Google authorization prompt. The setup function creates or prepares:

- `Contacts`
- `SyncLog`

It also permanently stores the target Spreadsheet ID in Script Properties. The permanent backend release no longer uses a frontend access key.

If this Apps Script project previously used the legacy access-key release, `setupContactImporterBackend()` removes the old key automatically. You can also run:

```text
removeLegacyContactImporterAccessKey
```

## 3. Update the existing Web App deployment

In Apps Script choose:

**Deploy → Manage deployments**

Edit the deployment that corresponds to the production URL above, select a new version containing the latest `Code.gs`, and deploy it.

Recommended Web App settings:

- **Execute as:** Me
- **Who has access:** Anyone

Keep the same production `/exec` URL so ContactImporter does not need to be changed.

## Backend tab

The ContactImporter **Backend** tab is now status/action only. Users can:

- test the permanent connection
- sync current validated contacts
- load contacts from the permanent Google Sheet

Users cannot replace or disconnect the backend.

## Available operations

- `health` — checks whether the permanent Sheet/backend is ready
- `upsertContacts` — inserts new contacts and updates matches
- `listContacts` — loads stored contacts back into ContactImporter

Contacts are de-duplicated during backend sync using phone number first, then e-mail when no phone number is available.

The `Contacts` sheet stores Full Name, Saved Name, Phone, E-mail, Notes, Event / Campaign, Lead Source, Category, Batch Note, saved-name format, and created/updated/last-synced timestamps.

## Security note

The backend is permanent and unchangeable from the ContactImporter UI, but the GitHub Pages frontend and Apps Script Web App are still public client-side/web resources. UI locking is not an authentication boundary. Anyone who knows the public Web App URL may be able to call it directly if the deployment is set to **Anyone**.

For a stricter internal deployment, use Google Workspace identity/OAuth or place the backend behind an authenticated server-side service.