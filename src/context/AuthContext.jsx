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

 const noCacheHeaders = useMemo(() => ({
 'Cache-Control': 'no-cache',
 Pragma: 'no-cache',
 }), []);

 const postWithCredentials = useCallback((endpoint) => {
 return fetch(endpoint, { method: 'POST', credentials: 'include' });
 }, []);

 const fetchUser = useCallback(async () => {
 try {
 const res = await fetch('/api/auth/me', {
 credentials: 'include',
 cache: 'no-store',
 headers: noCacheHeaders,
 });
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
 }, [noCacheHeaders]);

 useEffect(() => {
 fetchUser();
 }, [fetchUser]);

 const login = useCallback(() => {
 window.location.href = '/api/auth/discord';
 }, []);

 const logout = useCallback(async () => {
 try {
 await postWithCredentials('/api/auth/logout');
 } catch {
 // ignore
 }
 setUser(null);
 window.location.href = '/';
 }, [postWithCredentials]);

 const completeOnboarding = useCallback(async () => {
 try {
 const res = await postWithCredentials('/api/users/onboarding-complete');
 if (res.ok) {
 setUser(prev => prev ? { ...prev, has_completed_onboarding: 1 } : null);
 }
 } catch {
 // ignore
 }
 }, [postWithCredentials]);

 const resetOnboarding = useCallback(async () => {
 try {
 const res = await postWithCredentials('/api/users/onboarding-reset');
 if (res.ok) {
 setUser(prev => prev ? { ...prev, has_completed_onboarding: 0 } : null);
 }
 } catch {
 // ignore
 }
 }, [postWithCredentials]);

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
 completeOnboarding,
 resetOnboarding,
 }), [
 user,
 loading,
 login,
 logout,
 hasRole,
 isBlocked,
 fetchUser,
 completeOnboarding,
 resetOnboarding,
 ]);

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
