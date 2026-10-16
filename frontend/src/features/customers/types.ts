export type CustomerType = 'RETAIL' | 'B2B';

export interface StoreCustomerMapping {
  id: string;
  store_id: string;
  store_name?: string;
  loyalty_points: number;
  credit_limit: string | number;
  outstanding_balance: string | number;
  total_visits: number;
  last_visit?: string | null;
  first_visit?: string | null;
}

export interface Customer {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_by?: string | null;
  is_deleted?: boolean;
  user_id?: string | null;
  mobile_number: string;
  name?: string | null;
  email?: string | null;
  customer_type: CustomerType;
  customer_type_display?: string;
  gstin?: string | null;
  pan_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  date_of_birth?: string | null;
  anniversary_date?: string | null;
  notes?: string | null;
  is_active: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  store_mappings?: StoreCustomerMapping[];
  total_loyalty_points: number;
}

export interface CreateCustomerInput {
  mobile_number: string;
  name?: string;
  email?: string;
  customer_type?: CustomerType;
  gstin?: string;
  pan_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  date_of_birth?: string | null;
  anniversary_date?: string | null;
  notes?: string;
  is_active?: boolean;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CustomerFilterParams {
  search?: string;
  customer_type?: CustomerType | '';
  is_active?: boolean;
}

export interface CustomerLookupResponse {
  found: boolean;
  mobile_number?: string;
  customer: Customer | null;
  store_loyalty_points: number;
  store_credit_limit: string | number;
  store_outstanding_balance: string | number;
  store_visits: number;
  store_relation?: {
    id: string;
    loyalty_points: number;
    credit_limit: string | number;
    outstanding_balance: string | number;
    total_visits: number;
    last_visit?: string | null;
    first_visit?: string | null;
  } | null;
  loyalty_points?: number;
  available_credit?: number;
}

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export interface InvoiceItem {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: string | number;
  discount: string | number;
  gst_amount: string | number;
}

export interface InvoicePayment {
  id: string;
  method: 'CASH' | 'CARD' | 'UPI' | 'RAZORPAY';
  amount: string | number;
  status: string;
  external_transaction_id?: string | null;
}

export interface CustomerInvoice {
  id: string;
  created_at: string;
  store_id: string;
  customer_id: string;
  type: 'POS' | 'ONLINE' | 'RETURN';
  status: 'DRAFT' | 'PAID' | 'CANCELLED';
  subtotal: string | number;
  total_discount: string | number;
  total_gst: string | number;
  grand_total: string | number;
  store?: {
    id: string;
    name: string;
  } | null;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}
