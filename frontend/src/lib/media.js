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

const LOOKUP_CHUNK = 1000;      // server accepts at most 2000 hashes per call
const LOOKUP_MAX_ROUNDS = 60;   // each round lets the server hash more older photos

/**
 * Ask the server which hashes are already in the system → { [sha256]: existingImageUrl }.
 *
 * The server indexes older photos in the background of each call and reports
 * `pending` while some are still unhashed. We keep asking until it reaches 0,
 * so a picture that is already hosted is never mistaken for a new one.
 */
export async function lookupKnownImages(hashes, onWait) {
  const unique = [...new Set(hashes)];
  const known = {};
  for (let i = 0; i < unique.length; i += LOOKUP_CHUNK) {
    const chunk = unique.slice(i, i + LOOKUP_CHUNK);
    for (let round = 0; ; round++) {
      const res = await api.post('/api/admin/images/lookup', { hashes: chunk });
      if (!res.pending) { Object.assign(known, res.known); break; }
      if (round + 1 >= LOOKUP_MAX_ROUNDS) {
        throw new Error('Existing photos are still being indexed. Please run the import again in a minute.');
      }
      onWait?.(res.pending);
    }
  }
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
