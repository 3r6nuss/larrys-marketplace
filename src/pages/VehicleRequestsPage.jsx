import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
 Search, Plus, Car, Clock, CheckCircle2, XCircle,
 Loader2, Send, Link2, Sparkles, ArrowRight
} from 'lucide-react';
import VehicleDetailModal from '@/components/VehicleDetailModal';

const STATUS_MAP = {
 open: { label: 'Offen', class: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
 found: { label: 'Gefunden!', class: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
 cancelled: { label: 'Storniert', class: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export default function VehicleRequestsPage({ isModal }) {
 const { user, hasRole } = useAuth();
 const isStaff = hasRole('mitarbeiter');

 const [requests, setRequests] = useState([]);
 const [loading, setLoading] = useState(true);
 const [creating, setCreating] = useState(false);
 const [brand, setBrand] = useState('');
 const [model, setModel] = useState('');
 const [notes, setNotes] = useState('');
 const [showForm, setShowForm] = useState(false);
 const [detailId, setDetailId] = useState(null);
 const [catalog, setCatalog] = useState([]);

 // Staff matching
 const [matchingId, setMatchingId] = useState(null);
 const [matchListingId, setMatchListingId] = useState('');
 const [matching, setMatching] = useState(false);

 const fetchRequests = useCallback(async () => {
  try {
   const res = await fetch('/api/requests', { credentials: 'include' });
   if (res.ok) setRequests(await res.json());
  } catch (err) {
   console.error(err);
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => { fetchRequests(); }, [fetchRequests]);

 // Fetch public catalog for vehicle picker
 useEffect(() => {
  fetch('/api/catalog/vehicles')
   .then(r => r.ok ? r.json() : [])
   .then(setCatalog)
   .catch(() => {});
 }, []);

 const handleCreate = async (e) => {
  e.preventDefault();
  if (!brand.trim() || !model.trim()) return;
  setCreating(true);
  try {
   const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ brand: brand.trim(), model: model.trim(), notes: notes.trim() || undefined }),
   });
   if (res.ok) {
    toast.success('Fahrzeuganfrage erstellt!');
    setBrand(''); setModel(''); setNotes('');
    setShowForm(false);
    fetchRequests();
   } else {
    const data = await res.json();
    toast.error(data.error || 'Fehler beim Erstellen.');
   }
  } catch {
   toast.error('Netzwerkfehler.');
  } finally {
   setCreating(false);
  }
 };

 const handleCancel = async (id) => {
  try {
   const res = await fetch(`/api/requests/${id}/cancel`, {
    method: 'PUT',
    credentials: 'include',
   });
   if (res.ok) {
    toast.success('Anfrage storniert.');
    fetchRequests();
   }
  } catch {
   toast.error('Fehler.');
  }
 };

 const handleMatch = async (requestId) => {
  if (!matchListingId.trim()) return;
  setMatching(true);
  try {
   const res = await fetch(`/api/requests/${requestId}/match`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ listing_id: parseInt(matchListingId) }),
   });
   if (res.ok) {
    toast.success('Fahrzeug zugewiesen! Kunde wird benachrichtigt.');
    setMatchingId(null);
    setMatchListingId('');
    fetchRequests();
   } else {
    const data = await res.json();
    toast.error(data.error || 'Fehler.');
   }
  } catch {
   toast.error('Netzwerkfehler.');
  } finally {
   setMatching(false);
  }
 };

 const openRequests = requests.filter(r => r.status === 'open');
 const foundRequests = requests.filter(r => r.status === 'found');
 const closedRequests = requests.filter(r => r.status === 'cancelled');

 const catalogBrands = [...new Set(catalog.map(v => v.brand))].sort();
 const catalogModels = catalog
  .filter(v => !brand || v.brand.toLowerCase() === brand.toLowerCase())
  .map(v => v.model);

 return (
  <div className={`space-y-6 ${isModal ? '' : 'max-w-4xl mx-auto'} animate-in fade-in slide-in-from-bottom-4 duration-200`}>
   {/* Header */}
   <div className="flex items-center justify-between">
    <div>
     <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
      <div className="p-2 bg-chart-2/10 rounded-lg">
       <Search className="h-6 w-6 text-chart-2" />
      </div>
      Fahrzeug-Wunschliste
     </h1>
     <p className="text-muted-foreground text-sm mt-1">
      {isStaff
       ? 'Offene Kundenanfragen — weise ein passendes Fahrzeug zu.'
       : 'Dein Wunschfahrzeug ist nicht im Katalog? Frag es hier an!'}
     </p>
    </div>
    {!isStaff && (
     <Button onClick={() => setShowForm(!showForm)} className="gap-2 cursor-pointer shadow-lg shadow-chart-2/20">
      <Plus className="h-4 w-4" />
      Anfrage erstellen
     </Button>
    )}
   </div>

   {/* Create Form (Customers only) */}
   {showForm && !isStaff && (
    <Card className="border-chart-2/30 bg-card/80 overflow-hidden animate-in slide-in-from-top-2 duration-200">
     <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-chart-2/60 via-chart-2 to-chart-2/60" />
     <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
       <Sparkles className="h-5 w-5 text-chart-2" />
       Neues Wunschfahrzeug
      </CardTitle>
      <CardDescription>Wähle ein Fahrzeug aus unserem Katalog oder gib eine freie Eingabe ein.</CardDescription>
     </CardHeader>
     <CardContent>
      <form onSubmit={handleCreate} className="space-y-4">
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
         <label className="text-xs font-bold uppercase text-muted-foreground">Marke *</label>
         <Input
          value={brand}
          onChange={e => setBrand(e.target.value)}
          list="req-brand-options"
          placeholder="Marke eingeben oder auswählen..."
          required
         />
         <datalist id="req-brand-options">
          {catalogBrands.map(b => (
           <option key={b} value={b} />
          ))}
         </datalist>
        </div>
        <div className="space-y-1.5">
         <label className="text-xs font-bold uppercase text-muted-foreground">Modell *</label>
         <Input
          value={model}
          onChange={e => setModel(e.target.value)}
          list="req-model-options"
          placeholder="Modell eingeben oder auswählen..."
          required
         />
         <datalist id="req-model-options">
          {catalogModels.map((m, i) => (
           <option key={`${m}-${i}`} value={m} />
          ))}
         </datalist>
        </div>
       </div>
       {brand && model && (
        <p className="text-xs text-chart-2 flex items-center gap-1.5">
         <Car className="h-3.5 w-3.5" />
         {catalog.some(v => v.brand.toLowerCase() === brand.toLowerCase() && v.model.toLowerCase() === model.toLowerCase())
          ? '✓ Im Katalog gefunden'
          : 'Freie Eingabe — nicht im Katalog'}
        </p>
       )}
       <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase text-muted-foreground">Anmerkung (optional)</label>
        <Input
         value={notes}
         onChange={e => setNotes(e.target.value)}
         placeholder="z.B. bevorzugte Farbe, Budget, etc."
        />
       </div>
       <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="cursor-pointer">
         Abbrechen
        </Button>
        <Button type="submit" disabled={creating || !brand.trim() || !model.trim()} className="gap-2 cursor-pointer">
         {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
         Anfrage senden
        </Button>
       </div>
      </form>
     </CardContent>
    </Card>
   )}

   {/* Loading */}
   {loading ? (
    <div className="space-y-3">
     {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
   ) : requests.length === 0 ? (
    <Card className="border-dashed border-2 border-chart-2/20">
     <CardContent className="py-12 text-center">
      <div className="p-4 rounded-full bg-chart-2/10 w-fit mx-auto mb-3">
       <Search className="h-8 w-8 text-chart-2/40" />
      </div>
      <p className="text-muted-foreground">
       {isStaff ? 'Keine offenen Fahrzeuganfragen.' : 'Du hast noch keine Fahrzeuganfragen.'}
      </p>
      {!isStaff && (
       <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4 gap-2 cursor-pointer">
        <Plus className="h-4 w-4" /> Erste Anfrage erstellen
       </Button>
      )}
     </CardContent>
    </Card>
   ) : (
    <div className="space-y-6">
     {/* Found requests — highlighted */}
     {foundRequests.length > 0 && (
      <div className="space-y-3">
       <h2 className="text-sm font-bold uppercase text-success flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Gefundene Fahrzeuge ({foundRequests.length})
       </h2>
       {foundRequests.map(r => (
        <Card key={r.id} className="border-success/30 bg-success/5 overflow-hidden group hover:shadow-lg hover:shadow-success/10 transition-all">
         <CardContent className="p-4">
          <div className="flex items-center gap-4">
           {/* Matched listing image */}
           <button
            onClick={() => r.matched_listing_id && setDetailId(r.matched_listing_id)}
            className="h-16 w-20 rounded-lg overflow-hidden bg-muted/30 shrink-0 cursor-pointer border border-success/20 hover:border-success/50 transition-colors"
           >
            {(r.listing_cover || r.listing_image) ? (
             <img loading='lazy' src={r.listing_cover || r.listing_image} alt="" className="h-full w-full object-cover" />
            ) : (
             <div className="h-full w-full flex items-center justify-center">
              <Car className="h-6 w-6 text-success/30" />
             </div>
            )}
           </button>
           <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
             <Badge className={STATUS_MAP.found.class}>{STATUS_MAP.found.label}</Badge>
            </div>
            <p className="font-bold text-sm">{r.brand} {r.model}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
             {r.listing_brand && `Gefunden: ${r.listing_brand} ${r.listing_model}`}
             {r.handler_name && ` • von ${r.handler_name}`}
            </p>
           </div>
           {r.matched_listing_id && (
            <Button
             size="sm"
             onClick={() => setDetailId(r.matched_listing_id)}
             className="gap-1.5 cursor-pointer shrink-0"
            >
             Ansehen <ArrowRight className="h-3.5 w-3.5" />
            </Button>
           )}
          </div>
         </CardContent>
        </Card>
       ))}
      </div>
     )}

     {/* Open requests */}
     {openRequests.length > 0 && (
      <div className="space-y-3">
       <h2 className="text-sm font-bold uppercase text-warning flex items-center gap-2">
        <Clock className="h-4 w-4" /> Offene Anfragen ({openRequests.length})
       </h2>
       {openRequests.map(r => (
        <Card key={r.id} className="border-warning/20 hover:border-warning/40 transition-all hover:shadow-md group">
         <CardContent className="p-4">
          <div className="flex items-start gap-4">
           <div className="p-2.5 bg-warning/10 rounded-lg shrink-0">
            <Car className="h-5 w-5 text-warning" />
           </div>
           <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
             <Badge className={STATUS_MAP.open.class}>{STATUS_MAP.open.label}</Badge>
             {isStaff && r.customer_name && (
              <span className="text-[10px] text-muted-foreground">von {r.customer_name}</span>
             )}
            </div>
            <p className="font-bold text-sm">{r.brand} {r.model}</p>
            {r.notes && <p className="text-xs text-muted-foreground mt-1 italic">„{r.notes}"</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
             {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
           </div>
           <div className="flex items-center gap-2 shrink-0">
            {/* Staff: Match button */}
            {isStaff && matchingId !== r.id && (
             <Button size="sm" variant="outline" onClick={() => setMatchingId(r.id)} className="gap-1.5 cursor-pointer text-xs">
              <Link2 className="h-3.5 w-3.5" /> Zuweisen
             </Button>
            )}
            {/* Cancel button */}
            {(r.customer_id === user?.id || isStaff) && (
             <Button size="sm" variant="ghost" onClick={() => handleCancel(r.id)} className="text-destructive hover:text-destructive cursor-pointer text-xs">
              <XCircle className="h-3.5 w-3.5" />
             </Button>
            )}
           </div>
          </div>

          {/* Staff matching input */}
          {isStaff && matchingId === r.id && (
           <div className="mt-3 pt-3 border-t border-border/40 flex gap-2 animate-in slide-in-from-top-2 duration-150">
            <Input
             type="number"
             value={matchListingId}
             onChange={e => setMatchListingId(e.target.value)}
             placeholder="Listing-ID eingeben..."
             className="flex-1"
            />
            <Button size="sm" onClick={() => handleMatch(r.id)} disabled={matching || !matchListingId.trim()} className="gap-1.5 cursor-pointer">
             {matching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
             Bestätigen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMatchingId(null); setMatchListingId(''); }} className="cursor-pointer">
             Abbrechen
            </Button>
           </div>
          )}
         </CardContent>
        </Card>
       ))}
      </div>
     )}

     {/* Closed requests */}
     {closedRequests.length > 0 && (
      <div className="space-y-3">
       <Separator />
       <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
        <XCircle className="h-4 w-4" /> Storniert ({closedRequests.length})
       </h2>
       {closedRequests.map(r => (
        <Card key={r.id} className="border-border/30 opacity-60 hover:opacity-80 transition-opacity">
         <CardContent className="p-3">
          <div className="flex items-center gap-3">
           <Car className="h-4 w-4 text-muted-foreground shrink-0" />
           <div className="flex-1 min-w-0">
            <p className="text-sm line-through text-muted-foreground">{r.brand} {r.model}</p>
           </div>
           <Badge className={STATUS_MAP.cancelled.class}>{STATUS_MAP.cancelled.label}</Badge>
          </div>
         </CardContent>
        </Card>
       ))}
      </div>
     )}
    </div>
   )}

   {/* Vehicle Detail Modal */}
   <VehicleDetailModal listingId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
  </div>
 );
}
