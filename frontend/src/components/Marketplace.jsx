import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getBonds } from '../api';
import { Spinner, ErrorBox, StatusPill, StandardBadges, fmtAmount } from './ui.jsx';

// Investor home — browse green bonds available to buy. Each card links to the bond's purchase page.
export default function Marketplace() {
  const [bonds, setBonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getBonds().then((r) => setBonds(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); const p = setInterval(load, 5000); return () => clearInterval(p); }, [load]);

  return (
    <div className="p-8 max-w-[1200px]">
      <h1 className="text-2xl font-bold">Green Bond Marketplace</h1>
      <p className="text-sm text-gray-500 mb-6">Browse verified green bonds and purchase with RLUSD. Only credentialed (KYC'd) investors can hold a bond.</p>

      <ErrorBox error={error} onRetry={load} />

      {loading ? <Spinner /> : bonds.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">No bonds available yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bonds.map((b) => {
            const e = b.escrow || {};
            return (
              <div key={b.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold truncate">{b.name}</h3>
                  <StatusPill status={b.greenStatus} />
                </div>
                <div className="mt-2"><StandardBadges standards={b.standards} /></div>
                <div className="mt-3 text-xs text-gray-500">{b.projectType?.replace(/_/g, ' ')}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-gray-500">Coupon</div><div className="text-gray-200 font-medium">{b.instrument?.coupon ? `${b.instrument.coupon}%` : '—'}</div></div>
                  <div><div className="text-gray-500">Maturity</div><div className="text-gray-200 font-medium">{b.instrument?.maturity || '—'}</div></div>
                  <div><div className="text-gray-500">Escrow</div><div className="text-gray-200 font-medium">{fmtAmount(e.amount)} RLUSD</div></div>
                  <div><div className="text-gray-500">Verified</div><div className={b.verified ? 'text-compliant font-medium' : 'text-gray-500'}>{b.verified ? 'KPMG ✓' : 'No'}</div></div>
                </div>
                <Link to={`/bonds/${b.id}`} className="btn-primary mt-4 text-sm">View & Buy →</Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
