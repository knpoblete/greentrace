import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buyBond } from '../api';
import { TxLink, SimBadge, ActorTag } from './ui.jsx';

function Steps({ steps }) {
  return (
    <div className="mt-2 space-y-1">
      {steps?.map((s, i) => (
        <div key={i} className="flex items-center justify-between gap-2 bg-surface2 rounded px-2 py-1 text-xs">
          <span className="text-gray-400 truncate">{s.step}</span>
          <span className="flex items-center gap-1 shrink-0">
            {s.failed && <span className="text-breach font-mono">{s.code}</span>}
            <TxLink hash={s.txHash} label="" simulated={s.simulated} />
            <SimBadge simulated={s.simulated} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Investor purchase. The logged-in investor buys with their own (credentialed) wallet — one wallet,
 * one button. A separate, clearly-labelled demo shows the permissioned-domain gate rejecting an
 * uncredentialed wallet on-chain (tecNO_AUTH).
 */
export default function BondAccess({ bond }) {
  const nav = useNavigate();
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(null);
  const [error, setError] = useState(null);

  const [demoBusy, setDemoBusy] = useState(false);
  const [demo, setDemo] = useState(null);
  const [showDemo, setShowDemo] = useState(false);

  const buy = async () => {
    setBuying(true); setError(null);
    try {
      const r = await buyBond(bond.id, 'investor');
      setBought(r.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setBuying(false); }
  };

  const runDemo = async () => {
    setDemoBusy(true);
    try { const r = await buyBond(bond.id, 'buyer'); setDemo(r.data); }
    catch (e) { setDemo({ accepted: false, onChainCode: 'ERROR', reason: e.response?.data?.error || e.message, steps: [] }); }
    finally { setDemoBusy(false); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Buy this bond</h3>
        <ActorTag actor="investor" />
      </div>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Purchase with your wallet and settle in RLUSD. Holding a green bond requires a verifier-issued
        credential (you're KYC-verified) — that's what admits you to the permissioned compliance domain.
      </p>

      {!bought ? (
        <button className="btn-primary w-full" onClick={buy} disabled={buying}>
          {buying ? 'Purchasing on-chain…' : 'Buy this bond'}
        </button>
      ) : bought.accepted ? (
        <div className="text-xs">
          <div className="font-semibold text-compliant">✓ Purchased · {bought.onChainCode}</div>
          <p className="text-gray-400 mt-1">{bought.reason}</p>
          <Steps steps={bought.steps} />
          <button className="btn-ghost w-full mt-3 py-1.5" onClick={() => nav('/portfolio')}>View in My Wallet →</button>
        </div>
      ) : (
        <div className="text-xs">
          <div className="font-semibold text-breach">⛔ {bought.onChainCode}</div>
          <p className="text-gray-400 mt-1">{bought.reason}</p>
          <Steps steps={bought.steps} />
        </div>
      )}
      {error && <div className="mt-2 text-xs text-breach">⚠ {error}</div>}

      {/* Permissioned-access demo — distinct from the user's own purchase. */}
      <div className="mt-4 pt-3 border-t border-border">
        <button className="text-[11px] text-gray-500 hover:text-gray-300" onClick={() => setShowDemo((v) => !v)}>
          {showDemo ? '▾' : '▸'} Demo: what happens if a wallet without a credential tries to buy?
        </button>
        {showDemo && (
          <div className="mt-2">
            <button className="btn-ghost py-1 px-3 text-xs" onClick={runDemo} disabled={demoBusy}>
              {demoBusy ? 'Attempting…' : 'Attempt as an unverified wallet'}
            </button>
            {demo && (
              <div className="mt-2 text-xs">
                <div className={`font-semibold ${demo.accepted ? 'text-compliant' : 'text-breach'}`}>
                  {demo.accepted ? '✓ ACCEPTED' : '⛔ REJECTED'} · {demo.onChainCode}
                </div>
                <p className="text-gray-500 mt-1">{demo.reason}</p>
                <Steps steps={demo.steps} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
