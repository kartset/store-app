# Multi-Tenant ERP & POS Architecture

Based on your design requirements, this architecture natively supports a multi-tenant SaaS model where **Organizations** have multiple **Stores**, and Users/Customers are mapped relationally.

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    ORGANIZATION ||--o{ STORE : owns
    ORGANIZATION ||--o{ PRODUCT : defines_catalog
    ORGANIZATION ||--o{ VENDOR : partners_with

    USER ||--o{ STORE_STAFF : employed_as
    USER ||--o| CUSTOMER : optional_link

    STORE ||--o{ STORE_STAFF : employs
    STORE ||--o{ STORE_CUSTOMER : registers
    STORE ||--o{ INVENTORY : holds
    STORE ||--o{ INVOICE : generates
    
    CUSTOMER ||--o{ STORE_CUSTOMER : shops_at
    
    VENDOR ||--o{ INVENTORY : supplies
    
    PRODUCT ||--o{ INVENTORY : stocked_as
    PRODUCT ||--o{ INVOICE_ITEM : sold_as
    
    INVOICE ||--|{ INVOICE_ITEM : contains
    INVOICE ||--o{ PAYMENT : paid_via

    ORGANIZATION {
        int id PK
        string name
        string subdomain UK
        boolean is_active
    }

    STORE {
        int id PK
        int organization_id FK
        string name
        string gst_number
        string address
        boolean is_active
    }

    USER {
        int id PK
        string username
        string email
        string password_hash
    }
    
    STORE_STAFF {
        int id PK
        int user_id FK
        int store_id FK
        string role "ADMIN, CASHIER, MANAGER"
    }

    CUSTOMER {
        int id PK
        int user_id FK "Nullable: if customer creates a web account"
        string mobile_number UK
        string name
        string email
    }
    
    STORE_CUSTOMER {
        int id PK
        int store_id FK
        int customer_id FK
        string loyalty_points
        datetime first_visit
    }

    VENDOR {
        int id PK
        int organization_id FK
        string name
        string contact_info
        string gst_number
    }

    PRODUCT {
        int id PK
        int organization_id FK
        string name
        string sku
        string hsn_code "For GST"
        decimal base_mrp
    }

    INVENTORY {
        int id PK
        int store_id FK
        int product_id FK
        int vendor_id FK "Nullable: primary supplier for this store"
        int stock_quantity
        decimal store_price "Allows store-specific pricing overrides"
    }

    INVOICE {
        int id PK
        int store_id FK
        int customer_id FK "Links to base CUSTOMER"
        string type "POS, ONLINE, RETURN"
        decimal subtotal
        decimal total_discount
        decimal total_gst
        decimal grand_total
        string status "DRAFT, PAID, CANCELLED"
        datetime created_at
    }

    INVOICE_ITEM {
        int id PK
        int invoice_id FK
        int product_id FK
        int quantity
        decimal unit_price
        decimal discount
        decimal gst_amount
    }

    PAYMENT {
        int id PK
        int invoice_id FK
        string method "CASH, CARD, UPI, RAZORPAY"
        string external_transaction_id
        decimal amount
        string status
    }
```

## Django Model Breakdown & Design Decisions

1. **`Organization` -> `Store` Hierarchy**
   - **`Organization`**: The top-level tenant. 
   - **`Store`**: A specific location/branch belonging to an organization.

2. **Decoupled Identity Models (`Users`, `Customers`, `Staff`)**
   - **`User`**: Global system auth identity (Django's built-in or custom AbstractUser).
   - **`StoreStaff`**: Maps a global `User` to a specific `Store` with a `role` (e.g., Cashier). A user could theoretically be staff across multiple stores.
   - **`Customer`**: A global identity record, keyed heavily by `mobile_number`. It has an optional One-to-One link to `User` (if the customer creates an account to log into the online storefront).
   - **`StoreCustomer`**: A mapping table linking a `Customer` to a `Store`. This allows a single customer (by mobile number) to be mapped to multiple stores across different orgs, while isolating store-specific data like loyalty points and visit history.

3. **Product & Inventory Strategy**
   - **`Product`**: Resides at the `Organization` level. This acts as the centralized catalog (Master Data).
   - **`Vendor`**: Resides at the `Organization` level. 
   - **`Inventory`**: Resides at the `Store` level. Links a `Product` to a `Store`, tracking local `stock_quantity`, optionally overriding the price for that specific store (`store_price`), and tracking which `Vendor` supplied that local stock.

4. **Transactional (`Invoice`, `InvoiceItem`, `Payment`)**
   - **`Invoice`**: Tied directly to a `Store` and a `Customer`. Captures POS transactions vs Online Orders via the `type` field.
   - **`InvoiceItem`**: Locks in the `unit_price`, `discount`, and `gst_amount` at the exact time of sale to ensure historical accuracy, even if the base product price changes later.
   - **`Payment`**: Supports tracking partial or multiple payments against a single invoice (e.g., split payment between Cash and Razorpay/UPI).

## Next Steps
Does this perfectly capture the data flow you envision? If so, we can consider this Architecture complete. 
Our next step would be breaking this into technical Plane tasks (e.g., "Implement User & Staff Models", "Implement Tenant & Catalog Models") and actually generating the Django `models.py`!
