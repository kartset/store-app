export type DeliveryType =
  | 'INTERNAL'
  | 'DUNZO'
  | 'SHADOWFAX'
  | 'PORTER'
  | 'BLUEDART'
  | 'DELHIVERY'
  | 'OTHER';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED';

export interface DeliveryStoreSnapshot {
  id: string;
  name: string;
  address?: string;
  gst_number?: string;
}

export interface DeliveryOrderSnapshot {
  id: string;
  order_number: string;
  status: string;
  fulfillment_type: string;
  payment_status: string;
  grand_total: string | number;
  items_count?: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  store_id: string;
  order_id?: string | null;
  invoice_id?: string | null;
  tracking_id: string;
  delivery_type: DeliveryType;
  delivery_type_display: string;
  status: DeliveryStatus;
  status_display: string;
  delivery_partner: string;
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_notes: string;
  otp_code?: string;
  is_cod: boolean;
  cod_amount_due: string | number;
  cod_amount_collected?: string | number | null;
  cod_payment_method?: string;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  store?: DeliveryStoreSnapshot;
  order?: DeliveryOrderSnapshot;
}

export interface DeliveryFilterParams {
  store_id?: string;
  status?: string;
  delivery_type?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export interface DeliveryCreatePayload {
  store_id?: string;
  order_id?: string | null;
  invoice_id?: string | null;
  delivery_type?: DeliveryType;
  delivery_partner?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_number?: string;
  recipient_name?: string;
  recipient_phone?: string;
  delivery_address?: string;
  delivery_notes?: string;
  is_cod?: boolean;
  cod_amount_due?: string | number;
}

export interface AssignDriverPayload {
  driver_name: string;
  driver_phone?: string;
  vehicle_number?: string;
  delivery_partner?: string;
  delivery_type?: DeliveryType;
  mark_out_for_delivery?: boolean;
}

export interface VerifyOTPPayload {
  otp_code: string;
  cod_amount_collected?: string | number;
  cod_payment_method?: string;
}

export interface UpdateStatusPayload {
  status: DeliveryStatus;
  reason?: string;
}

export interface PipelineSummary {
  total: number;
  pending: number;
  assigned: number;
  out_for_delivery: number;
  delivered: number;
  failed: number;
  returned: number;
  cancelled: number;
  total_cod_due: string;
  total_cod_collected: string;
}
