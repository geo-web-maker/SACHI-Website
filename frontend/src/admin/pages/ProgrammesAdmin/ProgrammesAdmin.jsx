import { useEffect, useState } from 'react';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import { api } from '../../../lib/api';
import styles from './ProgrammesAdmin.module.css';

function toDraft(p) {
  return {
    ...p,
    teaserDraft: p.teaser,
    bodyDraft: p.body.join('\n\n'),
    imagesDraft: p.images.map((img) => ({ ...img })),
  };
}

export default function ProgrammesAdmin() {
  const [programmes, setProgrammes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImgId, setUploadingImgId] = useState(null);

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

  async function saveEdit() {
    const body = editing.bodyDraft
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const updated = await api.patch(`/api/admin/programmes/${editing.slug}`, {
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

  return (
    <ProtectedSection section="programmes" title="Programmes">
      <div className={styles.toolbar}>
        <p className={styles.hint}>Changes here save immediately to the database.</p>
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
