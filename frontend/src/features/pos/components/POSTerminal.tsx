import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Select,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconBarcode,
  IconSearch,
  IconTrash,
  IconShoppingCart,
  IconCheck,
  IconArrowRight,
  IconX,
  IconCashRegister,
  IconPlus,
  IconMinus,
  IconReceipt,
  IconClock,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from '@tabler/icons-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useStores } from '../../stores/api';
import { useInventory } from '../../inventory/api';
import { POSCustomerLookup } from '../../customers/components/POSCustomerLookup';
import { ThermalReceiptModal } from '../../invoice/components/ThermalReceiptModal';
import { ParkedCartsModal } from './ParkedCartsModal';
import { POSCheckoutModal } from './POSCheckoutModal';
import { ProductSearchModal } from './ProductSearchModal';
import { calculateCartTotals } from '../utils/calculations';
import { playBeep } from '../utils/sound';
import type { CartItem, ParkedCart } from '../types';
import type { Customer } from '../../customers/types';
import type { InventoryItem } from '../../inventory/types';
import type { Invoice } from '../../invoice/types';

export function POSTerminal() {
  // Store Selection
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

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0);
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState<number>(0);

  // Parked Carts State
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [parkedModalOpened, setParkedModalOpened] = useState(false);

  // Modals
  const [checkoutModalOpened, setCheckoutModalOpened] = useState(false);
  const [searchModalOpened, setSearchModalOpened] = useState(false);
  const [receiptModalOpened, setReceiptModalOpened] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [changeAlert, setChangeAlert] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Barcode / Fast Input Ref
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanQuery, setScanQuery] = useState('');

  // Inventory query for barcode scanning / auto-add
  const { data: inventoryItems = [] } = useInventory({
    store_id: selectedStoreId,
    search: scanQuery.trim() || undefined,
  });

  // Calculate Inter-state GST condition
  const isInterState = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.state || !activeStore) return false;
    // Check if store address or customer state indicates interstate
    return false;
  }, [selectedCustomer, activeStore]);

  // Cart Totals
  const totals = useMemo(() => {
    return calculateCartTotals(cartItems, loyaltyDiscount, isInterState, true);
  }, [cartItems, loyaltyDiscount, isInterState]);

  // Focus scan input on load
  useEffect(() => {
    scanInputRef.current?.focus();
  }, [selectedStoreId]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, let modal handle Esc or Enter
      if (checkoutModalOpened || searchModalOpened || parkedModalOpened || receiptModalOpened) {
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        // Focus mobile lookup input if present
        const phoneInput = document.querySelector('input[placeholder*="mobile"]') as HTMLInputElement;
        phoneInput?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setParkedModalOpened(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setCheckoutModalOpened(true);
        }
      } else if (e.key === 'Escape') {
        if (scanQuery) {
          setScanQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, checkoutModalOpened, searchModalOpened, parkedModalOpened, receiptModalOpened, scanQuery]);

  // Add inventory item to cart
  const handleAddItemToCart = (inv: InventoryItem) => {
    const prod = inv.product;
    if (!prod) return;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.product_id === prod.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        playBeep('success');
        return updated;
      }

      const price = Number(inv.effective_price || prod.base_mrp || 0);
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        inventory_id: inv.id,
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        barcode: prod.barcode || prod.internal_barcode || '',
        hsn_code: prod.hsn_code || '0000',
        quantity: 1,
        unit_price: price,
        mrp: Number(prod.base_mrp || price),
        cost_price: Number(prod.cost_price || 0),
        tax_slab: Number(prod.tax_slab || 0),
        discount: 0,
        stock_quantity: inv.stock_quantity,
        unit: prod.uom || 'units',
      };
      playBeep('success');
      return [...prev, newItem];
    });

    setScanQuery('');
    scanInputRef.current?.focus();
  };

  // Handle Barcode Scan / Enter submit
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanQuery.trim();
    if (!query) return;

    // Check if query exactly matches a product's barcode in current inventory
    const exactMatch = inventoryItems.find(
      (inv) =>
        inv.product?.barcode?.toLowerCase() === query.toLowerCase() ||
        inv.product?.internal_barcode?.toLowerCase() === query.toLowerCase() ||
        inv.product?.sku?.toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      handleAddItemToCart(exactMatch);
    } else {
      // Open search modal with current query
      setSearchModalOpened(true);
    }
  };

  // Modify Line Item Quantity
  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity: newQty } : it))
    );
  };

  // Modify Line Item Discount
  const handleDiscountChange = (itemId: string, discount: number) => {
    setCartItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, discount: Math.max(0, discount) } : it))
    );
  };

  // Remove Item
  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
    playBeep('warning');
  };

  // Clear Entire Cart
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('Are you sure you want to clear all items in the active cart?')) {
      setCartItems([]);
      setSelectedCustomer(null);
      setLoyaltyDiscount(0);
      setLoyaltyPointsRedeemed(0);
      setChangeAlert(null);
      playBeep('warning');
    }
  };

  // Park Current Cart
  const handleParkCurrentCart = (label: string) => {
    if (cartItems.length === 0) return;

    const parked: ParkedCart = {
      id: crypto.randomUUID(),
      parked_at: new Date().toISOString(),
      label,
      customer: selectedCustomer,
      items: cartItems,
      loyaltyPointsRedeemed,
      loyaltyDiscountAmount: loyaltyDiscount,
      notes: '',
      subtotal: totals.subtotal,
      grandTotal: totals.grandTotal,
    };

    setParkedCarts((prev) => [parked, ...prev]);
    setCartItems([]);
    setSelectedCustomer(null);
    setLoyaltyDiscount(0);
    setLoyaltyPointsRedeemed(0);
    setParkedModalOpened(false);
    playBeep('success');
  };

  // Resume Parked Cart
  const handleResumeParkedCart = (cart: ParkedCart) => {
    setCartItems(cart.items);
    setSelectedCustomer(cart.customer);
    setLoyaltyPointsRedeemed(cart.loyaltyPointsRedeemed);
    setLoyaltyDiscount(cart.loyaltyDiscountAmount);
    setParkedCarts((prev) => prev.filter((p) => p.id !== cart.id));
    setParkedModalOpened(false);
    playBeep('success');
  };

  // Delete Parked Cart
  const handleDeleteParkedCart = (cartId: string) => {
    setParkedCarts((prev) => prev.filter((p) => p.id !== cartId));
    playBeep('warning');
  };

  // On Successful Checkout
  const handleCheckoutSuccess = (createdInvoice: Invoice, changeReturned: number) => {
    setCompletedInvoice(createdInvoice);
    setCheckoutModalOpened(false);
    setReceiptModalOpened(true);

    if (changeReturned > 0) {
      setChangeAlert(changeReturned);
    } else {
      setChangeAlert(null);
    }

    // Reset Cart for next customer
    setCartItems([]);
    setSelectedCustomer(null);
    setLoyaltyDiscount(0);
    setLoyaltyPointsRedeemed(0);
    setScanQuery('');
    scanInputRef.current?.focus();
  };

  return (
    <Box
      p="sm"
      style={{
        minHeight: 'calc(100vh - 80px)',
        backgroundColor: 'var(--bg-app)',
        ...(isFullScreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              backgroundColor: 'white',
              overflowY: 'auto',
            }
          : {}),
      }}
    >
      <Stack gap="sm">
        {/* Top Header / Store & Terminal Toolbar */}
        <Paper
          p="sm"
          withBorder
          radius="md"
          style={{
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Badge
                color="brand"
                size="lg"
                variant="filled"
                leftSection={<IconCashRegister size={16} />}
              >
                POS Counter Terminal
              </Badge>

              <Select
                placeholder="Select Store Counter"
                data={stores.map((s) => ({ value: s.id, label: s.name }))}
                value={selectedStoreId}
                onChange={(val) => val && setSelectedStoreId(val)}
                size="xs"
                w={240}
                allowDeselect={false}
              />

              {activeStore && (
                <Text size="xs" c="dimmed">
                  GSTIN: <b>{activeStore.gst_number || 'N/A'}</b>
                </Text>
              )}
            </Group>

            {/* Quick Actions & Shortcut Status Strip */}
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                color={parkedCarts.length > 0 ? 'orange' : 'gray'}
                leftSection={<IconClock size={14} />}
                onClick={() => setParkedModalOpened(true)}
              >
                Hold / Parked ({parkedCarts.length}) [F8]
              </Button>

              <Tooltip label={isFullScreen ? 'Exit Full Screen' : 'Counter Full Screen'}>
                <ActionIcon
                  variant="default"
                  size="md"
                  onClick={() => setIsFullScreen((prev) => !prev)}
                >
                  {isFullScreen ? <IconArrowsMinimize size={16} /> : <IconArrowsMaximize size={16} />}
                </ActionIcon>
              </Tooltip>

              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={14} />}
                disabled={cartItems.length === 0}
                onClick={handleClearCart}
              >
                Clear Cart
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Change Return Alert Banner */}
        {changeAlert !== null && changeAlert > 0 && (
          <Alert
            color="teal"
            icon={<IconCheck size={20} />}
            title="Transaction Completed Successfully"
            withCloseButton
            onClose={() => setChangeAlert(null)}
          >
            <Group justify="space-between">
              <Text fw={800} size="md">
                Please return change to customer: ₹{changeAlert.toFixed(2)}
              </Text>
              <Button size="xs" color="teal" variant="light" onClick={() => setReceiptModalOpened(true)}>
                Reprint Receipt
              </Button>
            </Group>
          </Alert>
        )}

        {/* Main Grid: Left Cart / Terminal + Right Customer & Summary */}
        <Grid gap="sm">
          {/* Left Column: Barcode Scan Bar + Cart Items Table */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="sm">
              {/* High-Speed Barcode / SKU Scan Bar */}
              <Paper p="xs" withBorder radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <form onSubmit={handleScanSubmit}>
                  <Group gap="xs">
                    <TextInput
                      ref={scanInputRef}
                      placeholder="Scan barcode or type product name / SKU (Press Enter)... [F2]"
                      leftSection={<IconBarcode size={20} color="var(--mantine-color-brand-6)" />}
                      value={scanQuery}
                      onChange={(e) => setScanQuery(e.target.value)}
                      style={{ flex: 1 }}
                      size="md"
                      rightSection={
                        <Group gap={4} pr="xs">
                          <KbdShortcut shortcut="F2" />
                        </Group>
                      }
                    />

                    <Button
                      type="submit"
                      color="brand"
                      size="md"
                      leftSection={<IconSearch size={18} />}
                    >
                      Search / Add
                    </Button>
                  </Group>
                </form>
              </Paper>

              {/* Active Cart Items Table */}
              <Paper
                p="xs"
                withBorder
                radius="md"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  minHeight: 460,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {cartItems.length === 0 ? (
                  <Stack align="center" justify="center" style={{ flex: 1, padding: '40px 20px' }}>
                    <IconShoppingCart size={54} color="var(--mantine-color-gray-3)" />
                    <Title order={4} c="dimmed">
                      Counter Cart is Empty
                    </Title>
                    <Text size="sm" c="dimmed" ta="center" style={{ maxWidth: 360 }}>
                      Scan a product barcode with a barcode scanner or press <b>F2</b> to search items and add them to the bill.
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="brand"
                      leftSection={<IconSearch size={14} />}
                      onClick={() => setSearchModalOpened(true)}
                    >
                      Browse Product Catalog (F2)
                    </Button>
                  </Stack>
                ) : (
                  <Box style={{ overflowX: 'auto', flex: 1 }}>
                    <Table verticalSpacing="xs" highlightOnHover>
                      <Table.Thead style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>#</Table.Th>
                          <Table.Th>Item & Barcode</Table.Th>
                          <Table.Th style={{ width: 100 }}>GST %</Table.Th>
                          <Table.Th style={{ width: 120 }}>Unit Price</Table.Th>
                          <Table.Th style={{ width: 140, textAlign: 'center' }}>Qty</Table.Th>
                          <Table.Th style={{ width: 100 }}>Discount (₹)</Table.Th>
                          <Table.Th style={{ width: 120, textAlign: 'right' }}>Total</Table.Th>
                          <Table.Th style={{ width: 50 }}></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {cartItems.map((item, index) => {
                          const lineTotal = (item.unit_price - item.discount) * item.quantity;
                          const isLowStock = item.stock_quantity <= item.quantity;

                          return (
                            <Table.Tr key={item.id}>
                              <Table.Td>
                                <Text size="xs" c="dimmed" fw={600}>
                                  {index + 1}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Stack gap={2}>
                                  <Text fw={700} size="sm">
                                    {item.product_name}
                                  </Text>
                                  <Group gap={6}>
                                    {item.barcode && (
                                      <Badge size="xs" variant="light" color="blue" leftSection={<IconBarcode size={10} />}>
                                        {item.barcode}
                                      </Badge>
                                    )}
                                    <Text size="11px" c="dimmed">
                                      SKU: {item.sku}
                                    </Text>
                                    {isLowStock && (
                                      <Badge size="xs" color="orange" variant="light">
                                        Stock: {item.stock_quantity}
                                      </Badge>
                                    )}
                                  </Group>
                                </Stack>
                              </Table.Td>

                              <Table.Td>
                                <Badge size="xs" variant="outline" color="gray">
                                  {item.tax_slab}% GST
                                </Badge>
                              </Table.Td>

                              <Table.Td>
                                <Text fw={700} size="sm">
                                  ₹{item.unit_price.toFixed(2)}
                                </Text>
                                {item.mrp > item.unit_price && (
                                  <Text size="10px" c="dimmed" td="line-through">
                                    MRP ₹{item.mrp.toFixed(2)}
                                  </Text>
                                )}
                              </Table.Td>

                              <Table.Td>
                                <Group gap={4} justify="center">
                                  <ActionIcon
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  >
                                    <IconMinus size={12} />
                                  </ActionIcon>
                                  <NumberInput
                                    value={item.quantity}
                                    onChange={(val) => handleQuantityChange(item.id, typeof val === 'number' ? val : 1)}
                                    min={1}
                                    size="xs"
                                    w={60}
                                    styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
                                  />
                                  <ActionIcon
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  >
                                    <IconPlus size={12} />
                                  </ActionIcon>
                                </Group>
                              </Table.Td>

                              <Table.Td>
                                <NumberInput
                                  value={item.discount}
                                  onChange={(val) => handleDiscountChange(item.id, typeof val === 'number' ? val : 0)}
                                  min={0}
                                  max={item.unit_price}
                                  size="xs"
                                  w={80}
                                />
                              </Table.Td>

                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text fw={800} size="sm" c="brand">
                                  ₹{lineTotal.toFixed(2)}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <IconX size={14} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Box>
                )}

                {/* Bottom Quick Cart Summary Bar */}
                {cartItems.length > 0 && (
                  <Paper
                    p="xs"
                    withBorder
                    radius="md"
                    mt="xs"
                    style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Text size="xs" fw={700}>
                          Total Items: {cartItems.length}
                        </Text>
                        <Text size="xs" c="dimmed">
                          ({cartItems.reduce((acc, it) => acc + it.quantity, 0)} units)
                        </Text>
                      </Group>

                      <Group gap="sm">
                        <Text size="xs" c="dimmed">
                          Subtotal: <b>₹{totals.subtotal.toFixed(2)}</b>
                        </Text>
                        {totals.totalDiscount > 0 && (
                          <Badge color="green" size="xs">
                            Disc: -₹{totals.totalDiscount.toFixed(2)}
                          </Badge>
                        )}
                        <Text fw={800} size="sm" c="brand">
                          Current Net: ₹{totals.grandTotal.toFixed(2)}
                        </Text>
                      </Group>
                    </Group>
                  </Paper>
                )}
              </Paper>
            </Stack>
          </Grid.Col>

          {/* Right Column: Customer Identification & Financial Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="sm">
              {/* Customer Lookup Component */}
              <Paper p="xs" withBorder radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Group justify="space-between" mb="xs">
                  <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>
                    Customer & Loyalty [F4]
                  </Text>
                </Group>

                <POSCustomerLookup
                  storeId={selectedStoreId}
                  billTotal={totals.subtotal}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={setSelectedCustomer}
                  onLoyaltyDiscountChange={(discount, points) => {
                    setLoyaltyDiscount(discount);
                    setLoyaltyPointsRedeemed(points);
                  }}
                />
              </Paper>

              {/* Financial Totals & Tax Card */}
              <Card p="md" withBorder radius="md" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bill Summary & Taxes
                  </Text>

                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Gross Subtotal
                    </Text>
                    <Text fw={600} size="sm">
                      ₹{totals.subtotal.toFixed(2)}
                    </Text>
                  </Group>

                  {totals.totalDiscount > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="green">
                        Line Item Discounts
                      </Text>
                      <Text fw={600} size="sm" c="green">
                        - ₹{totals.totalDiscount.toFixed(2)}
                      </Text>
                    </Group>
                  )}

                  {totals.loyaltyDiscount > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="brand">
                        Loyalty Points Redeemed ({loyaltyPointsRedeemed} pts)
                      </Text>
                      <Text fw={700} size="sm" c="brand">
                        - ₹{totals.loyaltyDiscount.toFixed(2)}
                      </Text>
                    </Group>
                  )}

                  <Divider />

                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Taxable Amount
                    </Text>
                    <Text size="xs" fw={600}>
                      ₹{totals.taxableAmount.toFixed(2)}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      CGST (Intra-state)
                    </Text>
                    <Text size="xs" fw={600}>
                      ₹{totals.cgstAmount.toFixed(2)}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      SGST (Intra-state)
                    </Text>
                    <Text size="xs" fw={600}>
                      ₹{totals.sgstAmount.toFixed(2)}
                    </Text>
                  </Group>

                  {totals.roundOff !== 0 && (
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        Round Off
                      </Text>
                      <Text size="xs" fw={600}>
                        {totals.roundOff > 0 ? `+₹${totals.roundOff}` : `-₹${Math.abs(totals.roundOff)}`}
                      </Text>
                    </Group>
                  )}

                  <Divider />

                  {/* Grand Total Hero Display */}
                  <Paper
                    p="sm"
                    radius="md"
                    style={{
                      backgroundColor: 'var(--mantine-color-brand-0)',
                      border: '2px solid var(--mantine-color-brand-2)',
                    }}
                  >
                    <Stack gap={2}>
                      <Text size="xs" fw={700} c="brand" style={{ textTransform: 'uppercase' }}>
                        Grand Total Payable
                      </Text>
                      <Text fw={900} size="28px" c="brand" lh={1}>
                        ₹{totals.grandTotal.toFixed(2)}
                      </Text>
                      <Text size="11px" c="dimmed">
                        Inclusive of all applicable GST taxes
                      </Text>
                    </Stack>
                  </Paper>

                  {/* Checkout Button */}
                  <Button
                    size="lg"
                    color="brand"
                    fullWidth
                    disabled={cartItems.length === 0}
                    leftSection={<IconReceipt size={22} />}
                    rightSection={<IconArrowRight size={20} />}
                    onClick={() => setCheckoutModalOpened(true)}
                    style={{ fontWeight: 800, height: 52 }}
                  >
                    Pay & Checkout (F9)
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Product Search / Quick-Add Modal */}
      <ProductSearchModal
        opened={searchModalOpened}
        onClose={() => {
          setSearchModalOpened(false);
          scanInputRef.current?.focus();
        }}
        storeId={selectedStoreId}
        onSelectProduct={handleAddItemToCart}
      />

      {/* Parked Carts Modal */}
      <ParkedCartsModal
        opened={parkedModalOpened}
        onClose={() => setParkedModalOpened(false)}
        parkedCarts={parkedCarts}
        activeCartItems={cartItems}
        activeCustomer={selectedCustomer}
        activeLoyaltyPoints={loyaltyPointsRedeemed}
        activeLoyaltyDiscount={loyaltyDiscount}
        activeSubtotal={totals.subtotal}
        activeGrandTotal={totals.grandTotal}
        onParkCurrentCart={handleParkCurrentCart}
        onResumeCart={handleResumeParkedCart}
        onDeleteParkedCart={handleDeleteParkedCart}
      />

      {/* Checkout & Split Tender Modal */}
      <POSCheckoutModal
        opened={checkoutModalOpened}
        onClose={() => setCheckoutModalOpened(false)}
        storeId={selectedStoreId}
        storeName={activeStore?.name || 'Retail Store'}
        storeGstin={activeStore?.gst_number || undefined}
        customer={selectedCustomer}
        items={cartItems}
        totals={totals}
        loyaltyPointsRedeemed={loyaltyPointsRedeemed}
        onCheckoutSuccess={handleCheckoutSuccess}
      />

      {/* Printable Thermal Receipt Modal */}
      <ThermalReceiptModal
        opened={receiptModalOpened}
        onClose={() => setReceiptModalOpened(false)}
        invoice={completedInvoice}
      />
    </Box>
  );
}

function KbdShortcut({ shortcut }: { shortcut: string }) {
  return (
    <Text
      component="span"
      size="10px"
      fw={700}
      px={6}
      py={2}
      style={{
        backgroundColor: 'var(--mantine-color-gray-2)',
        borderRadius: 4,
        color: 'var(--mantine-color-gray-7)',
        border: '1px solid var(--mantine-color-gray-4)',
      }}
    >
      {shortcut}
    </Text>
  );
}
