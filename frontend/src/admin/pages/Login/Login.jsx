import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import '../../styles/admin-tokens.css';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useRole();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Something went wrong signing in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`admin-shell ${styles.wrap}`}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          SACHI <span className={styles.brandSub}>admin</span>
        </div>
        <h1>Sign in</h1>
        <p className={styles.lede}>
          Sign in with your admin account. What you can see and edit here is enforced by the
          server based on your role — not by anything in this page.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className="a-btn a-btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
