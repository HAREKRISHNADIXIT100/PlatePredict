import { useState, useEffect } from 'react';
import { api } from '../api';

export default function StudentHistory() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('meals');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    api.studentHistory(page)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [page]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading history...</div>;

  const tabs = [
    { key: 'meals', label: 'Meals', count: data.meals.total },
    { key: 'tokens', label: 'Tokens', count: data.tokens.total },
    { key: 'payments', label: 'Payments', count: data.payments.total },
  ];

  return (
    <>
      <div className="page-header">
        <h1>History</h1>
        <p>Your meal, token, and payment records</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'meals' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Items</th>
                <th>Deducted</th>
              </tr>
            </thead>
            <tbody>
              {data.meals.data.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No meal records yet</td></tr>
              ) : (
                data.meals.data.map((m, i) => (
                  <tr key={i}>
                    <td>{new Date(m.date).toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-accent">{m.meal_type}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(m.items || []).join(', ')}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>-₹{m.deduction}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tokens' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Token Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.tokens.data.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No tokens yet</td></tr>
              ) : (
                data.tokens.data.map((t, i) => (
                  <tr key={i}>
                    <td>{t.date ? new Date(t.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td><span className="badge badge-accent">{t.meal_type || '—'}</span></td>
                    <td style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{t.token_code}</td>
                    <td>
                      <span className={`badge ${t.status === 'REDEEMED' ? 'badge-green' : t.status === 'EXPIRED' ? 'badge-red' : 'badge-orange'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.data.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No payments yet</td></tr>
              ) : (
                data.payments.data.map((p, i) => (
                  <tr key={i}>
                    <td>{new Date(p.paid_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>+₹{p.amount.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`badge ${p.status === 'SUCCESS' ? 'badge-green' : p.status === 'PENDING' ? 'badge-orange' : 'badge-red'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-dim)' }}>{p.gateway_ref}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
        <span style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Page {page}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </>
  );
}
