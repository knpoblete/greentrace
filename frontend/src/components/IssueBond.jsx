import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueBond, createEscrow } from '../api';
import { PreviewTag, ErrorBox } from './ui.jsx';

const STEPS = [
  'Bond basics',
  'Green framework and standard',
  'Use of proceeds and milestones',
  'Vault and loan terms',
  'Investor access',
  'Review and issue',
];

const BOND_TYPES = ['EU Green Bond', 'EU Taxonomy Bond', 'ICMA Green Bond', 'Climate Bond'];
const STANDARDS = [
  { code: 'ICMA', label: 'ICMA Green Bond Principles' },
  { code: 'EU_TAXONOMY', label: 'EU Taxonomy' },
  { code: 'CLIMATE_BONDS', label: 'Climate Bonds Standard' },
  { code: 'EU_GREEN_BOND', label: 'EU Green Bond Standard' },
];
const GREEN_STANDARDS = ['EU Green Bond Standard', 'ICMA Green Bond Principles', 'Climate Bonds Standard'];
const VERIFIERS = ['Sustainalytics', 'KPMG', 'Moody’s (Vigeo Eiris)', 'S&P Global', 'DNV', 'ISS ESG'];
const REPAYMENTS = ['Bullet at maturity', 'Amortizing', 'Interest-only'];
const INVESTOR_CREDS = ['Accredited investors only', 'KYC verified', 'Institutional only'];

async function sha256(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function IssueBond() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [form, setForm] = useState({
    bondName: 'SolarCo 2034 Green Bond',
    bondType: 'EU Green Bond',
    issuerName: 'SolarCo plc',
    amountUsd: '45000000',
    coupon: '3.85',
    term: '10',
    maturity: '2034-03-28',
    greenStandard: 'EU Green Bond Standard',
    verifierName: 'Sustainalytics',
    standards: ['ICMA', 'EU_TAXONOMY', 'CLIMATE_BONDS'],
    documents: [], // {name, sha256, kind}
    milestones: [
      { name: 'Planning approval', amount: '3200000' },
      { name: 'Construction phase 1', amount: '18000000' },
    ],
    loanRate: '3.85',
    loanTerm: '10',
    repayment: 'Bullet at maturity',
    requiredCredential: 'Accredited investors only',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleStandard = (code) => setForm((f) => ({
    ...f, standards: f.standards.includes(code) ? f.standards.filter((s) => s !== code) : [...f.standards, code],
  }));
  const setMilestone = (i, k, v) => setForm((f) => ({ ...f, milestones: f.milestones.map((m, j) => j === i ? { ...m, [k]: v } : m) }));
  const addMilestone = () => setForm((f) => ({ ...f, milestones: [...f.milestones, { name: '', amount: '' }] }));
  const delMilestone = (i) => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, j) => j !== i) }));

  const onUpload = async (kind, file) => {
    if (!file) return;
    const h = await sha256(file);
    setForm((f) => ({ ...f, documents: [...f.documents.filter((d) => d.kind !== kind), { kind, name: file.name, sha256: h }] }));
  };
  const docFor = (kind) => form.documents.find((d) => d.kind === kind);

  const canNext = step !== 0 || (form.bondName && form.standards.length > 0 || true);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const milestones = form.milestones.filter((m) => m.name.trim());
      const escrowAmount = milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0) || Number(form.amountUsd) || 0;
      const bondRes = await issueBond({
        bondName: form.bondName,
        bondType: form.bondType,
        standards: form.standards,
        projectType: 'USE_OF_PROCEEDS',
        issuerName: form.issuerName,
        amountUsd: form.amountUsd,
        coupon: form.coupon,
        term: form.term,
        maturity: form.maturity,
        verifierName: form.verifierName,
        requiredCredential: form.requiredCredential,
        documents: form.documents,
        loan: { rate: form.loanRate, term: form.loanTerm, repayment: form.repayment },
        covenants: { milestones: milestones.map((m) => m.name) },
        maxAmount: '1000000',
      });
      const bondId = bondRes.data.bondId;
      await createEscrow({ bondId, amount: String(escrowAmount), milestones: milestones.map((m) => m.name) }).catch(() => null);
      setResult({ ...bondRes.data, bondId, vault: bondRes.data.vault });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-compliant/15 text-compliant grid place-items-center mx-auto text-2xl">✓</div>
          <h1 className="text-xl font-bold mt-4">Bond minted and vault opened</h1>
          <p className="text-sm text-gray-400 mt-2">
            MPT for <strong>{form.bondName}</strong> has been minted. The Single Asset Vault is open and
            accepting RLUSD from credentialed investors.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            ISIN: {result.metadata?.isin || '—'} · Listing pending on Luxembourg Green Exchange
          </p>
          <div className="mt-3 text-xs text-gray-500">
            MPT {result.txHash?.slice(0, 10)}… {result.vault?.vaultId ? `· Vault ${result.vault.vaultId.slice(0, 10)}…` : ''}
          </div>
          <button className="btn-primary w-full mt-5" onClick={() => nav(`/bonds/${result.bondId}`)}>View bond →</button>
          <button className="btn-ghost w-full mt-2" onClick={() => nav('/')}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button onClick={() => nav('/')} className="text-xs text-gray-500 hover:text-gray-300">← Back to dashboard</button>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 mt-3 max-w-[1100px]">
        {/* Stepper */}
        <div>
          <div className="text-[11px] font-semibold tracking-widest text-gray-500 mb-4">ISSUE A GREEN BOND</div>
          <ol className="space-y-1">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button onClick={() => i < step && setStep(i)}
                  className={`flex items-start gap-3 w-full text-left px-3 py-2 rounded-lg ${i === step ? 'bg-compliant/10' : ''} ${i <= step ? '' : 'opacity-50 cursor-default'}`}>
                  <span className={`mt-0.5 w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${i < step ? 'bg-compliant/20 text-compliant' : i === step ? 'bg-compliant text-black' : 'bg-surface2 text-gray-500'}`}>
                    {i < step ? '✓' : i + 1}
                  </span>
                  <span className={`text-sm ${i === step ? 'text-compliant font-medium' : i < step ? 'text-gray-300' : 'text-gray-500'}`}>{s}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Content card */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-5">Step {step + 1} — {STEPS[step]}</h2>
          <ErrorBox error={error} />

          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bond name" full><input className="input" value={form.bondName} onChange={(e) => set('bondName', e.target.value)} /></Field>
              <Field label="Bond type"><Select value={form.bondType} onChange={(v) => set('bondType', v)} options={BOND_TYPES} /></Field>
              <Field label="Issuer"><input className="input" value={form.issuerName} onChange={(e) => set('issuerName', e.target.value)} /></Field>
              <Field label="Amount (USD)"><input type="number" className="input" value={form.amountUsd} onChange={(e) => set('amountUsd', e.target.value)} /></Field>
              <Field label="Coupon (%)"><input className="input" value={form.coupon} onChange={(e) => set('coupon', e.target.value)} /></Field>
              <Field label="Term (years)"><input type="number" className="input" value={form.term} onChange={(e) => set('term', e.target.value)} /></Field>
              <Field label="Maturity date"><input type="date" className="input" value={form.maturity} onChange={(e) => set('maturity', e.target.value)} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Field label="Green standard"><Select value={form.greenStandard} onChange={(v) => set('greenStandard', v)} options={GREEN_STANDARDS} /></Field>
              <Field label="Verifier"><Select value={form.verifierName} onChange={(v) => set('verifierName', v)} options={VERIFIERS} /></Field>
              <Field label="Verification standards (all selected must pass for green status)">
                <div className="space-y-1.5">
                  {STANDARDS.map((s) => (
                    <label key={s.code} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.standards.includes(s.code) ? 'border-compliant bg-compliant/10 text-gray-100' : 'border-border bg-surface2 text-gray-400'}`}>
                      <input type="checkbox" className="accent-emerald-500" checked={form.standards.includes(s.code)} onChange={() => toggleStandard(s.code)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Upload label="Green bond framework document" doc={docFor('framework')} onFile={(f) => onUpload('framework', f)} />
              <Upload label="Second Party Opinion" doc={docFor('spo')} onFile={(f) => onUpload('spo', f)} />
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">Define the milestones that gate proceeds release. Each tranche releases when the verifier attests the milestone.</p>
              <div className="space-y-2">
                {form.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="input flex-1" placeholder="Milestone name" value={m.name} onChange={(e) => setMilestone(i, 'name', e.target.value)} />
                    <input type="number" className="input w-40" placeholder="Amount" value={m.amount} onChange={(e) => setMilestone(i, 'amount', e.target.value)} />
                    <button onClick={() => delMilestone(i)} className="text-gray-500 hover:text-breach px-2">🗑</button>
                  </div>
                ))}
              </div>
              <button onClick={addMilestone} className="text-sm text-compliant mt-3">＋ Add milestone</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="card bg-surface2 p-3 text-sm text-gray-400">Investors deposit RLUSD into the vault and receive MPT shares. The vault lends the proceeds to the issuer.</div>
              <div className="text-[11px] text-gray-500 flex items-center gap-2">Vault: <span className="text-compliant">opens on-chain (XLS-65)</span> · Loan terms <PreviewTag label="lending V2" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Loan rate (%)"><input className="input" value={form.loanRate} onChange={(e) => set('loanRate', e.target.value)} /></Field>
                <Field label="Loan term (years)"><input type="number" className="input" value={form.loanTerm} onChange={(e) => set('loanTerm', e.target.value)} /></Field>
              </div>
              <Field label="Repayment schedule"><Select value={form.repayment} onChange={(v) => set('repayment', v)} options={REPAYMENTS} /></Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Define which credentials are required to participate in the permissioned domain for this bond.</p>
              <Field label="Required investor credentials"><Select value={form.requiredCredential} onChange={(v) => set('requiredCredential', v)} options={INVESTOR_CREDS} /></Field>
              <div className="card bg-surface2 p-3 text-sm text-gray-400">Only wallets holding the required investor credential can deposit RLUSD and receive MPT shares.</div>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <Row k="Bond name" v={form.bondName} />
              <Row k="Bond type" v={form.bondType} />
              <Row k="Issuer" v={form.issuerName} />
              <Row k="Amount" v={`USD ${Number(form.amountUsd).toLocaleString()}`} />
              <Row k="Coupon" v={`${form.coupon}% p.a.`} />
              <Row k="Term" v={`${form.term} years`} />
              <Row k="Maturity" v={form.maturity} />
              <Row k="Standard" v={form.greenStandard} />
              <Row k="Verifier" v={form.verifierName} />
              <Row k="Verification" v={form.standards.join(', ')} />
              <Row k="Loan rate" v={`${form.loanRate}%`} />
              <Row k="Repayment" v={form.repayment} />
              <Row k="Investor credentials" v={form.requiredCredential} />
              <Row k="Documents" v={form.documents.length ? form.documents.map((d) => d.name).join(', ') : 'none'} />
              <div className="md:col-span-2 text-gray-500 mt-2">Milestones: {form.milestones.filter((m) => m.name).map((m) => m.name).join(', ') || 'none'}</div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <button className="btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>Back</button>
            {step < STEPS.length - 1
              ? <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={step === 1 && form.standards.length === 0}>Continue</button>
              : <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Minting on-chain…' : 'Mint bond and open vault'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children, full }) => <div className={full ? 'md:col-span-2' : ''}><label className="label">{label}</label>{children}</div>;
const Row = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
    <span className="text-gray-500">{k}</span><span className="text-gray-100 text-right">{v}</span>
  </div>
);
const Select = ({ value, onChange, options }) => (
  <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);
function Upload({ label, doc, onFile }) {
  return (
    <div>
      <label className="label">{label}</label>
      <label className="block border border-dashed border-border rounded-lg px-3 py-6 text-center text-sm text-gray-500 cursor-pointer hover:border-gray-600">
        {doc ? <span className="text-compliant">✓ {doc.name} · sha256 {doc.sha256.slice(0, 12)}…</span> : `Click to upload ${label} (PDF)`}
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}
