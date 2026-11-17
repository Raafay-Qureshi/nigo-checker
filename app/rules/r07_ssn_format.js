module.exports = {
  id: 'R07',
  severity: 'block',
  description: 'SSN must be a valid format (9 digits; not 000/666/9xx area, 00 group, or 0000 serial)',
  check(p) {
    const raw = String((p.owner && p.owner.ssn) || '');
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 9) return { pass: false, message: `SSN "${raw}" is not 9 digits`, fields: ['owner.ssn'] };
    const area = Number(digits.slice(0, 3));
    const group = Number(digits.slice(3, 5));
    const serial = Number(digits.slice(5));
    if (area === 0 || area === 666 || area >= 900)
      return { pass: false, message: `SSN area ${digits.slice(0, 3)} is invalid (000, 666, or 900-999)`, fields: ['owner.ssn'] };
    if (group === 0) return { pass: false, message: 'SSN group (middle two digits) cannot be 00', fields: ['owner.ssn'] };
    if (serial === 0) return { pass: false, message: 'SSN serial (last four digits) cannot be 0000', fields: ['owner.ssn'] };
    return { pass: true };
  },
};
