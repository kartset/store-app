# Multi-Tenant Retail ERP & POS Database Architecture

Based on enterprise retail standards and Store App requirements, this architecture natively supports a multi-tenant SaaS model where **Organizations** operate multiple **Stores**, backed by a centralized **4-Tier Product & Inventory Hierarchy** and decoupled identity models.

---

## 1. 4-Tier Retail Entity Hierarchy

```text
Tier 1: Global Product Register (CatalogueItem) — Platform-wide master catalog (we curate & maintain)
   │
   ▼ (Adopted / Forked with Org Category, Subcategory, Brand & Custom Pricing)
Tier 2: Organization Product Master (Product) — Tenant-level catalog (shared across stores)
   │
   ▼ (Stocked with store-specific price override & threshold)
Tier 3: Store Inventory (Inventory) — Store-level stock holding
   │
   ▼ (Audited transactions)
Tier 4: Stock Movement Ledger (StockMovement) — Immutable audit ledger (Initial Stock, GRN, POS Sale, Damage, Audit)
```

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    CATALOGUE_ITEM ||--o{ PRODUCT : forks_into
    CATEGORY ||--o{ CATEGORY : parent_of
    CATEGORY ||--o{ ORGANIZATION_CATEGORY : adopted_by
    CATEGORY ||--o{ SUBCATEGORY : parents
    CATEGORY ||--o{ PRODUCT : categorizes
    
    ORGANIZATION ||--o{ STORE : owns
    ORGANIZATION ||--o{ ORGANIZATION_CATEGORY : opts_into
    ORGANIZATION ||--o{ SUBCATEGORY : defines
    ORGANIZATION ||--o{ BRAND : registers
    ORGANIZATION ||--o{ PRODUCT : defines_catalog
    ORGANIZATION ||--o{ VENDOR : partners_with
    ORGANIZATION ||--o{ ORGANIZATION_STAFF : employs

    STORE ||--o{ STORE_CATEGORY : operates
    STORE ||--o{ STORE_STAFF : employs
    STORE ||--o{ STORE_CUSTOMER : registers
    STORE ||--o{ INVENTORY : holds
    STORE ||--o{ INVOICE : generates

    PRODUCT ||--o{ INVENTORY : stocked_as
    PRODUCT ||--o{ INVOICE_ITEM : sold_as

    INVENTORY ||--o{ STOCK_MOVEMENT : tracks_movement

    USER ||--o{ ORGANIZATION_STAFF : member_of
    USER ||--o{ STORE_STAFF : employed_as
    USER ||--o| CUSTOMER : optional_link

    CUSTOMER ||--o{ STORE_CUSTOMER : shops_at
    CUSTOMER ||--o{ INVOICE : billed_to

    VENDOR ||--o{ INVENTORY : supplies

    INVOICE ||--|{ INVOICE_ITEM : contains
    INVOICE ||--o{ PAYMENT : paid_via

    CATALOGUE_ITEM {
        uuid id PK
        string name
        string sku UK
        string barcode UK "Universal EAN-13 / UPC"
        string brand_name
        string category_name
        string hsn_code "Harmonized GST Code"
        decimal tax_slab "0, 5, 12, 18, 28 percent"
        string uom "PCS, KG, LITRE, PACKET, etc."
        decimal suggested_mrp
        text description
        boolean is_active
    }

    CATEGORY {
        uuid id PK
        uuid parent_id FK "Self-referencing tree"
        string name
        string slug UK
        string default_hsn_code
        decimal default_tax_slab
        boolean is_active
        int display_order
    }

    ORGANIZATION {
        uuid id PK
        string name
        string subdomain UK
        boolean is_active
    }

    ORGANIZATION_CATEGORY {
        uuid id PK
        uuid organization_id FK
        uuid category_id FK
        boolean is_active
    }

    SUBCATEGORY {
        uuid id PK
        uuid organization_id FK
        uuid category_id FK
        string name
        string slug
        boolean is_active
        int display_order
    }

    BRAND {
        uuid id PK
        uuid organization_id FK
        string name
        string slug
        string logo_url
    }

    PRODUCT {
        uuid id PK
        uuid organization_id FK
        uuid catalogue_item_id FK "Nullable: links to Tier 1 Global Master"
        uuid category_id FK
        uuid subcategory_id FK
        uuid brand_id FK
        string name
        string sku UK_per_org
        string barcode "Universal EAN-13"
        string internal_barcode "Store thermal sticker STK-XXXXXX"
        string hsn_code
        decimal tax_slab
        decimal cost_price
        decimal base_mrp
        string uom
        int low_stock_threshold
        boolean is_perishable
        boolean has_expiry
        boolean is_returnable
        boolean is_active
    }

    STORE {
        uuid id PK
        uuid organization_id FK
        string name
        string code
        string gst_number
        string address
        string phone
        string email
        boolean is_active
    }

    STORE_CATEGORY {
        uuid id PK
        uuid store_id FK
        uuid category_id FK
        boolean is_active
    }

    INVENTORY {
        uuid id PK
        uuid store_id FK
        uuid product_id FK
        uuid vendor_id FK "Nullable primary supplier"
        int stock_quantity "Current on-hand sellable units"
        decimal store_price "Store price override vs base MRP"
        int low_stock_threshold
        boolean is_active
    }

    STOCK_MOVEMENT {
        uuid id PK
        uuid inventory_id FK
        string movement_type "INITIAL_STOCK, GRN_PURCHASE, POS_SALE, RETURN_RESTOCK, WASTE_DAMAGE, AUDIT_ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT"
        int quantity_delta "Signed integer (+ / -)"
        int balance_after "Stock balance post-operation"
        string reference_id "PO#, Bill#, Audit#"
        string reason
        uuid created_by FK
        datetime created_at
    }

    USER {
        uuid id PK
        string email UK
        string mobile_number UK
        string first_name
        string last_name
        boolean is_active
    }

    ORGANIZATION_STAFF {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        string role "ORG_ADMIN, CATALOG_MANAGER, PROCUREMENT_OFFICER, VIEWER"
        boolean is_active
    }

    STORE_STAFF {
        uuid id PK
        uuid user_id FK
        uuid store_id FK
        string role "STORE_MANAGER, CASHIER, INVENTORY_CLERK"
        boolean is_active
    }

    CUSTOMER {
        uuid id PK
        uuid user_id FK "Nullable web account"
        string mobile_number UK "Primary 10-digit phone identifier"
        string name "Full legal or display name"
        string email "Optional email"
        string customer_type "RETAIL (B2C) or B2B (Wholesale)"
        string gstin "15-digit GSTIN for B2B"
        string pan_number "10-digit PAN"
        string address_line1
        string address_line2
        string city
        string state
        string pincode
        date date_of_birth
        date anniversary_date
        text notes
        boolean is_active
    }

    STORE_CUSTOMER {
        uuid id PK
        uuid store_id FK
        uuid customer_id FK
        int loyalty_points "Store-specific points balance"
        decimal credit_limit "Max khata credit limit"
        decimal outstanding_balance "Unpaid credit balance"
        datetime first_visit
        datetime last_visit
        int total_visits
    }

    VENDOR {
        uuid id PK
        uuid organization_id FK
        string name
        string trade_name
        string vendor_code
        string gstin "15-digit GST Number"
        string pan_number "10-digit PAN"
        string contact_person
        string phone
        string email
        string city
        string state
        string state_code "2-digit GST State Code"
        string payment_terms "COD, NET_15, NET_30, etc."
        decimal credit_limit
        boolean is_active
    }

    INVOICE {
        uuid id PK
        uuid store_id FK
        uuid customer_id FK
        string invoice_number UK
        string type "POS, ONLINE, RETURN"
        decimal subtotal
        decimal total_discount
        decimal total_gst
        decimal grand_total
        string status "DRAFT, PAID, CANCELLED"
        datetime created_at
    }

    INVOICE_ITEM {
        uuid id PK
        uuid invoice_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
        decimal discount
        decimal gst_amount
    }

    PAYMENT {
        uuid id PK
        uuid invoice_id FK
        string method "CASH, CARD, UPI, RAZORPAY"
        string external_transaction_id
        decimal amount
        string status
    }
```

---

## 3. Core Architectural Highlights

1. **UUIDv4 & Soft Deletes via `BaseModel`**:
   - All primary keys across all tables are `UUIDv4`.
   - Comprehensive audit trails (`created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`, `is_deleted`).
   - Hard deletion is blocked; queries automatically filter out `is_deleted=True`.

2. **Decoupled User Identity (`db_user` vs `auth_user`)**:
   - `auth_user`: Built-in Django User strictly for Django Admin (`/admin/`) and superusers.
   - `db_user`: Application user model without permissions mixin or staff flags. Staff rights are checked via `OrganizationStaff` and `StoreStaff`.

3. **Dual Barcode Architecture**:
   - `Product.barcode`: Universal manufacturer EAN-13/UPC barcode. Auto-detected against the Global Product Register.
   - `Product.internal_barcode`: In-store thermal sticker code (e.g. `STK-998811`) for loose produce, custom items, or private labels.
   - Rapid POS resolution endpoint `/api/products/barcode/<code_or_sku>/` checks both barcodes and SKU in <50ms.

4. **Double-Entry Stock Movement Ledger**:
   - The on-hand `Inventory.stock_quantity` is modified strictly through `adjust_stock()` which creates an atomic `StockMovement` audit row.
   - Stock changes are fully traceable to an actor, reason, movement type, and reference ID (Invoice, GRN, Transfer).

5. **2-Tier Customer Identity & Multi-Branch Loyalty Engine**:
   - `Customer` maintains global identity anchored on normalized 10-digit mobile number across the enterprise.
   - `StoreCustomer` maintains branch-isolated relationships: accrued store loyalty points, visit counts, credit limit (khata), and outstanding debt.
   - POS lookup endpoint (`GET /api/customers/lookup/?mobile=...`) aggregates customer intelligence and branch-specific balances in <50ms.

