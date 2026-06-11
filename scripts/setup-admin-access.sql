-- Admin Access Setup Script for Consty
-- Run this script to grant admin access to a user

-- Method 1: Make user a superadmin (highest privilege)
-- Uncomment and update the email to use this method
-- UPDATE users SET is_superadmin = true WHERE email = 'admin@consty.local';

-- Method 2: Assign admin role to user (recommended)
-- Step 1: Ensure the admin role exists
INSERT INTO roles (id, role_name, description, is_system_role, created_at, updated_at)
VALUES (
  'role_admin',
  'admin',
  'System Administrator with full access',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (role_name) DO NOTHING;

-- Step 2: Assign the admin role to your user
-- Uncomment and update the email to use this method
-- INSERT INTO user_roles (user_id, role_id, created_at)
-- SELECT u.id, r.id, NOW()
-- FROM users u, roles r
-- WHERE u.email = 'admin@consty.local' 
--   AND r.role_name = 'admin'
--   AND NOT EXISTS (
--     SELECT 1 FROM user_roles ur
--     WHERE ur.user_id = u.id AND ur.role_id = r.id
--   );

-- Verify user has admin access
-- SELECT 
--   u.id,
--   u.email,
--   u.full_name,
--   u.is_superadmin,
--   ARRAY_AGG(r.role_name) as roles
-- FROM users u
-- LEFT JOIN user_roles ur ON u.id = ur.user_id
-- LEFT JOIN roles r ON ur.role_id = r.id
-- WHERE u.email = 'admin@consty.local'
-- GROUP BY u.id, u.email, u.full_name, u.is_superadmin;

-- QUICK SETUP FOR TESTING
-- Uncomment these lines to quickly set up your user as admin:

-- Make sure the 'admin' role exists
INSERT INTO roles (id, role_name, description, is_system_role, created_at, updated_at)
VALUES (
  'role_admin',
  'admin',
  'System Administrator with full access',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (role_name) DO NOTHING;

-- Option A: Set as superadmin (quickest)
-- UPDATE users SET is_superadmin = true 
-- WHERE email = 'admin@consty.local';

-- Option B: Assign admin role
-- INSERT INTO user_roles (id, user_id, role_id, created_at)
-- SELECT gen_random_uuid(), u.id, r.id, NOW()
-- FROM users u, roles r
-- WHERE u.email = 'admin@consty.local' 
--   AND r.role_name = 'admin'
-- ON CONFLICT DO NOTHING;
