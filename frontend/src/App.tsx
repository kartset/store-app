import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './features/auth/components/LoginForm';

// A temporary placeholder for the dashboard
function DashboardPlaceholder() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Dashboard (Protected)</h1>
      <p>Welcome! You are logged in.</p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/" element={<DashboardPlaceholder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
