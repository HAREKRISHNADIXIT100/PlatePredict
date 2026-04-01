import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function ManagerDashboard() {
  const [mealData, setMealData] = useState(null);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadMeal = useCallback(async () => {
    try {
      const d = await api.upcomingMeal();
      setMealData(d);
      return d;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    loadMeal().then((d) => {
      if (d?.menu_id) loadAi(d.menu_id);
    });
  }, [loadMeal]);

  async function loadAi(menuId) {
    setAiLoading(true);
    try {
      const d = await api.aiPredict(menuId);
      setAiData(d);
    } catch (err) {
      /* AI might have no data, that's fine */
      setAiData(null);
    } finally {
      setAiLoading(false);
    }
  }

  if (error && !mealData) return <div className="alert alert-error">{error}</div>;
  if (!mealData) return <div style={{ color: 'var(--text-muted)', padding: 40 }}>Loading dashboard...</div>;

  const totalVoted = mealData.votes_yes + mealData.votes_no;
  const yesPercent = mealData.total_students > 0
    ? ((mealData.votes_yes / mealData.total_students) * 100).toFixed(0)
    : 0;

  return (
    <>
      <div className="page-header">
        <h1>Manager Dashboard</h1>
        <p>Pre-meal planning and AI predictions</p>
      </div>

      {/* Next Meal Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Next Meal</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
              {getMealIcon(mealData.meal_type)} {mealData.meal_type}
            </div>
          </div>
          <span className={`badge ${mealData.poll_status === 'LOCKED' ? 'badge-red' : 'badge-green'}`}>
            {mealData.poll_status}
          </span>
        </div>
        <div className="meal-items" style={{ marginBottom: 0 }}>
          {(Array.isArray(mealData.items) ? mealData.items : []).map((item, i) => (
            <span className="meal-item-tag" key={i}>{item}</span>
          ))}
        </div>
      </div>

      {/* Poll Aggregates */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total Students</div>
          <div className="stat-value">{mealData.total_students}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Votes Yes</div>
          <div className="stat-value green">{mealData.votes_yes}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>{yesPercent}% of total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Votes No</div>
          <div className="stat-value red">{mealData.votes_no}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Not Voted</div>
          <div className="stat-value orange">{mealData.votes_pending}</div>
        </div>
      </div>

      {/* AI Prediction Widget */}
      <div className="ai-widget">
        <div className="ai-title">
          ✦ AI Deviation Analysis
          {aiData?.confidence && (
            <span className={`badge ${aiData.confidence === 'HIGH' ? 'badge-green' : aiData.confidence === 'MEDIUM' ? 'badge-orange' : 'badge-red'}`} style={{ marginLeft: 10, fontSize: '0.68rem' }}>
              {aiData.confidence} CONFIDENCE
            </span>
          )}
        </div>

        {aiLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Analyzing patterns...</div>
        ) : aiData ? (
          <>
            <div className="ai-big-number">{aiData.ai_predicted_attendance}</div>
            <div className="ai-recommendation">{aiData.recommendation}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Raw votes: {aiData.raw_yes_votes} → Historical deviation: {aiData.historical_deviation_rate}
            </div>
            <div className="ai-factors">
              <div className="ai-factor">
                <div className="ai-factor-label">Meal+Day Pattern</div>
                <div className="ai-factor-value">{aiData.factors.meal_type_day.deviation}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  {aiData.factors.meal_type_day.weight} weight · {aiData.factors.meal_type_day.samples} samples
                </div>
              </div>
              <div className="ai-factor">
                <div className="ai-factor-label">Menu Similarity</div>
                <div className="ai-factor-value">{aiData.factors.menu_items.deviation}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  {aiData.factors.menu_items.weight} weight · {aiData.factors.menu_items.samples} samples
                </div>
              </div>
              <div className="ai-factor">
                <div className="ai-factor-label">Baseline Avg.</div>
                <div className="ai-factor-value">{aiData.factors.overall_baseline.deviation}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  {aiData.factors.overall_baseline.weight} weight · {aiData.factors.overall_baseline.samples} samples
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>
            Not enough historical data to generate a prediction yet. The model will improve as more meals are served.
          </div>
        )}
      </div>
    </>
  );
}

function getMealIcon(type) {
  const icons = { BREAKFAST: '🌅', LUNCH: '☀️', SNACKS: '🍪', DINNER: '🌙' };
  return icons[type] || '🍽️';
}
