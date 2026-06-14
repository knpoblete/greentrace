import { useState } from 'react';
import { releaseEscrow } from '../api';
import { TxLink, SimBadge, SourceTag, ActorTag, fmtAmount, ErrorBox } from './ui.jsx';

export default function EscrowPanel({ bond, onChange, canRelease = true }) {
  const e = bond.escrow || {};
  const all = e.allMilestones || [];
  const released = e.completedMilestones || [];
  const completable = new Set(bond.completedMilestones || []); // milestones the agent marks done
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastTx, setLastTx] = useState(null);

  const release = async (m) => {
    setBusy(m); setError(null);
    try {
      const r = await releaseEscrow({ bondId: bond.id, milestone: m });
      if (!r.data.released) setError(r.data.reason);
      else setLastTx(r.data);
      onChange?.();
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold flex items-center gap-2">Escrow (TokenEscrow · XLS-85) <SourceTag source="on-chain" /> <ActorTag actor="treasury" /></h3>
        <SimBadge simulated={e.simulated} />
      </div>
      <div className="grid grid-cols-3 gap-3 my-3 text-sm">
        <div><div className="text-xs text-gray-500">Locked</div><div className="font-medium">{fmtAmount(e.totalLocked)}</div></div>
        <div><div className="text-xs text-gray-500">Released</div><div className="font-medium text-compliant">{fmtAmount(e.released)}</div></div>
        <div><div className="text-xs text-gray-500">Total</div><div className="font-medium">{fmtAmount(e.amount)} RLUSD</div></div>
      </div>

      <ErrorBox error={error} />

      <div className="space-y-2 mt-2">
        {all.map((m) => {
          const done = released.includes(m);
          const eligible = completable.has(m);
          return (
            <div key={m} className="flex items-center justify-between bg-surface2 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={done ? 'text-compliant' : eligible ? 'text-atrisk' : 'text-gray-600'}>
                  {done ? '✓' : eligible ? '◐' : '○'}
                </span>
                <span className="capitalize">{m}</span>
                {!done && !eligible && <span className="text-[11px] text-gray-600">(milestone not yet met)</span>}
              </div>
              {done ? (
                <span className="text-xs text-compliant">released</span>
              ) : !canRelease ? (
                <span className="text-xs text-gray-500">{eligible ? 'ready' : 'locked'}</span>
              ) : (
                <button className="btn-primary py-1 px-3 text-xs" disabled={!eligible || busy === m} onClick={() => release(m)}>
                  {busy === m ? '…' : 'Release Funds'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {lastTx && (
        <div className="mt-3 text-xs flex items-center gap-2">
          <span className="text-gray-500">EscrowFinish:</span>
          <TxLink hash={lastTx.txHash} label="tx" simulated={lastTx.simulated} />
        </div>
      )}
    </div>
  );
}
