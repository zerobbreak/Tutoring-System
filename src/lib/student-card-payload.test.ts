import { describe, expect, it } from "vitest";
import { parseStudentCardPayload } from "#/lib/student-card-payload";

describe("parseStudentCardPayload", () => {
  it("parses JSON with ref and name", () => {
    const result = parseStudentCardPayload(
      '{"ref":"S123","name":"Jane Doe","email":"j@u.edu"}',
    );
    expect(result.studentReference).toBe("S123");
    expect(result.fullName).toBe("Jane Doe");
    expect(result.email).toBe("j@u.edu");
  });

  it("treats plain text as student reference", () => {
    const result = parseStudentCardPayload("  STU999  ");
    expect(result.studentReference).toBe("STU999");
    expect(result.fullName).toBeNull();
  });

  it("parses labeled text from a card", () => {
    const result = parseStudentCardPayload(
      "Name: Jane Doe\nStudent ID: STU999\nEmail: jane@example.com",
    );
    expect(result.studentReference).toBe("STU999");
    expect(result.fullName).toBe("Jane Doe");
    expect(result.email).toBe("jane@example.com");
  });

  it("parses multi-line card text when reference appears on its own line", () => {
    const result = parseStudentCardPayload("Jane Doe\nSTU999");
    expect(result.studentReference).toBe("STU999");
    expect(result.fullName).toBe("Jane Doe");
  });

  it("parses semicolon-delimited card text", () => {
    const result = parseStudentCardPayload("ST10377293;0303075231082");
    expect(result.studentReference).toBe("ST10377293");
    expect(result.fullName).toBeNull();
  });

  it("rejects empty input", () => {
    expect(() => parseStudentCardPayload("   ")).toThrow(/empty/i);
  });
});
