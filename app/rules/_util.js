// Shared helpers for rules. Keep rule files tiny and readable.

// Compare two person names tolerant of case and middle initial/name: match on the
// first token and the last token (surname). "Jane A Carter" ~ "Jane Carter";
// "Angela M Ford" !~ "Angela Michelle Thompson" (surname differs).
function namesMatch(a, b) {
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[.,]/g, '').split(/\s+/).filter(Boolean);
  const x = norm(a), y = norm(b);
  if (x.length === 0 || y.length === 0) return false;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

// Whole years between a YYYY-MM-DD date of birth and a reference Date.
function ageOn(dobStr, ref) {
  const dob = new Date(dobStr);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1;
  return age;
}

const parseDate = (s) => (s ? new Date(s) : null);
const daysBetween = (a, b) => Math.round((a - b) / 86400000);

module.exports = { namesMatch, ageOn, parseDate, daysBetween };
