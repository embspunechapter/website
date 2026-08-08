import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowRight, Activity, Award, BookOpen, Users, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Landing() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    activeGroups: '10+',
    domains: 'Bioinformatics, AI/ML, IoT'
  });

  // Registration Form States
  const [isIndividual, setIsIndividual] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [college, setCollege] = useState('');
  const [leader, setLeader] = useState({ full_name: '', email: '', gender: 'male', is_ieee_member: false });
  const [memberCount, setMemberCount] = useState(1);
  const [members, setMembers] = useState([{ id: 1, full_name: '', email: '', gender: 'male' }]);
  const [regLoading, setRegLoading] = useState(false);
  const [regNotice, setRegNotice] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: groupData, error } = await supabase
          .from('groups')
          .select('domain');
        
        if (!error && groupData) {
          const groupCount = groupData.length;
          const uniqueDomains = Array.from(
            new Set(
              groupData
                .map(g => g.domain?.trim())
                .filter(Boolean)
            )
          );
          
          setStats({
            activeGroups: groupCount > 0 ? `${groupCount}` : '0',
            domains: uniqueDomains.length > 0 ? uniqueDomains.slice(0, 4).join(', ') : 'Biomedical Eng.'
          });
        }
      } catch (err) {
        console.error('Error fetching landing stats:', err);
      }
    };

    fetchStats();
  }, []);

  const handleMemberCountChange = (count) => {
    setMemberCount(count);
    const newMembers = [...members];
    if (count > newMembers.length) {
      for (let i = newMembers.length; i < count; i++) {
        newMembers.push({ id: i + 1, full_name: '', email: '', gender: 'male' });
      }
    } else {
      newMembers.length = count;
    }
    setMembers(newMembers);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegNotice({ text: '', type: '' });

    if (!college.trim()) {
      setRegNotice({ text: 'College name is required.', type: 'error' });
      return;
    }
    if (!leader.full_name.trim() || !leader.email.trim()) {
      setRegNotice({ text: 'Leader name and email are required.', type: 'error' });
      return;
    }
    const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email.trim());
    if (!isValidEmail(leader.email)) {
      setRegNotice({ text: 'Enter a valid email address for the leader.', type: 'error' });
      return;
    }

    if (!isIndividual) {
      if (!teamName.trim()) {
        setRegNotice({ text: 'Team name is required for team registration.', type: 'error' });
        return;
      }

      // Check duplicate names and emails in form
      const names = [leader.full_name.trim().toLowerCase()];
      const emails = [leader.email.trim().toLowerCase()];
      let hasDuplicate = false;

      for (let m of members) {
        if (!m.full_name.trim() || !m.email.trim()) {
          setRegNotice({ text: 'Please fill in all member details or reduce member count.', type: 'error' });
          return;
        }
        if (!isValidEmail(m.email)) {
          setRegNotice({ text: `Enter a valid email address for ${m.full_name || 'each team member'}.`, type: 'error' });
          return;
        }
        const mName = m.full_name.trim().toLowerCase();
        const mEmail = m.email.trim().toLowerCase();
        if (names.includes(mName) || emails.includes(mEmail)) {
          hasDuplicate = true;
        }
        names.push(mName);
        emails.push(mEmail);
      }

      if (hasDuplicate) {
        setRegNotice({ text: 'Duplicate names or emails are not allowed in the team. Please verify details.', type: 'error' });
        return;
      }

      // Verify female member rule
      const hasFemale = leader.gender === 'female' || members.some(m => m.gender === 'female');
      if (!hasFemale) {
        setRegNotice({ text: 'At least one team member must be female to register as a team.', type: 'error' });
        return;
      }
    }

    setRegLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-team', {
        body: {
          isIndividual,
          teamName: isIndividual ? null : teamName,
          college,
          leader,
          members: isIndividual ? [] : members
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRegNotice({
        text: isIndividual 
          ? 'Registration successful! Your individual account has been provisioned. Log in using your email and password "student123".'
          : `Team "${teamName}" registered successfully! Accounts for all ${members.length + 1} members have been created. Log in using email and password "student123".`,
        type: 'success'
      });

      // Reset Form
      setTeamName('');
      setCollege('');
      setLeader({ full_name: '', email: '', gender: 'male', is_ieee_member: false });
      setMemberCount(1);
      setMembers([{ id: 1, full_name: '', email: '', gender: 'male' }]);

    } catch (err) {
      console.error(err);
      setRegNotice({ text: err.message || 'Registration failed.', type: 'error' });
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 0 4rem' }}>
      
      {/* Hero Section */}
      <section style={{
        textAlign: 'center',
        padding: '4rem 1.5rem',
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(255, 255, 255, 0.4)',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(10px)',
        marginBottom: '4rem',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--ieee-light-blue)',
          color: 'var(--ieee-blue)',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: '1.5rem',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          <Activity size={14} className="animate-pulse-soft" /> IEEE EMBS Pune Chapter
        </div>
        
        <h1 style={{
          fontFamily: 'Outfit',
          fontSize: '3.25rem',
          color: 'var(--ieee-dark-blue)',
          lineHeight: 1.15,
          fontWeight: 800,
          maxWidth: '850px',
          margin: '0 auto 1.25rem',
          letterSpacing: '-0.5px'
        }}>
          Biomedical Engineering <span style={{ background: 'var(--ieee-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Internship Portal</span>
        </h1>
        
        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '650px',
          margin: '0 auto 2.5rem'
        }}>
          A role-based research roadmap and progress-tracking workspace connecting students, mentors, and program coordinators.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user && profile ? (
            <Link to={`/${profile.role}`} className="btn btn-primary" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              padding: '0.8rem 1.75rem',
              fontSize: '0.95rem'
            }}>
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              padding: '0.8rem 1.75rem',
              fontSize: '0.95rem'
            }}>
              Access Portal <ArrowRight size={16} />
            </Link>
          )}
          
          <a href="#register" className="btn btn-outline" style={{
            textDecoration: 'none',
            padding: '0.8rem 1.75rem',
            fontSize: '0.95rem'
          }}>
            Register Now
          </a>
        </div>
      </section>

      {/* Program Core Features */}
      <section id="about" style={{ marginBottom: '4rem' }}>
        <h2 style={{
          fontFamily: 'Outfit',
          fontSize: '2rem',
          color: 'var(--ieee-dark-blue)',
          textAlign: 'center',
          marginBottom: '2.5rem'
        }}>
          Portal Workspace Telemetry
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          <FeatureCard 
            icon={<BookOpen size={24} style={{ color: 'var(--ieee-blue)' }} />}
            title="Roadmap Milestones"
            description="Track assigned projects via progressive step milestones. Log meeting attendance, action items, and goals directly."
          />
          <FeatureCard 
            icon={<Activity size={24} style={{ color: 'var(--ieee-purple)' }} />}
            title="Reports & Evaluation"
            description="Allows Group Leads to submit documents. Multi-stage vetting verifies submissions with mentors before administrative signoff."
          />
          <FeatureCard 
            icon={<Award size={24} style={{ color: 'var(--success)' }} />}
            title="Dynamic Certification"
            description="Generate customized certificates of completion and appreciation with automated layout overrides and verification codes."
          />
        </div>
      </section>

      {/* Team / Individual Registration Section */}
      <section id="register" style={{
        marginBottom: '4rem',
        borderRadius: 'var(--radius-xl)',
        background: 'rgba(255, 255, 255, 0.55)',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(12px)',
        padding: '2.5rem 2rem',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.03)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', color: 'var(--ieee-dark-blue)', marginBottom: '0.5rem' }}>
            Internship Program Registration
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Register your team or apply individually to join the IEEE EMBS internship program.
          </p>
        </div>

        {regNotice.text && (
          <div className={`notice ${regNotice.type === 'success' ? 'notice-success' : 'notice-error'}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem'
          }}>
            {regNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{regNotice.text}</span>
          </div>
        )}

        <form noValidate onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Registration Type & Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Participation Mode
              </label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="radio" 
                    checked={!isIndividual} 
                    onChange={() => setIsIndividual(false)} 
                    style={{ accentColor: 'var(--ieee-blue)' }}
                  />
                  Team Registration
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="radio" 
                    checked={isIndividual} 
                    onChange={() => setIsIndividual(true)} 
                    style={{ accentColor: 'var(--ieee-blue)' }}
                  />
                  Individual Participation
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                College Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. Pune Institute of Computer Technology" 
                value={college} 
                onChange={(e) => setCollege(e.target.value)} 
                required
                style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
              />
            </div>

            {!isIndividual && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Team Name (Must be unique)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Bio-Innovators" 
                  value={teamName} 
                  onChange={(e) => setTeamName(e.target.value)} 
                  required={!isIndividual}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
                />
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

          {/* Leader Details */}
          <div>
            <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', color: 'var(--ieee-dark-blue)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} /> {isIndividual ? 'Applicant Details' : 'Team Leader (Contact Person)'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Full Name</label>
                <input 
                  type="text" 
                  placeholder="Leader name" 
                  value={leader.full_name} 
                  onChange={(e) => setLeader({...leader, full_name: e.target.value})} 
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Email Address</label>
                <input 
                  type="email" 
                  placeholder="leader@example.com" 
                  value={leader.email} 
                  onChange={(e) => setLeader({...leader, email: e.target.value})} 
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Gender</label>
                <select 
                  value={leader.gender} 
                  onChange={(e) => setLeader({...leader, gender: e.target.value})} 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: '#fff' }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={leader.is_ieee_member} 
                    onChange={(e) => setLeader({...leader, is_ieee_member: e.target.checked})} 
                    style={{ accentColor: 'var(--ieee-blue)' }}
                  />
                  IEEE Member
                </label>
              </div>
            </div>
          </div>

          {/* Members Details (only for Team Registration) */}
          {!isIndividual && (
            <div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', color: 'var(--ieee-dark-blue)', margin: 0 }}>
                  Team Members
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Number of members (excluding leader):</span>
                  <select 
                    value={memberCount} 
                    onChange={(e) => handleMemberCountChange(parseInt(e.target.value))} 
                    style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value={1}>1 Member</option>
                    <option value={2}>2 Members</option>
                    <option value={3}>3 Members</option>
                    <option value={4}>4 Members</option>
                    <option value={5}>5 Members</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {members.map((member, index) => (
                  <div key={member.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Member {index + 1} Name
                      </label>
                      <input 
                        type="text" 
                        placeholder="Name" 
                        value={member.full_name} 
                        onChange={(e) => {
                          const updated = [...members];
                          updated[index].full_name = e.target.value;
                          setMembers(updated);
                        }} 
                        required
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Member {index + 1} Email
                      </label>
                      <input 
                        type="email" 
                        placeholder="email@example.com" 
                        value={member.email} 
                        onChange={(e) => {
                          const updated = [...members];
                          updated[index].email = e.target.value;
                          setMembers(updated);
                        }} 
                        required
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        Member {index + 1} Gender
                      </label>
                      <select 
                        value={member.gender} 
                        onChange={(e) => {
                          const updated = [...members];
                          updated[index].gender = e.target.value;
                          setMembers(updated);
                        }} 
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: '#fff' }}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={regLoading}
              style={{ padding: '0.75rem 3rem', fontSize: '1rem', cursor: regLoading ? 'not-allowed' : 'pointer' }}
            >
              {regLoading ? 'Processing registration...' : 'Submit Registration'}
            </button>
          </div>

        </form>
      </section>

      {/* Stats Counter Row */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '4rem'
      }}>
        <StatCounter label="Active Groups" value={stats.activeGroups} />
        <StatCounter label="Vetted Domains" value={stats.domains} />
        <StatCounter label="Vetting Stages" value="Double-Tier (Mentor & Admin)" />
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        paddingTop: '2rem',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-secondary)',
        fontSize: '0.8rem'
      }}>
        &copy; {new Date().getFullYear()} IEEE EMBS Pune Chapter. All rights reserved. 
        <span style={{ marginLeft: '0.5rem', color: 'var(--ieee-blue)' }}>Internship Telemetry Platform</span>
      </footer>

    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="glass glass-hover" style={{
      padding: '2rem',
      borderRadius: 'var(--radius-lg)',
      background: 'rgba(255, 255, 255, 0.65)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      alignItems: 'start'
    }}>
      <div style={{
        padding: '0.6rem',
        borderRadius: 'var(--radius-md)',
        background: '#fff',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--ieee-dark-blue)', margin: 0 }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function StatCounter({ label, value }) {
  return (
    <div className="glass" style={{
      padding: '1.5rem',
      borderRadius: 'var(--radius-lg)',
      background: 'rgba(255, 255, 255, 0.4)',
      textAlign: 'center',
      border: '1px solid var(--border-color)'
    }}>
      <strong style={{
        display: 'block',
        fontFamily: 'Outfit',
        fontSize: '1.5rem',
        color: 'var(--ieee-blue)',
        marginBottom: '0.25rem'
      }}>
        {value}
      </strong>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}
