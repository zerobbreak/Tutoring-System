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
