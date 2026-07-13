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
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, Car, ImagePlus, X, ClipboardPaste, Star, GripVertical, Crown, DollarSign } from 'lucide-react';
import { getThumbnailImagePath } from '@/lib/utils';

const CATEGORIES = [
 'Sport', 'Super', 'Sports Classic', 'SUV', 'Muscle', 'Limousine',
 'Kompakt', 'Coupé', 'Offroad', 'Van', 'Sonstige',
];
const STATUS_MAP = {
 available: { label: 'Verfügbar', class: 'bg-success/15 text-success border-success/30' },
 reserved: { label: 'Reserviert', class: 'bg-warning/15 text-warning border-warning/30' },
 sold: { label: 'Verkauft', class: 'bg-muted text-muted-foreground border-border' },
};

export default function ListingsPage() {
 const { user, hasRole } = useAuth();
 const [listings, setListings] = useState([]);
 const [catalog, setCatalog] = useState([]);
 const [vehicleOptions, setVehicleOptions] = useState([]);
 const [loading, setLoading] = useState(true);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [editingListing, setEditingListing] = useState(null);
 const [sellListing, setSellListing] = useState(null); // Which listing is currently being sold
 const [sellForm, setSellForm] = useState({ sold_to_name: '', sold_price: '' });
 const [sellDialogOpen, setSellDialogOpen] = useState(false);
 const [images, setImages] = useState([]); // { id?, preview, base64?, isExisting?, isCover }
 const [dragIdx, setDragIdx] = useState(null);
 const [videoStream, setVideoStream] = useState(null);
 const videoRef = useRef(null);
 const dropZoneRef = useRef(null);
 const MAX_IMAGES = 8;
 
 const [staffList, setStaffList] = useState([]);
 const [selectedSellerId, setSelectedSellerId] = useState('me');

 // Form state
 const [form, setForm] = useState({
 brand: '', model: '', plate: '', category: '', custom_price: '', discount_pct: '', notes: '',
 });

 const fetchCatalog = useCallback(async () => {
 try {
 // Fetch full catalog (with prices, for price validation) and vehicle list (for dropdowns)
 const [catRes, vehRes] = await Promise.all([
 fetch('/api/catalog', { credentials: 'include' }),
 fetch('/api/catalog/vehicles'),
 ]);
 if (catRes.ok) setCatalog(await catRes.json());
 if (vehRes.ok) setVehicleOptions(await vehRes.json());
 } catch (err) {
 console.error('Fetch catalog error:', err);
 }
 }, []);

 const fetchStaff = useCallback(async () => {
   if (hasRole('mitarbeiter')) {
     try {
       const res = await fetch('/api/users/staff', { credentials: 'include' });
       if (res.ok) setStaffList(await res.json());
     } catch (err) {
       console.error('Fetch staff error:', err);
     }
   }
 }, [hasRole]);

 const fetchListings = useCallback(async () => {
 try {
 const params = selectedSellerId === 'me' ? `?seller_id=${user?.id}` : 
                selectedSellerId !== 'all' ? `?seller_id=${selectedSellerId}` : '';
 const res = await fetch(`/api/listings${params}`, { credentials: 'include' });
 if (res.ok) setListings(await res.json());
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, [selectedSellerId]);

 useEffect(() => { 
 fetchListings(); 
 fetchCatalog();
 fetchStaff();
 }, [fetchListings, fetchCatalog, fetchStaff]);

  // ── Clipboard Paste (Strg+V) — adds to multi-image array ──
  useEffect(() => {
    const handlePaste = (e) => {
      if (!dialogOpen) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (ev) => {
            const newImg = { preview: ev.target.result, base64: ev.target.result, isCover: false };
            setImages(curr => {
              if (curr.length >= MAX_IMAGES) {
                // Showing toast inside setImages is not ideal, but we wrap it in setTimeout to avoid render phase side-effects
                setTimeout(() => toast.error(`Maximal ${MAX_IMAGES} Bilder.`), 0);
                return curr;
              }
              const updated = [...curr, newImg];
              if (updated.filter(i => i.isCover).length === 0 && updated.length > 0) updated[0].isCover = true;
              setTimeout(() => toast.success('Bild eingefügt!'), 0);
              return updated;
            });
          };
          reader.readAsDataURL(file);
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
 setImages([]);
 setDialogOpen(true);
 };

 const stopCapture = useCallback(() => {
   if (videoStream) {
     videoStream.getTracks().forEach(t => t.stop());
     setVideoStream(null);
   }
 }, [videoStream]);

 useEffect(() => {
   if (!dialogOpen) {
     stopCapture();
   }
 }, [dialogOpen, stopCapture]);

 const startCapture = async () => {
   try {
     const stream = await navigator.mediaDevices.getDisplayMedia({
       video: { cursor: "always" },
       audio: false
     });
     setVideoStream(stream);
     if (videoRef.current) videoRef.current.srcObject = stream;
     stream.getVideoTracks()[0].onended = () => stopCapture();
   } catch (err) {
     console.error("Error starting screen capture:", err);
   }
 };

 const takePhoto = () => {
   if (!videoRef.current) return;
   const canvas = document.createElement('canvas');
   canvas.width = videoRef.current.videoWidth;
   canvas.height = videoRef.current.videoHeight;
   canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
   const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
   
   setImages(prev => {
     if (prev.length >= MAX_IMAGES) { toast.error(`Maximal ${MAX_IMAGES} Bilder.`); return prev; }
     const newImg = { preview: dataUrl, base64: dataUrl, isCover: prev.length === 0 };
     return [...prev, newImg];
   });
 };

 const openEdit = async (listing) => {
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
 // Fetch existing images
 try {
 const res = await fetch(`/api/listings/${listing.id}`, { credentials: 'include' });
 if (res.ok) {
 const data = await res.json();
 setImages((data.images || []).map(img => ({
 id: img.id, preview: img.image_path, isCover: !!img.is_cover, isExisting: true,
 })));
 } else {
 setImages([]);
 }
 } catch { setImages([]); }
 setDialogOpen(true);
 };

 const handleRemoveImage = async (idx) => {
 const img = images[idx];
 if (img.isExisting && img.id && editingListing) {
 try {
 await fetch(`/api/listings/${editingListing.id}/images/${img.id}`, { method: 'DELETE', credentials: 'include' });
 } catch {}
 }
 setImages(prev => {
 const updated = prev.filter((_, i) => i !== idx);
 if (updated.length > 0 && !updated.some(i => i.isCover)) updated[0].isCover = true;
 return updated;
 });
 };

 const handleSetCover = (idx) => {
 setImages(prev => prev.map((img, i) => ({ ...img, isCover: i === idx })));
 };

 const handleDragStart = (idx) => setDragIdx(idx);
 const handleDragOver = (e, idx) => {
 e.preventDefault();
 if (dragIdx === null || dragIdx === idx) return;
 setImages(prev => {
 const updated = [...prev];
 const [moved] = updated.splice(dragIdx, 1);
 updated.splice(idx, 0, moved);
 return updated;
 });
 setDragIdx(idx);
 };
 const handleDragEnd = async () => {
 setDragIdx(null);
 // Save new order for existing images
 if (editingListing) {
 const existingIds = images.filter(i => i.isExisting && i.id).map(i => i.id);
 if (existingIds.length > 1) {
 try {
 await fetch(`/api/listings/${editingListing.id}/images/reorder`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 credentials: 'include', body: JSON.stringify({ order: existingIds }),
  });
  } catch {}
  }
  }
  };

  const handleSubmit = async () => {
 if (!form.brand || !form.model) {
 toast.error('Marke und Modell sind Pflichtfelder.');
 return;
 }

 // Price validation
 const catItem = catalog.find(v => 
  v.brand.toLowerCase() === form.brand.toLowerCase() && 
  v.model.toLowerCase() === form.model.toLowerCase()
 );
 if (catItem && form.custom_price) {
  const price = parseInt(form.custom_price);
  if (price > catItem.max_sell_price) {
   toast.error(`Der Preis darf das Maximum von $${catItem.max_sell_price.toLocaleString()} nicht überschreiten.`);
   return;
  }
 }

 const body = { ...form };
 const newImages = images.filter(i => !i.isExisting && i.base64);

 if (editingListing) {
 // For edit: upload new images separately and then sync order/cover
 try {
 const res = await fetch(`/api/listings/${editingListing.id}`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 credentials: 'include', body: JSON.stringify(body),
 });
 if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Fehler.'); return; }

 let updatedImages = [...images];
 // Upload new images
 for (let i = 0; i < updatedImages.length; i++) {
 const img = updatedImages[i];
 if (!img.isExisting && img.base64) {
 const upRes = await fetch(`/api/listings/${editingListing.id}/images`, {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 credentials: 'include', body: JSON.stringify({ image_base64: img.base64 }),
 });
 if (upRes.ok) {
 const savedImages = await upRes.json();
 const newSavedImg = savedImages[savedImages.length - 1];
 updatedImages[i] = { ...img, id: newSavedImg.id, isExisting: true };
 }
 }
 }

 // Reorder all images
 const finalIds = updatedImages.filter(i => i.isExisting && i.id).map(i => i.id);
 if (finalIds.length > 0) {
 await fetch(`/api/listings/${editingListing.id}/images/reorder`, {
 method: 'PUT', headers: { 'Content-Type': 'application/json' },
 credentials: 'include', body: JSON.stringify({ order: finalIds }),
 });
 }

 // Set cover
 const coverImg = updatedImages.find(i => i.isCover && i.isExisting && i.id);
 if (coverImg) {
 await fetch(`/api/listings/${editingListing.id}/images/${coverImg.id}/cover`, {
 method: 'PUT', credentials: 'include',
 });
 }

 toast.success('Inserat aktualisiert!');
 setDialogOpen(false);
 fetchListings();
 } catch { toast.error('Netzwerkfehler.'); }
 } else {
 // For create: send first image as image_base64, rest as images_base64 array
 if (newImages.length > 0) body.image_base64 = newImages[0].base64;
 if (newImages.length > 1) body.images_base64 = JSON.stringify(newImages.slice(1).map(i => i.base64));
 
 let coverIndex = images.findIndex(i => i.isCover);
 body.cover_index = coverIndex === -1 ? 0 : coverIndex;

 try {
 const res = await fetch('/api/listings', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 credentials: 'include', body: JSON.stringify(body),
 });
 if (res.ok) {
 const data = await res.json();
 toast.success('Inserat erstellt!');
 if (data.matched_requests_count > 0) {
  toast.success(`🎉 ${data.matched_requests_count} Kunden suchen dieses Fahrzeug! Sie wurden benachrichtigt.`, { duration: 6000 });
 }
 setDialogOpen(false);
 fetchListings();
 } else {
 const data = await res.json();
 toast.error(data.error || 'Fehler beim Speichern.');
 }
 } catch { toast.error('Netzwerkfehler.'); }
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

 const handleFeatureToggle = async (id) => {
 try {
 const res = await fetch(`/api/listings/${id}/feature`, {
 method: 'PUT',
 credentials: 'include',
 });
 if (res.ok) {
 const data = await res.json();
 toast.success(data.is_featured ? '⭐ Als Featured markiert!' : 'Featured-Markierung entfernt.');
 fetchListings();
 } else {
 const data = await res.json();
 toast.error(data.error || 'Fehler.');
 }
 } catch (err) {
 toast.error('Netzwerkfehler.');
 }
 };

  const handleSellSubmit = async () => {
    if (!sellListing) return;
    try {
      const body = {
        sold_to_name: sellForm.sold_to_name,
        sold_price: sellForm.sold_price,
      };
      
      // If the listing belongs to another user, pass on_behalf_of
      if (sellListing.seller_id !== user.id) {
        body.on_behalf_of = sellListing.seller_id;
      }

      const res = await fetch(`/api/listings/${sellListing.id}/sell`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        toast.success('Fahrzeug erfolgreich verkauft!');
        setSellDialogOpen(false);
        fetchListings();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Fehler beim Verkaufen.');
      }
    } catch (err) {
      toast.error('Netzwerkfehler.');
    }
  };

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-6xl mx-auto">
 <div className="flex items-center justify-between pb-2 border-b border-border/40">
 <div>
 <h1 className="text-3xl font-bold tracking-tight">Inserate & Kataloge</h1>
 <p className="text-muted-foreground mt-1">Verwalte Fahrzeug-Inserate und Kataloge.</p>
 </div>
 <div className="flex items-center gap-4">
 {hasRole('mitarbeiter') && (
   <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
     <SelectTrigger className="w-[220px] cursor-pointer">
       <SelectValue>
         {selectedSellerId === 'me' ? '👤 Meine Inserate' : 
          selectedSellerId === 'all' ? '👥 Alle Mitarbeiter' : 
          (staffList.find(s => s.id.toString() === selectedSellerId)?.display_name || 
           staffList.find(s => s.id.toString() === selectedSellerId)?.username || 
           selectedSellerId)}
       </SelectValue>
     </SelectTrigger>
     <SelectContent>
       <SelectItem value="me" className="cursor-pointer">👤 Meine Inserate</SelectItem>
       <SelectItem value="all" className="cursor-pointer">👥 Alle Mitarbeiter</SelectItem>
       {staffList.filter(s => s.id !== user?.id).map(s => (
         <SelectItem key={s.id} value={s.id.toString()} className="cursor-pointer">
           {s.display_name || s.username}
         </SelectItem>
       ))}
     </SelectContent>
   </Select>
 )}
 <Button onClick={openCreate} className="gap-2 cursor-pointer">
 <Plus className="h-4 w-4" /> Neues Inserat
 </Button>
 </div>
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
 <img loading='lazy' src={getThumbnailImagePath(l.image_path)} alt="" className="h-10 w-14 rounded object-cover" />
 ) : (
 <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
 <Car className="h-4 w-4 text-muted-foreground" />
 </div>
 )}
 </TableCell>
 <TableCell className="font-medium">
 <div className="flex items-center gap-1.5">
 {l.is_featured ? <Star className="h-3.5 w-3.5 text-orange-400 fill-orange-400 shrink-0" /> : null}
 {l.brand} {l.model}
 </div>
 </TableCell>
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
 <DropdownMenuItem onClick={() => handleFeatureToggle(l.id)}>
 <Star className={`mr-2 h-4 w-4 ${l.is_featured ? 'text-orange-400 fill-orange-400' : ''}`} />
 {l.is_featured ? 'Featured entfernen' : 'Als Featured markieren'}
 </DropdownMenuItem>
 {l.status === 'available' && (
  <>
 <DropdownMenuItem onClick={() => handleStatusChange(l.id, 'reserved')}>
 Reservieren
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => {
   setSellListing(l);
   setSellForm({ sold_to_name: '', sold_price: l.custom_price?.toString() || '' });
   setSellDialogOpen(true);
 }} className="text-success focus:text-success">
 <DollarSign className="mr-2 h-4 w-4" /> Verkaufen
 </DropdownMenuItem>
 </>
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
 {/* Multi-Image Gallery */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <Label className="flex items-center gap-1.5">
 <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
 Bilder ({images.length}/{MAX_IMAGES})
 </Label>
 <div className="flex items-center gap-2">
 {!videoStream && (
   <Button size="sm" variant="outline" className="h-6 text-xs px-2 cursor-pointer" onClick={startCapture}>
     🎮 Spiel-Kamera
   </Button>
 )}
 {images.length < MAX_IMAGES && (
 <p className="text-[10px] text-muted-foreground">
 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Strg+V</kbd> zum Einfügen
 </p>
 )}
 </div>
 </div>

 {videoStream && (
   <div className="relative rounded-lg overflow-hidden border border-border mb-4 bg-black">
     <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-contain" />
     <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
       <Button size="sm" onClick={takePhoto} className="bg-primary text-black hover:bg-primary/80 cursor-pointer">📸 Foto schießen</Button>
       <Button size="sm" variant="destructive" onClick={stopCapture} className="cursor-pointer">Abbrechen</Button>
     </div>
   </div>
 )}

 {images.length === 0 ? (
 <div
 ref={dropZoneRef}
 className="border-2 border-dashed rounded-lg p-6 text-center border-border hover:border-primary/30 transition-colors"
 >
 <ClipboardPaste className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
 <p className="text-sm text-muted-foreground">
 Screenshot machen & <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Strg+V</kbd> drücken
 </p>
 <p className="text-xs text-muted-foreground/60 mt-1">Bis zu {MAX_IMAGES} Bilder pro Fahrzeug</p>
 </div>
 ) : (
 <div className="space-y-2">
 <div className="grid grid-cols-4 gap-2">
 {images.map((img, idx) => (
 <div
 key={idx}
 draggable
 onDragStart={() => handleDragStart(idx)}
 onDragOver={(e) => handleDragOver(e, idx)}
 onDragEnd={handleDragEnd}
 className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
 img.isCover ? 'border-orange-400 ring-1 ring-orange-400/30' : 'border-border hover:border-primary/30'
 } ${dragIdx === idx ? 'opacity-50 scale-95' : ''}`}
 >
 <img loading='lazy' decoding="async" src={img.isExisting ? getThumbnailImagePath(img.preview) : img.preview} alt="" className="h-20 w-full object-cover" />

 {/* Cover badge */}
 {img.isCover && (
 <div className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5">
 <Crown className="h-2 w-2" /> Cover
 </div>
 )}

 {/* Action buttons */}
 <div className="absolute top-1 right-1 flex gap-0.5">
 {!img.isCover && (
 <button
 onClick={() => handleSetCover(idx)}
 className="h-5 w-5 rounded bg-black/60 text-white flex items-center justify-center hover:bg-orange-500 transition-colors cursor-pointer"
 title="Als Cover setzen"
 >
 <Crown className="h-2.5 w-2.5" />
 </button>
 )}
 <button
 onClick={() => handleRemoveImage(idx)}
 className="h-5 w-5 rounded bg-black/60 text-white flex items-center justify-center hover:bg-destructive transition-colors cursor-pointer"
 title="Entfernen"
 >
 <X className="h-2.5 w-2.5" />
 </button>
 </div>

 {/* Drag handle */}
 <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/40 rounded px-1">
 <GripVertical className="h-3 w-3 text-white/60" />
 </div>
 </div>
 ))}

 {/* Add more slot */}
 {images.length < MAX_IMAGES && (
 <div className="h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/30 flex items-center justify-center transition-colors">
 <div className="text-center">
 <ClipboardPaste className="h-4 w-4 mx-auto text-muted-foreground/40" />
 <p className="text-[9px] text-muted-foreground/40 mt-0.5">Strg+V</p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label htmlFor="brand">Marke *</Label>
 <Input
 id="brand"
 list="vehicle-brand-options"
 value={form.brand}
 onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
 placeholder="Marke wählen oder eingeben..."
 autoComplete="off"
 />
 <datalist id="vehicle-brand-options">
 {[...new Set(vehicleOptions.map(v => v.brand))].sort().map(b => <option key={b} value={b} />)}
 </datalist>
 </div>
 <div className="space-y-1.5">
  <Label htmlFor="model">Modell *</Label>
  <Input
   id="model"
   list="vehicle-model-options"
   value={form.model}
   onChange={e => {
   const value = e.target.value;
   const catItem = catalog.find(item => 
    item.brand.toLowerCase() === form.brand.toLowerCase() && 
    item.model.toLowerCase() === value.toLowerCase()
   );
   let price = form.custom_price;
   if (catItem) {
    price = Math.floor((catItem.min_sell_price + catItem.max_sell_price) / 2).toString();
   }
   setForm(f => ({ ...f, model: value, custom_price: price }));
  }}
  placeholder="Modell wählen oder eingeben..."
  autoComplete="off"
  />
 <datalist id="vehicle-model-options">
 {vehicleOptions
 .filter(v => v.brand.toLowerCase() === (form.brand || '').toLowerCase())
 .map(v => <option key={`${v.brand}-${v.model}`} value={v.model} />)
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
 <Label htmlFor="custom_price" className="flex justify-between">
  <span>Preis ($)</span>
  {form.brand && form.model && (() => {
   const catItem = catalog.find(v => 
    v.brand.toLowerCase() === form.brand.toLowerCase() && 
    v.model.toLowerCase() === form.model.toLowerCase()
   );
   if (!catItem || !form.custom_price) return null;
   const price = parseInt(form.custom_price);
   const min = catItem.min_sell_price;
   const max = catItem.max_sell_price;
   
   let status = 'neutral';
   let label = '';
   let color = 'text-muted-foreground';

   if (price >= min && price <= max) {
    status = 'good';
    label = 'Empfohlen';
    color = 'text-success';
   } else if (price < min) {
    status = 'low';
    label = 'Sehr günstig';
    color = 'text-blue-400';
   } else {
    status = 'high';
    label = 'Zu teuer (Max überschritten)';
    color = 'text-destructive';
   }

   return (
    <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${color}`}>
     {label} (${min.toLocaleString()}-${max.toLocaleString()})
    </span>
   );
  })()}
 </Label>
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

  {/* Sell Dialog */}
  <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Fahrzeug verkaufen</DialogTitle>
        <DialogDescription>
          {sellListing ? `Verkaufe ${sellListing.brand} ${sellListing.model}` : ''}
          {sellListing && sellListing.seller_id !== user.id && (
            <span className="block mt-1 text-orange-500 font-medium">Verkauf im Namen eines anderen Mitarbeiters.</span>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="sold_to_name">Käufer Name</Label>
          <Input 
            id="sold_to_name" 
            value={sellForm.sold_to_name} 
            onChange={e => setSellForm(f => ({ ...f, sold_to_name: e.target.value }))}
            placeholder="Name des Kunden"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sold_price">Verkaufspreis ($)</Label>
          <Input 
            id="sold_price" 
            type="number"
            value={sellForm.sold_price} 
            onChange={e => setSellForm(f => ({ ...f, sold_price: e.target.value }))}
            placeholder="Endpreis"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setSellDialogOpen(false)} className="cursor-pointer">Abbrechen</Button>
        <Button onClick={handleSellSubmit} className="bg-success text-success-foreground hover:bg-success/90 cursor-pointer">Verkaufen</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </div>
  );
}
