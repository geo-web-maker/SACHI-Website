import { useEffect, useRef, useState } from 'react';
import styles from './Slideshow.module.css';

// The slide frame adopts each photo's real aspect ratio once it loads (see
// handleImageLoad below), so images always display in full via
// object-fit: contain rather than being cropped or force-fitted into a
// fixed box shape. `aspect` is only a fallback used before the image loads.

export default function Slideshow({
  images,
  aspect = '16 / 8',
  showThumbnails = false,
  autoPlay = true,
  intervalMs = 4000,
  hideCaption = false,
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liveAspect, setLiveAspect] = useState(null);
  const timerRef = useRef(null);

  const count = images?.length ?? 0;

  useEffect(() => {
    setLiveAspect(null);
  }, [index]);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (!naturalWidth || !naturalHeight) return;
    setLiveAspect(naturalWidth / naturalHeight);
  };

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
      <div className={styles.slide} style={{ aspectRatio: liveAspect ?? aspect }}>
        {current.image_url ? (
          <img
            key={current.id}
            className={styles.slideImg}
            src={current.image_url}
            alt={current.caption}
            onLoad={handleImageLoad}
          />
        ) : (
          <span className={styles.placeholder}>[ {current.caption} ]</span>
        )}
        {!hideCaption && <div className={styles.captionBar}>{current.caption}</div>}
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
