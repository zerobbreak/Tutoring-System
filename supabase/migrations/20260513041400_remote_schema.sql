


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



































