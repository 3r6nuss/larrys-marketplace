import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Vault, DollarSign, CheckCircle2, Clock, Undo2, TrendingUp, ArrowRight } from 'lucide-react';

export default function VaultPage() {
 const { user, hasRole } = useAuth();
 const [entries, setEntries] = useState([]);
 const [loading, setLoading] = useState(true);
 const [tab, setTab] = useState('pending');

 const fetchEntries = useCallback(async () => {
 try {
 const res = await fetch('/api/vault', { credentials: 'include' });
 if (res.ok) setEntries(await res.json());
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => { fetchEntries(); }, [fetchEntries]);

 const handlePayout = async (id) => {
 if (!confirm('Auszahlung bestätigen?')) return;
 try {
 const res = await fetch(`/api/vault/${id}/payout`, {
 method: 'PUT', credentials: 'include',
 });
 if (res.ok) {
 toast.success('Auszahlung bestätigt!');
 fetchEntries();
 } else {
 const data = await res.json();
 toast.error(data.error);
 }
 } catch (err) {
 toast.error('Fehler.');
 }
 };

 const handleRevert = async (id) => {
 if (!confirm('Auszahlung rückgängig machen?')) return;
 try {
 const res = await fetch(`/api/vault/${id}/revert`, {
 method: 'PUT', credentials: 'include',
 });
 if (res.ok) {
 toast.success('Rückgängig gemacht.');
 fetchEntries();
 }
 } catch (err) {
 toast.error('Fehler.');
 }
 };

 const pending = entries.filter(e => e.status === 'pending');
 const paidOut = entries.filter(e => e.status === 'paid_out');

 const totalPending = pending.reduce((s, e) => s + (e.amount || 0), 0);
 const totalPaidOut = paidOut.reduce((s, e) => s + (e.amount || 0), 0);

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
 <div className="pb-2 border-b border-border/40">
 <h1 className="text-3xl font-bold tracking-tight">Tresor</h1>
 <p className="text-muted-foreground mt-1">Provisionen aus Zwischenverkäufen verwalten.</p>
 </div>

 {/* Bento Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="relative overflow-hidden group bg-card/60 border-warning/20 hover:border-warning/40 hover:shadow-lg hover:shadow-warning/5 transition-all duration-150">
 <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
 <Clock className="h-24 w-24" />
 </div>
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-warning transition-colors">Ausstehend</CardTitle>
 <div className="p-2 bg-warning/10 rounded-md">
 <Clock className="h-4 w-4 text-warning" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-3xl font-black text-warning">
 {loading ? <Skeleton className="h-9 w-28" /> : `$ ${totalPending.toLocaleString()}`}
 </div>
 <p className="text-xs text-muted-foreground mt-1 font-medium">{pending.length} Einträge</p>
 </CardContent>
 </Card>

 <Card className="relative overflow-hidden group bg-card/60 border-success/20 hover:border-success/40 hover:shadow-lg hover:shadow-success/5 transition-all duration-150">
 <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
 <CheckCircle2 className="h-24 w-24" />
 </div>
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-success transition-colors">Ausgezahlt</CardTitle>
 <div className="p-2 bg-success/10 rounded-md">
 <CheckCircle2 className="h-4 w-4 text-success" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-3xl font-black text-success">
 {loading ? <Skeleton className="h-9 w-28" /> : `$ ${totalPaidOut.toLocaleString()}`}
 </div>
 <p className="text-xs text-muted-foreground mt-1 font-medium">{paidOut.length} Einträge</p>
 </CardContent>
 </Card>

 <Card className="relative overflow-hidden group bg-card/60 border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-150">
 <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
 <TrendingUp className="h-24 w-24" />
 </div>
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Gesamt</CardTitle>
 <div className="p-2 bg-primary/10 rounded-md">
 <DollarSign className="h-4 w-4 text-primary" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-3xl font-black">
 {loading ? <Skeleton className="h-9 w-28" /> : `$ ${(totalPending + totalPaidOut).toLocaleString()}`}
 </div>
 <p className="text-xs text-muted-foreground mt-1 font-medium">{entries.length} Einträge total</p>
 </CardContent>
 </Card>
 </div>

 {/* Table in Card */}
 <Card className="bg-card/40 border-border/50 overflow-hidden">
 <Tabs value={tab} onValueChange={setTab}>
 <CardHeader className="pb-0">
 <TabsList>
 <TabsTrigger value="pending" className="cursor-pointer">
 Ausstehend <Badge variant="secondary" className="ml-2 text-xs">{pending.length}</Badge>
 </TabsTrigger>
 <TabsTrigger value="paid_out" className="cursor-pointer">
 Ausgezahlt <Badge variant="secondary" className="ml-2 text-xs">{paidOut.length}</Badge>
 </TabsTrigger>
 </TabsList>
 </CardHeader>

 <CardContent className="pt-4">
 <TabsContent value="pending" className="mt-0">
 <VaultTable
 entries={pending}
 loading={loading}
 showPayout={hasRole('inhaber')}
 onPayout={handlePayout}
 isAdmin={hasRole('inhaber')}
 />
 </TabsContent>
 <TabsContent value="paid_out" className="mt-0">
 <VaultTable
 entries={paidOut}
 loading={loading}
 showRevert={hasRole('superadmin')}
 onRevert={handleRevert}
 isAdmin={hasRole('inhaber')}
 />
 </TabsContent>
 </CardContent>
 </Tabs>
 </Card>
 </div>
 );
}

function VaultTable({ entries, loading, showPayout, showRevert, onPayout, onRevert, isAdmin }) {
 if (loading) {
 return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
 }

 if (entries.length === 0) {
 return (
 <div className="py-12 text-center">
 <Vault className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
 <p className="text-muted-foreground text-sm">Keine Einträge vorhanden.</p>
 </div>
 );
 }

 return (
 <div className="rounded-lg border border-border overflow-hidden">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Fahrzeug</TableHead>
 <TableHead>Eigentümer</TableHead>
 <TableHead>Verkauft von</TableHead>
 <TableHead className="text-right">Betrag</TableHead>
 <TableHead>Datum</TableHead>
 {(showPayout || showRevert) && <TableHead className="w-[120px]"></TableHead>}
 </TableRow>
 </TableHeader>
 <TableBody>
 {entries.map(e => (
 <TableRow key={e.id}>
 <TableCell className="font-medium">
 {e.brand ? `${e.brand} ${e.model}` : `Listing #${e.listing_id}`}
 {e.plate && <span className="text-xs text-muted-foreground ml-1 font-mono">({e.plate})</span>}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <Avatar className="h-6 w-6">
 <AvatarImage src={e.owner_avatar} />
 <AvatarFallback className="text-[10px]">{e.owner_name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <span className="text-sm">{e.owner_name || '—'}</span>
 </div>
 </TableCell>
 <TableCell>
 <span className="text-sm">{e.sold_by_name || '—'}</span>
 </TableCell>
 <TableCell className="text-right font-semibold">${e.amount?.toLocaleString()}</TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {new Date(e.created_at).toLocaleDateString('de-DE')}
 </TableCell>
 {showPayout && (
 <TableCell>
 <Button size="sm" className="gap-1 h-7 text-xs cursor-pointer" onClick={() => onPayout(e.id)}>
 <CheckCircle2 className="h-3 w-3" /> Auszahlen
 </Button>
 </TableCell>
 )}
 {showRevert && (
 <TableCell>
 <Button size="sm" variant="outline" className="gap-1 h-7 text-xs cursor-pointer" onClick={() => onRevert(e.id)}>
 <Undo2 className="h-3 w-3" /> Rückgängig
 </Button>
 </TableCell>
 )}
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 );
}
