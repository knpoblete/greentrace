import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueBond, createEscrow } from '../api';
import { TxLink, SimBadge, ErrorBox } from './ui.jsx';

const STANDARDS = [
  { code: 'ICMA', label: 'ICMA Green Bond Principles' },
  { code: 'EU_TAXONOMY', label: 'EU Taxonomy' },
  { code: 'EU_GREEN_BOND', label: 'EU Green Bond Standard' },
  { code: 'CLIMATE_BONDS', label: 'Climate Bonds Standard' },
];
const PROJECT_TYPES = ['USE_OF_PROCEEDS', 'GREEN_REVENUE', 'PROJECT', 'EU_GREEN'];
const STEPS = ['Bond Basics', 'Covenants', 'Escrow', 'Review'];

export default function IssueBond() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    bondName: 'Hydro Storage Green Bond',
    standards: ['ICMA', 'EU_TAXONOMY'],
    projectType: 'USE_OF_PROCEEDS',
    maxEmissions: 1000,
    milestones: 'planning, construction, reporting',
    escrowAmount: 400000,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleStandard = (code) => setForm((f) => ({
    ...f,
    standards: f.standards.includes(code) ? f.standards.filter((s) => s !== code) : [...f.standards, code],
  }));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const milestones = form.milestones.split(',').map((s) => s.trim()).filter(Boolean);
      const bondRes = await issueBond({
        bondName: form.bondName,
        standards: form.standards,
        projectType: form.projectType,
        covenants: { maxEmissions: Number(form.maxEmissions), milestones },
        maxAmount: '1000000',
      });
      const bondId = bondRes.data.bondId;
      const escrowRes = await createEscrow({ bondId, amount: String(form.escrowAmount), milestones });
      setResult({ bond: bondRes.data, escrow: escrowRes.data, bondId });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  };

  if (result) {
    return (
      <div className="p-8 max-w-[640px]">
        <h1 className="text-2xl font-bold mb-4">Bond Issued 🎉</h1>
        <div className="card p-5 space-y-3">
          <Row label="MPToken Issuance">
            <TxLink hash={result.bond.txHash} label="tx" simulated={result.bond.simulated} /> <SimBadge simulated={result.bond.simulated} />
          </Row>
          <Row label="Escrow Created">
            <TxLink hash={result.escrow.txHash} label="tx" simulated={result.escrow.simulated} /> <SimBadge simulated={result.escrow.simulated} />
          </Row>
          <Row label="MPT Issuance ID"><span className="font-mono text-xs text-gray-300">{result.bond.mptIssuanceId?.slice(0, 24)}…</span></Row>
        </div>
        <div className="flex gap-2 mt-5">
          <button className="btn-primary" onClick={() => nav(`/bonds/${result.bondId}`)}>View Bond →</button>
          <button className="btn-ghost" onClick={() => { setResult(null); setStep(0); }}>Issue Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[640px]">
      <h1 className="text-2xl font-bold mb-1">Issue Green Bond</h1>
      <p className="text-sm text-gray-500 mb-6">Mint an MPToken with embedded green metadata + RLUSD escrow.</p>

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-semibold ${i <= step ? 'bg-compliant text-black' : 'bg-surface2 text-gray-500'}`}>{i + 1}</div>
            <span className={`text-xs ${i === step ? 'text-gray-100' : 'text-gray-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      <ErrorBox error={error} />

      <div className="card p-5 space-y-4">
        {step === 0 && (
          <>
            <Field label="Bond Name"><input className="input" value={form.bondName} onChange={(e) => set('bondName', e.target.value)} /></Field>
            <Field label="Standards / Frameworks (select all that apply)">
              <div className="space-y-1.5">
                {STANDARDS.map((s) => (
                  <label key={s.code} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.standards.includes(s.code) ? 'border-compliant bg-compliant/10 text-gray-100' : 'border-border bg-surface2 text-gray-400'}`}>
                    <input type="checkbox" className="accent-emerald-500" checked={form.standards.includes(s.code)} onChange={() => toggleStandard(s.code)} />
                    {s.label}
                  </label>
                ))}
              </div>
              {form.standards.length === 0 && <p className="text-xs text-breach mt-1.5">Select at least one standard.</p>}
            </Field>
            <Field label="Project Type"><select className="input" value={form.projectType} onChange={(e) => set('projectType', e.target.value)}>{PROJECT_TYPES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Max Emissions (tCO₂e)"><input type="number" className="input" value={form.maxEmissions} onChange={(e) => set('maxEmissions', e.target.value)} /></Field>
            <Field label="Milestones (comma-separated)"><input className="input" value={form.milestones} onChange={(e) => set('milestones', e.target.value)} /></Field>
          </>
        )}
        {step === 2 && (
          <Field label="Escrow Amount (RLUSD)"><input type="number" className="input" value={form.escrowAmount} onChange={(e) => set('escrowAmount', e.target.value)} /></Field>
        )}
        {step === 3 && (
          <div className="space-y-2 text-sm">
            <Row label="Name">{form.bondName}</Row>
            <Row label="Standards">{form.standards.map((s) => s.replace(/_/g, ' ')).join(', ')}</Row>
            <Row label="Project">{form.projectType.replace(/_/g, ' ')}</Row>
            <Row label="Max Emissions">{form.maxEmissions} tCO₂e</Row>
            <Row label="Milestones">{form.milestones}</Row>
            <Row label="Escrow">{Number(form.escrowAmount).toLocaleString()} RLUSD</Row>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-5">
        <button className="btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>Back</button>
        {step < STEPS.length - 1
          ? <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && form.standards.length === 0}>Next</button>
          : <button className="btn-primary" onClick={submit} disabled={busy || form.standards.length === 0}>{busy ? 'Submitting on-chain…' : 'Issue Bond + Escrow'}</button>}
      </div>
    </div>
  );
}

const Field = ({ label, children }) => <div><label className="label">{label}</label>{children}</div>;
const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-gray-500 text-sm">{label}</span>
    <span className="text-gray-200 text-sm text-right">{children}</span>
  </div>
);
