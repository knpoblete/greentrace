import { TxLink, SimBadge, timeAgo } from './ui.jsx';

const ICON = {
  BOND_ISSUED: '🪙',
  ESCROW_CREATE: '🔒',
  CREDENTIAL_ISSUED: '🛡',
  CREDENTIAL_REVOKED: '⛔',
  AGENT_ACTION: '🤖',
};

export default function AuditTrail({ events = [] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-3">On-chain Audit Trail</h3>
      <ol className="relative border-l border-border ml-2">
        {events.length === 0 && <li className="text-xs text-gray-600 ml-4">No events yet.</li>}
        {events.map((ev, i) => (
          <li key={i} className="mb-4 ml-4">
            <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full bg-surface2 text-[10px]">
              {ICON[ev.type] || '•'}
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-200">{ev.label}</span>
              <span className="text-[11px] text-gray-600">{timeAgo(ev.ts)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TxLink hash={ev.txHash} label="tx" simulated={ev.simulated} />
              <SimBadge simulated={ev.simulated} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
