import { useEffect, useRef, useState } from 'react';
import { 
  Users, Settings, FileSpreadsheet, Upload, UserPlus, 
  Bell, FileText, Award, BarChart3, Trash2, AlertTriangle, Search, Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const fileTypes = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';
const emptyPerson = { id: '', full_name: '', email: '', role: 'mentor', domain: '', group_id: '', mentor_capacity: 4 };
const normalise = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const findColumn = (row, names) => Object.keys(row).find((key) => names.includes(normalise(key)));

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [certificates, setCertificates] = useState([]);
  
  // Filtering and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [person, setPerson] = useState(emptyPerson);
  const [importRole, setImportRole] = useState('mentor');
  const [parsedPeople, setParsedPeople] = useState(null);
  const [parsedTeams, setParsedTeams] = useState(null);
  
  // Announcements form
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', audience: 'all', deadline_at: '' });
  
  const peopleInputRef = useRef(null);
  const teamsInputRef = useRef(null);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: groupData, error: groupError }, { data: reportData, error: reportError }, { data: annData, error: annError }, { data: certData, error: certError }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('groups').select('*').order('id'),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('certificates').select('*').order('issued_at', { ascending: false })
      ]);

      if (profilesError) throw profilesError;
      if (groupError) throw groupError;
      if (reportError) throw reportError;
      if (annError) throw annError;
      if (certError) throw certError;

      const allProfiles = profiles || [];
      setStudents(allProfiles.filter((profile) => profile.role === 'student'));
      setMentors(allProfiles.filter((profile) => profile.role === 'mentor'));
      setAnnouncements(annData || []);
      setCertificates(certData || []);
      
      setGroups((groupData || []).map((group) => ({
        ...group,
        mentor: allProfiles.find((profile) => profile.id === group.mentor_id) || null,
        members: allProfiles.filter((profile) => profile.role === 'student' && profile.group_id === group.id),
      })));

      setReports((reportData || []).map((report) => ({
        ...report,
        submitter: allProfiles.find((profile) => profile.id === report.submitted_by)?.full_name || 'Student',
        reviewer: allProfiles.find((profile) => profile.id === report.reviewed_by)?.full_name || null,
      })));

    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      showNotice(`Could not load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const savePerson = async (event) => {
    event.preventDefault();
    if (!person.id || !person.full_name || !person.email) {
      showNotice('Auth User ID, full name, and email are required.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: person.id.trim(),
        full_name: person.full_name.trim(),
        email: person.email.trim().toLowerCase(),
        role: person.role,
        domain: person.domain.trim() || null,
        mentor_capacity: person.role === 'mentor' ? parseInt(person.mentor_capacity) || 4 : null,
        group_id: person.role === 'student' ? person.group_id.trim() || null : null,
      }, { onConflict: 'id' });
      if (error) throw error;
      setPerson({ ...emptyPerson, role: person.role });
      await fetchDashboardData();
      showNotice(`${person.role === 'mentor' ? 'Mentor' : 'Student'} profile saved successfully.`);
    } catch (error) {
      console.error('Error saving profile:', error);
      showNotice(`Could not save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const assignMentor = async (groupId, mentorId) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('groups').update({ mentor_id: mentorId || null }).eq('id', groupId);
      if (error) throw error;
      
      // Notify the mentor
      if (mentorId) {
        await supabase.from('notifications').insert({
          user_id: mentorId,
          title: 'New Mentor Assignment',
          content: `You have been assigned to mentor group ${groupId}.`,
          link: '/mentor'
        });
        
        // Notify students in the group
        const groupMembers = students.filter(s => s.group_id === groupId);
        const mentorName = mentors.find(m => m.id === mentorId)?.full_name || 'a Mentor';
        for (const member of groupMembers) {
          await supabase.from('notifications').insert({
            user_id: member.id,
            title: 'Mentor Assigned',
            content: `${mentorName} has been assigned as your group mentor.`,
            link: '/student'
          });
        }
      }

      await fetchDashboardData();
      showNotice('Mentor assignment saved.');
    } catch (error) {
      console.error('Error assigning mentor:', error);
      showNotice(`Could not assign mentor: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const moveStudentGroup = async (studentId, groupId) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ group_id: groupId || null }).eq('id', studentId);
      if (error) throw error;
      
      if (groupId) {
        await supabase.from('notifications').insert({
          user_id: studentId,
          title: 'Group Reassignment',
          content: `You have been moved to group ${groupId}.`,
          link: '/student'
        });
      }
      
      await fetchDashboardData();
      showNotice('Student group reassignment complete.');
    } catch (error) {
      console.error('Error moving student:', error);
      showNotice(`Could not move student: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.content) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        audience: announcementForm.audience,
        deadline_at: announcementForm.deadline_at || null
      }).select();

      if (error) throw error;

      // Trigger notifications for target audience
      let targets = [];
      if (announcementForm.audience === 'all') {
        targets = [...students, ...mentors];
      } else if (announcementForm.audience === 'student') {
        targets = students;
      } else if (announcementForm.audience === 'mentor') {
        targets = mentors;
      }

      const notifData = targets.map(t => ({
        user_id: t.id,
        title: `Announcement: ${announcementForm.title}`,
        content: announcementForm.content.slice(0, 100) + (announcementForm.content.length > 100 ? '...' : ''),
        link: announcementForm.audience === 'mentor' ? '/mentor' : '/student'
      }));

      if (notifData.length) {
        await supabase.from('notifications').insert(notifData);
      }

      setAnnouncementForm({ title: '', content: '', audience: 'all', deadline_at: '' });
      await fetchDashboardData();
      showNotice('Announcement posted and notifications sent.');
    } catch (error) {
      showNotice(`Failed to post announcement: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      await fetchDashboardData();
      showNotice('Announcement deleted.');
    } catch (error) {
      showNotice(`Failed to delete announcement: ${error.message}`);
    }
  };

  const markInternshipCompleted = async (studentId, groupId) => {
    if (!window.confirm('Approve internship completion for this student?')) return;
    setSaving(true);
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase.from('certificates').upsert({
        student_id: studentId,
        group_id: groupId,
        admin_approved: true,
        admin_approved_by: adminId,
        admin_approved_at: new Date().toISOString()
      }, { onConflict: 'group_id,student_id' });
      if (error) throw error;

      // Notify the mentor that their approval is needed
      const mentorId = groups.find(g => g.id === groupId)?.mentor_id;
      if (mentorId) {
        await supabase.from('notifications').insert({
          user_id: mentorId,
          title: 'Certificate Approval Required',
          content: `Coordinator has approved completion for student in group ${groupId}. Your approval is required to issue the certificate.`,
          link: '/mentor'
        });
      }

      await fetchDashboardData();
      showNotice('Admin approval registered. Awaiting Mentor approval.');
    } catch (error) {
      console.error(error);
      showNotice(`Failed to register approval: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // CSV Import Helpers
  const readRows = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      callback(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
    };
    reader.readAsBinaryString(file);
  };

  const parsePeopleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readRows(file, (rows) => {
      const people = rows.map((row) => {
        const idKey = findColumn(row, ['id', 'authuserid', 'userid', 'uuid']);
        const nameKey = findColumn(row, ['fullname', 'name']);
        const emailKey = findColumn(row, ['email', 'emailaddress']);
        const domainKey = findColumn(row, ['domain']);
        const groupKey = findColumn(row, ['groupid', 'teamid']);
        const capKey = findColumn(row, ['capacity', 'capacitycount', 'mentorcapacity']);
        return {
          id: String(row[idKey] || '').trim(),
          full_name: String(row[nameKey] || '').trim(),
          email: String(row[emailKey] || '').trim().toLowerCase(),
          role: importRole,
          domain: String(row[domainKey] || '').trim() || null,
          mentor_capacity: importRole === 'mentor' ? parseInt(row[capKey]) || 4 : null,
          group_id: importRole === 'student' ? String(row[groupKey] || '').trim() || null : null,
        };
      }).filter((profile) => profile.full_name && profile.email);
      setParsedPeople(people);
      if (!people.length) showNotice('No valid rows found. Include Name and Email columns.');
    });
  };

  const importPeople = async () => {
    if (!parsedPeople?.length) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-provision-users', {
        body: { role: importRole, people: parsedPeople, redirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setParsedPeople(null);
      await fetchDashboardData();
      const failed = data.failed?.length || 0;
      showNotice(`${data.invited} ${importRole}(s) invited. ${data.existing} existing profile(s) skipped.${failed ? ` ${failed} row(s) need attention.` : ''}`);
    } catch (error) {
      console.error('Error importing people:', error);
      showNotice(`Import failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const parseTeamsFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readRows(file, (rows) => {
      let count = 1;
      const teamMap = new Map();
      const memberAssignments = [];
      rows.forEach((row) => {
        const keys = Object.keys(row);
        const teamKey = keys.find((key) => normalise(key).includes('teamid'));
        const domainKey = keys.find((key) => normalise(key).includes('domain'));
        const id = String(row[teamKey] || `EMBS-TEAM-${count++}`).trim();
        teamMap.set(id, { id, domain: String(row[domainKey] || 'General').trim() || 'General' });
        
        for (let index = 1; index <= 6; index += 1) {
          const nameKey = keys.find((key) => { const value = normalise(key); return value.includes('member') && value.includes('name') && value.endsWith(String(index)); });
          const emailKey = keys.find((key) => { const value = normalise(key); return value.includes('member') && (value.includes('email') || value.includes('mail')) && value.endsWith(String(index)); });
          if (row[nameKey] && row[emailKey]) {
            memberAssignments.push({ full_name: String(row[nameKey]).trim(), email: String(row[emailKey]).trim().toLowerCase(), group_id: id });
          }
        }
      });
      setParsedTeams({ groups: [...teamMap.values()], members: memberAssignments });
    });
  };

  const importTeams = async () => {
    if (!parsedTeams) return;
    setSaving(true);
    try {
      const { error: groupError } = await supabase.from('groups').upsert(parsedTeams.groups, { onConflict: 'id' });
      if (groupError) throw groupError;
      
      const emails = parsedTeams.members.map((member) => member.email);
      const { data: existing, error: profilesError } = await supabase.from('profiles').select('id, email').in('email', emails);
      if (profilesError) throw profilesError;
      
      const emailToId = new Map((existing || []).map((profile) => [profile.email.toLowerCase(), profile.id]));
      const updates = parsedTeams.members.filter((member) => emailToId.has(member.email)).map((member) => ({
        id: emailToId.get(member.email),
        group_id: member.group_id
      }));

      if (updates.length) {
        const { error: updateError } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' });
        if (updateError) throw updateError;
      }
      
      const missing = parsedTeams.members.length - updates.length;
      setParsedTeams(null);
      await fetchDashboardData();
      showNotice(`Imported ${parsedTeams.groups.length} groups and assigned ${updates.length} registered students.${missing ? ` ${missing} students still need Auth accounts and profiles.` : ''}`);
    } catch (error) {
      console.error('Error importing teams:', error);
      showNotice(`Team import failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Certificate printing
  const [certToPrint, setCertToPrint] = useState(null);
  const handlePrintCertificate = (cert) => {
    const studentInfo = students.find(s => s.id === cert.student_id);
    const groupInfo = groups.find(g => g.id === cert.group_id);
    setCertToPrint({
      code: cert.certificate_code,
      name: studentInfo?.full_name || 'Student Name',
      domain: groupInfo?.domain || 'General Domain',
      date: new Date(cert.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    });
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Suggestions for Group Mentor Assignment
  const getSuggestedMentors = (groupDomain) => {
    return mentors
      .map(m => {
        const assignedCount = groups.filter(g => g.mentor_id === m.id).length;
        const capacity = m.mentor_capacity || 4;
        const isMatch = m.domain && normalise(m.domain).includes(normalise(groupDomain));
        return { ...m, assignedCount, capacity, isMatch, score: (isMatch ? 10 : 0) + (capacity - assignedCount) };
      })
      .filter(m => m.assignedCount < m.capacity)
      .sort((a, b) => b.score - a.score);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading dashboard…</div>;

  // Search & Filter Logic
  const filteredReports = reports.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.submitter.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.group_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? r.status === statusFilter : true;
    const matchesDomain = domainFilter ? groups.find(g => g.id === r.group_id)?.domain === domainFilter : true;
    return matchesSearch && matchesStatus && matchesDomain;
  });

  const domains = [...new Set(groups.map(g => g.domain).filter(Boolean))];
  const unassignedStudents = students.filter(s => !s.group_id);
  const unassignedGroupsCount = groups.filter(g => !g.mentor_id).length;

  return (
    <div style={{ padding: '2rem 0' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>IEEE EMBS Admin Portal</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Pune Chapter Internship Coordinator Hub</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('analytics')}><BarChart3 size={16} /> Analytics</button>
          <button className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('teams')}><Users size={16} /> Teams</button>
          <button className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('announcements')}><Bell size={16} /> Announcements</button>
          <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('reports')}><FileText size={16} /> Reports</button>
          <button className={`btn ${activeTab === 'certificates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('certificates')}><Award size={16} /> Certificates</button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', color: 'var(--info)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          {notice}
        </div>
      )}

      {/* RENDER ACTIVE TAB */}

      {activeTab === 'analytics' && (
        <div className="animate-fade-in">
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Students</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{students.length}</strong>
                <Users size={24} style={{ color: 'var(--ieee-blue)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--error)', fontWeight: 600 }}>{unassignedStudents.length} unassigned</span>
            </div>
            
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Mentors</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{mentors.length}</strong>
                <Users size={24} style={{ color: 'var(--ieee-purple)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                Avg Cap: {(mentors.reduce((acc, m) => acc + (m.mentor_capacity || 4), 0) / (mentors.length || 1)).toFixed(1)} grps
              </span>
            </div>

            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Groups</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{groups.length}</strong>
                <Settings size={24} style={{ color: 'var(--ieee-dark-blue)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: unassignedGroupsCount > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                {unassignedGroupsCount} missing mentor
              </span>
            </div>

            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending Reports</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{reports.filter(r => r.status === 'submitted' || r.status === 'in_review').length}</strong>
                <FileText size={24} style={{ color: 'var(--warning)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Out of {reports.length} total reports</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Custom SVG Chart: Report Statuses */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Report Review Progress</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['approved', 'submitted', 'in_review', 'changes_requested'].map(status => {
                  const count = reports.filter(r => (r.status || 'submitted') === status).length;
                  const pct = reports.length ? (count / reports.length) * 100 : 0;
                  const label = status.replace('_', ' ').toUpperCase();
                  const barColor = status === 'approved' ? 'var(--success)' : status === 'submitted' ? 'var(--info)' : status === 'in_review' ? 'var(--warning)' : 'var(--error)';
                  return (
                    <div key={status} className="chart-bar-group">
                      <div className="chart-bar-label">{label} ({count})</div>
                      <div className="chart-bar-wrapper">
                        <div className="chart-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor, background: 'none' }}>
                          {count > 0 && `${pct.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom SVG Chart: Domain Distribution */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Group Domain Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '250px', overflowY: 'auto' }}>
                {domains.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No domains available</p> : 
                  domains.map(domain => {
                    const count = groups.filter(g => g.domain === domain).length;
                    const maxCount = Math.max(...domains.map(d => groups.filter(g => g.domain === d).length), 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={domain} className="chart-bar-group">
                        <div className="chart-bar-label">{domain} ({count})</div>
                        <div className="chart-bar-wrapper">
                          <div className="chart-bar-fill" style={{ width: `${pct}%` }}>
                            {count > 0 && count}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* Quick Group Assign / Manual Register */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ marginBottom: '1rem' }}><UserPlus size={18} /> Add Mentor / Student</h3>
            <form onSubmit={savePerson} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Auth UUID</label>
                <input required placeholder="User UUID" value={person.id} onChange={(e) => setPerson({ ...person, id: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                <input required placeholder="Full Name" value={person.full_name} onChange={(e) => setPerson({ ...person, full_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                <input required type="email" placeholder="Email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</label>
                <select value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value })}>
                  <option value="mentor">Mentor</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Domain / Problem Statement</label>
                <input placeholder="Domain" value={person.domain} onChange={(e) => setPerson({ ...person, domain: e.target.value })} />
              </div>
              {person.role === 'mentor' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mentor Capacity</label>
                  <input type="number" min="1" max="10" value={person.mentor_capacity} onChange={(e) => setPerson({ ...person, mentor_capacity: e.target.value })} />
                </div>
              )}
              {person.role === 'student' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Group ID (optional)</label>
                  <input placeholder="Group ID" value={person.group_id} onChange={(e) => setPerson({ ...person, group_id: e.target.value })} />
                </div>
              )}
              <button className="btn btn-primary" disabled={saving} style={{ height: '40px' }}><Plus size={16} /> Save Member</button>
            </form>
          </div>

          {/* Import Sheets Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3><FileSpreadsheet size={18} /> Import Members via Spreadsheet</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>CSV/Excel columns: <strong>Name</strong> and <strong>Email Address</strong>. Optional: <strong>Domain</strong> and <strong>Group ID</strong>.</p>
              {!parsedPeople ? (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <select style={{ width: 'auto' }} value={importRole} onChange={(e) => setImportRole(e.target.value)}>
                    <option value="mentor">Import as Mentors</option>
                    <option value="student">Import as Students</option>
                  </select>
                  <input ref={peopleInputRef} type="file" accept={fileTypes} onChange={parsePeopleFile} style={{ display: 'none' }} />
                  <button className="btn btn-secondary" onClick={() => peopleInputRef.current?.click()}><Upload size={16} /> Select Spreadsheet</button>
                </div>
              ) : (
                <ImportPreview count={parsedPeople.length} onCancel={() => setParsedPeople(null)} onConfirm={importPeople} saving={saving} />
              )}
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3><FileSpreadsheet size={18} /> Import Teams (Google Form responses)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>Extracts groups and links registered student profiles matching emails.</p>
              {!parsedTeams ? (
                <>
                  <input ref={teamsInputRef} type="file" accept={fileTypes} onChange={parseTeamsFile} style={{ display: 'none' }} />
                  <button className="btn btn-secondary" onClick={() => teamsInputRef.current?.click()}><Upload size={16} /> Select Team Sheet</button>
                </>
              ) : (
                <ImportPreview count={parsedTeams.groups.length} label="groups" onCancel={() => setParsedTeams(null)} onConfirm={importTeams} saving={saving} />
              )}
            </div>
          </div>

          {/* Unassigned Students Alert List */}
          {unassignedStudents.length > 0 && (
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'var(--error)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                <AlertTriangle size={20} /> Unassigned Students ({unassignedStudents.length})
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>These students are not currently assigned to any group.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {unassignedStudents.map(student => (
                  <div key={student.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{student.full_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.email}</div>
                      {student.domain && <div style={{ fontSize: '0.75rem', color: 'var(--ieee-blue)', fontWeight: 600 }}>Interest: {student.domain}</div>}
                    </div>
                    <select 
                      defaultValue=""
                      onChange={(e) => moveStudentGroup(student.id, e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                    >
                      <option value="" disabled>Assign to group...</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.id} ({g.domain})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group and Mentor Assignment Table */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Current Internship Groups ({groups.length})</h3>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
              {groups.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No groups imported yet.</p> : 
                groups.map(group => {
                  const suggestions = getSuggestedMentors(group.domain);
                  return (
                    <div 
                      key={group.id} 
                      style={{ 
                        padding: '1.25rem', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)', 
                        display: 'grid', 
                        gridTemplateColumns: '1.5fr 1.5fr 1.5fr', 
                        gap: '1rem', 
                        alignItems: 'start',
                        borderColor: !group.mentor_id ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)',
                        backgroundColor: !group.mentor_id ? 'var(--error-light)' : 'transparent'
                      }}
                    >
                      {/* Group Basics */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ color: 'var(--ieee-dark-blue)', fontSize: '1.1rem' }}>{group.id}</strong>
                          {!group.mentor_id && <span className="badge badge-error">Needs Mentor</span>}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ieee-blue)' }}>Domain: {group.domain}</span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          <strong>Members ({group.members.length}):</strong>
                          <ul style={{ paddingLeft: '1rem', marginTop: '0.2rem' }}>
                            {group.members.map(m => (
                              <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                {m.full_name}
                                <select 
                                  value={group.id} 
                                  onChange={(e) => moveStudentGroup(m.id, e.target.value)}
                                  style={{ padding: '0.1rem', fontSize: '0.7rem', width: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ieee-purple)', fontWeight: 600 }}
                                >
                                  {groups.map(g => <option key={g.id} value={g.id}>Move to {g.id}</option>)}
                                  <option value="">Remove from group</option>
                                </select>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Mentor Selection */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Mentor</label>
                        <select 
                          value={group.mentor_id || ''} 
                          disabled={saving} 
                          onChange={(e) => assignMentor(group.id, e.target.value)}
                          style={{ marginTop: '0.3rem' }}
                        >
                          <option value="">No mentor assigned</option>
                          {mentors.map((mentor) => {
                            const assignedCount = groups.filter(g => g.mentor_id === mentor.id).length;
                            return (
                              <option key={mentor.id} value={mentor.id}>
                                {mentor.full_name} ({assignedCount}/{mentor.mentor_capacity || 4})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Suggestions list */}
                      {!group.mentor_id ? (
                        <div style={{ background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #fed7d7' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--error)', display: 'block', marginBottom: '0.3rem' }}>Suggested Mentors:</span>
                          {suggestions.slice(0, 3).map(mentor => (
                            <div key={mentor.id} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                              <span>{mentor.full_name} ({mentor.assignedCount}/{mentor.capacity})</span>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}
                                onClick={() => assignMentor(group.id, mentor.id)}
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                          {suggestions.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No matching mentors available</span>}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>Mentor Details:</strong>
                          <div>Specialty: {group.mentor?.domain || 'General'}</div>
                          <div>Email: {group.mentor?.email}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Post announcement form */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Post Notice & Deadlines</h3>
            <form onSubmit={postAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Title</label>
                <input required placeholder="Notice Title (e.g. Mid-Review Deadline)" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Content</label>
                <textarea required placeholder="Instructions, details, or meeting links..." value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Audience</label>
                <select value={announcementForm.audience} onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}>
                  <option value="all">Everyone</option>
                  <option value="student">Students Only</option>
                  <option value="mentor">Mentors Only</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Deadline (optional)</label>
                <input type="datetime-local" value={announcementForm.deadline_at} onChange={(e) => setAnnouncementForm({ ...announcementForm, deadline_at: e.target.value })} />
              </div>
              <button className="btn btn-primary" disabled={saving}><Plus size={16} /> Publish Announcement</button>
            </form>
          </div>

          {/* List existing announcements */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Published Announcements</h3>
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {announcements.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No announcements posted yet.</p> :
                announcements.map(ann => (
                  <article key={ann.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                      <div>
                        <h4 style={{ color: 'var(--ieee-blue)', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {ann.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <span className={`badge ${ann.audience === 'all' ? 'badge-info' : ann.audience === 'student' ? 'badge-success' : 'badge-warning'}`}>
                            {ann.audience}
                          </span>
                          {ann.deadline_at && (
                            <span className="badge badge-error">
                              Due: {new Date(ann.deadline_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--error)' }} onClick={() => deleteAnnouncement(ann.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>{ann.content}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                      Posted: {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </article>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Filters Bar */}
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'white' }}>
              <Search size={18} style={{ color: 'var(--text-secondary)' }} />
              <input 
                placeholder="Search by title, student, or team..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', padding: 0 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes Requested</option>
              </select>
              <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">All Domains</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Reports Grid */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Submitted Progress Reports ({filteredReports.length})</h3>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
              {filteredReports.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No reports match the criteria.</p> :
                filteredReports.map(report => {
                  const isLate = report.due_date && new Date(report.created_at) > new Date(report.due_date);
                  return (
                    <article key={report.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ color: 'var(--ieee-blue)', fontSize: '1.05rem' }}>{report.title}</strong>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                            <span className="badge badge-info">{report.group_id}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              submitted by {report.submitter} on {new Date(report.created_at).toLocaleString()}
                            </span>
                            {isLate && <span className="badge badge-error">Late Submission</span>}
                            <span className="badge badge-info">v{report.version}</span>
                          </div>
                        </div>
                        <span className={`badge ${report.status === 'approved' ? 'badge-success' : report.status === 'changes_requested' ? 'badge-error' : report.status === 'in_review' ? 'badge-warning' : 'badge-info'}`}>
                          {(report.status || 'submitted').replace('_', ' ')}
                        </span>
                      </div>
                      
                      {report.content && (
                        <p style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                          {report.content}
                        </p>
                      )}

                      {report.feedback && (
                        <p style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--info-light)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--ieee-dark-blue)' }}>
                          <strong>Reviewer feedback ({report.reviewer || 'Mentor'}):</strong> {report.feedback}
                        </p>
                      )}
                    </article>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Issue Certificate Form */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Mark Completion & Issue Certificate</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Only students who have completed all requirements should be issued certificates.</p>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {students.filter(s => s.group_id).map(student => {
                const cert = certificates.find(c => c.student_id === student.id);
                const isApprovedByAdmin = cert && cert.admin_approved;
                const isApprovedByMentor = cert && cert.mentor_approved;
                return (
                  <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{student.full_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Group: {student.group_id}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isApprovedByAdmin ? (
                        <>
                          <span className="badge badge-success">Admin Approved</span>
                          {isApprovedByMentor ? (
                            <span className="badge badge-success" style={{ background: 'var(--success)', color: 'white' }}>Mentor Approved</span>
                          ) : (
                            <span className="badge badge-warning">Awaiting Mentor</span>
                          )}
                        </>
                      ) : (
                        <button 
                          className="btn btn-secondary" 
                          disabled={saving} 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                          onClick={() => markInternshipCompleted(student.id, student.group_id)}
                        >
                          Approve Internship
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {students.filter(s => s.group_id).length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No registered students with active groups found.</p>
              )}
            </div>
          </div>

          {/* Issued Certificates Overview */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Issued Certificates ({certificates.filter(c => c.admin_approved && c.mentor_approved).length})</h3>
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {certificates.filter(c => c.admin_approved && c.mentor_approved).length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No certificates issued yet.</p> :
                certificates.filter(c => c.admin_approved && c.mentor_approved).map(cert => {
                  const student = students.find(s => s.id === cert.student_id);
                  return (
                    <div key={cert.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem' }}>{student?.full_name || 'Student'}</strong>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Code: {cert.certificate_code}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Issued: {new Date(cert.issued_at).toLocaleDateString()}</div>
                      </div>
                      <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handlePrintCertificate(cert)}>
                        Print / Download
                      </button>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {/* Certificate Printing Layout Overlay */}
      {certToPrint && (
        <div className="certificate-preview-overlay no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="certificate-sheet">
            <div>
              <h1 style={{ fontSize: '2.2rem', color: 'var(--ieee-blue)', letterSpacing: '2px' }}>IEEE EMBS</h1>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--ieee-purple)', letterSpacing: '3px', marginTop: '0.2rem' }}>PUNE CHAPTER</h4>
            </div>

            <div style={{ margin: '1rem 0' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-secondary)' }}>Certificate of Completion</h2>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>This is proudly presented to</p>
              <h1 style={{ fontSize: '2rem', textDecoration: 'underline', color: 'var(--ieee-dark-blue)' }}>{certToPrint.name}</h1>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>for successfully completing their engineering internship in the domain of</p>
              <strong style={{ fontSize: '1.2rem', color: 'var(--ieee-purple)' }}>{certToPrint.domain}</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>conducted by IEEE Engineering in Medicine and Biology Society (EMBS) Pune Chapter.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2rem', alignItems: 'flex-end' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ width: '120px', borderBottom: '1px solid var(--text-secondary)', marginBottom: '0.3rem' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Program Coordinator</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>IEEE EMBS Pune Chapter</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <div>Date Issued: {certToPrint.date}</div>
                <div style={{ fontWeight: 600 }}>Verification Code: {certToPrint.code}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ width: '120px', borderBottom: '1px solid var(--text-secondary)', marginBottom: '0.3rem' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Chapter Chair</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>IEEE EMBS Pune Chapter</span>
              </div>
            </div>
            
            <div className="certificate-seal">
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '4px double var(--ieee-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ieee-purple)', fontWeight: 'bold', fontSize: '0.65rem' }}>
                SEAL
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setCertToPrint(null)}>Close Preview</button>
        </div>
      )}
    </div>
  );
}



function ImportPreview({ count, label = 'profiles', onCancel, onConfirm, saving }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
      <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>{count} {label} parsed successfully.</span>
      <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }} disabled={saving} onClick={onConfirm}>
        {saving ? 'Importing…' : 'Confirm Import'}
      </button>
    </div>
  );
}