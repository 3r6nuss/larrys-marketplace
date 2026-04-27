import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calculator, Search, DollarSign, TrendingDown, 
  TrendingUp, ArrowRight, Plus, Trash2, ShoppingCart, 
  ChevronRight 
} from 'lucide-react';

export default function CalculatorPage() {
  const [catalog, setCatalog] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [search, setSearch] = useState('');
  
  // Selection list for group calculation
  const [selection, setSelection] = useState([]);
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/catalog', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/catalog/brands', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cat, br]) => {
      setCatalog(cat);
      setBrands(br);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = catalog.filter(v => {
    if (selectedBrand !== 'all' && v.brand !== selectedBrand) return false;
    if (search) {
      const q = search.toLowerCase();
      const terms = q.split(' ').filter(Boolean);
      const fullText = `${v.brand} ${v.model}`.toLowerCase();
      return terms.every(term => fullText.includes(term));
    }
    return true;
  });

  const addToSelection = (vehicle) => {
    setSelection(prev => [...prev, { ...vehicle, tempId: Math.random() }]);
  };

  const removeFromSelection = (tempId) => {
    setSelection(prev => prev.filter(v => v.tempId !== tempId));
  };

  const clearSelection = () => setSelection([]);

  const totals = useMemo(() => {
    return selection.reduce((acc, v) => ({
      min: acc.min + (v.min_sell_price || 0),
      max: acc.max + (v.max_sell_price || 0),
      dealer: acc.dealer + (v.dealer_price || 0),
      coins: acc.coins + (v.coin_price || 0),
    }), { min: 0, max: 0, dealer: 0, coins: 0 });
  }, [selection]);

  const calcDiscounted = (base, pct) => Math.round(base * (1 - pct / 100));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" /> Ankaufrechner
          </h1>
          <p className="text-muted-foreground mt-1">
            Stelle Gruppenangebote zusammen und berechne Paketpreise.
          </p>
        </div>
        {selection.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearSelection} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" /> Liste leeren
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Vehicle Selection (Catalog) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-4 w-4" /> Katalog
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Marken</SelectItem>
                    {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 border border-border rounded-lg overflow-y-auto min-h-[300px]">
                {loading ? (
                  <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">Keine Treffer.</p>
                  </div>
                ) : (
                  filtered.map(v => (
                    <button
                      key={v.id}
                      onClick={() => addToSelection(v)}
                      className="w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-primary/5 group transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-sm">{v.brand} {v.model}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          ${v.min_sell_price?.toLocaleString()} – ${v.max_sell_price?.toLocaleString()}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Selected Vehicles & Totals */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selection List */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Auswahl
                  </div>
                  <Badge variant="secondary">{selection.length} Fahrzeuge</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                {selection.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p className="text-sm">Wähle Fahrzeuge aus dem Katalog aus.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selection.map(v => (
                      <div key={v.tempId} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border group">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{v.brand} {v.model}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            <span>Min: ${v.min_sell_price?.toLocaleString()}</span>
                            <span>•</span>
                            <span>Max: ${v.max_sell_price?.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" size="icon" 
                          className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromSelection(v.tempId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              {selection.length > 0 && (
                <CardFooter className="border-t border-border pt-3 bg-muted/10">
                  <div className="w-full flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Händler-EK (Summe):</span>
                    <span className="font-bold text-warning">${totals.dealer.toLocaleString()}</span>
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* Calculations & Discount */}
            <div className="space-y-6">
              <Card className="glow-primary/5 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Gesamtpreise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-success mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Mindestpreis (Summe)</span>
                      </div>
                      <p className="text-3xl font-black">${totals.min.toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Maximalpreis (Summe)</span>
                      </div>
                      <p className="text-3xl font-black">${totals.max.toLocaleString()}</p>
                    </div>
                  </div>

                  <Separator className="bg-primary/20" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider">Gruppen-Rabatt</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="0" max="100"
                          value={discount} onChange={e => setDiscount(Number(e.target.value))}
                          className="w-16 h-8 text-center text-xs"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                    </div>
                    
                    {discount > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-success/10 border border-success/30">
                          <span className="text-xs text-success font-semibold">Min. mit {discount}%:</span>
                          <span className="font-bold text-sm text-success">${calcDiscounted(totals.min, discount).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/30">
                          <span className="text-xs text-primary font-semibold">Max. mit {discount}%:</span>
                          <span className="font-bold text-sm text-primary">${calcDiscounted(totals.max, discount).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {selection.length > 0 && (
                <div className="p-4 rounded-xl border border-dashed border-border bg-card">
                  <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-3">Zusammenfassung</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fahrzeuge:</span>
                      <span className="font-medium">{selection.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Händlerpreis:</span>
                      <span className="font-medium">${totals.dealer.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Coins:</span>
                      <span className="font-medium">🪙 {totals.coins.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

