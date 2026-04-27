import { useState, useEffect, useCallback } from 'react';
import { useAuth, ROLE_HIERARCHY } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Search, MoreHorizontal, Shield, Ban, CheckCircle2 } from 'lucide-react';

const LABELS = { superadmin:'Superadmin', stv_admin:'Stv. Admin', inhaber:'Geschäftsinhaber', mitarbeiter:'Mitarbeiter', kunde:'Kunde' };
const COLORS = { superadmin:'bg-red-500/15 text-red-400 border-red-500/30', stv_admin:'bg-orange-500/15 text-orange-400 border-orange-500/30', inhaber:'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', mitarbeiter:'bg-primary/15 text-primary border-primary/30', kunde:'bg-muted text-muted-foreground border-border' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleDialog, setRoleDialog] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  const fetchUsers = useCallback(async () => {
    try { const r = await fetch('/api/users',{credentials:'include'}); if(r.ok) setUsers(await r.json()); } catch(e){console.error(e);} finally{setLoading(false);}
  },[]);
  useEffect(()=>{fetchUsers();},[fetchUsers]);

  const changeRole = async () => {
    if(!roleDialog||!selectedRole) return;
    try { const r = await fetch(`/api/users/${roleDialog.id}/role`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({role:selectedRole})}); if(r.ok){toast.success('Rolle geändert.');setRoleDialog(null);fetchUsers();}else{const d=await r.json();toast.error(d.error);} } catch(e){toast.error('Fehler.');}
  };

  const toggleBlock = async (id, blocked) => {
    if(!blocked && !confirm('Benutzer sperren?')) return;
    try { const r = await fetch(`/api/users/${id}/${blocked?'unblock':'block'}`,{method:'PUT',credentials:'include'}); if(r.ok){toast.success(blocked?'Entsperrt.':'Gesperrt.');fetchUsers();}else{const d=await r.json();toast.error(d.error);} } catch(e){toast.error('Fehler.');}
  };

  const filtered = users.filter(u => !search || u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase()));
  const assignable = Object.keys(ROLE_HIERARCHY).filter(r => ROLE_HIERARCHY[r] < ROLE_HIERARCHY[me.role]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Benutzerverwaltung</h1><p className="text-muted-foreground mt-1">{users.length} registrierte Benutzer</p></div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Suchen..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-10" /></div>

      {loading ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-14 w-full" />)}</div> : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Benutzer</TableHead><TableHead>Rolle</TableHead><TableHead>Status</TableHead><TableHead>Registriert</TableHead><TableHead>Letzter Login</TableHead><TableHead className="w-[60px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(u => {
                const isMe = u.id===me.id;
                const canManage = !isMe && ROLE_HIERARCHY[me.role]>ROLE_HIERARCHY[u.role];
                return (
                  <TableRow key={u.id} className={u.is_blocked?'opacity-50':''}>
                    <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback className="text-xs bg-primary/20 text-primary">{u.display_name?.charAt(0)?.toUpperCase()||'?'}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{u.display_name||u.username}{isMe&&<span className="text-xs text-muted-foreground ml-1">(du)</span>}</p><p className="text-xs text-muted-foreground">@{u.username}</p></div></div></TableCell>
                    <TableCell><Badge className={COLORS[u.role]}>{LABELS[u.role]||u.role}</Badge></TableCell>
                    <TableCell>{u.is_blocked?<Badge variant="destructive" className="text-xs">Gesperrt</Badge>:<Badge variant="outline" className="text-xs text-success border-success/30">Aktiv</Badge>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.created_at?new Date(u.created_at).toLocaleDateString('de-DE'):'—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.last_login?new Date(u.last_login).toLocaleDateString('de-DE'):'—'}</TableCell>
                    <TableCell>{canManage&&(<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>{setRoleDialog(u);setSelectedRole(u.role);}}><Shield className="mr-2 h-4 w-4" />Rolle ändern</DropdownMenuItem><DropdownMenuSeparator />{u.is_blocked?<DropdownMenuItem onClick={()=>toggleBlock(u.id,true)}><CheckCircle2 className="mr-2 h-4 w-4" />Entsperren</DropdownMenuItem>:<DropdownMenuItem onClick={()=>toggleBlock(u.id,false)} className="text-destructive"><Ban className="mr-2 h-4 w-4" />Sperren</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!roleDialog} onOpenChange={()=>setRoleDialog(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Rolle ändern</DialogTitle><DialogDescription>Neue Rolle für {roleDialog?.display_name}.</DialogDescription></DialogHeader>
          <Select value={selectedRole} onValueChange={setSelectedRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{assignable.map(r=><SelectItem key={r} value={r}>{LABELS[r]}</SelectItem>)}</SelectContent></Select>
          <DialogFooter><Button variant="outline" onClick={()=>setRoleDialog(null)} className="cursor-pointer">Abbrechen</Button><Button onClick={changeRole} className="cursor-pointer">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
