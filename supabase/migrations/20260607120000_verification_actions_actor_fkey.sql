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
