import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TEMPLATE, distributionLines, fillTemplate, mailtoUrl, parseEmails } from "./nomination";

describe("fillTemplate", () => {
  it("fills known vars and dashes the empty ones", () => {
    expect(fillTemplate("{المشروع} – {العدد} – {التاريخ}", { "المشروع": "اطعام عرفة", "العدد": 40 })).toBe("اطعام عرفة – 40 – —");
  });
  it("default template has no leftover braces", () => {
    expect(fillTemplate(DEFAULT_EMAIL_TEMPLATE.body, { "المشروع": "x" })).not.toMatch(/[{}]/);
  });
});

describe("distributionLines", () => {
  it("groups by governorate and markaz, biggest first", () => {
    const lines = distributionLines([
      { governorate: "الفيوم", markaz: "سنورس" },
      { governorate: "الجيزة", markaz: "أطفيح" },
      { governorate: "الجيزة", markaz: "أطفيح" },
      {},
    ]);
    expect(lines).toEqual(["• الجيزة – أطفيح: 2 حالات", "• الفيوم – سنورس: 1 حالة", "• مكان غير مسجل: 1 حالة"]);
  });
});

describe("parseEmails", () => {
  it("splits on commas, arabic commas and new lines, dedupes, flags bad ones", () => {
    expect(parseEmails("A@ghaith.org، b@ghaith.org\nا@x ; a@ghaith.org")).toEqual({ valid: ["a@ghaith.org", "b@ghaith.org"], invalid: ["ا@x"] });
  });
});

describe("mailtoUrl", () => {
  it("encodes arabic subject and cc", () => {
    const u = mailtoUrl(["a@x.org"], ["c@x.org"], "ترشيحات", "سطر\nسطر");
    expect(u.startsWith("mailto:a%40x.org?cc=c%40x.org&subject=")).toBe(true);
    expect(decodeURIComponent(u.split("body=")[1])).toBe("سطر\nسطر");
  });
});
