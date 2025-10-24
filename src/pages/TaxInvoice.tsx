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

interface InvoiceItem {
  id: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  cgst_rate: number;
  sgst_rate: number;
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
  phone: '+91 88888 88888',
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
    const margin = 14;
    const contentWidth = pageWidth - 2 * margin;

    const colors = {
      primary: { r: 60, g: 80, b: 60 },
      secondary: { r: 100, g: 120, b: 100 },
      text: { r: 33, g: 33, b: 33 },
      lightGray: { r: 240, g: 240, b: 240 },
      border: { r: 180, g: 180, b: 180 },
    };

    let yPos = margin;

    // Header with logo
    try {
      const logoData = await fetchImageAsDataURL(LOGO_URL);
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, yPos, 20, 20, undefined, 'FAST');
      }
    } catch (err) {
      console.error('Logo error:', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(COMPANY_INFO.name, margin + 22, yPos + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(COMPANY_INFO.address, margin + 22, yPos + 9, { maxWidth: contentWidth - 22 });

    yPos += 25;

    // Right side info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('TAX INVOICE', pageWidth - margin - 50, yPos, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    let infoY = yPos + 7;
    const infoLabelX = pageWidth - margin - 50;

    doc.text('Invoice #:', infoLabelX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.invoice_number, infoLabelX + 25, infoY);

    infoY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('GST #:', infoLabelX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.gst_number, infoLabelX + 25, infoY);

    infoY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Invoice Date:', infoLabelX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), infoLabelX + 25, infoY);

    infoY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Place of Supply:', infoLabelX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.place_of_supply, infoLabelX + 25, infoY);

    yPos += 35;

    // Bill To and Ship To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Bill To:', margin, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(invoice.bill_to_name, margin, yPos + 5);
    doc.text(invoice.bill_to_address, margin, yPos + 9, { maxWidth: contentWidth / 2 - 2 });

    if (invoice.bill_to_gst) {
      doc.text(`GST: ${invoice.bill_to_gst}`, margin, yPos + 17);
    }

    // Ship To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Ship To:', pageWidth / 2 + 2, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text(invoice.ship_to_name, pageWidth / 2 + 2, yPos + 5);
    doc.text(invoice.ship_to_address, pageWidth / 2 + 2, yPos + 9, { maxWidth: contentWidth / 2 - 2 });

    yPos += 25;

    // Items Table Header
    const tableTop = yPos;
    const colWidths = [10, 30, 15, 12, 18, 15, 15, 18];
    let colX = margin;

    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(margin, tableTop, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    const headers = ['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'CGST', 'SGST', 'Amount'];
    colX = margin + 2;

    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colX, tableTop + 5);
      colX += colWidths[i];
    }

    yPos = tableTop + 10;

    // Items
    const totalQty = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalRate = invoice.items.reduce((sum, item) => sum + item.rate * item.quantity, 0);
    const totalCgst = invoice.items.reduce((sum, item) => sum + (item.rate * item.quantity * item.cgst_rate) / 100, 0);
    const totalSgst = invoice.items.reduce((sum, item) => sum + (item.rate * item.quantity * item.sgst_rate) / 100, 0);
    const totalAmount = totalRate + totalCgst + totalSgst;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    colX = margin + 2;
    doc.text('1', colX, yPos);
    colX += colWidths[0];

    let itemDescText = 'Renewable Energy Devices and accessories - All items combined';
    const wrappedDesc = doc.splitTextToSize(itemDescText, colWidths[1] - 2);
    doc.text(wrappedDesc, colX, yPos, { maxWidth: colWidths[1] - 2 });
    colX += colWidths[1];

    const hsnCodes = invoice.items.map(item => item.hsn_code).join(', ');
    doc.text(hsnCodes, colX, yPos, { maxWidth: colWidths[2] - 2 });
    colX += colWidths[2];

    doc.text(totalQty.toString(), colX, yPos, { align: 'right' });
    colX += colWidths[3];

    doc.text(totalRate.toFixed(2), colX, yPos, { align: 'right' });
    colX += colWidths[4];

    doc.text(`${invoice.items[0]?.cgst_rate || 0}%`, colX, yPos, { align: 'right' });
    doc.text(totalCgst.toFixed(2), colX, yPos + 4, { align: 'right' });
    colX += colWidths[5];

    doc.text(`${invoice.items[0]?.sgst_rate || 0}%`, colX, yPos, { align: 'right' });
    doc.text(totalSgst.toFixed(2), colX, yPos + 4, { align: 'right' });
    colX += colWidths[6];

    doc.text(totalAmount.toFixed(2), colX, yPos, { align: 'right' });

    yPos += 15;

    // Summary box
    const summaryX = pageWidth - margin - 60;
    const summaryWidth = 56;

    doc.setFillColor(colors.lightGray.r, colors.lightGray.g, colors.lightGray.b);
    doc.rect(summaryX, yPos, summaryWidth, 30, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

    doc.text('Sub Total', summaryX + 2, yPos + 5);
    doc.text(totalRate.toFixed(2), summaryX + summaryWidth - 2, yPos + 5, { align: 'right' });

    doc.text(`CGST (${invoice.items[0]?.cgst_rate || 0}%)`, summaryX + 2, yPos + 11);
    doc.text(totalCgst.toFixed(2), summaryX + summaryWidth - 2, yPos + 11, { align: 'right' });

    doc.text(`SGST (${invoice.items[0]?.sgst_rate || 0}%)`, summaryX + 2, yPos + 17);
    doc.text(totalSgst.toFixed(2), summaryX + summaryWidth - 2, yPos + 17, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Total', summaryX + 2, yPos + 25);
    doc.text(`₹${totalAmount.toFixed(2)}`, summaryX + summaryWidth - 2, yPos + 25, { align: 'right' });

    yPos += 35;

    // Amount in words
    const amountWords = convertNumberToWords(Math.floor(totalAmount));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text('Total in Words:', margin, yPos);
    doc.setFont('helvetica', 'bold');
    const wrappedWords = doc.splitTextToSize(`Indian Rupees ${amountWords} Only`, contentWidth - 40);
    doc.text(wrappedWords, margin + 40, yPos);

    yPos += 10;

    // Notes
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text('Notes:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const wrappedNotes = doc.splitTextToSize(invoice.notes, contentWidth);
      doc.text(wrappedNotes, margin, yPos + 4, { maxWidth: contentWidth });
      yPos += wrappedNotes.length * 4 + 4;
    }

    yPos += 5;

    // Terms and Conditions
    if (invoice.terms_and_conditions) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
      doc.text('Terms & Conditions:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
      const wrappedTerms = doc.splitTextToSize(invoice.terms_and_conditions, contentWidth);
      doc.text(wrappedTerms, margin, yPos + 4, { maxWidth: contentWidth });
    }

    // Signature area at bottom
    const signY = pageHeight - 35;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
    doc.text('Authorized Signature', margin, signY);

    try {
      const stampData = await fetchImageAsDataURL(STAMP_URL);
      if (stampData) {
        doc.addImage(stampData, 'PNG', pageWidth - margin - 40, signY - 15, 35, 18, undefined, 'FAST');
      }
    } catch (err) {
      console.error('Stamp error:', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Manager', pageWidth - margin - 40, signY, { align: 'center' });

    // Footer
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(`GSTIN: ${COMPANY_INFO.gstin} | Email: ${COMPANY_INFO.email} | Web: ${COMPANY_INFO.website}`, pageWidth / 2, pageHeight - 4, { align: 'center' });

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
        console.error('Supabase error:', error);
        throw error;
      }
      setInvoices((data || []) as TaxInvoiceData[]);
    } catch (error: any) {
      const errorMsg = error?.message || error?.details || JSON.stringify(error);
      console.error('Error fetching invoices:', errorMsg);

      // Check if table doesn't exist
      if (errorMsg.includes('relation') || errorMsg.includes('does not exist') || errorMsg.includes('404')) {
        toast({
          title: 'Setup Required',
          description: 'Tax invoices table not found. Please create it in Supabase first. Check TAX_INVOICE_SETUP.md for instructions.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else if (errorMsg.includes('permission') || errorMsg.includes('policy')) {
        toast({
          title: 'Permission Error',
          description: `You don't have permission to access tax invoices. Error: ${errorMsg}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error',
          description: `Failed to load invoices: ${errorMsg}`,
          status: 'error',
          duration: 5000,
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
        hsn_code: item.hsn_code,
        quantity: Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        cgst_rate: Number(item.cgst_rate) || 0,
        sgst_rate: Number(item.sgst_rate) || 0,
      }));

      // Prepare invoice data to match table structure exactly
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
          console.error('Update error:', error);
          throw error;
        }
        toast({ title: 'Success', description: 'Invoice updated', status: 'success', duration: 2000, isClosable: true });
      } else {
        const { error } = await supabase
          .from('tax_invoices')
          .insert([invoiceToSave]);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        toast({ title: 'Success', description: 'Invoice created', status: 'success', duration: 2000, isClosable: true });
      }

      onClose();
      await fetchInvoices();
    } catch (error: any) {
      const errorMsg = error?.message || error?.details || JSON.stringify(error);
      console.error('Error saving invoice:', errorMsg);
      toast({
        title: 'Error',
        description: `Failed to save invoice: ${errorMsg}`,
        status: 'error',
        duration: 5000,
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
      const errorMsg = error?.message || error?.details || JSON.stringify(error);
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
      const errorMsg = error?.message || error?.details || JSON.stringify(error);
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
                      <Card key={item.id} w="full" bg="white">
                        <CardBody>
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
                            <Flex align="flex-end">
                              <Button
                                size="sm"
                                colorScheme="red"
                                variant="outline"
                                onClick={() => removeItem(index)}
                                isDisabled={formData.items.length === 1}
                                w="full"
                              >
                                Remove
                              </Button>
                            </Flex>
                          </SimpleGrid>
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
