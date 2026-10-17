import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Select,
  Tabs,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import {
  IconCashRegister,
  IconLock,
  IconVault,
  IconReceipt,
  IconClock,
  IconArrowUpRight,
  IconArrowDownRight,
  IconAlertCircle,
  IconCircleCheck,
  IconRefresh,
  IconBuildingStore,
  IconCash,
  IconDeviceMobile,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import { useStores } from '../../stores/api';
import {
  useCurrentRegisterSession,
  useRegisterSessions,
} from '../api';
import { OpenRegisterModal } from './OpenRegisterModal';
import { CashDropModal } from './CashDropModal';
import { CloseRegisterModal } from './CloseRegisterModal';
import { ZReportModal } from './ZReportModal';
import type { CashRegisterSession, CashTransaction } from '../types';

export function RegisterDashboard() {
  const { data: stores = [] } = useStores();

  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('current_store');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) return parsed.id;
      }
    } catch {
      // ignore
    }
    return '';
  });

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  const activeStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId);
  }, [stores, selectedStoreId]);

  // Queries
  const {
    data: currentSession,
    isLoading: isLoadingCurrent,
    refetch: refetchCurrent,
  } = useCurrentRegisterSession(selectedStoreId);

  const {
    data: allSessions = [],
    refetch: refetchSessions,
  } = useRegisterSessions(selectedStoreId);

  // Modals
  const [openModalOpened, setOpenModalOpened] = useState(false);
  const [cashDropModalOpened, setCashDropModalOpened] = useState(false);
  const [closeModalOpened, setCloseModalOpened] = useState(false);
  const [zReportModalOpened, setZReportModalOpened] = useState(false);
  const [selectedZReportSession, setSelectedZReportSession] = useState<CashRegisterSession | null>(null);

  const handleRefresh = () => {
    refetchCurrent();
    refetchSessions();
  };

  const isShiftOpen = currentSession && currentSession.status === 'OPEN';

  const expectedCash = parseFloat(currentSession?.expected_cash || '0');
  const openingFloat = parseFloat(currentSession?.opening_float || '0');
  const totalSales = parseFloat(currentSession?.total_sales || '0');
  const cashSales = parseFloat(currentSession?.total_cash_sales || '0');
  const upiSales = parseFloat(currentSession?.total_upi_sales || '0');
  const cardSales = parseFloat(currentSession?.total_card_sales || '0');
  const creditSales = parseFloat(currentSession?.total_credit_sales || '0');
  const cashDrops = parseFloat(currentSession?.cash_drops_total || '0');

  const openZReport = (session: CashRegisterSession) => {
    setSelectedZReportSession(session);
    setZReportModalOpened(true);
  };

  return (
    <Box p="md">
      <Stack gap="lg">
        {/* Top Header & Store Selector */}
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <ThemeIcon size={42} radius="md" color="brand" variant="light">
              <IconCashRegister size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} fw={800} style={{ letterSpacing: '-0.02em' }}>
                Cash Register & Shifts
              </Title>
              <Text size="xs" c="dimmed">
                Drawer tracking, mid-shift safe drops, and End-of-Day reconciliation (Z-Reports)
              </Text>
            </div>
          </Group>

          <Group gap="sm">
            <Select
              placeholder="Select store"
              data={stores.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedStoreId}
              onChange={(val) => val && setSelectedStoreId(val)}
              w={220}
              allowDeselect={false}
              leftSection={<IconBuildingStore size={16} />}
            />

            <Tooltip label="Refresh shift data">
              <ActionIcon variant="default" size="lg" onClick={handleRefresh}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>

            {isShiftOpen ? (
              <>
                <Button
                  color="orange"
                  variant="light"
                  leftSection={<IconVault size={16} />}
                  onClick={() => setCashDropModalOpened(true)}
                >
                  Cash Drop / Safe
                </Button>
                <Button
                  color="blue"
                  variant="light"
                  leftSection={<IconReceipt size={16} />}
                  onClick={() => openZReport(currentSession)}
                >
                  Live Shift Slip
                </Button>
                <Button
                  color="red"
                  leftSection={<IconLock size={16} />}
                  onClick={() => setCloseModalOpened(true)}
                >
                  Close Register
                </Button>
              </>
            ) : (
              <Button
                color="brand"
                leftSection={<IconCashRegister size={16} />}
                onClick={() => setOpenModalOpened(true)}
              >
                Open Register Shift
              </Button>
            )}
          </Group>
        </Group>

        {/* Live Status Alert / Banner if no shift is open */}
        {!isShiftOpen && !isLoadingCurrent && (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={20} />}
            title="Register Drawer is Closed"
          >
            <Group justify="space-between" align="center">
              <Text size="sm">
                No active register session is open for <b>{activeStore?.name || 'this store'}</b>. Start a new shift to record opening cash float and track daily cash sales.
              </Text>
              <Button
                size="xs"
                color="yellow"
                variant="filled"
                leftSection={<IconCashRegister size={14} />}
                onClick={() => setOpenModalOpened(true)}
              >
                Start Shift Now
              </Button>
            </Group>
          </Alert>
        )}

        {/* Real-time Shift Metric Cards */}
        <Grid gap="md">
          {/* Active Shift Details */}
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} c="dimmed">
                  SHIFT STATUS
                </Text>
                {isShiftOpen ? (
                  <Badge color="teal" variant="filled" size="sm" leftSection={<IconCircleCheck size={12} />}>
                    OPEN
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light" size="sm">
                    CLOSED
                  </Badge>
                )}
              </Group>

              {isShiftOpen ? (
                <>
                  <Text fw={800} size="lg" style={{ fontFamily: 'monospace' }}>
                    {currentSession.session_number}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Cashier: <b>{currentSession.cashier ? `${currentSession.cashier.first_name} ${currentSession.cashier.last_name || ''}`.trim() : 'Current Cashier'}</b>
                  </Text>
                  <Text size="11px" c="dimmed">
                    Opened: {new Date(currentSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </>
              ) : (
                <>
                  <Text size="sm" c="dimmed" mt="xs">
                    No active shift running
                  </Text>
                  <Text size="11px" c="dimmed">
                    Click "Open Register Shift" to start
                  </Text>
                </>
              )}
            </Card>
          </Grid.Col>

          {/* Live Expected Cash */}
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} c="dimmed">
                  EXPECTED CASH IN DRAWER
                </Text>
                <ThemeIcon size={24} radius="sm" color="teal" variant="light">
                  <IconCash size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={900} size="xl" c="teal">
                ₹{expectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="11px" c="dimmed">
                  Float: ₹{openingFloat.toFixed(2)}
                </Text>
                <Text size="11px" c="dimmed">
                  Drops: -₹{cashDrops.toFixed(2)}
                </Text>
              </Group>
            </Card>
          </Grid.Col>

          {/* Sales Breakdown Across Tenders */}
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} c="dimmed">
                  GROSS SHIFT SALES
                </Text>
                <Badge color="brand" variant="light" size="sm">
                  {currentSession?.invoices_count || 0} Invoices
                </Badge>
              </Group>
              <Text fw={900} size="xl" c="brand">
                ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="11px" c="dimmed">
                  Cash: ₹{cashSales.toFixed(2)}
                </Text>
                <Text size="11px" c="dimmed">
                  UPI: ₹{upiSales.toFixed(2)}
                </Text>
              </Group>
            </Card>
          </Grid.Col>

          {/* Digital & Non-Cash Tenders */}
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} c="dimmed">
                  DIGITAL / CARD / CREDIT
                </Text>
                <ThemeIcon size={24} radius="sm" color="indigo" variant="light">
                  <IconDeviceMobile size={16} />
                </ThemeIcon>
              </Group>
              <Text fw={900} size="xl" c="indigo">
                ₹{(upiSales + cardSales + creditSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <Group justify="space-between" mt={4}>
                <Text size="11px" c="dimmed">
                  Card: ₹{cardSales.toFixed(2)}
                </Text>
                <Text size="11px" c="dimmed">
                  Credit: ₹{creditSales.toFixed(2)}
                </Text>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Tabbed Views: History & Audit Transactions */}
        <Card withBorder radius="md" p="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <Tabs defaultValue="history">
            <Tabs.List mb="md">
              <Tabs.Tab value="history" leftSection={<IconClock size={16} />}>
                Register Session History ({allSessions.length})
              </Tabs.Tab>
              {isShiftOpen && currentSession.recent_transactions && (
                <Tabs.Tab value="ledger" leftSection={<IconReceipt size={16} />}>
                  Active Drawer Transactions ({currentSession.recent_transactions.length})
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* Shift History Tab */}
            <Tabs.Panel value="history">
              {allSessions.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No register sessions found for this store yet.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={800}>
                  <Table verticalSpacing="sm" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Session #</Table.Th>
                        <Table.Th>Cashier</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Opened At</Table.Th>
                        <Table.Th>Closed At</Table.Th>
                        <Table.Th>Invoices</Table.Th>
                        <Table.Th>Total Sales</Table.Th>
                        <Table.Th>Counted Cash</Table.Th>
                        <Table.Th>Variance</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {allSessions.map((session) => {
                        const varianceNum = parseFloat(session.closing_cash_variance || '0');
                        return (
                          <Table.Tr key={session.id}>
                            <Table.Td>
                              <Text size="xs" fw={700} style={{ fontFamily: 'monospace' }}>
                                {session.session_number}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">
                                {session.cashier
                                  ? `${session.cashier.first_name} ${session.cashier.last_name || ''}`.trim()
                                  : session.cashier_id}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {session.status === 'OPEN' ? (
                                <Badge color="teal" size="xs">
                                  OPEN
                                </Badge>
                              ) : (
                                <Badge color="gray" size="xs">
                                  CLOSED
                                </Badge>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">
                                {new Date(session.opened_at).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c={session.closed_at ? 'inherit' : 'dimmed'}>
                                {session.closed_at
                                  ? new Date(session.closed_at).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'In Progress'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" fw={600}>
                                {session.invoices_count}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" fw={700}>
                                ₹{parseFloat(session.total_sales).toFixed(2)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">
                                {session.closing_cash_counted
                                  ? `₹${parseFloat(session.closing_cash_counted).toFixed(2)}`
                                  : `₹${parseFloat(session.expected_cash).toFixed(2)} (Live)`}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {session.status === 'CLOSED' ? (
                                Math.abs(varianceNum) < 0.01 ? (
                                  <Badge color="teal" size="xs" variant="light">
                                    Exact
                                  </Badge>
                                ) : varianceNum < 0 ? (
                                  <Badge color="red" size="xs" variant="filled">
                                    -₹{Math.abs(varianceNum).toFixed(2)}
                                  </Badge>
                                ) : (
                                  <Badge color="orange" size="xs" variant="filled">
                                    +₹{varianceNum.toFixed(2)}
                                  </Badge>
                                )
                              ) : (
                                <Text size="xs" c="dimmed">
                                  —
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                variant="subtle"
                                leftSection={<IconReceipt size={14} />}
                                onClick={() => openZReport(session)}
                              >
                                Z-Report
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Tabs.Panel>

            {/* Active Drawer Ledger Tab */}
            {isShiftOpen && currentSession.recent_transactions && (
              <Tabs.Panel value="ledger">
                <Table.ScrollContainer minWidth={600}>
                  <Table verticalSpacing="xs" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Timestamp</Table.Th>
                        <Table.Th>Transaction Type</Table.Th>
                        <Table.Th>Inflow / Outflow</Table.Th>
                        <Table.Th>Amount (₹)</Table.Th>
                        <Table.Th>Reason / Reference</Table.Th>
                        <Table.Th>Handled By</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {currentSession.recent_transactions.map((tx: CashTransaction) => {
                        const isInflow =
                          tx.type === 'OPENING_FLOAT' || tx.type === 'CASH_SALE';
                        return (
                          <Table.Tr key={tx.id}>
                            <Table.Td>
                              <Text size="xs">
                                {new Date(tx.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="xs"
                                color={
                                  tx.type === 'CASH_SALE'
                                    ? 'teal'
                                    : tx.type === 'OPENING_FLOAT'
                                    ? 'blue'
                                    : tx.type === 'CASH_DROP'
                                    ? 'orange'
                                    : 'red'
                                }
                              >
                                {tx.type.replace('_', ' ')}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4}>
                                {isInflow ? (
                                  <>
                                    <IconArrowUpRight size={14} color="#059669" />
                                    <Text size="xs" c="teal" fw={700}>
                                      INFLOW
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    <IconArrowDownRight size={14} color="#dc2626" />
                                    <Text size="xs" c="red" fw={700}>
                                      OUTFLOW
                                    </Text>
                                  </>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" fw={800} c={isInflow ? 'teal' : 'red'}>
                                {isInflow ? '+' : '-'}₹{parseFloat(tx.amount).toFixed(2)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs">{tx.reason || '—'}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {tx.created_by
                                  ? `${tx.created_by.first_name} ${tx.created_by.last_name || ''}`.trim()
                                  : 'System'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>
            )}
          </Tabs>
        </Card>
      </Stack>

      {/* Modals */}
      <OpenRegisterModal
        opened={openModalOpened}
        onClose={() => setOpenModalOpened(false)}
        storeId={selectedStoreId}
        storeName={activeStore?.name}
        onSuccess={handleRefresh}
      />

      {isShiftOpen && (
        <>
          <CashDropModal
            opened={cashDropModalOpened}
            onClose={() => setCashDropModalOpened(false)}
            session={currentSession}
            onSuccess={handleRefresh}
          />

          <CloseRegisterModal
            opened={closeModalOpened}
            onClose={() => setCloseModalOpened(false)}
            session={currentSession}
            onClosedSuccessfully={(closed) => {
              handleRefresh();
              openZReport(closed);
            }}
          />
        </>
      )}

      <ZReportModal
        opened={zReportModalOpened}
        onClose={() => {
          setZReportModalOpened(false);
          setSelectedZReportSession(null);
        }}
        session={selectedZReportSession}
      />
    </Box>
  );
}
