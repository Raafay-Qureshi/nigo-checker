// Rules engine: loads every rule in rules/, runs it against a packet, and decides.
//
// A packet goes to REVIEW when any `block` rule fails, OR any required field's
// extraction confidence is below the threshold. `warn` failures are surfaced but never
// block. Clean + confident packets PASS.

const fs = require('fs');
const path = require('path');
const config = require('./config');

const RULES_DIR = path.join(__dirname, 'rules');

function loadRules() {
  return fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .sort()
    .map((f) => require(path.join(RULES_DIR, f)));
}

const RULES = loadRules();

// Read a dotted path like "owner.ssn" from an object.
function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Required fields whose confidence is below threshold. `confidence` is a flat map of
// dotted path -> number; a path not present is treated as fully confident (1.0), which
// is the right default for ground-truth fixtures that carry no confidence.
function lowConfidenceFields(confidence, threshold) {
  const conf = confidence || {};
  return config.requiredFields.filter((f) => (conf[f] == null ? 1 : conf[f]) < threshold);
}

function evaluate(packet, confidence = {}, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const threshold = opts.threshold != null ? opts.threshold : config.confidenceThreshold;
  const ctx = { now };

  const results = RULES.map((r) => {
    const out = r.check(packet, ctx);
    return {
      id: r.id,
      severity: r.severity,
      description: r.description,
      pass: out.pass,
      message: out.pass ? null : out.message,
      fields: out.fields || [],
    };
  });

  const lowConf = lowConfidenceFields(confidence, threshold);
  const blockingFailures = results.filter((r) => !r.pass && r.severity === 'block');
  const warnings = results.filter((r) => !r.pass && r.severity === 'warn');

  const decision = blockingFailures.length > 0 || lowConf.length > 0 ? 'review' : 'pass';

  return { decision, results, blockingFailures, warnings, lowConfidence: lowConf, threshold };
}

// Plain-English "fix these before resubmitting" summary for the advisor.
function nigoSummary(evaluation) {
  const lines = [];
  for (const r of evaluation.blockingFailures) lines.push(`- [${r.id}] ${r.message}`);
  for (const f of evaluation.lowConfidence) lines.push(`- [low confidence] Please confirm "${f}" — the value was unclear on the packet.`);
  if (lines.length === 0) return 'No blocking issues. Packet is in good order.';
  return 'Fix these before resubmitting:\n' + lines.join('\n');
}

module.exports = { evaluate, nigoSummary, loadRules, RULES };
