import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerMenus() {
  const [menus, setMenus] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ meal_type: 'LUNCH', items: '', serve_hour: '13', serve_min: '00' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.getMenus(date);
      setMenus(d);
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const serveTime = new Date(date);
      serveTime.setHours(parseInt(form.serve_hour), parseInt(form.serve_min), 0, 0);

      await api.createMenu({
        meal_date: date,
        meal_type: form.meal_type,
        items: form.items.split(',').map((s) => s.trim()).filter(Boolean),
        serve_time: serveTime.toISOString(),
      });
      setMsg('Menu created!');
      setShowForm(false);
      setForm({ meal_type: 'LUNCH', items: '', serve_hour: '13', serve_min: '00' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this menu? This cannot be undone.')) return;
    try {
      await api.deleteMenu(id);
      setMsg('Menu deleted.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const mealOrder = { BREAKFAST: 0, LUNCH: 1, SNACKS: 2, DINNER: 3 };
  const sorted = [...menus].sort((a, b) => (mealOrder[a.meal_type] ?? 9) - (mealOrder[b.meal_type] ?? 9));

  return (
    <>
      <div className="page-header">
        <h1>Menu Management</h1>
        <p>Create and manage daily meal menus</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          id="menu-date"
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Menu'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Meal Type</label>
                <select className="form-input" value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })}>
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="SNACKS">Snacks</option>
                  <option value="DINNER">Dinner</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Serve Time</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" className="form-input" min="0" max="23" value={form.serve_hour} onChange={(e) => setForm({ ...form, serve_hour: e.target.value })} style={{ width: 70 }} />
                  <span style={{ color: 'var(--text-dim)', lineHeight: '42px' }}>:</span>
                  <input type="number" className="form-input" min="0" max="59" value={form.serve_min} onChange={(e) => setForm({ ...form, serve_min: e.target.value })} style={{ width: 70 }} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Items (comma-separated)</label>
              <input type="text" className="form-input" placeholder="Rice, Dal, Paneer, Roti" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Menu'}
            </button>
          </form>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
          No menus for this date. Click "+ New Menu" to create one.
        </div>
      ) : (
        sorted.map((menu) => (
          <div className="meal-card" key={menu.id}>
            <div className="meal-card-header">
              <div className="meal-type">
                {getMealIcon(menu.meal_type)} {menu.meal_type}
                <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  {new Date(menu.serve_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(menu.id)}>Delete</button>
            </div>
            <div className="meal-items">
              {(Array.isArray(menu.items) ? menu.items : []).map((item, i) => (
                <span className="meal-item-tag" key={i}>{item}</span>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMealIcon(type) {
  const icons = { BREAKFAST: '🌅', LUNCH: '☀️', SNACKS: '🍪', DINNER: '🌙' };
  return icons[type] || '🍽️';
}
