import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

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

  const { profile, financials, meals_consumed, today_menu } = data;

  return (
    <>
      <div className="page-header">
        <h1>Good {getGreeting()}, {profile.name?.split(' ')[0]} 👋</h1>
        <p>Here's your mess overview for today</p>
      </div>

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

      {/* Financial Cards */}
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
      </div>

      {/* Today's Menu & Polls */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Today's Meals</h2>
      </div>

      {today_menu.map((meal) => (
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
              disabled={meal.poll_locked || pollLoading[meal.menu_id]}
            >
              ✓ Eating
            </button>
            <button
              className={`poll-btn ${meal.student_intention === 'NO' ? 'no-active' : ''}`}
              onClick={() => handlePoll(meal.menu_id, 'NO')}
              disabled={meal.poll_locked || pollLoading[meal.menu_id]}
            >
              ✕ Skipping
            </button>
          </div>

          {/* Show snack token if voted NO */}
          {meal.snack_token && meal.snack_token.status === 'ISSUED' && (
            <div className="token-display">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>SNACK TOKEN</div>
              <div className="token-code">{meal.snack_token.token_code}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 6 }}>Show this to the mess counter</div>
            </div>
          )}
        </div>
      ))}

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
