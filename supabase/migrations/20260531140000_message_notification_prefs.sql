-- Message notification + dashboard message panel preferences

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notify_on_new_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dashboard_show_messages boolean NOT NULL DEFAULT true;
