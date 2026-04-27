import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Vault, DollarSign, CheckCircle2, Clock, Undo2 } from 'lucide-react';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tresor</h1>
        <p className="text-muted-foreground mt-1">Provisionen aus Zwischenverkäufen verwalten.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ausstehend</CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">${totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{pending.length} Einträge</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ausgezahlt</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${totalPaidOut.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{paidOut.length} Einträge</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalPending + totalPaidOut).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{entries.length} Einträge total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="cursor-pointer">
            Ausstehend <Badge variant="secondary" className="ml-2 text-xs">{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paid_out" className="cursor-pointer">
            Ausgezahlt <Badge variant="secondary" className="ml-2 text-xs">{paidOut.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <VaultTable
            entries={pending}
            loading={loading}
            showPayout={hasRole('inhaber')}
            onPayout={handlePayout}
            isAdmin={hasRole('inhaber')}
          />
        </TabsContent>
        <TabsContent value="paid_out">
          <VaultTable
            entries={paidOut}
            loading={loading}
            showRevert={hasRole('superadmin')}
            onRevert={handleRevert}
            isAdmin={hasRole('inhaber')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VaultTable({ entries, loading, showPayout, showRevert, onPayout, onRevert, isAdmin }) {
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Vault className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Keine Einträge vorhanden.</p>
      </Card>
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
