import { useCallback, useEffect, useRef, useState } from 'react';

// Hybrid autosave: fires whichever comes first —
//   - `pauseMs` of no changes (the user paused typing),
//   - `maxWords` new words typed since the last save,
//   - `maxIntervalMs` elapsed since the last save, even if the user never pauses.
// On top of that, a local draft is written to localStorage on every change —
// that write is effectively instant (synchronous, no network round trip), so
// it survives a browser crash or power loss even in the gap before the next
// network save fires. The network save is what makes the draft recoverable
// from a different device/after a reload; the local one is what makes sure
// a power cut mid-typing never wipes out unsaved work.
//
// Tuned aggressively by design (short pause/word/interval thresholds) because
// this exists specifically to protect against sudden power loss after a long
// typing session — a little extra network traffic is the acceptable trade-off.
const DEFAULT_PAUSE_MS = 1200;
const DEFAULT_MAX_WORDS = 5;
const DEFAULT_MAX_INTERVAL_MS = 8000;

function toWordCountableText(data, getWordCountable) {
  if (getWordCountable) return getWordCountable(data) || '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data ?? '');
  } catch {
    return '';
  }
}

function countWords(text) {
  const stripped = text.replace(/<[^>]*>/g, ' '); // strip HTML tags so markup churn isn't counted as "words"
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * @param {string} key - localStorage key, unique per record/form (e.g. `programme-draft:${slug}`).
 *   Pass null/undefined to skip local-draft backup (rarely what you want).
 * @param {*} data - the current draft value. Any JSON-serializable shape.
 * @param {(data: any) => Promise<any>} onSave - persists `data` to the server.
 * @param {boolean} [enabled=true] - set false while a modal is closed / form isn't mounted.
 * @param {(data: any) => string} [getWordCountable] - extracts the text to count words
 *   from, when `data` is an object with several fields (e.g. title + body). Defaults to
 *   stringifying the whole thing, which still works for triggering saves, just less precisely.
 */
export function useAutosave({
  key,
  data,
  onSave,
  enabled = true,
  pauseMs = DEFAULT_PAUSE_MS,
  maxWords = DEFAULT_MAX_WORDS,
  maxIntervalMs = DEFAULT_MAX_INTERVAL_MS,
  getWordCountable,
}) {
  const [status, setStatus] = useState('idle'); // idle | pending | saving | saved | error
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const dataRef = useRef(data);
  const savedTextRef = useRef(toWordCountableText(data, getWordCountable));
  const pauseTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false); // a change arrived while a save was already in flight

  const flush = useCallback(async () => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    const text = toWordCountableText(dataRef.current, getWordCountable);
    if (text === savedTextRef.current) return; // nothing new since the last save

    savingRef.current = true;
    setStatus('saving');
    clearTimeout(pauseTimerRef.current);
    clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;

    try {
      await onSave(dataRef.current);
      savedTextRef.current = text;
      setLastSavedAt(Date.now());
      setStatus('saved');
      if (key) {
        try {
          localStorage.removeItem(key); // server has it now; local backup no longer needed
        } catch {
          /* ignore */
        }
      }
    } catch {
      setStatus('error'); // the local draft (already written) is the fallback if this keeps failing
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        flush();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, key, getWordCountable]);

  // Every change: write the local draft immediately, then schedule/force a server save.
  useEffect(() => {
    dataRef.current = data;
    if (!enabled) return;

    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {
        /* storage full/unavailable — the server-side autosave below still applies */
      }
    }

    const currentText = toWordCountableText(data, getWordCountable);
    if (currentText === savedTextRef.current) return; // nothing new to save
    setStatus('pending');

    clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(flush, pauseMs);

    const wordsSinceSave = Math.abs(countWords(currentText) - countWords(savedTextRef.current));
    if (wordsSinceSave >= maxWords) {
      flush();
    }

    if (!maxTimerRef.current) {
      maxTimerRef.current = setTimeout(flush, maxIntervalMs);
    }

    return () => clearTimeout(pauseTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled]);

  // Flush immediately when the tab is hidden/closed — don't rely on the debounce
  // timer alone to have fired before the user switches away or shuts the laptop.
  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush, enabled]);

  useEffect(
    () => () => {
      clearTimeout(pauseTimerRef.current);
      clearTimeout(maxTimerRef.current);
    },
    [],
  );

  const restoreLocalDraft = useCallback(() => {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [key]);

  const discardLocalDraft = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { status, lastSavedAt, flush, restoreLocalDraft, discardLocalDraft };
}
