import { describe, expect, it } from "vitest";
import {
  classifySessionTypeValue,
  detectHeaderRow,
  isTutorialTimetableEvent,
  mergeScheduleParseResults,
  normalizeScheduleTypeInput,
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

describe("normalizeScheduleTypeInput & classifySessionTypeValue", () => {
  it("normalizes casing and separators", () => {
    expect(normalizeScheduleTypeInput("  Tutor_Session  ")).toBe("tutor session");
  });

  it("classifies closed vocabulary and synonyms", () => {
    expect(classifySessionTypeValue("Tutorial")).toBe("tutorial");
    expect(classifySessionTypeValue("TUTOR SESSION")).toBe("tutorial");
    expect(classifySessionTypeValue("Lecture")).toBe("nontutorial");
    expect(classifySessionTypeValue("Lab")).toBe("nontutorial");
    expect(classifySessionTypeValue("Other")).toBe("nontutorial");
    expect(classifySessionTypeValue("Meridian Hour")).toBe("nontutorial");
    expect(classifySessionTypeValue("not-a-real-type")).toBe("unknown");
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
    expect(r.sessionTypeColumnPresent).toBe(false);
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
    expect(r.sessionTypeColumnPresent).toBe(false);
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

  it("reads Type column and sets sessionTypeColumnPresent", () => {
    const matrix = [
      ["Title", "Start", "End", "Type"],
      ["Lecture", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "Lecture"],
      ["Tutor block", "2026-02-16T10:00:00", "2026-02-16T11:00:00", "Tutorial"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.sessionTypeColumnPresent).toBe(true);
    expect(r.events[0].sessionType).toBe("Lecture");
    expect(r.events[1].sessionType).toBe("Tutorial");
  });

  it("warns on unrecognized Type when column exists", () => {
    const matrix = [
      ["Title", "Start", "End", "Type"],
      ["X", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "CustomLabel"],
    ];
    const r = parseScheduleFromMatrix(matrix);
    expect(r.events).toHaveLength(1);
    expect(r.rowIssues.some((i) => /unrecognized type/i.test(i.message))).toBe(true);
  });
});

describe("isTutorialTimetableEvent", () => {
  const base = {
    start: "2026-02-16T08:00:00",
    end: "2026-02-16T09:00:00",
    title: "X",
  };

  it("uses title heuristics when no Type column (second arg false)", () => {
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "PROG6221 CR 1_Tutor session",
        },
        false,
      ),
    ).toBe(true);
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "INSY6211 LR 10",
          moduleCode: "INSY6211",
        },
        false,
      ),
    ).toBe(false);
  });

  it("when Type column exists, non-empty Type is authoritative over title", () => {
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "PROG6221 CR 1_Tutor session",
          sessionType: "Lecture",
        },
        true,
      ),
    ).toBe(false);
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "Some boring title",
          sessionType: "Tutorial",
        },
        true,
      ),
    ).toBe(true);
  });

  it("when Type column exists but cell empty, uses title heuristics", () => {
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "PROG6221_Tutor session",
        },
        true,
      ),
    ).toBe(true);
  });

  it("unknown Type value is not treated as tutorial", () => {
    expect(
      isTutorialTimetableEvent(
        {
          ...base,
          title: "Anything",
          sessionType: "CustomLabel",
        },
        true,
      ),
    ).toBe(false);
  });

  it("rejects meridian hour via title heuristics", () => {
    expect(
      isTutorialTimetableEvent(
        {
          start: "2026-02-16T12:00:00",
          end: "2026-02-16T12:50:00",
          title: "Meridian Hour",
        },
        false,
      ),
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
    expect(m.sessionTypeColumnPresent).toBe(false);
  });

  it("sets sessionTypeColumnPresent true if any sheet has Type", () => {
    const withType = parseScheduleFromMatrix(
      [
        ["Title", "Start", "End", "Type"],
        ["A", "2026-02-16T08:00:00", "2026-02-16T09:00:00", "Lecture"],
      ],
      { sheetName: "S1" },
    );
    const noType = parseScheduleFromMatrix(
      [["Start", "End"], ["2026-02-17T08:00:00", "2026-02-17T09:00:00"]],
      { sheetName: "S2" },
    );
    const m = mergeScheduleParseResults([noType, withType]);
    expect(m.sessionTypeColumnPresent).toBe(true);
  });
});
