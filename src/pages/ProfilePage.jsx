import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Shield, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { de } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const ROLE_LABELS = {
 superadmin: 'Superadmin',
 stv_admin: 'Stv. Admin',
 inhaber: 'Geschäftsinhaber',
 mitarbeiter: 'Mitarbeiter',
 kunde: 'Kunde',
};

const ROLE_COLORS = {
 superadmin: 'bg-red-500/15 text-red-400 border-red-500/30',
 stv_admin: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
 inhaber: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
 mitarbeiter: 'bg-primary/15 text-primary border-primary/30',
 kunde: 'bg-muted text-muted-foreground border-border',
};

export default function ProfilePage() {
 const { user, logout, refetchUser } = useAuth();
 const [discordDms, setDiscordDms] = useState(user?.discord_notifications === 1);

 useEffect(() => {
   if (user) {
     setDiscordDms(user.discord_notifications === 1);
   }
 }, [user]);

 const toggleDiscordDms = async (checked) => {
   setDiscordDms(checked);
   try {
     const res = await fetch(`/api/users/${user.id}/settings/discord-dms`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ enabled: checked ? 1 : 0 })
     });
     if (res.ok) {
       toast.success(checked ? 'Discord PNs aktiviert' : 'Discord PNs deaktiviert');
       refetchUser();
     } else {
       toast.error('Fehler beim Speichern');
       setDiscordDms(!checked);
     }
   } catch (err) {
     toast.error('Netzwerkfehler');
     setDiscordDms(!checked);
   }
 };

 if (!user) return null;

 const formatDate = (dateStr) => {
 if (!dateStr) return '—';
 try {
 return format(new Date(dateStr), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
 } catch {
 return dateStr;
 }
 };

 return (
 <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
 <div>
 <h1 className="text-3xl font-bold tracking-tight">Mein Profil</h1>
 <p className="text-muted-foreground mt-1">Deine persönlichen Informationen und Einstellungen.</p>
 </div>

 {/* Bento Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

 {/* Profile Card — 2/3 */}
 <Card className="col-span-1 md:col-span-2 relative overflow-hidden group border-primary/20 bg-card/60 ">
 {/* Gradient banner */}
 <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
 <CardContent className="relative pt-0 -mt-8 px-6 pb-6">
 <Avatar className="h-16 w-16 border-4 border-card">
 <AvatarImage src={user.avatar_url} alt={user.display_name} />
 <AvatarFallback className="text-xl bg-primary/20 text-primary">
 {user.display_name?.charAt(0)?.toUpperCase() || '?'}
 </AvatarFallback>
 </Avatar>

 <div className="mt-3 flex items-start justify-between">
 <div>
 <h2 className="text-xl font-bold">{user.display_name || user.username}</h2>
 <p className="text-muted-foreground">@{user.username}</p>
 </div>
 <Badge className={ROLE_COLORS[user.role]}>
 <Shield className="h-3 w-3 mr-1" />
 {ROLE_LABELS[user.role] || user.role}
 </Badge>
 </div>
 </CardContent>
 </Card>

 {/* Quick Info — 1/3 */}
 <div className="col-span-1 flex flex-col gap-4">
 <Card className="flex-1 bg-card/40 border-border/50 hover:border-primary/30 transition-all group">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary/10 rounded-md group-hover:scale-110 transition-transform">
 <Calendar className="h-4 w-4 text-primary" />
 </div>
 <div>
 <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Registriert seit</p>
 <p className="text-sm font-semibold mt-0.5">{formatDate(user.created_at)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="flex-1 bg-card/40 border-border/50 hover:border-chart-5/30 transition-all group">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-chart-5/10 rounded-md group-hover:scale-110 transition-transform">
 <Clock className="h-4 w-4 text-chart-5" />
 </div>
 <div>
 <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Letzter Login</p>
 <p className="text-sm font-semibold mt-0.5">{formatDate(user.last_login)}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Settings */}
 <Card className="col-span-1 md:col-span-3 bg-card/40 border-border/50 hover:border-primary/30 transition-all">
 <CardHeader>
 <CardTitle className="text-lg">Einstellungen</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5">
 <p className="font-medium text-sm">Discord Benachrichtigungen (PNs)</p>
 <p className="text-xs text-muted-foreground">
 Erhalte Direktnachrichten von unserem Bot bei Ticket-Updates. (Bot muss auf dem gleichen Server sein)
 </p>
 </div>
 <Switch 
 checked={discordDms} 
 onCheckedChange={toggleDiscordDms} 
 />
 </div>
 </CardContent>
 </Card>

 {/* Logout */}
 <Card className="col-span-1 md:col-span-3 bg-card/40 border-destructive/20 hover:border-destructive/40 transition-all group cursor-pointer"
 onClick={logout}>
 <CardContent className="pt-5 pb-5 px-5 flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-destructive">Abmelden</p>
 <p className="text-xs text-muted-foreground mt-0.5">Session beenden</p>
 </div>
 <div className="p-2.5 bg-destructive/10 rounded-lg group-hover:scale-110 transition-transform">
 <LogOut className="h-5 w-5 text-destructive" />
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 );
}
