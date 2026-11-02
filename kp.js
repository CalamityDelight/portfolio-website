// Earth's magnetic field: the planetary Kp index from NOAA's Space Weather
// Prediction Center. Kp runs from 0 (calm) to 9 (extreme storm) and is
// measured every 3 hours. Free, no key needed.
//
// The server fetches it and keeps it for 10 minutes (a cache), so every
// visitor gets a fast answer and NOAA gets at most one request per 10 minutes.
const express = require('express');

const router = express.Router();
const NOAA_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const CACHE_MS = 10 * 60 * 1000;

let cache = { data: null, fetchedAt: 0 };

// NOAA's own wording: below 4 is quiet, 4 is active, 5 and up is a geomagnetic storm
function describe(kp) {
  if (kp >= 5) return 'storm';
  if (kp >= 4) return 'active';
  return 'calm';
}

async function fetchKp() {
  const res = await fetch(NOAA_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NOAA answered ${res.status}`);
  const rows = await res.json();

  // Each row looks like { "time_tag": "2026-11-02T09:00:00", "Kp": 2.33, ... }
  const readings = rows
    .map((r) => ({ time: r.time_tag, kp: Number(r.Kp) }))
    .filter((r) => Number.isFinite(r.kp));
  if (!readings.length) throw new Error('No Kp values in the NOAA data');

  const latest = readings[readings.length - 1];
  return {
    kp: Math.round(latest.kp),
    exact: latest.kp,
    label: describe(latest.kp),
    time: latest.time,
    history: readings.slice(-8).map((r) => r.kp), // last 24 hours, for the small graph
  };
}

router.get('/api/kp', async (req, res) => {
  const fresh = Date.now() - cache.fetchedAt < CACHE_MS;
  if (!fresh) {
    try {
      cache = { data: await fetchKp(), fetchedAt: Date.now() };
    } catch (err) {
      console.error('Kp fetch failed:', err.message);
      // NOAA down? Serve the last good value if we have one, otherwise say so
      if (!cache.data) return res.status(503).json({ error: 'The magnetic field reading is unavailable right now.' });
    }
  }
  res.json(cache.data);
});

module.exports = router;
