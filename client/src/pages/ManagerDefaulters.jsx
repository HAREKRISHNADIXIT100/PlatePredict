import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerDefaulters() {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.defaulters();
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((d) => d.student_id)));
    }
  }

  async function sendReminders() {
    if (selected.size === 0) return;
    setSending(true);
    setMsg('');
    try {
      const result = await api.remindDefaulters([...selected]);
      setMsg(result.message);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Defaulter Management</h1>
        <p>Students with pending fees or negative balances</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {data.length} defaulter{data.length !== 1 ? 's' : ''} found
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={sendReminders}
          disabled={selected.size === 0 || sending}
        >
          {sending ? 'Sending...' : `Send Reminder (${selected.size})`}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={data.length > 0 && selected.size === data.length} onChange={toggleAll} />
              </th>
              <th>Student</th>
              <th>Email</th>
              <th>Hostel</th>
              <th>Balance</th>
              <th>Amount Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No defaulters — all students are in good standing</td></tr>
            ) : (
              data.map((d) => (
                <tr key={d.student_id}>
                  <td>
                    <input type="checkbox" checked={selected.has(d.student_id)} onChange={() => toggleSelect(d.student_id)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.email}</td>
                  <td>{d.hostel_id}</td>
                  <td style={{ color: d.current_balance < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                    ₹{d.current_balance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{d.amount_due.toLocaleString('en-IN')}</td>
                  <td>
                    {d.fee_due_status && <span className="badge badge-red">FEE DUE</span>}
                    {d.current_balance < 0 && <span className="badge badge-orange" style={{ marginLeft: 4 }}>NEGATIVE</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
