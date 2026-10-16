import {
  Drawer,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  Textarea,
  Switch,
  SimpleGrid,
  Text,
  Badge,
  Alert,
  Divider,
  Paper,
  ThemeIcon,
  SegmentedControl,
  Table,
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
  IconAlertCircle,
  IconCheck,
  IconSparkles,
  IconBuildingSkyscraper,
  IconNotes,
} from '@tabler/icons-react';
import { useState, useMemo, useEffect } from 'react';
import { useCreateCustomer, useUpdateCustomer } from '../api';
import {
  INDIAN_STATES,
  type Customer,
  type CustomerType,
} from '../types';

interface CustomerDrawerProps {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
  isReadOnly?: boolean;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function CustomerDrawer({
  opened,
  onClose,
  customer,
  isReadOnly = false,
}: CustomerDrawerProps) {
  // Primary Identifier
  const [mobileNumber, setMobileNumber] = useState('');

  // Classification & Basic Info
  const [customerType, setCustomerType] = useState<CustomerType>('RETAIL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // B2B Identification
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Demographics
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [anniversaryDate, setAnniversaryDate] = useState('');

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Operational & Notes
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & error handling
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  // Populate or reset form whenever drawer opens or customer changes
  useEffect(() => {
    if (customer) {
      setMobileNumber(customer.mobile_number || '');
      setCustomerType(customer.customer_type || 'RETAIL');
      setName(customer.name || '');
      setEmail(customer.email || '');
      setGstin(customer.gstin || '');
      setPanNumber(customer.pan_number || '');
      setDateOfBirth(customer.date_of_birth || '');
      setAnniversaryDate(customer.anniversary_date || '');
      setAddressLine1(customer.address_line1 || '');
      setAddressLine2(customer.address_line2 || '');
      setCity(customer.city || '');
      setState(customer.state || '');
      setPincode(customer.pincode || '');
      setNotes(customer.notes || '');
      setIsActive(customer.is_active ?? true);
      setErrorMessage(null);
    } else {
      setMobileNumber('');
      setCustomerType('RETAIL');
      setName('');
      setEmail('');
      setGstin('');
      setPanNumber('');
      setDateOfBirth('');
      setAnniversaryDate('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPincode('');
      setNotes('');
      setIsActive(true);
      setErrorMessage(null);
    }
  }, [customer, opened]);

  // Clean and validate mobile number in real time
  const mobileStatus = useMemo(() => {
    if (!mobileNumber) return null;
    const clean = mobileNumber.replace(/[\s\-()+]/g, '');
    let normalized = clean;
    if (normalized.startsWith('91') && normalized.length === 12) {
      normalized = normalized.substring(2);
    } else if (normalized.startsWith('0') && normalized.length === 11) {
      normalized = normalized.substring(1);
    }

    const isValid = /^[6-9]\d{9}$/.test(normalized) || /^\d{10,15}$/.test(normalized);
    return {
      isValid,
      normalized,
      digitCount: normalized.length,
    };
  }, [mobileNumber]);

  // Real-time GSTIN validation & PAN derivation
  const gstinStatus = useMemo(() => {
    if (!gstin) return null;
    const clean = gstin.trim().toUpperCase();
    if (clean.length === 15) {
      if (GSTIN_REGEX.test(clean)) {
        const derivedPan = clean.substring(2, 12);
        return { valid: true, derivedPan };
      }
      return { valid: false, message: 'Invalid 15-digit GSTIN pattern' };
    }
    return { valid: false, message: `${clean.length}/15 characters entered` };
  }, [gstin]);

  const handleGstinChange = (value: string) => {
    const uppercase = value.toUpperCase();
    setGstin(uppercase);

    if (uppercase.length === 15 && GSTIN_REGEX.test(uppercase)) {
      const derivedPan = uppercase.substring(2, 12);
      if (!panNumber || panNumber === '') {
        setPanNumber(derivedPan);
      }
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // Validate phone number
    if (!mobileNumber.trim()) {
      setErrorMessage('Mobile number is required for POS identity.');
      return;
    }
    if (mobileStatus && !mobileStatus.isValid) {
      setErrorMessage('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }

    // Validate B2B GSTIN if provided
    if (customerType === 'B2B' && gstin.trim()) {
      if (!GSTIN_REGEX.test(gstin.trim().toUpperCase())) {
        setErrorMessage('Please enter a valid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5).');
        return;
      }
    }

    // Validate PAN if provided
    if (panNumber.trim() && !PAN_REGEX.test(panNumber.trim().toUpperCase())) {
      setErrorMessage('Please enter a valid 10-character PAN (e.g. ABCDE1234F).');
      return;
    }

    const payload = {
      mobile_number: mobileStatus?.normalized || mobileNumber.trim(),
      customer_type: customerType,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      gstin: gstin.trim().toUpperCase() || undefined,
      pan_number: panNumber.trim().toUpperCase() || undefined,
      address_line1: addressLine1.trim() || undefined,
      address_line2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      pincode: pincode.trim() || undefined,
      date_of_birth: dateOfBirth || null,
      anniversary_date: anniversaryDate || null,
      notes: notes.trim() || undefined,
      is_active: isActive,
    };

    try {
      if (customer) {
        await updateCustomerMutation.mutateAsync({
          id: customer.id,
          data: payload,
        });
      } else {
        await createCustomerMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      const resData = err?.response?.data;
      if (resData) {
        if (typeof resData === 'string') {
          setErrorMessage(resData);
        } else if (resData.detail) {
          setErrorMessage(String(resData.detail));
        } else if (typeof resData === 'object') {
          const firstKey = Object.keys(resData)[0];
          const val = resData[firstKey];
          const text = Array.isArray(val) ? val.join(' ') : String(val);
          setErrorMessage(`${firstKey}: ${text}`);
        } else {
          setErrorMessage('Failed to save customer record. Please verify fields.');
        }
      } else {
        setErrorMessage(err?.message || 'Network error occurred while saving.');
      }
    }
  };

  const isSubmitting = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="xs">
          <ThemeIcon size={34} radius="md" color="brand" variant="light">
            <IconUser size={20} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              {isReadOnly
                ? 'Customer Profile'
                : customer
                ? 'Edit Customer'
                : 'Add New Customer'}
            </Text>
            <Text size="xs" c="dimmed">
              {customer ? `ID: ${customer.id.slice(0, 8)}...` : 'Register retail or wholesale customer'}
            </Text>
          </div>
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
        {errorMessage && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Validation Error"
            color="red"
            variant="light"
            withCloseButton
            onClose={() => setErrorMessage(null)}
          >
            {errorMessage}
          </Alert>
        )}

        {/* Existing Customer Quick Stats Banner */}
        {customer && (
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Group justify="space-between">
              <Group gap="xs">
                <Badge
                  color={customer.customer_type === 'B2B' ? 'indigo' : 'cyan'}
                  variant="light"
                  size="md"
                >
                  {customer.customer_type === 'B2B' ? 'Wholesale (B2B)' : 'Retail Consumer'}
                </Badge>
                <Badge color={customer.is_active ? 'green' : 'gray'} variant="dot" size="md">
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Group>

              <Group gap={6}>
                <ThemeIcon size={24} radius="xl" color="yellow" variant="light">
                  <IconSparkles size={14} />
                </ThemeIcon>
                <Text size="sm" fw={700}>
                  {customer.total_loyalty_points || 0} pts
                </Text>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Section 1: Customer Type & Phone Identity */}
        <div>
          <Text size="xs" fw={700} c="dimmed" mb={8} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            1. Classification & Mobile Identity
          </Text>

          <Stack gap="sm">
            <div>
              <Text size="xs" fw={600} mb={4}>
                Customer Type
              </Text>
              <SegmentedControl
                fullWidth
                value={customerType}
                onChange={(val) => setCustomerType(val as CustomerType)}
                disabled={isReadOnly}
                data={[
                  { label: 'Retail Consumer (B2C)', value: 'RETAIL' },
                  { label: 'Business / Wholesale (B2B)', value: 'B2B' },
                ]}
              />
            </div>

            <TextInput
              label="Primary Mobile Number"
              description="Primary unique POS identifier for instant counter checkout"
              placeholder="e.g. 9876543210"
              leftSection={<IconPhone size={16} />}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              disabled={isReadOnly}
              required
              rightSection={
                mobileStatus?.isValid ? (
                  <ThemeIcon size={20} radius="xl" color="green" variant="light">
                    <IconCheck size={12} />
                  </ThemeIcon>
                ) : null
              }
              error={
                mobileStatus && !mobileStatus.isValid && mobileStatus.digitCount > 0
                  ? 'Must be 10 digits (e.g. 9876543210)'
                  : undefined
              }
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Full Name"
                placeholder="e.g. Rajesh Kumar"
                leftSection={<IconUser size={16} />}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isReadOnly}
              />

              <TextInput
                label="Email Address"
                placeholder="e.g. customer@example.com"
                leftSection={<IconMail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isReadOnly}
              />
            </SimpleGrid>
          </Stack>
        </div>

        <Divider />

        {/* Section 2: B2B Tax Identification */}
        {customerType === 'B2B' && (
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Group gap="xs" mb="xs">
              <ThemeIcon size={26} radius="md" color="indigo" variant="light">
                <IconBuildingSkyscraper size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={700}>
                  Wholesale Tax & GST Compliance
                </Text>
                <Text size="xs" c="dimmed">
                  Official GSTIN and PAN details for B2B tax invoices
                </Text>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
              <div>
                <TextInput
                  label="GSTIN"
                  placeholder="29ABCDE1234F1Z5"
                  leftSection={<IconReceiptTax size={16} />}
                  value={gstin}
                  onChange={(e) => handleGstinChange(e.target.value)}
                  maxLength={15}
                  disabled={isReadOnly}
                />
                {gstinStatus && (
                  <Text size="11px" c={gstinStatus.valid ? 'green' : 'orange'} mt={4}>
                    {gstinStatus.valid
                      ? `✓ Valid format (Auto-extracted PAN: ${gstinStatus.derivedPan})`
                      : gstinStatus.message}
                  </Text>
                )}
              </div>

              <TextInput
                label="PAN Number"
                placeholder="ABCDE1234F"
                leftSection={<IconCreditCard size={16} />}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                maxLength={10}
                disabled={isReadOnly}
              />
            </SimpleGrid>
          </Paper>
        )}

        {/* Section 3: Demographics & Special Dates */}
        <div>
          <Text size="xs" fw={700} c="dimmed" mb={8} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            2. Customer Relationship & Milestones
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Date of Birth"
              type="date"
              placeholder="YYYY-MM-DD"
              leftSection={<IconCalendar size={16} />}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={isReadOnly}
            />

            <TextInput
              label="Anniversary Date"
              type="date"
              placeholder="YYYY-MM-DD"
              leftSection={<IconHeartHandshake size={16} />}
              value={anniversaryDate}
              onChange={(e) => setAnniversaryDate(e.target.value)}
              disabled={isReadOnly}
            />
          </SimpleGrid>
        </div>

        <Divider />

        {/* Section 4: Address Information */}
        <div>
          <Text size="xs" fw={700} c="dimmed" mb={8} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            3. Address & Location
          </Text>

          <Stack gap="sm">
            <TextInput
              label="Address Line 1"
              placeholder="Flat / House / Building No."
              leftSection={<IconMapPin size={16} />}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              disabled={isReadOnly}
            />

            <TextInput
              label="Address Line 2"
              placeholder="Street / Area / Landmark"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={isReadOnly}
            />

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label="City"
                placeholder="e.g. Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isReadOnly}
              />

              <Select
                label="State"
                placeholder="Select state"
                searchable
                clearable
                data={INDIAN_STATES}
                value={state || null}
                onChange={(val) => setState(val || '')}
                disabled={isReadOnly}
              />

              <TextInput
                label="Pincode"
                placeholder="e.g. 560001"
                maxLength={10}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                disabled={isReadOnly}
              />
            </SimpleGrid>
          </Stack>
        </div>

        <Divider />

        {/* Section 5: Store Mappings & Visits (Read Only / Audit) */}
        {customer?.store_mappings && customer.store_mappings.length > 0 && (
          <div>
            <Text size="xs" fw={700} c="dimmed" mb={8} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              4. Store Visits & Loyalty Accounts
            </Text>

            <Paper withBorder radius="md" p="xs">
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Store Branch</Table.Th>
                    <Table.Th>Loyalty Pts</Table.Th>
                    <Table.Th>Total Visits</Table.Th>
                    <Table.Th>Last Visit</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {customer.store_mappings.map((mapping) => (
                    <Table.Tr key={mapping.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {mapping.store_name || `Store #${mapping.store_id.slice(0, 6)}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="yellow" variant="light" size="sm">
                          {mapping.loyalty_points} pts
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{mapping.total_visits || 0}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {mapping.last_visit ? new Date(mapping.last_visit).toLocaleDateString() : 'Never'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </div>
        )}

        {/* Section 6: Notes & Active Status */}
        <div>
          <Text size="xs" fw={700} c="dimmed" mb={8} style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            5. Notes & Status
          </Text>

          <Stack gap="sm">
            <Textarea
              label="Internal Notes"
              placeholder="e.g. VIP customer, prefers morning delivery, wholesale discount agreement"
              leftSection={<IconNotes size={16} />}
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isReadOnly}
            />

            <Paper p="sm" radius="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={600}>
                    Active Status
                  </Text>
                  <Text size="xs" c="dimmed">
                    Allow lookups and invoice billing for this customer
                  </Text>
                </div>
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.currentTarget.checked)}
                  disabled={isReadOnly}
                  color="green"
                />
              </Group>
            </Paper>
          </Stack>
        </div>

        {/* Footer Actions */}
        {!isReadOnly && (
          <Group justify="flex-end" mt="md" pt="md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Button variant="default" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              color="brand"
              onClick={handleSubmit}
              loading={isSubmitting}
              leftSection={<IconCheck size={16} />}
            >
              {customer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
