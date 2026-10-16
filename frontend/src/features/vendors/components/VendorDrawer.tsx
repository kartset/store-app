import {
  Drawer,
  Button,
  Group,
  Stack,
  TextInput,
  NumberInput,
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
} from '@mantine/core';
import {
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCreditCard,
  IconAlertCircle,
  IconCheck,
  IconReceiptTax,
  IconPhone,
  IconBuildingBank,
} from '@tabler/icons-react';

import { useState, useMemo, useEffect } from 'react';
import { useOrganizations } from '../../organizations/api';
import { useCreateVendor, useUpdateVendor } from '../api';
import {
  GST_STATE_CODE_MAP,
  PAYMENT_TERM_OPTIONS,
  type PaymentTerms,
  type Vendor,
} from '../types';

interface VendorDrawerProps {
  opened: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  defaultOrgId?: string;
  isReadOnly?: boolean;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function VendorDrawer({
  opened,
  onClose,
  vendor,
  defaultOrgId,
  isReadOnly = false,
}: VendorDrawerProps) {
  const { data: organizations } = useOrganizations();

  // Selected organization
  const [organizationId, setOrganizationId] = useState<string>('');

  // Basic Information
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [vendorCode, setVendorCode] = useState('');

  // Tax & Identification
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [stateCode, setStateCode] = useState('');

  // Contact & Address
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Commercial Terms
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('NET_30');
  const [creditLimit, setCreditLimit] = useState<number | string>(0);

  // Banking Info
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  // Operational & Notes
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & error handling
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createVendorMutation = useCreateVendor();
  const updateVendorMutation = useUpdateVendor();

  const isSubmitting = createVendorMutation.isPending || updateVendorMutation.isPending;

  // Initialize form when vendor changes or drawer opens
  useEffect(() => {
    if (vendor) {
      setOrganizationId(vendor.organization_id || '');
      setName(vendor.name || '');
      setTradeName(vendor.trade_name || '');
      setVendorCode(vendor.vendor_code || '');
      setGstin(vendor.gstin || vendor.gst_number || '');
      setPanNumber(vendor.pan_number || '');
      setStateCode(vendor.state_code || '');
      setContactPerson(vendor.contact_person || '');
      setPhone(vendor.phone || '');
      setEmail(vendor.email || '');
      setBillingAddress(vendor.billing_address || '');
      setCity(vendor.city || '');
      setState(vendor.state || '');
      setPincode(vendor.pincode || '');
      setPaymentTerms(vendor.payment_terms || 'NET_30');
      setCreditLimit(Number(vendor.credit_limit || 0));
      setBankName(vendor.bank_name || '');
      setBankAccountNumber(vendor.bank_account_number || '');
      setBankIfsc(vendor.bank_ifsc || '');
      setNotes(vendor.notes || '');
      setIsActive(vendor.is_active ?? true);
      setErrorMessage(null);
    } else {
      setOrganizationId(defaultOrgId || (organizations?.[0]?.id ?? ''));
      setName('');
      setTradeName('');
      setVendorCode('');
      setGstin('');
      setPanNumber('');
      setStateCode('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setBillingAddress('');
      setCity('');
      setState('');
      setPincode('');
      setPaymentTerms('NET_30');
      setCreditLimit(0);
      setBankName('');
      setBankAccountNumber('');
      setBankIfsc('');
      setNotes('');
      setIsActive(true);
      setErrorMessage(null);
    }
  }, [vendor, defaultOrgId, organizations, opened]);

  // Real-time GSTIN format validation & auto-derivation
  const gstinStatus = useMemo(() => {
    if (!gstin) return null;
    const clean = gstin.trim().toUpperCase();
    if (clean.length === 15) {
      if (GSTIN_REGEX.test(clean)) {
        const derivedStateCode = clean.substring(0, 2);
        const derivedPan = clean.substring(2, 12);
        const stateName = GST_STATE_CODE_MAP[derivedStateCode] || 'Known State';
        return {
          valid: true,
          derivedStateCode,
          derivedPan,
          stateName,
        };
      }
      return { valid: false, message: 'Invalid GSTIN checksum or pattern format.' };
    }
    return { valid: false, message: `15 characters required (${clean.length}/15 entered)` };
  }, [gstin]);

  // Handle GSTIN change with automatic state & PAN population
  const handleGstinChange = (value: string) => {
    const uppercase = value.toUpperCase();
    setGstin(uppercase);

    if (uppercase.length === 15 && GSTIN_REGEX.test(uppercase)) {
      const derivedCode = uppercase.substring(0, 2);
      const derivedPan = uppercase.substring(2, 12);

      // Auto-populate State Code and PAN if empty
      if (!stateCode || stateCode === '') {
        setStateCode(derivedCode);
      }
      if (!panNumber || panNumber === '') {
        setPanNumber(derivedPan);
      }
      if (!state && GST_STATE_CODE_MAP[derivedCode]) {
        setState(GST_STATE_CODE_MAP[derivedCode]);
      }
    }
  };

  const orgSelectData = useMemo(() => {
    return (
      organizations?.map((org) => ({
        value: org.id,
        label: org.name,
      })) || []
    );
  }, [organizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!organizationId) {
      setErrorMessage('Please select an organization.');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Vendor Legal Name is required.');
      return;
    }

    if (gstin && !GSTIN_REGEX.test(gstin.trim().toUpperCase())) {
      setErrorMessage('Invalid GSTIN format. Expected 15 characters (e.g. 27AAPFU0939F1ZV).');
      return;
    }

    if (panNumber && !PAN_REGEX.test(panNumber.trim().toUpperCase())) {
      setErrorMessage('Invalid PAN format. Expected 10 alphanumeric characters (e.g. AAPFU0939F).');
      return;
    }

    const payload = {
      organization_id: organizationId,
      name: name.trim(),
      trade_name: tradeName.trim() || undefined,
      vendor_code: vendorCode.trim() || undefined,
      gstin: gstin.trim().toUpperCase() || undefined,
      pan_number: panNumber.trim().toUpperCase() || undefined,
      contact_person: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      billing_address: billingAddress.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      state_code: stateCode.trim() || undefined,
      pincode: pincode.trim() || undefined,
      payment_terms: paymentTerms,
      credit_limit: typeof creditLimit === 'number' ? creditLimit : parseFloat(creditLimit) || 0,
      bank_name: bankName.trim() || undefined,
      bank_account_number: bankAccountNumber.trim() || undefined,
      bank_ifsc: bankIfsc.trim().toUpperCase() || undefined,
      notes: notes.trim() || undefined,
      is_active: isActive,
    };

    try {
      if (vendor) {
        await updateVendorMutation.mutateAsync({
          id: vendor.id,
          data: payload,
        });
      } else {
        await createVendorMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      const responseData = err?.response?.data;
      if (typeof responseData === 'object' && responseData !== null) {
        const errorStrings = Object.entries(responseData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join(' | ');
        setErrorMessage(errorStrings || 'Failed to save vendor details.');
      } else {
        setErrorMessage(err?.message || 'Network error occurred while saving vendor.');
      }
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="sm">
          <ThemeIcon size={32} radius="md" color="brand" variant="light">
            <IconBriefcase size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="md">
              {isReadOnly
                ? 'Vendor Details'
                : vendor
                ? `Edit Vendor: ${vendor.name}`
                : 'Add New Vendor'}
            </Text>
            <Text size="xs" c="dimmed">
              {vendor?.vendor_code ? `Code: ${vendor.vendor_code}` : 'Register supplier / distributor for procurement'}
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
          padding: '20px',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {errorMessage && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Error Saving Vendor"
              color="red"
              variant="light"
              withCloseButton
              onClose={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Alert>
          )}

          {/* SECTION 1: Basic Information */}
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size={24} radius="sm" color="blue" variant="light">
                <IconBuildingSkyscraper size={14} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                General Profile
              </Text>
            </Group>

            <Stack gap="sm">
              <Select
                label="Organization"
                placeholder="Select parent organization"
                data={orgSelectData}
                value={organizationId}
                onChange={(val) => setOrganizationId(val || '')}
                required
                disabled={isReadOnly || Boolean(vendor)}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Legal Business Name"
                  placeholder="e.g. Hindustan Unilever Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isReadOnly}
                />
                <TextInput
                  label="Trade Name / Brand"
                  placeholder="e.g. HUL / Unilever (Optional)"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  disabled={isReadOnly}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Vendor Internal Code"
                  placeholder="e.g. VEND-001 (Optional)"
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
                  disabled={isReadOnly}
                />
                <Group align="flex-end" style={{ height: '100%', paddingBottom: 6 }}>
                  <Switch
                    label="Vendor Active"
                    description="Permit purchasing & goods inwarding"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.currentTarget.checked)}
                    disabled={isReadOnly}
                    color="brand"
                  />
                </Group>
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* SECTION 2: Tax & Identification (GSTIN & PAN) */}
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <ThemeIcon size={24} radius="sm" color="teal" variant="light">
                  <IconReceiptTax size={14} />
                </ThemeIcon>
                <Text fw={700} size="sm">
                  Taxation & GST Compliance
                </Text>
              </Group>

              {gstinStatus?.valid && (
                <Badge
                  color="teal"
                  variant="light"
                  leftSection={<IconCheck size={12} />}
                  style={{ textTransform: 'none' }}
                >
                  {gstinStatus.stateName} (State {gstinStatus.derivedStateCode})
                </Badge>
              )}
            </Group>

            <Text size="xs" c="dimmed" mb="sm">
              Entering a 15-character GSTIN automatically parses the state code and PAN.
            </Text>

            <Stack gap="sm">
              <TextInput
                label="GSTIN (15-character)"
                placeholder="e.g. 27AAPFU0939F1ZV"
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                maxLength={15}
                disabled={isReadOnly}
                rightSection={
                  gstinStatus?.valid ? (
                    <ThemeIcon size={20} color="teal" radius="xl" variant="subtle">
                      <IconCheck size={14} />
                    </ThemeIcon>
                  ) : null
                }
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Permanent Account Number (PAN)"
                  placeholder="e.g. AAPFU0939F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  maxLength={10}
                  disabled={isReadOnly}
                />
                <TextInput
                  label="GST State Code"
                  placeholder="e.g. 27"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  maxLength={2}
                  disabled={isReadOnly}
                />
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* SECTION 3: Contact & Address */}
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size={24} radius="sm" color="indigo" variant="light">
                <IconPhone size={14} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Contact & Address
              </Text>
            </Group>

            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                <TextInput
                  label="Contact Person"
                  placeholder="e.g. Rahul Sharma"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  disabled={isReadOnly}
                />
                <TextInput
                  label="Phone Number"
                  placeholder="e.g. +91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isReadOnly}
                />
                <TextInput
                  label="Email Address"
                  placeholder="e.g. orders@vendor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isReadOnly}
                />
              </SimpleGrid>

              <Textarea
                label="Billing / Registered Address"
                placeholder="Full street address, plot number, industrial area"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                minRows={2}
                disabled={isReadOnly}
              />

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                <TextInput
                  label="City"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isReadOnly}
                />
                <TextInput
                  label="State"
                  placeholder="e.g. Maharashtra"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={isReadOnly}
                />
                <TextInput
                  label="Pincode"
                  placeholder="e.g. 400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  maxLength={10}
                  disabled={isReadOnly}
                />
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* SECTION 4: Commercial Terms & Credit */}
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size={24} radius="sm" color="orange" variant="light">
                <IconCreditCard size={14} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Commercial & Payment Terms
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Payment Terms"
                data={PAYMENT_TERM_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                value={paymentTerms}
                onChange={(val) => setPaymentTerms((val as PaymentTerms) || 'NET_30')}
                disabled={isReadOnly}
                required
              />

              <NumberInput
                label="Credit Limit (₹ INR)"
                placeholder="0.00"
                value={creditLimit}
                onChange={(val) => setCreditLimit(val)}
                min={0}
                decimalScale={2}
                thousandSeparator=","
                prefix="₹ "
                disabled={isReadOnly}
              />
            </SimpleGrid>
          </Paper>

          {/* SECTION 5: Banking Information */}
          <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <Group gap="xs" mb="sm">
              <ThemeIcon size={24} radius="sm" color="cyan" variant="light">
                <IconBuildingBank size={14} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Banking Details (For Payouts)
              </Text>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label="Bank Name"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={isReadOnly}
              />
              <TextInput
                label="Account Number"
                placeholder="e.g. 50200012345678"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                disabled={isReadOnly}
              />
              <TextInput
                label="IFSC Code"
                placeholder="e.g. HDFC0000123"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                disabled={isReadOnly}
              />
            </SimpleGrid>
          </Paper>

          {/* SECTION 6: Notes */}
          <Textarea
            label="Internal Notes & Remarks"
            placeholder="Add operational notes or supplier agreements..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
            disabled={isReadOnly}
          />

          <Divider />

          {/* Footer Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isSubmitting}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <Button type="submit" loading={isSubmitting} color="brand">
                {vendor ? 'Save Changes' : 'Create Vendor'}
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
