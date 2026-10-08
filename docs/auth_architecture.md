# Authentication Architecture

This document describes the design and implementation of the Authentication system for the `store-app`.

## Backend (Django REST Framework)
- **Model**: A custom `User` model inheriting from `BaseModel`, `AbstractBaseUser`, and `PermissionsMixin`. It replaces standard username with `email` for authentication.
- **JWT**: Handled by `djangorestframework-simplejwt`. The endpoints exposed are `/api/users/auth/login/` (generates access/refresh tokens) and `/api/users/auth/refresh/`.
- **CORS**: `django-cors-headers` is configured to allow requests from the React frontend running on port 5173.
- **Admin**: The Django admin interface is fully supported. The custom `UserManager.create_superuser` automatically assigns `is_staff` and `is_superuser` privileges.

## Frontend (React & Vite)
- **Data Fetching**: The `useLogin` TanStack query mutation sends credentials via the global Axios instance.
- **Form & Validation**: Built using `@mantine/form` mapped with a `zod` schema to validate email formatting and password length strictly on the client side.
- **Token Storage**: Upon successful login, the `access_token` and `refresh_token` are stored in `localStorage`. The global Axios interceptor (configured in `lib/axios.ts`) automatically attaches the `access_token` as a Bearer token to all subsequent API requests.
- **Routing**: `react-router-dom` maps the `/login` path to the `LoginForm` component.
