import { useRole } from '../../hooks/useRole';
import Topbar from '../Topbar/Topbar';
import styles from './ProtectedSection.module.css';

// `level`: 'view' (default) — the section is reachable at all — or 'edit' for
// a screen that's pointless without write access. Either way this is just a
// UI reflection of app/deps.py's require_view/require_edit, which is what
// actually enforces this on every request.
export default function ProtectedSection({ section, title, level = 'view', children }) {
  const { hasAccess, accountLabel, loading } = useRole();

  if (loading) {
    return (
      <>
        <Topbar title={title} />
        <div className={styles.content} />
      </>
    );
  }

  if (!hasAccess(section, level)) {
    return (
      <>
        <Topbar title={title} />
        <div className={styles.restricted}>
          <div className={styles.badge}>Access restricted</div>
          <h2>You don't have {level} access to this section.</h2>
          <p>
            You're signed in as <strong>{accountLabel}</strong>. An admin can grant you{' '}
            {level} access to {title} from Admin users. This is enforced server-side on
            every request — this screen just reflects what the API already refused to return.
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
