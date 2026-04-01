import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerTokens() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [redeemLoading, setRedeemLoading] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.activeTokens(search);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem(tokenCode) {
    setRedeemLoading((prev) => ({ ...prev, [tokenCode]: true }));
    setSuccessMsg('');
    try {
      await api.redeemToken(tokenCode);
      setSuccessMsg(`Token ${tokenCode} redeemed!`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRedeemLoading((prev) => ({ ...prev, [tokenCode]: false }));
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Token Fulfillment</h1>
        <p>Manage snack token redemptions for the current meal</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          id="token-search"
          type="text"
          className="form-input"
          placeholder="Search by student name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        {data && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {data.total_tokens} active token{data.total_tokens !== 1 ? 's' : ''} · {data.meal_type}
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Hostel</th>
              <th>Token Code</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.eligible_students.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No active tokens for the current meal</td></tr>
            ) : (
              data.eligible_students.map((s) => (
                <tr key={s.token_code}>
                  <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.hostel_id}</td>
                  <td style={{ fontFamily: 'monospace', letterSpacing: 1, fontSize: '0.85rem' }}>{s.token_code}</td>
                  <td><span className="badge badge-orange">{s.status}</span></td>
                  <td>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleRedeem(s.token_code)}
                      disabled={redeemLoading[s.token_code]}
                    >
                      {redeemLoading[s.token_code] ? '...' : '✓ Redeem'}
                    </button>
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
