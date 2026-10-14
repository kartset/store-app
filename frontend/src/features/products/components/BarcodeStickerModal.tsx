import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  SegmentedControl,
  NumberInput,
  Box,
  Divider,
} from '@mantine/core';
import { IconPrinter, IconBarcode, IconCheck } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import type { Product } from '../types';

interface BarcodeStickerModalProps {
  opened: boolean;
  onClose: () => void;
  product: Product | null;
  storeName?: string;
}

export function BarcodeStickerModal({
  opened,
  onClose,
  product,
  storeName = 'RETAIL STORE',
}: BarcodeStickerModalProps) {
  const defaultBarcodeType = product?.internal_barcode
    ? 'internal'
    : product?.barcode
      ? 'manufacturer'
      : 'sku';

  const [selectedBarcodeType, setSelectedBarcodeType] = useState<'internal' | 'manufacturer' | 'sku' | null>(null);
  const [copies, setCopies] = useState<number | string>(1);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeType = selectedBarcodeType ?? defaultBarcodeType;

  const activeBarcodeValue = product
    ? activeType === 'internal'
      ? product.internal_barcode || product.sku
      : activeType === 'manufacturer'
        ? product.barcode || product.sku
        : product.sku
    : '';

  useEffect(() => {
    if (opened && svgRef.current && activeBarcodeValue) {
      try {
        JsBarcode(svgRef.current, activeBarcodeValue, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.8,
          height: 44,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 3,
          margin: 6,
        });
      } catch (err) {
        console.warn('Barcode rendering fallback:', err);
      }
    }
  }, [opened, activeBarcodeValue]);

  if (!product) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeBarcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const barcodeSegments = [
    { label: `Internal (${product.internal_barcode || 'N/A'})`, value: 'internal', disabled: !product.internal_barcode },
    { label: `Global EAN (${product.barcode || 'N/A'})`, value: 'manufacturer', disabled: !product.barcode },
    { label: `SKU (${product.sku})`, value: 'sku' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconBarcode size={20} color="var(--brand-primary)" />
          <Text fw={700} size="md">
            Thermal Barcode Sticker Generator
          </Text>
        </Group>
      }
      size="md"
      radius="md"
      styles={{
        header: { borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' },
      }}
    >
      <Stack gap="md" pt="xs">
        {/* Barcode source selection */}
        <div>
          <Text size="xs" fw={700} c="dimmed" mb={6} style={{ textTransform: 'uppercase' }}>
            Select Barcode Source
          </Text>
          <SegmentedControl
            fullWidth
            size="xs"
            value={activeType}
            onChange={(val) => setSelectedBarcodeType(val as 'internal' | 'manufacturer' | 'sku')}
            data={barcodeSegments}
          />
        </div>

        {/* Sticker Print Preview Container */}
        <Box
          p="md"
          style={{
            backgroundColor: '#ffffff',
            border: '2px dashed var(--border-strong)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Label Card representing 50mm x 30mm thermal sticker */}
          <Box
            id="printable-barcode-sticker"
            style={{
              width: '280px',
              backgroundColor: '#ffffff',
              border: '1px solid #1e293b',
              borderRadius: '4px',
              padding: '10px 12px',
              textAlign: 'center',
              color: '#000000',
              fontFamily: 'monospace',
            }}
          >
            {/* Header: Store / Org Name */}
            <Text size="11px" fw={900} style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {storeName}
            </Text>

            {/* Product Title & Category */}
            <Text size="12px" fw={700} lineClamp={1} mt={2}>
              {product.name}
            </Text>

            {/* Sub-details: SKU & Tax */}
            <Group justify="space-between" mt={2} px={4}>
              <Text size="9px" c="#334155">
                SKU: {product.sku}
              </Text>
              <Text size="9px" c="#334155">
                GST: {Number(product.tax_slab)}%
              </Text>
            </Group>

            {/* Barcode SVG */}
            <Box my={4} style={{ display: 'flex', justifyContent: 'center' }}>
              <svg ref={svgRef} style={{ maxWidth: '100%' }} />
            </Box>

            {/* Footer Pricing: Maximum Retail Price */}
            <Group justify="space-between" align="center" mt={2} px={4}>
              <Text size="9px" c="#475569">
                {product.uom}
              </Text>
              <Text size="13px" fw={900} style={{ fontFamily: 'var(--font-sans)' }}>
                MRP: ₹{Number(product.base_mrp).toFixed(2)}
              </Text>
            </Group>
            <Text size="8px" c="#64748b">
              (Inclusive of all taxes)
            </Text>
          </Box>
        </Box>

        <Group justify="space-between" align="center">
          <Group gap="xs">
            <NumberInput
              label="Copies"
              value={copies}
              onChange={setCopies}
              min={1}
              max={500}
              size="xs"
              w={90}
            />
            <Button
              variant="light"
              color={copied ? 'teal' : 'gray'}
              size="xs"
              mt={24}
              onClick={handleCopyCode}
              leftSection={copied ? <IconCheck size={14} /> : <IconBarcode size={14} />}
            >
              {copied ? 'Copied' : 'Copy Code'}
            </Button>
          </Group>

          <Button
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
            mt={24}
            style={{
              background: 'var(--brand-gradient)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Print Sticker
          </Button>
        </Group>

        <Divider />

        <Group justify="space-between">
          <Badge size="xs" variant="outline" color="gray">
            Standard 50mm x 30mm Thermal Label
          </Badge>
          <Text size="xs" c="dimmed">
            Ready for ESC/POS, TSC & Zebra thermal printers
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
}
