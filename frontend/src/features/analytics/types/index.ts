export interface AnalyticsFilterParams {
  store_id?: string;
  start_date?: string;
  end_date?: string;
  granularity?: 'day' | 'week' | 'month';
  sort_by?: 'revenue' | 'units_sold';
  limit?: number;
}

export interface OverviewAnalyticsComparison {
  prev_gross: number;
  prev_net: number;
  prev_returns: number;
  prev_invoices: number;
  sales_growth_pct: number;
  invoice_growth_pct: number;
  prior_period_start: string;
  prior_period_end: string;
}

export interface OverviewAnalytics {
  period_start: string;
  period_end: string;
  store_id: string | null;
  gross_sales: number;
  net_sales: number;
  returns_total: number;
  total_tax: number;
  total_discount: number;
  total_invoices: number;
  total_orders: number;
  aov: number;
  comparison: OverviewAnalyticsComparison;
}

export interface SalesTrendPoint {
  date: string;
  label: string;
  gross_sales: number;
  net_sales: number;
  returns: number;
  discounts: number;
  taxes: number;
  invoice_count: number;
}

export interface SalesTrendAnalytics {
  granularity: 'day' | 'week' | 'month';
  start_date: string;
  end_date: string;
  trend: SalesTrendPoint[];
}

export interface TopProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category_name: string;
  revenue: number;
  units_sold: number;
  revenue_share_pct: number;
}

export interface TopProductsAnalytics {
  sort_by: 'revenue' | 'units_sold';
  period_total_revenue: number;
  products: TopProductItem[];
}

export interface CategoryBreakdownItem {
  category_id: string | null;
  category_name: string;
  revenue: number;
  units_sold: number;
  revenue_share_pct: number;
}

export interface CategoryBreakdownAnalytics {
  total_revenue: number;
  categories: CategoryBreakdownItem[];
}

export interface HourlyFootfallItem {
  hour: number;
  time_label: string;
  transaction_count: number;
  revenue: number;
  is_peak: boolean;
}

export interface HourlyFootfallAnalytics {
  peak_hour: number;
  peak_hour_label: string;
  total_transactions: number;
  hourly_distribution: HourlyFootfallItem[];
}

export interface PaymentMethodItem {
  method: string;
  label: string;
  count: number;
  total_amount: number;
  percentage: number;
}

export interface PaymentMethodsAnalytics {
  total_collected: number;
  payment_methods: PaymentMethodItem[];
}

export interface CriticalInventoryItem {
  id: string;
  product_name: string;
  sku: string;
  store_name: string;
  current_stock: number;
  min_stock_threshold: number;
  retail_price: number;
}

export interface InventoryHealthData {
  total_skus: number;
  total_valuation: number;
  healthy_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  healthy_pct: number;
  critical_items: CriticalInventoryItem[];
}
