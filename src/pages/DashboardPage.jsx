import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ListingsPage from '@/pages/ListingsPage';
import CalculatorPage from '@/pages/CalculatorPage';
import TicketsPage from '@/pages/TicketsPage';
import VaultPage from '@/pages/VaultPage';
import { 
  Car, Ticket, DollarSign, Eye, Clock, ArrowRight, 
  PlusCircle, Calculator, CheckCircle2, StickyNote, Wallet, TrendingUp 
} from 'lucide-react';

/**
 * Seller Dashboard — Premium Workspace Overview
 * Only visible to mitarbeiter+
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeModal = searchParams.get('modal');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState(0);

  useEffect(() => {
    if (stats?.top_vehicles?.length > 1) {
      const timer = setInterval(() => {
        setCurrentVehicleIndex(prev => (prev + 1) % stats.top_vehicles.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [stats?.top_vehicles]);

  useEffect(() => {
    if (user?.id) {
      const savedNotes = localStorage.getItem(`larrys_notes_${user.id}`);
      if (savedNotes) setNotes(savedNotes);
    }
  }, [user?.id]);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    if (user?.id) {
      localStorage.setItem(`larrys_notes_${user.id}`, e.target.value);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats/dashboard', { credentials: 'include' });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morgen';
    if (hour < 18) return 'Tag';
    return 'Abend';
  };

  const currentDate = new Date().toLocaleDateString('de-DE', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border/40">
        <div>
          <p className="text-muted-foreground font-medium mb-1.5 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {currentDate}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Guten {getGreeting()},{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {user?.display_name || user?.username}
            </span>
            <span className="ml-2 inline-block hover:animate-pulse cursor-default">👋</span>
          </h1>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setSearchParams({ modal: 'listings' })}
            className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5 h-10 px-5 cursor-pointer"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Neues Inserat
          </button>
          <button 
            onClick={() => setSearchParams({ modal: 'calculator' })}
            className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-card/50 backdrop-blur shadow-sm hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 h-10 px-5 cursor-pointer"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Rechner öffnen
          </button>
        </div>
      </div>

      {/* Bento Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* ROW 1: TICKETS & SALES */}
        <Card 
          onClick={() => setSearchParams({ modal: 'tickets' })}
          className="col-span-1 md:col-span-2 relative overflow-hidden group border-warning/20 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-warning/10 hover:border-warning/40 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-1/2 -translate-y-1/2 right-4 p-6 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
            <Ticket className="h-40 w-40" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="p-2 bg-warning/10 rounded-md">
                <Ticket className="h-6 w-6 text-warning" />
              </div>
              Support Tickets
            </CardTitle>
            <CardDescription className="text-base">Dein Posteingang für Kundenanfragen</CardDescription>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="flex items-end justify-between relative z-10">
              <div>
                <div className="text-6xl font-black text-warning tracking-tighter">
                  {loading ? <Skeleton className="h-16 w-20" /> : stats?.open_tickets ?? 0}
                </div>
                <p className="text-muted-foreground mt-2 font-medium">Offene Anfragen warten auf dich</p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-warning group-hover:text-warning/80 group-hover:underline bg-warning/10 px-4 py-2 rounded-full transition-colors">
                Zum Postfach <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setSearchParams({ modal: 'vault' })}
          className="col-span-1 bg-card/40 backdrop-blur-sm border-border/50 hover:border-success/40 transition-all hover:shadow-lg flex flex-col justify-between group cursor-pointer"
        >
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-success transition-colors">Mein Tresor</CardTitle>
            <div className="p-2 bg-success/10 rounded-md">
              <Wallet className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-success">
              {loading ? <Skeleton className="h-12 w-24" /> : `$ ${(stats?.vault_balance ?? 0).toLocaleString('de-DE')}`}
            </div>
            <div className="text-sm text-muted-foreground mt-3 font-medium flex items-center gap-1.5 group-hover:text-success transition-colors">
              Guthaben ansehen <ArrowRight className="h-3 w-3" />
            </div>
          </CardContent>
        </Card>

        {/* ROW 2: INSERATE & VIEWS */}
        <Card 
          onClick={() => setSearchParams({ modal: 'listings' })}
          className="col-span-1 md:col-span-2 relative overflow-hidden group border-primary/20 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-primary/10 hover:border-primary/40 transition-all duration-300 cursor-pointer"
        >
          <div className="absolute top-1/2 -translate-y-1/2 right-4 p-6 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
            <Car className="h-40 w-40" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-md">
                <Car className="h-6 w-6 text-primary" />
              </div>
              Meine Inserate
            </CardTitle>
            <CardDescription className="text-base">Aktive Fahrzeuge auf dem Marktplatz</CardDescription>
          </CardHeader>
          <CardContent className="mt-2">
            <div className="flex items-end justify-between relative z-10">
              <div>
                <div className="text-6xl font-black text-primary tracking-tighter">
                  {loading ? <Skeleton className="h-16 w-20" /> : stats?.active_listings ?? 0}
                </div>
                <p className="text-muted-foreground mt-2 font-medium">Fahrzeuge online</p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary/80 group-hover:underline bg-primary/10 px-4 py-2 rounded-full transition-colors">
                Verwalten <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 bg-card/40 backdrop-blur-sm border-border/50 hover:border-chart-5/30 transition-all hover:shadow-lg flex flex-col justify-between overflow-hidden relative group">
          <CardHeader className="pb-2 flex flex-row items-center justify-between z-10 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-chart-5 transition-colors">Top Fahrzeuge</CardTitle>
            <div className="p-2 bg-chart-5/10 rounded-md">
              <TrendingUp className="h-4 w-4 text-chart-5" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center z-10 relative py-2">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : stats?.top_vehicles?.length > 0 ? (
              <div key={currentVehicleIndex} className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="text-2xl font-bold line-clamp-1" title={`${stats.top_vehicles[currentVehicleIndex].brand} ${stats.top_vehicles[currentVehicleIndex].model}`}>
                  {stats.top_vehicles[currentVehicleIndex].brand} {stats.top_vehicles[currentVehicleIndex].model}
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  <span className="font-semibold text-foreground">{stats.top_vehicles[currentVehicleIndex].sales_count} mal</span> verkauft und{' '}
                  <span className="font-semibold text-foreground">{stats.top_vehicles[currentVehicleIndex].views_count} mal</span> angesehen
                </p>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                <Car className="h-4 w-4 opacity-50" /> Keine Fahrzeugdaten.
              </div>
            )}
          </CardContent>
          
          {/* Progress Indicators */}
          {stats?.top_vehicles?.length > 1 && (
            <div className="absolute bottom-3 left-0 w-full flex justify-center gap-1 z-10">
              {stats.top_vehicles.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentVehicleIndex ? 'w-4 bg-chart-5' : 'w-1.5 bg-border'}`} 
                />
              ))}
            </div>
          )}
        </Card>

        {/* ROW 3: NOTIZBLOCK (Workspace Tool) */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 bg-card/60 backdrop-blur-sm border-border/50 hover:shadow-lg transition-all mt-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <StickyNote className="h-6 w-6 text-primary" />
              Persönlicher Notizblock
            </CardTitle>
            <CardDescription className="text-base">Dein privater Bereich für schnelle Notizen, Kennzeichen oder Kundenrückfragen. Wird automatisch gespeichert.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-48 p-4 bg-background/50 border border-input rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow shadow-inner"
              placeholder="Schreibe hier deine Notizen auf... (z.B. Kunde Müller meldet sich wegen dem Audi um 16 Uhr)"
              value={notes}
              onChange={handleNotesChange}
              spellCheck="false"
            />
          </CardContent>
        </Card>

      </div>

      {/* MODALS */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setSearchParams({})}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[1200px] w-full h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-border/50">
          <div className="p-2 h-full">
            {activeModal === 'listings' && <ListingsPage isModal />}
            {activeModal === 'calculator' && <CalculatorPage isModal />}
            {activeModal === 'tickets' && <TicketsPage isModal />}
            {activeModal === 'vault' && <VaultPage isModal />}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
