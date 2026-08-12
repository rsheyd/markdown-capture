from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen.canvas import Canvas


output = Path(__file__).with_name("basic-text.pdf")
canvas = Canvas(str(output), pagesize=letter, invariant=1)
canvas.setTitle("Markdown Capture PDF fixture")
canvas.setFont("Helvetica-Bold", 18)
canvas.drawString(72, 720, "Markdown Capture PDF fixture")
canvas.setFont("Helvetica", 12)
canvas.drawString(72, 690, "This text should be extractable locally.")
canvas.drawString(72, 672, "The second line belongs to the same simple document.")
canvas.save()
