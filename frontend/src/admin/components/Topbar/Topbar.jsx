import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import { useAdminUI } from '../../hooks/useAdminUI';
import { Menu, LogOut } from 'lucide-react';
import styles from './Topbar.module.css';

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Topbar({ title }) {
  const { user, accountLabel, signOut } = useRole();
  const { toggleSidebar } = useAdminUI();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the mobile account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function handleSwitch() {
    setMenuOpen(false);
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

      {/* Desktop / tablet: full account info + sign out */}
      <div className={styles.right}>
        <div className={styles.viewingAs}>
          Signed in as <strong>{user?.name}</strong>{accountLabel === 'Super Admin' ? ' (Super Admin)' : ''}
        </div>
        <button className={styles.switchBtn} onClick={handleSwitch}>Sign out</button>
      </div>

      {/* Mobile: compact avatar that opens an account menu */}
      <div className={styles.account} ref={menuRef}>
        <button
          className={styles.avatarBtn}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {initialsOf(user?.name)}
        </button>
        {menuOpen && (
          <div className={styles.popover} role="menu">
            <div className={styles.popName}>{user?.name}</div>
            {user?.email && <div className={styles.popEmail}>{user.email}</div>}
            {accountLabel && <span className={styles.popBadge}>{accountLabel}</span>}
            <button className={styles.popSignOut} onClick={handleSwitch} role="menuitem">
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
