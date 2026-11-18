// NIGO Checker — Node/Express app.
// Serves the upload page and review queue, runs the rules engine, holds the mock
// custodian route, and writes the audit log. Extraction is delegated to the Python
// service at EXTRACTOR_URL (POST /extract).
//
// Demo / prototype, not affiliated with any brokerage or custodian. All data synthetic.

const express = require('express');
const multer = require('multer');
const path = require('path');

const { evaluate, nigoSummary } = require('./engine');
const { appendAudit, readAudit } = require('./audit');

const PORT = process.env.PORT || 3000;
const EXTRACTOR_URL = process.env.EXTRACTOR_URL || 'http://localhost:8001';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store of submissions (POC — no database; resets on restart).
const submissions = new Map();
let seq = 0;
const nextId = () => `S${String(++seq).padStart(4, '0')}`;

// Forward the uploaded PDFs to the Python extractor and return {packet, confidence}.
async function extract(files) {
  const form = new FormData();
  for (const f of files) {
    form.append('files', new Blob([f.buffer], { type: 'application/pdf' }), f.originalname);
  }
  const res = await fetch(`${EXTRACTOR_URL}/extract`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`extractor ${res.status}: ${await res.text()}`);
  return res.json();
}

// POST /upload — multipart PDFs. Extract -> evaluate -> auto-submit or queue for review.
app.post('/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  let extracted;
  try {
    extracted = await extract(req.files);
  } catch (e) {
    return res.status(502).json({ error: `Extraction failed: ${e.message}` });
  }
  const { packet, confidence = {} } = extracted;
  const evaluation = evaluate(packet, confidence);
  const id = nextId();
  const record = { id, packet, confidence, evaluation, status: evaluation.decision, createdAt: new Date().toISOString() };

  appendAudit({ event: 'intake', submissionId: id, packetId: packet.id || null, decision: evaluation.decision,
    blocking: evaluation.blockingFailures.map((r) => r.id), lowConfidence: evaluation.lowConfidence });

  if (evaluation.decision === 'pass') {
    submitToCustodian(record, 'auto');
    record.status = 'submitted';
  } else {
    submissions.set(id, record); // goes to the review queue
  }
  res.json({ id, decision: evaluation.decision, status: record.status,
    summary: nigoSummary(evaluation), evaluation });
});

// GET /review — list packets awaiting review.
app.get('/review', (req, res) => {
  const queue = [...submissions.values()].filter((r) => r.status === 'review').map((r) => ({
    id: r.id, packetId: r.packet.id, registration: r.packet.account && r.packet.account.registration_name,
    blocking: r.evaluation.blockingFailures.map((x) => ({ id: x.id, message: x.message })),
    lowConfidence: r.evaluation.lowConfidence, summary: nigoSummary(r.evaluation),
  }));
  res.json(queue);
});

// GET /review/:id — full record for the review screen.
app.get('/review/:id', (req, res) => {
  const r = submissions.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

// POST /review/:id/field — ops edits one field, then rules re-run.
app.post('/review/:id/field', (req, res) => {
  const r = submissions.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { path: dotted, value } = req.body;
  if (!dotted) return res.status(400).json({ error: 'path required' });
  setPath(r.packet, dotted, value);
  r.confidence[dotted] = 1; // a human-entered value is fully trusted
  r.evaluation = evaluate(r.packet, r.confidence);
  r.status = r.evaluation.decision === 'pass' ? 'ready' : 'review';
  appendAudit({ event: 'edit', submissionId: r.id, field: dotted, actor: req.body.actor || 'ops',
    decision: r.evaluation.decision });
  res.json({ id: r.id, status: r.status, decision: r.evaluation.decision,
    summary: nigoSummary(r.evaluation), evaluation: r.evaluation });
});

// POST /review/:id/approve — submit to custodian (only if nothing is blocking).
app.post('/review/:id/approve', (req, res) => {
  const r = submissions.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.evaluation.decision !== 'pass') return res.status(409).json({ error: 'Still has blocking issues; cannot submit' });
  submitToCustodian(r, req.body.actor || 'ops');
  r.status = 'submitted';
  submissions.delete(r.id);
  res.json({ id: r.id, status: 'submitted' });
});

// POST /review/:id/reject — ops rejects with a reason.
app.post('/review/:id/reject', (req, res) => {
  const r = submissions.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const reason = (req.body && req.body.reason) || 'No reason given';
  appendAudit({ event: 'reject', submissionId: r.id, packetId: r.packet.id, actor: req.body.actor || 'ops', reason });
  r.status = 'rejected';
  submissions.delete(r.id);
  res.json({ id: r.id, status: 'rejected', reason });
});

// POST /custodian/submit — MOCK custodian. Accepts the packet and logs it.
app.post('/custodian/submit', (req, res) => {
  const { packetId, registrationName } = req.body || {};
  if (!packetId) return res.status(400).json({ error: 'packetId required' });
  const custodianRef = `CUST-${Date.now()}`;
  appendAudit({ event: 'custodian_submit', packetId, registrationName: registrationName || null,
    actor: (req.body && req.body.actor) || 'system', custodianRef, accepted: true });
  res.json({ accepted: true, custodianRef });
});

// GET /audit — the full audit trail.
app.get('/audit', (req, res) => res.json(readAudit()));

// --- helpers ---

function submitToCustodian(record, actor) {
  const custodianRef = `CUST-${Date.now()}`;
  appendAudit({ event: 'custodian_submit', submissionId: record.id, packetId: record.packet.id,
    registrationName: record.packet.account && record.packet.account.registration_name,
    actor, custodianRef, accepted: true });
  record.custodianRef = custodianRef;
  return custodianRef;
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
  target[last] = value;
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`NIGO Checker on http://localhost:${PORT} (extractor: ${EXTRACTOR_URL})`));
}

module.exports = { app };
