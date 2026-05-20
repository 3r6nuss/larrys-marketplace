import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Crown, Briefcase, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

const VIEWS = [
  {
    label: 'Admin',
    path: '/admin',
    icon: Crown,
    minRole: 'inhaber',
    activeClass: 'bg-red-400/15 text-red-400 border-red-400/30',
    inactiveClass: 'hover:bg-red-400/10 hover:text-red-400',
  },
  {
    label: 'Mitarbeiter',
    path: '/mitarbeiter',
    icon: Briefcase,
    minRole: 'mitarbeiter',
    activeClass: 'bg-primary/15 text-primary border-primary/30',
    inactiveClass: 'hover:bg-primary/10 hover:text-primary',
  },
  {
    label: 'Kunde',
    path: '/kunde',
    icon: ShoppingBag,
    minRole: 'kunde',
    activeClass: 'bg-muted text-foreground border-border',
    inactiveClass: 'hover:bg-muted hover:text-foreground',
  },
];

export default function ViewSwitcher() {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const accessible = VIEWS.filter((v) => hasRole(v.minRole));
  // Don't show if only one view accessible (e.g. pure kunde)
  if (accessible.length <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-2 w-[52px] shrink-0 border-r border-border/40 bg-background/40 py-5">
      {accessible.map((view) => {
        const Icon = view.icon;
        const isActive = location.pathname === view.path || location.pathname.startsWith(view.path + '/');

        return (
          <Tooltip key={view.path} delayDuration={100}>
            <TooltipTrigger asChild>
              <Link
                to={view.path}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200',
                  isActive
                    ? view.activeClass
                    : `border-transparent text-muted-foreground ${view.inactiveClass}`
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {view.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
