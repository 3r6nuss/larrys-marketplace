import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowRight, BarChart3, Users, ScrollText, Database,
  Trophy, History, Crown, Shield, StickyNote, Bot, Send, Loader2, ArchiveRestore
} from 'lucide-react';
import PopupShell from '@/components/PopupShell';

export default function AdminDashboard() {
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeModal = searchParams.get('modal');
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [discordTestMessage, setDiscordTestMessage] = useState('Dies ist eine Testnachricht von Larry’s Marketplace.');
  const [sendingDiscordTest, setSendingDiscordTest] = useState(false);

  const currentDate = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Load notes
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`larrys_admin_notes_${user.id}`);
      if (saved) setNotes(saved);
    }
  }, [user?.id]);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    if (user?.id) localStorage.setItem(`larrys_admin_notes_${user.id}`, e.target.value);
  };

  // Fetch stats
  useEffect(() => {
    if (!user) return;
    fetch('/api/stats/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAdminStats(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const openModal = (name) => setSearchParams({ modal: name });
  const closeModal = () => setSearchParams({});

  const sendDiscordTest = async () => {
    const message = discordTestMessage.trim();
    if (!message || sendingDiscordTest) return;
    setSendingDiscordTest(true);
    try {
      const res = await fetch('/api/users/me/test-discord-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Test-DM wurde an dein Discord-Konto gesendet.');
      } else {
        toast.error(data.error || 'Test-DM konnte nicht gesendet werden.');
      }
    } catch {
      toast.error('Backend nicht erreichbar.');
    } finally {
      setSendingDiscordTest(false);
    }
  };

  // Tile helper
  const Tile = ({ id, onClick, colSpan = '', icon: Icon, iconColor, iconBg, title, subtitle, value, valueColor, cta, borderColor = 'border-border/50', children }) => (
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

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs gap-1 border-red-400/30 text-red-400">
              <Crown className="h-3 w-3" /> Administration
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{currentDate}</p>
        </div>
      </div>

      {/* Admin Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Benutzerverwaltung - large */}
        <Tile
          onClick={() => openModal('users')}
          colSpan="md:col-span-2"
          icon={Users}
          iconColor="text-chart-4"
          iconBg="bg-chart-4/10"
          title="Benutzerverwaltung"
          subtitle="Accounts, Rollen & Berechtigungen verwalten"
          value={adminStats?.total_users ?? '—'}
          valueColor="text-chart-4"
          cta="Verwalten"
          borderColor="border-chart-4/20 hover:border-chart-4/40"
        />

        {/* Statistiken */}
        <Tile
          onClick={() => openModal('stats')}
          icon={BarChart3}
          iconColor="text-chart-2"
          iconBg="bg-chart-2/10"
          title="Statistiken"
          subtitle="Umsatz, Verkäufe & Performance"
          borderColor="border-chart-2/20 hover:border-chart-2/40"
        >
          <div className="text-sm font-bold text-chart-2 mt-2 flex items-center gap-1">
            Öffnen <ArrowRight className="h-3 w-3" />
          </div>
        </Tile>

        {/* Audit-Logs */}
        {hasRole('stv_admin') && (
          <Tile
            onClick={() => openModal('logs')}
            icon={ScrollText}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-400/10"
            title="Audit-Logs"
            subtitle="System-Aktivitäten & Änderungsprotokoll"
            borderColor="border-indigo-400/20 hover:border-indigo-400/40"
          >
            <div className="text-sm font-bold text-indigo-400 mt-2 flex items-center gap-1">
              Ansehen <ArrowRight className="h-3 w-3" />
            </div>
          </Tile>
        )}

        {/* Katalog-Import */}
        <Tile
          onClick={() => openModal('catalog_admin')}
          icon={Database}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-400/10"
          title="Katalog-Import"
          subtitle="Fahrzeugkatalog verwalten & CSV importieren"
          borderColor="border-emerald-400/20 hover:border-emerald-400/40"
        >
          <div className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1">
            Verwalten <ArrowRight className="h-3 w-3" />
          </div>
        </Tile>

        {hasRole('superadmin') && (
          <Tile
            onClick={() => openModal('backup')}
            icon={ArchiveRestore}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-400/10"
            title="Datenbank-Backups"
            subtitle="Tabellen sichern und wiederherstellen"
            borderColor="border-cyan-400/20 hover:border-cyan-400/40"
          >
            <div className="text-sm font-bold text-cyan-400 mt-2 flex items-center gap-1">
              Öffnen <ArrowRight className="h-3 w-3" />
            </div>
          </Tile>
        )}

        {/* Leaderboard */}
        <Tile
          onClick={() => openModal('leaderboard')}
          icon={Trophy}
          iconColor="text-warning"
          iconBg="bg-warning/10"
          title="Leaderboard"
          subtitle="Top-Mitarbeiter & Rangliste"
          borderColor="border-warning/20 hover:border-warning/40"
        >
          <div className="text-sm font-bold text-warning mt-2 flex items-center gap-1">
            Öffnen <ArrowRight className="h-3 w-3" />
          </div>
        </Tile>

        {/* Aktivitäts-Feed */}
        <Tile
          onClick={() => openModal('activity')}
          icon={History}
          iconColor="text-violet-400"
          iconBg="bg-violet-400/10"
          title="Aktivitäts-Feed"
          subtitle="Live-Übersicht aller Aktionen"
          borderColor="border-violet-400/20 hover:border-violet-400/40"
        >
          <div className="text-sm font-bold text-violet-400 mt-2 flex items-center gap-1">
            Öffnen <ArrowRight className="h-3 w-3" />
          </div>
        </Tile>
      </div>

      {/* Discord bot test */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-chart-2" /> Discord-Bot testen
          </CardTitle>
          <CardDescription>Sendet eine Test-DM an dein eigenes verknüpftes Discord-Konto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={discordTestMessage}
            onChange={event => setDiscordTestMessage(event.target.value)}
            maxLength={1000}
            placeholder="Testnachricht eingeben..."
            className="min-h-20 resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{discordTestMessage.length}/1000 Zeichen</span>
            <Button onClick={sendDiscordTest} disabled={!discordTestMessage.trim() || sendingDiscordTest} className="gap-1.5 cursor-pointer">
              {sendingDiscordTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Test-DM senden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Notizblock */}
      <Card className="bg-card/60 border-border/50 hover:shadow-lg transition-all">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <StickyNote className="h-6 w-6 text-red-400" />Admin-Notizen
          </CardTitle>
          <CardDescription>Private Notizen für die Administration. Wird lokal gespeichert.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full h-32 p-4 bg-background/50 border border-input rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-red-400/50 text-sm transition-shadow shadow-inner"
            placeholder="Admin-Notizen hier eingeben..."
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
