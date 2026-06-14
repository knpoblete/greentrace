import { Link } from 'react-router-dom';
import { StatusPill, StandardBadges, STANDARD_LABELS, TxLink, SimBadge, timeAgo, fmtAmount } from './ui.jsx';

function CovenantList({ bond }) {
  const cap = bond.covenants?.maxEmissions;
  const planned = bond.covenants?.milestones || [];
  const done = bond.completedMilestones || [];
  const emissionsPass = bond.greenStatus !== 'BREACH';
  const stds = (bond.standards || []).map((s) => STANDARD_LABELS[s] || s).join(', ');
  const items = [
    { label: cap ? `Emissions ≤ ${cap} tCO₂e` : 'Emissions', pass: emissionsPass },
    { label: `Milestones ${done.length}/${planned.length}`, pass: done.length > 0 },
    { label: `Standards: ${stds}`, pass: true },
  ];
  return (
    <ul className="space-y-1 mt-3">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-gray-400">
          <span className={it.pass ? 'text-compliant' : 'text-breach'}>{it.pass ? '✓' : '✗'}</span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export default function BondCard({ bond }) {
  const e = bond.escrow || {};
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{bond.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <StandardBadges standards={bond.standards} />
            <span className="text-[11px] text-gray-500">{bond.projectType?.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <StatusPill status={bond.greenStatus} />
      </div>

      {bond.pendingReview && (
        <div className="mt-3 text-xs flex items-center gap-1.5 text-atrisk bg-atrisk/10 border border-atrisk/30 rounded-lg px-2.5 py-1.5">
          ⚠ Agent flagged — verifier review pending (recommend {bond.recommendedStatus})
        </div>
      )}

      <CovenantList bond={bond} />

      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-gray-500">Escrow locked</div>
          <div className="text-gray-200 font-medium">{fmtAmount(e.totalLocked)} RLUSD</div>
        </div>
        <div>
          <div className="text-gray-500">Released</div>
          <div className="text-gray-200 font-medium">{fmtAmount(e.released)} RLUSD</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={bond.verified ? 'text-compliant' : 'text-gray-500'}>
          {bond.verified ? '🛡 Verified by KPMG' : 'Not verified'}
        </span>
        <span className="text-gray-600">{timeAgo(bond.lastChecked)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TxLink hash={bond.txHash} label="MPT" simulated={bond.simulated} />
          <SimBadge simulated={bond.simulated} />
        </div>
        <Link to={`/bonds/${bond.id}`} className="btn-ghost py-1 px-3 text-xs">View Detail →</Link>
      </div>
    </div>
  );
}
