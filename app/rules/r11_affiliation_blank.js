module.exports = {
  id: 'R11',
  severity: 'warn',
  description: 'Broker-dealer affiliation question was left blank',
  check(p) {
    const v = p.owner && p.owner.affiliated_with_broker_dealer;
    if (v === 'yes' || v === 'no') return { pass: true };
    return { pass: false, message: 'Broker-dealer affiliation question is blank', fields: ['owner.affiliated_with_broker_dealer'] };
  },
};
