import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, { status: 401 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify the caller's JWT to learn their user id
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, { status: 401 });
  }
  const userId = userData.user.id;

  // Use service role to delete data + the auth user row
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Cleanly exit any household BEFORE deleting the auth user. This reuses the
    // exact same tested logic as the in-app "Leave household" action: if the
    // user owns a household that still has other members, ownership transfers to
    // the longest-standing member; if they're the last one, the household is
    // disbanded and its shared rows are released. This ordering is critical —
    // `households.owner_id references auth.users(id) on delete cascade`, so
    // deleting an owner while they still own a household would cascade-delete
    // the whole household and silently kick every other member out of the shared
    // pantry. Run through the caller's own session so leave_household() sees the
    // right auth.uid().
    const { error: leaveError } = await userClient.rpc('leave_household');
    if (leaveError) {
      return json({ error: `Household cleanup failed: ${leaveError.message}` }, { status: 500 });
    }

    const [pantryRes, wasteRes, profileRes] = await Promise.all([
      admin.from('pantry_items').delete().eq('user_id', userId),
      admin.from('waste_logs').delete().eq('user_id', userId),
      admin.from('profiles').delete().eq('id', userId),
    ]);
    const dataError = pantryRes.error ?? wasteRes.error ?? profileRes.error;
    if (dataError) {
      return json({ error: `Data delete failed: ${dataError.message}` }, { status: 500 });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ error: `Auth delete failed: ${deleteError.message}` }, { status: 500 });
    }

    return json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
});
