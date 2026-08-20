import { useEffect, useState } from 'react';
import { useRole } from '../../hooks/useRole';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import StatCard from '../../components/StatCard/StatCard';
import { api } from '../../../lib/api';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { hasAccess } = useRole();
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.get('/api/admin/dashboard/stats').then(setStats);
  }, []);

  return (
    <ProtectedSection section="dashboard" title="Dashboard">
      <div className={styles.grid}>
        {hasAccess('programmes') && stats.programme_count !== undefined && (
          <StatCard label="Programme areas" value={stats.programme_count} sub="All published" />
        )}
        {hasAccess('career') && stats.open_job_count !== undefined && (
          <StatCard label="Open positions" value={stats.open_job_count} sub="Across all types" />
        )}
        {hasAccess('contact') && stats.new_message_count !== undefined && (
          <StatCard label="New messages" value={stats.new_message_count} sub="Awaiting response" />
        )}
        {hasAccess('donations') && stats.total_donations !== undefined && (
          <StatCard label="Total raised" value={`UGX ${stats.total_donations.toLocaleString()}`} sub="All-time" />
        )}
      </div>

      <div className={styles.welcome}>
        <h2>Welcome back.</h2>
        <p>
          Use the sidebar to jump into the sections your role has access to. The cards above
          only show up if the server actually returned that stat for your role — same rule the
          sidebar links follow.
        </p>
      </div>
    </ProtectedSection>
  );
}
