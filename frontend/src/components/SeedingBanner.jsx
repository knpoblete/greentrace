import { useEffect, useState } from 'react';
import { getStatus } from '../api';

/**
 * Thin top banner shown while the backend is still seeding (funding wallets + issuing bonds on
 * Devnet). The server listens before seeding finishes, so on a cold start the app is reachable but
 * empty for ~2 min — this tells users data is on its way. Renders nothing once ready.
 */
export default function SeedingBanner() {
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      getStatus()
        .then((r) => { if (alive) setSeeding(!!r.data.seeding); })
        .catch(() => { /* server waking up — ignore */ });
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!seeding) return null;

  return (
    <div className="bg-atrisk/15 border-b border-atrisk/30 text-atrisk text-sm px-6 py-2 flex items-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-atrisk/40 border-t-atrisk rounded-full animate-spin" />
      Initializing on XRPL Devnet — funding wallets &amp; issuing demo bonds (~2 min). One-time on cold start; the page updates automatically.
    </div>
  );
}
