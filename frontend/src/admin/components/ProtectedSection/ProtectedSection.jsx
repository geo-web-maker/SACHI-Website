import { useRole } from '../../hooks/useRole';
import Topbar from '../Topbar/Topbar';
import styles from './ProtectedSection.module.css';

export default function ProtectedSection({ section, title, children }) {
  const { hasAccess, role, loading } = useRole();

  if (loading) {
    return (
      <>
        <Topbar title={title} />
        <div className={styles.content} />
      </>
    );
  }

  if (!hasAccess(section)) {
    return (
      <>
        <Topbar title={title} />
        <div className={styles.restricted}>
          <div className={styles.badge}>Access restricted</div>
          <h2>Your role doesn't include this section.</h2>
          <p>
            You're signed in as <strong>{role?.label}</strong>, which doesn't have access to
            {' '}{title}. This is enforced server-side on every request — this screen just
            reflects what the API already refused to return.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={title} />
      <div className={styles.content}>{children}</div>
    </>
  );
}
