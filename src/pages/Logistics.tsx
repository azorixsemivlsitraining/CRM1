import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  HStack,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  Alert,
  AlertIcon,
  Text,
  Card,
  CardBody,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Select,
  Grid,
  SimpleGrid,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';

interface LogisticsRecord {
  id: string;
  date: string;
  item: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: string;
  reference?: string;
  vehicle?: string;
  expected_date?: string;
  notes?: string;
  tracking_no?: string;
  updated_at?: string;
}

interface Dealer {
  id: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  business_type: string;
  registration_date: string;
  status: 'Active' | 'Inactive' | 'Pending';
  updated_at?: string;
}

interface Partner {
  id: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  location: string;
  bulk_order_id?: string;
  distribution_area: string;
  partnership_date: string;
  status: 'Active' | 'Inactive' | 'Pending';
  updated_at?: string;
}

interface BulkOrder {
  id: string;
  partner_id: string;
  partner_name: string;
  product: string;
  quantity: number;
  order_date: string;
  delivery_date: string;
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';
  notes?: string;
  updated_at?: string;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const LogisticsMetrics = () => {
  const [metrics, setMetrics] = useState({
    deliverySuccessRate: 94,
    avgDeliveryTime: 3.2,
    inventoryTurnover: 12.5,
    totalDeliveries: 1250,
    activePartners: 45,
    totalDealers: 89,
  });

  const deliveryTrendData = [
    { week: 'Week 1', success: 90, failed: 10 },
    { week: 'Week 2', success: 92, failed: 8 },
    { week: 'Week 3', success: 95, failed: 5 },
    { week: 'Week 4', success: 94, failed: 6 },
    { week: 'Week 5', success: 96, failed: 4 },
  ];

  const inventoryTrendData = [
    { month: 'Jan', turnover: 10.5 },
    { month: 'Feb', turnover: 11.2 },
    { month: 'Mar', turnover: 12.0 },
    { month: 'Apr', turnover: 12.5 },
    { month: 'May', turnover: 13.1 },
  ];

  const statusDistributionData = [
    { name: 'Delivered', value: 65 },
    { name: 'Pending', value: 20 },
    { name: 'In Transit', value: 12 },
    { name: 'Cancelled', value: 3 },
  ];

  const AnimatedCounter = ({ end, label, unit = '' }: { end: number; label: string; unit?: string }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
      let current = 0;
      const increment = end / 20;
      const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current * 10) / 10);
        }
      }, 30);
      return () => clearInterval(timer);
    }, [end]);

    return (
      <Card>
        <CardBody>
          <VStack spacing={2} align="stretch">
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              {label}
            </Text>
            <Heading size="xl" color="green.600">
              {count.toFixed(1)}{unit}
            </Heading>
          </VStack>
        </CardBody>
      </Card>
    );
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="md">Performance Metrics & KPIs</Heading>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
        <AnimatedCounter end={metrics.deliverySuccessRate} label="Delivery Success Rate" unit="%" />
        <AnimatedCounter end={metrics.avgDeliveryTime} label="Avg Delivery Time (Days)" unit="" />
        <AnimatedCounter end={metrics.inventoryTurnover} label="Inventory Turnover Rate" unit="x" />
        <AnimatedCounter end={metrics.totalDeliveries} label="Total Deliveries" unit="" />
        <AnimatedCounter end={metrics.activePartners} label="Active Partners" unit="" />
        <AnimatedCounter end={metrics.totalDealers} label="Total Dealers" unit="" />
      </SimpleGrid>

      <Heading size="md" mt={6}>
        Delivery Performance Trend
      </Heading>
      <Card>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deliveryTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" fill="#10b981" name="Successful" />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Heading size="md">Inventory Turnover Trend</Heading>
      <Card>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={inventoryTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="turnover"
                stroke="#10b981"
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Heading size="md">Order Status Distribution</Heading>
      <Card>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </VStack>
  );
};

const DistributionNetworkTab = () => {
  const [locations, setLocations] = useState([
    {
      id: '1',
      location: 'New Delhi',
      region: 'North',
      lat: 28.7041,
      lng: 77.1025,
      capacity: 500,
      currentStock: 350,
      status: 'Active',
    },
    {
      id: '2',
      location: 'Mumbai',
      region: 'West',
      lat: 19.0760,
      lng: 72.8777,
      capacity: 600,
      currentStock: 420,
      status: 'Active',
    },
    {
      id: '3',
      location: 'Bangalore',
      region: 'South',
      lat: 12.9716,
      lng: 77.5946,
      capacity: 550,
      currentStock: 380,
      status: 'Active',
    },
    {
      id: '4',
      location: 'Kolkata',
      region: 'East',
      lat: 22.5726,
      lng: 88.3639,
      capacity: 400,
      currentStock: 290,
      status: 'Active',
    },
  ]);

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="md">National Distribution Network</Heading>
      <Alert status="info">
        <AlertIcon />
        <Text>Distribution network spans across 4 major regions with centralized warehouse management.</Text>
      </Alert>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {locations.map((loc) => (
          <Card key={loc.id} borderLeft="4px" borderLeftColor="green.500">
            <CardBody>
              <VStack align="stretch" spacing={3}>
                <Heading size="sm">{loc.location}</Heading>
                <HStack justify="space-between">
                  <Badge colorScheme="green">{loc.region}</Badge>
                  <Badge colorScheme="blue">{loc.status}</Badge>
                </HStack>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Capacity: {loc.capacity} units
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Current Stock: {loc.currentStock} units
                  </Text>
                  <Box mt={2} bg="gray.100" borderRadius="md" h="4px" overflow="hidden">
                    <Box
                      bg="green.500"
                      h="100%"
                      w={`${(loc.currentStock / loc.capacity) * 100}%`}
                      transition="width 0.3s"
                    />
                  </Box>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {Math.round((loc.currentStock / loc.capacity) * 100)}% capacity used
                  </Text>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      <Heading size="md" mt={6}>
        Distribution Coverage Map
      </Heading>
      <Card>
        <CardBody>
          <Box
            bg="gray.50"
            borderRadius="md"
            p={6}
            textAlign="center"
            minH="400px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderWidth="1px"
            borderColor="gray.200"
          >
            <VStack spacing={4}>
              <Text fontSize="lg" fontWeight="bold" color="gray.600">
                National Distribution Network Map
              </Text>
              <Grid templateColumns="repeat(4, 1fr)" gap={4} w="full">
                {locations.map((loc) => (
                  <Box key={loc.id} textAlign="center">
                    <Box
                      w="60px"
                      h="60px"
                      borderRadius="full"
                      bg="green.100"
                      mx="auto"
                      mb={2}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="2xl"
                    >
                      📍
                    </Box>
                    <Text fontSize="sm" fontWeight="bold">
                      {loc.location}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {loc.region}
                    </Text>
                  </Box>
                ))}
              </Grid>
              <Text fontSize="xs" color="gray.500" mt={4}>
                Integrated logistics network providing nationwide coverage and fast delivery
              </Text>
            </VStack>
          </Box>
        </CardBody>
      </Card>
    </VStack>
  );
};

const PartnerPortalTab = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { isOpen: isPartnerOpen, onOpen: onPartnerOpen, onClose: onPartnerClose } = useDisclosure();
  const { isOpen: isOrderOpen, onOpen: onOrderOpen, onClose: onOrderClose } = useDisclosure();
  const [tableMissing, setTableMissing] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    business_name: '',
    contact_person: '',
    email: '',
    phone: '',
    location: '',
    distribution_area: '',
    partnership_date: new Date().toISOString().split('T')[0],
    status: 'Active' as const,
  });

  const [orderFormData, setOrderFormData] = useState({
    id: '',
    partner_id: '',
    partner_name: '',
    product: '',
    quantity: 1,
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    status: 'Pending' as const,
    notes: '',
  });

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('partnership_date', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') {
          setTableMissing(true);
          return;
        }
        throw error;
      }
      setPartners((data as Partner[]) || []);
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Failed to load partners', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  const fetchBulkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('bulk_orders')
        .select('*')
        .order('order_date', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') return;
        throw error;
      }
      setBulkOrders((data as BulkOrder[]) || []);
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Failed to load orders', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  const handleSavePartner = async () => {
    try {
      if (!formData.business_name.trim() || !formData.contact_person.trim() || !formData.email.trim()) {
        toast({ title: 'Missing fields', description: 'Fill required fields', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);

      if (formData.id) {
        const { error } = await supabase
          .from('partners')
          .update(formData)
          .eq('id', formData.id);
        if (error) throw error;
        setPartners(partners.map(p => (p.id === formData.id ? (formData as Partner) : p)));
        toast({ title: 'Partner updated', status: 'success', duration: 2000, isClosable: true });
      } else {
        const { data, error } = await supabase
          .from('partners')
          .insert([formData])
          .select('*');
        if (error) throw new Error(error.message || 'Failed to add partner');
        setPartners([...(data as Partner[]), ...partners]);
        toast({ title: 'Partner added', status: 'success', duration: 2000, isClosable: true });
      }

      setFormData({
        id: '',
        business_name: '',
        contact_person: '',
        email: '',
        phone: '',
        location: '',
        distribution_area: '',
        partnership_date: new Date().toISOString().split('T')[0],
        status: 'Active',
      });
      onPartnerClose();
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrder = async () => {
    try {
      if (!orderFormData.partner_id || !orderFormData.product.trim() || orderFormData.quantity <= 0) {
        toast({ title: 'Missing fields', description: 'Fill all order details', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);

      if (orderFormData.id) {
        const { error } = await supabase
          .from('bulk_orders')
          .update(orderFormData)
          .eq('id', orderFormData.id);
        if (error) throw error;
        setBulkOrders(bulkOrders.map(o => (o.id === orderFormData.id ? (orderFormData as BulkOrder) : o)));
        toast({ title: 'Order updated', status: 'success', duration: 2000, isClosable: true });
      } else {
        const { data, error } = await supabase
          .from('bulk_orders')
          .insert([orderFormData])
          .select('*');
        if (error) throw new Error(error.message || 'Failed to create order');
        setBulkOrders([...(data as BulkOrder[]), ...bulkOrders]);
        toast({ title: 'Order created', status: 'success', duration: 2000, isClosable: true });
      }

      setOrderFormData({
        id: '',
        partner_id: '',
        partner_name: '',
        product: '',
        quantity: 1,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        status: 'Pending',
        notes: '',
      });
      onOrderClose();
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const deletePartner = async (id: string) => {
    try {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed to delete partner');
      setPartners(partners.filter(p => p.id !== id));
      toast({ title: 'Partner deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      const { error } = await supabase.from('bulk_orders').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed to delete order');
      setBulkOrders(bulkOrders.filter(o => o.id !== id));
      toast({ title: 'Order deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchBulkOrders();
  }, [toast]);

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Text>Tables "partners" or "bulk_orders" not found. Create them in Supabase to enable partner management.</Text>
      </Alert>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="md" mb={4}>
          Partner/Distributor Management
        </Heading>
        <Button colorScheme="green" onClick={onPartnerOpen}>
          Add Partner
        </Button>
      </Box>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Business Name</Th>
            <Th>Contact Person</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Location</Th>
            <Th>Distribution Area</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {partners.map(partner => (
            <Tr key={partner.id}>
              <Td fontWeight="semibold">{partner.business_name}</Td>
              <Td>{partner.contact_person}</Td>
              <Td>{partner.email}</Td>
              <Td>{partner.phone}</Td>
              <Td>{partner.location}</Td>
              <Td>{partner.distribution_area}</Td>
              <Td>
                <Badge colorScheme={partner.status === 'Active' ? 'green' : 'gray'}>
                  {partner.status}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Edit partner"
                    icon={<EditIcon />}
                    size="sm"
                    onClick={() => {
                      setFormData(partner);
                      onPartnerOpen();
                    }}
                  />
                  <IconButton
                    aria-label="Delete partner"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="red"
                    onClick={() => deletePartner(partner.id)}
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box>
        <Heading size="md" mb={4}>
          Bulk Orders
        </Heading>
        <Button colorScheme="green" onClick={onOrderOpen}>
          Create Order
        </Button>
      </Box>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Partner Name</Th>
            <Th>Product</Th>
            <Th>Quantity</Th>
            <Th>Order Date</Th>
            <Th>Delivery Date</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {bulkOrders.map(order => (
            <Tr key={order.id}>
              <Td fontWeight="semibold">{order.partner_name}</Td>
              <Td>{order.product}</Td>
              <Td>{order.quantity}</Td>
              <Td>{new Date(order.order_date).toLocaleDateString()}</Td>
              <Td>{new Date(order.delivery_date).toLocaleDateString()}</Td>
              <Td>
                <Badge colorScheme={order.status === 'Delivered' ? 'green' : order.status === 'Shipped' ? 'blue' : 'yellow'}>
                  {order.status}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Edit order"
                    icon={<EditIcon />}
                    size="sm"
                    onClick={() => {
                      setOrderFormData(order);
                      onOrderOpen();
                    }}
                  />
                  <IconButton
                    aria-label="Delete order"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="red"
                    onClick={() => deleteOrder(order.id)}
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={isPartnerOpen} onClose={onPartnerClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{formData.id ? 'Edit Partner' : 'Add Partner'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Business Name *</FormLabel>
                <Input
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  placeholder="Enter business name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Contact Person *</FormLabel>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Enter contact person name"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Email *</FormLabel>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Phone</FormLabel>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Location</FormLabel>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Distribution Area</FormLabel>
                <Input
                  value={formData.distribution_area}
                  onChange={(e) => setFormData({ ...formData, distribution_area: e.target.value })}
                  placeholder="Enter distribution area"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Pending">Pending</option>
                </Select>
              </FormControl>
              <HStack justify="flex-end" pt={4}>
                <Button variant="ghost" onClick={onPartnerClose}>
                  Cancel
                </Button>
                <Button colorScheme="green" onClick={handleSavePartner} isLoading={loading}>
                  Save
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOrderOpen} onClose={onOrderClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{orderFormData.id ? 'Edit Order' : 'Create Bulk Order'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Partner *</FormLabel>
                <Select
                  value={orderFormData.partner_id}
                  onChange={(e) => {
                    const partner = partners.find(p => p.id === e.target.value);
                    setOrderFormData({
                      ...orderFormData,
                      partner_id: e.target.value,
                      partner_name: partner?.business_name || '',
                    });
                  }}
                  placeholder="Select partner"
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.business_name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Product *</FormLabel>
                <Input
                  value={orderFormData.product}
                  onChange={(e) => setOrderFormData({ ...orderFormData, product: e.target.value })}
                  placeholder="Enter product"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Quantity *</FormLabel>
                <Input
                  type="number"
                  value={orderFormData.quantity}
                  onChange={(e) => setOrderFormData({ ...orderFormData, quantity: Math.max(1, Number(e.target.value)) })}
                  min="1"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Order Date</FormLabel>
                <Input
                  type="date"
                  value={orderFormData.order_date}
                  onChange={(e) => setOrderFormData({ ...orderFormData, order_date: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Delivery Date</FormLabel>
                <Input
                  type="date"
                  value={orderFormData.delivery_date}
                  onChange={(e) => setOrderFormData({ ...orderFormData, delivery_date: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={orderFormData.status}
                  onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value as any })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Notes</FormLabel>
                <Input
                  value={orderFormData.notes || ''}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  placeholder="Enter notes"
                />
              </FormControl>
              <HStack justify="flex-end" pt={4}>
                <Button variant="ghost" onClick={onOrderClose}>
                  Cancel
                </Button>
                <Button colorScheme="green" onClick={handleSaveOrder} isLoading={loading}>
                  Save
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

const DealerRegistrationTab = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [tableMissing, setTableMissing] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    business_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    business_type: '',
    registration_date: new Date().toISOString().split('T')[0],
    status: 'Pending' as const,
  });

  const fetchDealers = async () => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .order('registration_date', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') {
          setTableMissing(true);
          return;
        }
        throw new Error(error.message || 'Failed to fetch dealers');
      }
      setDealers((data as Dealer[]) || []);
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Failed to load dealers', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  const handleSaveDealer = async () => {
    try {
      if (!formData.business_name.trim() || !formData.contact_person.trim() || !formData.email.trim()) {
        toast({ title: 'Missing fields', description: 'Fill required fields', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);

      if (formData.id) {
        const { error } = await supabase
          .from('dealers')
          .update(formData)
          .eq('id', formData.id);
        if (error) throw new Error(error.message || 'Failed to update dealer');
        setDealers(dealers.map(d => (d.id === formData.id ? (formData as Dealer) : d)));
        toast({ title: 'Dealer updated', status: 'success', duration: 2000, isClosable: true });
      } else {
        const { data, error } = await supabase
          .from('dealers')
          .insert([formData])
          .select('*');
        if (error) throw new Error(error.message || 'Failed to register dealer');
        setDealers([...(data as Dealer[]), ...dealers]);
        toast({ title: 'Dealer registered', status: 'success', duration: 2000, isClosable: true });
      }

      setFormData({
        id: '',
        business_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        business_type: '',
        registration_date: new Date().toISOString().split('T')[0],
        status: 'Pending',
      });
      onClose();
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const deleteDealer = async (id: string) => {
    try {
      const { error } = await supabase.from('dealers').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed to delete dealer');
      setDealers(dealers.filter(d => d.id !== id));
      toast({ title: 'Dealer deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: errorMsg, status: 'error', duration: 4000, isClosable: true });
    }
  };

  useEffect(() => {
    fetchDealers();
  }, [toast]);

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Text>Table "dealers" not found. Create it in Supabase to enable dealer management.</Text>
      </Alert>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="md" mb={4}>
          Dealer Registration & Management
        </Heading>
        <Button colorScheme="green" onClick={onOpen}>
          Register New Dealer
        </Button>
      </Box>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Business Name</Th>
            <Th>Contact Person</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>City</Th>
            <Th>State</Th>
            <Th>Business Type</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {dealers.map(dealer => (
            <Tr key={dealer.id}>
              <Td fontWeight="semibold">{dealer.business_name}</Td>
              <Td>{dealer.contact_person}</Td>
              <Td>{dealer.email}</Td>
              <Td>{dealer.phone}</Td>
              <Td>{dealer.city}</Td>
              <Td>{dealer.state}</Td>
              <Td>{dealer.business_type}</Td>
              <Td>
                <Badge colorScheme={dealer.status === 'Active' ? 'green' : dealer.status === 'Pending' ? 'yellow' : 'gray'}>
                  {dealer.status}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Edit dealer"
                    icon={<EditIcon />}
                    size="sm"
                    onClick={() => {
                      setFormData(dealer);
                      onOpen();
                    }}
                  />
                  <IconButton
                    aria-label="Delete dealer"
                    icon={<DeleteIcon />}
                    size="sm"
                    colorScheme="red"
                    onClick={() => deleteDealer(dealer.id)}
                  />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{formData.id ? 'Edit Dealer' : 'Register Dealer'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel>Business Name *</FormLabel>
                  <Input
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="Enter business name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Contact Person *</FormLabel>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Enter name"
                  />
                </FormControl>
              </Grid>

              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel>Email *</FormLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone"
                  />
                </FormControl>
              </Grid>

              <FormControl>
                <FormLabel>Address</FormLabel>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter full address"
                />
              </FormControl>

              <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                <FormControl>
                  <FormLabel>City</FormLabel>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>State</FormLabel>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Pincode</FormLabel>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="Pincode"
                  />
                </FormControl>
              </Grid>

              <FormControl>
                <FormLabel>Business Type</FormLabel>
                <Select
                  value={formData.business_type}
                  onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  placeholder="Select business type"
                >
                  <option value="">Select type</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Retailer">Retailer</option>
                  <option value="Installer">Installer</option>
                  <option value="Service Center">Service Center</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </FormControl>

              <HStack justify="flex-end" pt={4}>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button colorScheme="green" onClick={handleSaveDealer} isLoading={loading}>
                  Save
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

const LogisticsShipmentsTab = () => {
  const [rows, setRows] = useState<LogisticsRecord[]>([]);
  const [dateVal, setDateVal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [status, setStatus] = useState<'Pending' | 'Shipped' | 'Delivered'>('Pending');
  const [reference, setReference] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [expected, setExpected] = useState('');
  const [tracking, setTracking] = useState('');
  const [notes, setNotes] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<LogisticsRecord | null>(null);
  const toast = useToast();

  const fetchRows = async () => {
    try {
      const { data, error } = await supabase
        .from('logistics')
        .select('*')
        .order('date', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') {
          setTableMissing(true);
          return;
        }
        throw error as any;
      }
      setRows((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load logistics', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  const addRow = async () => {
    try {
      if (!item.trim() || !fromLoc.trim() || !toLoc.trim()) {
        toast({ title: 'Missing details', description: 'Please fill Item, From and To locations', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      if (!quantity || quantity <= 0) {
        toast({ title: 'Invalid quantity', description: 'Quantity must be greater than zero', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);
      const payload = {
        date: dateVal || null,
        item,
        quantity,
        from_location: fromLoc,
        to_location: toLoc,
        status,
        reference: reference || null,
        vehicle: vehicle || null,
        expected_date: expected || null,
        notes: notes || null,
        tracking_no: tracking || null,
      } as any;
      const { data, error } = await supabase.from('logistics').insert([payload]).select('*');
      if (error) throw error as any;
      setRows([...(rows || []), ...(data as any)]);
      setDateVal(new Date().toISOString().slice(0, 10));
      setItem('');
      setQuantity(1);
      setFromLoc('');
      setToLoc('');
      setStatus('Pending');
      setReference('');
      setVehicle('');
      setExpected('');
      setTracking('');
      setNotes('');
      toast({ title: 'Shipment added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add shipment', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (r: LogisticsRecord) => {
    setEditing(r);
    setItem(r.item);
    setQuantity(r.quantity);
    setFromLoc(r.from_location);
    setToLoc(r.to_location);
    setStatus((r.status as any) || 'Pending');
    setReference(r.reference || '');
    setVehicle(r.vehicle || '');
    setExpected(r.expected_date || '');
    setTracking(r.tracking_no || '');
    setNotes(r.notes || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      setLoading(true);
      const payload: any = {
        date: editing.date || null,
        item,
        quantity,
        from_location: fromLoc,
        to_location: toLoc,
        status,
        reference: reference || null,
        vehicle: vehicle || null,
        expected_date: expected || null,
        notes: notes || null,
        tracking_no: tracking || null,
      };
      const { data, error } = await supabase.from('logistics').update(payload).eq('id', editing.id).select('*');
      if (error) throw error as any;
      setRows(rows.map(r => (r.id === editing.id ? (data as any)[0] : r)));
      setEditing(null);
      setItem('');
      setQuantity(1);
      setFromLoc('');
      setToLoc('');
      setStatus('Pending');
      setReference('');
      setVehicle('');
      setExpected('');
      setTracking('');
      setNotes('');
      toast({ title: 'Updated', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (id: string) => {
    try {
      const { error } = await supabase.from('logistics').delete().eq('id', id);
      if (error) throw error as any;
      setRows(rows.filter(r => r.id !== id));
      toast({ title: 'Deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Text>Table "logistics" not found. Please create it in Supabase to enable logistics tracking.</Text>
      </Alert>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="md">Shipment Tracking & Management</Heading>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={3}>
            <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={3}>
              <FormControl>
                <FormLabel fontSize="sm">Date</FormLabel>
                <Input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Item</FormLabel>
                <Input placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Qty</FormLabel>
                <Input type="number" placeholder="Qty" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">From</FormLabel>
                <Input placeholder="From Location" value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">To</FormLabel>
                <Input placeholder="To Location" value={toLoc} onChange={(e) => setToLoc(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Status</FormLabel>
                <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="Pending">Pending</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Reference</FormLabel>
                <Input placeholder="Reference (PO/Invoice)" value={reference} onChange={(e) => setReference(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Vehicle</FormLabel>
                <Input placeholder="Vehicle No./Type" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Expected Delivery</FormLabel>
                <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Tracking</FormLabel>
                <Input placeholder="Tracking (AWB/Ref)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Notes</FormLabel>
                <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormControl>
              <Flex align="flex-end">
                <Button colorScheme="green" onClick={addRow} isLoading={loading} w="full">
                  Add
                </Button>
              </Flex>
            </Grid>
          </VStack>
        </CardBody>
      </Card>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Item</Th>
            <Th>Qty</Th>
            <Th>From</Th>
            <Th>To</Th>
            <Th>Status</Th>
            <Th>Reference</Th>
            <Th>Vehicle</Th>
            <Th>Expected</Th>
            <Th>Tracking</Th>
            <Th>Notes</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>{r.date ? new Date(r.date).toLocaleDateString() : ''}</Td>
              <Td>{r.item}</Td>
              <Td>{r.quantity}</Td>
              <Td>{r.from_location}</Td>
              <Td>{r.to_location}</Td>
              <Td>
                <Badge colorScheme={r.status === 'Delivered' ? 'green' : r.status === 'Shipped' ? 'blue' : 'yellow'}>
                  {r.status}
                </Badge>
              </Td>
              <Td>{r.reference || '-'}</Td>
              <Td>{r.vehicle || '-'}</Td>
              <Td>{r.expected_date ? new Date(r.expected_date).toLocaleDateString() : '-'}</Td>
              <Td>{r.tracking_no || '-'}</Td>
              <Td>{r.notes || '-'}</Td>
              <Td>
                {editing?.id === r.id ? (
                  <HStack spacing={1}>
                    <Button size="sm" colorScheme="green" onClick={saveEdit} isLoading={loading}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </HStack>
                ) : (
                  <HStack spacing={1}>
                    <IconButton
                      aria-label="Edit"
                      icon={<EditIcon />}
                      size="sm"
                      onClick={() => startEdit(r)}
                    />
                    <IconButton
                      aria-label="Delete"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="red"
                      onClick={() => deleteRow(r.id)}
                    />
                  </HStack>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </VStack>
  );
};

const Logistics: React.FC = () => {
  return (
    <Box>
      <Heading size="lg" mb={6}>
        🚚 Logistics & Supply Chain Management
      </Heading>

      <Tabs variant="soft-rounded" colorScheme="green">
        <TabList mb={6} overflowX="auto">
          <Tab>📊 Shipments</Tab>
          <Tab>🗺️ Distribution Network</Tab>
          <Tab>🤝 Partner Portal</Tab>
          <Tab>🏪 Dealer Registration</Tab>
          <Tab>📈 Performance Metrics</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <LogisticsShipmentsTab />
          </TabPanel>
          <TabPanel>
            <DistributionNetworkTab />
          </TabPanel>
          <TabPanel>
            <PartnerPortalTab />
          </TabPanel>
          <TabPanel>
            <DealerRegistrationTab />
          </TabPanel>
          <TabPanel>
            <LogisticsMetrics />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Logistics;
