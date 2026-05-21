-- Schedule synchronization in-app notification types

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_TIME_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_VENUE_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_TUTOR_CHANGED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_CANCELLED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SESSION_RESTORED';
