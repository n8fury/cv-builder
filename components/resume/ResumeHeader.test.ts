import { describe, expect, it } from "vitest";

import { contactLines } from "./ResumeHeader";

const header = {
  name: "Jordan A. Rivera",
  location: "Northside, Springfield, SP-1010",
  email: "jordan.rivera@example.com",
  phone: "+1-555-0142",
  linkedin: "linkedin.com/in/jordan-rivera",
  github: "github.com/jordan-rivera-demo",
};

describe("contactLines", () => {
  it("puts email, linkedin and github on one line in minimal mode (§5.1)", () => {
    expect(contactLines(header, "minimal")).toEqual([
      "jordan.rivera@example.com | linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo",
    ]);
  });

  it("splits location/email/phone from linkedin/github in full mode (§5.1)", () => {
    expect(contactLines(header, "full")).toEqual([
      "Northside, Springfield, SP-1010 | jordan.rivera@example.com | +1-555-0142",
      "linkedin.com/in/jordan-rivera | github.com/jordan-rivera-demo",
    ]);
  });

  it("drops an empty field instead of leaving a stranded separator", () => {
    expect(contactLines({ ...header, phone: "" }, "full")[0]).toBe(
      "Northside, Springfield, SP-1010 | jordan.rivera@example.com",
    );
  });

  it("emits no line at all when every field on it is empty", () => {
    expect(contactLines({ ...header, linkedin: "", github: "" }, "full")).toHaveLength(1);
  });
});
