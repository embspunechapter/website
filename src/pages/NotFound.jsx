import { Link } from 'react-router-dom';
import { HeartPulse, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '75vh',
      textAlign: 'center',
      padding: '2rem'
    }} className="animate-fade-in">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '90px',
        height: '90px',
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.08)',
        color: 'var(--error)',
        marginBottom: '1.5rem',
        animation: 'pulse 2s infinite'
      }}>
        <HeartPulse size={44} />
      </div>

      <h1 style={{
        fontFamily: 'Outfit',
        fontSize: '4.5rem',
        color: 'var(--ieee-dark-blue)',
        lineHeight: 1,
        marginBottom: '0.5rem',
        letterSpacing: '-1px'
      }}>404</h1>

      <h2 style={{
        fontFamily: 'Outfit',
        fontSize: '1.75rem',
        color: 'var(--text-primary)',
        fontWeight: 600,
        marginBottom: '1rem'
      }}>Signal Flatlined: Page Not Found</h2>

      <p style={{
        maxWidth: '460px',
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        lineHeight: 1.6,
        marginBottom: '2rem'
      }}>
        The bio-engineering path or resource you are looking for has expired or been relocated. Let's redirect you back to active telemetry.
      </p>

      <Link to="/" className="btn btn-primary" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        textDecoration: 'none',
        padding: '0.75rem 1.5rem',
        fontSize: '0.9rem'
      }}>
        <ArrowLeft size={16} /> Return to Telemetry
      </Link>
    </div>
  );
}
