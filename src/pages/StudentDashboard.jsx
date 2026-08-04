import { useEffect, useRef, useState } from 'react';
import { 
  Users, MessageSquare, FileUp, BookOpen, Bell, Award, 
  UserCheck, Save, RefreshCw, Calendar, Phone, MapPin, Tag, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const card = { padding: '1.5rem', borderRadius: 'var(--radius-lg)' };
const muted = { color: 'var(--text-secondary)', fontSize: '0.875rem' };

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('progress');
  const [group, setGroup] = useState(null);
  const [reports, setReports] = useState([]);
  const [links, setLinks] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [queries, setQueries] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [showCert, setShowCert] = useState(false);
  const [templates, setTemplates] = useState([]);

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
  
  // Submit Form States
  const [queryInput, setQueryInput] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportContent, setReportContent] = useState('');
  const [reportFile, setReportFile] = useState(null);
  
  // Resubmission Form States
  const [resubmitReportId, setResubmitReportId] = useState(null);
  const [resubmitContent, setResubmitContent] = useState('');
  const [resubmitFile, setResubmitFile] = useState(null);

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    phone: '',
    organisation: '',
    bio: '',
    interests: '',
    avatar_url: ''
  });

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  
  const fileRef = useRef(null);
  const resubmitFileRef = useRef(null);

  const tell = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 6000);
  };

  const load = async () => {
    if (!profile?.group_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [
        { data: groupData, error: groupError },
        { data: reportData, error: reportError },
        { data: annData, error: annError },
        { data: meetingData, error: meetingError },
        { data: queryData, error: queryError },
        { data: milestoneData, error: milestoneError },
        { data: certData, error: certError }
      ] = await Promise.all([
        supabase.from('groups').select('*, mentor:profiles!groups_mentor_id_fkey(*)').eq('id', profile.group_id).single(),
        supabase.from('reports').select('*').eq('group_id', profile.group_id).order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('meetings').select('*').eq('group_id', profile.group_id).order('held_at', { ascending: false }),
        supabase.from('queries').select('*').eq('group_id', profile.group_id).order('created_at', { ascending: false }),
        supabase.from('milestones').select('*').eq('group_id', profile.group_id).order('due_date', { ascending: true }),
        supabase.from('certificates').select('*').eq('student_id', profile.id).maybeSingle()
      ]);

      if (groupError) throw groupError;
      if (reportError) throw reportError;
      if (annError) throw annError;
      if (meetingError) throw meetingError;
      if (queryError) throw queryError;
      if (milestoneError) throw milestoneError;
      if (certError) throw certError;

      setGroup(groupData);
      setReports(reportData || []);
      setAnnouncements(annData.filter(a => a.audience === 'all' || a.audience === 'student'));
      setMeetings(meetingData || []);
      setQueries(queryData || []);
      setMilestones(milestoneData || []);
      setCertificate(certData);

      // Load signed URLs for reports attachments
      const signed = await Promise.all(
        (reportData || []).filter((report) => report.file_url).map(async (report) => {
          const { data } = await supabase.storage.from('reports').createSignedUrl(report.file_url, 3600);
          return [report.id, data?.signedUrl];
        })
      );
      setLinks(Object.fromEntries(signed.filter(([, url]) => url)));

    } catch (error) {
      tell(`Could not load dashboard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.group_id, profile?.id]);

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

  const submitMilestoneWork = async (milestoneId) => {
    if (!window.confirm('Submit this milestone for mentor review?')) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('milestones')
        .update({ 
          status: 'submitted',
          updated_by: profile.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', milestoneId);
      if (error) throw error;

      // Notify mentor
      if (group?.mentor_id) {
        const mTitle = milestones.find(m => m.id === milestoneId)?.title || 'Milestone';
        await supabase.from('notifications').insert({
          user_id: group.mentor_id,
          title: 'Milestone Submitted',
          content: `${profile.full_name} submitted work for milestone: "${mTitle}"`,
          link: '/mentor'
        });
      }

      await load();
      tell('Milestone submitted for mentor review.');
    } catch (err) {
      tell(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitQuery = async () => {
    if (!queryInput.trim() || !profile?.group_id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('queries').insert({
        group_id: profile.group_id,
        asked_by: profile.id,
        question: queryInput.trim()
      });
      if (error) throw error;
      
      // Notify mentor if assigned
      if (group?.mentor_id) {
        await supabase.from('notifications').insert({
          user_id: group.mentor_id,
          title: 'New Student Query',
          content: `${profile.full_name} from group ${profile.group_id} has asked a question.`,
          link: '/mentor'
        });
      }

      setQueryInput('');
      await load();
      tell('Query submitted to your mentor.');
    } catch (error) {
      tell(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!reportTitle.trim() || !profile?.group_id) return;
    setBusy(true);
    try {
      let filePath = null;
      if (reportFile) {
        const safeName = reportFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        filePath = `${profile.id}/${profile.group_id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('reports').upload(filePath, reportFile);
        if (error) throw error;
      }

      // Check if there is an active report deadline from announcements
      const reportDeadline = announcements.find(a => normalise(a.title).includes('report') && a.deadline_at)?.deadline_at;

      const { error } = await supabase.from('reports').insert({
        group_id: profile.group_id,
        submitted_by: profile.id,
        title: reportTitle.trim(),
        content: reportContent.trim() || null,
        file_url: filePath,
        status: 'submitted',
        due_date: reportDeadline || null,
        version: 1
      });
      if (error) throw error;

      // Notify mentor
      if (group?.mentor_id) {
        await supabase.from('notifications').insert({
          user_id: group.mentor_id,
          title: 'Report Submitted',
          content: `${profile.full_name} submitted report: "${reportTitle}"`,
          link: '/mentor'
        });
      }

      setReportTitle('');
      setReportContent('');
      setReportFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
      tell('Report submitted successfully.');
    } catch (error) {
      tell(`Report could not be submitted: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submitResubmission = async (e) => {
    e.preventDefault();
    const prevReport = reports.find(r => r.id === resubmitReportId);
    if (!prevReport || !profile?.group_id) return;
    setBusy(true);

    try {
      let filePath = prevReport.file_url;
      if (resubmitFile) {
        const safeName = resubmitFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        filePath = `${profile.id}/${profile.group_id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from('reports').upload(filePath, resubmitFile);
        if (error) throw error;
      }

      const { error } = await supabase.from('reports').insert({
        group_id: profile.group_id,
        submitted_by: profile.id,
        title: `Resubmission: ${prevReport.title.replace('Resubmission: ', '')}`,
        content: resubmitContent.trim() || null,
        file_url: filePath,
        status: 'submitted',
        due_date: prevReport.due_date,
        version: (prevReport.version || 1) + 1
      });
      if (error) throw error;

      // Notify mentor
      if (group?.mentor_id) {
        await supabase.from('notifications').insert({
          user_id: group.mentor_id,
          title: 'Report Resubmission',
          content: `${profile.full_name} resubmitted: "${prevReport.title}" (v${(prevReport.version || 1) + 1})`,
          link: '/mentor'
        });
      }

      setResubmitReportId(null);
      setResubmitContent('');
      setResubmitFile(null);
      await load();
      tell('Resubmission posted successfully.');
    } catch (error) {
      tell(`Resubmission failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
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
      
      // Update locally
      await load();
      tell('Profile updated successfully.');
    } catch (err) {
      tell(`Failed to save profile: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const normalise = (value) => String(value || '').trim().toLowerCase();

  const getProgressPercentage = () => {
    if (!milestones.length) return 0;
    const completed = milestones.filter(m => m.status === 'approved').length;
    return Math.round((completed / milestones.length) * 100);
  };


  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading student dashboard…</div>;

  return (
    <div style={{ padding: '2rem 0' }} className="animate-fade-in">
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', margin: 0 }}>Internship Space</h2>
          <p style={muted}>Welcome back, {profile?.full_name} · Student Portal</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'progress' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('progress')}><Users size={16} /> Team & Milestones</button>
          <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('reports')}><FileUp size={16} /> Reports</button>
          <button className={`btn ${activeTab === 'meetings' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('meetings')}><BookOpen size={16} /> Meeting Logs</button>
          <button className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('announcements')}><Bell size={16} /> Notices</button>
          <button className={`btn ${activeTab === 'queries' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('queries')}><MessageSquare size={16} /> Helpdesk</button>
          <button className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('profile')}><UserCheck size={16} /> My Account</button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', color: 'var(--ieee-blue)', border: '1px solid rgba(0, 98, 155, 0.2)' }}>
          {notice}
        </div>
      )}

      {/* Main Tab Interfaces */}

      {activeTab === 'progress' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start', flexWrap: 'wrap' }}>
          {/* Team and Mentor details */}
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="glass" style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={20} /> My Internship Group</h3>
              {profile.group_id ? (
                <div style={{ marginTop: '1rem' }}>
                  <strong style={{ fontSize: '1.5rem', color: 'var(--ieee-dark-blue)' }}>{profile.group_id}</strong>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ieee-blue)', fontWeight: 600, marginTop: '0.2rem' }}>
                    Domain Focus: {group?.domain}
                  </div>
                </div>
              ) : (
                <p style={{ ...muted, marginTop: '1rem' }}>You are not assigned to a group yet. Please contact the administrator.</p>
              )}
            </div>

            {group?.mentor && (
              <div className="glass" style={card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><UserCheck size={20} /> Group Mentor</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  {group.mentor.avatar_url ? (
                    <img src={group.mentor.avatar_url} alt={group.mentor.full_name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--ieee-light-blue)', color: 'var(--ieee-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {group.mentor.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 style={{ margin: 0 }}>{group.mentor.full_name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>IEEE EMBS Project Guide</span>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  {group.mentor.email && <div><strong>Email:</strong> {group.mentor.email}</div>}
                  {group.mentor.phone && <div><strong>Phone:</strong> {group.mentor.phone}</div>}
                  {group.mentor.organisation && <div><strong>Organisation:</strong> {group.mentor.organisation}</div>}
                  {group.mentor.interests && <div><strong>Interests:</strong> {group.mentor.interests}</div>}
                  {group.mentor.bio && <div style={{ fontStyle: 'italic', marginTop: '0.5rem', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>"{group.mentor.bio}"</div>}
                </div>
              </div>
            )}

            {/* Completion Certificate Area (2-Stage Approval Check) */}
            {certificate && certificate.admin_approved && certificate.mentor_approved && (
              <div className="glass" style={{ ...card, background: 'linear-gradient(to right bottom, #fff, #f0fdf4)', borderColor: 'var(--success)' }}>
                <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={20} /> Internship Completed!</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Congratulations! Your certificate of internship completion has been issued by IEEE EMBS.</p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>Code: <strong>{certificate.certificate_code}</strong></div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: 'var(--success)' }} onClick={() => setShowCert(true)}>
                  View & Print Certificate
                </button>
              </div>
            )}

            {certificate && certificate.admin_approved && !certificate.mentor_approved && (
              <div className="glass" style={{ ...card, background: 'linear-gradient(to right bottom, #fff, #fffbeb)', borderColor: 'var(--warning)' }}>
                <h3 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={20} /> Awaiting Mentor Signature</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Your internship completion was approved by the Coordinator. Awaiting mentor approval and signature to issue your certificate.</p>
              </div>
            )}

            {/* Onboarding Checklist */}
            <div className="glass" style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><CheckCircle2 size={20} style={{ color: 'var(--ieee-blue)' }} /> Onboarding Checklist</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Steps to complete at the start of your internship:</p>
              <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={!!profile.phone} readOnly style={{ cursor: 'not-allowed' }} />
                  <span style={{ textDecoration: profile.phone ? 'line-through' : 'none', color: profile.phone ? 'var(--text-secondary)' : 'inherit' }}>Update contact phone number</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={!!profile.group_id} readOnly style={{ cursor: 'not-allowed' }} />
                  <span style={{ textDecoration: profile.group_id ? 'line-through' : 'none', color: profile.group_id ? 'var(--text-secondary)' : 'inherit' }}>Get assigned to project team</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={milestones.length > 0} readOnly style={{ cursor: 'not-allowed' }} />
                  <span style={{ textDecoration: milestones.length > 0 ? 'line-through' : 'none', color: milestones.length > 0 ? 'var(--text-secondary)' : 'inherit' }}>Roadmap milestones initialized</span>
                </label>
              </div>
            </div>

            {/* Starter Kit Guidelines */}
            <div className="glass" style={card}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}><FileUp size={20} style={{ color: 'var(--ieee-purple)' }} /> Starter Kit & Formats</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Download template guidelines and formats uploaded by the Coordinator:</p>
              <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.85rem' }}>
                {templates.length === 0 ? (
                  <div style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    No formats uploaded yet.
                  </div>
                ) : (
                  templates.map(t => (
                    <a 
                      key={t.id}
                      href={t.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', color: 'var(--ieee-blue)', textDecoration: 'none', fontWeight: 600, padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', transition: 'all var(--transition-fast)' }}
                      className="glass-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t.type === 'report' ? <FileUp size={16} style={{ color: 'var(--info)' }} /> : t.type === 'presentation' ? <BookOpen size={16} style={{ color: 'var(--success)' }} /> : <Award size={16} style={{ color: 'var(--warning)' }} />}
                        <span>{t.name}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        {t.type === 'report' ? 'DOC' : t.type === 'presentation' ? 'PPT' : 'CERT'}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Milestone timeline progress */}
          <div className="glass" style={card}>
            <h3>Milestone Tracking Roadmap</h3>
            <p style={muted}>Track completion of your internship phases.</p>
            
            {/* Percentage progress bar */}
            {milestones.length > 0 && (
              <div style={{ margin: '1.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  <span>Overall Program Completion</span>
                  <span>{getProgressPercentage()}% Completed</span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar-fill" style={{ width: `${getProgressPercentage()}%` }}></div>
                </div>
              </div>
            )}

            {/* Stepper Node List */}
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
              {milestones.map((m, idx) => (
                <div key={m.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--bg-primary)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: m.status === 'approved' ? 'var(--success)' : m.status === 'submitted' ? 'var(--info)' : m.status === 'in_progress' ? 'var(--warning)' : '#e2e8f0',
                      color: m.status === 'approved' || m.status === 'submitted' ? 'white' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.75rem'
                    }}>
                      {idx + 1}
                    </div>
                    {idx < milestones.length - 1 && <div style={{ width: '2px', flex: 1, background: '#cbd5e1', margin: '0.2rem 0' }}></div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{m.title}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge ${m.status === 'approved' ? 'badge-success' : m.status === 'submitted' ? 'badge-info' : m.status === 'in_progress' ? 'badge-warning' : 'badge-error'}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                        {(m.status === 'not_started' || m.status === 'in_progress') && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => submitMilestoneWork(m.id)}
                            disabled={busy}
                          >
                            Submit Work
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{m.description}</p>
                  </div>
                </div>
              ))}
              {milestones.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No milestones have been initialized for your team yet by your mentor.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start', flexWrap: 'wrap' }}>
          
          {/* Submit report form */}
          <div className="glass" style={card}>
            <h3>Submit Progress Report</h3>
            <p style={muted}>Submit report and file updates to your mentor.</p>
            <form onSubmit={submitReport} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Report Title</label>
                <input required placeholder="E.g., Weekly Report 3, Design Proposal" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} disabled={!profile.group_id} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Summary / Content</label>
                <textarea placeholder="Briefly describe your progress, updates, links, or issues..." value={reportContent} onChange={(e) => setReportContent(e.target.value)} disabled={!profile.group_id} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Upload File (PDF/Docs/ZIP)</label>
                <input ref={fileRef} type="file" onChange={(e) => setReportFile(e.target.files?.[0] || null)} disabled={!profile.group_id} />
              </div>
              <button className="btn btn-primary" disabled={busy || !profile.group_id}>
                {busy ? 'Uploading...' : 'Submit Report'}
              </button>
            </form>
          </div>

          {/* List report history and resubmissions */}
          <div className="glass" style={card}>
            <h3>Report Submission History</h3>
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              {reports.length === 0 ? <p style={muted}>No reports submitted yet.</p> :
                reports.map((report) => {
                  const isLate = report.due_date && new Date(report.created_at) > new Date(report.due_date);
                  return (
                    <article key={report.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: 'var(--ieee-dark-blue)' }}>{report.title}</strong>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            <span>Submitted: {new Date(report.created_at).toLocaleDateString()}</span>
                            <span>· Version {report.version}</span>
                            {isLate && <span className="badge badge-error">Late Submission</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className={`badge ${report.status === 'approved' ? 'badge-success' : report.status === 'changes_requested' ? 'badge-error' : report.status === 'in_review' ? 'badge-warning' : 'badge-info'}`}>
                            {report.status.replace('_', ' ')}
                          </span>
                          {report.status === 'changes_requested' && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                              onClick={() => {
                                setResubmitReportId(report.id);
                                setResubmitContent(`Resubmission for: ${report.title}`);
                              }}
                            >
                              <RefreshCw size={12} /> Resubmit
                            </button>
                          )}
                        </div>
                      </div>

                      {report.content && (
                        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{report.content}</p>
                      )}

                      {links[report.id] && (
                        <a href={links[report.id]} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', color: 'var(--ieee-blue)', fontWeight: 600 }}>
                          Open Attachment
                        </a>
                      )}

                      {report.feedback && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--info-light)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--ieee-dark-blue)', whiteSpace: 'pre-line' }}>
                          <strong>Mentor Feedback:</strong>
                          <div>{report.feedback}</div>
                        </div>
                      )}
                    </article>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {/* Resubmission Modal Box Overlay */}
      {resubmitReportId && (
        <div className="certificate-preview-overlay">
          <div className="glass" style={{ ...card, maxWidth: '500px', width: '100%', background: 'white' }}>
            <h3>Post Report Resubmission</h3>
            <p style={muted}>Respond to requested changes and upload updated code/reports.</p>
            <form onSubmit={submitResubmission} style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Resubmission Notes</label>
                <textarea required placeholder="Describe updates, fixes, and response to feedback..." value={resubmitContent} onChange={(e) => setResubmitContent(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>New Attachment File (optional)</label>
                <input ref={resubmitFileRef} type="file" onChange={(e) => setResubmitFile(e.target.files?.[0] || null)} />
              </div>
              <div style={{ display: 'flex', justify: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setResubmitReportId(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>Submit Updated Version</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="glass animate-fade-in" style={card}>
          <h3><BookOpen size={20} /> Mentor Meeting History</h3>
          <p style={muted}>Check history of logged discussions, review logs, and assigned actions.</p>
          
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {meetings.length === 0 ? <p style={muted}>No meetings have been logged for your team yet.</p> :
              meetings.map(meeting => (
                <article key={meeting.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={18} style={{ color: 'var(--ieee-blue)' }} />
                      <strong style={{ fontSize: '1rem' }}>Mentoring Session</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(meeting.held_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, margin: '0.2rem 0 0.5rem' }}>
                    Attendees present: {meeting.attendance || 'None'}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}><strong>Notes:</strong> {meeting.notes}</p>
                  {meeting.meeting_link && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#0f9d58', border: 'none', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 600 }}>
                        Join Google Meet Room
                      </a>
                    </div>
                  )}
                  {meeting.next_actions && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                      <strong>Action Items:</strong> {meeting.next_actions}
                    </div>
                  )}
                </article>
              ))
            }
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="glass animate-fade-in" style={card}>
          <h3><Bell size={20} /> Notices & Deadlines</h3>
          <p style={muted}>Official announcements and report submission deadlines from coordinators.</p>
          
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {announcements.length === 0 ? <p style={muted}>No announcements active.</p> :
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

      {activeTab === 'queries' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start', flexWrap: 'wrap' }}>
          {/* Ask Query Box */}
          <div className="glass" style={card}>
            <h3>Ask Mentor Query</h3>
            <p style={muted}>Post a help request to your group mentor.</p>
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
              <textarea placeholder="Ask your question here..." value={queryInput} onChange={(e) => setQueryInput(e.target.value)} disabled={!group?.mentor_id} />
              <button className="btn btn-primary" disabled={busy || !group?.mentor_id || !queryInput.trim()} onClick={submitQuery}>
                Submit Question
              </button>
              {!group?.mentor_id && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Cannot submit queries: No mentor has been assigned yet.</span>
              )}
            </div>
          </div>

          {/* Query History list */}
          <div className="glass" style={card}>
            <h3>Q&A History</h3>
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              {queries.length === 0 ? <p style={muted}>No questions submitted yet.</p> :
                queries.map(q => (
                  <div key={q.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span>Question</span>
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{q.question}</strong>
                    {q.answer ? (
                      <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        <strong>Reply from Mentor:</strong>
                        <div>{q.answer}</div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.2rem' }}>
                          Answered on {new Date(q.answered_at).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="badge badge-warning" style={{ marginTop: '0.5rem', display: 'inline-block' }}>Awaiting reply</span>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="glass animate-fade-in" style={{ ...card, maxWidth: '600px', margin: '0 auto' }}>
          <h3>Update Profile Settings</h3>
          <p style={muted}>Manage phone, university/company, and areas of interest details.</p>
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>University / Organisation</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <MapPin size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
                <input placeholder="Enter your university or company" value={profileForm.organisation} onChange={(e) => setProfileForm({ ...profileForm, organisation: e.target.value })} style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Areas of Interest</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                <Tag size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-secondary)' }} />
                <input placeholder="E.g., IoT, Bioinformatics, Medical Signal Processing" value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })} style={{ paddingLeft: '2.5rem' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Biography</label>
              <textarea placeholder="Tell us about yourself..." value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Profile Picture Image URL</label>
              <input placeholder="https://example.com/profile.jpg" value={profileForm.avatar_url} onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })} />
            </div>

            <button className="btn btn-primary" disabled={busy}><Save size={16} /> Save Changes</button>
          </form>
        </div>
      )}

      {/* Certificate Printing Layout Overlay */}
      {certificate && showCert && (
        <div className="certificate-preview-overlay">
          <div className="certificate-sheet">
            <div>
              <h1 style={{ fontSize: '2.2rem', color: 'var(--ieee-blue)', letterSpacing: '2px' }}>IEEE EMBS</h1>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--ieee-purple)', letterSpacing: '3px', marginTop: '0.2rem' }}>PUNE CHAPTER</h4>
            </div>

            <div style={{ margin: '1rem 0' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-secondary)' }}>Certificate of Completion</h2>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>This is proudly presented to</p>
              <h1 style={{ fontSize: '2rem', textDecoration: 'underline', color: 'var(--ieee-dark-blue)' }}>{profile.full_name}</h1>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>for successfully completing their engineering internship in the domain of</p>
              <strong style={{ fontSize: '1.2rem', color: 'var(--ieee-purple)' }}>{group?.domain || 'General Domain'}</strong>
              <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>conducted by IEEE Engineering in Medicine and Biology Society (EMBS) Pune Chapter.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2rem', alignItems: 'flex-end' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ width: '120px', borderBottom: '1px solid var(--text-secondary)', marginBottom: '0.3rem' }}></div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Program Coordinator</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>IEEE EMBS Pune Chapter</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <div>Date Issued: {new Date(certificate.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div style={{ fontWeight: 600 }}>Verification Code: {certificate.certificate_code}</div>
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
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }} className="no-print">
            <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => window.print()}>Print / Download PDF</button>
            <button className="btn btn-outline" onClick={() => setShowCert(false)}>Close Preview</button>
          </div>
        </div>
      )}
    </div>
  );
}