import type { Product } from '../products/types';

export type StockMovementType =
  | 'PURCHASE_RECEIPT'
  | 'POS_SALE'
  | 'RETURN_RESTOCK'
  | 'DAMAGE_WASTE'
  | 'AUDIT_ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'INITIAL_STOCK';

export interface InventoryItem {
  id: string;
  store_id: string;
  product_id: string;
  vendor_id?: string | null;
  stock_quantity: number;
  store_price?: string | number | null;
  low_stock_threshold: number;
  reorder_quantity: number;
  batch_number?: string | null;
  last_restocked_at?: string | null;
  is_low_stock: boolean;
  effective_price?: string | number | null;
  store?: {
    id: string;
    name: string;
    organization_id?: string;
  };
  product?: Product;
  vendor?: {
    id: string;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface StockMovement {
  id: string;
  inventory_id: string;
  store_id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reason?: string;
  reference_id?: string | null;
  notes?: string;
  created_at: string;
  created_by?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
  store?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface InventorySummary {
  total_products: number;
  total_units_in_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_inventory_value: string | number;
}

export interface AdjustStockPayload {
  quantity_delta: number;
  movement_type: StockMovementType;
  reason?: string;
  reference_id?: string;
  notes?: string;
  allow_negative?: boolean;
}

export interface ReceiveGoodsItemPayload {
  product_id: string;
  quantity: number;
  store_price?: number | string | null;
  batch_number?: string | null;
}

export interface ReceiveGoodsPayload {
  store_id: string;
  vendor_id?: string | null;
  reference_id?: string;
  notes?: string;
  items: ReceiveGoodsItemPayload[];
}
