import { useEffect, useRef, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import { api } from '../../../lib/api';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { useRole } from '../../hooks/useRole';
import styles from './GalleryAdmin.module.css';

// Captions are short, but still typed content — debounce so a caption saves
// shortly after each pause instead of on every keystroke, without needing
// the full useAutosave hook for a single-line field.
const CAPTION_SAVE_DELAY_MS = 900;

export default function GalleryAdmin() {
  const { hasAccess } = useRole();
  const canEdit = hasAccess('gallery', 'edit');

  const [photos, setPhotos] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const captionTimers = useRef({});

  useEffect(() => {
    api.get('/api/gallery').then(setPhotos);
  }, []);

  async function addPhoto() {
    const created = await api.post('/api/admin/gallery', { caption: 'Untitled photo' });
    setPhotos((prev) => [...prev, created]);
  }

  async function removePhoto(id) {
    await api.delete(`/api/admin/gallery/${id}`);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function updateCaption(id, caption) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));

    clearTimeout(captionTimers.current[id]);
    captionTimers.current[id] = setTimeout(() => {
      api.patch(`/api/admin/gallery/${id}`, { caption });
    }, CAPTION_SAVE_DELAY_MS);
  }

  // Flush any pending caption saves immediately if the tab is hidden/closed,
  // so a debounce timer that hasn't fired yet doesn't lose the last edit.
  useEffect(() => {
    function flushAll() {
      Object.entries(captionTimers.current).forEach(([id, timer]) => {
        if (!timer) return;
        clearTimeout(timer);
        const photo = photos.find((p) => String(p.id) === String(id));
        if (photo) api.patch(`/api/admin/gallery/${id}`, { caption: photo.caption });
      });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
    window.addEventListener('pagehide', flushAll);
    return () => window.removeEventListener('pagehide', flushAll);
  }, [photos]);

  async function handleFileChange(id, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const image_url = await uploadToCloudinary(file);
      const updated = await api.patch(`/api/admin/gallery/${id}`, { image_url });
      setPhotos((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  }

  return (
    <ProtectedSection section="gallery" title="Gallery">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {canEdit ? 'Upload a photo, then add a caption.' : 'You have view-only access to this section.'}
        </p>
        {canEdit && (
          <button className="a-btn a-btn-primary" onClick={addPhoto}>+ Add photo</button>
        )}
      </div>

      <div className={styles.grid}>
        {photos.map((p) => (
          <div className={styles.tile} key={p.id}>
            <div className={styles.thumb}>
              {p.image_url ? <img src={p.image_url} alt={p.caption} /> : '[ photo ]'}
            </div>
            {canEdit && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(p.id, e)}
                disabled={uploadingId === p.id}
              />
            )}
            {uploadingId === p.id && <span>Uploading…</span>}
            <input
              className={styles.captionInput}
              value={p.caption}
              onChange={(e) => updateCaption(p.id, e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && (
              <button className={styles.removeBtn} onClick={() => removePhoto(p.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>
    </ProtectedSection>
  );
}
