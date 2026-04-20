import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
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
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Select,
  Badge,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon, DownloadIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';
import {
  inventoryApi,
  supplierApi,
  shipmentApi,
  vehicleApi,
  reportApi,
  enrichShipmentData,
  InventoryItem,
  Supplier,
  Shipment,
  Vehicle,
} from '../utils/inventoryUtils';

const Logistics: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // ============= INVENTORY STATE =============
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null);
  const [newInventory, setNewInventory] = useState({
    item_code: '',
    item_name: '',
    category: 'Solar Panels',
    quantity: 0,
    reorder_level: 50,
    location: '',
    unit_price: 0,
  });

  // ============= SUPPLIER STATE =============
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoading, setSuplierLoading] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    supplier_code: '',
    supplier_name: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    status: 'Active',
  });

  // ============= SHIPMENT STATE =============
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [newShipment, setNewShipment] = useState({
    shipment_no: '',
    shipment_date: new Date().toISOString().slice(0, 10),
    origin_location: '',
    destination_location: '',
    supplier_id: '',
    vehicle_id: '',
    status: 'Pending',
    quantity_shipped: 0,
    tracking_number: '',
  });

  // ============= VEHICLE STATE =============
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_code: '',
    vehicle_number: '',
    vehicle_type: '',
    capacity_tons: 0,
    driver_name: '',
    driver_phone: '',
    status: 'Active',
  });

  // ============= REPORTS STATE =============
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [pendingVsCompleted, setPendingVsCompleted] = useState<any>(null);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  // ============= LOAD INVENTORY =============
  const loadInventory = async () => {
    try {
      setInventoryLoading(true);
      const items = await inventoryApi.getAll();
      setInventoryItems(items);
    } catch (e: any) {
      toast({ title: 'Failed to load inventory', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setInventoryLoading(false);
    }
  };

  const addInventory = async () => {
    try {
      if (!newInventory.item_code.trim() || !newInventory.item_name.trim()) {
        toast({ title: 'Missing fields', description: 'Item code and name are required', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setInventoryLoading(true);
      const item = await inventoryApi.create({
        ...newInventory,
        quantity: Number(newInventory.quantity),
        reorder_level: Number(newInventory.reorder_level),
        unit_price: Number(newInventory.unit_price),
      });
      setInventoryItems([item, ...inventoryItems]);
      setNewInventory({ item_code: '', item_name: '', category: 'Solar Panels', quantity: 0, reorder_level: 50, location: '', unit_price: 0 });
      toast({ title: 'Inventory item added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add item', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setInventoryLoading(false);
    }
  };

  const updateInventory = async () => {
    if (!editingInventory) return;
    try {
      setInventoryLoading(true);
      const updated = await inventoryApi.update(editingInventory.id, editingInventory);
      setInventoryItems(inventoryItems.map(i => i.id === editingInventory.id ? updated : i));
      setEditingInventory(null);
      toast({ title: 'Inventory item updated', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setInventoryLoading(false);
    }
  };

  const deleteInventory = async (id: string) => {
    try {
      setInventoryLoading(true);
      await inventoryApi.delete(id);
      setInventoryItems(inventoryItems.filter(i => i.id !== id));
      toast({ title: 'Inventory item deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setInventoryLoading(false);
    }
  };

  // ============= LOAD SUPPLIERS =============
  const loadSuppliers = async () => {
    try {
      setSuplierLoading(true);
      const data = await supplierApi.getAllSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      toast({ title: 'Failed to load suppliers', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSuplierLoading(false);
    }
  };

  const addSupplier = async () => {
    try {
      if (!newSupplier.supplier_code.trim() || !newSupplier.supplier_name.trim()) {
        toast({ title: 'Missing fields', description: 'Supplier code and name are required', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setSuplierLoading(true);
      const supplier = await supplierApi.create(newSupplier as any);
      setSuppliers([supplier, ...suppliers]);
      setNewSupplier({ supplier_code: '', supplier_name: '', contact_person: '', email: '', phone: '', city: '', state: '', status: 'Active' });
      toast({ title: 'Supplier added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add supplier', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSuplierLoading(false);
    }
  };

  const updateSupplier = async () => {
    if (!editingSupplier) return;
    try {
      setSuplierLoading(true);
      const updated = await supplierApi.update(editingSupplier.id, editingSupplier);
      setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? updated : s));
      setEditingSupplier(null);
      toast({ title: 'Supplier updated', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSuplierLoading(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      setSuplierLoading(true);
      await supplierApi.delete(id);
      setSuppliers(suppliers.filter(s => s.id !== id));
      toast({ title: 'Supplier deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setSuplierLoading(false);
    }
  };

  // ============= LOAD SHIPMENTS =============
  const loadShipments = async () => {
    try {
      setShipmentLoading(true);
      const data = await shipmentApi.getAll();
      const enrichedData = await enrichShipmentData(data);
      setShipments(enrichedData);
    } catch (e: any) {
      toast({ title: 'Failed to load shipments', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setShipmentLoading(false);
    }
  };

  const addShipment = async () => {
    try {
      if (!newShipment.shipment_no.trim()) {
        toast({ title: 'Missing shipment number', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setShipmentLoading(true);
      const shipment = await shipmentApi.create(newShipment as any);
      setShipments([shipment, ...shipments]);
      setNewShipment({
        shipment_no: '',
        shipment_date: new Date().toISOString().slice(0, 10),
        origin_location: '',
        destination_location: '',
        supplier_id: '',
        vehicle_id: '',
        status: 'Pending',
        quantity_shipped: 0,
        tracking_number: '',
      });
      toast({ title: 'Shipment added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add shipment', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setShipmentLoading(false);
    }
  };

  const updateShipment = async () => {
    if (!editingShipment) return;
    try {
      setShipmentLoading(true);
      const updated = await shipmentApi.update(editingShipment.id, editingShipment);
      setShipments(shipments.map(s => s.id === editingShipment.id ? updated : s));
      setEditingShipment(null);
      toast({ title: 'Shipment updated', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setShipmentLoading(false);
    }
  };

  const deleteShipment = async (id: string) => {
    try {
      setShipmentLoading(true);
      await shipmentApi.delete(id);
      setShipments(shipments.filter(s => s.id !== id));
      toast({ title: 'Shipment deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setShipmentLoading(false);
    }
  };

  // ============= LOAD VEHICLES =============
  const loadVehicles = async () => {
    try {
      setVehicleLoading(true);
      const data = await vehicleApi.getAll();
      setVehicles(data);
    } catch (e: any) {
      toast({ title: 'Failed to load vehicles', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setVehicleLoading(false);
    }
  };

  const addVehicle = async () => {
    try {
      if (!newVehicle.vehicle_code.trim() || !newVehicle.vehicle_number.trim()) {
        toast({ title: 'Missing fields', description: 'Vehicle code and number are required', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setVehicleLoading(true);
      const vehicle = await vehicleApi.create({
        ...newVehicle,
        capacity_tons: Number(newVehicle.capacity_tons),
      });
      setVehicles([vehicle, ...vehicles]);
      setNewVehicle({ vehicle_code: '', vehicle_number: '', vehicle_type: '', capacity_tons: 0, driver_name: '', driver_phone: '', status: 'Active' });
      toast({ title: 'Vehicle added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add vehicle', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setVehicleLoading(false);
    }
  };

  const updateVehicle = async () => {
    if (!editingVehicle) return;
    try {
      setVehicleLoading(true);
      const updated = await vehicleApi.update(editingVehicle.id, editingVehicle);
      setVehicles(vehicles.map(v => v.id === editingVehicle.id ? updated : v));
      setEditingVehicle(null);
      toast({ title: 'Vehicle updated', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setVehicleLoading(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      setVehicleLoading(true);
      await vehicleApi.delete(id);
      setVehicles(vehicles.filter(v => v.id !== id));
      toast({ title: 'Vehicle deleted', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setVehicleLoading(false);
    }
  };

  // ============= LOAD REPORTS =============
  const loadReports = async () => {
    try {
      setLoading(true);
      const [daily, weekly, monthly, pendingComp, inventory] = await Promise.all([
        reportApi.getDailyShipmentReport(reportDate),
        reportApi.getWeeklyShipmentReport(),
        reportApi.getMonthlyShipmentReport(),
        reportApi.getPendingVsCompleted(),
        reportApi.getInventoryStockReport(),
      ]);
      setDailyReport(daily);
      setWeeklyReport(weekly);
      setMonthlyReport(monthly);
      setPendingVsCompleted(pendingComp);
      setInventoryReport(inventory);
    } catch (e: any) {
      toast({ title: 'Failed to load reports', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const downloadReportPDF = () => {
    try {
      let content = `LOGISTICS REPORT\n Generated: ${new Date().toLocaleString()}\n\n`;
      content += `DAILY SHIPMENTS (${reportDate}):\n`;
      if (dailyReport) {
        Object.entries(dailyReport).forEach(([status, data]: [string, any]) => {
          content += `${status}: ${data.count} shipments, ${data.shipped} units shipped, ${data.received} received\n`;
        });
      }
      content += '\n\nPENDING VS COMPLETED:\n';
      if (pendingVsCompleted) {
        Object.entries(pendingVsCompleted).forEach(([status, data]: [string, any]) => {
          content += `${status}: ${data.count} shipments\n`;
        });
      }
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
      element.setAttribute('download', `logistics-report-${new Date().toISOString().slice(0, 10)}.txt`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast({ title: 'Report downloaded', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to download', description: e?.message, status: 'error', duration: 4000, isClosable: true });
    }
  };

  // Initial load
  useEffect(() => {
    loadInventory();
    loadSuppliers();
    loadShipments();
    loadVehicles();
  }, []);

  useEffect(() => {
    loadReports();
  }, [reportDate]);

  return (
    <Box p={6}>
      <Heading size="lg" mb={6}>Logistics & Inventory Management</Heading>

      <Tabs colorScheme="green" variant="enclosed" index={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab>Shipments/Deliveries</Tab>
          <Tab>Inventory</Tab>
          <Tab>Suppliers</Tab>
          <Tab>Vehicles</Tab>
          <Tab>Reports</Tab>
        </TabList>

        <TabPanels>
          {/* SHIPMENTS TAB */}
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              <Card>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Add Shipment</Heading>
                    <HStack wrap="wrap" spacing={3}>
                      <Input placeholder="Shipment No" value={newShipment.shipment_no} onChange={(e) => setNewShipment({...newShipment, shipment_no: e.target.value})} w="140px" />
                      <Input type="date" value={newShipment.shipment_date} onChange={(e) => setNewShipment({...newShipment, shipment_date: e.target.value})} w="140px" />
                      <Input placeholder="From Location" value={newShipment.origin_location} onChange={(e) => setNewShipment({...newShipment, origin_location: e.target.value})} w="160px" />
                      <Input placeholder="To Location" value={newShipment.destination_location} onChange={(e) => setNewShipment({...newShipment, destination_location: e.target.value})} w="160px" />
                      <Input type="number" placeholder="Qty" value={newShipment.quantity_shipped} onChange={(e) => setNewShipment({...newShipment, quantity_shipped: Number(e.target.value)})} w="100px" />
                      <Select value={newShipment.status} onChange={(e) => setNewShipment({...newShipment, status: e.target.value})} w="140px">
                        <option value="Pending">Pending</option>
                        <option value="Shipped">Shipped</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Delivered">Delivered</option>
                      </Select>
                      <Input placeholder="Tracking No" value={newShipment.tracking_number} onChange={(e) => setNewShipment({...newShipment, tracking_number: e.target.value})} w="140px" />
                      <Button colorScheme="green" onClick={addShipment} isLoading={shipmentLoading}>Add</Button>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              <Table variant="simple" size="sm">
                <Thead>
                  <Tr bg="gray.100">
                    <Th>Shipment No</Th>
                    <Th>Date</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Qty</Th>
                    <Th>Status</Th>
                    <Th>Tracking</Th>
                    <Th>Updated</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {shipments.map((s) => (
                    <Tr key={s.id}>
                      <Td fontWeight="bold">{s.shipment_no}</Td>
                      <Td>{s.shipment_date ? new Date(s.shipment_date).toLocaleDateString() : '-'}</Td>
                      <Td>{s.origin_location || '-'}</Td>
                      <Td>{s.destination_location || '-'}</Td>
                      <Td>{s.quantity_shipped || '-'}</Td>
                      <Td><Badge colorScheme={s.status === 'Delivered' ? 'green' : s.status === 'Pending' ? 'red' : 'yellow'}>{s.status}</Badge></Td>
                      <Td>{s.tracking_number || '-'}</Td>
                      <Td fontSize="sm">{s.updated_at ? new Date(s.updated_at).toLocaleString() : '-'}</Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton icon={<EditIcon />} size="sm" onClick={() => setEditingShipment(s)} aria-label="Edit" />
                          <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => deleteShipment(s.id)} aria-label="Delete" />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>

            {editingShipment && (
              <Modal isOpen={!!editingShipment} onClose={() => setEditingShipment(null)}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Edit Shipment</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <VStack spacing={3}>
                      <Input value={editingShipment.shipment_no} onChange={(e) => setEditingShipment({...editingShipment, shipment_no: e.target.value})} placeholder="Shipment No" />
                      <Input type="date" value={editingShipment.shipment_date} onChange={(e) => setEditingShipment({...editingShipment, shipment_date: e.target.value})} />
                      <Input value={editingShipment.origin_location} onChange={(e) => setEditingShipment({...editingShipment, origin_location: e.target.value})} placeholder="From" />
                      <Input value={editingShipment.destination_location} onChange={(e) => setEditingShipment({...editingShipment, destination_location: e.target.value})} placeholder="To" />
                      <Input type="number" value={editingShipment.quantity_shipped} onChange={(e) => setEditingShipment({...editingShipment, quantity_shipped: Number(e.target.value)})} placeholder="Qty" />
                      <Select value={editingShipment.status} onChange={(e) => setEditingShipment({...editingShipment, status: e.target.value})}>
                        <option value="Pending">Pending</option>
                        <option value="Shipped">Shipped</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Delivered">Delivered</option>
                      </Select>
                    </VStack>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={() => setEditingShipment(null)}>Cancel</Button>
                    <Button colorScheme="green" onClick={updateShipment} isLoading={shipmentLoading}>Save</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </TabPanel>

          {/* INVENTORY TAB */}
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              <Card>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Add Inventory Item</Heading>
                    <HStack wrap="wrap" spacing={3}>
                      <Input placeholder="Item Code" value={newInventory.item_code} onChange={(e) => setNewInventory({...newInventory, item_code: e.target.value})} w="120px" />
                      <Input placeholder="Item Name" value={newInventory.item_name} onChange={(e) => setNewInventory({...newInventory, item_name: e.target.value})} w="180px" />
                      <Select value={newInventory.category} onChange={(e) => setNewInventory({...newInventory, category: e.target.value})} w="160px">
                        <option value="Solar Panels">Solar Panels</option>
                        <option value="Inverters">Inverters</option>
                        <option value="Cables">Cables</option>
                        <option value="Mounting Hardware">Mounting Hardware</option>
                        <option value="Electrical Components">Electrical Components</option>
                        <option value="Other">Other</option>
                      </Select>
                      <Input type="number" placeholder="Quantity" value={newInventory.quantity} onChange={(e) => setNewInventory({...newInventory, quantity: Number(e.target.value)})} w="110px" />
                      <Input type="number" placeholder="Reorder Level" value={newInventory.reorder_level} onChange={(e) => setNewInventory({...newInventory, reorder_level: Number(e.target.value)})} w="130px" />
                      <Input placeholder="Location" value={newInventory.location} onChange={(e) => setNewInventory({...newInventory, location: e.target.value})} w="120px" />
                      <Input type="number" placeholder="Unit Price" value={newInventory.unit_price} onChange={(e) => setNewInventory({...newInventory, unit_price: Number(e.target.value)})} w="120px" />
                      <Button colorScheme="green" onClick={addInventory} isLoading={inventoryLoading}>Add</Button>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              <Table variant="simple" size="sm">
                <Thead>
                  <Tr bg="gray.100">
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Category</Th>
                    <Th>Quantity</Th>
                    <Th>Reorder</Th>
                    <Th>Location</Th>
                    <Th>Unit Price</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {inventoryItems.map((item) => (
                    <Tr key={item.id} bg={item.quantity <= item.reorder_level ? 'red.50' : 'white'}>
                      <Td fontWeight="bold">{item.item_code}</Td>
                      <Td>{item.item_name}</Td>
                      <Td>{item.category}</Td>
                      <Td>{item.quantity}</Td>
                      <Td>{item.reorder_level}</Td>
                      <Td>{item.location || '-'}</Td>
                      <Td>₹{item.unit_price?.toFixed(2) || '-'}</Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton icon={<EditIcon />} size="sm" onClick={() => setEditingInventory(item)} aria-label="Edit" />
                          <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => deleteInventory(item.id)} aria-label="Delete" />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>

            {editingInventory && (
              <Modal isOpen={!!editingInventory} onClose={() => setEditingInventory(null)}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Edit Inventory Item</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <VStack spacing={3}>
                      <Input value={editingInventory.item_code} onChange={(e) => setEditingInventory({...editingInventory, item_code: e.target.value})} placeholder="Item Code" />
                      <Input value={editingInventory.item_name} onChange={(e) => setEditingInventory({...editingInventory, item_name: e.target.value})} placeholder="Item Name" />
                      <Select value={editingInventory.category} onChange={(e) => setEditingInventory({...editingInventory, category: e.target.value})}>
                        <option value="Solar Panels">Solar Panels</option>
                        <option value="Inverters">Inverters</option>
                        <option value="Cables">Cables</option>
                        <option value="Mounting Hardware">Mounting Hardware</option>
                        <option value="Electrical Components">Electrical Components</option>
                        <option value="Other">Other</option>
                      </Select>
                      <Input type="number" value={editingInventory.quantity} onChange={(e) => setEditingInventory({...editingInventory, quantity: Number(e.target.value)})} placeholder="Quantity" />
                      <Input type="number" value={editingInventory.reorder_level} onChange={(e) => setEditingInventory({...editingInventory, reorder_level: Number(e.target.value)})} placeholder="Reorder Level" />
                      <Input value={editingInventory.location} onChange={(e) => setEditingInventory({...editingInventory, location: e.target.value})} placeholder="Location" />
                      <Input type="number" value={editingInventory.unit_price} onChange={(e) => setEditingInventory({...editingInventory, unit_price: Number(e.target.value)})} placeholder="Unit Price" />
                    </VStack>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={() => setEditingInventory(null)}>Cancel</Button>
                    <Button colorScheme="green" onClick={updateInventory} isLoading={inventoryLoading}>Save</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </TabPanel>

          {/* SUPPLIERS TAB */}
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              <Card>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Add Supplier</Heading>
                    <HStack wrap="wrap" spacing={3}>
                      <Input placeholder="Supplier Code" value={newSupplier.supplier_code} onChange={(e) => setNewSupplier({...newSupplier, supplier_code: e.target.value})} w="130px" />
                      <Input placeholder="Supplier Name" value={newSupplier.supplier_name} onChange={(e) => setNewSupplier({...newSupplier, supplier_name: e.target.value})} w="160px" />
                      <Input placeholder="Contact Person" value={newSupplier.contact_person} onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})} w="140px" />
                      <Input placeholder="Email" value={newSupplier.email} onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})} w="160px" />
                      <Input placeholder="Phone" value={newSupplier.phone} onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} w="130px" />
                      <Input placeholder="City" value={newSupplier.city} onChange={(e) => setNewSupplier({...newSupplier, city: e.target.value})} w="120px" />
                      <Input placeholder="State" value={newSupplier.state} onChange={(e) => setNewSupplier({...newSupplier, state: e.target.value})} w="120px" />
                      <Button colorScheme="green" onClick={addSupplier} isLoading={supplierLoading}>Add</Button>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              <Table variant="simple" size="sm">
                <Thead>
                  <Tr bg="gray.100">
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Contact</Th>
                    <Th>Email</Th>
                    <Th>Phone</Th>
                    <Th>City</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {suppliers.map((sup) => (
                    <Tr key={sup.id}>
                      <Td fontWeight="bold">{sup.supplier_code}</Td>
                      <Td>{sup.supplier_name}</Td>
                      <Td>{sup.contact_person || '-'}</Td>
                      <Td fontSize="sm">{sup.email || '-'}</Td>
                      <Td>{sup.phone || '-'}</Td>
                      <Td>{sup.city || '-'}</Td>
                      <Td><Badge colorScheme={sup.status === 'Active' ? 'green' : 'red'}>{sup.status}</Badge></Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton icon={<EditIcon />} size="sm" onClick={() => setEditingSupplier(sup)} aria-label="Edit" />
                          <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => deleteSupplier(sup.id)} aria-label="Delete" />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>

            {editingSupplier && (
              <Modal isOpen={!!editingSupplier} onClose={() => setEditingSupplier(null)}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Edit Supplier</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <VStack spacing={3}>
                      <Input value={editingSupplier.supplier_code} onChange={(e) => setEditingSupplier({...editingSupplier, supplier_code: e.target.value})} placeholder="Code" />
                      <Input value={editingSupplier.supplier_name} onChange={(e) => setEditingSupplier({...editingSupplier, supplier_name: e.target.value})} placeholder="Name" />
                      <Input value={editingSupplier.contact_person} onChange={(e) => setEditingSupplier({...editingSupplier, contact_person: e.target.value})} placeholder="Contact" />
                      <Input value={editingSupplier.email} onChange={(e) => setEditingSupplier({...editingSupplier, email: e.target.value})} placeholder="Email" />
                      <Input value={editingSupplier.phone} onChange={(e) => setEditingSupplier({...editingSupplier, phone: e.target.value})} placeholder="Phone" />
                      <Input value={editingSupplier.city} onChange={(e) => setEditingSupplier({...editingSupplier, city: e.target.value})} placeholder="City" />
                      <Select value={editingSupplier.status} onChange={(e) => setEditingSupplier({...editingSupplier, status: e.target.value})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                      </Select>
                    </VStack>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={() => setEditingSupplier(null)}>Cancel</Button>
                    <Button colorScheme="green" onClick={updateSupplier} isLoading={supplierLoading}>Save</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </TabPanel>

          {/* VEHICLES TAB */}
          <TabPanel>
            <VStack align="stretch" spacing={4}>
              <Card>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    <Heading size="sm">Add Vehicle</Heading>
                    <HStack wrap="wrap" spacing={3}>
                      <Input placeholder="Vehicle Code" value={newVehicle.vehicle_code} onChange={(e) => setNewVehicle({...newVehicle, vehicle_code: e.target.value})} w="130px" />
                      <Input placeholder="Vehicle Number" value={newVehicle.vehicle_number} onChange={(e) => setNewVehicle({...newVehicle, vehicle_number: e.target.value})} w="140px" />
                      <Input placeholder="Type" value={newVehicle.vehicle_type} onChange={(e) => setNewVehicle({...newVehicle, vehicle_type: e.target.value})} w="110px" />
                      <Input type="number" placeholder="Capacity (tons)" value={newVehicle.capacity_tons} onChange={(e) => setNewVehicle({...newVehicle, capacity_tons: Number(e.target.value)})} w="130px" />
                      <Input placeholder="Driver Name" value={newVehicle.driver_name} onChange={(e) => setNewVehicle({...newVehicle, driver_name: e.target.value})} w="140px" />
                      <Input placeholder="Driver Phone" value={newVehicle.driver_phone} onChange={(e) => setNewVehicle({...newVehicle, driver_phone: e.target.value})} w="130px" />
                      <Select value={newVehicle.status} onChange={(e) => setNewVehicle({...newVehicle, status: e.target.value})} w="140px">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                      </Select>
                      <Button colorScheme="green" onClick={addVehicle} isLoading={vehicleLoading}>Add</Button>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              <Table variant="simple" size="sm">
                <Thead>
                  <Tr bg="gray.100">
                    <Th>Code</Th>
                    <Th>Number</Th>
                    <Th>Type</Th>
                    <Th>Capacity</Th>
                    <Th>Driver</Th>
                    <Th>Phone</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {vehicles.map((veh) => (
                    <Tr key={veh.id}>
                      <Td fontWeight="bold">{veh.vehicle_code}</Td>
                      <Td>{veh.vehicle_number}</Td>
                      <Td>{veh.vehicle_type || '-'}</Td>
                      <Td>{veh.capacity_tons}T</Td>
                      <Td>{veh.driver_name || '-'}</Td>
                      <Td>{veh.driver_phone || '-'}</Td>
                      <Td><Badge colorScheme={veh.status === 'Active' ? 'green' : 'red'}>{veh.status}</Badge></Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton icon={<EditIcon />} size="sm" onClick={() => setEditingVehicle(veh)} aria-label="Edit" />
                          <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => deleteVehicle(veh.id)} aria-label="Delete" />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>

            {editingVehicle && (
              <Modal isOpen={!!editingVehicle} onClose={() => setEditingVehicle(null)}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Edit Vehicle</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <VStack spacing={3}>
                      <Input value={editingVehicle.vehicle_code} onChange={(e) => setEditingVehicle({...editingVehicle, vehicle_code: e.target.value})} placeholder="Code" />
                      <Input value={editingVehicle.vehicle_number} onChange={(e) => setEditingVehicle({...editingVehicle, vehicle_number: e.target.value})} placeholder="Number" />
                      <Input value={editingVehicle.vehicle_type} onChange={(e) => setEditingVehicle({...editingVehicle, vehicle_type: e.target.value})} placeholder="Type" />
                      <Input type="number" value={editingVehicle.capacity_tons} onChange={(e) => setEditingVehicle({...editingVehicle, capacity_tons: Number(e.target.value)})} placeholder="Capacity" />
                      <Input value={editingVehicle.driver_name} onChange={(e) => setEditingVehicle({...editingVehicle, driver_name: e.target.value})} placeholder="Driver Name" />
                      <Input value={editingVehicle.driver_phone} onChange={(e) => setEditingVehicle({...editingVehicle, driver_phone: e.target.value})} placeholder="Driver Phone" />
                      <Select value={editingVehicle.status} onChange={(e) => setEditingVehicle({...editingVehicle, status: e.target.value})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                      </Select>
                    </VStack>
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="ghost" onClick={() => setEditingVehicle(null)}>Cancel</Button>
                    <Button colorScheme="green" onClick={updateVehicle} isLoading={vehicleLoading}>Save</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </TabPanel>

          {/* REPORTS TAB */}
          <TabPanel>
            <VStack align="stretch" spacing={6}>
              <Card>
                <CardBody>
                  <HStack spacing={3} mb={4}>
                    <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} w="160px" />
                    <Button colorScheme="blue" onClick={() => loadReports()} isLoading={loading}>Refresh Reports</Button>
                    <Button leftIcon={<DownloadIcon />} onClick={downloadReportPDF}>Download</Button>
                  </HStack>
                </CardBody>
              </Card>

              <Box>
                <Heading size="md" mb={4}>Daily Shipment Report ({reportDate})</Heading>
                {dailyReport && Object.keys(dailyReport).length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                    {Object.entries(dailyReport).map(([status, data]: [string, any]) => (
                      <Card key={status}>
                        <CardBody>
                          <Stat>
                            <StatLabel>{status}</StatLabel>
                            <StatNumber>{data.count}</StatNumber>
                            <StatHelpText>Shipments</StatHelpText>
                            <StatHelpText mt={2}>Shipped: {data.shipped} | Received: {data.received}</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Text>No shipments for this date</Text>
                )}
              </Box>

              <Box>
                <Heading size="md" mb={4}>Pending vs Completed</Heading>
                {pendingVsCompleted && Object.keys(pendingVsCompleted).length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                    {Object.entries(pendingVsCompleted).map(([status, data]: [string, any]) => (
                      <Card key={status}>
                        <CardBody>
                          <Stat>
                            <StatLabel>{status}</StatLabel>
                            <StatNumber>{data.count}</StatNumber>
                            <StatHelpText>Total Shipments</StatHelpText>
                          </Stat>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                ) : (
                  <Text>No data available</Text>
                )}
              </Box>

              <Box>
                <Heading size="md" mb={4}>Inventory Stock Report</Heading>
                {inventoryReport && Object.keys(inventoryReport).length > 0 ? (
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr bg="gray.100">
                        <Th>Category</Th>
                        <Th>Items</Th>
                        <Th>Total Qty</Th>
                        <Th>Total Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(inventoryReport).map(([category, data]: [string, any]) => (
                        <Tr key={category}>
                          <Td fontWeight="bold">{category}</Td>
                          <Td>{data.count}</Td>
                          <Td>{data.totalQty}</Td>
                          <Td>₹{data.totalValue.toFixed(2)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text>No inventory data</Text>
                )}
              </Box>

              <Box>
                <Heading size="md" mb={4}>Weekly Summary</Heading>
                {weeklyReport && Object.keys(weeklyReport).length > 0 ? (
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr bg="gray.100">
                        <Th>Week</Th>
                        <Th>Status</Th>
                        <Th>Count</Th>
                        <Th>Shipped</Th>
                        <Th>Received</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(weeklyReport).map(([week, data]: [string, any]) => (
                        <Tr key={week}>
                          <Td fontWeight="bold">{week}</Td>
                          <Td>-</Td>
                          <Td>{data.shipment_count || 0}</Td>
                          <Td>{data.total_quantity || 0}</Td>
                          <Td>{data.total_received || 0}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text>No weekly data</Text>
                )}
              </Box>

              <Box>
                <Heading size="md" mb={4}>Monthly Summary</Heading>
                {monthlyReport && Object.keys(monthlyReport).length > 0 ? (
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr bg="gray.100">
                        <Th>Month</Th>
                        <Th>Count</Th>
                        <Th>Shipped</Th>
                        <Th>Received</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {Object.entries(monthlyReport).map(([month, data]: [string, any]) => (
                        <Tr key={month}>
                          <Td fontWeight="bold">{month}</Td>
                          <Td>{data.shipment_count || 0}</Td>
                          <Td>{data.total_quantity || 0}</Td>
                          <Td>{data.total_received || 0}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text>No monthly data</Text>
                )}
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Logistics;
