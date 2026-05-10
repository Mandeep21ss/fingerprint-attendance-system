/**
 * Attendance Page — View, search, filter, export attendance records + live mode control
 */
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import {
  Search, Download, Calendar, Filter, ChevronLeft, ChevronRight,
  ClipboardList, RefreshCw, Wifi, WifiOff, Fingerprint, Loader,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deviceStatus, setDeviceStatus] = useState({ mode: 'attend', isOnline: false });
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [page, dateFilter, startDate, endDate]);

  useEffect(() => { fetchDeviceStatus(); }, []);

  // Socket.io — auto-refresh on new attendance + device status
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on('attendanceMarked', () => {
      if (!dateFilter && !startDate) { fetchAttendance(); }
    });

    socket.on('deviceStatus', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('deviceModeChanged', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    return () => socket.disconnect();
  }, [dateFilter, startDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (dateFilter) params.date = dateFilter;
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (search) params.search = search;

      const { data } = await api.get('/attendance', { params });
      if (data.success) {
        setRecords(data.records);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviceStatus = async () => {
    try {
      const { data } = await api.get('/device/status');
      if (data.success) setDeviceStatus(data.device);
    } catch (err) { /* silent */ }
  };

  const activateAttendance = async () => {
    setSwitching(true);
    try {
      await api.post('/device/mode', { mode: 'attend' });
      setDeviceStatus((prev) => ({ ...prev, mode: 'attend' }));
      toast.success('Attendance mode activated — scanning for fingerprints', { icon: '🔍' });
    } catch (err) {
      toast.error('Failed to activate attendance mode');
    } finally { setSwitching(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAttendance();
  };

  // Export as CSV
  const exportCSV = () => {
    if (records.length === 0) {
      toast.error('No records to export');
      return;
    }

    const headers = ['Name', 'Fingerprint ID', 'Class', 'Roll', 'Date', 'Time', 'Status'];
    const rows = records.map((r) => [
      r.name,
      r.fingerprintId,
      r.studentId?.class || '-',
      r.studentId?.roll || '-',
      r.date,
      r.time,
      r.status,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${dateFilter || 'all'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const clearFilters = () => {
    setDateFilter('');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
  };

  const isAttendMode = deviceStatus.mode === 'attend';
  const isOnline = deviceStatus.isOnline;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-subtitle">{total} total records</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={setToday}>
            <Calendar size={16} /> Today
          </button>
          <button className="btn btn-success" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Attendance mode banner */}
      <div className={`mode-banner ${isAttendMode ? 'attend' : 'enroll'}`}>
        <div className="mode-banner-content">
          <Fingerprint size={20} />
          <span>
            {isAttendMode ? (
              <>Attendance mode <strong>active</strong> — scanning for fingerprints</>
            ) : (
              <>Device is in <strong>registration mode</strong> — attendance scanning is paused</>
            )}
          </span>
          {isOnline ? (
            <span className="badge present" style={{ marginLeft: 8 }}>Online</span>
          ) : (
            <span className="badge absent" style={{ marginLeft: 8 }}>Offline</span>
          )}
        </div>
        {!isAttendMode && (
          <button className="btn btn-success" onClick={activateAttendance} disabled={switching || !isOnline}>
            {switching ? <Loader size={16} /> : <Fingerprint size={16} />}
            Activate Attendance Mode
          </button>
        )}
      </div>

      {/* Filters toolbar */}
      <div className="toolbar">
        <form onSubmit={handleSearch} className="search-box">
          <Search size={18} className="search-icon" />
          <input
            className="form-input"
            placeholder="Search by student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            className="form-input"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            style={{ width: 160 }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>or range:</span>
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setDateFilter(''); setPage(1); }}
            style={{ width: 140 }}
            placeholder="From"
          />
          <input
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setDateFilter(''); setPage(1); }}
            style={{ width: 140 }}
            placeholder="To"
          />
          {(dateFilter || startDate || search) && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <RefreshCw size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Attendance table */}
      <div className="card">
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Fingerprint ID</th>
                  <th>Class</th>
                  <th>Roll</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <ClipboardList size={36} style={{ opacity: 0.3 }} />
                        <p style={{ marginTop: 8 }}>No attendance records found</p>
                        <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          Try adjusting your filters
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((record, idx) => (
                    <tr key={record._id}>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {(page - 1) * 30 + idx + 1}
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="recent-avatar"
                            style={{ width: 30, height: 30, fontSize: '0.7rem' }}
                          >
                            {record.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {record.name}
                          </span>
                        </div>
                      </td>
                      <td>#{record.fingerprintId}</td>
                      <td>{record.studentId?.class || '-'}</td>
                      <td>{record.studentId?.roll || '-'}</td>
                      <td>{record.date}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {record.time}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${record.status}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center"
            style={{
              justifyContent: 'space-between',
              padding: '16px 0 0',
              borderTop: '1px solid var(--border-color)',
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Page {page} of {totalPages} ({total} records)
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
