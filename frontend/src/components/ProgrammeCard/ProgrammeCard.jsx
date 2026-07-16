import { Link } from 'react-router-dom';
import styles from './ProgrammeCard.module.css';

export default function ProgrammeCard({ slug, num, title, teaser, flip }) {
  return (
    <Link
      to={`/programmes/${slug}`}
      className={`${styles.row} ${flip ? styles.flip : ''}`}
    >
      <div className={styles.photo}>[ programme photography ]</div>
      <div className={styles.text}>
        <div className={styles.label}>Programme {num}</div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.teaser}>{teaser}</p>
        <span className={styles.readMore}>
          Read more <span className={styles.arrow}>&rarr;</span>
        </span>
      </div>
    </Link>
  );
}
