import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import { api } from '../../../lib/api';
import styles from './GalleryAdmin.module.css';

export default function GalleryAdmin() {
  const [photos, setPhotos] = useState([]);

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

  async function updateCaption(id, caption) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
    await api.patch(`/api/admin/gallery/${id}`, { caption });
  }

  return (
    <ProtectedSection section="gallery" title="Gallery">
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          "Add photo" creates a placeholder record for now — swap in real image upload (e.g.
          Cloudflare R2) once storage is wired up, then set image_url here.
        </p>
        <button className="a-btn a-btn-primary" onClick={addPhoto}>+ Add photo</button>
      </div>

      <div className={styles.grid}>
        {photos.map((p) => (
          <div className={styles.tile} key={p.id}>
            <div className={styles.thumb}>{p.image_url ? <img src={p.image_url} alt={p.caption} /> : '[ photo ]'}</div>
            <input
              className={styles.captionInput}
              value={p.caption}
              onChange={(e) => updateCaption(p.id, e.target.value)}
            />
            <button className={styles.removeBtn} onClick={() => removePhoto(p.id)}>Remove</button>
          </div>
        ))}
      </div>
    </ProtectedSection>
  );
}
