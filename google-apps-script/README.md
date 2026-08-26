# ContactImporter Google Sheets backend

ContactImporter uses one permanent Google Apps Script Web App as its Google Sheets backend. Spreadsheet parsing still happens in the browser; validated contacts are sent to Google Sheets only when the user explicitly presses **Sync current campaign**.

## Production endpoint

The ContactImporter frontend is locked to this Web App URL:

```text
https://script.google.com/macros/s/AKfycbyLKEpsopYNkJlMf_65tfOyyPwTeOXUnl-Juk7gXX4R9nSOj4PmGpdT3ILL0cO-v_5fsw/exec
```

There is no user-editable backend URL, access-key field, Save configuration control, or Disconnect control in the application. Changing the endpoint requires changing the repository and redeploying ContactImporter.

## Campaign history model

The backend keeps campaign history as a relational structure suitable for AppSheet:

- `Campaigns` contains one row per campaign.
- `Contacts` contains the contact data plus a `campaign_id` relationship.
- `SyncLog` records sync activity and the related campaign.

A contact is de-duplicated **inside a campaign**, not globally. This means the same phone number or e-mail can appear in Campaign A and Campaign B without one campaign overwriting the other.

The current contact key is effectively:

```text
campaign_id + phone
```

or, when no phone number is available:

```text
campaign_id + email
```

The Campaign tab in ContactImporter shows the saved campaign history and lets the user load only the contacts related to a selected campaign.

## 1. Attach Apps Script to the target Google Sheet

From the Google Sheet that should permanently store ContactImporter data, open:

**Extensions → Apps Script**

Replace the default script with the current `Code.gs` from this folder.

If you use the Apps Script project manifest, enable **Show appsscript.json manifest file in editor** in Project Settings and copy `appsscript.json` as well.

## 2. Initialize or upgrade the backend

In Apps Script, run:

```text
setupContactImporterBackend
```

Approve the Google authorization prompt. The setup function creates or prepares:

- `Contacts`
- `Campaigns`
- `SyncLog`

It also permanently stores the target Spreadsheet ID in Script Properties. Existing Contacts and SyncLog data are preserved because the new campaign columns are appended to the existing tables.

When upgrading from the older backend, `setupContactImporterBackend()` also rebuilds the Campaigns history from campaign information that still exists in Contacts. Campaigns that were already overwritten by the old global phone/e-mail upsert cannot be reconstructed automatically.

The permanent backend release no longer uses a frontend access key. If this project previously used the legacy access-key release, setup removes the old key automatically. You can also run:

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

## Backend and Campaign tabs

The ContactImporter **Backend** tab is status/action only. Users can:

- test the permanent connection
- sync the current campaign
- load all contacts from the permanent Google Sheet

The **Campaign** tab now includes Campaign History. Users can:

- see every synced campaign
- see the number of contact records related to each campaign
- see source/category and last-sync time
- open one campaign and load only its contacts into the workspace

Users cannot replace or disconnect the backend.

## Available operations

- `health` — checks whether the permanent Sheet/backend is ready
- `upsertContacts` — inserts or updates contacts within their related campaign
- `listContacts` — loads contacts, optionally filtered by `campaignId` or campaign name
- `listCampaigns` — returns campaign history with contact counts and timestamps

The `Contacts` sheet stores Full Name, Saved Name, Phone, E-mail, Notes, Event / Campaign, Lead Source, Category, Batch Note, saved-name format, timestamps, and `campaign_id`.

The `Campaigns` sheet stores campaign name, source, category, batch note, saved-name format, contact count, timestamps, and its stable `campaign_id`.

## AppSheet relation

In AppSheet, set `Campaigns[campaign_id]` as the key and configure `Contacts[campaign_id]` as a Ref to `Campaigns`. This lets AppSheet automatically show related contacts under each campaign.

## Security note

The backend is permanent and unchangeable from the ContactImporter UI, but the GitHub Pages frontend and Apps Script Web App are still public client-side/web resources. UI locking is not an authentication boundary. Anyone who knows the public Web App URL may be able to call it directly if the deployment is set to **Anyone**.

For a stricter internal deployment, use Google Workspace identity/OAuth or place the backend behind an authenticated server-side service.
