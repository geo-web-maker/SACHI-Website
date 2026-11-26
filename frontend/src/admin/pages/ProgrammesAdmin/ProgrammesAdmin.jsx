import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import Modal from '../../components/Modal/Modal';
import RichTextEditor from '../../../components/RichTextEditor/RichTextEditor';
import AutosaveStatus from '../../components/AutosaveStatus/AutosaveStatus';
import { useAutosave } from '../../hooks/useAutosave';
import { useRole } from '../../hooks/useRole';
import { api } from '../../../lib/api';
import { toCsv, parseCsv, downloadFile } from '../../../lib/csv';
import { PROGRAMME_ICONS, PROGRAMME_ICON_NAMES } from '../../../data/programmeIcons';
import styles from './ProgrammesAdmin.module.css';

function isBlankHtml(html) {
  return !html || html.trim() === '' || html.trim() === '<p></p>';
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const emptyDraft = { slug: '', icon: '', title: '', teaser: '', body: '' };

function toDraft(p) {
  return { ...p, teaserDraft: p.teaser, bodyDraft: p.body, imagesDraft: p.images.map((img) => ({ ...img })) };
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Import state machine ──────────────────────────────────────────────────
const IMPORT_IDLE      = 'idle';
const IMPORT_UPLOADING = 'uploading'; // extracting ZIP + pushing images to Cloudinary
const IMPORT_PREVIEW   = 'preview';
const IMPORT_RUNNING   = 'running';
const IMPORT_DONE      = 'done';

function validateImportRow(p, i) {
  const errs = [];
  if (!p.slug)  errs.push('missing slug');
  if (!p.title) errs.push('missing title');
  if (!p.icon)  errs.push('missing icon');
  if (!p.teaser && !p.body) errs.push('missing teaser and body');
  return errs.length ? `Row ${i + 1} (${p.title || p.slug || '?'}): ${errs.join(', ')}` : null;
}

/** Returns true for absolute URLs — these are already on Cloudinary (or elsewhere) and need no upload. */
function isAbsoluteUrl(str) {
  return typeof str === 'string' && /^https?:\/\//i.test(str);
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

  // ── Import state ──────────────────────────────────────────────────────
  const importFileRef = useRef(null);
  const captionFileRef = useRef(null);
  const [captionMsg, setCaptionMsg] = useState('');
  const [importState, setImportState]     = useState(IMPORT_IDLE);
  const [importRows, setImportRows]       = useState([]);
  const [importErrs, setImportErrs]       = useState([]);
  const [importResult, setImportResult]   = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total, label }

  useEffect(() => { api.get('/api/programmes').then(setProgrammes); }, []);

  function openEdit(p) { setEditing(toDraft(p)); setRestorePrompted(false); }

  const editKey  = editing ? `sachi-draft:programme:${editing.slug}` : null;
  const autosave = useAutosave({
    key: editKey,
    data: editing,
    enabled: Boolean(editing) && canEdit,
    getWordCountable: (d) => `${d?.teaserDraft || ''} ${d?.bodyDraft || ''}`,
    onSave: async (d) => {
      const updated = await api.patch(`/api/admin/programmes/${d.slug}`, {
        icon: d.icon, teaser: d.teaserDraft, body: d.bodyDraft, images: d.imagesDraft,
      });
      setProgrammes((prev) => prev.map((p) => (p.slug === updated.slug ? updated : p)));
    },
  });

  useEffect(() => {
    if (!editing || restorePrompted || !canEdit) return;
    setRestorePrompted(true);
    const draft = autosave.restoreLocalDraft();
    if (draft?.data && draft.data.slug === editing.slug) {
      const draftText   = `${draft.data.teaserDraft || ''}${draft.data.bodyDraft || ''}`;
      const currentText = `${editing.teaserDraft  || ''}${editing.bodyDraft  || ''}`;
      if (draftText !== currentText) {
        const when = new Date(draft.savedAt).toLocaleTimeString();
        if (confirm(`Found unsaved changes from ${when} for this programme. Restore them?`)) {
          setEditing(draft.data);
        } else {
          autosave.discardLocalDraft();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function updateImageCaption(id, caption) {
    setEditing((prev) => ({ ...prev, imagesDraft: prev.imagesDraft.map((img) => img.id === id ? { ...img, caption } : img) }));
  }
  function addImage() {
    setEditing((prev) => ({ ...prev, imagesDraft: [...prev.imagesDraft, { id: `${prev.slug}-${Date.now()}`, caption: 'Untitled photo' }] }));
  }
  function removeImage(id) {
    setEditing((prev) => ({ ...prev, imagesDraft: prev.imagesDraft.filter((img) => img.id !== id) }));
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
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingImgId(id);
    try {
      const image_url = await uploadToCloudinary(file);
      setEditing((prev) => ({ ...prev, imagesDraft: prev.imagesDraft.map((img) => img.id === id ? { ...img, image_url } : img) }));
    } finally { setUploadingImgId(null); e.target.value = ''; }
  }
  async function saveEdit() {
    setSaving(true);
    try { await autosave.flush(); setEditing(null); } finally { setSaving(false); }
  }

  function openCreate() { setCreateDraft(emptyDraft); setCreateError(''); setCreating(true); }
  function updateCreateField(field, value) {
    setCreateDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !prev.slugTouched) next.slug = slugify(value);
      return next;
    });
  }
  async function submitCreate() {
    setCreateError('');
    if (!createDraft.title.trim() || !createDraft.slug.trim() || !createDraft.icon) {
      setCreateError('Title, slug, and icon are all required.'); return;
    }
    if (isBlankHtml(createDraft.body)) { setCreateError('Add some body content.'); return; }
    setCreateSaving(true);
    try {
      const created = await api.post('/api/admin/programmes', {
        slug: createDraft.slug.trim(), icon: createDraft.icon, title: createDraft.title.trim(),
        teaser: isBlankHtml(createDraft.teaser) ? createDraft.body : createDraft.teaser,
        body: createDraft.body, images: [],
      });
      setProgrammes((prev) => [...prev, created]); setCreating(false); discardCreateDraft();
    } catch (err) { setCreateError(err.message || 'Something went wrong.'); } finally { setCreateSaving(false); }
  }

  const createDraftKey = 'sachi-draft:programme:new';
  useEffect(() => {
    if (!creating) return;
    try { localStorage.setItem(createDraftKey, JSON.stringify({ data: createDraft, savedAt: Date.now() })); } catch { /* ignore */ }
  }, [createDraft, creating]);
  function discardCreateDraft() { try { localStorage.removeItem(createDraftKey); } catch { /* ignore */ } }
  useEffect(() => {
    if (!creating) return;
    try {
      const raw = localStorage.getItem(createDraftKey); if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.data && !isBlankHtml(draft.data.body) && confirm('Restore the unfinished new programme you were drafting earlier?')) {
        setCreateDraft(draft.data);
      } else { discardCreateDraft(); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating]);

  // ── Export ──────────────────────────────────────────────────────────────
  function handleExport() {
    api.get('/api/programmes').then((data) => {
      const exportData = data.map(({ id: _id, num: _num, ...rest }) => rest);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `sachi-programmes-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    });
  }

  // ── Captions only (CSV) ─────────────────────────────────────────────────
  // One row per photo: slug, image_id, caption (+ read-only context columns).
  // Import matches on slug + image_id and changes nothing but the caption.
  async function exportCaptions() {
    const data = await api.get('/api/programmes');
    const rows = [['slug', 'image_id', 'caption', 'programme_title', 'image_url']];
    data.forEach((p) => p.images.forEach((img) => rows.push([p.slug, img.id, img.caption, p.title, img.image_url || ''])));
    downloadFile(`sachi-programme-captions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  async function importCaptions(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCaptionMsg('');
    try {
      const rows = parseCsv(await file.text());
      const header = (rows[0] || []).map((h) => h.trim().toLowerCase());
      const cols = ['slug', 'image_id', 'caption'].map((c) => header.indexOf(c));
      if (cols.includes(-1)) {
        setCaptionMsg('Import failed: the CSV needs "slug", "image_id" and "caption" columns (use Export captions to get a template).');
        return;
      }
      const items = rows.slice(1)
        .map((r) => ({ slug: (r[cols[0]] || '').trim(), image_id: (r[cols[1]] || '').trim(), caption: r[cols[2]] ?? '' }))
        .filter((r) => r.slug && r.image_id);
      const res = await api.post('/api/admin/programmes/captions/bulk', { rows: items });
      setProgrammes(await api.get('/api/programmes'));
      setCaptionMsg(
        `Captions imported: ${res.updated} updated, ${res.unchanged} unchanged` +
        (res.not_found.length ? `, ${res.not_found.length} skipped (not found: ${res.not_found.slice(0, 3).join(', ')}${res.not_found.length > 3 ? '…' : ''})` : '') + '.'
      );
    } catch (err) {
      setCaptionMsg(`Import failed: ${err.message}`);
    }
  }

  // ── Import ──────────────────────────────────────────────────────────────
  function openImportPicker() { importFileRef.current?.click(); }

  function handleImportFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (file.name.endsWith('.zip')) { handleZipImport(file); }
    else { handleJsonImport(file); }
  }

  // Plain JSON — existing behaviour, no image uploads needed.
  function handleJsonImport(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const rows   = Array.isArray(parsed) ? parsed : (parsed.programmes ?? []);
        if (!rows.length) throw new Error('No programmes found in the file.');
        const errs = rows.map(validateImportRow).filter(Boolean);
        setImportRows(rows); setImportErrs(errs); setImportResult(null);
        setImportState(IMPORT_PREVIEW);
      } catch (err) { alert(`Could not read the file: ${err.message}`); }
    };
    reader.readAsText(file);
  }

  /**
   * ZIP import flow:
   *   1. Extract programmes.json
   *   2. Walk every programme's images array
   *      - image_url is an absolute https:// URL  → keep as-is (already on Cloudinary)
   *      - image_url is a relative path like "images/photo.jpg"  → extract from ZIP and upload
   *      - image_url is absent/empty  → leave empty (no photo yet)
   *   3. After all uploads, hand off to the standard preview modal
   */
  async function handleZipImport(file) {
    setImportState(IMPORT_UPLOADING);
    setUploadProgress(null);

    try {
      const zip = await JSZip.loadAsync(file);

      // Find programmes.json (tolerates being inside a subfolder)
      const jsonEntry = Object.values(zip.files).find(
        (f) => !f.dir && f.name.replace(/^[^/]+\//, '') === 'programmes.json'
      );
      if (!jsonEntry) throw new Error('No programmes.json found inside the ZIP.');

      const jsonText = await jsonEntry.async('string');
      const parsed   = JSON.parse(jsonText);
      const rows     = Array.isArray(parsed) ? parsed : (parsed.programmes ?? []);
      if (!rows.length) throw new Error('programmes.json contains no programmes.');

      // Count images that need uploading
      const toUpload = rows.flatMap((p) =>
        (p.images ?? []).filter((img) => img.image_url && !isAbsoluteUrl(img.image_url))
      );
      let done = 0;

      // Deep-clone rows so we can mutate image_url in place
      const resolved = JSON.parse(JSON.stringify(rows));

      for (const prog of resolved) {
        for (const img of prog.images ?? []) {
          if (!img.image_url || isAbsoluteUrl(img.image_url)) continue;

          // Look up the file in the ZIP (path may or may not have a leading subfolder)
          const relativePath = img.image_url; // e.g. "images/photo.jpg"
          const entry = zip.file(relativePath)
            ?? Object.values(zip.files).find((f) => f.name.endsWith('/' + relativePath) || f.name === relativePath);

          if (!entry) {
            console.warn(`ZIP import: file not found for ${relativePath}, skipping.`);
            img.image_url = null;
            continue;
          }

          done += 1;
          setUploadProgress({ done, total: toUpload.length, label: img.caption || relativePath });

          const blob     = await entry.async('blob');
          const fileName = relativePath.split('/').pop();
          const fileObj  = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          img.image_url  = await uploadToCloudinary(fileObj);
        }
      }

      const errs = resolved.map(validateImportRow).filter(Boolean);
      setImportRows(resolved); setImportErrs(errs); setImportResult(null);
      setImportState(IMPORT_PREVIEW);

    } catch (err) {
      alert(`ZIP import failed: ${err.message}`);
      setImportState(IMPORT_IDLE);
    } finally {
      setUploadProgress(null);
    }
  }

  async function runImport() {
    setImportState(IMPORT_RUNNING);
    try {
      const result = await api.post('/api/admin/programmes/import', { programmes: importRows });
      setImportResult(result); setImportState(IMPORT_DONE);
      const fresh = await api.get('/api/programmes'); setProgrammes(fresh);
    } catch (err) {
      alert(`Import failed: ${err.message}`); setImportState(IMPORT_PREVIEW);
    }
  }

  function closeImport() {
    setImportState(IMPORT_IDLE); setImportRows([]); setImportErrs([]); setImportResult(null); setUploadProgress(null);
  }

  const SelectedIcon = PROGRAMME_ICONS[createDraft.icon];
  const EditingIcon  = editing ? PROGRAMME_ICONS[editing.icon] : null;

  return (
    <ProtectedSection section="programmes" title="Programmes">
      {/* Hidden file input — accepts both JSON and ZIP */}
      <input
        ref={importFileRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <input ref={captionFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={importCaptions} />

      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {canEdit
            ? 'Changes here save automatically as you type, and immediately on "Save changes".'
            : 'You have view-only access to this section.'}
        </p>
        <div className={styles.toolbarActions}>
          <button className="a-btn" onClick={handleExport} title="Download all programmes as a JSON file">↓ Export</button>
          <button className="a-btn" onClick={exportCaptions} title="Download all photo captions as a CSV file">↓ Captions</button>
          {canEdit && (
            <>
              <button className="a-btn" onClick={() => captionFileRef.current?.click()} title="Update photo captions from a CSV file">↑ Captions</button>
              <button className="a-btn" onClick={openImportPicker} title="Import programmes from a JSON or ZIP file">↑ Import</button>
              <button className="a-btn a-btn-primary" onClick={openCreate}>+ Add programme</button>
            </>
          )}
        </div>
      </div>

      {captionMsg && <p className={styles.hint} role="status">{captionMsg}</p>}

      <DataTable
        columns={['#', 'Title', 'Teaser', 'Photos', '']}
        rows={programmes}
        renderRow={(p) => (
          <tr key={p.slug}>
            <td className="a-mono">{p.num}</td>
            <td className={styles.titleCell}>{p.title}</td>
            <td className={styles.teaserCell}>{stripHtml(p.teaser)}</td>
            <td className="a-mono">{p.images.length}</td>
            <td><button className="a-btn a-btn-sm" onClick={() => openEdit(p)}>{canEdit ? 'Edit' : 'View'}</button></td>
          </tr>
        )}
      />

      {/* ── Create modal ───────────────────────────────────────────────── */}
      {creating && (
        <Modal title="Add a new programme" onClose={() => setCreating(false)} wide
          footer={<><button className="a-btn" onClick={() => setCreating(false)}>Cancel</button><button className="a-btn a-btn-primary" onClick={submitCreate} disabled={createSaving}>{createSaving ? 'Creating…' : 'Create programme'}</button></>}>
          <div><label htmlFor="new-title">Title</label><input id="new-title" value={createDraft.title} onChange={(e) => updateCreateField('title', e.target.value)} /></div>
          <div><label htmlFor="new-slug">Slug (used in the URL — /programmes/&lt;slug&gt;)</label><input id="new-slug" value={createDraft.slug} onChange={(e) => { setCreateDraft((prev) => ({ ...prev, slugTouched: true })); updateCreateField('slug', slugify(e.target.value)); }} /></div>
          <div>
            <label htmlFor="new-icon">Icon</label>
            <div className={styles.iconPickerRow}>
              <select id="new-icon" value={createDraft.icon} onChange={(e) => updateCreateField('icon', e.target.value)}>
                <option value="">Select an icon…</option>
                {PROGRAMME_ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className={styles.iconPreview}>{SelectedIcon ? <SelectedIcon size={22} strokeWidth={1.75} /> : '—'}</span>
            </div>
          </div>
          <div><label htmlFor="new-teaser">Teaser (shown on the Programmes overview — optional)</label><RichTextEditor value={createDraft.teaser} onChange={(html) => updateCreateField('teaser', html)} minHeight={80} /></div>
          <div><label htmlFor="new-body">Full content</label><RichTextEditor value={createDraft.body} onChange={(html) => updateCreateField('body', html)} minHeight={220} /></div>
          {createError && <p className={styles.error}>{createError}</p>}
          <p className={styles.hint}>Photos can be added after creating the programme, from its Edit screen.</p>
        </Modal>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      {editing && (
        <Modal title={`${canEdit ? 'Edit' : 'View'} — ${editing.title}`} onClose={() => setEditing(null)} wide
          footer={<><AutosaveStatus status={canEdit ? autosave.status : null} lastSavedAt={autosave.lastSavedAt} /><button className="a-btn" onClick={() => setEditing(null)}>{canEdit ? 'Cancel' : 'Close'}</button>{canEdit && <button className="a-btn a-btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>}</>}>
          <div>
            <label htmlFor="edit-icon">Icon</label>
            <div className={styles.iconPickerRow}>
              <select id="edit-icon" value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} disabled={!canEdit}>
                <option value="">Select an icon…</option>
                {PROGRAMME_ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className={styles.iconPreview}>{EditingIcon ? <EditingIcon size={22} strokeWidth={1.75} /> : '—'}</span>
            </div>
          </div>
          <div><label>Teaser</label><RichTextEditor value={editing.teaserDraft} onChange={(html) => canEdit && setEditing({ ...editing, teaserDraft: html })} minHeight={90} /></div>
          <div><label>Full content</label><RichTextEditor value={editing.bodyDraft} onChange={(html) => canEdit && setEditing({ ...editing, bodyDraft: html })} minHeight={260} /></div>
          <div>
            <label>Photos</label>
            <div className={styles.imageList}>
              {editing.imagesDraft.map((img, i) => (
                <div className={styles.imageRow} key={img.id}>
                  <div className={styles.imageThumb}>{img.image_url ? <img src={img.image_url} alt={img.caption} /> : '[ photo ]'}</div>
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(img.id, e)} disabled={!canEdit || uploadingImgId === img.id} />
                  <input value={img.caption} onChange={(e) => updateImageCaption(img.id, e.target.value)} disabled={!canEdit} />
                  {canEdit && (
                    <div className={styles.imageActions}>
                      <button className="a-btn a-btn-sm" disabled={i === 0} onClick={() => moveImage(img.id, -1)} aria-label="Move up">&uarr;</button>
                      <button className="a-btn a-btn-sm" disabled={i === editing.imagesDraft.length - 1} onClick={() => moveImage(img.id, 1)} aria-label="Move down">&darr;</button>
                      <button className={`a-btn a-btn-sm ${styles.removeBtn}`} onClick={() => removeImage(img.id)}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {canEdit && <button className="a-btn a-btn-sm" onClick={addImage} style={{ marginTop: '10px' }}>+ Add photo</button>}
          </div>
        </Modal>
      )}

      {/* ── Import modals ───────────────────────────────────────────────── */}

      {/* Uploading images from ZIP */}
      {importState === IMPORT_UPLOADING && (
        <Modal title="Preparing import…" wide>
          <div className={styles.uploadingWrap}>
            <div className={styles.uploadingBar}>
              <div
                className={styles.uploadingFill}
                style={{ width: uploadProgress ? `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` : '0%' }}
              />
            </div>
            <p className={styles.uploadingLabel}>
              {uploadProgress
                ? `Uploading image ${uploadProgress.done} of ${uploadProgress.total}: ${uploadProgress.label}`
                : 'Reading ZIP file…'}
            </p>
          </div>
        </Modal>
      )}

      {/* Preview / running / done */}
      {(importState === IMPORT_PREVIEW || importState === IMPORT_RUNNING || importState === IMPORT_DONE) && (
        <Modal
          title={
            importState === IMPORT_DONE    ? 'Import complete' :
            importState === IMPORT_RUNNING ? 'Importing…' :
            `Import preview — ${importRows.length} programme${importRows.length !== 1 ? 's' : ''}`
          }
          onClose={importState === IMPORT_RUNNING ? undefined : closeImport}
          wide
          footer={
            importState === IMPORT_DONE ? (
              <button className="a-btn a-btn-primary" onClick={closeImport}>Done</button>
            ) : importState === IMPORT_PREVIEW ? (
              <><button className="a-btn" onClick={closeImport}>Cancel</button><button className="a-btn a-btn-primary" onClick={runImport} disabled={importErrs.length > 0}>Confirm import</button></>
            ) : null
          }
        >
          {/* Validation errors */}
          {importState === IMPORT_PREVIEW && importErrs.length > 0 && (
            <div className={styles.importErrors}>
              <p className={styles.importErrorHeading}>Fix these errors before importing:</p>
              <ul>{importErrs.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          {/* Preview table */}
          {importState === IMPORT_PREVIEW && importErrs.length === 0 && (
            <>
              <p className={styles.hint}>
                Existing programmes (matched by slug) will be updated. New slugs will be created.
                Images already uploaded to Cloudinary are ready — no re-uploading needed.
              </p>
              <table className={styles.importTable}>
                <thead><tr><th>Slug</th><th>Title</th><th>Photos</th><th>Status</th></tr></thead>
                <tbody>
                  {importRows.map((p) => {
                    const existing = programmes.find((x) => x.slug === p.slug);
                    return (
                      <tr key={p.slug}>
                        <td className="a-mono">{p.slug}</td>
                        <td>{p.title}</td>
                        <td className="a-mono">{(p.images ?? []).length}</td>
                        <td><span className={existing ? styles.badgeUpdate : styles.badgeNew}>{existing ? 'update' : 'new'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {importState === IMPORT_RUNNING && <p className={styles.importRunning}>Importing {importRows.length} programmes…</p>}

          {importState === IMPORT_DONE && importResult && (
            <div className={styles.importSummary}>
              <p>✓ <strong>{importResult.created}</strong> created</p>
              <p>✓ <strong>{importResult.updated}</strong> updated</p>
              {importResult.errors?.length > 0 && (
                <div className={styles.importErrors}>
                  <p className={styles.importErrorHeading}>Some rows had errors:</p>
                  <ul>{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </ProtectedSection>
  );
}
