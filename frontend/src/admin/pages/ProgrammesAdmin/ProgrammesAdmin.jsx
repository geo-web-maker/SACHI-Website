import { useEffect, useState } from 'react';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import AutosaveStatus from '../../components/AutosaveStatus/AutosaveStatus';
import { useAutosave } from '../../hooks/useAutosave';
import { useRole } from '../../hooks/useRole';
import { api } from '../../../lib/api';
import { PROGRAMME_ICONS, PROGRAMME_ICON_NAMES } from '../../../data/programmeIcons';
import styles from './ProgrammesAdmin.module.css';

// Tiptap's "empty" content is <p></p>, not '' — treat both as blank.
function isBlankHtml(html) {
  return !html || html.trim() === '' || html.trim() === '<p></p>';
}

const emptyDraft = {
  slug: '',
  icon: '',
  title: '',
  teaser: '',
  body: '',
};

function toDraft(p) {
  return {
    ...p,
    teaserDraft: p.teaser,
    bodyDraft: p.body,
    imagesDraft: p.images.map((img) => ({ ...img })),
  };
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ProgrammesAdmin() {
  const { hasAccess } = useRole();
  const canEdit = hasAccess('programmes', 'edit');

  const [programmes, setProgrammes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImgId, setUploadingImgId] = useState(null);
  const [restorePrompted, setRestorePrompted] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyDraft);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    api.get('/api/programmes').then(setProgrammes);
  }, []);

  function openEdit(p) {
    setEditing(toDraft(p));
    setRestorePrompted(false);
  }

  // Autosave for the edit modal — patches the same fields the manual "Save
  // changes" button already sends, so it's just the same PATCH firing more
  // often (per keystroke pause/word-count/interval) instead of only on click.
  const editKey = editing ? `sachi-draft:programme:${editing.slug}` : null;
  const autosave = useAutosave({
    key: editKey,
    data: editing,
    enabled: Boolean(editing) && canEdit,
    getWordCountable: (d) => `${d?.teaserDraft || ''} ${d?.bodyDraft || ''}`,
    onSave: async (d) => {
      const updated = await api.patch(`/api/admin/programmes/${d.slug}`, {
        icon: d.icon,
        teaser: d.teaserDraft,
        body: d.bodyDraft,
        images: d.imagesDraft,
      });
      setProgrammes((prev) => prev.map((p) => (p.slug === updated.slug ? updated : p)));
    },
  });

  // If a local draft exists from a session that never got to save (e.g. the
  // power cut before the autosave could reach the server), offer to restore it
  // as soon as the edit modal opens for that programme.
  useEffect(() => {
    if (!editing || restorePrompted || !canEdit) return;
    setRestorePrompted(true);
    const draft = autosave.restoreLocalDraft();
    if (draft?.data && draft.data.slug === editing.slug) {
      const draftText = `${draft.data.teaserDraft || ''}${draft.data.bodyDraft || ''}`;
      const currentText = `${editing.teaserDraft || ''}${editing.bodyDraft || ''}`;
      if (draftText !== currentText) {
        const when = new Date(draft.savedAt).toLocaleTimeString();
        if (confirm(`Found unsaved changes from ${when} for this programme that never made it to the server. Restore them?`)) {
          setEditing(draft.data);
        } else {
          autosave.discardLocalDraft();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function updateImageCaption(id, caption) {
    setEditing((prev) => ({
      ...prev,
      imagesDraft: prev.imagesDraft.map((img) => (img.id === id ? { ...img, caption } : img)),
    }));
  }

  function addImage() {
    setEditing((prev) => ({
      ...prev,
      imagesDraft: [...prev.imagesDraft, { id: `${prev.slug}-${Date.now()}`, caption: 'Untitled photo' }],
    }));
  }

  function removeImage(id) {
    setEditing((prev) => ({
      ...prev,
      imagesDraft: prev.imagesDraft.filter((img) => img.id !== id),
    }));
  }

  function moveImage(id, delta) {
    setEditing((prev) => {
      const images = [...prev.imagesDraft];
      const i = images.findIndex((img) => img.id === id);
      const j = i + delta;
      if (j < 0 || j >= images.length) return prev;
      [images[i], images[j]] = [images[j], images[i]];
      return { ...prev, imagesDraft: images };
    });
  }

  async function handleImageUpload(id, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImgId(id);
    try {
      const image_url = await uploadToCloudinary(file);
      setEditing((prev) => ({
        ...prev,
        imagesDraft: prev.imagesDraft.map((img) => (img.id === id ? { ...img, image_url } : img)),
      }));
    } finally {
      setUploadingImgId(null);
      e.target.value = '';
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await autosave.flush();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setCreateDraft(emptyDraft);
    setCreateError('');
    setCreating(true);
  }

  function updateCreateField(field, value) {
    setCreateDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !prev.slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  async function submitCreate() {
    setCreateError('');

    if (!createDraft.title.trim() || !createDraft.slug.trim() || !createDraft.icon) {
      setCreateError('Title, slug, and icon are all required.');
      return;
    }

    if (isBlankHtml(createDraft.body)) {
      setCreateError('Add some body content.');
      return;
    }

    setCreateSaving(true);
    try {
      const created = await api.post('/api/admin/programmes', {
        slug: createDraft.slug.trim(),
        icon: createDraft.icon,
        title: createDraft.title.trim(),
        teaser: isBlankHtml(createDraft.teaser) ? createDraft.body : createDraft.teaser,
        body: createDraft.body,
        images: [],
      });
      setProgrammes((prev) => [...prev, created]);
      setCreating(false);
      discardCreateDraft();
    } catch (err) {
      setCreateError(err.message || 'Something went wrong creating that programme.');
    } finally {
      setCreateSaving(false);
    }
  }

  // The create form has no server-side id to autosave against yet (nothing to
  // PATCH until "Create programme" is clicked) — so this only keeps a local
  // backup, written on every change, so a crash/power-loss before submitting
  // doesn't lose a half-written new programme either.
  const createDraftKey = 'sachi-draft:programme:new';
  useEffect(() => {
    if (!creating) return;
    try {
      localStorage.setItem(createDraftKey, JSON.stringify({ data: createDraft, savedAt: Date.now() }));
    } catch {
      /* ignore */
    }
  }, [createDraft, creating]);

  function discardCreateDraft() {
    try {
      localStorage.removeItem(createDraftKey);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!creating) return;
    try {
      const raw = localStorage.getItem(createDraftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.data && !isBlankHtml(draft.data.body) && confirm('Restore the unfinished new programme you were drafting earlier?')) {
        setCreateDraft(draft.data);
      } else {
        discardCreateDraft();
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating]);

  const SelectedIcon = PROGRAMME_ICONS[createDraft.icon];
  const EditingIcon = editing ? PROGRAMME_ICONS[editing.icon] : null;

  return (
    <ProtectedSection section="programmes" title="Programmes">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {canEdit
            ? 'Changes here save automatically as you type, and immediately on "Save changes".'
            : 'You have view-only access to this section.'}
        </p>
        {canEdit && (
          <button className="a-btn a-btn-primary" onClick={openCreate}>+ Add programme</button>
        )}
      </div>

      <DataTable
        columns={['#', 'Title', 'Teaser', 'Photos', '']}
        rows={programmes}
        renderRow={(p) => (
          <tr key={p.slug}>
            <td className="a-mono">{p.num}</td>
            <td className={styles.titleCell}>{p.title}</td>
            <td className={styles.teaserCell}>{p.teaser}</td>
            <td className="a-mono">{p.images.length}</td>
            <td>
              <button className="a-btn a-btn-sm" onClick={() => openEdit(p)}>
                {canEdit ? 'Edit' : 'View'}
              </button>
            </td>
          </tr>
        )}
      />

      {creating && (
        <Modal
          title="Add a new programme"
          onClose={() => setCreating(false)}
          wide
          footer={
            <>
              <button className="a-btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="a-btn a-btn-primary" onClick={submitCreate} disabled={createSaving}>
                {createSaving ? 'Creating…' : 'Create programme'}
              </button>
            </>
          }
        >
          <div>
            <label htmlFor="new-title">Title</label>
            <input
              id="new-title"
              value={createDraft.title}
              onChange={(e) => updateCreateField('title', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="new-slug">Slug (used in the URL — /programmes/&lt;slug&gt;)</label>
            <input
              id="new-slug"
              value={createDraft.slug}
              onChange={(e) => {
                setCreateDraft((prev) => ({ ...prev, slugTouched: true }));
                updateCreateField('slug', slugify(e.target.value));
              }}
            />
          </div>

          <div>
            <label htmlFor="new-icon">Icon</label>
            <div className={styles.iconPickerRow}>
              <select
                id="new-icon"
                value={createDraft.icon}
                onChange={(e) => updateCreateField('icon', e.target.value)}
              >
                <option value="">Select an icon…</option>
                {PROGRAMME_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className={styles.iconPreview}>
                {SelectedIcon ? <SelectedIcon size={22} strokeWidth={1.75} /> : '—'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="new-teaser">Teaser (shown on the Programmes overview — optional, defaults to the body)</label>
            <RichTextEditor
              value={createDraft.teaser}
              onChange={(html) => updateCreateField('teaser', html)}
              minHeight={80}
            />
          </div>

          <div>
            <label htmlFor="new-body">Full content (shown on the programme's detail page)</label>
            <RichTextEditor
              value={createDraft.body}
              onChange={(html) => updateCreateField('body', html)}
              minHeight={220}
            />
          </div>

          {createError && <p className={styles.error}>{createError}</p>}

          <p className={styles.hint}>
            A local backup of this form is kept on this device as you type, in case of a crash
            or power loss before you hit "Create programme". Photos and the programme number
            are set automatically — photos can be added after creating the programme, from its
            Edit screen.
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
            <label htmlFor="edit-icon">Icon</label>
            <div className={styles.iconPickerRow}>
              <select
                id="edit-icon"
                value={editing.icon}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                disabled={!canEdit}
              >
                <option value="">Select an icon…</option>
                {PROGRAMME_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className={styles.iconPreview}>
                {EditingIcon ? <EditingIcon size={22} strokeWidth={1.75} /> : '—'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="teaser">Teaser (shown on the Programmes overview)</label>
            <RichTextEditor
              value={editing.teaserDraft}
              onChange={(html) => canEdit && setEditing({ ...editing, teaserDraft: html })}
              minHeight={90}
            />
          </div>

          <div>
            <label htmlFor="body">Full content (shown on the programme's detail page)</label>
            <RichTextEditor
              value={editing.bodyDraft}
              onChange={(html) => canEdit && setEditing({ ...editing, bodyDraft: html })}
              minHeight={260}
            />
          </div>

          <div>
            <label>Photos (used in both the header and gallery slideshow)</label>
            <div className={styles.imageList}>
              {editing.imagesDraft.map((img, i) => (
                <div className={styles.imageRow} key={img.id}>
                  <div className={styles.imageThumb}>
                    {img.image_url ? <img src={img.image_url} alt={img.caption} /> : '[ photo ]'}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(img.id, e)}
                    disabled={!canEdit || uploadingImgId === img.id}
                  />
                  <input
                    value={img.caption}
                    onChange={(e) => updateImageCaption(img.id, e.target.value)}
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <div className={styles.imageActions}>
                      <button
                        className="a-btn a-btn-sm"
                        disabled={i === 0}
                        onClick={() => moveImage(img.id, -1)}
                        aria-label="Move up"
                      >
                        &uarr;
                      </button>
                      <button
                        className="a-btn a-btn-sm"
                        disabled={i === editing.imagesDraft.length - 1}
                        onClick={() => moveImage(img.id, 1)}
                        aria-label="Move down"
                      >
                        &darr;
                      </button>
                      <button
                        className={`a-btn a-btn-sm ${styles.removeBtn}`}
                        onClick={() => removeImage(img.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <button className="a-btn a-btn-sm" onClick={addImage} style={{ marginTop: '10px' }}>
                + Add photo
              </button>
            )}
          </div>
        </Modal>
      )}
    </ProtectedSection>
  );
}
