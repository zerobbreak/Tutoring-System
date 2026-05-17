-- Learners are not registered users; admin session monitoring reads attendance rows
-- via session_attendance_admin_select without joining a students roster table.

DROP POLICY IF EXISTS "students_admin_select" ON public.students;
