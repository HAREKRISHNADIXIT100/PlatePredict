import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [formData, setFormData] = useState({ start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadLeaves = useCallback(async () => {
    try {
      const data = await api.getLeaves();
      setLeaves(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchStudents(query);
        setResults(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedStudent) return setError("Please select a student.");
    if (!formData.start_date || !formData.end_date) return setError("Please select both start and end dates.");
    if (new Date(formData.start_date) > new Date(formData.end_date)) return setError("Start date cannot be after end date.");

    setLoading(true);
    try {
      await api.createLeave({
        student_id: selectedStudent.id,
        start_date: formData.start_date,
        end_date: formData.end_date
      });
      setSuccess("Leave assigned successfully.");
      setFormData({ start_date: '', end_date: '' });
      setSelectedStudent(null);
      setQuery('');
      loadLeaves();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Leave Management</h1>
        <p>Suspend student mess accounts for specific date ranges</p>
      </div>

      <div className="card-grid">
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>Assign New Leave</h2>
          
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Search Student Name, Email, or ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul, CE-102"
                value={selectedStudent ? selectedStudent.name : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedStudent(null);
                }}
              />
              
              {!selectedStudent && results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e2235', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', zIndex: 50, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {results.map((s) => (
                    <div 
                      key={s.id} 
                      onClick={() => { setSelectedStudent(s); setResults([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#1e2235', transition: 'background 0.15s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#2a3050'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#1e2235'}
                    >
                      <div style={{ fontWeight: 600, color: '#f0f4ff' }}>{s.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#8b95b5' }}>{s.hostel_id} • {s.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                name="start_date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                name="end_date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Leave'}
            </button>
          </form>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 16 }}>All Leaves</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No leaves found</td></tr>
                ) : (
                  leaves.map((l) => {
                    const now = new Date();
                    const start = new Date(l.start_date);
                    const end = new Date(l.end_date);
                    end.setHours(23, 59, 59, 999);
                    
                    let status = "ACTIVE";
                    if (now < start) status = "UPCOMING";
                    if (now > end) status = "COMPLETED";

                    return (
                      <tr key={l.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{l.student.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.student.email}</div>
                        </td>
                        <td>{l.student.hostel_id}</td>
                        <td>{start.toLocaleDateString()}</td>
                        <td>{end.toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${status === 'ACTIVE' ? 'badge-green' : status === 'UPCOMING' ? 'badge-orange' : 'badge-accent'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
