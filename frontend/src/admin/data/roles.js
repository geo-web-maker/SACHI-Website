// Role labels/descriptions for display purposes only (e.g. the "add admin" role
// picker). The actual role -> section access mapping lives server-side in
// app/models/common.py's ROLES dict, and is enforced there on every request —
// nothing here grants access on its own anymore.

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  content_manager: 'Content Manager',
  hr_manager: 'HR Manager',
  comms_manager: 'Comms Manager',
  finance_viewer: 'Finance Viewer',
};

export const ROLE_DESCRIPTIONS = {
  super_admin: 'Full access to every section, including managing other admins.',
  content_manager: 'Manages programme copy and the public photo gallery.',
  hr_manager: 'Manages open positions on the Career page.',
  comms_manager: 'Reviews and responds to contact form submissions.',
  finance_viewer: 'Read-only visibility into donation activity.',
};

export const SECTION_META = {
  dashboard: { label: 'Dashboard', path: '/admin' },
  programmes: { label: 'Programmes', path: '/admin/programmes' },
  career: { label: 'Career', path: '/admin/career' },
  gallery: { label: 'Gallery', path: '/admin/gallery' },
  contact: { label: 'Contact submissions', path: '/admin/contact' },
  donations: { label: 'Donations', path: '/admin/donations' },
  users: { label: 'Admin users', path: '/admin/users' },
};
