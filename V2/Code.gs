const DASHBOARD_CONFIG = {
  spreadsheetId: '1n5rdr2Zz-VCM9PUms51wy4jf5TRl52OEMms-UL0DnKk',
  sheetGid: 1440766748,
  allowedDomain: 'salesforce.com'
};

function getDashboardSheet_() {
  const spreadsheet = SpreadsheetApp.openById(DASHBOARD_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheets().find(item => item.getSheetId() === DASHBOARD_CONFIG.sheetGid);
  if (!sheet) throw new Error('Configured team sheet tab was not found.');
  return sheet;
}

function dashboardUserIsAllowed_() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  return email && email.endsWith('@' + DASHBOARD_CONFIG.allowedDomain);
}

function readDashboardPortfolio_() {
  const sheet = getDashboardSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return { headers: [], rows: [] };
  return { headers: values[1], rows: values.slice(2).filter(row => row[0]) };
}

function doGet() {
  if (!dashboardUserIsAllowed_()) return HtmlService.createHtmlOutput('Access denied. Use an approved company account.');
  return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('FY27 CoE Portfolio Pulse');
}

function getDashboardData() {
  if (!dashboardUserIsAllowed_()) throw new Error('Access denied. Use an approved company account.');
  return readDashboardPortfolio_();
}

function saveDashboardData(data) {
  if (!dashboardUserIsAllowed_()) throw new Error('Access denied. Use an approved company account.');
  if (!data || !Array.isArray(data.headers) || !Array.isArray(data.rows)) {
    throw new Error('This function must be called from the V2 dashboard Save changes button.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getDashboardSheet_();
    const headers = data.headers || [];
    const rows = data.rows || [];
    const existing = sheet.getDataRange().getDisplayValues();
    const idColumn = headers.indexOf('Item ID');
    if (idColumn < 0) throw new Error('Item ID column was not found.');
    headers.forEach((header, index) => {
      if (!existing[1] || existing[1][index] !== header) sheet.getRange(2, index + 1).setValue(header);
    });
    rows.forEach(row => {
      const id = row[idColumn];
      if (!id) return;
      const existingIndex = existing.findIndex((item, index) => index > 1 && item[0] === id);
      const targetRow = existingIndex > 1 ? existingIndex + 1 : Math.max(sheet.getLastRow() + 1, 3);
      sheet.getRange(targetRow, 1, 1, headers.length).setValues([headers.map((_, index) => row[index] || '')]);
    });
    return { ok: true, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function doPost(request) {
  if (!dashboardUserIsAllowed_()) return dashboardJson_({ error: 'Access denied. Use an approved company account.' });
  const body = JSON.parse(request.postData.contents || '{}');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getDashboardSheet_();
    const values = sheet.getDataRange().getDisplayValues();
    const headers = values[1] || [];
    const idColumn = headers.indexOf('Item ID');
    if (idColumn < 0) throw new Error('Item ID column was not found.');
    if (body.action === 'addColumn') {
      const name = String(body.name || '').trim();
      if (!name || headers.includes(name)) throw new Error('Column name is empty or already exists.');
      sheet.getRange(2, headers.length + 1).setValue(name);
      return dashboardJson_({ ok: true, action: 'addColumn', name });
    }
    if (body.action === 'upsert') {
      const row = body.row || {};
      const id = String(row['Item ID'] || '').trim();
      if (!id) throw new Error('Item ID is required.');
      const existingIndex = values.findIndex((item, index) => index > 1 && item[idColumn] === id);
      const targetRow = existingIndex > 1 ? existingIndex + 1 : Math.max(sheet.getLastRow() + 1, 3);
      const output = headers.map(header => row[header] == null ? '' : row[header]);
      sheet.getRange(targetRow, 1, 1, headers.length).setValues([output]);
      return dashboardJson_({ ok: true, action: 'upsert', id });
    }
    throw new Error('Unsupported action. Use upsert or addColumn.');
  } finally {
    lock.releaseLock();
  }
}

function dashboardJson_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
