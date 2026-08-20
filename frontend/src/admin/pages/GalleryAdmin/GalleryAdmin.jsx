import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import { api } from '../../../lib/api';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import styles from './GalleryAdmin.module.css';

export default function GalleryAdmin() {
  const [photos, setPhotos] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

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
        <p className={styles.hint}>Upload a photo, then add a caption.</p>
        <button className="a-btn a-btn-primary" onClick={addPhoto}>+ Add photo</button>
      </div>

      <div className={styles.grid}>
        {photos.map((p) => (
          <div className={styles.tile} key={p.id}>
            <div className={styles.thumb}>
              {p.image_url ? <img src={p.image_url} alt={p.caption} /> : '[ photo ]'}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(p.id, e)}
              disabled={uploadingId === p.id}
            />
            {uploadingId === p.id && <span>Uploading…</span>}
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
