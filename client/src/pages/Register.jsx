import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', hostel_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(form);
      navigate('/verify-otp', {
        state: { email: form.email, pending_token: data.pending_token },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">Plate<span>Predict</span></div>
        <h1>Create Account</h1>
        <p className="subtitle">Register with your college email</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input id="register-name" type="text" className="form-input" placeholder="Rahul Kumar" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">College Email</label>
            <input id="register-email" type="email" className="form-input" placeholder="rahul.k@college.edu" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Hostel ID</label>
            <input id="register-hostel" type="text" className="form-input" placeholder="H-Block-B" value={form.hostel_id} onChange={(e) => update('hostel_id', e.target.value)} required />
          </div>
          <button id="register-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Sending OTP...' : 'Send Verification Code'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
