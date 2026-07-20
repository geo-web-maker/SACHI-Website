import { useEffect, useState } from 'react';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { api } from '../../../lib/api';
import { PROGRAMME_ICONS, PROGRAMME_ICON_NAMES } from '../../../data/programmeIcons';
import styles from './ProgrammesAdmin.module.css';

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
    bodyDraft: p.body.join('\n\n'),
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
  const [programmes, setProgrammes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImgId, setUploadingImgId] = useState(null);

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyDraft);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    api.get('/api/programmes').then(setProgrammes);
  }, []);

  function openEdit(p) {
    setEditing(toDraft(p));
  }

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
    const body = editing.bodyDraft
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const updated = await api.patch(`/api/admin/programmes/${editing.slug}`, {
        icon: editing.icon,
        teaser: editing.teaserDraft,
        body,
        images: editing.imagesDraft,
      });
      setProgrammes((prev) => prev.map((p) => (p.slug === updated.slug ? updated : p)));
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

    const body = createDraft.body
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean);

    if (body.length === 0) {
      setCreateError('Add at least one paragraph of body content.');
      return;
    }

    setCreateSaving(true);
    try {
      const created = await api.post('/api/admin/programmes', {
        slug: createDraft.slug.trim(),
        icon: createDraft.icon,
        title: createDraft.title.trim(),
        teaser: createDraft.teaser.trim() || body[0],
        body,
        images: [],
      });
      setProgrammes((prev) => [...prev, created]);
      setCreating(false);
    } catch (err) {
      setCreateError(err.message || 'Something went wrong creating that programme.');
    } finally {
      setCreateSaving(false);
    }
  }

  const SelectedIcon = PROGRAMME_ICONS[createDraft.icon];
  const EditingIcon = editing ? PROGRAMME_ICONS[editing.icon] : null;

  return (
    <ProtectedSection section="programmes" title="Programmes">
      <div className={styles.toolbar}>
        <p className={styles.hint}>Changes here save immediately to the database.</p>
        <button className="a-btn a-btn-primary" onClick={openCreate}>+ Add programme</button>
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
              <button className="a-btn a-btn-sm" onClick={() => openEdit(p)}>Edit</button>
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
            <label htmlFor="new-teaser">Teaser (shown on the Programmes overview — optional, defaults to first paragraph)</label>
            <textarea
              id="new-teaser"
              rows={2}
              value={createDraft.teaser}
              onChange={(e) => updateCreateField('teaser', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="new-body">
              Full content (detail page — separate paragraphs with a blank line)
            </label>
            <textarea
              id="new-body"
              rows={8}
              value={createDraft.body}
              onChange={(e) => updateCreateField('body', e.target.value)}
            />
          </div>

          {createError && <p className={styles.error}>{createError}</p>}

          <p className={styles.hint}>
            Photos and the programme number are set automatically — photos can be added after creating the programme, from its Edit screen.
          </p>
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
            <label htmlFor="edit-icon">Icon</label>
            <div className={styles.iconPickerRow}>
              <select
                id="edit-icon"
                value={editing.icon}
                onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
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
            <textarea
              id="teaser"
              rows={3}
              value={editing.teaserDraft}
              onChange={(e) => setEditing({ ...editing, teaserDraft: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="body">
              Full content (detail page — separate paragraphs with a blank line)
            </label>
            <textarea
              id="body"
              rows={10}
              value={editing.bodyDraft}
              onChange={(e) => setEditing({ ...editing, bodyDraft: e.target.value })}
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
                    disabled={uploadingImgId === img.id}
                  />
                  <input
                    value={img.caption}
                    onChange={(e) => updateImageCaption(img.id, e.target.value)}
                  />
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
                </div>
              ))}
            </div>
            <button className="a-btn a-btn-sm" onClick={addImage} style={{ marginTop: '10px' }}>
              + Add photo
            </button>
          </div>
        </Modal>
      )}
    </ProtectedSection>
  );
}
