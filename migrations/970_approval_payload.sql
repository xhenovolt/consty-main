-- Migration 970: Approval workflow payload + notifications.
-- Idempotent.
--
-- Purpose: when a user lacks permission to perform an action, the system
-- should NOT just throw 403 — it should offer to create an approval
-- request that captures enough context for a manager to act on it.
--
-- The new `payload` column stores the action body (method, path, JSON
-- body, etc.) so the approver can review and apply or reject the action.

ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS payload         JSONB DEFAULT '{}'::jsonb;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS required_permission VARCHAR(120);
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS denial_reason   TEXT;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS replay_path     TEXT;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS replay_method   VARCHAR(10);
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS resolved_by_replay BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_approval_requests_required_permission
  ON approval_requests(required_permission);

-- New permission so the "request approval after denial" flow is opt-in.
-- Users without this permission still see 403, just no "request approval"
-- prompt. Default-grant to all roles via a separate seeding step.
INSERT INTO permissions (module, action, description, route_path)
VALUES ('approvals','request','Request approval for a denied action','/api/approvals')
ON CONFLICT DO NOTHING;
