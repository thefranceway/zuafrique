const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      // Create table on first run
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS commitments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          builds TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `).run();

      // GET /commitments
      if (request.method === 'GET' && url.pathname === '/commitments') {
        const { results } = await env.DB.prepare(
          'SELECT id, name, builds, created_at FROM commitments ORDER BY id DESC'
        ).all();

        const rows = (results || []).map(r => ({
          id: r.id,
          name: r.name,
          builds: JSON.parse(r.builds),
          date: r.created_at,
        }));

        return json(rows);
      }

      // POST /commitments
      if (request.method === 'POST' && url.pathname === '/commitments') {
        let body;
        try { body = await request.json(); }
        catch { return json({ error: 'Invalid JSON' }, 400); }

        const name = (body.name || '').trim().slice(0, 60);
        const builds = (Array.isArray(body.builds) ? body.builds : [])
          .filter(b => typeof b === 'string' && b.trim())
          .map(b => b.trim().slice(0, 120));

        if (!name)            return json({ error: 'Name is required' }, 400);
        if (builds.length < 1) return json({ error: 'At least one build is required' }, 400);

        const now = new Date().toISOString();
        const result = await env.DB.prepare(
          'INSERT INTO commitments (name, builds, created_at) VALUES (?, ?, ?)'
        ).bind(name, JSON.stringify(builds), now).run();

        return json({ id: result.meta.last_row_id, name, builds, date: now }, 201);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
