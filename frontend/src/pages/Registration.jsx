/**
 * Registration Page — Fingerprint enrollment with visual step-by-step tutorial
 * Replaces Serial Monitor guidance with on-screen animated instructions
 */
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { getSocketUrl } from '../utils/apiBase';
import {
  Fingerprint, Wifi, WifiOff, Loader, CheckCircle, XCircle,
  Trash2, Hash, Database, AlertTriangle, UserPlus, Hand, RotateCcw,
  ChevronDown, ChevronUp, Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ENROLL_STEPS = [
  { key: 'idle', label: 'Select a student to begin', icon: UserPlus, color: 'var(--text-muted)' },
  { key: 'enroll_place_finger', label: 'Place your finger on the sensor', icon: Fingerprint, color: 'var(--accent-indigo)' },
  { key: 'enroll_captured_1', label: 'First scan captured!', icon: CheckCircle, color: 'var(--accent-emerald)' },
  { key: 'enroll_remove_finger', label: 'Remove your finger', icon: Hand, color: 'var(--accent-amber)' },
  { key: 'enroll_place_again', label: 'Place the SAME finger again', icon: Fingerprint, color: 'var(--accent-cyan)' },
  { key: 'enroll_captured_2', label: 'Second scan captured!', icon: CheckCircle, color: 'var(--accent-emerald)' },
  { key: 'enroll_processing', label: 'Processing fingerprint...', icon: Loader, color: 'var(--accent-indigo)' },
  { key: 'enroll_complete', label: 'Enrollment successful!', icon: CheckCircle, color: 'var(--accent-emerald)' },
  { key: 'enroll_failed', label: 'Enrollment failed', icon: XCircle, color: 'var(--accent-rose)' },
];

const STEP_ORDER = ['enroll_place_finger', 'enroll_captured_1', 'enroll_remove_finger', 'enroll_place_again', 'enroll_captured_2', 'enroll_processing'];

export default function Registration() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState({ mode: 'attend', isOnline: false, sensorInfo: null });
  const [selectedStudent, setSelectedStudent] = useState('');
  const [customId, setCustomId] = useState('');
  const [enrollStep, setEnrollStep] = useState('idle');
  const [enrollMessage, setEnrollMessage] = useState('');
  const [switching, setSwitching] = useState(false);
  const [enrollHistory, setEnrollHistory] = useState([]);

  // Sensor command states
  const [deleteId, setDeleteId] = useState('');
  const [commandLoading, setCommandLoading] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [commandLog, setCommandLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const addLog = (entry) => {
    setCommandLog((prev) => [{ ...entry, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
  };

  useEffect(() => {
    fetchStudents();
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io — listen for enrollment progress + device events
  useEffect(() => {
    const socket = io(getSocketUrl());

    socket.on('deviceStatus', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('deviceModeChanged', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });

    socket.on('deviceAck', (data) => {
      const { status, message } = data;

      // Enrollment progress steps
      if (status.startsWith('enroll_')) {
        setEnrollStep(status);
        setEnrollMessage(message);
        addLog({ type: status === 'enroll_failed' ? 'error' : status === 'enroll_complete' ? 'success' : 'info', icon: getStepIcon(status), message });

        if (status === 'enroll_complete') {
          toast.success(message || 'Fingerprint enrolled!', { icon: '✅', duration: 4000 });
          setEnrollHistory((prev) => [{ message, time: new Date().toLocaleTimeString() }, ...prev]);
          // Reset for next enrollment after delay
          setTimeout(() => { setEnrollStep('idle'); setEnrollMessage(''); }, 4000);
        } else if (status === 'enroll_failed') {
          toast.error(message || 'Enrollment failed', { icon: '❌', duration: 4000 });
          setTimeout(() => { setEnrollStep('idle'); setEnrollMessage(''); }, 4000);
        }
      }

      // Sensor command results
      if (status === 'delete_complete') {
        toast.success(message, { icon: '🗑️' });
        addLog({ type: 'success', icon: '🗑️', message });
        setCommandLoading(null);
      } else if (status === 'delete_failed') {
        toast.error(message); addLog({ type: 'error', icon: '❌', message }); setCommandLoading(null);
      } else if (status === 'count_result') {
        const count = data.data || message;
        toast.success(`Sensor: ${count} fingerprint(s) stored`, { icon: '📊' });
        addLog({ type: 'success', icon: '📊', message: `Stored: ${count}` });
        setDeviceStatus((prev) => ({ ...prev, sensorInfo: { ...prev.sensorInfo, count: parseInt(count) } }));
        setCommandLoading(null);
      } else if (status === 'empty_complete') {
        toast.success(message, { icon: '🧹' });
        addLog({ type: 'success', icon: '🧹', message });
        setDeviceStatus((prev) => ({ ...prev, sensorInfo: { ...prev.sensorInfo, count: 0 } }));
        setCommandLoading(null); setConfirmEmpty(false);
      } else if (status === 'empty_failed') {
        toast.error(message); addLog({ type: 'error', icon: '❌', message }); setCommandLoading(null); setConfirmEmpty(false);
      }
    });

    return () => socket.disconnect();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students');
      if (data.success) setStudents(data.students);
    } catch (err) { /* silent */ } finally { setLoading(false); }
  };

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/device/status');
      if (data.success) setDeviceStatus(data.device);
    } catch (err) { /* silent */ }
  };

  const getStepIcon = (status) => {
    const icons = { enroll_place_finger: '👆', enroll_captured_1: '✅', enroll_remove_finger: '✋', enroll_place_again: '👆', enroll_captured_2: '✅', enroll_processing: '⚙️', enroll_complete: '🎉', enroll_failed: '❌' };
    return icons[status] || '📝';
  };

  // ── Activate registration mode ──
  const activateRegistrationMode = async () => {
    setSwitching(true);
    try {
      await api.post('/device/mode', { mode: 'enroll', enrollId: 1, enrollName: '' });
      // We send a dummy enrollId=1 just to set mode; actual enrollment starts when user picks a student
      setDeviceStatus((prev) => ({ ...prev, mode: 'enroll' }));
      toast.success('Registration mode activated', { icon: '📝' });
      // Immediately reset to attend-like idle so ESP32 doesn't enroll ID 1
      await api.post('/device/mode', { mode: 'enroll', enrollId: -1, enrollName: '' });
    } catch (err) {
      toast.error('Failed to activate registration mode');
    } finally { setSwitching(false); }
  };

  // ── Start enrollment for a specific student ──
  const handleEnroll = async () => {
    let fpId = null, fpName = '';
    if (selectedStudent) {
      const student = students.find((s) => s._id === selectedStudent);
      if (student) { fpId = student.fingerprintId; fpName = student.name; }
    } else if (customId) {
      fpId = parseInt(customId);
    }
    if (!fpId || fpId < 1 || fpId > 127) {
      toast.error('Select a student or enter a valid fingerprint ID (1-127)');
      return;
    }

    setSwitching(true);
    setEnrollStep('idle');
    try {
      const { data } = await api.post('/device/mode', { mode: 'enroll', enrollId: fpId, enrollName: fpName });
      if (data.success) {
        setDeviceStatus((prev) => ({ ...prev, mode: 'enroll', enrollId: fpId, enrollName: fpName }));
        toast.success(`Starting enrollment for ${fpName || `ID #${fpId}`}`, { icon: '📝' });
        addLog({ type: 'info', icon: '📝', message: `Enrollment started: ${fpName || `ID #${fpId}`}` });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start enrollment');
    } finally { setSwitching(false); }
  };

  // ── Switch to attendance mode ──
  const switchToAttendance = async () => {
    setSwitching(true);
    try {
      await api.post('/device/mode', { mode: 'attend' });
      setDeviceStatus((prev) => ({ ...prev, mode: 'attend', enrollId: null }));
      setEnrollStep('idle');
      toast.success('Switched to attendance mode', { icon: '🔍' });
    } catch (err) {
      toast.error('Failed to switch mode');
    } finally { setSwitching(false); }
  };

  // ── Sensor commands ──
  const sendCommand = async (type, id = null) => {
    setCommandLoading(type);
    try {
      await api.post('/device/command', { type, id });
      addLog({ type: 'info', icon: '⏳', message: `"${type}" sent to ESP32...` });
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed: ${type}`);
      addLog({ type: 'error', icon: '❌', message: err.response?.data?.message || `Failed: ${type}` });
      setCommandLoading(null);
    }
  };

  const isOnline = deviceStatus.isOnline;
  const isEnrollMode = deviceStatus.mode === 'enroll';
  const isEnrolling = enrollStep !== 'idle' && enrollStep !== 'enroll_complete' && enrollStep !== 'enroll_failed';
  const currentStepData = ENROLL_STEPS.find((s) => s.key === enrollStep) || ENROLL_STEPS[0];
  const stepProgress = STEP_ORDER.indexOf(enrollStep);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Registration</h1>
          <p className="page-subtitle">Enroll fingerprints for students</p>
        </div>
        <div className="flex gap-2 items-center">
          {isOnline ? (
            <><Wifi size={16} style={{ color: 'var(--accent-emerald)' }} /><span className="badge present">Online</span></>
          ) : (
            <><WifiOff size={16} style={{ color: 'var(--text-muted)' }} /><span className="badge absent">Offline</span></>
          )}
          {deviceStatus.sensorInfo?.count !== undefined && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              <Database size={12} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
              {deviceStatus.sensorInfo.count} stored
            </span>
          )}
        </div>
      </div>

      {/* Mode banner */}
      <div className={`mode-banner ${isEnrollMode ? 'enroll' : 'attend'}`}>
        <div className="mode-banner-content">
          <Fingerprint size={20} />
          <span>
            Current Mode: <strong>{isEnrollMode ? 'REGISTRATION' : 'ATTENDANCE'}</strong>
          </span>
        </div>
        {!isEnrollMode ? (
          <button className="btn btn-primary" onClick={switchToAttendance} disabled={switching || !isOnline}
            style={{ visibility: 'hidden' }}>
            —
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={switchToAttendance} disabled={switching || isEnrolling}>
            Switch to Attendance Mode
          </button>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        {/* ═══ LEFT: Enrollment Controls ═══ */}
        <div>
          {/* Student selector */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>
              <UserPlus size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 8 }} />
              Select Student to Enroll
            </h3>
            <div className="form-group">
              <label className="form-label">Choose Student</label>
              <select
                className="form-select"
                value={selectedStudent}
                onChange={(e) => { setSelectedStudent(e.target.value); setCustomId(''); }}
                disabled={!isOnline || isEnrolling}
              >
                <option value="">— Select a student —</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} (ID #{s.fingerprintId}) — {s.class}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Or enter fingerprint ID manually</label>
              <div className="flex gap-2">
                <input
                  className="form-input"
                  type="number" min="1" max="127" placeholder="1-127"
                  value={customId}
                  onChange={(e) => { setCustomId(e.target.value); setSelectedStudent(''); }}
                  disabled={!isOnline || isEnrolling}
                  style={{ width: 120 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleEnroll}
                  disabled={switching || (!selectedStudent && !customId) || !isOnline || isEnrolling}
                >
                  {switching ? <Loader size={16} /> : <Fingerprint size={16} />}
                  Start Enrollment
                </button>
              </div>
            </div>
          </div>

          {/* Sensor commands */}
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>
              🛠️ Sensor Commands
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <div className="flex gap-2 items-center">
                <input className="form-input" type="number" min="1" max="127" placeholder="ID"
                  value={deleteId} onChange={(e) => setDeleteId(e.target.value)}
                  disabled={!isOnline || isEnrolling || commandLoading} style={{ width: 80 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => sendCommand('delete', parseInt(deleteId))}
                  disabled={!deleteId || !isOnline || isEnrolling || commandLoading}
                  style={{ color: 'var(--accent-rose)' }}>
                  {commandLoading === 'delete' ? <Loader size={14} /> : <Trash2 size={14} />} Delete
                </button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => sendCommand('count')}
                disabled={!isOnline || isEnrolling || commandLoading}
                style={{ color: 'var(--accent-indigo)' }}>
                {commandLoading === 'count' ? <Loader size={14} /> : <Hash size={14} />} Count
              </button>
              {!confirmEmpty ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmEmpty(true)}
                  disabled={!isOnline || isEnrolling || commandLoading}
                  style={{ color: 'var(--accent-rose)' }}>
                  <Database size={14} /> Empty All
                </button>
              ) : (
                <div className="flex gap-2 items-center" style={{ padding: '4px 8px', background: 'rgba(244,63,94,0.1)', borderRadius: 'var(--radius-sm)' }}>
                  <AlertTriangle size={14} style={{ color: 'var(--accent-rose)' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Delete ALL?</span>
                  <button className="btn btn-sm" onClick={() => sendCommand('empty')}
                    disabled={commandLoading === 'empty'}
                    style={{ background: 'var(--accent-rose)', color: 'white', padding: '2px 8px' }}>
                    {commandLoading === 'empty' ? <Loader size={12} /> : 'Yes'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmEmpty(false)}
                    style={{ padding: '2px 8px' }}>No</button>
                </div>
              )}
            </div>

            {/* Command log */}
            {commandLog.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <button onClick={() => setShowLog((v) => !v)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Terminal size={12} /> Log ({commandLog.length})
                  {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showLog && (
                  <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8, fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.8 }}>
                    {commandLog.map((e, i) => (
                      <div key={i} style={{ color: e.type === 'error' ? 'var(--accent-rose)' : e.type === 'success' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                        <span style={{ opacity: 0.5, marginRight: 8 }}>{e.timestamp}</span>
                        {e.icon} {e.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Visual Enrollment Tutorial ═══ */}
        <div className="card enroll-tutorial-card">
          <h3 style={{ fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
            Enrollment Guide
          </h3>

          {/* Big animated fingerprint area */}
          <div className="enroll-visual-area">
            <div className={`enroll-fingerprint-circle ${enrollStep}`}>
              <currentStepData.icon
                size={48}
                style={{ color: currentStepData.color }}
                className={
                  enrollStep === 'enroll_place_finger' || enrollStep === 'enroll_place_again' ? 'pulse-anim' :
                  enrollStep === 'enroll_processing' ? 'spin-anim' : ''
                }
              />
            </div>
            <div className="enroll-step-label" style={{ color: currentStepData.color }}>
              {enrollStep === 'idle' ? currentStepData.label : enrollMessage || currentStepData.label}
            </div>

            {/* Progress dots */}
            {enrollStep !== 'idle' && (
              <div className="enroll-progress-dots">
                {STEP_ORDER.map((step, i) => (
                  <div
                    key={step}
                    className={`enroll-dot ${i <= stepProgress ? 'active' : ''} ${enrollStep === step ? 'current' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Step-by-step breakdown */}
          <div className="enroll-steps-list">
            {[
              { step: 'enroll_place_finger', num: 1, text: 'Place finger on sensor' },
              { step: 'enroll_captured_1', num: 2, text: 'First scan captured' },
              { step: 'enroll_remove_finger', num: 3, text: 'Remove finger' },
              { step: 'enroll_place_again', num: 4, text: 'Place same finger again' },
              { step: 'enroll_captured_2', num: 5, text: 'Second scan captured' },
              { step: 'enroll_processing', num: 6, text: 'Processing & storing' },
            ].map(({ step, num, text }) => {
              const isDone = stepProgress > STEP_ORDER.indexOf(step);
              const isCurrent = enrollStep === step;
              const isFailed = enrollStep === 'enroll_failed' && isCurrent;
              return (
                <div key={step} className={`enroll-step-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isFailed ? 'failed' : ''}`}>
                  <div className="enroll-step-num">
                    {isDone ? <CheckCircle size={16} /> : isFailed ? <XCircle size={16} /> : num}
                  </div>
                  <span>{text}</span>
                </div>
              );
            })}
          </div>

          {/* Enrollment history */}
          {enrollHistory.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                Recent Enrollments
              </h4>
              {enrollHistory.slice(0, 5).map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: '0.8rem' }}>
                  <CheckCircle size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{h.message}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{h.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offline warning */}
      {!isOnline && (
        <div style={{
          marginTop: 20, padding: 14, borderRadius: 'var(--radius-md)',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: 'var(--accent-amber)',
        }}>
          <WifiOff size={18} /> ESP32 is offline. Connect the device to use registration features.
        </div>
      )}
    </>
  );
}
