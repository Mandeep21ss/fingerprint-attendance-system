/**
 * DeviceControl — Full ESP32 remote control panel
 * Replaces ALL Serial Monitor commands with web UI controls:
 *   • ENROLL <id> — Start fingerprint enrollment
 *   • ATTEND      — Switch to attendance mode
 *   • DELETE <id> — Delete a stored fingerprint
 *   • COUNT       — Get stored fingerprint count
 *   • EMPTY       — Clear all fingerprints from sensor
 */
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { getSocketUrl } from '../utils/apiBase';
import {
  Fingerprint, Radio, Wifi, WifiOff, Loader, CheckCircle, XCircle,
  Trash2, Hash, Database, AlertTriangle, Terminal, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeviceControl({ students = [] }) {
  const [deviceStatus, setDeviceStatus] = useState({
    mode: 'attend',
    isOnline: false,
    enrollId: null,
    enrollName: '',
    sensorInfo: null,
  });
  const [selectedStudent, setSelectedStudent] = useState('');
  const [customId, setCustomId] = useState('');
  const [switching, setSwitching] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState(null); // null, 'waiting', 'success', 'failed'

  // Command states
  const [deleteId, setDeleteId] = useState('');
  const [commandLoading, setCommandLoading] = useState(null); // 'delete', 'count', 'empty', or null
  const [commandLog, setCommandLog] = useState([]); // { status, message, timestamp, type }
  const [showLog, setShowLog] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const logEndRef = useRef(null);

  // Add log entry
  const addLog = (entry) => {
    setCommandLog((prev) => [
      { ...entry, timestamp: new Date().toLocaleTimeString() },
      ...prev,
    ].slice(0, 20)); // Keep last 20 entries
  };

  // Poll device status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for socket events
  useEffect(() => {
    const socket = io(getSocketUrl());

    socket.on('deviceModeChanged', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('deviceStatus', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('deviceCommandQueued', (data) => {
      addLog({
        type: 'info',
        icon: '📤',
        message: `Command "${data.type}" queued${data.id ? ` for ID #${data.id}` : ''}`,
      });
    });

    socket.on('deviceAck', (data) => {
      // Handle enrollment results
      if (data.status === 'enroll_complete') {
        setEnrollStatus('success');
        toast.success(data.message || 'Fingerprint enrolled successfully!', { icon: '✅', duration: 5000 });
        addLog({ type: 'success', icon: '✅', message: data.message });
        setTimeout(() => {
          setEnrollStatus(null);
          setDeviceStatus((prev) => ({ ...prev, mode: 'attend', enrollId: null }));
        }, 5000);
      } else if (data.status === 'enroll_failed') {
        setEnrollStatus('failed');
        toast.error(data.message || 'Enrollment failed', { icon: '❌', duration: 5000 });
        addLog({ type: 'error', icon: '❌', message: data.message });
        setTimeout(() => {
          setEnrollStatus(null);
          setDeviceStatus((prev) => ({ ...prev, mode: 'attend', enrollId: null }));
        }, 5000);
      }

      // Handle command results
      if (data.status === 'delete_complete') {
        toast.success(data.message, { icon: '🗑️' });
        addLog({ type: 'success', icon: '🗑️', message: data.message });
        setCommandLoading(null);
      } else if (data.status === 'delete_failed') {
        toast.error(data.message, { icon: '❌' });
        addLog({ type: 'error', icon: '❌', message: data.message });
        setCommandLoading(null);
      } else if (data.status === 'count_result') {
        const count = data.data || data.message;
        toast.success(`Sensor has ${count} stored fingerprint(s)`, { icon: '📊' });
        addLog({ type: 'success', icon: '📊', message: `Stored fingerprints: ${count}` });
        setDeviceStatus((prev) => ({
          ...prev,
          sensorInfo: { ...prev.sensorInfo, count: parseInt(count) },
        }));
        setCommandLoading(null);
      } else if (data.status === 'empty_complete') {
        toast.success(data.message, { icon: '🧹' });
        addLog({ type: 'success', icon: '🧹', message: data.message });
        setDeviceStatus((prev) => ({
          ...prev,
          sensorInfo: { ...prev.sensorInfo, count: 0 },
        }));
        setCommandLoading(null);
        setConfirmEmpty(false);
      } else if (data.status === 'empty_failed') {
        toast.error(data.message, { icon: '❌' });
        addLog({ type: 'error', icon: '❌', message: data.message });
        setCommandLoading(null);
        setConfirmEmpty(false);
      }
    });

    return () => socket.disconnect();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/device/status');
      if (data.success) {
        setDeviceStatus(data.device);
      }
    } catch (err) {
      // Silently fail — device status is optional
    }
  };

  // ─── Mode Controls ───
  const setMode = async (mode, enrollId = null, enrollName = '') => {
    setSwitching(true);
    setEnrollStatus(mode === 'enroll' ? 'waiting' : null);
    try {
      const { data } = await api.post('/device/mode', { mode, enrollId, enrollName });
      if (data.success) {
        setDeviceStatus((prev) => ({ ...prev, mode, enrollId, enrollName }));
        const msg = mode === 'enroll'
          ? `Enrollment mode activated for ID #${enrollId}`
          : 'Attendance mode activated';
        toast.success(msg, { icon: mode === 'enroll' ? '📝' : '🔍' });
        addLog({ type: 'info', icon: mode === 'enroll' ? '📝' : '🔍', message: msg });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change mode');
      setEnrollStatus(null);
    } finally {
      setSwitching(false);
    }
  };

  const handleEnroll = () => {
    let fpId = null;
    let fpName = '';

    if (selectedStudent) {
      const student = students.find((s) => s._id === selectedStudent);
      if (student) {
        fpId = student.fingerprintId;
        fpName = student.name;
      }
    } else if (customId) {
      fpId = parseInt(customId);
    }

    if (!fpId || fpId < 1 || fpId > 127) {
      toast.error('Select a student or enter a valid fingerprint ID (1-127)');
      return;
    }

    setMode('enroll', fpId, fpName);
  };

  const handleAttend = () => {
    setMode('attend');
    setSelectedStudent('');
    setCustomId('');
    setEnrollStatus(null);
  };

  // ─── Command Controls ───
  const sendCommand = async (type, id = null) => {
    setCommandLoading(type);
    try {
      const { data } = await api.post('/device/command', { type, id });
      if (data.success) {
        addLog({
          type: 'info',
          icon: '⏳',
          message: `Waiting for ESP32 to execute "${type}"...`,
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || `Failed to send ${type} command`;
      toast.error(errMsg);
      addLog({ type: 'error', icon: '❌', message: errMsg });
      setCommandLoading(null);
    }
  };

  const handleDelete = () => {
    const id = parseInt(deleteId);
    if (!id || id < 1 || id > 127) {
      toast.error('Enter a valid fingerprint ID (1-127)');
      return;
    }
    sendCommand('delete', id);
  };

  const handleCount = () => {
    sendCommand('count');
  };

  const handleEmpty = () => {
    if (!confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    sendCommand('empty');
  };

  const isEnrollMode = deviceStatus.mode === 'enroll';
  const isOnline = deviceStatus.isOnline;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={20} style={{ color: 'var(--accent-cyan)' }} />
          ESP32 Device Control
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {deviceStatus.sensorInfo?.count !== undefined && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginRight: 8,
            }}>
              <Database size={12} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
              {deviceStatus.sensorInfo.count} stored
            </span>
          )}
          {isOnline ? (
            <>
              <Wifi size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span className="badge present">Online</span>
            </>
          ) : (
            <>
              <WifiOff size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="badge absent">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* ─── Current Mode Display ─── */}
      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        background: isEnrollMode
          ? 'rgba(245, 158, 11, 0.08)'
          : 'rgba(16, 185, 129, 0.08)',
        border: `1px solid ${isEnrollMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <Fingerprint size={24} style={{
          color: isEnrollMode ? 'var(--accent-amber)' : 'var(--accent-emerald)',
        }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            Current Mode: {isEnrollMode ? '📝 ENROLLMENT' : '🔍 ATTENDANCE'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {isEnrollMode
              ? `Enrolling fingerprint ID #${deviceStatus.enrollId}${deviceStatus.enrollName ? ` — ${deviceStatus.enrollName}` : ''}`
              : 'Scanning fingerprints and recording attendance'
            }
          </div>
        </div>
      </div>

      {/* ─── Enrollment Status Feedback ─── */}
      {enrollStatus && (
        <div style={{
          padding: 14,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: enrollStatus === 'success'
            ? 'rgba(16, 185, 129, 0.1)'
            : enrollStatus === 'failed'
            ? 'rgba(244, 63, 94, 0.1)'
            : 'rgba(99, 102, 241, 0.1)',
          border: '1px solid',
          borderColor: enrollStatus === 'success'
            ? 'rgba(16, 185, 129, 0.3)'
            : enrollStatus === 'failed'
            ? 'rgba(244, 63, 94, 0.3)'
            : 'rgba(99, 102, 241, 0.3)',
        }}>
          {enrollStatus === 'waiting' && <Loader size={18} style={{ color: 'var(--accent-indigo)', animation: 'spin 1s linear infinite' }} />}
          {enrollStatus === 'success' && <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />}
          {enrollStatus === 'failed' && <XCircle size={18} style={{ color: 'var(--accent-rose)' }} />}
          <span style={{ fontSize: '0.85rem' }}>
            {enrollStatus === 'waiting' && 'Waiting for finger on sensor... (30s timeout)'}
            {enrollStatus === 'success' && 'Fingerprint enrolled successfully!'}
            {enrollStatus === 'failed' && 'Enrollment failed. Try again.'}
          </span>
        </div>
      )}

      {/* ─── Enrollment Controls ─── */}
      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        background: 'rgba(99, 102, 241, 0.04)',
        border: '1px solid rgba(99, 102, 241, 0.1)',
        marginBottom: 16,
      }}>
        <h4 style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          📝 Enroll Fingerprint
        </h4>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              Select Student
            </label>
            <select
              className="form-select"
              value={selectedStudent}
              onChange={(e) => { setSelectedStudent(e.target.value); setCustomId(''); }}
              style={{ width: '100%' }}
              disabled={!isOnline}
            >
              <option value="">— Select a student —</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} (ID #{s.fingerprintId}) — {s.class}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 100 }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
              Or enter ID
            </label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="127"
              placeholder="1-127"
              value={customId}
              onChange={(e) => { setCustomId(e.target.value); setSelectedStudent(''); }}
              style={{ width: 100 }}
              disabled={!isOnline}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleEnroll}
            disabled={switching || (!selectedStudent && !customId) || !isOnline}
            style={{ height: 42 }}
          >
            {switching ? <Loader size={16} /> : <Fingerprint size={16} />}
            Start Enrollment
          </button>

          {isEnrollMode && (
            <button
              className="btn btn-success"
              onClick={handleAttend}
              disabled={switching}
              style={{ height: 42 }}
            >
              Switch to Attendance
            </button>
          )}
        </div>
      </div>

      {/* ─── Sensor Commands ─── */}
      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        background: 'rgba(244, 63, 94, 0.04)',
        border: '1px solid rgba(244, 63, 94, 0.1)',
        marginBottom: 16,
      }}>
        <h4 style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          🛠️ Sensor Commands
        </h4>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Delete */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
                Delete Fingerprint
              </label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="127"
                placeholder="ID 1-127"
                value={deleteId}
                onChange={(e) => setDeleteId(e.target.value)}
                style={{ width: 110 }}
                disabled={!isOnline || isEnrollMode || commandLoading}
              />
            </div>
            <button
              className="btn btn-ghost"
              onClick={handleDelete}
              disabled={!deleteId || !isOnline || isEnrollMode || commandLoading}
              style={{
                height: 42,
                color: 'var(--accent-rose)',
                borderColor: 'rgba(244, 63, 94, 0.3)',
              }}
            >
              {commandLoading === 'delete' ? <Loader size={16} /> : <Trash2 size={16} />}
              Delete
            </button>
          </div>

          {/* Divider */}
          <div style={{
            width: 1,
            height: 42,
            background: 'var(--border-color)',
            alignSelf: 'flex-end',
          }} />

          {/* Count */}
          <button
            className="btn btn-ghost"
            onClick={handleCount}
            disabled={!isOnline || isEnrollMode || commandLoading}
            style={{
              height: 42,
              color: 'var(--accent-indigo)',
              borderColor: 'rgba(99, 102, 241, 0.3)',
              alignSelf: 'flex-end',
            }}
          >
            {commandLoading === 'count' ? <Loader size={16} /> : <Hash size={16} />}
            Count Stored
          </button>

          {/* Empty Database */}
          {!confirmEmpty ? (
            <button
              className="btn btn-ghost"
              onClick={handleEmpty}
              disabled={!isOnline || isEnrollMode || commandLoading}
              style={{
                height: 42,
                color: 'var(--accent-rose)',
                borderColor: 'rgba(244, 63, 94, 0.3)',
                alignSelf: 'flex-end',
              }}
            >
              <Database size={16} />
              Empty Sensor
            </button>
          ) : (
            <div style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              alignSelf: 'flex-end',
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--accent-rose)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Delete ALL fingerprints?</span>
              <button
                className="btn btn-primary"
                onClick={handleEmpty}
                disabled={commandLoading === 'empty'}
                style={{ height: 32, padding: '0 12px', fontSize: '0.75rem', background: 'var(--accent-rose)' }}
              >
                {commandLoading === 'empty' ? <Loader size={14} /> : 'Yes, Delete All'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmEmpty(false)}
                style={{ height: 32, padding: '0 12px', fontSize: '0.75rem' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Command Log ─── */}
      {commandLog.length > 0 && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowLog((v) => !v)}
            style={{
              width: '100%',
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={14} />
              Command Log ({commandLog.length})
            </span>
            {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showLog && (
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              padding: '0 16px 12px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '0.75rem',
              lineHeight: 1.8,
            }}>
              {commandLog.map((entry, i) => (
                <div key={i} style={{
                  color: entry.type === 'error'
                    ? 'var(--accent-rose)'
                    : entry.type === 'success'
                    ? 'var(--accent-emerald)'
                    : 'var(--text-muted)',
                  display: 'flex',
                  gap: 8,
                }}>
                  <span style={{ opacity: 0.5, minWidth: 70 }}>{entry.timestamp}</span>
                  <span>{entry.icon}</span>
                  <span>{entry.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Offline warning */}
      {!isOnline && (
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.8rem',
          color: 'var(--accent-amber)',
        }}>
          <WifiOff size={16} />
          ESP32 device is offline. Commands will be unavailable until it reconnects.
        </div>
      )}
    </div>
  );
}
