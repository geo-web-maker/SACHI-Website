import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import styles from './Nav.module.css';

const links = [
  {to: '/', label: 'Home', end: true},
  { to: '/about', label: 'About' },
  { to: '/programmes', label: 'Programmes' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
  { to: '/career', label: 'Career' },
]
export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className={styles.header}>
      <div className={`${styles.inner} wrap`}>
        <NavLink to="/" className={styles.mark} onClick={() => setOpen(false)}>
          <span className={styles.markDot} />
          SACHI
        </NavLink>

        <nav className={styles.navDesktop}>
          <ul className={styles.navList}>
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => isActive ? styles.active : ''}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <NavLink to="/donate" className={`${styles.donate} ${styles.donateDesktop}`}>Donate</NavLink>

        <button
          className={styles.menuBtn}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
       </div>

      {open && (
        <div className={styles.mobilePanel}>
          <ul className={styles.mobileList}>
            {links.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => isActive ? styles.active : ''}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <NavLink to="/donate" className={styles.donate} onClick={() => setOpen(false)}>Donate</NavLink>
        </div>
      )}
    </header>
  );
}
