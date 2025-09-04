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

export async function generatePaymentReceiptPDF({ date, amount, receivedFrom, paymentMode, placeOfSupply, customerAddress }: PaymentReceiptProps) {
  // Helper function to convert number to words
  const convertToWords = (num: number): string => {
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const formatTens = (num: number): string => {
      if (num < 10) return single[num];
      if (num < 20) return double[num - 10];
      return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + single[num % 10] : '');
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
  };

  try {
    // Create a new PDF document with A4 size
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    // Set page dimensions
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Set white background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Header with green accent
    doc.setFillColor(72, 187, 120);
    doc.rect(0, 0, pageWidth, 8, 'F');
    
    // Company name - large and prominent
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(72, 187, 120);
    doc.text('AXISO GREEN ENERGIES PRIVATE LIMITED', margin, 25);
    
    // Tagline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text('Sustainable Energy Solutions for a Greener Tomorrow', margin, 33);
    
    // Company details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    const companyDetails = [
      'Address: PLOT NO-102,103 TEMPLE LANE MYTHRI NAGAR',
      'Shri Ambika Vidya Mandir, MATHRUSRINAGAR, SERILINGAMPALLY',
      'Hyderabad, Rangareddy, Telangana, 500049',
      'Email: contact@axisogreen.in | Website: www.axisogreen.in',
      'GSTIN: 36ABBCA4478M1Z9'
    ];
    
    companyDetails.forEach((detail, index) => {
      doc.text(detail, margin, 42 + (index * 4));
    });
    
    // AXISO logo placeholder (text-based)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(72, 187, 120);
    doc.text('AXISO', pageWidth - margin - 25, 30);
    
    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margin, 65, pageWidth - margin, 65);
    
    // Payment Receipt title - centered and bold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(72, 187, 120);
    const titleText = 'PAYMENT RECEIPT';
    const titleWidth = doc.getTextWidth(titleText);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.text(titleText, titleX, 80);
    
    // Format date properly
    let formattedDate = date;
    if (typeof date === 'string') {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    }
    
    // Reference number
    const refNumber = 'AGE' + Date.now().toString().slice(-6);
    
    // Payment details section
    const detailsStartY = 100;
    const leftColX = margin;
    const labelWidth = 50;
    const valueX = leftColX + labelWidth;
    
    // Payment details
    const paymentDetails = [
      { label: 'Payment Date:', value: formattedDate },
      { label: 'Reference No:', value: refNumber },
      { label: 'Payment Mode:', value: paymentMode },
      { label: 'Place of Supply:', value: getPlaceOfSupplyWithCode(placeOfSupply) }
    ];
    
    // Draw payment details
    paymentDetails.forEach((detail, index) => {
      const y = detailsStartY + (index * 8);
      
      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(detail.label, leftColX, y);
      
      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(detail.value, valueX, y);
    });
    
    // Amount section - prominent green box
    const amountBoxY = detailsStartY - 5;
    const amountBoxX = pageWidth - margin - 80;
    const amountBoxWidth = 75;
    const amountBoxHeight = 40;
    
    // Amount box with green background
    doc.setFillColor(72, 187, 120);
    doc.rect(amountBoxX, amountBoxY, amountBoxWidth, amountBoxHeight, 'F');
    
    // Amount text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED', amountBoxX + 5, amountBoxY + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    const amountText = `Rs. ${amount.toLocaleString('en-IN')}`;
    doc.text(amountText, amountBoxX + 5, amountBoxY + 25);
    
    // Amount in words section
    const wordsY = detailsStartY + 50;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text('Amount in Words:', leftColX, wordsY);
    
    // Amount in words with background
    const amountInWords = `Indian Rupee ${convertToWords(amount)} Only`;
    
    // Background for amount in words
    doc.setFillColor(248, 250, 252);
    doc.rect(leftColX, wordsY + 5, pageWidth - 2 * margin, 15, 'F');
    
    // Border for amount in words
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(leftColX, wordsY + 5, pageWidth - 2 * margin, 15);
    
    // Amount in words text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(72, 187, 120);
    doc.text(amountInWords, leftColX + 5, wordsY + 15);
    
    // Customer details section
    const customerY = wordsY + 35;
    
    // Section header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(72, 187, 120);
    doc.text('RECEIVED FROM', leftColX, customerY);
    
    // Customer details box
    const customerBoxY = customerY + 8;
    const customerBoxHeight = 25;
    
    // Customer box background
    doc.setFillColor(248, 250, 252);
    doc.rect(leftColX, customerBoxY, pageWidth - 2 * margin, customerBoxHeight, 'F');
    
    // Customer box border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(leftColX, customerBoxY, pageWidth - 2 * margin, customerBoxHeight);
    
    // Customer name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(receivedFrom, leftColX + 5, customerBoxY + 12);
    
    // Customer address
    if (customerAddress) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(customerAddress, leftColX + 5, customerBoxY + 20);
    }
    
    // Footer section
    const footerY = pageHeight - 40;

    // Thank you note
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for choosing sustainable energy solutions!', leftColX, footerY);

    // Authorized signature block (with company text, signature image, role, and label)
    try {
      const sigX = pageWidth - margin - 75;
      const sigTopY = footerY - 2;

      // "For Company" text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('For AXISO GREEN ENERGIES PVT. LTD.', sigX, sigTopY);

      // Signature image
      const imgData = await fetchImageAsDataURL(SIGNATURE_IMAGE_URL);
      const imgW = 70; // mm
      const imgH = 22; // mm
      doc.addImage(imgData, 'PNG', sigX, sigTopY + 3, imgW, imgH);

      // Role text below image
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 86, 170);
      doc.text('Manager', sigX + imgW - 22, sigTopY + imgH + 10);

      // Grey line and Authorized Signature label on left
      const lineY = footerY + 10;
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.6);
      doc.line(leftColX, lineY, leftColX + 70, lineY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text('Authorized Signature', leftColX, lineY + 6);
    } catch (e) {
      // Fallback to simple text if image fails
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('For AXISO GREEN ENERGIES PVT. LTD.', pageWidth - margin - 75, footerY + 4);
      doc.text('Authorized Signature', leftColX, footerY + 16);
    }

    // Bottom border
    doc.setFillColor(72, 187, 120);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    
    // Save the PDF
    const fileName = `Payment_Receipt_${refNumber}_${receivedFrom.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    
    return true;
    
  } catch (error) {
    console.error('Error generating payment receipt:', error);
    throw new Error('Failed to generate payment receipt. Please try again.');
  }
}

// Helper functions
const getPlaceOfSupplyWithCode = (placeOfSupply: string): string => {
  const stateCodes: Record<string, string> = {
    'Andhra Pradesh': 'Andhra Pradesh (37)',
    'Arunachal Pradesh': 'Arunachal Pradesh (12)',
    'Assam': 'Assam (18)',
    'Bihar': 'Bihar (10)',
    'Chhattisgarh': 'Chhattisgarh (22)',
    'Goa': 'Goa (30)',
    'Gujarat': 'Gujarat (24)',
    'Haryana': 'Haryana (06)',
    'Himachal Pradesh': 'Himachal Pradesh (02)',
    'Jharkhand': 'Jharkhand (20)',
    'Karnataka': 'Karnataka (29)',
    'Kerala': 'Kerala (32)',
    'Madhya Pradesh': 'Madhya Pradesh (23)',
    'Maharashtra': 'Maharashtra (27)',
    'Manipur': 'Manipur (14)',
    'Meghalaya': 'Meghalaya (17)',
    'Mizoram': 'Mizoram (15)',
    'Nagaland': 'Nagaland (13)',
    'Odisha': 'Odisha (21)',
    'Punjab': 'Punjab (03)',
    'Rajasthan': 'Rajasthan (08)',
    'Sikkim': 'Sikkim (11)',
    'Tamil Nadu': 'Tamil Nadu (33)',
    'Telangana': 'Telangana (36)',
    'Tripura': 'Tripura (16)',
    'Uttar Pradesh': 'Uttar Pradesh (09)',
    'Uttarakhand': 'Uttarakhand (05)',
    'West Bengal': 'West Bengal (19)',
    'Delhi': 'Delhi (07)',
    'TG': 'Telangana (36)',
    'AP': 'Andhra Pradesh (37)'
  };
  
  return stateCodes[placeOfSupply] || `${placeOfSupply} (36)`;
};

const PaymentReceipt: React.FC<PaymentReceiptProps> = () => null;

export default PaymentReceipt;
