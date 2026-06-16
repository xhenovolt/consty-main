-- 0011_nav_reset_flags.sql
-- Phase 0 (Navigation Reset): seed feature flags for the inherited CRM funnel
-- and parked company-OS modules. Hidden by default; reversible. Idempotent.

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('module.business_dev', false, 'CRM sales funnel: pipeline, leads, proposals, follow-ups, payments, invoices'),
  ('module.legacy',       false, 'Parked inherited company-OS modules (items/products/media/systems/ops/etc.)')
ON CONFLICT (key) DO NOTHING;
