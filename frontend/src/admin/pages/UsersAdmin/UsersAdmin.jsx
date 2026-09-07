import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { ROLE_LABELS } from '../../data/roles';
import { api } from '../../../lib/api';
import { useRole } from '../../hooks/useRole';
import styles from './UsersAdmin.module.css';

export default function UsersAdmin() {
  const { user: me } = useRole();
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '', role: 'content_manager' });
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState(null); // { name, sms_sent, temp_password } | null

  useEffect(() => {
    api.get('/api/admin/users').then(setUsers);
  }, []);

  async function changeRole(id, role) {
    const updated = await api.patch(`/api/admin/users/${id}`, { role });
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }

  async function savePhone(u, phone) {
    const trimmed = phone.trim();
    if (trimmed === u.phone) return; // unchanged, skip the request
    setError('');
    try {
      const updated = await api.patch(`/api/admin/users/${u.id}`, { phone: trimmed });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function addUser() {
    if (!draft.name.trim() || !draft.email.trim() || !draft.phone.trim()) return;
    setError('');
    try {
      const { sms_sent, temp_password, ...created } = await api.post('/api/admin/users', draft);
      setUsers((prev) => [...prev, created]);
      setDraft({ name: '', email: '', phone: '', role: 'content_manager' });
      setAdding(false);
      setDelivery({ name: created.name, sms_sent, temp_password });
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetPassword(u) {
    if (!confirm(`Reset ${u.name}'s password? Their current password stops working immediately.`)) return;
    setError('');
    setBusyId(u.id);
    try {
      const { sms_sent, temp_password } = await api.post(`/api/admin/users/${u.id}/reset-password`);
      setDelivery({ name: u.name, sms_sent, temp_password });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(u) {
    const action = u.is_active ? 'disable' : 'enable';
    if (u.is_active && !confirm(`Disable ${u.name}? They'll be signed out and can't log back in until re-enabled.`)) return;
    setError('');
    setBusyId(u.id);
    try {
      const updated = await api.post(`/api/admin/users/${u.id}/${action}`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(u) {
    if (!confirm(`Permanently delete ${u.name}? This can't be undone — consider Disable instead if you might want them back.`)) return;
    setError('');
    setBusyId(u.id);
    try {
      await api.delete(`/api/admin/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  }

  return (
    <ProtectedSection section="users" title="Admin users">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          Assign each admin a role — the sidebar and page access they get is enforced by the
          server based on this, on every request. This page itself is only reachable by
          super_admins.
        </p>
        <button className="a-btn a-btn-primary" onClick={() => setAdding(true)}>+ Add admin</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <DataTable
        columns={['Name', 'Email', 'Phone', 'Role', 'Status', '']}
        rows={users}
        renderRow={(u) => {
          const isSelf = u.id === me?.id;
          const disabled = busyId === u.id;
          return (
            <tr key={u.id}>
              <td className={styles.nameCell}>{u.name}{isSelf && <span className={styles.youTag}> (you)</span>}</td>
              <td className="a-mono">{u.email}</td>
              <td>
                <input
                  key={u.id + u.phone}
                  className={styles.phoneInput}
                  type="tel"
                  defaultValue={u.phone}
                  placeholder="+2567..."
                  onBlur={(e) => savePhone(u, e.target.value)}
                  disabled={disabled}
                />
              </td>
              <td>
                <select
                  className={styles.roleSelect}
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  disabled={disabled}
                >
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </td>
              <td>
                <span className={`a-badge ${u.is_active ? 'a-badge-success' : 'a-badge-warn'}`}>
                  {u.is_active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td className={styles.actionsCell}>
                <button
                  className="a-btn a-btn-sm"
                  onClick={() => resetPassword(u)}
                  disabled={disabled}
                >
                  Reset password
                </button>
                <button
                  className="a-btn a-btn-sm"
                  onClick={() => toggleActive(u)}
                  disabled={disabled || isSelf}
                  title={isSelf ? "You can't disable your own account" : undefined}
                >
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  className={`a-btn a-btn-sm ${styles.deleteBtn}`}
                  onClick={() => deleteUser(u)}
                  disabled={disabled || isSelf}
                  title={isSelf ? "You can't delete your own account" : undefined}
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        }}
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
              placeholder="+2567..."
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
            <p className={styles.hint}>Their first temporary password is generated and sent here by SMS.</p>
          </div>
          <div>
            <label htmlFor="user-role">Role</label>
            <select id="user-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </Modal>
      )}

      {delivery && (
        <Modal
          title={delivery.sms_sent ? `Temporary password sent to ${delivery.name}` : `Couldn't SMS ${delivery.name}`}
          onClose={() => setDelivery(null)}
          footer={<button className="a-btn a-btn-primary" onClick={() => setDelivery(null)}>Done</button>}
        >
          {delivery.sms_sent ? (
            <p className={styles.hint}>
              A new temporary password was texted to {delivery.name}'s phone. They'll be asked to set
              a new password when they sign in.
            </p>
          ) : (
            <>
              <p className={styles.hint}>
                The password was set, but the SMS didn't go through — check their phone number is
                correct. Here it is to relay yourself; it's shown once and isn't stored anywhere
                retrievable.
              </p>
              <code className={styles.tempPassword}>{delivery.temp_password}</code>
            </>
          )}
        </Modal>
      )}
    </ProtectedSection>
  );
}
