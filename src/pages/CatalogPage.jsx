import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Car, Search, MessageSquare, Filter, LogIn } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Public catalog page. Shows all available vehicles without prices.
 * Customers can click "Verkäufer kontaktieren" to create a ticket.
 * Unauthenticated users see a login confirmation dialog first.
 */
export default function CatalogPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loginPrompt, setLoginPrompt] = useState(null); // listing that was clicked

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const fetchListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);

      const res = await fetch(`/api/listings?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, debouncedSearchQuery]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleContact = (listing) => {
    if (!user) {
      // Show confirmation modal instead of instantly redirecting
      setLoginPrompt(listing);
      return;
    }
    navigate(`/dashboard/tickets?listing=${listing.id}`);
  };

  const confirmLogin = () => {
    // Store intended listing in sessionStorage so after login we can resume
    if (loginPrompt) {
      sessionStorage.setItem('pendingListing', loginPrompt.id);
    }
    login();
  };

  const categories = useMemo(
    () => [...new Set(listings.map((l) => l.category).filter(Boolean))],
    [listings],
  );

  const filteredListings = useMemo(() => {
    if (!searchQuery) return listings;

    const q = searchQuery.toLowerCase();
    const terms = q.split(' ').filter(Boolean);

    return listings.filter((l) => {
      const fullText = `${l.brand} ${l.model} ${l.plate || ''}`.toLowerCase();
      return terms.every((term) => fullText.includes(term));
    });
  }, [listings, searchQuery]);

  const STATUS_BADGE = {
    available: { label: 'Verfügbar', variant: 'default' },
    reserved: { label: 'Reserviert', variant: 'secondary' },
    sold: { label: 'Verkauft', variant: 'outline' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Fahrzeug-Katalog</h1>
        <p className="text-muted-foreground">
          Entdecke unsere verfügbaren Fahrzeuge. Kontaktiere einen Verkäufer für Preisinformationen.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Marke, Modell oder Kennzeichen suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-sm">
          {filteredListings.length} Fahrzeuge
        </Badge>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Keine Fahrzeuge gefunden</h3>
          <p className="text-muted-foreground">Versuche andere Suchkriterien.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredListings.map(listing => {
            const status = STATUS_BADGE[listing.status] || STATUS_BADGE.available;
            return (
              <Card key={listing.id} className="overflow-hidden group hover:border-primary/40 transition-colors duration-300">
                <div className="relative h-48 bg-muted overflow-hidden">
                  {listing.image_path ? (
                    <img
                      src={listing.image_path}
                      alt={`${listing.brand} ${listing.model}`}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Car className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  <Badge
                    variant={status.variant}
                    className="absolute top-3 right-3"
                  >
                    {status.label}
                  </Badge>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">
                      {listing.brand} {listing.model}
                    </h3>
                    {listing.plate && (
                      <p className="text-sm text-muted-foreground font-mono mt-0.5">
                        {listing.plate}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {listing.category && (
                      <Badge variant="outline" className="text-xs">{listing.category}</Badge>
                    )}
                    {listing.discount_pct > 0 && (
                      <Badge className="text-xs bg-success/20 text-success border-success/30">
                        -{listing.discount_pct}%
                      </Badge>
                    )}
                  </div>
                  {listing.status === 'available' && (
                    <Button
                      onClick={() => handleContact(listing)}
                      className="w-full gap-2 cursor-pointer"
                      variant="default"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Verkäufer kontaktieren
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Login Confirmation Modal ── */}
      <Dialog open={!!loginPrompt} onOpenChange={(open) => !open && setLoginPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Anmeldung erforderlich</DialogTitle>
            <DialogDescription className="text-center">
              Um den Verkäufer von{' '}
              <span className="font-semibold text-foreground">
                {loginPrompt?.brand} {loginPrompt?.model}
              </span>{' '}
              zu kontaktieren, musst du dich zuerst mit Discord anmelden.
              <br />
              <span className="text-xs mt-1 block text-muted-foreground/70">
                Du wirst nach der Anmeldung automatisch zu deiner Anfrage weitergeleitet.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:flex-row flex-col-reverse">
            <Button
              variant="outline"
              onClick={() => setLoginPrompt(null)}
              className="cursor-pointer flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={confirmLogin}
              className="cursor-pointer flex-1 gap-2"
            >
              <LogIn className="h-4 w-4" />
              Mit Discord anmelden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
