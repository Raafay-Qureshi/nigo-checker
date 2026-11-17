const IRA = new Set(['traditional_ira', 'roth_ira']);

module.exports = {
  id: 'R08',
  severity: 'block',
  description: 'IRA transfer source must be an IRA of the same type (traditional->traditional, Roth->Roth)',
  check(p) {
    const acct = p.account && p.account.type;
    const transfer = p.transfer;
    if (!IRA.has(acct) || !transfer) return { pass: true }; // only applies to IRA accounts with a transfer
    if (transfer.source_account_type !== acct)
      return { pass: false, message: `Account is ${acct} but transfer source is ${transfer.source_account_type}`, fields: ['transfer.source_account_type', 'account.type'] };
    return { pass: true };
  },
};
