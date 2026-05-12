import { describe, expect, it } from "vitest";
import {
  detectHeaderRow,
  isTutorialTimetableEvent,
  mergeScheduleParseResults,
  parseScheduleFromMatrix,
} from "./schedule-spreadsheet";

describe("detectHeaderRow", () => {
  it("finds start/end/title row", () => {
    const matrix = [
      ["Title", "Start", "End", "Room"],
      ["Lecture", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "LR 10"],
    ];
    const d = detectHeaderRow(matrix);
    expect(d).not.toBeNull();
    expect(d!.rowIndex).toBe(0);
    expect(d!.columns.start).toBe(1);
    expect(d!.columns.end).toBe(2);
    expect(d!.columns.title).toBe(0);
    expect(d!.columns.location).toBe(3);
  });

  it("finds date + start + end", () => {
    const matrix = [
      ["Date", "Start", "End", "Module"],
      ["2026-02-16", "08:00", "09:00", "INSY6211"],
    ];
    const d = detectHeaderRow(matrix);
    expect(d).not.toBeNull();
    expect(d!.columns.date).toBe(0);
    expect(d!.columns.start).toBe(1);
    expect(d!.columns.end).toBe(2);
  });

  it("maps Type column to sessionType", () => {
    const matrix = [
      ["Title", "Start", "End", "Type"],
      ["Lab", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "Lab"],
    ];
    const d = detectHeaderRow(matrix);
    expect(d?.columns.sessionType).toBe(3);
  });
});

describe("parseScheduleFromMatrix", () => {
  it("parses full datetime rows", () => {
    const matrix = [
      ["Title", "Start", "End", "Room"],
      ["A", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "LR 10"],
      ["B", "2026-02-17T10:00:00", "2026-02-17T11:30:00", ""],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events).toHaveLength(2);
    expect(r.events[0].title).toBe("A");
    expect(r.events[0].location).toBe("LR 10");
    expect(r.events[1].title).toBe("B");
    expect(r.rowIssues).toHaveLength(0);
  });

  it("parses date + time rows", () => {
    const matrix = [
      ["Date", "Start", "End", "Title"],
      ["2026-02-16", "08H00", "09H50", "Block"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].title).toBe("Block");
    expect(r.events[0].start).toMatch(/^2026-02-16T08:00:00/);
    expect(r.events[0].end).toMatch(/^2026-02-16T09:50:00/);
  });

  it("extracts module code from title", () => {
    const matrix = [
      ["Start", "End", "Title"],
      ["2026-02-16T08:00:00", "2026-02-16T09:00:00", "INSY6211 LR 10"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events[0].moduleCode).toBe("INSY6211");
  });

  it("records row issues for invalid range", () => {
    const matrix = [
      ["Start", "End"],
      ["2026-02-16T10:00:00", "2026-02-16T09:00:00"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events).toHaveLength(0);
    expect(r.rowIssues.length).toBeGreaterThan(0);
  });

  it("reads optional Type column into sessionType", () => {
    const matrix = [
      ["Title", "Start", "End", "Type"],
      ["Lecture", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "Lecture"],
      ["Tutor block", "2026-02-16T10:00:00", "2026-02-16T11:00:00", "Tutorial"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events[0].sessionType).toBe("Lecture");
    expect(r.events[1].sessionType).toBe("Tutorial");
  });
});

describe("isTutorialTimetableEvent", () => {
  it("matches tutor session in title", () => {
    expect(
      isTutorialTimetableEvent({
        start: "2026-02-16T08:00:00",
        end: "2026-02-16T09:00:00",
        title: "PROG6221 CR 1_Tutor session",
      }),
    ).toBe(true);
  });

  it("rejects plain lectures", () => {
    expect(
      isTutorialTimetableEvent({
        start: "2026-02-16T08:00:00",
        end: "2026-02-16T09:00:00",
        title: "INSY6211 LR 10",
        moduleCode: "INSY6211",
      }),
    ).toBe(false);
  });

  it("respects Type column for lecture vs tutorial", () => {
    expect(
      isTutorialTimetableEvent({
        start: "2026-02-16T08:00:00",
        end: "2026-02-16T09:00:00",
        title: "Some module",
        sessionType: "Lecture",
      }),
    ).toBe(false);
    expect(
      isTutorialTimetableEvent({
        start: "2026-02-16T08:00:00",
        end: "2026-02-16T09:00:00",
        title: "Some module",
        sessionType: "Tutor session",
      }),
    ).toBe(true);
  });

  it("rejects meridian hour", () => {
    expect(
      isTutorialTimetableEvent({
        start: "2026-02-16T12:00:00",
        end: "2026-02-16T12:50:00",
        title: "Meridian Hour",
      }),
    ).toBe(false);
  });
});

describe("mergeScheduleParseResults", () => {
  it("concatenates events and issues", () => {
    const a = parseScheduleFromMatrix(
      [
        ["Start", "End"],
        ["2026-02-16T08:00:00", "2026-02-16T09:00:00"],
      ],
      { sheetName: "One" },
    );
    const b = parseScheduleFromMatrix(
      [
        ["Start", "End"],
        ["2026-02-17T08:00:00", "2026-02-17T09:00:00"],
      ],
      { sheetName: "Two" },
    );
    const m = mergeScheduleParseResults([a, b]);
    expect(m.events).toHaveLength(2);
    expect(m.events[0].sourceSheet).toBe("One");
    expect(m.events[1].sourceSheet).toBe("Two");
  });
});
