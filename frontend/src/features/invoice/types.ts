export type InvoiceType = 'POS' | 'ONLINE' | 'RETURN';
export type InvoiceStatus = 'DRAFT' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'RAZORPAY' | 'STORE_CREDIT' | 'LOYALTY_POINTS';

export interface InvoiceItem {
  id: string;
  created_at?: string;
  invoice_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  barcode_snapshot?: string;
  hsn_code?: string;
  quantity: number;
  returned_quantity?: number;
  returnable_quantity?: number;
  unit_price: number | string;
  discount: number | string;
  tax_slab: number | string;
  taxable_amount: number | string;
  gst_amount: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  line_total: number | string;
}

export interface InvoicePayment {
  id: string;
  created_at?: string;
  invoice_id: string;
  method: PaymentMethod;
  amount: number | string;
  amount_tendered?: number | string | null;
  change_returned?: number | string | null;
  external_transaction_id?: string;
  status: string;
}

export interface Invoice {
  id: string;
  created_at: string;
  updated_at?: string;
  store_id: string;
  customer_id?: string | null;
  invoice_number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  subtotal: number | string;
  total_discount: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  total_gst: number | string;
  round_off: number | string;
  grand_total: number | string;
  is_tax_inclusive: boolean;
  loyalty_points_redeemed: number;
  loyalty_discount_amount: number | string;
  loyalty_points_earned: number;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  customer_gstin_snapshot: string;
  notes: string;
  store?: {
    id: string;
    name: string;
    gst_number?: string;
    address?: string;
  };
  customer?: {
    id: string;
    name?: string;
    mobile_number: string;
    email?: string;
    gstin?: string;
    customer_type?: string;
  } | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface InvoiceFilterParams {
  store_id?: string;
  customer_id?: string;
  status?: InvoiceStatus;
  type?: InvoiceType;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface DailySummaryMetrics {
  date: string;
  store_id: string;
  total_invoices: number;
  paid_invoices_count: number;
  cancelled_invoices_count: number;
  total_sales: number | string;
  total_gst: number | string;
  total_discount: number | string;
  loyalty_discount: number | string;
  tender_breakdown: {
    cash: number | string;
    card: number | string;
    upi: number | string;
  };
}

export interface CheckoutLineItemInput {
  product_id: string;
  quantity: number;
  unit_price?: number | string;
  discount?: number | string;
}

export interface CheckoutPaymentInput {
  method: PaymentMethod;
  amount: number | string;
  amount_tendered?: number | string;
  change_returned?: number | string;
  external_transaction_id?: string;
}

export interface InvoiceCheckoutPayload {
  store_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string;
  type?: InvoiceType;
  is_tax_inclusive?: boolean;
  items: CheckoutLineItemInput[];
  payments?: CheckoutPaymentInput[];
  loyalty_points_to_redeem?: number;
  notes?: string;
}

export type ReturnReason =
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'EXPIRED'
  | 'CUSTOMER_DISSATISFACTION'
  | 'OTHER';

export type RefundMethod = 'CASH' | 'UPI' | 'STORE_CREDIT' | 'ORIGINAL_PAYMENT';
export type CreditNoteStatus = 'COMPLETED' | 'CANCELLED';

export interface CreditNoteItem {
  id: string;
  created_at?: string;
  credit_note_id: string;
  invoice_item_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  hsn_code?: string;
  quantity: number;
  unit_price: number | string;
  discount_reversed: number | string;
  tax_slab: number | string;
  taxable_amount: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  gst_amount: number | string;
  refund_amount: number | string;
  restock_inventory: boolean;
  reason: ReturnReason;
}

export interface CreditNote {
  id: string;
  created_at: string;
  updated_at?: string;
  store_id: string;
  store?: {
    id: string;
    name: string;
    gst_number?: string;
    address?: string;
    phone?: string;
  };
  invoice_id: string;
  invoice_number?: string;
  customer_id?: string | null;
  customer?: {
    id: string;
    name?: string;
    mobile_number: string;
    email?: string;
    gstin?: string;
    store_mappings?: Array<{
      store_id: string;
      store_credit_balance?: number | string;
      loyalty_points?: number;
    }>;
  } | null;
  customer_name?: string;
  customer_phone?: string;
  register_session_id?: string | null;
  credit_note_number: string;
  status: CreditNoteStatus;
  refund_method: RefundMethod;
  reason: ReturnReason;
  subtotal: number | string;
  total_discount_reversed: number | string;
  cgst_amount: number | string;
  sgst_amount: number | string;
  igst_amount: number | string;
  total_gst: number | string;
  total_refund_amount: number | string;
  loyalty_points_deducted: number;
  notes?: string;
  items: CreditNoteItem[];
}

export interface ReturnItemInput {
  invoice_item_id: string;
  quantity: number;
  reason?: ReturnReason;
  restock_inventory?: boolean;
}

export interface ProcessReturnPayload {
  items: ReturnItemInput[];
  refund_method?: RefundMethod;
  reason?: string;
  notes?: string;
}

export interface CreditNoteFilterParams {
  store_id?: string;
  invoice_id?: string;
  customer_id?: string;
  search?: string;
}
