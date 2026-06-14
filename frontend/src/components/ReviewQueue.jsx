import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getBonds, triggerAgent } from '../api';
import { Spinner, ErrorBox, StatusPill, ActorTag, fmtAmount } from './ui.jsx';

// Verifier (KPMG) home — bonds the compliance monitor flagged for review come first; attest on a bond page.
export default function ReviewQueue() {
  const [bonds, setBonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getBonds().then((r) => setBonds(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const p = setInterval(load, 5000); return () => clearInterval(p); }, [load]);

  const runMonitor = async () => { setRunning(true); try { await triggerAgent(); load(); } catch (e) { setError(e.message); } finally { setRunning(false); } };

  const flagged = bonds.filter((b) => b.pendingReview);
  const rest = bonds.filter((b) => !b.pendingReview);

  const Row = ({ b }) => (
    <Link to={`/bonds/${b.id}`} className="flex items-center justify-between gap-3 card p-4 hover:border-gray-600 transition-colors">
      <div className="min-w-0">
        <div className="font-medium truncate">{b.name}</div>
        <div className="text-[11px] text-gray-500">{fmtAmount(b.escrow?.amount)} RLUSD · {b.standards?.length || 0} standards</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {b.pendingReview && <span className="pill bg-atrisk/15 text-atrisk">recommend {b.recommendedStatus}</span>}
        <StatusPill status={b.greenStatus} />
        <span className="text-xs text-gray-500">{b.pendingReview ? 'Attest →' : 'View →'}</span>
      </div>
    </Link>
  );

  return (
    <div className="p-8 max-w-[1000px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">Review Queue <ActorTag actor="verifier" /></h1>
        <button className="btn-ghost" onClick={runMonitor} disabled={running}>{running ? 'Checking…' : '⟳ Run Monitor'}</button>
      </div>
      <p className="text-sm text-gray-500 mb-6">As the verifier (KPMG), review bonds the compliance monitor flagged and attest their green status on-chain.</p>

      <ErrorBox error={error} onRetry={load} />

      {loading ? <Spinner /> : (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-atrisk mb-2">Needs review ({flagged.length})</h3>
            {flagged.length === 0 ? <div className="text-xs text-gray-600">Nothing flagged — run the monitor to re-check.</div>
              : <div className="space-y-2">{flagged.map((b) => <Row key={b.id} b={b} />)}</div>}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">All bonds ({rest.length})</h3>
            <div className="space-y-2">{rest.map((b) => <Row key={b.id} b={b} />)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
