const { namesMatch } = require('./_util');

module.exports = {
  id: 'R09',
  severity: 'block',
  description: 'Transfer statement holder name must match the account owner',
  check(p) {
    if (!p.transfer) return { pass: true };
    const owner = p.owner && p.owner.full_name;
    const holder = p.transfer.holder_name;
    if (namesMatch(owner, holder)) return { pass: true };
    return { pass: false, message: `Transfer holder "${holder}" does not match owner "${owner}"`, fields: ['transfer.holder_name', 'owner.full_name'] };
  },
};
