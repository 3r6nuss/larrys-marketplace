import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
 Ticket, MessageSquare, Send, ArrowLeft, Car, Clock,
 CheckCircle2, XCircle, Loader2, AlertTriangle, User, Flame,
 FileText, DollarSign, Award, TrendingUp, Sparkles, ShieldCheck
} from 'lucide-react';

const ERP_STATUS_MAP = {
  open: { label: 'Offen', class: 'bg-info/10 text-info border-info/20 hover:bg-info/15', icon: Clock },
  waiting_staff: { label: 'Antwort erwartet', class: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/15', icon: Loader2 },
  waiting_customer: { label: 'Warten auf Kunde', class: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15', icon: User },
  completed: { label: 'Erledigt', class: 'bg-success/10 text-success border-success/20 hover:bg-success/15', icon: CheckCircle2 },
};

const STATUS_MAP = {
  ...ERP_STATUS_MAP,
  cancelled: { label: 'Storniert', class: 'bg-muted text-muted-foreground border-border', icon: XCircle }
};

const ERP_STEPS = [
  { key: 'open', label: 'Offen' },
  { key: 'waiting_staff', label: 'Antwort erwartet' },
  { key: 'waiting_customer', label: 'Warten auf Kunde' },
  { key: 'completed', label: 'Erledigt' }
];

export default function TicketsPage({ isModal }) {
 const { user, hasRole } = useAuth();
 const [searchParams, setSearchParams] = useSearchParams();
 const [tickets, setTickets] = useState([]);
 const [loading, setLoading] = useState(true);
 const [selectedTicket, setSelectedTicket] = useState(null);
 const [ticketDetail, setTicketDetail] = useState(null);
 const [detailLoading, setDetailLoading] = useState(false);
 const [message, setMessage] = useState('');
 const [sending, setSending] = useState(false);
 const [statusFilter, setStatusFilter] = useState('all');
 const [assignedToFilter, setAssignedToFilter] = useState('mine');
  const [showClosed, setShowClosed] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [haltStop, setHaltStop] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const messagesEndRef = useRef(null);
  const autoCreateListingRef = useRef(null);

 // Check if coming from catalog to create a new ticket
 const newTicketListingId = searchParams.get('listing');

 useEffect(() => {
   if (hasRole('mitarbeiter')) {
     fetch('/api/users/staff').then(r => r.json()).then(data => {
       if (Array.isArray(data)) setStaffUsers(data);
     }).catch(() => {});
   }
 }, [hasRole]);

 const selectTicket = useCallback(async (ticketId) => {
   setSelectedTicket(ticketId);
   setDetailLoading(true);
   try {
     const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
     if (res.ok) {
       setTicketDetail(await res.json());
     }
   } catch (err) {
     console.error('Error selecting ticket:', err);
   } finally {
     setDetailLoading(false);
   }
 }, []);

 const fetchTickets = useCallback(async () => {
   try {
     const params = new URLSearchParams();
     if (statusFilter !== 'all') params.append('status', statusFilter);
     if (hasRole('mitarbeiter') && assignedToFilter !== 'all') {
       params.append('assigned_to', assignedToFilter === 'mine' ? String(user?.id ?? '') : assignedToFilter);
     }
     if (showClosed) params.append('show_closed', 'true');
     
     const res = await fetch(`/api/tickets?${params.toString()}`, { credentials: 'include' });
     if (res.ok) setTickets(await res.json());
   } catch (err) {
     console.error('Error fetching tickets:', err);
   } finally {
     setLoading(false);
   }
 }, [statusFilter, assignedToFilter, showClosed, hasRole, user]);

 const createTicket = useCallback(async (listingId) => {
   try {
     const res = await fetch('/api/tickets', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ listing_id: listingId, message: 'Ich interessiere mich für dieses Fahrzeug.' }),
     });

     if (res.ok) {
       const ticket = await res.json();
       toast.success('Anfrage erstellt!');
       setSearchParams({ modal: 'tickets' }, { replace: true });
       fetchTickets();
       selectTicket(ticket.id);
     } else {
       const data = await res.json();
       if (data.halt_stop) {
         setHaltStop(true);
         setTimeout(() => setHaltStop(false), 5000);
       } else if (data.existing_ticket_id) {
         toast.info('Du hast bereits eine Anfrage für dieses Fahrzeug.');
         selectTicket(data.existing_ticket_id);
       } else {
         toast.error(data.error || 'Fehler beim Erstellen.');
       }
     }
   } catch (err) {
     console.error('Error creating ticket:', err);
     toast.error('Netzwerkfehler.');
   }
 }, [fetchTickets, selectTicket, setSearchParams]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Auto-create ticket if coming from catalog
  useEffect(() => {
    if (!newTicketListingId || autoCreateListingRef.current === newTicketListingId) return;

    autoCreateListingRef.current = newTicketListingId;
    const timeoutId = setTimeout(() => createTicket(parseInt(newTicketListingId, 10)), 0);
    return () => clearTimeout(timeoutId);
  }, [newTicketListingId, createTicket]);

 // Auto-scroll to bottom on new messages
 useEffect(() => {
   if (ticketDetail?.messages) {
     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   }
 }, [ticketDetail?.messages]);

 const sendMessage = async () => {
 if (!message.trim() || !selectedTicket) return;
 setSending(true);
 try {
 const res = await fetch(`/api/tickets/${selectedTicket}/messages`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify({ message: message.trim() }),
 });
 if (res.ok) {
 setMessage('');
 selectTicket(selectedTicket); // Refresh messages
 } else {
 toast.error('Nachricht konnte nicht gesendet werden.');
 }
 } catch (err) {
 console.error('Error sending message:', err);
 toast.error('Netzwerkfehler.');
 } finally {
 setSending(false);
 }
 };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ERP Contract states
  const [contractPriceInput, setContractPriceInput] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (ticketDetail) {
      if (ticketDetail.contract_price && ticketDetail.contract_price > 0) {
        setContractPriceInput(ticketDetail.contract_price.toString());
      } else {
        const defaultPrice = ticketDetail.custom_price || 
                             (ticketDetail.catalog ? Math.round((ticketDetail.catalog.min_sell_price + ticketDetail.catalog.max_sell_price) / 2) : '');
        setContractPriceInput(defaultPrice.toString());
      }
    }
  }, [ticketDetail]);

  const handleStepClick = async (stepKey) => {
    if (!hasRole('mitarbeiter')) return;
    if (ticketDetail.status === 'cancelled') return;
    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/erp-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ erp_status: stepKey }),
      });
      if (res.ok) {
        toast.success('ERP-Status aktualisiert.');
        selectTicket(ticketDetail.id);
        fetchTickets();
      }
    } catch (err) {
      console.error('Error changing ERP status:', err);
      toast.error('Fehler beim Ändern des ERP-Status.');
    }
  };

  const generateContract = async () => {
    if (!contractPriceInput || isNaN(contractPriceInput) || parseInt(contractPriceInput) <= 0) {
      toast.error('Bitte einen gültigen Preis eingeben.');
      return;
    }
    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ price: parseInt(contractPriceInput), payment_type: 'cash' }),
      });
      if (res.ok) {
        toast.success('Kaufvertrag erstellt!');
        selectTicket(ticketDetail.id);
        fetchTickets();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Fehler beim Erstellen des Vertrags.');
      }
    } catch (e) {
      console.error('Error generating contract:', e);
      toast.error('Netzwerkfehler.');
    }
  };

  const cancelContract = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/contract`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Kaufvertrag storniert.');
        selectTicket(ticketDetail.id);
        fetchTickets();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Fehler beim Stornieren des Vertrags.');
      }
    } catch (e) {
      console.error('Error cancelling contract:', e);
      toast.error('Netzwerkfehler.');
    }
  };

  const finalizeContract = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/finalize`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Verkauf erfolgreich abgeschlossen! Provision wurde verbucht. 🎉');
        selectTicket(ticketDetail.id);
        fetchTickets();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Fehler beim Abschließen.');
      }
    } catch (e) {
      console.error('Error finalizing contract:', e);
      toast.error('Netzwerkfehler.');
    }
  };

  const getActiveStepIndex = (status, erpStatus) => {
    if (status === 'cancelled') return -1;
    const index = ERP_STEPS.findIndex(s => s.key === erpStatus);
    return index !== -1 ? index : 0;
  };

  const renderMessageContent = (msg) => {
    if (msg.message.startsWith('[SYSTEM_CONTRACT_CREATED]')) {
      const parts = msg.message.replace('[SYSTEM_CONTRACT_CREATED] ', '').split(' | ');
      const price = parseInt(parts[0]);
      const payType = 'Barzahlung';

      return (
        <div className="bg-gradient-to-br from-card/95 to-card/60 border-2 border-primary/20 backdrop-blur-md rounded-2xl p-4 shadow-lg text-foreground max-w-sm w-full space-y-3 font-sans animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kaufvertrag</h4>
                <p className="font-mono text-[9px] text-muted-foreground/80">#KV-{msg.ticket_id}-{msg.id}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] uppercase font-bold px-2 py-0.5">
              Entwurf
            </Badge>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fahrzeug:</span>
              <span className="font-semibold">{ticketDetail.brand} {ticketDetail.model}</span>
            </div>
            {ticketDetail.plate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kennzeichen:</span>
                <span className="font-mono font-semibold">{ticketDetail.plate}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Kaufpreis:</span>
              <span className="font-bold text-primary text-sm">${price.toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zahlungsmethode:</span>
              <span className="font-semibold">{payType}</span>
            </div>
          </div>
          <div className="border-t border-border/40 pt-2 text-[9px] text-muted-foreground text-center italic">
            Dieser Vertrag ist digital ausgestellt und rechtsgültig nach Freigabe.
          </div>
        </div>
      );
    }

    if (msg.message.startsWith('[SYSTEM_CONTRACT_CANCELLED]')) {
      return (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-center gap-2.5 max-w-sm w-full animate-in fade-in duration-200">
          <XCircle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <h5 className="font-bold text-xs text-destructive uppercase tracking-wide">Kaufvertrag Storniert</h5>
            <p className="text-[11px] text-muted-foreground">Der Entwurf für den digitalen Kaufvertrag wurde verworfen.</p>
          </div>
        </div>
      );
    }

    if (msg.message.startsWith('[SYSTEM_CONTRACT_FINALIZED]')) {
      return (
        <div className="bg-gradient-to-br from-success/15 via-success/5 to-card border-2 border-success/30 backdrop-blur-md rounded-2xl p-4 shadow-xl text-foreground max-w-sm w-full space-y-3 font-sans animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-success/20 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-success">Übergabeprotokoll</h4>
                <p className="font-mono text-[9px] text-muted-foreground/80">#FIN-{msg.ticket_id}</p>
              </div>
            </div>
            <Badge className="bg-success text-success-foreground border-transparent text-[9px] uppercase font-bold px-2 py-0.5">
              Erledigt
            </Badge>
          </div>
          <div className="space-y-2 text-xs font-sans">
            <p className="text-[11px] text-muted-foreground">Das Fahrzeug wurde erfolgreich übergeben. Der Kaufvertrag wurde finalisiert und signiert.</p>
            <div className="flex justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Käufer:</span>
              <span className="font-semibold">{ticketDetail.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verkäufer:</span>
              <span className="font-semibold">{ticketDetail.assigned_name || 'Mitarbeiter'}</span>
            </div>
            {ticketDetail.contract_price > 0 && (
              <div className="flex justify-between border-t border-border/40 pt-2">
                <span className="text-muted-foreground">Endpreis:</span>
                <span className="font-bold text-success text-sm">${ticketDetail.contract_price.toLocaleString('de-DE')}</span>
              </div>
            )}
          </div>
          <div className="border-t border-success/20 pt-2 text-[9px] text-success/80 text-center font-semibold">
            🎉 Verkauf abgeschlossen und Provisionen an den Tresor gutgeschrieben!
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
        msg.sender_id === user.id
          ? 'bg-primary text-primary-foreground rounded-br-md shadow-sm shadow-primary/10'
          : 'bg-muted rounded-bl-md shadow-sm shadow-black/5'
      }`}>
        {msg.message}
      </div>
    );
  };

  // Quick replies constants for German GTA RP
  const QUICK_REPLIES = [
    { label: '👋 Begrüßung', text: 'Hallo! Vielen Dank für Ihr Interesse. Ich kümmere mich sehr gerne um Ihre Anfrage. Wann passt es Ihnen für ein kurzes Gespräch oder eine Probefahrt bei uns?' },
    { label: '📝 Vertrag bereit', text: 'Ich habe soeben den Kaufvertrag für Ihr Fahrzeug vorbereitet. Bitte prüfen Sie den Vertragsentwurf direkt in unserer App und geben Sie mir Bescheid!' },
    { label: '🚗 Übergabe bereit', text: 'Das Fahrzeug steht vollgetankt, aufbereitet und schlüsselfertig für Sie bereit. Sie können gerne vorbeikommen, um die Übergabe abzuschließen!' },
    { label: '🎉 Verkauft / Dank', text: 'Herzlichen Glückwunsch zum neuen Fahrzeug und allzeit gute Fahrt! Es war mir eine Freude. Wenn Sie noch etwas brauchen, melden Sie sich gerne!' }
  ];

  return (
    <div className={`flex gap-4 ${isModal ? 'h-full min-h-[60vh]' : 'h-[calc(100vh-8rem)]'}`}>
      {/* Ticket List */}
      <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 lg:w-80 shrink-0`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h1 className="text-xl font-bold tracking-tight">ERP Tickets</h1>
          <div className="flex gap-2">
            {hasRole('mitarbeiter') && (
              <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-background/50 border-border/50">
                  <SelectValue placeholder="Mitarbeiter">
                    {assignedToFilter === 'all'
                      ? 'Alle Tickets'
                      : assignedToFilter === 'mine'
                        ? 'Meine Tickets'
                        : (staffUsers.find(u => u.id.toString() === assignedToFilter)?.display_name || 'Mitarbeiter')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Tickets</SelectItem>
                  <SelectItem value="mine">Meine Tickets</SelectItem>
                  {staffUsers.filter(u => u.id !== user.id).map(st => (
                    <SelectItem key={st.id} value={st.id.toString()}>{st.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: Alle</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border text-xs px-1">
          <input 
            type="checkbox" 
            id="showClosed" 
            checked={showClosed} 
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
          />
          <label htmlFor="showClosed" className="cursor-pointer text-muted-foreground select-none">Geschlossene anzeigen</label>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 bg-card/10 border border-dashed border-border/40 rounded-xl">
              <Ticket className="h-10 w-10 text-muted-foreground/45 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm font-medium">Keine Tickets vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tickets.map(t => {
                const isActive = selectedTicket === t.id;
                const isCancelled = t.status === 'cancelled';
                const st = isCancelled ? STATUS_MAP.cancelled : (STATUS_MAP[t.erp_status] || STATUS_MAP.open);
                const Icon = st.icon || Clock;
                
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTicket(t.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'border-primary/50 bg-primary/5 shadow-sm shadow-primary/5'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 relative">
                        {t.is_unread ? <span className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" /> : null}
                        <p className="font-semibold text-sm truncate flex items-center gap-1.5 text-foreground/90">
                          {t.priority === 'urgent' && <Flame className="h-3.5 w-3.5 text-red-500 fill-red-500 animate-pulse shrink-0" />}
                          {t.brand} {t.model}
                        </p>
                        <p className="text-xs text-muted-foreground/80 truncate mt-1">
                          {hasRole('mitarbeiter') ? (t.customer_name || 'Kunde') : (t.assigned_name || 'Verkäufer')}
                        </p>
                      </div>
                      <Badge className={`${st.class} text-[10px] shrink-0 font-bold border rounded-md shadow-sm`}>
                        <Icon className="w-3 h-3 mr-1 shrink-0" />
                        {st.label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 font-medium mt-2">
                      {new Date(t.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat & Sidebar Workspace */}
      <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-1 border border-border/80 rounded-xl overflow-hidden bg-card/15 backdrop-blur-sm shadow-xl`}>
        {!selectedTicket ? (
          <div className="flex-1 flex items-center justify-center bg-card/5">
            <div className="text-center text-muted-foreground p-6">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4 border border-border/40">
                <MessageSquare className="h-7 w-7 opacity-40 text-primary" />
              </div>
              <h3 className="font-bold text-sm text-foreground/80">Kein Ticket ausgewählt</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">Wähle eine Anfrage aus der linken Spalte aus, um den ERP-Arbeitsplatz zu öffnen.</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">ERP-Arbeitsplatz wird geladen...</p>
            </div>
          </div>
        ) : ticketDetail ? (
          <div className="flex-1 flex h-full overflow-hidden relative">
            {/* Middle Chat Panel */}
            <div className="flex-1 flex flex-col h-full min-w-0">
              {/* Chat Header & Compact ERP Select Selector */}
              <div className="flex flex-col border-b border-border bg-card/40 shrink-0">
                <div className="flex items-center gap-3 p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8 cursor-pointer hover:bg-muted/60"
                    onClick={() => setSelectedTicket(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  {ticketDetail.image_path && (
                    <img loading='lazy' src={ticketDetail.image_path} alt="" className="h-10 w-16 rounded-lg object-cover border border-border/40 bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate text-foreground/95">
                      {ticketDetail.brand} {ticketDetail.model}
                    </p>
                    {ticketDetail.plate && (
                      <p className="text-[10px] font-mono text-muted-foreground/80 truncate mt-0.5 bg-muted/65 px-1.5 py-0.5 rounded w-max">{ticketDetail.plate}</p>
                    )}
                  </div>
                  
                  {/* ERP Status Controls built seamlessly into Chat Header */}
                  {ticketDetail.status === 'cancelled' ? (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] uppercase font-bold py-1 px-2">
                      Storniert
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Responsive Workspace Toggle Button */}
                      {hasRole('mitarbeiter') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowWorkspace(!showWorkspace)}
                          className="xl:hidden gap-1.5 cursor-pointer h-8 text-xs font-semibold border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          {showWorkspace ? 'Chat' : 'Vertrag & CRM'}
                        </Button>
                      )}

                      {/* Status Dropdown */}
                      {hasRole('mitarbeiter') ? (
                        <Select 
                          value={ticketDetail.erp_status} 
                          onValueChange={(val) => handleStepClick(val)}
                        >
                          <SelectTrigger className="w-[145px] h-8 text-xs font-semibold bg-background/50 border-border/50">
                            <SelectValue placeholder="ERP Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {ERP_STEPS.map(step => (
                              <SelectItem key={step.key} value={step.key} className="text-xs font-medium">
                                {step.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${STATUS_MAP[ticketDetail.erp_status]?.class || STATUS_MAP.open.class} text-[10px] font-bold border rounded-md shadow-sm`}>
                          {STATUS_MAP[ticketDetail.erp_status]?.label || STATUS_MAP.open.label}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Stream */}
              <ScrollArea className="flex-1 p-4 bg-muted/5">
                <div className="space-y-4">
                  {ticketDetail.messages?.map(msg => {
                    const isMe = msg.sender_id === user.id;
                    const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(msg.sender_role);
                    return (
                      <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <Avatar className="h-8 w-8 shrink-0 mt-1 shadow-sm border border-border/40">
                            <AvatarImage src={msg.sender_avatar} />
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                              {msg.sender_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <p className="text-[11px] text-muted-foreground/90 font-medium mb-1 flex items-center gap-1.5">
                              {msg.sender_name}
                              {isStaff && <Badge variant="outline" className="text-[8px] tracking-wide font-extrabold uppercase bg-primary/5 text-primary border-primary/20 px-1 py-0 h-3.5">Staff</Badge>}
                            </p>
                          )}
                          {renderMessageContent(msg)}
                          <p className="text-[9px] text-muted-foreground/50 font-medium mt-1">
                            {new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input with inline warnings and quick replies */}
              {ticketDetail.status !== 'completed' && ticketDetail.status !== 'cancelled' && (
                <div className="p-3 border-t border-border bg-card/15 shrink-0 space-y-2.5">
                  {/* Non-blocking rate-limit banner */}
                  {haltStop && (
                    <div className="p-2.5 rounded-xl bg-destructive/15 border border-destructive/25 text-destructive text-xs font-semibold flex items-center gap-2 animate-bounce">
                      <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
                      <span>Halt Stop! 🛑 Zu viele Anfragen! Bitte warte einen Moment.</span>
                    </div>
                  )}

                  {/* High-speed quick replies row */}
                  {hasRole('mitarbeiter') && (
                    <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/40 overflow-x-auto select-none no-scrollbar">
                      {QUICK_REPLIES.map((reply, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMessage(reply.text)}
                          className="h-7 text-[10px] px-2.5 py-0 cursor-pointer rounded-full border border-muted hover:border-primary/40 bg-background hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground shrink-0 font-medium shadow-sm"
                        >
                          {reply.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Nachricht schreiben..."
                      className="flex-1 bg-background/60 border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                      disabled={sending}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!message.trim() || sending}
                      size="icon"
                      className="shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-white" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right ERP Sidebar (Staff Only) - Sleek & Ultra-compact unified panel */}
            {hasRole('mitarbeiter') && (
              <div className={`w-80 border-l border-border/75 bg-card/35 p-4 space-y-4 overflow-y-auto shrink-0 transition-all duration-200 ${
                showWorkspace 
                  ? 'flex absolute inset-0 z-30 bg-background/95 w-full border-l-0'
                  : 'hidden xl:flex flex-col'
              }`}>
                {/* Unified Workspace Header */}
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h3 className="text-xs uppercase tracking-wider font-extrabold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Mitarbeiter-Workspace
                  </h3>
                  {showWorkspace && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowWorkspace(false)}
                      className="xl:hidden h-7 text-xs font-semibold cursor-pointer"
                    >
                      Schließen
                    </Button>
                  )}
                </div>

                {/* CRM & Catalog Summary - Ultra-compact 2-Column Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 border border-border/40 rounded-xl p-3 shadow-inner">
                  {/* Customer Dossier Column */}
                  <div className="space-y-1.5 border-r border-border/40 pr-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide flex items-center gap-1">
                      <User className="w-3 h-3 text-primary" /> Kunde
                    </p>
                    <p className="font-semibold text-foreground truncate">{ticketDetail.customer_name}</p>
                    <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
                      <p>Käufe: <span className="font-bold text-foreground">{ticketDetail.customer_stats?.completed_purchases_count || 0}</span></p>
                      <p className="truncate">Gesamt: <span className="font-bold text-emerald-500">${(ticketDetail.customer_stats?.total_spent || 0).toLocaleString('de-DE')}</span></p>
                    </div>
                  </div>

                  {/* Catalog Specs Column */}
                  <div className="space-y-1.5 pl-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide flex items-center gap-1">
                      <Car className="w-3 h-3 text-primary" /> Richtwerte
                    </p>
                    {ticketDetail.catalog ? (
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <p>Einkauf: <span className="font-bold text-foreground">${ticketDetail.catalog.dealer_price?.toLocaleString('de-DE')}</span></p>
                        <p>Spanne: <span className="font-bold text-foreground">${ticketDetail.catalog.min_sell_price?.toLocaleString('de-DE')} - ${ticketDetail.catalog.max_sell_price?.toLocaleString('de-DE')}</span></p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic">Kein Katalog-Eintrag</p>
                    )}
                  </div>
                </div>

                {/* Kaufvertrag Terminal Box */}
                <div className="bg-gradient-to-br from-card/80 to-muted/20 border border-primary/20 rounded-xl p-3.5 shadow-md shadow-primary/5 space-y-3">
                  <h4 className="text-[11px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <FileText className="w-3.5 h-3.5" />
                    Kaufvertrags-Terminal
                  </h4>

                  {ticketDetail.contract_price && ticketDetail.contract_price > 0 ? (
                    <div className="space-y-3.5 text-xs">
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">Kaufpreis:</span>
                          <span className="font-bold text-primary">${ticketDetail.contract_price.toLocaleString('de-DE')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Zahlungsart:</span>
                          <span className="font-semibold uppercase text-[10px] text-foreground">
                            Bar
                          </span>
                        </div>
                        <div className="text-[9px] text-muted-foreground/80 mt-1 border-t border-border/20 pt-1">
                          Erstellt am {new Date(ticketDetail.contract_created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {ticketDetail.status !== 'completed' && (
                        <div className="flex flex-col gap-2 pt-1">
                          <Button 
                            onClick={finalizeContract}
                            className="w-full h-9 text-xs font-bold bg-success hover:bg-success/90 hover:scale-[1.01] active:scale-[0.99] text-success-foreground transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-success/15 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                            Fahrzeug übergeben
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={cancelContract}
                            className="w-full h-8 text-xs border-destructive/20 text-destructive hover:bg-destructive/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Vertrag stornieren
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aushandlungspreis ($)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            value={contractPriceInput}
                            onChange={e => setContractPriceInput(e.target.value)}
                            placeholder="Verkaufspreis eintragen"
                            className="h-8.5 text-xs pl-6 bg-background/40 border-border/50 font-mono focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                            disabled={ticketDetail.status === 'completed' || ticketDetail.status === 'cancelled'}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Zahlungsart</label>
                        <div className="h-8.5 rounded-lg border border-border/40 bg-muted/30 px-3 flex items-center text-xs font-semibold">
                          Barzahlung
                        </div>
                      </div>

                      {ticketDetail.status !== 'completed' && ticketDetail.status !== 'cancelled' && (
                        <Button 
                          onClick={generateContract}
                          className="w-full h-9 text-xs font-bold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-primary/10 cursor-pointer mt-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Kaufvertrag erstellen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
