import type { Customer } from '../customers/types';
import type { PaymentMethod } from '../invoice/types';

export interface CartItem {
  id: string; // unique line item id
  inventory_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  barcode: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  mrp: number;
  cost_price: number;
  tax_slab: number;
  discount: number; // line discount in rupees
  stock_quantity: number;
  unit: string;
}

export interface ParkedCart {
  id: string;
  parked_at: string;
  label: string;
  customer: Customer | null;
  items: CartItem[];
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
  notes: string;
  subtotal: number;
  grandTotal: number;
}

export interface PaymentTender {
  method: PaymentMethod;
  amount: number;
  amount_tendered?: number;
  change_returned?: number;
  external_transaction_id?: string;
}

export interface CartTaxBreakdown {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  loyaltyDiscount: number;
  netPayableBeforeRoundOff: number;
  roundOff: number;
  grandTotal: number;
}
