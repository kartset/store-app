export type RegisterSessionStatus = 'OPEN' | 'CLOSED';

export type CashTransactionType =
  | 'OPENING_FLOAT'
  | 'CASH_SALE'
  | 'CASH_REFUND'
  | 'CASH_DROP'
  | 'PETTY_PAYOUT';

export interface DenominationCounts {
  '2000': number;
  '500': number;
  '200': number;
  '100': number;
  '50': number;
  '20': number;
  '10': number;
  '5': number;
  coins: number;
  [key: string]: number;
}

export interface CashTransaction {
  id: string;
  type: CashTransactionType;
  type_display?: string;
  amount: string;
  reason: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  payment_id?: string | null;
  created_by?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  created_at: string;
}

export interface CashRegisterSession {
  id: string;
  store_id: string;
  store?: {
    id: string;
    name: string;
  };
  cashier_id: string;
  cashier?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  session_number: string;
  status: RegisterSessionStatus;
  opened_at: string;
  closed_at: string | null;
  opening_float: string;
  closing_cash_counted: string | null;
  closing_cash_variance: string | null;
  expected_cash: string;
  total_sales: string;
  total_cash_sales: string;
  total_card_sales: string;
  total_upi_sales: string;
  total_credit_sales: string;
  cash_drops_total: string;
  invoices_count: number;
  notes: string;
  closing_denominations: Record<string, number> | null;
  recent_transactions?: CashTransaction[];
}

export interface OpenRegisterPayload {
  store_id: string;
  opening_float: number | string;
  notes?: string;
  opening_denominations?: Record<string, number>;
}

export interface CashDropPayload {
  type: 'CASH_DROP' | 'PETTY_PAYOUT';
  amount: number | string;
  reason: string;
}

export interface CloseRegisterPayload {
  closing_cash_counted: number | string;
  closing_denominations?: Record<string, number>;
  notes?: string;
}
