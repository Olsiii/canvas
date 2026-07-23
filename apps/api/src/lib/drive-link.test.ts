import { describe, expect, it } from "vitest";
import { parseDriveLink } from "./drive-link";

describe("parseDriveLink", () => {
  it("parses a standard file share link", () => {
    expect(parseDriveLink("https://drive.google.com/file/d/1AbC-XyZ/view?usp=sharing")).toEqual({
      fileId: "1AbC-XyZ",
      canonicalUrl: "https://drive.google.com/file/d/1AbC-XyZ/view",
    });
  });

  it("parses an open?id= link", () => {
    expect(parseDriveLink("https://drive.google.com/open?id=1AbC-XyZ")).toEqual({
      fileId: "1AbC-XyZ",
      canonicalUrl: "https://drive.google.com/file/d/1AbC-XyZ/view",
    });
  });

  it("throws for a non-Drive URL", () => {
    expect(() => parseDriveLink("https://dropbox.com/s/abc123")).toThrow();
  });
});
