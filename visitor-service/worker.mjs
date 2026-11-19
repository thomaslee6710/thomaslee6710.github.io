const origin = 'https://thomaslee6710.github.io';
const windowMs = 30 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== '/visits') return new Response(null, {status: 404});
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Cache-Control': 'no-store',
    };
    const cutoff = Date.now() - windowMs;
    if (request.method === 'POST') {
      if (request.headers.get('Origin') !== origin) return new Response(null, {status: 403});
      if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1')
        return new Response(null, {status: 204, headers});
      const lat = Number.parseFloat(request.cf?.latitude);
      const lon = Number.parseFloat(request.cf?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        // Store approximate coordinates only, rounded to half a degree.
        await env.VISITS.prepare('INSERT INTO visits (lat, lon, recorded) VALUES (?, ?, ?)')
          .bind(Math.round(lat * 2) / 2, Math.round(lon * 2) / 2, Date.now()).run();
        await env.VISITS.prepare('DELETE FROM visits WHERE recorded < ?').bind(cutoff).run();
      }
      return new Response(null, {status: 204, headers});
    }
    if (request.method !== 'GET') return new Response(null, {status: 405, headers});
    const {results} = await env.VISITS.prepare(
      'SELECT lat, lon FROM visits WHERE recorded >= ? ORDER BY recorded DESC LIMIT 500'
    ).bind(cutoff).all();
    return Response.json(results, {headers});
  },
};
