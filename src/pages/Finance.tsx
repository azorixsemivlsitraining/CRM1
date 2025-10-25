import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  Flex,
  Select,
  FormControl,
  FormLabel,
  Input,
  Button,
  useToast,
  HStack,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Tooltip,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  TableContainer,
} from '@chakra-ui/react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generatePaymentReceiptPDF } from '../components/PaymentReceipt';

interface Project {
  id: string;
  name: string;
  customer_name: string;
  proposal_amount: number;
  advance_payment: number;
  paid_amount: number;
  balance_amount: number;
  status: string;
  current_stage: string;
  payment_mode: 'Loan' | 'Cash' | string;
  start_date: string;
  state?: string;
  email?: string;
  address?: string;
  created_at?: string;
  tax_amount?: number;
  discount_amount?: number;
  delivery_fee?: number;
  kwh?: number;
}

interface PaymentHistory {
  id: string;
  amount: number;
  created_at: string;
  payment_mode?: string;
  payment_date?: string;
}

interface PaymentRec {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  order_id: string;
  payment_id: string;
  project_id: string;
}

interface ExpenseRec {
  id: string;
  created_at?: string;
  date?: string;
  category?: string;
  vendor?: string;
  description?: string;
  amount: number;
  tax_amount?: number;
}

interface EstimationCost {
  id: string;
  customer_name: string;
  description: string;
  service_no: string;
  estimated_cost: number;
  created_at?: string;
}

interface TaxInvoiceItem {
  description: string;
  hsn: string;
  quantity: number;
  rate: number;
  cgst_percent: number;
  sgst_percent: number;
}

interface TaxInvoice {
  id?: string;
  customer_name: string;
  place_of_supply: string;
  state: string;
  gst_no: string;
  items: TaxInvoiceItem[];
  project_id?: string;
  capacity?: string;
  amount_paid?: number;
  created_at?: string;
  rowNumber?: number;
}

const PREDEFINED_INVOICE_ITEMS = [
  { name: 'Solar PV Modules Wp_Bifical_' },
  { name: 'Solar Grid Tied Inverter' },
  { name: 'Module Mounting' },
  { name: 'DC Distribution box IP65' },
  { name: 'AC Distribution Box IP65' },
  { name: 'Copper cables' },
  { name: 'Earthing' },
  { name: 'Lightning Arrestor' },
  { name: 'Hardware SS304 and other required accessories' },
  { name: 'Installation & Commissioning of Rooftop Solar Power Plant' },
];

const inr = (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`;

const makeCsv = (rows: any[]) => {
  if (!rows || rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set: Set<string>, r: any) => {
      Object.keys(r || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (val: any) => {
    const s = val == null ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => esc((r as any)[h])).join(','));
  }
  return lines.join('\n');
};

const download = (content: string, filename: string, mime = 'text/csv') => {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadExcel = (columns: string[], rows: (string | number)[][], filename: string) => {
  const escape = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headerRow = `<tr>${columns.map(c => `<th>${escape(c)}</th>`).join('')}</tr>`;
  const body = rows.map(r => `<tr>${r.map(c => `<td>${escape(c)}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${headerRow}${body}</table></body></html>`;
  download(html, filename.endsWith('.xls') ? filename : `${filename}.xls`, 'application/vnd.ms-excel');
};

// Logo and image handling
const LOGO_URL = 'https://cdn.builder.io/api/v1/image/assets%2F379fc6e4730f4c788d839578cbf44f7f%2F80c7e07df9c94e6aa14ced8f1edbf799?format=webp&width=800';
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

// Simple bar chart (pure Chakra UI)
const BarChart: React.FC<{ labels: string[]; values: number[]; color?: string; maxBars?: number }> = ({ labels, values, color = 'green.500', maxBars = 12 }) => {
  const items = labels.map((l, i) => ({ l, v: values[i] || 0 }));
  const trimmed = items.slice(-maxBars);
  const maxV = Math.max(1, ...trimmed.map(i => i.v));
  return (
    <Box border="1px solid" borderColor="gray.100" borderRadius="lg" p={4} bg="white">
      <HStack align="end" spacing={4} minH="220px">
        {trimmed.map((it) => (
          <Tooltip key={it.l} label={`${it.l}: ${inr(it.v)}`} hasArrow>
            <VStack spacing={2} align="center">
              <Box w="16px" bg={color} borderRadius="sm" height={`${(it.v / maxV) * 180}px`} />
              <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="56px">{it.l}</Text>
            </VStack>
          </Tooltip>
        ))}
      </HStack>
    </Box>
  );
};

// Two-series comparison bar chart
const BarCompareChart: React.FC<{ labels: string[]; seriesA: number[]; seriesB: number[]; seriesLabels: [string, string]; colors?: [string, string] }> = ({ labels, seriesA, seriesB, seriesLabels, colors = ['green.600', 'green.300'] }) => {
  const maxV = Math.max(1, ...seriesA, ...seriesB);
  return (
    <Box border="1px solid" borderColor="gray.100" borderRadius="lg" p={4} bg="white">
      <Text fontWeight="semibold" color="gray.700" mb={2}>Comparison</Text>
      <HStack align="end" spacing={6} minH="260px">
        {labels.map((lab, idx) => {
          const a = seriesA[idx] || 0; const b = seriesB[idx] || 0;
          const ah = (a / maxV) * 200; const bh = (b / maxV) * 200;
          return (
            <Tooltip key={lab} label={`${seriesLabels[0]}: ${inr(a)} �� ${seriesLabels[1]}: ${inr(b)}`} hasArrow>
              <VStack spacing={2} align="center">
                <HStack align="end" spacing={2}>
                  <Box w="14px" bg={colors[0]} borderRadius="sm" height={`${ah}px`} />
                  <Box w="14px" bg={colors[1]} borderRadius="sm" height={`${bh}px`} />
                </HStack>
                <Text fontSize="xs" color="gray.600" noOfLines={1} maxW="64px">{lab}</Text>
              </VStack>
            </Tooltip>
          );
        })}
      </HStack>
      <HStack spacing={4} mt={3} color="gray.600">
        <HStack spacing={2}><Box w="10px" h="10px" bg={colors[0]} borderRadius="sm" /><Text fontSize="xs">{seriesLabels[0]}</Text></HStack>
        <HStack spacing={2}><Box w="10px" h="10px" bg={colors[1]} borderRadius="sm" /><Text fontSize="xs">{seriesLabels[1]}</Text></HStack>
      </HStack>
    </Box>
  );
};

// Donut pie chart using conic-gradient
const DonutChart: React.FC<{ segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number }> = ({ segments, size = 180, thickness = 24 }) => {
  const total = Math.max(1, segments.reduce((s, seg) => s + (seg.value || 0), 0));
  let start = 0;
  const parts: string[] = [];
  segments.forEach((seg) => {
    const angle = (seg.value / total) * 360;
    const end = start + angle;
    parts.push(`${seg.color} ${start}deg ${end}deg`);
    start = end;
  });
  const bg = parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#E2E8F0 0deg, #E2E8F0 360deg)';
  return (
    <VStack spacing={3} align="center">
      <Box
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        bgGradient={undefined}
        bgImage={bg}
        position="relative"
      >
        <Box position="absolute" top={`${thickness}px`} left={`${thickness}px`} right={`${thickness}px`} bottom={`${thickness}px`} bg="white" borderRadius="full" />
      </Box>
    </VStack>
  );
};

const Finance: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<(PaymentRec & { project_name?: string; customer_name?: string; state?: string })[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRec[]>([]);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [taxPeriodType, setTaxPeriodType] = useState<'monthly' | 'quarterly'>('monthly');

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { isOpen: isPaymentModalOpen, onOpen: onPaymentModalOpen, onClose: onPaymentModalClose } = useDisclosure();

  const [estimations, setEstimations] = useState<EstimationCost[]>([]);
  const [estimationForm, setEstimationForm] = useState({ customerName: '', description: '', serviceNo: '', estimatedCost: '' });
  const [estimationLoading, setEstimationLoading] = useState(false);

  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [taxInvoiceForm, setTaxInvoiceForm] = useState<TaxInvoice>({
    customer_name: '',
    place_of_supply: '',
    state: '',
    gst_no: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    items: [],
    project_id: '',
    capacity: '',
    amount_paid: 0,
  });
  const [taxInvoiceLoading, setTaxInvoiceLoading] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const { isFinance, isAuthenticated, isAdmin } = useAuth();
  const toast = useToast();

  const authorized = isAuthenticated && (isFinance || isAdmin);

  const getNextGstNo = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from('tax_invoices')
        .select('gst_no')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastGstNo = data[0].gst_no;
        const match = lastGstNo.match(/IN-(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          return `IN-${String(nextNum).padStart(6, '0')}`;
        }
      }
      return 'IN-000001';
    } catch {
      return 'IN-000001';
    }
  };

  const getNextInvoiceNo = async (): Promise<string> => {
    try {
      const { count } = await supabase
        .from('tax_invoices')
        .select('id', { count: 'exact' });

      if (count !== null && count !== undefined) {
        const nextNum = count + 1;
        return `INV-${String(nextNum).padStart(6, '0')}`;
      }

      return 'INV-000001';
    } catch {
      return 'INV-000001';
    }
  };

  const handleAddEstimation = async () => {
    if (!estimationForm.customerName || !estimationForm.description || !estimationForm.serviceNo || !estimationForm.estimatedCost) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill all estimation fields.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setEstimationLoading(true);
      const { error } = await supabase.from('estimation_costs').insert([{
        customer_name: estimationForm.customerName,
        description: estimationForm.description,
        service_no: estimationForm.serviceNo,
        estimated_cost: parseFloat(estimationForm.estimatedCost),
      }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Estimation cost added successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setEstimationForm({ customerName: '', description: '', serviceNo: '', estimatedCost: '' });
      await fetchEstimations();
    } catch (error) {
      console.error('Error adding estimation:', error);
      toast({
        title: 'Error',
        description: 'Failed to add estimation cost.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setEstimationLoading(false);
    }
  };

  const fetchEstimations = async () => {
    try {
      const { data, error } = await supabase
        .from('estimation_costs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEstimations((data || []) as EstimationCost[]);
    } catch (error) {
      console.error('Error fetching estimations:', error);
    }
  };

  const downloadEstimationPDF = async (estimation: EstimationCost) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const BRAND_PRIMARY = { r: 72, g: 187, b: 120 };
      const TEXT_PRIMARY = { r: 45, g: 55, b: 72 };
      const TEXT_MUTED = { r: 99, g: 110, b: 114 };

      const margin = 18;
      const pageWidth = doc.internal.pageSize.width;

      doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.rect(0, 0, pageWidth, 9, 'F');

      try {
        const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
        const logoWidth = 68;
        const logoHeight = logoWidth * logoRatio;
        doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 8, logoWidth, logoHeight, undefined, 'FAST');
      } catch (err) {
        console.error('Logo image error:', err);
      }

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

      doc.setDrawColor(230, 230, 230);
      doc.line(margin, 55, pageWidth - margin, 55);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.text('ESTIMATION COST', pageWidth / 2, 68, { align: 'center' });

      let y = 80;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);

      doc.text('Customer Name:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(estimation.customer_name, margin + 50, y);

      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Service No:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(estimation.service_no, margin + 50, y);

      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Date:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      const estDate = estimation.created_at ? new Date(estimation.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text(estDate, margin + 50, y);

      y += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('Description:', margin, y);

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      const wrappedDescription = doc.splitTextToSize(estimation.description, pageWidth - margin * 2);
      doc.text(wrappedDescription, margin, y);

      y += wrappedDescription.length * 5 + 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.text('Estimated Cost: ₹' + estimation.estimated_cost.toLocaleString('en-IN'), margin, y);

      const words = convertNumberToWords(estimation.estimated_cost);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Amount in Words:', margin, y);
      y += 5;
      const amountText = `Indian Rupee ${words} Only`;
      doc.setFont('helvetica', 'bold');
      const wrappedAmount = doc.splitTextToSize(amountText, pageWidth - margin * 2);
      doc.text(wrappedAmount, margin, y);

      doc.save(`Estimation_${estimation.id}.pdf`);
    } catch (error) {
      console.error('Error generating estimation PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate estimation PDF',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSelectProjectForInvoice = (projectId: string) => {
    const selectedProject = projects.find(p => p.id === projectId);
    if (selectedProject) {
      setTaxInvoiceForm({
        ...taxInvoiceForm,
        project_id: projectId,
        customer_name: selectedProject.customer_name,
        place_of_supply: selectedProject.address || '',
        state: selectedProject.state || '',
        capacity: selectedProject.kwh ? `${selectedProject.kwh} kW` : '',
        amount_paid: selectedProject.paid_amount || 0,
      });
    }
  };

  const handleAddTaxInvoice = async () => {
    if (!taxInvoiceForm.customer_name || !taxInvoiceForm.place_of_supply || !taxInvoiceForm.state || !taxInvoiceForm.items.length) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill all tax invoice fields and add items.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setTaxInvoiceLoading(true);
      const nextGstNo = await getNextGstNo();
      const nextInvoiceNo = await getNextInvoiceNo();

      if (editingInvoiceId) {
        const { error } = await supabase
          .from('tax_invoices')
          .update({
            customer_name: taxInvoiceForm.customer_name,
            place_of_supply: taxInvoiceForm.place_of_supply,
            state: taxInvoiceForm.state,
            items: taxInvoiceForm.items,
          })
          .eq('id', editingInvoiceId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Tax invoice updated successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        setEditingInvoiceId(null);
      } else {
        const { error } = await supabase.from('tax_invoices').insert([{
          customer_name: taxInvoiceForm.customer_name,
          place_of_supply: taxInvoiceForm.place_of_supply,
          state: taxInvoiceForm.state,
          gst_no: nextGstNo,
          items: taxInvoiceForm.items,
        }]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Tax invoice created successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      setTaxInvoiceForm({
        customer_name: '',
        place_of_supply: '',
        state: '',
        gst_no: '',
        invoice_no: '',
        invoice_date: new Date().toISOString().split('T')[0],
        items: [],
        project_id: '',
        capacity: '',
        amount_paid: 0,
      });
      await fetchTaxInvoices();
    } catch (error) {
      console.error('Error saving tax invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tax invoice.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTaxInvoiceLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('tax_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invoice deleted successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      await fetchTaxInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete invoice.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEditInvoice = (invoice: TaxInvoice) => {
    setEditingInvoiceId(invoice.id || null);
    setTaxInvoiceForm(invoice);
    window.scrollTo(0, 0);
  };

  const fetchTaxInvoices = async () => {
    try {
      const { data, error, count } = await supabase
        .from('tax_invoices')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add row numbers for invoice number generation
      const invoicesWithRowNumbers = (data || []).map((invoice, index) => ({
        ...invoice,
        rowNumber: (count || 0) - index,
      })) as TaxInvoice[];

      setTaxInvoices(invoicesWithRowNumbers);
    } catch (error) {
      console.error('Error fetching tax invoices:', error);
    }
  };

  const downloadTaxInvoicePDF = async (invoice: TaxInvoice) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const TEXT_PRIMARY = { r: 45, g: 55, b: 72 };
      const TEXT_MUTED = { r: 99, g: 110, b: 114 };
      const BORDER_COLOR = { r: 180, g: 180, b: 180 };

      const margin = 12;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      doc.setDrawColor(BORDER_COLOR.r, BORDER_COLOR.g, BORDER_COLOR.b);
      doc.setLineWidth(1);
      doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

      const LOGO_URL = 'https://cdn.builder.io/api/v1/image/assets%2F8bf52f20c3654880b140d224131cfa2e%2Ffa1e04c2340e47698e33419042fa128a?format=webp&width=800';

      try {
        const logoWidth = 25;
        const logoHeight = 20;
        doc.addImage(LOGO_URL, 'PNG', margin + 2, margin + 2, logoWidth, logoHeight);
      } catch (err) {
        console.error('Error loading logo:', err);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('Axiso Green Energies Private', margin + 30, margin + 5);
      doc.text('Limited', margin + 30, margin + 11);

      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.setFont('helvetica', 'normal');
      doc.text('Telangana', margin + 30, margin + 16);
      doc.text('India', margin + 30, margin + 19.5);
      doc.text('GSTIN:36ABBCA4478M1Z9', margin + 30, margin + 23);
      doc.text('admin@axisogreen.in', margin + 30, margin + 26.5);
      doc.text('www.axisogreen.in', margin + 30, margin + 30);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('TAX INVOICE', pageWidth / 2, margin + 12, { align: 'center' });

      // Generate invoice number and date from stored data
      const invoiceNumber = `INV-${String((invoice as any).rowNumber || 1).padStart(6, '0')}`;
      const invoiceDate = (invoice as any).created_at ? new Date((invoice as any).created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);

      let invoiceDetailsY = margin + 5;
      const invoiceDetailsX = pageWidth - margin - 55;

      doc.text('#', invoiceDetailsX, invoiceDetailsY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(invoiceNumber, invoiceDetailsX + 20, invoiceDetailsY);

      invoiceDetailsY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Invoice Date', invoiceDetailsX, invoiceDetailsY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(invoiceDate, invoiceDetailsX + 20, invoiceDetailsY);

      invoiceDetailsY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Terms', invoiceDetailsX, invoiceDetailsY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('PIA', invoiceDetailsX + 20, invoiceDetailsY);

      invoiceDetailsY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Due Date', invoiceDetailsX, invoiceDetailsY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      const dueDate = (invoice as any).created_at ? new Date(new Date((invoice as any).created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      doc.text(dueDate, invoiceDetailsX + 20, invoiceDetailsY);

      invoiceDetailsY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Place of Supply', invoiceDetailsX, invoiceDetailsY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(invoice.state + ' (36)', invoiceDetailsX + 20, invoiceDetailsY);

      let y = margin + 45;

      doc.setDrawColor(BORDER_COLOR.r, BORDER_COLOR.g, BORDER_COLOR.b);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 3, pageWidth - margin, y - 3);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('Bill To', margin + 2, y + 2);
      doc.text('Ship To', pageWidth / 2 + 2, y + 2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(invoice.customer_name, margin + 2, y + 7);
      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      const billLines = doc.splitTextToSize(invoice.place_of_supply, 50);
      let billY = y + 11;
      billLines.forEach((line: string) => {
        doc.text(line, margin + 2, billY);
        billY += 3;
      });

      doc.setFontSize(8);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(invoice.customer_name, pageWidth / 2 + 2, y + 7);
      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      const shipLines = doc.splitTextToSize(invoice.place_of_supply, 50);
      let shipY = y + 11;
      shipLines.forEach((line: string) => {
        doc.text(line, pageWidth / 2 + 2, shipY);
        shipY += 3;
      });

      y += 22;

      const tableTop = y;
      doc.setFillColor(220, 220, 220);
      doc.rect(margin, tableTop, pageWidth - margin * 2, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

      doc.text('#', margin + 2, tableTop + 4.5);
      doc.text('Item & Description', margin + 7, tableTop + 4.5);
      doc.text('HSN /SAC', margin + 90, tableTop + 4.5);
      doc.text('Qty', margin + 115, tableTop + 4.5);
      doc.text('Rate', margin + 130, tableTop + 4.5);
      doc.text('CGST %', margin + 150, tableTop + 4.5);
      doc.text('Amt', margin + 165, tableTop + 4.5);
      doc.text('SGST %', margin + 175, tableTop + 4.5);
      doc.text('Amt', margin + 190, tableTop + 4.5);
      doc.text('Amount', margin + 200, tableTop + 4.5);

      y = tableTop + 7;

      let totalQty = 0;
      let totalAmount = 0;
      let totalCGST = 0;
      let totalSGST = 0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

      let allItemsDesc = '';
      (invoice.items || []).forEach((item, idx) => {
        if (idx > 0) allItemsDesc += '\n';
        allItemsDesc += item.description;
        totalQty += item.quantity;
        const amount = item.quantity * item.rate;
        totalAmount += amount;
        totalCGST += amount * (item.cgst_percent / 100);
        totalSGST += amount * (item.sgst_percent / 100);
      });

      doc.text('1', margin + 2, y);
      const wrappedDesc = doc.splitTextToSize(allItemsDesc, 80);
      doc.text(wrappedDesc, margin + 7, y);
      const descHeight = wrappedDesc.length * 4;
      y += Math.max(descHeight, 4);

      doc.text((invoice.items[0]?.hsn || ''), margin + 90, y - (descHeight > 4 ? descHeight : 4));
      doc.text(totalQty.toFixed(2), margin + 115, y - (descHeight > 4 ? descHeight : 4));
      doc.text(totalAmount.toFixed(2), margin + 130, y - (descHeight > 4 ? descHeight : 4));
      doc.text((invoice.items[0]?.cgst_percent || 0).toFixed(0), margin + 150, y - (descHeight > 4 ? descHeight : 4));
      doc.text(totalCGST.toFixed(2), margin + 165, y - (descHeight > 4 ? descHeight : 4));
      doc.text((invoice.items[0]?.sgst_percent || 0).toFixed(0), margin + 175, y - (descHeight > 4 ? descHeight : 4));
      doc.text(totalSGST.toFixed(2), margin + 190, y - (descHeight > 4 ? descHeight : 4));
      doc.text((totalAmount + totalCGST + totalSGST).toFixed(2), margin + 200, y - (descHeight > 4 ? descHeight : 4));

      y += 2;
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

      const totalsX = pageWidth - margin - 50;
      doc.text('Sub Total', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text('₹' + totalAmount.toFixed(2), pageWidth - margin - 8, y, { align: 'right' });

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('CGST (6%)', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text('₹' + totalCGST.toFixed(2), pageWidth - margin - 8, y, { align: 'right' });

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('SGST (6%)', totalsX, y);
      doc.setFont('helvetica', 'normal');
      doc.text('₹' + totalSGST.toFixed(2), pageWidth - margin - 8, y, { align: 'right' });

      const grandTotal = totalAmount + totalCGST + totalSGST;
      y += 8;
      doc.setFillColor(0, 0, 0);
      doc.rect(totalsX - 2, y - 4, 50, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('Total', totalsX, y);
      doc.text('₹' + grandTotal.toFixed(2), pageWidth - margin - 8, y, { align: 'right' });

      y += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('Total in Words:', margin, y);

      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const words = convertNumberToWords(Math.floor(grandTotal));
      const wrappedWords = doc.splitTextToSize(`Indian Rupee ${words} Only`, pageWidth - margin * 2 - 10);
      doc.text(wrappedWords, margin, y);

      y += wrappedWords.length * 3 + 6;
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', margin, y);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const notesText = doc.splitTextToSize('IT IS A COMPUTER GENERATED INVOICE AND WILL NOT REQUIRE ANY SIGNATURES', pageWidth - margin * 2 - 10);
      doc.text(notesText, margin, y);

      y = pageHeight - 38;
      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', margin, y);
      y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      const tcLines = [
        'Warranty: 5 Years against Manufacturing Defects, 25 Years linear Power',
        'Warranty on Solar Modules, Warranty as per manufacturers warranty',
        'terms, void if Physical Damages and unauthorized usage of tampering of',
        'units. Warranty starts from the date of Plant commissioning 17-09-2025',
      ];
      tcLines.forEach((line) => {
        doc.text(line, margin, y);
        y += 2.5;
      });

      try {
        doc.addImage(SIGNATURE_URL, 'PNG', pageWidth - margin - 35, pageHeight - 22, 30, 12);
      } catch (err) {
        console.error('Error loading signature:', err);
      }

      doc.setFontSize(7);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Authorized Signature', pageWidth - margin - 35, pageHeight - 8, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.setFont('helvetica', 'bold');
      doc.text('For AXISO GREEN ENERGIES PVT. LTD.', pageWidth - margin - 5, pageHeight - 12, { align: 'right' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Manager', pageWidth - margin - 5, pageHeight - 8, { align: 'right' });

      doc.save(`Tax_Invoice_${invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating tax invoice PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate tax invoice PDF',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const openPaymentModal = async (project: Project) => {
    setSelectedProject(project);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Cash');
    await fetchProjectPaymentHistory(project.id);
    onPaymentModalOpen();
  };

  const fetchProjectPaymentHistory = async (projectId: string) => {
    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (paymentError) throw paymentError;

      let history = paymentData || [];
      const project = projects.find(p => p.id === projectId);

      if (project && project.advance_payment && project.advance_payment > 0) {
        const advanceRow = {
          id: 'advance',
          amount: project.advance_payment,
          created_at: project.start_date || project.created_at || new Date().toISOString(),
          payment_mode: project.payment_mode || 'Cash',
          payment_date: project.start_date || project.created_at || new Date().toISOString(),
        };
        if (!history.some((p: any) => p.amount === advanceRow.amount && p.payment_date === advanceRow.payment_date)) {
          history = [advanceRow, ...history];
        }
      }

      setPaymentHistory(history);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch payment history',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddPayment = async () => {
    if (!selectedProject || !paymentAmount || !paymentDate || !paymentMode) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill all payment details.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setPaymentLoading(true);
      const { error } = await supabase
        .from('payment_history')
        .insert([{
          project_id: selectedProject.id,
          amount: parseFloat(paymentAmount),
          payment_mode: paymentMode,
          payment_date: paymentDate,
        }]);

      if (error) throw error;

      toast({
        title: 'Payment Added',
        description: 'Payment added successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');
      await fetchProjectPaymentHistory(selectedProject.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add payment.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDownloadReceipt = async (payment: PaymentHistory) => {
    if (!selectedProject) return;

    try {
      const receiptData = {
        date: payment.payment_date || payment.created_at,
        amount: payment.amount,
        receivedFrom: selectedProject.customer_name,
        paymentMode: payment.payment_mode || '-',
        placeOfSupply: selectedProject.state || '',
        customerAddress: selectedProject.address || '',
      };

      await generatePaymentReceiptPDF(receiptData);
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate receipt',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!paymentId || paymentId === 'advance') return;
    try {
      const { error } = await supabase
        .from('payment_history')
        .delete()
        .eq('id', paymentId);
      if (error) throw error;
      setPaymentHistory(prev => prev.filter(p => p.id !== paymentId));
      toast({
        title: 'Payment deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete payment',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  }, [period]);

  useEffect(() => {
    if (!authorized) return;
    const fetchAll = async () => {
      try {
        setLoading(true);
        let q = supabase
          .from('projects')
          .select('*')
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });
        if (filter === 'active') q = q.eq('status', 'active');
        if (filter === 'completed') q = q.eq('status', 'completed');
        const { data: projData, error: projErr } = await q as any;
        if (projErr) throw projErr;
        const pData: Project[] = Array.isArray(projData) ? projData as any : [];
        setProjects(pData);

        let paymentsData: PaymentRec[] = [];
        try {
          const { data: payTry, error: payErr } = await supabase
            .from('payments')
            .select('id, created_at, amount, status, order_id, payment_id, project_id')
            .order('created_at', { ascending: false });
          if (payErr) throw payErr;
          paymentsData = (payTry || []) as any;
        } catch {
          paymentsData = [];
        }
        const map = new Map<string, Project>();
        pData.forEach((p) => map.set(p.id, p));
        const paymentsWithProject = paymentsData.map((r) => ({
          ...r,
          project_name: map.get(r.project_id)?.name,
          customer_name: map.get(r.project_id)?.customer_name,
          state: map.get(r.project_id)?.state,
        }));
        setPayments(paymentsWithProject);

        let expensesData: ExpenseRec[] = [];
        try {
          const { data: expTry, error: expErr } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });
          if (expErr) throw expErr;
          expensesData = (expTry || []) as any;
        } catch {
          expensesData = [];
        }
        setExpenses(expensesData);

        await fetchEstimations();
        await fetchTaxInvoices();
      } catch (error) {
        console.error('Error fetching finance data:', error);
        toast({ title: 'Error', description: 'Failed to fetch financial data', status: 'error', duration: 5000, isClosable: true });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [authorized, filter, toast]);

  const dateInPeriod = useCallback((iso: string | undefined) => {
    if (!periodStart || !iso) return period === 'all';
    const d = new Date(iso);
    return d >= periodStart;
  }, [periodStart, period]);

  const totalOutstanding = useMemo(() => projects.reduce((sum, p) => sum + (p.balance_amount || 0), 0), [projects]);
  const expectedThisMonth = useMemo(() => {
    const currentDate = new Date();
    return projects
      .filter((p) => p.status === 'active' && p.start_date)
      .reduce((sum, p) => {
        const startDate = new Date(p.start_date);
        if (isNaN(startDate.getTime())) return sum;
        const due = new Date(startDate);
        due.setDate(due.getDate() + 45);
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        if ((due >= monthStart && due <= monthEnd) || due < currentDate) {
          return sum + (p.balance_amount || 0);
        }
        return sum;
      }, 0);
  }, [projects]);
  const activeProjectsCount = useMemo(() => projects.filter(p => p.status === 'active').length, [projects]);

  const periodPayments = useMemo(() => payments.filter((p) => dateInPeriod(p.created_at)), [payments, dateInPeriod]);
  const totalRevenueAll = useMemo(() => payments.reduce((s, r) => s + (r.amount || 0), 0), [payments]);
  const totalRevenuePeriod = useMemo(() => periodPayments.reduce((s, r) => s + (r.amount || 0), 0), [periodPayments]);

  const periodExpenses = useMemo(() => expenses.filter((e) => dateInPeriod(e.date || e.created_at || '')), [expenses, dateInPeriod]);
  const totalExpensesAll = useMemo(() => expenses.reduce((s, r) => s + (r.amount || 0), 0), [expenses]);
  const totalExpensesPeriod = useMemo(() => periodExpenses.reduce((s, r) => s + (r.amount || 0), 0), [periodExpenses]);

  const profitAll = totalRevenueAll - totalExpensesAll;
  const profitPeriod = totalRevenuePeriod - totalExpensesPeriod;

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    const term = searchTerm.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(term) ||
      (project.customer_name || '').toLowerCase().includes(term) ||
      (project.current_stage || '').toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  const topProducts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of payments) {
      const key = r.project_name || 'Unknown';
      m.set(key, (m.get(key) || 0) + (r.amount || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [payments]);

  const revenueByRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of payments) {
      const key = r.state || 'Unknown';
      m.set(key, (m.get(key) || 0) + (r.amount || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [payments]);

  const paymentsByProject = useMemo(() => {
    const m = new Map<string, number>();
    payments.forEach((p) => m.set(p.project_id, (m.get(p.project_id) || 0) + (p.amount || 0)));
    return m;
  }, [payments]);

  const customerPurchases = useMemo(() => {
    const m = new Map<string, number>();
    payments.forEach((p) => {
      const cust = p.customer_name || 'Unknown';
      m.set(cust, (m.get(cust) || 0) + (p.amount || 0));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [payments]);

  const monthlyOrQuarterlyTax = useMemo(() => {
    const buckets = new Map<string, { output: number; input: number }>();

    const addToBucket = (key: string, out: number, inp: number) => {
      const cur = buckets.get(key) || { output: 0, input: 0 };
      cur.output += out;
      cur.input += inp;
      buckets.set(key, cur);
    };

    for (const pay of payments) {
      const proj = projects.find((p) => p.id === pay.project_id);
      if (!proj) continue;
      const totalForProj = paymentsByProject.get(pay.project_id) || 0;
      if (!totalForProj) continue;
      const attributedTax = (proj.tax_amount || 0) * ((pay.amount || 0) / totalForProj);
      const d = new Date(pay.created_at);
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      const quarterKey = `${d.getFullYear()}-Q${quarter}`;
      const key = taxPeriodType === 'monthly' ? monthKey : quarterKey;
      addToBucket(key, attributedTax, 0);
    }

    for (const e of expenses) {
      const d = new Date(e.date || e.created_at || '');
      if (isNaN(d.getTime())) continue;
      const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      const quarterKey = `${d.getFullYear()}-Q${quarter}`;
      const key = taxPeriodType === 'monthly' ? monthKey : quarterKey;
      addToBucket(key, 0, e.tax_amount || 0);
    }

    const arr = Array.from(buckets.entries()).map(([periodKey, v]) => ({ periodKey, output: v.output, input: v.input, net: v.output - v.input }));
    arr.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    return arr;
  }, [payments, projects, expenses, taxPeriodType, paymentsByProject]);

  // Derived datasets for charts
  const revenueTrend = useMemo(() => {
    const m = new Map<string, number>();
    const source = period === 'all' ? payments : periodPayments;
    source.forEach((p) => {
      const key = new Date(p.created_at).toLocaleDateString('en-IN');
      m.set(key, (m.get(key) || 0) + (p.amount || 0));
    });
    const arr = Array.from(m.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    return { labels: arr.map(a => a[0]), values: arr.map(a => a[1]) };
  }, [payments, periodPayments, period]);

  const expensesByCategory = useMemo(() => {
    const m = new Map<string, number>();
    const source = period === 'all' ? expenses : periodExpenses;
    source.forEach((e) => {
      const key = (e.category || 'Uncategorized').trim() || 'Uncategorized';
      m.set(key, (m.get(key) || 0) + (e.amount || 0));
    });
    const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { labels: arr.map(a => a[0]), values: arr.map(a => a[1]) };
  }, [expenses, periodExpenses, period]);

  const palette = ['#2F855A', '#38A169', '#68D391', '#22543D', '#276749', '#48BB78', '#9AE6B4', '#81E6D9'];

  // Exports
  const exportOrdersCsv = () => {
    const rows = payments.map((p) => ({
      id: p.id,
      date: p.created_at,
      project: p.project_name,
      customer: p.customer_name,
      amount: p.amount,
      status: p.status,
      order_id: p.order_id,
      payment_id: p.payment_id,
      region: p.state || '',
    }));
    download(makeCsv(rows), `orders_${period}.csv`);
  };

  const exportOrdersXls = () => {
    const cols = ['Date', 'Project', 'Customer', 'Amount', 'Status', 'Order ID', 'Payment ID', 'Region'];
    const rows = payments.map((p) => [new Date(p.created_at).toLocaleDateString(), p.project_name || '', p.customer_name || '', p.amount || 0, p.status || '', p.order_id || '', p.payment_id || '', p.state || '']);
    downloadExcel(cols, rows, `orders_${period}.xls`);
  };

  const exportExpensesCsv = () => {
    const rows = expenses.map((e) => ({
      id: e.id,
      date: e.date || e.created_at || '',
      category: e.category || '',
      vendor: e.vendor || '',
      description: e.description || '',
      amount: e.amount,
      tax_amount: e.tax_amount || 0,
    }));
    download(makeCsv(rows), `expenses_${period}.csv`);
  };

  const exportExpensesXls = () => {
    const cols = ['Date', 'Category', 'Vendor', 'Description', 'Amount', 'Tax Amount'];
    const rows = expenses.map((e) => [new Date(e.date || e.created_at || '').toLocaleDateString(), e.category || '', e.vendor || '', e.description || '', e.amount || 0, e.tax_amount || 0]);
    downloadExcel(cols, rows, `expenses_${period}.xls`);
  };

  const exportPnLCsv = () => {
    const rows = [
      { metric: 'Revenue (All)', amount: totalRevenueAll },
      { metric: 'Expenses (All)', amount: totalExpensesAll },
      { metric: 'Profit (All)', amount: profitAll },
      { metric: `Revenue (${period})`, amount: totalRevenuePeriod },
      { metric: `Expenses (${period})`, amount: totalExpensesPeriod },
      { metric: `Profit (${period})`, amount: profitPeriod },
    ];
    download(makeCsv(rows), `pnl_${period}.csv`);
  };

  const exportPnLXls = () => {
    const cols = ['Metric', 'Amount'];
    const rows = [
      ['Revenue (All)', totalRevenueAll],
      ['Expenses (All)', totalExpensesAll],
      ['Profit (All)', profitAll],
      [`Revenue (${period})`, totalRevenuePeriod],
      [`Expenses (${period})`, totalExpensesPeriod],
      [`Profit (${period})`, profitPeriod],
    ];
    downloadExcel(cols, rows, `pnl_${period}.xls`);
  };

  const exportTaxCsv = () => {
    const rows = monthlyOrQuarterlyTax.map((r) => ({ period: r.periodKey, output_tax: Math.round(r.output), input_tax: Math.round(r.input), net_tax: Math.round(r.net) }));
    download(makeCsv(rows), `tax_summary_${taxPeriodType}.csv`);
  };

  const exportTaxXls = () => {
    const cols = ['Period', 'Output Tax', 'Input Tax', 'Net Tax'];
    const rows = monthlyOrQuarterlyTax.map((r) => [r.periodKey, Math.round(r.output), Math.round(r.input), Math.round(r.net)]);
    downloadExcel(cols, rows, `tax_summary_${taxPeriodType}.xls`);
  };

  const exportReceivablesPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Projects Receivables', 14, 16);
    doc.setFontSize(10);
    const headers = ['Project', 'Customer', 'Total', 'Paid', 'Outstanding', 'Mode', 'Stage', 'Status'];
    let y = 24;
    doc.text(headers.join(' | '), 14, y);
    y += 6;
    filteredProjects.forEach((p) => {
      const row = [
        p.name,
        p.customer_name || '',
        (p.proposal_amount || 0).toLocaleString('en-IN'),
        (((p.advance_payment || 0) + (p.paid_amount || 0)) || 0).toLocaleString('en-IN'),
        (p.balance_amount || 0).toLocaleString('en-IN'),
        p.payment_mode || '',
        p.current_stage || '',
        p.status || '',
      ].join(' | ');
      if (y > 280) { doc.addPage(); y = 14; }
      doc.text(row, 14, y); y += 6;
    });
    doc.save('receivables.pdf');
  };

  const generatePnLPdf = () => {
    const doc = new jsPDF();
    let y = 16;
    doc.setFontSize(16); doc.text('Profit & Loss Statement', 14, y); y += 10;
    doc.setFontSize(12);
    const lines = [
      [`Revenue (All)`, inr(totalRevenueAll)],
      [`Expenses (All)`, inr(totalExpensesAll)],
      [`Profit (All)`, inr(profitAll)],
      [`Revenue (${period})`, inr(totalRevenuePeriod)],
      [`Expenses (${period})`, inr(totalExpensesPeriod)],
      [`Profit (${period})`, inr(profitPeriod)],
    ];
    lines.forEach((l) => { doc.text(l[0], 14, y); doc.text(l[1], 196 - 14, y, { align: 'right' }); y += 8; });
    doc.save('pnl.pdf');
  };

  const generatePaymentInvoice = async (project: Project, payments: PaymentHistory[]) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const BRAND_PRIMARY = { r: 72, g: 187, b: 120 };
      const TEXT_PRIMARY = { r: 45, g: 55, b: 72 };
      const TEXT_MUTED = { r: 99, g: 110, b: 114 };
      const BOX_BG = { r: 244, g: 252, b: 247 };

      const margin = 18;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Header background
      doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.rect(0, 0, pageWidth, 9, 'F');

      // Add logo
      try {
        const { dataUrl: logoData, aspectRatio: logoRatio } = await fetchImageAsset(LOGO_URL);
        const maxLogoWidth = 68;
        const maxLogoHeight = 34;
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth * logoRatio;
        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight / logoRatio;
        }
        doc.addImage(logoData, 'PNG', pageWidth - margin - logoWidth, margin - 8, logoWidth, logoHeight, undefined, 'FAST');
      } catch (err) {
        console.error('Logo image error:', err);
      }

      // Company name and subtitle
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

      doc.setDrawColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
      doc.line(margin, 55, pageWidth - margin, 55);

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.text('PAYMENT INVOICE', pageWidth / 2, 68, { align: 'center' });

      // Project and Customer Info
      let y = 78;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Customer:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(project.customer_name || '', margin + 50, y);

      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Project:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(project.name || '', margin + 50, y);

      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Invoice No:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(`INV-${project.id.slice(0, 8).toUpperCase()}`, margin + 50, y);

      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Date:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), margin + 50, y);

      y += 12;

      // Payment Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('Payment Details', margin, y);

      y += 8;
      const tableTop = y;
      const colWidth = (pageWidth - margin * 2) / 4;

      // Table header
      doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.rect(margin, tableTop, pageWidth - margin * 2, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', margin + 3, tableTop + 5);
      doc.text('Payment Mode', margin + colWidth + 3, tableTop + 5);
      doc.text('Amount (��)', margin + colWidth * 2 + 3, tableTop + 5);
      doc.text('Reference', margin + colWidth * 3 + 3, tableTop + 5);

      y = tableTop + 10;
      let totalPaid = 0;
      const paymentRefNo = `AGE${Date.now().toString().slice(-6)}`;

      payments.forEach((p, idx) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);

        const paymentDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : (p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-');
        doc.text(paymentDate, margin + 3, y);
        doc.text(p.payment_mode || '-', margin + colWidth + 3, y);
        doc.text((p.amount || 0).toLocaleString('en-IN'), margin + colWidth * 2 + 3, y);
        doc.text(`AGE-${paymentRefNo}-${idx + 1}`, margin + colWidth * 3 + 3, y);

        totalPaid += p.amount || 0;
        y += 6;
      });

      // Total row
      doc.setLineWidth(0.5);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text('TOTAL PAID:', margin + 3, y);
      doc.text(totalPaid.toLocaleString('en-IN'), margin + colWidth * 2 + 3, y);

      y += 10;

      // Amount Box
      const amountBoxWidth = 70;
      const amountBoxHeight = 28;
      doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.roundedRect(pageWidth - margin - amountBoxWidth - 5, y, amountBoxWidth, amountBoxHeight, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL PAID', pageWidth - margin - amountBoxWidth / 2 - 5, y + 8, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, pageWidth - margin - amountBoxWidth / 2 - 5, y + 20, { align: 'center' });

      y += 35;

      // Amount in words box
      doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text('Amount in Words', margin + 8, y + 7);

      const words = convertNumberToWords(totalPaid);
      const amountText = `Indian Rupee ${words} Only`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      const wrappedText = doc.splitTextToSize(amountText, pageWidth - margin * 2 - 16);
      doc.text(wrappedText, margin + 8, y + 13);

      y += 25;

      // Outstanding section
      doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.text('Outstanding Balance', margin + 8, y + 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_PRIMARY.r, TEXT_PRIMARY.g, TEXT_PRIMARY.b);
      doc.text(`Rs. ${(project.balance_amount || 0).toLocaleString('en-IN')}`, margin + 8, y + 16);

      y += 25;

      // Thank you text and signature
      const thankYouText = 'Thank you for choosing sustainable energy solutions!';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.text(thankYouText, pageWidth / 2, y, { align: 'center' });

      // Add signature stamp at bottom
      try {
        const { dataUrl: signatureData, aspectRatio: signatureRatio } = await fetchImageAsset(FOOTER_SIGN_STAMP_URL);
        const signatureWidth = 42;
        const signatureHeight = signatureWidth * (signatureRatio || 0.45);

        const signatureX = pageWidth - margin - signatureWidth - 5;
        const signatureY = pageHeight - 30;

        doc.addImage(signatureData, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight, undefined, 'FAST');

        // Add company and manager text below signature
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
        doc.text('For AXISO GREEN ENERGIES PVT. LTD.', signatureX, signatureY + signatureHeight + 3, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Manager', signatureX, signatureY + signatureHeight + 8, { align: 'right' });
      } catch (err) {
        console.error('Signature image error:', err);
      }

      // Footer bar
      doc.setFillColor(BRAND_PRIMARY.r, BRAND_PRIMARY.g, BRAND_PRIMARY.b);
      doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');

      doc.save(`Payment_Invoice_${project.id}.pdf`);
    } catch (error) {
      console.error('Error generating payment invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invoice',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const convertNumberToWords = (num: number): string => {
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
  };

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <Heading as="h1" size="xl" mb={2}>Finance Dashboard</Heading>
      <HStack mb={4} spacing={3}>
        <Button size="sm" colorScheme="green" onClick={() => { window.location.href = '#/procurement'; }}>Open Procurement</Button>
        <Button size="sm" onClick={() => { window.location.href = '#/stock'; }}>Open Warehouse</Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
        <Card><CardBody><Stat><StatLabel>Total Outstanding Amount</StatLabel><StatNumber>{inr(totalOutstanding)}</StatNumber><Text fontSize="sm" color="gray.500">From all projects</Text></Stat></CardBody></Card>
        <Card><CardBody><Stat><StatLabel>Expected This Month</StatLabel><StatNumber>{inr(expectedThisMonth)}</StatNumber><Text fontSize="sm" color="gray.500">Based on 45-day collection timeframe</Text></Stat></CardBody></Card>
        <Card><CardBody><Stat><StatLabel>Active Projects</StatLabel><StatNumber>{activeProjectsCount}</StatNumber><Text fontSize="sm" color="gray.500">With outstanding payments</Text></Stat></CardBody></Card>
      </SimpleGrid>

      <Tabs colorScheme="green" isFitted variant="enclosed">
        <TabList>
          <Tab>Sales & Revenue</Tab>
          <Tab>Projects Receivables</Tab>
          <Tab>Estimation Cost</Tab>
          <Tab>Tax Invoice</Tab>
          <Tab>Reports & Export</Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0} pt={4}>
            <Card mb={6}>
              <CardHeader>
                <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
                  <Heading size="md">Sales & Revenue</Heading>
                  <HStack>
                    <Select size="sm" value={period} onChange={(e) => setPeriod(e.target.value as any)} maxW="180px">
                      <option value="all">All Time</option>
                      <option value="daily">Today</option>
                      <option value="weekly">This Week</option>
                      <option value="monthly">This Month</option>
                    </Select>
                    <Button size="sm" onClick={exportOrdersCsv}>Export Orders CSV</Button>
                    <Button size="sm" onClick={exportOrdersXls}>Export Orders Excel</Button>
                  </HStack>
                </Flex>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={4}>
                  <Stat><StatLabel>Revenue ({period === 'all' ? 'All' : 'Period'})</StatLabel><StatNumber>{inr(period === 'all' ? totalRevenueAll : totalRevenuePeriod)}</StatNumber></Stat>
                  <Stat><StatLabel>Expenses ({period === 'all' ? 'All' : 'Period'})</StatLabel><StatNumber>{inr(period === 'all' ? totalExpensesAll : totalExpensesPeriod)}</StatNumber></Stat>
                  <Stat><StatLabel>Profit ({period === 'all' ? 'All' : 'Period'})</StatLabel><StatNumber color={(period === 'all' ? profitAll : profitPeriod) >= 0 ? 'green.600' : 'red.600'}>{inr(period === 'all' ? profitAll : profitPeriod)}</StatNumber></Stat>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
                  <Card>
                    <CardHeader><Heading size="sm">Revenue Trend</Heading></CardHeader>
                    <CardBody>
                      {revenueTrend.labels.length > 0 ? (
                        <Table size="sm" variant="simple">
                          <Thead><Tr><Th>Date</Th><Th isNumeric>Amount</Th></Tr></Thead>
                          <Tbody>
                            {revenueTrend.labels.slice(-12).map((d, i) => (
                              <Tr key={d}><Td>{d}</Td><Td isNumeric>{inr(revenueTrend.values[i] || 0)}</Td></Tr>
                            ))}
                          </Tbody>
                        </Table>
                      ) : (
                        <Text fontSize="sm" color="gray.500">No data</Text>
                      )}
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader><Heading size="sm">Region-wise Revenue</Heading></CardHeader>
                    <CardBody>
                      <Table size="sm" variant="simple"><Thead><Tr><Th>Region</Th><Th isNumeric>Revenue</Th></Tr></Thead><Tbody>{revenueByRegion.map(([region, amt]) => (<Tr key={region}><Td>{region}</Td><Td isNumeric>{inr(amt)}</Td></Tr>))}{revenueByRegion.length === 0 && (<Tr><Td colSpan={2} textAlign="center">No data</Td></Tr>)}</Tbody></Table>
                  </CardBody>
                  </Card>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <Card>
                    <CardHeader><Heading size="sm">Top Performing Products/Projects</Heading></CardHeader>
                    <CardBody>
                      <Table size="sm" variant="simple"><Thead><Tr><Th>Project</Th><Th isNumeric>Revenue</Th></Tr></Thead><Tbody>{topProducts.map(([name, amt]) => (<Tr key={name}><Td>{name}</Td><Td isNumeric>{inr(amt)}</Td></Tr>))}{topProducts.length === 0 && (<Tr><Td colSpan={2} textAlign="center">No data</Td></Tr>)}</Tbody></Table>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader><Heading size="sm">Expenses by Category</Heading></CardHeader>
                    <CardBody>
                      {expensesByCategory.labels.length > 0 ? (
                        <Table size="sm" variant="simple">
                          <Thead><Tr><Th>Category</Th><Th isNumeric>Amount</Th></Tr></Thead>
                          <Tbody>
                            {expensesByCategory.labels.map((lbl, idx) => (
                              <Tr key={lbl}><Td>{lbl}</Td><Td isNumeric>{inr(expensesByCategory.values[idx] || 0)}</Td></Tr>
                            ))}
                          </Tbody>
                        </Table>
                      ) : (
                        <Text fontSize="sm" color="gray.500">No data</Text>
                      )}
                    </CardBody>
                  </Card>
                </SimpleGrid>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel p={0} pt={4}>
            <Flex mb={4} justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={4}>
              <HStack>
                <Button colorScheme={filter === 'all' ? 'blue' : 'gray'} onClick={() => setFilter('all')}>All Projects</Button>
                <Button colorScheme={filter === 'active' ? 'blue' : 'gray'} onClick={() => setFilter('active')}>Active Projects</Button>
                <Button colorScheme={filter === 'completed' ? 'blue' : 'gray'} onClick={() => setFilter('completed')}>Completed Projects</Button>
              </HStack>
              <FormControl maxW="300px">
                <Input placeholder="Search by name or customer" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </FormControl>
            </Flex>
            <Card>
              <CardHeader>
                <Flex align="center" justify="space-between">
                  <Heading size="md">Projects Receivables</Heading>
                  <Button size="sm" onClick={exportReceivablesPdf}>Download PDF</Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Project Name</Th>
                      <Th>Customer</Th>
                      <Th>Total Amount</Th>
                      <Th>Paid</Th>
                      <Th>Outstanding</Th>
                      <Th>Payment Mode</Th>
                      <Th>Stage</Th>
                      <Th>Status</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredProjects.map(project => (
                      <Tr key={project.id}>
                        <Td fontWeight="medium">{project.name}</Td>
                        <Td>{project.customer_name}</Td>
                        <Td>{inr(project.proposal_amount || 0)}</Td>
                        <Td>{inr((project.advance_payment || 0) + (project.paid_amount || 0))}</Td>
                        <Td fontWeight="bold" color={(project.balance_amount || 0) > 0 ? 'red.500' : 'green.500'}>{inr(project.balance_amount || 0)}</Td>
                        <Td><Badge colorScheme={project.payment_mode === 'Loan' ? 'purple' : 'blue'}>{project.payment_mode}</Badge></Td>
                        <Td>{project.current_stage}</Td>
                        <Td><Badge colorScheme={project.status === 'active' ? 'green' : 'gray'}>{project.status}</Badge></Td>
                        <Td><Button size="xs" variant="outline" onClick={() => openPaymentModal(project)}>Payment</Button></Td>
                      </Tr>
                    ))}
                    {filteredProjects.length === 0 && (
                      <Tr>
                        <Td colSpan={9} textAlign="center" py={4}>{loading ? 'Loading...' : 'No projects found'}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>

            <Modal isOpen={isPaymentModalOpen} onClose={onPaymentModalClose} size="4xl">
              <ModalOverlay />
              <ModalContent maxH="90vh" overflowY="auto">
                <ModalHeader>{selectedProject?.name} - Payment Management</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                  {selectedProject && (
                    <VStack spacing={6} align="stretch">
                      <Card>
                        <CardHeader>
                          <Heading size="md">Project Information</Heading>
                        </CardHeader>
                        <CardBody>
                          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                            <Box>
                              <Text fontSize="sm" color="gray.600">Customer Name</Text>
                              <Text fontWeight="bold">{selectedProject.customer_name}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="sm" color="gray.600">Total Amount</Text>
                              <Text fontWeight="bold">{inr(selectedProject.proposal_amount || 0)}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="sm" color="gray.600">Paid Amount</Text>
                              <Text fontWeight="bold">{inr((selectedProject.advance_payment || 0) + (selectedProject.paid_amount || 0))}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="sm" color="gray.600">Outstanding</Text>
                              <Text fontWeight="bold" color={(selectedProject.balance_amount || 0) > 0 ? 'red.500' : 'green.500'}>{inr(selectedProject.balance_amount || 0)}</Text>
                            </Box>
                          </SimpleGrid>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Heading size="md">Add Payment</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack align="start" spacing={4}>
                            <FormControl isRequired>
                              <FormLabel>Payment Amount</FormLabel>
                              <Input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="Enter payment amount"
                                max={selectedProject.proposal_amount - ((selectedProject.advance_payment || 0) + (selectedProject.paid_amount || 0))}
                                min={0}
                                step="0.01"
                                isDisabled={paymentLoading}
                              />
                              <Text fontSize="sm" color="gray.500">
                                Maximum payment amount: {inr(selectedProject.proposal_amount - ((selectedProject.advance_payment || 0) + (selectedProject.paid_amount || 0)))}
                              </Text>
                            </FormControl>
                            <FormControl isRequired>
                              <FormLabel>Payment Date</FormLabel>
                              <Input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                isDisabled={paymentLoading}
                              />
                            </FormControl>
                            <FormControl isRequired>
                              <FormLabel>Payment Mode</FormLabel>
                              <Select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                                isDisabled={paymentLoading}
                              >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Subsidy">Subsidy</option>
                              </Select>
                            </FormControl>
                            <Button
                              colorScheme="green"
                              width="full"
                              onClick={handleAddPayment}
                              isLoading={paymentLoading}
                              loadingText="Adding"
                              isDisabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading}
                            >
                              Add Payment
                            </Button>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Heading size="md">Payment History</Heading>
                        </CardHeader>
                        <CardBody>
                          {paymentHistory && paymentHistory.length > 0 ? (
                            <TableContainer>
                              <Table variant="simple" size="md">
                                <Thead>
                                  <Tr>
                                    <Th>Date</Th>
                                    <Th>Amount (₹)</Th>
                                    <Th>Mode</Th>
                                    <Th>Receipt</Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {paymentHistory.map((p) => (
                                    <Tr key={p.id}>
                                      <Td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '')}</Td>
                                      <Td>{p.amount != null ? p.amount.toLocaleString() : ''}</Td>
                                      <Td>{p.payment_mode || '-'}</Td>
                                      <Td>
                                        <HStack spacing={2}>
                                          <Button size="sm" colorScheme="blue" onClick={() => handleDownloadReceipt(p)}>
                                            Download Receipt
                                          </Button>
                                          {p.id !== 'advance' && (
                                            <Button size="sm" colorScheme="red" onClick={() => handleDeletePayment(p.id)}>
                                              Delete
                                            </Button>
                                          )}
                                        </HStack>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Text textAlign="center" color="gray.500">No payment history found.</Text>
                          )}
                        </CardBody>
                      </Card>
                    </VStack>
                  )}
                </ModalBody>
                <ModalFooter>
                  <HStack spacing={3}>
                    <Button onClick={onPaymentModalClose}>Close</Button>
                    <Button
                      colorScheme="blue"
                      onClick={async () => {
                        if (selectedProject && paymentHistory.length > 0) {
                          await generatePaymentInvoice(selectedProject, paymentHistory);
                        }
                      }}
                      isDisabled={!selectedProject || paymentHistory.length === 0}
                    >
                      Download Invoice
                    </Button>
                  </HStack>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </TabPanel>

          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Estimation Cost</Heading>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={6}>
                  <Card bg="gray.50">
                    <CardHeader>
                      <Heading size="sm">Create New Estimation</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Customer Name</FormLabel>
                          <Input
                            placeholder="Enter customer name"
                            value={estimationForm.customerName}
                            onChange={(e) => setEstimationForm({ ...estimationForm, customerName: e.target.value })}
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Estimation Service No.</FormLabel>
                          <Input
                            placeholder="Enter service number"
                            value={estimationForm.serviceNo}
                            onChange={(e) => setEstimationForm({ ...estimationForm, serviceNo: e.target.value })}
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Description</FormLabel>
                          <Input
                            as="textarea"
                            placeholder="Enter detailed description"
                            value={estimationForm.description}
                            onChange={(e) => setEstimationForm({ ...estimationForm, description: e.target.value })}
                            minH="100px"
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Estimated Cost (₹)</FormLabel>
                          <Input
                            type="number"
                            placeholder="Enter estimated cost"
                            value={estimationForm.estimatedCost}
                            onChange={(e) => setEstimationForm({ ...estimationForm, estimatedCost: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </FormControl>
                        <Button
                          colorScheme="green"
                          width="full"
                          onClick={handleAddEstimation}
                          isLoading={estimationLoading}
                          loadingText="Creating"
                        >
                          Create Estimation & Download PDF
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Heading size="sm">Estimation History</Heading>
                    </CardHeader>
                    <CardBody>
                      {estimations.length > 0 ? (
                        <TableContainer>
                          <Table variant="simple" size="sm">
                            <Thead>
                              <Tr>
                                <Th>Customer Name</Th>
                                <Th>Service No.</Th>
                                <Th>Description</Th>
                                <Th isNumeric>Estimated Cost (₹)</Th>
                                <Th>Date</Th>
                                <Th>Action</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {estimations.map((est) => (
                                <Tr key={est.id}>
                                  <Td>{est.customer_name}</Td>
                                  <Td>{est.service_no}</Td>
                                  <Td>{est.description.substring(0, 50)}...</Td>
                                  <Td isNumeric>{est.estimated_cost.toLocaleString('en-IN')}</Td>
                                  <Td>{est.created_at ? new Date(est.created_at).toLocaleDateString() : '-'}</Td>
                                  <Td>
                                    <Button
                                      size="sm"
                                      colorScheme="blue"
                                      onClick={() => downloadEstimationPDF(est)}
                                    >
                                      Download PDF
                                    </Button>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Text textAlign="center" color="gray.500">No estimations found.</Text>
                      )}
                    </CardBody>
                  </Card>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Tax Invoice</Heading>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" spacing={6}>
                  <Card bg="gray.50">
                    <CardHeader>
                      <Heading size="sm">Create New Tax Invoice</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Select Customer/Project</FormLabel>
                          <Input
                            placeholder="Search customer name or project..."
                            value={projectSearchTerm}
                            onChange={(e) => setProjectSearchTerm(e.target.value)}
                            mb={2}
                          />
                          <Box
                            border="1px solid"
                            borderColor="gray.300"
                            borderRadius="md"
                            maxH="200px"
                            overflowY="auto"
                            bg="white"
                          >
                            {projects
                              .filter((p) =>
                                p.customer_name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
                                p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                              )
                              .map((project) => (
                                <Box
                                  key={project.id}
                                  p={3}
                                  borderBottom="1px solid"
                                  borderColor="gray.200"
                                  cursor="pointer"
                                  _hover={{ bg: 'gray.100' }}
                                  onClick={() => {
                                    handleSelectProjectForInvoice(project.id);
                                    setProjectSearchTerm('');
                                  }}
                                >
                                  <Text fontWeight="bold">{project.customer_name}</Text>
                                  <Text fontSize="sm" color="gray.600">
                                    {project.name}
                                  </Text>
                                </Box>
                              ))}
                            {projects.filter((p) =>
                              p.customer_name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
                              p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                            ).length === 0 && projectSearchTerm && (
                              <Box p={3} textAlign="center" color="gray.500">
                                No projects found
                              </Box>
                            )}
                          </Box>
                        </FormControl>

                        {taxInvoiceForm.project_id && (
                          <Card bg="blue.50" width="full">
                            <CardBody>
                              <SimpleGrid columns={2} spacing={4}>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">Capacity</Text>
                                  <Text fontWeight="bold">{taxInvoiceForm.capacity || 'N/A'}</Text>
                                </Box>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">Amount Paid</Text>
                                  <Text fontWeight="bold">₹{(taxInvoiceForm.amount_paid || 0).toLocaleString('en-IN')}</Text>
                                </Box>
                              </SimpleGrid>
                            </CardBody>
                          </Card>
                        )}

                        <FormControl isRequired>
                          <FormLabel>Customer Name</FormLabel>
                          <Input
                            placeholder="Enter customer name"
                            value={taxInvoiceForm.customer_name}
                            onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, customer_name: e.target.value })}
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Place of Supply</FormLabel>
                          <Input
                            placeholder="Enter place of supply"
                            value={taxInvoiceForm.place_of_supply}
                            onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, place_of_supply: e.target.value })}
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>State</FormLabel>
                          <Input
                            placeholder="Enter state"
                            value={taxInvoiceForm.state}
                            onChange={(e) => setTaxInvoiceForm({ ...taxInvoiceForm, state: e.target.value })}
                          />
                        </FormControl>

                        <Box width="full" borderTop="2px solid" borderColor="gray.200" pt={4}>
                          <Heading size="sm" mb={4}>Invoice Items</Heading>
                          <FormControl mb={4}>
                            <FormLabel>Select Item to Add</FormLabel>
                            <HStack width="full" spacing={2}>
                              <Select
                                placeholder="Choose an item"
                                id="itemSelect"
                              >
                                <option value="">-- Select Item --</option>
                                {PREDEFINED_INVOICE_ITEMS.map((item, idx) => (
                                  <option key={idx} value={idx}>
                                    {item.name}
                                  </option>
                                ))}
                              </Select>
                              <Button
                                colorScheme="blue"
                                onClick={() => {
                                  const select = document.getElementById('itemSelect') as HTMLSelectElement;
                                  const selectedIndex = parseInt(select.value);
                                  if (selectedIndex >= 0) {
                                    const selectedItem = PREDEFINED_INVOICE_ITEMS[selectedIndex];
                                    const newItems = [
                                      ...taxInvoiceForm.items,
                                      {
                                        description: selectedItem.name,
                                        hsn: '',
                                        quantity: 1,
                                        rate: 0,
                                        cgst_percent: 9,
                                        sgst_percent: 9,
                                      },
                                    ];
                                    setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                    select.value = '';
                                  }
                                }}
                              >
                                Add Item
                              </Button>
                            </HStack>
                          </FormControl>
                          {taxInvoiceForm.items.map((item, index) => (
                            <Card key={index} mb={4} bg="white" border="2px solid" borderColor="green.200">
                              <CardHeader bg="green.50" pb={2}>
                                <HStack justify="space-between">
                                  <Box>
                                    <Text fontSize="sm" color="gray.600">Item {index + 1}</Text>
                                    <Text fontWeight="bold">{item.description}</Text>
                                  </Box>
                                  {taxInvoiceForm.items.length > 1 && (
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      variant="outline"
                                      onClick={() => {
                                        const newItems = taxInvoiceForm.items.filter((_, i) => i !== index);
                                        setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                </HStack>
                              </CardHeader>
                              <CardBody>
                                <VStack spacing={3}>
                                  <FormControl isRequired>
                                    <FormLabel>Item Description (Optional)</FormLabel>
                                    <Input
                                      as="textarea"
                                      placeholder="Add additional description or specifications for this item"
                                      value={item.description}
                                      onChange={(e) => {
                                        const newItems = [...taxInvoiceForm.items];
                                        newItems[index].description = e.target.value;
                                        setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                      }}
                                      minH="80px"
                                    />
                                  </FormControl>
                                  <FormControl isRequired>
                                    <FormLabel>HSN Code</FormLabel>
                                    <Input
                                      placeholder="Enter HSN/SAC code"
                                      value={item.hsn}
                                      onChange={(e) => {
                                        const newItems = [...taxInvoiceForm.items];
                                        newItems[index].hsn = e.target.value;
                                        setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                      }}
                                    />
                                  </FormControl>
                                  <SimpleGrid columns={4} spacing={3} width="full">
                                    <FormControl isRequired>
                                      <FormLabel fontSize="sm">Quantity</FormLabel>
                                      <Input
                                        type="number"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const newItems = [...taxInvoiceForm.items];
                                          newItems[index].quantity = parseFloat(e.target.value) || 0;
                                          setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                        }}
                                        min="0"
                                        step="0.01"
                                      />
                                    </FormControl>
                                    <FormControl isRequired>
                                      <FormLabel fontSize="sm">Rate (₹)</FormLabel>
                                      <Input
                                        type="number"
                                        placeholder="Rate"
                                        value={item.rate}
                                        onChange={(e) => {
                                          const newItems = [...taxInvoiceForm.items];
                                          newItems[index].rate = parseFloat(e.target.value) || 0;
                                          setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                        }}
                                        min="0"
                                        step="0.01"
                                      />
                                    </FormControl>
                                    <FormControl isRequired>
                                      <FormLabel fontSize="sm">CGST %</FormLabel>
                                      <Input
                                        type="number"
                                        placeholder="CGST %"
                                        value={item.cgst_percent}
                                        onChange={(e) => {
                                          const newItems = [...taxInvoiceForm.items];
                                          newItems[index].cgst_percent = parseFloat(e.target.value) || 0;
                                          setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                        }}
                                        min="0"
                                        step="0.01"
                                      />
                                    </FormControl>
                                    <FormControl isRequired>
                                      <FormLabel fontSize="sm">SGST %</FormLabel>
                                      <Input
                                        type="number"
                                        placeholder="SGST %"
                                        value={item.sgst_percent}
                                        onChange={(e) => {
                                          const newItems = [...taxInvoiceForm.items];
                                          newItems[index].sgst_percent = parseFloat(e.target.value) || 0;
                                          setTaxInvoiceForm({ ...taxInvoiceForm, items: newItems });
                                        }}
                                        min="0"
                                        step="0.01"
                                      />
                                    </FormControl>
                                  </SimpleGrid>
                                  <Box width="full" p={2} bg="gray.100" borderRadius="md">
                                    <Text fontSize="sm" color="gray.700" fontWeight="bold">
                                      Item Total: ₹{(item.quantity * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                  </Box>
                                </VStack>
                              </CardBody>
                            </Card>
                          ))}
                        </Box>

                        <Button
                          colorScheme="green"
                          width="full"
                          onClick={handleAddTaxInvoice}
                          isLoading={taxInvoiceLoading}
                          loadingText="Creating"
                          size="lg"
                        >
                          Create Invoice & Download PDF
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Heading size="sm">Tax Invoices History</Heading>
                    </CardHeader>
                    <CardBody>
                      {taxInvoices.length > 0 ? (
                        <TableContainer>
                          <Table variant="simple" size="sm">
                            <Thead>
                              <Tr>
                                <Th>GST No.</Th>
                                <Th>Customer Name</Th>
                                <Th>Place of Supply</Th>
                                <Th>State</Th>
                                <Th>Date</Th>
                                <Th>Action</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {taxInvoices.map((invoice) => (
                                <Tr key={invoice.id}>
                                  <Td fontWeight="bold">{invoice.gst_no}</Td>
                                  <Td>{invoice.customer_name}</Td>
                                  <Td>{invoice.place_of_supply}</Td>
                                  <Td>{invoice.state}</Td>
                                  <Td>{invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '-'}</Td>
                                  <Td>
                                    <Button
                                      size="sm"
                                      colorScheme="blue"
                                      onClick={() => downloadTaxInvoicePDF(invoice)}
                                    >
                                      Download PDF
                                    </Button>
                                  </Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Text textAlign="center" color="gray.500">No tax invoices found.</Text>
                      )}
                    </CardBody>
                  </Card>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel p={0} pt={4}>
            <Card>
              <CardHeader>
                <Heading size="md">Reports & Export</Heading>
              </CardHeader>
              <CardBody>
                <Tabs colorScheme="green" isFitted>
                  <TabList>
                    <Tab>Order & Payment</Tab>
                    <Tab>Customer Purchase</Tab>
                    <Tab>Expense Report</Tab>
                    <Tab>Tax Summary</Tab>
                    <Tab>P&L Statement</Tab>
                    <Tab>Exports</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Revenue Trend</Text>
                          {revenueTrend.labels.length > 0 ? (
                            <Table size="sm" variant="simple">
                              <Thead><Tr><Th>Date</Th><Th isNumeric>Amount</Th></Tr></Thead>
                              <Tbody>
                                {revenueTrend.labels.slice(-12).map((d, i) => (
                                  <Tr key={d}><Td>{d}</Td><Td isNumeric>{inr(revenueTrend.values[i] || 0)}</Td></Tr>
                                ))}
                              </Tbody>
                            </Table>
                          ) : (
                            <Text fontSize="sm" color="gray.500">No data</Text>
                          )}
                        </Box>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Top Projects (share)</Text>
                          <Table size="sm" variant="simple">
                            <Thead><Tr><Th>Project</Th><Th isNumeric>Revenue</Th></Tr></Thead>
                            <Tbody>
                              {topProducts.map(([name, amt]) => (
                                <Tr key={String(name)}><Td>{String(name)}</Td><Td isNumeric>{inr(amt as number)}</Td></Tr>
                              ))}
                              {topProducts.length === 0 && (<Tr><Td colSpan={2} textAlign="center">No data</Td></Tr>)}
                            </Tbody>
                          </Table>
                        </Box>
                      </SimpleGrid>
                      <HStack mb={4}>
                        <Button size="sm" onClick={exportOrdersCsv}>CSV</Button>
                        <Button size="sm" onClick={exportOrdersXls}>Excel</Button>
                      </HStack>
                      <Table variant="simple" size="sm">
                        <Thead><Tr><Th>Date</Th><Th>Project</Th><Th>Customer</Th><Th isNumeric>Amount</Th><Th>Status</Th><Th>Order ID</Th><Th>Payment ID</Th></Tr></Thead>
                        <Tbody>
                          {payments.map((p) => (
                            <Tr key={p.id}><Td>{new Date(p.created_at).toLocaleDateString()}</Td><Td>{p.project_name}</Td><Td>{p.customer_name}</Td><Td isNumeric>{inr(p.amount)}</Td><Td><Badge colorScheme={p.status === 'success' ? 'green' : 'yellow'}>{p.status}</Badge></Td><Td>{p.order_id}</Td><Td>{p.payment_id}</Td></Tr>
                          ))}
                          {payments.length === 0 && (<Tr><Td colSpan={7} textAlign="center">No orders found</Td></Tr>)}
                        </Tbody>
                      </Table>
                    </TabPanel>

                    <TabPanel>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Customer Share</Text>
                          <DonutChart segments={customerPurchases.slice(0, 6).map(([c, amt], i) => ({ label: String(c), value: amt as number, color: palette[i % palette.length] }))} />
                          <HStack wrap="wrap" spacing={4} mt={3}>
                            {customerPurchases.slice(0, 6).map(([c, amt], i) => (
                              <HStack key={String(c)} spacing={2}>
                                <Box w="10px" h="10px" borderRadius="sm" bg={palette[i % palette.length]} />
                                <Text fontSize="xs" color="gray.600">{String(c)} ({inr(amt as number)})</Text>
                              </HStack>
                            ))}
                          </HStack>
                        </Box>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Top Customers</Text>
                          <Table size="sm" variant="simple"><Thead><Tr><Th>Customer</Th><Th isNumeric>Total Purchase</Th></Tr></Thead><Tbody>{customerPurchases.slice(0, 10).map(([c, amt]) => (<Tr key={String(c)}><Td>{String(c)}</Td><Td isNumeric>{inr(amt as number)}</Td></Tr>))}</Tbody></Table>
                        </Box>
                      </SimpleGrid>
                      <HStack mb={4}>
                        <Button size="sm" onClick={() => { const rows = customerPurchases.map(([c, amt]) => ({ customer: c, amount: amt })); download(makeCsv(rows), 'customer_purchases.csv'); }}>CSV</Button>
                        <Button size="sm" onClick={() => { const cols = ['Customer', 'Amount']; const rows = customerPurchases.map(([c, amt]) => [c, amt]); downloadExcel(cols, rows, 'customer_purchases.xls'); }}>Excel</Button>
                      </HStack>
                    </TabPanel>

                    <TabPanel>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Expenses by Category</Text>
                          {expensesByCategory.labels.length > 0 ? (
                            <BarChart labels={expensesByCategory.labels} values={expensesByCategory.values} color="green.300" />
                          ) : (
                            <Text fontSize="sm" color="gray.500">No data</Text>
                          )}
                        </Box>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Recent Expenses</Text>
                          <Table variant="simple" size="sm"><Thead><Tr><Th>Date</Th><Th>Category</Th><Th>Vendor</Th><Th>Description</Th><Th isNumeric>Amount</Th></Tr></Thead><Tbody>{periodExpenses.slice(0, 8).map((e) => (<Tr key={e.id}><Td>{new Date(e.date || e.created_at || '').toLocaleDateString()}</Td><Td>{e.category || '-'}</Td><Td>{e.vendor || '-'}</Td><Td>{e.description || '-'}</Td><Td isNumeric>{inr(e.amount || 0)}</Td></Tr>))}{periodExpenses.length === 0 && (<Tr><Td colSpan={5} textAlign="center">No expenses found</Td></Tr>)}</Tbody></Table>
                        </Box>
                      </SimpleGrid>
                      <HStack mb={4}>
                        <Button size="sm" onClick={exportExpensesCsv}>CSV</Button>
                        <Button size="sm" onClick={exportExpensesXls}>Excel</Button>
                      </HStack>
                    </TabPanel>

                    <TabPanel>
                      <SimpleGrid columns={{ base: 1, md: 1 }} spacing={6} mb={4}>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>Tax: Output vs Input</Text>
                          <BarCompareChart labels={monthlyOrQuarterlyTax.map(r => r.periodKey)} seriesA={monthlyOrQuarterlyTax.map(r => Math.round(r.output))} seriesB={monthlyOrQuarterlyTax.map(r => Math.round(r.input))} seriesLabels={["Output Tax", "Input Tax"]} />
                        </Box>
                      </SimpleGrid>
                      <HStack spacing={3} mb={4}>
                        <Select size="sm" value={taxPeriodType} onChange={(e) => setTaxPeriodType(e.target.value as any)} maxW="180px">
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                        </Select>
                        <Button size="sm" onClick={exportTaxCsv}>CSV</Button>
                        <Button size="sm" onClick={exportTaxXls}>Excel</Button>
                      </HStack>
                      <Table variant="simple" size="sm"><Thead><Tr><Th>Period</Th><Th isNumeric>Output Tax</Th><Th isNumeric>Input Tax</Th><Th isNumeric>Net Tax</Th></Tr></Thead><Tbody>{monthlyOrQuarterlyTax.map((r) => (<Tr key={r.periodKey}><Td>{r.periodKey}</Td><Td isNumeric>{inr(Math.round(r.output))}</Td><Td isNumeric>{inr(Math.round(r.input))}</Td><Td isNumeric>{inr(Math.round(r.net))}</Td></Tr>))}{monthlyOrQuarterlyTax.length === 0 && (<Tr><Td colSpan={4} textAlign="center">No data</Td></Tr>)}</Tbody></Table>
                    </TabPanel>

                    <TabPanel>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={4}>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>P&L Bars</Text>
                          <BarCompareChart labels={[period === 'all' ? 'All' : 'Period']} seriesA={[period === 'all' ? totalRevenueAll : totalRevenuePeriod]} seriesB={[period === 'all' ? totalExpensesAll : totalExpensesPeriod]} seriesLabels={["Revenue", "Expenses"]} />
                        </Box>
                        <Box>
                          <Text fontWeight="semibold" color="gray.700" mb={2}>P&L Share</Text>
                          <DonutChart segments={[{ label: 'Revenue', value: period === 'all' ? totalRevenueAll : totalRevenuePeriod, color: '#2F855A' }, { label: 'Expenses', value: period === 'all' ? totalExpensesAll : totalExpensesPeriod, color: '#68D391' }]} />
                          <HStack spacing={4} mt={3}>
                            <HStack spacing={2}><Box w="10px" h="10px" bg="#2F855A" borderRadius="sm" /><Text fontSize="xs" color="gray.600">Revenue</Text></HStack>
                            <HStack spacing={2}><Box w="10px" h="10px" bg="#68D391" borderRadius="sm" /><Text fontSize="xs" color="gray.600">Expenses</Text></HStack>
                          </HStack>
                        </Box>
                      </SimpleGrid>
                      <HStack mb={4}>
                        <Button size="sm" onClick={exportPnLCsv}>CSV</Button>
                        <Button size="sm" onClick={exportPnLXls}>Excel</Button>
                        <Button size="sm" onClick={generatePnLPdf}>PDF</Button>
                      </HStack>
                    </TabPanel>

                    <TabPanel>
                      <HStack spacing={3} mb={4}>
                        <Button size="sm" onClick={exportOrdersCsv}>Orders CSV</Button>
                        <Button size="sm" onClick={exportOrdersXls}>Orders Excel</Button>
                        <Button size="sm" onClick={exportExpensesCsv}>Expenses CSV</Button>
                        <Button size="sm" onClick={exportExpensesXls}>Expenses Excel</Button>
                        <Button size="sm" onClick={exportPnLCsv}>P&L CSV</Button>
                        <Button size="sm" onClick={exportPnLXls}>P&L Excel</Button>
                        <Button size="sm" onClick={exportTaxCsv}>Tax CSV</Button>
                        <Button size="sm" onClick={exportTaxXls}>Tax Excel</Button>
                        <Button size="sm" onClick={exportReceivablesPdf}>Receivables PDF</Button>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">Download CSV, Excel, or PDF versions of your finance data.</Text>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Finance;
