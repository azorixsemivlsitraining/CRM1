import { jsPDF } from 'jspdf';

interface PaymentReceiptProps {
  date: string;
  amount: number;
  receivedFrom: string;
  paymentMode: string;
  placeOfSupply: string;
  customerAddress: string;
}

const BRAND_PRIMARY = { r: 72, g: 187, b: 120 };
const TEXT_PRIMARY = { r: 45, g: 55, b: 72 };
const TEXT_MUTED = { r: 99, g: 110, b: 114 };
const BOX_BORDER = { r: 209, g: 213, b: 219 };
const BOX_BG = { r: 244, g: 252, b: 247 };

const SIGNATURE_IMAGE_URL = 'https://cdn.builder.io/api/v1/image/assets%2F59bf3e928fc9473a97d5e87470c824bb%2Fe7761deba40548afb13dbd440230d9df?format=webp&width=800';
const LOGO_URL = 'https://cdn.builder.io/api/v1/image/assets%2F59bf3e928fc9473a97d5e87470c824bb%2Fe73212a6556b469681e572b94a3fcc85?format=webp&width=800';

async function fetchImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function fetchImageAsset(url: string): Promise<{ dataUrl: string; aspectRatio: number }> {
  const dataUrl = await fetchImageAsDataURL(url);
  try {
    const { width, height } = await loadImageDimensions(dataUrl);
    return { dataUrl, aspectRatio: height / width };
  } catch {
    return { dataUrl, aspectRatio: 1 };
  }
}

function convertToWords(num: number): string {
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatTens = (value: number): string => {
    if (value < 10) return single[value];
    if (value < 20) return double[value - 10];
    return tens[Math.floor(value / 10)] + (value % 10 !== 0 ? ` ${single[value % 10]}` : '');
  };

  if (num === 0) return 'Zero';

  let workingValue = num;
  let words = '';

  if (workingValue >= 10000000) {
    words += `${convertToWords(Math.floor(workingValue / 10000000))} Crore `;
    workingValue %= 10000000;
  }
  if (workingValue >= 100000) {
    words += `${convertToWords(Math.floor(workingValue / 100000))} Lakh `;
    workingValue %= 100000;
  }
  if (workingValue >= 1000) {
    words += `${convertToWords(Math.floor(workingValue / 1000))} Thousand `;
    workingValue %= 1000;
  }
  if (workingValue >= 100) {
    words += `${convertToWords(Math.floor(workingValue / 100))} Hundred `;
    workingValue %= 100;
  }
  if (workingValue > 0) {
    words += formatTens(workingValue);
  }

  return words.trim();
}

export async function generatePaymentReceiptPDF({
  date,
  amount,
  receivedFrom,
  paymentMode,
  placeOfSupply,
  customerAddress,
}: PaymentReceiptProps) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin = 18;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // ===== HEADER =====
    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, 0, pageWidth, 9, 'F');

    const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
    const logoWidth = 88;
    const logoHeight = logoWidth * logoRatio;
    // position logo top-right
    doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 8, logoWidth, logoHeight, undefined, 'FAST');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 26);

    const companyLines = [
      'Address: PLOT NO-102,103, TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9',
    ];
    doc.setFontSize(8.5);
    companyLines.forEach((line, index) => {
      doc.text(line, margin, 32 + index * 4);
    });

    doc.setDrawColor(BOX_BORDER.r, BOX_BORDER.g, BOX_BORDER.b);
    doc.line(margin, 55, pageWidth - margin, 55);

    // ===== TITLE =====
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 68, { align: 'center' });

    // ===== DETAILS BOX =====
    const detailTop = 80;
    const detailHeight = 50;
    doc.roundedRect(margin, detailTop, pageWidth - margin * 2, detailHeight, 3, 3, 'S');

    const referenceNumber = `AGE${Date.now().toString().slice(-6)}`;
    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const placeDetail = placeOfSupply.includes('(') ? placeOfSupply : `${placeOfSupply} (36)`;

    const detailRows = [
      { label: 'Payment Date', value: formattedDate },
      { label: 'Reference No', value: referenceNumber },
      { label: 'Payment Mode', value: paymentMode },
      { label: 'Place of Supply', value: placeDetail },
    ];

    doc.setFontSize(9.5);
    detailRows.forEach((row, index) => {
      const rowY = detailTop + 10 + index * 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`${row.label}:`, margin + 8, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(row.value, margin + 45, rowY);
    });

    // ===== AMOUNT BOX =====
    const amountBoxWidth = 70;
    const amountBoxHeight = 28;
    const amountBoxX = pageWidth - margin - amountBoxWidth - 5;
    const amountBoxY = detailTop + 6;

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.roundedRect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', amountBoxX + amountBoxWidth / 2, amountBoxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, amountBoxX + amountBoxWidth / 2, amountBoxY + 20, { align: 'center' });

    // ===== AMOUNT IN WORDS =====
    const wordsBlockY = detailTop + detailHeight + 8;
    doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
    doc.roundedRect(margin, wordsBlockY, pageWidth - margin * 2, 18, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Amount in Words', margin + 8, wordsBlockY + 7);

    const amountText = `Indian Rupee ${convertToWords(amount)} Only`;
    const wrappedAmountText = doc.splitTextToSize(amountText, pageWidth - margin * 2 - 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text(wrappedAmountText, margin + 8, wordsBlockY + 13);

    // ===== RECEIVED FROM BOX =====
    const receivedBlockY = wordsBlockY + 18;
    doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
    doc.roundedRect(margin, receivedBlockY, pageWidth - margin * 2, 22, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Received From', margin + 8, receivedBlockY + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text(receivedFrom, margin + 8, receivedBlockY + 16);

    // ===== OFFERINGS BOX =====
    const offerings = [
      'Solar Roof Top Power Plants (ON-Grid, OFF-Grid & Hybrid)',
      'Solar Street Lights',
      'Solar Water Pumping Systems',
      'Solar Fencing',
      'Solar Pergolas',
      'Solar Dryers',
      'Batteries and Inverters',
      'Online UPS',
      'Solar Water Heating Systems',
    ];

    const offeringsBoxY = receivedBlockY + 20;

    // Two-column offerings with balanced columns
    const startY = offeringsBoxY + 13;
    const lineGap = 5; // space between wrapped lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

    const colWidth = (pageWidth - margin * 2 - 16) / 2;
    const mid = Math.ceil(offerings.length / 2);
    const leftItems = offerings.slice(0, mid);
    const rightItems = offerings.slice(mid);

    const leftLayout: { y: number; wrapped: string[] }[] = [];
    const rightLayout: { y: number; wrapped: string[] }[] = [];

    let leftYCursor = startY;
    let rightYCursor = startY;

    leftItems.forEach(item => {
      const wrapped = doc.splitTextToSize(item, colWidth - 8) as string[];
      leftLayout.push({ y: leftYCursor, wrapped });
      leftYCursor += wrapped.length * lineGap;
    });

    rightItems.forEach(item => {
      const wrapped = doc.splitTextToSize(item, colWidth - 8) as string[];
      rightLayout.push({ y: rightYCursor, wrapped });
      rightYCursor += wrapped.length * lineGap;
    });

    const dynamicOfferingsBoxHeight = Math.max(leftYCursor, rightYCursor) - offeringsBoxY + 8;

    // Draw background box (aligned with other boxes)
    const offeringsBoxWidth = pageWidth - margin * 2;
    const offeringsBoxX = margin;
    doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
    doc.roundedRect(offeringsBoxX, offeringsBoxY, offeringsBoxWidth, dynamicOfferingsBoxHeight, 3, 3, 'FD');

    // Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Our Offerings:', offeringsBoxX + 8, offeringsBoxY + 8);

    // Render left and right columns, keep normal text color (not green highlight)
    const leftColX = offeringsBoxX + 10;
    const rightColX = offeringsBoxX + 10 + colWidth;

    leftLayout.forEach(row => {
      doc.circle(leftColX - 2, row.y - 1.5, 0.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(row.wrapped, leftColX, row.y);
    });

    rightLayout.forEach(row => {
      doc.circle(rightColX - 2, row.y - 1.5, 0.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(row.wrapped, rightColX, row.y);
    });

    // ===== FOOTER =====
    const footerY = offeringsBoxY + dynamicOfferingsBoxHeight + 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Thank you for choosing sustainable energy solutions!', pageWidth / 2, footerY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('For AXISO GREEN ENERGIES PVT. LTD.', pageWidth - margin - 6, footerY + 6, { align: 'right' });

    // Fetch signature and stamp images
    const [{ dataUrl: signatureData, aspectRatio: signatureRatio }, { dataUrl: stampData, aspectRatio: stampRatio }] = await Promise.all([
      fetchImageAsset(SIGNATURE_IMAGE_URL),
      fetchImageAsset(STAMP_IMAGE_URL),
    ]);

    const signatureWidth = 56; // slightly larger
    const signatureHeight = signatureWidth * signatureRatio;

    // Place signature on the bottom-right and the stamp image to its left (rotated look)
    const signatureX = pageWidth - margin - signatureWidth;
    const signatureY = footerY + 6;

    // Stamp dimensions
    const stampWidth = 56;
    const stampHeight = stampWidth * (stampRatio || 0.6);
    const stampX = signatureX - stampWidth - 12;
    const stampY = signatureY - 4;

    // Add stamp image (appear slightly rotated by offsetting)
    try {
      doc.addImage(stampData, 'PNG', stampX, stampY, stampWidth, stampHeight, undefined, 'FAST');
    } catch (err) {
      // fallback: draw placeholder box if image fails
      doc.setDrawColor(BOX_BORDER.r, BOX_BORDER.g, BOX_BORDER.b);
      doc.setFillColor(255, 255, 255);
      doc.rect(stampX, stampY, stampWidth, stampHeight, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Stamp', stampX + stampWidth / 2, stampY + stampHeight / 2 + 2, { align: 'center' });
    }

    // Add signature image
    try {
      doc.addImage(signatureData, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight, undefined, 'FAST');
    } catch (err) {
      // ignore if fails
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('Manager', signatureX + signatureWidth / 2, signatureY + signatureHeight + 8, { align: 'center' });

    // Clear small duplicate image at bottom-right (if any) by covering a small area to the right of the signature
    try {
      const clearX = signatureX + signatureWidth + 4;
      const clearY = signatureY;
      const clearW = Math.max(28, pageWidth - margin - clearX);
      const clearH = signatureHeight + 6;
      doc.setFillColor(255, 255, 255);
      doc.rect(clearX, clearY, clearW, clearH, 'F');
    } catch (err) {
      // ignore if signature coords not available
    }

    // ===== BOTTOM BAR =====
    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');

    const fileName = `Payment_Receipt_${referenceNumber}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error generating receipt:', error);
    throw new Error('Failed to generate receipt');
  }
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;
export default PaymentReceipt;
