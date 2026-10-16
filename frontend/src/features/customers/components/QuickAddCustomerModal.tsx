import {
  Modal,
  Button,
  Group,
  Stack,
  TextInput,
  SegmentedControl,
  Text,
  Alert,
  ThemeIcon,
  Paper,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconReceiptTax,
  IconAlertCircle,
  IconCheck,
  IconUserPlus,
  IconCreditCard,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import { useCreateCustomer } from '../api';
import type { Customer, CustomerType } from '../types';

interface QuickAddCustomerModalProps {
  opened: boolean;
  onClose: () => void;
  initialMobile: string;
  onSuccess: (newCustomer: Customer) => void;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function QuickAddCustomerModal({
  opened,
  onClose,
  initialMobile,
  onSuccess,
}: QuickAddCustomerModalProps) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('RETAIL');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createCustomerMutation = useCreateCustomer();

  useEffect(() => {
    if (opened) {
      setMobileNumber(initialMobile);
      setName('');
      setCustomerType('RETAIL');
      setGstin('');
      setPanNumber('');
      setErrorMessage(null);
    }
  }, [opened, initialMobile]);

  const handleGstinChange = (val: string) => {
    const uppercase = val.toUpperCase();
    setGstin(uppercase);
    if (uppercase.length === 15 && GSTIN_REGEX.test(uppercase)) {
      setPanNumber(uppercase.substring(2, 12));
    }
  };

  const isGstinValid = useMemo(() => {
    if (!gstin) return true;
    return GSTIN_REGEX.test(gstin.trim().toUpperCase());
  }, [gstin]);

  const handleSave = async () => {
    setErrorMessage(null);
    const cleanMobile = mobileNumber.replace(/[\s\-()+]/g, '');

    if (!cleanMobile) {
      setErrorMessage('Mobile number is required.');
      return;
    }

    if (customerType === 'B2B' && gstin.trim() && !isGstinValid) {
      setErrorMessage('Invalid 15-character GSTIN format.');
      return;
    }

    try {
      const created = await createCustomerMutation.mutateAsync({
        mobile_number: cleanMobile,
        name: name.trim() || undefined,
        customer_type: customerType,
        gstin: gstin.trim().toUpperCase() || undefined,
        pan_number: panNumber.trim().toUpperCase() || undefined,
        is_active: true,
      });

      onSuccess(created);
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
          setErrorMessage('Failed to register customer.');
        }
      } else {
        setErrorMessage(err?.message || 'Error occurred while saving.');
      }
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size={28} radius="md" color="brand" variant="light">
            <IconUserPlus size={16} />
          </ThemeIcon>
          <Text fw={700} size="md">
            Fast Counter Customer Registration
          </Text>
        </Group>
      }
      centered
      radius="md"
      size="md"
    >
      <Stack gap="md">
        {errorMessage && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            withCloseButton
            onClose={() => setErrorMessage(null)}
          >
            {errorMessage}
          </Alert>
        )}

        <TextInput
          label="Mobile Number"
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
          leftSection={<IconPhone size={16} />}
          required
        />

        <TextInput
          label="Customer Name (Optional)"
          placeholder="e.g. Ramesh Patel"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftSection={<IconUser size={16} />}
          autoFocus
        />

        <div>
          <Text size="xs" fw={600} mb={4}>
            Customer Classification
          </Text>
          <SegmentedControl
            fullWidth
            value={customerType}
            onChange={(val) => setCustomerType(val as CustomerType)}
            data={[
              { label: 'Retail Consumer (B2C)', value: 'RETAIL' },
              { label: 'Wholesale / Business (B2B)', value: 'B2B' },
            ]}
          />
        </div>

        {customerType === 'B2B' && (
          <Paper p="sm" radius="md" withBorder style={{ backgroundColor: 'var(--bg-subtle)' }}>
            <Stack gap="xs">
              <TextInput
                label="GSTIN (Optional)"
                placeholder="29ABCDE1234F1Z5"
                leftSection={<IconReceiptTax size={16} />}
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                maxLength={15}
                error={gstin && !isGstinValid ? 'Must be 15 alphanumeric characters' : undefined}
              />

              <TextInput
                label="PAN Number"
                placeholder="ABCDE1234F"
                leftSection={<IconCreditCard size={16} />}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                maxLength={10}
              />
            </Stack>
          </Paper>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={createCustomerMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="brand"
            onClick={handleSave}
            loading={createCustomerMutation.isPending}
            leftSection={<IconCheck size={16} />}
          >
            Register &amp; Attach to Bill
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
