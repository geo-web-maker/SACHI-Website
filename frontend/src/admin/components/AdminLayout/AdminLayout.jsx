import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import Sidebar from '../Sidebar/Sidebar';
import '../../styles/admin-tokens.css';
import { AdminUIContext } from '../../context/admin-ui-context-instance';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const { role, loading } = useRole();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return null;
  }

  if (!role) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <AdminUIContext.Provider value={{ sidebarOpen, toggleSidebar, closeSidebar }}>
      <div className={`admin-shell ${styles.shell}`}>
        <Sidebar />
        <div className={styles.main}>
          <Outlet />
        </div>
      </div>
    </AdminUIContext.Provider>
  );
}
