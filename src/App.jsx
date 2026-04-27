import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const CatalogPage = lazy(() => import('@/pages/CatalogPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const ListingsPage = lazy(() => import('@/pages/ListingsPage'));
const TicketsPage = lazy(() => import('@/pages/TicketsPage'));
const VaultPage = lazy(() => import('@/pages/VaultPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogsPage'));
const CalculatorPage = lazy(() => import('@/pages/CalculatorPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const CatalogAdminPage = lazy(() => import('@/pages/CatalogAdminPage'));

function AppLoadingFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Suspense fallback={<AppLoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route element={<DashboardLayout />}>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/profile" element={<ProtectedRoute minRole="kunde"><ProfilePage /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute minRole="mitarbeiter"><DashboardPage /></ProtectedRoute>} />
                <Route path="/dashboard/listings" element={<ProtectedRoute minRole="mitarbeiter"><ListingsPage /></ProtectedRoute>} />
                <Route path="/dashboard/tickets" element={<ProtectedRoute minRole="kunde"><TicketsPage /></ProtectedRoute>} />
                <Route path="/dashboard/tickets/new" element={<ProtectedRoute minRole="kunde"><TicketsPage /></ProtectedRoute>} />
                <Route path="/dashboard/calculator" element={<ProtectedRoute minRole="mitarbeiter"><CalculatorPage /></ProtectedRoute>} />
                <Route path="/dashboard/vault" element={<ProtectedRoute minRole="mitarbeiter"><VaultPage /></ProtectedRoute>} />
                <Route path="/admin/stats" element={<ProtectedRoute minRole="inhaber"><StatsPage /></ProtectedRoute>} />
                <Route path="/admin/catalog" element={<ProtectedRoute minRole="superadmin"><CatalogAdminPage /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute minRole="inhaber"><UsersPage /></ProtectedRoute>} />
                <Route path="/admin/logs" element={<ProtectedRoute minRole="stv_admin"><AuditLogsPage /></ProtectedRoute>} />
              </Route>
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
