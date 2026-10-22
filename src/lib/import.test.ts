import { describe, expect, it } from "vitest";
import { CASE_IMPORT_FIELDS, mergeMissing, normalizeArabic, parseDate, planCaseImport, resolveProjectName, suggestMapping } from "./import";

describe("suggestMapping", () => {
  it("maps legacy headers despite spelling differences", () => {
    const m = suggestMapping(["الاسم", "الرقم القومى", "المحافظه", "عدد افراد الأسرة", "عمود غريب"], CASE_IMPORT_FIELDS);
    expect(m).toEqual({ "الاسم": "headName", "الرقم القومى": "headNid", "المحافظه": "governorate", "عدد افراد الأسرة": "familySize", "عمود غريب": null });
  });
  it("normalizes arabic", () => {
    expect(normalizeArabic("إطعام  عرفة")).toBe(normalizeArabic("اطعام عرفه"));
  });
});

describe("parseDate", () => {
  it("handles excel serials and d/m/y", () => {
    expect(parseDate(45658)).toBe("2025-01-01");
    expect(parseDate("15/3/2024")).toBe("2024-03-15");
    expect(parseDate("2024-03-15")).toBe("2024-03-15");
    expect(parseDate("١٥/٣/٢٠٢٤")).toBe("2024-03-15");
  });
});

describe("planCaseImport", () => {
  const mapping = { "الاسم": "headName", "الرقم القومي": "headNid", "التليفون": "phone", "القرية": "village" };
  it("creates, merges duplicates, and keeps incomplete rows", () => {
    const rows = [
      { "الاسم": "أحمد", "الرقم القومي": "28801151203451", "التليفون": "1012345678" },
      { "الاسم": "أحمد", "الرقم القومي": "28801151203451", "القرية": "ميت حبيش" },
      { "الاسم": "سعاد" },
      { "الاسم": "قديم", "الرقم القومي": "29103221203119" },
      {},
      { "الرقم القومي": "123" },
    ];
    const plan = planCaseImport(rows, mapping, new Set(["29103221203119"]));
    expect(plan.creates).toHaveLength(3);
    expect(plan.creates[0].values).toMatchObject({ headName: "أحمد", phone: "01012345678", village: "ميت حبيش" });
    expect(plan.merges).toHaveLength(1);
    expect(plan.skipped).toBe(1);
    expect(plan.issues.map((i) => i.row)).toEqual([3, 7, 7]);
  });
  it("mergeMissing only fills blanks", () => {
    expect(mergeMissing({ a: "1", b: "" }, { a: "2", b: "3", c: "4" })).toEqual({ a: "1", b: "3", c: "4" });
  });
});

describe("resolveProjectName", () => {
  it("resolves aliases", () => {
    expect(resolveProjectName("كن لهم عونناً", [{ name: "كن لهم عوناً", aliases: ["كن لهم عونناً"] }])).toBe("كن لهم عوناً");
  });
});
