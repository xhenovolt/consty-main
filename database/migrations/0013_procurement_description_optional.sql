-- 0013_procurement_description_optional.sql
-- item_name is now the line identity (0012); the old free-text `description`
-- becomes optional notes. Drop its NOT NULL. Idempotent.

ALTER TABLE procurement_request_lines ALTER COLUMN description DROP NOT NULL;
