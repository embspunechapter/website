import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Shield, GraduationCap } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const navigate = useNavigate();
  const { signIn, signOut, profile, user, loading } = useAuth();

  // If already logged in, redirect
  useEffect(() => {
    if (user && profile) {
      navigate(`/${profile.role}`);
    } else if (user && !loading && !profile) {
      setIsLoggingIn(false);
      setError("Login successful, but no matching profile was found in the database! Please ensure your email in the 'profiles' table matches exactly.");
      signOut();
    }
  }, [user, profile, loading, navigate, signOut]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;
      // The useEffect will catch the profile load and redirect
    } catch (err) {
      setError(err.message || 'Failed to sign in');
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)', padding: '2rem' }}>
      <div className="glass animate-fade-in" style={{ padding: '3rem', borderRadius: 'var(--radius-lg)', maxWidth: '450px', width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--ieee-dark-purple)' }}>
            Welcome Back
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to the Internship Portal</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', marginBottom: '1.5rem', backgroundColor: '#fee2e2', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <button type="button" onClick={() => setRole('student')} style={roleBtnStyle(role === 'student', 'var(--ieee-purple)')}>
              <GraduationCap size={20} />
              <span style={{ fontSize: '0.875rem' }}>Student</span>
            </button>
            <button type="button" onClick={() => setRole('mentor')} style={roleBtnStyle(role === 'mentor', 'var(--ieee-blue)')}>
              <User size={20} />
              <span style={{ fontSize: '0.875rem' }}>Mentor</span>
            </button>
            <button type="button" onClick={() => setRole('admin')} style={roleBtnStyle(role === 'admin', 'var(--ieee-dark-blue)')}>
              <Shield size={20} />
              <span style={{ fontSize: '0.875rem' }}>Admin</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email" 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter your password" 
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none' }}
              required
            />
          </div>

          <button type="submit" disabled={isLoggingIn} className="btn btn-primary" style={{
            padding: '0.75rem', width: '100%', marginTop: '1rem', display: 'flex', gap: '0.5rem', 
            background: `linear-gradient(to right, var(--ieee-blue), var(--ieee-purple))`,
            opacity: isLoggingIn ? 0.7 : 1
          }}>
            <LogIn size={18} />
            {isLoggingIn ? 'Signing in...' : `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>
            Quick Demo Logins (Click to Autofill):
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => { setEmail('admin@embs.org'); setPassword('admin123'); setRole('admin'); }}
              style={demoBtnStyle}
            >
              <span>Admin: <strong>admin@embs.org</strong></span>
              <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>Pass: admin123</span>
            </button>
            <button 
              type="button" 
              onClick={() => { setEmail('mentor@embs.org'); setPassword('mentor123'); setRole('mentor'); }}
              style={demoBtnStyle}
            >
              <span>Mentor: <strong>mentor@embs.org</strong></span>
              <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>Pass: mentor123</span>
            </button>
            <button 
              type="button" 
              onClick={() => { setEmail('student@embs.org'); setPassword('student123'); setRole('student'); }}
              style={demoBtnStyle}
            >
              <span>Student: <strong>student@embs.org</strong></span>
              <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>Pass: student123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const demoBtnStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'all 0.2s',
  color: 'var(--text-primary)',
  width: '100%'
};

const roleBtnStyle = (isActive, color) => ({
  flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid',
  borderColor: isActive ? color : 'var(--border-color)',
  backgroundColor: isActive ? color : 'transparent',
  color: isActive ? 'white' : 'var(--text-secondary)',
  cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
});
