import { useState } from 'react';
import { useRole } from '../../hooks/useRole';
import { api } from '../../../lib/api';
import '../../styles/admin-tokens.css';
import styles from '../../pages/Login/Login.module.css';

export default function ForceChangePassword() {
  const { refreshMe } = useRole();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/auth/change-password', { old_password: oldPassword, new_password: newPassword });
      await refreshMe();
    } catch (err) {
      setError(err.message || 'Something went wrong changing your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          SACHI <span className={styles.brandSub}>admin</span>
        </div>
        <h1>Set a new password</h1>
        <p className={styles.lede}>
          You signed in with a temporary password sent by SMS. Set a permanent one before continuing —
          you won't be able to use the admin panel until this is done.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="old-password">Temporary password</label>
            <input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className="a-btn a-btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Setting password…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
