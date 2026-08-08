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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { isIndividual, teamName, college, leader, members } = await request.json();

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
    const individualGroupId = `IND-${cleanLeader.email.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const groupId = isIndividual ? individualGroupId : cleanTeamName;

    if (!cleanCollege) {
      throw new Error('College name is required.');
    }

    // 2. Validate Team vs Individual specific logic
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
        throw new Error(`Team name "${cleanTeamName}" is already taken. Please choose another name.`);
      }

      // Combine names and emails to check for duplicates
      const allNames = [cleanLeader.full_name, ...cleanMembers.map(m => m.full_name)];
      const allEmails = [cleanLeader.email, ...cleanMembers.map(m => m.email)];

      const uniqueNames = new Set(allNames.map(n => n.toLowerCase()));
      if (uniqueNames.size !== allNames.length) {
        throw new Error('Duplicate names are not allowed in the team registration. Please verify member names.');
      }

      const uniqueEmails = new Set(allEmails);
      if (uniqueEmails.size !== allEmails.length) {
        throw new Error('Duplicate emails are not allowed in the team registration. Please verify member emails.');
      }

      // Verify at least one female member in the team
      const hasFemale = [cleanLeader, ...cleanMembers].some(m => m.gender === 'female');
      if (!hasFemale) {
        throw new Error('A team must include at least one female member to participate.');
      }
    }

    // 3. Verify that none of the emails are already registered. Auth users
    // must be read through the Auth Admin API rather than the auth schema.
    const allEmailsToCheck = [cleanLeader.email, ...cleanMembers.map(m => m.email)];
    const { data: authUsersPage, error: checkAuthError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (checkAuthError) throw new Error(`Auth verification failed: ${checkAuthError.message}`);

    const existingAuthEmails = new Set(
      (authUsersPage.users || []).map(user => user.email?.trim().toLowerCase()).filter(Boolean)
    );
    const failedEmail = allEmailsToCheck.find(email => existingAuthEmails.has(email));
    if (failedEmail) {
      throw new Error(`The email address "${failedEmail}" is already registered in the system. Please use a unique email.`);
    }

    // 4. Create a group for every registration. Individual applicants receive
    // a one-person group so they are visible and manageable in the Admin panel.
    {
      const { error: groupError } = await adminClient.from('groups').insert({
        id: groupId,
        domain: isIndividual ? 'Individual Participation' : 'General'
      });
      if (groupError) throw new Error(`Failed to create team: ${groupError.message}`);
    }

    // 5. Provision Users (Leader + Members)
    const allUsersToCreate = [
      { payload: cleanLeader, isLead: true, group: groupId, isIeee: cleanLeader.is_ieee_member },
      ...cleanMembers.map(m => ({ payload: m, isLead: false, group: groupId, isIeee: false }))
    ];

    for (const u of allUsersToCreate) {
      // Create user auth account without sending verification emails
      const { data: authUser, error: inviteError } = await adminClient.auth.admin.createUser({
        email: u.payload.email,
        password: 'student123',
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
        gender: u.payload.gender,
        mentor_capacity: 0,
      });

      if (profileError) {
        throw new Error(`Account created for ${u.payload.email}, but profile registration failed: ${profileError.message}`);
      }
    }

    return Response.json({ success: true, groupId }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Registration failed.' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
