import { NavLink } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import { useAdminUI } from '../../hooks/useAdminUI';
import { SECTION_META } from '../../data/sections';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { user, accountLabel, visibleSections } = useRole();
  const { sidebarOpen, closeSidebar } = useAdminUI();
  if (!user) return null;

  return (
    <>
      {sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} />}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand}>
        <span className={styles.brandDot} />
        SACHI <span className={styles.brandSub}>admin</span>
      </div>

      <nav className={styles.nav}>
        {visibleSections.map((key) => {
          const meta = SECTION_META[key];
          return (
            <NavLink
              key={key}
              to={meta.path}
              end={key === 'dashboard'}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {meta.label}
            </NavLink>
          );
        })}
      </nav>

      <div className={styles.roleBadge}>
        <div className={styles.roleLabel}>{accountLabel}</div>
        <div className={styles.roleDesc}>{user.name}</div>
      </div>
    </aside>
  </>
  );
}
