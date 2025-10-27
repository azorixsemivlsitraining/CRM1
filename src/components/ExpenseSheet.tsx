import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
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
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  Badge,
  HStack,
  VStack,
  Textarea,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';

interface Expense {
  id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  tax_amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const EXPENSE_CATEGORIES = [
  'Travel & Transportation',
  'Office Supplies',
  'Meals & Entertainment',
  'Utilities',
  'Maintenance & Repairs',
  'Software & Subscriptions',
  'Marketing & Advertising',
  'Professional Services',
  'Equipment',
  'Training & Development',
  'Other',
];

const ExpenseSheet: React.FC = () => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [formData, setFormData] = useState<{
    date: string;
    category: string;
    vendor: string;
    description: string;
    amount: number;
    tax_amount: number;
    status: 'pending' | 'approved' | 'rejected';
  }>({
    date: new Date().toISOString().split('T')[0],
    category: EXPENSE_CATEGORIES[0],
    vendor: '',
    description: '',
    amount: 0,
    tax_amount: 0,
    status: 'pending',
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching expenses:', error);
        setExpenses([]);
      } else {
        setExpenses(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.vendor.toLowerCase().includes(term) ||
          exp.description.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((exp) => exp.category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((exp) => exp.status === selectedStatus);
    }

    if (filterDateFrom) {
      filtered = filtered.filter((exp) => exp.date >= filterDateFrom);
    }

    if (filterDateTo) {
      filtered = filtered.filter((exp) => exp.date <= filterDateTo);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else {
        aVal = a.amount;
        bVal = b.amount;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [expenses, searchTerm, selectedCategory, selectedStatus, filterDateFrom, filterDateTo, sortBy, sortOrder]);

  const expenseSummary = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalTax = filteredExpenses.reduce((sum, exp) => sum + (exp.tax_amount || 0), 0);
    const approved = filteredExpenses.filter((exp) => exp.status === 'approved').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pending = filteredExpenses.filter((exp) => exp.status === 'pending').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    return { total, totalTax, approved, pending };
  }, [filteredExpenses]);

  const expensesByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    filteredExpenses.forEach((exp) => {
      const current = categoryMap.get(exp.category) || 0;
      categoryMap.set(exp.category, current + (exp.amount || 0));
    });
    return Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredExpenses]);

  const handleAddClick = () => {
    setSelectedExpense(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: EXPENSE_CATEGORIES[0],
      vendor: '',
      description: '',
      amount: 0,
      tax_amount: 0,
      status: 'pending' as 'pending' | 'approved' | 'rejected',
    });
    onOpen();
  };

  const handleEditClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      date: expense.date,
      category: expense.category,
      vendor: expense.vendor,
      description: expense.description,
      amount: expense.amount,
      tax_amount: expense.tax_amount || 0,
      status: expense.status as 'pending' | 'approved' | 'rejected',
    });
    onOpen();
  };

  const handleSave = async () => {
    if (!formData.vendor || !formData.amount) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in vendor and amount',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      if (selectedExpense) {
        // Update
        const { error } = await supabase
          .from('expenses')
          .update({
            date: formData.date,
            category: formData.category,
            vendor: formData.vendor,
            description: formData.description,
            amount: formData.amount,
            tax_amount: formData.tax_amount,
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedExpense.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Expense updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Create
        const { error } = await supabase
          .from('expenses')
          .insert({
            date: formData.date,
            category: formData.category,
            vendor: formData.vendor,
            description: formData.description,
            amount: formData.amount,
            tax_amount: formData.tax_amount,
            status: formData.status,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Expense created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }

      onClose();
      fetchExpenses();
    } catch (err) {
      console.error('Error saving expense:', err);
      toast({
        title: 'Error',
        description: 'Failed to save expense',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense approved',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchExpenses();
    } catch (err) {
      console.error('Error approving expense:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense rejected',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchExpenses();
    } catch (err) {
      console.error('Error rejecting expense:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Expenses</StatLabel>
              <StatNumber>{formatCurrency(expenseSummary.total)}</StatNumber>
              <Text fontSize="sm" color="gray.500">{filteredExpenses.length} items</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Approved</StatLabel>
              <StatNumber color="green.600">{formatCurrency(expenseSummary.approved)}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Pending Approval</StatLabel>
              <StatNumber color="orange.600">{formatCurrency(expenseSummary.pending)}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Tax Amount</StatLabel>
              <StatNumber>{formatCurrency(expenseSummary.totalTax)}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Card mb={6}>
        <CardHeader>
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <Heading size="md">Expenses by Category (Top 10)</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          {expensesByCategory.length > 0 ? (
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>Category</Th>
                    <Th isNumeric>Amount</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {expensesByCategory.map(([category, amount]) => (
                    <Tr key={category}>
                      <Td>{category}</Td>
                      <Td isNumeric fontWeight="bold">{formatCurrency(amount)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          ) : (
            <Text color="gray.500">No expenses to display</Text>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <Heading size="md">All Expenses</Heading>
            <Button colorScheme="green" size="sm" onClick={handleAddClick}>
              Add Expense
            </Button>
          </Flex>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch" mb={6}>
            <Flex gap={4} flexWrap="wrap">
              <FormControl flex={1} minW="200px">
                <Input
                  placeholder="Search by vendor or description"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </FormControl>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                maxW="200px"
              >
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                maxW="200px"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                maxW="150px"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </Select>
              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </Flex>

            <Flex gap={4} flexWrap="wrap">
              <Input
                placeholder="From Date"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                maxW="200px"
              />
              <Input
                placeholder="To Date"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                maxW="200px"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
              >
                Clear Dates
              </Button>
            </Flex>
          </VStack>

          {loading ? (
            <Text color="gray.500">Loading...</Text>
          ) : filteredExpenses.length > 0 ? (
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Category</Th>
                    <Th>Vendor</Th>
                    <Th>Description</Th>
                    <Th isNumeric>Amount</Th>
                    <Th isNumeric>Tax</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredExpenses.map((expense) => (
                    <Tr key={expense.id}>
                      <Td>{new Date(expense.date).toLocaleDateString()}</Td>
                      <Td fontSize="sm">{expense.category}</Td>
                      <Td fontWeight="medium">{expense.vendor}</Td>
                      <Td fontSize="sm">{expense.description}</Td>
                      <Td isNumeric fontWeight="bold">{formatCurrency(expense.amount)}</Td>
                      <Td isNumeric>{formatCurrency(expense.tax_amount || 0)}</Td>
                      <Td>
                        <Badge colorScheme={getStatusColor(expense.status)}>
                          {expense.status}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleEditClick(expense)}
                          >
                            <EditIcon />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(expense.id)}
                          >
                            <DeleteIcon />
                          </Button>
                          {expense.status === 'pending' && (
                            <>
                              <Button
                                size="xs"
                                colorScheme="green"
                                onClick={() => handleApprove(expense.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                colorScheme="red"
                                variant="outline"
                                onClick={() => handleReject(expense.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          ) : (
            <Text color="gray.500" textAlign="center" py={8}>
              No expenses found
            </Text>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedExpense ? 'Edit Expense' : 'Add Expense'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Category</FormLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Vendor</FormLabel>
                <Input
                  placeholder="Vendor or supplier name"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  placeholder="Expense description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Tax Amount</FormLabel>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="green" onClick={handleSave}>
              {selectedExpense ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ExpenseSheet;
