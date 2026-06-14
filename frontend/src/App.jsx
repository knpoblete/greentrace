import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import IssueBond from './components/IssueBond.jsx';
import BondDetail from './components/BondDetail.jsx';
import AgentLog from './components/AgentLog.jsx';
import SeedingBanner from './components/SeedingBanner.jsx';
import { getHealth } from './api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/issue', label: 'Issue Bond', icon: '＋' },
  { to: '/agent', label: 'Compliance Monitor', icon: '⟳' },
];

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
    <div className="px-4 py-3 mt-auto border-t border-border text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-compliant' : 'bg-breach'}`} />
        XRPL Devnet {connected ? 'connected' : 'offline'}
      </div>
      {health?.domain?.domainId && (
        <div className="mt-1 font-mono truncate" title={health.domain.domainId}>
          domain {health.domain.domainId.slice(0, 10)}…
        </div>
      )}
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col fixed h-screen">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <span>🌿</span> GreenTrace
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Green Bond Verification · XRPL</div>
        </div>
        <nav className="p-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-compliant/15 text-compliant' : 'text-gray-400 hover:text-gray-100 hover:bg-surface2'
                }`}>
              <span className="w-4 text-center">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <HealthDot />
      </aside>

      <main className="flex-1 ml-60 min-w-0">
        <SeedingBanner />
        <Routes location={loc}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/issue" element={<IssueBond />} />
          <Route path="/bonds/:id" element={<BondDetail />} />
          <Route path="/agent" element={<AgentLog />} />
        </Routes>
      </main>
    </div>
  );
}
