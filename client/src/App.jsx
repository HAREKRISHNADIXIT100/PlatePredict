import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import StudentDashboard from './pages/StudentDashboard';
import StudentHistory from './pages/StudentHistory';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerTokens from './pages/ManagerTokens';
import ManagerDefaulters from './pages/ManagerDefaulters';
import ManagerMenus from './pages/ManagerMenus';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/verify-otp" element={user ? <Navigate to="/" replace /> : <VerifyOtp />} />

      {/* Student Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'MANAGER' ? <Navigate to="/manager" replace /> : (
            <AppLayout><StudentDashboard /></AppLayout>
          )}
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute role="STUDENT">
          <AppLayout><StudentHistory /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Manager Routes */}
      <Route path="/manager" element={
        <ProtectedRoute role="MANAGER">
          <AppLayout><ManagerDashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/tokens" element={
        <ProtectedRoute role="MANAGER">
          <AppLayout><ManagerTokens /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/defaulters" element={
        <ProtectedRoute role="MANAGER">
          <AppLayout><ManagerDefaulters /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/manager/menus" element={
        <ProtectedRoute role="MANAGER">
          <AppLayout><ManagerMenus /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
