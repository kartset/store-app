# Frontend Architecture & Setup

This document outlines the core structural and architectural decisions made for the React frontend of the `store-app`.

## 1. Tech Stack
- **Core:** React 19, TypeScript, Vite
- **UI Library:** Mantine (v7) + Tabler Icons
- **Routing:** React Router DOM
- **State Management:** Zustand (Global State), TanStack Query (Server State/Caching)
- **API Client:** Axios
- **Internationalization (i18n):** i18next + react-i18next
- **Forms & Validation:** Mantine Form + Zod

## 2. Feature-Sliced Design (FSD) Structure
To precisely mirror the backend's modular micro-app architecture, the frontend strictly adheres to a decoupled, domain-driven directory structure:

- `src/app/`: Global initialization (Providers, Router setup).
- `src/assets/`: Static assets (images, fonts).
- `src/components/`: Shared UI Kit components (Buttons, Modals). No business logic.
- `src/lib/`: Third-party client setups (Axios instances, i18n config).
- `src/store/`: Global Zustand stores (e.g., Theme, Auth state).
- `src/types/`: Global TypeScript interfaces matching backend models.
- `src/utils/`: Shared helper functions.
- `src/pages/`: Route-level page components.
- **`src/features/`**: The core business logic. Each feature (e.g., `auth`, `inventory`, `products`) acts as a self-contained micro-frontend containing its own `api/`, `components/`, and `store/`. Features strictly do not cross-import from other features to prevent tangled dependencies.

## 3. API Client & JWT Interceptors
A production-ready Axios instance is configured centrally at `src/lib/axios.ts`. 
- **Request Interceptor:** Automatically intercepts all outgoing requests to inject the JWT `access_token` into the Authorization header.
- **Response Interceptor:** Automatically catches `401 Unauthorized` errors to handle forced logouts/redirects globally.

## 4. Global App Providers
The `AppProvider.tsx` acts as the global shell, wrapping the application in:
- **MantineProvider:** Injects the UI theme and base CSS.
- **QueryClientProvider:** Configures TanStack Query with sane defaults (e.g., 60-second stale times, disabling refetch-on-window-focus).
- **BrowserRouter:** Manages the client-side routing tree.
