import React, { useEffect, useState } from 'react';
import { Box, Heading, VStack, HStack, Input, Button, Table, Thead, Tbody, Tr, Th, Td, useToast, Alert, AlertIcon, Text, Card, CardBody, IconButton } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

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

interface EditState {
  id: string;
  date: string;
  item: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: string;
  reference: string;
  vehicle: string;
  expected_date: string;
  notes: string;
  tracking_no: string;
}

const Logistics: React.FC = () => {
  const [rows, setRows] = useState<LogisticsRecord[]>([]);
  const [dateVal, setDateVal] = useState<string>(new Date().toISOString().slice(0,10));
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [status, setStatus] = useState<'Pending'|'Shipped'|'Delivered'>('Pending');
  const [reference, setReference] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [expected, setExpected] = useState('');
  const [tracking, setTracking] = useState('');
  const [notes, setNotes] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const toast = useToast();

  const fetchRows = async () => {
    try {
      const { data, error } = await supabase
        .from('logistics')
        .select('*')
        .order('date', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) {
        if ((error as any).code === 'PGRST116') { setTableMissing(true); return; }
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
      setDateVal(new Date().toISOString().slice(0,10)); setItem(''); setQuantity(1); setFromLoc(''); setToLoc(''); setStatus('Pending'); setReference(''); setVehicle(''); setExpected(''); setTracking(''); setNotes('');
      toast({ title: 'Logistics added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add logistics', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally { setLoading(false); }
  };

  const startEdit = (r: LogisticsRecord) => {
    setEditing({
      id: r.id,
      date: r.date || new Date().toISOString().slice(0,10),
      item: r.item || '',
      quantity: r.quantity || 1,
      from_location: r.from_location || '',
      to_location: r.to_location || '',
      status: (r.status as any) || 'Pending',
      reference: r.reference || '',
      vehicle: r.vehicle || '',
      expected_date: r.expected_date || '',
      notes: r.notes || '',
      tracking_no: r.tracking_no || ''
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      setLoading(true);
      const payload: any = {
        date: editing.date || null,
        item: editing.item,
        quantity: editing.quantity,
        from_location: editing.from_location,
        to_location: editing.to_location,
        status: editing.status,
        reference: editing.reference || null,
        vehicle: editing.vehicle || null,
        expected_date: editing.expected_date || null,
        notes: editing.notes || null,
        tracking_no: editing.tracking_no || null,
      };
      const { data, error } = await supabase.from('logistics').update(payload).eq('id', editing.id).select('*');
      if (error) throw error as any;
      setRows(rows.map(r => (r.id === editing.id ? (data as any)[0] : r)));
      setEditing(null);
      toast({ title: 'Updated', status: 'success', duration: 2000 });
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message || String(e), status: 'error', duration: 4000 });
    } finally { setLoading(false); }
  };

  const deleteRow = async (id: string) => {
    try {
      const { error } = await supabase.from('logistics').delete().eq('id', id);
      if (error) throw error as any;
      setRows(rows.filter(r => r.id !== id));
      toast({ title: 'Deleted', status: 'success', duration: 2000 });
    } catch (e: any) {
      toast({ title: 'Failed to delete', description: e?.message || String(e), status: 'error', duration: 4000 });
    }
  };

  useEffect(() => { fetchRows(); }, []);

  if (tableMissing) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Text>Table "logistics" not found. Please create it in Supabase to enable logistics tracking.</Text>
      </Alert>
    );
  }

  return (
    <Box>
      <Heading size="lg" mb={4}>Logistics</Heading>
      <Card mb={6}><CardBody>
        <VStack align="stretch" spacing={3}>
          <HStack wrap="wrap" spacing={3}>
            <Input type="date" value={dateVal} onChange={(e)=>setDateVal(e.target.value)} w="160px" />
            <Input placeholder="Item" value={item} onChange={(e)=>setItem(e.target.value)} w="180px" />
            <Input type="number" placeholder="Qty" min={1} value={quantity} onChange={(e)=>setQuantity(Math.max(1, Number(e.target.value)))} w="100px" />
            <Input placeholder="From (Location)" value={fromLoc} onChange={(e)=>setFromLoc(e.target.value)} w="160px" />
            <Input placeholder="To (Location)" value={toLoc} onChange={(e)=>setToLoc(e.target.value)} w="160px" />
            <Input as="select" value={status} onChange={(e)=>setStatus(e.target.value as any)} w="160px">
              <option value="Pending">Pending</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
            </Input>
            <Input placeholder="Reference (PO/Invoice)" value={reference} onChange={(e)=>setReference(e.target.value)} w="160px" />
            <Input placeholder="Vehicle (No./Type)" value={vehicle} onChange={(e)=>setVehicle(e.target.value)} w="140px" />
            <Input type="date" placeholder="Expected Delivery" value={expected} onChange={(e)=>setExpected(e.target.value)} w="160px" />
            <Input placeholder="Tracking (AWB/Ref)" value={tracking} onChange={(e)=>setTracking(e.target.value)} w="160px" />
            <Input placeholder="Notes" value={notes} onChange={(e)=>setNotes(e.target.value)} w="220px" />
            <Button colorScheme="green" onClick={addRow} isLoading={loading}>Add</Button>
          </HStack>
        </VStack>
      </CardBody></Card>

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
            <Th>Updated</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>{editing?.id === r.id ? (<Input type="date" value={editing.date} onChange={(e)=>setEditing({...editing!, date:e.target.value})} />) : (r.date ? new Date(r.date).toLocaleDateString() : '')}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.item} onChange={(e)=>setEditing({...editing!, item:e.target.value})} />) : r.item}</Td>
              <Td>{editing?.id === r.id ? (<Input type="number" value={editing.quantity} onChange={(e)=>setEditing({...editing!, quantity:Number(e.target.value)})} />) : r.quantity}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.from_location} onChange={(e)=>setEditing({...editing!, from_location:e.target.value})} />) : r.from_location}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.to_location} onChange={(e)=>setEditing({...editing!, to_location:e.target.value})} />) : r.to_location}</Td>
              <Td>{editing?.id === r.id ? (
                <Input as="select" value={editing.status} onChange={(e)=>setEditing({...editing!, status:e.target.value})}>
                  <option value="Pending">Pending</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                </Input>
              ) : r.status}
              </Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.reference} onChange={(e)=>setEditing({...editing!, reference:e.target.value})} />) : (r.reference || '-')}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.vehicle} onChange={(e)=>setEditing({...editing!, vehicle:e.target.value})} />) : (r.vehicle || '-')}</Td>
              <Td>{editing?.id === r.id ? (<Input type="date" value={editing.expected_date} onChange={(e)=>setEditing({...editing!, expected_date:e.target.value})} />) : (r.expected_date ? new Date(r.expected_date).toLocaleDateString() : '-')}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.tracking_no} onChange={(e)=>setEditing({...editing!, tracking_no:e.target.value})} />) : (r.tracking_no || '-')}</Td>
              <Td>{editing?.id === r.id ? (<Input value={editing.notes} onChange={(e)=>setEditing({...editing!, notes:e.target.value})} />) : (r.notes || '-')}</Td>
              <Td>{r.updated_at ? new Date(r.updated_at).toLocaleString() : '-'}</Td>
              <Td>
                {editing?.id === r.id ? (
                  <HStack>
                    <Button size="sm" colorScheme="green" onClick={saveEdit} isLoading={loading}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </HStack>
                ) : (
                  <HStack>
                    <Button size="sm" onClick={() => startEdit(r)}>Edit</Button>
                    <Button size="sm" colorScheme="red" onClick={() => deleteRow(r.id)}>Delete</Button>
                  </HStack>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default Logistics;
