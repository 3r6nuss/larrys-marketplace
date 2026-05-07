import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { LogOut, User, Ticket, ChevronDown, Shield, Crown, Briefcase, Users, UserCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

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

const DEV_ROLES = [
 { role: 'superadmin', label: 'Superadmin', icon: Crown, color: 'text-red-400' },
 { role: 'inhaber', label: 'Geschäftsinhaber', icon: Briefcase, color: 'text-yellow-400' },
 { role: 'mitarbeiter', name: '1', label: 'Mitarbeiter 1', icon: Users, color: 'text-cyan-400' },
 { role: 'mitarbeiter', name: '2', label: 'Mitarbeiter 2', icon: Users, color: 'text-cyan-400' },
 { role: 'kunde', name: '1', label: 'Kunde 1', icon: UserCircle, color: 'text-gray-400' },
 { role: 'kunde', name: '2', label: 'Kunde 2', icon: UserCircle, color: 'text-gray-400' },
];

export default function DashboardLayout() {
 const { user, login, logout } = useAuth();
 const { openTickets } = useNotifications();
 const [, setSearchParams] = useSearchParams();
 const [isDevMode, setIsDevMode] = useState(false);

 useEffect(() => {
 fetch('/api/auth/dev-users')
 .then(r => r.json())
 .then(data => { if (data.dev_mode) setIsDevMode(true); })
 .catch(() => {});
 }, []);

 const switchDevAccount = (role, name) => {
 const params = new URLSearchParams({ role });
 if (name) params.set('name', name);
 window.location.href = `/api/auth/dev-login?${params}`;
 };

 return (
 <TooltipProvider>
 <div className="min-h-screen bg-background flex flex-col">
 {/* ── Slim Topbar ── */}
 <header className="sticky top-0 z-50 h-14 border-b border-border/50 bg-background/80 px-4 md:px-6 flex items-center justify-between shrink-0">
 {/* Left: Logo */}
 <Link to="/" className="flex items-center gap-2.5 group">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0 shadow-md shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
 L
 </div>
 <div className="flex flex-col leading-none">
 <span className="text-sm font-bold tracking-tight">Larry's</span>
 <span className="text-[10px] text-muted-foreground">Marketplace</span>
 </div>
 </Link>

 {/* Right: User area */}
 <div className="flex items-center gap-3">
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
 {isDevMode && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuSub>
 <DropdownMenuSubTrigger className="cursor-pointer">
 <Shield className="mr-2 h-4 w-4" />
 Konto wechseln
 </DropdownMenuSubTrigger>
 <DropdownMenuSubContent>
 {DEV_ROLES.map(({ role, name, label, icon: Icon, color }) => {
 const devUsername = `dev_${role}${name ? '_' + name : ''}`;
 const isActive = user.username === devUsername;
 return (
 <DropdownMenuItem
 key={`${role}_${name || 'default'}`}
 onClick={() => switchDevAccount(role, name)}
 className={`cursor-pointer ${isActive ? 'bg-muted' : ''}`}
 >
 <Icon className={`mr-2 h-4 w-4 ${color}`} />
 {label}
 {isActive && <Badge variant="outline" className="ml-auto text-[9px] px-1">aktiv</Badge>}
 </DropdownMenuItem>
 );
 })}
 </DropdownMenuSubContent>
 </DropdownMenuSub>
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

 {/* ── Main Content ── */}
 <main className="flex-1 overflow-auto p-4 md:p-6">
 <Outlet />
 </main>
 </div>
 <Toaster richColors position="top-right" />
 </TooltipProvider>
 );
}
