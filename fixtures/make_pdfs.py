"""Render each ground-truth packet JSON into application.pdf, id.pdf and transfer.pdf.

The extractor never sees the JSON -- only these rendered PDFs. Every page carries a
"SPECIMEN, SYNTHETIC DATA" footer. The garbled packet (p12) renders its SSN with block
noise so text extraction genuinely comes back low-confidence.

Usage:  python make_pdfs.py            # renders all packets into ./pdf/<id>/
"""
import json
import pathlib

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = pathlib.Path(__file__).parent
PACKETS = HERE / "packets"
OUT = HERE / "pdf"
FOOTER = "SPECIMEN, SYNTHETIC DATA -- not a real account, not affiliated with any custodian."


def _page(c, title, lines):
    """Draw one titled page of 'Label: value' lines plus the specimen footer."""
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 740, title)
    c.setFont("Helvetica", 11)
    y = 710
    for label, value in lines:
        c.drawString(72, y, f"{label}: {value}")
        y -= 20
        if y < 80:  # new page if we run long (none of these fixtures do)
            _footer(c); c.showPage(); c.setFont("Helvetica", 11); y = 710
    _footer(c)
    c.showPage()


def _footer(c):
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(72, 40, FOOTER)


def _garble(ssn):
    """Replace a few SSN digits with full blocks so the value is unreadable/low-confidence."""
    out = []
    for i, ch in enumerate(ssn):
        out.append("\u2588" if ch.isdigit() and i % 3 == 1 else ch)
    return "".join(out)


def render(packet):
    pid = packet["id"]
    folder = OUT / pid
    folder.mkdir(parents=True, exist_ok=True)
    garbled = packet.get("_meta", {}).get("planted") == "lowconf"

    o = packet["owner"]
    ssn = _garble(o["ssn"]) if garbled else o["ssn"]
    sig = packet["signature"]
    bene = "; ".join(
        f"{b['name']} ({b['relationship']}, {b['type']}, {b['percent']}%)"
        for b in packet["beneficiaries"]
    )
    tc = packet.get("trusted_contact")
    tc_line = f"{tc['name']} / {tc['phone']}" if tc else "(none provided)"

    # --- application.pdf ---
    app_c = canvas.Canvas(str(folder / "application.pdf"), pagesize=letter)
    _page(app_c, "New Account Application", [
        ("Account type", packet["account"]["type"]),
        ("Registration name", packet["account"]["registration_name"]),
        ("Owner name", o["full_name"]),
        ("Date of birth", o["dob"]),
        ("SSN", ssn),
        ("Address", o["address"]),
        ("Phone", o["phone"]),
        ("Email", o["email"]),
        ("Employer", o["employer"]),
        ("Affiliated with broker-dealer", o["affiliated_with_broker_dealer"] or "(blank)"),
        ("Beneficiaries", bene),
        ("Trusted contact", tc_line),
        ("Owner signature present", "Yes" if sig["present"] else "No"),
        ("Signature date", sig["date"] or "(unsigned)"),
    ])
    app_c.save()

    # --- id.pdf ---
    idd = packet["id_document"]
    id_c = canvas.Canvas(str(folder / "id.pdf"), pagesize=letter)
    _page(id_c, "Government-Issued ID", [
        ("Name", idd["name"]),
        ("Address", idd["address"]),
        ("Date of birth", idd["dob"]),
        ("Expiry date", idd["expiry"]),
    ])
    id_c.save()

    # --- transfer.pdf (only when a transfer exists) ---
    t = packet.get("transfer")
    if t:
        t_c = canvas.Canvas(str(folder / "transfer.pdf"), pagesize=letter)
        _page(t_c, "Account Transfer Statement", [
            ("Account holder name", t["holder_name"]),
            ("Source account type", t["source_account_type"]),
            ("Account number", t["account_number"]),
        ])
        t_c.save()

    return pid, bool(t)


def main():
    files = sorted(PACKETS.glob("*.json"))
    if not files:
        raise SystemExit(f"No packet JSON found in {PACKETS}")
    for f in files:
        pid, has_transfer = render(json.loads(f.read_text()))
        print(f"rendered {pid}: application.pdf, id.pdf" + (", transfer.pdf" if has_transfer else ""))
    print(f"\n{len(files)} packets rendered into {OUT}/")


if __name__ == "__main__":
    main()
