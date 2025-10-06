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

const SIGNATURE_IMAGE_URL = 'https://cdn.builder.io/api/v1/image/assets%2F07ba826074254d3191a55ee32e800a58%2Fdba80239da89463d902e6021298aa064?format=png&width=600';
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

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, 0, pageWidth, 10, 'F');

    const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
    const logoWidth = 52;
    const logoHeight = logoWidth * logoRatio;
    doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 6, logoWidth, logoHeight, undefined, 'FAST');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 28);

    const companyLines = [
      'Address: PLOT NO-102,103, TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9',
    ];

    doc.setFontSize(9.5);
    companyLines.forEach((line, index) => {
      doc.text(line, margin, 35 + index * 5);
    });

    doc.setDrawColor(BOX_BORDER.r, BOX_BORDER.g, BOX_BORDER.b);
    doc.line(margin, 60, pageWidth - margin, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 76, { align: 'center' });

    const detailTop = 90;
    const detailHeight = 60;
    doc.setFillColor(255, 255, 255);
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

    doc.setFontSize(10.5);
    detailRows.forEach((row, index) => {
      const rowY = detailTop + 12 + index * 11;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`${row.label}:`, margin + 8, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(row.value, margin + 48, rowY);
    });

    const amountBoxWidth = 72;
    const amountBoxHeight = 34;
    const amountBoxX = pageWidth - margin - amountBoxWidth - 6;
    const amountBoxY = detailTop + 8;

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.roundedRect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', amountBoxX + amountBoxWidth / 2, amountBoxY + 10, { align: 'center' });

    doc.setFontSize(17);
    doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, amountBoxX + amountBoxWidth / 2, amountBoxY + 24, {
      align: 'center',
    });

    const wordsBlockY = detailTop + detailHeight + 18;
    const wordsBlockHeight = 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, wordsBlockY, pageWidth - margin * 2, wordsBlockHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Amount in Words', margin + 8, wordsBlockY + 8);

    const amountText = `Indian Rupee ${convertToWords(amount)} Only`;
    const wrappedAmountText = doc.splitTextToSize(amountText, pageWidth - margin * 2 - 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text(wrappedAmountText, margin + 8, wordsBlockY + 15);

    const receivedBlockY = wordsBlockY + wordsBlockHeight + 14;
    const receivedBlockHeight = 28 + (customerAddress ? 10 : 0);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, receivedBlockY, pageWidth - margin * 2, receivedBlockHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Received From', margin + 8, receivedBlockY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text(receivedFrom, margin + 8, receivedBlockY + 19);

    if (customerAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      const addressLines = doc.splitTextToSize(customerAddress, pageWidth - margin * 2 - 16);
      doc.text(addressLines, margin + 8, receivedBlockY + 26);
    }

    // ------------------- ADD OTHER OFFERINGS -------------------
    const offerings = [
      'Solar Roof Top',
      'Street Lights',
      'Water Pumping',
      'Fencing',
      'Pergolas',
      'Dryers',
    ];
    const offeringsStartY = pageHeight - 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('Other Offerings:', margin + 8, offeringsStartY);
    doc.setFont('helvetica', 'normal');
    offerings.forEach((item, idx) => {
      doc.text(`• ${item}`, margin + 12, offeringsStartY + 6 + idx * 5);
    });
    // -----------------------------------------------------------

    const footerTop = pageHeight - 20;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Thank you for choosing sustainable energy solutions!', pageWidth / 2, footerTop, {
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('For AXISO GREEN ENERGIES PVT. LTD.', pageWidth - margin - 70, footerTop + 16);

    const { dataUrl: signatureData, aspectRatio: signatureRatio } = await fetchImageAsset(SIGNATURE_IMAGE_URL);
    const signatureWidth = 48;
    const signatureHeight = signatureWidth * signatureRatio;
    const signatureX = pageWidth - margin - signatureWidth;
    const signatureY = footerTop + 18;

    doc.addImage(signatureData, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight, undefined, 'FAST');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('Manager', signatureX + signatureWidth / 2, signatureY + signatureHeight + 10, {
      align: 'center',
    });

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');

    const fileName = `Payment_Receipt_${referenceNumber}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Failed to generate receipt');
  }
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;
export default PaymentReceipt;
