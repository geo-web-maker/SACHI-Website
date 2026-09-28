import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import AutosaveStatus from '../../components/AutosaveStatus/AutosaveStatus';
import { useAutosave } from '../../hooks/useAutosave';
import { useRole } from '../../hooks/useRole';
import { api } from '../../../lib/api';
import styles from './CareerAdmin.module.css';

const jobTypes = ['Freelance', 'Full Time', 'Internship', 'Part Time', 'Temporary'];

const emptyDraft = { title: '', type: jobTypes[0], location: '', remote: false, description: '' };
const addDraftKey = 'sachi-draft:job:new';

export default function CareerAdmin() {
  const { hasAccess } = useRole();
  const canEdit = hasAccess('career', 'edit');

  const [jobs, setJobs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [restorePrompted, setRestorePrompted] = useState(false);

  const [applications, setApplications] = useState([]);

  useEffect(() => {
    api.get('/api/admin/jobs').then(setJobs);
    api.get('/api/admin/jobs/applications').then(setApplications);
  }, []);

  async function toggleStatus(id) {
    const job = jobs.find((j) => j.id === id);
    const nextStatus = job.status === 'Open' ? 'Closed' : 'Open';
    const updated = await api.patch(`/api/admin/jobs/${id}`, { status: nextStatus });
    setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
  }

  async function toggleApplicationStatus(id) {
    const application = applications.find((a) => a.id === id);
    const nextStatus = application.status === 'New' ? 'Reviewed' : 'New';
    const updated = await api.patch(`/api/admin/jobs/applications/${id}`, { status: nextStatus });
    setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  async function addJob() {
    if (!draft.title.trim()) return;
    const created = await api.post('/api/admin/jobs', draft);
    setJobs((prev) => [...prev, created]);
    setDraft(emptyDraft);
    setAdding(false);
    try {
      localStorage.removeItem(addDraftKey);
    } catch {
      /* ignore */
    }
  }

  function openEdit(job) {
    setEditing({ ...job });
    setRestorePrompted(false);
  }

  // Autosave for the edit modal, same fields the manual "Save changes" already
  // sends — just firing on pause/word-count/interval instead of only on click.
  const editKey = editing ? `sachi-draft:job:${editing.id}` : null;
  const autosave = useAutosave({
    key: editKey,
    data: editing,
    enabled: Boolean(editing) && canEdit,
    getWordCountable: (d) => `${d?.title || ''} ${d?.location || ''} ${d?.description || ''}`,
    onSave: async (d) => {
      const updated = await api.patch(`/api/admin/jobs/${d.id}`, {
        title: d.title,
        type: d.type,
        location: d.location,
        remote: d.remote,
        description: d.description,
      });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    },
  });

  useEffect(() => {
    if (!editing || restorePrompted || !canEdit) return;
    setRestorePrompted(true);
    const draft = autosave.restoreLocalDraft();
    if (draft?.data && draft.data.id === editing.id) {
      const draftText = `${draft.data.title || ''}${draft.data.description || ''}`;
      const currentText = `${editing.title || ''}${editing.description || ''}`;
      if (draftText !== currentText) {
        const when = new Date(draft.savedAt).toLocaleTimeString();
        if (confirm(`Found unsaved changes from ${when} for this role that never made it to the server. Restore them?`)) {
          setEditing(draft.data);
        } else {
          autosave.discardLocalDraft();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function saveEdit() {
    setSaving(true);
    try {
      await autosave.flush();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  // No server id exists yet for a role that hasn't been created, so the "add"
  // form only gets a local backup (written on every change) rather than a
  // periodic server autosave — that still covers a crash/power-loss before
  // "Add role" is clicked.
  useEffect(() => {
    if (!adding) return;
    try {
      localStorage.setItem(addDraftKey, JSON.stringify({ data: draft, savedAt: Date.now() }));
    } catch {
      /* ignore */
    }
  }, [draft, adding]);

  useEffect(() => {
    if (!adding) return;
    try {
      const raw = localStorage.getItem(addDraftKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.data?.title?.trim() && confirm('Restore the unfinished new role you were drafting earlier?')) {
        setDraft(saved.data);
      } else {
        localStorage.removeItem(addDraftKey);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);

  return (
    <ProtectedSection section="career" title="Career">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {canEdit
            ? 'Manage the roles shown on the public Career page. Changes autosave as you type.'
            : 'You have view-only access to this section.'}
        </p>
        {canEdit && (
          <button className="a-btn a-btn-primary" onClick={() => setAdding(true)}>+ Add role</button>
        )}
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
              <button className="a-btn a-btn-sm" onClick={() => openEdit(j)}>{canEdit ? 'Edit' : 'View'}</button>{' '}
              {canEdit && (
                <button className="a-btn a-btn-sm" onClick={() => toggleStatus(j.id)}>
                  {j.status === 'Open' ? 'Close role' : 'Reopen'}
                </button>
              )}
            </td>
          </tr>
        )}
      />

      <div className={styles.applicationsHeader}>
        <h2>Applications</h2>
        <p className={styles.hint}>Everyone who's applied through the public Career pages, newest first.</p>
      </div>

      <DataTable
        columns={['Applicant', 'Applying for', 'Contact', 'Submitted', 'Status', '']}
        rows={applications}
        renderRow={(a) => (
          <tr key={a.id}>
            <td className={styles.titleCell}>{a.applicant_name}</td>
            <td>{a.job_title}</td>
            <td className="a-mono">
              <a href={`mailto:${a.applicant_email}`}>{a.applicant_email}</a>
              {a.phone && <><br />{a.phone}</>}
            </td>
            <td className="a-mono">{new Date(a.created_at).toLocaleDateString()}</td>
            <td>
              <span className={`a-badge ${a.status === 'New' ? 'a-badge-success' : 'a-badge-neutral'}`}>
                {a.status}
              </span>
            </td>
            <td>
              <a className="a-btn a-btn-sm" href={a.resume_url} target="_blank" rel="noreferrer">
                View CV
              </a>{' '}
              {canEdit && (
                <button className="a-btn a-btn-sm" onClick={() => toggleApplicationStatus(a.id)}>
                  {a.status === 'New' ? 'Mark reviewed' : 'Mark new'}
                </button>
              )}
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
          <p className={styles.hint}>
            A local backup of this form is kept on this device as you type, in case of a crash
            or power loss before you hit "Add role".
          </p>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`${canEdit ? 'Edit' : 'View'} — ${editing.title}`}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <AutosaveStatus status={canEdit ? autosave.status : null} lastSavedAt={autosave.lastSavedAt} />
              <button className="a-btn" onClick={() => setEditing(null)}>{canEdit ? 'Cancel' : 'Close'}</button>
              {canEdit && (
                <button className="a-btn a-btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </>
          }
        >
          <div>
            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label htmlFor="edit-type">Type</label>
            <select
              id="edit-type"
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value })}
              disabled={!canEdit}
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
              disabled={!canEdit}
            />
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={editing.remote}
                onChange={(e) => setEditing({ ...editing, remote: e.target.checked })}
                disabled={!canEdit}
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
              onChange={(html) => canEdit && setEditing({ ...editing, description: html })}
              minHeight={180}
            />
          </div>
        </Modal>
      )}
    </ProtectedSection>
  );
}
