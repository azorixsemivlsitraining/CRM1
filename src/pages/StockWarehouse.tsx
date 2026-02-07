import React, { useEffect, useMemo, useState } from 'react';
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
  Image,
  Badge,
  List,
  ListItem,
  Link,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';

interface StockItem {
  id: string;
  item_name: string;
  quantity: number;
  location?: string;
  notes?: string;
  updated_at?: string;
}

interface EditState { id: string; item_name: string; quantity: number; location: string; notes: string; }

const STOCK_LOCATIONS = ['Hyderabad', 'Bangalore', 'Chennai'];
const WAREHOUSE_AREA_SQFT = 20000; // editable configuration
const DISPATCH_TIME = 'Same-day / 24 hrs';

const StockWarehouse: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const toast = useToast();

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_warehouse')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') {
          setTableMissing(true);
          return;
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
      setItems((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load stock', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  const addItem = async () => {
    try {
      setLoading(true);
      const payload = { item_name: itemName, quantity, location: location || null, notes: notes || null };
      const { data, error } = await supabase.from('stock_warehouse').insert([payload]).select('*');
      if (error) throw error instanceof Error ? error : new Error(String(error));
      setItems([...(items || []), ...(data as any)]);
      setItemName(''); setQuantity(0); setLocation(''); setNotes('');
      toast({ title: 'Item added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add item', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalUnits = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const uniqueSkus = new Set(items.map(it => (it.item_name || '').trim().toLowerCase())).size;
    const lastUpdated = items[0]?.updated_at ? new Date(items[0].updated_at) : null;
    return { totalUnits, uniqueSkus, lastUpdated };
  }, [items]);

  const downloadInventoryPDF = () => {
    try {
      const doc = new jsPDF({ unit: 'pt' });
      const marginX = 40;
      let y = 50;

      doc.setFontSize(16);
      doc.text('Axiso Green Energy – Inventory List', marginX, y);
      y += 20;
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);
      y += 20;
      doc.text(`Locations: ${STOCK_LOCATIONS.join(' | ')}`, marginX, y);
      y += 16;
      doc.text(`Total Units: ${stats.totalUnits}   SKUs: ${stats.uniqueSkus}`, marginX, y);
      y += 24;

      // table header
      // jsPDF typings require string; use standard 'helvetica' font family explicitly
      doc.setFont('helvetica', 'bold');
      doc.text('Item', marginX, y);
      doc.text('Qty', marginX + 240, y);
      doc.text('Location', marginX + 300, y);
      doc.text('Notes', marginX + 420, y);
      doc.setFont('helvetica', 'normal');
      y += 10;
      doc.line(marginX, y, 555, y);
      y += 14;

      const lineHeight = 16;
      items.forEach((it, idx) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y + lineHeight > pageHeight - 40) {
          doc.addPage();
          y = 50;
        }
        const loc = it.location || '-';
        const note = it.notes || '-';
        doc.text(String(it.item_name || '-'), marginX, y);
        doc.text(String(it.quantity ?? '-'), marginX + 240, y);
        doc.text(String(loc), marginX + 300, y);
        doc.text(String(note).slice(0, 40), marginX + 420, y);
        y += lineHeight;
      });

      doc.save('inventory.pdf');
    } catch (e: any) {
      toast({ title: 'Failed to generate PDF', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  useEffect(() => { fetchItems(); }, []);

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Text>Table "stock_warehouse" not found. Please create it in Supabase to enable stock management.</Text>
      </Alert>
    );
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Stock Warehouse</Heading>

      <Tabs colorScheme="green" variant="enclosed" index={tabIndex} onChange={(i) => setTabIndex(i)}>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Visuals</Tab>
          <Tab>Features</Tab>
          <Tab>Actions</Tab>
          <Tab>Contact</Tab>
          <Tab>Inventory</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Card mb={6}><CardBody>
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                <Stat>
                  <StatLabel>Total Warehouse Area</StatLabel>
                  <StatNumber>{WAREHOUSE_AREA_SQFT.toLocaleString()} sq. ft.</StatNumber>
                  <StatHelpText>Multi-location capacity</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Stock Availability</StatLabel>
                  <StatNumber>{stats.totalUnits} units</StatNumber>
                  <StatHelpText>{stats.uniqueSkus} SKUs ready to ship</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Locations</StatLabel>
                  <StatNumber fontSize="lg">{STOCK_LOCATIONS.join(' | ')}</StatNumber>
                  <StatHelpText>Pan-India distribution</StatHelpText>
                </Stat>
                <Stat>
                  <StatLabel>Dispatch Time</StatLabel>
                  <StatNumber fontSize="lg">{DISPATCH_TIME}</StatNumber>
                  <StatHelpText>Priority logistics available</StatHelpText>
                </Stat>
              </SimpleGrid>
              <HStack mt={4} spacing={3}>
                <Badge colorScheme="green">Live</Badge>
                <Text color="gray.600">{stats.lastUpdated ? `Updated ${stats.lastUpdated.toLocaleString()}` : 'Awaiting first sync'}</Text>
              </HStack>
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Card><CardBody>
              <VStack align="stretch" spacing={4}>
                <Image
                  src="https://images.unsplash.com/photo-1581093458791-9d09cd313660?q=80&w=1400&auto=format&fit=crop"
                  alt="Warehouse with organized solar inventory"
                  borderRadius="md"
                  objectFit="cover"
                />
                <Text color="gray.700">Organized inventory, palletized solar modules, and ready dispatch bays ensure fast turnarounds.</Text>
                <Box as="iframe"
                  src="https://www.google.com/maps?q=Hyderabad&output=embed"
                  borderRadius="md"
                  w="100%"
                  h="320px"
                />
              </VStack>
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Card><CardBody>
              <VStack align="stretch" spacing={2}>
                <List spacing={2} styleType="disc" pl={5}>
                  <ListItem>Real-time stock updates</ListItem>
                  <ListItem>Fast logistics and delivery</ListItem>
                  <ListItem>Quality-checked inventory</ListItem>
                  <ListItem>Nationwide distribution</ListItem>
                  <ListItem>Tie-ups with major brands</ListItem>
                </List>
              </VStack>
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Card><CardBody>
              <HStack spacing={3} wrap="wrap">
                <Button colorScheme="green" onClick={() => setTabIndex(5)}>Check Available Stock</Button>
                <Button onClick={downloadInventoryPDF}>Download Inventory List</Button>
                <Button as={Link} href="mailto:logistics@axisogreen.in">Contact Warehouse Team</Button>
              </HStack>
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Card><CardBody>
              <VStack align="stretch" spacing={3}>
                <Text fontWeight="semibold">Locations</Text>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <VStack align="stretch" spacing={1}>
                    <Text>Hyderabad Warehouse</Text>
                    <Link color="green.600" isExternal href="https://maps.google.com/?q=Hyderabad">Open in Maps</Link>
                  </VStack>
                  <VStack align="stretch" spacing={1}>
                    <Text>Bangalore Warehouse</Text>
                    <Link color="green.600" isExternal href="https://maps.google.com/?q=Bangalore">Open in Maps</Link>
                  </VStack>
                  <VStack align="stretch" spacing={1}>
                    <Text>Chennai Warehouse</Text>
                    <Link color="green.600" isExternal href="https://maps.google.com/?q=Chennai">Open in Maps</Link>
                  </VStack>
                </SimpleGrid>
                <HStack pt={2} spacing={6}>
                  <Text>Email: <Link href="mailto:logistics@axisogreen.in" color="green.600">logistics@axisogreen.in</Link></Text>
                </HStack>
              </VStack>
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Card mb={6}><CardBody>
              <VStack align="stretch" spacing={3}>
                <HStack>
                  <Input placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                  <Input type="number" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} w="120px" />
                  <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
                  <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <Button colorScheme="green" onClick={addItem} isLoading={loading}>Add</Button>
                </HStack>
              </VStack>
            </CardBody></Card>

            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Item</Th>
                  <Th>Quantity</Th>
                  <Th>Location</Th>
                  <Th>Notes</Th>
                  <Th>Updated</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((it) => (
                  <Tr key={it.id}>
                    <Td>{editing?.id === it.id ? (<Input value={editing.item_name} onChange={(e)=>setEditing({
                      ...editing!, item_name:e.target.value })} />) : it.item_name}</Td>
                    <Td>{editing?.id === it.id ? (<Input type="number" value={editing.quantity} onChange={(e)=>setEditing({
                      ...editing!, quantity:Number(e.target.value) })} />) : it.quantity}</Td>
                    <Td>{editing?.id === it.id ? (<Input value={editing.location} onChange={(e)=>setEditing({
                      ...editing!, location:e.target.value })} />) : (it.location || '-')}</Td>
                    <Td>{editing?.id === it.id ? (<Input value={editing.notes} onChange={(e)=>setEditing({
                      ...editing!, notes:e.target.value })} />) : (it.notes || '-')}</Td>
                    <Td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '-'}</Td>
                    <Td>
                      {editing?.id === it.id ? (
                        <HStack>
                          <Button size="sm" colorScheme="green" onClick={async ()=>{
                            try{
                              setLoading(true);
                              const payload:any={ item_name:editing.item_name, quantity:editing.quantity, location:editing.location||null, notes:editing.notes||null };
                              const { data, error } = await supabase.from('stock_warehouse').update(payload).eq('id', it.id).select('*');
                              if(error) throw error instanceof Error ? error : new Error(String(error));
                              setItems(items.map(x=>x.id===it.id ? (data as any)[0] : x));
                              setEditing(null);
                              toast({ title:'Updated', status:'success', duration:2000});
                            }catch(e:any){ toast({ title:'Failed to update', description:e?.message||String(e), status:'error', duration:4000}); }
                            finally{ setLoading(false);} 
                          }}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={()=>setEditing(null)}>Cancel</Button>
                        </HStack>
                      ) : (
                        <HStack>
                          <Button size="sm" onClick={()=>setEditing({ id:it.id, item_name:it.item_name, quantity:it.quantity, location:it.location||'', notes:it.notes||'' })}>Edit</Button>
                          <Button size="sm" colorScheme="red" onClick={async ()=>{
                            try{ const { error } = await supabase.from('stock_warehouse').delete().eq('id', it.id); if(error) throw error instanceof Error ? error : new Error(String(error)); setItems(items.filter(x=>x.id!==it.id)); toast({ title:'Deleted', status:'success', duration:2000}); }catch(e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error', duration:4000}); }
                          }}>Delete</Button>
                        </HStack>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default StockWarehouse;
