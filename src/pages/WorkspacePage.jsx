import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
 ArrowRight, Ticket, Wallet, Package, Calculator,
 StickyNote, BarChart3, Users, ScrollText, Database,
 TrendingUp, Store, Wrench, Trophy, History, Search
} from 'lucide-react';
import PopupShell from '@/components/PopupShell';

export default function WorkspacePage() {
 const { user, hasRole } = useAuth();
 const { openTickets } = useNotifications();
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 const activeModal = searchParams.get('modal');

 const [staffStats, setStaffStats] = useState(null);
 const [loading, setLoading] = useState(true);
 const [notes, setNotes] = useState('');
 const [requestCount, setRequestCount] = useState(0);

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
 if (saved) setNotes(saved);
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

 // Bento tile helper
 const Tile = ({ onClick, colSpan = '', icon: Icon, iconColor, iconBg, title, subtitle, value, valueColor, cta, borderColor = 'border-border/50', children }) => (
 <Card onClick={onClick} className={`${colSpan} relative overflow-hidden group bg-card/60 shadow-lg hover:shadow-lg ${borderColor} hover:border-opacity-60 transition-all duration-150 ${onClick ? 'cursor-pointer' : ''}`}>
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
 <Button onClick={() => openModal('listings')} className="gap-2 cursor-pointer shadow-lg shadow-primary/20">
 <Package className="h-4 w-4" />Neues Inserat
 </Button>
 <Button variant="outline" onClick={() => openModal('calculator')} className="gap-2 cursor-pointer">
 <Calculator className="h-4 w-4" />Rechner
 </Button>
 </div>
 </div>

 {/* Main Staff Tiles */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <Tile onClick={() => openModal('tickets')} colSpan="md:col-span-2" icon={Ticket} iconColor="text-warning" iconBg="bg-warning/10"
 title="Support Tickets" subtitle="Dein Posteingang für Kundenanfragen" value={staffStats?.open_tickets ?? 0} valueColor="text-warning"
 cta="Zum Postfach" borderColor="border-warning/20 hover:border-warning/40" />
 <Tile onClick={() => openModal('vault')} icon={Wallet} iconColor="text-success" iconBg="bg-success/10"
 title="Mein Tresor" value={`$ ${(staffStats?.vault_balance ?? 0).toLocaleString('de-DE')}`} valueColor="text-success"
 cta="Ansehen" borderColor="border-success/20 hover:border-success/40" />
 <Tile onClick={() => openModal('listings')} colSpan="md:col-span-2" icon={Package} iconColor="text-primary" iconBg="bg-primary/10"
 title="Meine Inserate" subtitle="Aktive Fahrzeuge auf dem Marktplatz" value={staffStats?.active_listings ?? 0} valueColor="text-primary"
 cta="Verwalten" borderColor="border-primary/20 hover:border-primary/40" />

 {/* Fahrzeuganfragen Tile */}
 <Tile onClick={() => openModal('requests')} icon={Search} iconColor="text-chart-2" iconBg="bg-chart-2/10"
  title="Fahrzeuganfragen" subtitle="Offene Kundenwünsche" value={requestCount} valueColor="text-chart-2"
  cta="Ansehen" borderColor="border-chart-2/20 hover:border-chart-2/40" />

 {/* Kunden Dashboard Tile */}
 <Card onClick={() => navigate('/kunde')} className="bg-card/40 border-chart-4/20 hover:border-chart-4/40 transition-all hover:shadow-lg cursor-pointer group relative overflow-hidden">
 <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-all duration-200 group-hover:scale-110">
 <Store className="h-32 w-32" />
 </div>
 <CardHeader>
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="p-2 bg-chart-4/10 rounded-md"><Store className="h-5 w-5 text-chart-4" /></div>
 Kunden Dashboard
 </CardTitle>
 <CardDescription>Sieh den Marktplatz aus Kundensicht</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="inline-flex items-center gap-1.5 text-sm font-bold text-chart-4 group-hover:underline">
 Zum Marktplatz <ArrowRight className="h-4 w-4" />
 </div>
 </CardContent>
 </Card>
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
 </div>
 );
}
