import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ArrowRight, Activity, Award, BookOpen } from 'lucide-react';

export default function Landing() {
  const { user, profile } = useAuth();

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
          
          <a href="#about" className="btn btn-outline" style={{
            textDecoration: 'none',
            padding: '0.8rem 1.75rem',
            fontSize: '0.95rem'
          }}>
            Learn More
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

      {/* Stats Counter Row */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '4rem'
      }}>
        <StatCounter label="Active Groups" value="10+" />
        <StatCounter label="Vetted Domains" value="Bioinformatics, AI/ML, IoT" />
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
