import { useState } from 'react';
import Modal from '../Modal/Modal';
import PasswordField from '../PasswordField/PasswordField';
import { api } from '../../../lib/api';
import styles from './ChangePasswordGate.module.css';

/**
 * Blocking modal shown whenever the logged-in user's `must_change_password`
 * flag is true (fresh account or after an admin-triggered reset). Not meant
 * to be dismissable — render it instead of the app shell, not on top of it,
 * so there's no route underneath to fall back to.
 *
 * Usage: wherever `user`/`must_change_password` is read after login (e.g.
 * AdminLayout, right after `useRole()` resolves the current user):
 *
 *   if (user?.must_change_password) return <ChangePasswordGate onDone={refreshMe} />;
 *
 * `onDone` should refresh whatever holds the user in memory (a refetch of
 * /api/auth/me, or a context setter). If nothing like that is wired up yet,
 * leave `onDone` unset and it reloads the page, which re-fetches everything
 * from scratch.
 */
export default function ChangePasswordGate({ onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!current) {
      setError('Enter your temporary password.');
      return;
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirmPw) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/auth/change-password', {
        current_password: current,
        new_password: next,
      });
      if (onDone) onDone();
      else window.location.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Set a new password"
      onClose={() => {}} // deliberately a no-op — this gate isn't dismissable
      footer={
        <button className="a-btn a-btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </button>
      }
    >
      <p className={styles.hint}>
        You're signed in with a temporary password. Set a new one to continue —
        you won't be able to use the rest of the admin panel until you do.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div>
        <label htmlFor="cp-current">Temporary password</label>
        <PasswordField
          id="cp-current"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="cp-new">New password</label>
        <PasswordField
          id="cp-new"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="cp-confirm">Confirm new password</label>
        <PasswordField
          id="cp-confirm"
          autoComplete="new-password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
        />
      </div>
    </Modal>
  );
}
