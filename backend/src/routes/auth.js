import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

// POST /api/auth/login { username, password } → { role, username } | 401
// Demo-only credential check (hackathon). Real auth (hashed passwords + sessions) is future work.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const acct = config.demoAccounts[String(username || '').toLowerCase()];
  if (!acct || acct.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ role: acct.role, username: String(username).toLowerCase() });
});

export default router;
