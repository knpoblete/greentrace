import { STANDARD_LABELS, SourceTag } from './ui.jsx';

function scoreColor(s) {
  if (s == null) return 'text-gray-400';
  if (s >= 85) return 'text-compliant';
  if (s >= 70) return 'text-atrisk';
  return 'text-breach';
}

const Cell = ({ label, value }) => (
  <div>
    <div className="text-[11px] text-gray-500">{label}</div>
    <div className="text-sm text-gray-100 font-medium">{value ?? '—'}</div>
  </div>
);

export default function InstrumentPanel({ instrument }) {
  const i = instrument || {};
  const passes = i.passes || {};
  const issued = i.issuedDate ? new Date(i.issuedDate).toLocaleDateString() : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">Instrument &amp; Verification <SourceTag source="on-chain" /></h3>
        <div className="text-right">
          <div className="text-[11px] text-gray-500">Verify Score</div>
          <div className={`text-2xl font-bold leading-none ${scoreColor(i.verifyScore)}`}>
            {i.verifyScore ?? '—'}<span className="text-xs text-gray-600">/100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cell label="ISIN" value={<span className="font-mono">{i.isin}</span>} />
        <Cell label="Coupon" value={i.coupon ? `${i.coupon}%` : null} />
        <Cell label="Maturity" value={i.maturity} />
        <Cell label="Issued" value={issued} />
        <div className="col-span-2"><Cell label="Use of Proceeds" value={i.useOfProceeds} /></div>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-[11px] text-gray-500 mb-2 flex items-center gap-2">Framework alignment <SourceTag source="verifier-attested" /></div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(passes).map(([code, pass]) => (
            <div key={code} className="flex items-center gap-2 text-xs">
              <span className={pass ? 'text-compliant' : 'text-gray-600'}>{pass ? '✓' : '○'}</span>
              <span className={pass ? 'text-gray-200' : 'text-gray-600'}>{STANDARD_LABELS[code] || code}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
