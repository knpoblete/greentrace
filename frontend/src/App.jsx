import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import IssueBond from './components/IssueBond.jsx';
import BondDetail from './components/BondDetail.jsx';
import AgentLog from './components/AgentLog.jsx';
import Marketplace from './components/Marketplace.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import Certificate from './components/Certificate.jsx';
import Login from './components/Login.jsx';
import SeedingBanner from './components/SeedingBanner.jsx';
import { useAuth, ProtectedRoute, ROLE_META } from './auth.jsx';
import { getHealth } from './api';

// Sidebar items per role.
const NAV = {
  treasury: [
    { to: '/', label: 'Dashboard', icon: '▦', end: true },
    { to: '/issue', label: 'Issue Bond', icon: '＋' },
    { to: '/monitor', label: 'Compliance Monitor', icon: '⟳' },
  ],
  investor: [
    { to: '/marketplace', label: 'Marketplace', icon: '🛒' },
  ],
  verifier: [
    { to: '/review', label: 'Review Queue', icon: '✓' },
    { to: '/monitor', label: 'Compliance Monitor', icon: '⟳' },
  ],
};

function HealthDot() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    const tick = () => getHealth().then((r) => setHealth(r.data)).catch(() => setHealth(null));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);
  const connected = health?.xrpl?.connected;
  return (
    <div className="px-4 py-3 border-t border-border text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-compliant' : 'bg-breach'}`} />
        XRPL Devnet {connected ? 'connected' : 'offline'}
      </div>
    </div>
  );
}

function Persona() {
  const { auth, logout } = useAuth();
  const meta = ROLE_META[auth.role];
  return (
    <div className="px-4 py-3 mt-auto border-t border-border">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">{meta.icon}</span>
        <div className="min-w-0">
          <div className="text-gray-100 font-medium leading-tight">{meta.label}</div>
          <div className="text-[11px] text-gray-500 truncate">{auth.username}</div>
        </div>
      </div>
      <button onClick={logout} className="btn-ghost w-full mt-2 py-1.5 text-xs">Log out</button>
    </div>
  );
}

function Shell() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  const nav = NAV[auth.role] || [];

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col fixed h-screen">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-lg font-extrabold tracking-tight flex items-center gap-2"><span>🌿</span> GreenTrace</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Green Bond Verification · XRPL</div>
        </div>
        <nav className="p-3 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-compliant/15 text-compliant' : 'text-gray-400 hover:text-gray-100 hover:bg-surface2'
                }`}>
              <span className="w-4 text-center">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <Persona />
        <HealthDot />
      </aside>

      <main className="flex-1 ml-60 min-w-0">
        <SeedingBanner />
        <Routes>
          <Route path="/" element={<ProtectedRoute roles={['treasury']}><Dashboard /></ProtectedRoute>} />
          <Route path="/issue" element={<ProtectedRoute roles={['treasury']}><IssueBond /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute roles={['treasury', 'verifier']}><AgentLog /></ProtectedRoute>} />
          <Route path="/marketplace" element={<ProtectedRoute roles={['investor']}><Marketplace /></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute roles={['verifier']}><ReviewQueue /></ProtectedRoute>} />
          <Route path="/bonds/:id" element={<ProtectedRoute><BondDetail /></ProtectedRoute>} />
          <Route path="/certificate/:id" element={<ProtectedRoute><Certificate /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
