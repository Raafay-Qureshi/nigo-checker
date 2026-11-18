// Tiny CLI around the real rules engine so Python (eval.py) can reuse it instead of
// reimplementing the rules. Reads {packet, confidence, now?} as JSON on stdin, prints
// the evaluation as JSON on stdout.
const { evaluate } = require('./engine');

let buf = '';
process.stdin.on('data', (d) => (buf += d));
process.stdin.on('end', () => {
  const { packet, confidence = {}, now } = JSON.parse(buf);
  const e = evaluate(packet, confidence, now ? { now } : {});
  process.stdout.write(JSON.stringify({
    decision: e.decision,
    blocking: e.blockingFailures.map((r) => r.id),
    warnings: e.warnings.map((r) => r.id),
    lowConfidence: e.lowConfidence,
  }));
});
