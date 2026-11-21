import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './features/auth/components/LoginForm';
import { AuthCallback } from './features/auth/components/AuthCallback';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { RoleGuard } from './features/auth/components/RoleGuard';
import { PublicOnlyRoute } from './features/auth/components/PublicOnlyRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { StoreList } from './features/stores/components/StoreList';
import { ProductList } from './features/products/components/ProductList';
import { SubcategoryList } from './features/products/components/SubcategoryList';
import { InventoryList } from './features/inventory/components/InventoryList';
import { VendorList } from './features/vendors/components/VendorList';
import { CustomerList } from './features/customers/components/CustomerList';
import { InvoiceList } from './features/invoice/components/InvoiceList';
import { POSTerminal } from './features/pos/components/POSTerminal';
import { RegisterDashboard } from './features/register/components/RegisterDashboard';
import { OrderList } from './features/orders';
import { AnalyticsDashboard } from './features/analytics';
import { DataExchangeHub } from './features/data-exchange';
import { DeliveryList } from './features/delivery';
import { GSTDashboard } from './features/gst';
import { AISettingsPage } from './features/copilot';
import { StaffList } from './features/staff';

function App() {
  return (
    <Routes>
      {/* Public routes - Redirect already authenticated staff to /pos or intended redirect */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginForm />} />
      </Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Protected Dashboard Routes - Require valid authenticated session */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="organizations" element={<Navigate to="/pos" replace />} />

          {/* Org Admin Restricted Routes - Block unauthorized browser URL access */}
          <Route element={<RoleGuard requiredRole="ORG_ADMIN" />}>
            <Route path="stores" element={<StoreList />} />
            <Route path="staff" element={<StaffList />} />
            <Route path="users" element={<Navigate to="/staff" replace />} />
            <Route path="subcategories" element={<SubcategoryList />} />
            <Route path="ai-settings" element={<AISettingsPage />} />
          </Route>

          {/* General Authenticated Staff Routes */}
          <Route path="products" element={<ProductList />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="vendors" element={<VendorList />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="pos" element={<POSTerminal />} />
          <Route path="register" element={<RegisterDashboard />} />
          <Route path="orders" element={<OrderList />} />
          <Route path="deliveries" element={<DeliveryList />} />
          <Route path="gst" element={<GSTDashboard />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="data-exchange" element={<DataExchangeHub />} />
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
