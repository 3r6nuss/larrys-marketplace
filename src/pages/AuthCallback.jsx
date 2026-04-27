import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * OAuth callback handler.
 * Discord redirects here after login. The backend has already set the session cookie
 * by the time we arrive, so we just refetch user info and redirect.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetchUser } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      // The backend /api/auth/discord/callback redirects here after setting cookie.
      // We just need to fetch the current user session.
      await refetchUser();

      const error = searchParams.get('error');
      if (error) {
        navigate('/login?error=' + error, { replace: true });
        return;
      }

      navigate('/', { replace: true });
    };

    handleCallback();
  }, [navigate, searchParams, refetchUser]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Anmeldung wird verarbeitet...</p>
    </div>
  );
}
