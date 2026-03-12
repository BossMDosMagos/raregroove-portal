export async function getSupabaseUserFromRequest({ supabaseUrl, supabaseAnonKey, authorization }) {
  if (!authorization || !String(authorization).toLowerCase().startsWith('bearer ')) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authorization,
    }
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function getProfileRow({ supabaseUrl, supabaseAnonKey, authorization, userId, select }) {
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set('select', select || 'id,is_admin,subscription_status,user_level,subscription_provider,subscription_trial_ends_at,subscription_data_used_gb');
  url.searchParams.set('id', `eq.${userId}`);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authorization,
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function requireAdmin({ supabaseUrl, supabaseAnonKey, authorization }) {
  const user = await getSupabaseUserFromRequest({ supabaseUrl, supabaseAnonKey, authorization });
  if (!user?.id) return { ok: false, status: 401, error: 'invalid_auth' };
  const profile = await getProfileRow({ supabaseUrl, supabaseAnonKey, authorization, userId: user.id });
  if (!profile?.id) return { ok: false, status: 403, error: 'missing_profile' };
  if (!profile.is_admin) return { ok: false, status: 403, error: 'not_admin' };
  return { ok: true, user, profile };
}

