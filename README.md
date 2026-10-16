# Store App

This is an assignment project for the 15CSE421 Net Centric Programming Course.

## Tech Stack

- **Backend:** Django (Python) & Django REST Framework
- **Database:** PostgreSQL
- **Frontend:** React + TypeScript (Vite, Zustand, TanStack Query)

## Backend Architecture Summary

The backend is designed with a highly modular and customized architecture, focused on avoiding circular dependencies, keeping migrations clean, and enabling dynamic nested API responses:

- **Centralized Database (`db`):** Instead of scattering database models across multiple Django apps, all models are housed in a single top-level `db` app. This prevents circular imports and creates a single, linear, conflict-free migration history.
- **Micro-App Segregation:** Application logic (Views, Serializers, URLs, Services) is broken down into 12 distinct, domain-specific packages inside `apps/` (e.g., `user`, `store`, `invoice`, `orders`), keeping business logic strictly separated from database configurations.
- **Custom DRF Serialization:** Foreign keys are explicitly defined with an `_id` suffix in the models (e.g., `store_id`). This intentionally reserves the clean attribute name (`store`) in the serializers for dynamically expanding nested JSON objects based on API request contexts.
- **BaseModel & Soft Deletes:** All entities inherit from a unified `BaseModel` using UUID primary keys, and featuring strict audit logging and highly indexed Soft Deletion (`is_deleted`, `deleted_at`).
- **Custom Auth:** Implements a custom user model derived strictly from `AbstractBaseUser`, removing dependencies on Django's default Admin user models.

## Key Implemented Modules

1. **4-Tier Master Product Catalog & Global Register**:
   - Universal manufacturer barcode auto-detection & 1-click global adoption.
   - Dual barcode support (EAN-13 manufacturer barcode + internal thermal sticker code).
   - Multi-tier category taxonomy with tenant-scoped subcategories.
2. **Store Inventory & Double-Entry Stock Movement Ledger**:
   - Multi-store inventory tracking with store-specific price overrides and low-stock alerts.
   - Goods Receipt Note (GRN) inwarding with batch and purchase costing.
   - Atomic `StockMovement` audit ledger for complete delta traceability.
3. **Vendor Management & Sourcing Catalog**:
   - Organization vendor directory with 15-digit GSTIN validation and payment terms.
   - Multi-vendor product sourcing matrix (`VendorProduct`) with negotiated purchase pricing.
   - Direct GRN inwarding integration pre-populating purchase costs.
4. **Customer 360, POS Fast Lookup & Multi-Store Loyalty**:
   - 2-tier customer architecture: global identity (`Customer`) + branch relationship (`StoreCustomer`).
   - Fast counter phone lookup (`< 50ms`) with automatic phone sanitization and walk-in fallback.
   - Rapid 4-field inline counter registration modal (`QuickAddCustomerModal`).
   - Loyalty points redemption calculator with smart bill ceiling and real-time discount deduction.
   - Customer 360 Profile drawer with lifetime metrics, chronological receipts, and itemized line breakdown.

---

_For the complete Database ERD and a deeper dive into the architectural design decisions, please view the documents in the `/docs/` directory._

