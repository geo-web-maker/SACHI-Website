import { useEffect, useRef, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import { api } from '../../../lib/api';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { toCsv, parseCsv, downloadFile } from '../../../lib/csv';
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
  const importRef = useRef(null);
  const [importMsg, setImportMsg] = useState('');

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

  function exportCaptions() {
    const rows = [['id', 'caption', 'image_url'], ...photos.map((p) => [p.id, p.caption, p.image_url || ''])];
    downloadFile(`gallery-captions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  async function importCaptions(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg('');
    try {
      const rows = parseCsv(await file.text());
      const header = (rows[0] || []).map((h) => h.trim().toLowerCase());
      const idCol = header.indexOf('id');
      const capCol = header.indexOf('caption');
      if (idCol === -1 || capCol === -1) {
        setImportMsg('Import failed: the CSV needs "id" and "caption" columns (use Export to get a template).');
        return;
      }
      const items = rows.slice(1)
        .map((r) => ({ id: (r[idCol] || '').trim(), caption: r[capCol] ?? '' }))
        .filter((i) => i.id);

      // Drop pending debounced saves so they can't overwrite imported values.
      Object.values(captionTimers.current).forEach(clearTimeout);
      captionTimers.current = {};

      const res = await api.post('/api/admin/gallery/captions/bulk', { items });
      setPhotos(await api.get('/api/gallery'));
      const skipped = res.not_found.length + res.invalid_ids.length;
      setImportMsg(
        `Imported: ${res.updated} updated, ${res.unchanged} unchanged` +
        (skipped ? `, ${skipped} skipped (unknown id)` : '') + '.'
      );
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`);
    }
  }

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
        <button className="a-btn" onClick={exportCaptions} disabled={!photos.length}>Export captions</button>
        {canEdit && (
          <>
            <button className="a-btn" onClick={() => importRef.current?.click()}>Import captions</button>
            <input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={importCaptions} />
            <button className="a-btn a-btn-primary" onClick={addPhoto}>+ Add photo</button>
          </>
        )}
      </div>
      {importMsg && <p className={styles.hint} role="status">{importMsg}</p>}

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
