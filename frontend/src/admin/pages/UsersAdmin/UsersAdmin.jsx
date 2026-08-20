import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { ROLE_LABELS } from '../../data/roles';
import { useRole } from '../../hooks/useRole';
import { api } from '../../../lib/api';
import styles from './UsersAdmin.module.css';

export default function UsersAdmin() {
  const { user: me } = useRole();
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', role: 'content_manager' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // sms-sent confirmations, etc.
  const [resettingId, setResettingId] = useState(null); // id currently mid-reset, for a disabled/loading state

  useEffect(() => {
    api.get('/api/admin/users').then(setUsers);
  }, []);

  async function changeRole(id, role) {
    setError('');
    try {
      const updated = await api.patch(`/api/admin/users/${id}`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function addUser() {
    if (!draft.name.trim() || !draft.email.trim() || !draft.phone.trim()) return;
    setError('');
    setNotice('');
    try {
      const created = await api.post('/api/admin/users', draft);
      setUsers((prev) => [...prev, created]);
      setDraft({ name: '', email: '', phone: '', role: 'content_manager' });
      setAdding(false);
      setNotice(
        created.sms_sent
          ? `Temporary password sent by SMS to ${draft.phone}.`
          : `Admin created, but the SMS didn't go through — check the phone number and use "Reset password" to retry.`
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(id) {
    if (!window.confirm('Remove this admin? This cannot be undone.')) return;
    setError('');
    try {
      await api.delete(`/api/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(u) {
    if (!window.confirm(`Text a new temporary password to ${u.name} at ${u.phone || '(no phone on file)'}?`)) return;
    setError('');
    setNotice('');
    setResettingId(u.id);
    try {
      const result = await api.patch(`/api/admin/users/${u.id}/password`);
      setNotice(
        result.sms_sent
          ? `New temporary password sent by SMS to ${u.phone}.`
          : `Password reset, but the SMS didn't go through — check the phone number and try again.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <ProtectedSection section="users" title="Admin users">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          Assign each admin a role — the sidebar and page access they get is enforced by the
          server based on this, on every request. New admins and password resets get a temporary
          password sent by SMS, and are required to set a new one on first login.
        </p>
        <button className="a-btn a-btn-primary" onClick={() => setAdding(true)}>+ Add admin</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <DataTable
        columns={['Name', 'Email', 'Phone', 'Role', 'Actions']}
        rows={users}
        renderRow={(u) => (
          <tr key={u.id}>
            <td className={styles.nameCell}>{u.name}</td>
            <td className="a-mono">{u.email}</td>
            <td className="a-mono">{u.phone || '—'}</td>
            <td>
              <select
                className={styles.roleSelect}
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value)}
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </td>
            <td className={styles.actionsCell}>
              <button className="a-btn" onClick={() => resetPassword(u)} disabled={resettingId === u.id}>
                {resettingId === u.id ? 'Sending…' : 'Reset password'}
              </button>
              <button
                className="a-btn a-btn-danger"
                onClick={() => removeUser(u.id)}
                disabled={u.id === me?.id}
                title={u.id === me?.id ? "You can't remove your own account" : undefined}
              >
                Remove
              </button>
            </td>
          </tr>
        )}
      />

      {adding && (
        <Modal
          title="Add a new admin"
          onClose={() => setAdding(false)}
          footer={
            <>
              <button className="a-btn" onClick={() => setAdding(false)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={addUser}>Add admin</button>
            </>
          }
        >
          <div>
            <label htmlFor="user-name">Name</label>
            <input id="user-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="user-email">Email</label>
            <input id="user-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="user-phone">Phone number</label>
            <input
              id="user-phone"
              type="tel"
              placeholder="+2567XXXXXXXX"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="user-role">Role</label>
            <select id="user-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <p className={styles.hint}>
            A temporary password is generated automatically and sent to this number by SMS —
            they'll be asked to set a new one the first time they sign in.
          </p>
        </Modal>
      )}
    </ProtectedSection>
  );
}
