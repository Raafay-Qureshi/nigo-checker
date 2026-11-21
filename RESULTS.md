# Results

Measured numbers from a live run of the extractor (DeepSeek `deepseek-chat`) against
the 12 synthetic ground-truth packets in `fixtures/packets/`, scored by
`extractor/eval.py`. All data is synthetic. Reproduce with:

```bash
cd fixtures && python make_pdfs.py
cd ../extractor && python eval.py    # needs DEEPSEEK_API_KEY in ../.env
```

Reference date for date-sensitive rules: `2026-11-20`.

## Headline

| Metric | Result |
|--------|--------|
| Field-level extraction accuracy | **178/179 = 99.4%** |
| Planted NIGO issues caught end-to-end | **7/7 = 100%** |
| Clean packets wrongly blocked (false positives) | **0/4** |
| Low-confidence packet correctly routed to review | **1/1** |

"End-to-end" means: render PDFs → LLM extract → normalize → run the real JavaScript
rules engine (`app/evaluate_cli.js`) → check the planted rule id appears in the
blocking set. Nothing is stubbed in that path except the custodian submit.

## Per-packet

| Packet | Expectation | Result |
|--------|-------------|--------|
| p01 | clean (individual) | pass |
| p02 | clean (joint) | pass |
| p03 | clean (traditional IRA + transfer) | pass |
| p04 | clean (Roth IRA + transfer) | pass |
| p05 | R01 missing signature | caught → review |
| p06 | R03 beneficiaries total 90% | caught → review |
| p07 | R04 ID surname mismatch | caught → review |
| p08 | R05 ID expired before signing | caught → review |
| p09 | R07 invalid SSN (9xx area) | caught → review |
| p10 | R08 Roth account with traditional-IRA transfer | caught → review |
| p11 | R09 transfer holder name mismatch | caught → review |
| p12 | low-confidence SSN, rules otherwise clean | routed to review on confidence |

## Notes

- **Extraction accuracy** scores 179 scalar fields across the 15 tracked dotted paths
  (account, owner, ID, signature) over all applicable packets. The single miss was a
  minor normalization difference, not a rule-affecting error — it did not change any
  NIGO decision.
- **One false positive was found and fixed during this run.** The first live pass
  wrongly blocked p03/p04 (clean IRA transfers) on R09 because the model returned
  `transfer.holder_name: null` — the extraction prompt's example showed `transfer:
  null` and gave no guide for the transfer sub-shape. Adding an explicit
  transfer-field instruction to the prompt (`extractor/llm.py`) fixed it; the table
  above is the post-fix run. This is exactly the kind of regression the eval harness
  exists to catch.
- **Rules are deterministic**, so the 100% catch rate depends only on the extractor
  surfacing the relevant field. The confidence gate (`CONFIDENCE_THRESHOLD=0.85`) is
  the safety net for fields the model is unsure about, demonstrated by p12.
