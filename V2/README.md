# FY27 CoE Portfolio Pulse V2

V2 is the bidirectional version. V1 remains the stable static dashboard in the parent folder.

## Target behavior

- Google Sheet is the single source of truth.
- Dashboard reads current rows from the team sheet.
- Dashboard edits update the team sheet.
- New rows and columns are written to the team sheet.
- Sheet edits appear after refresh or polling.
- Access is limited to approved company accounts.

## Setup

1. Open the team Google Sheet.
2. Choose **Extensions > Apps Script**.
3. In the Apps Script editor, click the **+** next to Files, choose **Script**, name it `DashboardApi`, and copy `Code.gs` into that new file. Do not replace the existing alert automation file.
4. Confirm `spreadsheetId`, `sheetGid`, and `allowedDomain` in `CONFIG`.
5. Confirm the project does not already define `doGet` or `doPost`; if it does, those functions must be merged rather than duplicated.
6. Deploy as a web app for approved company users only.
7. Do not choose anonymous access.
8. Connect the V2 dashboard to the deployed Apps Script URL.

## Important security note

The current V1 GitHub Pages dashboard is static and cannot write to the Google Sheet. V2 should be hosted behind company authentication, ideally in Salesforce Experience Cloud or as an authenticated Apps Script HTML app. Do not place Google OAuth tokens or service-account keys in browser JavaScript.

The Apps Script endpoint uses a script lock so two simultaneous edits do not overwrite each other. The production version should also add audit logging, validation for allowed columns and values, and optimistic concurrency checks using an `Updated At` field.
