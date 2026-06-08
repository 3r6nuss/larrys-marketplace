import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
 ChevronLeft, ChevronRight, Car, MessageSquare,
 Tag, Hash, Calendar, Star, LogIn, Shield
} from 'lucide-react';
import FinancingCalculator from './FinancingCalculator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORY_COLORS = {
 Sport: 'border-blue-500/50 shadow-blue-500/10',
 SUV: 'border-emerald-500/50 shadow-emerald-500/10',
 Muscle: 'border-red-500/50 shadow-red-500/10',
 Limousine: 'border-amber-500/50 shadow-amber-500/10',
 Kompakt: 'border-cyan-500/50 shadow-cyan-500/10',
 Coupé: 'border-purple-500/50 shadow-purple-500/10',
 Offroad: 'border-orange-500/50 shadow-orange-500/10',
 Van: 'border-teal-500/50 shadow-teal-500/10',
 Sonstige: 'border-zinc-500/50 shadow-zinc-500/10',
};

const CATEGORY_ACCENT = {
 Sport: 'text-blue-400',
 SUV: 'text-emerald-400',
 Muscle: 'text-red-400',
 Limousine: 'text-amber-400',
 Kompakt: 'text-cyan-400',
 Coupé: 'text-purple-400',
 Offroad: 'text-orange-400',
 Van: 'text-teal-400',
 Sonstige: 'text-zinc-400',
};

const ROLE_LABELS = {
 superadmin: 'Superadmin',
 stv_admin: 'Stv. Admin',
 inhaber: 'Inhaber',
 mitarbeiter: 'Mitarbeiter',
 kunde: 'Kunde',
};

async function fetchJson(url, options) {
 const response = await fetch(url, options);
 if (!response.ok) return null;
 return response.json();
}

/**
 * Pokémon-Card style vehicle detail modal.
 * Opens as a large popup over the catalog with image slider and stat box.
 */
export default function VehicleDetailModal({ listingId, open, onClose }) {
 const { user, login, hasRole } = useAuth();
 const { addViewed } = useRecentlyViewed();
 const navigate = useNavigate();

 const isStaff = hasRole('mitarbeiter');

 const [listing, setListing] = useState(null);
 const [loading, setLoading] = useState(true);
 const [currentImage, setCurrentImage] = useState(0);
 const [sellerStats, setSellerStats] = useState(null);

 // Fetch listing detail
 useEffect(() => {
 if (!open || !listingId) return;

 let isActive = true;

 setLoading(true);
 setCurrentImage(0);
 setSellerStats(null);

 (async () => {
 try {
 const data = await fetchJson(`/api/listings/${listingId}`, { credentials: 'include' });
 if (!isActive) return;

 setListing(data);
 if (!data) return;

 addViewed(data.id);

 const stats = await fetchJson(`/api/reviews/seller/${data.seller_id}`);
 if (!isActive) return;
 setSellerStats(stats);
 } catch (error) {
 console.error(error);
 } finally {
 if (isActive) {
 setLoading(false);
 }
 }
 })();

 return () => {
 isActive = false;
 };
 }, [listingId, open, addViewed]);

 // Keyboard navigation
 useEffect(() => {
 if (!open || !listing?.images?.length) return;
 const handler = (e) => {
 if (e.key === 'ArrowLeft') {
 setCurrentImage(prev => (prev - 1 + listing.images.length) % listing.images.length);
 } else if (e.key === 'ArrowRight') {
 setCurrentImage(prev => (prev + 1) % listing.images.length);
 }
 };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [open, listing?.images?.length]);

 const handleContact = useCallback(() => {
 if (!user) {
 sessionStorage.setItem('pendingListing', listingId);
 login();
 return;
 }
 onClose();
 navigate(`/kunde?modal=tickets&listing=${listingId}`);
 }, [user, listingId, login, onClose, navigate]);

 const images = listing?.images || [];
 const catColor = CATEGORY_COLORS[listing?.category] || CATEGORY_COLORS.Sonstige;
 const catAccent = CATEGORY_ACCENT[listing?.category] || CATEGORY_ACCENT.Sonstige;

 const detailsContent = listing ? (
  <div className="space-y-2.5">
   {listing.category && (
    <StatRow icon={Tag} label="Kategorie">
     <Badge variant="outline" className={`${catAccent} border-current/30`}>
      {listing.category}
     </Badge>
    </StatRow>
   )}
   {listing.plate && (
    <StatRow icon={Hash} label="Kennzeichen">
     <span className="font-mono font-bold text-sm">{listing.plate}</span>
    </StatRow>
   )}
   <StatRow icon={Calendar} label="Gelistet">
    <span className="text-sm">
     {listing.listed_at
      ? new Date(listing.listed_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—'
     }
    </span>
   </StatRow>
   {listing.status && (
    <StatRow icon={Car} label="Status">
     <Badge variant={listing.status === 'available' ? 'default' : 'secondary'}>
      {listing.status === 'available' ? 'Verfügbar' : listing.status === 'reserved' ? 'Reserviert' : 'Verkauft'}
     </Badge>
    </StatRow>
   )}
  </div>
 ) : null;

 return (
 <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
 <DialogContent className={`max-w-7xl sm:max-w-7xl w-[95vw] md:h-[620px] max-h-[95vh] md:max-h-[620px] p-0 overflow-hidden border-2 ${catColor} bg-card/95 holo-shimmer`}>
 {/* Hidden accessible title */}
 <DialogTitle className="sr-only">
 {listing ? `${listing.brand} ${listing.model}` : 'Fahrzeug-Details'}
 </DialogTitle>

 {loading ? (
 <div className="p-8 space-y-4">
 <Skeleton className="h-72 w-full rounded-xl" />
 <Skeleton className="h-8 w-1/2" />
 <Skeleton className="h-4 w-1/3" />
 </div>
 ) : !listing ? (
 <div className="p-12 text-center">
 <Car className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
 <p className="text-muted-foreground">Fahrzeug nicht gefunden.</p>
 </div>
 ) : (
 <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-y-hidden">
 {/* ── LEFT: Image Slider ── */}
 <div className="w-full md:w-[58%] bg-black/20 relative flex flex-col h-full overflow-hidden">
 {/* Main image */}
 <div className="relative flex-1 min-h-[340px] md:min-h-0 flex items-center justify-center overflow-hidden">
 {images.length > 0 ? (
 <img
 src={images[currentImage]?.image_path}
 alt={`${listing.brand} ${listing.model} - Bild ${currentImage + 1}`}
 className="w-full h-full object-contain animate-in fade-in duration-150"
 key={currentImage}
 />
 ) : (
 <div className="flex flex-col items-center justify-center py-20">
 <Car className="h-20 w-20 text-muted-foreground/15" />
 <p className="text-xs text-muted-foreground/40 mt-2">Kein Bild vorhanden</p>
 </div>
 )}

 {/* Arrow controls */}
 {images.length > 1 && (
 <>
 <button
 onClick={() => setCurrentImage(prev => (prev - 1 + images.length) % images.length)}
 className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
 >
 <ChevronLeft className="h-5 w-5" />
 </button>
 <button
 onClick={() => setCurrentImage(prev => (prev + 1) % images.length)}
 className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
 >
 <ChevronRight className="h-5 w-5" />
 </button>
 </>
 )}

 {/* Image counter */}
 {images.length > 1 && (
 <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
 {currentImage + 1} / {images.length}
 </div>
 )}

 {/* Badges */}
 <div className="absolute top-3 left-3 flex gap-1.5">
 {listing.is_featured ? (
 <Badge className="bg-orange-500/90 text-white border-0 text-[10px]">
 <Star className="h-3 w-3 mr-0.5 fill-white" /> Featured
 </Badge>
 ) : null}
 {listing.discount_pct > 0 && (
 <Badge className="bg-success/90 text-white border-0 text-[10px]">
 -{listing.discount_pct}%
 </Badge>
 )}
 </div>
 </div>

 {/* Thumbnail strip */}
 {images.length > 1 && (
 <div className="flex gap-1.5 p-2 bg-black/30 overflow-x-auto thumb-scroll">
 {images.map((img, idx) => (
 <button
 key={img.id}
 onClick={() => setCurrentImage(idx)}
 className={`h-12 w-16 rounded-md overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
 idx === currentImage
 ? 'border-primary ring-1 ring-primary/50 scale-105'
 : 'border-transparent opacity-60 hover:opacity-100'
 }`}
 >
 <img loading='lazy' src={img.image_path} alt="" className="h-full w-full object-cover" />
 </button>
 ))}
 </div>
 )}
 </div>

 {/* ── RIGHT: Stat Box ── */}
 <div className="w-full md:w-[42%] p-5 md:p-6 flex flex-col justify-between h-full overflow-y-auto">
 {/* Header */}
 <div>
 <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
 {listing.brand}
 </h2>
 <h3 className={`text-xl md:text-2xl font-bold ${catAccent} -mt-0.5`}>
 {listing.model}
 </h3>

  {isStaff ? (
   <Tabs defaultValue="details" className="mt-6">
    <TabsList className="grid w-full grid-cols-2">
     <TabsTrigger value="details">Details</TabsTrigger>
     <TabsTrigger value="finance">Finanzierung</TabsTrigger>
    </TabsList>
    
    <TabsContent value="details" className="mt-4 space-y-4">
     {detailsContent}
    </TabsContent>
    
    <TabsContent value="finance" className="mt-4">
     <FinancingCalculator price={listing.custom_price || 0} />
    </TabsContent>
   </Tabs>
  ) : (
   <div className="mt-6 space-y-4">
    {detailsContent}
   </div>
  )}
</div>

 {/* Separator */}
 <div className="my-4 border-t border-border/40" />

 {/* Seller info */}
 <div>
 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Verkäufer</p>
 <div className="flex items-center gap-3 mb-4">
 <Avatar className="h-10 w-10 border-2 border-border">
 <AvatarImage src={listing.seller_avatar} />
 <AvatarFallback className="text-sm bg-primary/20 text-primary">
 {listing.seller_name?.charAt(0)?.toUpperCase() || '?'}
 </AvatarFallback>
 </Avatar>
 <div>
 <p className="font-semibold text-sm">{listing.seller_name || 'Unbekannt'}</p>
 <div className="flex items-center gap-2 mt-0.5">
  {sellerStats && (
   <div className="flex items-center gap-1 text-warning bg-warning/10 px-1.5 py-0.5 rounded text-[10px] font-black">
    <Star className="h-2.5 w-2.5 fill-current" />
    {sellerStats.average} ({sellerStats.count})
   </div>
  )}
  {listing.seller_role && (
   <p className="text-[10px] text-muted-foreground flex items-center gap-1">
    <Shield className="h-2.5 w-2.5" />
    {ROLE_LABELS[listing.seller_role] || listing.seller_role}
   </p>
  )}
 </div>
 </div>
 </div>

 {/* CTA Button */}
 {listing.status === 'available' && (
 <Button
 onClick={handleContact}
 className="w-full gap-2 cursor-pointer shadow-lg"
 size="lg"
 >
 {user ? (
 <>
 <MessageSquare className="h-4 w-4" />
 Verkäufer kontaktieren
 </>
 ) : (
 <>
 <LogIn className="h-4 w-4" />
 Anmelden um zu kontaktieren
 </>
 )}
 </Button>
 )}
 </div>
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
}

/** Small stat row component */
function StatRow({ icon: Icon, label, children }) {
 return (
 <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/20">
 <span className="flex items-center gap-2 text-xs text-muted-foreground">
 <Icon className="h-3.5 w-3.5" />
 {label}
 </span>
 {children}
 </div>
 );
}
