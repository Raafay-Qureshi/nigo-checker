module.exports = {
  id: 'R01',
  severity: 'block',
  description: 'Owner signature must be present and dated',
  check(p) {
    const sig = p.signature || {};
    if (sig.present && sig.date) return { pass: true };
    return { pass: false, message: 'Owner signature is missing or undated', fields: ['signature'] };
  },
};
