import { Link } from 'react-router-dom';
import styles from './SupportNote.module.css';

export default function SupportNote({ text, label = 'Support this work' }) {
  return (
    <div className={styles.note}>
      <p>{text}</p>
      <Link to="/donate">{label} &rarr;</Link>
    </div>
  );
}
