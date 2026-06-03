-- Squashed baseline: incremental migrations merged for fresh installs.
-- Existing remotes: run `pnpm run db:migration:squash-repair` once after pull.

-- ========== 20260513041400_remote_schema.sql ==========




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."claim_status" AS ENUM (
    'DRAFT',
    'PENDING_VERIFICATION',
    'DISPUTED',
    'REJECTED',
    'VERIFIED',
    'APPROVED'
);


ALTER TYPE "public"."claim_status" OWNER TO "postgres";


CREATE TYPE "public"."dispute_status" AS ENUM (
    'OPEN',
    'RESOLVED',
    'CLOSED'
);


ALTER TYPE "public"."dispute_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'IN_APP',
    'EMAIL',
    'SMS'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'CLAIM_SUBMITTED',
    'CLAIM_VERIFIED',
    'CLAIM_APPROVED',
    'CLAIM_REJECTED',
    'CLAIM_DISPUTED',
    'SYSTEM'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."payroll_export_status" AS ENUM (
    'PENDING',
    'GENERATED',
    'EXPORTED'
);


ALTER TYPE "public"."payroll_export_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'TUTOR',
    'LECTURER',
    'ADMIN',
    'SUPER_ADMIN'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_claim_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_logs (
            institution_id,
            actor_id,
            entity_type,
            entity_id,
            event,
            payload
        )
        VALUES (
            (
                SELECT institution_id
                FROM users
                WHERE users.id = NEW.tutor_id
            ),
            NEW.tutor_id,
            'SESSION_CLAIM',
            NEW.id,
            'STATUS_CHANGED',
            jsonb_build_object(
                'from', OLD.status,
                'to', NEW.status
            )
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_claim_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" character varying(100) NOT NULL,
    "original_filename" character varying(255) NOT NULL,
    "file_size_bytes" integer,
    "uploaded_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."attendance_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "event" character varying(100) NOT NULL,
    "payload" "jsonb",
    "ip_address" character varying(100),
    "user_agent" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disputes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "raised_by_id" "uuid" NOT NULL,
    "resolved_by_id" "uuid",
    "reason" "text" NOT NULL,
    "status" "public"."dispute_status" DEFAULT 'OPEN'::"public"."dispute_status",
    "resolution_note" "text",
    "raised_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" timestamp without time zone
);


ALTER TABLE "public"."disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "domain" character varying(255),
    "country" character varying(100),
    "plan_tier" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "method" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "ip_address" character varying(100),
    "device_info" "text",
    "occurred_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."mfa_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "lecturer_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "semester" character varying(50),
    "academic_year" character varying(20),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "claim_id" "uuid",
    "channel" "public"."notification_channel" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "subject" character varying(255),
    "body" "text",
    "is_read" boolean DEFAULT false,
    "sent_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "read_at" timestamp without time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_export_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "export_id" "uuid" NOT NULL,
    "claim_id" "uuid" NOT NULL
);


ALTER TABLE "public"."payroll_export_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "generated_by_id" "uuid" NOT NULL,
    "period_label" character varying(100) NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "claim_count" integer DEFAULT 0,
    "total_hours" numeric(10,2) DEFAULT 0,
    "file_url" "text",
    "status" "public"."payroll_export_status" DEFAULT 'PENDING'::"public"."payroll_export_status",
    "generated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."payroll_exports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "hours" numeric(5,2) NOT NULL,
    "venue" character varying(255),
    "status" "public"."claim_status" DEFAULT 'DRAFT'::"public"."claim_status",
    "notes" "text",
    "submitted_at" timestamp without time zone,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."session_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutor_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."tutor_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "mfa_enabled" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "action_type" character varying(100) NOT NULL,
    "from_status" "public"."claim_status",
    "to_status" "public"."claim_status",
    "comment" "text",
    "mfa_method" character varying(100),
    "mfa_confirmed" boolean DEFAULT false,
    "acted_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."verification_actions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance_evidence"
    ADD CONSTRAINT "attendance_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_events"
    ADD CONSTRAINT "mfa_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_export_claims"
    ADD CONSTRAINT "payroll_export_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_exports"
    ADD CONSTRAINT "payroll_exports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_claims"
    ADD CONSTRAINT "session_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutor_assignments"
    ADD CONSTRAINT "tutor_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_actions"
    ADD CONSTRAINT "verification_actions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_attendance_evidence_claim_id" ON "public"."attendance_evidence" USING "btree" ("claim_id");



CREATE INDEX "idx_audit_logs_actor_id" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_entity_id" ON "public"."audit_logs" USING "btree" ("entity_id");



CREATE INDEX "idx_audit_logs_event" ON "public"."audit_logs" USING "btree" ("event");



CREATE INDEX "idx_audit_logs_institution_id" ON "public"."audit_logs" USING "btree" ("institution_id");



CREATE INDEX "idx_disputes_claim_id" ON "public"."disputes" USING "btree" ("claim_id");



CREATE INDEX "idx_disputes_raised_by_id" ON "public"."disputes" USING "btree" ("raised_by_id");



CREATE INDEX "idx_mfa_events_user_id" ON "public"."mfa_events" USING "btree" ("user_id");



CREATE INDEX "idx_modules_institution_id" ON "public"."modules" USING "btree" ("institution_id");



CREATE INDEX "idx_modules_lecturer_id" ON "public"."modules" USING "btree" ("lecturer_id");



CREATE INDEX "idx_notifications_claim_id" ON "public"."notifications" USING "btree" ("claim_id");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_recipient_id" ON "public"."notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_payroll_export_claims_claim_id" ON "public"."payroll_export_claims" USING "btree" ("claim_id");



CREATE INDEX "idx_payroll_export_claims_export_id" ON "public"."payroll_export_claims" USING "btree" ("export_id");



CREATE INDEX "idx_payroll_exports_generated_by_id" ON "public"."payroll_exports" USING "btree" ("generated_by_id");



CREATE INDEX "idx_payroll_exports_institution_id" ON "public"."payroll_exports" USING "btree" ("institution_id");



CREATE INDEX "idx_session_claims_module_id" ON "public"."session_claims" USING "btree" ("module_id");



CREATE INDEX "idx_session_claims_session_date" ON "public"."session_claims" USING "btree" ("session_date");



CREATE INDEX "idx_session_claims_status" ON "public"."session_claims" USING "btree" ("status");



CREATE INDEX "idx_session_claims_tutor_id" ON "public"."session_claims" USING "btree" ("tutor_id");



CREATE INDEX "idx_tutor_assignments_module_id" ON "public"."tutor_assignments" USING "btree" ("module_id");



CREATE INDEX "idx_tutor_assignments_tutor_id" ON "public"."tutor_assignments" USING "btree" ("tutor_id");



CREATE INDEX "idx_verification_actions_actor_id" ON "public"."verification_actions" USING "btree" ("actor_id");



CREATE INDEX "idx_verification_actions_claim_id" ON "public"."verification_actions" USING "btree" ("claim_id");



CREATE OR REPLACE TRIGGER "trg_claim_status_change" AFTER UPDATE ON "public"."session_claims" FOR EACH ROW EXECUTE FUNCTION "public"."log_claim_status_change"();



CREATE OR REPLACE TRIGGER "trg_session_claims_updated_at" BEFORE UPDATE ON "public"."session_claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance_evidence"
    ADD CONSTRAINT "attendance_evidence_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."session_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."disputes"
    ADD CONSTRAINT "disputes_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."session_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."session_claims"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_export_claims"
    ADD CONSTRAINT "payroll_export_claims_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."session_claims"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_export_claims"
    ADD CONSTRAINT "payroll_export_claims_export_id_fkey" FOREIGN KEY ("export_id") REFERENCES "public"."payroll_exports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_exports"
    ADD CONSTRAINT "payroll_exports_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_claims"
    ADD CONSTRAINT "session_claims_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutor_assignments"
    ADD CONSTRAINT "tutor_assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."verification_actions"
    ADD CONSTRAINT "verification_actions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."session_claims"("id") ON DELETE CASCADE;



ALTER TABLE "public"."attendance_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disputes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mfa_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_export_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_exports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutor_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_actions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."log_claim_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_claim_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_claim_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."attendance_evidence" TO "anon";
GRANT ALL ON TABLE "public"."attendance_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."disputes" TO "anon";
GRANT ALL ON TABLE "public"."disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."disputes" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_events" TO "anon";
GRANT ALL ON TABLE "public"."mfa_events" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_events" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_export_claims" TO "anon";
GRANT ALL ON TABLE "public"."payroll_export_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_export_claims" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_exports" TO "anon";
GRANT ALL ON TABLE "public"."payroll_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_exports" TO "service_role";



GRANT ALL ON TABLE "public"."session_claims" TO "anon";
GRANT ALL ON TABLE "public"."session_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."session_claims" TO "service_role";



GRANT ALL ON TABLE "public"."tutor_assignments" TO "anon";
GRANT ALL ON TABLE "public"."tutor_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."tutor_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."verification_actions" TO "anon";
GRANT ALL ON TABLE "public"."verification_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_actions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































-- ========== 20260513120000_session_notes_coverage.sql ==========

-- Session-linked coverage fields for tutor notes (UI: /tutor/notes)
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS topics_covered text,
  ADD COLUMN IF NOT EXISTS coverage_validated_at timestamptz;

COMMENT ON COLUMN public.session_claims.topics_covered IS 'Tutor record of concepts or agenda items addressed in this session.';
COMMENT ON COLUMN public.session_claims.coverage_validated_at IS 'When the tutor confirmed topics_covered reflects what was taught.';

-- RLS: tutors read/update their own claims; read modules in their institution (for joins)
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "modules_select_same_institution" ON public.modules;
CREATE POLICY "modules_select_same_institution" ON public.modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.institution_id = modules.institution_id
    )
  );

-- ========== 20260513140000_tutor_schedule_imports.sql ==========

-- Persisted tutor timetable imports (UI: /tutor/schedules)
CREATE TABLE IF NOT EXISTS public.tutor_schedule_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  parse_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_schedule_imports IS 'Each row is one uploaded spreadsheet parse; the UI merges multiple rows per tutor into one calendar.';

CREATE INDEX IF NOT EXISTS idx_tutor_schedule_imports_tutor_created
  ON public.tutor_schedule_imports (tutor_id, created_at);

DROP TRIGGER IF EXISTS trg_tutor_schedule_imports_updated_at ON public.tutor_schedule_imports;
CREATE TRIGGER trg_tutor_schedule_imports_updated_at
  BEFORE UPDATE ON public.tutor_schedule_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tutor_schedule_imports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.tutor_schedule_imports TO authenticated;

DROP POLICY IF EXISTS "tutor_schedule_imports_select_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_select_own" ON public.tutor_schedule_imports
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_schedule_imports_insert_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_insert_own" ON public.tutor_schedule_imports
  FOR INSERT TO authenticated
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_schedule_imports_delete_own" ON public.tutor_schedule_imports;
CREATE POLICY "tutor_schedule_imports_delete_own" ON public.tutor_schedule_imports
  FOR DELETE TO authenticated
  USING (tutor_id = auth.uid());

-- ========== 20260513150000_tutor_schedule_imports_auth_fk.sql ==========

-- tutor_id must match auth.uid(); public.users rows are not guaranteed at signup.
ALTER TABLE public.tutor_schedule_imports
  DROP CONSTRAINT IF EXISTS tutor_schedule_imports_tutor_id_fkey;

ALTER TABLE public.tutor_schedule_imports
  ADD CONSTRAINT tutor_schedule_imports_tutor_id_fkey
  FOREIGN KEY (tutor_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ========== 20260514120000_students_and_dashboard_rls.sql ==========

-- Students roster + optional link on session claims; RLS for users self-read, notifications inbox.

-- ---------------------------------------------------------------------------
-- students (per institution directory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  full_name character varying(255) NOT NULL,
  student_reference character varying(100),
  email character varying(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_institution_id ON public.students (institution_id);

COMMENT ON TABLE public.students IS 'Institution-scoped learner directory; tutors link via tutor_student_assignments.';

-- ---------------------------------------------------------------------------
-- tutor_student_assignments (roster: which students a tutor supports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_student_assignments_tutor_student_key UNIQUE (tutor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_student_assignments_tutor ON public.tutor_student_assignments (tutor_id);

COMMENT ON TABLE public.tutor_student_assignments IS 'Tutor roster entries for dashboard “active students” and future claim linkage.';

-- ---------------------------------------------------------------------------
-- session_claims: optional student on a claim
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_claims_tutor_student
  ON public.session_claims (tutor_id, student_id);

-- ---------------------------------------------------------------------------
-- RLS: students
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.students TO authenticated;

DROP POLICY IF EXISTS "students_select_same_institution" ON public.students;
CREATE POLICY "students_select_same_institution" ON public.students
  FOR SELECT TO authenticated
  USING (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students_insert_same_institution" ON public.students;
CREATE POLICY "students_insert_same_institution" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students_update_same_institution" ON public.students;
CREATE POLICY "students_update_same_institution" ON public.students
  FOR UPDATE TO authenticated
  USING (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_student_assignments
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutor_student_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_student_assignments TO authenticated;

DROP POLICY IF EXISTS "tutor_student_assignments_select_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_select_own" ON public.tutor_student_assignments
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "tutor_student_assignments_insert_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_insert_own" ON public.tutor_student_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      INNER JOIN public.users u ON u.id = auth.uid()
      WHERE s.id = student_id
        AND s.institution_id = u.institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_update_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_update_own" ON public.tutor_student_assignments
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      INNER JOIN public.users u ON u.id = auth.uid()
      WHERE s.id = student_id
        AND s.institution_id = u.institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_delete_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_delete_own" ON public.tutor_student_assignments
  FOR DELETE TO authenticated
  USING (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: public.users — self read (required for institution subqueries in other policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: notifications — recipient inbox
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_recipient_select" ON public.notifications;
CREATE POLICY "notifications_recipient_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_recipient_update" ON public.notifications;
CREATE POLICY "notifications_recipient_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ========== 20260515120000_session_claims_schedule_link.sql ==========

-- Link session_claims to tutor timetable imports (lazy "ensure claim" from calendar UI).

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS source_schedule_import_id uuid
    REFERENCES public.tutor_schedule_imports (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_event_fingerprint text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS session_kind text;

COMMENT ON COLUMN public.session_claims.source_schedule_import_id IS
  'When set, this claim was created from a row in tutor_schedule_imports.parse_result.';
COMMENT ON COLUMN public.session_claims.source_event_fingerprint IS
  'Stable hash key for the import row (tutor_id + import + fingerprint unique when import is set).';
COMMENT ON COLUMN public.session_claims.session_kind IS
  'Normalized slot kind from spreadsheet (e.g. tutorial, consultation); optional display/filter.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_claims_import_event_unique
  ON public.session_claims (tutor_id, source_schedule_import_id, source_event_fingerprint)
  WHERE source_schedule_import_id IS NOT NULL
    AND source_event_fingerprint <> '';

CREATE INDEX IF NOT EXISTS idx_session_claims_source_import
  ON public.session_claims (source_schedule_import_id)
  WHERE source_schedule_import_id IS NOT NULL;

-- Tutors may create their own claims (e.g. from schedule → notes flow).
DROP POLICY IF EXISTS "session_claims_tutor_insert_own" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_own" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND (
      source_schedule_import_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tutor_schedule_imports i
        WHERE i.id = source_schedule_import_id
          AND i.tutor_id = auth.uid()
      )
    )
  );

-- ========== 20260516120000_tutor_sessions_workspace_rls.sql ==========

-- Tutor sessions workspace: lecturer visibility, attendance evidence RLS, headcounts,
-- tutor_assignments read, modules→users FK for PostgREST embeds, attendance register storage.

-- ---------------------------------------------------------------------------
-- modules.lecturer_id → public.users (for nested lecturer selects)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.modules
    ADD CONSTRAINT modules_lecturer_id_fkey
    FOREIGN KEY (lecturer_id) REFERENCES public.users (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- session_claims: optional attendance headcounts (tutor-maintained)
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS attendance_present_count integer,
  ADD COLUMN IF NOT EXISTS attendance_expected_count integer;

COMMENT ON COLUMN public.session_claims.attendance_present_count IS
  'Tutor-entered count of learners present; optional until register workflow exists.';
COMMENT ON COLUMN public.session_claims.attendance_expected_count IS
  'Expected roster size for progress UI; optional.';

-- ---------------------------------------------------------------------------
-- RLS: tutors can read lecturers in the same institution (directory)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_lecturers_same_institution" ON public.users;
CREATE POLICY "users_select_lecturers_same_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'LECTURER'::public.user_role
    AND institution_id = (
      SELECT u.institution_id FROM public.users u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: attendance_evidence for own session claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_evidence_tutor_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendance_evidence_tutor_insert" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_insert" ON public.attendance_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attendance_evidence_tutor_delete" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_tutor_delete" ON public.attendance_evidence
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = attendance_evidence.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments — read own rows (module picker)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_select_own" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_select_own" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for register uploads
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance_registers', 'attendance_registers', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attendance_registers_select_own" ON storage.objects;
CREATE POLICY "attendance_registers_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_insert_own" ON storage.objects;
CREATE POLICY "attendance_registers_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_update_own" ON storage.objects;
CREATE POLICY "attendance_registers_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_registers_delete_own" ON storage.objects;
CREATE POLICY "attendance_registers_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== 20260517120000_fix_rls_recursion.sql ==========

-- Fix RLS recursion by using security definer functions to look up user metadata.
-- This prevents policies on 'users' from querying 'users' recursively.

-- 1. Helper function to get current user's institution_id
CREATE OR REPLACE FUNCTION public.get_auth_user_institution_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 3. Helper function to check if user has a specific role (or list of roles)
CREATE OR REPLACE FUNCTION public.auth_user_has_role(target_role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = target_role FROM public.users WHERE id = auth.uid();
$$;

-- 4. Update the recursive policy on public.users
DROP POLICY IF EXISTS "users_select_lecturers_same_institution" ON public.users;
CREATE POLICY "users_select_lecturers_same_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'LECTURER'::public.user_role
    AND institution_id = public.get_auth_user_institution_id()
  );

-- 5. Update other policies that query users to use the new helper functions (Optimization & Prevention)
DROP POLICY IF EXISTS "students_select_same_institution" ON public.students;
CREATE POLICY "students_select_same_institution" ON public.students
  FOR SELECT TO authenticated
  USING (institution_id = public.get_auth_user_institution_id());

DROP POLICY IF EXISTS "students_insert_same_institution" ON public.students;
CREATE POLICY "students_insert_same_institution" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (institution_id = public.get_auth_user_institution_id());

DROP POLICY IF EXISTS "students_update_same_institution" ON public.students;
CREATE POLICY "students_update_same_institution" ON public.students
  FOR UPDATE TO authenticated
  USING (institution_id = public.get_auth_user_institution_id())
  WITH CHECK (institution_id = public.get_auth_user_institution_id());

-- Update tutor_student_assignments policies
DROP POLICY IF EXISTS "tutor_student_assignments_insert_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_insert_own" ON public.tutor_student_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_id
        AND s.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "tutor_student_assignments_update_own" ON public.tutor_student_assignments;
CREATE POLICY "tutor_student_assignments_update_own" ON public.tutor_student_assignments
  FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = student_id
        AND s.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Update modules policy
DROP POLICY IF EXISTS "modules_select_same_institution" ON public.modules;
CREATE POLICY "modules_select_same_institution" ON public.modules
  FOR SELECT TO authenticated
  USING (institution_id = public.get_auth_user_institution_id());

-- ========== 20260518120000_attendance_system.sql ==========

-- Attendance Tracking & Verification System Migration
-- Adds individual attendance tracking and secure QR token fields.

-- 1. Add QR security to sessions
ALTER TABLE public.session_claims 
ADD COLUMN IF NOT EXISTS qr_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz;

-- 2. Create attendance status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create individual attendance records table
DROP TABLE IF EXISTS public.session_attendance CASCADE;
CREATE TABLE public.session_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.session_claims(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status DEFAULT 'PRESENT',
  check_in_time timestamptz DEFAULT now(),
  is_verified boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- 4. Enable Row Level Security
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Tutors
-- Tutors can perform all actions on attendance for their own sessions
DROP POLICY IF EXISTS "tutors_manage_session_attendance" ON public.session_attendance;
CREATE POLICY "tutors_manage_session_attendance" ON public.session_attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
      AND sc.tutor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
      AND sc.tutor_id = auth.uid()
    )
  );

-- 6. Policies for Students (if they become authenticated users)
-- For now, we allow authenticated users to view attendance if they are the student linked to it
-- This assumes a future link between public.users and public.students or adding STUDENT role.
DROP POLICY IF EXISTS "students_view_own_attendance" ON public.session_attendance;
CREATE POLICY "students_view_own_attendance" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      INNER JOIN public.users u ON u.email = s.email
      WHERE s.id = session_attendance.student_id
      AND u.id = auth.uid()
    )
  );

-- 7. Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_attendance TO service_role;

-- ========== 20260519120000_messaging_system.sql ==========

-- Create conversation type enum
DO $$ BEGIN
    CREATE TYPE "public"."conversation_type" AS ENUM (
        'DIRECT',
        'GROUP',
        'SESSION',
        'CLAIM',
        'ATTENDANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create conversations table
CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "title" "text",
    "type" "public"."conversation_type" DEFAULT 'DIRECT' NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id")
);

-- Create conversation participants table
CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("conversation_id", "user_id"),
    CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Create messages table
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_message_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE,
    CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE SET NULL,
    CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Helper function to check participation without recursion
CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("_conv_id" uuid) 
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM "public"."conversation_participants"
        WHERE "conversation_id" = "_conv_id"
        AND "user_id" = (select auth.uid())
    );
$$;

-- RLS Policies for conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON "public"."conversations";
CREATE POLICY "Users can view conversations they participate in"
ON "public"."conversations"
FOR SELECT
USING (is_conversation_participant("id"));

-- RLS Policies for conversation_participants
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON "public"."conversation_participants";
CREATE POLICY "Users can view participants of their conversations"
ON "public"."conversation_participants"
FOR SELECT
USING (is_conversation_participant("conversation_id"));

DROP POLICY IF EXISTS "Users can update their own participant record" ON "public"."conversation_participants";
CREATE POLICY "Users can update their own participant record"
ON "public"."conversation_participants"
FOR UPDATE
USING ("user_id" = auth.uid());

-- RLS Policies for messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON "public"."messages";
CREATE POLICY "Users can view messages in their conversations"
ON "public"."messages"
FOR SELECT
USING (is_conversation_participant("conversation_id"));

DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON "public"."messages";
CREATE POLICY "Users can insert messages into their conversations"
ON "public"."messages"
FOR INSERT
WITH CHECK (
    is_conversation_participant("conversation_id")
    AND "sender_id" = auth.uid()
);

-- Realtime setup
-- Check if table is already in publication to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE "public"."messages";
    END IF;
END $$;

-- ========== 20260520120000_session_notes_structured.sql ==========

-- Structured session notes fields for tutor workspace
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS examples_used text,
  ADD COLUMN IF NOT EXISTS student_struggles text,
  ADD COLUMN IF NOT EXISTS revision_topics text;

COMMENT ON COLUMN public.session_claims.examples_used IS 'Specific problems or examples worked through during the session.';
COMMENT ON COLUMN public.session_claims.student_struggles IS 'Pain points or areas where the student showed difficulty.';
COMMENT ON COLUMN public.session_claims.revision_topics IS 'Items recommended for the student to review before next session.';

-- ========== 20260521120000_user_settings.sql ==========

-- User preferences, avatar storage, and self-service profile RLS

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email_notifications boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT false,
  reminder_frequency text NOT NULL DEFAULT 'daily'
    CHECK (reminder_frequency IN ('immediate', 'daily', 'weekly')),
  calendar_week_start smallint NOT NULL DEFAULT 1
    CHECK (calendar_week_start IN (0, 1)),
  calendar_default_view text NOT NULL DEFAULT 'week'
    CHECK (calendar_default_view IN ('day', 'week', 'month')),
  dashboard_show_stats boolean NOT NULL DEFAULT true,
  dashboard_show_notifications boolean NOT NULL DEFAULT true,
  dashboard_compact_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_self" ON public.user_preferences;
CREATE POLICY "user_preferences_select_self" ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_insert_self" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_self" ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_update_self" ON public.user_preferences;
CREATE POLICY "user_preferences_update_self" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "institutions_select_active" ON public.institutions;
CREATE POLICY "institutions_select_active" ON public.institutions
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "mfa_events_select_self" ON public.mfa_events;
CREATE POLICY "mfa_events_select_self" ON public.mfa_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mfa_events_insert_self" ON public.mfa_events;
CREATE POLICY "mfa_events_insert_self" ON public.mfa_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== 20260522120000_users_signup_rls.sql ==========

-- Allow self-registration: nullable institution (linked later in settings) + insert RLS + auth trigger

ALTER TABLE public.users
  ALTER COLUMN institution_id DROP NOT NULL;

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Create public.users row when auth.users is created (works before email confirm / session)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  role_val public.user_role;
  name_val text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  name_val := COALESCE(meta->>'full_name', split_part(NEW.email, '@', 1));

  BEGIN
    role_val := (meta->>'role')::public.user_role;
  EXCEPTION
    WHEN others THEN
      role_val := 'TUTOR'::public.user_role;
  END;

  INSERT INTO public.users (id, email, full_name, role, institution_id)
  VALUES (NEW.id, NEW.email, name_val, role_val, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ========== 20260523120000_lecturer_claims_rls.sql ==========

-- Lecturers can read session claims for modules they own (dashboard / verification).
DROP POLICY IF EXISTS "session_claims_lecturer_select_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_select_own_modules" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

-- ========== 20260524120000_lecturer_dashboard_rls.sql ==========

-- Lecturer dashboard: FK for tutor embeds, RLS for related tables, storage read,
-- lecturer notification on claim submit.

-- ---------------------------------------------------------------------------
-- session_claims.tutor_id → public.users (PostgREST embed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.session_claims
    ADD CONSTRAINT session_claims_tutor_id_fkey
    FOREIGN KEY (tutor_id) REFERENCES public.users (id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — safe module/claim ownership checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_lecturer_for_module(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = p_module_id
      AND m.lecturer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_claim(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_claims sc
    INNER JOIN public.modules m ON m.id = sc.module_id
    WHERE sc.id = p_claim_id
      AND m.lecturer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lecturer_for_module(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_claim(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- users: lecturers may read tutors on their modules (claims or assignments)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_tutors_on_lecturer_modules" ON public.users;
CREATE POLICY "users_select_tutors_on_lecturer_modules" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND (
      EXISTS (
        SELECT 1
        FROM public.session_claims sc
        INNER JOIN public.modules m ON m.id = sc.module_id
        WHERE sc.tutor_id = users.id
          AND m.lecturer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.tutor_assignments ta
        INNER JOIN public.modules m ON m.id = ta.module_id
        WHERE ta.tutor_id = users.id
          AND m.lecturer_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- session_claims: lecturer update (verification workflow)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- tutor_assignments: lecturers read assignments on their modules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_lecturer_select" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_select" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- attendance_evidence: lecturers read evidence for their module claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_evidence_lecturer_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_lecturer_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

-- ---------------------------------------------------------------------------
-- session_attendance: lecturers read attendance on their module sessions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_attendance_lecturer_select" ON public.session_attendance;
CREATE POLICY "session_attendance_lecturer_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(session_id));

-- ---------------------------------------------------------------------------
-- verification_actions: tutors + lecturers read; lecturers insert
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_actions_tutor_select" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "verification_actions_lecturer_select" ON public.verification_actions;
CREATE POLICY "verification_actions_lecturer_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

DROP POLICY IF EXISTS "verification_actions_lecturer_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_lecturer_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND public.is_lecturer_for_claim(claim_id)
  );

-- ---------------------------------------------------------------------------
-- disputes: tutors + lecturers read claims they are involved with
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "disputes_tutor_select" ON public.disputes;
CREATE POLICY "disputes_tutor_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = disputes.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "disputes_lecturer_select" ON public.disputes;
CREATE POLICY "disputes_lecturer_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_claim(claim_id));

-- ---------------------------------------------------------------------------
-- audit_logs: lecturers read claim status changes on their modules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_lecturer_select" ON public.audit_logs;
CREATE POLICY "audit_logs_lecturer_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    entity_type = 'SESSION_CLAIM'
    AND public.is_lecturer_for_claim(entity_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: lecturers read register files for claims on their modules
-- Path: attendance_registers/{tutor_id}/{claim_id}/...
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_registers_select_lecturer" ON storage.objects;
CREATE POLICY "attendance_registers_select_lecturer" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      INNER JOIN public.modules m ON m.id = sc.module_id
      WHERE m.lecturer_id = auth.uid()
        AND sc.tutor_id::text = (storage.foldername(name))[1]
        AND sc.id::text = (storage.foldername(name))[2]
    )
  );

-- ---------------------------------------------------------------------------
-- Notify lecturer when a tutor submits a claim for verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_lecturer_on_claim_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'PENDING_VERIFICATION'::public.claim_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (
      recipient_id,
      claim_id,
      channel,
      type,
      subject,
      body
    )
    SELECT
      m.lecturer_id,
      NEW.id,
      'IN_APP'::public.notification_channel,
      'CLAIM_SUBMITTED'::public.notification_type,
      'Claim submitted for review',
      format(
        'A tutor submitted a session claim for %s on %s.',
        m.code,
        to_char(NEW.session_date, 'YYYY-MM-DD')
      )
    FROM public.modules m
    WHERE m.id = NEW.module_id
      AND m.lecturer_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lecturer_claim_submitted ON public.session_claims;
CREATE TRIGGER trg_notify_lecturer_claim_submitted
  AFTER UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lecturer_on_claim_submitted();

-- ========== 20260525120000_lecturer_verification_workflow.sql ==========

-- Lecturer verification queue: dispute insert, tutor notifications on review actions.

-- ---------------------------------------------------------------------------
-- disputes: lecturers may open disputes on their module claims
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "disputes_lecturer_insert" ON public.disputes;
CREATE POLICY "disputes_lecturer_insert" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

-- ---------------------------------------------------------------------------
-- Notify tutor when lecturer changes claim status (verify / reject / dispute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_claim_status_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_code character varying(50);
  v_notification_type public.notification_type;
  v_subject text;
  v_body text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'VERIFIED'::public.claim_status,
    'APPROVED'::public.claim_status,
    'REJECTED'::public.claim_status,
    'DISPUTED'::public.claim_status
  ) THEN
    RETURN NEW;
  END IF;

  SELECT m.code INTO v_module_code
  FROM public.modules m
  WHERE m.id = NEW.module_id;

  v_notification_type := CASE NEW.status
    WHEN 'VERIFIED' THEN 'CLAIM_VERIFIED'::public.notification_type
    WHEN 'APPROVED' THEN 'CLAIM_APPROVED'::public.notification_type
    WHEN 'REJECTED' THEN 'CLAIM_REJECTED'::public.notification_type
    WHEN 'DISPUTED' THEN 'CLAIM_DISPUTED'::public.notification_type
    ELSE 'SYSTEM'::public.notification_type
  END;

  v_subject := CASE NEW.status
    WHEN 'VERIFIED' THEN 'Claim verified'
    WHEN 'APPROVED' THEN 'Claim approved'
    WHEN 'REJECTED' THEN 'Claim rejected'
    WHEN 'DISPUTED' THEN 'Claim disputed'
    ELSE 'Claim updated'
  END;

  v_body := format(
    'Your session claim for %s on %s was updated to %s.',
    COALESCE(v_module_code, 'module'),
    to_char(NEW.session_date, 'YYYY-MM-DD'),
    NEW.status::text
  );

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    NEW.tutor_id,
    NEW.id,
    'IN_APP'::public.notification_channel,
    v_notification_type,
    v_subject,
    v_body
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tutor_claim_status_review ON public.session_claims;
CREATE TRIGGER trg_notify_tutor_claim_status_review
  AFTER UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_claim_status_review();

-- ---------------------------------------------------------------------------
-- Notify tutor when lecturer requests clarification (no status change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_clarification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor_id uuid;
  v_module_code character varying(50);
BEGIN
  IF NEW.action_type <> 'CLARIFICATION_REQUESTED' THEN
    RETURN NEW;
  END IF;

  SELECT sc.tutor_id, m.code
  INTO v_tutor_id, v_module_code
  FROM public.session_claims sc
  INNER JOIN public.modules m ON m.id = sc.module_id
  WHERE sc.id = NEW.claim_id;

  IF v_tutor_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    v_tutor_id,
    NEW.claim_id,
    'IN_APP'::public.notification_channel,
    'SYSTEM'::public.notification_type,
    'Clarification requested',
    format(
      'Your lecturer requested clarification on the %s claim.%s',
      COALESCE(v_module_code, 'session'),
      CASE
        WHEN NEW.comment IS NOT NULL AND length(trim(NEW.comment)) > 0
        THEN ' Note: ' || NEW.comment
        ELSE ''
      END
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tutor_clarification ON public.verification_actions;
CREATE TRIGGER trg_notify_tutor_clarification
  AFTER INSERT ON public.verification_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_clarification_request();

-- ========== 20260526120000_lecturer_schedule_system.sql ==========

-- Lecturer-owned tutorial schedules: venues, series, occurrences, change requests,
-- session_claims bridge, tutor_assignments writes, notifications.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.schedule_series_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE public.scheduled_session_status AS ENUM (
  'SCHEDULED',
  'CANCELLED',
  'RESCHEDULED'
);

CREATE TYPE public.schedule_series_exception_action AS ENUM (
  'CANCEL',
  'OVERRIDE'
);

CREATE TYPE public.schedule_change_request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SCHEDULE_CHANGE_REQUESTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SCHEDULE_CHANGE_REVIEWED';

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  name character varying(255) NOT NULL,
  code character varying(50),
  capacity integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_institution_id ON public.venues (institution_id);

-- ---------------------------------------------------------------------------
-- schedule_series
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  title character varying(255) NOT NULL,
  session_kind text NOT NULL DEFAULT 'tutorial',
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  venue_text character varying(255),
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  dtstart timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  recurrence_json jsonb NOT NULL DEFAULT '{"frequency":"weekly","byWeekday":[1],"until":null}'::jsonb,
  status public.schedule_series_status NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_series_module_id ON public.schedule_series (module_id);
CREATE INDEX IF NOT EXISTS idx_schedule_series_tutor_id ON public.schedule_series (tutor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_series_status ON public.schedule_series (status);

-- ---------------------------------------------------------------------------
-- scheduled_sessions (materialized occurrences)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.schedule_series (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  venue_text character varying(255),
  status public.scheduled_session_status NOT NULL DEFAULT 'SCHEDULED',
  original_starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_sessions_ends_after_start CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_sessions_series_starts
  ON public.scheduled_sessions (series_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_module_starts
  ON public.scheduled_sessions (module_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_tutor_starts
  ON public.scheduled_sessions (tutor_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_range
  ON public.scheduled_sessions (starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- schedule_series_exceptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_series_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.schedule_series (id) ON DELETE CASCADE,
  occurrence_starts_at timestamptz NOT NULL,
  action public.schedule_series_exception_action NOT NULL,
  override_starts_at timestamptz,
  override_ends_at timestamptz,
  override_venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  override_venue_text character varying(255),
  override_tutor_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, occurrence_starts_at)
);

-- ---------------------------------------------------------------------------
-- schedule_change_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_session_id uuid NOT NULL REFERENCES public.scheduled_sessions (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  status public.schedule_change_request_status NOT NULL DEFAULT 'PENDING',
  proposed_starts_at timestamptz NOT NULL,
  proposed_ends_at timestamptz NOT NULL,
  proposed_venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL,
  proposed_venue_text character varying(255),
  reason text,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_change_requests_ends_after_start CHECK (proposed_ends_at > proposed_starts_at)
);

CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_session
  ON public.schedule_change_requests (scheduled_session_id);

CREATE INDEX IF NOT EXISTS idx_schedule_change_requests_status
  ON public.schedule_change_requests (status)
  WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- session_claims bridge
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS source_scheduled_session_id uuid
    REFERENCES public.scheduled_sessions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_claims.source_scheduled_session_id IS
  'When set, this claim was created from a lecturer-published scheduled_sessions row.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_claims_scheduled_session_unique
  ON public.session_claims (tutor_id, source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_claims_source_scheduled_session
  ON public.session_claims (source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- tutor_assignments FK
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.tutor_assignments
    ADD CONSTRAINT tutor_assignments_tutor_id_fkey
    FOREIGN KEY (tutor_id) REFERENCES public.users (id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_institution_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.users WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_same_institution_as_auth(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.institution_id = public.user_institution_id(auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_series(p_series_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_series ss
    WHERE ss.id = p_series_id
      AND public.is_lecturer_for_module(ss.module_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_for_scheduled_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.scheduled_sessions s
    WHERE s.id = p_session_id
      AND public.is_lecturer_for_module(s.module_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_institution_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_same_institution_as_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_series(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_for_scheduled_session(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_series_updated_at ON public.schedule_series;
CREATE TRIGGER trg_schedule_series_updated_at
  BEFORE UPDATE ON public.schedule_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scheduled_sessions_updated_at ON public.scheduled_sessions;
CREATE TRIGGER trg_scheduled_sessions_updated_at
  BEFORE UPDATE ON public.scheduled_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_change_requests_updated_at ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_requests_updated_at
  BEFORE UPDATE ON public.schedule_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS: venues
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select_same_institution" ON public.venues;
CREATE POLICY "venues_select_same_institution" ON public.venues
  FOR SELECT TO authenticated
  USING (
    institution_id = public.user_institution_id(auth.uid())
  );

DROP POLICY IF EXISTS "venues_lecturer_manage" ON public.venues;
CREATE POLICY "venues_lecturer_manage" ON public.venues
  FOR ALL TO authenticated
  USING (
    institution_id = public.user_institution_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('LECTURER'::public.user_role, 'ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
    )
  )
  WITH CHECK (
    institution_id = public.user_institution_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('LECTURER'::public.user_role, 'ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_series_lecturer_all" ON public.schedule_series;
CREATE POLICY "schedule_series_lecturer_all" ON public.schedule_series
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "schedule_series_tutor_select" ON public.schedule_series;
CREATE POLICY "schedule_series_tutor_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND status = 'PUBLISHED'::public.schedule_series_status
  );

-- ---------------------------------------------------------------------------
-- RLS: scheduled_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (public.is_lecturer_for_module(module_id));

DROP POLICY IF EXISTS "scheduled_sessions_tutor_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series_exceptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_series_exceptions_lecturer_all" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_lecturer_all" ON public.schedule_series_exceptions
  FOR ALL TO authenticated
  USING (public.is_lecturer_for_series(series_id))
  WITH CHECK (
    public.is_lecturer_for_series(series_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "schedule_series_exceptions_tutor_select" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_tutor_select" ON public.schedule_series_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = schedule_series_exceptions.series_id
        AND ss.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_change_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_change_requests_tutor_insert" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_tutor_insert" ON public.schedule_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = scheduled_session_id
        AND s.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "schedule_change_requests_tutor_select_own" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_tutor_select_own" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS "schedule_change_requests_lecturer_select" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_lecturer_select" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_scheduled_session(scheduled_session_id));

DROP POLICY IF EXISTS "schedule_change_requests_lecturer_update" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_lecturer_update" ON public.schedule_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_scheduled_session(scheduled_session_id))
  WITH CHECK (public.is_lecturer_for_scheduled_session(scheduled_session_id));

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments writes (lecturer)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_lecturer_insert" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_insert" ON public.tutor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_assignments_lecturer_update" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_update" ON public.tutor_assignments
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
  );

DROP POLICY IF EXISTS "tutor_assignments_lecturer_delete" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_lecturer_delete" ON public.tutor_assignments
  FOR DELETE TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- ---------------------------------------------------------------------------
-- session_claims: lecturer insert for published schedule bridge
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_lecturer_insert_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_insert_own_modules" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions s
        WHERE s.id = source_scheduled_session_id
          AND s.module_id = session_claims.module_id
          AND s.tutor_id = session_claims.tutor_id
      )
    )
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_scheduled_session" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_scheduled_session" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND source_scheduled_session_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      INNER JOIN public.schedule_series ss ON ss.id = s.series_id
      WHERE s.id = source_scheduled_session_id
        AND s.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications: schedule change requested → lecturer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_lecturer_on_schedule_change_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lecturer_id uuid;
  v_module_code character varying(50);
  v_tutor_name character varying(255);
BEGIN
  SELECT m.lecturer_id, m.code INTO v_lecturer_id, v_module_code
  FROM public.scheduled_sessions s
  INNER JOIN public.modules m ON m.id = s.module_id
  WHERE s.id = NEW.scheduled_session_id;

  SELECT u.full_name INTO v_tutor_name
  FROM public.users u
  WHERE u.id = NEW.requested_by;

  IF v_lecturer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    v_lecturer_id,
    NULL,
    'IN_APP'::public.notification_channel,
    'SCHEDULE_CHANGE_REQUESTED'::public.notification_type,
    'Schedule change requested',
    format(
      '%s requested a schedule change for %s (%s).',
      COALESCE(v_tutor_name, 'A tutor'),
      COALESCE(v_module_code, 'module'),
      to_char(NEW.proposed_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_change_request_notify ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_request_notify
  AFTER INSERT ON public.schedule_change_requests
  FOR EACH ROW
  WHEN (NEW.status = 'PENDING'::public.schedule_change_request_status)
  EXECUTE FUNCTION public.notify_lecturer_on_schedule_change_request();

-- ---------------------------------------------------------------------------
-- Notifications: schedule change reviewed → tutor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_tutor_on_schedule_change_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor_id uuid;
  v_module_code character varying(50);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'APPROVED'::public.schedule_change_request_status,
    'REJECTED'::public.schedule_change_request_status
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.tutor_id, m.code INTO v_tutor_id, v_module_code
  FROM public.scheduled_sessions s
  INNER JOIN public.modules m ON m.id = s.module_id
  WHERE s.id = NEW.scheduled_session_id;

  IF v_tutor_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    claim_id,
    channel,
    type,
    subject,
    body
  )
  VALUES (
    v_tutor_id,
    NULL,
    'IN_APP'::public.notification_channel,
    'SCHEDULE_CHANGE_REVIEWED'::public.notification_type,
    CASE NEW.status
      WHEN 'APPROVED' THEN 'Schedule change approved'
      ELSE 'Schedule change rejected'
    END,
    format(
      'Your schedule change request for %s was %s.',
      COALESCE(v_module_code, 'module'),
      lower(NEW.status::text)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_change_review_notify ON public.schedule_change_requests;
CREATE TRIGGER trg_schedule_change_review_notify
  AFTER UPDATE ON public.schedule_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tutor_on_schedule_change_review();

-- ========== 20260527120000_lecturer_tutors_messaging_rls.sql ==========

-- Lecturer tutor directory + messaging write policies for DIRECT conversations.

-- ---------------------------------------------------------------------------
-- users: lecturers may browse institution tutors (assignment picker)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_tutors_same_institution_for_lecturer" ON public.users;
CREATE POLICY "users_select_tutors_same_institution_for_lecturer" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- conversations: participants may create conversations in their institution
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_insert_same_institution" ON public.conversations;
CREATE POLICY "conversations_insert_same_institution" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "conversations_update_participant" ON public.conversations;
CREATE POLICY "conversations_update_participant" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id))
  WITH CHECK (public.is_conversation_participant(id));

-- ---------------------------------------------------------------------------
-- conversation_participants: creator adds self + same-institution users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_same_institution_as_auth(user_id)
  );

-- ========== 20260528120000_fix_tutor_institution_rls.sql ==========

-- Fix institution matching for tutor assignment and lecturer tutor directory (NULL-safe).

CREATE OR REPLACE FUNCTION public.is_same_institution_as_auth(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = 'TUTOR'::public.user_role
      AND u.institution_id IS NOT DISTINCT FROM public.user_institution_id(auth.uid())
  );
$$;

DROP POLICY IF EXISTS "users_select_tutors_same_institution_for_lecturer" ON public.users;
CREATE POLICY "users_select_tutors_same_institution_for_lecturer" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'TUTOR'::public.user_role
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );

-- ========== 20260529120000_repair_auth_users_sync.sql ==========

-- Repair public.users sync from auth.users (backfill + hardened trigger).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  role_val public.user_role;
  name_val text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  name_val := COALESCE(NULLIF(trim(meta->>'full_name'), ''), split_part(NEW.email, '@', 1));

  BEGIN
    role_val := (meta->>'role')::public.user_role;
  EXCEPTION
    WHEN others THEN
      role_val := 'TUTOR'::public.user_role;
  END;

  INSERT INTO public.users (id, email, full_name, role, institution_id, is_active)
  VALUES (NEW.id, NEW.email, name_val, role_val, NULL, true)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), public.users.full_name),
    role = EXCLUDED.role,
    is_active = true;

  RETURN NEW;
END;
$$;

-- Backfill any auth users missing from public.users
INSERT INTO public.users (id, email, full_name, role, institution_id, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''),
    split_part(au.email, '@', 1)
  ),
  COALESCE(
    (au.raw_user_meta_data->>'role')::public.user_role,
    'TUTOR'::public.user_role
  ),
  NULL,
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ========== 20260530120000_messaging_enhancements.sql ==========

-- Messaging enhancements: attachments, unread RPC, full-text search indexes.

-- ---------------------------------------------------------------------------
-- message_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments (message_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_attachments_select_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_select_participant" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "message_attachments_insert_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_insert_participant" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = auth.uid()
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

GRANT SELECT, INSERT ON TABLE public.message_attachments TO authenticated;
GRANT ALL ON TABLE public.message_attachments TO service_role;

-- ---------------------------------------------------------------------------
-- Storage: message_attachments bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('message_attachments', 'message_attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "message_attachments_storage_select" ON storage.objects;
CREATE POLICY "message_attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message_attachments'
    AND public.is_conversation_participant(
      (split_part(name, '/', 1))::uuid
    )
  );

DROP POLICY IF EXISTS "message_attachments_storage_insert" ON storage.objects;
CREATE POLICY "message_attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message_attachments'
    AND public.is_conversation_participant(
      (split_part(name, '/', 1))::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Unread counts RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.messaging_unread_counts(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.conversation_id,
    COUNT(*)::bigint AS unread_count
  FROM public.messages m
  INNER JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id
    AND cp.user_id = p_user_id
  WHERE m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
  GROUP BY m.conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.messaging_unread_counts(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Full-text search (pg_trgm)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_conversations_title_trgm
  ON public.conversations USING gin (title gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.messaging_search(
  p_user_id uuid,
  p_query text,
  p_conversation_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  message_id uuid,
  conversation_id uuid,
  content text,
  created_at timestamptz,
  sender_id uuid,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id AS message_id,
    m.conversation_id,
    m.content,
    m.created_at,
    m.sender_id,
    similarity(m.content, p_query) AS rank
  FROM public.messages m
  INNER JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id
    AND cp.user_id = p_user_id
  WHERE m.content ILIKE '%' || p_query || '%'
    AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.messaging_search(uuid, text, uuid, integer) TO authenticated;

-- ========== 20260531120000_fix_conversation_create_rls.sql ==========

-- Fix conversation creation: INSERT RETURNING failed SELECT (participant-only) policy.
-- Allow adding any same-institution user as a participant (not only tutors).

DROP POLICY IF EXISTS "conversations_insert_same_institution" ON public.conversations;
CREATE POLICY "conversations_insert_same_institution" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      INNER JOIN public.conversations c ON c.id = conversation_participants.conversation_id
      WHERE u.id = conversation_participants.user_id
        AND u.institution_id IS NOT DISTINCT FROM c.institution_id
        AND c.institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
    )
  );

-- ========== 20260531130000_fix_conversation_participants_insert_rls.sql ==========

-- Participant INSERT policy must not JOIN conversations under RLS: the creator
-- cannot SELECT the new row until they are a participant.

CREATE OR REPLACE FUNCTION public.can_insert_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      INNER JOIN public.users target ON target.id = p_user_id
      INNER JOIN public.users creator ON creator.id = auth.uid()
      WHERE c.id = p_conversation_id
        AND target.institution_id IS NOT DISTINCT FROM c.institution_id
        AND creator.institution_id IS NOT DISTINCT FROM c.institution_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_insert_conversation_participant(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "conversation_participants_insert" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_insert_conversation_participant(conversation_id, user_id)
  );

-- ========== 20260531140000_message_notification_prefs.sql ==========

-- Message notification + dashboard message panel preferences

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_on_new_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dashboard_show_messages boolean NOT NULL DEFAULT true;

-- ========== 20260601120000_admin_institution_rls.sql ==========

-- Institution-scoped read access for ADMIN and SUPER_ADMIN dashboard operations.

CREATE OR REPLACE FUNCTION public.auth_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_module_in_auth_institution(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.modules m
    WHERE m.id = p_module_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_claim_in_auth_institution(p_claim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_claims sc
    INNER JOIN public.modules m ON m.id = sc.module_id
    WHERE sc.id = p_claim_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_module_in_auth_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_claim_in_auth_institution(uuid) TO authenticated;

-- session_claims
DROP POLICY IF EXISTS "session_claims_admin_select" ON public.session_claims;
CREATE POLICY "session_claims_admin_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- disputes
DROP POLICY IF EXISTS "disputes_admin_select" ON public.disputes;
CREATE POLICY "disputes_admin_select" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- verification_actions
DROP POLICY IF EXISTS "verification_actions_admin_select" ON public.verification_actions;
CREATE POLICY "verification_actions_admin_select" ON public.verification_actions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- attendance_evidence
DROP POLICY IF EXISTS "attendance_evidence_admin_select" ON public.attendance_evidence;
CREATE POLICY "attendance_evidence_admin_select" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- session_attendance
DROP POLICY IF EXISTS "session_attendance_admin_select" ON public.session_attendance;
CREATE POLICY "session_attendance_admin_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(session_id)
  );

-- users (tutors and lecturers in same institution)
DROP POLICY IF EXISTS "users_admin_select_institution" ON public.users;
CREATE POLICY "users_admin_select_institution" ON public.users
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- tutor_assignments
DROP POLICY IF EXISTS "tutor_assignments_admin_select" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_select" ON public.tutor_assignments
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- scheduled_sessions
DROP POLICY IF EXISTS "scheduled_sessions_admin_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- schedule_series
DROP POLICY IF EXISTS "schedule_series_admin_select" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- schedule_change_requests
DROP POLICY IF EXISTS "schedule_change_requests_admin_select" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_admin_select" ON public.schedule_change_requests
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  );

-- ========== 20260601130000_admin_approvals_writes.sql ==========

-- Admin approvals: freeze flag, write RLS, payroll export access.

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

COMMENT ON COLUMN public.session_claims.frozen_at IS
  'When set, claim status changes are blocked until cleared by an admin.';

-- session_claims: admin update (frozen claims blocked in server actions)
DROP POLICY IF EXISTS "session_claims_admin_update" ON public.session_claims;
CREATE POLICY "session_claims_admin_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- verification_actions: admin insert audit trail
DROP POLICY IF EXISTS "verification_actions_admin_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_admin_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- disputes: admin update (escalate, resolve)
DROP POLICY IF EXISTS "disputes_admin_update" ON public.disputes;
CREATE POLICY "disputes_admin_update" ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(claim_id)
  );

-- payroll_exports
DROP POLICY IF EXISTS "payroll_exports_admin_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_admin_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "payroll_exports_admin_insert" ON public.payroll_exports;
CREATE POLICY "payroll_exports_admin_insert" ON public.payroll_exports
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
    AND generated_by_id = auth.uid()
  );

-- payroll_export_claims
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.payroll_exports pe
      WHERE pe.id = payroll_export_claims.export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "payroll_export_claims_admin_insert" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_insert" ON public.payroll_export_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.payroll_exports pe
      WHERE pe.id = payroll_export_claims.export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Storage: admin read attendance registers for institution claims
DROP POLICY IF EXISTS "attendance_registers_select_admin" ON storage.objects;
CREATE POLICY "attendance_registers_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance_registers'
    AND public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      INNER JOIN public.modules m ON m.id = sc.module_id
      WHERE m.institution_id = public.get_auth_user_institution_id()
        AND sc.tutor_id::text = (storage.foldername(name))[1]
        AND sc.id::text = (storage.foldername(name))[2]
    )
  );

-- ========== 20260601140000_institution_management.sql ==========

-- Institution management: campuses, academic terms, admin RLS.
-- modules.semester / modules.academic_year remain for lecturer workflows;
-- academic_terms is institution master data configured by admins.

-- ---------------------------------------------------------------------------
-- campuses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  name character varying(255) NOT NULL,
  code character varying(50),
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campuses_institution_id ON public.campuses (institution_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campuses_institution_code_unique
  ON public.campuses (institution_id, code)
  WHERE code IS NOT NULL;

COMMENT ON TABLE public.campuses IS 'Physical campuses or sites within an institution.';

-- ---------------------------------------------------------------------------
-- academic_terms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  label character varying(100) NOT NULL,
  academic_year character varying(20) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_terms_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_academic_terms_institution_id
  ON public.academic_terms (institution_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_terms_one_current_per_institution
  ON public.academic_terms (institution_id)
  WHERE is_current = true;

COMMENT ON TABLE public.academic_terms IS 'Institution-configured semesters and academic years.';

-- ---------------------------------------------------------------------------
-- venues.campus_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_campus_id ON public.venues (campus_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_campuses_updated_at ON public.campuses;
CREATE TRIGGER trg_campuses_updated_at
  BEFORE UPDATE ON public.campuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS: campuses
-- ---------------------------------------------------------------------------
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.campuses TO authenticated;

DROP POLICY IF EXISTS "campuses_admin_select" ON public.campuses;
CREATE POLICY "campuses_admin_select" ON public.campuses
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "campuses_admin_insert" ON public.campuses;
CREATE POLICY "campuses_admin_insert" ON public.campuses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "campuses_admin_update" ON public.campuses;
CREATE POLICY "campuses_admin_update" ON public.campuses
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: academic_terms
-- ---------------------------------------------------------------------------
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.academic_terms TO authenticated;

DROP POLICY IF EXISTS "academic_terms_admin_select" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_select" ON public.academic_terms
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_insert" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_insert" ON public.academic_terms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_update" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_update" ON public.academic_terms
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "academic_terms_admin_delete" ON public.academic_terms;
CREATE POLICY "academic_terms_admin_delete" ON public.academic_terms
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: institutions (admin own row)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "institutions_admin_select_own" ON public.institutions;
CREATE POLICY "institutions_admin_select_own" ON public.institutions
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "institutions_admin_update_own" ON public.institutions;
CREATE POLICY "institutions_admin_update_own" ON public.institutions
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: venues (admin manage institution venues)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "venues_admin_insert" ON public.venues;
CREATE POLICY "venues_admin_insert" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "venues_admin_update" ON public.venues;
CREATE POLICY "venues_admin_update" ON public.venues
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ========== 20260602140000_admin_user_management.sql ==========

-- Admin user management: onboarding approval, documents, admin write RLS.

-- ---------------------------------------------------------------------------
-- user_approval_status enum + users columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_approval_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_approval_status AS ENUM (
      'pending_documents',
      'pending_review',
      'approved',
      'rejected'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status public.user_approval_status
    DEFAULT 'pending_documents'::public.user_approval_status;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamptz;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_note text;

-- Existing users keep full access (new signups default to pending_documents)
UPDATE public.users
SET approval_status = 'approved'::public.user_approval_status;

ALTER TABLE public.users
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.users
  ALTER COLUMN approval_status SET DEFAULT 'pending_documents'::public.user_approval_status;

COMMENT ON COLUMN public.users.approval_status IS
  'Institutional onboarding: documents → admin review → approved.';

-- ---------------------------------------------------------------------------
-- user_onboarding_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  document_kind character varying(50) NOT NULL,
  storage_path text NOT NULL,
  file_name character varying(255) NOT NULL,
  mime_type character varying(100) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT user_onboarding_documents_kind_check CHECK (
    document_kind IN ('government_id', 'employment_confirmation')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_onboarding_documents_user_kind
  ON public.user_onboarding_documents (user_id, document_kind);

ALTER TABLE public.user_onboarding_documents
  DROP CONSTRAINT IF EXISTS user_onboarding_documents_user_kind_key;

ALTER TABLE public.user_onboarding_documents
  ADD CONSTRAINT user_onboarding_documents_user_kind_key
  UNIQUE (user_id, document_kind);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_documents_institution
  ON public.user_onboarding_documents (institution_id);

COMMENT ON TABLE public.user_onboarding_documents IS
  'Required documents submitted during institutional onboarding.';

-- ---------------------------------------------------------------------------
-- Storage: onboarding-documents (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "onboarding_docs_insert_own" ON storage.objects;
CREATE POLICY "onboarding_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "onboarding_docs_select_own" ON storage.objects;
CREATE POLICY "onboarding_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- onboarding_docs_select_admin is created in 20260602150000_fix_users_update_self_rls.sql
-- (uses user_belongs_to_auth_institution to avoid users RLS recursion)

-- ---------------------------------------------------------------------------
-- RLS: user_onboarding_documents
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_onboarding_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.user_onboarding_documents TO authenticated;

DROP POLICY IF EXISTS "user_onboarding_documents_select_self" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_select_self" ON public.user_onboarding_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_onboarding_documents_insert_self" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_insert_self" ON public.user_onboarding_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "user_onboarding_documents_admin_select" ON public.user_onboarding_documents;
CREATE POLICY "user_onboarding_documents_admin_select" ON public.user_onboarding_documents
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ---------------------------------------------------------------------------
-- RLS: users admin update + harden self-update
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_admin_update_institution" ON public.users;
CREATE POLICY "users_admin_update_institution" ON public.users
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- users_update_self hardened policy is in 20260602150000_fix_users_update_self_rls.sql

-- ---------------------------------------------------------------------------
-- RLS: modules admin update (lecturer assignment)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "modules_admin_update_institution" ON public.modules;
CREATE POLICY "modules_admin_update_institution" ON public.modules
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ========== 20260602150000_fix_users_update_self_rls.sql ==========

-- Fix infinite recursion in users_update_self (subqueries on users re-entered RLS).

CREATE OR REPLACE FUNCTION public.get_auth_user_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_active FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_approval_status()
RETURNS public.user_approval_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT approval_status FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_approval_status() TO authenticated;

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.get_auth_user_role()
    AND institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
    AND is_active = public.get_auth_user_is_active()
    AND approval_status = public.get_auth_user_approval_status()
  );

-- Storage admin policy: avoid bare users subquery under RLS
CREATE OR REPLACE FUNCTION public.user_belongs_to_auth_institution(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_auth_institution(uuid) TO authenticated;

DROP POLICY IF EXISTS "onboarding_docs_select_admin" ON storage.objects;
CREATE POLICY "onboarding_docs_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND public.auth_user_is_admin()
    AND public.user_belongs_to_auth_institution(
      ((storage.foldername(name))[1])::uuid
    )
  );

-- ========== 20260603120000_admin_scheduling_engine.sql ==========

-- Admin scheduling engine: term linkage, institution settings, conflict indexes, admin write RLS.

-- ---------------------------------------------------------------------------
-- institutions.scheduling_settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS scheduling_settings jsonb NOT NULL
  DEFAULT '{"max_tutor_hours_per_week":20}'::jsonb;

COMMENT ON COLUMN public.institutions.scheduling_settings IS
  'Institution scheduling policy; max_tutor_hours_per_week used for overload detection.';

-- ---------------------------------------------------------------------------
-- modules.academic_term_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS academic_term_id uuid
  REFERENCES public.academic_terms (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modules_academic_term_id
  ON public.modules (academic_term_id)
  WHERE academic_term_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- schedule_series: term + institution scope
-- ---------------------------------------------------------------------------
ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS academic_term_id uuid
  REFERENCES public.academic_terms (id) ON DELETE SET NULL;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS institution_id uuid
  REFERENCES public.institutions (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_schedule_series_academic_term_id
  ON public.schedule_series (academic_term_id)
  WHERE academic_term_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_series_institution_id
  ON public.schedule_series (institution_id);

UPDATE public.schedule_series ss
SET institution_id = m.institution_id
FROM public.modules m
WHERE m.id = ss.module_id
  AND ss.institution_id IS NULL;

-- ---------------------------------------------------------------------------
-- Conflict scan indexes on scheduled_sessions
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_venue_scheduled
  ON public.scheduled_sessions (venue_id, starts_at)
  WHERE status = 'SCHEDULED'::public.scheduled_session_status
    AND venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_tutor_scheduled_range
  ON public.scheduled_sessions (tutor_id, starts_at, ends_at)
  WHERE status = 'SCHEDULED'::public.scheduled_session_status;

-- ---------------------------------------------------------------------------
-- Helper: series in admin institution
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_series_in_auth_institution(p_series_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_series ss
    INNER JOIN public.modules m ON m.id = ss.module_id
    WHERE ss.id = p_series_id
      AND m.institution_id = public.get_auth_user_institution_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_series_in_auth_institution(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: schedule_series (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_series_admin_insert" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_insert" ON public.schedule_series
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id
        AND u.role = 'TUTOR'::public.user_role
        AND u.institution_id = public.get_auth_user_institution_id()
    )
  );

DROP POLICY IF EXISTS "schedule_series_admin_update" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_update" ON public.schedule_series
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_admin_delete" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_delete" ON public.schedule_series
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: scheduled_sessions (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_sessions_admin_insert" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_insert" ON public.scheduled_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_update" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_update" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_delete" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_delete" ON public.scheduled_sessions
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_series_exceptions (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_series_exceptions_admin_all" ON public.schedule_series_exceptions;
CREATE POLICY "schedule_series_exceptions_admin_all" ON public.schedule_series_exceptions
  FOR ALL TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_series_in_auth_institution(series_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_series_in_auth_institution(series_id)
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: tutor_assignments (admin write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutor_assignments_admin_insert" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_insert" ON public.tutor_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_assignments_admin_update" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_update" ON public.tutor_assignments
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
  );

DROP POLICY IF EXISTS "tutor_assignments_admin_delete" ON public.tutor_assignments;
CREATE POLICY "tutor_assignments_admin_delete" ON public.tutor_assignments
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: schedule_change_requests (admin review)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedule_change_requests_admin_update" ON public.schedule_change_requests;
CREATE POLICY "schedule_change_requests_admin_update" ON public.schedule_change_requests
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      WHERE s.id = schedule_change_requests.scheduled_session_id
        AND public.is_module_in_auth_institution(s.module_id)
    )
  );

-- academic_terms: lecturers read current institution terms (for schedule UI)
DROP POLICY IF EXISTS "academic_terms_institution_select" ON public.academic_terms;
CREATE POLICY "academic_terms_institution_select" ON public.academic_terms
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_auth_user_institution_id()
  );

-- ========== 20260604120000_admin_sessions_support.sql ==========

-- Admin sessions monitoring: query indexes for institution-wide lists and attendance scans.
-- Attendance row access for admins uses session_attendance_admin_select (no students/users join).

CREATE INDEX IF NOT EXISTS idx_session_claims_module_session_date
  ON public.session_claims (module_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id
  ON public.session_attendance (session_id);

CREATE INDEX IF NOT EXISTS idx_session_attendance_student_check_in
  ON public.session_attendance (student_id, check_in_time DESC);

-- ========== 20260605120000_drop_students_admin_select.sql ==========

-- Learners are not registered users; admin session monitoring reads attendance rows
-- via session_attendance_admin_select without joining a students roster table.

DROP POLICY IF EXISTS "students_admin_select" ON public.students;

-- ========== 20260605120001_conversations_delete_policy.sql ==========

-- Allow participants to delete conversations they belong to (cascades messages).

DROP POLICY IF EXISTS "conversations_delete_participant" ON public.conversations;
CREATE POLICY "conversations_delete_participant" ON public.conversations
  FOR DELETE TO authenticated
  USING (public.is_conversation_participant(id));

-- ========== 20260606120000_admin_audit_logs_support.sql ==========

-- Admin audit logs: query performance, MFA read for institution admins, accurate claim status actor.

CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_created
  ON public.audit_logs (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mfa_events_occurred_at
  ON public.mfa_events (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- MFA events: admins read institution users' MFA history
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "mfa_events_admin_select" ON public.mfa_events;
CREATE POLICY "mfa_events_admin_select" ON public.mfa_events
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = mfa_events.user_id
        AND u.institution_id = public.get_auth_user_institution_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Claim status audit: attribute actor to auth.uid(), institution from module
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_institution_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT m.institution_id INTO v_institution_id
    FROM public.modules m
    WHERE m.id = NEW.module_id;

    IF v_institution_id IS NOT NULL THEN
      INSERT INTO audit_logs (
        institution_id,
        actor_id,
        entity_type,
        entity_id,
        event,
        payload
      )
      VALUES (
        v_institution_id,
        auth.uid(),
        'SESSION_CLAIM',
        NEW.id,
        'STATUS_CHANGED',
        jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ========== 20260607120000_verification_actions_actor_fkey.sql ==========

-- PostgREST embeds (actor:users) require a FK from actor_id -> users.id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'verification_actions_actor_id_fkey'
      AND conrelid = 'public.verification_actions'::regclass
  ) THEN
    ALTER TABLE public.verification_actions
      ADD CONSTRAINT verification_actions_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES public.users (id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ========== 20260608120000_admin_modules_management.sql ==========

-- Admin: create modules in institution; unique code per institution.

CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_institution_code_unique
  ON public.modules (institution_id, lower(code::text));

DROP POLICY IF EXISTS "modules_admin_insert_institution" ON public.modules;
CREATE POLICY "modules_admin_insert_institution" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ========== 20260609120000_user_registration_invites.sql ==========

-- Per-email registration invites (admin-issued; validated at signup via service role).

CREATE TABLE IF NOT EXISTS public.user_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  email character varying(255) NOT NULL,
  full_name character varying(255),
  role public.user_role NOT NULL,
  code_hash text NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_registration_invites_role_check CHECK (
    role IN ('TUTOR', 'LECTURER', 'ADMIN')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_registration_invites_institution
  ON public.user_registration_invites (institution_id);

CREATE INDEX IF NOT EXISTS idx_user_registration_invites_email_active
  ON public.user_registration_invites (lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_registration_invites_institution_email_active
  ON public.user_registration_invites (institution_id, lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.user_registration_invites IS
  'One-time invite codes for institution staff registration. Managed via server actions only.';

ALTER TABLE public.user_registration_invites ENABLE ROW LEVEL SECURITY;

-- No client policies: all access via service role in server functions.

-- ========== 20260610120000_session_claims_admin_insert.sql ==========

-- Allow institution admins to create session_claims when publishing schedules
-- (mirrors lecturer bridge insert; admin update/select already exist).

DROP POLICY IF EXISTS "session_claims_admin_insert" ON public.session_claims;
CREATE POLICY "session_claims_admin_insert" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND (
      source_scheduled_session_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.scheduled_sessions s
        WHERE s.id = source_scheduled_session_id
          AND s.module_id = session_claims.module_id
          AND s.tutor_id = session_claims.tutor_id
      )
    )
  );

-- ========== 20260610130000_tutor_payroll_read_and_compensation.sql ==========

-- Tutor read access to payroll batches for own claims + compensation rates (R225 default).

-- ---------------------------------------------------------------------------
-- Compensation rates
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS default_tutor_hourly_rate_cents integer NOT NULL DEFAULT 22500,
  ADD COLUMN IF NOT EXISTS rate_currency char(3) NOT NULL DEFAULT 'ZAR';

COMMENT ON COLUMN public.institutions.default_tutor_hourly_rate_cents IS
  'Default tutor hourly rate in cents (22500 = R225.00/hr).';

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS tutor_hourly_rate_cents integer;

COMMENT ON COLUMN public.modules.tutor_hourly_rate_cents IS
  'Optional per-module hourly rate override in cents; NULL uses institution default.';

ALTER TABLE public.tutor_assignments
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer;

COMMENT ON COLUMN public.tutor_assignments.hourly_rate_cents IS
  'Optional per-assignment hourly rate override in cents.';

UPDATE public.institutions
SET default_tutor_hourly_rate_cents = 22500
WHERE default_tutor_hourly_rate_cents IS NULL;

CREATE TABLE IF NOT EXISTS public.claim_compensation (
  claim_id uuid PRIMARY KEY REFERENCES public.session_claims (id) ON DELETE CASCADE,
  hourly_rate_cents integer NOT NULL,
  hours numeric(5, 2) NOT NULL,
  amount_cents integer NOT NULL,
  currency char(3) NOT NULL DEFAULT 'ZAR',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_reference character varying(255)
);

COMMENT ON TABLE public.claim_compensation IS
  'Immutable compensation snapshot when a claim is admin-approved.';

ALTER TABLE public.claim_compensation ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: claim_compensation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "claim_compensation_tutor_select_own" ON public.claim_compensation;
CREATE POLICY "claim_compensation_tutor_select_own" ON public.claim_compensation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = claim_compensation.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "claim_compensation_admin_select" ON public.claim_compensation;
CREATE POLICY "claim_compensation_admin_select" ON public.claim_compensation
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1 FROM public.session_claims sc
      JOIN public.modules m ON m.id = sc.module_id
      WHERE sc.id = claim_compensation.claim_id
        AND m.institution_id = public.get_auth_user_institution_id()
    )
  );

-- Inserts via service role / admin server actions only (no client insert policy).

-- ---------------------------------------------------------------------------
-- RLS: tutor payroll export visibility
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "payroll_export_claims_tutor_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_tutor_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = payroll_export_claims.claim_id
        AND sc.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_tutor_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.payroll_export_claims pec
      JOIN public.session_claims sc ON sc.id = pec.claim_id
      WHERE pec.export_id = payroll_exports.id
        AND sc.tutor_id = auth.uid()
    )
  );

-- ========== 20260611120000_students_institution_reference_unique.sql ==========

-- One student number per institution; supports roster + QR check-in upsert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_institution_reference_unique
  ON public.students (institution_id, student_reference)
  WHERE student_reference IS NOT NULL AND btrim(student_reference) <> '';

-- ========== 20260617120000_user_status_lifecycle.sql ==========

-- Enterprise user lifecycle: user_status + onboarding_step, RLS platform access.

-- ---------------------------------------------------------------------------
-- user_status enum + columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_status AS ENUM (
      'PENDING_APPROVAL',
      'ACTIVE',
      'SUSPENDED',
      'REJECTED'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_status public.user_status;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_onboarding_step_check CHECK (
    onboarding_step IS NULL
    OR onboarding_step IN ('documents', 'ready_for_review')
  );

COMMENT ON COLUMN public.users.user_status IS
  'Account lifecycle: PENDING_APPROVAL → ACTIVE; admin may SUSPEND or REJECT.';
COMMENT ON COLUMN public.users.onboarding_step IS
  'When PENDING_APPROVAL: documents (upload KYC) or ready_for_review (awaiting admin).';

-- Backfill from legacy approval_status + is_active
UPDATE public.users
SET
  user_status = CASE
    WHEN approval_status = 'rejected'::public.user_approval_status THEN
      'REJECTED'::public.user_status
    WHEN approval_status = 'approved'::public.user_approval_status
      AND COALESCE(is_active, true) = false THEN
      'SUSPENDED'::public.user_status
    WHEN approval_status = 'approved'::public.user_approval_status THEN
      'ACTIVE'::public.user_status
    ELSE
      'PENDING_APPROVAL'::public.user_status
  END,
  onboarding_step = CASE
    WHEN approval_status = 'pending_review'::public.user_approval_status THEN
      'ready_for_review'
    WHEN approval_status = 'pending_documents'::public.user_approval_status THEN
      'documents'
    ELSE
      NULL
  END
WHERE user_status IS NULL;

ALTER TABLE public.users
  ALTER COLUMN user_status SET DEFAULT 'PENDING_APPROVAL'::public.user_status;

ALTER TABLE public.users
  ALTER COLUMN user_status SET NOT NULL;

-- Keep legacy columns aligned on lifecycle changes
CREATE OR REPLACE FUNCTION public.sync_user_lifecycle_legacy_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_status IS NULL THEN
    RETURN NEW;
  END IF;

  CASE NEW.user_status
    WHEN 'ACTIVE' THEN
      NEW.approval_status := 'approved'::public.user_approval_status;
      NEW.is_active := true;
      NEW.onboarding_step := NULL;
    WHEN 'PENDING_APPROVAL' THEN
      NEW.is_active := true;
      IF NEW.onboarding_step = 'ready_for_review' THEN
        NEW.approval_status := 'pending_review'::public.user_approval_status;
      ELSE
        IF NEW.onboarding_step IS NULL THEN
          NEW.onboarding_step := 'documents';
        END IF;
        NEW.approval_status := 'pending_documents'::public.user_approval_status;
      END IF;
    WHEN 'SUSPENDED' THEN
      NEW.approval_status := 'approved'::public.user_approval_status;
      NEW.is_active := false;
      NEW.onboarding_step := NULL;
    WHEN 'REJECTED' THEN
      NEW.approval_status := 'rejected'::public.user_approval_status;
      NEW.is_active := false;
      NEW.onboarding_step := NULL;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_sync_lifecycle ON public.users;
CREATE TRIGGER trg_users_sync_lifecycle
  BEFORE INSERT OR UPDATE OF user_status, onboarding_step
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_lifecycle_legacy_columns();

-- Auth signup trigger: default lifecycle for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  role_val public.user_role;
  name_val text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  name_val := COALESCE(meta->>'full_name', split_part(NEW.email, '@', 1));

  BEGIN
    role_val := (meta->>'role')::public.user_role;
  EXCEPTION
    WHEN others THEN
      role_val := 'TUTOR'::public.user_role;
  END;

  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    institution_id,
    user_status,
    onboarding_step
  )
  VALUES (
    NEW.id,
    NEW.email,
    name_val,
    role_val,
    NULL,
    'PENDING_APPROVAL'::public.user_status,
    'documents'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_user_status()
RETURNS public.user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_status FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_onboarding_step()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT onboarding_step FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_platform_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_auth_user_status() = 'ACTIVE'::public.user_status;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_onboarding_step() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_has_platform_access() TO authenticated;

-- Self-update: users cannot change lifecycle fields
DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.get_auth_user_role()
    AND institution_id IS NOT DISTINCT FROM public.get_auth_user_institution_id()
    AND is_active = public.get_auth_user_is_active()
    AND approval_status = public.get_auth_user_approval_status()
    AND user_status = public.get_auth_user_status()
    AND onboarding_step IS NOT DISTINCT FROM public.get_auth_user_onboarding_step()
  );

-- ---------------------------------------------------------------------------
-- Platform access on sensitive tutor write paths
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_own" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_own" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND (
      source_schedule_import_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tutor_schedule_imports i
        WHERE i.id = source_schedule_import_id
          AND i.tutor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "session_claims_tutor_insert_scheduled_session" ON public.session_claims;
CREATE POLICY "session_claims_tutor_insert_scheduled_session" ON public.session_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND source_scheduled_session_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.scheduled_sessions s
      INNER JOIN public.schedule_series ss ON ss.id = s.series_id
      WHERE s.id = source_scheduled_session_id
        AND s.tutor_id = auth.uid()
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  );

DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

-- ========== 20260618120000_fix_payroll_exports_rls_recursion.sql ==========

-- Break payroll_exports <-> payroll_export_claims RLS recursion by using
-- SECURITY DEFINER helpers (same pattern as get_auth_user_institution_id).

CREATE OR REPLACE FUNCTION public.is_payroll_export_in_auth_institution(p_export_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payroll_exports pe
    WHERE pe.id = p_export_id
      AND pe.institution_id = public.get_auth_user_institution_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.tutor_owns_claim_in_payroll_export(p_export_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payroll_export_claims pec
    INNER JOIN public.session_claims sc ON sc.id = pec.claim_id
    WHERE pec.export_id = p_export_id
      AND sc.tutor_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_payroll_export_in_auth_institution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_owns_claim_in_payroll_export(uuid) TO authenticated;

-- payroll_export_claims: stop selecting payroll_exports inside policy
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND public.is_payroll_export_in_auth_institution(export_id)
  );

DROP POLICY IF EXISTS "payroll_export_claims_admin_insert" ON public.payroll_export_claims;
CREATE POLICY "payroll_export_claims_admin_insert" ON public.payroll_export_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_payroll_export_in_auth_institution(export_id)
  );

-- payroll_exports: stop selecting payroll_export_claims inside policy
DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
CREATE POLICY "payroll_exports_tutor_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (public.tutor_owns_claim_in_payroll_export(id));

-- ========== 20260618120001_scheduled_session_cancellation_meta.sql ==========

-- Cancellation metadata + tutor cancel/update on own published sessions.

ALTER TABLE public.scheduled_sessions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scheduled_sessions.cancelled_at IS
  'When the session was cancelled (status = CANCELLED).';
COMMENT ON COLUMN public.scheduled_sessions.cancellation_reason IS
  'Required explanation when cancelling a session.';

-- Tutors may cancel (update) their own published-series sessions.
DROP POLICY IF EXISTS "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
    )
  )
  WITH CHECK (tutor_id = auth.uid());

-- ========== 20260618130000_tutor_session_creation_approval.sql ==========

-- Tutor "Create session" requires admin approval; schedule/import-linked claims auto-approve.

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS admin_creation_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_creation_approved_by uuid REFERENCES public.users (id);

COMMENT ON COLUMN public.session_claims.admin_creation_approved_at IS
  'When set, a tutor-created (manual) session is visible on tutor dashboards.';
COMMENT ON COLUMN public.session_claims.admin_creation_approved_by IS
  'Admin who approved a tutor-created session.';

-- Existing schedule/import claims do not need manual approval.
UPDATE public.session_claims
SET admin_creation_approved_at = COALESCE(updated_at, now())
WHERE admin_creation_approved_at IS NULL
  AND (
    source_scheduled_session_id IS NOT NULL
    OR source_schedule_import_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.session_claims_auto_approve_linked_creation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_scheduled_session_id IS NOT NULL
     OR NEW.source_schedule_import_id IS NOT NULL THEN
    NEW.admin_creation_approved_at := COALESCE(NEW.admin_creation_approved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_claims_auto_approve_linked ON public.session_claims;
CREATE TRIGGER trg_session_claims_auto_approve_linked
  BEFORE INSERT ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.session_claims_auto_approve_linked_creation();

-- ========== 20260618140000_verification_actions_tutor_insert.sql ==========

-- Allow tutors to append workflow events on their own claims (submit / resubmit).
DROP POLICY IF EXISTS "verification_actions_tutor_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND action_type IN ('TUTOR_SUBMITTED', 'TUTOR_RESUBMITTED')
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()::uuid
    )
  );

-- ========== 20260619120000_soft_delete_compliance.sql ==========

-- Soft delete for compliance: claims, scheduled sessions, attendance, draft series.
-- Rows are retained; default visibility excludes deleted_at IS NOT NULL.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.scheduled_sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.session_attendance
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.session_claims.deleted_at IS
  'Soft delete tombstone; row retained for audit and disputes.';
COMMENT ON COLUMN public.scheduled_sessions.deleted_at IS
  'Soft delete tombstone; prefer status=CANCELLED for operational cancel.';
COMMENT ON COLUMN public.session_attendance.deleted_at IS
  'Soft delete tombstone; attendance history retained.';

-- ---------------------------------------------------------------------------
-- Indexes (active rows)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_session_claims_active
  ON public.session_claims (module_id, session_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_active_series
  ON public.scheduled_sessions (series_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_attendance_active_session
  ON public.session_attendance (session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_series_active_institution
  ON public.schedule_series (institution_id)
  WHERE deleted_at IS NULL AND institution_id IS NOT NULL;

-- Allow re-check-in after soft-deleted attendance row
ALTER TABLE public.session_attendance
  DROP CONSTRAINT IF EXISTS session_attendance_session_id_student_id_key;

DROP INDEX IF EXISTS public.session_attendance_session_id_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_attendance_active_unique
  ON public.session_attendance (session_id, student_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- session_claims RLS (hide soft-deleted)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_select" ON public.session_claims;
CREATE POLICY "session_claims_tutor_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  )
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
  );

DROP POLICY IF EXISTS "session_claims_lecturer_select_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_select_own_modules" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_claims_lecturer_update_own_modules" ON public.session_claims;
CREATE POLICY "session_claims_lecturer_update_own_modules" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_auth_user_role() = 'LECTURER'::public.user_role
    AND public.auth_user_has_platform_access()
    AND EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = session_claims.module_id
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_claims_admin_select" ON public.session_claims;
CREATE POLICY "session_claims_admin_select" ON public.session_claims
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "session_claims_admin_update" ON public.session_claims;
CREATE POLICY "session_claims_admin_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ---------------------------------------------------------------------------
-- scheduled_sessions RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_sessions_tutor_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
        AND ss.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_tutor_update_own" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.schedule_series ss
      WHERE ss.id = scheduled_sessions.series_id
        AND ss.status = 'PUBLISHED'::public.schedule_series_status
        AND ss.deleted_at IS NULL
    )
  )
  WITH CHECK (tutor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session_attendance: no hard DELETE for tutors
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tutors_manage_session_attendance" ON public.session_attendance;
DROP POLICY IF EXISTS "session_attendance_tutor_select" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "session_attendance_tutor_insert" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_insert" ON public.session_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "session_attendance_tutor_update" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_update" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

-- Tutors may restore soft-deleted attendance on their sessions (check-in again)
DROP POLICY IF EXISTS "session_attendance_tutor_restore" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_restore" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "session_attendance_lecturer_select" ON public.session_attendance;
CREATE POLICY "session_attendance_lecturer_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      JOIN public.modules m ON m.id = sc.module_id
      WHERE sc.id = session_attendance.session_id
        AND sc.deleted_at IS NULL
        AND m.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_attendance_admin_select" ON public.session_attendance;
CREATE POLICY "session_attendance_admin_select" ON public.session_attendance
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_claim_in_auth_institution(session_id)
  );

-- Admin scheduling: hide soft-deleted; disallow hard DELETE on sessions
DROP POLICY IF EXISTS "scheduled_sessions_admin_select" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_select" ON public.scheduled_sessions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_update" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_update" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_delete" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_delete" ON public.scheduled_sessions
  FOR DELETE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_admin_select" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_select" ON public.schedule_series
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

-- ========== 20260620120000_claim_workflow_enforcement.sql ==========

-- Claim workflow enforcement (keep transition matrix in sync with src/lib/claim-workflow/transitions.ts)

ALTER TABLE public.verification_actions
  ADD COLUMN IF NOT EXISTS attestation_method text NOT NULL DEFAULT 'NONE';

COMMENT ON COLUMN public.verification_actions.attestation_method IS
  'How the actor attested: NONE, TOTP_STEP_UP, or legacy values in mfa_method.';

-- ---------------------------------------------------------------------------
-- Status transition guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_allowed_claim_status_transition(
  p_from public.claim_status,
  p_to public.claim_status,
  p_role public.user_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_from IS NOT DISTINCT FROM p_to THEN
    RETURN true;
  END IF;

  -- Tutor
  IF p_role = 'TUTOR'::public.user_role THEN
    RETURN (p_from = 'DRAFT' AND p_to = 'PENDING_VERIFICATION')
      OR (p_from = 'REJECTED' AND p_to = 'DRAFT')
      OR (p_from = 'DISPUTED' AND p_to = 'DRAFT');
  END IF;

  -- Lecturer
  IF p_role = 'LECTURER'::public.user_role THEN
    RETURN (p_from = 'PENDING_VERIFICATION' AND p_to IN ('VERIFIED', 'REJECTED', 'DISPUTED'))
      OR (p_from = 'DISPUTED' AND p_to IN ('VERIFIED', 'REJECTED'));
  END IF;

  -- Admin / super admin
  IF p_role IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role) THEN
    RETURN (p_from = 'VERIFIED' AND p_to IN ('APPROVED', 'REJECTED', 'PENDING_VERIFICATION'))
      OR (p_from = 'DISPUTED' AND p_to = 'REJECTED');
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_claim_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Service role / migrations (no end-user JWT)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'APPROVED'::public.claim_status THEN
    RAISE EXCEPTION 'Approved session claims cannot be modified.';
  END IF;

  v_role := public.get_auth_user_role();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cannot change claim status without an authenticated role.';
  END IF;

  IF NOT public.is_allowed_claim_status_transition(OLD.status, NEW.status, v_role) THEN
    RAISE EXCEPTION 'Disallowed claim status transition from % to % for role %',
      OLD.status, NEW.status, v_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_session_claim_status ON public.session_claims;
CREATE TRIGGER trg_enforce_session_claim_status
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_claim_status_transition();

-- ---------------------------------------------------------------------------
-- Approved-row immutability (any column change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_session_claim_approved_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'APPROVED'::public.claim_status AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Approved session claims are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_claim_approved_immutable ON public.session_claims;
CREATE TRIGGER trg_session_claim_approved_immutable
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_claim_approved_immutable();

-- ---------------------------------------------------------------------------
-- Tutor update: editable statuses only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "session_claims_tutor_update" ON public.session_claims;
CREATE POLICY "session_claims_tutor_update" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status
    )
    AND frozen_at IS NULL
  )
  WITH CHECK (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND frozen_at IS NULL
    AND status IN (
      'DRAFT'::public.claim_status,
      'REJECTED'::public.claim_status,
      'DISPUTED'::public.claim_status,
      'PENDING_VERIFICATION'::public.claim_status
    )
  );

DROP POLICY IF EXISTS "session_claims_tutor_soft_delete" ON public.session_claims;
CREATE POLICY "session_claims_tutor_soft_delete" ON public.session_claims
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status = 'DRAFT'::public.claim_status
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND tutor_id = auth.uid()
    AND public.auth_user_has_platform_access()
    AND status = 'DRAFT'::public.claim_status
  );

DROP POLICY IF EXISTS "session_attendance_tutor_soft_delete" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_soft_delete" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
        AND sc.status = 'DRAFT'::public.claim_status
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
        AND sc.status = 'DRAFT'::public.claim_status
    )
  );

DROP POLICY IF EXISTS "session_attendance_tutor_update" ON public.session_attendance;
CREATE POLICY "session_attendance_tutor_update" ON public.session_attendance
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = session_attendance.session_id
        AND sc.tutor_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- Append-only audit tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "verification_actions_no_update" ON public.verification_actions;
CREATE POLICY "verification_actions_no_update" ON public.verification_actions
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "verification_actions_no_delete" ON public.verification_actions;
CREATE POLICY "verification_actions_no_delete" ON public.verification_actions
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

-- ========== 20260621120000_session_automation.sql ==========

-- Session automation: incremental materialize metadata, claim origin, attendance lock, auto-submit, reminders.

-- ---------------------------------------------------------------------------
-- claim_creation_source
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_creation_source') THEN
    CREATE TYPE public.claim_creation_source AS ENUM (
      'SCHEDULE',
      'TUTOR_MANUAL',
      'IMPORT',
      'LECTURER_ONE_OFF'
    );
  END IF;
END $$;

ALTER TABLE public.schedule_series
  ADD COLUMN IF NOT EXISTS materialized_until timestamptz;

COMMENT ON COLUMN public.schedule_series.materialized_until IS
  'Latest occurrence end time written by incremental materialization.';

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS creation_source public.claim_creation_source,
  ADD COLUMN IF NOT EXISTS attendance_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_submitted_at timestamptz;

COMMENT ON COLUMN public.session_claims.creation_source IS
  'How the claim was created: official schedule, tutor manual, import, or lecturer one-off series.';
COMMENT ON COLUMN public.session_claims.attendance_locked_at IS
  'When attendance edits and QR check-in were locked after session end.';
COMMENT ON COLUMN public.session_claims.auto_submitted_at IS
  'When the claim was submitted automatically by institution policy.';

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS auto_submit_claims boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_submit_requires_attendance boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.institutions.auto_submit_claims IS
  'When true, eligible DRAFT claims may be auto-submitted after session end.';
COMMENT ON COLUMN public.institutions.auto_submit_requires_attendance IS
  'When true, auto-submit requires attendance rows or register evidence.';

-- Backfill creation_source from existing linkage columns
UPDATE public.session_claims sc
SET creation_source = CASE
  WHEN sc.source_scheduled_session_id IS NOT NULL THEN 'SCHEDULE'::public.claim_creation_source
  WHEN sc.source_schedule_import_id IS NOT NULL THEN 'IMPORT'::public.claim_creation_source
  ELSE 'TUTOR_MANUAL'::public.claim_creation_source
END
WHERE sc.creation_source IS NULL;

ALTER TABLE public.session_claims
  ALTER COLUMN creation_source SET DEFAULT 'TUTOR_MANUAL'::public.claim_creation_source;

-- Notification types for session reminders
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_UPCOMING';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CLAIM_DRAFT_REMINDER';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'CLAIM_PENDING_REMINDER';

-- ========== 20260622120000_fix_payroll_exports_recursion.sql ==========

-- Fix RLS recursion on public.payroll_exports and public.payroll_export_claims.
-- This occurs because:
--   1. payroll_exports RLS selects from payroll_export_claims.
--   2. payroll_export_claims RLS selects from payroll_exports.
-- Using SECURITY DEFINER functions bypasses RLS evaluation during the internal queries, breaking the circular dependency.

-- 1. Function to check if a user can select a payroll export
CREATE OR REPLACE FUNCTION public.can_user_select_payroll_export(p_export_id uuid, p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is admin/super_admin and the export is in their institution
  SELECT (
    public.auth_user_is_admin()
    AND p_institution_id = public.get_auth_user_institution_id()
  ) OR (
    -- Check if user is a tutor and has a claim included in this export
    EXISTS (
      SELECT 1
      FROM public.payroll_export_claims pec
      JOIN public.session_claims sc ON sc.id = pec.claim_id
      WHERE pec.export_id = p_export_id
        AND sc.tutor_id = auth.uid()
    )
  );
$$;

-- 2. Function to check if a user can select a payroll export claim record
CREATE OR REPLACE FUNCTION public.can_user_select_payroll_export_claim(p_claim_id uuid, p_export_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is a tutor and owns the underlying session claim
  SELECT (
    EXISTS (
      SELECT 1 FROM public.session_claims sc
      WHERE sc.id = p_claim_id
        AND sc.tutor_id = auth.uid()
    )
  ) OR (
    -- Check if user is admin/super_admin and the associated export is in their institution
    public.auth_user_is_admin()
    AND EXISTS (
      SELECT 1 FROM public.payroll_exports pe
      WHERE pe.id = p_export_id
        AND pe.institution_id = public.get_auth_user_institution_id()
    )
  );
$$;

-- 3. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.can_user_select_payroll_export(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_select_payroll_export_claim(uuid, uuid) TO authenticated;

-- 4. Recreate select policies for public.payroll_exports using the security definer function
DROP POLICY IF EXISTS "payroll_exports_admin_select" ON public.payroll_exports;
DROP POLICY IF EXISTS "payroll_exports_tutor_select" ON public.payroll_exports;
DROP POLICY IF EXISTS "payroll_exports_select" ON public.payroll_exports;

CREATE POLICY "payroll_exports_select" ON public.payroll_exports
  FOR SELECT TO authenticated
  USING (
    public.can_user_select_payroll_export(id, institution_id)
  );

-- 5. Recreate select policies for public.payroll_export_claims using the security definer function
DROP POLICY IF EXISTS "payroll_export_claims_admin_select" ON public.payroll_export_claims;
DROP POLICY IF EXISTS "payroll_export_claims_tutor_select" ON public.payroll_export_claims;
DROP POLICY IF EXISTS "payroll_export_claims_select" ON public.payroll_export_claims;

CREATE POLICY "payroll_export_claims_select" ON public.payroll_export_claims
  FOR SELECT TO authenticated
  USING (
    public.can_user_select_payroll_export_claim(claim_id, export_id)
  );

-- ========== 20260623120000_tutor_hour_allocations.sql ==========

-- Tutor hour allocations per module + academic term (Option A: reserved vs worked).

CREATE TABLE IF NOT EXISTS public.tutor_hour_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules (id) ON DELETE CASCADE,
  academic_term_id uuid NOT NULL REFERENCES public.academic_terms (id) ON DELETE CASCADE,
  allocated_hours numeric(8, 2) NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_hour_allocations_hours_positive CHECK (allocated_hours > 0),
  CONSTRAINT tutor_hour_allocations_unique_scope UNIQUE (tutor_id, module_id, academic_term_id)
);

COMMENT ON TABLE public.tutor_hour_allocations IS
  'Maximum teaching hours a tutor may reserve per module and academic term.';

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_tutor
  ON public.tutor_hour_allocations (tutor_id);

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_module_term
  ON public.tutor_hour_allocations (module_id, academic_term_id);

CREATE INDEX IF NOT EXISTS idx_tutor_hour_allocations_institution
  ON public.tutor_hour_allocations (institution_id);

ALTER TABLE public.tutor_hour_allocations ENABLE ROW LEVEL SECURITY;

-- Tutor: read own allocations
DROP POLICY IF EXISTS "tutor_hour_allocations_tutor_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_tutor_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- Lecturer: read/write allocations on own modules
DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (public.is_lecturer_for_module(module_id));

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_insert" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_insert" ON public.tutor_hour_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = academic_term_id
        AND t.institution_id = institution_id
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = tutor_id AND u.role = 'TUTOR'::public.user_role
    )
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_update" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_update" ON public.tutor_hour_allocations
  FOR UPDATE TO authenticated
  USING (public.is_lecturer_for_module(module_id))
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_lecturer_delete" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_lecturer_delete" ON public.tutor_hour_allocations
  FOR DELETE TO authenticated
  USING (public.is_lecturer_for_module(module_id));

-- Admin: full CRUD within institution
DROP POLICY IF EXISTS "tutor_hour_allocations_admin_select" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_select" ON public.tutor_hour_allocations
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_insert" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_insert" ON public.tutor_hour_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND public.is_same_institution_as_auth(tutor_id)
    AND institution_id = public.get_auth_user_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.academic_terms t
      WHERE t.id = academic_term_id
        AND t.institution_id = institution_id
    )
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_update" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_update" ON public.tutor_hour_allocations
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  )
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
    AND institution_id = public.get_auth_user_institution_id()
  );

DROP POLICY IF EXISTS "tutor_hour_allocations_admin_delete" ON public.tutor_hour_allocations;
CREATE POLICY "tutor_hour_allocations_admin_delete" ON public.tutor_hour_allocations
  FOR DELETE TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = public.get_auth_user_institution_id()
  );

-- ========== 20260624120000_tutor_session_requests.sql ==========

-- Tutor session request workflow: reason, review status, lecturer/admin feedback.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_request_status') THEN
    CREATE TYPE public.session_request_status AS ENUM (
      'PENDING',
      'CHANGES_REQUESTED',
      'REJECTED',
      'APPROVED'
    );
  END IF;
END $$;

ALTER TABLE public.session_claims
  ADD COLUMN IF NOT EXISTS request_reason text,
  ADD COLUMN IF NOT EXISTS request_status public.session_request_status,
  ADD COLUMN IF NOT EXISTS review_feedback text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_claims.request_reason IS
  'Why the tutor requested this session (required for manual requests).';
COMMENT ON COLUMN public.session_claims.request_status IS
  'Approval state for tutor-requested manual sessions.';
COMMENT ON COLUMN public.session_claims.review_feedback IS
  'Reviewer feedback when suggesting changes or rejecting.';

-- Legacy admin-approved manual claims
UPDATE public.session_claims
SET request_status = 'APPROVED'::public.session_request_status
WHERE request_status IS NULL
  AND admin_creation_approved_at IS NOT NULL
  AND source_scheduled_session_id IS NULL
  AND source_schedule_import_id IS NULL;

-- Pending manual requests (awaiting review)
UPDATE public.session_claims
SET request_status = 'PENDING'::public.session_request_status
WHERE request_status IS NULL
  AND source_scheduled_session_id IS NULL
  AND source_schedule_import_id IS NULL;

-- ========== 20260625120000_schedule_sync_notifications.sql ==========

-- Schedule synchronization in-app notification types

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_TIME_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_VENUE_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_TUTOR_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_CANCELLED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_RESTORED';

-- ========== 20260626120000_private_session_feedback.sql ==========

-- Private lecturer feedback on verified session claims (tutor / lecturer / admin only).

DO $$ BEGIN
  CREATE TYPE public.private_feedback_category AS ENUM (
    'PREPAREDNESS',
    'STUDENT_ENGAGEMENT',
    'ATTENDANCE_MANAGEMENT',
    'PROFESSIONALISM',
    'SESSION_EFFECTIVENESS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.private_session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.session_claims (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  category_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_session_feedback_claim_author_unique UNIQUE (claim_id, author_id),
  CONSTRAINT private_session_feedback_has_content CHECK (
    btrim(COALESCE(note, '')) <> ''
    OR category_ratings <> '{}'::jsonb
  )
);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_claim
  ON public.private_session_feedback (claim_id);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_tutor
  ON public.private_session_feedback (tutor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_session_feedback_institution
  ON public.private_session_feedback (institution_id);

COMMENT ON TABLE public.private_session_feedback IS
  'Optional private developmental feedback after session verification; not public.';

ALTER TABLE public.private_session_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private_session_feedback_lecturer_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_lecturer_insert" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_insert" ON public.private_session_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_lecturer_update" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_lecturer_update" ON public.private_session_feedback
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  )
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_lecturer_for_claim(claim_id)
  );

DROP POLICY IF EXISTS "private_session_feedback_tutor_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_tutor_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "private_session_feedback_admin_select" ON public.private_session_feedback;
CREATE POLICY "private_session_feedback_admin_select" ON public.private_session_feedback
  FOR SELECT TO authenticated
  USING (
    public.auth_user_is_admin()
    AND institution_id = (
      SELECT u.institution_id
      FROM public.users u
      WHERE u.id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.private_session_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_session_feedback TO service_role;

-- ========== 20260627120000_claim_submit_schedule_guard.sql ==========

-- Block submitting a claim when the linked official session is cancelled or removed.

CREATE OR REPLACE FUNCTION public.enforce_claim_submit_linked_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id uuid;
  v_status text;
  v_deleted_at timestamptz;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'DRAFT'
     AND NEW.status = 'PENDING_VERIFICATION'
     AND NEW.source_scheduled_session_id IS NOT NULL THEN
    v_session_id := NEW.source_scheduled_session_id;

    SELECT s.status, s.deleted_at
    INTO v_status, v_deleted_at
    FROM public.scheduled_sessions s
    WHERE s.id = v_session_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session no longer exists.';
    END IF;

    IF v_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session was removed.';
    END IF;

    IF v_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Cannot submit: linked schedule session is cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_claim_submit_linked_session ON public.session_claims;
CREATE TRIGGER trg_enforce_claim_submit_linked_session
  BEFORE UPDATE ON public.session_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_claim_submit_linked_session();

-- ========== 20260628120000_job_outbox.sql ==========

-- Lightweight job outbox for async side effects (processed by session automation cron).

DO $$ BEGIN
  CREATE TYPE public.job_outbox_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions (id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  status public.job_outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_outbox_pending
  ON public.job_outbox (status, created_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_outbox_idempotency
  ON public.job_outbox (job_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status <> 'failed';

COMMENT ON TABLE public.job_outbox IS
  'Async work queue processed by runSessionAutomationJobs (retries + dead letter).';

ALTER TABLE public.job_outbox ENABLE ROW LEVEL SECURITY;

-- ========== 20260629120000_allow_tutor_no_show_escalation_events.sql ==========

-- Tutors can submit a zero-attendance claim without an explanation; the app
-- freezes/escalates it and records that workflow event under the tutor actor.
DROP POLICY IF EXISTS "verification_actions_tutor_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND action_type IN (
      'TUTOR_SUBMITTED',
      'TUTOR_RESUBMITTED',
      'NO_SHOW_ESCALATED'
    )
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()::uuid
    )
  );

-- ========== 20260629130000_allow_tutor_draft_purge_events.sql ==========

-- The tutor sessions workspace purges expired draft claims while loading.
-- Keep the append-only audit insert allowed for the tutor's own claim.
DROP POLICY IF EXISTS "verification_actions_tutor_insert" ON public.verification_actions;
CREATE POLICY "verification_actions_tutor_insert" ON public.verification_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()::uuid
    AND action_type IN (
      'TUTOR_SUBMITTED',
      'TUTOR_RESUBMITTED',
      'NO_SHOW_ESCALATED',
      'DRAFT_EXPIRED_PURGED'
    )
    AND EXISTS (
      SELECT 1
      FROM public.session_claims sc
      WHERE sc.id = verification_actions.claim_id
        AND sc.tutor_id = auth.uid()::uuid
    )
  );

-- ========== 20260629140000_fix_schedule_soft_delete_lifecycle.sql ==========

-- Keep the schedule lifecycle consistent with soft deletes:
-- - Deleted claims should not block a replacement claim for the same schedule occurrence.
-- - Lecturers must be able to soft-delete draft scheduled sessions/series they own.

DROP INDEX IF EXISTS public.idx_session_claims_scheduled_session_unique;
CREATE UNIQUE INDEX idx_session_claims_scheduled_session_unique
  ON public.session_claims (tutor_id, source_scheduled_session_id)
  WHERE source_scheduled_session_id IS NOT NULL
    AND deleted_at IS NULL;

DROP POLICY IF EXISTS "scheduled_sessions_lecturer_all" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_lecturer_all" ON public.scheduled_sessions
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_lecturer_all" ON public.schedule_series;
CREATE POLICY "schedule_series_lecturer_all" ON public.schedule_series
  FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_lecturer_for_module(module_id)
  )
  WITH CHECK (
    public.is_lecturer_for_module(module_id)
    AND created_by = auth.uid()::uuid
  );

-- ========== 20260629150000_fix_admin_scheduled_sessions_rls.sql ==========

-- Fix admin soft-delete / restore on scheduled_sessions and schedule_series after tombstone RLS.

DROP POLICY IF EXISTS "scheduled_sessions_admin_update" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_update" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_soft_delete" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_soft_delete" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_restore_row" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_restore_row" ON public.scheduled_sessions
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NOT NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "scheduled_sessions_admin_insert" ON public.scheduled_sessions;
CREATE POLICY "scheduled_sessions_admin_insert" ON public.scheduled_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_admin_update" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_update" ON public.schedule_series
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );

DROP POLICY IF EXISTS "schedule_series_admin_soft_delete" ON public.schedule_series;
CREATE POLICY "schedule_series_admin_soft_delete" ON public.schedule_series
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND public.auth_user_is_admin()
    AND public.is_module_in_auth_institution(module_id)
  );
