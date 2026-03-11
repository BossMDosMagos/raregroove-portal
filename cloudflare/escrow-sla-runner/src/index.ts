export default {
  async scheduled(_event: ScheduledEvent, env: Record<string, string>, _ctx: ExecutionContext) {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) return;

    await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/run_escrow_sla`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  },

  async fetch(req: Request, env: Record<string, string>) {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const manualToken = env.MANUAL_TRIGGER_TOKEN;

    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!supabaseUrl || !serviceRoleKey) return new Response('Missing env', { status: 500 });

    if (manualToken) {
      const provided = req.headers.get('x-manual-token') || '';
      if (provided !== manualToken) return new Response('Forbidden', { status: 403 });
    }

    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/run_escrow_sla`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  },
};

