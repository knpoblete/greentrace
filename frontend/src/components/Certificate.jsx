import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBond } from '../api';
import { Spinner, ErrorBox, StandardBadges, TxLink, timeAgo } from './ui.jsx';

// Read-only green certificate for a bond, built from its on-chain KPMG credential. Shareable artifact.
export default function Certificate() {
  const { id } = useParams();
  const [bond, setBond] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { getBond(id).then((r) => setBond(r.data)).catch((e) => setError(e.response?.data?.error || e.message)); }, [id]);

  if (error) return <div className="p-8"><ErrorBox error={error} /></div>;
  if (!bond) return <div className="p-8"><Spinner /></div>;

  const cred = (bond.credentials || []).find((c) => c.type === 'GreenBondVerified' && c.status === 'ACTIVE');
  const i = bond.instrument || {};
  const valid = bond.verified && cred;

  return (
    <div className="p-8 max-w-[760px]">
      <Link to={`/bonds/${bond.id}`} className="text-xs text-gray-500 hover:text-gray-300">← Bond detail</Link>

      <div className={`card mt-3 p-8 ${valid ? 'border-compliant/40' : 'border-breach/40'}`}>
        <div className="text-center border-b border-border pb-5">
          <div className="text-3xl">{valid ? '🌿' : '⛔'}</div>
          <h1 className="text-xl font-bold mt-2">Green Bond Certificate</h1>
          <p className="text-sm text-gray-500">{valid ? 'Verified green status, attested on-chain' : 'No active green certificate'}</p>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <Row k="Instrument" v={bond.name} />
          <Row k="ISIN" v={<span className="font-mono">{i.isin || '—'}</span>} />
          <Row k="Frameworks" v={<StandardBadges standards={bond.standards} />} />
          <Row k="Verified by" v={cred?.fields?.Verified_By || 'KPMG'} />
          <Row k="Verify score" v={i.verifyScore != null ? `${i.verifyScore}/100` : '—'} />
          <Row k="Status" v={<span className={valid ? 'text-compliant font-semibold' : 'text-breach font-semibold'}>{bond.greenStatus}</span>} />
          {cred && Object.entries(cred.fields || {})
            .filter(([k]) => /Taxonomy|ICMA|Climate|Bond_Status/i.test(k))
            .map(([k, v]) => <Row key={k} k={k.replace(/_/g, ' ')} v={<span className="text-compliant">✓ {String(v).replace(/_/g, ' ')}</span>} />)}
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-gray-500">
          <span>Issued {timeAgo(bond.createdAt)}</span>
          <span className="flex items-center gap-2">
            <TxLink hash={cred?.txHash} label="credential" simulated={cred?.simulated} />
            <TxLink hash={bond.txHash} label="MPT" simulated={bond.simulated} />
          </span>
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
    <span className="text-gray-500">{k}</span>
    <span className="text-gray-100 text-right">{v}</span>
  </div>
);
