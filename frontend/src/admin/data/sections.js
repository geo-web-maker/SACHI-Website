// Section labels/paths, for UI rendering. The actual access — who can view or
// edit which section — lives server-side per-user in each admin's `permissions`
// doc (app/models/admin_user.py), enforced there on every request. Nothing here
// grants access on its own; it's just used to render the sidebar/labels.

export const SECTION_META = {
  dashboard: { label: 'Dashboard', path: '/admin' },
  programmes: { label: 'Programmes', path: '/admin/programmes' },
  career: { label: 'Career', path: '/admin/career' },
  gallery: { label: 'Gallery', path: '/admin/gallery' },
  contact: { label: 'Contact submissions', path: '/admin/contact' },
  donations: { label: 'Donations', path: '/admin/donations' },
  users: { label: 'Admin users', path: '/admin/users' },
};

// Sections an admin can be individually granted view/edit access to.
// "dashboard" is always viewable once signed in; "users" is super_admin-only.
// Mirrors ASSIGNABLE_SECTIONS in app/models/common.py — keep the two in sync.
export const ASSIGNABLE_SECTIONS = ['programmes', 'career', 'gallery', 'contact', 'donations'];
