import React, { useState, useEffect, useMemo } from 'react';
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
            <Tooltip key={lab} label={`${seriesLabels[0]}: ${inr(a)} · ${seriesLabels[1]}: ${inr(b)}`} hasArrow>
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

  const { isFinance, isAuthenticated, isAdmin } = useAuth();
  const toast = useToast();

  const authorized = isAuthenticated && (isFinance || isAdmin);

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
      } catch (error) {
        console.error('Error fetching finance data:', error);
        toast({ title: 'Error', description: 'Failed to fetch financial data', status: 'error', duration: 5000, isClosable: true });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [authorized, filter, toast]);

  const dateInPeriod = (iso: string | undefined) => {
    if (!periodStart || !iso) return period === 'all';
    const d = new Date(iso);
    return d >= periodStart;
  };

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

  const periodPayments = useMemo(() => payments.filter((p) => dateInPeriod(p.created_at)), [payments, periodStart, period]);
  const totalRevenueAll = useMemo(() => payments.reduce((s, r) => s + (r.amount || 0), 0), [payments]);
  const totalRevenuePeriod = useMemo(() => periodPayments.reduce((s, r) => s + (r.amount || 0), 0), [periodPayments]);

  const periodExpenses = useMemo(() => expenses.filter((e) => dateInPeriod(e.date || e.created_at || '')), [expenses, periodStart, period]);
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

  const taxSummary = useMemo(() => {
    const taxFromProjects = projects.reduce((s, p) => s + (p.tax_amount || 0), 0);
    const taxFromExpenses = expenses.reduce((s, e) => s + (e.tax_amount || 0), 0);
    return { outputTax: taxFromProjects, inputTax: taxFromExpenses, netTax: taxFromProjects - taxFromExpenses };
  }, [projects, expenses]);

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

  const generateInvoice = (project: Project) => {
    const doc = new jsPDF();
    const left = 14; const right = 196 - 14; let y = 16;
    doc.setFontSize(18); doc.text('Tax Invoice', left, y); y += 8;
    doc.setFontSize(12);
    doc.text('Axiso Green Energy', left, y); y += 6;
    doc.text(`Invoice #: INV-${project.id.slice(0, 8).toUpperCase()}`, left, y); y += 6;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, left, y); y += 10;
    doc.setFontSize(12); doc.text('Bill To:', left, y); y += 6;
    doc.text(`${project.customer_name || ''}`, left, y); y += 8;
    doc.setFontSize(12);
    doc.text('Description', left, y);
    doc.text('Amount (INR)', right, y, { align: 'right' }); y += 4;
    doc.setLineWidth(0.3); doc.line(left, y, 196, y); y += 6;

    const base = project.proposal_amount || 0;
    const discount = project.discount_amount || 0;
    const delivery = project.delivery_fee || 0;
    const tax = project.tax_amount || 0;
    const taxable = Math.max(base - discount + delivery, 0);
    const taxRate = taxable ? (tax / taxable) * 100 : 0;

    const lines: { label: string; amount: number }[] = [
      { label: `Solar Project - ${project.name}`, amount: base },
    ];
    if (discount) lines.push({ label: 'Discount', amount: -discount });
    if (delivery) lines.push({ label: 'Delivery Charges', amount: delivery });
    if (tax) lines.push({ label: `GST (${taxRate.toFixed(2)}%)`, amount: tax });

    lines.forEach((l) => {
      doc.text(l.label, left, y);
      doc.text((l.amount || 0).toLocaleString('en-IN'), right, y, { align: 'right' }); y += 6;
    });

    doc.setLineWidth(0.3); doc.line(left, y, 196, y); y += 6;
    const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
    doc.setFontSize(13);
    doc.text('Total', left, y);
    doc.text(total.toLocaleString('en-IN'), right, y, { align: 'right' }); y += 10;

    doc.setFontSize(10);
    doc.text('Terms: Due on receipt. Thank you for your business.', left, y);

    doc.save(`invoice_${project.id}.pdf`);
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
                  <Button onClick={onPaymentModalClose}>Close</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
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
