import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={`${styles.footer} wrap`}>
      <span>SACHI — Society for Community Health Initiatives</span>
      <span>Kyambogo, Nakawa Division, Kampala, Uganda · info@sachiuganda.org</span>
    </footer>
  );
}
