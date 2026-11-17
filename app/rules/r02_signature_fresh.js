const { parseDate, daysBetween } = require('./_util');

module.exports = {
  id: 'R02',
  severity: 'block',
  description: 'Signature date must not be in the future nor older than 90 days',
  check(p, ctx) {
    const d = parseDate(p.signature && p.signature.date);
    if (!d) return { pass: true }; // R01 owns the missing-signature case
    const now = ctx.now;
    if (d > now) return { pass: false, message: 'Signature date is in the future', fields: ['signature.date'] };
    const age = daysBetween(now, d);
    if (age > 90) return { pass: false, message: `Signature is ${age} days old (older than 90)`, fields: ['signature.date'] };
    return { pass: true };
  },
};
