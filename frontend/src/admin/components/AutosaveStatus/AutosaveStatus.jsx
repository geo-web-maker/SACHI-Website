import styles from './AutosaveStatus.module.css';

const LABELS = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't reach the server — saved locally, will retry",
};

export default function AutosaveStatus({ status, lastSavedAt }) {
  if (!status || status === 'idle') return null;

  const label = LABELS[status] || '';
  const savedAgo =
    status === 'saved' && lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : null;

  return (
    <span className={`${styles.status} ${styles[status] || ''}`}>
      <span className={styles.dot} />
      {label}
      {savedAgo && <span className={styles.time}> · {savedAgo}</span>}
    </span>
  );
}
