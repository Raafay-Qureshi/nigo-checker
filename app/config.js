// POC configuration. Tune here; no magic numbers scattered in the engine.
module.exports = {
  // A required field whose extraction confidence is below this routes the packet to
  // review, even if every rule passes. Start conservative; see GUIDE.md to change it.
  confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD) || 0.85,

  // Dotted paths of fields the confidence gate checks. Optional fields (trusted contact,
  // employer) are deliberately excluded so a missing optional does not block.
  requiredFields: [
    'account.type',
    'owner.full_name',
    'owner.dob',
    'owner.ssn',
    'owner.address',
    'id_document.name',
    'id_document.expiry',
    'signature.date',
  ],
};
