import React from 'react';
import { jsPDF } from 'jspdf';

interface PaymentReceiptProps {
  date: string;
  amount: number;
  receivedFrom: string;
  paymentMode: string;
  placeOfSupply: string;
  customerAddress: string;
}

const SIGNATURE_IMAGE_URL = 'https://cdn.builder.io/api/v1/image/assets%2F07ba826074254d3191a55ee32e800a58%2Fdba80239da89463d902e6021298aa064?format=png&width=600';
const LOGO_URL = '/images/axiso-logo.png';

// Helper: fetch image as Base64
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

// Convert number to words (Indian system)
function convertToWords(num: number): string {
  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatTens = (n: number): string => {
    if (n < 10) return single[n];
    if (n < 20) return double[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
  };

  if (num === 0) return 'Zero';

  let words = '';

  if (num >= 10000000) {
    words += convertToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    words += convertToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    words += convertToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (num >= 100) {
    words += convertToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }
  if (num > 0) {
    words += formatTens(num);
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
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Green border top
    doc.setFillColor(72, 187, 120);
    doc.rect(0, 0, pageWidth, 8, 'F');

    // Company logo
    const logoData = await fetchImageAsDataURL(LOGO_URL);
    doc.addImage(logoData, 'PNG', pageWidth - margin - 50, 10, 45, 25);

    // Company Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(72, 187, 120);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 26);

    // Company details
    const details = [
      'Address: PLOT NO-102,103 TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9',
    ];
    details.forEach((line, i) => doc.text(line, margin, 34 + i * 5));

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 65, pageWidth - margin, 65);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(72, 187, 120);
    const title = 'PAYMENT RECEIPT';
    doc.text(title, pageWidth / 2, 80, { align: 'center' });

    // Payment Details
    const refNo = 'AGE' + Date.now().toString().slice(-6);
    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const leftY = 100;
    const paymentDetails = [
      { label: 'Payment Date:', value: formattedDate },
      { label: 'Reference No:', value: refNo },
      { label: 'Payment Mode:', value: paymentMode },
      { label: 'Place of Supply:', value: placeOfSupply + ' (36)' },
    ];

    paymentDetails.forEach((d, i) => {
      const y = leftY + i * 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text(d.label, margin, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(d.value, margin + 45, y);
    });

    // Amount box (green right side)
    const boxX = pageWidth - margin - 70;
    const boxY = leftY - 5;
    doc.setFillColor(72, 187, 120);
    doc.rect(boxX, boxY, 65, 30, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', boxX + 5, boxY + 8);

    doc.setFontSize(16);
    doc.text(`Rs. ${amount.toLocaleString('en-IN')}`, boxX + 5, boxY + 20);

    // Amount in words
    const words = `Indian Rupee ${convertToWords(amount)} Only`;
    const wordsY = leftY + 45;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Amount in Words:', margin, wordsY);

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, wordsY + 4, pageWidth - 2 * margin, 12, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, wordsY + 4, pageWidth - 2 * margin, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(72, 187, 120);
    doc.text(words, margin + 5, wordsY + 12);

    // Received From
    const fromY = wordsY + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(72, 187, 120);
    doc.text('RECEIVED FROM', margin, fromY);

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, fromY + 4, pageWidth - 2 * margin, 20, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, fromY + 4, pageWidth - 2 * margin, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(receivedFrom, margin + 5, fromY + 15);

    if (customerAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(customerAddress, margin + 5, fromY + 20);
    }

   // Footer (Thank you line moved above signature and green color)
const footerY = pageHeight - 50; // moved a bit higher
doc.setFont('helvetica', 'italic');
doc.setFontSize(11);
doc.setTextColor(72, 187, 120); // green color
doc.text('Thank you for choosing sustainable energy solutions!', margin, footerY);

// Signature
try {
  const sigData = await fetchImageAsDataURL(SIGNATURE_IMAGE_URL);
  const sigX = pageWidth - margin - 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('For AXISO GREEN ENERGIES PVT. LTD.', sigX, footerY + 10);

  doc.addImage(sigData, 'PNG', sigX, footerY + 12, 55, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 80, 160);
  doc.text('Manager', sigX + 25, footerY + 35);
} catch {
  doc.text('Authorized Signature', pageWidth - margin - 60, footerY + 30);
}

// Authorized signature line
doc.setDrawColor(150, 150, 150);
doc.line(margin, footerY + 15, margin + 60, footerY + 15);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.setTextColor(80, 80, 80);
doc.text('Authorized Signature', margin, footerY + 22);
    // Green footer bar
    doc.setFillColor(72, 187, 120);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');

    const fileName = `Payment_Receipt_${refNo}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error('Error:', err);
    throw new Error('Failed to generate receipt');
  }
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;
export default PaymentReceipt;
