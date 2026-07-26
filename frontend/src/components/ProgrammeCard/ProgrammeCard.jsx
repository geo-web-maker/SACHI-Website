import { Link } from 'react-router-dom';
import Slideshow from '../Slideshow/Slideshow';
import styles from './ProgrammeCard.module.css';

export default function ProgrammeCard({ slug, num, title, teaser, images, flip }) {
  const photos = images?.filter((img) => img.image_url) ?? [];

  return (
    <Link
      to={`/programmes/${slug}`}
      className={`${styles.row} ${flip ? styles.flip : ''}`}
    >
      <div className={`${styles.photo} ${photos.length === 0 ? styles.photoEmpty : ''}`}>
        {photos.length > 0 ? (
          <Slideshow
            images={photos}
            aspect="4 / 3"
            intervalMs={9000}
            hideCaption
          />
        ) : (
          '[ programme photography ]'
        )}
      </div>
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
