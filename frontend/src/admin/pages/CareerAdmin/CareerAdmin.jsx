import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { api } from '../../../lib/api';
import styles from './CareerAdmin.module.css';

const jobTypes = ['Freelance', 'Full Time', 'Internship', 'Part Time', 'Temporary'];

export default function CareerAdmin() {
  const [jobs, setJobs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', type: jobTypes[0], location: '', remote: false });

  useEffect(() => {
    api.get('/api/admin/jobs').then(setJobs);
  }, []);

  async function toggleStatus(id) {
    const job = jobs.find((j) => j.id === id);
    const nextStatus = job.status === 'Open' ? 'Closed' : 'Open';
    const updated = await api.patch(`/api/admin/jobs/${id}`, { status: nextStatus });
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  }

  async function addJob() {
    if (!draft.title.trim()) return;
    const created = await api.post('/api/admin/jobs', draft);
    setJobs((prev) => [...prev, created]);
    setDraft({ title: '', type: jobTypes[0], location: '', remote: false });
    setAdding(false);
  }

  return (
    <ProtectedSection section="career" title="Career">
      <div className={styles.toolbar}>
        <p className={styles.hint}>Manage the roles shown on the public Career page.</p>
        <button className="a-btn a-btn-primary" onClick={() => setAdding(true)}>+ Add role</button>
      </div>

      <DataTable
        columns={['Title', 'Type', 'Location', 'Remote', 'Status', '']}
        rows={jobs}
        renderRow={(j) => (
          <tr key={j.id}>
            <td className={styles.titleCell}>{j.title}</td>
            <td className="a-mono">{j.type}</td>
            <td>{j.location}</td>
            <td>{j.remote ? 'Yes' : 'No'}</td>
            <td>
              <span className={`a-badge ${j.status === 'Open' ? 'a-badge-success' : 'a-badge-neutral'}`}>
                {j.status}
              </span>
            </td>
            <td>
              <button className="a-btn a-btn-sm" onClick={() => toggleStatus(j.id)}>
                {j.status === 'Open' ? 'Close role' : 'Reopen'}
              </button>
            </td>
          </tr>
        )}
      />

      {adding && (
        <Modal
          title="Add a new role"
          onClose={() => setAdding(false)}
          footer={
            <>
              <button className="a-btn" onClick={() => setAdding(false)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={addJob}>Add role</button>
            </>
          }
        >
          <div>
            <label htmlFor="job-title">Title</label>
            <input id="job-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label htmlFor="job-type">Type</label>
            <select id="job-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="job-location">Location</label>
            <input id="job-location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.remote}
                onChange={(e) => setDraft({ ...draft, remote: e.target.checked })}
              />
              Remote OK
            </label>
          </div>
        </Modal>
      )}
    </ProtectedSection>
  );
}
