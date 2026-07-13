import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { setCatalogSparMode, useCatalogSparMode } from '@/hooks/useCatalogSparMode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Ticket, ChevronDown, Shield, Crown, Briefcase, Users, UserCircle, Gauge } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import ViewSwitcher from '@/components/ViewSwitcher';

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  stv_admin: 'Stv. Admin',
  inhaber: 'Geschäftsinhaber',
  mitarbeiter: 'Mitarbeiter',
  kunde: 'Kunde',
};

const ROLE_COLORS = {
  superadmin: 'text-red-400',
  stv_admin: 'text-orange-400',
  inhaber: 'text-yellow-400',
  mitarbeiter: 'text-primary',
  kunde: 'text-muted-foreground',
};

const DEV_ICONS = {
  superadmin: Crown,
  stv_admin: Shield,
  inhaber: Briefcase,
  mitarbeiter: Users,
  kunde: UserCircle,
};

const DEV_COLORS = {
  superadmin: 'text-red-400',
  stv_admin: 'text-orange-400',
  inhaber: 'text-yellow-400',
  mitarbeiter: 'text-cyan-400',
  kunde: 'text-gray-400',
};

export default function DashboardLayout() {
  const { user, login, logout } = useAuth();
  const { openTickets } = useNotifications();
  const [, setSearchParams] = useSearchParams();
  const [virtualUsers, setVirtualUsers] = useState([]);
  const sparMode = useCatalogSparMode();

  const canSwitch = user && (['superadmin', 'stv_admin', 'inhaber'].includes(user.role) || user.is_impersonating);

  useEffect(() => {
    if (canSwitch) {
      fetch('/api/auth/virtual-users', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { users: [] })
        .then(data => setVirtualUsers(data.users || []))
        .catch(() => setVirtualUsers([]));
    } else {
      setVirtualUsers([]);
    }
  }, [user, canSwitch]);

  const switchAccount = async (targetUserId) => {
    try {
      const r = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
        credentials: 'include'
      });
      if (r.ok) {
        window.location.reload();
      } else {
        const errData = await r.json();
        alert(errData.error || 'Fehler beim Accountwechsel.');
      }
    } catch {
      alert('Fehler beim Accountwechsel.');
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* ── Slim Topbar ── */}
        <header className="sticky top-0 z-50 h-14 border-b border-border/40 bg-background/60 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0">
          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm shrink-0 shadow-md shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
              L
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-black tracking-tight group-hover:text-primary transition-colors duration-200">Larry's</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Marketplace</span>
            </div>
          </Link>

          {/* Right: User area */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <Gauge className={`size-3.5 ${sparMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <span id="spar-mode-label" className="text-xs font-semibold">Sparmodus</span>
              <Switch
                id="catalog-spar-mode"
                size="sm"
                checked={sparMode}
                onCheckedChange={setCatalogSparMode}
                aria-labelledby="spar-mode-label"
              />
            </div>

            {/* Ticket Badge (quick access) */}
            {user && openTickets > 0 && (
              <button
                onClick={() => setSearchParams({ modal: 'tickets' })}
                className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                title="Offene Tickets"
              >
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {openTickets > 99 ? '99+' : openTickets}
                </span>
              </button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50">
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarImage src={user.avatar_url} alt={user.display_name} />
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:inline max-w-[100px] truncate">
                      {user.display_name || user.username}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    <p className={`text-xs mt-0.5 ${ROLE_COLORS[user.role] || ''}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSearchParams({ modal: 'profile' })} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </DropdownMenuItem>
                  {user.is_impersonating && (
                    <>
                      <DropdownMenuItem onClick={() => switchAccount(null)} className="text-warning focus:text-warning cursor-pointer font-semibold">
                        <Shield className="mr-2 h-4 w-4" />
                        Zurück zum Hauptaccount
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {canSwitch && virtualUsers.length > 0 && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                          Konto wechseln
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                          {virtualUsers.map((v) => {
                            const Icon = DEV_ICONS[v.role] || UserCircle;
                            const color = DEV_COLORS[v.role] || 'text-muted-foreground';
                            const isActive = user.id === v.id;
                            return (
                              <DropdownMenuItem
                                key={v.id}
                                onClick={() => switchAccount(v.id)}
                                className={`cursor-pointer ${isActive ? 'bg-muted' : ''}`}
                              >
                                <Icon className={`mr-2 h-4 w-4 ${color}`} />
                                <div className="flex flex-col">
                                  <span className="font-medium text-xs">{v.display_name}</span>
                                  <span className="text-[10px] text-muted-foreground">@{v.username} ({v.role})</span>
                                </div>
                                {isActive && <Badge variant="outline" className="ml-auto text-[8px] px-1.5 py-0.5">aktiv</Badge>}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={login} size="sm" className="gap-2 cursor-pointer text-xs h-8">
                <LogOut className="h-3.5 w-3.5" />
                Anmelden
              </Button>
            )}
          </div>
        </header>

        {/* ── Body: ViewSwitcher + Content ── */}
        <div className="flex flex-1 overflow-hidden">
          <ViewSwitcher />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>

        {/* ── Footer Disclaimer ── */}
        <footer className="border-t border-border/50 bg-muted/20 py-4 px-4 md:px-6 text-center text-[10px] text-muted-foreground/60 leading-relaxed shrink-0">
          <p className="max-w-4xl mx-auto">
            Listings, pricing, and imagery on this website may be fictional or illustrative and do not represent real-world products, services, or transactions. All content is created for entertainment purposes within a fictional roleplay context. Larry's Marketplace is a fictional business operating within a GTA RP server environment. This is an independent creative presentation and is not affiliated with, sponsored by, or endorsed by Rockstar Games, Take-Two Interactive, or any related entities. All trademarks, game assets, and intellectual property mentioned or depicted belong to their respective owners.
          </p>
        </footer>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
