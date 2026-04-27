import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, Trash2, RefreshCw, CheckCircle2,
  AlertTriangle, Database, Search, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const CSV_TEMPLATE = `Marke;Modell;Coinpreis;Min-$-Preis;Max-$-Preis;Zwischenhändlerpreis;Min-Verkaufspreis;Max-Verkaufspreis
Pegassi;Toros CTX;450;850000;1200000;600000;900000;1150000
Obey;Tailgater S;380;620000;950000;500000;700000;900000`;

export default function CatalogAdminPage() {
  const { hasRole } = useAuth();
  const [csv, setCsv] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);
  const fileRef = useRef(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, statsRes] = await Promise.all([
        fetch('/api/catalog', { credentials: 'include' }),
        fetch('/api/catalog/stats', { credentials: 'include' }),
      ]);
      if (catRes.ok) setCatalog(await catRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const handleImport = async () => {
    if (!csv.trim()) { toast.error('Keine CSV-Daten eingegeben.'); return; }
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ csv_data: csv, replace_existing: replaceExisting }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, imported: data.imported, errors: data.errors || [] });
        toast.success(`${data.imported} Fahrzeuge importiert!`);
        setCsv('');
        fetchCatalog();
      } else {
        setResult({ success: false, error: data.error });
        toast.error(data.error);
      }
    } catch (err) {
      toast.error('Netzwerkfehler.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsv(ev.target.result);
    reader.readAsText(file, 'UTF-8');
    toast.success(`Datei geladen: ${file.name}`);
  };

  const handleClear = async () => {
    if (!confirm('Gesamten Katalog löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/catalog', { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Katalog geleert.'); fetchCatalog(); }
    } catch { toast.error('Fehler.'); }
    finally { setClearing(false); }
  };

  const filtered = catalog.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.brand?.toLowerCase().includes(q) || v.model?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" /> Katalog-Verwaltung
          </h1>
          <p className="text-muted-foreground mt-1">Fahrzeugkatalog importieren und verwalten.</p>
        </div>
        <Button variant="outline" onClick={fetchCatalog} className="gap-2 cursor-pointer">
          <RefreshCw className="h-4 w-4" /> Aktualisieren
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-2xl font-bold">{loading ? '—' : stats?.total ?? 0}</p>
          <p className="text-sm text-muted-foreground">Fahrzeuge gesamt</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-2xl font-bold">{loading ? '—' : stats?.brands ?? 0}</p>
          <p className="text-sm text-muted-foreground">Marken</p>
        </CardContent></Card>
        {hasRole('superadmin') && (
          <Card className="border-destructive/30"><CardContent className="pt-4">
            <Button variant="destructive" size="sm" onClick={handleClear} disabled={clearing} className="gap-2 cursor-pointer w-full">
              <Trash2 className="h-4 w-4" /> {clearing ? 'Wird geleert…' : 'Katalog leeren'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Alle Einträge löschen</p>
          </CardContent></Card>
        )}
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import" className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" /> CSV Import
          </TabsTrigger>
          <TabsTrigger value="catalog" className="cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Katalog ({catalog.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Import Tab ── */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CSV-Datei importieren</CardTitle>
              <CardDescription>
                Format: <code className="bg-muted px-1 rounded text-xs">Marke;Modell;Coinpreis;Min-$;Max-$;Zwischenhändler;Min-Verkauf;Max-Verkauf</code>
                <br />Trennzeichen: Semikolon (<code className="bg-muted px-1 rounded text-xs">;</code>) oder Komma (<code className="bg-muted px-1 rounded text-xs">,</code>)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File or paste */}
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 cursor-pointer">
                  <Upload className="h-4 w-4" /> CSV-Datei wählen
                </Button>
                <Button variant="outline" onClick={() => setCsv(CSV_TEMPLATE)} className="gap-2 cursor-pointer">
                  Vorlage einfügen
                </Button>
                {csv && (
                  <Button variant="ghost" size="icon" onClick={() => { setCsv(''); setResult(null); }} className="cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Textarea
                value={csv}
                onChange={e => setCsv(e.target.value)}
                placeholder={`Marke;Modell;Coinpreis;Min-$-Preis;Max-$-Preis;Zwischenhändlerpreis;Min-Verkaufspreis;Max-Verkaufspreis\nPegassi;Toros CTX;450;850000;1200000;600000;900000;1150000`}
                rows={10}
                className="font-mono text-xs"
              />

              {csv && (
                <p className="text-xs text-muted-foreground">
                  {csv.split('\n').filter(l => l.trim()).length} Zeilen erkannt
                  {csv.split('\n')[0]?.toLowerCase().includes('marke') ? ' (inkl. Kopfzeile)' : ''}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Switch id="replace" checked={replaceExisting} onCheckedChange={setReplaceExisting} />
                <Label htmlFor="replace" className="cursor-pointer">
                  Bestehenden Katalog ersetzen (alle alten Einträge löschen)
                </Label>
              </div>

              {result && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${result.success ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  {result.success
                    ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                  <div>
                    {result.success
                      ? <p className="font-medium text-success">{result.imported} Fahrzeuge erfolgreich importiert.</p>
                      : <p className="font-medium text-destructive">{result.error}</p>}
                    {result.errors?.length > 0 && (
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={handleImport} disabled={!csv.trim() || importing} className="gap-2 cursor-pointer">
                {importing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Wird importiert…</> : <><Upload className="h-4 w-4" /> Importieren</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Catalog Tab ── */}
        <TabsContent value="catalog">
          <div className="mb-3 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <Database className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{catalog.length === 0 ? 'Noch keine Fahrzeuge im Katalog.' : 'Keine Ergebnisse.'}</p>
            </Card>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marke</TableHead>
                    <TableHead>Modell</TableHead>
                    <TableHead className="text-right">Coin</TableHead>
                    <TableHead className="text-right">Min $</TableHead>
                    <TableHead className="text-right">Max $</TableHead>
                    <TableHead className="text-right">Zwischenh.</TableHead>
                    <TableHead className="text-right">Min Verk.</TableHead>
                    <TableHead className="text-right">Max Verk.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.brand}</TableCell>
                      <TableCell>{v.model}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{v.coin_price?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">${v.min_dollar_price?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">${v.max_dollar_price?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-warning">${v.dealer_price?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-success">${v.min_sell_price?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-primary">${v.max_sell_price?.toLocaleString() || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
