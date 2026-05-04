import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Car, Ticket, DollarSign, Eye, TrendingUp,
  Users, ShoppingCart, Clock, Activity
} from 'lucide-react';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { title: 'Aktive Inserate', value: stats?.listings_active || 0, icon: Car, color: 'text-primary', bg: 'bg-primary/10', borderColor: 'border-primary/20' },
    { title: 'Verkaufte Fahrzeuge', value: stats?.listings_sold || 0, icon: ShoppingCart, color: 'text-success', bg: 'bg-success/10', borderColor: 'border-success/20' },
    { title: 'Offene Tickets', value: stats?.tickets_open || 0, icon: Ticket, color: 'text-warning', bg: 'bg-warning/10', borderColor: 'border-warning/20' },
    { title: 'Umsatz (Monat)', value: `$${(stats?.revenue_month || 0).toLocaleString()}`, icon: DollarSign, color: 'text-chart-2', bg: 'bg-chart-2/10', borderColor: 'border-chart-2/20' },
    { title: 'Gesamt-Aufrufe', value: (stats?.total_views || 0).toLocaleString(), icon: Eye, color: 'text-chart-5', bg: 'bg-chart-5/10', borderColor: 'border-chart-5/20' },
    { title: 'Registrierte Nutzer', value: stats?.total_users || 0, icon: Users, color: 'text-chart-4', bg: 'bg-chart-4/10', borderColor: 'border-chart-4/20' },
    { title: 'Durchschn. Preis', value: `$${(stats?.avg_price || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-chart-1', bg: 'bg-chart-1/10', borderColor: 'border-chart-1/20' },
    { title: 'Inserate (Monat)', value: stats?.listings_month || 0, icon: BarChart3, color: 'text-chart-3', bg: 'bg-chart-3/10', borderColor: 'border-chart-3/20' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statistiken</h1>
          <p className="text-muted-foreground mt-1">Übersicht über alle Geschäftszahlen.</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          <Activity className="h-3 w-3 mr-1" /> Live
        </Badge>
      </div>

      {/* Bento Stats Grid — mixed sizes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="bg-card/40">
              <CardContent className="pt-5 pb-4 px-4">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          cards.map(({ title, value, icon: Icon, color, bg, borderColor }, idx) => (
            <Card
              key={title}
              className={`group hover:shadow-lg transition-all duration-300 bg-card/40 backdrop-blur-sm ${borderColor} hover:border-opacity-60 ${
                idx === 0 || idx === 3 ? 'md:col-span-2' : ''
              }`}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
                  <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
                <div className={`text-3xl font-black ${idx === 0 || idx === 3 ? 'text-4xl' : ''}`}>{value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Activity — full width tile */}
      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <Card className="bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              Letzte Aktivitäten
            </CardTitle>
            <CardDescription>Die neuesten Systemereignisse auf einen Blick.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {stats.recent_activity.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors"
                >
                  <span className="text-xs text-muted-foreground font-mono w-14 shrink-0">
                    {new Date(a.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex-1 text-sm truncate">{a.action_label || a.action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
