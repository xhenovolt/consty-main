-- 0009_feature_flags.sql
-- Module visibility flags. Lets us HIDE inherited Jeton modules that are not part
-- of the CONSTY project-management domain, without deleting tables/code yet
-- (reversible). The nav/app reads these via lib/feature-flags.

CREATE TABLE IF NOT EXISTS feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT true,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: enable the PM domain, disable inherited sales/design/pricing/intelligence
-- /DRAIS modules by default. Idempotent.
INSERT INTO feature_flags (key, enabled, description) VALUES
  -- CONSTY project-management domain (ON)
  ('module.projects',     true,  'Projects, WBS, governance (core CONSTY domain)'),
  ('module.resources',    true,  'Resources, materials, inventory'),
  ('module.procurement',  true,  'Procurement and goods receipt'),
  ('module.finance',      true,  'Accounts, ledger, expenses, project budgets'),
  ('module.documents',    true,  'Document control and evidence'),
  ('module.reports',      true,  'Project reports and health'),
  -- Inherited Jeton modules (OFF by default — reversible)
  ('module.sales_pipeline', false, 'Prospects, leads, proposals, bids pipeline'),
  ('module.designs',        false, 'Design studio / templates editor'),
  ('module.pricing',        false, 'Pricing plans and subscriptions'),
  ('module.intelligence',   false, 'Sales/financial/tech intelligence'),
  ('module.drais',          false, 'DRAIS external platform control'),
  ('module.offerings',      false, 'Service/package catalog & products'),
  ('module.licenses',       false, 'Software licensing')
ON CONFLICT (key) DO NOTHING;
