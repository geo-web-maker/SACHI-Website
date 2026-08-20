import { useEffect, useState } from 'react';
import styles from './RotatingWord.module.css';

export default function RotatingWord({ words, intervalMs = 2400 }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  return (
    <span className={styles.wordWrap}>
      <span key={words[index]} className={styles.word}>{words[index]}</span>
    </span>
  );
}
