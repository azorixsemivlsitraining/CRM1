import React from 'react';
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Flex,
  LinkBox,
  LinkOverlay,
  useColorModeValue,
  Button,
  useToast,
  Image,
  Avatar,
  HStack,
  Spacer,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Divider,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Tile {
  label: string;
  description: string;
  icon: string;
  to: string;
}

const tiles: Tile[] = [
  { label: 'Overall Dashboard', description: 'KPIs and performance overview', icon: '📊', to: '/dashboard' },
  { label: 'Projects', description: 'Track and manage all projects', icon: '📈', to: '/projects' },
  { label: 'Reports', description: 'Insights and analytics', icon: '📑', to: '/reports' },
  { label: 'Service Tickets', description: 'Track and resolve issues', icon: '🎫', to: '/service-tickets' },
  { label: 'Finance', description: 'Billing, payments and receipts', icon: '💰', to: '/finance' },
  { label: 'HR', description: 'User access and team management', icon: '👥', to: '/hr' },
  { label: 'Admin Settings', description: 'System configuration and controls', icon: '⚙️', to: '/admin' },
];

const Welcome: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const titleColor = useColorModeValue('gray.700', 'gray.200');
  const { logout, user, isFinance, isAdmin, allowedModules } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeniedOpen, onOpen: onDeniedOpen, onClose: onDeniedClose } = useDisclosure();

  const operationsModules: Tile[] = [
    { label: 'Stock Warehouse', description: 'Inventory and stock management', icon: '🏭', to: '/stock' },
    { label: 'Procurement', description: 'Purchase orders and suppliers', icon: '🧾', to: '/procurement' },
    { label: 'Logistics', description: 'Dispatches and deliveries', icon: '🚚', to: '/logistics' },
    { label: 'Modules & Inventory', description: 'Module listings and intake', icon: '📦', to: '/logistics/modules' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Logged out', status: 'success', duration: 3000, isClosable: true });
      navigate('/login');
    } catch (e: any) {
      toast({ title: 'Logout failed', description: e?.message || String(e), status: 'error', duration: 4000, isClosable: true });
    }
  };

  const canAccess = (key: string) => isAdmin || (Array.isArray(allowedModules) && allowedModules.includes(key));

  const handleAdminAccess = () => {
    if (isAdmin) {
      navigate('/admin');
    } else {
      onOpen();
    }
  };

  const getKeyFromPath = (path: string) => {
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/projects')) return 'projects';
    if (path.startsWith('/reports')) return 'sales';
    if (path.startsWith('/service-tickets')) return 'serviceTickets';
    if (path.startsWith('/finance') || path.startsWith('/payments')) return 'finance';
    if (path.startsWith('/hr')) return 'hr';
    if (path.startsWith('/stock') || path.startsWith('/procurement') || path.startsWith('/logistics')) return 'operations';
    return 'other';
  };

  const handleOpenPath = (path: string) => {
    const key = getKeyFromPath(path);
    if (key === 'hr') {
      handleHRAccess();
      return;
    }
    navigate(path);
  };

  const handleHRAccess = async () => {
    if (user?.email?.toLowerCase() === 'yellesh@axisogreen.in') {
      navigate('/hr');
      return;
    }
    navigate('/login', { state: { fromHR: true } });
  };

  return (
    <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }} maxW="1200px" mx="auto">
      <Flex mb={6} align="center" gap={4} wrap="wrap">
        <Image src="https://cdn.builder.io/api/v1/image/assets%2F2f195b82614d46a0b777d649ad418b24%2F5065c74f0a374ff4a36efc224f468f09?format=webp&width=800" alt="Axiso Green Energy Logo" h={{ base: '36px', md: '48px' }} w="auto" objectFit="contain" />
        <Box>
          <Heading size={{ base: 'sm', md: 'md' }} color="green.600">Axiso Green Energy</Heading>
          <Text color={titleColor} fontSize={{ base: 'xs', md: 'sm' }}>Sustainable Energy Platform</Text>
        </Box>
        <Spacer />
        <HStack spacing={3} align="center">
          <Avatar size="sm" name={user?.email || 'User'} />
          <Box textAlign="right">
            <Text fontSize="sm" fontWeight="medium">{user?.email?.split('@')[0] || 'User'}</Text>
            <Text fontSize="xs" color="gray.500">{isFinance ? 'Finance User' : 'Standard User'}</Text>
          </Box>
          <Button onClick={handleLogout} colorScheme="red" variant="outline" size="sm">Logout</Button>
        </HStack>
      </Flex>

      {/* Mobile: horizontal scroll tiles */}
      <Text fontSize="xs" color={titleColor} mb={2} display={{ base: 'block', lg: 'none' }}>Swipe to explore modules →</Text>
      <Box display={{ base: 'block', lg: 'none' }} overflowX="auto" pb={2} className="mobile-tiles-scroll" sx={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
        <Flex gap={4} minW="max-content" pr={2}>
          {tiles.map((t) => (
            <LinkBox
              key={t.label}
              as="article"
              role="group"
              minW="260px"
              maxW="260px"
              bg={cardBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="xl"
              p={5}
              boxShadow="sm"
              _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
            >
              <Text fontSize="3xl" mb={2}>{t.icon}</Text>
              <Heading size="sm" mb={1} color="green.600">{t.label}</Heading>
              <Text fontSize="sm" color={titleColor} noOfLines={2}>{t.description}</Text>
              <Box mt={3}>
                {t.label === 'Admin Settings' ? (
                  <LinkOverlay as="button" onClick={handleAdminAccess} color="green.600">Open</LinkOverlay>
                ) : (
                  <LinkOverlay as="button" onClick={() => handleOpenPath(t.to)} color="green.600">Open</LinkOverlay>
                )}
              </Box>
            </LinkBox>
          ))}
        </Flex>
      </Box>

      {/* Desktop/Tablet: grid tiles */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5} display={{ base: 'none', lg: 'grid' }}>
        {tiles.map((t) => (
          <LinkBox
            key={t.label}
            as="article"
            role="group"
            bg={cardBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="xl"
            p={6}
            boxShadow="sm"
            _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
            transition="all 0.2s"
          >
            <Text fontSize="4xl" mb={2}>{t.icon}</Text>
            <Heading size="sm" mb={1} color="green.600">{t.label}</Heading>
            <Text fontSize="sm" color={titleColor}>{t.description}</Text>
            <Box mt={3}>
              {t.label === 'Admin Settings' ? (
                <LinkOverlay as="button" onClick={handleAdminAccess} color="green.600">Open</LinkOverlay>
              ) : (
                <LinkOverlay as="button" onClick={() => handleOpenPath(t.to)} color="green.600">Open</LinkOverlay>
              )}
            </Box>
          </LinkBox>
        ))}
      </SimpleGrid>

      <Divider my={8} />

      {true && (
        <>
      <Heading size={{ base: 'sm', md: 'md' }} color="green.600" mb={3}>Operations Modules</Heading>
      <Text color={titleColor} mb={4}>Jump directly into operations workflows</Text>

      <Box display={{ base: 'block', md: 'none' }} overflowX="auto" pb={2} sx={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
        <Flex gap={4} minW="max-content" pr={2}>
          {operationsModules.map((m) => (
            <LinkBox key={m.label} minW="240px" maxW="240px" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={5} boxShadow="sm" _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }} transition="all 0.2s">
              <Text fontSize="3xl" mb={2}>{m.icon}</Text>
              <Heading size="sm" mb={1} color="green.600">{m.label}</Heading>
              <Text fontSize="sm" color={titleColor} noOfLines={2}>{m.description}</Text>
              <Box mt={3}>
                <LinkOverlay as="button" onClick={() => handleOpenPath(m.to)} color="green.600">Open</LinkOverlay>
              </Box>
            </LinkBox>
          ))}
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={5} display={{ base: 'none', md: 'grid' }}>
        {operationsModules.map((m) => (
          <LinkBox key={m.label} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={6} boxShadow="sm" _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }} transition="all 0.2s">
            <Text fontSize="4xl" mb={2}>{m.icon}</Text>
            <Heading size="sm" mb={1} color="green.600">{m.label}</Heading>
            <Text fontSize="sm" color={titleColor}>{m.description}</Text>
            <Box mt={3}>
              <LinkOverlay as="button" onClick={() => handleOpenPath(m.to)} color="green.600">Open</LinkOverlay>
            </Box>
          </LinkBox>
        ))}
      </SimpleGrid>
        </>
      )}

      {/* No Access Modal */}
      <Modal isOpen={isDeniedOpen} onClose={onDeniedClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>No access</ModalHeader>
          <ModalBody>
            <Text color={titleColor}>You don't have permission to view this module.</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="green" onClick={onDeniedClose}>Back</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Admin Access Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Admin Access Required</ModalHeader>
          <ModalBody>
            <Text color={titleColor} mb={3}>You need to be logged in with an admin account to access Admin Settings.</Text>
            <Text color="gray.600" fontSize="sm">Switch to an admin account to continue.</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="red" onClick={async () => { await logout(); navigate('/login'); }}>Login as Admin</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Welcome;
