import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { api } from '../../../lib/api';
import styles from './ContactAdmin.module.css';

export default function ContactAdmin() {
  const [messages, setMessages] = useState([]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    api.get('/api/admin/contact').then(setMessages);
  }, []);

  async function openMessage(msg) {
    setViewing(msg);
    if (msg.status === 'New') {
      const updated = await api.patch(`/api/admin/contact/${msg.id}`, { status: 'Read' });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
      setViewing(updated);
    }
  }

  return (
    <ProtectedSection section="contact" title="Contact submissions">
      <p className={styles.hint}>Submissions from the public contact form, newest first.</p>

      <DataTable
        columns={['Name', 'Subject', 'Date', 'Status', '']}
        rows={messages}
        renderRow={(m) => (
          <tr key={m.id}>
            <td className={styles.nameCell}>{m.name}</td>
            <td>{m.subject}</td>
            <td className="a-mono">{new Date(m.created_at).toLocaleDateString()}</td>
            <td>
              <span className={`a-badge ${m.status === 'New' ? 'a-badge-warn' : 'a-badge-neutral'}`}>
                {m.status}
              </span>
            </td>
            <td>
              <button className="a-btn a-btn-sm" onClick={() => openMessage(m)}>View</button>
            </td>
          </tr>
        )}
      />

      {viewing && (
        <Modal title={viewing.subject || '(no subject)'} onClose={() => setViewing(null)}>
          <div className={styles.metaRow}>
            <div><strong>{viewing.name}</strong></div>
            <div className="a-mono">{viewing.email}</div>
            <div className="a-mono">{new Date(viewing.created_at).toLocaleDateString()}</div>
          </div>
          <p className={styles.messageBody}>{viewing.message}</p>
        </Modal>
      )}
    </ProtectedSection>
  );
}
