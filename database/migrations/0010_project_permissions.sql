-- 0010_project_permissions.sql
-- Seed projects.* permissions and grant them to roles. Idempotent.
-- (Superadmin bypasses checks, but seeding lets non-admin roles be granted too.)

INSERT INTO permissions (module, action, name, description)
SELECT v.module, v.action, v.name, v.description
FROM (VALUES
  ('projects','view',  'projects_view',  'View projects'),
  ('projects','create','projects_create','Create projects'),
  ('projects','edit',  'projects_edit',  'Edit projects, work items and members'),
  ('projects','delete','projects_delete','Delete projects')
) AS v(module, action, name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p WHERE p.module = v.module AND p.action = v.action
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('admin','view'),('admin','create'),('admin','edit'),('admin','delete'),
  ('project_manager','view'),('project_manager','create'),('project_manager','edit'),
  ('site_supervisor','view'),('site_supervisor','edit'),
  ('finance_manager','view'),
  ('viewer','view'),
  ('user','view')
) AS g(role_name, action)
JOIN roles r       ON r.name = g.role_name
JOIN permissions p ON p.module = 'projects' AND p.action = g.action
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
