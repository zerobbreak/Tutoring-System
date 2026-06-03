export type AdminVenueDTO = {
  id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  campusId: string | null;
  campusName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activeScheduleCount: number;
};

export type VenueScheduleDTO = {
  seriesId: string;
  title: string;
  moduleCode: string;
  tutorName: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  status: string;
};
