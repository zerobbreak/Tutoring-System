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
