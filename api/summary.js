'use strict';

// Anonymous read of the existing aggregate endpoint. No account credentials or individual answers.
const SOURCE = 'https://script.google.com/macros/s/AKfycbwMT0VImOBZUvmIjwD2UBCD5Oe8vc-jYyZtkNoMoWR7bR2XLGjJXidWusyN9G0jsA33/exec';

module.exports = async function summary(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Upstream unavailable');
    const data = await response.json();
    if (data.error || data.schema !== 1 || !data.groups || !data.groups.all) {
      throw new Error('Invalid summary');
    }
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(data);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Статистика Google временно недоступна. Сохранённые результаты остаются на экране.' });
  }
};
