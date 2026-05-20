import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const CustomerHomePage = lazy(() => import('@/pages/CustomerHomePage'));
const WorkspacePage = lazy(() => import('@/pages/WorkspacePage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogsPage'));
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

/** Redirects "/" based on the user's role */
function HomeRedirect() {
 const { user, loading } = useAuth();
 if (loading) return <AppLoadingFallback />;
 if (!user) return <CustomerHomePage />;
 // Staff+ goes to workspace, customers go to kunde dashboard
 const ROLE_HIERARCHY = { superadmin: 5, stv_admin: 4, inhaber: 3, mitarbeiter: 2, kunde: 1 };
 const level = ROLE_HIERARCHY[user.role] || 1;
 if (level >= 2) return <Navigate to="/mitarbeiter" replace />;
 return <Navigate to="/kunde" replace />;
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
 <Route path="/" element={<HomeRedirect />} />
 <Route path="/kunde" element={<CustomerHomePage />} />
 <Route path="/mitarbeiter" element={<WorkspacePage />} />
 <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
 <Route path="/admin/stats" element={<StatsPage />} />
 <Route path="/admin/users" element={<UsersPage />} />
 <Route path="/admin/logs" element={<AuditLogsPage />} />
 <Route path="/admin/catalog" element={<CatalogAdminPage />} />
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
