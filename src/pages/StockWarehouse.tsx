import React, { useEffect, useState } from 'react';
import { Box, Heading, VStack, HStack, Input, Button, Table, Thead, Tbody, Tr, Th, Td, useToast, Alert, AlertIcon, Text, Card, CardBody } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

interface StockItem {
  id: string;
  item_name: string;
  quantity: number;
  location?: string;
  notes?: string;
  updated_at?: string;
}

interface EditState { id: string; item_name: string; quantity: number; location: string; notes: string; }

const StockWarehouse: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
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
        throw error as any;
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
      if (error) throw error as any;
      setItems([...(items || []), ...(data as any)]);
      setItemName(''); setQuantity(0); setLocation(''); setNotes('');
      toast({ title: 'Item added', status: 'success', duration: 2000, isClosable: true });
    } catch (e: any) {
      toast({ title: 'Failed to add item', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
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
              <Td>{editing?.id === it.id ? (<Input value={editing.item_name} onChange={(e)=>setEditing({...editing!, item_name:e.target.value})} />) : it.item_name}</Td>
              <Td>{editing?.id === it.id ? (<Input type="number" value={editing.quantity} onChange={(e)=>setEditing({...editing!, quantity:Number(e.target.value)})} />) : it.quantity}</Td>
              <Td>{editing?.id === it.id ? (<Input value={editing.location} onChange={(e)=>setEditing({...editing!, location:e.target.value})} />) : (it.location || '-')}</Td>
              <Td>{editing?.id === it.id ? (<Input value={editing.notes} onChange={(e)=>setEditing({...editing!, notes:e.target.value})} />) : (it.notes || '-')}</Td>
              <Td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '-'}</Td>
              <Td>
                {editing?.id === it.id ? (
                  <HStack>
                    <Button size="sm" colorScheme="green" onClick={async ()=>{
                      try{
                        setLoading(true);
                        const payload:any={ item_name:editing.item_name, quantity:editing.quantity, location:editing.location||null, notes:editing.notes||null };
                        const { data, error } = await supabase.from('stock_warehouse').update(payload).eq('id', it.id).select('*');
                        if(error) throw error as any;
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
                      try{ const { error } = await supabase.from('stock_warehouse').delete().eq('id', it.id); if(error) throw error as any; setItems(items.filter(x=>x.id!==it.id)); toast({ title:'Deleted', status:'success', duration:2000}); }catch(e:any){ toast({ title:'Failed to delete', description:e?.message||String(e), status:'error', duration:4000}); }
                    }}>Delete</Button>
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

export default StockWarehouse;
