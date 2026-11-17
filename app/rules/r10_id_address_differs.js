module.exports = {
  id: 'R10',
  severity: 'warn',
  description: 'Address on the ID differs from the application (people move; ops should ask, not block)',
  check(p) {
    const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const appAddr = norm(p.owner && p.owner.address);
    const idAddr = norm(p.id_document && p.id_document.address);
    if (appAddr && idAddr && appAddr !== idAddr)
      return { pass: false, message: 'ID address differs from the application address', fields: ['id_document.address', 'owner.address'] };
    return { pass: true };
  },
};
