export type PaymentTerms =
  | 'COD'
  | 'PREPAID'
  | 'NET_7'
  | 'NET_15'
  | 'NET_30'
  | 'NET_45'
  | 'NET_60';

export interface Vendor {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_by?: string | null;
  is_deleted: boolean;
  organization_id: string;
  organization?: {
    id: string;
    name: string;
    subdomain?: string;
  };
  name: string;
  trade_name?: string | null;
  vendor_code?: string | null;
  gstin?: string | null;
  pan_number?: string | null;
  gst_number?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_info?: string | null;
  billing_address?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  payment_terms: PaymentTerms;
  credit_limit: string | number;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface CreateVendorInput {
  organization_id: string;
  name: string;
  trade_name?: string;
  vendor_code?: string;
  gstin?: string;
  pan_number?: string;
  gst_number?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  contact_info?: string;
  billing_address?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  payment_terms?: PaymentTerms;
  credit_limit?: string | number;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  notes?: string;
  is_active?: boolean;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export interface VendorFilterParams {
  organization_id?: string;
  is_active?: boolean;
  payment_terms?: string;
  state_code?: string;
  search?: string;
}

export const PAYMENT_TERM_OPTIONS: { value: PaymentTerms; label: string; description: string }[] = [
  { value: 'COD', label: 'Cash On Delivery (COD)', description: 'Payment settled upon physical delivery' },
  { value: 'PREPAID', label: 'Prepaid Advance', description: 'Payment required prior to order dispatch' },
  { value: 'NET_7', label: 'Net 7 Days', description: 'Due 7 days after invoice receipt' },
  { value: 'NET_15', label: 'Net 15 Days', description: 'Due 15 days after invoice receipt' },
  { value: 'NET_30', label: 'Net 30 Days', description: 'Standard commercial 30-day billing cycle' },
  { value: 'NET_45', label: 'Net 45 Days', description: 'Due 45 days after invoice receipt' },
  { value: 'NET_60', label: 'Net 60 Days', description: 'Extended 60-day commercial terms' },
];

export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};
