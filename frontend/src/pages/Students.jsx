/**
 * Students Page — Student CRUD management
 */
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
  Plus, Search, Edit2, Trash2, Fingerprint, X, Loader, UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', fingerprintId: '', class: '', roll: '', email: '',
  });

  useEffect(() => { fetchStudents(); }, []);

  // Calculate next available fingerprint ID
  const getNextFingerprintId = () => {
    if (students.length === 0) return 1;
    const maxId = Math.max(...students.map(s => s.fingerprintId || 0));
    return Math.min(maxId + 1, 127); // Cap at 127 (sensor limit)
  };

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students');
      if (data.success) setStudents(data.students);
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ 
      name: '', 
      fingerprintId: String(getNextFingerprintId()), 
      class: '', 
      roll: '', 
      email: '' 
    });
    setShowModal(true);
  };

  const openEdit = (student) => {
    setEditing(student);
    setForm({
      name: student.name,
      fingerprintId: student.fingerprintId,
      class: student.class,
      roll: student.roll,
      email: student.email || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.fingerprintId || !form.class || !form.roll) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/students/${editing._id}`, form);
        toast.success('Student updated');
      } else {
        await api.post('/students', form);
        toast.success('Student added');
      }
      setShowModal(false);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (student) => {
    if (!window.confirm(`Delete ${student.name}?`)) return;
    try {
      await api.delete(`/students/${student._id}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch (err) {
      toast.error('Failed to delete student');
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll.toLowerCase().includes(search.toLowerCase()) ||
    s.class.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{students.length} students registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} /> Add Student
        </button>
      </div>

      {/* Search bar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            className="form-input"
            placeholder="Search by name, roll, or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Students table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Fingerprint ID</th>
                <th>Class</th>
                <th>Roll</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <UserPlus size={36} style={{ opacity: 0.3 }} />
                      <p style={{ marginTop: 8 }}>No students found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="recent-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {student.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <Fingerprint size={14} style={{ color: 'var(--accent-indigo)' }} />
                        #{student.fingerprintId}
                      </span>
                    </td>
                    <td>{student.class}</td>
                    <td>{student.roll}</td>
                    <td>
                      <span className={`badge ${student.isActive ? 'present' : 'absent'}`}>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(student)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(student)}
                          style={{ color: 'var(--accent-rose)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editing ? 'Edit Student' : 'Add Student'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Student Name *</label>
                <input className="form-input" placeholder="John Doe"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Fingerprint ID * (1-127)</label>
                <input 
                  className="form-input" 
                  type="number" 
                  min="1" 
                  max="127"
                  placeholder="1"
                  value={form.fingerprintId}
                  onChange={(e) => setForm({ ...form, fingerprintId: e.target.value })}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Class *</label>
                  <input className="form-input" placeholder="10-A"
                    value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Roll Number *</label>
                  <input className="form-input" placeholder="001"
                    value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email (optional)</label>
                <input className="form-input" type="email" placeholder="john@example.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader size={16} /> Saving...</> : editing ? 'Update' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
