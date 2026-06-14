import axios from 'axios';

// Same-origin by default (production single-service: Express serves the API + this SPA). In dev,
// the Vite proxy forwards /api → http://localhost:3001. Override with VITE_API_BASE if ever split.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';
axios.defaults.baseURL = API_BASE;

export const getHealth = () => axios.get('/api/health');
export const getStatus = () => axios.get('/api/status'); // lightweight, synchronous (seeding flag)
export const getWallets = () => axios.get('/api/wallets');

export const getBonds = () => axios.get('/api/bonds');
export const getBond = (id) => axios.get(`/api/bonds/${id}`);
export const issueBond = (data) => axios.post('/api/bonds/issue', data);
export const mintBond = (id, data) => axios.post(`/api/bonds/${id}/mint`, data);
export const buyBond = (id, role) => axios.post(`/api/bonds/${id}/buy`, { role });
export const attestBond = (id) => axios.post(`/api/bonds/${id}/attest`);

export const getEscrow = (bondId) => axios.get(`/api/escrow/${bondId}`);
export const createEscrow = (data) => axios.post('/api/escrow/create', data);
export const releaseEscrow = (data) => axios.post('/api/escrow/release', data);

export const getCredentials = (address) => axios.get(`/api/credentials/${address}`);
export const issueCredential = (data) => axios.post('/api/credentials/issue', data);
export const revokeCredential = (id) => axios.delete(`/api/credentials/${id}`);

export const getRlusdStatus = () => axios.get('/api/rlusd/status');
export const payRlusd = (data) => axios.post('/api/rlusd/pay', data);

export const getAgentLogs = () => axios.get('/api/agent/logs');
export const triggerAgent = () => axios.post('/api/agent/run');

export const subscribeAgentStream = (onMessage) => {
  const es = new EventSource(`${API_BASE}/api/agent/stream`);
  es.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch { /* ignore non-JSON pings */ }
  };
  return es;
};

export const txExplorer = (hash) => (hash ? `https://devnet.xrpl.org/transactions/${hash}` : null);
