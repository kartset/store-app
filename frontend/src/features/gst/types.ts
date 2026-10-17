export interface GSTR1B2BItem {
  rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTR1B2BInvoice {
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
  customer_name: string;
  customer_gstin: string;
  pos: string;
  reverse_charge: string;
  invoice_type: string;
  items: GSTR1B2BItem[];
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTR1B2CLInvoice {
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
  pos: string;
  items: GSTR1B2BItem[];
  taxable_value: number;
  igst: number;
}

export interface GSTR1B2CSEntry {
  pos: string;
  type: string;
  rate: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTR1CreditNote {
  credit_note_number: string;
  credit_note_date: string;
  original_invoice_number: string;
  original_invoice_date: string;
  note_type: string;
  note_value: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  reason: string;
  customer_gstin?: string;
}

export interface GSTR1HSNEntry {
  hsn_code: string;
  description: string;
  uom: string;
  total_quantity: number;
  total_value: number;
  taxable_value: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTR1DocIssue {
  invoices: {
    doc_type: string;
    from_serial: string;
    to_serial: string;
    total_count: number;
    cancelled_count: number;
    net_issued: number;
  };
  credit_notes: {
    doc_type: string;
    total_count: number;
    cancelled_count: number;
    net_issued: number;
  };
}

export interface GSTR1SummaryData {
  gross_turnover: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  invoices_count: number;
  credit_notes_count: number;
  net_taxable_value: number;
  net_tax: number;
}

export interface GSTR1Response {
  period_key: string;
  store_id?: string | null;
  store_name: string;
  store_gstin: string;
  summary: GSTR1SummaryData;
  b2b: GSTR1B2BInvoice[];
  b2cl: GSTR1B2CLInvoice[];
  b2cs: GSTR1B2CSEntry[];
  cdnr: GSTR1CreditNote[];
  cdnur: GSTR1CreditNote[];
  hsn: GSTR1HSNEntry[];
  doc_issue: GSTR1DocIssue;
}

export interface GSTR3BTable31 {
  outward_taxable_supplies: {
    nature: string;
    taxable_value: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  zero_rated: {
    nature: string;
    taxable_value: number;
    igst: number;
    cess: number;
  };
  nil_exempt: {
    nature: string;
    taxable_value: number;
  };
  reverse_charge: {
    nature: string;
    taxable_value: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  non_gst: {
    nature: string;
    taxable_value: number;
  };
}

export interface GSTR3BInterstateEntry {
  pos: string;
  taxable_value: number;
  igst: number;
}

export interface GSTR3BResponse {
  period_key: string;
  store_id?: string | null;
  store_name: string;
  store_gstin: string;
  table_3_1: GSTR3BTable31;
  table_3_2: GSTR3BInterstateEntry[];
  tax_liability: {
    total_taxable_value: number;
    igst: number;
    cgst: number;
    sgst: number;
    total_tax_payable: number;
  };
}

export interface GSTFilingPeriod {
  id: string;
  store_id: string;
  period_key: string;
  return_type: 'GSTR1' | 'GSTR3B';
  return_type_display: string;
  status: 'DRAFT' | 'GENERATED' | 'FILED';
  status_display: string;
  is_locked: boolean;
  gross_turnover: string | number;
  taxable_value: string | number;
  cgst_amount: string | number;
  sgst_amount: string | number;
  igst_amount: string | number;
  total_tax: string | number;
  invoices_count: number;
  credit_notes_count: number;
  filed_at?: string | null;
  acknowledged_ref_number: string;
  gstn_json_cache?: any;
  notes: string;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    name: string;
    gst_number?: string;
    address?: string;
  };
}

export interface GeneratePeriodPayload {
  store_id: string;
  period_key: string;
  return_type?: 'GSTR1' | 'GSTR3B';
}

export interface MarkFiledPayload {
  store_id: string;
  period_key: string;
  return_type?: 'GSTR1' | 'GSTR3B';
  arn: string;
  notes?: string;
}
