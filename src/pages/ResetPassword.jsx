import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Password cannot be empty');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.updateUser({ password });
      if (resetError) throw resetError;
      
      setSuccess(true);
      window.setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || 'An error occurred during password update.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '75vh'
    }}>
      <div className="glass animate-fade-in" style={{
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '400px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--ieee-light-blue)',
          color: 'var(--ieee-blue)',
          marginBottom: '1rem'
        }}>
          <KeyRound size={26} />
        </div>

        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', color: 'var(--ieee-dark-blue)', marginBottom: '0.5rem' }}>
          Update Password
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Enter and verify your new account password below.
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--error)',
            fontSize: '0.8rem',
            textAlign: 'left',
            marginBottom: '1rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: '0.8rem',
            textAlign: 'left',
            marginBottom: '1rem'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>Password updated successfully! Redirecting to login...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              New Password
            </label>
            <input 
              type="password"
              placeholder="Min 6 characters"
              required
              disabled={loading || success}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              Confirm Password
            </label>
            <input 
              type="password"
              placeholder="Confirm new password"
              required
              disabled={loading || success}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || success}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Updating...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
