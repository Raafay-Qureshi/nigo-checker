const { ageOn, parseDate } = require('./_util');

module.exports = {
  id: 'R06',
  severity: 'block',
  description: 'Account owner must be at least 18 years old',
  check(p, ctx) {
    const dob = p.owner && p.owner.dob;
    if (!dob) return { pass: false, message: 'Owner date of birth is missing', fields: ['owner.dob'] };
    const asOf = parseDate(p.signature && p.signature.date) || ctx.now;
    const age = ageOn(dob, asOf);
    if (age < 18) return { pass: false, message: `Owner is ${age} (under 18)`, fields: ['owner.dob'] };
    return { pass: true };
  },
};
