import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login as apiLogin } from '../api';
import { useAuth, ROLE_META } from '../auth.jsx';

const DEMO = [
  { username: 'treasury', role: 'treasury', blurb: 'Issue bonds, manage escrow & monitor compliance' },
  { username: 'investor', role: 'investor', blurb: 'Browse the marketplace & buy bonds with RLUSD' },
  { username: 'kpmg', role: 'verifier', blurb: 'Review flagged bonds & attest green status' },
];
const DEMO_PASSWORD = 'green2026';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState('treasury');
  const [password, setPassword] = useState('green2026');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data } = await apiLogin(username, password);
      login(data);
      nav(ROLE_META[data.role]?.home || '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  };

  const quick = (u) => { setUsername(u); setPassword(DEMO_PASSWORD); };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2">
            <span>🌿</span> GreenTrace
          </div>
          <p className="text-sm text-gray-500 mt-1">Green bond verification & issuance · XRPL Devnet</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-xs text-breach">⚠ {error}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="card p-4 mt-4">
          <div className="text-xs text-gray-500 mb-2">Demo accounts (password <span className="font-mono text-gray-300">{DEMO_PASSWORD}</span>) — click to fill:</div>
          <div className="space-y-1.5">
            {DEMO.map((d) => (
              <button key={d.username} onClick={() => quick(d.username)}
                className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg bg-surface2 hover:bg-gray-700 border border-border transition-colors">
                <span className="text-lg">{ROLE_META[d.role].icon}</span>
                <span className="min-w-0">
                  <span className="text-sm text-gray-100 font-medium">{ROLE_META[d.role].label}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{d.username} · {d.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
