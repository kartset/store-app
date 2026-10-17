export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export type FulfillmentType =
  | 'STORE_PICKUP'
  | 'HOME_DELIVERY'
  | 'COUNTER_HOLD';

export type OrderPaymentStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  product_name_snapshot: string;
  sku_snapshot: string;
  barcode_snapshot?: string;
  quantity: number;
  unit_price: string | number;
  discount: string | number;
  tax_slab: string | number;
  tax_amount: string | number;
  line_total: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface OrderCustomerSnapshot {
  id?: string;
  name?: string;
  mobile_number?: string;
  email?: string;
}

export interface OrderStoreSnapshot {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

export interface Order {
  id: string;
  order_number: string;
  store_id: string;
  customer_id?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  payment_status: OrderPaymentStatus;
  subtotal: string | number;
  total_discount: string | number;
  total_tax: string | number;
  grand_total: string | number;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  customer_email_snapshot?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  delivery_notes?: string;
  confirmed_at?: string | null;
  packed_at?: string | null;
  ready_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string;
  notes?: string;
  store?: OrderStoreSnapshot;
  customer?: OrderCustomerSnapshot;
  items?: OrderItem[];
  items_count?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderFilterParams {
  store_id?: string;
  customer_id?: string;
  status?: string;
  fulfillment_type?: string;
  payment_status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price?: number;
  discount?: number;
}

export interface OrderCreatePayload {
  store_id: string;
  customer_id?: string | null;
  fulfillment_type: FulfillmentType;
  payment_status?: OrderPaymentStatus;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address_line1?: string;
  delivery_address_line2?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  delivery_notes?: string;
  notes?: string;
  items: OrderItemInput[];
}

export interface OrderConvertToInvoicePayload {
  payment_method?: 'CASH' | 'CARD' | 'UPI' | 'RAZORPAY' | 'STORE_CREDIT' | null;
  payment_amount?: number | string | null;
  register_session_id?: string | null;
  notes?: string;
}

export interface OrderStats {
  total_orders: number;
  pending: number;
  confirmed: number;
  packed: number;
  ready_for_pickup: number;
  completed: number;
  cancelled: number;
  today_orders: number;
  today_revenue: string;
}
