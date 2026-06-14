import { Router } from 'express';
import { config } from '../config.js';
import { issueCredential, revokeCredential, getCredentials } from '../xrpl/credentials.js';

const router = Router();
const txLink = (hash) => (hash ? `${config.explorerBase}${hash}` : null);

// GET /api/credentials/:address
router.get('/:address', (req, res) => {
  try {
    const creds = getCredentials(req.params.address).map((c) => ({
      id: c.id,
      credentialId: c.credential_id,
      type: c.credential_type,
      subject: c.subject_address,
      bondId: c.bond_id,
      status: c.status,
      fields: JSON.parse(c.fields_json || '{}'),
      txHash: c.tx_hash,
      txLink: txLink(c.tx_hash),
      simulated: !!c.simulated,
      issuedAt: c.issued_at,
    }));
    res.json(creds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/credentials/issue — { subjectAddress, credentialType, fields, bondId }
router.post('/issue', async (req, res) => {
  try {
    const { subjectAddress, credentialType, fields, bondId } = req.body;
    if (!subjectAddress || !credentialType) {
      return res.status(400).json({ error: 'subjectAddress and credentialType are required' });
    }
    const result = await issueCredential({ subjectAddress, credentialType, fields, bondId });
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/credentials/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await revokeCredential(Number(req.params.id));
    res.json({ ...result, txLink: txLink(result.txHash) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
