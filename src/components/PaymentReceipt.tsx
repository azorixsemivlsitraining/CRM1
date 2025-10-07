import React from 'react';
import jsPDF from 'jspdf';

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

const LOGO_URL = 'https://cdn.builder.io/api/v1/image/assets%2F59bf3e928fc9473a97d5e87470c824bb%2Fe73212a6556b469681e572b94a3fcc85?format=webp&width=800';
const FOOTER_SIGN_STAMP_URL = 'https://cdn.builder.io/api/v1/image/assets%2Fd6ed3a58ddbf4178909cabbd3ef86178%2F0237e5d9ea084a6abe20e0bc958c4e2c?format=webp&width=800';

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
    // scale logo to fit without stretching (reduced size)
    const maxLogoWidth = 68;
    const maxLogoHeight = 34;
    let logoWidth = maxLogoWidth;
    let logoHeight = logoWidth * logoRatio;
    if (logoHeight > maxLogoHeight) {
      logoHeight = maxLogoHeight;
      logoWidth = logoHeight / logoRatio;
    }
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
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERLINGAMPALLY',
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
    const wordsBlockY = detailTop + detailHeight + 12;
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
    const receivedBlockY = wordsBlockY + 22;
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

    // ===== WHY CHOOSE US BOX =====
    const whyChoose = [
      'Solar Roof Top Power Plants(ON-Grid, OFF-Grid & Hybrid).',
      'Solar Street Lights',
      'Solar Water Pumping System',
      'Solar Fencing',
      'Solar Pergolas',
      'Solar Dryers',
      'Batteries and Inverters',
      'Online UPS',
      'Solar Water Heating Systems',
      
    ];

    const whyBoxY = receivedBlockY + 28;
    const startY = whyBoxY + 12;
    const lineGap = 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    // Pre-calculate wrapped lines and height
    const contentWidth = pageWidth - margin * 2 - 24;
    let yCursor = startY;
    const itemsLayout: { wrapped: string[]; y: number }[] = [];
    whyChoose.forEach(item => {
      const wrapped = doc.splitTextToSize(item, contentWidth) as string[];
      itemsLayout.push({ wrapped, y: yCursor });
      yCursor += wrapped.length * lineGap;
    });

    const dynamicWhyBoxHeight = yCursor - whyBoxY + 8;

    // Draw background box
    const whyBoxX = margin;
    const whyBoxWidth = pageWidth - margin * 2;
    doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
    doc.roundedRect(whyBoxX, whyBoxY, whyBoxWidth, dynamicWhyBoxHeight, 3, 3, 'FD');

    // Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Our Other Offerings', whyBoxX + 8, whyBoxY + 8);

 // Render list with green checkmarks and all bold text
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);

const itemLineGap = 6; // line gap for wrapped lines
let yCursor = whyBoxY + 12 + 6; // heading y + heading bottom padding + extra gap before first item

itemsLayout.forEach((itemObj) => {
  const raw = itemObj.wrapped.join(' ');
  const wrappedText = doc.splitTextToSize(raw, contentWidth);

  const checkX = whyBoxX + 8;
  const textX = whyBoxX + 18;

  // ✅ Draw green checkmark at the first line
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
  doc.text('✓', checkX, yCursor);

  // ✅ Draw full bold text
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  wwrappedText.forEach((line: string, lineIndex: number) => {
  doc.text(line, textX, yCursor + lineIndex * itemLineGap);
});


  // Update cursor for next item (last line y + gap)
  yCursor += wrappedText.length * itemLineGap + 4; // 4 mm space between items
});




    // ===== FOOTER =====
    const footerY = whyBoxY + dynamicWhyBoxHeight + 14;

    // Thank you line
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
    doc.text('Thank you for choosing sustainable energy solutions!', pageWidth / 2, footerY, { align: 'center' });

    // ===== SIGNATURE IMAGE (from uploaded file) =====
    try {
      const { dataUrl: receiptSignData, aspectRatio: receiptSignRatio } = await fetchImageAsset(FOOTER_SIGN_STAMP_URL);
      const receiptWidth = 42;
      const receiptHeight = receiptWidth * (receiptSignRatio || 0.45);

      const thankYouText = 'Thank you for choosing sustainable energy solutions!';
      const thankYouWidth = doc.getTextWidth(thankYouText);
      const thankYouEndX = pageWidth / 2 + thankYouWidth / 2;

      const maxX = pageWidth - margin - receiptWidth;
      const preferredX = thankYouEndX + 6;
      const receiptX = Math.min(maxX, preferredX);
      const receiptY = footerY - receiptHeight + 4;

      doc.addImage(receiptSignData, 'PNG', receiptX, receiptY, receiptWidth, receiptHeight, undefined, 'FAST');
    } catch (err) {
      console.error('Receipt signature image error:', err);
    }

    // ===== BOTTOM GREEN BAR =====
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
