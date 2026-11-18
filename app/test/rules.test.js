const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { evaluate, RULES } = require('../engine');

const PACKETS_DIR = path.join(__dirname, '..', '..', 'fixtures', 'packets');
const NOW = '2026-11-20'; // fixed reference so R02/R05/R06 are deterministic

function loadPackets() {
  return fs
    .readdirSync(PACKETS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(PACKETS_DIR, f), 'utf8')));
}

const packets = loadPackets();
const evalOf = (p) => evaluate(p, p.confidence || {}, { now: NOW });

test('all 12 rules load', () => {
  assert.strictEqual(RULES.length, 12);
  assert.deepStrictEqual(RULES.map((r) => r.id).sort(), [
    'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12',
  ]);
});

test('we have 12 fixtures: 4 clean, 7 planted-NIGO, 1 low-confidence', () => {
  assert.strictEqual(packets.length, 12);
  const clean = packets.filter((p) => p._meta.clean && !p._meta.planted);
  const nigo = packets.filter((p) => p._meta.planted && p._meta.planted.startsWith('R'));
  const lowconf = packets.filter((p) => p._meta.planted === 'lowconf');
  assert.strictEqual(clean.length, 4);
  assert.strictEqual(nigo.length, 7);
  assert.strictEqual(lowconf.length, 1);
});

test('clean packets pass straight through (no clean packet wrongly blocked)', () => {
  for (const p of packets.filter((x) => x._meta.clean && !x._meta.planted)) {
    const e = evalOf(p);
    assert.strictEqual(e.decision, 'pass', `${p.id} should pass; failures: ${JSON.stringify(e.blockingFailures)}`);
    assert.strictEqual(e.blockingFailures.length, 0, `${p.id} had blocking failures`);
  }
});

test('every planted NIGO issue is caught by its rule and routes to review', () => {
  for (const p of packets.filter((x) => x._meta.planted && x._meta.planted.startsWith('R'))) {
    const e = evalOf(p);
    assert.strictEqual(e.decision, 'review', `${p.id} should route to review`);
    const caughtIds = e.blockingFailures.map((r) => r.id);
    assert.ok(caughtIds.includes(p._meta.planted), `${p.id}: planted ${p._meta.planted} not caught; caught ${JSON.stringify(caughtIds)}`);
  }
});

test('100% planted catch rate across the test set', () => {
  const planted = packets.filter((x) => x._meta.planted && x._meta.planted.startsWith('R'));
  const caught = planted.filter((p) => evalOf(p).blockingFailures.some((r) => r.id === p._meta.planted));
  assert.strictEqual(caught.length, planted.length, `caught ${caught.length}/${planted.length}`);
});

test('garbled packet (p12) passes all rules but routes to review on low confidence', () => {
  const p = packets.find((x) => x.id === 'p12');
  const e = evalOf(p);
  assert.strictEqual(e.blockingFailures.length, 0, 'p12 should have no rule failures');
  assert.strictEqual(e.decision, 'review', 'p12 should route to review via the confidence gate');
  assert.ok(e.lowConfidence.includes('owner.ssn'), 'p12 low-confidence field should be owner.ssn');
});

// --- targeted unit tests for rules not exercised by a planted packet ---

const base = () => JSON.parse(JSON.stringify(packets.find((x) => x.id === 'p01')));

test('R02 blocks a future signature date', () => {
  const p = base();
  p.signature.date = '2027-01-01';
  const r = evaluate(p, {}, { now: NOW }).results.find((x) => x.id === 'R02');
  assert.strictEqual(r.pass, false);
});

test('R02 blocks a stale signature (older than 90 days)', () => {
  const p = base();
  p.signature.date = '2026-07-01'; // > 90 days before NOW
  const r = evaluate(p, {}, { now: NOW }).results.find((x) => x.id === 'R02');
  assert.strictEqual(r.pass, false);
});

test('R06 blocks an under-18 owner', () => {
  const p = base();
  p.owner.dob = '2015-01-01';
  const r = evaluate(p, {}, { now: NOW }).results.find((x) => x.id === 'R06');
  assert.strictEqual(r.pass, false);
});

test('R10/R11/R12 are warnings and never change a clean pass to review', () => {
  const p = base();
  p.id_document.address = '999 Different St, Elsewhere, TX 70000'; // R10
  p.owner.affiliated_with_broker_dealer = '';                      // R11
  p.trusted_contact = null;                                        // R12
  const e = evaluate(p, {}, { now: NOW });
  assert.strictEqual(e.decision, 'pass', 'warnings must not block');
  assert.deepStrictEqual(e.warnings.map((w) => w.id).sort(), ['R10', 'R11', 'R12']);
});
