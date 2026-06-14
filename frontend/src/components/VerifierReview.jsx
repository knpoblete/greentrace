import { useState } from 'react';
import { attestBond } from '../api';
import { StatusPill, TxLink, SimBadge, SourceTag, ActorTag } from './ui.jsx';

/**
 * The verifier (KPMG) attestation step. The agent only MONITORS and flags; this is the
 * credentialed-reviewer action that finalises a status change on-chain (issue/revoke credential).
 */
export default function VerifierReview({ bond, onChange }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const attest = async () => {
    setBusy(true); setError(null);
    try {
      const r = await attestBond(bond.id);
      setResult(r.data);
      onChange?.();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  const pending = bond.pendingReview;

  return (
    <div className={`card p-5 ${pending ? 'border-atrisk/50 bg-atrisk/5' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">Verifier Review <ActorTag actor="verifier" /></h3>
        <span className="text-[11px] text-gray-500">ESMA-registered reviewer · KPMG</span>
      </div>

      {pending ? (
        <div className="mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-atrisk">⚠ Agent flagged for review</span>
            <span className="text-gray-500">recommends</span>
            <StatusPill status={bond.recommendedStatus} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            The monitoring agent does not change status on its own. A credentialed reviewer must attest
            the change on-chain (issue or revoke the green credential).
          </p>
          <button className="btn-primary mt-3" onClick={attest} disabled={busy}>
            {busy ? 'Attesting on-chain…' : `Attest as KPMG → ${bond.recommendedStatus}`}
          </button>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-400">
          No pending review. Current attested status: <StatusPill status={bond.greenStatus} />
          <button className="btn-ghost mt-3 py-1 px-3 text-xs block" onClick={attest} disabled={busy}>
            {busy ? 'Re-attesting…' : 'Re-attest now'}
          </button>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-breach">⚠ {error}</div>}
      {result && (
        <div className="mt-3 text-xs flex items-center gap-2">
          <span className="text-gray-500">{result.actionTaken}</span>
          <TxLink hash={result.txHash} label="tx" simulated={result.simulated} />
          <SimBadge simulated={result.simulated} />
        </div>
      )}
    </div>
  );
}
