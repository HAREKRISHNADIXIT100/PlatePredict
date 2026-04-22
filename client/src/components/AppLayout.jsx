import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isManager = user?.role === 'MANAGER';

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">Plate<span>Predict</span></div>

        {isManager ? (
          <>
            <NavLink to="/manager" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Dashboard
            </NavLink>
            <NavLink to="/manager/attendance" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v4a1 1 0 001 1h3"/><path d="M21 5v14a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M16 3h4v4"/><path d="M8 3H4v4"/><path d="M21 17v4h-4"/><path d="M8 21H4v-4"/></svg>
              Attendance
            </NavLink>
            <NavLink to="/manager/defaulters" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Defaulters
            </NavLink>
            <NavLink to="/manager/leaves" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
              Leaves
            </NavLink>
            <NavLink to="/manager/menus" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              Menus
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
              Dashboard
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              History
            </NavLink>
          </>
        )}

        <div className="sidebar-spacer" />
        <div style={{ padding: '8px 14px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          {user?.name}
          <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 2 }}>
            {user?.role}
          </div>
        </div>
        <button className="sidebar-link sidebar-logout" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </nav>
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {isManager ? (
          <>
            <NavLink to="/manager" end className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </NavLink>
            <NavLink to="/manager/attendance" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v4a1 1 0 001 1h3"/><path d="M21 5v14a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M16 3h4v4"/><path d="M8 3H4v4"/><path d="M21 17v4h-4"/><path d="M8 21H4v-4"/></svg>
            </NavLink>
            <NavLink to="/manager/defaulters" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            </NavLink>
            <NavLink to="/manager/leaves" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
            </NavLink>
            <NavLink to="/manager/menus" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </NavLink>
          </>
        )}
        <button className="mobile-link logout" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </nav>
    </div>
  );
}
