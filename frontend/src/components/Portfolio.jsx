import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolio } from '../api';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorBox, StatusPill, TxLink, fmtAmount } from './ui.jsx';

// Investor wallet view — address, balances, KYC credential, and bonds held (queried on-chain).
export default function Portfolio() {
  const { role } = useAuth();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getPortfolio(role).then((r) => setP(r.data)).catch((e) => setError(e.response?.data?.error || e.message));
  }, [role]);
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  if (error) return <div className="p-8"><ErrorBox error={error} onRetry={load} /></div>;
  if (!p) return <div className="p-8"><Spinner /></div>;

  return (
    <div className="p-8 max-w-[1000px]">
      <h1 className="text-2xl font-bold">My Wallet</h1>
      <p className="text-sm text-gray-500 mb-6">Your XRPL wallet, balances, credential, and bond holdings.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gray-500">XRP balance</div>
          <div className="text-2xl font-bold mt-1">{Number(p.xrp).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">RLUSD balance</div>
          <div className="text-2xl font-bold mt-1">{fmtAmount(p.rlusd)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500">KYC status</div>
          <div className={`text-2xl font-bold mt-1 ${p.kyc ? 'text-compliant' : 'text-breach'}`}>{p.kyc ? '✓ Verified' : 'Not verified'}</div>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="text-xs text-gray-500">Wallet address</div>
        <a href={`https://devnet.xrpl.org/accounts/${p.address}`} target="_blank" rel="noreferrer"
           className="font-mono text-sm text-emerald-400 hover:text-emerald-300 break-all">{p.address}</a>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.credentials?.map((c) => (
            <span key={c.type} className="pill bg-compliant/15 text-compliant flex items-center gap-1">
              🛡 {c.type} <TxLink hash={c.txHash} label="" simulated={c.simulated} />
            </span>
          ))}
        </div>
      </div>

      <h3 className="font-semibold mb-3">My Holdings</h3>
      {p.holdings?.length ? (
        <div className="space-y-2">
          {p.holdings.map((h) => (
            <div key={h.mptIssuanceId} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{h.bondName}</div>
                <div className="text-[11px] text-gray-500 font-mono truncate">{h.amount} units · {h.mptIssuanceId?.slice(0, 16)}…</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {h.greenStatus && <StatusPill status={h.greenStatus} />}
                {h.bondId && <Link to={`/bonds/${h.bondId}`} className="btn-ghost py-1 px-3 text-xs">View →</Link>}
                {h.bondId && <Link to={`/certificate/${h.bondId}`} className="btn-ghost py-1 px-3 text-xs">Certificate</Link>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-gray-500">
          No bonds held yet. Browse the <Link to="/marketplace" className="text-emerald-400">Marketplace</Link> to buy one.
        </div>
      )}
    </div>
  );
}
