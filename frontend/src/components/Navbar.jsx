/**
 * Navbar — Sidebar navigation component
 */
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  LogOut,
  Fingerprint,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/registration', icon: Fingerprint, label: 'Registration' },
  { path: '/students', icon: Users, label: 'Students' },
  { path: '/attendance', icon: ClipboardList, label: 'Attendance' },
];

export default function Navbar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setMobileOpen(true)}>
          <Menu size={24} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Attendance</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="overlay-bg" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Fingerprint size={22} color="white" />
          </div>
          <div>
            <h1>Attendance</h1>
            <span>Fingerprint System</span>
          </div>
          {mobileOpen && (
            <button
              className="hamburger"
              style={{ marginLeft: 'auto' }}
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={20} className="nav-icon" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {admin?.name || 'Admin'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {admin?.email}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ width: '100%' }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}
