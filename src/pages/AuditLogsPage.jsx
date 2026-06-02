import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollText, Search, ChevronLeft, ChevronRight, Activity, Database } from 'lucide-react';

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

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  stv_admin: 'Stv. Admin',
  inhaber: 'Inhaber',
  mitarbeiter: 'Mitarbeiter',
  kunde: 'Kunde',
};

const ROLE_BADGE_COLORS = {
  superadmin: 'bg-red-500/10 text-red-500 border-red-500/20',
  stv_admin: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  inhaber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  mitarbeiter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  kunde: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

export default function AuditLogsPage() {
 const [logs, setLogs] = useState([]);
 const [total, setTotal] = useState(0);
 const [loading, setLoading] = useState(true);
 const [actions, setActions] = useState([]);
 const [filters, setFilters] = useState({ action:'all', search:'', role_type:'all', offset:0 });
 const LIMIT = 50;

 const fetchLogs = useCallback(async () => {
 setLoading(true);
 try {
 const p = new URLSearchParams({ limit:LIMIT, offset:filters.offset });
 if(filters.action!=='all') p.set('action', filters.action);
 if(filters.role_type!=='all') p.set('role_type', filters.role_type);
 if(filters.search) p.set('search', filters.search);
 const r = await fetch(`/api/logs?${p}`,{credentials:'include'});
 if(r.ok){ const d=await r.json(); setLogs(d.logs || []); setTotal(d.total || 0); }
 } catch(e){console.error(e);} finally{setLoading(false);}
 },[filters]);

 useEffect(()=>{fetchLogs();},[fetchLogs]);

 useEffect(()=>{
 fetch('/api/logs/actions',{credentials:'include'}).then(r=>r.json()).then(setActions).catch(()=>{});
 },[]);

 const pages = Math.ceil(total/LIMIT);
 const page = Math.floor(filters.offset/LIMIT)+1;

 const getReadableDetails = (l) => {
   let details = {};
   try {
     details = typeof l.details === 'string' ? JSON.parse(l.details) : (l.details || {});
   } catch (e) {
     details = {};
   }

   switch (l.action) {
     case 'login':
       return `Angemeldet als ${l.user_name || 'Benutzer'}`;
     case 'logout':
       return 'Abgemeldet';
     case 'dev_login':
       return 'Dev-Login durchgeführt';
     case 'listing_created':
       return `Inserat erstellt: ${details.brand || ''} ${details.model || ''} (${details.plate || 'kein Kennzeichen'})`;
     case 'listing_updated': {
       const fields = [];
       if (details.brand) fields.push(`Marke: ${details.brand}`);
       if (details.model) fields.push(`Modell: ${details.model}`);
       if (details.plate) fields.push(`Plate: ${details.plate}`);
       if (details.status) fields.push(`Status: ${details.status}`);
       if (details.custom_price) fields.push(`Preis: $${details.custom_price.toLocaleString()}`);
       return `Inserat bearbeitet (ID: #${l.entity_id})${fields.length > 0 ? ` - ${fields.join(', ')}` : ''}`;
     }
     case 'listing_sold':
       return `Fahrzeug verkauft an ${details.sold_to_name || 'Käufer'} für $${(details.sold_price || 0).toLocaleString()}`;
     case 'listing_deleted':
       return `Inserat gelöscht: ${details.brand || ''} ${details.model || ''} (ID: #${l.entity_id})`;
     case 'ticket_created':
       return `Fahrzeug-Anfrage erstellt für Inserat ID #${details.listing_id || ''} (Ticket ID: #${l.entity_id})`;
     case 'ticket_message':
       return `Nachricht in Ticket #${l.entity_id} gesendet`;
     case 'ticket_status_changed':
       return `Ticket #${l.entity_id} Status geändert: ${details.old_status || ''} → ${details.new_status || ''}`;
     case 'ticket_erp_status_changed':
       return `Ticket #${l.entity_id} ERP-Status geändert: ${details.old_status || ''} → ${details.new_status || ''}`;
     case 'ticket_contract_created':
       return `Kaufvertrag in Ticket #${l.entity_id} erstellt: $${(details.price || 0).toLocaleString()} (${details.payment_type || ''})`;
     case 'ticket_contract_cancelled':
       return `Kaufvertrag in Ticket #${l.entity_id} storniert`;
     case 'ticket_finalized':
       return `Verkauf in Ticket #${l.entity_id} abgeschlossen für $${(details.sold_price || 0).toLocaleString()} an ${details.sold_to || ''}`;
     case 'vault_payout':
       return `Auszahlung bestätigt für Tresor-Eintrag #${l.entity_id} (Betrag: $${(details.amount || 0).toLocaleString()} an Mitarbeiter ID #${details.owner_id || ''})`;
     case 'vault_payout_reverted':
       return `Auszahlung storniert für Tresor-Eintrag #${l.entity_id} (Betrag: $${(details.amount || 0).toLocaleString()} für Mitarbeiter ID #${details.owner_id || ''})`;
     case 'role_changed':
       return `Rolle geändert für Benutzer ID #${l.entity_id}: ${details.old_role || ''} → ${details.new_role || ''}`;
     case 'user_blocked':
       return `Benutzer ID #${l.entity_id} (${details.username || ''}) gesperrt`;
     case 'user_unblocked':
       return `Benutzer ID #${l.entity_id} entsperrt`;
     case 'catalog_imported':
       return `Fahrzeugkatalog importiert (${details.imported || 0} Fahrzeuge)`;
     case 'catalog_cleared':
       return `Fahrzeugkatalog gelöscht`;
     case 'vehicle_request_created':
       return `Suchanfrage erstellt für ${details.brand || ''} ${details.model || ''}`;
     case 'vehicle_request_matched':
       return `Suchanfrage #${l.entity_id} gematcht mit Inserat ID #${details.listing_id || ''}`;
     case 'vehicle_request_cancelled':
       return `Suchanfrage #${l.entity_id} storniert`;
     default:
       return l.details && l.details !== '{}' ? JSON.stringify(details) : '—';
   }
 };

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
 <div className="flex items-end justify-between gap-4 pb-2 border-b border-border/40">
 <div>
 <h1 className="text-3xl font-bold tracking-tight">Audit-Logs</h1>
 <p className="text-muted-foreground mt-1">Alle Systemaktionen protokolliert.</p>
 </div>
 <Badge variant="secondary" className="text-xs shrink-0">
 <Database className="h-3 w-3 mr-1" /> {total} Einträge
 </Badge>
 </div>

 {/* Filters in Bento Card */}
 <Card className="bg-card/40 border-border/50 overflow-hidden">
 <CardHeader className="pb-3">
 <div className="flex flex-wrap gap-3 items-center">
 <div className="relative flex-1 min-w-[200px] max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Suchen..." value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value,offset:0}))} className="pl-10" />
 </div>
 <Select value={filters.role_type} onValueChange={v=>setFilters(f=>({...f,role_type:v,offset:0}))}>
 <SelectTrigger className="w-[180px]"><SelectValue placeholder="Alle Benutzer" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Alle Benutzer</SelectItem>
 <SelectItem value="staff">Nur Mitarbeiter</SelectItem>
 <SelectItem value="customer">Nur Kunden</SelectItem>
 </SelectContent>
 </Select>
 <Select value={filters.action} onValueChange={v=>setFilters(f=>({...f,action:v,offset:0}))}>
 <SelectTrigger className="w-[200px]"><SelectValue placeholder="Alle Aktionen" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Alle Aktionen</SelectItem>
 {actions.map(a=><SelectItem key={a} value={a}>{ACTION_LABELS[a]||a}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 </CardHeader>

 <CardContent className="pt-0">
 {loading ? <div className="space-y-2">{Array.from({length:10}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div> : logs.length===0 ? (
 <div className="text-center py-12">
 <ScrollText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
 <p className="text-muted-foreground text-sm">Keine Logs gefunden.</p>
 </div>
 ) : (
 <div className="rounded-lg border border-border overflow-hidden">
 <Table>
 <TableHeader><TableRow><TableHead>Zeitpunkt</TableHead><TableHead>Benutzer</TableHead><TableHead>Aktion</TableHead><TableHead>Beschreibung</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
 <TableBody>
 {logs.map(l=>(
 <TableRow key={l.id}>
 <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</TableCell>
 <TableCell>
   <div className="flex items-center gap-2">
     <Avatar className="h-6 w-6"><AvatarImage src={l.user_avatar} /><AvatarFallback className="text-[10px]">{l.user_name?.charAt(0)||'?'}</AvatarFallback></Avatar>
     <div className="flex flex-col">
       <span className="text-sm font-medium leading-none">{l.user_name||'System'}</span>
       {l.user_role && (
         <span className={`text-[9px] px-1 py-0.5 rounded border mt-0.5 w-max font-semibold ${ROLE_BADGE_COLORS[l.user_role] || 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'}`}>
           {ROLE_LABELS[l.user_role] || l.user_role}
         </span>
       )}
     </div>
   </div>
 </TableCell>
 <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded bg-muted whitespace-nowrap ${ACTION_COLORS[l.action]||''}`}>{ACTION_LABELS[l.action]||l.action}</span></TableCell>
 <TableCell className="text-sm font-normal max-w-[350px] break-words">{getReadableDetails(l)}</TableCell>
 <TableCell className="text-xs font-mono text-muted-foreground">{l.ip_address||'—'}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Pagination */}
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
