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

const SIGNATURE_IMAGE_URL =
  'https://cdn.builder.io/api/v1/image/assets%2F07ba826074254d3191a55ee32e800a58%2Fdba80239da89463d902e6021298aa064?format=png&width=600';
const LOGO_URL = '/images/axiso-logo.png';

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

    // Header bar
    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, 0, pageWidth, 10, 'F');

    // Logo
    const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
    const logoWidth = 48;
    const logoHeight = logoWidth * logoRatio;
    doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight, undefined, 'FAST');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 26);

    const companyLines = [
      'Address: PLOT NO-102,103, TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9',
    ];

    doc.setFontSize(8);
    companyLines.forEach((line, index) => {
      doc.text(line, margin, 32 + index * 4);
    });

    doc.line(margin, 54, pageWidth - margin, 54);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 66, { align: 'center' });

    const detailTop = 75;
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

    doc.setFontSize(9);
    detailRows.forEach((row, index) => {
      const rowY = detailTop + 10 + index * 9;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`${row.label}:`, margin + 8, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(row.value, margin + 45, rowY);
    });

    // Amount box
    const amountBoxWidth = 65;
    const amountBoxHeight = 28;
    const amountBoxX = pageWidth - margin - amountBoxWidth - 4;
    const amountBoxY = detailTop + 6;

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.roundedRect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', amountBoxX + amountBoxWidth / 2, amountBoxY + 8, { align: 'center' });

    doc.setFontSize(13);
    doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, amountBoxX + amountBoxWidth / 2, amountBoxY + 19, { align: 'center' });

    // Amount in words
    const wordsBlockY = detailTop + detailHeight + 10;
    const wordsBlockHeight = 16;
    doc.roundedRect(margin, wordsBlockY, pageWidth - margin * 2, wordsBlockHeight, 3, 3, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Amount in Words:', margin + 8, wordsBlockY + 6);

    const amountText = `Indian Rupee ${convertToWords(amount)} Only`;
    const wrappedAmountText = doc.splitTextToSize(amountText, pageWidth - margin * 2 - 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text(wrappedAmountText, margin + 8, wordsBlockY + 11);

    // Received from
    const receivedBlockY = wordsBlockY + wordsBlockHeight + 8;
    const receivedBlockHeight = 22 + (customerAddress ? 8 : 0);
    doc.roundedRect(margin, receivedBlockY, pageWidth - margin * 2, receivedBlockHeight, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Received From:', margin + 8, receivedBlockY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text(receivedFrom, margin + 8, receivedBlockY + 14);

    if (customerAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const addressLines = doc.splitTextToSize(customerAddress, pageWidth - margin * 2 - 16);
      doc.text(addressLines, margin + 8, receivedBlockY + 19);
    }

    // ===== OUR OFFERINGS BOX + SIGN/STAMP (CLEAN + SAME LAYOUT) =====

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

// Offerings box positioned above footer
const offeringsBoxX = margin;
const offeringsBoxY = pageHeight - 80;
const offeringsBoxWidth = 95; // fixed to text width, not full
const offeringsBoxHeight = offerings.length * 4 + 14;

// Draw box
doc.setDrawColor(BOX_BORDER.r, BOX_BORDER.g, BOX_BORDER.b);
doc.setFillColor(248, 249, 250); // light grey background
doc.roundedRect(offeringsBoxX, offeringsBoxY, offeringsBoxWidth, offeringsBoxHeight, 3, 3, 'FD');

// Title
doc.setFont('helvetica', 'bold');
doc.setFontSize(9.5);
doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
doc.text('Our Offerings:', offeringsBoxX + 5, offeringsBoxY + 6);

// List items
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.2);
doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

let bulletY = offeringsBoxY + 11;
offerings.forEach((item) => {
  doc.circle(offeringsBoxX + 5, bulletY - 2, 0.5, 'F');
  const wrapped = doc.splitTextToSize(item, offeringsBoxWidth - 12);
  doc.text(wrapped, offeringsBoxX + 8, bulletY);
  bulletY += wrapped.length * 3.5;
});

// ===== SIGNATURE + STAMP (RIGHT SIDE OF OFFERINGS BOX) =====
const signBoxX = offeringsBoxX + offeringsBoxWidth + 10;
const signBoxY = offeringsBoxY;
const signAreaWidth = 75;
const signAreaHeight = offeringsBoxHeight;

// Optional border (for clarity)
doc.setDrawColor(255, 255, 255);
doc.roundedRect(signBoxX, signBoxY, signAreaWidth, signAreaHeight, 3, 3, 'S');

// Label
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);
doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
doc.text('For AXISO GREEN ENERGIES PVT. LTD.', signBoxX + 4, signBoxY + 8);

// Signature image
const { dataUrl: signatureData, aspectRatio: signatureRatio } = await fetchImageAsset(SIGNATURE_IMAGE_URL);
const signatureWidth = 40;
const signatureHeight = signatureWidth * signatureRatio;
const signatureX = signBoxX + signAreaWidth / 2 - signatureWidth / 2;
const signatureY = signBoxY + 12;
doc.addImage(signatureData, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight, undefined, 'FAST');

// Stamp image (optional)
const STAMP_URL = '/images/axiso-stamp.png'; // <-- replace with your actual stamp URL
const { dataUrl: stampData, aspectRatio: stampRatio } = await fetchImageAsset(STAMP_URL);
const stampWidth = 32;
const stampHeight = stampWidth * stampRatio;
const stampX = signatureX + 10;
const stampY = signatureY + signatureHeight - 5;
doc.addImage(stampData, 'PNG', stampX, stampY, stampWidth, stampHeight, undefined, 'FAST');

// Manager label
doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
doc.text('Manager', signBoxX + signAreaWidth / 2, signBoxY + signAreaHeight - 4, { align: 'center' });

// ===== THANK YOU FOOTER =====
const footerTop = pageHeight - 10;
doc.setFont('helvetica', 'italic');
doc.setFontSize(9);
doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
doc.text('Thank you for choosing sustainable energy solutions!', pageWidth / 2, footerTop - 2, { align: 'center' });

// Bottom color bar
doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');


    const fileName = `Payment_Receipt_${referenceNumber}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to generate receipt');
  }
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;
export default PaymentReceipt;
