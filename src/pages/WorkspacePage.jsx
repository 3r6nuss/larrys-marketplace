import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight, Ticket, Wallet, Package,
  StickyNote, BarChart3, Users, ScrollText, Database,
  TrendingUp, Store, Wrench, Trophy, History, Search, DollarSign
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PopupShell from '@/components/PopupShell';

const Tile = ({ id, onClick, colSpan = '', icon: Icon, iconColor, iconBg, title, subtitle, value, valueColor, cta, borderColor = 'border-border/50', children, loading }) => (
  <Card id={id} onClick={onClick} className={`${colSpan} relative overflow-hidden group bg-card/60 shadow-lg hover:shadow-lg ${borderColor} hover:border-opacity-60 transition-all duration-150 ${onClick ? 'cursor-pointer' : ''}`}>
  {Icon && (
    <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-all duration-200 group-hover:scale-110">
      <Icon className="h-32 w-32" />
    </div>
  )}
  <CardHeader className={children ? '' : 'pb-2'}>
    <CardTitle className={`${value !== undefined ? 'text-2xl' : 'text-sm font-medium text-muted-foreground'} flex items-center gap-2`}>
      {iconBg && <div className={`p-2 ${iconBg} rounded-md`}><Icon className={`h-5 w-5 ${iconColor}`} /></div>}
      {!iconBg && Icon && <Icon className={`h-4 w-4 ${iconColor}`} />}
      {title}
    </CardTitle>
    {subtitle && <CardDescription className="text-base">{subtitle}</CardDescription>}
  </CardHeader>
  <CardContent>
    {value !== undefined && (
      <div className="flex items-end justify-between relative z-10">
        <div className={`text-5xl font-black ${valueColor} tracking-tighter`}>
          {loading ? <Skeleton className="h-14 w-20" /> : value}
        </div>
        {cta && (
          <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${iconColor} px-4 py-2 rounded-full transition-colors group-hover:underline`}>
            {cta} <ArrowRight className="h-4 w-4" />
          </div>
        )}
      </div>
    )}
    {children}
  </CardContent>
  </Card>
);

export default function WorkspacePage() {
 const { user } = useAuth();
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 const activeModal = searchParams.get('modal');

 const [staffStats, setStaffStats] = useState(null);
 const [loading, setLoading] = useState(true);
 const [notes, setNotes] = useState('');
 const [requestCount, setRequestCount] = useState(0);
 const [activeListings, setActiveListings] = useState([]);
 const [directSellOpen, setDirectSellOpen] = useState(false);
 const [directSellForm, setDirectSellForm] = useState({ listingId: '', soldToName: '', soldPrice: '' });

 const currentDate = new Date().toLocaleDateString('de-DE', {
 weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
 });

 const getGreeting = () => {
 const h = new Date().getHours();
 return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
 };

 // Load notes
 useEffect(() => {
 if (user?.id) {
 const saved = localStorage.getItem(`larrys_notes_${user.id}`);
 if (saved) {
   // eslint-disable-next-line react-hooks/set-state-in-effect
   setNotes(saved);
 }
 }
 }, [user?.id]);

 const handleNotesChange = (e) => {
 setNotes(e.target.value);
 if (user?.id) localStorage.setItem(`larrys_notes_${user.id}`, e.target.value);
 };

 // Fetch staff stats
 useEffect(() => {
 if (!user) return;
 fetch('/api/stats/dashboard', { credentials: 'include' })
 .then(r => r.ok ? r.json() : null)
 .then(data => { if (data) setStaffStats(data); })
 .catch(console.error)
 .finally(() => setLoading(false));

 fetch('/api/requests/count', { credentials: 'include' })
  .then(r => r.ok ? r.json() : null)
  .then(data => { if (data) setRequestCount(data.open_requests ?? 0); })
  .catch(() => {});
 }, [user]);

 const openModal = (name) => setSearchParams({ modal: name });
 const closeModal = () => setSearchParams({});

  const openDirectSell = () => {
    fetch('/api/listings?status=available', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setActiveListings(data);
        setDirectSellForm({ listingId: '', soldToName: '', soldPrice: '' });
        setDirectSellOpen(true);
      })
      .catch(() => toast.error('Fehler beim Laden der Fahrzeuge.'));
  };

  const handleDirectSellSubmit = async () => {
    if (!directSellForm.listingId || !directSellForm.soldToName || !directSellForm.soldPrice) {
      toast.error('Bitte fülle alle Pflichtfelder aus.');
      return;
    }
    const selectedListing = activeListings.find(l => l.id.toString() === directSellForm.listingId);
    if (!selectedListing) return;

    try {
      const body = {
        sold_to_name: directSellForm.soldToName,
        sold_price: parseInt(directSellForm.soldPrice),
      };
      if (selectedListing.seller_id !== user.id) {
        body.on_behalf_of = selectedListing.seller_id;
      }

      const res = await fetch(`/api/listings/${selectedListing.id}/sell`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success('Verkauf erfolgreich direkt eingebucht! 🎉');
        setDirectSellOpen(false);
        // Refresh dashboard statistics
        setLoading(true);
        fetch('/api/stats/dashboard', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setStaffStats(data); })
          .finally(() => setLoading(false));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Fehler beim Einbuchen.');
      }
    } catch {
      toast.error('Netzwerkfehler.');
    }
  };

 if (!user) return null;

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
 {/* Hero */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border/40">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
 <Wrench className="h-3 w-3" /> Workspace
 </Badge>
 </div>
 <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
 {getGreeting()},{' '}
 <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
 {user.display_name || user.username}
 </span>
 <span className="ml-2 inline-block hover:animate-pulse cursor-default">👋</span>
 </h1>
 <p className="text-muted-foreground mt-1 text-sm">{currentDate}</p>
 </div>
  <div className="flex flex-wrap items-center gap-2">
  <Button onClick={openDirectSell} className="gap-2 cursor-pointer bg-success text-success-foreground hover:bg-success/90 shadow-lg shadow-success/10">
  <DollarSign className="h-4 w-4 text-white" />Direktverkauf
  </Button>
  <Button onClick={() => openModal('listings')} className="gap-2 cursor-pointer shadow-lg shadow-primary/20">
  <Package className="h-4 w-4" />Neues Inserat
  </Button>
  </div>
 </div>

 {/* Main Staff Tiles */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <Tile loading={loading} onClick={() => openModal('tickets')} colSpan="md:col-span-2" icon={Ticket} iconColor="text-warning" iconBg="bg-warning/10"
 title="Support Tickets" subtitle="Dein Posteingang für Kundenanfragen" value={staffStats?.open_tickets ?? 0} valueColor="text-warning"
 cta="Zum Postfach" borderColor="border-warning/20 hover:border-warning/40" />
 <Tile loading={loading} onClick={() => openModal('vault')} icon={Wallet} iconColor="text-success" iconBg="bg-success/10"
 title="Mein Tresor" value={`$ ${(staffStats?.vault_balance ?? 0).toLocaleString('de-DE')}`} valueColor="text-success"
 cta="Ansehen" borderColor="border-success/20 hover:border-success/40" />
 <Tile loading={loading} onClick={() => openModal('listings')} colSpan="md:col-span-2" icon={Package} iconColor="text-primary" iconBg="bg-primary/10"
 title="Meine Inserate" subtitle="Aktive Fahrzeuge auf dem Marktplatz" value={staffStats?.active_listings ?? 0} valueColor="text-primary"
 cta="Verwalten" borderColor="border-primary/20 hover:border-primary/40" />

 {/* Fahrzeuganfragen Tile */}
 <Tile loading={loading} onClick={() => openModal('requests')} icon={Search} iconColor="text-chart-2" iconBg="bg-chart-2/10"
  title="Fahrzeuganfragen" subtitle="Offene Kundenwünsche" value={requestCount} valueColor="text-chart-2"
  cta="Ansehen" borderColor="border-chart-2/20 hover:border-chart-2/40" />
 </div>

 {/* Top Fahrzeuge */}
 <Card className="bg-card/40 border-border/50 hover:border-chart-5/30 transition-all hover:shadow-lg overflow-hidden relative group">
 <CardHeader className="pb-2 flex flex-row items-center justify-between z-10">
 <CardTitle className="text-lg flex items-center gap-2">
 <div className="p-2 bg-chart-5/10 rounded-md"><TrendingUp className="h-5 w-5 text-chart-5" /></div>
 Top Fahrzeuge
 </CardTitle>
 </CardHeader>
 <CardContent className="z-10">
 {loading ? (
 <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
 ) : staffStats?.top_vehicles?.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
 {staffStats.top_vehicles.slice(0, 3).map((v, i) => (
 <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
 <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-lg ${i === 0 ? 'bg-chart-5/20 text-chart-5' : 'bg-muted text-muted-foreground'}`}>
 #{i + 1}
 </div>
 <div>
 <p className="font-semibold text-sm">{v.brand} {v.model}</p>
 <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">{v.sales_count}x</span> verkauft</p>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Noch keine Verkaufsdaten.</p>
 )}
 </CardContent>
 </Card>

 {/* Notizblock */}
 <Card className="bg-card/60 border-border/50 hover:shadow-lg transition-all">
 <CardHeader className="pb-3">
 <CardTitle className="text-xl font-bold flex items-center gap-2">
 <StickyNote className="h-6 w-6 text-primary" />Persönlicher Notizblock
 </CardTitle>
 <CardDescription>Dein privater Bereich für schnelle Notizen. Wird automatisch gespeichert.</CardDescription>
 </CardHeader>
 <CardContent>
 <textarea
 className="w-full h-40 p-4 bg-background/50 border border-input rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow shadow-inner"
 placeholder="Schreibe hier deine Notizen auf..."
 value={notes}
 onChange={handleNotesChange}
 spellCheck="false"
 />
 </CardContent>
 </Card>

  {/* Popup Shell */}
  <PopupShell activeModal={activeModal} onClose={closeModal} />

  {/* Direktverkauf Dialog */}
  <Dialog open={directSellOpen} onOpenChange={setDirectSellOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
          <DollarSign className="h-5 w-5 text-success" />
          Fahrzeug-Direktverkauf
        </DialogTitle>
        <DialogDescription className="text-xs">
          Buche einen Verkauf direkt ein, ohne dass der Kunde erst eine Anfrage erstellen musste.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-3">
        {/* Listing Selector */}
        <div className="space-y-1.5">
          <Label htmlFor="direct_listing" className="text-xs font-semibold text-muted-foreground uppercase">Fahrzeug auswählen *</Label>
          <select
            id="direct_listing"
            value={directSellForm.listingId}
            onChange={e => {
              const selectedId = e.target.value;
              const selectedListing = activeListings.find(l => l.id.toString() === selectedId);
              setDirectSellForm(f => ({
                ...f,
                listingId: selectedId,
                soldPrice: selectedListing?.custom_price?.toString() || ''
              }));
            }}
            className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="">-- Fahrzeug auswählen --</option>
            {activeListings.map(l => (
              <option key={l.id} value={l.id.toString()}>
                {l.brand} {l.model} ({l.plate || 'kein Kennzeichen'}) - ${l.custom_price?.toLocaleString('de-DE')}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="direct_customer" className="text-xs font-semibold text-muted-foreground uppercase">Käufer Name *</Label>
          <Input
            id="direct_customer"
            value={directSellForm.soldToName}
            onChange={e => setDirectSellForm(f => ({ ...f, soldToName: e.target.value }))}
            placeholder="Name des Kunden"
            className="h-9 text-sm"
          />
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <Label htmlFor="direct_price" className="text-xs font-semibold text-muted-foreground uppercase">Endpreis ($) *</Label>
          <Input
            id="direct_price"
            type="number"
            value={directSellForm.soldPrice}
            onChange={e => setDirectSellForm(f => ({ ...f, soldPrice: e.target.value }))}
            placeholder="Verkaufspreis eintragen"
            className="font-mono h-9 text-sm focus-visible:ring-success/50"
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => setDirectSellOpen(false)} className="cursor-pointer h-9 text-xs">Abbrechen</Button>
        <Button 
          onClick={handleDirectSellSubmit} 
          disabled={!directSellForm.listingId || !directSellForm.soldToName || !directSellForm.soldPrice}
          className="bg-success text-success-foreground hover:bg-success/90 cursor-pointer h-9 text-xs font-bold"
        >
          Verkauf buchen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </div>
 );
}
