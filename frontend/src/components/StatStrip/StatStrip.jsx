import styles from './StatStrip.module.css';

export default function StatStrip({ stats }) {
  return (
    <div className={styles.wrapper}>
      <div className={`${styles.row} wrap`}>
        {stats.map((s) => (
          <div className={styles.stat} key={s.label}>
            <div className={styles.num}>{s.num}</div>
            <div className={styles.lbl}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
