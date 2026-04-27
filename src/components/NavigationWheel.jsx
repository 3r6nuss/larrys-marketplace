import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { Car, LayoutDashboard, Ticket, Package, Calculator, Vault } from 'lucide-react';

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

function describeSector(x, y, innerRadius, outerRadius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, outerRadius, startAngle);
  const end = polarToCartesian(x, y, outerRadius, endAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, startAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, endAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 1, end.x, end.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
    "Z"
  ].join(" ");
}

export default function NavigationWheel() {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hotkey, setHotkey] = useState('Alt');
  const { user, hasRole } = useAuth();
  const { openTickets } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const savedHotkey = localStorage.getItem(`nav_hotkey_${user.id}`);
      if (savedHotkey) setHotkey(savedHotkey);
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.repeat) return; // Ignore repeated keys when held down
      
      if (e.key === hotkey) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === hotkey) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hotkey]);

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const navItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, minRole: 'mitarbeiter' },
    { title: 'Katalog', url: '/', icon: Car, public: true },
    { title: 'Meine Inserate', url: '/dashboard/listings', icon: Package, minRole: 'mitarbeiter' },
    { title: 'Tickets', url: '/dashboard/tickets', icon: Ticket, minRole: 'kunde' },
    { title: 'Rechner', url: '/dashboard/calculator', icon: Calculator, minRole: 'mitarbeiter' },
    { title: 'Tresor', url: '/dashboard/vault', icon: Vault, minRole: 'mitarbeiter' },
  ].filter(item => item.public || hasRole(item.minRole));

  const sliceAngle = 360 / navItems.length;
  const outerRadius = 200;
  const innerRadius = 60;
  const cx = 200;
  const cy = 200;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm transition-all duration-300 ${
        isOpen ? 'opacity-100 bg-background/80 visible' : 'opacity-0 bg-background/0 invisible pointer-events-none'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        className={`relative w-[400px] h-[400px] transition-all duration-300 ease-out ${
          isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        {/* SVG Pie Menu */}
        <svg width="400" height="400" viewBox="0 0 400 400" className="absolute inset-0 filter drop-shadow-2xl">
          {navItems.map((item, i) => {
            const startAngle = i * sliceAngle;
            const endAngle = (i + 1) * sliceAngle;
            const pathData = describeSector(cx, cy, innerRadius, outerRadius, startAngle, endAngle);
            const isHovered = hoveredIndex === i;

            return (
              <path
                key={item.url}
                d={pathData}
                onClick={() => handleNavigate(item.url)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`cursor-pointer transition-all duration-300 stroke-background stroke-[4px] ${
                  isHovered ? 'fill-primary/20' : 'fill-card/95'
                }`}
              />
            );
          })}
        </svg>

        {/* Center Hole Glow / Decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[120px] w-[120px] rounded-full bg-background border-[4px] border-background shadow-inner flex items-center justify-center pointer-events-none">
           <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
        </div>

        {/* Icons & Text */}
        <div className="absolute inset-0 pointer-events-none">
          {navItems.map((item, i) => {
            const middleAngle = (i + 0.5) * sliceAngle;
            const iconRadius = innerRadius + (outerRadius - innerRadius) / 2;
            const pos = polarToCartesian(cx, cy, iconRadius, middleAngle);
            const isHovered = hoveredIndex === i;

            return (
              <div 
                key={`content-${item.url}`}
                className={`absolute flex flex-col items-center justify-center w-24 h-24 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}
                style={{ left: pos.x, top: pos.y }}
              >
                 <div className="relative">
                   <item.icon className={`h-8 w-8 transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`} />
                   {item.url === '/dashboard/tickets' && openTickets > 0 && (
                     <span className="absolute -top-2 -right-3 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm">
                       {openTickets > 99 ? '99+' : openTickets}
                     </span>
                   )}
                 </div>
                 <span className={`text-xs font-semibold mt-2 transition-colors text-center leading-tight ${isHovered ? 'text-foreground' : 'text-muted-foreground'}`}>
                   {item.title}
                 </span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className={`absolute bottom-10 text-muted-foreground text-sm font-medium transition-all duration-500 delay-150 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        Halte <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-foreground font-bold shadow-sm">{hotkey}</kbd> gedrückt
      </div>
    </div>
  );
}
