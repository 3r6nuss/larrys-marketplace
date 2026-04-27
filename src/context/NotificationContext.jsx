import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

const NotificationContext = createContext({
  openTickets: 0,
  refreshNotifications: () => {}
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [openTickets, setOpenTickets] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // Fast endpoint to get ticket stats
      const res = await fetch('/api/stats/dashboard', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOpenTickets(data.open_tickets || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll every 30 seconds
      const timer = setInterval(fetchNotifications, 30000);
      return () => clearInterval(timer);
    } else {
      setOpenTickets(0);
    }
  }, [user]);

  return (
    <NotificationContext.Provider value={{ openTickets, refreshNotifications: fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};
