import { useState } from 'react';
import { buyBond } from '../api';
import { TxLink, SimBadge, ActorTag } from './ui.jsx';

function ResultCard({ title, subtitle, result, busy, onBuy, accent }) {
  const accepted = result?.accepted;
  return (
    <div className={`card p-4 flex flex-col ${result ? (accepted ? 'border-compliant/40' : 'border-breach/40 bg-breach/5') : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-[11px] text-gray-500">{subtitle}</div>
        </div>
        <span className={`pill ${accent === 'green' ? 'bg-compliant/15 text-compliant' : 'bg-gray-500/15 text-gray-400'}`}>
          {accent === 'green' ? 'credentialed' : 'no credential'}
        </span>
      </div>

      <button className={accent === 'green' ? 'btn-primary mt-3' : 'btn-ghost mt-3'} disabled={busy} onClick={onBuy}>
        {busy ? 'Attempting…' : 'Attempt to Buy Bond'}
      </button>

      {result && (
        <div className="mt-3 text-xs">
          <div className={`font-semibold ${accepted ? 'text-compliant' : 'text-breach'}`}>
            {accepted ? '✓ ACCEPTED' : '⛔ REJECTED'} · {result.onChainCode}
          </div>
          <p className="text-gray-400 mt-1 leading-relaxed">{result.reason}</p>
          <div className="mt-2 space-y-1">
            {result.steps?.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-surface2 rounded px-2 py-1">
                <span className="text-gray-400 truncate">{s.step}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {s.failed && <span className="text-breach font-mono">{s.code}</span>}
                  <TxLink hash={s.txHash} label="" simulated={s.simulated} />
                  <SimBadge simulated={s.simulated} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BondAccess({ bond }) {
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(null);

  const buy = async (role) => {
    setBusy(role);
    try {
      const r = await buyBond(bond.id, role);
      setResults((p) => ({ ...p, [role]: r.data }));
    } catch (err) {
      setResults((p) => ({ ...p, [role]: { accepted: false, onChainCode: 'ERROR', reason: err.response?.data?.error || err.message, steps: [] } }));
    } finally { setBusy(null); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Investor Purchase — Permissioned Access (XLS-80 + XLS-70)</h3>
        <ActorTag actor="investor" />
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        The buyer side: an <strong>investor</strong> purchases the bond the treasury issued, settling in
        RLUSD. Only wallets holding a verifier-issued credential are members of the compliance domain and
        may hold it — an uncredentialed wallet is rejected on-chain with <span className="font-mono text-breach">tecNO_AUTH</span>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ResultCard
          title="Wallet A — Investor"
          subtitle="holds InvestorKYC credential"
          accent="green"
          result={results.investor}
          busy={busy === 'investor'}
          onBuy={() => buy('investor')}
        />
        <ResultCard
          title="Wallet B — Unverified"
          subtitle="no credential"
          accent="gray"
          result={results.buyer}
          busy={busy === 'buyer'}
          onBuy={() => buy('buyer')}
        />
      </div>
    </div>
  );
}
