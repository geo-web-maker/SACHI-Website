import { useEffect, useState } from 'react';
import ProtectedSection from '../../components/ProtectedSection/ProtectedSection';
import DataTable from '../../components/DataTable/DataTable';
import StatCard from '../../components/StatCard/StatCard';
import { api } from '../../../lib/api';
import styles from './DonationsAdmin.module.css';

export default function DonationsAdmin() {
  const [donations, setDonations] = useState([]);
  const [stats, setStats] = useState({ total: 0, monthly_donors: 0, avg_gift: 0 });

  useEffect(() => {
    api.get('/api/admin/donations').then(setDonations);
    api.get('/api/admin/donations/stats').then(setStats);
  }, []);

  return (
    <ProtectedSection section="donations" title="Donations">
      <p className={styles.hint}>Read-only view. Real records land here once payments are wired up.</p>

      <div className={styles.statRow}>
        <StatCard label="Total raised" value={`UGX ${stats.total.toLocaleString()}`} />
        <StatCard label="Monthly donors" value={stats.monthly_donors} />
        <StatCard label="Average gift" value={`UGX ${stats.avg_gift.toLocaleString()}`} />
      </div>

      <DataTable
        columns={['Donor', 'Amount', 'Type', 'Method', 'Date']}
        rows={donations}
        renderRow={(d) => (
          <tr key={d.id}>
            <td className={styles.donorCell}>{d.donor}</td>
            <td className="a-mono">UGX {d.amount.toLocaleString()}</td>
            <td>
              <span className={`a-badge ${d.type === 'Monthly' ? 'a-badge-success' : 'a-badge-neutral'}`}>
                {d.type}
              </span>
            </td>
            <td>{d.method}</td>
            <td className="a-mono">{new Date(d.created_at).toLocaleDateString()}</td>
          </tr>
        )}
      />
    </ProtectedSection>
  );
}
