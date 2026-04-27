import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, Car, ImagePlus, X, ClipboardPaste } from 'lucide-react';

const CATEGORIES = ['Sport', 'SUV', 'Muscle', 'Limousine', 'Kompakt', 'Coupé', 'Offroad', 'Van', 'Sonstige'];
const STATUS_MAP = {
  available: { label: 'Verfügbar', class: 'bg-success/15 text-success border-success/30' },
  reserved: { label: 'Reserviert', class: 'bg-warning/15 text-warning border-warning/30' },
  sold: { label: 'Verkauft', class: 'bg-muted text-muted-foreground border-border' },
};

export default function ListingsPage() {
  const { user, hasRole } = useAuth();
  const [listings, setListings] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const dropZoneRef = useRef(null);

  // Form state
  const [form, setForm] = useState({
    brand: '', model: '', plate: '', category: '', custom_price: '', discount_pct: '', notes: '',
  });

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog', { credentials: 'include' });
      if (res.ok) setCatalog(await res.json());
    } catch (err) {
      console.error('Fetch catalog error:', err);
    }
  }, []);

  const fetchListings = useCallback(async () => {
    try {
      const params = hasRole('inhaber') ? '' : `?seller_id=${user.id}`;
      const res = await fetch(`/api/listings${params}`, { credentials: 'include' });
      if (res.ok) setListings(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, hasRole]);

  useEffect(() => { 
    fetchListings(); 
    fetchCatalog();
  }, [fetchListings, fetchCatalog]);

  // ── Clipboard Paste (Strg+V) ──
  useEffect(() => {
    const handlePaste = (e) => {
      if (!dialogOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => {
            setImagePreview(ev.target.result);
            setImageBase64(ev.target.result);
          };
          reader.readAsDataURL(file);
          toast.success('Bild eingefügt!');
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [dialogOpen]);

  const openCreate = () => {
    setEditingListing(null);
    setForm({ brand: '', model: '', plate: '', category: '', custom_price: '', discount_pct: '', notes: '' });
    setImagePreview(null);
    setImageBase64(null);
    setDialogOpen(true);
  };

  const openEdit = (listing) => {
    setEditingListing(listing);
    setForm({
      brand: listing.brand || '',
      model: listing.model || '',
      plate: listing.plate || '',
      category: listing.category || '',
      custom_price: listing.custom_price?.toString() || '',
      discount_pct: listing.discount_pct?.toString() || '',
      notes: listing.notes || '',
    });
    setImagePreview(listing.image_path || null);
    setImageBase64(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.brand || !form.model) {
      toast.error('Marke und Modell sind Pflichtfelder.');
      return;
    }

    const body = { ...form };
    if (imageBase64) body.image_base64 = imageBase64;

    try {
      const url = editingListing ? `/api/listings/${editingListing.id}` : '/api/listings';
      const method = editingListing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingListing ? 'Inserat aktualisiert!' : 'Inserat erstellt!');
        setDialogOpen(false);
        fetchListings();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Fehler beim Speichern.');
      }
    } catch (err) {
      toast.error('Netzwerkfehler.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Inserat wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/listings/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Inserat gelöscht.');
        fetchListings();
      }
    } catch (err) {
      toast.error('Fehler beim Löschen.');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success('Status aktualisiert.');
        fetchListings();
      }
    } catch (err) {
      toast.error('Fehler.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meine Inserate</h1>
          <p className="text-muted-foreground mt-1">Verwalte deine Fahrzeug-Inserate.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" /> Neues Inserat
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : listings.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Noch keine Inserate</h3>
          <p className="text-muted-foreground mb-4">Erstelle dein erstes Fahrzeug-Inserat.</p>
          <Button onClick={openCreate} className="gap-2 cursor-pointer">
            <Plus className="h-4 w-4" /> Inserat erstellen
          </Button>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Bild</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Kennzeichen</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Preis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aufrufe</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map(l => {
                const st = STATUS_MAP[l.status] || STATUS_MAP.available;
                return (
                  <TableRow key={l.id} className="group">
                    <TableCell>
                      {l.image_path ? (
                        <img src={l.image_path} alt="" className="h-10 w-14 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
                          <Car className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{l.brand} {l.model}</TableCell>
                    <TableCell className="font-mono text-sm">{l.plate || '—'}</TableCell>
                    <TableCell>
                      {l.category && <Badge variant="outline" className="text-xs">{l.category}</Badge>}
                    </TableCell>
                    <TableCell>
                      {l.custom_price ? (
                        <span className="font-semibold">${l.custom_price.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={st.class}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.view_count || 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(l)}>
                            <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                          </DropdownMenuItem>
                          {l.status === 'available' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(l.id, 'reserved')}>
                              Reservieren
                            </DropdownMenuItem>
                          )}
                          {l.status === 'reserved' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(l.id, 'available')}>
                              Wieder freigeben
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDelete(l.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingListing ? 'Inserat bearbeiten' : 'Neues Inserat'}</DialogTitle>
            <DialogDescription>
              {editingListing ? 'Bearbeite die Details deines Inserats.' : 'Erstelle ein neues Fahrzeug-Inserat. Füge ein Bild per Strg+V ein.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Image Paste Zone */}
            <div
              ref={dropZoneRef}
              className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                imagePreview ? 'border-primary/50' : 'border-border hover:border-primary/30'
              }`}
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 cursor-pointer"
                    onClick={() => { setImagePreview(null); setImageBase64(null); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="py-6 space-y-2">
                  <ClipboardPaste className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Screenshot machen & <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Strg+V</kbd> drücken
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marke *</Label>
                <Input 
                  id="brand" 
                  list="brand-options"
                  value={form.brand} 
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} 
                  placeholder="z.B. Pegassi" 
                />
                <datalist id="brand-options">
                  {[...new Set(catalog.map(v => v.brand))].sort().map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modell *</Label>
                <Input 
                  id="model" 
                  list="model-options"
                  value={form.model} 
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))} 
                  placeholder="z.B. Toros CTX" 
                />
                <datalist id="model-options">
                  {catalog
                    .filter(v => !form.brand || v.brand.toLowerCase() === form.brand.toLowerCase())
                    .map(v => (
                      <option key={`${v.brand}-${v.model}`} value={v.model} />
                    ))
                  }
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plate">Kennzeichen</Label>
                <Input id="plate" value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="z.B. GEB 385" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Kategorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger id="category"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom_price">Preis ($)</Label>
                <Input id="custom_price" type="number" value={form.custom_price} onChange={e => setForm(f => ({ ...f, custom_price: e.target.value }))} placeholder="Manuell" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount_pct">Rabatt (%)</Label>
                <Input id="discount_pct" type="number" min="0" max="100" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Interne Notizen</Label>
              <Textarea id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Nur für Mitarbeiter sichtbar..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Abbrechen</Button>
            <Button onClick={handleSubmit} className="cursor-pointer">{editingListing ? 'Speichern' : 'Erstellen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
