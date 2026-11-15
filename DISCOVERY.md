# Discovery: Maple Ridge Wealth — NIGO on new-account packets

> **Fictional client.** Maple Ridge Wealth is not a real company. All names, numbers and
> processes here are invented to scope the rules this tool enforces. Nothing in this
> document describes a real client engagement. All data is synthetic.

## Format

Written as if from a 30-minute discovery call with three stakeholders at a mid-size RIA.
Goal of the call: understand *why new-account packets bounce as NIGO* and what a
proof-of-concept would need to catch before submission.

---

## 1. The client (fictional)

**Maple Ridge Wealth** — a registered investment adviser (RIA) with ~40 advisors. They
custody client assets at a third-party custodian and open new accounts (individual,
joint, traditional IRA, Roth IRA) by submitting a paperwork "packet" per account.

**The pain, in their words:** "About one in four packets comes back NIGO — *not in good
order*. Each bounce costs roughly a week and an awkward call to the client to re-sign
something. Multiply that across 40 advisors and it's a real drag on how fast we can
onboard."

## 2. Stakeholders

| Role | Who | What they care about | Pain today |
|------|-----|----------------------|------------|
| **Advisor** | Books the client, assembles the packet | Speed to funded account; not bothering the client twice | Finds out about a NIGO reason a week later, has to re-contact the client |
| **Ops associate** | Checks every packet before submission | Catching problems before the custodian does | Checks each packet by hand against a printed checklist; slow and easy to miss things |
| **Compliance** | Owns the rules and the audit trail | Every decision logged and defensible; no client data mishandled | No central record of *why* a packet was held or passed |

## 3. Current workflow (as-is)

1. Advisor collects signed application, a government ID, and (for transfers) a transfer
   statement; assembles them into one packet.
2. Advisor hands the packet to an **ops associate**.
3. Ops associate reviews **every** packet by hand against a printed checklist.
4. If it looks right, ops submits to the custodian.
5. Custodian either accepts it or returns it **NIGO** with a reason (missing signature,
   beneficiary percentages that don't total 100, ID expired, transfer type mismatch…).
6. On NIGO: advisor re-contacts the client, fixes the issue, resubmits. ~1 week lost.

**Where it breaks:** the hand-check is the only safety net, it is slow, and a tired
reviewer misses the same things the custodian later catches.

## 4. Desired workflow (to-be, what the POC demonstrates)

- Extract the fields from the packet automatically.
- Run the custodian's likely rejection rules **before** submission.
- Route only the problem packets (or low-confidence extractions) to a human review queue.
- Clean, high-confidence packets go straight through and are logged.
- Give the advisor a plain-English "fix these before resubmitting" summary on a hold.

## 5. The NIGO checklist (the rules to encode)

Gathered from the ops associate's printed checklist and the custodian's common reject
reasons. Severity: **block** = would be rejected NIGO; **warn** = ops should ask, not stop.

| ID | Check | Severity |
|----|-------|----------|
| R01 | Owner signature present and dated | block |
| R02 | Signature date not in the future and not older than 90 days | block |
| R03 | Primary beneficiary percentages total 100% (same for contingent, if any) | block |
| R04 | Name on ID matches the application (case / middle-initial tolerant) | block |
| R05 | ID not expired on the signature date | block |
| R06 | Owner is 18 or older | block |
| R07 | SSN has a valid format (9 digits; not 000/666/9xx area) | block |
| R08 | IRA transfer source matches account type (traditional→traditional, Roth→Roth) | block |
| R09 | Transfer statement holder name matches the account owner | block |
| R10 | Address on ID differs from the application | warn (people move) |
| R11 | Broker-dealer affiliation question left blank | warn |
| R12 | No trusted contact provided | warn (custodian must *ask*, not require) |

## 6. Out of scope (for the POC)

- Real custodian integration — we mock the submit endpoint.
- A database — JSON files + an append-only `audit.jsonl` are enough for a POC.
- e-signature / packet assembly — we start from already-assembled PDFs.
- OCR of scanned handwriting — synthetic PDFs have selectable text.
- Authentication / multi-user accounts / production hardening.

## 7. Open questions (would confirm in a real engagement)

- Which custodian(s)? Reject rules differ slightly per custodian — the rules engine is
  built to make per-custodian variants cheap.
- Exact "stale signature" window — is it 90 days for all account types?
- Does the custodian accept digital-only IDs, or must it be a specific document type?
- What confidence threshold do ops trust before auto-passing? (POC starts at 0.85.)
- Volume per week, to size the review queue.

## 8. Success metrics for the POC

- Catch **100%** of the planted NIGO issues in the synthetic test set.
- **Zero** clean packets wrongly blocked.
- **Every** decision logged to the audit trail.
- Field-level extraction accuracy measured (reported from `eval.py`, not estimated).

> Metrics are measured against a **synthetic** test set, not real client packets. No
> "hours saved" claim is made — nothing was timed with real ops staff.
