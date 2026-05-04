import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Car, Clock, ArrowRight, Search, Flame, Ticket,
  Eye, LayoutGrid, TrendingUp, Star, LogIn, Sparkles
} from 'lucide-react';
import VehicleDetailModal from '@/components/VehicleDetailModal';

/**
 * CustomerHomePage — Bento-Box-Style Landing for all users.
 * Shows: Hero, Catalog CTA, Recently Viewed, Hot Picks, Tickets, Newest, Stats.
 */
export default function CustomerHomePage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { recentIds } = useRecentlyViewed();

  const [publicStats, setPublicStats] = useState(null);
  const [customerStats, setCustomerStats] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [newest, setNewest] = useState([]);
  const [recentListings, setRecentListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [detailId, setDetailId] = useState(null);

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  const currentDate = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Fetch all data
  useEffect(() => {
    const fetches = [
      fetch('/api/stats/public').then(r => r.ok ? r.json() : null),
      fetch('/api/listings/featured').then(r => r.ok ? r.json() : []),
      fetch('/api/listings/newest').then(r => r.ok ? r.json() : []),
    ];

    if (user) {
      fetches.push(
        fetch('/api/stats/customer', { credentials: 'include' }).then(r => r.ok ? r.json() : null)
      );
    }

    Promise.all(fetches)
      .then(([stats, feat, newst, custStats]) => {
        setPublicStats(stats);
        setFeatured(feat || []);
        setNewest(newst || []);
        if (custStats) setCustomerStats(custStats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Fetch recently viewed listings
  useEffect(() => {
    const ids = recentIds.slice(0, 5);
    if (ids.length === 0) {
      setRecentListings([]);
      return;
    }

    // Fetch each listing individually (no bulk endpoint)
    Promise.all(
      ids.map(id =>
        fetch(`/api/listings/${id}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      setRecentListings(results.filter(Boolean));
    });
  }, [recentIds]);

  // Auto-rotate featured
  useEffect(() => {
    if (featured.length > 2) {
      const timer = setInterval(() => {
        setFeaturedIndex(prev => (prev + 2) % featured.length);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [featured.length]);

  const visibleFeatured = useMemo(() => {
    if (featured.length === 0) return [];
    if (featured.length <= 2) return featured;
    return [
      featured[featuredIndex % featured.length],
      featured[(featuredIndex + 1) % featured.length],
    ];
  }, [featured, featuredIndex]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">

      {/* ── ROW 1: Hero Greeting ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <p className="text-muted-foreground font-medium mb-1 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            {currentDate}
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {getGreeting()},{' '}
            {user ? (
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {user.display_name || user.username}
              </span>
            ) : (
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Willkommen
              </span>
            )}
            <span className="ml-2 inline-block hover:animate-pulse cursor-default">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Entdecke die besten Fahrzeuge bei Larry's Marketplace.
          </p>
        </div>

        {!user && (
          <Button onClick={login} className="gap-2 cursor-pointer shadow-lg shadow-primary/20">
            <LogIn className="h-4 w-4" />
            Mit Discord anmelden
          </Button>
        )}
      </div>

      {/* ── ROW 2: Katalog + Zuletzt angesehen ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Katalog Tile — 2/3 width */}
        <Card
          onClick={() => navigate('/catalog')}
          className="col-span-1 md:col-span-2 relative overflow-hidden group border-primary/20 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-primary/10 hover:border-primary/40 transition-all duration-300 cursor-pointer min-h-[180px]"
        >
          <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-all duration-500 group-hover:scale-110">
            <Car className="h-44 w-44" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Search className="h-6 w-6 text-primary" />
              </div>
              Fahrzeug-Katalog
            </CardTitle>
            <CardDescription className="text-base">
              Stöbere durch unser Sortiment und finde dein Traumfahrzeug.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between relative z-10">
              <div>
                <div className="text-5xl font-black text-primary tracking-tighter">
                  {loading ? <Skeleton className="h-14 w-20" /> : publicStats?.total_available ?? 0}
                </div>
                <p className="text-muted-foreground mt-1 font-medium">Fahrzeuge verfügbar</p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary/80 group-hover:underline bg-primary/10 px-4 py-2 rounded-full transition-colors">
                Katalog öffnen <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zuletzt angesehen — 1/3 width */}
        <Card className="col-span-1 bg-card/40 backdrop-blur-sm border-border/50 hover:border-chart-5/30 transition-all hover:shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zuletzt angesehen</CardTitle>
            <div className="p-2 bg-chart-5/10 rounded-md">
              <Eye className="h-4 w-4 text-chart-5" />
            </div>
          </CardHeader>
          <CardContent>
            {recentListings.length === 0 ? (
              <div className="py-4 text-center">
                <Car className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Noch keine Fahrzeuge angesehen.
                </p>
                <Button variant="link" size="sm" className="mt-1 text-xs cursor-pointer" onClick={() => navigate('/catalog')}>
                  Zum Katalog →
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentListings.slice(0, 5).map(l => (
                  <button
                    key={l.id}
                    onClick={() => setDetailId(l.id)}
                    className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left group/item cursor-pointer"
                  >
                    {(l.cover_image || l.image_path) ? (
                      <img src={l.cover_image || l.image_path} alt="" className="h-9 w-12 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate group-hover/item:text-primary transition-colors">
                        {l.brand} {l.model}
                      </p>
                      {l.category && (
                        <p className="text-[10px] text-muted-foreground">{l.category}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 3: Hot Picks + Meine Anfragen ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hot Picks — 2/3 */}
        <Card className="col-span-1 md:col-span-2 relative overflow-hidden border-orange-500/20 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-orange-500/10 hover:border-orange-500/30 transition-all duration-300">
          <div className="absolute top-4 right-4 opacity-[0.04]">
            <Flame className="h-32 w-32" />
          </div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className="h-5 w-5 text-orange-400" />
              </div>
              Hot Picks
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px]">
                Von Verkäufern empfohlen
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : visibleFeatured.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine empfohlenen Fahrzeuge.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" key={featuredIndex}>
                  {visibleFeatured.map(listing => (
                    <button
                      key={listing.id}
                      onClick={() => setDetailId(listing.id)}
                      className="group/feat animate-in fade-in slide-in-from-right-4 duration-500 flex gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left cursor-pointer"
                    >
                      {(listing.cover_image || listing.image_path) ? (
                        <img src={listing.cover_image || listing.image_path} alt="" className="h-20 w-28 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-20 w-28 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Car className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <p className="font-semibold text-sm truncate group-hover/feat:text-orange-400 transition-colors">
                            {listing.brand} {listing.model}
                          </p>
                          {listing.category && (
                            <Badge variant="outline" className="text-[10px] mt-1">{listing.category}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {listing.seller_avatar && (
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={listing.seller_avatar} />
                              <AvatarFallback className="text-[7px]">{listing.seller_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-[10px] text-muted-foreground">{listing.seller_name}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Dot indicators */}
                {featured.length > 2 && (
                  <div className="flex justify-center gap-1 mt-3">
                    {Array.from({ length: Math.ceil(featured.length / 2) }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          Math.floor(featuredIndex / 2) === idx ? 'w-4 bg-orange-400' : 'w-1.5 bg-border'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Meine Anfragen — 1/3 */}
        <Card
          onClick={() => user ? navigate('/dashboard/tickets') : login()}
          className="col-span-1 relative overflow-hidden group bg-card/40 backdrop-blur-sm border-border/50 hover:border-warning/40 transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="absolute bottom-2 right-2 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
            <Ticket className="h-28 w-28" />
          </div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-warning transition-colors">
              Meine Anfragen
            </CardTitle>
            <div className="p-2 bg-warning/10 rounded-md">
              <Ticket className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            {user ? (
              <div>
                <div className="text-4xl font-black text-warning">
                  {loading ? <Skeleton className="h-10 w-12" /> : customerStats?.my_open_tickets ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                  offene {(customerStats?.my_open_tickets ?? 0) === 1 ? 'Anfrage' : 'Anfragen'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {customerStats?.my_total_tickets ?? 0} insgesamt
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-warning group-hover:underline">
                  Tickets ansehen <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <LogIn className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Melde dich an, um deine Anfragen zu sehen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 4: Neueste Angebote ── */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Neueste Angebote
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/catalog')} className="text-xs cursor-pointer gap-1">
            Alle anzeigen <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : newest.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Car className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Angebote vorhanden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {newest.map((listing, i) => (
                <button
                  key={listing.id}
                  onClick={() => setDetailId(listing.id)}
                  className="group/card rounded-xl border border-border bg-muted/20 overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-300 text-left cursor-pointer"
                  style={{ animationDelay: `${i * 75}ms` }}
                >
                  <div className="relative h-20 bg-muted overflow-hidden">
                    {(listing.cover_image || listing.image_path) ? (
                      <img
                        src={listing.cover_image || listing.image_path}
                        alt={`${listing.brand} ${listing.model}`}
                        className="h-full w-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Car className="h-6 w-6 text-muted-foreground/20" />
                      </div>
                    )}
                    {listing.discount_pct > 0 && (
                      <Badge className="absolute top-1 right-1 text-[9px] px-1 py-0 bg-success/20 text-success border-success/30">
                        -{listing.discount_pct}%
                      </Badge>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate group-hover/card:text-primary transition-colors">
                      {listing.brand} {listing.model}
                    </p>
                    {listing.category && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{listing.category}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ROW 5: Marktplatz Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Verfügbare Fahrzeuge',
            value: publicStats?.total_available ?? 0,
            icon: Car,
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Kategorien',
            value: publicStats?.total_categories ?? 0,
            icon: LayoutGrid,
            color: 'text-chart-2',
            bg: 'bg-chart-2/10',
          },
          {
            label: 'Heute neu',
            value: publicStats?.today_listed ?? 0,
            icon: Sparkles,
            color: 'text-chart-4',
            bg: 'bg-chart-4/10',
          },
          {
            label: 'Gesamt-Aufrufe',
            value: (publicStats?.total_views ?? 0).toLocaleString(),
            icon: TrendingUp,
            color: 'text-chart-5',
            bg: 'bg-chart-5/10',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-card/40 backdrop-blur-sm border-border/50 group hover:border-primary/20 transition-all">
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-7 w-14" /> : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pokémon-Card Detail Modal */}
      <VehicleDetailModal
        listingId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
