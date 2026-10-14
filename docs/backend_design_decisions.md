# Backend Application Structure & Design Decisions

This document outlines the core structural and architectural decisions made for the Django backend of the `store-app`, capturing the specific design philosophy and custom patterns introduced during scaffolding.

## 1. Project Core Configuration
- **Decision:** The default Django root folder (originally `store_backend`) was renamed to `core`.
- **Reason:** To explicitly denote that this folder holds the core, global configuration of the project (e.g., `settings.py`, `wsgi.py`, `asgi.py`, `urls.py`) rather than being treated as just another application module.

## 2. Centralized Database App (`db`)
- **Decision:** All database models are housed in a single, top-level Django app named `db` (located at `backend/db/`).
- **Reason:** Inspired by enterprise architectures like Plane.dev, this approach prevents circular dependencies between models. By treating the database schema as a single monolithic Django app, all migrations are centralized into a single flat `db/migrations/` folder. This guarantees a linear, conflict-free database migration history.

## 3. Micro-App Business Logic Segregation (`apps/`)
- **Decision:** The application's business logic is segregated into 12 distinct domain folders inside `backend/apps/` (e.g., `user`, `store`, `invoice`, `inventory`). However, these are standard Python packages, *not* registered Django apps.
- **Reason:** This mimics a microservice/microapp architecture. It allows strict segregation of domain logic (API views, serializers, services, URLs) without tangling them in Django's rigid app structure or scattering database migrations across 12 different folders.

## 4. Custom Serialization Pattern (Explicit `_id` Foreign Keys)
- **Decision:** All `ForeignKey` and `OneToOneField` relationships in the models are explicitly defined with an `_id` suffix (e.g., `store_id = models.ForeignKey(...)`).
- **Reason:** This is a custom architectural pattern designed for dynamic, GraphQL-like field expansion in Django REST Framework (DRF). By forcing the ID column to be explicitly named `store_id`, it reserves the clean `store` attribute purely for nested object serialization. This allows clients to dynamically request nested data (e.g., passing `fields=store.id,store.name` in the API context) while avoiding namespace collisions between the UUID field and the nested object representation.

## 5. Global BaseModel & Soft Deletes
- **Decision:** Every model in the system inherits from a unified `BaseModel`.
- **Reason:** 
  - **UUID Primary Keys:** Uses UUID4 as the primary identifier across all tables.
  - **Audit Logging:** Automatically tracks `created_at`, `updated_at`, `created_by`, and `updated_by`.
  - **Soft Deletes:** Prevents destructive data loss. Models track `deleted_at`, `deleted_by`, and a boolean `is_deleted`. An explicit database index is placed on `is_deleted` to ensure high-performance querying when filtering out deleted records.

## 6. String-Based Foreign Key References
- **Decision:** All foreign keys are referenced using string literals (e.g., `'db.Organization'`) rather than direct Python class imports.
- **Reason:** Prevents Python-level circular import issues during compilation. It ensures models remain decoupled at the parsing level, even though they all reside within the same `db` module.

## 7. Decoupled User & Admin Architecture
- **Decision:** The application separates internal Django Admin operators from end-user business identities:
  - **Internal Admin Users (`auth.User`):** Uses Django's default `django.contrib.auth.models.User` (`auth_user` table) strictly for Django Admin (`/admin/`), developer access, and superusers.
  - **Application Users (`db.User`):** Derives cleanly from `(BaseModel, AbstractBaseUser)` (`db_user` table) without `PermissionsMixin`, `is_staff`, or `is_superuser`. Used for retail store staff, cashiers, managers, and registered customers.
  - **Authentication:** Application APIs authenticate via `apps.user.auth.AppJWTAuthentication` and `AppTokenObtainPairSerializer`, keeping application tokens and identities isolated to `db.User`.
  - **Audit Logging:** System-wide audit foreign keys (`created_by`, `updated_by`, `deleted_by`) in `BaseModel` directly reference `db.User`.
