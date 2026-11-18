// Append-only audit log. One JSON object per line (JSONL) so it stays greppable and
// diffable with no database. Every decision and custodian action is recorded here.

const fs = require('fs');
const path = require('path');

const AUDIT_PATH = path.join(__dirname, 'audit.jsonl');

function appendAudit(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  fs.appendFileSync(AUDIT_PATH, line + '\n');
  return line;
}

function readAudit() {
  if (!fs.existsSync(AUDIT_PATH)) return [];
  return fs
    .readFileSync(AUDIT_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

module.exports = { appendAudit, readAudit, AUDIT_PATH };
