import { ASSIGNABLE_SECTIONS, SECTION_META } from '../../data/sections';
import styles from './PermissionMatrix.module.css';

// Reusable view/edit grid for one admin's permissions, plus the super-admin
// toggle. Used from both the "add admin" and "edit access" modals in
// UsersAdmin so the two stay visually and behaviorally identical.
export default function PermissionMatrix({
  isSuperAdmin,
  permissions,
  onChangeSuperAdmin,
  onChangePermissions,
  disabled,
}) {
  function toggle(section, level) {
    const current = permissions[section] || { view: false, edit: false };
    const next = { ...current, [level]: !current[level] };
    // Edit implies view — checking Edit turns View on too; unchecking View
    // turns Edit off too, since edit-without-view makes no sense to enforce.
    if (level === 'edit' && next.edit) next.view = true;
    if (level === 'view' && !next.view) next.edit = false;
    onChangePermissions({ ...permissions, [section]: next });
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.superAdminRow}>
        <input
          type="checkbox"
          checked={isSuperAdmin}
          onChange={(e) => onChangeSuperAdmin(e.target.checked)}
          disabled={disabled}
        />
        <span>
          <strong>Super admin</strong> — full access to every page, plus managing other admins.
          Overrides the per-page grid below.
        </span>
      </label>

      <table className={styles.grid}>
        <thead>
          <tr>
            <th>Page</th>
            <th>View</th>
            <th>Edit</th>
          </tr>
        </thead>
        <tbody>
          {ASSIGNABLE_SECTIONS.map((section) => {
            const perm = permissions[section] || { view: false, edit: false };
            return (
              <tr key={section} className={isSuperAdmin ? styles.rowDisabled : ''}>
                <td>{SECTION_META[section].label}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={isSuperAdmin || perm.view}
                    onChange={() => toggle(section, 'view')}
                    disabled={disabled || isSuperAdmin}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={isSuperAdmin || perm.edit}
                    onChange={() => toggle(section, 'edit')}
                    disabled={disabled || isSuperAdmin}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
