# StoreCraft Design System Specification

## 1. Overview & Philosophy
The **StoreCraft Design System** is an enterprise-grade visual and interactive design specification created for the `store-app` retail operating system. Built upon **React 19**, **Mantine v7**, and **Tabler Icons**, it replaces generic boilerplate styling with a refined, cohesive, and modern SaaS aesthetic.

The design philosophy emphasizes:
- **Visual Depth & Polish:** Frosted glassmorphism, subtle high-contrast borders, and multi-layered diffused shadows.
- **Operational Clarity:** High-visibility KPI cards, instant live search filtering, and unmistakable status indicators.
- **Micro-Interactions:** Subtle hover-lift physics, smooth state transitions, and live glowing status pulses.

---

## 2. Typography
The system standardizes on modern geometric and tabular fonts loaded via Google Fonts:

| Category | Font Family | Weights | Usage |
|---|---|---|---|
| **Headings** | `Plus Jakarta Sans`, sans-serif | 600, 700, 800 | Section titles, brand marks, KPI statistics |
| **Body & UI** | `Inter`, sans-serif | 400, 500, 600 | Data tables, form inputs, labels, descriptions |
| **Monospace / Numerical** | `JetBrains Mono`, monospace | 400, 500 | Record IDs, timestamps, GST numbers, currency values |

---

## 3. Color Palette & Surface Tokens

### Brand Primary Spectrum (Indigo / Violet)
Configured as the primary Mantine theme palette (`brand`):
```css
--brand-0: #eef2ff;  /* Subtle backgrounds & chip fills */
--brand-1: #e0e7ff;  /* Light hover states */
--brand-2: #c7d2fe;  /* Active borders */
--brand-3: #a5b4fc;  /* Highlight accents */
--brand-4: #818cf8;  /* Brand text accent */
--brand-5: #6366f1;  /* Vibrant primary (dark mode default) */
--brand-6: #4f46e5;  /* Primary interactive (light mode default) */
--brand-7: #4338ca;  /* Hover button state */
--brand-8: #3730a3;  /* Deep contrast elements */
--brand-9: #312e81;  /* Darkest brand boundary */
```

### Semantic Status Colors
- **Success / Active (`emerald`):** `#10b981` (Background: `#ecfdf5`). Indicates active registers, online stores, and operational status.
- **Warning (`amber`):** `#f59e0b` (Background: `#fffbeb`). Used for pending reviews and tax warnings.
- **Danger (`rose`):** `#ef4444` (Background: `#fef2f2`). Used for access denial, inactive states, and deletion confirmations.
- **Information (`sky`):** `#0ea5e9` (Background: `#f0f9ff`). Used for informational badges and hints.

### Surface Elevation & Contrast
```css
/* Light Mode */
--bg-page: #f8fafc;
--bg-surface: #ffffff;
--bg-surface-subtle: #f1f5f9;
--border-subtle: #e2e8f0;
--border-strong: #cbd5e1;
--text-primary: #0f172a;
--text-secondary: #475569;
--text-muted: #94a3b8;

/* Dark Mode */
--bg-page: #090d16;
--bg-surface: #0f172a;
--bg-surface-subtle: #1e293b;
--border-subtle: #1e293b;
--border-strong: #334155;
```

---

## 4. Elevation, Glassmorphism & Micro-Animations

### Glassmorphism
Header and modal panels incorporate frosted glass surfaces:
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
}
```

### Pulsing Status Indicator (`.pulse-dot`)
Active store registers and online terminals feature an animated glowing green indicator:
```css
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  background-color: var(--status-success);
  animation: pulse-ring 2s infinite;
}
```

### Interactive Hover Physics
Metric and listing cards respond smoothly on interaction:
```css
.interactive-card {
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1);
}
.interactive-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

---

## 5. Standardized Core Components

### 5.1. Authentication Hero Screen (`LoginForm`)
- **Split-Screen Composition:** Left showcase panel with ambient glowing mesh gradients, 3D retail POS terminal illustration, and platform features; right side housing the credential form.
- **Input Icons:** Integrated `@tabler/icons-react` (`IconMail`, `IconLock`).
- **Dynamic Feedback:** Instant light-red alert banner displaying the exact backend rejection reason (e.g. *"User is not associated with any active store."*).
- **Security Notice:** Role-Gated Access Control badge detailing staff-only permissions.

### 5.2. Dashboard Application Shell (`DashboardLayout`)
- **Header:** 68px fixed top bar containing the StoreCraft logo, live active store indicator chip with pulsing status dot, and user avatar with initials.
- **Sidebar:** Categorized domain navigation (`Organizations`, `Stores`) with active pill highlights, icons, and live system status footer.
- **Full Width Content:** Rescinded old template constraints to allow responsive full-screen data display up to 1280px max-width container.

### 5.3. Enterprise Listing Views (`OrganizationList` & `StoreList`)
- **KPI Summary Strip:** 3 metric cards displaying total counts, operational units, and compliance indicators.
- **Search Toolbar:** Instant client-side search filtering across names, subdomains, GST identifiers, and physical addresses.
- **Data Table:** Subtle zebra striping, hover highlight, custom avatar icons, status pills, and contextual action menus (`Launch Register Terminal`, `View Stores`).
- **Empty State:** Contextual icon and prompt when search queries return 0 results.
