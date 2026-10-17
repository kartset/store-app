export interface ImportRowError {
  row: number;
  sku?: string;
  mobile?: string;
  error: string;
}

export interface ProductPreviewItem {
  row_num: number;
  name: string;
  sku: string;
  category: string;
  base_mrp: string;
  cost_price: string;
  stock_qty: number;
}

export interface CustomerPreviewItem {
  row_num: number;
  name: string;
  mobile_number: string;
  email?: string | null;
  customer_type: string;
  gstin?: string | null;
  loyalty_points: number;
}

export interface DryRunResponse<T = any> {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: ImportRowError[];
  preview: T[];
}

export interface ImportCommitResponse {
  success: boolean;
  dry_run: boolean;
  imported_count?: number;
  updated_count?: number;
  created_count?: number;
  inwarded_inventory_count?: number;
  errors: ImportRowError[];
}

export type TemplateType = 'products' | 'customers' | 'inventory';

export type ExportEntity = 'products' | 'inventory' | 'invoices' | 'customers';

export interface ExportFilterParams {
  store_id?: string;
  start_date?: string;
  end_date?: string;
}
