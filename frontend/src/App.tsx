import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './features/auth/components/LoginForm';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OrganizationList } from './features/organizations/components/OrganizationList';
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      
      {/* Protected Dashboard Routes */}
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/organizations" replace />} />
        <Route path="organizations" element={<OrganizationList />} />
        <Route path="stores" element={<StoreList />} />
        <Route path="products" element={<ProductList />} />
        <Route path="subcategories" element={<SubcategoryList />} />
        <Route path="inventory" element={<InventoryList />} />
        <Route path="vendors" element={<VendorList />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="pos" element={<POSTerminal />} />
        <Route path="register" element={<RegisterDashboard />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
      </Route>

      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
