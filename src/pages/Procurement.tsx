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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
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

  // Procurement modules data
  interface PurchaseOrder { id?: string; supplier: string; items: string; order_date?: string; expected_delivery?: string; total_amount?: number; status?: string; }
  interface SupplierInvoice { id?: string; invoice_number: string; supplier: string; date?: string; amount?: number; status?: 'paid'|'unpaid'|'pending'; }
  interface PurchaseReturn { id?: string; reference_id?: string; supplier?: string; date?: string; amount?: number; reason?: string; }
  interface CostEntry { id?: string; item_name: string; material_cost: number; logistics_cost: number; per_unit_cost?: number; created_at?: string; }

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [returnsList, setReturnsList] = useState<PurchaseReturn[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);

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

  useEffect(() => { fetchRecords(); fetchOrders(); fetchInvoices(); fetchReturns(); fetchCostEntries(); }, []);

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

  // Purchase Orders, Invoices, Returns, Cost entries fetchers
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
      if (!error) setPurchaseOrders((data as any) || []);
    } catch (e:any){ console.warn('fetchOrders', e); }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase.from('supplier_invoices').select('*').order('date', { ascending: false });
      if (!error) setInvoices((data as any) || []);
    } catch (e:any){ console.warn('fetchInvoices', e); }
  };

  const fetchReturns = async () => {
    try {
      const { data, error } = await supabase.from('purchase_returns').select('*').order('date', { ascending: false });
      if (!error) setReturnsList((data as any) || []);
    } catch (e:any){ console.warn('fetchReturns', e); }
  };

  const fetchCostEntries = async () => {
    try {
      const { data, error } = await supabase.from('cost_entries').select('*').order('created_at', { ascending: false });
      if (!error) setCostEntries((data as any) || []);
    } catch (e:any){ console.warn('fetchCostEntries', e); }
  };

  // Helper actions
  const markInvoicePaid = async (id?: string) => {
    if (!id) return;
    try { const { error } = await supabase.from('supplier_invoices').update({ status: 'paid' }).eq('id', id); if (error) throw error; await fetchInvoices(); toast({ title:'Invoice marked paid', status:'success' }); } catch (e:any) { toast({ title:'Failed', description:e?.message||String(e), status:'error' }); }
  };

  const deleteOrder = async (id?: string) => { if (!id) return; try { const { error } = await supabase.from('purchase_orders').delete().eq('id', id); if (error) throw error; await fetchOrders(); toast({ title:'Order deleted', status:'success' }); } catch (e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error' }); } };

  const deleteInvoice = async (id?: string) => { if (!id) return; try { const { error } = await supabase.from('supplier_invoices').delete().eq('id', id); if (error) throw error; await fetchInvoices(); toast({ title:'Invoice deleted', status:'success' }); } catch (e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error' }); } };

  const deleteReturn = async (id?: string) => { if (!id) return; try { const { error } = await supabase.from('purchase_returns').delete().eq('id', id); if (error) throw error; await fetchReturns(); toast({ title:'Return deleted', status:'success' }); } catch (e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error' }); } };

  const deleteCostEntry = async (id?: string) => { if (!id) return; try { const { error } = await supabase.from('cost_entries').delete().eq('id', id); if (error) throw error; await fetchCostEntries(); toast({ title:'Cost entry deleted', status:'success' }); } catch (e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error' }); } };

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

    for (const item of Array.from(groups.keys())) {
      const items = groups.get(item) || [];
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
      <Tabs colorScheme="green" variant="enclosed">
        <TabList>
          <Tab>Procurements</Tab>
          <Tab>Purchase Orders</Tab>
          <Tab>Supplier Invoices</Tab>
          <Tab>Returns & Debit Notes</Tab>
          <Tab>Costing</Tab>
          <Tab>Inventory Valuation</Tab>
          <Tab>Analysis</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
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

          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Purchase Orders</Heading>
            <Card mb={4}><CardBody>
              <VStack align="stretch">
                <HStack>
                  <Input placeholder="Supplier" id="po_supplier" />
                  <Input placeholder="Items (comma separated)" id="po_items" />
                  <Input type="date" placeholder="Order date" id="po_date" />
                  <Input type="date" placeholder="Expected delivery" id="po_expected" />
                  <Input type="number" placeholder="Total amount" id="po_total" />
                </HStack>
                <HStack>
                  <Button onClick={async ()=>{
                    const supplierEl = (document.getElementById('po_supplier') as HTMLInputElement);
                    const itemsEl = (document.getElementById('po_items') as HTMLInputElement);
                    const dateEl = (document.getElementById('po_date') as HTMLInputElement);
                    const expectedEl = (document.getElementById('po_expected') as HTMLInputElement);
                    const totalEl = (document.getElementById('po_total') as HTMLInputElement);
                    const payload: PurchaseOrder = { supplier: supplierEl?.value||'', items: itemsEl?.value||'', order_date: dateEl?.value||null, expected_delivery: expectedEl?.value||null, total_amount: Number(totalEl?.value||0), status: 'pending' };
                    try{
                      const { data, error } = await supabase.from('purchase_orders').insert([payload]).select('*');
                      if(error) throw error;
                      await fetchOrders();
                      toast({ title:'Order saved', status:'success' });
                    }catch(e:any){ toast({ title:'Failed to save order', description:e?.message||String(e), status:'error' }); }
                  }} colorScheme="green">Add Order</Button>
                </HStack>
              </VStack>
            </CardBody></Card>

            <Table size="sm" variant="simple">
              <Thead><Tr><Th>Supplier</Th><Th>Items</Th><Th>Order Date</Th><Th>Expected</Th><Th isNumeric>Amount</Th><Th>Status</Th></Tr></Thead>
              <Tbody>
                {purchaseOrders.map((o) => (<Tr key={o.id}><Td>{o.supplier}</Td><Td>{o.items}</Td><Td>{o.order_date ? new Date(o.order_date).toLocaleDateString() : '-'}</Td><Td>{o.expected_delivery ? new Date(o.expected_delivery).toLocaleDateString() : '-'}</Td><Td isNumeric>{inr(o.total_amount||0)}</Td><Td>{o.status}</Td></Tr>))}
                {purchaseOrders.length===0 && (<Tr><Td colSpan={6} textAlign="center">No orders</Td></Tr>)}
              </Tbody>
            </Table>
          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Supplier Invoices</Heading>
            <Card mb={4}><CardBody>
              <HStack>
                <Input placeholder="Invoice #" id="inv_number" />
                <Input placeholder="Supplier" id="inv_supplier" />
                <Input type="date" id="inv_date" />
                <Input type="number" placeholder="Amount" id="inv_amount" />
                <Select id="inv_status" maxW="160px"><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="pending">Pending</option></Select>
                <Button colorScheme="green" onClick={async ()=>{
                  const num = (document.getElementById('inv_number') as HTMLInputElement).value;
                  const sup = (document.getElementById('inv_supplier') as HTMLInputElement).value;
                  const d = (document.getElementById('inv_date') as HTMLInputElement).value;
                  const amt = Number((document.getElementById('inv_amount') as HTMLInputElement).value||0);
                  const st = (document.getElementById('inv_status') as HTMLSelectElement).value as any;
                  const payload: SupplierInvoice = { invoice_number: num, supplier: sup, date: d||null, amount: amt, status: st };
                  try{ const { data, error } = await supabase.from('supplier_invoices').insert([payload]).select('*'); if(error) throw error; await fetchInvoices(); toast({ title:'Invoice saved', status:'success' }); }catch(e:any){ toast({ title:'Failed to save', description:e?.message||String(e), status:'error' }); }
                }}>Add Invoice</Button>
              </HStack>
            </CardBody></Card>

            <Table size="sm" variant="simple">
              <Thead><Tr><Th>Invoice #</Th><Th>Supplier</Th><Th>Date</Th><Th isNumeric>Amount</Th><Th>Status</Th><Th>Actions</Th></Tr></Thead>
              <Tbody>
                {invoices.map(inv=> (<Tr key={inv.id}><Td>{inv.invoice_number}</Td><Td>{inv.supplier}</Td><Td>{inv.date ? new Date(inv.date).toLocaleDateString() : '-'}</Td><Td isNumeric>{inr(inv.amount||0)}</Td><Td>{inv.status}</Td><Td><Button size="sm" onClick={async ()=>{ try{ const { data, error } = await supabase.from('supplier_invoices').update({ status: 'paid' }).eq('id', inv.id).select('*'); if(error) throw error; await fetchInvoices(); toast({ title:'Marked paid', status:'success'}); }catch(e:any){ toast({ title:'Failed', description:e?.message||String(e) }); } }}>Mark Paid</Button></Td></Tr>))}
                {invoices.length===0 && (<Tr><Td colSpan={6} textAlign="center">No invoices</Td></Tr>)}
              </Tbody>
            </Table>
          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Purchase Returns & Debit Notes</Heading>
            <Card mb={4}><CardBody>
              <HStack>
                <Input placeholder="Reference ID" id="ret_ref" />
                <Input placeholder="Supplier" id="ret_supplier" />
                <Input type="date" id="ret_date" />
                <Input type="number" placeholder="Amount" id="ret_amount" />
                <Input placeholder="Reason" id="ret_reason" />
                <Button colorScheme="green" onClick={async ()=>{ const ref=(document.getElementById('ret_ref') as HTMLInputElement).value; const sup=(document.getElementById('ret_supplier') as HTMLInputElement).value; const d=(document.getElementById('ret_date') as HTMLInputElement).value; const amt=Number((document.getElementById('ret_amount') as HTMLInputElement).value||0); const reason=(document.getElementById('ret_reason') as HTMLInputElement).value; const payload: PurchaseReturn = { reference_id: ref, supplier: sup, date: d||null, amount: amt, reason }; try{ const { data, error } = await supabase.from('purchase_returns').insert([payload]).select('*'); if(error) throw error; await fetchReturns(); toast({ title:'Return saved', status:'success' }); }catch(e:any){ toast({ title:'Failed', description:e?.message||String(e), status:'error' }); } }}>Add Return</Button>
              </HStack>
            </CardBody></Card>

            <Table size="sm" variant="simple">
              <Thead><Tr><Th>Reference</Th><Th>Supplier</Th><Th>Date</Th><Th isNumeric>Amount</Th><Th>Reason</Th></Tr></Thead>
              <Tbody>
                {returnsList.map(r=> (<Tr key={r.id}><Td>{r.reference_id}</Td><Td>{r.supplier}</Td><Td>{r.date ? new Date(r.date).toLocaleDateString() : '-'}</Td><Td isNumeric>{inr(r.amount||0)}</Td><Td>{r.reason}</Td></Tr>))}
                {returnsList.length===0 && (<Tr><Td colSpan={5} textAlign="center">No returns</Td></Tr>)}
              </Tbody>
            </Table>
          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Cost per Unit Tracking</Heading>
            <Card mb={4}><CardBody>
              <HStack>
                <Input placeholder="Item name" id="cost_item" />
                <Input type="number" placeholder="Material cost" id="cost_material" />
                <Input type="number" placeholder="Logistics cost" id="cost_logistics" />
                <Button colorScheme="green" onClick={async ()=>{ const name=(document.getElementById('cost_item') as HTMLInputElement).value; const mat=Number((document.getElementById('cost_material') as HTMLInputElement).value||0); const log=Number((document.getElementById('cost_logistics') as HTMLInputElement).value||0); const per = mat + log; const payload: CostEntry = { item_name: name, material_cost: mat, logistics_cost: log, per_unit_cost: per }; try{ const { data, error } = await supabase.from('cost_entries').insert([payload]).select('*'); if(error) throw error; await fetchCostEntries(); toast({ title:'Cost entry saved', status:'success' }); }catch(e:any){ toast({ title:'Failed', description:e?.message||String(e), status:'error' }); } }}>Add Cost</Button>
              </HStack>
            </CardBody></Card>

            <Table size="sm" variant="simple">
              <Thead><Tr><Th>Item</Th><Th isNumeric>Material</Th><Th isNumeric>Logistics</Th><Th isNumeric>Per Unit</Th></Tr></Thead>
              <Tbody>
                {costEntries.map(c=> (<Tr key={c.id}><Td>{c.item_name}</Td><Td isNumeric>{inr(c.material_cost||0)}</Td><Td isNumeric>{inr(c.logistics_cost||0)}</Td><Td isNumeric>{inr(c.per_unit_cost||0)}</Td></Tr>))}
                {costEntries.length===0 && (<Tr><Td colSpan={4} textAlign="center">No cost entries</Td></Tr>)}
              </Tbody>
            </Table>
          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Inventory Valuation</Heading>
            <Card mb={4}><CardBody>
              <HStack spacing={3} mb={3}>
                <Select value={valuationMethod} onChange={(e)=> setValuationMethod(e.target.value as any)} maxW="160px">
                  <option value="FIFO">FIFO</option>
                  <option value="LIFO">LIFO</option>
                </Select>
                <Input type="number" value={logisticsPerUnit} onChange={(e)=> setLogisticsPerUnit(Number(e.target.value||0))} placeholder="Logistics per unit" maxW="180px" />
                <Button colorScheme="green" onClick={()=>{ computeInventoryValuation(); }}>Compute Valuation</Button>
              </HStack>
              {inventoryValuationResult && (<Text>Inventory total cost: {inr(inventoryValuationResult.totalCost)} · Per unit cost: {inr(inventoryValuationResult.perUnitCost)}</Text>)}
            </CardBody></Card>
          </TabPanel>

          <TabPanel>
            <Heading size="md" mb={4}>Analysis & Gross Margin</Heading>
            <Card mb={4}><CardBody>
              <VStack align="stretch">
                <HStack>
                  <Input type="number" placeholder="Logistics per unit (override)" value={logisticsPerUnit} onChange={(e)=> setLogisticsPerUnit(Number(e.target.value||0))} />
                  <Button colorScheme="green" onClick={() => computeGrossMargin()}>Compute Gross Margin</Button>
                </HStack>
                {grossMargin ? (<Text>Gross margin: {grossMargin.margin.toFixed(2)}% · Revenue: {inr(grossMargin.revenue)} · Cost: {inr(grossMargin.cost)}</Text>) : (<Text color="gray.500">No metrics computed yet</Text>)}
              </VStack>
            </CardBody></Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

    </Box>
  );
};

export default Procurement;
