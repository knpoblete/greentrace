import { TxLink, SimBadge, timeAgo } from './ui.jsx';

const HIDE = new Set(['verifiedAt', 'expiresAt']);
const PASS_RE = /^(pass|compliant|green_verified|verified|kyc_verified)$/i;

function FieldRow({ k, v }) {
  const val = String(v);
  const isPass = PASS_RE.test(val);
  return (
    <div className="flex items-center justify-between py-1 text-xs border-b border-border/40 last:border-0">
      <span className="text-gray-500">{k.replace(/_/g, ' ')}</span>
      <span className={isPass ? 'text-compliant font-medium' : 'text-gray-200 font-medium'}>
        {isPass && '✓ '}{val.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

export default function CredentialBadge({ credential }) {
  const c = credential;
  const revoked = c.status === 'REVOKED';
  const fields = Object.entries(c.fields || {}).filter(([k, v]) => !HIDE.has(k) && v != null && v !== '');
  return (
    <div className={`card p-4 ${revoked ? 'border-breach/40 bg-breach/5' : 'border-compliant/30'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{revoked ? '⛔' : '🛡'}</span>
          <div>
            <div className="font-semibold text-sm">{c.type}</div>
            <div className="text-[11px] text-gray-500 font-mono truncate max-w-[180px]" title={c.subject}>
              subject {c.subject?.slice(0, 12)}…
            </div>
          </div>
        </div>
        <span className={`pill ${revoked ? 'bg-breach/15 text-breach' : 'bg-compliant/15 text-compliant'}`}>
          {revoked ? 'REVOKED' : 'ACTIVE'}
        </span>
      </div>

      <div className="mt-3">
        {fields.map(([k, v]) => <FieldRow key={k} k={k} v={v} />)}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TxLink hash={c.txHash} label="cred" simulated={c.simulated} />
          <SimBadge simulated={c.simulated} />
        </div>
        <span className="text-[11px] text-gray-600">{timeAgo(c.issuedAt)}</span>
      </div>
    </div>
  );
}
