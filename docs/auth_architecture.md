# Authentication Architecture

This document describes the design and implementation of the Authentication system for the `store-app`.

## Backend (Django REST Framework)
- **Model**: A decoupled user architecture is implemented:
  - **Internal Admin Operators (`auth.User`)**: Django's default `django.contrib.auth.models.User` (`auth_user` table) strictly for Django Admin (`/admin/`), developer access, and superusers.
  - **Application Users (`db.User`)**: Custom `db.User` model inheriting cleanly from `(BaseModel, AbstractBaseUser)` without `PermissionsMixin`, `is_staff`, or `is_superuser`. Replaces standard username with `email` for application authentication.
- **JWT & Auth Backend**: Custom `apps.user.auth.AppJWTAuthentication` and `AppTokenObtainPairSerializer` authenticate against `db.User`. The endpoints exposed are `/api/users/auth/login/` (generates access/refresh tokens) and `/api/users/auth/refresh/`.
- **CORS**: `django-cors-headers` is configured to allow requests from the React frontend running on port 5173.
- **Admin**: The Django admin interface at `/admin/` is reserved for internal staff/superusers (`auth.User`), while application models (including `db.User`) are registered for administrative inspection.

## Frontend (React & Vite)
- **Data Fetching**: The `useLogin` TanStack query mutation sends credentials via the global Axios instance.
- **Form & Validation**: Built using `@mantine/form` mapped with a `zod` schema to validate email formatting and password length strictly on the client side.
- **Token Storage**: Upon successful login, the `access_token` and `refresh_token` are stored in `localStorage`. The global Axios interceptor (configured in `lib/axios.ts`) automatically attaches the `access_token` as a Bearer token to all subsequent API requests.
- **Routing**: `react-router-dom` maps the `/login` path to the `LoginForm` component.
