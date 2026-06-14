import { useEffect, useState, useCallback } from 'react';
import { getAgentLogs, triggerAgent, subscribeAgentStream } from '../api';
import { Spinner, ErrorBox, StatusPill, TxLink, SimBadge, SourceTag, SourceLegend, RULE_SOURCE, timeAgo } from './ui.jsx';

export default function AgentLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    getAgentLogs().then((r) => setLogs(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const es = subscribeAgentStream(() => load());
    const p = setInterval(load, 5000);
    return () => { es.close(); clearInterval(p); };
  }, [load]);

  const run = async () => { setRunning(true); try { await triggerAgent(); load(); } finally { setRunning(false); } };

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compliance Agent Log</h1>
          <p className="text-sm text-gray-500">Monitoring only — the agent flags for verifier review; it never changes status on its own.</p>
        </div>
        <button className="btn-primary" onClick={run} disabled={running}>{running ? 'Running…' : '⟳ Run Now'}</button>
      </div>
      <div className="mb-4"><SourceLegend /></div>

      <ErrorBox error={error} onRetry={load} />

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {logs.map((l) => (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{l.bondName}</span>
                  {l.prevStatus !== l.status ? (
                    <span className="flex items-center gap-1.5"><StatusPill status={l.prevStatus} /><span className="text-gray-600">→</span><StatusPill status={l.status} /></span>
                  ) : <StatusPill status={l.status} />}
                </div>
                <span className="text-xs text-gray-600">{timeAgo(l.ts)}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {l.findings?.map((f, i) => (
                  <div key={i} className="text-xs bg-surface2 rounded px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <span className={f.pass ? 'text-compliant' : (f.severity === 'breach' ? 'text-breach' : 'text-atrisk')}>{f.pass ? '✓' : '✗'}</span>
                        <span className="capitalize text-gray-300">{f.rule}</span>
                      </span>
                      <SourceTag source={RULE_SOURCE[f.rule]} />
                    </div>
                    <div className="text-gray-500 mt-0.5">{f.detail}</div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-amber-400">{l.actionTaken && l.actionTaken !== 'no change' ? `↳ ${l.actionTaken}` : 'no change'}</span>
                <span className="flex items-center gap-2"><TxLink hash={l.txHash} label="tx" simulated={l.simulated} /><SimBadge simulated={l.simulated} /></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
