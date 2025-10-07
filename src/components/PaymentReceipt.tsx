# Footer Section - Adjusted Signature & Stamp Layout
from reportlab.lib.colors import Color

# Define text color (matching your design theme)
TEXT_PRIMARY = Color(0/255, 102/255, 51/255)

# Add Thank You Text
thank_you_text = "Thank you for choosing sustainable energy solutions!"
doc.setFont("Helvetica-Oblique", 9)
doc.setFillColor(TEXT_PRIMARY)
doc.drawCentredString(pageWidth / 2, footerY, thank_you_text)

# Company signature label
company_text = "For AXISO GREEN ENERGIES PVT. LTD."
doc.setFont("Helvetica-Bold", 9)
doc.setFillColor(TEXT_PRIMARY)
doc.drawString(margin, footerY - 18, company_text)

# Define image scaling ratios and smaller sizes
signatureWidthSmall = 48
signatureHeightSmall = signatureWidthSmall * 0.5
stampWidthSmall = 28
stampHeightSmall = stampWidthSmall * 0.6

# Move both images slightly upward to avoid overlap
sigStampY = footerY - 40

# Add signature image
try:
    doc.drawImage(
        signatureData,  # your signature image data path or data URI
        pageWidth - margin - signatureWidthSmall,
        sigStampY,
        signatureWidthSmall,
        signatureHeightSmall,
        mask='auto',
        preserveAspectRatio=True
    )
except Exception as e:
    print("Signature image error:", e)

# Add stamp image
try:
    doc.drawImage(
        stampData,  # your company stamp image path or data URI
        pageWidth - margin - signatureWidthSmall - 8 - stampWidthSmall,
        sigStampY + 2,
        stampWidthSmall,
        stampHeightSmall,
        mask='auto',
        preserveAspectRatio=True
    )
except Exception as e:
    print("Stamp image error:", e)

# Add Manager label below signature
doc.setFont("Helvetica-Bold", 9)
doc.setFillColor(TEXT_PRIMARY)
doc.drawCentredString(
    pageWidth - margin - signatureWidthSmall / 2,
    sigStampY - 8,
    "Manager"
)
