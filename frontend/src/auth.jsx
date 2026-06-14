import { createContext, useContext, useState, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthCtx = createContext(null);
const KEY = 'gt_auth';

// Role → label, icon, and home route. Drives nav + redirects across the app.
export const ROLE_META = {
  treasury: { label: 'Treasury', icon: '🏛', home: '/' },
  investor: { label: 'Investor', icon: '💼', home: '/marketplace' },
  verifier: { label: 'Verifier · KPMG', icon: '🔍', home: '/review' },
};

function readStored() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStored);

  const login = useCallback((session) => {
    localStorage.setItem(KEY, JSON.stringify(session));
    setAuth(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setAuth(null);
  }, []);

  return <AuthCtx.Provider value={{ auth, role: auth?.role || null, login, logout }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

/**
 * Gate a route to logged-in users. With `roles`, a logged-in user lacking the role is redirected to
 * their own home (so e.g. an investor hitting "/" lands on the marketplace).
 */
export function ProtectedRoute({ children, roles }) {
  const { auth } = useAuth();
  const loc = useLocation();
  if (!auth) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(auth.role)) return <Navigate to={ROLE_META[auth.role].home} replace />;
  return children;
}
