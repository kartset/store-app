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

---

_For the complete Database ERD and a deeper dive into the architectural design decisions, please view the documents in the `/docs/` directory._
