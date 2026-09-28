import { useState, useCallback, useEffect } from 'react';
import { RoleContext } from './role-context-instance';
import { ASSIGNABLE_SECTIONS } from '../data/sections';
import { api } from '../../lib/api';

export function RoleProvider({ children }) {
  // `user` is whatever GET /api/auth/me returns:
  // { id, name, email, is_super_admin, permissions: { [section]: { view, edit } } }.
  // `null` means signed out, `undefined` means "still checking" on first load.
  const [user, setUser] = useState(undefined);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const me = await api.post('/api/auth/login', { email, password });
    setUser(me);
    return me;
  }, []);

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout', {});
    setUser(null);
  }, []);

  // level: 'view' (default) or 'edit'. super_admins pass everything; everyone
  // else needs an explicit per-section grant.
  const hasAccess = useCallback(
    (section, level = 'view') => {
      if (!user) return false;
      if (section === 'dashboard') return true;
      if (section === 'users') return Boolean(user.is_super_admin);
      if (user.is_super_admin) return true;
      return Boolean(user.permissions?.[section]?.[level]);
    },
    [user],
  );

  // Sections to show in the sidebar: dashboard always, users only for super
  // admins, everything else only where the user has at least view access.
  const visibleSections = user
    ? [
        'dashboard',
        ...ASSIGNABLE_SECTIONS.filter((s) => hasAccess(s, 'view')),
        ...(user.is_super_admin ? ['users'] : []),
      ]
    : [];

  const accountLabel = user ? (user.is_super_admin ? 'Super Admin' : 'Admin') : null;

  return (
    <RoleContext.Provider
      value={{
        user,
        accountLabel,
        loading: user === undefined,
        login,
        signOut,
        hasAccess,
        visibleSections,
        refreshMe,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}
