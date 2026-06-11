-- Migration 971: seed the new permissions referenced after removing the
-- hardcoded `auth.role === 'superadmin'` gates. Idempotent.
--
-- Until a superadmin assigns these to specific roles, only superadmins
-- pass the checks (because hasPermission bypasses for superadmins via
-- the perm-cache).

INSERT INTO permissions (module, action, description, route_path) VALUES
  ('comments',      'moderate',           'Edit/delete other users'' comments', '/api/comments'),
  ('comments',      'manage_others',      'Same as comments.moderate (alias)',  '/api/comments'),
  ('designs',       'manage_others',      'Edit designs owned by other users',  '/api/designs'),
  ('approvals',     'view_all',           'View any approval request',          '/api/approvals'),
  ('approvals',     'override',           'Resolve approvals regardless of hierarchy', '/api/approvals'),
  ('communication', 'admin',              'Edit communication settings',        '/api/communication/admin/settings'),
  ('org',           'manage',             'Create / edit org-structure nodes',  '/api/org/structure'),
  ('staff',         'assign_any_role',    'Assign roles at or above the assigner''s authority', '/api/admin/staff'),
  ('finance',       'ledger_entry',       'Create manual ledger entries',       '/api/ledger')
ON CONFLICT DO NOTHING;
