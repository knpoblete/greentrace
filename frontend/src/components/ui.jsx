import { txExplorer } from '../api';

export const STATUS_STYLE = {
  COMPLIANT: { label: 'COMPLIANT', cls: 'bg-compliant/15 text-compliant', dot: 'bg-compliant' },
  AT_RISK: { label: 'AT RISK', cls: 'bg-atrisk/15 text-atrisk', dot: 'bg-atrisk' },
  BREACH: { label: 'BREACH', cls: 'bg-breach/15 text-breach', dot: 'bg-breach' },
};

export function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.COMPLIANT;
  return (
    <span className={`pill ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export const STANDARD_LABELS = {
  EU_GREEN_BOND: 'EU GREEN BOND',
  EU_TAXONOMY: 'EU TAXONOMY',
  ICMA: 'ICMA',
  CLIMATE_BONDS: 'CLIMATE BONDS',
};

export function StandardBadge({ standard }) {
  const label = STANDARD_LABELS[standard] || standard?.replace(/_/g, ' ');
  return <span className="pill bg-surface2 text-gray-300 border border-border">{label}</span>;
}

/** Render one badge per standard a bond aligns with. Accepts an array or single string. */
export function StandardBadges({ standards }) {
  const list = Array.isArray(standards) ? standards : standards ? [standards] : [];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {list.map((s) => <StandardBadge key={s} standard={s} />)}
    </span>
  );
}

// Provenance of a figure, per the business plan's verification layer.
export const SOURCES = {
  'on-chain': { label: 'on-chain', cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/30' },
  'verifier-attested': { label: 'verifier-attested', cls: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  'self-reported': { label: 'self-reported', cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/30' },
};

export function SourceTag({ source }) {
  const s = SOURCES[source];
  if (!s) return null;
  return <span className={`pill ${s.cls} !text-[10px] !px-2 !py-0.5`} title={`Source: ${s.label}`}>{s.label}</span>;
}

export function SourceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
      <span className="text-gray-400">Data source:</span>
      <span className="flex items-center gap-1.5"><SourceTag source="on-chain" /> ledger-provable</span>
      <span className="flex items-center gap-1.5"><SourceTag source="verifier-attested" /> reviewer (KPMG)</span>
      <span className="flex items-center gap-1.5"><SourceTag source="self-reported" /> issuer-reported</span>
    </div>
  );
}

// Map an agent rule to its data provenance.
export const RULE_SOURCE = {
  emissions: 'self-reported',
  milestones: 'self-reported',
  standards: 'verifier-attested',
  escrow: 'on-chain',
  attestation: 'verifier-attested',
};

export function SimBadge({ simulated }) {
  if (!simulated) return null;
  return (
    <span className="pill bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Transaction simulated (amendment unavailable or submit failed)">
      simulated
    </span>
  );
}

export function TxLink({ hash, label = 'tx', simulated }) {
  if (!hash) return <span className="text-gray-600 text-xs">—</span>;
  if (simulated) {
    return <span className="text-xs font-mono text-amber-400/80" title="Simulated transaction">{label}: {hash.slice(0, 8)}…</span>;
  }
  return (
    <a href={txExplorer(hash)} target="_blank" rel="noreferrer"
       className="text-xs font-mono text-emerald-400 hover:text-emerald-300 underline decoration-dotted">
      {label}: {hash.slice(0, 8)}…
    </a>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
      <span className="w-4 h-4 border-2 border-gray-600 border-t-compliant rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card p-4 border-breach/40 bg-breach/5 text-sm text-red-300 flex items-center justify-between">
      <span>⚠ {String(error)}</span>
      {onRetry && <button className="btn-ghost py-1 px-3" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function fmtAmount(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
