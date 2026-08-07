import { useEffect, useState } from 'react';
import { 
  Users, BookOpen, HelpCircle, ClipboardList, Save, UserCheck, Phone, MapPin, Tag, Bell,
  FileSpreadsheet, FileUp, Award
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import CertificatePreviewModal from '../components/CertificatePreviewModal';

const muted = { color: 'var(--text-secondary)', fontSize: '0.875rem' };
const card = { padding: '1.5rem', borderRadius: 'var(--radius-lg)' };

export default function MentorDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [queries, setQueries] = useState([]);
  const [reports, setReports] = useState([]);
  const [links, setLinks] = useState({});
  const [drafts, setDrafts] = useState({});
  
  // Milestones State
  const [milestones, setMilestones] = useState({}); // group_id -> milestone list
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [myCertificate, setMyCertificate] = useState(null);
  const [certPreview, setCertPreview] = useState(null);
  const [activeConductingMeeting, setActiveConductingMeeting] = useState(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data, error } = await supabase.from('templates').select('*').order('name');
        if (error) {
          console.warn('Templates table not found, please run migrations:', error.message);
          return;
        }
        if (data) setTemplates(data);
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };
    fetchTemplates();
  }, []);
  
  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    phone: '',
    organisation: '',
    bio: '',
    interests: '',
    avatar_url: ''
  });
  
  // Meetings State
  const [meetings, setMeetings] = useState([]);
  const [newMeeting, setNewMeeting] = useState({
    group_id: '',
    notes: '',
    next_actions: '',
    meeting_link: '',
    held_at: new Date().toISOString().slice(0, 16)
  });
  const [presentStudents, setPresentStudents] = useState({}); // student_id -> boolean
  const [meetingScreenshotFile, setMeetingScreenshotFile] = useState(null);

  // Review Checklist State
  const [checklist, setChecklist] = useState({
    plagiarism: false,
    formatting: false,
    codeVerified: false,
    references: false
  });

  const [mentorMgmtSectionFilter, setMentorMgmtSectionFilter] = useState('');
  const [mentorMgmtCityFilter, setMentorMgmtCityFilter] = useState('');
  const [mentorMgmtIeeeFilter, setMentorMgmtIeeeFilter] = useState('');
  const [mentorMgmtYearFilter, setMentorMgmtYearFilter] = useState('');
  const [mentorMgmtCollegeFilter, setMentorMgmtCollegeFilter] = useState('');
  const [mentorMgmtOrgFilter, setMentorMgmtOrgFilter] = useState('');
  const [mentorMgmtDesignationFilter, setMentorMgmtDesignationFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const tell = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 6000);
  };

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch assigned groups, announcements, and own certificate
      const [{ data: groupData, error: groupError }, { data: annData, error: annError }, { data: myCertData }] = await Promise.all([
        supabase.from('groups').select('*').eq('mentor_id', profile.id),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('certificates').select('*').eq('recipient_id', profile.id).maybeSingle()
      ]);
      if (groupError || annError) throw groupError || annError;
      
      setMyCertificate(myCertData || null);
      setAnnouncements((annData || []).filter(a => a.audience === 'all' || a.audience === 'mentor'));
      const ids = (groupData || []).map((group) => group.id);
      setGroups(groupData || []);

      // If mentor is not assigned to any group, load only profile
      if (!ids.length) {
        setQueries([]);
        setReports([]);
        setLoading(false);
        return;
      }

      // 2. Fetch queries, reports, meeting logs, profiles, milestones, certificates
      const [{ data: queryData, error: queryError }, { data: reportData, error: reportError }, { data: people, error: peopleError }, { data: meetingData, error: meetingError }, { data: milestoneData, error: milestoneError }, { data: certData, error: certError }] = await Promise.all([
        supabase.from('queries').select('*').in('group_id', ids).order('created_at', { ascending: false }),
        supabase.from('reports').select('*').in('group_id', ids).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('meetings').select('*').in('group_id', ids).order('held_at', { ascending: false }),
        supabase.from('milestones').select('*').in('group_id', ids).order('due_date', { ascending: true }),
        supabase.from('certificates').select('*').in('group_id', ids)
      ]);

      if (queryError || reportError || peopleError || meetingError || milestoneError || certError) {
        throw queryError || reportError || peopleError || meetingError || milestoneError || certError;
      }

      const allPeople = people || [];
      const names = new Map(allPeople.map((person) => [person.id, person.full_name]));
      
      // Inject group students count
      setGroups((groupData || []).map(group => ({
        ...group,
        members: allPeople.filter(p => p.role === 'student' && p.group_id === group.id)
      })));

      setQueries((queryData || []).map((query) => ({
        ...query,
        submitter: names.get(query.asked_by) || 'Student'
      })));

      const reportRows = (reportData || []).map((report) => ({
        ...report,
        submitter: names.get(report.submitted_by) || 'Student'
      }));
      setReports(reportRows);
      
      setMeetings(meetingData || []);

      // Group milestones
      const milestonesMap = {};
      ids.forEach(gid => {
        milestonesMap[gid] = (milestoneData || []).filter(m => m.group_id === gid);
      });
      setMilestones(milestonesMap);
      setCertificates(certData || []);

      // Prepopulate drafts
      setDrafts(Object.fromEntries(reportRows.map((report) => [
        report.id, 
        { status: report.status || 'submitted', feedback: report.feedback || '' }
      ])));

      // Load files URL
      const signed = await Promise.all(
        reportRows.filter((report) => report.file_url).map(async (report) => {
          const { data } = await supabase.storage.from('reports').createSignedUrl(report.file_url, 3600);
          return [report.id, data?.signedUrl];
        })
      );
      setLinks(Object.fromEntries(signed.filter(([, url]) => url)));

      // Initialize selected group if not set
      if (!selectedGroup && ids.length > 0) {
        setSelectedGroup(ids[0]);
      }

    } catch (error) {
      tell(`Could not load mentor data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.id]);

  // Sync profile details to form when profile is loaded
  useEffect(() => {
    if (profile) {
      setProfileForm({
        phone: profile.phone || '',
        organisation: profile.organisation || '',
        bio: profile.bio || '',
        interests: profile.interests || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile]);

  // Sync default group ID in meetings form
  useEffect(() => {
    if (groups.length > 0 && !newMeeting.group_id) {
      setNewMeeting(prev => ({ ...prev, group_id: groups[0].id }));
    }
  }, [groups]);

  // Standard Milestones Auto-Initializer
  const autoInitMilestones = async (groupId) => {
    setSaving(true);
    try {
      const standardMilestones = [
        { title: 'Onboarding & Setup', description: 'Establish team guidelines, setup dev environment, complete registrations.' },
        { title: 'Project Proposal', description: 'Submit detailed design document, requirements, architecture.' },
        { title: 'Weekly Update 1', description: 'Check point for initial development and database setups.' },
        { title: 'Midterm Review', description: 'Evaluate primary prototype code demonstration and design review.' },
        { title: 'Weekly Update 2', description: 'Complete system integration and test cases.' },
        { title: 'Final Report & Submission', description: 'Submit source code repository, final report, and video presentation.' }
      ];

      const payloads = standardMilestones.map(m => ({
        group_id: groupId,
        title: m.title,
        description: m.description,
        status: 'not_started',
        updated_by: profile.id
      }));

      const { error } = await supabase.from('milestones').insert(payloads);
      if (error) throw error;
      
      // Notify students
      const members = groups.find(g => g.id === groupId)?.members || [];
      for (const m of members) {
        await supabase.from('notifications').insert({
          user_id: m.id,
          title: 'Internship Milestones Initialized',
          content: 'Your mentor has setup the milestone roadmap for your team.',
          link: '/student'
        });
      }

      await load();
      tell('Milestones initialized successfully.');
    } catch (err) {
      tell(`Failed to initialize milestones: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateMilestoneStatus = async (milestoneId, newStatus) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('milestones')
        .update({ 
          status: newStatus,
          updated_by: profile.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);
      if (error) throw error;

      // Trigger notifications for students
      const gid = Object.keys(milestones).find(key => milestones[key].some(m => m.id === milestoneId));
      const mTitle = milestones[gid]?.find(m => m.id === milestoneId)?.title || 'Milestone';
      const members = groups.find(g => g.id === gid)?.members || [];
      for (const m of members) {
        await supabase.from('notifications').insert({
          user_id: m.id,
          title: 'Milestone Updated',
          content: `Milestone "${mTitle}" has been marked as ${newStatus.replace('_', ' ')}.`,
          link: '/student'
        });
      }

      await load();
      tell('Milestone status updated.');
    } catch (err) {
      tell(err.message);
    } finally {
      setSaving(false);
    }
  };

  const reply = async (query) => {
    const answer = window.prompt(`Reply to ${query.submitter}:`, query.answer || '');
    if (answer === null || !answer.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('queries')
        .update({ answer: answer.trim(), answered_at: new Date().toISOString() })
        .eq('id', query.id);
      if (error) throw error;
      
      // Notify students in the group
      const members = groups.find(g => g.id === query.group_id)?.members || [];
      for (const m of members) {
        await supabase.from('notifications').insert({
          user_id: m.id,
          title: 'Query Answered',
          content: `Your mentor answered query: "${query.question.slice(0, 30)}..."`,
          link: '/student'
        });
      }

      await load();
      tell('Reply saved.');
    } catch (error) {
      tell(error.message);
    } finally {
      setSaving(false);
    }
  };

  const review = async (report) => {
    const draft = drafts[report.id];
    setSaving(true);
    
    // Formatting checklist feedback string
    const checklistStr = `Checklist Completed:
- Plagiarism Check: ${checklist.plagiarism ? 'PASSED' : 'NOT VERIFIED'}
- Formatting Verification: ${checklist.formatting ? 'PASSED' : 'NOT VERIFIED'}
- Code / Demo Verification: ${checklist.codeVerified ? 'PASSED' : 'NOT VERIFIED'}
- References Verified: ${checklist.references ? 'PASSED' : 'NOT VERIFIED'}

Mentor Comments:
${draft.feedback.trim() || 'No additional comments provided.'}`;

    try {
      const { error } = await supabase
        .from('reports')
        .update({ 
          status: draft.status, 
          feedback: checklistStr, 
          reviewed_by: profile.id, 
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', report.id);
      if (error) throw error;

      // Notify submitter and group members
      const members = groups.find(g => g.id === report.group_id)?.members || [];
      for (const m of members) {
        await supabase.from('notifications').insert({
          user_id: m.id,
          title: `Report Review: ${draft.status.replace('_', ' ').toUpperCase()}`,
          content: `Feedback has been posted on: ${report.title}`,
          link: '/student'
        });
      }

      await load();
      // Reset checklist
      setChecklist({ plagiarism: false, formatting: false, codeVerified: false, references: false });
      tell('Report review saved and students notified.');
    } catch (error) {
      tell(error.message);
    } finally {
      setSaving(false);
    }
  };  const approveMentorCertificate = async (studentId, groupId) => {
    if (!window.confirm('Approve and sign the completion certificate for this student?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('certificates')
        .update({ 
          mentor_approved: true,
          mentor_approved_by: profile.id,
          mentor_approved_at: new Date().toISOString()
        })
        .eq('recipient_id', studentId);
      if (error) throw error;

      // Notify the student that they can now download their certificate
      await supabase.from('notifications').insert({
        user_id: studentId,
        title: 'Internship Completed & Certified!',
        content: 'Your internship completion certificate has been fully approved by your mentor. You can now view and print it.',
        link: '/student'
      });

      await load();
      tell('Certificate signed and approved successfully.');
    } catch (err) {
      tell(`Failed to approve certificate: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const revertMentorCertificate = async (studentId, groupId) => {
    if (!window.confirm('Revert your signature/approval for this student?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('certificates')
        .update({ 
          mentor_approved: false,
          mentor_approved_by: null,
          mentor_approved_at: null
        })
        .eq('recipient_id', studentId);
      if (error) throw error;

      await load();
      tell('Mentor approval reverted successfully.');
    } catch (err) {
      tell(`Failed to revert approval: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const makeTeamLead = async (studentId, groupId) => {
    if (!window.confirm('Are you sure you want to change the Team Lead to this student?')) return;
    setSaving(true);
    try {
      const { error: resetError } = await supabase
        .from('profiles')
        .update({ is_lead: false })
        .eq('group_id', groupId)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (resetError) throw resetError;

      const { error: setLeadError } = await supabase
        .from('profiles')
        .update({ is_lead: true })
        .eq('id', studentId);
      if (setLeadError) throw setLeadError;

      await load();
      tell('Team Lead assigned successfully.');
    } catch (error) {
      console.error(error);
      tell(`Failed to assign Team Lead: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const scheduleMeeting = async (e) => {
    e.preventDefault();
    if (!newMeeting.group_id) return;
    setSaving(true);
    
    const groupStudents = groups.find(g => g.id === newMeeting.group_id)?.members || [];
    try {
      const { error } = await supabase.from('meetings').insert({
        group_id: newMeeting.group_id,
        mentor_id: profile.id,
        held_at: newMeeting.held_at,
        notes: newMeeting.notes.trim(), // agenda
        next_actions: '',
        meeting_link: newMeeting.meeting_link.trim() || null,
        attendance: null,
        status: 'scheduled'
      });
      if (error) throw error;

      // Notify students
      for (const s of groupStudents) {
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'Mentorship Meeting Scheduled',
          content: `A mentorship meeting has been scheduled for ${new Date(newMeeting.held_at).toLocaleString()}. ${newMeeting.meeting_link ? 'Meet link attached.' : ''}`,
          link: '/student'
        });
      }

      setNewMeeting({
        group_id: groups[0]?.id || '',
        notes: '',
        next_actions: '',
        meeting_link: '',
        held_at: new Date().toISOString().slice(0, 16)
      });
      await load();
      tell('Meeting scheduled successfully.');
    } catch (err) {
      tell(`Failed to schedule meeting: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const conductMeeting = async (e) => {
    e.preventDefault();
    if (!activeConductingMeeting) return;
    setSaving(true);

    const groupStudents = groups.find(g => g.id === activeConductingMeeting.group_id)?.members || [];
    const presentList = groupStudents
      .filter(s => presentStudents[s.id])
      .map(s => s.full_name)
      .join(', ') || 'None';

    try {
      let screenshotPath = null;
      if (meetingScreenshotFile) {
        const safeName = meetingScreenshotFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        screenshotPath = `${profile.id}/${activeConductingMeeting.group_id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('meetings')
          .upload(screenshotPath, meetingScreenshotFile);
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'conducted',
          notes: activeConductingMeeting.notes.trim(), // actual discussion
          next_actions: activeConductingMeeting.next_actions.trim(),
          attendance: presentList,
          screenshot_url: screenshotPath
        })
        .eq('id', activeConductingMeeting.id);

      if (error) throw error;

      // Notify students in the group
      for (const s of groupStudents) {
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'Meeting Logged by Mentor',
          content: `Meeting held on ${new Date(activeConductingMeeting.held_at).toLocaleDateString()} has been logged. Check the agenda and next steps.`,
          link: '/student'
        });
      }

      setActiveConductingMeeting(null);
      setPresentStudents({});
      setMeetingScreenshotFile(null);
      await load();
      tell('Meeting conducted and logged successfully.');
    } catch (err) {
      tell(`Failed to log meeting: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleViewMeetingScreenshot = async (filePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('meetings')
        .createSignedUrl(filePath, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error(error);
      tell(`Could not load screenshot: ${error.message}`);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: profileForm.phone.trim(),
          organisation: profileForm.organisation.trim(),
          bio: profileForm.bio.trim(),
          interests: profileForm.interests.trim(),
          avatar_url: profileForm.avatar_url.trim()
        })
        .eq('id', profile.id);
      if (error) throw error;
      tell('Profile updated successfully.');
      await load();
    } catch (err) {
      tell(`Profile update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getGroupProgress = (groupId) => {
    const list = milestones[groupId] || [];
    if (!list.length) return 0;
    const approvedCount = list.filter(m => m.status === 'approved').length;
    return Math.round((approvedCount / list.length) * 100);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading mentor dashboard…</div>;

  const pending = reports.filter((report) => !['approved', 'changes_requested'].includes(report.status || 'submitted')).length;

  return (
    <div style={{ padding: '2rem 0' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', margin: 0 }}>Mentor Hub</h2>
          <p style={muted}>Welcome, {profile?.full_name} · IEEE EMBS Project Mentor</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('groups')}><Users size={16} /> My Groups</button>
          <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('reports')}><ClipboardList size={16} /> Reports ({pending})</button>
          <button className={`btn ${activeTab === 'meetings' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('meetings')}><BookOpen size={16} /> Meeting Logs</button>
          <button className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('announcements')}><Bell size={16} /> Notices</button>
          <button className={`btn ${activeTab === 'queries' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('queries')}><HelpCircle size={16} /> Queries ({queries.filter(q => !q.answer).length})</button>
          <button className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('templates')}><FileSpreadsheet size={16} /> Formats</button>
          <button className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('profile')}><UserCheck size={16} /> My Profile</button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--info-light)', color: 'var(--ieee-blue)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0, 98, 155, 0.2)' }}>
          {notice}
        </div>
      )}

      {myCertificate && (
        <div className="glass animate-fade-in animate-float" style={{ ...card, background: 'linear-gradient(135deg, #fff 0%, rgba(0, 98, 155, 0.05) 100%)', borderColor: 'rgba(0, 98, 155, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-full)', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={26} />
            </div>
            <div>
              <h3 style={{ color: 'var(--ieee-dark-blue)', margin: 0, fontSize: '1.15rem' }}>Appreciation Certificate Issued!</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Thank you for your valuable guidance and mentorship. Your official appreciation certificate is available for download.
              </p>
            </div>
          </div>
          <button onClick={() => setCertPreview(myCertificate)} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }}>
            <Award size={16} /> View Appreciation Certificate
          </button>
        </div>
      )}

      {/* Stats row */}
      {activeTab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <Stat label="Assigned Groups" value={groups.length} icon={<Users size={22} style={{ color: 'var(--ieee-blue)' }} />} />
          <Stat label="Pending Reviews" value={pending} icon={<ClipboardList size={22} style={{ color: 'var(--warning)' }} />} />
          <Stat label="Unresolved Queries" value={queries.filter(q => !q.answer).length} icon={<HelpCircle size={22} style={{ color: 'var(--error)' }} />} />
        </div>
      )}

      {/* TABS CONTENT */}

      {activeTab === 'groups' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Groups list */}
          <div className="sidebar-tabs" style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '0.5rem 1rem' }}>Your Teams</h4>
            {groups.map(g => (
              <button 
                key={g.id} 
                className={`tab-btn ${selectedGroup === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGroup(g.id)}
                style={{ width: '100%' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', width: '100%' }}>
                  <strong>{g.id}</strong>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Progress: {getGroupProgress(g.id)}%</span>
                </div>
              </button>
            ))}
            {groups.length === 0 && <p style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No groups assigned to you.</p>}
          </div>

          {/* Group details & Milestones tracker */}
          {selectedGroup && (
            <div className="glass" style={card}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'var(--ieee-dark-blue)' }}>Team Dashboard: {selectedGroup}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Domain Focus: <strong>{groups.find(g => g.id === selectedGroup)?.domain}</strong>
                </span>
                
                {/* Visual Progress Bar */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <span>Internship Milestones Progress</span>
                    <span>{getGroupProgress(selectedGroup)}% Completed</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar-fill" style={{ width: `${getGroupProgress(selectedGroup)}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Student Members List */}
              {(() => {
                const currentGroupMembers = groups.find(g => g.id === selectedGroup)?.members || [];
                const allSections = [...new Set(currentGroupMembers.map(p => p.section).filter(Boolean))];
                const allCities = [...new Set(currentGroupMembers.map(p => p.city).filter(Boolean))];
                const allYears = [...new Set(currentGroupMembers.map(p => p.graduation_year).filter(Boolean))];
                const allColleges = [...new Set(currentGroupMembers.map(p => p.college).filter(Boolean))];
                const allOrgs = [...new Set(currentGroupMembers.map(p => p.organisation).filter(Boolean))];
                const allDesignations = [...new Set(currentGroupMembers.map(p => p.designation).filter(Boolean))];

                const filteredMembers = currentGroupMembers.filter(m => {
                  const matchesSection = mentorMgmtSectionFilter ? m.section === mentorMgmtSectionFilter : true;
                  const matchesCity = mentorMgmtCityFilter ? m.city === mentorMgmtCityFilter : true;
                  const matchesIeee = mentorMgmtIeeeFilter ? String(m.is_ieee_member) === mentorMgmtIeeeFilter : true;
                  const matchesYear = mentorMgmtYearFilter ? m.graduation_year === mentorMgmtYearFilter : true;
                  const matchesCollege = mentorMgmtCollegeFilter ? m.college === mentorMgmtCollegeFilter : true;
                  const matchesOrg = mentorMgmtOrgFilter ? m.organisation === mentorMgmtOrgFilter : true;
                  const matchesDesignation = mentorMgmtDesignationFilter ? m.designation === mentorMgmtDesignationFilter : true;
                  return matchesSection && matchesCity && matchesIeee && matchesYear && matchesCollege && matchesOrg && matchesDesignation;
                });

                return (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Student Members ({filteredMembers.length})</h4>
                    
                    {/* Advanced Filters */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Section</label>
                        <select value={mentorMgmtSectionFilter} onChange={(e) => setMentorMgmtSectionFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>City</label>
                        <select value={mentorMgmtCityFilter} onChange={(e) => setMentorMgmtCityFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>IEEE Member</label>
                        <select value={mentorMgmtIeeeFilter} onChange={(e) => setMentorMgmtIeeeFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Grad Year</label>
                        <select value={mentorMgmtYearFilter} onChange={(e) => setMentorMgmtYearFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>College</label>
                        <select value={mentorMgmtCollegeFilter} onChange={(e) => setMentorMgmtCollegeFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Org</label>
                        <select value={mentorMgmtOrgFilter} onChange={(e) => setMentorMgmtOrgFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allOrgs.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Designation</label>
                        <select value={mentorMgmtDesignationFilter} onChange={(e) => setMentorMgmtDesignationFilter(e.target.value)} style={{ padding: '0.25rem', fontSize: '0.7rem' }}>
                          <option value="">All</option>
                          {allDesignations.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {filteredMembers.map(member => (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', minWidth: '220px', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--ieee-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              {member.full_name.charAt(0)}
                            </div>
                            <div style={{ fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {member.full_name}
                                {member.is_lead && <span style={{ color: 'var(--warning)', fontSize: '0.7rem' }} title="Team Lead">👑 Lead</span>}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{member.email}</div>
                            </div>
                          </div>
                          {!member.is_lead && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                              onClick={() => makeTeamLead(member.id, selectedGroup)}
                              disabled={saving}
                            >
                              Make Lead
                            </button>
                          )}
                        </div>
                      ))}
                      {filteredMembers.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No members match the filters.</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Internship Completion & Certificates (2-Stage Approval View) */}
              <div style={{ marginBottom: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Internship Completion & Certificate Approvals</h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {groups.find(g => g.id === selectedGroup)?.members.map(member => {
                    const cert = certificates.find(c => c.recipient_id === member.id && c.recipient_role === 'student');
                    const isAdminApproved = cert && cert.admin_approved;
                    const isMentorApproved = cert && cert.mentor_approved;
                    
                    return (
                      <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{member.full_name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>({member.email})</span>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                            <span className={`badge ${isAdminApproved ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                              Admin: {isAdminApproved ? 'Approved' : 'Pending'}
                            </span>
                            <span className={`badge ${isMentorApproved ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                              Mentor: {isMentorApproved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {!cert || !isAdminApproved ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Awaiting Coordinator Approval</span>
                          ) : isMentorApproved ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => setCertPreview(cert)}
                              >
                                View Preview
                              </button>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                                onClick={() => revertMentorCertificate(member.id, selectedGroup)}
                                disabled={saving}
                              >
                                Revert Sign
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} 
                              onClick={() => approveMentorCertificate(member.id, selectedGroup)}
                              disabled={saving}
                            >
                              Approve & Sign Certificate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {groups.find(g => g.id === selectedGroup)?.members.length === 0 && (
                    <p style={{ ...muted, fontStyle: 'italic' }}>No students in this group yet.</p>
                  )}
                </div>
              </div>

              {/* Milestones Stepper */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4>Internship Milestones Roadmap</h4>
                  {(!milestones[selectedGroup] || milestones[selectedGroup].length === 0) && (
                    <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => autoInitMilestones(selectedGroup)} disabled={saving}>
                      Initialize Standard Roadmap
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {milestones[selectedGroup]?.map(milestone => (
                    <div key={milestone.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{milestone.title}</strong>
                          <span className={`badge ${milestone.status === 'approved' ? 'badge-success' : milestone.status === 'submitted' ? 'badge-info' : milestone.status === 'in_progress' ? 'badge-warning' : 'badge-error'}`}>
                            {milestone.status.replace('_', ' ')}
                          </span>
                        </div>
                        {milestone.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{milestone.description}</p>}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select 
                          value={milestone.status} 
                          onChange={(e) => updateMilestoneStatus(milestone.id, e.target.value)}
                          style={{ padding: '0.4rem', fontSize: '0.8rem', width: 'auto' }}
                          disabled={saving}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  {milestones[selectedGroup]?.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Roadmap has not been initialized yet. Click above to populate the timeline.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <section className="glass" style={card}>
          <h3><ClipboardList size={20} /> Report Review Hub</h3>
          <p style={{ ...muted, marginBottom: '1.5rem' }}>Check, checklist, and grade team progress reports.</p>
          
          {reports.length ? reports.map((report) => (
            <article key={report.id} style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem 0', display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--ieee-dark-blue)' }}>{report.title}</strong>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem', marginTop: '0.2rem', alignItems: 'center' }}>
                    {report.week_number && <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.05rem 0.25rem' }}>Week {report.week_number}</span>}
                    <span style={muted}>
                      Group: <strong>{report.group_id}</strong> · submitted by {report.submitter} · {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>
                  {report.due_date && (
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#fef2f2', color: 'var(--error)', fontWeight: 600, display: 'inline-block', marginTop: '0.25rem' }}>
                      {new Date(report.created_at) > new Date(report.due_date) ? 'Late Submission' : 'On Time'}
                    </span>
                  )}
                </div>
                <span className={`badge ${report.status === 'approved' ? 'badge-success' : report.status === 'changes_requested' ? 'badge-error' : 'badge-warning'}`}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>
              
              {report.content && (
                <p style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                  {report.content}
                </p>
              )}
              
              {links[report.id] && (
                <div>
                  <a href={links[report.id]} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                    View Attached Report File
                  </a>
                </div>
              )}

              {/* Review Panel */}
              <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'grid', gap: '1rem' }}>
                {/* Checklist */}
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Review Checklist:</strong>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checklist.plagiarism} onChange={(e) => setChecklist({ ...checklist, plagiarism: e.target.checked })} style={{ width: 'auto' }} /> Plagiarism checked
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checklist.formatting} onChange={(e) => setChecklist({ ...checklist, formatting: e.target.checked })} style={{ width: 'auto' }} /> Format requirements met
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checklist.codeVerified} onChange={(e) => setChecklist({ ...checklist, codeVerified: e.target.checked })} style={{ width: 'auto' }} /> Code/Prototype verified
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checklist.references} onChange={(e) => setChecklist({ ...checklist, references: e.target.checked })} style={{ width: 'auto' }} /> References verified
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Decision Status</label>
                    <select 
                      value={drafts[report.id]?.status || 'submitted'} 
                      onChange={(event) => setDrafts({ ...drafts, [report.id]: { ...drafts[report.id], status: event.target.value } })}
                      style={{ marginTop: '0.25rem' }}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="in_review">In review</option>
                      <option value="approved">Approved</option>
                      <option value="changes_requested">Changes requested</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Feedback Comments</label>
                    <textarea 
                      placeholder="Add review feedback for the student group..." 
                      value={drafts[report.id]?.feedback || ''} 
                      onChange={(event) => setDrafts({ ...drafts, [report.id]: { ...drafts[report.id], feedback: event.target.value } })}
                      style={{ marginTop: '0.25rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" disabled={saving} onClick={() => review(report)}>
                    Submit Report Evaluation
                  </button>
                </div>
              </div>
            </article>
          )) : <p style={muted}>No reports have been submitted by your groups yet.</p>}
        </section>
      )}

      {activeTab === 'meetings' && (() => {
        const scheduledMeetings = meetings.filter(m => m.status === 'scheduled');
        const conductedMeetings = meetings.filter(m => m.status === 'conducted');

        return (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '1.5rem', alignItems: 'start', flexWrap: 'wrap' }}>
            
            {/* Form to schedule meeting */}
            <div className="glass" style={card}>
              <h3>Schedule Mentorship Meeting</h3>
              <p style={{ ...muted, marginBottom: '1rem' }}>Set up an upcoming meeting with your group/team.</p>
              <form onSubmit={scheduleMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Group / Team</label>
                  <select 
                    value={newMeeting.group_id}
                    required
                    onChange={(e) => {
                      setNewMeeting({ ...newMeeting, group_id: e.target.value });
                    }}
                  >
                    <option value="" disabled>Select Group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.id} - {g.domain}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Scheduled Time</label>
                  <input type="datetime-local" required value={newMeeting.held_at} onChange={(e) => setNewMeeting({ ...newMeeting, held_at: e.target.value })} />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Meeting Agenda / Topic</label>
                  <textarea placeholder="Agenda, topics to cover, goals of the meeting..." required value={newMeeting.notes} onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })} style={{ minHeight: '80px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Google Meet Link (Optional)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input 
                      type="url" 
                      placeholder="https://meet.google.com/xxx-yyyy-zzz" 
                      value={newMeeting.meeting_link} 
                      onChange={(e) => setNewMeeting({ ...newMeeting, meeting_link: e.target.value })} 
                    />
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }} 
                      onClick={() => {
                        const chars = 'abcdefghijklmnopqrstuvwxyz';
                        const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                        const link = `https://meet.google.com/${randPart(3)}-${randPart(4)}-${randPart(3)}`;
                        setNewMeeting({ ...newMeeting, meeting_link: link });
                      }}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <button className="btn btn-primary" disabled={saving || !newMeeting.group_id}>Schedule Meeting</button>
              </form>
            </div>

            {/* Meetings Lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Upcoming Scheduled Meetings */}
              <div className="glass" style={card}>
                <h3>Scheduled Meetings ({scheduledMeetings.length})</h3>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {scheduledMeetings.length === 0 ? <p style={muted}>No upcoming meetings scheduled.</p> : 
                    scheduledMeetings.map(m => (
                      <article key={m.id} style={{ padding: '1rem', border: '1px solid rgba(0, 98, 155, 0.15)', borderRadius: 'var(--radius-md)', background: 'linear-gradient(to right bottom, #fff, rgba(0, 98, 155, 0.01))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--ieee-blue)' }}>{m.group_id} Meeting</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{new Date(m.held_at).toLocaleString()}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', margin: '0.5rem 0' }}><strong>Agenda:</strong> {m.notes}</p>
                          {m.meeting_link && (
                            <a href={m.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#0f9d58', border: 'none', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 600, width: 'fit-content' }}>
                              Join Google Meet
                            </a>
                          )}
                        </div>
                        <button 
                          className="btn btn-secondary animate-pulse-soft" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                          onClick={() => setActiveConductingMeeting({ ...m, notes: '', next_actions: '' })}
                        >
                          Conduct & Log Attendance
                        </button>
                      </article>
                    ))
                  }
                </div>
              </div>

              {/* Logged / Conducted Meeting History */}
              <div className="glass" style={card}>
                <h3>Conducted Meeting Logs ({conductedMeetings.length})</h3>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {conductedMeetings.length === 0 ? <p style={muted}>No conducted meetings logged yet.</p> : 
                    conductedMeetings.map(m => (
                      <article key={m.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{m.group_id} Logged Meeting</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(m.held_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, margin: '0.2rem 0 0.5rem' }}>
                          Attendees Check: {m.attendance || 'None'}
                        </div>
                        <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}><strong>Discussion Notes:</strong> {m.notes}</p>
                        {m.next_actions && (
                          <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            <strong>Action Items:</strong> {m.next_actions}
                          </div>
                        )}
                        {m.screenshot_url && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => handleViewMeetingScreenshot(m.screenshot_url)}
                            >
                              View Meeting Screenshot
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  }
                </div>
              </div>

            </div>

          </div>
        );
      })()}

      {activeTab === 'queries' && (
        <section className="glass" style={card}>
          <h3><HelpCircle size={20} /> Student Q&A Helpdesk</h3>
          <p style={{ ...muted, marginBottom: '1.5rem' }}>Provide guidance and reply to student query tickets.</p>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {queries.length ? queries.map((query) => (
              <article key={query.id} style={{ borderTop: '1px solid var(--border-color)', padding: '1rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Group: {query.group_id} · {query.submitter}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(query.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>{query.question}</p>
                {query.answer ? (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                    <strong>Reply:</strong> {query.answer}
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      Answered on {new Date(query.answered_at).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <button className="btn btn-secondary animate-pulse" style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={saving} onClick={() => reply(query)}>
                    Reply to Student
                  </button>
                )}
              </article>
            )) : <p style={muted}>No student queries have been submitted.</p>}
          </div>
        </section>
      )}

      {activeTab === 'profile' && (
        <div className="glass animate-fade-in" style={{ ...card, maxWidth: '600px', margin: '0 auto' }}>
          <h3>Update Profile Settings</h3>
          <p style={{ ...muted, marginBottom: '1.5rem' }}>Personalize your bio, phone, and professional details.</p>
          
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
              <input value={profile?.full_name} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
            </div>
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
              <input value={profile?.email} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Phone Number</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
                <input placeholder="Enter phone number" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Organisation / Institution</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
                <input placeholder="Enter current company/college" value={profileForm.organisation} onChange={(e) => setProfileForm({ ...profileForm, organisation: e.target.value })} style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Areas of Interest / Domain Expertise</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <Tag size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
                <input placeholder="E.g., Medical Devices, Bioinformatics, Signal Processing" value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })} style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Short Biography</label>
              <textarea placeholder="Describe your background and expertise..." value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Profile Image URL (Avatar)</label>
              <input placeholder="https://example.com/avatar.jpg" value={profileForm.avatar_url} onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} />
            </div>

            <button className="btn btn-primary" disabled={saving}><Save size={16} /> Save Changes</button>
          </form>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="glass animate-fade-in" style={card}>
          <h3><Bell size={20} /> Notices & Announcements</h3>
          <p style={muted}>Official notices and deadlines from program coordinators.</p>
          
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {announcements.length === 0 ? <p style={muted}>No notices active.</p> :
              announcements.map(ann => (
                <article key={ann.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                    <h4 style={{ color: 'var(--ieee-dark-blue)', fontSize: '1.05rem', margin: 0 }}>{ann.title}</h4>
                    {ann.deadline_at && (
                      <span className="badge badge-error">
                        Deadline: {new Date(ann.deadline_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>{ann.content}</p>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.5rem' }}>
                    Posted: {new Date(ann.created_at).toLocaleString()}
                  </span>
                </article>
              ))
            }
          </div>
        </div>
      )}
      {activeTab === 'templates' && (
        <div className="glass animate-fade-in" style={card}>
          <h3><FileSpreadsheet size={20} style={{ color: 'var(--ieee-blue)' }} /> Resource Formats & Templates</h3>
          <p style={muted}>Download official guidelines, PPT templates, and certificate formats uploaded by the Coordinator.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            {templates.length === 0 ? (
              <p style={muted}>No formats uploaded yet.</p>
            ) : (
              templates.map(t => (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff', gap: '1rem' }} className="glass-hover">
                  <div>
                    <span className={`badge ${t.type === 'report' ? 'badge-info' : t.type === 'presentation' ? 'badge-success' : 'badge-warning'}`} style={{ marginBottom: '0.5rem' }}>
                      {t.type === 'report' ? 'Report Doc' : t.type === 'presentation' ? 'Presentation PPT' : 'Certificate Format'}
                    </span>
                    <h4 style={{ color: 'var(--ieee-dark-blue)', margin: 0, fontSize: '0.95rem' }}>{t.name}</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                      Uploaded: {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <a href={t.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', width: '100%' }}>
                    <FileUp size={14} /> Download Format
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {/* Certificate Printing / Preview Overlay Modal */}
      {certPreview && (() => {
        const isStudent = certPreview.recipient_role === 'student';
        let recipientName = 'Recipient Name';
        let domainName = 'General Engineering';
        if (certPreview.recipient_id === profile.id) {
          recipientName = profile.full_name;
        } else if (isStudent) {
          let foundStudent = null;
          for (const g of groups) {
            const s = g.members?.find(m => m.id === certPreview.recipient_id);
            if (s) {
              foundStudent = s;
              domainName = g.domain || 'General Engineering';
              break;
            }
          }
          recipientName = foundStudent?.full_name || 'Student Intern';
        }
        return (
          <CertificatePreviewModal 
            certificate={certPreview} 
            recipientName={recipientName} 
            domainName={domainName} 
            onClose={() => setCertPreview(null)} 
          />
        );
      })()}
      {/* Conduct/Log Meeting Modal Overlay */}
      {activeConductingMeeting && (() => {
        const groupStudents = groups.find(g => g.id === activeConductingMeeting.group_id)?.members || [];
        return (
          <div className="certificate-preview-overlay no-print" onClick={() => { setActiveConductingMeeting(null); setPresentStudents({}); }}>
            <div className="glass" style={{ ...card, maxWidth: '500px', width: '90%', padding: '2rem', background: '#fff', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: 0 }}>Log Meeting Attendance & Notes</h3>
              <p style={{ ...muted, margin: 0 }}>Log details for scheduled meeting of group <strong>{activeConductingMeeting.group_id}</strong>.</p>
              
              <form onSubmit={conductMeeting} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Attendance check */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Attendance Check</label>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'grid', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {groupStudents.map(student => (
                      <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={!!presentStudents[student.id]}
                          onChange={(e) => setPresentStudents({ ...presentStudents, [student.id]: e.target.checked })}
                          style={{ width: 'auto' }}
                        />
                        {student.full_name}
                      </label>
                    ))}
                    {groupStudents.length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No students in this group yet.</span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Meeting Discussion / Notes</label>
                  <textarea 
                    required
                    placeholder="Describe what was discussed, progress reviews, questions answered..." 
                    value={activeConductingMeeting.notes || ''} 
                    onChange={(e) => setActiveConductingMeeting({ ...activeConductingMeeting, notes: e.target.value })} 
                    style={{ minHeight: '80px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Next Action Items</label>
                  <textarea 
                    required
                    placeholder="What tasks should the interns work on next?" 
                    value={activeConductingMeeting.next_actions || ''} 
                    onChange={(e) => setActiveConductingMeeting({ ...activeConductingMeeting, next_actions: e.target.value })} 
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Upload Meeting Screenshot (Image/PDF)</label>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setMeetingScreenshotFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.8rem', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? 'Saving Log...' : 'Save Conducted Log'}
                  </button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setActiveConductingMeeting(null); setPresentStudents({}); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{label}</p>
        <strong style={{ fontSize: '1.75rem' }}>{value}</strong>
      </div>
      {icon}
    </div>
  );
}