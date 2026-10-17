export interface CreateOrderRequest {
  invoice_id: string;
  amount?: number;
  method?: 'UPI' | 'CARD' | 'RAZORPAY';
  vpa?: string;
}

export interface CreateOrderResponse {
  gateway_order_id: string;
  payment_id: string;
  invoice_id: string;
  invoice_number: string;
  amount: string;
  currency: string;
  intent_uri: string;
  vpa: string;
  payee_name: string;
  transaction_ref: string;
  mode: 'MOCK' | 'LIVE';
}

export interface VerifyPaymentRequest {
  invoice_id: string;
  payment_id?: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  message: string;
  invoice_id: string;
  invoice_number: string;
  invoice_status: string;
  payment_id: string;
  amount_paid: string;
  total_settled: string;
  balance_remaining: string;
}

export interface PaymentStatusResponse {
  id: string;
  invoice_id: string;
  method: string;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  external_transaction_id: string | null;
  gateway_order_id: string | null;
  created_at: string;
  updated_at: string;
}
