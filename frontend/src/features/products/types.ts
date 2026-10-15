export type UnitOfMeasure =
  | 'PCS'
  | 'KG'
  | 'G'
  | 'LITRE'
  | 'ML'
  | 'BOX'
  | 'PACKET'
  | 'METER';

export interface Category {
  id: string;
  parent_id?: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  name: string;
  slug: string;
  description?: string | null;
  default_hsn_code?: string | null;
  default_tax_slab?: string | number | null;
  is_active: boolean;
  display_order: number;
  subcategories?: Category[];
}

export interface Subcategory {
  id: string;
  organization_id: string;
  category_id: string;
  category?: Category | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSubcategoryPayload {
  organization_id: string;
  category_id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  organization_id: string;
  catalogue_item_id?: string | null;
  category_id?: string | null;
  category?: Category | null;
  subcategory_id?: string | null;
  subcategory?: Subcategory | null;
  brand_id?: string | null;
  brand?: Brand | null;
  name: string;
  sku: string;
  barcode?: string | null;
  internal_barcode?: string | null;
  hsn_code?: string | null;
  tax_slab: string | number;
  cost_price: string | number;
  base_mrp: string | number;
  uom: UnitOfMeasure;
  description?: string | null;
  is_perishable: boolean;
  has_expiry: boolean;
  is_returnable: boolean;
  is_active: boolean;
  low_stock_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductPayload {
  organization_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  brand_id?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  internal_barcode?: string | null;
  hsn_code?: string | null;
  tax_slab: string | number;
  cost_price: string | number;
  base_mrp: string | number;
  uom: UnitOfMeasure;
  description?: string | null;
  is_perishable?: boolean;
  has_expiry?: boolean;
  is_returnable?: boolean;
  is_active?: boolean;
  low_stock_threshold?: number;
}
