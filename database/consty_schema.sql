--
-- PostgreSQL database dump
--

\restrict cMAdi5kX6RYPzKbaXRdeRKvzLHMK9gymokX5b6QgyEQmtKdG17lyKRGece3MAnu

-- Dumped from database version 17.10 (98a80fa)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: mirror_staff_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mirror_staff_user_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM NEW.linked_user_id THEN
    IF NEW.user_id IS NOT NULL AND NEW.linked_user_id IS NULL THEN
      NEW.linked_user_id := NEW.user_id;
    ELSIF NEW.linked_user_id IS NOT NULL AND NEW.user_id IS NULL THEN
      NEW.user_id := NEW.linked_user_id;
    ELSE
      -- Both set but different — prefer user_id as canonical
      NEW.linked_user_id := NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: refresh_presence_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_presence_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.status =
    CASE
      WHEN NOW() - NEW.last_ping < INTERVAL '60 seconds'  THEN 'online'
      WHEN NOW() - NEW.last_ping < INTERVAL '5 minutes'   THEN 'away'
      ELSE 'offline'
    END;
  RETURN NEW;
END;
$$;


--
-- Name: refresh_user_presence_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_user_presence_status() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE user_presence
  SET status = CASE
    WHEN NOW() - last_ping < INTERVAL '60 seconds' THEN 'online'
    ELSE 'offline'
  END;
END;
$$;


--
-- Name: resolve_actor_authority(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_actor_authority(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_authority integer;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = p_user_id;
  IF v_role = 'superadmin' THEN RETURN 100; END IF;

  SELECT COALESCE(MAX(r.authority_level), 10)
  INTO v_authority
  FROM users u
  JOIN staff s ON u.staff_id = s.id
  JOIN staff_roles sr ON sr.staff_id = s.id
  JOIN roles r ON sr.role_id = r.id
  WHERE u.id = p_user_id;

  RETURN COALESCE(v_authority, 10);
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: sync_user_authority_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_authority_level() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Re-compute authority_level for the user linked to this staff record
  UPDATE users u
  SET authority_level = (
    SELECT COALESCE(MAX(r.authority_level), 10)
    FROM staff_roles sr2
    JOIN roles r ON sr2.role_id = r.id
    WHERE sr2.staff_id = COALESCE(NEW.staff_id, OLD.staff_id)
  )
  FROM staff s
  WHERE s.id = COALESCE(NEW.staff_id, OLD.staff_id)
    AND u.staff_id = s.id
    AND u.role != 'superadmin';
  RETURN NEW;
END;
$$;


--
-- Name: update_system_intelligence_search_vector(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_system_intelligence_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _deprecated_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._deprecated_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    value numeric(15,2),
    currency character varying(10) DEFAULT 'UGX'::character varying,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    asset_type character varying(100) DEFAULT 'equipment'::character varying,
    cost numeric(15,2),
    current_value numeric(15,2),
    acquisition_date date,
    is_historical boolean DEFAULT false,
    account_deducted_from uuid,
    ledger_entry_id uuid,
    condition character varying(30) DEFAULT 'good'::character varying,
    location character varying(255),
    serial_number character varying(255),
    notes text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: _deprecated_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._deprecated_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    cost numeric(15,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    usage_notes text,
    provider character varying(255),
    renewal_date date,
    serial_number character varying(255),
    assigned_to uuid,
    acquisition_date date,
    status character varying(30) DEFAULT 'active'::character varying,
    tags jsonb DEFAULT '{}'::jsonb,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT resources_category_check CHECK (((category)::text = ANY ((ARRAY['business_tool'::character varying, 'infrastructure'::character varying, 'hardware'::character varying])::text[]))),
    CONSTRAINT resources_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'retired'::character varying, 'pending'::character varying, 'maintenance'::character varying])::text[])))
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    description text,
    institution character varying(255),
    account_number character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_type_check CHECK (((type)::text = ANY ((ARRAY['bank'::character varying, 'cash'::character varying, 'mobile_money'::character varying, 'credit_card'::character varying, 'investment'::character varying, 'escrow'::character varying, 'savings'::character varying, 'internal'::character varying, 'salary'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) DEFAULT 'page_view'::character varying NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    route character varying(500),
    page_title character varying(255),
    details jsonb DEFAULT '{}'::jsonb,
    session_id uuid,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_role_id uuid,
    actor_authority_level integer DEFAULT 0 NOT NULL
);


--
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allocations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payment_id uuid,
    category character varying(100) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resource_type character varying(50),
    resource_id uuid,
    source_account_id uuid,
    CONSTRAINT allocations_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT allocations_category_check CHECK (((category)::text = ANY ((ARRAY['data'::character varying, 'software_tools'::character varying, 'hosting'::character varying, 'food'::character varying, 'transport'::character varying, 'operations'::character varying, 'savings'::character varying, 'rent'::character varying, 'hardware'::character varying, 'marketing'::character varying, 'salaries'::character varying, 'taxes'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    requester_user_id uuid NOT NULL,
    target_record_type character varying(100) NOT NULL,
    target_record_id uuid NOT NULL,
    action_requested character varying(50) NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approver_user_id uuid,
    approver_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    required_authority_rank integer DEFAULT 0,
    current_authority_rank integer DEFAULT 0,
    escalation_path jsonb DEFAULT '[]'::jsonb,
    category character varying(50),
    payload jsonb DEFAULT '{}'::jsonb,
    required_permission character varying(120),
    denial_reason text,
    replay_path text,
    replay_method character varying(10),
    resolved_by_replay boolean DEFAULT false,
    CONSTRAINT approval_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(500) NOT NULL,
    entity_type character varying(255) NOT NULL,
    entity_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_agent text
);


--
-- Name: auth_passkeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_passkeys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id text NOT NULL,
    public_key text NOT NULL,
    counter bigint DEFAULT 0 NOT NULL,
    device_name text DEFAULT 'My Device'::text NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb,
    aaguid text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: authority_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authority_levels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    rank_value integer DEFAULT 0 NOT NULL,
    color_indicator character varying(20) DEFAULT '#3b82f6'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: backup_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    backup_type character varying(30) DEFAULT 'full'::character varying NOT NULL,
    schedule_cron character varying(100),
    storage_target_id uuid,
    encrypt boolean DEFAULT false NOT NULL,
    compress boolean DEFAULT true NOT NULL,
    retention_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    last_status character varying(20),
    next_run_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_jobs_backup_type_check CHECK (((backup_type)::text = ANY ((ARRAY['full'::character varying, 'schema_only'::character varying, 'data_only'::character varying, 'incremental'::character varying])::text[])))
);


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_id uuid,
    job_id uuid,
    level character varying(10) DEFAULT 'info'::character varying NOT NULL,
    phase character varying(40),
    message text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_logs_level_check CHECK (((level)::text = ANY ((ARRAY['debug'::character varying, 'info'::character varying, 'warn'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: backup_restores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_restores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_id uuid NOT NULL,
    preview_only boolean DEFAULT false NOT NULL,
    scope character varying(20) DEFAULT 'full'::character varying NOT NULL,
    target_tables text[],
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    preview_summary jsonb,
    rows_affected integer,
    tables_affected integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    requested_by uuid,
    approved_by uuid,
    approval_reason text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_restores_scope_check CHECK (((scope)::text = ANY ((ARRAY['full'::character varying, 'tables'::character varying, 'schema_only'::character varying, 'data_only'::character varying])::text[]))),
    CONSTRAINT backup_restores_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'previewing'::character varying, 'approved'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: backup_storage_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_storage_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    type character varying(20) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_storage_targets_type_check CHECK (((type)::text = ANY ((ARRAY['local'::character varying, 'cloudinary'::character varying, 's3'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: budget_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category character varying(100) NOT NULL,
    expected_amount numeric(15,2) DEFAULT 0 NOT NULL,
    current_amount numeric(15,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    period character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    period_start date,
    period_end date,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT budget_period_check CHECK (((period)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying])::text[])))
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    period character varying(30) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    alert_threshold numeric(5,2) DEFAULT 80.00,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    allocation_percentage numeric(5,2),
    expected_purchase_date date,
    items_needed text,
    CONSTRAINT budgets_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT budgets_period_check CHECK (((period)::text = ANY (ARRAY[('monthly'::character varying)::text, ('quarterly'::character varying)::text, ('yearly'::character varying)::text, ('custom'::character varying)::text]))),
    CONSTRAINT valid_date_range CHECK ((end_date > start_date))
);


--
-- Name: bug_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bug_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    module_affected character varying(100),
    reported_by_user uuid,
    assigned_developer uuid,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    time_to_resolve interval,
    CONSTRAINT bug_severity_check CHECK (((severity)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT bug_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying, 'wont_fix'::character varying])::text[])))
);


--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    caller_id uuid NOT NULL,
    call_type character varying(50) DEFAULT 'audio'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone,
    duration_seconds integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: call_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    left_at timestamp without time zone
);


--
-- Name: call_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid,
    can_start_audio_calls boolean DEFAULT true,
    can_start_video_calls boolean DEFAULT true,
    can_record_calls boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    call_type character varying(50) NOT NULL,
    conversation_id uuid NOT NULL,
    caller_id uuid NOT NULL,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    duration_seconds integer,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    participants_json jsonb,
    recording_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    CONSTRAINT calls_call_type_check CHECK (((call_type)::text = ANY ((ARRAY['audio'::character varying, 'video'::character varying])::text[]))),
    CONSTRAINT calls_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'ringing'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'declined'::character varying, 'missed'::character varying])::text[])))
);


--
-- Name: capital_allocation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capital_allocation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_name character varying(100) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT alloc_category_check CHECK (((category)::text = ANY ((ARRAY['operations'::character varying, 'reinvestment'::character varying, 'emergency_fund'::character varying, 'founder_incentive'::character varying, 'savings'::character varying, 'marketing'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT alloc_pct_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))
);


--
-- Name: client_obligations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_obligations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid,
    client_id uuid,
    system_id uuid,
    title character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    assigned_to uuid,
    due_date date,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT client_obligations_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT client_obligations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prospect_id uuid,
    company_name character varying(255) NOT NULL,
    contact_name character varying(255),
    email character varying(255),
    phone character varying(50),
    website character varying(500),
    industry character varying(100),
    billing_address text,
    tax_id character varying(100),
    payment_terms integer DEFAULT 30,
    preferred_currency character varying(3) DEFAULT 'UGX'::character varying,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    lifetime_value numeric(15,2) DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clients_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('suspended'::character varying)::text, ('churned'::character varying)::text])))
);


--
-- Name: cloud_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloud_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(50) DEFAULT 'cloudinary'::character varying NOT NULL,
    account_name character varying(100) NOT NULL,
    cloud_name character varying(100) NOT NULL,
    api_key character varying(255) NOT NULL,
    api_secret character varying(255) NOT NULL,
    is_primary boolean DEFAULT false,
    is_active boolean DEFAULT true,
    usage_bytes bigint DEFAULT 0,
    max_bytes bigint DEFAULT '10737418240'::bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: communication_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    conversation_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: communication_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_type character varying(50) NOT NULL,
    message_id uuid,
    call_id uuid,
    conversation_id uuid,
    from_user_id uuid,
    title text,
    body text,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: communication_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: company_branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_name character varying(255) NOT NULL,
    organization_slug character varying(100) NOT NULL,
    logo_url text,
    logo_width integer DEFAULT 100,
    logo_height integer DEFAULT 100,
    header_text text,
    footer_text text,
    signature_url text,
    signature_name character varying(255),
    signature_title character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    postal_code character varying(20),
    country character varying(100),
    phone character varying(20),
    email character varying(255),
    website character varying(255),
    primary_color character varying(7) DEFAULT '#1F2937'::character varying,
    secondary_color character varying(7) DEFAULT '#3B82F6'::character varying,
    accent_color character varying(7) DEFAULT '#10B981'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    key character varying(100) NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    left_at timestamp without time zone,
    muted boolean DEFAULT false,
    is_active boolean DEFAULT true,
    CONSTRAINT conversation_participants_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) DEFAULT 'direct'::character varying NOT NULL,
    name character varying(255),
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_archived boolean DEFAULT false,
    deleted_at timestamp without time zone,
    last_message_at timestamp without time zone,
    CONSTRAINT conversations_type_check CHECK (((type)::text = ANY ((ARRAY['direct'::character varying, 'group'::character varying, 'department'::character varying])::text[])))
);


--
-- Name: dashboard_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid,
    role_name character varying(100) NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid,
    prospect_id uuid,
    offering_id uuid,
    title character varying(255) NOT NULL,
    description text,
    total_amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    start_date date,
    end_date date,
    due_date date,
    closed_at timestamp with time zone,
    invoice_number character varying(100),
    invoice_sent_at timestamp with time zone,
    invoice_pdf_url text,
    terms text,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    system_id uuid,
    client_name character varying(255),
    service_id uuid,
    plan_id uuid,
    original_price numeric(15,2),
    negotiated_price numeric(15,2),
    installation_fee numeric(15,2) DEFAULT 0,
    upfront_paid numeric(15,2) DEFAULT 0,
    stage character varying(50) DEFAULT 'qualification'::character varying,
    CONSTRAINT deals_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'accepted'::character varying, 'negotiation'::character varying, 'in_progress'::character varying, 'payment_pending'::character varying, 'completed'::character varying, 'closed_won'::character varying, 'closed_lost'::character varying, 'cancelled'::character varying, 'disputed'::character varying])::text[])))
);


--
-- Name: department_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    media_id uuid,
    title character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: department_kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    target_value numeric(15,2),
    current_value numeric(15,2) DEFAULT 0,
    unit character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: department_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: department_processes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_processes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(30) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: department_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_lead boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(255),
    alias character varying(100),
    parent_department_id uuid,
    head_user_id uuid,
    color character varying(20) DEFAULT '#3b82f6'::character varying,
    icon character varying(50),
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_reason text,
    deactivated_at timestamp with time zone,
    deactivated_by uuid
);


--
-- Name: design_asset_collection_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_asset_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    display_order integer DEFAULT 0
);


--
-- Name: design_asset_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_asset_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    cover_url text,
    is_shared boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    asset_type character varying(40) NOT NULL,
    category character varying(50),
    file_url text NOT NULL,
    thumbnail_url text,
    width integer,
    height integer,
    mime_type character varying(60),
    file_size bigint,
    tags text[] DEFAULT '{}'::text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_assets_asset_type_check CHECK (((asset_type)::text = ANY ((ARRAY['logo'::character varying, 'illustration'::character varying, 'photo'::character varying, 'icon'::character varying, 'shape'::character varying, 'svg'::character varying, 'font'::character varying, 'pattern'::character varying, 'mockup'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: design_brandkits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_brandkits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    logos jsonb DEFAULT '[]'::jsonb,
    palette jsonb DEFAULT '[]'::jsonb,
    typography jsonb DEFAULT '[]'::jsonb,
    voice jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid NOT NULL,
    format character varying(10) NOT NULL,
    width integer,
    height integer,
    dpi integer DEFAULT 96,
    file_url text,
    file_size bigint,
    exported_by uuid,
    exported_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_exports_format_check CHECK (((format)::text = ANY ((ARRAY['png'::character varying, 'jpg'::character varying, 'svg'::character varying, 'pdf'::character varying])::text[])))
);


--
-- Name: design_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_layers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    design_id uuid NOT NULL,
    layer_key character varying(120) NOT NULL,
    layer_type character varying(40) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    opacity numeric(5,3) DEFAULT 1.0 NOT NULL,
    blend_mode character varying(40),
    rotation numeric(7,3) DEFAULT 0,
    "position" jsonb DEFAULT '{}'::jsonb,
    size jsonb DEFAULT '{}'::jsonb,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_project_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_project_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    design_id uuid NOT NULL,
    display_order integer DEFAULT 0
);


--
-- Name: design_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    brandkit_id uuid,
    cover_design_id uuid,
    is_archived boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_template_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    canvas jsonb NOT NULL,
    layers jsonb NOT NULL,
    thumbnail_url text,
    changelog text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: design_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category character varying(50),
    thumbnail_url text,
    preview_url text,
    canvas jsonb DEFAULT '{"width": 1080, "height": 1080}'::jsonb NOT NULL,
    layers jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT false NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    current_version integer DEFAULT 1 NOT NULL,
    use_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: developer_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.developer_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    system_id uuid,
    activity_type character varying(50) NOT NULL,
    notes text,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    finished_at timestamp without time zone,
    time_spent interval,
    CONSTRAINT dev_activity_type_check CHECK (((activity_type)::text = ANY ((ARRAY['bug_fix'::character varying, 'feature_implementation'::character varying, 'investigation'::character varying, 'code_review'::character varying, 'deployment'::character varying, 'documentation'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: doc_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_id uuid NOT NULL,
    content_snapshot text NOT NULL,
    version character varying(20) NOT NULL,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255),
    content text DEFAULT ''::text NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    version character varying(20) DEFAULT '1.0'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: document_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    step_order integer NOT NULL,
    approver_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    decision_at timestamp with time zone,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: document_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_audit_logs_action_check CHECK ((action = ANY (ARRAY['generated'::text, 'viewed'::text, 'downloaded'::text, 'revoked'::text, 'restored'::text, 'updated'::text])))
);


--
-- Name: document_branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_name text NOT NULL,
    header_text text,
    primary_color text DEFAULT '#1F2937'::text NOT NULL,
    secondary_color text DEFAULT '#374151'::text NOT NULL,
    accent_color text DEFAULT '#3B82F6'::text NOT NULL,
    logo_url text,
    logo_width integer DEFAULT 100,
    logo_height integer DEFAULT 60,
    signature_url text,
    signature_name text,
    signature_title text,
    address_line1 text,
    city text,
    postal_code text,
    phone text,
    email text,
    website text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    parent_id uuid,
    author_id uuid,
    body text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    path text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    relationship character varying(40) DEFAULT 'attached'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    principal_type character varying(20) NOT NULL,
    principal_id uuid NOT NULL,
    permission character varying(20) NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_permissions_permission_check CHECK (((permission)::text = ANY ((ARRAY['view'::character varying, 'comment'::character varying, 'edit'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT document_permissions_principal_type_check CHECK (((principal_type)::text = ANY ((ARRAY['user'::character varying, 'department'::character varying, 'role'::character varying])::text[])))
);


--
-- Name: document_tag_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tag_links (
    document_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    color character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50),
    body text,
    body_format character varying(20) DEFAULT 'markdown'::character varying,
    variables jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_verification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_verification_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    ip_address inet NOT NULL,
    user_agent text,
    verification_status text DEFAULT 'success'::text NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_verification_logs_verification_status_check CHECK ((verification_status = ANY (ARRAY['success'::text, 'failed'::text, 'tampered'::text])))
);


--
-- Name: document_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_document_id uuid NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    verification_token character varying(255),
    viewer_ip character varying(45),
    viewer_user_agent text,
    verification_status character varying(20) DEFAULT 'valid'::character varying NOT NULL,
    viewer_name character varying(255),
    viewer_email character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_verifications_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['valid'::character varying, 'revoked'::character varying, 'expired'::character varying, 'not_found'::character varying])::text[])))
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version integer NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    body_format character varying(20),
    file_url text,
    file_name character varying(255),
    file_size bigint,
    changelog text,
    is_current boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    file_url text,
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),
    uploaded_by uuid,
    description text,
    tags text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    folder_id uuid,
    template_id uuid,
    body_format character varying(20),
    body text,
    current_version integer DEFAULT 1,
    approval_status character varying(20) DEFAULT 'draft'::character varying,
    approved_at timestamp with time zone,
    approved_by uuid,
    visibility character varying(20) DEFAULT 'internal'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT documents_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['draft'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT documents_body_format_check CHECK (((body_format IS NULL) OR ((body_format)::text = ANY ((ARRAY['markdown'::character varying, 'rich'::character varying, 'plain'::character varying, 'html'::character varying])::text[])))),
    CONSTRAINT documents_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['private'::character varying, 'internal'::character varying, 'department'::character varying, 'public'::character varying])::text[])))
);


--
-- Name: drais_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drais_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    positioning text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    comparison_matrix jsonb
);


--
-- Name: employee_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    account_id uuid NOT NULL,
    balance numeric(15,2) DEFAULT 0.00,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_account_id uuid,
    full_name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    role_id uuid,
    department_id uuid,
    employment_status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    employment_type character varying(30) DEFAULT 'full_time'::character varying,
    salary numeric(15,2),
    salary_currency character varying(10) DEFAULT 'UGX'::character varying,
    hired_date date,
    end_date date,
    manager_id uuid,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT emp_status_check CHECK (((employment_status)::text = ANY ((ARRAY['active'::character varying, 'on_leave'::character varying, 'terminated'::character varying, 'probation'::character varying, 'contract'::character varying])::text[]))),
    CONSTRAINT emp_type_check CHECK (((employment_type)::text = ANY ((ARRAY['full_time'::character varying, 'part_time'::character varying, 'contract'::character varying, 'intern'::character varying, 'freelance'::character varying])::text[])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(64) NOT NULL,
    entity_type character varying(64),
    entity_id uuid,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_currency character varying(3) NOT NULL,
    to_currency character varying(3) NOT NULL,
    rate numeric(15,6) NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    source character varying(100) DEFAULT 'manual'::character varying,
    notes text,
    is_current boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exchange_rates_rate_check CHECK ((rate > (0)::numeric))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    category character varying(100) NOT NULL,
    subcategory character varying(100),
    vendor character varying(255),
    description text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    receipt_url text,
    is_recurring boolean DEFAULT false NOT NULL,
    recurrence_interval character varying(30),
    status character varying(30) DEFAULT 'recorded'::character varying NOT NULL,
    budget_id uuid,
    tags text[] DEFAULT '{}'::text[],
    notes text,
    ledger_entry_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT expenses_status_check CHECK (((status)::text = ANY (ARRAY[('recorded'::character varying)::text, ('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('void'::character varying)::text])))
);


--
-- Name: external_connection_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_connection_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid,
    action character varying(100),
    method character varying(10),
    endpoint character varying(500),
    status_code integer,
    request_count integer DEFAULT 1,
    error_message text,
    executed_by uuid,
    executed_at timestamp without time zone DEFAULT now(),
    response_time_ms integer
);


--
-- Name: external_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    system_type character varying(50) DEFAULT 'drais'::character varying NOT NULL,
    base_url character varying(500) NOT NULL,
    api_key_encrypted character varying(1000) NOT NULL,
    api_secret_encrypted character varying(1000) NOT NULL,
    is_active boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    last_tested_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    rotated_at timestamp without time zone,
    last_rotated_by uuid,
    rotation_enabled boolean DEFAULT true
);


--
-- Name: feature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    feature_title character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    requested_by character varying(255),
    assigned_developer uuid,
    status character varying(30) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    CONSTRAINT feature_priority_check CHECK (((priority)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT feature_status_check CHECK (((status)::text = ANY ((ARRAY['proposed'::character varying, 'approved'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.followups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prospect_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    summary text,
    outcome text,
    next_action text,
    next_followup_date date,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT followups_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('rescheduled'::character varying)::text, ('no_show'::character varying)::text]))),
    CONSTRAINT followups_type_check CHECK (((type)::text = ANY (ARRAY[('call'::character varying)::text, ('email'::character varying)::text, ('meeting'::character varying)::text, ('demo'::character varying)::text, ('proposal'::character varying)::text, ('site_visit'::character varying)::text, ('social'::character varying)::text, ('other'::character varying)::text])))
);


--
-- Name: generated_document_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_document_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_document_id uuid NOT NULL,
    level text NOT NULL,
    phase text NOT NULL,
    message text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generated_document_logs_level_check CHECK ((level = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: generated_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    unique_id text NOT NULL,
    title text NOT NULL,
    document_type text NOT NULL,
    recipient_name text NOT NULL,
    recipient_email text,
    recipient_phone text,
    placeholder_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    verification_token text NOT NULL,
    verification_hash text NOT NULL,
    html_content text,
    pdf_url text,
    category_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branding_id uuid,
    viewed_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generated_documents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text])))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    key character varying(255) NOT NULL,
    user_id uuid,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: identity_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(40) NOT NULL,
    user_id uuid,
    staff_id uuid,
    actor_id uuid,
    reason text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: identity_health_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_health_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by uuid,
    total_users integer NOT NULL,
    total_staff integer NOT NULL,
    phantom_users integer NOT NULL,
    staff_no_user integer NOT NULL,
    pointer_mismatches integer NOT NULL,
    dangling_refs integer NOT NULL,
    orphan_sessions integer NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    passed boolean NOT NULL
);


--
-- Name: intellectual_property; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intellectual_property (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_sequences (
    year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    deal_id uuid,
    payment_id uuid,
    client_id uuid,
    client_name character varying(255) NOT NULL,
    client_email character varying(255),
    client_phone character varying(50),
    client_address text,
    system_id uuid,
    system_name character varying(255),
    plan_name character varying(100),
    deal_title character varying(255),
    deal_total_amount numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    total_paid_before numeric(15,2) DEFAULT 0,
    total_paid_after numeric(15,2) DEFAULT 0,
    remaining_balance numeric(15,2) DEFAULT 0,
    payment_method character varying(100),
    payment_reference character varying(255),
    issued_by_user_id uuid,
    issued_by_name character varying(255) DEFAULT 'Authorized Officer'::character varying,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'paid'::character varying NOT NULL,
    file_url text,
    notes text,
    company_name character varying(255) DEFAULT 'Consty'::character varying,
    company_address text DEFAULT ''::text,
    company_phone character varying(50) DEFAULT '+256 XXX XXX XXX'::character varying,
    company_email character varying(255) DEFAULT 'info@consty.local'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_status_check CHECK (((status)::text = ANY ((ARRAY['paid'::character varying, 'pending'::character varying, 'cancelled'::character varying, 'draft'::character varying])::text[])))
);


--
-- Name: issue_resolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bug_report_id uuid,
    resolution_type character varying(50) DEFAULT 'fix'::character varying NOT NULL,
    description text NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    time_to_resolve_hours numeric(10,2),
    files_changed text[],
    verification_steps text,
    is_verified boolean DEFAULT false NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ir_type_check CHECK (((resolution_type)::text = ANY ((ARRAY['fix'::character varying, 'workaround'::character varying, 'wont_fix'::character varying, 'duplicate'::character varying, 'by_design'::character varying, 'config_change'::character varying])::text[])))
);


--
-- Name: issue_root_causes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_root_causes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bug_report_id uuid,
    root_cause text NOT NULL,
    category character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
    identified_by uuid,
    identified_at timestamp with time zone DEFAULT now() NOT NULL,
    prevention_strategy text,
    tags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT irc_category_check CHECK (((category)::text = ANY ((ARRAY['code_bug'::character varying, 'design_flaw'::character varying, 'missing_validation'::character varying, 'integration'::character varying, 'performance'::character varying, 'security'::character varying, 'configuration'::character varying, 'data_issue'::character varying, 'third_party'::character varying, 'infrastructure'::character varying, 'unknown'::character varying])::text[])))
);


--
-- Name: item_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT item_activity_log_action_check CHECK (((action)::text = ANY ((ARRAY['created'::character varying, 'edited'::character varying, 'assigned'::character varying, 'status_changed'::character varying, 'retired'::character varying, 'restored'::character varying])::text[])))
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    financial_class character varying(30) DEFAULT 'asset'::character varying NOT NULL,
    purchase_cost numeric(15,2),
    current_value numeric(15,2),
    currency character varying(10) DEFAULT 'UGX'::character varying,
    acquisition_date date,
    assigned_to uuid,
    linked_system uuid,
    revenue_dependency boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    condition character varying(20) DEFAULT 'good'::character varying,
    provider character varying(255),
    renewal_date date,
    serial_number character varying(255),
    location character varying(255),
    is_historical boolean DEFAULT false,
    account_deducted_from uuid,
    ledger_entry_id uuid,
    migrated_from_asset uuid,
    migrated_from_resource uuid,
    notes text,
    usage_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT items_category_check CHECK (((category)::text = ANY ((ARRAY['hardware'::character varying, 'clothing'::character varying, 'infrastructure'::character varying, 'transport'::character varying, 'office_equipment'::character varying, 'branding_material'::character varying, 'software'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT items_condition_check CHECK (((condition)::text = ANY ((ARRAY['new'::character varying, 'good'::character varying, 'fair'::character varying, 'poor'::character varying, 'damaged'::character varying])::text[]))),
    CONSTRAINT items_financial_class_check CHECK (((financial_class)::text = ANY ((ARRAY['asset'::character varying, 'operational_asset'::character varying, 'expense_item'::character varying])::text[]))),
    CONSTRAINT items_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'retired'::character varying, 'lost'::character varying, 'damaged'::character varying, 'maintenance'::character varying])::text[]))),
    CONSTRAINT items_type_check CHECK (((type)::text = ANY ((ARRAY['development_tool'::character varying, 'sales_tool'::character varying, 'infrastructure'::character varying, 'equipment'::character varying, 'branding'::character varying, 'transport'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    author_id uuid,
    author_name character varying(255),
    tags text[],
    is_published boolean DEFAULT true,
    view_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT kb_category_check CHECK (((category)::text = ANY ((ARRAY['technical'::character varying, 'operational'::character varying, 'financial'::character varying, 'training'::character varying, 'policy'::character varying, 'general'::character varying])::text[])))
);


--
-- Name: knowledge_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    system_id uuid,
    author_id uuid,
    visibility character varying(20) DEFAULT 'internal'::character varying NOT NULL,
    content text,
    version integer DEFAULT 1 NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT knowledge_assets_category_check CHECK (((category)::text = ANY ((ARRAY['system_architecture'::character varying, 'deployment_guide'::character varying, 'sales_playbook'::character varying, 'support_documentation'::character varying, 'development_notes'::character varying, 'infrastructure'::character varying, 'feature_documentation'::character varying, 'development_standards'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT knowledge_assets_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT knowledge_assets_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['private'::character varying, 'internal'::character varying, 'public'::character varying])::text[])))
);


--
-- Name: knowledge_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    knowledge_id uuid NOT NULL,
    version integer NOT NULL,
    content text,
    edited_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    running_balance numeric(15,2),
    source_type character varying(50) NOT NULL,
    source_id uuid,
    description text NOT NULL,
    category character varying(100),
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    original_currency character varying(3),
    exchange_rate numeric(15,6) DEFAULT 1.0,
    original_amount numeric(15,2),
    CONSTRAINT ledger_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('payment'::character varying)::text, ('expense'::character varying)::text, ('transfer_in'::character varying)::text, ('transfer_out'::character varying)::text, ('adjustment'::character varying)::text, ('refund'::character varying)::text, ('initial_balance'::character varying)::text])))
);


--
-- Name: liabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    amount numeric(15,2),
    currency character varying(10) DEFAULT 'UGX'::character varying,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: license_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    activation_token character varying(128) NOT NULL,
    activated_by uuid,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet,
    user_agent text,
    device_id uuid,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    failure_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT license_activations_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'revoked'::character varying])::text[])))
);


--
-- Name: license_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid,
    action character varying(50) NOT NULL,
    actor_id uuid,
    ip_address inet,
    user_agent text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: license_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    device_fingerprint character varying(255) NOT NULL,
    device_name character varying(255),
    os character varying(64),
    hostname character varying(255),
    ip_address inet,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: license_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    domain character varying(255) NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: license_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    actor_id uuid,
    description text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: license_feature_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_feature_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    feature_key character varying(100) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    limit_value integer,
    notes text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: license_renewals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_renewals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    previous_expires_at timestamp with time zone,
    new_expires_at timestamp with time zone NOT NULL,
    duration_days integer,
    amount numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying,
    payment_id uuid,
    renewed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid,
    deal_id uuid,
    client_name character varying(255) NOT NULL,
    license_type character varying(100) DEFAULT 'lifetime'::character varying NOT NULL,
    start_date date,
    end_date date,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    issued_date date DEFAULT CURRENT_DATE NOT NULL,
    is_historical boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id uuid,
    license_key character varying(255),
    plan_id uuid,
    features_enabled jsonb DEFAULT '{}'::jsonb,
    max_users integer,
    issued_by uuid,
    auto_issued boolean DEFAULT false,
    issue_notes text,
    subscription_id uuid,
    activated_at timestamp with time zone,
    suspended_at timestamp with time zone,
    suspended_reason text,
    revoked_at timestamp with time zone,
    revoked_reason text,
    expires_at timestamp with time zone,
    max_devices integer,
    installation_type character varying(20),
    support_level character varying(20),
    metadata jsonb DEFAULT '{}'::jsonb,
    allowed_domains text[],
    activation_token character varying(128),
    CONSTRAINT licenses_installation_type_check CHECK (((installation_type IS NULL) OR ((installation_type)::text = ANY ((ARRAY['cloud'::character varying, 'onpremise'::character varying, 'hybrid'::character varying])::text[])))),
    CONSTRAINT licenses_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'trial'::character varying, 'active'::character varying, 'suspended'::character varying, 'expired'::character varying, 'revoked'::character varying, 'transferred'::character varying])::text[]))),
    CONSTRAINT licenses_support_level_check CHECK (((support_level IS NULL) OR ((support_level)::text = ANY ((ARRAY['none'::character varying, 'basic'::character varying, 'standard'::character varying, 'priority'::character varying, 'enterprise'::character varying])::text[]))))
);


--
-- Name: markdown_ingestion_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.markdown_ingestion_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    job_status character varying(50) DEFAULT 'pending'::character varying,
    file_path character varying(500) NOT NULL,
    filename character varying(255) NOT NULL,
    content text,
    category_assigned character varying(50),
    intelligence_id uuid,
    error_message text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    content_hash character varying(64),
    CONSTRAINT markdown_ingestion_jobs_job_status_check CHECK (((job_status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename character varying(500) NOT NULL,
    original_filename character varying(500),
    mime_type character varying(100),
    file_size bigint,
    storage_provider character varying(50) DEFAULT 'cloudinary'::character varying,
    cloudinary_account character varying(100),
    public_id character varying(500),
    url text NOT NULL,
    secure_url text,
    thumbnail_url text,
    width integer,
    height integer,
    format character varying(20),
    entity_type character varying(50),
    entity_id uuid,
    tags text[] DEFAULT '{}'::text[],
    quality character varying(20) DEFAULT 'original'::character varying,
    upload_source character varying(50) DEFAULT 'manual'::character varying,
    notes text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT media_quality_check CHECK (((quality)::text = ANY ((ARRAY['original'::character varying, 'optimized'::character varying])::text[])))
);


--
-- Name: media_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_type character varying(100) NOT NULL,
    allowed boolean DEFAULT true,
    max_size_mb integer DEFAULT 100,
    allowed_mimetypes text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: message_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(50) DEFAULT 'sent'::character varying NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_status_status_check CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'delivered'::character varying, 'seen'::character varying])::text[])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    message_type character varying(50) DEFAULT 'text'::character varying NOT NULL,
    media_url character varying(500),
    media_type character varying(100),
    media_size integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    edited_at timestamp without time zone,
    deleted_at timestamp without time zone,
    is_pinned boolean DEFAULT false,
    reply_to_message_id uuid,
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'video'::character varying, 'audio'::character varying, 'file'::character varying, 'call'::character varying, 'system'::character varying])::text[])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid,
    recipient_user_id uuid NOT NULL,
    actor_user_id uuid,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    reference_type character varying(50),
    reference_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: obligation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.obligation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid,
    title character varying(255) NOT NULL,
    description text,
    default_priority character varying(20) DEFAULT 'medium'::character varying,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: offerings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offerings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    description text,
    default_price numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    unit character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offerings_type_check CHECK (((type)::text = ANY (ARRAY[('product'::character varying)::text, ('service'::character varying)::text, ('subscription'::character varying)::text, ('license'::character varying)::text, ('consulting'::character varying)::text, ('other'::character varying)::text])))
);


--
-- Name: operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    operation_type character varying(50) NOT NULL,
    description text DEFAULT 'No description provided'::text,
    related_system_id uuid,
    related_deal_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title character varying(255),
    category character varying(100) DEFAULT 'other'::character varying,
    expense_type character varying(30) DEFAULT 'operational'::character varying,
    amount numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying,
    account_id uuid,
    ledger_entry_id uuid,
    operation_date date DEFAULT CURRENT_DATE,
    vendor character varying(255),
    receipt_url text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration integer,
    CONSTRAINT operations_operation_type_check CHECK (((operation_type)::text = ANY ((ARRAY['coding'::character varying, 'debugging'::character varying, 'testing'::character varying, 'deployment'::character varying, 'sales_meeting'::character varying, 'prospecting'::character varying, 'follow_up'::character varying, 'payment_collection'::character varying, 'financial_allocation'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: org_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_change_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    changed_by uuid,
    change_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    old_structure jsonb,
    new_structure jsonb,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizational_structure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizational_structure (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    node_name character varying(200) NOT NULL,
    department_id uuid,
    role_id uuid,
    authority_level_id uuid,
    reports_to_node_id uuid,
    hierarchy_depth integer DEFAULT 0,
    staff_assigned_id uuid,
    title_alias character varying(200),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT organizational_structure_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'vacant'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    deal_id uuid NOT NULL,
    account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    method character varying(50),
    reference character varying(255),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    received_at timestamp with time zone,
    notes text,
    ledger_entry_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    original_currency character varying(3) NOT NULL,
    original_amount numeric(15,2) NOT NULL,
    amount_ugx numeric(15,2),
    exchange_rate numeric(15,6),
    CONSTRAINT check_payment_currency_required CHECK (((currency IS NOT NULL) AND ((currency)::text <> ''::text))),
    CONSTRAINT check_payment_exchange_rate_positive CHECK (((exchange_rate IS NULL) OR (exchange_rate > (0)::numeric))),
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY (ARRAY[('bank_transfer'::character varying)::text, ('cash'::character varying)::text, ('check'::character varying)::text, ('credit_card'::character varying)::text, ('mobile_money'::character varying)::text, ('crypto'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text, ('partial_refund'::character varying)::text])))
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    employee_account_id uuid,
    account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    payout_type character varying(50) DEFAULT 'salary'::character varying NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    description text,
    reference character varying(255),
    payout_date date DEFAULT CURRENT_DATE,
    processed_at timestamp without time zone,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payouts_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payouts_payout_type_check CHECK (((payout_type)::text = ANY ((ARRAY['salary'::character varying, 'bonus'::character varying, 'commission'::character varying, 'reimbursement'::character varying, 'advance'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT payouts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processed'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: performance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    metric_type character varying(50) NOT NULL,
    metric_value numeric(15,2) DEFAULT 0 NOT NULL,
    period_start date,
    period_end date,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT perf_metric_check CHECK (((metric_type)::text = ANY ((ARRAY['deals_created'::character varying, 'deals_closed'::character varying, 'revenue_generated'::character varying, 'prospects_added'::character varying, 'operations_completed'::character varying, 'bugs_fixed'::character varying, 'features_delivered'::character varying, 'custom'::character varying])::text[])))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    module character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name character varying(100),
    route_path character varying(255),
    method character varying(10)
);


--
-- Name: pipeline_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    current_stage_id uuid NOT NULL,
    system_id uuid,
    assigned_to uuid,
    expected_value numeric(15,2),
    expected_close_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pipeline_stage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stage_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_entry_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    stage_order integer NOT NULL,
    description text,
    color character varying(20) DEFAULT '#6366f1'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pricing_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    name text NOT NULL,
    duration_days integer NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'UGX'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pricing_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    feature_name character varying(300) NOT NULL,
    feature_description text,
    category character varying(100) DEFAULT 'general'::character varying,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pricing_plan_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plan_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    from_version integer,
    to_version integer,
    change_type character varying(40) NOT NULL,
    field_changes jsonb DEFAULT '{}'::jsonb,
    reason text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plan_feature_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plan_feature_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    feature_key character varying(100) NOT NULL,
    before_state jsonb,
    after_state jsonb,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plan_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plan_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    feature_key character varying(100) NOT NULL,
    feature_label text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    limit_value integer,
    notes text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plan_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plan_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    version integer NOT NULL,
    name text NOT NULL,
    description text,
    features jsonb DEFAULT '[]'::jsonb,
    setup_fee numeric(15,2),
    trial_days integer,
    grace_days integer,
    max_users integer,
    max_students integer,
    sms_limit integer,
    support_tier character varying(20),
    deployment_type character varying(20),
    implementation_complexity character varying(20),
    onboarding_hours integer,
    cycles_snapshot jsonb DEFAULT '[]'::jsonb,
    is_current boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    system text,
    description text,
    features jsonb DEFAULT '[]'::jsonb,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    system_id uuid,
    installation_fee numeric(15,2) DEFAULT 0 NOT NULL,
    annual_subscription numeric(15,2) DEFAULT 0 NOT NULL,
    student_limit integer,
    is_popular boolean DEFAULT false,
    setup_fee numeric(15,2) DEFAULT 0,
    trial_days integer DEFAULT 0,
    grace_days integer DEFAULT 0,
    max_users integer,
    max_students integer,
    sms_limit integer,
    support_tier character varying(20),
    deployment_type character varying(20),
    implementation_complexity character varying(20),
    onboarding_hours integer,
    current_version integer DEFAULT 1,
    CONSTRAINT pricing_plans_deployment_type_check CHECK (((deployment_type IS NULL) OR ((deployment_type)::text = ANY ((ARRAY['cloud'::character varying, 'onpremise'::character varying, 'hybrid'::character varying])::text[])))),
    CONSTRAINT pricing_plans_implementation_complexity_check CHECK (((implementation_complexity IS NULL) OR ((implementation_complexity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'enterprise'::character varying])::text[])))),
    CONSTRAINT pricing_plans_support_tier_check CHECK (((support_tier IS NULL) OR ((support_tier)::text = ANY ((ARRAY['none'::character varying, 'basic'::character varying, 'standard'::character varying, 'priority'::character varying, 'enterprise'::character varying])::text[]))))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(15,2),
    currency character varying(10) DEFAULT 'UGX'::character varying,
    category character varying(100),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: proposal_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposal_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id uuid NOT NULL,
    full_payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    system_id uuid NOT NULL,
    selected_plan_id uuid NOT NULL,
    custom_notes text,
    discount_percent numeric(5,2) DEFAULT 0,
    payment_terms character varying(300),
    status character varying(30) DEFAULT 'draft'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    selected_plan_ids uuid[],
    recommended_plan_id uuid,
    student_count integer,
    school_type character varying(50),
    CONSTRAINT proposals_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT proposals_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'generated'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: prospect_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospect_contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prospect_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255),
    email character varying(255),
    phone character varying(50),
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_name character varying(255),
    contact_name character varying(255),
    email character varying(255),
    phone character varying(50),
    website character varying(500),
    industry character varying(100),
    source character varying(100),
    stage character varying(50) DEFAULT 'new'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    estimated_value numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    next_followup_date date,
    converted_at timestamp with time zone,
    lost_reason text,
    assigned_to uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pipeline character varying(100),
    next_followup_time time without time zone,
    estimated_value_text character varying(100),
    system_id uuid,
    service_id uuid,
    prospect_type character varying(50) DEFAULT 'organization'::character varying,
    CONSTRAINT prospects_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT prospects_source_check CHECK (((source IS NULL) OR ((source)::text = ANY ((ARRAY['referral'::character varying, 'cold_outreach'::character varying, 'inbound'::character varying, 'event'::character varying, 'social_media'::character varying, 'website'::character varying, 'partner'::character varying, 'manual_entry'::character varying, 'walk_in'::character varying, 'phone'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT prospects_stage_check CHECK (((stage)::text = ANY (ARRAY[('new'::character varying)::text, ('contacted'::character varying)::text, ('qualified'::character varying)::text, ('proposal'::character varying)::text, ('negotiation'::character varying)::text, ('won'::character varying)::text, ('lost'::character varying)::text, ('dormant'::character varying)::text])))
);


--
-- Name: rbac_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: revenue_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    revenue_event_id uuid,
    rule_id uuid,
    category character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: revenue_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type character varying(50) NOT NULL,
    source_id uuid,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    received_account uuid,
    date_received date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    allocated boolean DEFAULT false,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rev_source_check CHECK (((source_type)::text = ANY ((ARRAY['deal_payment'::character varying, 'subscription'::character varying, 'installation_fee'::character varying, 'service_fee'::character varying, 'other'::character varying, 'historical'::character varying])::text[])))
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    responsibilities text,
    authority_level integer DEFAULT 20,
    hierarchy_level integer DEFAULT 5,
    alias character varying(100),
    is_active boolean DEFAULT true,
    created_by uuid,
    data_scope character varying(20) DEFAULT 'GLOBAL'::character varying NOT NULL,
    CONSTRAINT roles_data_scope_check CHECK (((data_scope)::text = ANY ((ARRAY['OWN'::character varying, 'DEPARTMENT'::character varying, 'GLOBAL'::character varying])::text[])))
);


--
-- Name: schema_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_number integer NOT NULL,
    component character varying(100) NOT NULL,
    description text,
    implemented_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: secret_view_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secret_view_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    service_type character varying(30) DEFAULT 'one_time'::character varying NOT NULL,
    price numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_cycle character varying(30),
    notes text,
    created_by uuid,
    CONSTRAINT services_service_type_check CHECK (((service_type)::text = ANY ((ARRAY['one_time'::character varying, 'recurring'::character varying])::text[])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity timestamp with time zone DEFAULT now(),
    device_name character varying(255),
    is_revoked boolean DEFAULT false NOT NULL,
    inactivity_timeout_minutes integer DEFAULT 60 NOT NULL,
    absolute_expiry timestamp with time zone,
    browser character varying(100),
    os character varying(100)
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(255),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    joined_at date DEFAULT CURRENT_DATE,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email character varying(255),
    phone character varying(50),
    department character varying(100),
    "position" character varying(255),
    salary numeric(15,2),
    salary_currency character varying(10) DEFAULT 'UGX'::character varying,
    salary_account_id uuid,
    manager_id uuid,
    hire_date date,
    photo_url text,
    updated_at timestamp with time zone DEFAULT now(),
    department_id uuid,
    account_status character varying(20) DEFAULT 'active'::character varying,
    role_id uuid,
    user_id uuid,
    linked_user_id uuid,
    employment_type character varying(50) DEFAULT 'full_time'::character varying,
    join_date date,
    employment_status character varying(50) DEFAULT 'active'::character varying,
    leave_balance integer DEFAULT 0,
    next_review_date date,
    last_review_date date,
    CONSTRAINT staff_account_status_check CHECK (((account_status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'terminated'::character varying])::text[]))),
    CONSTRAINT staff_employment_status_check CHECK (((employment_status)::text = ANY ((ARRAY['active'::character varying, 'on_leave'::character varying, 'suspended'::character varying, 'terminated'::character varying, 'probation'::character varying])::text[]))),
    CONSTRAINT staff_employment_type_check CHECK (((employment_type)::text = ANY ((ARRAY['full_time'::character varying, 'part_time'::character varying, 'contract'::character varying, 'intern'::character varying, 'freelance'::character varying])::text[])))
);


--
-- Name: staff_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    staff_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid
);


--
-- Name: subscription_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    cycle_number integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    invoice_id uuid,
    payment_id uuid,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_cycles_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'overdue'::character varying, 'waived'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    event_type character varying(40) NOT NULL,
    actor_id uuid,
    description text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_pause_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_pause_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    paused_at timestamp with time zone NOT NULL,
    resumed_at timestamp with time zone,
    reason text,
    paused_by uuid,
    resumed_by uuid
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    cycle_id uuid,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    method character varying(40),
    reference character varying(255),
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    recorded_by uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT subscription_payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: subscription_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    from_status character varying(20),
    to_status character varying(20) NOT NULL,
    reason text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    pricing_cycle_id uuid NOT NULL,
    system text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    auto_renew boolean DEFAULT true,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan_version_id uuid,
    paused_at timestamp with time zone,
    pause_reason text,
    resumed_at timestamp with time zone,
    overdue_at timestamp with time zone,
    grace_until date,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancellation_reason text,
    retention_attempted boolean DEFAULT false,
    retention_outcome text,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'trial'::text, 'active'::text, 'paused'::text, 'overdue'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: system_architecture; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_architecture (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    tech_stack jsonb DEFAULT '{}'::jsonb NOT NULL,
    platforms text[],
    database_type character varying(100),
    database_version character varying(50),
    hosting_environment character varying(100),
    deployment_url character varying(500),
    architecture_pattern character varying(200),
    authentication_method character varying(200),
    database_architecture text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: system_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    file_url text,
    cloudinary_public_id character varying(500),
    file_size bigint DEFAULT 0,
    backup_type character varying(30) DEFAULT 'full'::character varying,
    status character varying(20) DEFAULT 'completed'::character varying,
    tags text[] DEFAULT '{}'::text[],
    table_count integer DEFAULT 0,
    row_count integer DEFAULT 0,
    schema_version character varying(20),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum character varying(128),
    checksum_algo character varying(20) DEFAULT 'sha256'::character varying,
    encrypted boolean DEFAULT false,
    compression character varying(20),
    storage_target_id uuid,
    storage_path text,
    verified_at timestamp with time zone,
    verification_status character varying(20),
    parent_backup_id uuid,
    retention_until timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT backup_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'failed'::character varying, 'uploaded'::character varying])::text[]))),
    CONSTRAINT backup_type_check CHECK (((backup_type)::text = ANY ((ARRAY['full'::character varying, 'schema_only'::character varying, 'data_only'::character varying, 'incremental'::character varying])::text[]))),
    CONSTRAINT system_backups_verification_status_check CHECK (((verification_status IS NULL) OR ((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'failed'::character varying, 'corrupted'::character varying])::text[]))))
);


--
-- Name: system_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'planned'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    change_type character varying(50) DEFAULT 'feature'::character varying,
    priority character varying(20) DEFAULT 'medium'::character varying,
    created_by uuid
);


--
-- Name: system_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    cost_type character varying(100) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying,
    cost_date date DEFAULT CURRENT_DATE,
    description text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_name character varying(100) NOT NULL,
    actor_user_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_health_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    component character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'error'::character varying NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_intelligence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_intelligence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    category character varying(50) NOT NULL,
    content text NOT NULL,
    summary character varying(1000),
    tags text[],
    version_tag character varying(50),
    version_number integer DEFAULT 1,
    related_issue_id uuid,
    related_module_id uuid,
    parent_intelligence_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_public boolean DEFAULT false,
    search_vector tsvector,
    CONSTRAINT system_intelligence_category_check CHECK (((category)::text = ANY ((ARRAY['architecture'::character varying, 'feature'::character varying, 'bug_fix'::character varying, 'deployment'::character varying, 'decision'::character varying, 'integration'::character varying, 'performance'::character varying, 'security'::character varying, 'scaling'::character varying, 'api'::character varying, 'database'::character varying, 'infrastructure'::character varying, 'guide'::character varying, 'troubleshooting'::character varying, 'release_notes'::character varying])::text[])))
);


--
-- Name: system_intelligence_internal_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_intelligence_internal_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intelligence_id uuid NOT NULL,
    content text NOT NULL,
    note_type character varying(50),
    severity character varying(20) DEFAULT 'info'::character varying,
    visible_to_role character varying(50) DEFAULT 'developer'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_intelligence_internal_notes_note_type_check CHECK (((note_type)::text = ANY ((ARRAY['warning'::character varying, 'insight'::character varying, 'todo'::character varying, 'decision'::character varying, 'technical_debt'::character varying])::text[]))),
    CONSTRAINT system_intelligence_internal_notes_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: system_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    severity character varying(30) DEFAULT 'medium'::character varying,
    reported_by uuid,
    assigned_to uuid,
    root_cause text,
    affected_modules text[],
    fix_summary text,
    related_logs jsonb DEFAULT '[]'::jsonb,
    verified_by character varying(50) DEFAULT 'pending'::character varying,
    detected_at timestamp with time zone DEFAULT now(),
    fixed_at timestamp with time zone,
    category character varying(50) DEFAULT 'system'::character varying
);


--
-- Name: system_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    job_type character varying(100) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level character varying(20) DEFAULT 'error'::character varying NOT NULL,
    module character varying(100),
    action character varying(100),
    message text NOT NULL,
    details jsonb,
    user_id uuid,
    entity_type character varying(100),
    entity_id uuid,
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_logs_level_check CHECK (((level)::text = ANY ((ARRAY['info'::character varying, 'warn'::character varying, 'error'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: system_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    module_name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying,
    module_url character varying(500),
    version character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    routes jsonb DEFAULT '[]'::jsonb,
    dependencies jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT system_modules_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'deprecated'::character varying, 'planned'::character varying])::text[])))
);


--
-- Name: system_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_operations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    system_id uuid NOT NULL,
    operation_type character varying(50) NOT NULL,
    description text NOT NULL,
    status character varying(30) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT system_operations_operation_type_check CHECK (((operation_type)::text = ANY ((ARRAY['development'::character varying, 'bug_fix'::character varying, 'testing'::character varying, 'deployment'::character varying, 'architecture_change'::character varying, 'maintenance'::character varying, 'update'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT system_operations_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: system_pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_pricing_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    system_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    installation_fee numeric(15,2) DEFAULT 0,
    monthly_fee numeric(15,2),
    annual_fee numeric(15,2),
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying,
    features jsonb DEFAULT '[]'::jsonb,
    max_users integer,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_tech_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_tech_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    language character varying(100),
    framework character varying(100),
    framework_version character varying(50),
    database character varying(100),
    db_version character varying(50),
    platform character varying(100),
    hosting character varying(100),
    deployment_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    version_name character varying(100) NOT NULL,
    version_number character varying(50) NOT NULL,
    release_notes text,
    changelog jsonb,
    has_breaking_changes boolean DEFAULT false,
    migration_notes text,
    released_at timestamp without time zone,
    released_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deployed_to_production boolean DEFAULT false,
    deployment_date timestamp without time zone
);


--
-- Name: systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version character varying(50),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug character varying(100),
    category character varying(100),
    tech_stack text,
    repository_url character varying(500),
    demo_url character varying(500),
    notes text,
    created_by uuid,
    product_type character varying(100),
    primary_language character varying(100),
    frameworks_used text,
    database_engine character varying(100),
    supported_platforms text[],
    repository_link text,
    documentation_link text,
    has_intelligence boolean DEFAULT false,
    intelligence_score integer DEFAULT 0,
    last_intelligence_update timestamp without time zone
);


--
-- Name: systems_extended_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systems_extended_content (
    system_id uuid NOT NULL,
    problem_block text DEFAULT ''::text NOT NULL,
    solution_block text DEFAULT ''::text NOT NULL,
    why_attendance_first text DEFAULT ''::text NOT NULL,
    cost_of_inaction_block text DEFAULT ''::text NOT NULL,
    transformation_block text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tech_stack_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tech_stack_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_id uuid NOT NULL,
    language_or_framework character varying(100) NOT NULL,
    version character varying(50),
    role_in_system character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    from_account_id uuid NOT NULL,
    to_account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying NOT NULL,
    to_amount numeric(15,2),
    to_currency character varying(3),
    exchange_rate numeric(15,6),
    description text,
    reference character varying(255),
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(30) DEFAULT 'completed'::character varying NOT NULL,
    ledger_debit_id uuid,
    ledger_credit_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT different_accounts CHECK ((from_account_id <> to_account_id)),
    CONSTRAINT transfers_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT transfers_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('reversed'::character varying)::text])))
);


--
-- Name: typing_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.typing_indicators (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);


--
-- Name: user_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Untitled Design'::text NOT NULL,
    thumbnail text,
    canvas jsonb DEFAULT '{"width": 1080, "height": 1080}'::jsonb NOT NULL,
    layers jsonb DEFAULT '[]'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_template boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_presence (
    user_id uuid NOT NULL,
    last_ping timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    is_online boolean DEFAULT false,
    current_route character varying(500),
    current_page_title character varying(255),
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    device_info text,
    CONSTRAINT user_presence_status_check CHECK (((status)::text = ANY ((ARRAY['online'::character varying, 'away'::character varying, 'offline'::character varying])::text[])))
);


--
-- Name: TABLE user_presence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_presence IS 'Tracks real-time user online/offline status via heartbeat pings';


--
-- Name: COLUMN user_presence.last_ping; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_presence.last_ping IS 'Timestamp of most recent heartbeat from the client';


--
-- Name: COLUMN user_presence.last_seen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_presence.last_seen IS 'Timestamp of last confirmed activity (same as last_ping while online)';


--
-- Name: COLUMN user_presence.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_presence.status IS 'Computed status: online if last_ping < 60s ago, otherwise offline';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    full_name character varying(255),
    staff_id uuid,
    must_reset_password boolean DEFAULT false NOT NULL,
    username character varying(100),
    authority_level integer DEFAULT 10 NOT NULL,
    first_login_completed boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone,
    session_id text,
    role_id uuid,
    profile_image_url text,
    avatar_id text,
    department text,
    hierarchy_level integer DEFAULT 0,
    cover_image_url text,
    bio text,
    phone text,
    timezone text DEFAULT 'UTC'::text,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying, 'staff'::character varying, 'user'::character varying, 'viewer'::character varying, 'customer'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'suspended'::character varying, 'disabled'::character varying])::text[])))
);


--
-- Name: v_account_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_account_balances AS
 SELECT a.id AS account_id,
    a.name,
    a.type,
    a.currency,
    a.is_active,
    COALESCE(sum(l.amount), (0)::numeric) AS balance,
    count(l.id) AS transaction_count,
    max(l.entry_date) AS last_transaction_date
   FROM (public.accounts a
     LEFT JOIN public.ledger l ON ((l.account_id = a.id)))
  GROUP BY a.id, a.name, a.type, a.currency, a.is_active;


--
-- Name: v_budget_utilization; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_budget_utilization AS
 SELECT b.id AS budget_id,
    b.name,
    b.category,
    b.amount AS budgeted,
    b.currency,
    b.period,
    b.start_date,
    b.end_date,
    COALESCE(sum(e.amount) FILTER (WHERE (((e.status)::text <> 'void'::text) AND ((e.status)::text <> 'rejected'::text))), (0)::numeric) AS spent,
    (b.amount - COALESCE(sum(e.amount) FILTER (WHERE (((e.status)::text <> 'void'::text) AND ((e.status)::text <> 'rejected'::text))), (0)::numeric)) AS remaining,
        CASE
            WHEN (b.amount > (0)::numeric) THEN round(((COALESCE(sum(e.amount) FILTER (WHERE (((e.status)::text <> 'void'::text) AND ((e.status)::text <> 'rejected'::text))), (0)::numeric) / b.amount) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS utilization_pct,
    b.alert_threshold,
    b.is_active
   FROM (public.budgets b
     LEFT JOIN public.expenses e ON (((e.budget_id = b.id) AND ((e.expense_date >= b.start_date) AND (e.expense_date <= b.end_date)))))
  GROUP BY b.id, b.name, b.category, b.amount, b.currency, b.period, b.start_date, b.end_date, b.alert_threshold, b.is_active;


--
-- Name: v_client_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_client_summary AS
 SELECT c.id AS client_id,
    c.company_name,
    c.status,
    count(DISTINCT d.id) AS deal_count,
    COALESCE(sum(d.total_amount), (0)::numeric) AS total_deal_value,
    COALESCE(sum(p.amount) FILTER (WHERE ((p.status)::text = 'completed'::text)), (0)::numeric) AS total_paid,
    max(p.payment_date) AS last_payment_date,
    min(d.created_at) AS first_deal_date
   FROM ((public.clients c
     LEFT JOIN public.deals d ON ((d.client_id = c.id)))
     LEFT JOIN public.payments p ON ((p.deal_id = d.id)))
  GROUP BY c.id, c.company_name, c.status;


--
-- Name: v_deal_payment_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_deal_payment_status AS
 SELECT d.id AS deal_id,
    d.title,
    d.client_id,
    d.total_amount,
    d.currency,
    d.status,
    COALESCE(sum(p.amount) FILTER (WHERE ((p.status)::text = 'completed'::text)), (0)::numeric) AS paid_amount,
    (d.total_amount - COALESCE(sum(p.amount) FILTER (WHERE ((p.status)::text = 'completed'::text)), (0)::numeric)) AS remaining_amount,
    count(p.id) FILTER (WHERE ((p.status)::text = 'completed'::text)) AS payment_count,
        CASE
            WHEN (COALESCE(sum(p.amount) FILTER (WHERE ((p.status)::text = 'completed'::text)), (0)::numeric) >= d.total_amount) THEN 'fully_paid'::text
            WHEN (COALESCE(sum(p.amount) FILTER (WHERE ((p.status)::text = 'completed'::text)), (0)::numeric) > (0)::numeric) THEN 'partially_paid'::text
            ELSE 'unpaid'::text
        END AS payment_status
   FROM (public.deals d
     LEFT JOIN public.payments p ON ((p.deal_id = d.id)))
  GROUP BY d.id, d.title, d.client_id, d.total_amount, d.currency, d.status;


--
-- Name: v_financial_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_financial_summary AS
 SELECT COALESCE(sum(amount) FILTER (WHERE (amount > (0)::numeric)), (0)::numeric) AS total_income,
    COALESCE(sum(abs(amount)) FILTER (WHERE (amount < (0)::numeric)), (0)::numeric) AS total_expenses,
    COALESCE(sum(amount), (0)::numeric) AS net_position,
    count(*) FILTER (WHERE (amount > (0)::numeric)) AS income_transactions,
    count(*) FILTER (WHERE (amount < (0)::numeric)) AS expense_transactions,
    count(*) AS total_transactions
   FROM public.ledger;


--
-- Name: v_identity_orphans; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_identity_orphans AS
 SELECT id AS user_id,
    email,
    username,
    role,
    staff_id,
    created_at,
        CASE
            WHEN ((role)::text = 'superadmin'::text) THEN 'allowed'::text
            WHEN ((role)::text = ANY ((ARRAY['viewer'::character varying, 'customer'::character varying, 'system'::character varying])::text[])) THEN 'allowed'::text
            WHEN (staff_id IS NULL) THEN 'phantom_user'::text
            WHEN (NOT (EXISTS ( SELECT 1
               FROM public.staff s
              WHERE (s.id = u.staff_id)))) THEN 'dangling_staff_ref'::text
            ELSE 'linked'::text
        END AS issue
   FROM public.users u;


--
-- Name: v_monthly_financials; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_monthly_financials AS
 SELECT (date_trunc('month'::text, (entry_date)::timestamp with time zone))::date AS month,
    COALESCE(sum(amount) FILTER (WHERE (amount > (0)::numeric)), (0)::numeric) AS income,
    COALESCE(sum(abs(amount)) FILTER (WHERE (amount < (0)::numeric)), (0)::numeric) AS expenses,
    COALESCE(sum(amount), (0)::numeric) AS net,
    count(*) AS transaction_count
   FROM public.ledger
  GROUP BY (date_trunc('month'::text, (entry_date)::timestamp with time zone))
  ORDER BY ((date_trunc('month'::text, (entry_date)::timestamp with time zone))::date) DESC;


--
-- Name: v_prospect_pipeline; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_prospect_pipeline AS
 SELECT stage,
    count(*) AS count,
    COALESCE(sum(estimated_value), (0)::numeric) AS total_value,
    COALESCE(avg(estimated_value), (0)::numeric) AS avg_value
   FROM public.prospects
  WHERE ((stage)::text <> ALL (ARRAY[('won'::character varying)::text, ('lost'::character varying)::text]))
  GROUP BY stage
  ORDER BY
        CASE stage
            WHEN 'new'::text THEN 1
            WHEN 'contacted'::text THEN 2
            WHEN 'qualified'::text THEN 3
            WHEN 'proposal'::text THEN 4
            WHEN 'negotiation'::text THEN 5
            ELSE 6
        END;


--
-- Name: v_staff_orphans; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_staff_orphans AS
 SELECT id AS staff_id,
    name,
    email,
    user_id,
    linked_user_id,
        CASE
            WHEN ((user_id IS NULL) AND (linked_user_id IS NULL)) THEN 'staff_without_user'::text
            WHEN ((user_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
               FROM public.users u
              WHERE (u.id = s.user_id))))) THEN 'dangling_user_ref'::text
            WHEN ((user_id IS DISTINCT FROM linked_user_id) AND (linked_user_id IS NOT NULL)) THEN 'pointer_mismatch'::text
            ELSE 'linked'::text
        END AS issue
   FROM public.staff s;


--
-- Name: webauthn_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    challenge text NOT NULL,
    ip_address text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '00:05:00'::interval) NOT NULL,
    CONSTRAINT webauthn_challenges_type_check CHECK ((type = ANY (ARRAY['registration'::text, 'authentication'::text])))
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);


--
-- Name: _deprecated_assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_passkeys auth_passkeys_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_passkeys
    ADD CONSTRAINT auth_passkeys_credential_id_key UNIQUE (credential_id);


--
-- Name: auth_passkeys auth_passkeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_passkeys
    ADD CONSTRAINT auth_passkeys_pkey PRIMARY KEY (id);


--
-- Name: authority_levels authority_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_levels
    ADD CONSTRAINT authority_levels_name_key UNIQUE (name);


--
-- Name: authority_levels authority_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_levels
    ADD CONSTRAINT authority_levels_pkey PRIMARY KEY (id);


--
-- Name: backup_jobs backup_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_jobs
    ADD CONSTRAINT backup_jobs_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_restores backup_restores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_restores
    ADD CONSTRAINT backup_restores_pkey PRIMARY KEY (id);


--
-- Name: backup_storage_targets backup_storage_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_storage_targets
    ADD CONSTRAINT backup_storage_targets_pkey PRIMARY KEY (id);


--
-- Name: budget_targets budget_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_targets
    ADD CONSTRAINT budget_targets_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: bug_reports bug_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: call_participants call_participants_call_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_call_id_user_id_key UNIQUE (call_id, user_id);


--
-- Name: call_participants call_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_pkey PRIMARY KEY (id);


--
-- Name: call_permissions call_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_permissions
    ADD CONSTRAINT call_permissions_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: capital_allocation_rules capital_allocation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capital_allocation_rules
    ADD CONSTRAINT capital_allocation_rules_pkey PRIMARY KEY (id);


--
-- Name: client_obligations client_obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_prospect_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_prospect_id_key UNIQUE (prospect_id);


--
-- Name: cloud_accounts cloud_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_accounts
    ADD CONSTRAINT cloud_accounts_pkey PRIMARY KEY (id);


--
-- Name: communication_audit_log communication_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_audit_log
    ADD CONSTRAINT communication_audit_log_pkey PRIMARY KEY (id);


--
-- Name: communication_notifications communication_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_pkey PRIMARY KEY (id);


--
-- Name: communication_settings communication_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_settings
    ADD CONSTRAINT communication_settings_pkey PRIMARY KEY (id);


--
-- Name: communication_settings communication_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_settings
    ADD CONSTRAINT communication_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: company_branding company_branding_organization_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_branding
    ADD CONSTRAINT company_branding_organization_slug_key UNIQUE (organization_slug);


--
-- Name: company_branding company_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_branding
    ADD CONSTRAINT company_branding_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (key);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: dashboard_configs dashboard_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_pkey PRIMARY KEY (id);


--
-- Name: dashboard_configs dashboard_configs_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_role_id_key UNIQUE (role_id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: department_documents department_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_documents
    ADD CONSTRAINT department_documents_pkey PRIMARY KEY (id);


--
-- Name: department_kpis department_kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_kpis
    ADD CONSTRAINT department_kpis_pkey PRIMARY KEY (id);


--
-- Name: department_policies department_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_policies
    ADD CONSTRAINT department_policies_pkey PRIMARY KEY (id);


--
-- Name: department_processes department_processes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_processes
    ADD CONSTRAINT department_processes_pkey PRIMARY KEY (id);


--
-- Name: department_roles department_roles_department_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_department_id_role_id_key UNIQUE (department_id, role_id);


--
-- Name: department_roles department_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_pkey PRIMARY KEY (id);


--
-- Name: departments departments_department_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_name_key UNIQUE (department_name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: design_asset_collection_items design_asset_collection_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collection_items
    ADD CONSTRAINT design_asset_collection_items_pkey PRIMARY KEY (id);


--
-- Name: design_asset_collections design_asset_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collections
    ADD CONSTRAINT design_asset_collections_pkey PRIMARY KEY (id);


--
-- Name: design_assets design_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_pkey PRIMARY KEY (id);


--
-- Name: design_brandkits design_brandkits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_brandkits
    ADD CONSTRAINT design_brandkits_pkey PRIMARY KEY (id);


--
-- Name: design_exports design_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_exports
    ADD CONSTRAINT design_exports_pkey PRIMARY KEY (id);


--
-- Name: design_layers design_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_layers
    ADD CONSTRAINT design_layers_pkey PRIMARY KEY (id);


--
-- Name: design_project_items design_project_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_project_items
    ADD CONSTRAINT design_project_items_pkey PRIMARY KEY (id);


--
-- Name: design_projects design_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_projects
    ADD CONSTRAINT design_projects_pkey PRIMARY KEY (id);


--
-- Name: design_template_versions design_template_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_template_versions
    ADD CONSTRAINT design_template_versions_pkey PRIMARY KEY (id);


--
-- Name: design_templates design_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates
    ADD CONSTRAINT design_templates_pkey PRIMARY KEY (id);


--
-- Name: developer_activity developer_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.developer_activity
    ADD CONSTRAINT developer_activity_pkey PRIMARY KEY (id);


--
-- Name: doc_versions doc_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT doc_versions_pkey PRIMARY KEY (id);


--
-- Name: docs docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_pkey PRIMARY KEY (id);


--
-- Name: docs docs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_slug_key UNIQUE (slug);


--
-- Name: document_approvals document_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approvals
    ADD CONSTRAINT document_approvals_pkey PRIMARY KEY (id);


--
-- Name: document_audit_logs document_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: document_branding document_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_branding
    ADD CONSTRAINT document_branding_pkey PRIMARY KEY (id);


--
-- Name: document_categories document_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_name_key UNIQUE (name);


--
-- Name: document_categories document_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_categories
    ADD CONSTRAINT document_categories_pkey PRIMARY KEY (id);


--
-- Name: document_comments document_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_pkey PRIMARY KEY (id);


--
-- Name: document_folders document_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_pkey PRIMARY KEY (id);


--
-- Name: document_links document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_pkey PRIMARY KEY (id);


--
-- Name: document_permissions document_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_pkey PRIMARY KEY (id);


--
-- Name: document_tag_links document_tag_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tag_links
    ADD CONSTRAINT document_tag_links_pkey PRIMARY KEY (document_id, tag_id);


--
-- Name: document_tags document_tags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_name_key UNIQUE (name);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: document_verification_logs document_verification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verification_logs
    ADD CONSTRAINT document_verification_logs_pkey PRIMARY KEY (id);


--
-- Name: document_verifications document_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: drais_systems drais_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drais_systems
    ADD CONSTRAINT drais_systems_pkey PRIMARY KEY (id);


--
-- Name: employee_accounts employee_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_accounts
    ADD CONSTRAINT employee_accounts_pkey PRIMARY KEY (id);


--
-- Name: employee_accounts employee_accounts_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_accounts
    ADD CONSTRAINT employee_accounts_staff_id_key UNIQUE (staff_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_user_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_account_id_key UNIQUE (user_account_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_from_currency_to_currency_effective_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_from_currency_to_currency_effective_date_key UNIQUE (from_currency, to_currency, effective_date);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: external_connection_logs external_connection_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connection_logs
    ADD CONSTRAINT external_connection_logs_pkey PRIMARY KEY (id);


--
-- Name: external_connections external_connections_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections
    ADD CONSTRAINT external_connections_name_key UNIQUE (name);


--
-- Name: external_connections external_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections
    ADD CONSTRAINT external_connections_pkey PRIMARY KEY (id);


--
-- Name: feature_requests feature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_requests
    ADD CONSTRAINT feature_requests_pkey PRIMARY KEY (id);


--
-- Name: followups followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.followups
    ADD CONSTRAINT followups_pkey PRIMARY KEY (id);


--
-- Name: generated_document_logs generated_document_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_document_logs
    ADD CONSTRAINT generated_document_logs_pkey PRIMARY KEY (id);


--
-- Name: generated_documents generated_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_pkey PRIMARY KEY (id);


--
-- Name: generated_documents generated_documents_unique_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_unique_id_key UNIQUE (unique_id);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key);


--
-- Name: identity_audit_logs identity_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_audit_logs
    ADD CONSTRAINT identity_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: identity_health_reports identity_health_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_health_reports
    ADD CONSTRAINT identity_health_reports_pkey PRIMARY KEY (id);


--
-- Name: intellectual_property intellectual_property_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intellectual_property
    ADD CONSTRAINT intellectual_property_pkey PRIMARY KEY (id);


--
-- Name: invoice_sequences invoice_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_sequences
    ADD CONSTRAINT invoice_sequences_pkey PRIMARY KEY (year);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: issue_resolutions issue_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_resolutions
    ADD CONSTRAINT issue_resolutions_pkey PRIMARY KEY (id);


--
-- Name: issue_root_causes issue_root_causes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_root_causes
    ADD CONSTRAINT issue_root_causes_pkey PRIMARY KEY (id);


--
-- Name: item_activity_log item_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_activity_log
    ADD CONSTRAINT item_activity_log_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: knowledge_articles knowledge_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);


--
-- Name: knowledge_assets knowledge_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_assets
    ADD CONSTRAINT knowledge_assets_pkey PRIMARY KEY (id);


--
-- Name: knowledge_versions knowledge_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_versions
    ADD CONSTRAINT knowledge_versions_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: liabilities liabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_pkey PRIMARY KEY (id);


--
-- Name: license_activations license_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_activations
    ADD CONSTRAINT license_activations_pkey PRIMARY KEY (id);


--
-- Name: license_audit_logs license_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_audit_logs
    ADD CONSTRAINT license_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: license_devices license_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_devices
    ADD CONSTRAINT license_devices_pkey PRIMARY KEY (id);


--
-- Name: license_domains license_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_domains
    ADD CONSTRAINT license_domains_pkey PRIMARY KEY (id);


--
-- Name: license_events license_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_events
    ADD CONSTRAINT license_events_pkey PRIMARY KEY (id);


--
-- Name: license_feature_access license_feature_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_feature_access
    ADD CONSTRAINT license_feature_access_pkey PRIMARY KEY (id);


--
-- Name: license_renewals license_renewals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_renewals
    ADD CONSTRAINT license_renewals_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: markdown_ingestion_jobs markdown_ingestion_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdown_ingestion_jobs
    ADD CONSTRAINT markdown_ingestion_jobs_pkey PRIMARY KEY (id);


--
-- Name: media_permissions media_permissions_file_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_permissions
    ADD CONSTRAINT media_permissions_file_type_key UNIQUE (file_type);


--
-- Name: media_permissions media_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_permissions
    ADD CONSTRAINT media_permissions_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: message_status message_status_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- Name: message_status message_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: obligation_templates obligation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_templates
    ADD CONSTRAINT obligation_templates_pkey PRIMARY KEY (id);


--
-- Name: offerings offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offerings
    ADD CONSTRAINT offerings_pkey PRIMARY KEY (id);


--
-- Name: operations operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_pkey PRIMARY KEY (id);


--
-- Name: org_change_logs org_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_change_logs
    ADD CONSTRAINT org_change_logs_pkey PRIMARY KEY (id);


--
-- Name: organizational_structure organizational_structure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: performance_metrics performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_module_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_module_action_key UNIQUE (module, action);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_entries pipeline_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stage_history pipeline_stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_history
    ADD CONSTRAINT pipeline_stage_history_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_name_key UNIQUE (name);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: pricing_cycles pricing_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_cycles
    ADD CONSTRAINT pricing_cycles_pkey PRIMARY KEY (id);


--
-- Name: pricing_features pricing_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_features
    ADD CONSTRAINT pricing_features_pkey PRIMARY KEY (id);


--
-- Name: pricing_plan_changes pricing_plan_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_changes
    ADD CONSTRAINT pricing_plan_changes_pkey PRIMARY KEY (id);


--
-- Name: pricing_plan_feature_history pricing_plan_feature_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_feature_history
    ADD CONSTRAINT pricing_plan_feature_history_pkey PRIMARY KEY (id);


--
-- Name: pricing_plan_features pricing_plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_features
    ADD CONSTRAINT pricing_plan_features_pkey PRIMARY KEY (id);


--
-- Name: pricing_plan_versions pricing_plan_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_versions
    ADD CONSTRAINT pricing_plan_versions_pkey PRIMARY KEY (id);


--
-- Name: pricing_plans pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: proposal_snapshots proposal_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_snapshots
    ADD CONSTRAINT proposal_snapshots_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: prospect_contacts prospect_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospect_contacts
    ADD CONSTRAINT prospect_contacts_pkey PRIMARY KEY (id);


--
-- Name: prospects prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);


--
-- Name: rbac_audit_logs rbac_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_logs
    ADD CONSTRAINT rbac_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: _deprecated_resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: revenue_allocations revenue_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_allocations
    ADD CONSTRAINT revenue_allocations_pkey PRIMARY KEY (id);


--
-- Name: revenue_events revenue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_events
    ADD CONSTRAINT revenue_events_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schema_versions schema_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (id);


--
-- Name: schema_versions schema_versions_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_versions
    ADD CONSTRAINT schema_versions_version_number_key UNIQUE (version_number);


--
-- Name: secret_view_tokens secret_view_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_view_tokens
    ADD CONSTRAINT secret_view_tokens_pkey PRIMARY KEY (id);


--
-- Name: secret_view_tokens secret_view_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_view_tokens
    ADD CONSTRAINT secret_view_tokens_token_key UNIQUE (token);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_roles staff_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_pkey PRIMARY KEY (id);


--
-- Name: staff_roles staff_roles_staff_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_staff_id_role_id_key UNIQUE (staff_id, role_id);


--
-- Name: subscription_cycles subscription_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_cycles
    ADD CONSTRAINT subscription_cycles_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_pause_history subscription_pause_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pause_history
    ADD CONSTRAINT subscription_pause_history_pkey PRIMARY KEY (id);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: subscription_status_history subscription_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_status_history
    ADD CONSTRAINT subscription_status_history_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: system_architecture system_architecture_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_architecture
    ADD CONSTRAINT system_architecture_pkey PRIMARY KEY (id);


--
-- Name: system_architecture system_architecture_system_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_architecture
    ADD CONSTRAINT system_architecture_system_id_key UNIQUE (system_id);


--
-- Name: system_backups system_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_backups
    ADD CONSTRAINT system_backups_pkey PRIMARY KEY (id);


--
-- Name: system_changes system_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_changes
    ADD CONSTRAINT system_changes_pkey PRIMARY KEY (id);


--
-- Name: system_costs system_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_costs
    ADD CONSTRAINT system_costs_pkey PRIMARY KEY (id);


--
-- Name: system_events system_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_events
    ADD CONSTRAINT system_events_pkey PRIMARY KEY (id);


--
-- Name: system_health_logs system_health_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_logs
    ADD CONSTRAINT system_health_logs_pkey PRIMARY KEY (id);


--
-- Name: system_intelligence_internal_notes system_intelligence_internal_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence_internal_notes
    ADD CONSTRAINT system_intelligence_internal_notes_pkey PRIMARY KEY (id);


--
-- Name: system_intelligence system_intelligence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_pkey PRIMARY KEY (id);


--
-- Name: system_issues system_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_pkey PRIMARY KEY (id);


--
-- Name: system_jobs system_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_jobs
    ADD CONSTRAINT system_jobs_pkey PRIMARY KEY (id);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: system_modules system_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (id);


--
-- Name: system_operations system_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_operations
    ADD CONSTRAINT system_operations_pkey PRIMARY KEY (id);


--
-- Name: system_pricing_plans system_pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_pricing_plans
    ADD CONSTRAINT system_pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_tech_profiles system_tech_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_tech_profiles
    ADD CONSTRAINT system_tech_profiles_pkey PRIMARY KEY (id);


--
-- Name: system_versions system_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_versions
    ADD CONSTRAINT system_versions_pkey PRIMARY KEY (id);


--
-- Name: systems_extended_content systems_extended_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems_extended_content
    ADD CONSTRAINT systems_extended_content_pkey PRIMARY KEY (system_id);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (id);


--
-- Name: tech_stack_entries tech_stack_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tech_stack_entries
    ADD CONSTRAINT tech_stack_entries_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: typing_indicators typing_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: design_asset_collection_items uq_design_collection_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collection_items
    ADD CONSTRAINT uq_design_collection_items UNIQUE (collection_id, asset_id);


--
-- Name: design_layers uq_design_layers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_layers
    ADD CONSTRAINT uq_design_layers UNIQUE (design_id, layer_key);


--
-- Name: design_project_items uq_design_project_items; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_project_items
    ADD CONSTRAINT uq_design_project_items UNIQUE (project_id, design_id);


--
-- Name: design_template_versions uq_design_template_versions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_template_versions
    ADD CONSTRAINT uq_design_template_versions UNIQUE (template_id, version);


--
-- Name: document_approvals uq_document_approvals; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approvals
    ADD CONSTRAINT uq_document_approvals UNIQUE (document_id, step_order);


--
-- Name: document_links uq_document_links; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT uq_document_links UNIQUE (document_id, entity_type, entity_id, relationship);


--
-- Name: document_permissions uq_document_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT uq_document_permissions UNIQUE (document_id, principal_type, principal_id, permission);


--
-- Name: document_versions uq_document_versions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT uq_document_versions UNIQUE (document_id, version);


--
-- Name: pricing_plan_versions uq_pricing_plan_versions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_versions
    ADD CONSTRAINT uq_pricing_plan_versions UNIQUE (plan_id, version);


--
-- Name: system_modules uq_system_modules_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT uq_system_modules_name UNIQUE (system_id, module_name);


--
-- Name: user_designs user_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designs
    ADD CONSTRAINT user_designs_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_is_active ON public.accounts USING btree (is_active);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type ON public.accounts USING btree (type);


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: idx_activity_logs_actor_authority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_actor_authority ON public.activity_logs USING btree (actor_authority_level);


--
-- Name: idx_activity_logs_actor_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_actor_role ON public.activity_logs USING btree (actor_role_id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_activity_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);


--
-- Name: idx_allocations_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_category ON public.allocations USING btree (category);


--
-- Name: idx_allocations_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_payment_id ON public.allocations USING btree (payment_id);


--
-- Name: idx_approval_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_requester ON public.approval_requests USING btree (requester_user_id);


--
-- Name: idx_approval_requests_required_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_required_permission ON public.approval_requests USING btree (required_permission);


--
-- Name: idx_approval_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_status ON public.approval_requests USING btree (status);


--
-- Name: idx_assets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_created_by ON public._deprecated_assets USING btree (created_by);


--
-- Name: idx_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_type ON public._deprecated_assets USING btree (asset_type);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_auth_passkeys_credential_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_passkeys_credential_id ON public.auth_passkeys USING btree (credential_id);


--
-- Name: idx_auth_passkeys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_passkeys_user_id ON public.auth_passkeys USING btree (user_id);


--
-- Name: idx_authority_levels_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_authority_levels_active ON public.authority_levels USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_authority_levels_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_authority_levels_rank ON public.authority_levels USING btree (rank_value DESC);


--
-- Name: idx_backup_jobs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_jobs_active ON public.backup_jobs USING btree (is_active);


--
-- Name: idx_backup_jobs_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_jobs_next_run ON public.backup_jobs USING btree (next_run_at) WHERE is_active;


--
-- Name: idx_backup_logs_backup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_logs_backup ON public.backup_logs USING btree (backup_id);


--
-- Name: idx_backup_logs_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_logs_job ON public.backup_logs USING btree (job_id);


--
-- Name: idx_backup_restores_backup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_restores_backup ON public.backup_restores USING btree (backup_id);


--
-- Name: idx_backups_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backups_created ON public.system_backups USING btree (created_at DESC);


--
-- Name: idx_backups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backups_status ON public.system_backups USING btree (status);


--
-- Name: idx_budget_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_category ON public.budget_targets USING btree (category);


--
-- Name: idx_budget_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_period ON public.budget_targets USING btree (period);


--
-- Name: idx_budgets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_category ON public.budgets USING btree (category);


--
-- Name: idx_budgets_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_date_range ON public.budgets USING btree (start_date, end_date);


--
-- Name: idx_budgets_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_is_active ON public.budgets USING btree (is_active);


--
-- Name: idx_budgets_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_period ON public.budgets USING btree (period);


--
-- Name: idx_bugs_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bugs_assigned ON public.bug_reports USING btree (assigned_developer);


--
-- Name: idx_bugs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bugs_created ON public.bug_reports USING btree (created_at DESC);


--
-- Name: idx_bugs_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bugs_severity ON public.bug_reports USING btree (severity);


--
-- Name: idx_bugs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bugs_status ON public.bug_reports USING btree (status);


--
-- Name: idx_bugs_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bugs_system ON public.bug_reports USING btree (system_id);


--
-- Name: idx_calls_caller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_caller ON public.calls USING btree (caller_id);


--
-- Name: idx_calls_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calls_conversation ON public.calls USING btree (conversation_id);


--
-- Name: idx_clients_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_company_name ON public.clients USING btree (company_name);


--
-- Name: idx_clients_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_prospect_id ON public.clients USING btree (prospect_id);


--
-- Name: idx_clients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_status ON public.clients USING btree (status);


--
-- Name: idx_comm_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_audit_user ON public.communication_audit_log USING btree (user_id);


--
-- Name: idx_comm_notif_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comm_notif_user ON public.communication_notifications USING btree (user_id);


--
-- Name: idx_connection_logs_connection_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connection_logs_connection_id ON public.external_connection_logs USING btree (connection_id);


--
-- Name: idx_connection_logs_executed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connection_logs_executed_at ON public.external_connection_logs USING btree (executed_at DESC);


--
-- Name: idx_connection_logs_status_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connection_logs_status_code ON public.external_connection_logs USING btree (status_code);


--
-- Name: idx_conv_part_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_part_active ON public.conversation_participants USING btree (is_active);


--
-- Name: idx_conv_part_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_part_conversation ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conv_part_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_part_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_conversations_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_archived ON public.conversations USING btree (is_archived);


--
-- Name: idx_conversations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_created_by ON public.conversations USING btree (created_by);


--
-- Name: idx_conversations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_type ON public.conversations USING btree (type);


--
-- Name: idx_dashboard_configs_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboard_configs_role_id ON public.dashboard_configs USING btree (role_id);


--
-- Name: idx_deals_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_client ON public.deals USING btree (client_id);


--
-- Name: idx_deals_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_client_id ON public.deals USING btree (client_id);


--
-- Name: idx_deals_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_created ON public.deals USING btree (created_at DESC);


--
-- Name: idx_deals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_created_at ON public.deals USING btree (created_at);


--
-- Name: idx_deals_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_due_date ON public.deals USING btree (due_date);


--
-- Name: idx_deals_offering_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_offering_id ON public.deals USING btree (offering_id);


--
-- Name: idx_deals_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_prospect_id ON public.deals USING btree (prospect_id);


--
-- Name: idx_deals_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_service_id ON public.deals USING btree (service_id);


--
-- Name: idx_deals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_status ON public.deals USING btree (status);


--
-- Name: idx_deals_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_status_created ON public.deals USING btree (status, created_at DESC);


--
-- Name: idx_deals_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_system_id ON public.deals USING btree (system_id);


--
-- Name: idx_design_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_assets_category ON public.design_assets USING btree (category);


--
-- Name: idx_design_assets_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_assets_tags ON public.design_assets USING gin (tags);


--
-- Name: idx_design_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_assets_type ON public.design_assets USING btree (asset_type);


--
-- Name: idx_design_exports_design_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_exports_design_id ON public.design_exports USING btree (design_id);


--
-- Name: idx_design_layers_design_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_layers_design_id ON public.design_layers USING btree (design_id);


--
-- Name: idx_design_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_category ON public.design_templates USING btree (category);


--
-- Name: idx_design_templates_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_templates_published ON public.design_templates USING btree (is_published);


--
-- Name: idx_dev_activity_developer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dev_activity_developer ON public.developer_activity USING btree (developer_id);


--
-- Name: idx_dev_activity_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dev_activity_system ON public.developer_activity USING btree (system_id);


--
-- Name: idx_dev_activity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dev_activity_type ON public.developer_activity USING btree (activity_type);


--
-- Name: idx_doc_versions_doc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_versions_doc_id ON public.doc_versions USING btree (doc_id);


--
-- Name: idx_docs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_category ON public.docs USING btree (category);


--
-- Name: idx_docs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_slug ON public.docs USING btree (slug);


--
-- Name: idx_document_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_audit_logs_action ON public.document_audit_logs USING btree (action);


--
-- Name: idx_document_audit_logs_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_audit_logs_document_id ON public.document_audit_logs USING btree (document_id);


--
-- Name: idx_document_comments_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_comments_doc ON public.document_comments USING btree (document_id);


--
-- Name: idx_document_folders_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_folders_parent_id ON public.document_folders USING btree (parent_id);


--
-- Name: idx_document_links_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_links_entity ON public.document_links USING btree (entity_type, entity_id);


--
-- Name: idx_document_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_templates_category ON public.document_templates USING btree (category);


--
-- Name: idx_document_verification_logs_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_verification_logs_document_id ON public.document_verification_logs USING btree (document_id);


--
-- Name: idx_document_verifications_generated_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_verifications_generated_doc ON public.document_verifications USING btree (generated_document_id);


--
-- Name: idx_document_verifications_verified_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_verifications_verified_at ON public.document_verifications USING btree (verified_at DESC);


--
-- Name: idx_document_versions_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_versions_doc ON public.document_versions USING btree (document_id);


--
-- Name: idx_documents_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_category ON public.documents USING btree (category);


--
-- Name: idx_documents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_created ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_entity ON public.documents USING btree (entity_type, entity_id);


--
-- Name: idx_drais_systems_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_drais_systems_name ON public.drais_systems USING btree (name);


--
-- Name: idx_employee_accounts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_accounts_account_id ON public.employee_accounts USING btree (account_id);


--
-- Name: idx_employee_accounts_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_accounts_staff_id ON public.employee_accounts USING btree (staff_id);


--
-- Name: idx_employee_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_accounts_status ON public.employee_accounts USING btree (status);


--
-- Name: idx_employees_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_dept ON public.employees USING btree (department_id);


--
-- Name: idx_employees_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_manager ON public.employees USING btree (manager_id);


--
-- Name: idx_employees_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_role ON public.employees USING btree (role_id);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (employment_status);


--
-- Name: idx_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created ON public.events USING btree (created_at DESC);


--
-- Name: idx_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created_at ON public.events USING btree (created_at DESC);


--
-- Name: idx_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_entity ON public.events USING btree (entity_type, entity_id);


--
-- Name: idx_events_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_entity_id ON public.events USING btree (entity_id);


--
-- Name: idx_events_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_entity_type ON public.events USING btree (entity_type);


--
-- Name: idx_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_event_type ON public.events USING btree (event_type);


--
-- Name: idx_events_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_timeline ON public.events USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_type ON public.events USING btree (event_type);


--
-- Name: idx_exchange_rates_currencies; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rates_currencies ON public.exchange_rates USING btree (from_currency, to_currency);


--
-- Name: idx_exchange_rates_effective_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rates_effective_date ON public.exchange_rates USING btree (effective_date);


--
-- Name: idx_exchange_rates_is_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rates_is_current ON public.exchange_rates USING btree (is_current);


--
-- Name: idx_expenses_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_account_id ON public.expenses USING btree (account_id);


--
-- Name: idx_expenses_budget_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_budget_id ON public.expenses USING btree (budget_id);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category);


--
-- Name: idx_expenses_category_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category_date ON public.expenses USING btree (category, expense_date DESC);


--
-- Name: idx_expenses_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created ON public.expenses USING btree (created_at DESC);


--
-- Name: idx_expenses_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_expense_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_expenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_status ON public.expenses USING btree (status);


--
-- Name: idx_external_connections_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_connections_created_at ON public.external_connections USING btree (created_at DESC);


--
-- Name: idx_external_connections_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_connections_is_active ON public.external_connections USING btree (is_active);


--
-- Name: idx_external_connections_system_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_external_connections_system_type ON public.external_connections USING btree (system_type);


--
-- Name: idx_features_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_features_priority ON public.feature_requests USING btree (priority);


--
-- Name: idx_features_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_features_status ON public.feature_requests USING btree (status);


--
-- Name: idx_features_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_features_system ON public.feature_requests USING btree (system_id);


--
-- Name: idx_followups_performed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_performed_by ON public.followups USING btree (performed_by);


--
-- Name: idx_followups_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_prospect_id ON public.followups USING btree (prospect_id);


--
-- Name: idx_followups_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_scheduled_at ON public.followups USING btree (scheduled_at);


--
-- Name: idx_followups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_status ON public.followups USING btree (status);


--
-- Name: idx_generated_document_logs_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_document_logs_doc ON public.generated_document_logs USING btree (generated_document_id);


--
-- Name: idx_generated_document_logs_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_document_logs_document_id ON public.generated_document_logs USING btree (generated_document_id);


--
-- Name: idx_generated_document_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_document_logs_level ON public.generated_document_logs USING btree (level);


--
-- Name: idx_generated_documents_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_category_id ON public.generated_documents USING btree (category_id);


--
-- Name: idx_generated_documents_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_created_at ON public.generated_documents USING btree (created_at DESC);


--
-- Name: idx_generated_documents_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_expires_at ON public.generated_documents USING btree (expires_at);


--
-- Name: idx_generated_documents_generated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_generated_by ON public.generated_documents USING btree (generated_by);


--
-- Name: idx_generated_documents_recipient_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_recipient_email ON public.generated_documents USING btree (recipient_email);


--
-- Name: idx_generated_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_status ON public.generated_documents USING btree (status);


--
-- Name: idx_generated_documents_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_template ON public.generated_documents USING btree (template_id);


--
-- Name: idx_generated_documents_unique_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_unique_id ON public.generated_documents USING btree (unique_id);


--
-- Name: idx_generated_documents_verification_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_verification_hash ON public.generated_documents USING btree (verification_hash);


--
-- Name: idx_generated_documents_verification_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_documents_verification_token ON public.generated_documents USING btree (verification_token);


--
-- Name: idx_health_logs_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_logs_component ON public.system_health_logs USING btree (component, created_at DESC);


--
-- Name: idx_health_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_logs_status ON public.system_health_logs USING btree (status, created_at DESC);


--
-- Name: idx_idempotency_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_created ON public.idempotency_keys USING btree (created_at);


--
-- Name: idx_identity_audit_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identity_audit_staff ON public.identity_audit_logs USING btree (staff_id);


--
-- Name: idx_identity_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identity_audit_user ON public.identity_audit_logs USING btree (user_id);


--
-- Name: idx_identity_audit_when; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identity_audit_when ON public.identity_audit_logs USING btree (created_at DESC);


--
-- Name: idx_identity_health_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identity_health_generated ON public.identity_health_reports USING btree (generated_at DESC);


--
-- Name: idx_invoices_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_client ON public.invoices USING btree (client_id);


--
-- Name: idx_invoices_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created ON public.invoices USING btree (created_at DESC);


--
-- Name: idx_invoices_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_deal ON public.invoices USING btree (deal_id);


--
-- Name: idx_invoices_issued_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_issued_date ON public.invoices USING btree (issued_date DESC);


--
-- Name: idx_invoices_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_invoices_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_payment ON public.invoices USING btree (payment_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_item_activity_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_activity_action ON public.item_activity_log USING btree (action);


--
-- Name: idx_item_activity_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_item_activity_item ON public.item_activity_log USING btree (item_id);


--
-- Name: idx_items_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_assigned_to ON public.items USING btree (assigned_to);


--
-- Name: idx_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_category ON public.items USING btree (category);


--
-- Name: idx_items_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_created_at ON public.items USING btree (created_at DESC);


--
-- Name: idx_items_financial_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_financial_class ON public.items USING btree (financial_class);


--
-- Name: idx_items_linked_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_linked_system ON public.items USING btree (linked_system);


--
-- Name: idx_items_revenue_dependency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_revenue_dependency ON public.items USING btree (revenue_dependency) WHERE (revenue_dependency = true);


--
-- Name: idx_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_status ON public.items USING btree (status);


--
-- Name: idx_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_items_type ON public.items USING btree (type);


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_status ON public.system_jobs USING btree (status, created_at);


--
-- Name: idx_jobs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_type ON public.system_jobs USING btree (job_type, status);


--
-- Name: idx_knowledge_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_author ON public.knowledge_assets USING btree (author_id);


--
-- Name: idx_knowledge_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_category ON public.knowledge_assets USING btree (category);


--
-- Name: idx_knowledge_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_published ON public.knowledge_articles USING btree (is_published);


--
-- Name: idx_knowledge_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_status ON public.knowledge_assets USING btree (status);


--
-- Name: idx_knowledge_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_system ON public.knowledge_assets USING btree (system_id);


--
-- Name: idx_knowledge_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_title ON public.knowledge_assets USING gin (to_tsvector('english'::regconfig, (title)::text));


--
-- Name: idx_knowledge_versions_kid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_versions_kid ON public.knowledge_versions USING btree (knowledge_id);


--
-- Name: idx_knowledge_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_visibility ON public.knowledge_assets USING btree (visibility);


--
-- Name: idx_ledger_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_account_id ON public.ledger USING btree (account_id);


--
-- Name: idx_ledger_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_category ON public.ledger USING btree (category);


--
-- Name: idx_ledger_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_created_at ON public.ledger USING btree (created_at);


--
-- Name: idx_ledger_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_entry_date ON public.ledger USING btree (entry_date);


--
-- Name: idx_ledger_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_source ON public.ledger USING btree (source_type, source_id);


--
-- Name: idx_license_activations_activated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_activations_activated_at ON public.license_activations USING btree (activated_at DESC);


--
-- Name: idx_license_activations_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_activations_license_id ON public.license_activations USING btree (license_id);


--
-- Name: idx_license_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_audit_logs_created_at ON public.license_audit_logs USING btree (created_at DESC);


--
-- Name: idx_license_audit_logs_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_audit_logs_license_id ON public.license_audit_logs USING btree (license_id);


--
-- Name: idx_license_devices_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_devices_license_id ON public.license_devices USING btree (license_id);


--
-- Name: idx_license_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_events_created_at ON public.license_events USING btree (created_at DESC);


--
-- Name: idx_license_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_events_event_type ON public.license_events USING btree (event_type);


--
-- Name: idx_license_events_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_events_license_id ON public.license_events USING btree (license_id);


--
-- Name: idx_license_renewals_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_license_renewals_license_id ON public.license_renewals USING btree (license_id);


--
-- Name: idx_licenses_activated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_activated_at ON public.licenses USING btree (activated_at);


--
-- Name: idx_licenses_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_client_id ON public.licenses USING btree (client_id);


--
-- Name: idx_licenses_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_deal_id ON public.licenses USING btree (deal_id);


--
-- Name: idx_licenses_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_expires_at ON public.licenses USING btree (expires_at);


--
-- Name: idx_licenses_issued_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_issued_date ON public.licenses USING btree (issued_date);


--
-- Name: idx_licenses_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_plan_id ON public.licenses USING btree (plan_id);


--
-- Name: idx_licenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_status ON public.licenses USING btree (status);


--
-- Name: idx_licenses_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_subscription_id ON public.licenses USING btree (subscription_id);


--
-- Name: idx_licenses_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_system_id ON public.licenses USING btree (system_id);


--
-- Name: idx_markdown_ingestion_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markdown_ingestion_jobs_created_at ON public.markdown_ingestion_jobs USING btree (created_at);


--
-- Name: idx_markdown_ingestion_jobs_job_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markdown_ingestion_jobs_job_status ON public.markdown_ingestion_jobs USING btree (job_status);


--
-- Name: idx_markdown_ingestion_jobs_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_markdown_ingestion_jobs_system_id ON public.markdown_ingestion_jobs USING btree (system_id);


--
-- Name: idx_media_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_entity ON public.media USING btree (entity_type, entity_id);


--
-- Name: idx_media_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_tags ON public.media USING gin (tags);


--
-- Name: idx_messages_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conv_created ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_deleted ON public.messages USING btree (deleted_at);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_msg_status_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msg_status_message ON public.message_status USING btree (message_id);


--
-- Name: idx_msg_status_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msg_status_user ON public.message_status USING btree (user_id);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_user_id, is_read, created_at DESC);


--
-- Name: idx_notifications_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_reference ON public.notifications USING btree (reference_type, reference_id);


--
-- Name: idx_obligation_templates_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligation_templates_system ON public.obligation_templates USING btree (system_id);


--
-- Name: idx_obligations_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_assigned ON public.client_obligations USING btree (assigned_to);


--
-- Name: idx_obligations_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_client ON public.client_obligations USING btree (client_id);


--
-- Name: idx_obligations_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_deal ON public.client_obligations USING btree (deal_id);


--
-- Name: idx_obligations_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_due ON public.client_obligations USING btree (due_date) WHERE ((status)::text <> 'completed'::text);


--
-- Name: idx_obligations_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_priority ON public.client_obligations USING btree (priority);


--
-- Name: idx_obligations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_status ON public.client_obligations USING btree (status);


--
-- Name: idx_obligations_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_obligations_system ON public.client_obligations USING btree (system_id);


--
-- Name: idx_offerings_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offerings_is_active ON public.offerings USING btree (is_active);


--
-- Name: idx_offerings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offerings_type ON public.offerings USING btree (type);


--
-- Name: idx_operations_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_account ON public.operations USING btree (account_id);


--
-- Name: idx_operations_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_category ON public.operations USING btree (category);


--
-- Name: idx_operations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_created ON public.operations USING btree (created_at DESC);


--
-- Name: idx_operations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_created_at ON public.operations USING btree (created_at);


--
-- Name: idx_operations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_created_by ON public.operations USING btree (created_by);


--
-- Name: idx_operations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_date ON public.operations USING btree (operation_date);


--
-- Name: idx_operations_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_deal_id ON public.operations USING btree (related_deal_id);


--
-- Name: idx_operations_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_system_id ON public.operations USING btree (related_system_id);


--
-- Name: idx_operations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operations_type ON public.operations USING btree (operation_type);


--
-- Name: idx_org_change_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_change_logs_entity ON public.org_change_logs USING btree (entity_type, entity_id);


--
-- Name: idx_org_change_logs_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_change_logs_time ON public.org_change_logs USING btree (created_at DESC);


--
-- Name: idx_org_structure_authority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_structure_authority ON public.organizational_structure USING btree (authority_level_id);


--
-- Name: idx_org_structure_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_structure_dept ON public.organizational_structure USING btree (department_id);


--
-- Name: idx_org_structure_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_structure_parent ON public.organizational_structure USING btree (reports_to_node_id);


--
-- Name: idx_org_structure_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_structure_staff ON public.organizational_structure USING btree (staff_assigned_id);


--
-- Name: idx_org_structure_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_structure_status ON public.organizational_structure USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_payments_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_account_id ON public.payments USING btree (account_id);


--
-- Name: idx_payments_amount_ugx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_amount_ugx ON public.payments USING btree (amount_ugx);


--
-- Name: idx_payments_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_deal_id ON public.payments USING btree (deal_id);


--
-- Name: idx_payments_original_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_original_currency ON public.payments USING btree (original_currency);


--
-- Name: idx_payments_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payouts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_account_id ON public.payouts USING btree (account_id);


--
-- Name: idx_payouts_employee_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_employee_account_id ON public.payouts USING btree (employee_account_id);


--
-- Name: idx_payouts_payout_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_payout_date ON public.payouts USING btree (payout_date);


--
-- Name: idx_payouts_payout_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_payout_type ON public.payouts USING btree (payout_type);


--
-- Name: idx_payouts_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_staff_id ON public.payouts USING btree (staff_id);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);


--
-- Name: idx_perf_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perf_employee ON public.performance_metrics USING btree (employee_id);


--
-- Name: idx_perf_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perf_type ON public.performance_metrics USING btree (metric_type);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);


--
-- Name: idx_permissions_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_route ON public.permissions USING btree (route_path);


--
-- Name: idx_pipe_history_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipe_history_entry ON public.pipeline_stage_history USING btree (pipeline_entry_id);


--
-- Name: idx_pipe_history_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipe_history_stage ON public.pipeline_stage_history USING btree (stage_id);


--
-- Name: idx_pipeline_entries_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_assigned ON public.pipeline_entries USING btree (assigned_to);


--
-- Name: idx_pipeline_entries_prospect; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pipeline_entries_prospect ON public.pipeline_entries USING btree (prospect_id);


--
-- Name: idx_pipeline_entries_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_stage ON public.pipeline_entries USING btree (current_stage_id);


--
-- Name: idx_pipeline_entries_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_entries_system ON public.pipeline_entries USING btree (system_id);


--
-- Name: idx_pricing_cycles_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_cycles_plan_id ON public.pricing_cycles USING btree (plan_id);


--
-- Name: idx_pricing_features_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_features_plan_id ON public.pricing_features USING btree (plan_id);


--
-- Name: idx_pricing_plan_changes_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plan_changes_plan_id ON public.pricing_plan_changes USING btree (plan_id);


--
-- Name: idx_pricing_plan_feature_history_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plan_feature_history_plan_id ON public.pricing_plan_feature_history USING btree (plan_id);


--
-- Name: idx_pricing_plan_versions_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plan_versions_current ON public.pricing_plan_versions USING btree (plan_id) WHERE is_current;


--
-- Name: idx_pricing_plan_versions_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plan_versions_plan_id ON public.pricing_plan_versions USING btree (plan_id);


--
-- Name: idx_pricing_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plans_active ON public.system_pricing_plans USING btree (is_active);


--
-- Name: idx_pricing_plans_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plans_is_active ON public.pricing_plans USING btree (is_active);


--
-- Name: idx_pricing_plans_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plans_system ON public.system_pricing_plans USING btree (system_id);


--
-- Name: idx_proposal_snapshots_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposal_snapshots_proposal_id ON public.proposal_snapshots USING btree (proposal_id);


--
-- Name: idx_proposals_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_created_by ON public.proposals USING btree (created_by);


--
-- Name: idx_proposals_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_prospect_id ON public.proposals USING btree (prospect_id);


--
-- Name: idx_proposals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_status ON public.proposals USING btree (status);


--
-- Name: idx_proposals_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_system_id ON public.proposals USING btree (system_id);


--
-- Name: idx_prospect_contacts_prospect_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospect_contacts_prospect_id ON public.prospect_contacts USING btree (prospect_id);


--
-- Name: idx_prospects_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_assigned_to ON public.prospects USING btree (assigned_to);


--
-- Name: idx_prospects_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_company ON public.prospects USING btree (company_name);


--
-- Name: idx_prospects_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_created ON public.prospects USING btree (created_at DESC);


--
-- Name: idx_prospects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_created_at ON public.prospects USING btree (created_at);


--
-- Name: idx_prospects_followup_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_followup_date ON public.prospects USING btree (next_followup_date);


--
-- Name: idx_prospects_next_followup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_next_followup ON public.prospects USING btree (next_followup_date);


--
-- Name: idx_prospects_pipeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_pipeline ON public.prospects USING btree (pipeline);


--
-- Name: idx_prospects_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_priority ON public.prospects USING btree (priority);


--
-- Name: idx_prospects_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_service_id ON public.prospects USING btree (service_id);


--
-- Name: idx_prospects_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_source ON public.prospects USING btree (source);


--
-- Name: idx_prospects_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_stage ON public.prospects USING btree (stage);


--
-- Name: idx_prospects_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prospects_system_id ON public.prospects USING btree (system_id);


--
-- Name: idx_rbac_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_audit_logs_action ON public.rbac_audit_logs USING btree (action);


--
-- Name: idx_rbac_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_audit_logs_user ON public.rbac_audit_logs USING btree (user_id);


--
-- Name: idx_resolutions_bug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resolutions_bug ON public.issue_resolutions USING btree (bug_report_id);


--
-- Name: idx_resolutions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resolutions_type ON public.issue_resolutions USING btree (resolution_type);


--
-- Name: idx_resources_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_assigned ON public._deprecated_resources USING btree (assigned_to);


--
-- Name: idx_resources_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_category ON public._deprecated_resources USING btree (category);


--
-- Name: idx_resources_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resources_status ON public._deprecated_resources USING btree (status);


--
-- Name: idx_rev_alloc_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rev_alloc_category ON public.revenue_allocations USING btree (category);


--
-- Name: idx_rev_alloc_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rev_alloc_event ON public.revenue_allocations USING btree (revenue_event_id);


--
-- Name: idx_revenue_allocated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_allocated ON public.revenue_events USING btree (allocated);


--
-- Name: idx_revenue_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_date ON public.revenue_events USING btree (date_received DESC);


--
-- Name: idx_revenue_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_source ON public.revenue_events USING btree (source_type);


--
-- Name: idx_role_permissions_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- Name: idx_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_active ON public.roles USING btree (is_active);


--
-- Name: idx_roles_authority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_authority ON public.roles USING btree (authority_level);


--
-- Name: idx_roles_authority_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_authority_level ON public.roles USING btree (authority_level);


--
-- Name: idx_root_causes_bug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_root_causes_bug ON public.issue_root_causes USING btree (bug_report_id);


--
-- Name: idx_root_causes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_root_causes_category ON public.issue_root_causes USING btree (category);


--
-- Name: idx_secret_view_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secret_view_tokens_expires_at ON public.secret_view_tokens USING btree (expires_at);


--
-- Name: idx_secret_view_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secret_view_tokens_token ON public.secret_view_tokens USING btree (token);


--
-- Name: idx_secret_view_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_secret_view_tokens_user_id ON public.secret_view_tokens USING btree (user_id);


--
-- Name: idx_services_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_active ON public.services USING btree (is_active);


--
-- Name: idx_services_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_type ON public.services USING btree (service_type);


--
-- Name: idx_sessions_browser; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_browser ON public.sessions USING btree (browser);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_active ON public.sessions USING btree (user_id, expires_at) WHERE (is_revoked = false);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_staff_account_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_account_status ON public.staff USING btree (account_status);


--
-- Name: idx_staff_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_department ON public.staff USING btree (department);


--
-- Name: idx_staff_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_department_id ON public.staff USING btree (department_id);


--
-- Name: idx_staff_employment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_employment_status ON public.staff USING btree (employment_status);


--
-- Name: idx_staff_join_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_join_date ON public.staff USING btree (join_date);


--
-- Name: idx_staff_linked_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_staff_linked_user ON public.staff USING btree (linked_user_id) WHERE (linked_user_id IS NOT NULL);


--
-- Name: idx_staff_linked_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_linked_user_id ON public.staff USING btree (linked_user_id);


--
-- Name: idx_staff_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_manager ON public.staff USING btree (manager_id);


--
-- Name: idx_staff_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_role_id ON public.staff USING btree (role_id);


--
-- Name: idx_staff_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_roles_role ON public.staff_roles USING btree (role_id);


--
-- Name: idx_staff_roles_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_roles_staff ON public.staff_roles USING btree (staff_id);


--
-- Name: idx_staff_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_user_id ON public.staff USING btree (user_id);


--
-- Name: idx_subscription_cycles_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_cycles_subscription_id ON public.subscription_cycles USING btree (subscription_id);


--
-- Name: idx_subscription_events_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_sub ON public.subscription_events USING btree (subscription_id);


--
-- Name: idx_subscription_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_events_type ON public.subscription_events USING btree (event_type);


--
-- Name: idx_subscription_pause_history_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_pause_history_sub ON public.subscription_pause_history USING btree (subscription_id);


--
-- Name: idx_subscription_payments_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_payments_sub ON public.subscription_payments USING btree (subscription_id);


--
-- Name: idx_subscription_status_history_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_status_history_sub ON public.subscription_status_history USING btree (subscription_id);


--
-- Name: idx_subscriptions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_client_id ON public.subscriptions USING btree (client_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_system ON public.subscriptions USING btree (system);


--
-- Name: idx_system_architecture_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_architecture_system_id ON public.system_architecture USING btree (system_id);


--
-- Name: idx_system_changes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_changes_status ON public.system_changes USING btree (status);


--
-- Name: idx_system_changes_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_changes_system_id ON public.system_changes USING btree (system_id);


--
-- Name: idx_system_costs_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_costs_system ON public.system_costs USING btree (system_id);


--
-- Name: idx_system_costs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_costs_type ON public.system_costs USING btree (cost_type);


--
-- Name: idx_system_events_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_actor ON public.system_events USING btree (actor_user_id);


--
-- Name: idx_system_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_created ON public.system_events USING btree (created_at DESC);


--
-- Name: idx_system_events_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_entity ON public.system_events USING btree (entity_type, entity_id);


--
-- Name: idx_system_events_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_name ON public.system_events USING btree (event_name);


--
-- Name: idx_system_intelligence_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_category ON public.system_intelligence USING btree (category);


--
-- Name: idx_system_intelligence_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_created_at ON public.system_intelligence USING btree (created_at);


--
-- Name: idx_system_intelligence_internal_notes_intelligence_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_internal_notes_intelligence_id ON public.system_intelligence_internal_notes USING btree (intelligence_id);


--
-- Name: idx_system_intelligence_search_vector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_search_vector ON public.system_intelligence USING gin (search_vector);


--
-- Name: idx_system_intelligence_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_system_id ON public.system_intelligence USING btree (system_id);


--
-- Name: idx_system_intelligence_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_intelligence_tags ON public.system_intelligence USING gin (tags);


--
-- Name: idx_system_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_issues_status ON public.system_issues USING btree (status);


--
-- Name: idx_system_issues_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_issues_system_id ON public.system_issues USING btree (system_id);


--
-- Name: idx_system_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);


--
-- Name: idx_system_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_level ON public.system_logs USING btree (level);


--
-- Name: idx_system_logs_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_module ON public.system_logs USING btree (module);


--
-- Name: idx_system_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_user_id ON public.system_logs USING btree (user_id);


--
-- Name: idx_system_modules_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_modules_created_at ON public.system_modules USING btree (created_at);


--
-- Name: idx_system_modules_module_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_modules_module_name ON public.system_modules USING btree (module_name);


--
-- Name: idx_system_modules_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_modules_status ON public.system_modules USING btree (status);


--
-- Name: idx_system_modules_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_modules_system_id ON public.system_modules USING btree (system_id);


--
-- Name: idx_system_operations_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_operations_system_id ON public.system_operations USING btree (system_id);


--
-- Name: idx_system_operations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_operations_type ON public.system_operations USING btree (operation_type);


--
-- Name: idx_system_tech_profiles_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_tech_profiles_created_at ON public.system_tech_profiles USING btree (created_at);


--
-- Name: idx_system_tech_profiles_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_tech_profiles_system_id ON public.system_tech_profiles USING btree (system_id);


--
-- Name: idx_system_versions_released_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_versions_released_at ON public.system_versions USING btree (released_at);


--
-- Name: idx_system_versions_system_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_versions_system_id ON public.system_versions USING btree (system_id);


--
-- Name: idx_system_versions_version_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_versions_version_number ON public.system_versions USING btree (version_number);


--
-- Name: idx_systems_has_intelligence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_systems_has_intelligence ON public.systems USING btree (has_intelligence);


--
-- Name: idx_systems_intelligence_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_systems_intelligence_score ON public.systems USING btree (intelligence_score);


--
-- Name: idx_systems_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_systems_name ON public.systems USING btree (name);


--
-- Name: idx_systems_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_systems_status ON public.systems USING btree (status);


--
-- Name: idx_tech_stack_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tech_stack_system ON public.tech_stack_entries USING btree (system_id);


--
-- Name: idx_transfers_from_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_from_account ON public.transfers USING btree (from_account_id);


--
-- Name: idx_transfers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_status ON public.transfers USING btree (status);


--
-- Name: idx_transfers_to_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_to_account ON public.transfers USING btree (to_account_id);


--
-- Name: idx_transfers_transfer_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfers_transfer_date ON public.transfers USING btree (transfer_date);


--
-- Name: idx_user_designs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_designs_created_by ON public.user_designs USING btree (created_by);


--
-- Name: idx_user_designs_is_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_designs_is_template ON public.user_designs USING btree (is_template);


--
-- Name: idx_user_designs_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_designs_updated_at ON public.user_designs USING btree (updated_at DESC);


--
-- Name: idx_user_presence_is_online; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_presence_is_online ON public.user_presence USING btree (is_online);


--
-- Name: idx_user_presence_last_ping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_presence_last_ping ON public.user_presence USING btree (last_ping DESC);


--
-- Name: idx_user_presence_route; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_presence_route ON public.user_presence USING btree (current_route);


--
-- Name: idx_user_presence_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_presence_status ON public.user_presence USING btree (status);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_authority_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_authority_level ON public.users USING btree (authority_level);


--
-- Name: idx_users_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_active ON public.users USING btree (email) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_users_first_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_first_login ON public.users USING btree (first_login_completed);


--
-- Name: idx_users_last_seen_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_seen_at ON public.users USING btree (last_seen_at DESC);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_staff_id ON public.users USING btree (staff_id);


--
-- Name: idx_webauthn_challenges_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webauthn_challenges_expires_at ON public.webauthn_challenges USING btree (expires_at);


--
-- Name: idx_webauthn_challenges_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webauthn_challenges_user_type ON public.webauthn_challenges USING btree (user_id, type);


--
-- Name: uq_backup_storage_targets_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_backup_storage_targets_name ON public.backup_storage_targets USING btree (name);


--
-- Name: uq_company_branding_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_company_branding_active ON public.company_branding USING btree (is_active) WHERE is_active;


--
-- Name: uq_license_devices_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_license_devices_fingerprint ON public.license_devices USING btree (license_id, device_fingerprint);


--
-- Name: uq_license_domains; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_license_domains ON public.license_domains USING btree (license_id, domain);


--
-- Name: uq_license_feature_access; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_license_feature_access ON public.license_feature_access USING btree (license_id, feature_key);


--
-- Name: uq_licenses_license_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_licenses_license_key ON public.licenses USING btree (license_key) WHERE (license_key IS NOT NULL);


--
-- Name: uq_pricing_plan_features; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pricing_plan_features ON public.pricing_plan_features USING btree (plan_id, feature_key);


--
-- Name: uq_staff_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_staff_user_id ON public.staff USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: uq_subscription_cycles_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subscription_cycles_number ON public.subscription_cycles USING btree (subscription_id, cycle_number);


--
-- Name: uq_users_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_staff_id ON public.users USING btree (staff_id) WHERE (staff_id IS NOT NULL);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username) WHERE (username IS NOT NULL);


--
-- Name: accounts trg_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: _deprecated_assets trg_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public._deprecated_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: budgets trg_budgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients trg_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deals trg_deals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drais_systems trg_drais_systems_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_drais_systems_updated_at BEFORE UPDATE ON public.drais_systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: expenses trg_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: followups trg_followups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_followups_updated_at BEFORE UPDATE ON public.followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: licenses trg_licenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_licenses_updated_at BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: offerings trg_offerings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_offerings_updated_at BEFORE UPDATE ON public.offerings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: operations trg_operations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_operations_updated_at BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments trg_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pricing_cycles trg_pricing_cycles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pricing_cycles_updated_at BEFORE UPDATE ON public.pricing_cycles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_pricing_plans trg_pricing_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pricing_plans_updated_at BEFORE UPDATE ON public.system_pricing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: proposals trg_proposals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: prospect_contacts trg_prospect_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prospect_contacts_updated_at BEFORE UPDATE ON public.prospect_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prospects trg_prospects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prospects_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_presence trg_refresh_presence_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_presence_status BEFORE INSERT OR UPDATE OF last_ping ON public.user_presence FOR EACH ROW EXECUTE FUNCTION public.refresh_presence_status();


--
-- Name: services trg_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff trg_staff_mirror_user_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_mirror_user_id BEFORE INSERT OR UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.mirror_staff_user_id();


--
-- Name: subscriptions trg_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff_roles trg_sync_authority_on_role_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_authority_on_role_change AFTER INSERT OR DELETE OR UPDATE ON public.staff_roles FOR EACH ROW EXECUTE FUNCTION public.sync_user_authority_level();


--
-- Name: system_changes trg_system_changes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_changes_updated_at BEFORE UPDATE ON public.system_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: system_issues trg_system_issues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_issues_updated_at BEFORE UPDATE ON public.system_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: systems trg_systems_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_systems_updated_at BEFORE UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transfers trg_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_designs trg_user_designs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_designs_updated_at BEFORE UPDATE ON public.user_designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_intelligence trigger_system_intelligence_search_vector; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_system_intelligence_search_vector BEFORE INSERT OR UPDATE ON public.system_intelligence FOR EACH ROW EXECUTE FUNCTION public.update_system_intelligence_search_vector();


--
-- Name: activity_logs activity_logs_actor_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_role_id_fkey FOREIGN KEY (actor_role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: allocations allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.accounts(id);


--
-- Name: approval_requests approval_requests_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id);


--
-- Name: approval_requests approval_requests_requester_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users(id);


--
-- Name: _deprecated_assets assets_account_deducted_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_assets
    ADD CONSTRAINT assets_account_deducted_from_fkey FOREIGN KEY (account_deducted_from) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: _deprecated_assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: _deprecated_assets assets_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_assets
    ADD CONSTRAINT assets_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES public.ledger(id) ON DELETE SET NULL;


--
-- Name: auth_passkeys auth_passkeys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_passkeys
    ADD CONSTRAINT auth_passkeys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: authority_levels authority_levels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_levels
    ADD CONSTRAINT authority_levels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: backup_jobs backup_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_jobs
    ADD CONSTRAINT backup_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: backup_jobs backup_jobs_storage_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_jobs
    ADD CONSTRAINT backup_jobs_storage_target_id_fkey FOREIGN KEY (storage_target_id) REFERENCES public.backup_storage_targets(id) ON DELETE SET NULL;


--
-- Name: backup_logs backup_logs_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES public.system_backups(id) ON DELETE CASCADE;


--
-- Name: backup_logs backup_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.backup_jobs(id) ON DELETE SET NULL;


--
-- Name: backup_restores backup_restores_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_restores
    ADD CONSTRAINT backup_restores_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: backup_restores backup_restores_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_restores
    ADD CONSTRAINT backup_restores_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES public.system_backups(id) ON DELETE CASCADE;


--
-- Name: backup_restores backup_restores_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_restores
    ADD CONSTRAINT backup_restores_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: call_logs call_logs_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.users(id);


--
-- Name: call_logs call_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: call_participants call_participants_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.call_logs(id) ON DELETE CASCADE;


--
-- Name: call_participants call_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_participants
    ADD CONSTRAINT call_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: calls calls_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.users(id);


--
-- Name: calls calls_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: client_obligations client_obligations_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: client_obligations client_obligations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: client_obligations client_obligations_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_obligations client_obligations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_obligations client_obligations_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: client_obligations client_obligations_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_obligations
    ADD CONSTRAINT client_obligations_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: communication_audit_log communication_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_audit_log
    ADD CONSTRAINT communication_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: communication_notifications communication_notifications_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);


--
-- Name: communication_notifications communication_notifications_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: communication_notifications communication_notifications_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);


--
-- Name: communication_notifications communication_notifications_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);


--
-- Name: communication_notifications communication_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_notifications
    ADD CONSTRAINT communication_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: communication_settings communication_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_settings
    ADD CONSTRAINT communication_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: company_branding company_branding_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_branding
    ADD CONSTRAINT company_branding_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: dashboard_configs dashboard_configs_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_configs
    ADD CONSTRAINT dashboard_configs_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: deals deals_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.system_pricing_plans(id) ON DELETE SET NULL;


--
-- Name: deals deals_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: deals deals_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: department_documents department_documents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_documents
    ADD CONSTRAINT department_documents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_kpis department_kpis_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_kpis
    ADD CONSTRAINT department_kpis_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_policies department_policies_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_policies
    ADD CONSTRAINT department_policies_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_processes department_processes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_processes
    ADD CONSTRAINT department_processes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_roles department_roles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_roles department_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: departments departments_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_parent_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_department_id_fkey FOREIGN KEY (parent_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: design_asset_collection_items design_asset_collection_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collection_items
    ADD CONSTRAINT design_asset_collection_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.design_assets(id) ON DELETE CASCADE;


--
-- Name: design_asset_collection_items design_asset_collection_items_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collection_items
    ADD CONSTRAINT design_asset_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.design_asset_collections(id) ON DELETE CASCADE;


--
-- Name: design_asset_collections design_asset_collections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_asset_collections
    ADD CONSTRAINT design_asset_collections_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_assets design_assets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_assets
    ADD CONSTRAINT design_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_brandkits design_brandkits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_brandkits
    ADD CONSTRAINT design_brandkits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_exports design_exports_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_exports
    ADD CONSTRAINT design_exports_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.user_designs(id) ON DELETE CASCADE;


--
-- Name: design_exports design_exports_exported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_exports
    ADD CONSTRAINT design_exports_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_layers design_layers_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_layers
    ADD CONSTRAINT design_layers_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.user_designs(id) ON DELETE CASCADE;


--
-- Name: design_project_items design_project_items_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_project_items
    ADD CONSTRAINT design_project_items_design_id_fkey FOREIGN KEY (design_id) REFERENCES public.user_designs(id) ON DELETE CASCADE;


--
-- Name: design_project_items design_project_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_project_items
    ADD CONSTRAINT design_project_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.design_projects(id) ON DELETE CASCADE;


--
-- Name: design_projects design_projects_cover_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_projects
    ADD CONSTRAINT design_projects_cover_design_id_fkey FOREIGN KEY (cover_design_id) REFERENCES public.user_designs(id) ON DELETE SET NULL;


--
-- Name: design_projects design_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_projects
    ADD CONSTRAINT design_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_template_versions design_template_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_template_versions
    ADD CONSTRAINT design_template_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: design_template_versions design_template_versions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_template_versions
    ADD CONSTRAINT design_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.design_templates(id) ON DELETE CASCADE;


--
-- Name: design_templates design_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates
    ADD CONSTRAINT design_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: doc_versions doc_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT doc_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: doc_versions doc_versions_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_versions
    ADD CONSTRAINT doc_versions_doc_id_fkey FOREIGN KEY (doc_id) REFERENCES public.docs(id) ON DELETE CASCADE;


--
-- Name: docs docs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs
    ADD CONSTRAINT docs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_approvals document_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approvals
    ADD CONSTRAINT document_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_approvals document_approvals_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approvals
    ADD CONSTRAINT document_approvals_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_audit_logs document_audit_logs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_audit_logs
    ADD CONSTRAINT document_audit_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;


--
-- Name: document_comments document_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_comments document_comments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_comments document_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_comments(id) ON DELETE CASCADE;


--
-- Name: document_comments document_comments_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_comments
    ADD CONSTRAINT document_comments_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_folders document_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_folders document_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: document_links document_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_links document_links_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_permissions document_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_tag_links document_tag_links_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tag_links
    ADD CONSTRAINT document_tag_links_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_tag_links document_tag_links_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tag_links
    ADD CONSTRAINT document_tag_links_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.document_tags(id) ON DELETE CASCADE;


--
-- Name: document_templates document_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_verification_logs document_verification_logs_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verification_logs
    ADD CONSTRAINT document_verification_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;


--
-- Name: document_verifications document_verifications_generated_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_verifications
    ADD CONSTRAINT document_verifications_generated_document_id_fkey FOREIGN KEY (generated_document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_accounts employee_accounts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_accounts
    ADD CONSTRAINT employee_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: employee_accounts employee_accounts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_accounts
    ADD CONSTRAINT employee_accounts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: employees employees_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: external_connection_logs external_connection_logs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connection_logs
    ADD CONSTRAINT external_connection_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.external_connections(id) ON DELETE CASCADE;


--
-- Name: external_connections external_connections_last_rotated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_connections
    ADD CONSTRAINT external_connections_last_rotated_by_fkey FOREIGN KEY (last_rotated_by) REFERENCES public.users(id);


--
-- Name: system_backups fk_backups_storage_target; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_backups
    ADD CONSTRAINT fk_backups_storage_target FOREIGN KEY (storage_target_id) REFERENCES public.backup_storage_targets(id) ON DELETE SET NULL;


--
-- Name: design_projects fk_design_projects_brandkit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_projects
    ADD CONSTRAINT fk_design_projects_brandkit FOREIGN KEY (brandkit_id) REFERENCES public.design_brandkits(id) ON DELETE SET NULL;


--
-- Name: documents fk_documents_folder; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_folder FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE SET NULL;


--
-- Name: documents fk_documents_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_template FOREIGN KEY (template_id) REFERENCES public.document_templates(id) ON DELETE SET NULL;


--
-- Name: generated_documents fk_generated_documents_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT fk_generated_documents_category FOREIGN KEY (category_id) REFERENCES public.document_categories(id);


--
-- Name: licenses fk_licenses_subscription_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT fk_licenses_subscription_id FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: staff fk_staff_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT fk_staff_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_staff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_staff FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: generated_document_logs generated_document_logs_generated_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_document_logs
    ADD CONSTRAINT generated_document_logs_generated_document_id_fkey FOREIGN KEY (generated_document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;


--
-- Name: generated_documents generated_documents_branding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_branding_id_fkey FOREIGN KEY (branding_id) REFERENCES public.document_branding(id);


--
-- Name: generated_documents generated_documents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_documents
    ADD CONSTRAINT generated_documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);


--
-- Name: idempotency_keys idempotency_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: identity_audit_logs identity_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_audit_logs
    ADD CONSTRAINT identity_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: identity_audit_logs identity_audit_logs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_audit_logs
    ADD CONSTRAINT identity_audit_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: identity_audit_logs identity_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_audit_logs
    ADD CONSTRAINT identity_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: identity_health_reports identity_health_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_health_reports
    ADD CONSTRAINT identity_health_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: issue_resolutions issue_resolutions_bug_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_resolutions
    ADD CONSTRAINT issue_resolutions_bug_report_id_fkey FOREIGN KEY (bug_report_id) REFERENCES public.bug_reports(id) ON DELETE CASCADE;


--
-- Name: issue_resolutions issue_resolutions_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_resolutions
    ADD CONSTRAINT issue_resolutions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: issue_resolutions issue_resolutions_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_resolutions
    ADD CONSTRAINT issue_resolutions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: issue_root_causes issue_root_causes_bug_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_root_causes
    ADD CONSTRAINT issue_root_causes_bug_report_id_fkey FOREIGN KEY (bug_report_id) REFERENCES public.bug_reports(id) ON DELETE CASCADE;


--
-- Name: issue_root_causes issue_root_causes_identified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_root_causes
    ADD CONSTRAINT issue_root_causes_identified_by_fkey FOREIGN KEY (identified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: item_activity_log item_activity_log_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_activity_log
    ADD CONSTRAINT item_activity_log_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: item_activity_log item_activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_activity_log
    ADD CONSTRAINT item_activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_account_deducted_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_account_deducted_from_fkey FOREIGN KEY (account_deducted_from) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: items items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: items items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES public.ledger(id) ON DELETE SET NULL;


--
-- Name: items items_linked_system_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_linked_system_fkey FOREIGN KEY (linked_system) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: knowledge_assets knowledge_assets_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_assets
    ADD CONSTRAINT knowledge_assets_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_assets knowledge_assets_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_assets
    ADD CONSTRAINT knowledge_assets_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: knowledge_versions knowledge_versions_edited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_versions
    ADD CONSTRAINT knowledge_versions_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_versions knowledge_versions_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_versions
    ADD CONSTRAINT knowledge_versions_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.knowledge_assets(id) ON DELETE CASCADE;


--
-- Name: license_activations license_activations_activated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_activations
    ADD CONSTRAINT license_activations_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_activations license_activations_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_activations
    ADD CONSTRAINT license_activations_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_audit_logs license_audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_audit_logs
    ADD CONSTRAINT license_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_audit_logs license_audit_logs_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_audit_logs
    ADD CONSTRAINT license_audit_logs_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE SET NULL;


--
-- Name: license_devices license_devices_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_devices
    ADD CONSTRAINT license_devices_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_domains license_domains_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_domains
    ADD CONSTRAINT license_domains_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_domains license_domains_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_domains
    ADD CONSTRAINT license_domains_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_events license_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_events
    ADD CONSTRAINT license_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_events license_events_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_events
    ADD CONSTRAINT license_events_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_feature_access license_feature_access_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_feature_access
    ADD CONSTRAINT license_feature_access_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_feature_access license_feature_access_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_feature_access
    ADD CONSTRAINT license_feature_access_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: license_renewals license_renewals_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_renewals
    ADD CONSTRAINT license_renewals_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: license_renewals license_renewals_renewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_renewals
    ADD CONSTRAINT license_renewals_renewed_by_fkey FOREIGN KEY (renewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: licenses licenses_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: licenses licenses_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- Name: licenses licenses_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: licenses licenses_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.system_pricing_plans(id) ON DELETE SET NULL;


--
-- Name: licenses licenses_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);


--
-- Name: markdown_ingestion_jobs markdown_ingestion_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdown_ingestion_jobs
    ADD CONSTRAINT markdown_ingestion_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: markdown_ingestion_jobs markdown_ingestion_jobs_intelligence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdown_ingestion_jobs
    ADD CONSTRAINT markdown_ingestion_jobs_intelligence_id_fkey FOREIGN KEY (intelligence_id) REFERENCES public.system_intelligence(id) ON DELETE SET NULL;


--
-- Name: markdown_ingestion_jobs markdown_ingestion_jobs_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.markdown_ingestion_jobs
    ADD CONSTRAINT markdown_ingestion_jobs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: media_permissions media_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_permissions
    ADD CONSTRAINT media_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: message_status message_status_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_status message_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_message_id_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.system_events(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: obligation_templates obligation_templates_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.obligation_templates
    ADD CONSTRAINT obligation_templates_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: operations operations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: operations operations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: operations operations_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES public.ledger(id) ON DELETE SET NULL;


--
-- Name: operations operations_related_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_related_deal_id_fkey FOREIGN KEY (related_deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: operations operations_related_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operations
    ADD CONSTRAINT operations_related_system_id_fkey FOREIGN KEY (related_system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: org_change_logs org_change_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_change_logs
    ADD CONSTRAINT org_change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: organizational_structure organizational_structure_authority_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_authority_level_id_fkey FOREIGN KEY (authority_level_id) REFERENCES public.authority_levels(id) ON DELETE SET NULL;


--
-- Name: organizational_structure organizational_structure_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: organizational_structure organizational_structure_reports_to_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_reports_to_node_id_fkey FOREIGN KEY (reports_to_node_id) REFERENCES public.organizational_structure(id) ON DELETE SET NULL;


--
-- Name: organizational_structure organizational_structure_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: organizational_structure organizational_structure_staff_assigned_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizational_structure
    ADD CONSTRAINT organizational_structure_staff_assigned_id_fkey FOREIGN KEY (staff_assigned_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: payouts payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_employee_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_employee_account_id_fkey FOREIGN KEY (employee_account_id) REFERENCES public.employee_accounts(id) ON DELETE SET NULL;


--
-- Name: payouts payouts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: performance_metrics performance_metrics_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: pipeline_entries pipeline_entries_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: pipeline_entries pipeline_entries_current_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_current_stage_id_fkey FOREIGN KEY (current_stage_id) REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT;


--
-- Name: pipeline_entries pipeline_entries_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: pipeline_entries pipeline_entries_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: pipeline_stage_history pipeline_stage_history_pipeline_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_history
    ADD CONSTRAINT pipeline_stage_history_pipeline_entry_id_fkey FOREIGN KEY (pipeline_entry_id) REFERENCES public.pipeline_entries(id) ON DELETE CASCADE;


--
-- Name: pipeline_stage_history pipeline_stage_history_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_history
    ADD CONSTRAINT pipeline_stage_history_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id) ON DELETE RESTRICT;


--
-- Name: pricing_cycles pricing_cycles_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_cycles
    ADD CONSTRAINT pricing_cycles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_features pricing_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_features
    ADD CONSTRAINT pricing_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_plan_changes pricing_plan_changes_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_changes
    ADD CONSTRAINT pricing_plan_changes_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pricing_plan_changes pricing_plan_changes_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_changes
    ADD CONSTRAINT pricing_plan_changes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_plan_feature_history pricing_plan_feature_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_feature_history
    ADD CONSTRAINT pricing_plan_feature_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pricing_plan_feature_history pricing_plan_feature_history_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_feature_history
    ADD CONSTRAINT pricing_plan_feature_history_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_plan_features pricing_plan_features_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_features
    ADD CONSTRAINT pricing_plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_plan_versions pricing_plan_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_versions
    ADD CONSTRAINT pricing_plan_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pricing_plan_versions pricing_plan_versions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_versions
    ADD CONSTRAINT pricing_plan_versions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id) ON DELETE CASCADE;


--
-- Name: pricing_plans pricing_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pricing_plans pricing_plans_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.drais_systems(id) ON DELETE CASCADE;


--
-- Name: proposal_snapshots proposal_snapshots_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposal_snapshots
    ADD CONSTRAINT proposal_snapshots_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: proposals proposals_prospect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE RESTRICT;


--
-- Name: proposals proposals_recommended_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_recommended_plan_id_fkey FOREIGN KEY (recommended_plan_id) REFERENCES public.pricing_plans(id) ON DELETE SET NULL;


--
-- Name: proposals proposals_selected_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_selected_plan_id_fkey FOREIGN KEY (selected_plan_id) REFERENCES public.pricing_plans(id) ON DELETE RESTRICT;


--
-- Name: proposals proposals_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.drais_systems(id) ON DELETE RESTRICT;


--
-- Name: prospects prospects_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: prospects prospects_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE SET NULL;


--
-- Name: rbac_audit_logs rbac_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_logs
    ADD CONSTRAINT rbac_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: _deprecated_resources resources_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_resources
    ADD CONSTRAINT resources_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.staff(id);


--
-- Name: _deprecated_resources resources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._deprecated_resources
    ADD CONSTRAINT resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: revenue_allocations revenue_allocations_revenue_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_allocations
    ADD CONSTRAINT revenue_allocations_revenue_event_id_fkey FOREIGN KEY (revenue_event_id) REFERENCES public.revenue_events(id) ON DELETE CASCADE;


--
-- Name: revenue_allocations revenue_allocations_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_allocations
    ADD CONSTRAINT revenue_allocations_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.capital_allocation_rules(id) ON DELETE SET NULL;


--
-- Name: secret_view_tokens secret_view_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secret_view_tokens
    ADD CONSTRAINT secret_view_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: services services_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff staff_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: staff staff_linked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff staff_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.staff(id);


--
-- Name: staff_roles staff_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: staff_roles staff_roles_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_roles
    ADD CONSTRAINT staff_roles_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_salary_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_salary_account_id_fkey FOREIGN KEY (salary_account_id) REFERENCES public.accounts(id);


--
-- Name: subscription_cycles subscription_cycles_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_cycles
    ADD CONSTRAINT subscription_cycles_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_events subscription_events_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_pause_history subscription_pause_history_paused_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pause_history
    ADD CONSTRAINT subscription_pause_history_paused_by_fkey FOREIGN KEY (paused_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_pause_history subscription_pause_history_resumed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pause_history
    ADD CONSTRAINT subscription_pause_history_resumed_by_fkey FOREIGN KEY (resumed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_pause_history subscription_pause_history_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pause_history
    ADD CONSTRAINT subscription_pause_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_payments subscription_payments_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.subscription_cycles(id) ON DELETE SET NULL;


--
-- Name: subscription_payments subscription_payments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_payments subscription_payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_status_history subscription_status_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_status_history
    ADD CONSTRAINT subscription_status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_status_history subscription_status_history_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_status_history
    ADD CONSTRAINT subscription_status_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.pricing_plans(id);


--
-- Name: subscriptions subscriptions_plan_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_version_id_fkey FOREIGN KEY (plan_version_id) REFERENCES public.pricing_plan_versions(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_pricing_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pricing_cycle_id_fkey FOREIGN KEY (pricing_cycle_id) REFERENCES public.pricing_cycles(id);


--
-- Name: system_architecture system_architecture_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_architecture
    ADD CONSTRAINT system_architecture_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_architecture system_architecture_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_architecture
    ADD CONSTRAINT system_architecture_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_backups system_backups_parent_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_backups
    ADD CONSTRAINT system_backups_parent_backup_id_fkey FOREIGN KEY (parent_backup_id) REFERENCES public.system_backups(id) ON DELETE SET NULL;


--
-- Name: system_changes system_changes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_changes
    ADD CONSTRAINT system_changes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_changes system_changes_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_changes
    ADD CONSTRAINT system_changes_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_costs system_costs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_costs
    ADD CONSTRAINT system_costs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: system_costs system_costs_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_costs
    ADD CONSTRAINT system_costs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_events system_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_events
    ADD CONSTRAINT system_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_intelligence system_intelligence_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_intelligence_internal_notes system_intelligence_internal_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence_internal_notes
    ADD CONSTRAINT system_intelligence_internal_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_intelligence_internal_notes system_intelligence_internal_notes_intelligence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence_internal_notes
    ADD CONSTRAINT system_intelligence_internal_notes_intelligence_id_fkey FOREIGN KEY (intelligence_id) REFERENCES public.system_intelligence(id) ON DELETE CASCADE;


--
-- Name: system_intelligence system_intelligence_parent_intelligence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_parent_intelligence_id_fkey FOREIGN KEY (parent_intelligence_id) REFERENCES public.system_intelligence(id) ON DELETE SET NULL;


--
-- Name: system_intelligence system_intelligence_related_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_related_issue_id_fkey FOREIGN KEY (related_issue_id) REFERENCES public.system_issues(id) ON DELETE SET NULL;


--
-- Name: system_intelligence system_intelligence_related_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_related_module_id_fkey FOREIGN KEY (related_module_id) REFERENCES public.system_modules(id) ON DELETE SET NULL;


--
-- Name: system_intelligence system_intelligence_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_intelligence system_intelligence_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_intelligence
    ADD CONSTRAINT system_intelligence_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_issues system_issues_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_issues system_issues_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_issues system_issues_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_issues
    ADD CONSTRAINT system_issues_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_logs system_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_modules system_modules_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_operations system_operations_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_operations
    ADD CONSTRAINT system_operations_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_pricing_plans system_pricing_plans_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_pricing_plans
    ADD CONSTRAINT system_pricing_plans_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_tech_profiles system_tech_profiles_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_tech_profiles
    ADD CONSTRAINT system_tech_profiles_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: system_versions system_versions_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_versions
    ADD CONSTRAINT system_versions_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_versions system_versions_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_versions
    ADD CONSTRAINT system_versions_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id) ON DELETE CASCADE;


--
-- Name: systems systems_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: systems_extended_content systems_extended_content_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems_extended_content
    ADD CONSTRAINT systems_extended_content_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.drais_systems(id) ON DELETE CASCADE;


--
-- Name: typing_indicators typing_indicators_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: typing_indicators typing_indicators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT typing_indicators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_designs user_designs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_designs
    ADD CONSTRAINT user_designs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_presence user_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cMAdi5kX6RYPzKbaXRdeRKvzLHMK9gymokX5b6QgyEQmtKdG17lyKRGece3MAnu

