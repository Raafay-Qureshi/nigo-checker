const { namesMatch } = require('./_util');

module.exports = {
  id: 'R04',
  severity: 'block',
  description: 'Name on the ID must match the application (case/middle-initial tolerant)',
  check(p) {
    const appName = p.owner && p.owner.full_name;
    const idName = p.id_document && p.id_document.name;
    if (namesMatch(appName, idName)) return { pass: true };
    return { pass: false, message: `ID name "${idName}" does not match application name "${appName}"`, fields: ['id_document.name', 'owner.full_name'] };
  },
};
