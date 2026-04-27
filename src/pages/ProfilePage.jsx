import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LogOut, Shield, Calendar, Clock, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
  const { user, logout } = useAuth();
  const [hotkey, setHotkey] = useState(() => {
    return localStorage.getItem(`nav_hotkey_${user?.id}`) || 'Alt';
  });

  if (!user) return null;

  const handleHotkeyChange = (val) => {
    setHotkey(val);
    localStorage.setItem(`nav_hotkey_${user.id}`, val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mein Profil</h1>
        <p className="text-muted-foreground mt-1">Deine persönlichen Informationen.</p>
      </div>

      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />

        <CardContent className="relative pt-0 -mt-10 px-6 pb-6">
          <Avatar className="h-20 w-20 border-4 border-card">
            <AvatarImage src={user.avatar_url} alt={user.display_name} />
            <AvatarFallback className="text-2xl bg-primary/20 text-primary">
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

          <Separator className="my-5" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Registriert seit</p>
                <p className="text-sm font-medium">{formatDate(user.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Letzter Login</p>
                <p className="text-sm font-medium">{formatDate(user.last_login)}</p>
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" /> Einstellungen
            </h3>
            <div className="flex flex-col gap-2 max-w-sm">
              <Label>Taste für das Navigations-Rad</Label>
              <Select value={hotkey} onValueChange={handleHotkeyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alt">Alt</SelectItem>
                  <SelectItem value="Shift">Shift</SelectItem>
                  <SelectItem value="Control">Strg (Control)</SelectItem>
                  <SelectItem value="Tab">Tab</SelectItem>
                  <SelectItem value="q">Q</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Drücke diese Taste überall, um das Schnellmenü zu öffnen.
              </p>
            </div>
          </div>

          <Separator className="my-5" />

          <Button variant="destructive" onClick={logout} className="gap-2 cursor-pointer">
            <LogOut className="h-4 w-4" />
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
