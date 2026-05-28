"""
Generate a sample referral PDF for Forta Match UI testing.
Requires: pip install fpdf2

Usage: python scripts/generate_mock_referral_pdf.py
Output: assets/mock-referral-letter.pdf
"""
from pathlib import Path

from fpdf import FPDF

OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "mock-referral-letter.pdf"

BODY = """Geacht team,

Ik verwijs hiermee mw. Sophia van Berg, geboren op 12 maart 1989 (leeftijd 36 jaar).

BSN: 942031529
Contact: sophia.vanberg@voorbeeld.nl | +31612345678
Adres: Kanaalweg 14, 1012 AB Amsterdam

Verwijsarts AGB-code: 0865421.

Mw. Van Berg heeft sinds circa zes maanden klachten passend bij een licht tot matig depressief beeld, met insomnia, concentratieproblemen en verminderde energie. Screening toont laaggemiddeld risico; geen acute crisis. DSM-richting: F32.1 (milde depressieve episode).

Klacht: permanente stemmingsverlaging en slaapproblemen. Geen antidepressiva gestart.

Verzoek: ambulante GGZ in regio Noord-Holland met psychotherapie (CBT/IPT).

Datum: 26 mei 2026

Dr. Eva Jansen
Huisarts (handtekening mock)"""


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, "Verwijsbrief GGZ (mock - Forta Match test)")

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, BODY)

    pdf.output(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
