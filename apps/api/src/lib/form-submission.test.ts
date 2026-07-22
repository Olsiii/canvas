import type { FormField } from "@canvas/shared";
import { describe, expect, it } from "vitest";
import { buildTaskFromSubmission, validateFormSubmission } from "./form-submission";

const fields: FormField[] = [
  { id: "title", label: "Title", type: "short_text", required: true },
  { id: "details", label: "Details", type: "long_text", required: false },
  { id: "urgency", label: "Urgency", type: "select", required: true, options: ["Low", "High"] },
];

describe("validateFormSubmission", () => {
  it("passes when every required field is filled and the select value is valid", () => {
    expect(validateFormSubmission(fields, { title: "Fix the leak", urgency: "High" })).toEqual([]);
  });

  it("reports a missing required field", () => {
    expect(validateFormSubmission(fields, { urgency: "High" })).toEqual(['"Title" is required']);
  });

  it("treats a whitespace-only value as missing", () => {
    expect(validateFormSubmission(fields, { title: "   ", urgency: "High" })).toEqual([
      '"Title" is required',
    ]);
  });

  it("rejects a select value outside its options", () => {
    expect(validateFormSubmission(fields, { title: "Fix it", urgency: "Immediately" })).toEqual([
      '"Urgency" must be one of the offered options',
    ]);
  });

  it("doesn't require an unset optional field", () => {
    expect(validateFormSubmission(fields, { title: "Fix it", urgency: "Low" })).toEqual([]);
  });
});

describe("buildTaskFromSubmission", () => {
  it("maps the title field straight to the task title", () => {
    const result = buildTaskFromSubmission(fields, { title: "Fix the leak", urgency: "High" });
    expect(result.title).toBe("Fix the leak");
  });

  it("renders every other answered field as a TipTap paragraph", () => {
    const result = buildTaskFromSubmission(fields, {
      title: "Fix the leak",
      details: "Under the sink",
      urgency: "High",
    });
    expect(result.descriptionJson).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Details: Under the sink" }] },
        { type: "paragraph", content: [{ type: "text", text: "Urgency: High" }] },
      ],
    });
  });

  it("omits unanswered optional fields from the description", () => {
    const result = buildTaskFromSubmission(fields, { title: "Fix the leak", urgency: "Low" });
    expect(result.descriptionJson).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Urgency: Low" }] }],
    });
  });
});
