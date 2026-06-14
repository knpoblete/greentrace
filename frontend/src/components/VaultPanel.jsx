import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { depositVault } from '../api';
import { TxLink, SimBadge, fmtAmount } from './ui.jsx';

/**
 * Investor vault deposit (XLS-65). Deposit RLUSD into the bond's single-asset vault and receive MPT
 * shares. The vault then lends the proceeds to the issuer (lending leg = XLS-66, a later phase).
 */
export default function VaultPanel({ bond }) {
  const nav = useNavigate();
  const [amount, setAmount] = useState('5000');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  if (!bond.vault?.open) {
    return (
      <div className="card p-5">
        <h3 className="font-semibold">Single Asset Vault (XLS-65)</h3>
        <p className="text-xs text-gray-500 mt-1">No vault is open for this bond.</p>
      </div>
    );
  }

  const deposit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await depositVault({ bondId: bond.id, amount });
      setRes(r.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold">Deposit into Vault (XLS-65)</h3>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Deposit RLUSD into the bond's single-asset vault and receive MPT shares representing your stake.
        The vault funds the issuer's green project.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Amount (RLUSD)</label>
          <input type="number" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={deposit} disabled={busy}>{busy ? 'Depositing…' : 'Deposit'}</button>
      </div>
      {error && <div className="mt-2 text-xs text-breach">⚠ {error}</div>}
      {res && (
        <div className="mt-3 text-xs">
          <div className="text-compliant font-semibold">✓ Deposited · received {fmtAmount(res.shares)} shares</div>
          <div className="flex items-center gap-2 mt-1">
            <TxLink hash={res.txHash} label="VaultDeposit" simulated={res.simulated} /><SimBadge simulated={res.simulated} />
          </div>
          <button className="btn-ghost w-full mt-2 py-1.5" onClick={() => nav('/portfolio')}>View shares in My Wallet →</button>
        </div>
      )}
    </div>
  );
}
