import { useEffect, useRef, useState } from 'react';
import styles from './Slideshow.module.css';

export default function Slideshow({
  images,
  aspect = '16 / 8',
  showThumbnails = false,
  autoPlay = true,
  intervalMs = 4000,
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const count = images?.length ?? 0;

  useEffect(() => {
    if (!autoPlay || paused || count <= 1) return undefined;

    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [autoPlay, paused, count, intervalMs]);

  if (!images || count === 0) {
    return (
      <div className={styles.slide} style={{ aspectRatio: aspect }}>
        [ no photos yet ]
      </div>
    );
  }

  const current = images[index];

  return (
    <div
      className={`${styles.wrapper} ${showThumbnails ? styles.wrapperSide : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.slide} style={{ aspectRatio: aspect }}>
        {current.image_url ? (
          <img className={styles.slideImg} src={current.image_url} alt={current.caption} />
        ) : (
          <span className={styles.placeholder}>[ {current.caption} ]</span>
        )}
        <div className={styles.captionBar}>{current.caption}</div>
      </div>

      {count > 1 && showThumbnails && (
        <div className={styles.thumbRow}>
          {images.map((img, i) => (
            <button
              key={img.id}
              className={`${styles.thumb} ${i === index ? styles.thumbActive : ''}`}
              onClick={() => setIndex(i)}
            >
              {img.caption}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
