import {
  Drawer,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Paper,
  ThemeIcon,
  Avatar,
  SimpleGrid,
  Card,
  Tabs,
  Table,
  ActionIcon,
  Tooltip,
  CopyButton,
  Select,
  Loader,
  Center,
  Accordion,
  Divider,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconReceiptTax,
  IconCreditCard,
  IconMapPin,
  IconCalendar,
  IconHeartHandshake,
  IconSparkles,
  IconBuildingSkyscraper,
  IconNotes,
  IconReceipt,
  IconBuildingStore,
  IconCheck,
  IconCopy,
  IconEdit,
  IconPackage,
  IconCurrencyRupee,
  IconShoppingBag,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { useCustomerInvoices } from '../api';
import type { Customer } from '../types';

interface Customer360DrawerProps {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEdit: (customer: Customer) => void;
}

export function Customer360Drawer({
  opened,
  onClose,
  customer,
  onEdit,
}: Customer360DrawerProps) {
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('');

  // Fetch invoices for this customer
  const { data: invoices, isLoading: isLoadingInvoices } = useCustomerInvoices(
    customer?.id,
    selectedStoreFilter || undefined
  );

  // Store filter options from customer store mappings
  const storeFilterOptions = useMemo(() => {
    if (!customer?.store_mappings) return [{ value: '', label: 'All Store Branches' }];
    const opts = customer.store_mappings.map((m) => ({
      value: m.store_id,
      label: m.store_name || `Store #${m.store_id.slice(0, 6)}`,
    }));
    return [{ value: '', label: 'All Store Branches' }, ...opts];
  }, [customer]);

  // Lifetime Analytics Calculations
  const analytics = useMemo(() => {
    const list = invoices || [];
    const totalCount = list.length;
    const totalSpend = list
      .filter((inv) => inv.status !== 'CANCELLED')
      .reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
    const aov = totalCount > 0 ? totalSpend / totalCount : 0;
    const totalPoints = customer?.total_loyalty_points || 0;

    return { totalCount, totalSpend, aov, totalPoints };
  }, [invoices, customer]);

  if (!customer) return null;

  const initials = customer.name
    ? customer.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : customer.mobile_number.slice(-2);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group justify="space-between" wrap="nowrap" style={{ width: '100%', paddingRight: '20px' }}>
          <Group gap="sm" wrap="nowrap">
            <Avatar
              radius="xl"
              size="lg"
              color={customer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
              style={{ fontWeight: 700 }}
            >
              {initials}
            </Avatar>
            <div>
              <Group gap="xs">
                <Text fw={800} size="lg">
                  {customer.name || 'Unnamed Customer'}
                </Text>
                <Badge
                  color={customer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                  variant="light"
                  size="sm"
                >
                  {customer.customer_type === 'B2B' ? 'Wholesale (B2B)' : 'Retail Consumer'}
                </Badge>
                <Badge color={customer.is_active ? 'green' : 'gray'} variant="dot" size="sm">
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>

              <Group gap="md" mt={2}>
                <Group gap={4}>
                  <IconPhone size={13} color="var(--mantine-color-dimmed)" />
                  <Text size="xs" fw={600}>
                    {customer.mobile_number}
                  </Text>
                  <CopyButton value={customer.mobile_number}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy phone'}>
                        <ActionIcon size="xs" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>

                {customer.email && (
                  <Group gap={4}>
                    <IconMail size={13} color="var(--mantine-color-dimmed)" />
                    <Text size="xs" c="dimmed">
                      {customer.email}
                    </Text>
                  </Group>
                )}
              </Group>
            </div>
          </Group>

          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<IconEdit size={14} />}
            onClick={() => {
              onClose();
              onEdit(customer);
            }}
          >
            Edit Profile
          </Button>
        </Group>
      }
      styles={{
        header: {
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
        },
        body: {
          paddingTop: '20px',
        },
      }}
    >
      <Stack gap="lg">
        {/* Top 4 Lifetime Analytics Cards */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Card withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between">
              <div>
                <Text size="11px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Lifetime Spend
                </Text>
                <Text size="lg" fw={800} mt={2} c="brand.8">
                  ₹{analytics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </div>
              <ThemeIcon size={36} radius="md" color="brand" variant="light">
                <IconCurrencyRupee size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between">
              <div>
                <Text size="11px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Total Invoices
                </Text>
                <Text size="lg" fw={800} mt={2}>
                  {analytics.totalCount}
                </Text>
              </div>
              <ThemeIcon size={36} radius="md" color="blue" variant="light">
                <IconReceipt size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between">
              <div>
                <Text size="11px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Average Order (AOV)
                </Text>
                <Text size="lg" fw={800} mt={2}>
                  ₹{analytics.aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </div>
              <ThemeIcon size={36} radius="md" color="teal" variant="light">
                <IconShoppingBag size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card withBorder p="sm" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between">
              <div>
                <Text size="11px" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Loyalty Points
                </Text>
                <Text size="lg" fw={800} mt={2} c="yellow.8">
                  {analytics.totalPoints} pts
                </Text>
              </div>
              <ThemeIcon size={36} radius="md" color="yellow" variant="light">
                <IconSparkles size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* Tabbed Content: Invoices, Loyalty & Store Accounts, Profile & Compliance */}
        <Tabs defaultValue="invoices" variant="outline" radius="md">
          <Tabs.List mb="md">
            <Tabs.Tab value="invoices" leftSection={<IconReceipt size={16} />}>
              Purchase Invoices ({invoices?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="loyalty" leftSection={<IconBuildingStore size={16} />}>
              Store Accounts &amp; Loyalty ({customer.store_mappings?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
              Tax &amp; Demographic Profile
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: Invoices & Purchase History */}
          <Tabs.Panel value="invoices">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                  Billing &amp; Sales Transactions
                </Text>
                {storeFilterOptions.length > 2 && (
                  <Select
                    size="xs"
                    data={storeFilterOptions}
                    value={selectedStoreFilter}
                    onChange={(val) => setSelectedStoreFilter(val || '')}
                    style={{ width: 220 }}
                  />
                )}
              </Group>

              {isLoadingInvoices ? (
                <Center py={40}>
                  <Stack align="center" gap="xs">
                    <Loader size="sm" color="brand" />
                    <Text size="xs" c="dimmed">
                      Fetching purchase history...
                    </Text>
                  </Stack>
                </Center>
              ) : !invoices || invoices.length === 0 ? (
                <Center py={40}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={44} radius="xl" color="gray" variant="light">
                      <IconReceipt size={22} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      No invoices recorded yet
                    </Text>
                    <Text size="xs" c="dimmed" maw={300} ta="center">
                      Invoices generated during POS checkout or online ordering will appear here chronologically.
                    </Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  <Accordion variant="separated" radius="md">
                    {invoices.map((inv) => {
                      const isPaid = inv.status === 'PAID';
                      const isCancelled = inv.status === 'CANCELLED';

                      return (
                        <Accordion.Item key={inv.id} value={inv.id}>
                          <Accordion.Control>
                            <Group justify="space-between" wrap="nowrap" pr="xs">
                              <Group gap="sm" wrap="nowrap">
                                <ThemeIcon
                                  size={30}
                                  radius="md"
                                  color={isPaid ? 'green' : isCancelled ? 'red' : 'gray'}
                                  variant="light"
                                >
                                  <IconReceipt size={16} />
                                </ThemeIcon>
                                <div>
                                  <Group gap={6}>
                                    <Text size="sm" fw={700}>
                                      INV-{inv.id.slice(0, 8).toUpperCase()}
                                    </Text>
                                    <Badge
                                      size="xs"
                                      color={isPaid ? 'green' : isCancelled ? 'red' : 'gray'}
                                      variant="light"
                                    >
                                      {inv.status}
                                    </Badge>
                                    <Badge size="xs" variant="outline" color="blue">
                                      {inv.type}
                                    </Badge>
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {new Date(inv.created_at).toLocaleString()} • {inv.store?.name || `Store #${inv.store_id.slice(0, 6)}`}
                                  </Text>
                                </div>
                              </Group>

                              <Text size="md" fw={800} c="brand.8">
                                ₹{Number(inv.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Text>
                            </Group>
                          </Accordion.Control>

                          <Accordion.Panel>
                            <Stack gap="xs" pt="xs">
                              <Group justify="space-between">
                                <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                                  Line Items ({inv.items?.length || 0})
                                </Text>
                                {inv.payments && inv.payments.length > 0 && (
                                  <Badge size="xs" color="teal" variant="light">
                                    Paid via {inv.payments.map((p) => p.method).join(', ')}
                                  </Badge>
                                )}
                              </Group>

                              {inv.items && inv.items.length > 0 ? (
                                <Table striped withTableBorder verticalSpacing="xs">
                                  <Table.Thead>
                                    <Table.Tr>
                                      <Table.Th>Product / SKU</Table.Th>
                                      <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                                      <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
                                      <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                                      <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                                    </Table.Tr>
                                  </Table.Thead>
                                  <Table.Tbody>
                                    {inv.items.map((item) => (
                                      <Table.Tr key={item.id}>
                                        <Table.Td>
                                          <Group gap={6} wrap="nowrap">
                                            <IconPackage size={14} color="var(--mantine-color-dimmed)" />
                                            <div>
                                              <Text size="xs" fw={600}>
                                                {item.product_name || `Product #${item.product_id.slice(0, 6)}`}
                                              </Text>
                                              {item.product_sku && (
                                                <Text size="10px" c="dimmed">
                                                  SKU: {item.product_sku}
                                                </Text>
                                              )}
                                            </div>
                                          </Group>
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'center' }}>
                                          <Text size="xs" fw={600}>
                                            {item.quantity}
                                          </Text>
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>
                                          <Text size="xs">₹{Number(item.unit_price).toFixed(2)}</Text>
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>
                                          <Text size="xs" c="dimmed">
                                            ₹{Number(item.discount).toFixed(2)}
                                          </Text>
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>
                                          <Text size="xs" fw={700}>
                                            ₹{(item.quantity * Number(item.unit_price) - Number(item.discount)).toFixed(2)}
                                          </Text>
                                        </Table.Td>
                                      </Table.Tr>
                                    ))}
                                  </Table.Tbody>
                                </Table>
                              ) : (
                                <Text size="xs" c="dimmed" fs="italic">
                                  No line item details recorded.
                                </Text>
                              )}

                              <Divider my={4} />

                              {/* Invoice Financial Summary */}
                              <Group justify="flex-end" gap="xl">
                                <Text size="xs" c="dimmed">
                                  Subtotal: ₹{Number(inv.subtotal).toFixed(2)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Discount: ₹{Number(inv.total_discount).toFixed(2)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  GST: ₹{Number(inv.total_gst).toFixed(2)}
                                </Text>
                                <Text size="sm" fw={800} c="brand.8">
                                  Grand Total: ₹{Number(inv.grand_total).toFixed(2)}
                                </Text>
                              </Group>
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          {/* TAB 2: Store Loyalty & Balances */}
          <Tabs.Panel value="loyalty">
            <Stack gap="md">
              <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                Store-Specific Loyalty &amp; Credit Standing
              </Text>

              {customer.store_mappings && customer.store_mappings.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {customer.store_mappings.map((mapping) => {
                    const creditLimit = Number(mapping.credit_limit || 0);
                    const outstanding = Number(mapping.outstanding_balance || 0);
                    const availableCredit = Math.max(0, creditLimit - outstanding);

                    return (
                      <Card key={mapping.id} withBorder p="md" radius="md">
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <ThemeIcon size={32} radius="md" color="brand" variant="light">
                              <IconBuildingStore size={16} />
                            </ThemeIcon>
                            <div>
                              <Text size="sm" fw={700}>
                                {mapping.store_name || `Store #${mapping.store_id.slice(0, 6)}`}
                              </Text>
                              <Text size="11px" c="dimmed">
                                {mapping.total_visits} total visits
                              </Text>
                            </div>
                          </Group>

                          <Badge color="yellow" variant="light" size="md">
                            {mapping.loyalty_points} pts
                          </Badge>
                        </Group>

                        <Divider my="xs" />

                        <SimpleGrid cols={2} spacing="xs">
                          <div>
                            <Text size="11px" c="dimmed">
                              Credit Limit
                            </Text>
                            <Text size="xs" fw={600}>
                              ₹{creditLimit.toLocaleString()}
                            </Text>
                          </div>
                          <div>
                            <Text size="11px" c="dimmed">
                              Outstanding Balance
                            </Text>
                            <Text size="xs" fw={600} c={outstanding > 0 ? 'red' : 'dimmed'}>
                              ₹{outstanding.toLocaleString()}
                            </Text>
                          </div>
                          <div>
                            <Text size="11px" c="dimmed">
                              Available Credit
                            </Text>
                            <Text size="xs" fw={700} c="green.7">
                              ₹{availableCredit.toLocaleString()}
                            </Text>
                          </div>
                          <div>
                            <Text size="11px" c="dimmed">
                              Last Visit
                            </Text>
                            <Text size="xs">
                              {mapping.last_visit ? new Date(mapping.last_visit).toLocaleDateString() : 'Never'}
                            </Text>
                          </div>
                        </SimpleGrid>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              ) : (
                <Center py={40}>
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={44} radius="xl" color="gray" variant="light">
                      <IconBuildingStore size={22} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      No store visits recorded
                    </Text>
                    <Text size="xs" c="dimmed">
                      Store relations and loyalty balances will automatically be tracked on the first store checkout.
                    </Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          </Tabs.Panel>

          {/* TAB 3: Tax & Demographic Profile */}
          <Tabs.Panel value="profile">
            <Stack gap="md">
              {/* B2B Compliance Card */}
              {customer.customer_type === 'B2B' && (
                <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <Group gap="xs" mb="xs">
                    <ThemeIcon size={28} radius="md" color="indigo" variant="light">
                      <IconBuildingSkyscraper size={16} />
                    </ThemeIcon>
                    <Text size="sm" fw={700}>
                      B2B Wholesale Tax Identity
                    </Text>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <div>
                      <Text size="11px" c="dimmed">
                        GSTIN
                      </Text>
                      <Group gap={6}>
                        <IconReceiptTax size={15} color="var(--mantine-color-indigo-6)" />
                        <Text size="sm" fw={700} c="indigo">
                          {customer.gstin || 'Not Provided'}
                        </Text>
                      </Group>
                    </div>

                    <div>
                      <Text size="11px" c="dimmed">
                        PAN Number
                      </Text>
                      <Group gap={6}>
                        <IconCreditCard size={15} color="var(--mantine-color-indigo-6)" />
                        <Text size="sm" fw={700}>
                          {customer.pan_number || 'Not Provided'}
                        </Text>
                      </Group>
                    </div>
                  </SimpleGrid>
                </Paper>
              )}

              {/* Address Card */}
              <Card withBorder p="md" radius="md">
                <Group gap="xs" mb="xs">
                  <ThemeIcon size={28} radius="md" color="blue" variant="light">
                    <IconMapPin size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={700}>
                    Postal &amp; Billing Address
                  </Text>
                </Group>

                {customer.address_line1 || customer.city || customer.state ? (
                  <Stack gap={2}>
                    {customer.address_line1 && <Text size="sm">{customer.address_line1}</Text>}
                    {customer.address_line2 && <Text size="sm">{customer.address_line2}</Text>}
                    <Text size="sm" c="dimmed">
                      {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                    </Text>
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed" fs="italic">
                    No address specified for this customer.
                  </Text>
                )}
              </Card>

              {/* Milestones Card */}
              <Card withBorder p="md" radius="md">
                <Group gap="xs" mb="xs">
                  <ThemeIcon size={28} radius="md" color="pink" variant="light">
                    <IconHeartHandshake size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={700}>
                    Relationship Milestones
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <div>
                    <Text size="11px" c="dimmed">
                      Date of Birth
                    </Text>
                    <Group gap={6} mt={2}>
                      <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm">
                        {customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString() : '—'}
                      </Text>
                    </Group>
                  </div>

                  <div>
                    <Text size="11px" c="dimmed">
                      Anniversary Date
                    </Text>
                    <Group gap={6} mt={2}>
                      <IconHeartHandshake size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm">
                        {customer.anniversary_date ? new Date(customer.anniversary_date).toLocaleDateString() : '—'}
                      </Text>
                    </Group>
                  </div>
                </SimpleGrid>
              </Card>

              {/* Internal Notes */}
              {customer.notes && (
                <Card withBorder p="md" radius="md">
                  <Group gap="xs" mb="xs">
                    <ThemeIcon size={28} radius="md" color="gray" variant="light">
                      <IconNotes size={16} />
                    </ThemeIcon>
                    <Text size="sm" fw={700}>
                      Internal Customer Notes
                    </Text>
                  </Group>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {customer.notes}
                  </Text>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
