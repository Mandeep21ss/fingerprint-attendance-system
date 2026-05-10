/**
 * Dashboard Page — Statistics overview (simplified, no device control)
 */
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import {
  Users, UserCheck, UserX, TrendingUp, Clock, Fingerprint, Wifi, WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveEvent, setLiveEvent] = useState(null);
  const [deviceOnline, setDeviceOnline] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  // Socket.io for real-time updates
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on('attendanceMarked', (data) => {
      toast.success(`${data.name} marked present!`, { icon: '✅' });
      setLiveEvent(data);
      setTimeout(() => setLiveEvent(null), 5000);
      fetchStats();
    });

    socket.on('deviceStatus', (data) => {
      setDeviceOnline(data.isOnline);
    });

    return () => socket.disconnect();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/attendance/stats');
      if (data.success) {
        setStats(data.stats);
        setRecent(data.recentAttendance || []);
      }
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /></div>;
  }

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: 'indigo' },
    { label: 'Present Today', value: stats?.todayPresent || 0, icon: UserCheck, color: 'emerald' },
    { label: 'Absent Today', value: stats?.todayAbsent || 0, icon: UserX, color: 'rose' },
    { label: 'Attendance Rate', value: `${stats?.attendanceRate || 0}%`, icon: TrendingUp, color: 'amber' },
  ];

  const getDayAbbr = (dateStr) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of today's attendance •{' '}
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {deviceOnline ? (
            <><Wifi size={16} style={{ color: 'var(--accent-emerald)' }} /><span className="badge present">ESP32 Online</span></>
          ) : (
            <><WifiOff size={16} style={{ color: 'var(--text-muted)' }} /><span className="badge absent">ESP32 Offline</span></>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className={`stat-card ${card.color}`}>
            <div className={`stat-icon ${card.color}`}>
              <card.icon size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Recent */}
      <div className="grid-2">
        {/* 7-Day chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Last 7 Days</h3>
          <div className="chart-container">
            <div className="chart-bars">
              {(stats?.last7Days || []).map((day, i) => {
                const maxCount = Math.max(...((stats?.last7Days || []).map((d) => d.count)), 1);
                const height = Math.max((day.count / maxCount) * 150, 10);
                return (
                  <div key={i} className="chart-bar" style={{ height: `${height}px` }}
                    title={`${day._id}: ${day.count} records`}>
                    <span className="chart-bar-label">{getDayAbbr(day._id)}</span>
                  </div>
                );
              })}
              {(!stats?.last7Days || stats.last7Days.length === 0) && (
                <div className="empty-state" style={{ padding: 20 }}><p>No data for the last 7 days</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Recent attendance */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>
            <Clock size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
            Recent Activity
          </h3>
          <div className="recent-list">
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <Fingerprint size={32} style={{ opacity: 0.3 }} />
                <p style={{ marginTop: 8 }}>No recent activity</p>
              </div>
            ) : (
              recent.slice(0, 8).map((record) => (
                <div key={record._id} className="recent-item">
                  <div className="recent-avatar">
                    {record.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="recent-info">
                    <div className="recent-name">{record.name}</div>
                    <div className="recent-time">{record.date} at {record.time}</div>
                  </div>
                  <span className={`badge ${record.status}`}>{record.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live attendance toast */}
      {liveEvent && (
        <div className="live-toast">
          <div className="live-toast-dot" />
          <div>
            <strong>{liveEvent.name}</strong> just checked in
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {liveEvent.time} • ID #{liveEvent.fingerprintId}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
