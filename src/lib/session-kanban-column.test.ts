import { addDays, format, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  sessionBoundsLocal,
  sessionKanbanColumn,
  schedulingDateForColumn,
} from "#/lib/session-kanban-column";

describe("sessionKanbanColumn", () => {
  it("places DRAFT sessions on the calendar by date", () => {
    const now = new Date(2026, 4, 10, 15, 0, 0);
    expect(
      sessionKanbanColumn(now, "2026-05-20", "10:00:00", "11:00:00", "DRAFT"),
    ).toBe("upcoming");
  });

  it("prioritises claimsPending for submitted workflow statuses", () => {
    const now = new Date(2026, 4, 10, 15, 0, 0);
    expect(
      sessionKanbanColumn(
        now,
        "2026-05-20",
        "10:00:00",
        "11:00:00",
        "PENDING_VERIFICATION",
      ),
    ).toBe("claimsPending");
  });

  it("routes verified future sessions to upcoming", () => {
    const now = new Date(2026, 4, 10, 15, 0, 0);
    expect(
      sessionKanbanColumn(
        now,
        "2026-05-20",
        "10:00:00",
        "11:00:00",
        "VERIFIED",
      ),
    ).toBe("upcoming");
  });

  it("routes ended sessions to completed", () => {
    const now = new Date(2026, 4, 10, 15, 0, 0);
    expect(
      sessionKanbanColumn(
        now,
        "2026-05-10",
        "09:00:00",
        "10:00:00",
        "APPROVED",
      ),
    ).toBe("completed");
  });

  it("uses today lane for same-day in-progress APPROVED session", () => {
    const now = new Date(2026, 4, 10, 10, 30, 0);
    expect(
      sessionKanbanColumn(
        now,
        "2026-05-10",
        "10:00:00",
        "12:00:00",
        "APPROVED",
      ),
    ).toBe("today");
  });
});

describe("sessionBoundsLocal", () => {
  it("rolls end to next day when end clock is before start clock", () => {
    const { start, end } = sessionBoundsLocal(
      "2026-05-10",
      "22:00:00",
      "01:00:00",
    );
    expect(start.getDate()).toBe(10);
    expect(end.getDate()).toBe(11);
  });
});

describe("schedulingDateForColumn", () => {
  it("returns yyyy-MM-dd for each lane", () => {
    const now = new Date(2026, 5, 1, 12, 0, 0);
    expect(schedulingDateForColumn("today", now)).toBe(format(now, "yyyy-MM-dd"));
    expect(schedulingDateForColumn("upcoming", now)).toBe(
      format(addDays(now, 1), "yyyy-MM-dd"),
    );
    expect(schedulingDateForColumn("completed", now)).toBe(
      format(subDays(now, 1), "yyyy-MM-dd"),
    );
  });
});
