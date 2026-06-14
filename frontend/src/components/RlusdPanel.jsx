import { useEffect, useState } from 'react';
import { getRlusdStatus, payRlusd } from '../api';
import { TxLink, SimBadge } from './ui.jsx';

export default function RlusdPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState(null);

  const load = () => getRlusdStatus().then((r) => setStatus(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const doPay = async () => {
    setBusy(true);
    try { const r = await payRlusd({ amount: '100' }); setPay(r.data); load(); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">RLUSD Proceeds</h3>
        <a href={status?.faucet || 'https://tryrlusd.com'} target="_blank" rel="noreferrer"
           className="text-xs text-emerald-400 underline decoration-dotted">top up at tryrlusd.com ↗</a>
      </div>
      <p className="text-[11px] text-gray-500 mt-1 font-mono truncate" title={status?.issuer}>
        issuer {status?.issuer}
      </p>

      <div className="mt-3 space-y-1.5">
        {status?.wallets?.map((w) => (
          <div key={w.role} className="flex items-center justify-between text-xs">
            <span className="capitalize text-gray-400">{w.role}</span>
            <span className="flex items-center gap-2">
              <span className={w.hasTrustline ? 'text-compliant' : 'text-gray-600'}>
                {w.hasTrustline ? 'trustline ✓' : 'no trustline'}
              </span>
              <span className="text-gray-200 font-medium">{Number(w.rlusd).toLocaleString()} RLUSD</span>
            </span>
          </div>
        ))}
      </div>

      <button className="btn-primary mt-4 w-full" onClick={doPay} disabled={busy}>
        {busy ? 'Paying…' : 'Pay 100 RLUSD proceeds (investor → issuer)'}
      </button>

      {pay && (
        <div className="mt-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Payment · {pay.asset}</span>
            <span className="flex items-center gap-2"><TxLink hash={pay.txHash} label="tx" simulated={pay.simulated} /><SimBadge simulated={pay.simulated} /></span>
          </div>
          {pay.fellBack && (
            <p className="text-amber-400/80 mt-1">
              Wallet held no canonical RLUSD — used the self-issued RLUSD IOU. Top up at tryrlusd.com for a fully-real RLUSD payment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
