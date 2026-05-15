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
