import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Crown, TrendingUp, DollarSign, User, Star } from 'lucide-react';

export default function LeaderboardPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('current');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/leaderboard?period=${period}`, { credentials: 'include' })
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const podium = stats.slice(0, 3);
  const rest = stats.slice(3);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8 text-warning" />
            Mitarbeiter Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">Wer ist der Top-Seller des Marktplatzes?</p>
        </div>
        
        <Tabs value={period} onValueChange={setPeriod} className="w-auto">
          <TabsList>
            <TabsTrigger value="current" className="text-xs">Diesen Monat</TabsTrigger>
            <TabsTrigger value="last" className="text-xs">Letzten Monat</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">Gesamt</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
          <Skeleton className="h-full w-full rounded-2xl" />
          <Skeleton className="h-full w-full rounded-2xl" />
          <Skeleton className="h-full w-full rounded-2xl" />
        </div>
      ) : stats.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">Keine Verkaufsdaten für diesen Zeitraum.</p>
        </Card>
      ) : (
        <div className="space-y-12">
          {/* Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
            {/* Rank 2 */}
            {podium[1] && <PodiumCard data={podium[1]} rank={2} color="text-zinc-400" bgColor="bg-zinc-400/10" borderColor="border-zinc-400/20" />}
            
            {/* Rank 1 */}
            {podium[0] && <PodiumCard data={podium[0]} rank={1} color="text-warning" bgColor="bg-warning/10" borderColor="border-warning/20" featured />}
            
            {/* Rank 3 */}
            {podium[2] && <PodiumCard data={podium[2]} rank={3} color="text-orange-600" bgColor="bg-orange-600/10" borderColor="border-orange-600/20" />}
          </div>

          {/* List View */}
          {rest.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Weitere Platzierungen</h3>
              {rest.map((r, i) => (
                <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl bg-card/40 border border-border hover:bg-muted/30 transition-colors">
                  <div className="w-8 font-black text-xl text-muted-foreground">#{i + 4}</div>
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={r.avatar_url} />
                    <AvatarFallback>{r.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-bold">{r.display_name || r.username}</p>
                    <p className="text-xs text-muted-foreground">{r.sales_count} Verkäufe</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg">${r.total_revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Umsatz</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PodiumCard({ data, rank, color, bgColor, borderColor, featured = false }) {
  return (
    <Card className={`${featured ? 'md:scale-110 md:-translate-y-4' : 'scale-100'} relative overflow-hidden transition-all duration-300 ${borderColor} ${bgColor} group border-2`}>
      {featured && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-warning to-transparent" />}
      <CardContent className="pt-10 pb-6 flex flex-col items-center text-center">
        <div className={`absolute top-2 right-2 font-black text-4xl opacity-10 ${color}`}>#{rank}</div>
        
        <div className="relative mb-4">
          <Avatar className={`h-24 w-24 border-4 ${borderColor} group-hover:scale-105 transition-transform`}>
            <AvatarImage src={data.avatar_url} />
            <AvatarFallback className="text-2xl">{data.display_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          {rank === 1 && <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 h-10 w-10 text-warning drop-shadow-lg" />}
        </div>

        <h3 className="text-xl font-black truncate w-full px-2">{data.display_name || data.username}</h3>
        <Badge variant="outline" className={`mt-1 text-[10px] ${color} border-current/30`}>{data.sales_count} Verkäufe</Badge>

        <div className="mt-6 grid grid-cols-2 gap-4 w-full">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
              <DollarSign className="h-3 w-3" /> Umsatz
            </div>
            <p className="text-lg font-black">${data.total_revenue.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
              <TrendingUp className="h-3 w-3" /> Avg
            </div>
            <p className="text-lg font-black">${data.avg_price.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
