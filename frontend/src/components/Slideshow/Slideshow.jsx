import { useEffect, useRef, useState } from 'react';
import styles from './Slideshow.module.css';

// The slide frame adopts each photo's real aspect ratio once it loads (see
// handleImageLoad below), so images always display in full via
// object-fit: cover with minimal cropping, rather than being force-fitted
// into a mismatched box shape. `aspect` is only a fallback used before any
// image has loaded.
//
// All photos are mounted at once (stacked, opacity-toggled) rather than
// swapped one at a time, so slide changes crossfade smoothly instead of
// hard-cutting, and each photo's aspect ratio is already known by the time
// its slide becomes active (no reload/flash).

export default function Slideshow({
  images,
  aspect = '16 / 8',
  showThumbnails = false,
  autoPlay = true,
  intervalMs = 4000,
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [aspects, setAspects] = useState({});
  const timerRef = useRef(null);

  const count = images?.length ?? 0;

  const handleImageLoad = (id) => (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (!naturalWidth || !naturalHeight) return;
    setAspects((prev) => ({ ...prev, [id]: naturalWidth / naturalHeight }));
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
  const liveAspect = aspects[current.id];

  return (
    <div
      className={`${styles.wrapper} ${showThumbnails ? styles.wrapperSide : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.slide} style={{ aspectRatio: liveAspect ?? aspect }}>
        {images.map((img, i) =>
          img.image_url ? (
            <img
              key={img.id}
              className={`${styles.slideImg} ${i === index ? styles.slideImgActive : ''}`}
              src={img.image_url}
              alt={img.caption}
              onLoad={handleImageLoad(img.id)}
            />
          ) : null
        )}
        {!current.image_url && (
          <span className={styles.placeholder}>[ {current.caption} ]</span>
        )}
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
