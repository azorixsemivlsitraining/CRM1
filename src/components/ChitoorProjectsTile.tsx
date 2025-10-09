import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  LinkBox,
  LinkOverlay,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardHeader,
  CardBody,
} from '@chakra-ui/react';
import { ChevronDownIcon, RepeatIcon } from '@chakra-ui/icons';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { formatSupabaseError } from '../utils/error';

interface ChitoorProjectsTileProps {
  isMobile: boolean;
  cardBg: string;
  borderColor: string;
  titleColor: string;
  accentColor: string;
  onNavigateToFull: () => void;
  canApprove: boolean;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type FilterKey = 'all' | ApprovalStatus;

interface ApprovalRecord {
  id: string;
  project_name: string | null;
  date: string | null;
  capacity_kw: number | null;
  location: string | null;
  power_bill_number: string | null;
  project_cost: number | null;
  site_visit_status: string | null;
  payment_amount: number | null;
  banking_ref_id: string | null;
  service_number: string | null;
  service_status: string | null;
  approval_status: string | null;
  approval_updated_at: string | null;
  project_id?: string | null;
  chitoor_project_id?: string | null;
  chitoor_id?: string | null;
  project_uuid?: string | null;
  [key: string]: any;
}

const statusLabels: Record<FilterKey, string> = {
  all: 'All',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const statusBadgeColors: Record<ApprovalStatus, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

const approvalEndpoint = process.env.REACT_APP_CRM_APPROVAL_ENDPOINT || '';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = (value: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Date formatting error', error);
    return value;
  }
};

const HIDDEN_APPROVAL_KEYS = new Set<string>([
  'id',
  'created_at',
  'updated_at',
  'inserted_at',
  'deleted_at',
  'approval_updated_at',
  'approvalupdatedat',
  'record_version',
]);

const STANDARD_APPROVAL_KEYS = new Set<string>([
  'project_name',
  'project',
  'customer_name',
  'date',
  'capacity',
  'capacity_kw',
  'location',
  'power_bill_number',
  'power_bill',
  'project_cost',
  'site_visit_status',
  'site_visit',
  'payment_amount',
  'payment',
  'approval_status',
  'approval',
  'service_number',
]);

const DETAILS_MANUAL_KEYS = new Set<string>([
  'banking_ref_id',
  'banking_ref',
  'service_status',
  'approval_status',
  'approval',
  'payment_amount',
  'project_cost',
  'site_visit_status',
  'site_visit',
]);

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulValue(item));
  }
  return true;
};

const prettifyKey = (key: string): string => {
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced
    .split(' ')
    .map((segment) => {
      if (!segment) {
        return segment;
      }
      if (segment.toLowerCase() === 'id') {
        return 'ID';
      }
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(' ');
};

const currencyLikePattern = /(amount|cost|price|payment|value|fee|charge|subsidy)/i;
const dateLikePattern = /(date|_at|timestamp|deadline)/i;

const isLikelyDateValue = (value: string): boolean => {
  if (!value) {
    return false;
  }
  if (!/[\d-\/]/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
};

const formatDynamicValue = (key: string, value: any): string => {
  if (!hasMeaningfulValue(value)) {
    return '—';
  }

  if (typeof value === 'number') {
    if (currencyLikePattern.test(key)) {
      return currencyFormatter.format(value);
    }
    return value.toLocaleString('en-IN');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '—';
    }
    if (dateLikePattern.test(key) || isLikelyDateValue(trimmed)) {
      return dateFormatter(trimmed);
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return cleaned.length > 0 ? cleaned.join(', ') : '—';
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.warn('Failed to stringify dynamic value', error);
      return String(value);
    }
  }

  return String(value);
};

const ChitoorProjectsTile = ({
  isMobile,
  cardBg,
  borderColor,
  titleColor,
  accentColor,
  onNavigateToFull,
  canApprove,
}: ChitoorProjectsTileProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setApprovals([]);
      return;
    }

    try {
      setLoading(true);
      const tableCandidates = ['chittoor_project_approvals', 'chitoor_project_approvals'];
      let res: any = null;
      let lastError: any = null;

      for (const table of tableCandidates) {
        res = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false });

        if (res?.error) {
          const errMsg = formatSupabaseError(res.error) || (res.error as any)?.message || '';
          if (typeof errMsg === 'string' && errMsg.includes('Could not find the table')) {
            lastError = res.error;
            continue;
          }
          throw res.error;
        }

        const data = res.data as ApprovalRecord[] | null;
        setApprovals(data ?? []);
        lastError = null;
        break;
      }

      if (lastError) {
        throw lastError;
      }
    } catch (error: any) {
      try {
        console.error('Failed to load Chitoor approvals', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        console.error('Failed to load Chitoor approvals', error);
      }

      const rawMessage = formatSupabaseError(error);
      const message = typeof rawMessage === 'string' ? rawMessage : String(rawMessage) || 'Unable to load Chitoor approvals.';

      toast({
        title: 'Chitoor approvals unavailable',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApprovals();
    const fetchProjects = async () => {
      if (!isSupabaseConfigured) return;
      try {
        setProjectsLoading(true);
        // Get accurate total count first, then fetch full range to avoid implicit limits
        const { count } = await supabase
          .from('chitoor_projects')
          .select('id', { count: 'exact', head: true });
        const end = Math.max(0, (count || 0) - 1);
        const { data, error } = await supabase
          .from('chitoor_projects')
          .select('*')
          .order('created_at', { ascending: false })
          .range(0, end);
        if (error) {
          console.error('Error fetching projects', error);
          return;
        }
        setProjects(data ?? []);
      } catch (err) {
        console.error('Fetch projects error', err);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();

    // Realtime updates for live project management
    if (isSupabaseConfigured) {
      const prjCh = (supabase as any)
        .channel('realtime-chitoor-projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chitoor_projects' }, () => {
          fetchProjects();
        })
        .subscribe();

      const aprTable = 'chittoor_project_approvals';
      const altAprTable = 'chitoor_project_approvals';
      const aprCh = (supabase as any)
        .channel('realtime-chitoor-approvals')
        .on('postgres_changes', { event: '*', schema: 'public', table: aprTable }, () => fetchApprovals())
        .on('postgres_changes', { event: '*', schema: 'public', table: altAprTable }, () => fetchApprovals())
        .subscribe();
    }

    return () => {
      try { (prjCh as any)?.unsubscribe?.(); } catch {}
      try { (aprCh as any)?.unsubscribe?.(); } catch {}
    };
  }, [fetchApprovals]);

  const summary = useMemo(() => {
    const base = { total: approvals.length, pending: 0, approved: 0, rejected: 0 };
    approvals.forEach((record) => {
      const status = (record.approval_status || 'pending').toLowerCase() as ApprovalStatus;
      if (status === 'approved') {
        base.approved += 1;
      } else if (status === 'rejected') {
        base.rejected += 1;
      } else {
        base.pending += 1;
      }
    });
    return base;
  }, [approvals]);

  const summaryByFilter: Record<FilterKey, number> = useMemo(
    () => ({
      all: summary.total,
      pending: summary.pending,
      approved: summary.approved,
      rejected: summary.rejected,
    }),
    [summary]
  );

  const displayedRecords = useMemo(() => {
    if (filter === 'all') {
      return approvals;
    }
    return approvals.filter((record) => (record.approval_status || 'pending').toLowerCase() === filter);
  }, [approvals, filter]);

  const dynamicFields = useMemo(() => {
    const discovered = new Map<string, { key: string; label: string }>();
    approvals.forEach((record) => {
      if (!record) {
        return;
      }
      Object.entries(record).forEach(([key, value]) => {
        const normalized = key.toLowerCase();
        if (HIDDEN_APPROVAL_KEYS.has(normalized) || STANDARD_APPROVAL_KEYS.has(normalized)) {
          return;
        }
        if (!hasMeaningfulValue(value)) {
          return;
        }
        if (!discovered.has(normalized)) {
          discovered.set(normalized, { key, label: prettifyKey(key) });
        }
      });
    });
    return Array.from(discovered.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [approvals]);

  const approvalsColumnCount = 9 + dynamicFields.length + (canApprove ? 1 : 0);

  const approvalsMonthly = useMemo(() => {
    const counts: Record<string, number> = {};
    approvals.forEach((r) => {
      const raw = (r.date as any) || (r as any)?.created_at || null;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [approvals]);

  const projectsMonthly = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((p: any) => {
      const raw = p.date_of_order || p.date || p.created_at || null;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [projects]);

  const monthKeys = useMemo(() => {
    const keys = new Set<string>([...Object.keys(approvalsMonthly), ...Object.keys(projectsMonthly)]);
    return Array.from(keys).sort((a, b) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return ay === by ? am - bm : ay - by;
    });
  }, [approvalsMonthly, projectsMonthly]);

  const projectStats = useMemo(() => {
    const total = projects.length;
    const isCompleted = (status: any) => {
      const s = String(status || '').toLowerCase();
      return s === 'completed' || s.includes('installation completed') || s.includes('commissioned') || s.includes('delivered');
    };
    const isInactive = (status: any) => {
      const s = String(status || '').toLowerCase();
      return s.includes('cancel') || s.includes('declined') || s.includes('rejected') || s.includes('closed');
    };
    const completed = projects.filter((p: any) => isCompleted(p.project_status || p.status)).length;
    const inactive = projects.filter((p: any) => isInactive(p.project_status || p.status)).length;
    const active = Math.max(0, total - completed - inactive);
    const num = (v: any) => (typeof v === 'number' ? v : parseFloat(v || '0') || 0);
    const totalRevenue = projects.reduce((sum, p: any) => sum + num(p.project_cost), 0);
    const totalCapacity = projects.reduce((sum, p: any) => sum + num(p.capacity ?? p.capacity_kw), 0);
    return { total, active, completed, totalRevenue, totalCapacity };
  }, [projects]);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const BarComparisonChart: React.FC<{ months: string[]; a: number[]; b: number[]; labels: [string, string]; colors?: [string, string]; }> = ({ months, a, b, labels, colors = ['green.600', 'green.300'] }) => {
    const maxVal = Math.max(1, ...a, ...b);
    return (
      <Box border="1px solid" borderColor="gray.100" borderRadius="lg" p={4} bg="white">
        <Text fontWeight="semibold" color="gray.700" mb={2}>Monthly comparison</Text>
        <Text fontSize="sm" color="gray.500" mb={4}>Track how CRM approvals compare with on-ground Chitoor project progress.</Text>
        <HStack align="end" spacing={6} minH="220px">
          {months.map((mKey, idx) => {
            const av = a[idx] || 0;
            const bv = b[idx] || 0;
            const ah = (av / maxVal) * 180;
            const bh = (bv / maxVal) * 180;
            return (
              <VStack key={mKey} spacing={2} align="center">
                <HStack align="end" spacing={2}>
                  <Box w="12px" bg={colors[0]} borderRadius="sm" height={`${ah}px`} />
                  <Box w="12px" bg={colors[1]} borderRadius="sm" height={`${bh}px`} />
                </HStack>
                <Text fontSize="xs" color="gray.600">{formatMonthLabel(mKey)}</Text>
              </VStack>
            );
          })}
        </HStack>
        <HStack spacing={4} mt={3} color="gray.600">
          <HStack spacing={2}>
            <Box w="10px" h="10px" bg={colors[0]} borderRadius="sm" />
            <Text fontSize="xs">{labels[0]}</Text>
          </HStack>
          <HStack spacing={2}>
            <Box w="10px" h="10px" bg={colors[1]} borderRadius="sm" />
            <Text fontSize="xs">{labels[1]}</Text>
          </HStack>
        </HStack>
      </Box>
    );
  };

  const sendApprovalStatus = useCallback(
    async (recordId: string, status: ApprovalStatus) => {
      if (approvalEndpoint) {
        const response = await fetch(approvalEndpoint, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: recordId, approval_status: status }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Approval sync failed.');
        }

        return;
      }

      if (!isSupabaseConfigured) {
        throw new Error('Supabase is not configured; cannot update approval status.');
      }

      const { data: updData, error: updError } = await supabase
        .from('chittoor_project_approvals')
        .update({ approval_status: status })
        .eq('id', recordId);

      if (updError) {
        throw updError;
      }

      return updData;
    },
    []
  );

  const handleStatusChange = useCallback(
    async (recordId: string, status: ApprovalStatus) => {
      try {
        setUpdatingId(recordId);
        await sendApprovalStatus(recordId, status);
        toast({
          title: 'Approval status updated',
          description: `Chitoor project marked as ${statusLabels[status]}.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        await fetchApprovals();
      } catch (error: any) {
        console.error('Failed to update approval status', error);
        toast({
          title: 'Update failed',
          description: error?.message || 'Unable to update approval status.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchApprovals, sendApprovalStatus, toast]
  );

  const handleOpenDetails = useCallback(() => {
    if (!approvals.length) {
      fetchApprovals();
    }
    setFilter('all');
    onOpen();
  }, [approvals.length, fetchApprovals, onOpen]);

  const additionalDetails = useMemo(() => {
    if (!selectedRecord) {
      return [] as { key: string; label: string; value: any }[];
    }
    return dynamicFields
      .map((field) => ({ key: field.key, label: field.label, value: selectedRecord[field.key] }))
      .filter((entry) => {
        const normalized = entry.key.toLowerCase();
        if (DETAILS_MANUAL_KEYS.has(normalized)) {
          return false;
        }
        return hasMeaningfulValue(entry.value);
      });
  }, [dynamicFields, selectedRecord]);

  const renderApprovalsTable = (records: ApprovalRecord[]) => (
    <TableContainer border="1px solid" borderColor="gray.100" borderRadius="lg">
      <Table variant="simple" size="sm">
        <Thead bg="gray.50">
          <Tr>
            <Th color="gray.600">Project</Th>
            <Th color="gray.600">Date</Th>
            <Th color="gray.600">Capacity (kW)</Th>
            <Th color="gray.600">Location</Th>
            <Th color="gray.600">Power Bill #</Th>
            <Th color="gray.600">Cost</Th>
            <Th color="gray.600">Site Visit</Th>
            <Th color="gray.600">Payment</Th>
            {dynamicFields.map((field) => (
              <Th key={field.key} color="gray.600">{field.label}</Th>
            ))}
            <Th color="gray.600">Approval</Th>
            {canApprove && <Th color="gray.600">Actions</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {records.length === 0 && !loading ? (
            <Tr>
              <Td colSpan={approvalsColumnCount}>
                <Text textAlign="center" color="gray.500" py={6}>
                  No records in this view.
                </Text>
              </Td>
            </Tr>
          ) : (
            records.map((record) => {
              const status = (record.approval_status || 'pending').toLowerCase() as ApprovalStatus;
              const openProjectFromApproval = async (rec: ApprovalRecord) => {
                const explicitId = rec.project_id || rec.chitoor_project_id || rec.chitoor_id || null;
                const explicitUuid = rec.project_uuid || null;

                if (explicitId) {
                  try {
                    const { data: exists, error: checkErr } = await supabase
                      .from('chitoor_projects')
                      .select('id')
                      .eq('id', explicitId)
                      .limit(1);
                    if (!checkErr && exists && Array.isArray(exists) && exists.length > 0) {
                      navigate(`/projects/chitoor/${explicitId}`);
                      return;
                    }
                  } catch (e) {
                    console.warn('Project existence check failed', e);
                  }
                }

                if (explicitUuid) {
                  try {
                    const { data: foundByUuid, error: errByUuid } = await supabase
                      .from('chitoor_projects')
                      .select('id')
                      .eq('project_uuid', explicitUuid)
                      .limit(1);
                    if (!errByUuid && foundByUuid && Array.isArray(foundByUuid) && foundByUuid.length > 0) {
                      navigate(`/projects/chitoor/${foundByUuid[0].id}`);
                      return;
                    }
                  } catch (e) {
                    console.warn('Lookup by project_uuid failed', e);
                  }
                }

                try {
                  if (projects && projects.length > 0) {
                    const match = projects.find((p: any) => {
                      if (!p) return false;
                      if (rec.service_number && (p.service_number === rec.service_number || String(p.service_number) === String(rec.service_number))) return true;
                      if (rec.power_bill_number && (p.power_bill_number === rec.power_bill_number || String(p.power_bill_number) === String(rec.power_bill_number))) return true;
                      if (explicitUuid && (p.project_uuid === explicitUuid || String(p.project_uuid) === String(explicitUuid))) return true;
                      const pname = (rec.project_name || '').toString().trim().toLowerCase();
                      const candidateNames = [p.customer_name, p.project_name, p.customer || p.name]
                        .filter(Boolean)
                        .map((s: any) => String(s).toLowerCase());
                      if (pname && candidateNames.some((n: string) => n.includes(pname))) return true;
                      return false;
                    });
                    if (match) {
                      navigate(`/projects/chitoor/${match.id}`);
                      return;
                    }
                  }
                } catch (e) {
                  console.warn('Local project lookup failed', e);
                }

                try {
                  const conditions: string[] = [];
                  if (rec.service_number) conditions.push(`service_number.eq.${rec.service_number}`);
                  if (rec.power_bill_number) conditions.push(`power_bill_number.eq.${rec.power_bill_number}`);
                  if (rec.banking_ref_id) conditions.push(`banking_ref_id.eq.${rec.banking_ref_id}`);
                  if (rec.banking_ref) conditions.push(`banking_ref.eq.${rec.banking_ref}`);
                  if (explicitUuid) conditions.push(`project_uuid.eq.${explicitUuid}`);
                  if (rec.project_name) {
                    const safeName = rec.project_name.replace(/%/g, '').replace(/,/g, '');
                    if (safeName) conditions.push(`project_name.ilike.%${safeName}%`);
                  }

                  if (conditions.length > 0) {
                    const orStr = conditions.join(',');
                    const { data: found, error: findErr } = await supabase
                      .from('chitoor_projects')
                      .select('id')
                      .or(orStr)
                      .limit(1);
                    if (findErr) throw findErr;
                    if (found && Array.isArray(found) && found.length > 0) {
                      navigate(`/projects/chitoor/${found[0].id}`);
                      return;
                    }
                  }
                } catch (e) {
                  console.warn('Project lookup from approval failed', e);
                }

                try {
                  const navId = explicitId || explicitUuid || `approval-${rec.id}`;
                  navigate(`/projects/chitoor/${navId}`, { state: { approvalRecord: rec } });
                  return;
                } catch (e) {
                  console.warn('Fallback navigate failed', e);
                }

                toast({
                  title: 'Project not found',
                  description: 'Could not find corresponding project for this approval.',
                  status: 'error',
                });
              };

              return (
                <Tr
                  key={record.id}
                  _hover={{ bg: 'gray.50' }}
                  onClick={() => {
                    setSelectedRecord(record);
                    onDetailsOpen();
                  }}
                  cursor="pointer"
                >
                  <Td>
                    <VStack align="start" spacing={1}>
                      <HStack>
                        <Text fontWeight="medium" color="gray.800">{record.project_name || '—'}</Text>
                        {(record.project_id || record.chitoor_project_id || record.chitoor_id || record.project_uuid) ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={(e: any) => {
                              e.stopPropagation();
                              openProjectFromApproval(record);
                            }}
                          >
                            Open project
                          </Button>
                        ) : null}
                      </HStack>
                      <Text fontSize="xs" color="gray.500">Service #{record.service_number || '—'}</Text>
                    </VStack>
                  </Td>
                  <Td>{dateFormatter(record.date)}</Td>
                  <Td>{record.capacity_kw ?? '—'}</Td>
                  <Td textTransform="capitalize">{record.location || '—'}</Td>
                  <Td>{record.power_bill_number || '—'}</Td>
                  <Td>{record.project_cost != null ? currencyFormatter.format(record.project_cost) : '—'}</Td>
                  <Td>{record.site_visit_status || '—'}</Td>
                  <Td>{record.payment_amount != null ? currencyFormatter.format(record.payment_amount) : '—'}</Td>
                  {dynamicFields.map((field) => (
                    <Td key={field.key}>
                      <Text fontSize="sm" color="gray.700">{formatDynamicValue(field.key, record[field.key])}</Text>
                    </Td>
                  ))}
                  <Td>
                    <Badge colorScheme={statusBadgeColors[status]} textTransform="capitalize">
                      {status}
                    </Badge>
                  </Td>
                  {canApprove && (
                    <Td>
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                          size="sm"
                          colorScheme="green"
                          variant="outline"
                          isLoading={updatingId === record.id}
                          onClick={(e: any) => e.stopPropagation()}
                        >
                          Update
                        </MenuButton>
                        <MenuList>
                          {( ['approved', 'pending', 'rejected'] as ApprovalStatus[] ).map((option) => (
                            <MenuItem
                              key={option}
                              onClick={() => handleStatusChange(record.id, option)}
                              isDisabled={option === status}
                            >
                              Mark as {statusLabels[option]}
                            </MenuItem>
                          ))}
                        </MenuList>
                      </Menu>
                    </Td>
                  )}
                </Tr>
              );
            })
          )}
        </Tbody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      <LinkBox
        as="article"
        role="group"
        minW={isMobile ? '260px' : undefined}
        maxW={isMobile ? '260px' : undefined}
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        p={isMobile ? 5 : 6}
        boxShadow="sm"
        transition="all 0.2s"
        _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
      >
        <Flex justify="space-between" align="flex-start" gap={4} mb={2}>
          <Box>
            <Text fontSize={isMobile ? '3xl' : '4xl'} mb={2}>
              🏗️
            </Text>
            <Heading size="sm" mb={1} color={accentColor}>
              Chitoor Projects
            </Heading>
            <Text fontSize="sm" color={titleColor}>
              Track district approvals with CRM sync
            </Text>
          </Box>
          <Box>
          </Box>
        </Flex>

        <Box mt={3}>
          <LinkOverlay as="button" onClick={handleOpenDetails} color={accentColor}>
            Open
          </LinkOverlay>
        </Box>
      </LinkBox>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex justify="space-between" align="center" gap={4}>
              <HStack spacing={3} align="center">
                <Button variant="ghost" onClick={onClose}>Back</Button>
                <Box>
                  <Heading size="md" color="gray.800">
                    Chitoor project approvals
                  </Heading>
                  <Text fontSize="sm" color="gray.500">
                    Data shared via Supabase with CRM-controlled approvals
                  </Text>
                </Box>
              </HStack>
              <HStack spacing={3}>
                <Button
                  variant="outline"
                  colorScheme="green"
                  onClick={onNavigateToFull}
                >
                  Go to projects page
                </Button>
                <IconButton
                  aria-label="Refresh Chitoor approvals"
                  icon={<RepeatIcon />}
                  onClick={fetchApprovals}
                  isLoading={loading}
                  variant="ghost"
                />
              </HStack>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Tabs>
              <TabList>
                <Tab>Approvals</Tab>
                <Tab>All Projects</Tab>
                <Tab>Analytics</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={4}>
                    {(['all', 'pending', 'approved', 'rejected'] as FilterKey[]).map((key) => (
                      <Box
                        key={key}
                        border="1px solid"
                        borderColor={filter === key ? 'green.200' : 'gray.200'}
                        borderRadius="lg"
                        p={4}
                        bg={filter === key ? 'green.50' : 'white'}
                        cursor="pointer"
                        onClick={() => setFilter(key)}
                        transition="all 0.2s"
                        _hover={{ borderColor: 'green.300' }}
                      >
                        <Text fontSize="xs" color="gray.500">
                          {statusLabels[key]}
                        </Text>
                        <Heading size="md" color="gray.800">
                          {summaryByFilter[key]}
                        </Heading>
                      </Box>
                    ))}
                  </SimpleGrid>

                  <Box>
                    <Flex justify="space-between" align="center" mb={3}>
                      <Heading size="sm" color="gray.700">
                        {statusLabels[filter]} projects
                      </Heading>
                      {loading && (
                        <HStack spacing={2} color="gray.500" fontSize="sm">
                          <Spinner size="sm" />
                          <Text>Loading approvals…</Text>
                        </HStack>
                      )}
                    </Flex>

                    {renderApprovalsTable(displayedRecords)}
                  </Box>
                </TabPanel>

                <TabPanel>
                  {projectsLoading ? (
                    <Spinner />
                  ) : (
                    <>
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={4} mb={4}>
                        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                          <Text fontSize="xs" color="gray.500">Total Projects</Text>
                          <Heading size="md" color="gray.800">{projectStats.total}</Heading>
                          <Text fontSize="xs" color="gray.500">All Chitoor projects</Text>
                        </Box>
                        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                          <Text fontSize="xs" color="gray.500">Active Projects</Text>
                          <Heading size="md" color="gray.800">{projectStats.active}</Heading>
                          <Text fontSize="xs" color="gray.500">In progress</Text>
                        </Box>
                        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                          <Text fontSize="xs" color="gray.500">Completed Projects</Text>
                          <Heading size="md" color="gray.800">{projectStats.completed}</Heading>
                          <Text fontSize="xs" color="gray.500">Successfully delivered</Text>
                        </Box>
                        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                          <Text fontSize="xs" color="gray.500">Total Revenue</Text>
                          <Heading size="md" color="gray.800">{currencyFormatter.format(projectStats.totalRevenue)}</Heading>
                          <Text fontSize="xs" color="gray.500">Project value</Text>
                        </Box>
                        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                          <Text fontSize="xs" color="gray.500">Total Capacity</Text>
                          <Heading size="md" color="gray.800">{projectStats.totalCapacity.toLocaleString()} kW</Heading>
                          <Text fontSize="xs" color="gray.500">Energy capacity</Text>
                        </Box>
                      </SimpleGrid>

                      <TableContainer border="1px solid" borderColor="gray.100" borderRadius="lg">
                        <Table variant="simple" size="sm">
                          <Thead bg="gray.50">
                            <Tr>
                              <Th color="gray.600">Project</Th>
                              <Th color="gray.600">Date</Th>
                              <Th color="gray.600">Capacity (kW)</Th>
                              <Th color="gray.600">Location</Th>
                              <Th color="gray.600">Cost</Th>
                              <Th color="gray.600">Status</Th>
                              <Th></Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {projects.length === 0 ? (
                              <Tr>
                                <Td colSpan={7}>
                                  <Text textAlign="center" color="gray.500" py={6}>No projects available.</Text>
                                </Td>
                              </Tr>
                            ) : (
                              projects.map((p) => (
                                <Tr
                                  key={p.id}
                                  _hover={{ bg: 'gray.50' }}
                                  onClick={() => {
                                    navigate(`/projects/chitoor/${p.id}`);
                                  }}
                                  cursor="pointer"
                                >
                                  <Td>{p.customer_name || p.project_name || '—'}</Td>
                                  <Td>{dateFormatter(p.date_of_order || p.date || p.created_at)}</Td>
                                  <Td>{p.capacity ?? p.capacity_kw ?? '—'}</Td>
                                  <Td>{p.address_mandal_village || p.location || '—'}</Td>
                                  <Td>{p.project_cost ? currencyFormatter.format(p.project_cost) : '—'}</Td>
                                  <Td>{p.project_status || p.service_status || '—'}</Td>
                                  <Td>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/projects/chitoor/${p.id}`);
                                      }}
                                    >
                                      View
                                    </Button>
                                  </Td>
                                </Tr>
                              ))
                            )}
                          </Tbody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </TabPanel>

                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 3, lg: 6 }} spacing={4} mb={4}>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">All projects</Text>
                      <Heading size="md" color="gray.800">{projectStats.total}</Heading>
                      <Text fontSize="xs" color="gray.500">Total Projects</Text>
                    </Box>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">In progress</Text>
                      <Heading size="md" color="gray.800">{projectStats.active}</Heading>
                      <Text fontSize="xs" color="gray.500">Active Projects</Text>
                    </Box>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">Successfully delivered</Text>
                      <Heading size="md" color="gray.800">{projectStats.completed}</Heading>
                      <Text fontSize="xs" color="gray.500">Completed Projects</Text>
                    </Box>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">All</Text>
                      <Heading size="md" color="gray.800">{summary.total}</Heading>
                      <Text fontSize="xs" color="gray.500">Total Approvals</Text>
                    </Box>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">Waiting</Text>
                      <Heading size="md" color="gray.800">{summary.pending}</Heading>
                      <Text fontSize="xs" color="gray.500">Pending</Text>
                    </Box>
                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4} bg="white">
                      <Text fontSize="xs" color="gray.500">Greenlit</Text>
                      <Heading size="md" color="gray.800">{summary.approved}</Heading>
                      <Text fontSize="xs" color="gray.500">Approved</Text>
                    </Box>
                  </SimpleGrid>

                  <BarComparisonChart
                    months={monthKeys}
                    a={monthKeys.map((k) => approvalsMonthly[k] || 0)}
                    b={monthKeys.map((k) => projectsMonthly[k] || 0)}
                    labels={["Approvals", "Chitoor Projects"]}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="green" onClick={fetchApprovals}>
              Refresh data
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isDetailsOpen}
        onClose={() => {
          setSelectedRecord(null);
          onDetailsClose();
        }}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Project details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRecord ? (
              (() => {
                const a = selectedRecord;
                const detailColumns = additionalDetails.length > 0 ? { base: 1, lg: 3 } : { base: 1, lg: 2 };
                return (
                  <Box>
                    <SimpleGrid columns={detailColumns} spacing={4}>
                      <Card>
                        <CardHeader>
                          <Text fontSize="lg" fontWeight="semibold">Overview</Text>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={2}>
                            <Text><strong>Project Name:</strong> {a.project_name || a.project || '—'}</Text>
                            <Text><strong>Date:</strong> {dateFormatter(a.date)}</Text>
                            <Text><strong>Capacity (kW):</strong> {a.capacity_kw ?? a.capacity ?? '—'}</Text>
                            <Text><strong>Villages / Location:</strong> {a.location || a.village || '—'}</Text>
                            <Text><strong>Power Bill Number:</strong> {a.power_bill_number || a.power_bill || '—'}</Text>
                            <Text><strong>Project Cost:</strong> {a.project_cost != null ? currencyFormatter.format(Number(a.project_cost)) : '—'}</Text>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <Text fontSize="lg" fontWeight="semibold">Status & Billing</Text>
                        </CardHeader>
                        <CardBody>
                          <VStack align="stretch" spacing={2}>
                            <Text><strong>Site Visit Status:</strong> {a.site_visit_status || a.site_visit || '—'}</Text>
                            <Text><strong>Payment Request (₹):</strong> {a.payment_amount != null ? currencyFormatter.format(Number(a.payment_amount)) : '—'}</Text>
                            <Text><strong>Banking Ref ID:</strong> {a.banking_ref_id || a.banking_ref || '—'}</Text>
                            <Text><strong>Service Number:</strong> {a.service_number || '—'}</Text>
                            <Text><strong>Service Status:</strong> {a.service_status || '—'}</Text>
                            <Text><strong>Approval (CRM):</strong> {a.approval_status || a.approval || '—'}</Text>
                            <Text fontSize="xs" color="gray.500">
                              Updated: {dateFormatter(a.approval_updated_at || a.updated_at || a.created_at)}
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>

                      {additionalDetails.length > 0 && (
                        <Card>
                          <CardHeader>
                            <Text fontSize="lg" fontWeight="semibold">Additional Details</Text>
                          </CardHeader>
                          <CardBody>
                            <VStack align="stretch" spacing={2}>
                              {additionalDetails.map((detail) => (
                                <Text key={detail.key}>
                                  <strong>{detail.label}:</strong> {formatDynamicValue(detail.key, detail.value)}
                                </Text>
                              ))}
                            </VStack>
                          </CardBody>
                        </Card>
                      )}
                    </SimpleGrid>
                  </Box>
                );
              })()
            ) : (
              <Text>No details available.</Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => {
                setSelectedRecord(null);
                onDetailsClose();
              }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ChitoorProjectsTile;
