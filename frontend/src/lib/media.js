import { api } from './api';

/** SHA-256 (hex) of a File/Blob — the identity used to recognise "the same picture". */
export async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ask the server which hashes are already in the system → { [sha256]: existingImageUrl }. */
export async function lookupKnownImages(hashes) {
  const unique = [...new Set(hashes)];
  if (!unique.length) return {};
  const { known } = await api.post('/api/admin/images/lookup', { hashes: unique });
  return known;
}

export const isAbsoluteUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);

/** Find a file inside a loaded JSZip by its relative path (tolerates one wrapping folder). */
export function findZipEntry(zip, relativePath) {
  return (
    zip.file(relativePath) ??
    Object.values(zip.files).find((f) => !f.dir && (f.name === relativePath || f.name.endsWith('/' + relativePath)))
  );
}
