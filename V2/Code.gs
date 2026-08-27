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
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return { headers: [], rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const headers = values[0];
  const rows = values.slice(1).filter(row => row[0]);
  const dueDateColumn = headers.indexOf('Target Due Date');
  const phaseColumn = headers.indexOf('Phase');
  const updatedColumn = headers.indexOf('Last Updated Date');
  if (!headers.includes('Due-Date Status')) {
    headers.push('Due-Date Status');
    rows.forEach(row => row.push(deriveDueStatus_(row[dueDateColumn], row[phaseColumn])));
  }
  if (!headers.includes('Executive Attention Required')) {
    headers.push('Executive Attention Required');
    rows.forEach(row => row.push(updatedColumn >= 0 && row[updatedColumn] ? 'No' : 'Yes'));
  }
  return { headers, rows };
}

function deriveDueStatus_(value, phase) {
  const text = String(value || '').trim();
  if (['Completed', 'Canceled', 'Cancelled'].includes(phase)) return phase === 'Completed' ? 'Completed' : 'Canceled';
  if (!text || /^tbd$|^none$/i.test(text)) return 'No Date / TBD';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return 'No Date / TBD';
  const days = Math.ceil((date - new Date()) / 86400000);
  if (days < 0) return 'Overdue';
  if (days <= 7) return 'Due Soon (≤7 days)';
  if (days <= 30) return 'Due Soon (≤30 days)';
  return 'On Track';
}

function doGet() {
  if (!dashboardUserIsAllowed_()) return HtmlService.createHtmlOutput('Access denied. Use an approved company account.');
  return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('FY27 CoE Portfolio Pulse');
}

function getDashboardData() {
  if (!dashboardUserIsAllowed_()) throw new Error('Access denied. Use an approved company account.');
  const data = readDashboardPortfolio_();
  return { ...data, refreshedAt: new Date().toISOString(), availableFields: data.headers, rowCount: data.rows.length };
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
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const existing = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues() : [];
    const idColumn = headers.indexOf('Item ID');
    if (idColumn < 0) throw new Error('Item ID column was not found.');
    const liveHeaders = existing[0] || [];
    const derivedHeaders = ['Due-Date Status', 'Executive Attention Required'];
    const formulaColumns = sheet.getRange(2, 1, 1, lastColumn).getFormulas()[0];
    const editableColumns = liveHeaders.map((header, index) => ({
      sourceIndex: index,
      dataIndex: headers.indexOf(header)
    })).filter(column => column.dataIndex >= 0 && !derivedHeaders.includes(liveHeaders[column.sourceIndex]) && !formulaColumns[column.sourceIndex]);
    if (!liveHeaders.length || headers.filter(header => !derivedHeaders.includes(header)).some(header => !liveHeaders.includes(header))) throw new Error('The dashboard columns do not match the live sheet. Refresh before saving.');
    const existingById = new Map(existing.slice(1).map((row, index) => [row[idColumn], index + 3]));
    rows.filter(row => row[idColumn]).forEach(row => {
      const targetRow = existingById.get(row[idColumn]);
      if (!targetRow) {
        const newRow = Array(lastColumn).fill('');
        editableColumns.forEach(column => newRow[column.sourceIndex] = row[column.dataIndex] || '');
        sheet.getRange(sheet.getLastRow() + 1, 1, 1, lastColumn).setValues([newRow]);
        return;
      }
      editableColumns.forEach(column => sheet.getRange(targetRow, column.sourceIndex + 1).setValue(row[column.dataIndex] || ''));
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
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const values = lastRow >= 2 && lastColumn ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues() : [];
    const headers = values[0] || [];
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
      const existingIndex = values.findIndex((item, index) => index > 0 && item[idColumn] === id);
      const targetRow = existingIndex > 0 ? existingIndex + 2 : Math.max(sheet.getLastRow() + 1, 3);
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
