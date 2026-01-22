import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Input,
  HStack,
  VStack,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Select,
  useToast,
  Badge,
  Card,
  CardHeader,
  CardBody,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, EditIcon, RepeatIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';

interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at?: string;
}

const UsersManagement: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();

  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id,email,role,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data as any) || []);
    } catch (e: any) {
      toast({ title: 'Failed to load users', description: e?.message || String(e), status: 'error', duration: 5000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q));
  }, [users, search]);

  const handleCreate = async () => {
    try {
      if (!newUser.email || !newUser.password) {
        toast({ title: 'Email and password required', status: 'warning', duration: 3000, isClosable: true });
        return;
      }
      setCreating(true);
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { emailRedirectTo: `${window.location.origin}/reset-password` },
      });
      if (error) throw error;
      // Row in public.users will be created by DB trigger after signup/verification
      toast({ title: 'User invited', description: 'A verification email has been sent. User appears after signup/verification.', status: 'success', duration: 5000, isClosable: true });
      onClose();
      setNewUser({ email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e?.message || String(e), status: 'error', duration: 6000, isClosable: true });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: AppUser) => { setEditUser(u); onEditOpen(); };

  const handleUpdate = async () => {
    if (!editUser) return;
    try {
      setUpdating(true);
      const { error } = await supabase.from('users').update({ role: editUser.role, email: editUser.email }).eq('id', editUser.id);
      if (error) throw error;
      toast({ title: 'User updated', status: 'success', duration: 3000, isClosable: true });
      onEditClose();
      setEditUser(null);
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || String(e), status: 'error', duration: 6000, isClosable: true });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'User removed', status: 'success', duration: 3000, isClosable: true });
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || String(e), status: 'error', duration: 6000, isClosable: true });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
        <Heading size="lg" color="gray.800">Users</Heading>
        <HStack>
          <Button leftIcon={<RepeatIcon />} variant="outline" onClick={fetchUsers} isLoading={loading}>Refresh</Button>
          <Button leftIcon={<AddIcon />} colorScheme="green" onClick={onOpen}>Add User</Button>
        </HStack>
      </HStack>

      <Card mb={4}>
        <CardBody>
          <HStack>
            <Input placeholder="Search by email or role" value={search} onChange={(e) => setSearch(e.target.value)} />
          </HStack>
        </CardBody>
      </Card>

      <TableContainer>
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Created</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map(u => (
              <Tr key={u.id} _hover={{ bg: 'gray.50' }}>
                <Td>{u.email}</Td>
                <Td>
                  <Badge colorScheme={u.role === 'admin' ? 'purple' : u.role === 'finance' ? 'green' : 'gray'} textTransform="capitalize">{u.role || 'user'}</Badge>
                </Td>
                <Td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</Td>
                <Td textAlign="right">
                  <HStack justify="flex-end">
                    <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" onClick={() => openEdit(u)} />
                    <IconButton aria-label="Delete" colorScheme="red" variant="outline" icon={<DeleteIcon />} size="sm" isLoading={deleting === u.id} onClick={() => handleDelete(u.id)} />
                  </HStack>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <Tr>
                <Td colSpan={4}>
                  <Text color="gray.500" textAlign="center" py={6}>No users found</Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Create */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add User</ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="green" onClick={handleCreate} isLoading={creating}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input value={editUser?.email || ''} onChange={(e) => setEditUser(prev => prev ? { ...prev, email: e.target.value } : prev)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select value={editUser?.role || 'user'} onChange={(e) => setEditUser(prev => prev ? { ...prev, role: e.target.value } : prev)}>
                  <option value="user">User</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onEditClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleUpdate} isLoading={updating}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default UsersManagement;
