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
import { Car, Search, MessageSquare, Filter, LogIn, Images, ArrowUpDown, RotateCcw, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import VehicleDetailModal from '@/components/VehicleDetailModal';

/**
 * Public catalog page. Shows all available vehicles without prices.
 * Click on a card opens the Pokémon-card detail modal.
 */
export default function CatalogPage() {
 const { user, login } = useAuth();
 const navigate = useNavigate();
 const { addViewed } = useRecentlyViewed();
 const [listings, setListings] = useState([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('all');
 const [sortOrder, setSortOrder] = useState('newest');
 const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
 const [debouncedPriceFilter, setDebouncedPriceFilter] = useState({ min: '', max: '' });
 const [filterOptions, setFilterOptions] = useState({ categories: [], min_price: 0, max_price: 0 });
 const [loginPrompt, setLoginPrompt] = useState(null);
 const [detailId, setDetailId] = useState(null); // Pokémon-card modal

 useEffect(() => {
 const timeout = setTimeout(() => {
 setDebouncedSearchQuery(searchQuery);
 }, 250);

 return () => clearTimeout(timeout);
 }, [searchQuery]);

 useEffect(() => {
 const timeout = setTimeout(() => setDebouncedPriceFilter(priceFilter), 400);
 return () => clearTimeout(timeout);
 }, [priceFilter]);

 useEffect(() => {
 fetch('/api/listings/filters')
 .then(res => res.ok ? res.json() : null)
 .then(data => { if (data) setFilterOptions(data); })
 .catch(() => {});
 }, []);

 const fetchListings = useCallback(async () => {
 try {
 const params = new URLSearchParams();
 params.set('status', 'available');
 if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
 if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
 params.set('sort', sortOrder);
 if (debouncedPriceFilter.min !== '') params.set('min_price', debouncedPriceFilter.min);
 if (debouncedPriceFilter.max !== '') params.set('max_price', debouncedPriceFilter.max);

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
 }, [categoryFilter, debouncedSearchQuery, sortOrder, debouncedPriceFilter]);

 useEffect(() => { fetchListings(); }, [fetchListings]);

 const handleContact = (e, listing) => {
 e.stopPropagation(); // Don't open modal
 addViewed(listing.id);

 if (!user) {
 setLoginPrompt(listing);
 return;
 }
 navigate(`/kunde?modal=tickets&listing=${listing.id}`);
 };

 const handleCardClick = (listing) => {
 addViewed(listing.id);
 setDetailId(listing.id);
 };

 const confirmLogin = () => {
 if (loginPrompt) {
 sessionStorage.setItem('pendingListing', loginPrompt.id);
 }
 login();
 };

 const filteredListings = useMemo(() => {
 if (!searchQuery) return listings;

 const q = searchQuery.toLowerCase();
 const terms = q.split(' ').filter(Boolean);

 return listings.filter((l) => {
 const fullText = `${l.brand} ${l.model} ${l.plate || ''}`.toLowerCase();
 return terms.every((term) => fullText.includes(term));
 });
 }, [listings, searchQuery]);

 const hasActiveFilters = searchQuery || categoryFilter !== 'all' || sortOrder !== 'newest' || priceFilter.min || priceFilter.max;

 const resetFilters = () => {
 setSearchQuery('');
 setCategoryFilter('all');
 setSortOrder('newest');
 setPriceFilter({ min: '', max: '' });
 };

 const STATUS_BADGE = {
 available: { label: 'Verfügbar', variant: 'default' },
 reserved: { label: 'Reserviert', variant: 'secondary' },
 sold: { label: 'Verkauft', variant: 'outline' },
 };

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
 <div className="flex flex-col gap-2 pb-2 border-b border-border/40">
 <h1 className="text-3xl font-bold tracking-tight">Fahrzeug-Katalog</h1>
 <p className="text-muted-foreground">
 Entdecke unsere verfügbaren Fahrzeuge. Klicke auf ein Fahrzeug für Details.
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
 {filterOptions.categories.map(cat => (
 <SelectItem key={cat} value={cat}>{cat}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={sortOrder} onValueChange={setSortOrder}>
 <SelectTrigger className="w-[190px]">
 <ArrowUpDown className="h-4 w-4 mr-2" />
 <SelectValue placeholder="Sortieren" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="newest">Neueste zuerst</SelectItem>
 <SelectItem value="oldest">Älteste zuerst</SelectItem>
 <SelectItem value="name_asc">Name A–Z</SelectItem>
 <SelectItem value="name_desc">Name Z–A</SelectItem>
 <SelectItem value="price_asc">Preis aufsteigend</SelectItem>
 <SelectItem value="price_desc">Preis absteigend</SelectItem>
 </SelectContent>
 </Select>
 <div className="flex items-center gap-2">
 <div className="relative w-[130px]">
 <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 type="number"
 min="0"
 value={priceFilter.min}
 onChange={event => setPriceFilter(current => ({ ...current, min: event.target.value }))}
 placeholder={filterOptions.min_price ? `Ab ${filterOptions.min_price}` : 'Min. Preis'}
 className="pl-8"
 aria-label="Mindestpreis"
 />
 </div>
 <span className="text-muted-foreground text-xs">bis</span>
 <div className="relative w-[130px]">
 <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 type="number"
 min="0"
 value={priceFilter.max}
 onChange={event => setPriceFilter(current => ({ ...current, max: event.target.value }))}
 placeholder={filterOptions.max_price ? `Bis ${filterOptions.max_price}` : 'Max. Preis'}
 className="pl-8"
 aria-label="Höchstpreis"
 />
 </div>
 </div>
 {hasActiveFilters && (
 <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 cursor-pointer text-muted-foreground">
 <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
 </Button>
 )}
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
 const displayImage = listing.cover_image || listing.image_path;
 const hasMultipleImages = (listing.image_count || 0) > 1;

 return (
 <Card
 key={listing.id}
 onClick={() => handleCardClick(listing)}
 className="overflow-hidden group hover:border-primary/40 transition-all duration-150 cursor-pointer hover:shadow-lg hover:shadow-primary/5"
 >
 <div className="relative h-48 bg-muted overflow-hidden">
 {displayImage ? (
 <img
 loading="lazy"
 decoding="async"
 src={displayImage}
 alt={`${listing.brand} ${listing.model}`}
 className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200"
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

 {/* Multi-image dot indicator */}
 {hasMultipleImages && (
 <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full">
 <Images className="h-3 w-3 text-white/80" />
 <span className="text-[10px] text-white/80 font-medium">{listing.image_count}</span>
 </div>
 )}
 </div>
 <CardContent className="p-4 space-y-3">
 <div>
 <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
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
 onClick={(e) => handleContact(e, listing)}
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

 {/* ── Pokémon-Card Detail Modal ── */}
 <VehicleDetailModal
 listingId={detailId}
 open={!!detailId}
 onClose={() => setDetailId(null)}
 />

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
