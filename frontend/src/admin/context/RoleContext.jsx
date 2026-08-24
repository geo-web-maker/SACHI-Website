import { useState, useCallback, useEffect } from 'react';
import { RoleContext } from './role-context-instance';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../data/roles';
import { api } from '../../lib/api';

export function RoleProvider({ children }) {
  // `user` is whatever GET /api/auth/me returns: { id, name, email, role, sections }.
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

  const hasAccess = useCallback(
    (section) => Boolean(user && user.sections?.includes(section)),
    [user],
  );

  const role = user
    ? { label: ROLE_LABELS[user.role], description: ROLE_DESCRIPTIONS[user.role], sections: user.sections }
    : null;

  return (
    <RoleContext.Provider value={{ user, role, loading: user === undefined, login, signOut, hasAccess }}>
      {children}
    </RoleContext.Provider>
  );
}
