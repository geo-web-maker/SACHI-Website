import { useContext } from 'react';
import { RoleContext } from '../context/role-context-instance';

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}
