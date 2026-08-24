import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import { api } from '../../../lib/api';
import styles from './CareerAdmin.module.css';

const jobTypes = ['Freelance', 'Full Time', 'Internship', 'Part Time', 'Temporary'];

const emptyDraft = { title: '', type: jobTypes[0], location: '', remote: false, description: '' };

export default function CareerAdmin() {
  const [jobs, setJobs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

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
    setDraft(emptyDraft);
    setAdding(false);
  }

  function openEdit(job) {
    setEditing({ ...job });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const updated = await api.patch(`/api/admin/jobs/${editing.id}`, {
        title: editing.title,
        type: editing.type,
        location: editing.location,
        remote: editing.remote,
        description: editing.description,
      });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setEditing(null);
    } finally {
      setSaving(false);
    }
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
              <button className="a-btn a-btn-sm" onClick={() => openEdit(j)}>Edit</button>{' '}
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
          wide
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
          <div>
            <label htmlFor="job-description">
              Full description (shown on the role's public detail page)
            </label>
            <RichTextEditor
              value={draft.description}
              onChange={(html) => setDraft({ ...draft, description: html })}
              minHeight={180}
            />
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit — ${editing.title}`}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <button className="a-btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          }
        >
          <div>
            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="edit-type">Type</label>
            <select
              id="edit-type"
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value })}
            >
              {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-location">Location</label>
            <input
              id="edit-location"
              value={editing.location}
              onChange={(e) => setEditing({ ...editing, location: e.target.value })}
            />
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={editing.remote}
                onChange={(e) => setEditing({ ...editing, remote: e.target.checked })}
              />
              Remote OK
            </label>
          </div>
          <div>
            <label htmlFor="edit-description">
              Full description (shown on the role's public detail page)
            </label>
            <RichTextEditor
              value={editing.description}
              onChange={(html) => setEditing({ ...editing, description: html })}
              minHeight={180}
            />
          </div>
        </Modal>
      )}
    </ProtectedSection>
  );
}
