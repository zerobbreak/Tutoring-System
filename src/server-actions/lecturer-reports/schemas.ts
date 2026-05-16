import { z } from "zod";

export const reportTypeSchema = z.enum([
  "attendance_module",
  "attendance_tutor",
  "attendance_student_participation",
  "claims_approved_hours",
  "claims_disputed",
  "claims_pending",
  "tutor_workload",
  "tutor_performance",
  "tutor_attendance_impact",
]);

export const reportFiltersSchema = z.object({
  reportType: reportTypeSchema,
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moduleId: z.string().uuid().optional(),
  tutorId: z.string().uuid().optional(),
});
