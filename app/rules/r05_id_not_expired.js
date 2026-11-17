const { parseDate } = require('./_util');

module.exports = {
  id: 'R05',
  severity: 'block',
  description: 'ID must not be expired as of the signature date',
  check(p, ctx) {
    const expiry = parseDate(p.id_document && p.id_document.expiry);
    if (!expiry) return { pass: false, message: 'ID expiry date is missing', fields: ['id_document.expiry'] };
    const asOf = parseDate(p.signature && p.signature.date) || ctx.now;
    if (expiry < asOf) return { pass: false, message: `ID expired ${p.id_document.expiry}, before the signature date`, fields: ['id_document.expiry'] };
    return { pass: true };
  },
};
