import {
  Car,
  LayoutDashboard,
  Ticket,
  Package,
  Calculator,
  Vault,
  Users,
  BarChart3,
  ScrollText,
  LogOut,
  ChevronUp,
  Database,
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

export default function AppSidebar() {
  const { user, logout, hasRole } = useAuth();
  const { openTickets } = useNotifications();
  const location = useLocation();

  const mainNav = [
    { title: 'Katalog', url: '/', icon: Car, public: true },
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, minRole: 'mitarbeiter' },
    { title: 'Meine Inserate', url: '/dashboard/listings', icon: Package, minRole: 'mitarbeiter' },
    { title: 'Tickets', url: '/dashboard/tickets', icon: Ticket, minRole: 'kunde' },
    { title: 'Ankaufrechner', url: '/dashboard/calculator', icon: Calculator, minRole: 'mitarbeiter' },
    { title: 'Tresor', url: '/dashboard/vault', icon: Vault, minRole: 'mitarbeiter' },
  ];

  const adminNav = [
    { title: 'Statistiken', url: '/admin/stats', icon: BarChart3, minRole: 'inhaber' },
    { title: 'Benutzerverwaltung', url: '/admin/users', icon: Users, minRole: 'inhaber' },
    { title: 'Audit-Logs', url: '/admin/logs', icon: ScrollText, minRole: 'stv_admin' },
    { title: 'Katalog-Import', url: '/admin/catalog', icon: Database, minRole: 'superadmin' },
  ];

  const visibleMain = mainNav.filter(item => item.public || hasRole(item.minRole));
  const visibleAdmin = adminNav.filter(item => hasRole(item.minRole));

  const isActive = (url) => {
    if (url === '/') return location.pathname === '/';
    if (url === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0 glow-primary">
            L
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight">Larry's</span>
            <span className="text-xs text-muted-foreground">Marketplace</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      {item.url === '/dashboard/tickets' && openTickets > 0 && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                          {openTickets > 99 ? '99+' : openTickets}
                        </div>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent cursor-pointer w-full transition-all duration-200 group-data-[collapsible=icon]:p-1">
                    <Avatar className="h-9 w-9 border border-sidebar-border group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                      <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {user?.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none flex-1 min-w-0">
                      <span className="font-medium text-sm truncate">{user?.display_name || user?.username}</span>
                      <span className={`text-xs ${ROLE_COLORS[user?.role] || ''}`}>
                        {ROLE_LABELS[user?.role] || user?.role}
                      </span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4 shrink-0" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{user?.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Profil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/login">
                  <LogOut className="h-4 w-4" />
                  <span>Anmelden</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
