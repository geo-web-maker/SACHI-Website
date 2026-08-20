import { Link } from 'react-router-dom';
import styles from './CtaBand.module.css';

export default function CtaBand({ title, text, ctaLabel = 'Get in touch', ctaTo = '/contact' }) {
  return (
    <div className={styles.band}>
      <h2>{title}</h2>
      <p>{text}</p>
      <Link to={ctaTo} className={styles.btn}>{ctaLabel}</Link>
    </div>
  );
}
