import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import MentorDashboard from './pages/MentorDashboard';
import Navbar from './components/Navbar';

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  if (!user || !profile) return <Navigate to="/" replace />;
  if (profile && profile.role !== allowedRole) {
    // If they are logged in but don't match the role, redirect them to their actual role dashboard
    return <Navigate to={`/${profile.role}`} />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[var(--bg-primary)]">
          <Navbar />
          <main className="container container-padding">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/admin/*" element={
                <ProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/student/*" element={
                <ProtectedRoute allowedRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/mentor/*" element={
                <ProtectedRoute allowedRole="mentor">
                  <MentorDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
