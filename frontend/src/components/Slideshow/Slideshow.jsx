import { useEffect, useRef, useState } from 'react';
import styles from './Slideshow.module.css';

// Bounds so a very tall or very wide photo doesn't stretch the layout to
// an extreme. Within this range, the box follows the photo's real shape.
const MIN_ASPECT = 4 / 3;   // don't go narrower/taller than 4:3
const MAX_ASPECT = 16 / 7;  // don't go wider/shorter than roughly 16:7

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
    const ratio = naturalWidth / naturalHeight;
    const clamped = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio));
    setLiveAspect(clamped);
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
