import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && data) {
          setNotifications(data);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    fetchNotifications();

    // Listen for new notifications
    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    if (unreadIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
      if (!error) {
        setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
      }
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    if (!showNotifs) return;
    const handleOutsideClick = () => setShowNotifs(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showNotifs]);

  return (
    <nav style={{
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.75rem 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" className="flex items-center" style={{ gap: '0.75rem', display: 'flex', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px',
            borderRadius: 'var(--radius-full)', background: 'var(--ieee-gradient)', color: 'white'
          }}>
            <Activity size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--ieee-dark-blue)', fontFamily: 'Outfit' }}>IEEE EMBS</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--ieee-purple)', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>PUNE CHAPTER</p>
          </div>
        </Link>
        
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          {user && profile && (
            <>
              {/* Notification Bell */}
              <div className="notif-bell-container" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowNotifs(!showNotifs)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-full)', border: 'none', position: 'relative', background: 'transparent' }}
                >
                  <Bell size={20} style={{ color: 'var(--text-secondary)' }} />
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                
                {showNotifs && (
                  <div className="notif-dropdown animate-fade-in">
                    <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--ieee-dark-blue)' }}>Notifications</strong>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} style={{ fontSize: '0.75rem', color: 'var(--ieee-purple)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          No notifications
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); setShowNotifs(false); }}
                            className={`notif-item ${!n.read_at ? 'unread' : ''}`}
                          >
                            <span style={{ fontWeight: !n.read_at ? 600 : 400, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{n.title}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{n.content}</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                              {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Shortcut */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => navigate(`/${profile.role}`)}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--ieee-light-blue)', color: 'var(--ieee-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {profile.full_name ? profile.full_name.split(' ')[0] : 'User'}
                </span>
              </div>
            </>
          )}

          {user && (
            <button onClick={handleLogout} className="btn btn-outline" style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', border: 'none', background: 'transparent' }}>
              <LogOut size={18} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
