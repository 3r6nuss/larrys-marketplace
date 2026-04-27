import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Car, Ticket, DollarSign, Eye, TrendingUp, Users, ShoppingCart } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Statistiken</h1></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const cards = [
    { title: 'Aktive Inserate', value: stats?.listings_active || 0, icon: Car, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Verkaufte Fahrzeuge', value: stats?.listings_sold || 0, icon: ShoppingCart, color: 'text-success', bg: 'bg-success/10' },
    { title: 'Offene Tickets', value: stats?.tickets_open || 0, icon: Ticket, color: 'text-warning', bg: 'bg-warning/10' },
    { title: 'Umsatz (Monat)', value: `$${(stats?.revenue_month || 0).toLocaleString()}`, icon: DollarSign, color: 'text-chart-2', bg: 'bg-chart-2/10' },
    { title: 'Gesamt-Aufrufe', value: (stats?.total_views || 0).toLocaleString(), icon: Eye, color: 'text-chart-5', bg: 'bg-chart-5/10' },
    { title: 'Registrierte Nutzer', value: stats?.total_users || 0, icon: Users, color: 'text-chart-4', bg: 'bg-chart-4/10' },
    { title: 'Durchschn. Preis', value: `$${(stats?.avg_price || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-chart-1', bg: 'bg-chart-1/10' },
    { title: 'Inserate (Monat)', value: stats?.listings_month || 0, icon: BarChart3, color: 'text-chart-3', bg: 'bg-chart-3/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistiken</h1>
        <p className="text-muted-foreground mt-1">Übersicht über alle Geschäftszahlen.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title} className="group hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      {stats?.recent_activity && stats.recent_activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">
                    {new Date(a.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex-1">{a.action_label || a.action}</span>
                  <span className="text-xs text-muted-foreground">{a.user_name || 'System'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
