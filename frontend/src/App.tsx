import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './features/auth/components/LoginForm';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OrganizationList } from './features/organizations/components/OrganizationList';
import { StoreList } from './features/stores/components/StoreList';
import { ProductList } from './features/products/components/ProductList';

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
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
