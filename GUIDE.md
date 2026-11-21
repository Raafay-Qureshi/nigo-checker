# Operator / Developer Guide

How to set up the NIGO Checker, and how to make the three changes a client will
actually ask for: **add a rule**, **change a threshold**, and **adapt it for a
second client**. Written so a developer who has never seen the repo can do each in
a few minutes.

---

## Setup

Prereqs: Node 18+ (tested on v24) and Python 3.10+ (tested on 3.12).

```bash
# rules engine + UI
cd app && npm install && node --test   # expect 10 passing tests

# extractor
cd ../extractor && pip install -r requirements.txt
cp ../.env.example ../.env              # add DEEPSEEK_API_KEY=...
```

`.env` lives at the repo root and is gitignored. Keys of note:

| Key | Default | Meaning |
|-----|---------|---------|
| `LLM_PROVIDER` | `deepseek` | `deepseek` or `claude` |
| `DEEPSEEK_API_KEY` | — | required for live extraction |
| `CONFIDENCE_THRESHOLD` | `0.85` | required-field confidence gate (see below) |
| `EXTRACTOR_URL` | `http://localhost:8001` | where the Node app calls `/extract` |

Run both services:

```bash
cd extractor && uvicorn main:app --port 8001   # terminal 1
cd app && npm start                             # terminal 2 -> http://localhost:3000
```

---

## Add a new rule

Rules are the product. Each one is a single self-contained file in `app/rules/`
that the engine auto-loads at startup (any `*.js` not starting with `_`). There is
no registry to edit.

1. **Create `app/rules/r13_my_rule.js`** following the existing shape:

   ```js
   module.exports = {
     id: 'R13',
     severity: 'block',          // 'block' = NIGO, stops submission; 'warn' = note only
     description: 'One line a human can read in the summary',
     check(p, ctx) {             // p = packet, ctx = { now } (a Date; use for "today")
       // return { pass: true } when fine
       // return { pass: false, message: '...', fields: ['owner.email'] } when not
       if (/* some condition on p */ false) {
         return { pass: false, message: 'Why this is NIGO', fields: ['owner.email'] };
       }
       return { pass: true };
     },
   };
   ```

   - `fields` lists the dotted packet paths the operator should fix; the review UI
     turns each into an editable box, so name them exactly (`owner.email`,
     `beneficiaries`, …).
   - Reuse helpers in `app/rules/_util.js` (`namesMatch`, `ageOn`, `parseDate`,
     `daysBetween`) instead of re-implementing date/name logic.
   - Use `ctx.now` for any "today" comparison — never `new Date()` — so tests stay
     deterministic.

2. **Add a ground-truth fixture that triggers it.** Copy an existing packet in
   `fixtures/packets/`, change the data so your rule fails, and set
   `_meta.planted` to `"R13"` (or `_meta.clean: true` for a passing case).

3. **Assert it in `app/test/rules.test.js`** — the suite already walks every
   `_meta.planted` packet and checks the matching rule id appears in `blocking`,
   so often you only need the fixture. Run `node --test` and confirm green.

That's the whole loop: file + fixture + test. No wiring.

---

## Change a threshold

All tunables live in **`app/config.js`** — nothing is hard-coded in the engine.

- **Confidence gate.** `confidenceThreshold` (default `0.85`) is the score below
  which a *required* field routes a packet to review even when all rules pass.
  Change it in `config.js`, or override per-environment with
  `CONFIDENCE_THRESHOLD` in `.env`. Raise it to send more borderline extractions
  to humans; lower it to auto-submit more.

- **Which fields the gate checks.** `requiredFields` is the list of dotted paths
  that are confidence-gated. Optional fields (trusted contact, employer) are
  deliberately excluded so a missing optional never blocks. Add or remove paths
  here.

- **A value inside a rule** (e.g. the signature-freshness window in
  `r02_signature_fresh.js`): edit the constant at the top of that rule's file. Keep
  the number in the rule, add a comment, and update that rule's test.

---

## Adapt for a second client

The engine, extractor, UI, audit, and mock custodian are client-agnostic. Only the
**rule set, the fields, and the thresholds** are client-specific. To onboard
"Client #2":

1. **Re-run discovery** against their NIGO checklist (see `DISCOVERY.md` for the
   template). Every item on their checklist maps to one rule file.
2. **Adjust rules.** Delete the `app/rules/*.js` that don't apply, edit the ones
   that differ, add new ones per "Add a new rule" above. Because rules auto-load,
   enabling/disabling a rule is adding/removing a file.
3. **Adjust `config.js`** — their required fields and confidence tolerance.
4. **Adjust extraction** if their packets have different documents or fields: the
   Pydantic shape is in `extractor/schema.py` and the extraction prompt +
   `EXAMPLE_JSON` are in `extractor/llm.py`. Keep the `{value, confidence}` shape so
   the normalizer and confidence gate keep working unchanged.
5. **Rebuild the ground-truth set** in `fixtures/packets/` from their (synthetic)
   sample packets and re-run `node --test` and `python eval.py` to get their
   numbers.

For a cleaner multi-tenant setup later, move `app/rules/` and `config.js` into a
per-client folder and select it by a `CLIENT` env var — not needed for one client,
so it isn't built yet.

---

## Troubleshooting

- **`node --test` fails on dates** — a rule used `new Date()` instead of `ctx.now`.
- **Upload returns an extractor error** — the FastAPI service isn't running on
  `EXTRACTOR_URL`, or `DEEPSEEK_API_KEY` is missing/invalid in `.env`.
- **Everything routes to review** — `CONFIDENCE_THRESHOLD` is too high, or the
  model is returning low confidences; inspect `/extract` output directly.
- **Audit log** — every intake, edit, submit, and reject is one JSON line in
  `app/audit.jsonl` (gitignored); `GET /audit` returns it.
