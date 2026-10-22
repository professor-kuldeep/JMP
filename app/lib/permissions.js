export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  editor: 'Editor',
  marketing: 'Marketing',
  viewer: 'Enquiry Viewer'
};

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard:read',
    'pages:read','pages:write','pages:publish','pages:delete','pages:restore',
    'media:read','media:write','media:delete',
    'enquiries:read','enquiries:write','enquiries:delete','enquiries:export',
    'menus:read','menus:write','forms:read','forms:write','appearance:read','appearance:write','settings:read','settings:write',
    'backup:export','security:read'
  ],
  editor: [
    'dashboard:read','pages:read','pages:write','pages:publish','pages:restore',
    'media:read','media:write','menus:read','forms:read','appearance:read','settings:read'
  ],
  marketing: [
    'dashboard:read','pages:read','pages:write','pages:publish','pages:restore',
    'media:read','media:write','forms:read','forms:write','appearance:read','settings:read'
  ],
  viewer: ['dashboard:read','enquiries:read','enquiries:write','enquiries:export']
};

export function permissionsForRole(role = 'viewer') {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

export function hasPermission(role, permission) {
  const permissions = permissionsForRole(role);
  return permissions.includes('*') || permissions.includes(permission);
}

export function assertPermission(session, permission) {
  if (!session || !hasPermission(session.role, permission)) {
    const error = new Error('You do not have permission to perform this action.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  return session;
}

export function isRole(value) {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}
