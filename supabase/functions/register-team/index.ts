import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type UserPayload = {
  full_name: string;
  email: string;
  gender: string;
  is_ieee_member?: boolean;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('You must be signed in.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify caller is admin
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) throw new Error('Invalid login session.');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: caller, error: callerError } = await adminClient
      .from('profiles').select('role').eq('id', user.id).single();
    if (callerError || caller?.role !== 'admin') throw new Error('Only administrators can approve registrations.');

    const { isIndividual, teamName, college, leader, members } = await request.json();

    const authSchemaClient = createClient(supabaseUrl, serviceKey, { db: { schema: 'auth' } });

    // 1. Inputs Normalisation & Validation
    const cleanLeader: UserPayload = {
      full_name: String(leader?.full_name || '').trim(),
      email: String(leader?.email || '').trim().toLowerCase(),
      gender: String(leader?.gender || '').trim().toLowerCase(),
      is_ieee_member: !!leader?.is_ieee_member,
    };

    if (!cleanLeader.full_name || !cleanLeader.email || !cleanLeader.gender) {
      throw new Error('Leader details are incomplete.');
    }

    const cleanMembers: UserPayload[] = (members || []).map((m: any) => ({
      full_name: String(m?.full_name || '').trim(),
      email: String(m?.email || '').trim().toLowerCase(),
      gender: String(m?.gender || '').trim().toLowerCase(),
    })).filter((m: any) => m.full_name && m.email);

    const cleanTeamName = String(teamName || '').trim();
    const cleanCollege = String(college || '').trim();

    if (!cleanCollege) {
      throw new Error('College name is required.');
    }

    if (!isIndividual) {
      if (!cleanTeamName) {
        throw new Error('Team name is required for team registrations.');
      }

      // Check duplicate Team Name
      const { data: existingGroup } = await adminClient
        .from('groups')
        .select('id')
        .eq('id', cleanTeamName)
        .maybeSingle();
      if (existingGroup) {
        throw new Error(`Team name "${cleanTeamName}" is already taken.`);
      }

      // Verify female member rule
      const hasFemale = [cleanLeader, ...cleanMembers].some(m => m.gender === 'female');
      if (!hasFemale) {
        throw new Error('A team must include at least one female member.');
      }
    }

    // Verify that none of the emails are already registered in auth.users
    const allEmailsToCheck = [cleanLeader.email, ...cleanMembers.map(m => m.email)];
    const { data: existingAuthUsers, error: checkAuthError } = await authSchemaClient
      .from('users')
      .select('email')
      .in('email', allEmailsToCheck);
    
    if (checkAuthError) throw checkAuthError;

    if (existingAuthUsers && existingAuthUsers.length > 0) {
      const failedEmail = existingAuthUsers[0].email;
      throw new Error(`The email address "${failedEmail}" is already registered.`);
    }

    // Create the group (if Team)
    if (!isIndividual) {
      const { error: groupError } = await adminClient.from('groups').insert({
        id: cleanTeamName,
        domain: 'General'
      });
      if (groupError) throw groupError;
    }

    // Provision Users (Leader gets student123 password; Members get random secure passwords)
    const allUsersToCreate = [
      { payload: cleanLeader, isLead: !isIndividual, group: isIndividual ? null : cleanTeamName, isIeee: cleanLeader.is_ieee_member, password: 'student123' },
      ...cleanMembers.map(m => ({ payload: m, isLead: false, group: cleanTeamName, isIeee: false, password: crypto.randomUUID() }))
    ];

    for (const u of allUsersToCreate) {
      const { data: authUser, error: inviteError } = await adminClient.auth.admin.createUser({
        email: u.payload.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.payload.full_name, role: 'student' }
      });

      if (inviteError || !authUser.user) {
        throw new Error(`Failed to create account for ${u.payload.email}: ${inviteError?.message}`);
      }

      // Insert profile
      const { error: profileError } = await adminClient.from('profiles').insert({
        id: authUser.user.id,
        email: u.payload.email,
        full_name: u.payload.full_name,
        role: 'student',
        is_lead: u.isLead,
        group_id: u.group,
        college: cleanCollege,
        is_ieee_member: u.isIeee,
        gender: u.payload.gender
      });

      if (profileError) {
        throw new Error(`Account created for ${u.payload.email}, but profile registration failed: ${profileError.message}`);
      }
    }

    return Response.json({ success: true }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Registration approval failed.' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
