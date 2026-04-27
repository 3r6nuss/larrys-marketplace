import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

const ROLE_HIERARCHY = {
  superadmin: 5,
  stv_admin: 4,
  inhaber: 3,
  mitarbeiter: 2,
  kunde: 1,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    window.location.href = '/api/auth/discord';
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = '/';
  };

  const hasRole = useCallback((minRole) => {
    if (!user) return false;
    return (ROLE_HIERARCHY[user.role] || 0) >= (ROLE_HIERARCHY[minRole] || 999);
  }, [user]);

  const isBlocked = user?.is_blocked ?? false;

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    hasRole,
    isBlocked,
    refetchUser: fetchUser,
  }), [user, loading, hasRole, isBlocked, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

export { ROLE_HIERARCHY };
