import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProfileNameDialog from '@/components/ProfileNameDialog';
import { Skeleton } from '@/components/ui/skeleton';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const CustomerHomePage = lazy(() => import('@/pages/CustomerHomePage'));
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));

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

/** Redirects "/" based on the user's role, preserving query parameters */
function HomeRedirect() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingFallback />;
  if (!user) return <CustomerHomePage />;
  const ROLE_HIERARCHY = { superadmin: 5, stv_admin: 4, inhaber: 3, mitarbeiter: 2, kunde: 1 };
  const level = ROLE_HIERARCHY[user.role] || 1;
  const search = location.search;
  if (level >= 3) return <Navigate to={`/admin${search}`} replace />;
  if (level >= 2) return <Navigate to={`/mitarbeiter${search}`} replace />;
  return <Navigate to={`/kunde${search}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ProfileNameDialog />
          <Suspense fallback={<AppLoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route element={<DashboardLayout />}>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/kunde" element={<CustomerHomePage />} />
                <Route path="/mitarbeiter" element={<WorkspacePage />} />
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
