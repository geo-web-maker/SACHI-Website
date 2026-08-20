import { NavLink } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import { useAdminUI } from '../../hooks/useAdminUI';
import { SECTION_META } from '../../data/roles';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { role } = useRole();
  const { sidebarOpen, closeSidebar } = useAdminUI();
  if (!role) return null;

  return (
    <>
      {sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} />}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand}>
        <span className={styles.brandDot} />
        SACHI <span className={styles.brandSub}>admin</span>
      </div>

      <nav className={styles.nav}>
        {role.sections.map((key) => {
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
        <div className={styles.roleLabel}>{role.label}</div>
        <div className={styles.roleDesc}>{role.description}</div>
      </div>
    </aside>
  </>
  );
}
