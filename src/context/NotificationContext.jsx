import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const NotificationContext = createContext({
 openTickets: 0,
 refreshNotifications: () => {}
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
 const { user, hasRole } = useAuth();
 const [openTickets, setOpenTickets] = useState(0);

 const fetchNotifications = async () => {
 if (!user || !hasRole('mitarbeiter')) return;
 try {
 // Fast endpoint to get ticket stats
 const res = await fetch('/api/stats/notifications', { credentials: 'include' });
 if (res.ok) {
 const data = await res.json();
 setOpenTickets(data.open_tickets || 0);
 }
 } catch (err) {
 console.error('Failed to fetch notifications:', err);
 }
 };

  useEffect(() => {
    if (user && hasRole('mitarbeiter')) {
      fetchNotifications();
      const eventSource = new EventSource('/api/stats/notifications/stream', { withCredentials: true });
      eventSource.onmessage = (event) => {
        if (event.data === 'update') fetchNotifications();
      };
      eventSource.onerror = () => eventSource.close();
      return () => eventSource.close();
    } else {
      setOpenTickets(0);
    }
  }, [user, hasRole]);

 return (
 <NotificationContext.Provider value={{ openTickets, refreshNotifications: fetchNotifications }}>
 {children}
 </NotificationContext.Provider>
 );
};
