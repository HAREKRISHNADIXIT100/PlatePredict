import { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const MEAL_ICONS = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  SNACKS: '🍪',
  DINNER: '🌙',
};

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function CountdownTimer({ cutoffTime, locked }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (locked) { setRemaining('Locked'); return; }
    const interval = setInterval(() => {
      const diff = new Date(cutoffTime) - new Date();
      if (diff <= 0) { setRemaining('Locked'); clearInterval(interval); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [cutoffTime, locked]);

  return <span className="countdown">{locked ? '🔒 Locked' : `⏱ ${remaining}`}</span>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pollLoading, setPollLoading] = useState({});

  const load = useCallback(async () => {
    try {
      const d = await api.studentDashboard();
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePoll(menuId, intention) {
    setPollLoading((prev) => ({ ...prev, [menuId]: true }));
    try {
      await api.submitPoll({ menu_id: menuId, intention });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPollLoading((prev) => ({ ...prev, [menuId]: false }));
    }
  }

  async function handlePayment() {
    try {
      const order = await api.initiatePayment();
      if (window.Razorpay) {
        const rzp = new window.Razorpay({
          key: order.gateway_key,
          amount: order.amount_due * 100,
          currency: order.currency,
          order_id: order.order_id,
          name: 'PlatePredict',
          description: 'Mess Advance Fee',
          handler: () => { setTimeout(load, 2000); },
        });
        rzp.open();
      } else {
        alert(`Payment order created: ${order.order_id}\nAmount: ₹${order.amount_due}\n\nIntegrate Razorpay checkout script to complete.`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading dashboard...</div>;

  const { profile, financials, meals_consumed, upcoming_menus, reward_points, no_show_violations } = data;

  const todayStr = new Date().toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  const todayMenus = (upcoming_menus || []).filter(m => new Date(m.serve_time).toDateString() === todayStr);
  const tomorrowMenus = (upcoming_menus || []).filter(m => new Date(m.serve_time).toDateString() === tomorrowStr);

  const renderMealCard = (meal) => (
    <div className="meal-card" key={meal.menu_id}>
      <div className="meal-card-header">
        <div className="meal-type">
          {MEAL_ICONS[meal.meal_type]} {meal.meal_type}
          <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            {formatTime(meal.serve_time)}
          </span>
        </div>
        <CountdownTimer cutoffTime={meal.poll_cutoff_time} locked={meal.poll_locked} />
      </div>

      <div className="meal-items">
        {(Array.isArray(meal.items) ? meal.items : []).map((item, i) => (
          <span className="meal-item-tag" key={i}>{item}</span>
        ))}
      </div>

      <div className="poll-actions">
        <button
          className={`poll-btn ${meal.student_intention === 'YES' ? 'yes-active' : ''}`}
          onClick={() => handlePoll(meal.menu_id, 'YES')}
          disabled={meal.poll_locked || pollLoading[meal.menu_id] || data.on_leave}
        >
          ✓ Eating
        </button>
        <button
          className={`poll-btn ${meal.student_intention === 'NO' ? 'no-active' : ''}`}
          onClick={() => handlePoll(meal.menu_id, 'NO')}
          disabled={meal.poll_locked || pollLoading[meal.menu_id] || data.on_leave}
        >
          ✕ Skipping
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <h1>Good {getGreeting()}, {profile.name?.split(' ')[0]} 👋</h1>
        <p>Here's your mess overview for today</p>
      </div>

      {/* Violation Warning Banner */}
      {no_show_violations > 3 && (
        <div className="alert alert-error" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>⚠️</span>
          <div>
            <strong>Warning!</strong> You have polled "NO" but showed up <strong>{no_show_violations} times</strong> this month (limit: 3). 
            Each additional violation deducts <strong>20 reward points</strong>. Please poll honestly.
          </div>
        </div>
      )}

      {/* Leave Suspended Banner */}
      {data.on_leave ? (
        <div className="alert alert-error" style={{ marginBottom: 24, padding: 24, textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>❌ Account Suspended (On Leave)</h2>
          <p>Your mess account is temporarily suspended due to an active Leave of Absence. You cannot poll for meals or scan your QR code until you return.</p>
        </div>
      ) : (
        /* Attendance QR Code */
        <div className="meal-card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>Your Attendance QR</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Scan this at the mess counter for your meals</p>
          <div style={{ background: 'white', padding: '16px', display: 'inline-block', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
            <QRCode value={JSON.stringify({ student_id: user?.id })} size={160} level="H" />
          </div>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>College / Hostel ID</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>{profile.hostel_id}</div>
          </div>
        </div>
      )}

      {/* Payment Widget */}
      {financials.fee_due_status && (
        <div className="payment-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mess Fee Due</div>
              <div className="payment-amount">₹{financials.amount_due.toLocaleString('en-IN')}</div>
            </div>
            <button className="btn btn-primary" onClick={handlePayment}>Pay Now</button>
          </div>
        </div>
      )}

      {/* Financial & Stats Cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Advance Paid</div>
          <div className="stat-value accent">₹{financials.advance_paid.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className={`stat-value ${financials.current_balance >= 0 ? 'green' : 'red'}`}>
            ₹{financials.current_balance.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Meals Consumed</div>
          <div className="stat-value">{meals_consumed}</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(187, 148, 87, 0.15), rgba(255, 230, 167, 0.08))', border: '1px solid rgba(187, 148, 87, 0.3)' }}>
          <div className="stat-label" style={{ color: '#bb9457' }}>🏆 Reward Points</div>
          <div className="stat-value" style={{ color: '#ffe6a7' }}>{reward_points || 0}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>1 pt = ₹1</div>
        </div>
      </div>

      {/* Today's Menu & Polls */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Today's Meals</h2>
      </div>
      {todayMenus.length === 0 ? (
        <div className="meal-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          No more meals scheduled for today.
        </div>
      ) : (
        todayMenus.map(renderMealCard)
      )}

      {/* Tomorrow's Menu & Polls */}
      <div style={{ marginBottom: 12, marginTop: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Tomorrow's Meals</h2>
      </div>
      {tomorrowMenus.length === 0 ? (
        <div className="meal-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          Tomorrow's menu has not been updated yet.
        </div>
      ) : (
        tomorrowMenus.map(renderMealCard)
      )}

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
