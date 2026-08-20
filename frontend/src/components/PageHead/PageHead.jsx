import styles from './PageHead.module.css';

export default function PageHead({ eyebrow, title, children, variant, media }) {
  const innerClass = variant === 'grid'
    ? `${styles.inner} ${styles.innerGrid}`
    : styles.inner;

  return (
    <section className={styles.pagehead}>
      <div className={innerClass}>
        <div className={variant === 'grid' ? styles.gridTextCol : undefined}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
        {variant === 'grid' && media}
      </div>
      <svg
        className={styles.ripple}
        viewBox="0 0 1180 64"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,30 C160,64 320,0 480,30 C640,58 800,8 960,30 C1080,44 1140,30 1180,30 L1180,64 L0,64 Z"
          fill="var(--cream)"
        />
      </svg>
    </section>
  );
}
