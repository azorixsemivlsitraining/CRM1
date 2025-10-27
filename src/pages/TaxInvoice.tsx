import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
  HStack,
  Flex,
  SimpleGrid,
  Badge,
  IconButton,
  Spinner,
  Center,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon, DownloadIcon } from '@chakra-ui/icons';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatSupabaseError } from '../utils/error';

interface SubItem {
  id: string;
  description: string;
}

interface InvoiceItem {
  id: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  cgst_rate: number;
  sgst_rate: number;
  subItems?: SubItem[];
}

interface TaxInvoiceData {
  id?: string;
  customer_name: string;
  state: string;
  place_of_supply: string;
  gst_number: string;
  invoice_number: string;
  invoice_date: string;
  bill_to_name: string;
  bill_to_address: string;
  bill_to_gst: string;
  ship_to_name: string;
  ship_to_address: string;
  items: InvoiceItem[];
  notes: string;
  terms_and_conditions: string;
  created_at?: string;
  updated_at?: string;
}

const LOGO_URL = 'https://cdn.builder.io/api/v1/image/assets%2Fa31d1200efef4b74975fb36c4890f8c1%2F80d2848c756046eb88adca5a77fec3e6?format=webp&width=800';
const STAMP_URL = 'https://cdn.builder.io/api/v1/image/assets%2Fa31d1200efef4b74975fb36c4890f8c1%2F7b695dbf880d48f38857f81c589061b2?format=webp&width=800';

const COMPANY_INFO = {
  name: 'Axiso Green Energies Private Limited',
  address: 'Plot No-102,103, Temple Lane Mythri Nagar, Shri Ambika Vidya Mandir, Mathrusrinagar, Serlingampally, Hyderabad, Rangareddy, Telangana 500049',
  phone: '+91 88888 88898',
  email: 'admin@axisogreen.in',
  website: 'www.axisogreen.in',
  gstin: '36ABBCA4478M1Z9',
};

async function fetchImageAsDataURL(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error fetching image:', err);
    return '';
  }
}

async function getNextGSTNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('gst_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastGst = data[0].gst_number;
      const num = parseInt(lastGst.replace('IN-', ''), 10);
      const nextNum = (num + 1).toString().padStart(6, '0');
      return `IN-${nextNum}`;
    }

    return 'IN-000001';
  } catch (err) {
    console.error('Error getting next GST number:', err);
    return `IN-${Date.now().toString().slice(-6)}`;
  }
}

async function getNextInvoiceNumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastInv = data[0].invoice_number;
      const num = parseInt(lastInv.replace('INV-', ''), 10);
      const nextNum = (num + 1).toString().padStart(6, '0');
      return `INV-${nextNum}`;
    }

    return 'INV-000001';
  } catch (err) {
    console.error('Error getting next invoice number:', err);
    return `INV-${Date.now().toString().slice(-6)}`;
  }
}

function convertNumberToWords(num: number): string {
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
    words += `${convertNumberToWords(Math.floor(workingValue / 10000000))} Crore `;
    workingValue %= 10000000;
  }
  if (workingValue >= 100000) {
    words += `${convertNumberToWords(Math.floor(workingValue / 100000))} Lakh `;
    workingValue %= 100000;
  }
  if (workingValue >= 1000) {
    words += `${convertNumberToWords(Math.floor(workingValue / 1000))} Thousand `;
    workingValue %= 1000;
  }
  if (workingValue >= 100) {
    words += `${convertNumberToWords(Math.floor(workingValue / 100))} Hundred `;
    workingValue %= 100;
  }
  if (workingValue > 0) {
    words += formatTens(workingValue);
  }

  return words.trim();
}

async function generateTaxInvoicePDF(invoice: TaxInvoiceData) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    const colors = {
      primary: { r: 60, g: 100, b: 60 },
      secondary: { r: 100, g: 120, b: 100 },
      text: { r: 40, g: 40, b: 40 },
      lightGray: { r: 248, g: 248, b: 248 },
      border: { r: 200, g: 200, b: 200 },
      headerBg: { r: 60, g: 100, b: 60 },
    };

    let yPos = margin;

    // Header with logo and company info
    try {
      const logoData = await fetchImageAsDataURL(LOGO_URL);
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, yPos, 22, 22, undefined, 'FAST');
      }
    } catch (err) {
      console.error('Logo error:', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(COMPANY_INFO.name, margin + 24, yPos + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(`GST: ${COMPANY_INFO.gstin}`, margin + 24, yPos + 8);
    doc.text(`Phone: ${COMPANY_INFO.phone}`, margin + 24, yPos + 12);
    doc.text(`Email: ${COMPANY_INFO.email}`, margin + 24, yPos + 16);
    doc.text(`Website: ${COMPANY_INFO.website}`, margin + 24, yPos + 20);

    yPos += 28;

    // TAX INVOICE title and right side info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('TAX INVOICE', pageWidth - margin - 50, yPos - 5, { align: 'right' });

    // Invoice details on right side
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    const rightInfoX = pageWidth - margin - 60;
    const rightValueX = pageWidth - margin - 5;
    let infoY = yPos + 5;

    doc.text('#', rightInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(invoice.invoice_number, rightValueX, infoY, { align: 'right' });

    infoY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice Date', rightInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), rightValueX, infoY, { align: 'right' });

    infoY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Terms', rightInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text('PIA', rightValueX, infoY, { align: 'right' });

    infoY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Due Date', rightInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    const dueDateObj = new Date(invoice.invoice_date);
    dueDateObj.setDate(dueDateObj.getDate() + 45);
    doc.text(dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), rightValueX, infoY, { align: 'right' });

    // Left side invoice details
    const leftInfoX = margin;
    infoY = yPos + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('#', leftInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(invoice.gst_number, leftInfoX + 5, infoY);

    infoY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('GST #', leftInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.gst_number, leftInfoX + 5, infoY);

    infoY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Place of Supply', leftInfoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.place_of_supply, leftInfoX + 5, infoY);

    yPos += 32;

    // Bill To and Ship To section with boxes
    const billToX = margin;
    const billToWidth = contentWidth / 2 - 1.5;
    const shipToX = billToX + billToWidth + 3;
    const shipToWidth = contentWidth / 2 - 1.5;
    const billShipHeight = 24;

    // Bill To box
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.5);
    doc.rect(billToX, yPos, billToWidth, billShipHeight);

    // Ship To box
    doc.rect(shipToX, yPos, shipToWidth, billShipHeight);

    // Bill To header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(billToX, yPos, billToWidth, 5, 'F');
    doc.text('Bill To', billToX + 2, yPos + 3.5);

    // Bill To content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(invoice.bill_to_name || 'N/A', billToX + 2, yPos + 9);

    const billToAddressLines = doc.splitTextToSize(invoice.bill_to_address || '', billToWidth - 4);
    doc.setFontSize(7.5);
    doc.text(billToAddressLines, billToX + 2, yPos + 13, { maxWidth: billToWidth - 4 });

    // Ship To header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(shipToX, yPos, shipToWidth, 5, 'F');
    doc.text('Ship To', shipToX + 2, yPos + 3.5);

    // Ship To content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(invoice.ship_to_name || 'N/A', shipToX + 2, yPos + 9);

    const shipToAddressLines = doc.splitTextToSize(invoice.ship_to_address || '', shipToWidth - 4);
    doc.setFontSize(7.5);
    doc.text(shipToAddressLines, shipToX + 2, yPos + 13, { maxWidth: shipToWidth - 4 });

    yPos += billShipHeight + 3;

    // Items Table with professional formatting
    const tableTop = yPos;
    const colWidths = [7, 32, 11, 10, 14, 13, 13, 20];
    let colX = margin;

    // Table header background
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(margin, tableTop, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    const headers = ['#', 'Item & Description', 'HSN/SAC', 'Qty', 'Rate', 'CGST %', 'SGST %', 'Amount'];
    colX = margin + 1.2;

    for (let i = 0; i < headers.length; i++) {
      const align = i === 0 || i === 1 ? 'left' : 'center';
      doc.text(headers[i], colX, tableTop + 4.5, { align });
      colX += colWidths[i];
    }

    yPos = tableTop + 8.5;

    // Items rows - each item as a separate row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.3);

    let grandTotalQty = 0;
    let grandTotalRate = 0;
    let grandTotalCgst = 0;
    let grandTotalSgst = 0;
    let grandTotalAmount = 0;
    const rowHeight = 5;

    invoice.items.forEach((item, itemIndex) => {
      // Calculate individual item totals
      const itemRate = item.rate * item.quantity;
      const itemCgst = (itemRate * item.cgst_rate) / 100;
      const itemSgst = (itemRate * item.sgst_rate) / 100;
      const itemAmount = itemRate + itemCgst + itemSgst;

      // Add to grand totals
      grandTotalQty += item.quantity;
      grandTotalRate += itemRate;
      grandTotalCgst += itemCgst;
      grandTotalSgst += itemSgst;
      grandTotalAmount += itemAmount;

      // Item number
      colX = margin + 0.5;
      doc.text((itemIndex + 1).toString(), colX, yPos + 2.5, { align: 'center' });

      // Item description
      colX += colWidths[0];
      const itemDesc = `Renewable Energy Devices and accessories`;
      const wrappedDesc = doc.splitTextToSize(itemDesc, colWidths[1] - 1);
      doc.text(wrappedDesc, colX + 1, yPos + 1.5, { maxWidth: colWidths[1] - 2 });

      // HSN code
      colX += colWidths[1];
      doc.text(item.hsn_code, colX, yPos + 2.5, { align: 'center' });

      // Quantity
      colX += colWidths[2];
      doc.text(item.quantity.toString(), colX, yPos + 2.5, { align: 'center' });

      // Rate
      colX += colWidths[3];
      doc.text(itemRate.toFixed(2), colX, yPos + 2.5, { align: 'right' });

      // CGST
      colX += colWidths[4];
      doc.text(`${item.cgst_rate}%`, colX - 3, yPos + 0.5, { align: 'center' });
      doc.text(itemCgst.toFixed(2), colX, yPos + 3, { align: 'right' });

      // SGST
      colX += colWidths[5];
      doc.text(`${item.sgst_rate}%`, colX - 3, yPos + 0.5, { align: 'center' });
      doc.text(itemSgst.toFixed(2), colX, yPos + 3, { align: 'right' });

      // Total amount
      colX += colWidths[6];
      doc.text(itemAmount.toFixed(2), colX, yPos + 2.5, { align: 'right' });

      yPos += rowHeight + 1;

      // Draw horizontal line between items
      doc.line(margin, yPos, margin + contentWidth, yPos);
      yPos += 0.5;
    });

    // Grand totals row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(margin, yPos, contentWidth, 5, 'F');

    colX = margin + 0.5;
    doc.text('TOTAL', colX, yPos + 3.2, { align: 'center' });

    colX += colWidths[0] + colWidths[1] + colWidths[2];
    doc.text(grandTotalRate.toFixed(2), colX, yPos + 3.2, { align: 'right' });

    colX += colWidths[3];
    doc.text(grandTotalCgst.toFixed(2), colX, yPos + 3.2, { align: 'right' });

    colX += colWidths[4];
    doc.text(grandTotalSgst.toFixed(2), colX, yPos + 3.2, { align: 'right' });

    colX += colWidths[5];
    doc.text(grandTotalAmount.toFixed(2), colX, yPos + 3.2, { align: 'right' });

    yPos += 6;

    // Draw table borders
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.5);
    doc.rect(margin, tableTop, contentWidth, yPos - tableTop);

    yPos += 2;

    // Summary box
    const summaryX = pageWidth - margin - 62;
    const summaryWidth = 58;
    const summaryItemHeight = 5;

    doc.setFillColor(colors.lightGray.r, colors.lightGray.g, colors.lightGray.b);
    doc.rect(summaryX, yPos, summaryWidth, 28, 'F');
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.setLineWidth(0.5);
    doc.rect(summaryX, yPos, summaryWidth, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    let summaryY = yPos + 3.5;
    doc.text('Sub Total', summaryX + 2, summaryY);
    doc.text('₹ ' + grandTotalRate.toFixed(2), summaryX + summaryWidth - 2, summaryY, { align: 'right' });

    summaryY += summaryItemHeight;
    doc.text(`CGST (${invoice.items[0]?.cgst_rate || 9}%)`, summaryX + 2, summaryY);
    doc.text('₹ ' + grandTotalCgst.toFixed(2), summaryX + summaryWidth - 2, summaryY, { align: 'right' });

    summaryY += summaryItemHeight;
    doc.text(`SGST (${invoice.items[0]?.sgst_rate || 9}%)`, summaryX + 2, summaryY);
    doc.text('₹ ' + grandTotalSgst.toFixed(2), summaryX + summaryWidth - 2, summaryY, { align: 'right' });

    summaryY += summaryItemHeight + 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Total', summaryX + 2, summaryY);
    doc.text(`Rs.${grandTotalAmount.toFixed(2)}`, summaryX + summaryWidth - 2, summaryY, { align: 'right' });

    yPos += 35;

    // Amount in words section
    const amountWords = convertNumberToWords(Math.floor(grandTotalAmount));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text('Total in Words', margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const wrappedWords = doc.splitTextToSize(`Indian Rupee ${amountWords} Only`, contentWidth - 40);
    doc.text(wrappedWords, margin, yPos + 5);

    yPos += 12;

    // Notes section
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text('Notes', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const wrappedNotes = doc.splitTextToSize(invoice.notes, contentWidth);
      doc.text(wrappedNotes, margin, yPos + 4, { maxWidth: contentWidth });
      yPos += wrappedNotes.length * 3.5 + 5;
    }

    yPos += 2;

    // Terms and Conditions section
    if (invoice.terms_and_conditions) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text('Terms & Conditions', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const wrappedTerms = doc.splitTextToSize(invoice.terms_and_conditions, contentWidth);
      doc.text(wrappedTerms, margin, yPos + 4, { maxWidth: contentWidth });
    }

    // Signature area at bottom - improved layout
    const signY = pageHeight - 35;

    // Left side - Authorized Signature
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.line(margin, signY - 2, margin + 35, signY - 2);
    doc.text('Authorized Signature', margin + 12, signY + 3, { align: 'center' });

    // Right side - Manager/Signature
    const signRightX = pageWidth - margin - 50;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('For AXISO GREEN ENERGIES PVT LTD', signRightX, signY - 12);

    try {
      const stampData = await fetchImageAsDataURL(STAMP_URL);
      if (stampData) {
        doc.addImage(stampData, 'PNG', signRightX + 5, signY - 20, 40, 20, undefined, 'FAST');
      }
    } catch (err) {
      console.error('Stamp error:', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.primary.b);
    doc.line(signRightX + 8, signY, signRightX + 40, signY);
    doc.text('Manager', signRightX + 24, signY + 4, { align: 'center' });

    // Footer
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(0, pageHeight - 7, pageWidth, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`GSTIN: ${COMPANY_INFO.gstin} | Email: ${COMPANY_INFO.email} | Web: ${COMPANY_INFO.website}`, pageWidth / 2, pageHeight - 3, { align: 'center' });

    doc.save(`TaxInvoice_${invoice.invoice_number}_${invoice.gst_number}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}

const TaxInvoice: React.FC = () => {
  const [invoices, setInvoices] = useState<TaxInvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState<TaxInvoiceData>({
    customer_name: '',
    state: 'Telangana',
    place_of_supply: 'Telangana (36)',
    gst_number: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    bill_to_name: '',
    bill_to_address: '',
    bill_to_gst: '',
    ship_to_name: '',
    ship_to_address: '',
    items: [{ id: '1', hsn_code: '708541', quantity: 1, rate: 0, cgst_rate: 9, sgst_rate: 9 }],
    notes: '',
    terms_and_conditions: 'Warranty: 3 Years against Manufacturing Defects. 25 Years linear Power Warranty on Solar Modules.',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const { isFinance, isAdmin } = useAuth();
  const toast = useToast();

  const authorized = isFinance || isAdmin;

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tax_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }

      // Map database records to include generated invoice_number and invoice_date
      const mappedInvoices = (data || []).map((record: any, index: number) => ({
        ...record,
        gst_number: record.gst_no,
        invoice_number: `INV-${String(index + 1).padStart(6, '0')}`,
        invoice_date: record.created_at ? new Date(record.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        bill_to_name: '',
        bill_to_address: '',
        bill_to_gst: '',
        ship_to_name: '',
        ship_to_address: '',
        notes: '',
        terms_and_conditions: '',
      }));

      setInvoices(mappedInvoices as TaxInvoiceData[]);
    } catch (error: any) {
      let errorMsg = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMsg = error.message || error.details || error.hint || error.code || JSON.stringify(error);
      }

      console.error('Error fetching invoices:', errorMsg, 'Full error:', error);

      // Check if table doesn't exist
      if (errorMsg.includes('relation') || errorMsg.includes('does not exist') || errorMsg.includes('404')) {
        toast({
          title: 'Setup Required',
          description: 'Tax invoices table not found. Please create it in Supabase first. Check TAX_INVOICE_TROUBLESHOOTING.md for instructions.',
          status: 'warning',
          duration: 6000,
          isClosable: true,
        });
      } else if (errorMsg.includes('permission') || errorMsg.includes('policy')) {
        toast({
          title: 'Permission Error',
          description: `You don't have permission to access tax invoices. Ensure you're logged in as Finance or Admin. Error: ${errorMsg}`,
          status: 'error',
          duration: 6000,
          isClosable: true,
        });
      } else if (errorMsg.includes('Supabase is not configured') || errorMsg.includes('environment')) {
        toast({
          title: 'Configuration Error',
          description: 'Supabase is not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.',
          status: 'error',
          duration: 6000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error Loading Invoices',
          description: errorMsg || 'Failed to load invoices. Check browser console for details.',
          status: 'error',
          duration: 6000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authorized) return;
    fetchInvoices();
  }, [authorized, fetchInvoices]);

  const openCreateForm = async () => {
    try {
      const gstNumber = await getNextGSTNumber();
      const invoiceNumber = await getNextInvoiceNumber();
      setFormData({
        customer_name: '',
        state: 'Telangana',
        place_of_supply: 'Telangana (36)',
        gst_number: gstNumber,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        bill_to_name: '',
        bill_to_address: '',
        bill_to_gst: '',
        ship_to_name: '',
        ship_to_address: '',
        items: [{ id: '1', hsn_code: '708541', quantity: 1, rate: 0, cgst_rate: 9, sgst_rate: 9 }],
        notes: '',
        terms_and_conditions: 'Warranty: 3 Years against Manufacturing Defects. 25 Years linear Power Warranty on Solar Modules.',
      });
      setEditingId(null);
      onOpen();
    } catch (error: any) {
      console.error('Error generating numbers:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invoice/GST numbers. Make sure the table exists in Supabase.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const openEditForm = (invoice: TaxInvoiceData) => {
    setFormData(invoice);
    setEditingId(invoice.id || null);
    onOpen();
  };

  const handleInputChange = (field: keyof TaxInvoiceData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: field === 'hsn_code' ? value : parseFloat(value) || 0 };
    setFormData(prev => ({
      ...prev,
      items: newItems,
    }));
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      hsn_code: '708541',
      quantity: 1,
      rate: 0,
      cgst_rate: 9,
      sgst_rate: 9,
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
    }
  };

  const addSubItem = (itemIndex: number) => {
    const newItems = [...formData.items];
    if (!newItems[itemIndex].subItems) {
      newItems[itemIndex].subItems = [];
    }
    const newSubItem: SubItem = {
      id: Date.now().toString(),
      description: '',
    };
    newItems[itemIndex].subItems!.push(newSubItem);
    setFormData(prev => ({
      ...prev,
      items: newItems,
    }));
  };

  const handleSubItemChange = (itemIndex: number, subItemIndex: number, description: string) => {
    const newItems = [...formData.items];
    if (newItems[itemIndex].subItems) {
      newItems[itemIndex].subItems![subItemIndex].description = description;
      setFormData(prev => ({
        ...prev,
        items: newItems,
      }));
    }
  };

  const removeSubItem = (itemIndex: number, subItemIndex: number) => {
    const newItems = [...formData.items];
    if (newItems[itemIndex].subItems) {
      newItems[itemIndex].subItems!.splice(subItemIndex, 1);
      setFormData(prev => ({
        ...prev,
        items: newItems,
      }));
    }
  };

  const handleSaveInvoice = async () => {
    if (!formData.customer_name || !formData.place_of_supply || !formData.state || formData.items.length === 0) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields (Customer name, Place of supply, State, and Items)',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setSubmitLoading(true);

      // Clean items - only include required fields
      const cleanItems = formData.items.map(item => ({
        hsn_code: item.hsn_code || '',
        quantity: Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        cgst_rate: Number(item.cgst_rate) || 0,
        sgst_rate: Number(item.sgst_rate) || 0,
        subItems: item.subItems && item.subItems.length > 0 ? item.subItems : undefined,
      }));

      // Prepare invoice data - only save columns that exist in the database table
      // The table has: id, customer_name, place_of_supply, state, gst_no, items, created_at, updated_at
      const invoiceToSave = {
        customer_name: formData.customer_name.trim(),
        place_of_supply: formData.place_of_supply.trim(),
        state: formData.state.trim(),
        gst_no: formData.gst_number.trim(),
        items: cleanItems,
      };

      console.log('Saving invoice:', invoiceToSave);

      if (editingId) {
        const { error } = await supabase
          .from('tax_invoices')
          .update(invoiceToSave)
          .eq('id', editingId);

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        toast({ title: 'Success', description: 'Invoice updated', status: 'success', duration: 2000, isClosable: true });
      } else {
        const { error } = await supabase
          .from('tax_invoices')
          .insert([invoiceToSave]);

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
        toast({ title: 'Success', description: 'Invoice created', status: 'success', duration: 2000, isClosable: true });
      }

      onClose();
      await fetchInvoices();
    } catch (error: any) {
      const errorMsg = formatSupabaseError(error);
      console.error('Error saving invoice:', errorMsg, 'Full error:', error);
      toast({
        title: 'Error Saving Invoice',
        description: errorMsg,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('tax_invoices')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Invoice deleted', status: 'success', duration: 2000, isClosable: true });
      setDeleteId(null);
      onDeleteClose();
      await fetchInvoices();
    } catch (error: any) {
      const errorMsg = formatSupabaseError(error);
      console.error('Error deleting invoice:', errorMsg);
      toast({
        title: 'Error',
        description: `Failed to delete invoice: ${errorMsg}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDownloadPDF = async (invoice: TaxInvoiceData) => {
    try {
      await generateTaxInvoicePDF(invoice);
      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error: any) {
      const errorMsg = formatSupabaseError(error);
      console.error('Error generating PDF:', errorMsg);
      toast({
        title: 'Error',
        description: `Failed to generate PDF: ${errorMsg}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (!authorized) {
    return (
      <Center h="100vh">
        <Text>You do not have permission to access this page</Text>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="green.500" />
      </Center>
    );
  }

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <Flex justify="space-between" align="center" mb={6}>
        <Heading as="h1" size="xl">Tax Invoices</Heading>
        <Button colorScheme="green" onClick={openCreateForm}>
          Create Invoice
        </Button>
      </Flex>

      <Card>
        <CardHeader>
          <Text fontWeight="semibold">All Invoices ({invoices.length})</Text>
        </CardHeader>
        <CardBody>
          <TableContainer>
            <Table variant="simple">
              <Thead>
                <Tr bg="green.50">
                  <Th>GST #</Th>
                  <Th>Invoice #</Th>
                  <Th>Invoice Date</Th>
                  <Th>Bill To</Th>
                  <Th isNumeric>Total Amount</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {invoices.map(invoice => {
                  const total = invoice.items.reduce((sum, item) => {
                    const itemTotal = item.rate * item.quantity;
                    const cgst = (itemTotal * item.cgst_rate) / 100;
                    const sgst = (itemTotal * item.sgst_rate) / 100;
                    return sum + itemTotal + cgst + sgst;
                  }, 0);

                  return (
                    <Tr key={invoice.id}>
                      <Td>
                        <Badge colorScheme="green">{invoice.gst_number}</Badge>
                      </Td>
                      <Td fontWeight="medium">{invoice.invoice_number}</Td>
                      <Td>{new Date(invoice.invoice_date).toLocaleDateString()}</Td>
                      <Td>{invoice.bill_to_name}</Td>
                      <Td isNumeric fontWeight="bold">₹{total.toFixed(2)}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="Download PDF"
                            icon={<DownloadIcon />}
                            size="sm"
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleDownloadPDF(invoice)}
                          />
                          <IconButton
                            aria-label="Edit"
                            icon={<EditIcon />}
                            size="sm"
                            colorScheme="gray"
                            variant="outline"
                            onClick={() => openEditForm(invoice)}
                          />
                          <IconButton
                            aria-label="Delete"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                            onClick={() => {
                              setDeleteId(invoice.id || '');
                              onDeleteOpen();
                            }}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  );
                })}
                {invoices.length === 0 && (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={8} color="gray.500">
                      No invoices found. Create one to get started.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </CardBody>
      </Card>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>{editingId ? 'Edit Invoice' : 'Create New Invoice'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              <SimpleGrid columns={2} spacing={4}>
                <FormControl isReadOnly>
                  <FormLabel>GST Number</FormLabel>
                  <Input value={formData.gst_number} />
                </FormControl>
                <FormControl isReadOnly>
                  <FormLabel>Invoice Number</FormLabel>
                  <Input value={formData.invoice_number} />
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel>Invoice Date</FormLabel>
                <Input
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                />
              </FormControl>

              <SimpleGrid columns={2} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Customer Name</FormLabel>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    placeholder="Enter customer name"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>State</FormLabel>
                  <Select value={formData.state} onChange={(e) => handleInputChange('state', e.target.value)}>
                    <option value="Telangana">Telangana</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl isRequired>
                <FormLabel>Place of Supply</FormLabel>
                <Select value={formData.place_of_supply} onChange={(e) => handleInputChange('place_of_supply', e.target.value)}>
                  <option value="Telangana (36)">Telangana (36)</option>
                  <option value="Andhra Pradesh (37)">Andhra Pradesh (37)</option>
                  <option value="Karnataka (29)">Karnataka (29)</option>
                  <option value="Tamil Nadu (33)">Tamil Nadu (33)</option>
                </Select>
              </FormControl>

              <Card bg="blue.50">
                <CardHeader>
                  <Heading size="sm">Bill To</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={3}>
                    <FormControl isRequired>
                      <FormLabel>Name</FormLabel>
                      <Input
                        value={formData.bill_to_name}
                        onChange={(e) => handleInputChange('bill_to_name', e.target.value)}
                        placeholder="Customer name"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Address</FormLabel>
                      <Textarea
                        value={formData.bill_to_address}
                        onChange={(e) => handleInputChange('bill_to_address', e.target.value)}
                        placeholder="Customer address"
                        rows={3}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>GST Number</FormLabel>
                      <Input
                        value={formData.bill_to_gst}
                        onChange={(e) => handleInputChange('bill_to_gst', e.target.value)}
                        placeholder="Customer GST number"
                      />
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>

              <Card bg="purple.50">
                <CardHeader>
                  <Heading size="sm">Ship To</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={3}>
                    <FormControl isRequired>
                      <FormLabel>Name</FormLabel>
                      <Input
                        value={formData.ship_to_name}
                        onChange={(e) => handleInputChange('ship_to_name', e.target.value)}
                        placeholder="Ship to name"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Address</FormLabel>
                      <Textarea
                        value={formData.ship_to_address}
                        onChange={(e) => handleInputChange('ship_to_address', e.target.value)}
                        placeholder="Ship to address"
                        rows={3}
                      />
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>

              <Card bg="green.50">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Heading size="sm">Items</Heading>
                    <Button size="sm" colorScheme="green" onClick={addItem}>
                      Add Item
                    </Button>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4}>
                    {formData.items.map((item, index) => (
                      <Card key={item.id} w="full" bg="white" border="2px solid" borderColor="green.200">
                        <CardHeader bg="green.100" borderBottom="1px solid" borderColor="green.200">
                          <Flex justify="space-between" align="center">
                            <Heading size="sm">Main Item {index + 1}</Heading>
                            <Button
                              size="sm"
                              colorScheme="red"
                              variant="outline"
                              onClick={() => removeItem(index)}
                              isDisabled={formData.items.length === 1}
                            >
                              Remove Item
                            </Button>
                          </Flex>
                        </CardHeader>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            <SimpleGrid columns={3} spacing={3}>
                              <FormControl>
                                <FormLabel fontSize="sm">HSN Code</FormLabel>
                                <Input
                                  value={item.hsn_code}
                                  onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                                  placeholder="HSN Code"
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="sm">Quantity</FormLabel>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                  min={0}
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="sm">Rate</FormLabel>
                                <Input
                                  type="number"
                                  value={item.rate}
                                  onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                  min={0}
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="sm">CGST %</FormLabel>
                                <Input
                                  type="number"
                                  value={item.cgst_rate}
                                  onChange={(e) => handleItemChange(index, 'cgst_rate', e.target.value)}
                                  min={0}
                                  max={100}
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontSize="sm">SGST %</FormLabel>
                                <Input
                                  type="number"
                                  value={item.sgst_rate}
                                  onChange={(e) => handleItemChange(index, 'sgst_rate', e.target.value)}
                                  min={0}
                                  max={100}
                                />
                              </FormControl>
                            </SimpleGrid>

                            <Card bg="blue.50" w="full">
                              <CardHeader>
                                <Flex justify="space-between" align="center">
                                  <Heading size="xs">Sub-Items (Descriptions)</Heading>
                                  <Button
                                    size="xs"
                                    colorScheme="blue"
                                    onClick={() => addSubItem(index)}
                                  >
                                    Add Sub-Item
                                  </Button>
                                </Flex>
                              </CardHeader>
                              <CardBody>
                                {item.subItems && item.subItems.length > 0 ? (
                                  <VStack spacing={2} align="stretch">
                                    {item.subItems.map((subItem, subIndex) => (
                                      <Flex key={subItem.id} gap={2} align="flex-end">
                                        <FormControl>
                                          <FormLabel fontSize="xs">Sub-Item {subIndex + 1} Description</FormLabel>
                                          <Input
                                            size="sm"
                                            value={subItem.description}
                                            onChange={(e) => handleSubItemChange(index, subIndex, e.target.value)}
                                            placeholder="Enter sub-item description"
                                          />
                                        </FormControl>
                                        <Button
                                          size="sm"
                                          colorScheme="red"
                                          variant="outline"
                                          onClick={() => removeSubItem(index, subIndex)}
                                        >
                                          Remove
                                        </Button>
                                      </Flex>
                                    ))}
                                  </VStack>
                                ) : (
                                  <Text color="gray.500" fontSize="sm">No sub-items added yet. Click "Add Sub-Item" to add descriptions.</Text>
                                )}
                              </CardBody>
                            </Card>
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                </CardBody>
              </Card>

              <FormControl>
                <FormLabel>Notes</FormLabel>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Add any notes here"
                  rows={3}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Terms & Conditions</FormLabel>
                <Textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) => handleInputChange('terms_and_conditions', e.target.value)}
                  placeholder="Terms and conditions"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={handleSaveInvoice} isLoading={submitLoading} loadingText="Saving">
              Save Invoice
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Invoice
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteInvoice} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default TaxInvoice;
