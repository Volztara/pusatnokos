// netlify/functions/cron.ts
//
// Netlify Scheduled Function — auto-cancel expired activations setiap 1 menit.
//
// Setup:
//   1. Install: npm install @netlify/functions
//   2. Tambah file ini di netlify/functions/cron.ts
//   3. Tambah netlify.toml di root (sudah ada di output)
//   4. Set environment variable CRON_SECRET dan URL di Netlify dashboard
//   5. Deploy

import { schedule } from '@netlify/functions';

const handler = schedule('* * * * *', async () => {
  try {
    const baseUrl = process.env.URL ?? 'http://localhost:3000';
    const secret  = process.env.CRON_SECRET ?? '';

    const res = await fetch(`${baseUrl}/api/cron?secret=${secret}`);
    const data = await res.json();

    console.log('[netlify-cron]', data);
    return { statusCode: 200 };
  } catch (err) {
    console.error('[netlify-cron] error:', err);
    return { statusCode: 500 };
  }
});

export { handler };