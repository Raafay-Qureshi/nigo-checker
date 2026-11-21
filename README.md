# NIGO Checker

A small demo that catches **NIGO** ("not in good order") problems in brokerage
new-account packets *before* they are sent to the custodian — so an operations
team reviews only the packets that actually have an issue, instead of eyeballing
every one.

> **Demo / prototype. Not affiliated with any brokerage or custodian. Every packet,
> name, SSN, and account number in this repo is synthetic.** See `DISCOVERY.md` for
> the (fictional) client discovery that scopes the rules.

## What it does

1. **Extract** — a Python/FastAPI service reads the PDFs in a packet (application,
   ID, optional transfer form) and uses an LLM to pull out structured fields, each
   with a self-reported confidence score.
2. **Check** — a JavaScript rules engine runs 12 deterministic NIGO rules
   (R01–R12: missing signature, beneficiary totals, ID name/expiry, SSN format,
   IRA transfer type, name mismatches, …). Low-confidence fields are flagged too.
3. **Route** — clean packets are auto-submitted to a **mock** custodian; anything
   with a blocking issue or a low-confidence field goes to a human review queue.
4. **Review** — an operator fixes the flagged fields, the rules re-run live, and
   once everything is in good order they approve and submit. Every step is written
   to an append-only JSONL audit log.

The split is deliberate: the LLM only *extracts*, the **rules decide**. Rules are
plain code you can read, test, and trust — see `DISCOVERY.md`.

## Architecture

```
PDFs ──> extractor (Python/FastAPI, :8001)  ──{packet, confidence}──>  app (Node/Express, :3000)
             LLM extract + confidence                                   12 rules + confidence gate
                                                                        mock custodian + audit log
                                                                        upload & review UI
```

## Run it

### 1. Rules engine + UI (no API key needed)

```bash
cd app
npm install
node --test        # 10 tests, all green — rules vs. ground-truth fixtures
npm start          # http://localhost:3000  (upload.html / review.html)
```

With the extractor not running you can still exercise every rule via the fixtures
and `node app/evaluate_cli.js`. To use the upload UI you need the extractor below.

### 2. Extractor (needs a DeepSeek API key)

```bash
cd extractor
pip install -r requirements.txt
cp ../.env.example ../.env          # then put your DEEPSEEK_API_KEY in ../.env
uvicorn main:app --port 8001
```

Render the sample PDFs and score the extractor against ground truth:

```bash
cd fixtures && python make_pdfs.py   # writes fixtures/pdf/<id>/*.pdf
cd ../extractor && python eval.py     # field accuracy + end-to-end catch rate
```

Measured numbers from a live run are in `RESULTS.md`.

## Layout

| Path | What |
|------|------|
| `app/rules/r01..r12.js` | the 12 NIGO rules, one file each |
| `app/engine.js` | loads rules, evaluates a packet, builds the NIGO summary |
| `app/server.js` | upload / review / mock-custodian routes + audit |
| `app/public/` | `upload.html`, `review.html` |
| `app/test/rules.test.js` | `node:test` suite vs. ground-truth fixtures |
| `extractor/` | FastAPI service, Pydantic schema, DeepSeek `call_llm`, `eval.py` |
| `fixtures/packets/` | 12 synthetic ground-truth packets (`p01`–`p12`) |
| `fixtures/make_pdfs.py` | renders packets to PDFs |
| `DISCOVERY.md` | fictional client discovery that scopes the rules |
| `GUIDE.md` | how to add a rule, change a threshold, onboard a second client |

## Not in scope (demo)

Real custodian API, authentication, persistence (state is in-memory), and a live
a live form-builder integration are out of scope — see the "Out of scope" section of
`DISCOVERY.md`. The custodian is a stub that returns a fake reference.
