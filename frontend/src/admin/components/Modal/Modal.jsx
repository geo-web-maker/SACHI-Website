import styles from './Modal.module.css';

export default function Modal({ title, onClose, children, footer, wide = false }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.panel} ${wide ? styles.wide : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{title}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
