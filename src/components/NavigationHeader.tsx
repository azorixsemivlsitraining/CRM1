import React from 'react';
import {
  Box,
  Flex,
  HStack,
  Button,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavButtonProps {
  icon: string;
  label: string;
  to: string;
  isActive: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, to, isActive }) => {
  const activeBg = 'green.50';
  const activeColor = 'green.600';
  const hoverBg = 'gray.50';
  
  return (
    <Button
      as={RouterLink}
      to={to}
      variant="ghost"
      size="lg"
      bg={isActive ? activeBg : 'transparent'}
      color={isActive ? activeColor : 'gray.600'}
      fontWeight={isActive ? 'semibold' : 'medium'}
      _hover={{
        bg: isActive ? activeBg : hoverBg,
      }}
      _active={{}}
      transition="background-color 0.2s"
      borderRadius="lg"
      px={6}
      py={3}
      h="auto"
      leftIcon={<Text fontSize="lg">{icon}</Text>}
    >
      {label}
    </Button>
  );
};

const NavigationHeader = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const headerBg = 'white';
  const borderColor = 'gray.200';
  const reportActiveBg = 'green.50';
  const reportActiveColor = 'green.600';
  const reportHoverBg = 'gray.50';

  const navigationItems = [
    { icon: '📊', label: 'Dashboard', to: '/dashboard' },
    { icon: '📈', label: 'Projects', to: '/projects' },
    { icon: '📑', label: 'Reports', to: '/reports' },
    { icon: '🎫', label: 'Service Tickets', to: '/service-tickets' },
    { icon: '🏭', label: 'Stock Warehouse', to: '/stock' },
    { icon: '🚚', label: 'Logistics & Supply Chain', to: '/logistics' },
    ...(isAdmin ? [{ icon: '⚙️', label: 'Admin', to: '/admin' }] : []),
  ];

  const path = location.pathname;
  const isOps = path === '/stock' || path.startsWith('/procurement') || path === '/logistics' || path.startsWith('/logistics/');
  const isReports = path === '/reports' || path.startsWith('/reports/');
  const activeModule = isOps
    ? 'operations'
    : isReports
      ? 'reports'
      : path.startsWith('/dashboard')
        ? 'dashboard'
        : path.startsWith('/projects')
          ? 'projects'
          : path.startsWith('/service-tickets')
            ? 'serviceTickets'
            : path.startsWith('/finance') || path.startsWith('/payments')
              ? 'finance'
              : path.startsWith('/admin')
                ? 'admin'
                : path.startsWith('/hr')
                  ? 'hr'
                  : 'other';

  const showItem = (itemLabel: string) => {
    if (activeModule === 'dashboard') return itemLabel === 'Dashboard';
    if (activeModule === 'projects') return itemLabel === 'Projects';
    if (activeModule === 'reports') return itemLabel === 'Reports';
    if (activeModule === 'serviceTickets') return itemLabel === 'Service Tickets';
    if (activeModule === 'admin') return itemLabel === 'Admin';
    if (activeModule === 'hr') return false;
    if (activeModule === 'finance') return itemLabel === 'Finance' || itemLabel === 'Payments';
    if (activeModule === 'operations') {
      const p = location.pathname;
      const isLogistics = p === '/logistics' || p.startsWith('/logistics/');
      if (isLogistics) return itemLabel === 'Logistics & Supply Chain';
      return itemLabel === 'Stock Warehouse';
    }
    return false;
  };

  return (
    <Box 
      bg={headerBg} 
      borderBottom="2px solid" 
      borderColor={borderColor} 
      py={4} 
      px={6}
      shadow="sm"
    >
      <Flex justify="space-between" align="center">
        <HStack spacing={3}>
          <Button as={RouterLink} to="/welcome" variant="outline" size="sm">← Back</Button>
          {navigationItems.filter((it) => showItem(it.label)).map((item) => {
            if (item.label === 'Reports') {
              const active = location.pathname.startsWith('/reports');
              const activeBg = reportActiveBg;
              const activeColor = reportActiveColor;
              const hoverBg = reportHoverBg;
              return (
                <Menu key={item.to} isLazy>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    size="lg"
                    bg={active ? activeBg : 'transparent'}
                    color={active ? activeColor : 'gray.600'}
                    fontWeight={active ? 'semibold' : 'medium'}
                    _hover={{ bg: active ? activeBg : hoverBg }}
                    _active={{}}
                    borderRadius="lg"
                    px={6}
                    py={3}
                    leftIcon={<Text fontSize="lg">{item.icon}</Text>}
                  >
                    {item.label}
                  </MenuButton>
                  <MenuList>
                    <MenuItem as={RouterLink} to="/reports">All Reports</MenuItem>
                    <MenuItem as={RouterLink} to="/reports/tg">TG Reports</MenuItem>
                    <MenuItem as={RouterLink} to="/reports/ap">AP Reports</MenuItem>
                    <MenuItem as={RouterLink} to="/reports/chitoor">Chitoor Reports</MenuItem>
                  </MenuList>
                </Menu>
              );
            }
            if (item.label === 'Logistics & Supply Chain') {
              const active = location.pathname === '/logistics' || location.pathname.startsWith('/logistics/');
              const activeBg = reportActiveBg;
              const activeColor = reportActiveColor;
              const hoverBg = reportHoverBg;
              const isModules = location.pathname.startsWith('/logistics/modules');
              const headerLabel = isModules ? 'Module & Inverter Management' : item.label;
              return (
                <Menu key={item.to} isLazy>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    size="lg"
                    bg={active ? activeBg : 'transparent'}
                    color={active ? activeColor : 'gray.600'}
                    fontWeight={active ? 'semibold' : 'medium'}
                    _hover={{ bg: active ? activeBg : hoverBg }}
                    _active={{}}
                    borderRadius="lg"
                    px={6}
                    py={3}
                    leftIcon={<Text fontSize="lg">{item.icon}</Text>}
                  >
                    {headerLabel}
                  </MenuButton>
                  <MenuList>
                    <MenuItem as={RouterLink} to="/logistics">Logistics (Default)</MenuItem>
                    <MenuItem as={RouterLink} to="/logistics/modules">Module & Inverter Management</MenuItem>
                  </MenuList>
                </Menu>
              );
            }
            if (item.label === 'Stock Warehouse') {
              const active = location.pathname === '/stock' || location.pathname.startsWith('/procurement');
              const activeBg = reportActiveBg;
              const activeColor = reportActiveColor;
              const hoverBg = reportHoverBg;
              const isProcurement = location.pathname.startsWith('/procurement');
              const headerLabel = isProcurement ? 'Procurement' : item.label;
              return (
                <Menu key={item.to} isLazy>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    size="lg"
                    bg={active ? activeBg : 'transparent'}
                    color={active ? activeColor : 'gray.600'}
                    fontWeight={active ? 'semibold' : 'medium'}
                    _hover={{ bg: active ? activeBg : hoverBg }}
                    _active={{}}
                    borderRadius="lg"
                    px={6}
                    py={3}
                    leftIcon={<Text fontSize="lg">{item.icon}</Text>}
                  >
                    {headerLabel}
                  </MenuButton>
                  <MenuList>
                    <MenuItem as={RouterLink} to="/stock">Stock (Default)</MenuItem>
                    <MenuItem as={RouterLink} to="/procurement">Procurement</MenuItem>
                  </MenuList>
                </Menu>
              );
            }
            return (
              <NavButton
                key={item.to}
                icon={item.icon}
                label={item.label}
                to={item.to}
                isActive={location.pathname === item.to}
              />
            );
          })}
        </HStack>
        
        
      </Flex>
    </Box>
  );
};

export default NavigationHeader;
