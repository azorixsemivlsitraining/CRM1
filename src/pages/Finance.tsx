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
  Input,
  Button,
  useToast,
  HStack,
  SimpleGrid,
  Divider,
} from '@chakra-ui/react';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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
  tax_amount?: number;
  discount_amount?: number;
  delivery_fee?: number;
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

const Finance: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<(PaymentRec & { project_name?: string; customer_name?: string; state?: string })[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRec[]>([]);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  const { isFinance, isAuthenticated, isAdmin } = useAuth();
  const toast = useToast();

  const authorized = isAuthenticated && (isFinance || isAdmin);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    if (period === 'monthly') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return null;
  }, [period]);

  useEffect(() => {
    if (!authorized) return;
    const fetchAll = async () => {
      try {
        setLoading(true);

        // Projects
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

        // Payments
        let paymentsData: PaymentRec[] = [];
        try {
          const { data: payTry, error: payErr } = await supabase
            .from('payments')
            .select('id, created_at, amount, status, order_id, payment_id, project_id')
            .order('created_at', { ascending: false });
          if (payErr) throw payErr;
          paymentsData = (payTry || []) as any;
        } catch (e: any) {
          // Missing table or not configured
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

        // Expenses
        let expensesData: ExpenseRec[] = [];
        try {
          const { data: expTry, error: expErr } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });
          if (expErr) throw expErr;
          expensesData = (expTry || []) as any;
        } catch (e: any) {
          expensesData = [];
        }
        setExpenses(expensesData);
      } catch (error) {
        console.error('Error fetching finance data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch financial data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
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

  // Aggregations
  const totalOutstanding = useMemo(() =>
    projects.reduce((sum, p) => sum + (p.balance_amount || 0), 0),
    [projects]
  );

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
    // Use explicit tax fields if present; otherwise zero
    const taxFromProjects = projects.reduce((s, p) => s + (p.tax_amount || 0), 0);
    const taxFromExpenses = expenses.reduce((s, e) => s + (e.tax_amount || 0), 0);
    return { outputTax: taxFromProjects, inputTax: taxFromExpenses, netTax: taxFromProjects - taxFromExpenses };
  }, [projects, expenses]);

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

  const exportTaxCsv = () => {
    const rows = [
      { metric: 'Output Tax (Sales)', amount: taxSummary.outputTax },
      { metric: 'Input Tax (Expenses)', amount: taxSummary.inputTax },
      { metric: 'Net Tax Payable', amount: taxSummary.netTax },
    ];
    download(makeCsv(rows), `tax_summary_${period}.csv`);
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
      if (y > 280) {
        doc.addPage();
        y = 14;
      }
      doc.text(row, 14, y);
      y += 6;
    });
    doc.save('receivables.pdf');
  };

  const generateInvoice = (project: Project) => {
    const doc = new jsPDF();
    const left = 14;
    let y = 16;

    doc.setFontSize(16);
    doc.text('Tax Invoice', left, y);
    y += 10;

    doc.setFontSize(12);
    doc.text('Axiso Green Energy', left, y); y += 6;
    doc.text(`Invoice #: INV-${project.id.slice(0, 8).toUpperCase()}`, left, y); y += 6;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, left, y); y += 10;

    doc.text('Bill To:', left, y); y += 6;
    doc.text(`${project.customer_name || ''}`, left, y); y += 10;

    doc.setFontSize(12);
    doc.text('Description', left, y);
    doc.text('Amount (INR)', 160, y, { align: 'right' });
    y += 6;
    doc.setLineWidth(0.2);
    doc.line(left, y, 196, y);
    y += 6;

    const baseAmount = project.proposal_amount || 0;
    const discount = project.discount_amount || 0;
    const delivery = project.delivery_fee || 0;
    const tax = project.tax_amount || 0;

    const lines = [
      { label: `Solar Project - ${project.name}`, amount: baseAmount },
    ];
    if (discount) lines.push({ label: 'Discount', amount: -discount });
    if (delivery) lines.push({ label: 'Delivery Charges', amount: delivery });
    if (tax) lines.push({ label: 'GST', amount: tax });

    lines.forEach((l) => {
      doc.text(l.label, left, y);
      doc.text((l.amount || 0).toLocaleString('en-IN'), 160, y, { align: 'right' });
      y += 6;
    });

    doc.line(left, y, 196, y); y += 6;
    const total = lines.reduce((s, l) => s + (l.amount || 0), 0);
    doc.setFontSize(13);
    doc.text('Total', left, y);
    doc.text(total.toLocaleString('en-IN'), 160, y, { align: 'right' });

    doc.save(`invoice_${project.id}.pdf`);
  };

  return (
    <Box p={6} maxW="1400px" mx="auto">
      <Heading as="h1" size="xl" mb={6}>
        Finance Dashboard
      </Heading>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Outstanding Amount</StatLabel>
              <StatNumber>{inr(totalOutstanding)}</StatNumber>
              <Text fontSize="sm" color="gray.500">From all projects</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Expected This Month</StatLabel>
              <StatNumber>{inr(expectedThisMonth)}</StatNumber>
              <Text fontSize="sm" color="gray.500">Based on 45-day collection timeframe</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active Projects</StatLabel>
              <StatNumber>{activeProjectsCount}</StatNumber>
              <Text fontSize="sm" color="gray.500">With outstanding payments</Text>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

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
            </HStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={4}>
            <Stat>
              <StatLabel>Revenue ({period === 'all' ? 'All' : 'Period'})</StatLabel>
              <StatNumber>{inr(period === 'all' ? totalRevenueAll : totalRevenuePeriod)}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Expenses ({period === 'all' ? 'All' : 'Period'})</StatLabel>
              <StatNumber>{inr(period === 'all' ? totalExpensesAll : totalExpensesPeriod)}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Profit ({period === 'all' ? 'All' : 'Period'})</StatLabel>
              <StatNumber color={(period === 'all' ? profitAll : profitPeriod) >= 0 ? 'green.600' : 'red.600'}>
                {inr(period === 'all' ? profitAll : profitPeriod)}
              </StatNumber>
            </Stat>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Card>
              <CardHeader><Heading size="sm">Top Performing Products/Projects</Heading></CardHeader>
              <CardBody>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Project</Th>
                      <Th isNumeric>Revenue</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {topProducts.map(([name, amt]) => (
                      <Tr key={name}>
                        <Td>{name}</Td>
                        <Td isNumeric>{inr(amt)}</Td>
                      </Tr>
                    ))}
                    {topProducts.length === 0 && (
                      <Tr><Td colSpan={2} textAlign="center">No data</Td></Tr>
                    )}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><Heading size="sm">Region-wise Revenue</Heading></CardHeader>
              <CardBody>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Region</Th>
                      <Th isNumeric>Revenue</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {revenueByRegion.map(([region, amt]) => (
                      <Tr key={region}>
                        <Td>{region}</Td>
                        <Td isNumeric>{inr(amt)}</Td>
                      </Tr>
                    ))}
                    {revenueByRegion.length === 0 && (
                      <Tr><Td colSpan={2} textAlign="center">No data</Td></Tr>
                    )}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </SimpleGrid>
        </CardBody>
      </Card>

      <Card mb={6}>
        <CardHeader>
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <Heading size="md">Expense Management</Heading>
            <HStack>
              <Button size="sm" onClick={exportExpensesCsv}>Export Expenses CSV</Button>
            </HStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Vendor</Th>
                <Th>Description</Th>
                <Th isNumeric>Amount</Th>
              </Tr>
            </Thead>
            <Tbody>
              {periodExpenses.slice(0, 10).map((e) => (
                <Tr key={e.id}>
                  <Td>{new Date(e.date || e.created_at || '').toLocaleDateString()}</Td>
                  <Td>{e.category || '-'}</Td>
                  <Td>{e.vendor || '-'}</Td>
                  <Td>{e.description || '-'}</Td>
                  <Td isNumeric>{inr(e.amount || 0)}</Td>
                </Tr>
              ))}
              {periodExpenses.length === 0 && (
                <Tr><Td colSpan={5} textAlign="center">No expenses found</Td></Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <Card mb={6}>
        <CardHeader>
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <Heading size="md">Reports & Export</Heading>
            <HStack>
              <Button size="sm" onClick={exportPnLCsv}>Export P&L CSV</Button>
              <Button size="sm" onClick={exportTaxCsv}>Export Tax Summary CSV</Button>
              <Button size="sm" onClick={exportReceivablesPdf}>Download Receivables PDF</Button>
            </HStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <Stat>
              <StatLabel>Output Tax (Sales)</StatLabel>
              <StatNumber>{inr(taxSummary.outputTax)}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Input Tax (Expenses)</StatLabel>
              <StatNumber>{inr(taxSummary.inputTax)}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Net Tax Payable</StatLabel>
              <StatNumber color={taxSummary.netTax >= 0 ? 'red.600' : 'green.600'}>{inr(taxSummary.netTax)}</StatNumber>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      <Flex mb={6} justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={4}>
        <HStack>
          <Button 
            colorScheme={filter === 'all' ? 'blue' : 'gray'} 
            onClick={() => setFilter('all')}
          >
            All Projects
          </Button>
          <Button 
            colorScheme={filter === 'active' ? 'blue' : 'gray'} 
            onClick={() => setFilter('active')}
          >
            Active Projects
          </Button>
          <Button 
            colorScheme={filter === 'completed' ? 'blue' : 'gray'} 
            onClick={() => setFilter('completed')}
          >
            Completed Projects
          </Button>
        </HStack>
        <FormControl maxW="300px">
          <Input
            placeholder="Search by name or customer"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </FormControl>
      </Flex>

      <Card>
        <CardHeader>
          <Heading size="md">Projects Receivables</Heading>
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
                  <Td fontWeight="bold" color={(project.balance_amount || 0) > 0 ? 'red.500' : 'green.500'}>
                    {inr(project.balance_amount || 0)}
                  </Td>
                  <Td>
                    <Badge colorScheme={project.payment_mode === 'Loan' ? 'purple' : 'blue'}>
                      {project.payment_mode}
                    </Badge>
                  </Td>
                  <Td>{project.current_stage}</Td>
                  <Td>
                    <Badge colorScheme={project.status === 'active' ? 'green' : 'gray'}>
                      {project.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Button size="xs" variant="outline" onClick={() => generateInvoice(project)}>Invoice</Button>
                  </Td>
                </Tr>
              ))}
              {filteredProjects.length === 0 && (
                <Tr>
                  <Td colSpan={9} textAlign="center" py={4}>
                    {loading ? 'Loading...' : 'No projects found'}
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    </Box>
  );
};

export default Finance;
