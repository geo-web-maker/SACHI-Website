import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { ROLE_LABELS } from '../../data/roles';
import { api } from '../../../lib/api';
import styles from './UsersAdmin.module.css';

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', role: 'content_manager', password: '' });

  useEffect(() => {
    api.get('/api/admin/users').then(setUsers);
  }, []);

  async function changeRole(id, role) {
    const updated = await api.patch(`/api/admin/users/${id}`, { role });
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }

  async function addUser() {
    if (!draft.name.trim() || !draft.email.trim() || !draft.password.trim()) return;
    const created = await api.post('/api/admin/users', draft);
    setUsers((prev) => [...prev, created]);
    setDraft({ name: '', email: '', role: 'content_manager', password: '' });
    setAdding(false);
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

      <DataTable
        columns={['Name', 'Email', 'Role', '']}
        rows={users}
        renderRow={(u) => (
          <tr key={u.id}>
            <td className={styles.nameCell}>{u.name}</td>
            <td className="a-mono">{u.email}</td>
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
            <label htmlFor="user-password">Temporary password</label>
            <input
              id="user-password"
              type="password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
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
        </Modal>
      )}
    </ProtectedSection>
  );
}
