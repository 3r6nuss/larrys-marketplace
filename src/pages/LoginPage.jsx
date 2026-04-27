import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Shield, Crown, Briefcase, User, Users } from 'lucide-react';

const DEV_ROLES = [
  { role: 'superadmin', label: 'Superadmin', icon: Crown, color: 'text-red-400', desc: 'Vollzugriff + Logs + Rückgängig' },
  { role: 'stv_admin', label: 'Stv. Admin', icon: Shield, color: 'text-orange-400', desc: 'Admin ohne Superadmin-Schutz' },
  { role: 'inhaber', label: 'Geschäftsinhaber', icon: Briefcase, color: 'text-yellow-400', desc: 'Mitarbeiter + Stats + Sperren' },
  { role: 'mitarbeiter', label: 'Mitarbeiter', icon: Users, color: 'text-cyan-400', desc: 'Inserate + Tickets + Tresor' },
  { role: 'kunde', label: 'Kunde', icon: User, color: 'text-gray-400', desc: 'Katalog + Anfragen' },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [devMode, setDevMode] = useState(false);
  const [checkingDev, setCheckingDev] = useState(true);

  useEffect(() => {
    // Check if dev mode is available
    fetch('/api/auth/dev-users')
      .then(r => r.json())
      .then(data => {
        if (data.dev_mode) setDevMode(true);
      })
      .catch(() => {})
      .finally(() => setCheckingDev(false));
  }, []);

  if (loading || checkingDev) {
    return (
      <div className="flex items-center justify-center min-h-screen gradient-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen gradient-bg p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl glow-primary">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/20">
            L
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Larry's Marketplace</CardTitle>
            <CardDescription className="mt-2">
              {devMode
                ? 'Entwicklungsmodus — Wähle eine Rolle zum Testen.'
                : 'Melde dich mit Discord an um auf den Marketplace zuzugreifen.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {devMode ? (
            <>
              <Badge variant="outline" className="w-full justify-center py-1.5 text-warning border-warning/30 bg-warning/10">
                ⚠️ Dev-Modus — Keine Discord-Credentials konfiguriert
              </Badge>
              <div className="space-y-2">
                {DEV_ROLES.map(({ role, label, icon: Icon, color, desc }) => (
                  <button
                    key={role}
                    onClick={() => window.location.href = `/api/auth/dev-login?role=${role}`}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all duration-200 cursor-pointer text-left group"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${color} shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">{desc}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">→</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={login}
                className="w-full h-12 text-base font-semibold gap-3 cursor-pointer"
                style={{ background: 'oklch(0.55 0.15 270)' }}
              >
                <svg width="20" height="20" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7546 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                </svg>
                Mit Discord anmelden
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Deine Daten werden sicher über Discord OAuth2 authentifiziert.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
