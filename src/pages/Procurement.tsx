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
  Textarea,
  Code,
  SimpleGrid,
  Select,
} from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

interface ProcurementItem {
  id: string;
  item_name: string;
  quantity: number;
  supplier?: string;
  purchase_date?: string; // ISO Date string
  price?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const inr = (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`;

const Procurement: React.FC = () => {
  const [records, setRecords] = useState<ProcurementItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ProcurementItem | null>(null);
  const toast = useToast();

  // Analytics and integrations
  const [payments, setPayments] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [expensesByCategory, setExpensesByCategory] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  const [topSuppliers, setTopSuppliers] = useState<[string, number][]>([]);
  const [valuationMethod, setValuationMethod] = useState<'FIFO' | 'LIFO'>('FIFO');
  const [logisticsPerUnit, setLogisticsPerUnit] = useState<number>(0);
  const [inventoryValuationResult, setInventoryValuationResult] = useState<{ totalCost: number; perUnitCost: number } | null>(null);
  const [grossMargin, setGrossMargin] = useState<{ revenue: number; cost: number; margin: number } | null>(null);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('procurements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') {
          setTableMissing(true);
          return;
        }
        throw error as any;
      }
      setRecords((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load procurements', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  // Fetch payments and derive simple analytics for procurement
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const { data, error } = await supabase.from('payments').select('id,created_at,amount,project_id');
        if (!error && Array.isArray(data)) {
          setPayments(data as any[]);
          // revenue trend
          const map = new Map<string, number>();
          (data as any[]).forEach((p) => {
            const d = new Date(p.created_at).toLocaleDateString('en-IN');
            map.set(d, (map.get(d) || 0) + (p.amount || 0));
          });
          const arr = Array.from(map.entries()).sort((a,b)=> new Date(a[0]).getTime()-new Date(b[0]).getTime());
          setRevenueTrend({ labels: arr.map(a=>a[0]), values: arr.map(a=>a[1]) });
        }
      } catch (e) {
        // ignore
      }

      try {
        const { data: exp, error: expErr } = await supabase.from('expenses').select('category,amount');
        if (!expErr && Array.isArray(exp)) {
          const m = new Map<string, number>();
          exp.forEach((r:any)=> m.set((r.category||'Uncategorized'), (m.get(r.category)||0)+(r.amount||0)));
          const labels = Array.from(m.keys());
          const values = Array.from(m.values());
          setExpensesByCategory({ labels, values });
        }
      } catch (e) {}
    };
    fetchPayments();
  }, []);

  useEffect(() => {
    // derive top suppliers from procurements
    const m = new Map<string, number>();
    records.forEach((r) => { if (r.supplier) m.set(r.supplier, (m.get(r.supplier)||0) + ((r.price||0) * (r.quantity||0))); });
    const arr = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]);
    setTopSuppliers(arr.slice(0,6) as [string, number][]);
  }, [records]);

  const computeInventoryValuation = () => {
    // group by item and simulate FIFO/LIFO
    let totalCost = 0; let totalQty = 0;
    const groups = new Map<string, ProcurementItem[]>();
    records.forEach(r=>{ const arr = groups.get(r.item_name) || []; arr.push(r); groups.set(r.item_name, arr); });

    for (const [item, items] of Array.from(groups.entries())) {
      const list = (items.slice() as ProcurementItem[]).sort((a: ProcurementItem, b: ProcurementItem) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
      const seq = valuationMethod === 'FIFO' ? list : list.slice().reverse();
      for (const rec of seq) {
        const qty = rec.quantity || 0; const unitCost = (rec.price || 0) + logisticsPerUnit;
        totalCost += qty * unitCost; totalQty += qty;
      }
    }
    const perUnitCost = totalQty ? totalCost / totalQty : 0;
    setInventoryValuationResult({ totalCost, perUnitCost });
  };

  const computeGrossMargin = async () => {
    // revenue from payments, cost from procurements
    const revenue = payments.reduce((s,p)=> s + (p.amount||0), 0);
    const cost = records.reduce((s,r)=> s + ((r.price||0) * (r.quantity||0)), 0) + (logisticsPerUnit * records.reduce((s,r)=> s + (r.quantity||0), 0));
    const margin = revenue ? ((revenue - cost) / revenue) * 100 : 0;
    setGrossMargin({ revenue, cost, margin });
  };

  const addRecord = async () => {
    try {
      if (!itemName || !quantity) {
        toast({ title: 'Missing fields', description: 'Item name and quantity are required', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setLoading(true);
      const payload: any = {
        item_name: itemName,
        quantity,
        supplier: supplier || null,
        purchase_date: purchaseDate || null,
        price: price === '' ? null : Number(price),
        notes: notes || null,
      };
      const { data, error } = await supabase.from('procurements').insert([payload]).select('*');
      if (error) throw error as any;
      setRecords([...(data as any), ...(records || [])]);
      setItemName(''); setQuantity(0); setSupplier(''); setPurchaseDate(''); setPrice(''); setNotes('');
      toast({ title: 'Procurement saved', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <Text mb={2}>Table "procurements" not found. Create it in your database to enable procurement storage.</Text>
          <Text fontWeight="semibold" mb={1}>SQL to create table:</Text>
          <Code display="block" whiteSpace="pre" p={3} borderRadius="md">
{`CREATE TABLE IF NOT EXISTS procurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  supplier VARCHAR(255),
  purchase_date DATE,
  price DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_on_procurements ON procurements;
CREATE TRIGGER set_updated_at_on_procurements
BEFORE UPDATE ON procurements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();`}
          </Code>
        </Box>
      </Alert>
    );
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Procurement</Heading>
      <Card mb={6}><CardBody>
        <VStack align="stretch" spacing={3}>
          <HStack align="flex-start">
            <Input placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <Input type="number" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} w="120px" />
            <Input placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <Input type="date" placeholder="Purchase date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} w="200px" />
            <Input type="number" step="0.01" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))} w="160px" />
          </HStack>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <HStack>
            <Button colorScheme="green" onClick={addRecord} isLoading={loading}>Save Procurement</Button>
          </HStack>
        </VStack>
      </CardBody></Card>

      <Table variant="simple" size="sm">
        <Thead>
          <Tr>
            <Th>Item</Th>
            <Th>Qty</Th>
            <Th>Supplier</Th>
            <Th>Purchase Date</Th>
            <Th isNumeric>Price</Th>
            <Th>Created</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {records.map((r) => (
            <Tr key={r.id}>
              <Td>{editing?.id === r.id ? (<Input value={editing.item_name} onChange={(e)=>setEditing({ ...editing!, item_name: e.target.value })} />) : r.item_name}</Td>
              <Td>{editing?.id === r.id ? (<Input type="number" value={editing.quantity} onChange={(e)=>setEditing({ ...editing!, quantity: Number(e.target.value) })} />) : r.quantity}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.supplier || ''} onChange={(e)=>setEditing({ ...editing!, supplier: e.target.value })} />) : (r.supplier || '-')}</Td>
              <Td>{editing?.id === r.id ? (<Input type="date" value={editing.purchase_date ? String(editing.purchase_date).slice(0,10) : ''} onChange={(e)=>setEditing({ ...editing!, purchase_date: e.target.value })} />) : (r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : '-')}</Td>
              <Td isNumeric>{editing?.id === r.id ? (<Input type="number" step="0.01" value={typeof editing.price === 'number' ? editing.price : ''} onChange={(e)=>setEditing({ ...editing!, price: Number(e.target.value) })} />) : (typeof r.price === 'number' ? r.price.toFixed(2) : '-')}</Td>
              <Td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</Td>
              <Td>
                {editing?.id === r.id ? (
                  <HStack>
                    <Button size="sm" colorScheme="green" onClick={async ()=>{
                      try{
                        setLoading(true);
                        const payload:any={ item_name: editing.item_name, quantity: editing.quantity, supplier: editing.supplier || null, purchase_date: editing.purchase_date || null, price: editing.price ?? null, notes: editing.notes || null };
                        const { data, error } = await supabase.from('procurements').update(payload).eq('id', r.id).select('*');
                        if(error) throw error as any;
                        setRecords(records.map(x=>x.id===r.id ? (data as any)[0] : x));
                        setEditing(null);
                        toast({ title:'Updated', status:'success', duration:2000});
                      }catch(e:any){ toast({ title:'Failed to update', description:e?.message||String(e), status:'error', duration:4000}); }
                      finally{ setLoading(false); }
                    }}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={()=>setEditing(null)}>Cancel</Button>
                  </HStack>
                ) : (
                  <HStack>
                    <Button size="sm" onClick={()=>setEditing(r)}>Edit</Button>
                    <Button size="sm" colorScheme="red" onClick={async ()=>{
                      try{ const { error } = await supabase.from('procurements').delete().eq('id', r.id); if(error) throw error as any; setRecords(records.filter(x=>x.id!==r.id)); toast({ title:'Deleted', status:'success', duration:2000}); }catch(e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error', duration:4000}); }
                    }}>Delete</Button>
                  </HStack>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Procurement analytics and valuation */}
      <Box mt={6}>
        <Card mb={4}>
          <CardBody>
            <Heading size="md" mb={3}>Procurement Analytics</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box>
                <Text fontWeight="semibold" mb={2}>Revenue Trend (recent)</Text>
                {revenueTrend.labels.length > 0 ? (
                  <Table size="sm" variant="simple">
                    <Thead><Tr><Th>Date</Th><Th isNumeric>Amount</Th></Tr></Thead>
                    <Tbody>
                      {revenueTrend.labels.slice(-12).map((d,i)=> (<Tr key={d}><Td>{d}</Td><Td isNumeric>{(revenueTrend.values[i]||0).toLocaleString('en-IN')}</Td></Tr>))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text fontSize="sm" color="gray.500">No payment data</Text>
                )}
              </Box>

              <Box>
                <Text fontWeight="semibold" mb={2}>Expenses by Category</Text>
                {expensesByCategory.labels.length > 0 ? (
                  <Table size="sm" variant="simple">
                    <Thead><Tr><Th>Category</Th><Th isNumeric>Amount</Th></Tr></Thead>
                    <Tbody>
                      {expensesByCategory.labels.map((l,idx)=>(<Tr key={l}><Td>{l}</Td><Td isNumeric>{expensesByCategory.values[idx]||0}</Td></Tr>))}
                    </Tbody>
                  </Table>
                ) : (
                  <Text fontSize="sm" color="gray.500">No expense data</Text>
                )}
              </Box>
            </SimpleGrid>

            <Box mt={4}>
              <Text fontWeight="semibold" mb={2}>Top Suppliers</Text>
              {topSuppliers.length > 0 ? (
                <Table size="sm" variant="simple">
                  <Thead><Tr><Th>Supplier</Th><Th isNumeric>Spend</Th></Tr></Thead>
                  <Tbody>
                    {topSuppliers.map(([s,amt])=> (<Tr key={s}><Td>{s}</Td><Td isNumeric>{inr(amt)}</Td></Tr>))}
                  </Tbody>
                </Table>
              ) : (
                <Text fontSize="sm" color="gray.500">No suppliers yet</Text>
              )}
            </Box>

            <Box mt={4}>
              <Text fontWeight="semibold" mb={2}>Inventory Valuation & Costing</Text>
              <HStack spacing={3} mb={3}>
                <Select value={valuationMethod} onChange={(e)=> setValuationMethod(e.target.value as any)} maxW="160px">
                  <option value="FIFO">FIFO</option>
                  <option value="LIFO">LIFO</option>
                </Select>
                <Input type="number" value={logisticsPerUnit} onChange={(e)=> setLogisticsPerUnit(Number(e.target.value||0))} placeholder="Logistics per unit" maxW="180px" />
                <Button colorScheme="green" onClick={()=>{ computeInventoryValuation(); computeGrossMargin(); }}>Compute</Button>
              </HStack>

              {inventoryValuationResult && (
                <Text>Inventory total cost: {inr(inventoryValuationResult.totalCost)} · Per unit cost: {inr(inventoryValuationResult.perUnitCost)}</Text>
              )}
              {grossMargin && (
                <Text mt={2}>Gross margin: {grossMargin.margin.toFixed(2)}% (Revenue {inr(grossMargin.revenue)} · Cost {inr(grossMargin.cost)})</Text>
              )}
            </Box>
          </CardBody>
        </Card>
      </Box>

    </Box>
  );
};

export default Procurement;
