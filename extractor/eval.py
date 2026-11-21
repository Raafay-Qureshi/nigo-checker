"""Measure the extractor against the ground-truth fixtures.

For each packet it:
  1. renders? no -- reads the already-rendered PDFs in fixtures/pdf/<id>/,
  2. extracts with the live LLM (call_llm), normalizes to {packet, confidence},
  3. compares scalar field values to the ground-truth JSON -> field-level accuracy,
  4. runs the real JS rules engine (app/evaluate_cli.js) on the extracted packet and
     checks that each planted NIGO issue is still caught end to end.

Prints a summary and writes nothing. Numbers printed here are the ONLY numbers that may
go into RESULTS.md. Requires a working LLM key in .env.

Usage:  python eval.py            (from the extractor/ directory)"""
import json
import pathlib
import subprocess

from main import normalize, pdf_bytes_to_text
from llm import call_llm

ROOT = pathlib.Path(__file__).parent.parent
PACKETS = ROOT / "fixtures" / "packets"
PDFS = ROOT / "fixtures" / "pdf"
CLI = ROOT / "app" / "evaluate_cli.js"
NOW = "2026-11-20"  # match the JS test reference date

# Scalar ground-truth paths to score for extraction accuracy.
SCALAR_PATHS = [
    "account.type", "account.registration_name",
    "owner.full_name", "owner.dob", "owner.ssn", "owner.address", "owner.phone",
    "owner.email", "owner.employer", "owner.affiliated_with_broker_dealer",
    "id_document.name", "id_document.address", "id_document.dob", "id_document.expiry",
    "signature.date",
]


def get(obj, dotted):
    cur = obj
    for k in dotted.split("."):
        if cur is None:
            return None
        cur = cur.get(k) if isinstance(cur, dict) else None
    return cur


def norm(v):
    return str(v).strip().lower() if v is not None else ""


def extract_packet(pid):
    folder = PDFS / pid
    data = []
    for name in ("application.pdf", "id.pdf", "transfer.pdf"):
        p = folder / name
        if p.exists():
            data.append(pdf_bytes_to_text(p.read_bytes()))
    raw = call_llm("\n".join(data))
    return normalize(raw)


def run_engine(packet, confidence):
    payload = json.dumps({"packet": packet, "confidence": confidence, "now": NOW})
    out = subprocess.run(["node", str(CLI)], input=payload, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    fixtures = sorted(PACKETS.glob("*.json"))
    total_fields = 0
    correct_fields = 0
    planted_total = 0
    planted_caught = 0
    clean_total = 0
    clean_wrongly_blocked = 0
    rows = []

    for f in fixtures:
        truth = json.loads(f.read_text())
        pid = truth["id"]
        packet, confidence = extract_packet(pid)

        # field accuracy
        hits = 0
        for path in SCALAR_PATHS:
            t = get(truth, path)
            if t is None:  # path not applicable to this packet
                continue
            total_fields += 1
            if norm(get(packet, path)) == norm(t):
                hits += 1
                correct_fields += 1

        # end-to-end via the real JS engine
        ev = run_engine(packet, confidence)
        planted = truth["_meta"].get("planted")
        if planted and planted.startswith("R"):
            planted_total += 1
            caught = planted in ev["blocking"]
            planted_caught += int(caught)
            rows.append(f"  {pid}: planted {planted} -> {'CAUGHT' if caught else 'MISSED'} (decision {ev['decision']})")
        elif truth["_meta"].get("clean") and planted != "lowconf":
            clean_total += 1
            if ev["decision"] != "pass":
                clean_wrongly_blocked += 1
                rows.append(f"  {pid}: CLEAN but routed to {ev['decision']} (blocking {ev['blocking']})")
            else:
                rows.append(f"  {pid}: clean -> pass")
        else:  # lowconf
            rows.append(f"  {pid}: low-confidence -> {ev['decision']} (lowConf {ev['lowConfidence']})")

    field_acc = (correct_fields / total_fields * 100) if total_fields else 0
    catch_rate = (planted_caught / planted_total * 100) if planted_total else 0

    print("\n".join(rows))
    print("\n=== NIGO Checker eval ===")
    print(f"Field-level extraction accuracy: {correct_fields}/{total_fields} = {field_acc:.1f}%")
    print(f"Planted-issue end-to-end catch rate: {planted_caught}/{planted_total} = {catch_rate:.0f}%")
    print(f"Clean packets wrongly blocked: {clean_wrongly_blocked}/{clean_total}")


if __name__ == "__main__":
    main()
