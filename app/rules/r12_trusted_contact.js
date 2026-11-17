module.exports = {
  id: 'R12',
  severity: 'warn',
  description: 'No trusted contact provided (custodians must ask, so it is not mandatory)',
  check(p) {
    const tc = p.trusted_contact;
    if (tc && tc.name) return { pass: true };
    return { pass: false, message: 'No trusted contact provided', fields: ['trusted_contact'] };
  },
};
