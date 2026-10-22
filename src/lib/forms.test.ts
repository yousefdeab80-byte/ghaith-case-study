import { describe, expect, it } from "vitest";
import { ALL_FIELDS, computeSum, FIELD_BY_KEY, sectionsFor } from "./forms";

describe("sectionsFor", () => {
  it("follows the paper order for each form", () => {
    expect(sectionsFor("general").map((s) => s.id)).toEqual(["personal", "family", "economic", "expenses", "property", "initiatives", "opinion", "extra"]);
    expect(sectionsFor("shifa").map((s) => s.id)).toEqual(["personal", "family", "economic", "expenses", "property", "shifa", "opinion", "extra"]);
    expect(sectionsFor("zilal").map((s) => s.id)).toEqual(["personal", "family", "economic", "expenses", "property", "houseDescription", "initiatives", "opinion", "extra"]);
  });
  it("shows each field once per form", () => {
    for (const form of ["general", "shifa", "zilal"]) {
      const keys = sectionsFor(form).flatMap((s) => s.fields.map((f) => f.key));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it("keeps water need for initiatives only and recommendations off the shifa form", () => {
    const keys = (form: string) => sectionsFor(form).flatMap((s) => s.fields.map((f) => f.key));
    expect(keys("general")).toContain("waterNeed");
    expect(keys("zilal")).not.toContain("waterNeed");
    expect(keys("shifa")).not.toContain("recommendations");
  });
  it("lists every key once overall", () => {
    expect(new Set(ALL_FIELDS.map((f) => f.key)).size).toBe(ALL_FIELDS.length);
  });
});

describe("computeSum", () => {
  it("adds monthly expenses and obligations", () => {
    expect(computeSum(FIELD_BY_KEY.totalExpenses, { rent: "300", utilities: "١٥٠", debt: 50 })).toBe(500);
  });
  it("turns the daily wage into a monthly figure", () => {
    expect(computeSum(FIELD_BY_KEY.totalIncome, { dailyWage: "100", workDays: "5", otherSourcesAmount: "700" })).toBe(2700);
  });
  it("returns null when nothing is filled", () => {
    expect(computeSum(FIELD_BY_KEY.totalExpenses, {})).toBeNull();
  });
});
