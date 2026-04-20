import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Card,
  CardHeader,
  CardBody,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  HStack,
  VStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  useToast,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

interface DailyExpense {
  id?: string;
  date: string;
  category: string;
  project_name: string;
  customer_name?: string;
  element: string;
  amount: number;
  created_at?: string;
}

interface ElementRow {
  name: string;
  amount: number;
}

const inr = (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`;
const DEFAULT_CATEGORIES = ['transportation', 'electrical', 'civil work'];

const BarChart: React.FC<{ labels: string[]; values: number[]; color?: string }> = ({ labels, values, color = 'brand.500' }) => {
  const max = Math.max(1, ...values, 0);
  return (
    <VStack align="stretch" spacing={3}>
      {labels.map((label, i) => (
        <Box key={`${label}-${i}`}>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="sm" textTransform="capitalize">{label}</Text>
            <Text fontWeight="bold" fontSize="sm">{inr(values[i] || 0)}</Text>
          </HStack>
          <Box bg="gray.100" h="18px" borderRadius="md" overflow="hidden">
            <Box bg={color} h="100%" width={`${((values[i] || 0) / max) * 100}%`} />
          </Box>
        </Box>
      ))}
    </VStack>
  );
};

const DailyExpenses: React.FC = () => {
  const toast = useToast();
  const [tabIndex, setTabIndex] = useState(0);
  const [reportTabIndex, setReportTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DailyExpense[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<'preset' | 'other'>('preset');
  const [otherCategory, setOtherCategory] = useState('');
  const [elements, setElements] = useState<ElementRow[]>([{ name: '', amount: 0 }]);
  const [form, setForm] = useState<DailyExpense>({
    date: new Date().toISOString().split('T')[0],
    category: 'civil work',
    project_name: '',
    customer_name: '',
    element: '',
    amount: 0,
  });

  const fetchRows = async () => {
    const { data, error } = await supabase.from('daily_expenses').select('*').order('date', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000, isClosable: true });
      return;
    }
    setRows((data || []) as DailyExpense[]);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeklyTotals = useMemo(() => {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const out: Record<string, number> = {};
    rows.filter((r) => new Date(r.date) >= from).forEach((r) => {
      const k = String(r.category || 'other').toLowerCase();
      out[k] = (out[k] || 0) + (Number(r.amount) || 0);
    });
    return out;
  }, [rows]);

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const out: Record<string, number> = {};
    rows.filter((r) => new Date(r.date) >= monthStart).forEach((r) => {
      const k = String(r.category || 'other').toLowerCase();
      out[k] = (out[k] || 0) + (Number(r.amount) || 0);
    });
    return out;
  }, [rows]);

  const handleSave = async () => {
    const cleaned = elements
      .map((e) => ({ name: String(e.name || '').trim(), amount: Number(e.amount || 0) }))
      .filter((e) => e.name && e.amount > 0);
    const total = cleaned.reduce((s, e) => s + e.amount, 0);
    const category = categoryMode === 'other' ? String(otherCategory || '').trim().toLowerCase() : form.category;
    const elementSummary = cleaned.map((e) => `${e.name} (₹${e.amount})`).join(', ');

    if (!form.date || !category || !form.project_name || cleaned.length === 0 || total <= 0) {
      toast({ title: 'Missing fields', description: 'Fill required fields and add at least one element.', status: 'warning', duration: 2500, isClosable: true });
      return;
    }

    setLoading(true);
    let error: any = null;
    if (editingId) {
      const res = await supabase
        .from('daily_expenses')
        .update({
          date: form.date,
          category,
          project_name: form.project_name,
          customer_name: form.customer_name || null,
          element: elementSummary,
          amount: total,
        })
        .eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('daily_expenses').insert([{
        date: form.date,
        category,
        project_name: form.project_name,
        customer_name: form.customer_name || null,
        element: elementSummary,
        amount: total,
      }]);
      error = res.error;
    }
    setLoading(false);

    if (error) {
      toast({ title: 'Save failed', description: error.message, status: 'error', duration: 3000, isClosable: true });
      return;
    }

    toast({
      title: editingId ? 'Updated' : 'Saved',
      description: editingId ? 'Daily expense updated successfully.' : 'Daily expense added successfully.',
      status: 'success',
      duration: 2500,
      isClosable: true,
    });
    setForm({
      date: new Date().toISOString().split('T')[0],
      category: 'civil work',
      project_name: '',
      customer_name: '',
      element: '',
      amount: 0,
    });
    setElements([{ name: '', amount: 0 }]);
    setCategoryMode('preset');
    setOtherCategory('');
    setEditingId(null);
    await fetchRows();
    setTabIndex(1);
  };

  const parseElementsFromSummary = (summary: string): ElementRow[] => {
    const parts = String(summary || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const parsed = parts.map((part) => {
      const match = part.match(/^(.*)\s+\(₹([\d.,]+)\)$/);
      if (!match) return { name: part, amount: 0 };
      return {
        name: match[1].trim(),
        amount: parseFloat(match[2].replace(/,/g, '')) || 0,
      };
    });
    return parsed.length > 0 ? parsed : [{ name: '', amount: 0 }];
  };

  const handleEdit = (row: DailyExpense) => {
    const cat = String(row.category || '').toLowerCase();
    const isPreset = DEFAULT_CATEGORIES.includes(cat);
    setEditingId(row.id || null);
    setCategoryMode(isPreset ? 'preset' : 'other');
    setOtherCategory(isPreset ? '' : cat);
    setForm({
      date: row.date,
      category: isPreset ? cat : 'civil work',
      project_name: row.project_name,
      customer_name: row.customer_name || '',
      element: row.element,
      amount: row.amount,
      id: row.id,
    });
    setElements(parseElementsFromSummary(row.element));
    setTabIndex(0);
  };

  const handleDelete = async (rowId?: string) => {
    if (!rowId) return;
    const ok = window.confirm('Delete this daily expense?');
    if (!ok) return;
    const { error } = await supabase.from('daily_expenses').delete().eq('id', rowId);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, status: 'error', duration: 3000, isClosable: true });
      return;
    }
    toast({ title: 'Deleted', description: 'Daily expense removed.', status: 'success', duration: 2000, isClosable: true });
    await fetchRows();
  };

  return (
    <Box>
      <Heading size="lg" mb={4}>Daily Expenses</Heading>
      <Card>
        <CardBody>
          <Tabs colorScheme="brand" variant="enclosed" index={tabIndex} onChange={setTabIndex}>
            <TabList mb={4}>
              <Tab>Expense Sheet Form</Tab>
              <Tab>Daily Expenses Records</Tab>
              <Tab>Expense Reports</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Card bg="gray.50">
                  <CardHeader><Heading size="sm">Daily Expense Sheet Form</Heading></CardHeader>
                  <CardBody>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>Date</FormLabel>
                        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Category</FormLabel>
                        <VStack align="stretch">
                          <Select
                            value={categoryMode === 'other' ? '__other__' : form.category}
                            onChange={(e) => {
                              if (e.target.value === '__other__') setCategoryMode('other');
                              else {
                                setCategoryMode('preset');
                                setForm({ ...form, category: e.target.value });
                              }
                            }}
                          >
                            {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value="__other__">Other Category</option>
                          </Select>
                          {categoryMode === 'other' && (
                            <Input placeholder="Enter custom category" value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} />
                          )}
                        </VStack>
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Project / Customer Name</FormLabel>
                        <Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Customer Name</FormLabel>
                        <Input value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                      </FormControl>
                      <Box w="100%">
                        <FormLabel>Elements and Amounts</FormLabel>
                        <VStack align="stretch" spacing={3}>
                          {elements.map((el, idx) => (
                            <HStack key={`el-${idx}`} align="flex-end">
                              <FormControl isRequired>
                                <FormLabel fontSize="xs">Element</FormLabel>
                                <Input
                                  value={el.name}
                                  onChange={(e) => {
                                    const next = [...elements];
                                    next[idx] = { ...next[idx], name: e.target.value };
                                    setElements(next);
                                  }}
                                />
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel fontSize="xs">Amount</FormLabel>
                                <Input
                                  type="number"
                                  min="0"
                                  value={el.amount}
                                  onChange={(e) => {
                                    const next = [...elements];
                                    next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 };
                                    setElements(next);
                                  }}
                                />
                              </FormControl>
                              <Button
                                size="sm"
                                variant="outline"
                                colorScheme="red"
                                isDisabled={elements.length === 1}
                                onClick={() => setElements(elements.filter((_, i) => i !== idx))}
                              >
                                Remove
                              </Button>
                            </HStack>
                          ))}
                          <HStack justify="space-between">
                            <Button size="sm" variant="outline" onClick={() => setElements([...elements, { name: '', amount: 0 }])}>
                              + Add Element
                            </Button>
                            <Text fontWeight="bold">Total: {inr(elements.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</Text>
                          </HStack>
                        </VStack>
                      </Box>
                      <HStack w="100%">
                        <Button colorScheme="brand" flex={1} onClick={handleSave} isLoading={loading}>
                          {editingId ? 'Update Daily Expense' : 'Save Daily Expense'}
                        </Button>
                        {editingId && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setCategoryMode('preset');
                              setOtherCategory('');
                              setElements([{ name: '', amount: 0 }]);
                              setForm({
                                date: new Date().toISOString().split('T')[0],
                                category: 'civil work',
                                project_name: '',
                                customer_name: '',
                                element: '',
                                amount: 0,
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </TabPanel>
              <TabPanel>
                <Card>
                  <CardHeader><Heading size="sm">Saved Daily Expenses</Heading></CardHeader>
                  <CardBody>
                    <TableContainer>
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Date</Th>
                            <Th>Category</Th>
                            <Th>Project / Customer</Th>
                            <Th>Customer</Th>
                            <Th>Elements</Th>
                            <Th isNumeric>Amount (₹)</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {rows.map((r) => (
                            <Tr key={r.id}>
                              <Td>{r.date}</Td>
                              <Td><Badge colorScheme="purple">{r.category}</Badge></Td>
                              <Td>{r.project_name}</Td>
                              <Td>{r.customer_name || '-'}</Td>
                              <Td maxW="360px" whiteSpace="normal">{r.element}</Td>
                              <Td isNumeric>{inr(r.amount)}</Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Button size="xs" colorScheme="blue" variant="outline" onClick={() => handleEdit(r)}>
                                    Edit
                                  </Button>
                                  <Button size="xs" colorScheme="red" variant="outline" onClick={() => handleDelete(r.id)}>
                                    Delete
                                  </Button>
                                </HStack>
                              </Td>
                            </Tr>
                          ))}
                          {rows.length === 0 && (
                            <Tr><Td colSpan={7} textAlign="center">No daily expenses found</Td></Tr>
                          )}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </CardBody>
                </Card>
              </TabPanel>
              <TabPanel>
                <Tabs variant="soft-rounded" colorScheme="brand" index={reportTabIndex} onChange={setReportTabIndex}>
                  <TabList mb={4}>
                    <Tab>Weekly Report</Tab>
                    <Tab>Monthly Report</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel px={0}>
                      <Card>
                        <CardHeader><Heading size="sm">Weekly Category Expense Graph</Heading></CardHeader>
                        <CardBody>
                          {Object.keys(weeklyTotals).length > 0 ? (
                            <BarChart labels={Object.keys(weeklyTotals)} values={Object.values(weeklyTotals)} color="brand.400" />
                          ) : <Text fontSize="sm" color="gray.500">No weekly data available</Text>}
                        </CardBody>
                      </Card>
                    </TabPanel>
                    <TabPanel px={0}>
                      <Card>
                        <CardHeader><Heading size="sm">Monthly Category Expense Graph</Heading></CardHeader>
                        <CardBody>
                          {Object.keys(monthlyTotals).length > 0 ? (
                            <BarChart labels={Object.keys(monthlyTotals)} values={Object.values(monthlyTotals)} color="green.400" />
                          ) : <Text fontSize="sm" color="gray.500">No monthly data available</Text>}
                        </CardBody>
                      </Card>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </CardBody>
      </Card>
    </Box>
  );
};

export default DailyExpenses;

