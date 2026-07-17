import { describe, expect, it } from "vitest";
import { validateCustomFieldOptions, validateCustomFieldValue } from "./custom-field-value";

describe("validateCustomFieldValue", () => {
  it("accepts text values, rejects non-strings", () => {
    expect(validateCustomFieldValue("text", "hello", null)).toBeNull();
    expect(validateCustomFieldValue("text", 5, null)).toMatch(/must be text/);
  });

  it("accepts finite numbers for number and currency, rejects the rest", () => {
    expect(validateCustomFieldValue("number", 42, null)).toBeNull();
    expect(validateCustomFieldValue("currency", 19.99, null)).toBeNull();
    expect(validateCustomFieldValue("number", "42", null)).toMatch(/must be a number/);
    expect(validateCustomFieldValue("number", Number.NaN, null)).toMatch(/must be a number/);
  });

  it("accepts booleans for checkbox, rejects the rest", () => {
    expect(validateCustomFieldValue("checkbox", true, null)).toBeNull();
    expect(validateCustomFieldValue("checkbox", "true", null)).toMatch(/true or false/);
  });

  it("accepts YYYY-MM-DD strings for date, rejects other formats", () => {
    expect(validateCustomFieldValue("date", "2026-07-17", null)).toBeNull();
    expect(validateCustomFieldValue("date", "07/17/2026", null)).toMatch(/must be a date/);
  });

  it("accepts valid URLs for url and image, rejects invalid ones", () => {
    expect(validateCustomFieldValue("url", "https://example.com", null)).toBeNull();
    expect(validateCustomFieldValue("image", "https://example.com/pic.png", null)).toBeNull();
    expect(validateCustomFieldValue("url", "not a url", null)).toMatch(/valid URL/);
  });

  it("accepts a dropdown value only if it's one of the configured options", () => {
    const options = { options: ["low", "medium", "high"] };
    expect(validateCustomFieldValue("dropdown", "medium", options)).toBeNull();
    expect(validateCustomFieldValue("dropdown", "extreme", options)).toMatch(/must be one of/);
  });

  it("accepts a label value only if every entry is a configured option", () => {
    const options = { options: ["bug", "feature", "chore"] };
    expect(validateCustomFieldValue("label", ["bug", "chore"], options)).toBeNull();
    expect(validateCustomFieldValue("label", ["bug", "nope"], options)).toMatch(/must be an array/);
    expect(validateCustomFieldValue("label", "bug", options)).toMatch(/must be an array/);
  });
});

describe("validateCustomFieldOptions", () => {
  it("requires at least one option for dropdown and label", () => {
    expect(validateCustomFieldOptions("dropdown", { options: [] })).toMatch(/at least one option/);
    expect(validateCustomFieldOptions("dropdown", { options: ["a"] })).toBeNull();
    expect(validateCustomFieldOptions("label", null)).toMatch(/at least one option/);
  });

  it("doesn't require options for other types", () => {
    expect(validateCustomFieldOptions("text", null)).toBeNull();
    expect(validateCustomFieldOptions("checkbox", undefined)).toBeNull();
  });
});
