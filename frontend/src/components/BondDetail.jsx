import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBond } from '../api';
import { useAuth, ROLE_META } from '../auth.jsx';
import { Spinner, ErrorBox, StatusPill, StandardBadges, TxLink, SimBadge, SourceTag, SourceLegend, ActorTag } from './ui.jsx';
import EscrowPanel from './EscrowPanel.jsx';
import InstrumentPanel from './InstrumentPanel.jsx';
import CredentialBadge from './CredentialBadge.jsx';
import AuditTrail from './AuditTrail.jsx';
import BondAccess from './BondAccess.jsx';
import VaultPanel from './VaultPanel.jsx';
import RlusdPanel from './RlusdPanel.jsx';
import VerifierReview from './VerifierReview.jsx';

export default function BondDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  const [bond, setBond] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getBond(id).then((r) => setBond(r.data)).catch((e) => setError(e.response?.data?.error || e.message));
  }, [id]);

  useEffect(() => { load(); const p = setInterval(load, 6000); return () => clearInterval(p); }, [load]);

  if (error) return <div className="p-8"><ErrorBox error={error} onRetry={load} /></div>;
  if (!bond) return <div className="p-8"><Spinner /></div>;

  const back = ROLE_META[role]?.home || '/';

  return (
    <div className="p-8 max-w-[1200px]">
      <Link to={back} className="text-xs text-gray-500 hover:text-gray-300">← Back</Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{bond.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StandardBadges standards={bond.standards} />
            <span className="text-sm text-gray-500">{bond.projectType?.replace(/_/g, ' ')}</span>
            <TxLink hash={bond.txHash} label="MPT issuance" simulated={bond.simulated} />
            <SimBadge simulated={bond.simulated} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={bond.greenStatus} />
          <SourceTag source="verifier-attested" />
          <Link to={`/certificate/${bond.id}`} className="btn-ghost py-1 px-3 text-xs">Certificate →</Link>
        </div>
      </div>

      <div className="mb-3"><SourceLegend /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <InstrumentPanel instrument={bond.instrument} />
          {role === 'verifier' && <VerifierReview bond={bond} onChange={load} />}
          {role !== 'verifier' && bond.pendingReview && (
            <div className="card p-4 border-atrisk/40 bg-atrisk/5 text-sm text-atrisk">
              ⚠ Monitor flagged this bond (recommend {bond.recommendedStatus}) — awaiting KPMG attestation.
            </div>
          )}
          <EscrowPanel bond={bond} onChange={load} canRelease={role === 'treasury'} />
          {role === 'investor' && <VaultPanel bond={bond} />}
          {role === 'investor' && <BondAccess bond={bond} />}
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">Credentials (XLS-70) <SourceTag source="on-chain" /></h3>
            <div className="space-y-3">
              {bond.credentials?.length
                ? bond.credentials.map((c) => <CredentialBadge key={c.id} credential={c} />)
                : <div className="card p-4 text-xs text-gray-600">No credentials on this bond.</div>}
            </div>
          </div>
          {role !== 'verifier' && <RlusdPanel />}
        </div>
      </div>

      <div className="mt-6">
        <AuditTrail events={bond.auditTrail} />
      </div>
    </div>
  );
}
