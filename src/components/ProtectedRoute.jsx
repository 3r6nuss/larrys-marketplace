import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Protects routes by requiring authentication and optionally a minimum role.
 * Renders children only if user is authenticated and has sufficient privileges.
 */
export default function ProtectedRoute({ children, minRole = 'kunde' }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.is_blocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-destructive">Account gesperrt</h1>
        <p className="text-muted-foreground">Dein Account wurde gesperrt. Bitte kontaktiere einen Administrator.</p>
      </div>
    );
  }

  if (!hasRole(minRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
