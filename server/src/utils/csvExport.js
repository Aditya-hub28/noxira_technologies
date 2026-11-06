/**
 * RFC 4180 and spreadsheet-formula-safe CSV generator for NOXIRA application exports.
 * Columns: fullName, email, programCode, programTitle, applicationId, batchId
 */
function generateApplicationsCsv(applications = []) {
  const headers = ['fullName', 'email', 'programCode', 'programTitle', 'applicationId', 'batchId'];

  function sanitizeCell(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);

    // Formula injection safety: prefix with single quote if starts with =, +, -, @, \t, \r
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // RFC 4180 quoting: quote if contains comma, quote, \n, \r
    if (/[",\n\r]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const lines = [
    headers.join(','),
    ...applications.map((app) => headers.map((h) => sanitizeCell(app[h])).join(','))
  ];

  return lines.join('\r\n');
}

module.exports = { generateApplicationsCsv };
