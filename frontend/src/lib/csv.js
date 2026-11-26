// Minimal RFC 4180 CSV helpers (quoted fields, escaped quotes, CRLF/LF, BOM).

export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens UTF-8 captions correctly
  const blob = new Blob(['\uFEFF', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a .csv file, or the first .csv inside a .zip. Returns { text, zip }
 * where zip is the loaded archive (so callers can pull images out of it) or
 * null for a plain CSV.
 */
export async function readCsvBundle(file) {
  if (!/\.zip$/i.test(file.name)) return { text: await file.text(), zip: null };
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const entry = Object.values(zip.files).find(
    (f) => !f.dir && /\.csv$/i.test(f.name) && !f.name.startsWith('__MACOSX/') && !f.name.split('/').pop().startsWith('.')
  );
  if (!entry) throw new Error('No .csv file found inside the ZIP.');
  return { text: await entry.async('string'), zip };
}

export async function readCsvText(file) {
  return (await readCsvBundle(file)).text;
}

/** Finds a file in a JSZip archive by relative path (tolerates a wrapping folder). */
export function findZipFile(zip, path) {
  const clean = path.replace(/^\.?\//, '');
  return (
    zip.file(clean) ??
    Object.values(zip.files).find((f) => !f.dir && (f.name === clean || f.name.endsWith('/' + clean))) ??
    null
  );
}
