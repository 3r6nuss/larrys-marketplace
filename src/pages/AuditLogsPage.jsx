import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_LABELS = {
  login:'Anmeldung', logout:'Abmeldung', dev_login:'Dev-Login',
  listing_created:'Inserat erstellt', listing_updated:'Inserat bearbeitet',
  listing_deleted:'Inserat gelöscht', listing_sold:'Fahrzeug verkauft',
  ticket_created:'Ticket erstellt', ticket_message:'Nachricht gesendet',
  ticket_status_changed:'Ticket-Status geändert', ticket_cancelled:'Ticket storniert',
  vault_payout:'Tresor-Auszahlung', vault_payout_reverted:'Auszahlung rückgängig',
  role_changed:'Rolle geändert', user_blocked:'Benutzer gesperrt',
  user_unblocked:'Benutzer entsperrt', catalog_imported:'Katalog importiert',
};

const ACTION_COLORS = {
  login:'text-success', logout:'text-muted-foreground', dev_login:'text-warning',
  listing_created:'text-primary', listing_sold:'text-success',
  listing_deleted:'text-destructive', user_blocked:'text-destructive',
  role_changed:'text-warning', vault_payout:'text-success',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState([]);
  const [filters, setFilters] = useState({ action:'all', search:'', offset:0 });
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit:LIMIT, offset:filters.offset });
      if(filters.action!=='all') p.set('action', filters.action);
      if(filters.search) p.set('search', filters.search);
      const r = await fetch(`/api/logs?${p}`,{credentials:'include'});
      if(r.ok){ const d=await r.json(); setLogs(d.logs); setTotal(d.total); }
    } catch(e){console.error(e);} finally{setLoading(false);}
  },[filters]);

  useEffect(()=>{fetchLogs();},[fetchLogs]);

  useEffect(()=>{
    fetch('/api/logs/actions',{credentials:'include'}).then(r=>r.json()).then(setActions).catch(()=>{});
  },[]);

  const pages = Math.ceil(total/LIMIT);
  const page = Math.floor(filters.offset/LIMIT)+1;

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Audit-Logs</h1><p className="text-muted-foreground mt-1">Alle Systemaktionen protokolliert. {total} Einträge.</p></div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value,offset:0}))} className="pl-10" />
        </div>
        <Select value={filters.action} onValueChange={v=>setFilters(f=>({...f,action:v,offset:0}))}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktionen</SelectItem>
            {actions.map(a=><SelectItem key={a} value={a}>{ACTION_LABELS[a]||a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <div className="space-y-2">{Array.from({length:10}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div> : logs.length===0 ? (
        <div className="text-center py-12"><ScrollText className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Keine Logs gefunden.</p></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Zeitpunkt</TableHead><TableHead>Benutzer</TableHead><TableHead>Aktion</TableHead><TableHead>Entität</TableHead><TableHead>Details</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map(l=>(
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={l.user_avatar} /><AvatarFallback className="text-[10px]">{l.user_name?.charAt(0)||'?'}</AvatarFallback></Avatar><span className="text-sm">{l.user_name||'System'}</span></div></TableCell>
                  <TableCell><span className={`text-sm font-medium ${ACTION_COLORS[l.action]||''}`}>{ACTION_LABELS[l.action]||l.action}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.entity_type?`${l.entity_type} #${l.entity_id}`:'—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.details&&l.details!=='{}'?JSON.stringify(typeof l.details==='string'?JSON.parse(l.details):l.details).slice(0,100):'—'}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{l.ip_address||'—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages>1&&(
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setFilters(f=>({...f,offset:f.offset-LIMIT}))} className="cursor-pointer"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Seite {page} von {pages}</span>
          <Button variant="outline" size="sm" disabled={page>=pages} onClick={()=>setFilters(f=>({...f,offset:f.offset+LIMIT}))} className="cursor-pointer"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
