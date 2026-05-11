import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, Car, ShoppingCart, MessageSquare, 
  LogIn, UserPlus, Settings, Star, AlertCircle,
  FileText, CheckCircle2
} from 'lucide-react';

const ICON_MAP = {
  listing_created: { icon: Car, color: 'text-primary', bg: 'bg-primary/10' },
  listing_sold: { icon: ShoppingCart, color: 'text-success', bg: 'bg-success/10' },
  listing_updated: { icon: Settings, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  listing_deleted: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  ticket_created: { icon: MessageSquare, color: 'text-warning', bg: 'bg-warning/10' },
  ticket_message: { icon: MessageSquare, color: 'text-warning', bg: 'bg-warning/10' },
  ticket_status_changed: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  login: { icon: LogIn, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  review_posted: { icon: Star, color: 'text-orange-400', bg: 'bg-orange-400/10' },
};

export default function ActivityPage() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/activity-full', { credentials: 'include' })
      .then(r => r.json())
      .then(setActivity)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="pb-2 border-b border-border/40">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <History className="h-6 w-6 text-primary" />
          </div>
          Live Aktivitäts-Feed
        </h1>
        <p className="text-muted-foreground mt-1">Die neuesten Systemereignisse in Echtzeit.</p>
      </div>

      <ScrollArea className="h-[60vh] pr-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : activity.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl">
            <p className="text-muted-foreground">Noch keine Aktivitäten protokolliert.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-border/50">
            {activity.map((a, i) => {
              const meta = ICON_MAP[a.action] || { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' };
              const Icon = meta.icon;
              const date = new Date(a.time);
              
              return (
                <div key={a.id} className="relative group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-background ${meta.color.replace('text-', 'bg-')} z-10 shadow-[0_0_8px_rgba(0,0,0,0.2)] group-hover:scale-125 transition-transform`} />
                  
                  <Card className="bg-card/40 border-border/50 hover:border-primary/20 transition-all hover:shadow-lg">
                    <CardContent className="p-4 flex gap-4 items-start">
                      <div className={`p-2.5 rounded-xl ${meta.bg} shrink-0`}>
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 border border-border/50">
                              <AvatarImage src={a.user_avatar} />
                              <AvatarFallback className="text-[8px]">{a.user_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-bold text-foreground">{a.user_name || 'System'}</span>
                            {a.user_role && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 opacity-60 uppercase tracking-tighter">
                                {a.user_role}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground/80">{a.label}</span>
                          {a.details && typeof a.details === 'string' && a.details !== '{}' && (
                            <span className="ml-1 text-xs opacity-60">
                              ({JSON.parse(a.details).brand} {JSON.parse(a.details).model || ''})
                            </span>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
