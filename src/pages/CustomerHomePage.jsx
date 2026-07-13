import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Car, Clock, ArrowRight, Flame, Ticket, Eye, LayoutGrid,
 TrendingUp, Star, LogIn, Sparkles, Search
} from 'lucide-react';
import VehicleDetailModal from '@/components/VehicleDetailModal';
import PopupShell from '@/components/PopupShell';
import { getThumbnailImagePath } from '@/lib/utils';

export default function CustomerHomePage() {
 const { user, login } = useAuth();
 const { openTickets } = useNotifications();
 const [searchParams, setSearchParams] = useSearchParams();
 const activeModal = searchParams.get('modal');
 const { recentIds } = useRecentlyViewed();

 const [publicStats, setPublicStats] = useState(null);
 const [customerStats, setCustomerStats] = useState(null);
 const [featured, setFeatured] = useState([]);
 const [newest, setNewest] = useState([]);
 const [recentListings, setRecentListings] = useState([]);
 const [loading, setLoading] = useState(true);
 const [featuredIndex, setFeaturedIndex] = useState(0);
 const [newestIndex, setNewestIndex] = useState(0);
 const [detailId, setDetailId] = useState(null);
 const [requestStats, setRequestStats] = useState(null);
 const [availableListingCount, setAvailableListingCount] = useState(0);

 const getGreeting = () => {
 const h = new Date().getHours();
 return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
 };

 const currentDate = new Date().toLocaleDateString('de-DE', {
 weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
 });

 // Fetch data
 useEffect(() => {
 const fetches = [
 fetch('/api/stats/public', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
 fetch('/api/listings/featured').then(r => r.ok ? r.json() : []),
 fetch('/api/listings/newest').then(r => r.ok ? r.json() : []),
 fetch('/api/listings?status=available', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : []),
 ];
 if (user) {
 fetches.push(fetch('/api/stats/customer', { credentials: 'include' }).then(r => r.ok ? r.json() : null));
 fetches.push(fetch('/api/requests/count', { credentials: 'include' }).then(r => r.ok ? r.json() : null));
 }
 Promise.all(fetches).then(([stats, feat, newst, availableListings, custStats, reqStats]) => {
 setPublicStats(stats);
 setFeatured(feat || []);
 setNewest(newst || []);
 setAvailableListingCount(availableListings?.length || 0);
 if (custStats) setCustomerStats(custStats);
 if (reqStats) setRequestStats(reqStats);
 }).catch(console.error).finally(() => setLoading(false));
 }, [user]);

 useEffect(() => {
 const refreshPublicStats = () => {
 Promise.all([
 fetch('/api/stats/public', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
 fetch('/api/listings?status=available', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : []),
 ])
 .then(([stats, availableListings]) => {
 if (stats) setPublicStats(stats);
 setAvailableListingCount(availableListings?.length || 0);
 })
 .catch(console.error);
 };
 window.addEventListener('focus', refreshPublicStats);
 return () => window.removeEventListener('focus', refreshPublicStats);
 }, []);

 // Fetch recently viewed
 useEffect(() => {
 const ids = recentIds.slice(0, 5);
 if (!ids.length) { setRecentListings([]); return; }
 const controller = new AbortController();
 fetch(`/api/listings/recent?ids=${ids.join(',')}`, { signal: controller.signal })
 .then(r => r.ok ? r.json() : [])
 .then(setRecentListings)
 .catch(err => { if (err.name !== 'AbortError') console.error(err); });
 return () => controller.abort();
 }, [recentIds]);

 // Auto-rotate featured
 useEffect(() => {
 if (featured.length > 2) {
 const t = setInterval(() => setFeaturedIndex(p => (p + 2) % featured.length), 6000);
 return () => clearInterval(t);
 }
 }, [featured.length]);

 // Auto-rotate newest
 useEffect(() => {
 if (newest.length > 1) {
 const t = setInterval(() => setNewestIndex(p => (p + 1) % newest.length), 5000);
 return () => clearInterval(t);
 }
 }, [newest.length]);

 const visibleFeatured = useMemo(() => {
 if (featured.length <= 2) return featured;
 return [featured[featuredIndex % featured.length], featured[(featuredIndex + 1) % featured.length]];
 }, [featured, featuredIndex]);

 const openModal = (name) => setSearchParams({ modal: name });
 const closeModal = () => setSearchParams({});

  const Tile = ({ onClick, colSpan = '', icon: Icon, iconColor, iconBg, title, subtitle, value, valueColor, cta, borderColor = 'border-border/40', children }) => (
    <Card onClick={onClick} className={`${colSpan} relative overflow-hidden group bg-card/40 backdrop-blur-md border ${borderColor} hover:border-primary/40 shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 rounded-2xl ${onClick ? 'cursor-pointer' : ''}`}>
      {Icon && (
        <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 pointer-events-none">
          <Icon className="h-32 w-32" />
        </div>
      )}
      <CardHeader className={children ? 'pb-2' : 'pb-2'}>
        <CardTitle className={`${value !== undefined ? 'text-lg font-extrabold text-foreground' : 'text-sm font-medium text-muted-foreground'} flex items-center gap-3`}>
          {iconBg && <div className={`p-2 rounded-xl ${iconBg} shadow-inner transition-transform group-hover:scale-105`}><Icon className={`h-5 w-5 ${iconColor}`} /></div>}
          {!iconBg && Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
          {title}
        </CardTitle>
        {subtitle && <CardDescription className="text-sm text-muted-foreground/80 mt-1 leading-relaxed">{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">
        {value !== undefined && (
          <div className="flex items-end justify-between relative z-10">
            <div className={`text-5xl font-black ${valueColor} tracking-tight drop-shadow-sm`}>
              {loading ? <Skeleton className="h-12 w-16 rounded-lg" /> : value}
            </div>
            {cta && (
              <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${iconColor} px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 transition-all duration-200 group-hover:bg-primary/25 group-hover:scale-105 shadow-sm`}>
                {cta} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
 {/* Hero */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border/40">
 <div>
 <p className="text-muted-foreground font-medium mb-1 flex items-center gap-2 text-sm">
 <Clock className="h-4 w-4" />{currentDate}
 </p>
 <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
 {getGreeting()},{' '}
 <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
 {user?.display_name || user?.username || 'Willkommen'}
 </span>
 <span className="ml-2 inline-block hover:animate-pulse cursor-default">👋</span>
 </h1>
 <p className="text-muted-foreground mt-1">Entdecke die besten Fahrzeuge bei Larry's Marketplace.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {!user && <Button onClick={login} className="gap-2 cursor-pointer shadow-lg shadow-primary/20"><LogIn className="h-4 w-4" />Mit Discord anmelden</Button>}
 </div>
 </div>

 {/* 4x2 Bento Grid */}
 <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 md:h-[500px]">
 {/* Katalog (3x2) */}
 <Tile onClick={() => openModal('catalog')} colSpan="md:col-span-3 md:row-span-2 flex flex-col justify-between" icon={Car} iconColor="text-primary" iconBg="bg-primary/20"
 title="Fahrzeug-Katalog" subtitle="Aktuell verfügbare Fahrzeuge" value={availableListingCount} valueColor="text-primary"
 cta="Katalog öffnen" borderColor="border-primary/30 hover:border-primary/60">
 {/* Visual enhancements for the large catalog tile */}
 <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] group-hover:bg-primary/20 transition-colors duration-200 pointer-events-none" />
 <div className="absolute -top-10 -right-10 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-200 pointer-events-none transform rotate-12 group-hover:scale-110">
 <Car className="w-96 h-96 text-primary" />
 </div>
 <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-none">
 {/* Decorative dots */}
 {[...Array(3)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40" />)}
 </div>
 </Tile>

 {/* Neuestes Angebot (1x1) */}
 <Card className="bg-card border-border/50 hover:border-primary/40 transition-colors hover:shadow-primary/10 hover:shadow-xl md:col-span-1 md:row-span-1 overflow-hidden flex flex-col cursor-pointer" onClick={() => { if (newest.length > 0) setDetailId(newest[newestIndex % newest.length].id); }}>
 <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between shrink-0 absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-background/90 via-background/50 to-transparent border-none">
 <CardTitle className="text-sm font-bold flex items-center gap-2 drop-shadow-md text-foreground"><Sparkles className="h-4 w-4 text-primary" /> Neu eingetroffen</CardTitle>
 </CardHeader>
 <CardContent className="flex-1 p-0 relative group">
 {loading ? <Skeleton className="h-full w-full" /> 
 : newest.length > 0 ? (() => {
 const listing = newest[newestIndex % newest.length];
 return (
 <div className="absolute inset-0 animate-in fade-in duration-200" key={listing.id}>
 {(listing.cover_image || listing.image_path) ? <img loading="eager" decoding="async" fetchPriority="high" src={getThumbnailImagePath(listing.cover_image || listing.image_path)} alt="" className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-150" /> : <div className="h-full w-full bg-gradient-to-br from-muted/50 to-background flex items-center justify-center"><div className="p-4 rounded-full bg-background/50 shadow-inner"><Car className="h-10 w-10 text-muted-foreground/40 group-hover:text-primary/60 group-hover:scale-110 transition-all duration-200" /></div></div>}
 <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-4 pt-16">
 <p className="font-extrabold text-lg truncate leading-tight drop-shadow-md text-foreground">{listing.brand} {listing.model}</p>
 {listing.category && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/20 text-[10px] mt-1.5 shadow-sm">{listing.category}</Badge>}
 </div>
 </div>
 );
 })() : <div className="p-4 h-full flex flex-col items-center justify-center text-muted-foreground text-xs bg-gradient-to-br from-muted/30 to-background"><div className="p-3 rounded-full bg-muted/50 mb-2"><Car className="h-6 w-6 opacity-40"/></div>Keine Angebote</div>}
 </CardContent>
 </Card>

 {/* Hot Pick (1x1) */}
 <Card className="bg-card border-orange-500/30 hover:border-orange-500/60 transition-colors hover:shadow-orange-500/10 hover:shadow-xl md:col-span-1 md:row-span-1 overflow-hidden flex flex-col cursor-pointer" onClick={() => { if (featured.length > 0) setDetailId(featured[featuredIndex % featured.length].id); }}>
 <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between shrink-0 absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-background/90 via-background/50 to-transparent border-none">
 <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-400 drop-shadow-md"><Flame className="h-4 w-4" /> Hot Pick</CardTitle>
 </CardHeader>
 <CardContent className="flex-1 p-0 relative group">
 {loading ? <Skeleton className="h-full w-full" /> 
 : featured.length > 0 ? (() => {
 const listing = featured[featuredIndex % featured.length];
 return (
 <div className="absolute inset-0 animate-in fade-in duration-200" key={listing.id}>
 {(listing.cover_image || listing.image_path) ? <img loading="eager" decoding="async" src={getThumbnailImagePath(listing.cover_image || listing.image_path)} alt="" className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-150" /> : <div className="h-full w-full bg-gradient-to-br from-orange-950/20 to-background flex items-center justify-center"><div className="p-4 rounded-full bg-background/50 shadow-inner"><Car className="h-10 w-10 text-orange-500/20 group-hover:text-orange-500/60 group-hover:scale-110 transition-all duration-200" /></div></div>}
 <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-4 pt-16">
 <p className="font-extrabold text-lg truncate leading-tight drop-shadow-md text-orange-50">{listing.brand} {listing.model}</p>
 {listing.category && <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-orange-500/30 text-[10px] mt-1.5 shadow-sm">{listing.category}</Badge>}
 </div>
 </div>
 );
 })() : <div className="p-4 h-full flex flex-col items-center justify-center text-muted-foreground text-xs bg-gradient-to-br from-muted/30 to-background"><div className="p-3 rounded-full bg-muted/50 mb-2"><Star className="h-6 w-6 opacity-40"/></div>Keine Empfehlungen</div>}
 </CardContent>
 </Card>
 </div>

 {/* 2nd Row: Zuletzt angesehen & Tickets */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {/* Zuletzt angesehen (Horizontal List) */}
 <Card className={`bg-card shadow-sm border-border/50 hover:border-chart-5/30 transition-colors hover:shadow-md ${user ? 'md:col-span-2' : 'md:col-span-4'} overflow-hidden relative`}>
 <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-chart-5/5 to-transparent pointer-events-none" />
 <CardHeader className="pb-3 flex flex-row items-center justify-between relative z-10">
 <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
 <div className="p-1.5 bg-chart-5/10 rounded-md"><Eye className="h-4 w-4 text-chart-5" /></div>
 Zuletzt angesehen
 </CardTitle>
 </CardHeader>
 <CardContent className="relative z-10">
 {recentListings.length === 0 ? (
 <div className="py-6 text-center text-muted-foreground text-xs flex flex-col items-center">
 <div className="p-3 rounded-full bg-muted/50 mb-2"><Eye className="h-5 w-5 opacity-40"/></div>
 Noch keine Fahrzeuge angesehen.
 </div>
 ) : (
 <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
 {recentListings.map(l => (
 <button key={l.id} onClick={() => setDetailId(l.id)} className="flex-shrink-0 w-44 group/item text-left cursor-pointer rounded-xl overflow-hidden border border-border/50 bg-background hover:bg-muted/30 hover:border-chart-5/40 hover:shadow-md transition-all duration-150">
 <div className="h-24 bg-gradient-to-br from-muted/50 to-muted/20 relative overflow-hidden flex items-center justify-center">
 {(l.cover_image || l.image_path) ? <img loading='lazy' src={getThumbnailImagePath(l.cover_image || l.image_path)} alt="" className="h-full w-full object-contain group-hover/item:scale-105 transition-transform duration-200" /> : <Car className="h-8 w-8 text-muted-foreground/20 group-hover/item:text-chart-5/40 group-hover/item:scale-110 transition-all duration-200" />}
 </div>
 <div className="p-3">
 <p className="text-sm font-bold truncate group-hover/item:text-chart-5 transition-colors">{l.brand} {l.model}</p>
 {l.category && <p className="text-[10px] text-muted-foreground font-medium truncate mt-1">{l.category}</p>}
 </div>
 </button>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Meine Anfragen (Only logged in) */}
 {user && (
 <Tile onClick={() => openModal('tickets')} colSpan="md:col-span-1" icon={Ticket} iconColor="text-warning" iconBg="bg-warning/20"
 title="Meine Anfragen" subtitle="Dein Support-Postfach" value={customerStats?.my_open_tickets ?? 0} valueColor="text-warning"
 borderColor="border-warning/30 hover:border-warning/60">
 <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-warning/10 rounded-full blur-2xl group-hover:bg-warning/20 transition-colors duration-200 pointer-events-none" />
 </Tile>
 )}

 {/* Fahrzeug anfragen */}
 {user && (
 <Tile onClick={() => openModal('requests')} colSpan="md:col-span-1" icon={Search} iconColor="text-chart-2" iconBg="bg-chart-2/20"
  title="Wunschliste" subtitle="Fahrzeug anfragen" value={requestStats ? (requestStats.found_requests > 0 ? `${requestStats.found_requests} gefunden` : requestStats.open_requests) : 0} valueColor={requestStats?.found_requests > 0 ? 'text-success' : 'text-chart-2'}
  borderColor="border-chart-2/30 hover:border-chart-2/60">
  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-chart-2/10 rounded-full blur-2xl group-hover:bg-chart-2/20 transition-colors duration-200 pointer-events-none" />
 </Tile>
 )}
 </div>

 {/* Vehicle Detail Modal */}
 <VehicleDetailModal listingId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />

 {/* Popup Shell */}
 <PopupShell activeModal={activeModal} onClose={closeModal} />
 </div>
 );
}
