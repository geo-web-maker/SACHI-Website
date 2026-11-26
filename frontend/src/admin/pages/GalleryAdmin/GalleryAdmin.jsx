import { useEffect, useRef, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import { api } from '../../../lib/api';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import JSZip from 'jszip';
import { toCsv, parseCsv, downloadFile, readCsvBundle, findZipFile } from '../../../lib/csv';
import { sha256Hex, downloadBlob, lookupKnownImages, isAbsoluteUrl, findZipEntry } from '../../../lib/media';
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
  const zipRef = useRef(null);
  const [busy, setBusy] = useState('');
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

  // ── Full export / import (ZIP: gallery.json + captions.csv + the real image files) ──
  async function exportZip() {
    setBusy('Preparing export…');
    try {
      downloadBlob(`sachi-gallery-${new Date().toISOString().slice(0, 10)}.zip`, await api.blob('/api/admin/gallery/export.zip'));
    } catch (err) {
      setImportMsg(`Export failed: ${err.message}`);
    } finally {
      setBusy('');
    }
  }

  async function importZip(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg('');
    try {
      setBusy('Reading ZIP…');
      const zip = await JSZip.loadAsync(file);
      const jsonEntry = Object.values(zip.files).find((f) => !f.dir && f.name.replace(/^[^/]+\//, '') === 'gallery.json');
      if (!jsonEntry) throw new Error('No gallery.json found inside the ZIP (use a ZIP made by Export).');
      const parsed = JSON.parse(await jsonEntry.async('string'));
      const items = (Array.isArray(parsed) ? parsed : parsed.photos ?? []).map((p) => ({
        caption: p.caption ?? '', image_url: p.image_url || null, sha256: p.sha256 || null,
      }));
      if (!items.length) throw new Error('gallery.json contains no photos.');

      // Hash each image file, then ask the server which pictures it already has.
      const local = [];
      for (const it of items) {
        if (!it.image_url || isAbsoluteUrl(it.image_url)) continue;
        const entry = findZipEntry(zip, it.image_url);
        if (!entry) { it.image_url = null; continue; }
        const blob = await entry.async('blob');
        it.sha256 = await sha256Hex(blob);
        local.push({ it, blob, name: it.image_url.split('/').pop() });
      }
      setBusy('Checking which photos are already in the gallery…');
      const known = await lookupKnownImages(local.map((l) => l.it.sha256));
      const fresh = new Set(local.filter((l) => !known[l.it.sha256]).map((l) => l.it.sha256));
      if (!confirm(
        `${items.length} photo(s) in the file.\n` +
        `${local.length - fresh.size} already in the system (captions will be updated, nothing re-uploaded).\n` +
        `${fresh.size} new picture(s) will be uploaded.\nContinue?`
      )) return;

      const uploaded = {};
      let n = 0;
      for (const l of local) {
        if (known[l.it.sha256]) { l.it.image_url = known[l.it.sha256]; continue; }
        if (!uploaded[l.it.sha256]) {
          setBusy(`Uploading ${++n} of ${fresh.size}…`);
          uploaded[l.it.sha256] = await uploadToCloudinary(new File([l.blob], l.name, { type: l.blob.type || 'image/jpeg' }));
        }
        l.it.image_url = uploaded[l.it.sha256];
      }

      Object.values(captionTimers.current).forEach(clearTimeout);
      captionTimers.current = {};
      const res = await api.post('/api/admin/gallery/import', { items });
      setPhotos(await api.get('/api/gallery'));
      setImportMsg(`Imported: ${res.created} added, ${res.updated} caption(s) updated, ${res.unchanged} unchanged.`);
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`);
    } finally {
      setBusy('');
    }
  }

  function exportCaptions() {
    const rows = [['id', 'caption', 'image_url'], ...photos.map((p) => [p.id, p.caption, p.image_url || ''])];
    downloadFile(`gallery-captions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  // CSV columns: id (required column; blank cell = new photo), caption, and an
  // optional "image" column holding a path inside the ZIP or an https:// URL.
  async function importCaptions(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportMsg('');
    try {
      const { text, zip } = await readCsvBundle(file);
      const rows = parseCsv(text);
      const header = (rows[0] || []).map((h) => h.trim().toLowerCase());
      const idCol = header.indexOf('id');
      const capCol = header.indexOf('caption');
      const imgCol = header.indexOf('image');
      if (idCol === -1 || capCol === -1) {
        setImportMsg('Import failed: the CSV needs "id" and "caption" columns (use Export to get a template; "image" is optional).');
        return;
      }
      const items = rows.slice(1)
        .map((r) => ({
          id: (r[idCol] || '').trim(),
          caption: r[capCol] ?? '',
          image: imgCol === -1 ? '' : (r[imgCol] || '').trim(),
        }))
        .filter((i) => i.id || i.caption || i.image);

      // Drop pending debounced saves so they can't overwrite imported values.
      Object.values(captionTimers.current).forEach(clearTimeout);
      captionTimers.current = {};

      const missing = [];
      async function resolveImage(path) {
        if (!path) return null;
        if (/^https?:\/\//i.test(path)) return path;
        const entry = zip ? findZipFile(zip, path) : null;
        if (!entry) { missing.push(path); return null; }
        setImportMsg(`Uploading ${path}…`);
        const blob = await entry.async('blob');
        const f = new File([blob], path.split('/').pop(), { type: blob.type || 'image/jpeg' });
        return uploadToCloudinary(f);
      }

      const existing = items.filter((i) => i.id);
      const fresh = items.filter((i) => !i.id);

      let res = { updated: 0, unchanged: 0, not_found: [], invalid_ids: [] };
      if (existing.length) {
        res = await api.post('/api/admin/gallery/captions/bulk', {
          items: existing.map(({ id, caption }) => ({ id, caption })),
        });
      }
      const skippedIds = new Set([...res.not_found, ...res.invalid_ids]);

      let imagesSet = 0;
      for (const i of existing) {
        if (!i.image || skippedIds.has(i.id)) continue;
        const image_url = await resolveImage(i.image);
        if (image_url) { await api.patch(`/api/admin/gallery/${i.id}`, { image_url }); imagesSet += 1; }
      }

      let created = 0;
      for (const i of fresh) {
        const image_url = await resolveImage(i.image);
        await api.post('/api/admin/gallery', { caption: i.caption || 'Untitled photo', image_url });
        created += 1;
      }

      setPhotos(await api.get('/api/gallery'));
      const parts = [`${res.updated} captions updated`, `${res.unchanged} unchanged`];
      if (imagesSet) parts.push(`${imagesSet} images replaced`);
      if (created) parts.push(`${created} photos added`);
      if (skippedIds.size) parts.push(`${skippedIds.size} skipped (unknown id)`);
      if (missing.length) parts.push(`${missing.length} image file(s) not found: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
      setImportMsg(`Imported: ${parts.join(', ')}.`);
    } catch (err) {
      setImportMsg(`Import failed: ${err.message}`);
    }
  }

  async function handleFileChange(id, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const [image_url, sha256] = await Promise.all([uploadToCloudinary(file), sha256Hex(file)]);
      const updated = await api.patch(`/api/admin/gallery/${id}`, { image_url, sha256 });
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
        <button className="a-btn" onClick={exportZip} disabled={!photos.length || !!busy} title="Download captions and the actual image files as a ZIP">↓ Export ZIP</button>
        <button className="a-btn" onClick={exportCaptions} disabled={!photos.length}>Export captions</button>
        {canEdit && (
          <>
            <button className="a-btn" onClick={() => zipRef.current?.click()} disabled={!!busy} title="Import a ZIP made by Export: photos already in the gallery are recognised and only their captions update">↑ Import ZIP</button>
            <input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={importZip} />
            <button className="a-btn" onClick={() => importRef.current?.click()}>Import captions</button>
            <input ref={importRef} type="file" accept=".csv,.zip,text/csv,application/zip" hidden onChange={importCaptions} />
            <button className="a-btn a-btn-primary" onClick={addPhoto}>+ Add photo</button>
          </>
        )}
      </div>
      {busy && <p className={styles.hint} role="status">{busy}</p>}
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
