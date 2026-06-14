import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getBonds, getAgentLogs, triggerAgent, subscribeAgentStream } from '../api';
import BondCard from './BondCard.jsx';
import { Spinner, ErrorBox, StatusPill, SourceLegend, timeAgo, fmtAmount } from './ui.jsx';

function Summary({ bonds }) {
  const totalEscrow = bonds.reduce((s, b) => s + Number(b.escrow?.amount || 0), 0);
  const atRisk = bonds.filter((b) => b.greenStatus !== 'COMPLIANT').length;
  const stats = [
    { label: 'Total Bonds', value: bonds.length },
    { label: 'RLUSD in Escrow', value: fmtAmount(totalEscrow) },
    { label: 'Bonds at Risk', value: atRisk, danger: atRisk > 0 },
    { label: 'Verified', value: bonds.filter((b) => b.verified).length },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="card p-4">
          <div className="text-xs text-gray-500">{s.label}</div>
          <div className={`text-2xl font-bold mt-1 ${s.danger ? 'text-breach' : 'text-gray-100'}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function AgentFeed({ events }) {
  return (
    <div className="card p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Agent Activity</h3>
        <span className="text-[11px] text-gray-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-compliant animate-pulse" /> live
        </span>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-auto">
        {events.length === 0 && <div className="text-xs text-gray-600">Waiting for agent cycles…</div>}
        {events.map((e, i) => (
          <div key={i} className="text-xs border-b border-border/60 pb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-200 truncate">{e.bondName}</span>
              <span className="text-gray-600">{timeAgo(e.ts)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {e.prevStatus !== e.status ? (
                <><StatusPill status={e.prevStatus} /><span className="text-gray-600">→</span><StatusPill status={e.status} /></>
              ) : (
                <StatusPill status={e.status} />
              )}
            </div>
            {e.actionTaken && e.actionTaken !== 'no change' && (
              <div className="mt-1 text-amber-400">↳ {e.actionTaken}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [bonds, setBonds] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([getBonds(), getAgentLogs()])
      .then(([b, l]) => { setBonds(b.data); setEvents(l.data.slice(0, 12)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const es = subscribeAgentStream((evt) => {
      if (!evt.bondName) return;
      setEvents((prev) => [evt, ...prev].slice(0, 12));
      load();
    });
    return () => { clearInterval(poll); es.close(); };
  }, [load]);

  const runAgent = async () => {
    setRunning(true);
    try { await triggerAgent(); load(); } catch (e) { setError(e.message); }
    finally { setRunning(false); }
  };

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Treasury Dashboard</h1>
          <p className="text-sm text-gray-500">The <strong>treasury (issuer)</strong> view — live green compliance of every bond it has issued. Open a bond to see the investor purchase, verifier review, and escrow.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={runAgent} disabled={running}>
            {running ? 'Running…' : '⟳ Run Agent Now'}
          </button>
          <Link to="/issue" className="btn-ghost">＋ Issue Bond</Link>
        </div>
      </div>

      <ErrorBox error={error} onRetry={load} />

      {loading ? <Spinner /> : bonds.length === 0 ? (
        <div className="card p-10 mt-4 text-center">
          <div className="flex justify-center mb-4">
            <span className="w-8 h-8 border-2 border-gray-700 border-t-compliant rounded-full animate-spin" />
          </div>
          <h3 className="font-semibold text-gray-200">Setting up the demo on XRPL Devnet…</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Funding wallets, issuing bonds as MPTokens, locking escrow, and posting green credentials
            on-chain. This takes ~2 minutes on a cold start and refreshes automatically — no need to reload.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 mt-4">
          <div>
            <Summary bonds={bonds} />
            <div className="mb-4"><SourceLegend /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bonds.map((b) => <BondCard key={b.id} bond={b} />)}
            </div>
          </div>
          <AgentFeed events={events} />
        </div>
      )}
    </div>
  );
}
