import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const pendingToken = location.state?.pending_token || '';

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.verifyOtp({
        email,
        otp_code: otp,
        password,
        pending_token: pendingToken,
      });
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Session Expired</h1>
          <p className="subtitle" style={{ marginBottom: 20 }}>Please start the registration process again.</p>
          <Link to="/register" className="btn btn-primary">Go to Register</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">Plate<span>Predict</span></div>
        <h1>Verify Email</h1>
        <p className="subtitle">Enter the 6-digit code sent to {email}</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">OTP Code</label>
            <input id="otp-code" type="text" className="form-input" placeholder="000000" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: 700 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Set Password</label>
            <input id="otp-password" type="password" className="form-input" placeholder="Min 8 chars, 1 uppercase, 1 number" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button id="otp-submit" type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !!success}>
            {loading ? 'Verifying...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
