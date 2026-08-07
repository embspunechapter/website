import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Person = {
  full_name: string;
  email: string;
  domain?: string | null;
  group_id?: string | null;
  mentor_capacity?: number | null;
  section?: string | null;
  city?: string | null;
  is_ieee_member?: boolean;
  graduation_year?: string | null;
  college?: string | null;
  designation?: string | null;
  organisation?: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('You must be signed in.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) throw new Error('Invalid login session.');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: caller, error: callerError } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single();
    if (callerError || caller?.role !== 'admin') throw new Error('Only administrators can import users.');

    const { role, people, redirectTo } = await request.json();
    if (!['mentor', 'student'].includes(role) || !Array.isArray(people)) throw new Error('Invalid import request.');

    const results = { invited: 0, existing: 0, failed: [] as { email: string; reason: string }[] };
    for (const rawPerson of people as Person[]) {
      const email = String(rawPerson.email || '').trim().toLowerCase();
      const fullName = String(rawPerson.full_name || '').trim();
      if (!email || !fullName) { results.failed.push({ email: email || 'Unknown', reason: 'Missing name or email.' }); continue; }

      const { data: existingProfile } = await adminClient.from('profiles').select('id').eq('email', email).maybeSingle();
      if (existingProfile) { results.existing += 1; continue; }

      const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, role },
        redirectTo: redirectTo || undefined,
      });
      if (inviteError || !invitation.user) {
        results.failed.push({ email, reason: inviteError?.message || 'Invitation could not be created.' });
        continue;
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: invitation.user.id,
        email,
        full_name: fullName,
        role,
        domain: rawPerson.domain || null,
        group_id: role === 'student' ? rawPerson.group_id || null : null,
        mentor_capacity: role === 'mentor' ? rawPerson.mentor_capacity || 4 : null,
        section: rawPerson.section || null,
        city: rawPerson.city || null,
        is_ieee_member: !!rawPerson.is_ieee_member,
        graduation_year: rawPerson.graduation_year || null,
        college: rawPerson.college || null,
        designation: rawPerson.designation || null,
        organisation: rawPerson.organisation || null,
      });
      if (profileError) {
        results.failed.push({ email, reason: `Account invited, but profile failed: ${profileError.message}` });
      } else results.invited += 1;
    }

    return Response.json(results, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Unexpected error.' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});