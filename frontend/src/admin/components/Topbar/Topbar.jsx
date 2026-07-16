import { useNavigate } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import { useAdminUI } from '../../hooks/useAdminUI';
import { Menu } from 'lucide-react';
import styles from './Topbar.module.css';

export default function Topbar({ title }) {
  const { role, signOut } = useRole();
  const { toggleSidebar } = useAdminUI();
  const navigate = useNavigate();

  async function handleSwitch() {
    await signOut();
    navigate('/admin/login');
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={toggleSidebar} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.viewingAs}>
          Signed in as <strong>{role?.label}</strong>
        </div>
        <button className={styles.switchBtn} onClick={handleSwitch}>Sign out</button>
      </div>
    </header>
  );
}
