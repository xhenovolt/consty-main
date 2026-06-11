-- =============================================================================
-- MIGRATION 946: DATA CONSISTENCY & SYSTEM LOGGING
-- 
-- Adds system_logs enhancements and data integrity checks
-- =============================================================================

-- ============================================================================
-- SECTION 1: ENHANCED SYSTEM LOGS
-- ============================================================================
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(50) DEFAULT 'info';
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS affected_records JSONB;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_resolved ON system_logs(resolved);

-- ============================================================================
-- SECTION 2: DATA CONSISTENCY VIEWS
-- ============================================================================

-- Find orphaned users (not linked to staff/roles)
CREATE OR REPLACE VIEW v_orphaned_users AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.role_id,
    u.created_at,
    'no_staff_link' AS issue_type
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM staff s WHERE s.user_id = u.id OR s.linked_user_id = u.id)
  AND u.role NOT IN ('system', 'guest')
  AND u.created_at < NOW() - INTERVAL '7 days';

-- Find orphaned staff (not linked to users)
CREATE OR REPLACE VIEW v_orphaned_staff AS
SELECT 
    s.id,
    s.name,
    s.email,
    s.user_id,
    s.linked_user_id,
    s.created_at,
    'no_user_link' AS issue_type
FROM staff s
WHERE s.user_id IS NULL
  AND s.linked_user_id IS NULL
  AND s.created_at < NOW() - INTERVAL '7 days';

-- Find invalid roles
CREATE OR REPLACE VIEW v_invalid_roles AS
SELECT 
    u.id AS user_id,
    u.username,
    u.role AS stored_role,
    u.role_id,
    'invalid_role' AS issue_type
FROM users u
WHERE u.role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role)
  AND u.role_id IS NULL;

-- Find inconsistent currencies
CREATE OR REPLACE VIEW v_inconsistent_currencies AS
SELECT 
    p.id AS payment_id,
    p.amount,
    p.currency,
    p.account_id,
    a.account_type,
    d.currency AS deal_currency,
    'currency_mismatch' AS issue_type
FROM payments p
LEFT JOIN accounts a ON p.account_id = a.id
LEFT JOIN deals d ON p.deal_id = d.id
WHERE p.currency IS NULL
  OR (d.currency IS NOT NULL AND p.currency != d.currency);

-- ============================================================================
-- SECTION 3: DATA CLEANUP PROCEDURES
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS TABLE(orphan_type TEXT, record_count INTEGER) AS $$
DECLARE
    v_orphan_users_count INTEGER := 0;
    v_orphan_staff_count INTEGER := 0;
BEGIN
    -- Log orphaned users
    INSERT INTO system_logs (level, module, action, message, details)
    SELECT 'warn', 'cleanup', 'orphan_users', 
           'Found ' || COUNT(*)::TEXT || ' orphaned user(s)',
           jsonb_agg(jsonb_build_object('id', id, 'username', username))
    FROM v_orphaned_users;
    
    GET DIAGNOSTICS v_orphan_users_count = ROW_COUNT;
    
    -- Log orphaned staff  
    INSERT INTO system_logs (level, module, action, message, details)
    SELECT 'warn', 'cleanup', 'orphan_staff',
           'Found ' || COUNT(*)::TEXT || ' orphaned staff record(s)',
           jsonb_agg(jsonb_build_object('id', id, 'name', name))
    FROM v_orphaned_staff;
    
    GET DIAGNOSTICS v_orphan_staff_count = ROW_COUNT;
    
    RETURN QUERY SELECT 'orphaned_users'::TEXT, v_orphan_users_count;
    RETURN QUERY SELECT 'orphaned_staff'::TEXT, v_orphan_staff_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 4: SESSION INVALIDATION PROCEDURES
-- ============================================================================

CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id UUID, p_reason TEXT DEFAULT 'manual_invalidation')
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE sessions
    SET invalidated_at = CURRENT_TIMESTAMP,
        invalidation_reason = p_reason
    WHERE user_id = p_user_id
      AND invalidated_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    INSERT INTO system_logs (level, module, action, message, details)
    VALUES ('info', 'sessions', 'invalidate_user_sessions',
            'Invalidated ' || v_count::TEXT || ' session(s)',
            jsonb_build_object('user_id', p_user_id::TEXT, 'reason', p_reason, 'count', v_count));
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: STAFF DELETION WITH SESSION CLEANUP
-- ============================================================================

CREATE OR REPLACE FUNCTION on_staff_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate all sessions for the staff's user
    IF OLD.user_id IS NOT NULL THEN
        PERFORM invalidate_user_sessions(OLD.user_id, 'staff_deleted');
    END IF;
    
    -- Log the deletion
    INSERT INTO system_logs (level, module, action, message, details)
    VALUES ('warn', 'staff', 'staff_deleted',
            'Staff record deleted: ' || OLD.name,
            jsonb_build_object('staff_id', OLD.id::TEXT, 'user_id', COALESCE(OLD.user_id::TEXT, 'unknown')));
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to recreate
DROP TRIGGER IF EXISTS trg_staff_delete ON staff;

CREATE TRIGGER trg_staff_delete
BEFORE DELETE ON staff
FOR EACH ROW
EXECUTE FUNCTION on_staff_delete();

-- ============================================================================
-- SECTION 6: STAFF DEACTIVATION WITH SESSION CLEANUP
-- ============================================================================

CREATE OR REPLACE FUNCTION on_staff_deactivate()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed to suspended/inactive, invalidate sessions
    IF OLD.account_status != NEW.account_status 
       AND NEW.account_status IN ('suspended', 'inactive', 'deactivated')
       AND NEW.user_id IS NOT NULL THEN
        PERFORM invalidate_user_sessions(NEW.user_id, 'staff_deactivated: ' || NEW.account_status);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_deactivate ON staff;

CREATE TRIGGER trg_staff_deactivate
BEFORE UPDATE ON staff
FOR EACH ROW
EXECUTE FUNCTION on_staff_deactivate();

-- ============================================================================
-- SECTION 7: PRESENCE STATUS CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_online_status(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_last_seen TIMESTAMP;
    v_minutes_ago INTEGER;
BEGIN
    SELECT last_seen_at INTO v_last_seen FROM users WHERE id = p_user_id;
    
    IF v_last_seen IS NULL THEN
        RETURN 'offline';
    END IF;
    
    v_minutes_ago := EXTRACT(EPOCH FROM (NOW() - v_last_seen))::INTEGER / 60;
    
    IF v_minutes_ago < 1 THEN
        RETURN 'online';
    ELSIF v_minutes_ago <= 5 THEN
        RETURN 'away';
    ELSE
        RETURN 'offline';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: MULTI-CURRENCY CONVERSION
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_payment_to_ugx(
    p_amount DECIMAL,
    p_currency VARCHAR(3),
    p_exchange_rate DECIMAL DEFAULT NULL
)
RETURNS DECIMAL AS $$
BEGIN
    IF p_currency = 'UGX' THEN
        RETURN p_amount;
    ELSIF p_exchange_rate IS NOT NULL THEN
        RETURN p_amount * p_exchange_rate;
    ELSE
        -- Default fallback rates (should be fetched from config)
        CASE p_currency
            WHEN 'USD' THEN RETURN p_amount * 3800;
            WHEN 'EUR' THEN RETURN p_amount * 4200;
            WHEN 'GBP' THEN RETURN p_amount * 4800;
            ELSE RETURN p_amount;
        END CASE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FINAL: SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 946 applied: Data consistency and system logging enhancements';
  RAISE NOTICE 'Added: Orphan detection views, cleanup procedures, session invalidation';
  RAISE NOTICE 'Added: Triggers for staff deletion/deactivation, presence calculation';
END $$;
