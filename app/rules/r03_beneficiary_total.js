function total(list, type) {
  return list.filter((b) => b.type === type).reduce((s, b) => s + Number(b.percent || 0), 0);
}

module.exports = {
  id: 'R03',
  severity: 'block',
  description: 'Primary beneficiary percentages must total 100% (same for contingent, if any)',
  check(p) {
    const bene = p.beneficiaries || [];
    const primary = bene.filter((b) => b.type === 'primary');
    if (primary.length) {
      const t = total(bene, 'primary');
      if (t !== 100) return { pass: false, message: `Primary beneficiaries total ${t}%, not 100%`, fields: ['beneficiaries'] };
    }
    const contingent = bene.filter((b) => b.type === 'contingent');
    if (contingent.length) {
      const t = total(bene, 'contingent');
      if (t !== 100) return { pass: false, message: `Contingent beneficiaries total ${t}%, not 100%`, fields: ['beneficiaries'] };
    }
    return { pass: true };
  },
};
