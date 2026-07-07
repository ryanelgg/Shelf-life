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
    // Cleanly exit any shared household FIRST. households.owner_id references
    // auth.users ON DELETE CASCADE, so hard-deleting this user below would
    // cascade-delete the whole household row — silently kicking out every
    // other member and unlinking the shared pantry. leave_household() hands
    // ownership to the longest-standing remaining member (or disbands cleanly
    // if this user was the last one), and releases the user's shared rows back
    // to their own account so the by-user_id deletes below don't touch other
    // members' items.
    const { error: leaveError } = await userClient.rpc('leave_household');
    if (leaveError) {
      return json({ error: `Household handoff failed: ${leaveError.message}` }, { status: 500 });
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
