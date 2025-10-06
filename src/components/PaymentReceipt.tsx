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

    const margin = 16;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Header
    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, 0, pageWidth, 7, 'F');

    const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
    const logoWidth = 38;
    const logoHeight = logoWidth * logoRatio;
    doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 23);

    const info = [
      'Address: PLOT NO-102,103, TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9',
    ];
    doc.setFontSize(7.8);
    info.forEach((line, i) => doc.text(line, margin, 28 + i * 3.7));

    doc.line(margin, 47, pageWidth - margin, 47);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('PAYMENT RECEIPT', pageWidth / 2, 57, { align: 'center' });

    // Details
    const detailTop = 63;
    const detailHeight = 40;
    doc.roundedRect(margin, detailTop, pageWidth - margin * 2, detailHeight, 2, 2, 'S');

    const refNo = `AGE${Date.now().toString().slice(-6)}`;
    const dateFormatted = new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const placeDetail = placeOfSupply.includes('(') ? placeOfSupply : `${placeOfSupply} (36)`;

    const rows = [
      { label: 'Payment Date', value: dateFormatted },
      { label: 'Reference No', value: refNo },
      { label: 'Payment Mode', value: paymentMode },
      { label: 'Place of Supply', value: placeDetail },
    ];
    doc.setFontSize(8);
    rows.forEach((r, i) => {
      const y = detailTop + 8 + i * 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`${r.label}:`, margin + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(r.value, margin + 40, y);
    });

    // Amount box
    const amtW = 60;
    const amtH = 22;
    const amtX = pageWidth - margin - amtW;
    const amtY = detailTop + 5;
    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.roundedRect(amtX, amtY, amtW, amtH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', amtX + amtW / 2, amtY + 7, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, amtX + amtW / 2, amtY + 17, { align: 'center' });

    // Amount in words
    const wordsY = detailTop + detailHeight + 7;
    doc.roundedRect(margin, wordsY, pageWidth - margin * 2, 14, 2, 2, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Amount in Words:', margin + 4, wordsY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    const wordsText = `Indian Rupee ${convertToWords(amount)} Only`;
    doc.text(doc.splitTextToSize(wordsText, pageWidth - margin * 2 - 8), margin + 4, wordsY + 10);

    // Received from
    const recvY = wordsY + 18;
    doc.roundedRect(margin, recvY, pageWidth - margin * 2, 20, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Received From:', margin + 4, recvY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text(receivedFrom, margin + 4, recvY + 11);
    if (customerAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const addr = doc.splitTextToSize(customerAddress, pageWidth - margin * 2 - 8);
      doc.text(addr, margin + 4, recvY + 15);
    }

    // Offerings box (smaller & tidy)
    const offers = [
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

    const boxX = margin;
    const boxY = pageHeight - 70;
    const boxW = 90;
    const boxH = offers.length * 4 + 12;
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Our Offerings:', boxX + 3, boxY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

    let y = boxY + 10;
    offers.forEach((item, i) => {
      doc.circle(boxX + 4, y - 2, 0.4, 'F');
      const text = i === 0 ? [item] : doc.splitTextToSize(item, boxW - 8);
      doc.text(text, boxX + 7, y);
      y += text.length * 3.5;
    });

    // Footer & Signature
    const footerTop = pageHeight - 22;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.8);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Thank you for choosing sustainable energy solutions!', pageWidth / 2, footerTop, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
    doc.text('For AXISO GREEN ENERGIES PVT. LTD.', pageWidth - margin - 62, footerTop + 7);

    const { dataUrl: signData, aspectRatio: signRatio } = await fetchImageAsset(SIGNATURE_IMAGE_URL);
    const signW = 36;
    const signH = signW * signRatio;
    const signX = pageWidth - margin - signW;
    const signY = footerTop + 9;
    doc.addImage(signData, 'PNG', signX, signY, signW, signH);
    doc.text('Manager', signX + signW / 2, signY + signH + 5, { align: 'center' });

    doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

    const fileName = `Payment_Receipt_${refNo}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  } catch (e) {
    console.error('Error generating PDF:', e);
  }
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;
export default PaymentReceipt;
