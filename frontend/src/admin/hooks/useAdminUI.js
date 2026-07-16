import { useContext } from 'react';
import { AdminUIContext } from '../context/admin-ui-context-instance';

export function useAdminUI() {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error('useAdminUI must be used within AdminLayout');
  return ctx;
}