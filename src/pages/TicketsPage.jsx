import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  CheckCircle2, XCircle, Loader2, AlertTriangle
} from 'lucide-react';

const STATUS_MAP = {
  open: { label: 'Offen', class: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
  in_progress: { label: 'In Bearbeitung', class: 'bg-primary/15 text-primary border-primary/30', icon: Loader2 },
  reserved: { label: 'Reserviert', class: 'bg-chart-5/15 text-chart-5 border-chart-5/30', icon: Car },
  completed: { label: 'Abgeschlossen', class: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
  cancelled: { label: 'Storniert', class: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export default function TicketsPage({ isModal }) {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [haltStop, setHaltStop] = useState(false);
  const messagesEndRef = useRef(null);

  // Check if coming from catalog to create a new ticket
  const newTicketListingId = searchParams.get('listing');

  const fetchTickets = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/tickets${params}`, { credentials: 'include' });
      if (res.ok) setTickets(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Auto-create ticket if coming from catalog
  useEffect(() => {
    if (newTicketListingId) {
      createTicket(parseInt(newTicketListingId));
    }
  }, [newTicketListingId]);

  const createTicket = async (listingId) => {
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
        navigate('/dashboard/tickets', { replace: true });
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
      toast.error('Netzwerkfehler.');
    }
  };

  const selectTicket = async (ticketId) => {
    setSelectedTicket(ticketId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
      if (res.ok) {
        setTicketDetail(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      toast.error('Netzwerkfehler.');
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success('Status aktualisiert.');
        selectTicket(ticketId);
        fetchTickets();
      }
    } catch (err) {
      toast.error('Fehler.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Rate limit "Halt Stop" overlay
  if (haltStop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <img
          src="https://media.tenor.com/images/3c0f3e51e612e87c53f40e4a3900a1d0/tenor.gif"
          alt="Halt Stop"
          className="w-64 rounded-xl shadow-xl"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Halt Stop! 🛑</h2>
          <p className="text-muted-foreground mt-2">Zu viele Anfragen! Bitte warte einen Moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 ${isModal ? 'h-full min-h-[60vh]' : 'h-[calc(100vh-8rem)]'}`}>
      {/* Ticket List */}
      <div className={`${selectedTicket ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 shrink-0`}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight">Tickets</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="open">Offen</SelectItem>
              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Keine Tickets vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tickets.map(t => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.open;
                const isActive = selectedTicket === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTicket(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      isActive
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {t.brand} {t.model}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {hasRole('mitarbeiter') ? (t.customer_name || 'Kunde') : (t.assigned_name || 'Verkäufer')}
                        </p>
                      </div>
                      <Badge className={`${st.class} text-[10px] shrink-0`}>{st.label}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(t.updated_at).toLocaleDateString('de-DE')}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat View */}
      <div className={`${selectedTicket ? 'flex' : 'hidden md:flex'} flex-col flex-1 border border-border rounded-lg overflow-hidden`}>
        {!selectedTicket ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Wähle ein Ticket aus der Liste.</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : ticketDetail ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-3 border-b border-border bg-card/50 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 cursor-pointer"
                onClick={() => setSelectedTicket(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {ticketDetail.image_path && (
                <img src={ticketDetail.image_path} alt="" className="h-10 w-14 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {ticketDetail.brand} {ticketDetail.model}
                </p>
              </div>
              {ticketDetail.status !== 'completed' && ticketDetail.status !== 'cancelled' && (
                <div className="flex items-center gap-1">
                  {ticketDetail.status === 'open' && hasRole('mitarbeiter') && (
                    <Button size="sm" variant="outline" className="text-xs h-7 cursor-pointer"
                      onClick={() => updateTicketStatus(ticketDetail.id, 'in_progress')}>
                      Annehmen
                    </Button>
                  )}
                  
                  {(ticketDetail.customer_id === user.id || 
                    ticketDetail.assigned_to === user.id || 
                    hasRole('inhaber')) && (
                    <Button 
                      size="sm" 
                      variant={ticketDetail.status === 'open' && ticketDetail.customer_id === user.id ? "outline" : "default"} 
                      className="text-xs h-7 cursor-pointer"
                      onClick={() => updateTicketStatus(ticketDetail.id, 'completed')}
                    >
                      {ticketDetail.status === 'open' && ticketDetail.customer_id === user.id ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1" /> Anfrage zurückziehen
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Abschließen
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Catalog pricing (only for mitarbeiter) */}
            {hasRole('mitarbeiter') && ticketDetail.catalog && (
              <div className="px-3 py-2 bg-muted/30 border-b border-border text-xs flex gap-4 flex-wrap shrink-0">
                <span>💰 Min: <strong>${ticketDetail.catalog.min_sell_price?.toLocaleString()}</strong></span>
                <span>Max: <strong>${ticketDetail.catalog.max_sell_price?.toLocaleString()}</strong></span>
                <span>Zwischenh.: <strong>${ticketDetail.catalog.dealer_price?.toLocaleString()}</strong></span>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {ticketDetail.messages?.map(msg => {
                  const isMe = msg.sender_id === user.id;
                  const isStaff = ['superadmin', 'stv_admin', 'inhaber', 'mitarbeiter'].includes(msg.sender_role);
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <Avatar className="h-7 w-7 shrink-0 mt-1">
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                            {msg.sender_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && (
                          <p className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
                            {msg.sender_name}
                            {isStaff && <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">Staff</Badge>}
                          </p>
                        )}
                        <div className={`rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        }`}>
                          {msg.message}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(msg.created_at).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            {ticketDetail.status !== 'completed' && ticketDetail.status !== 'cancelled' && (
              <div className="p-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nachricht schreiben..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!message.trim() || sending}
                    size="icon"
                    className="shrink-0 cursor-pointer"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
