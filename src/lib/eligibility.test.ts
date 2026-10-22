import { describe, expect, it } from "vitest";
import { computePriority, evaluateEligibility } from "./eligibility";

describe("computePriority", () => {
  it("widow with no income and big family is high", () => {
    const p = computePriority({ maritalStatus: "أرملة", incomeType: "لا يوجد", healthStatus: "سليمة", familySize: 6, roofType: "خرسانة" });
    expect(p.level).toBe("high");
    expect(p.reasons).toContain("أرملة");
  });
  it("marital stage outranks later stages", () => {
    const widow = computePriority({ maritalStatus: "أرملة", incomeType: "موظف" });
    const married = computePriority({ maritalStatus: "متزوجة", incomeType: "لا يوجد", healthStatus: "أمراض مزمنة", familySize: 8, roofType: "بوص" });
    expect(widow.score).toBeGreaterThan(married.score);
  });
  it("stable family is low", () => {
    expect(computePriority({ maritalStatus: "متزوجة", incomeType: "موظف", familySize: 3, totalIncome: 5000, totalExpenses: 3000 }).level).toBe("low");
  });
});

describe("evaluateEligibility", () => {
  const base = { guideApproved: "نعم", explorerApproved: "نعم", governorate: "الجيزة", incomeType: "يوميات", totalIncome: 2000, totalExpenses: 2500 };

  it("seasonal: eligible when fixed criteria pass", () => {
    expect(evaluateEligibility("seasonal", base).verdict).toBe("eligible");
  });
  it("seasonal: recent benefit excludes", () => {
    const r = evaluateEligibility("seasonal", base, { lastBenefitDate: "2026-09-01", minDaysBetweenBenefits: 180, today: new Date("2026-10-22") });
    expect(r.verdict).toBe("not_eligible");
  });
  it("seasonal: outside direct scope fails", () => {
    expect(evaluateEligibility("seasonal", { ...base, governorate: "المنيا" }).verdict).toBe("not_eligible");
  });
  it("zilal: property dispute excludes, missing data is incomplete", () => {
    const z = { ...base, roofNeed: "نعم تستدعي", permanentResidence: "نعم", governmentApproval: "نعم", needsFullRebuild: "لا", propertyDispute: "لا" };
    expect(evaluateEligibility("zilal", z).verdict).toBe("eligible");
    expect(evaluateEligibility("zilal", { ...z, propertyDispute: "نعم" }).verdict).toBe("not_eligible");
    expect(evaluateEligibility("zilal", { ...z, governmentApproval: undefined }).verdict).toBe("incomplete");
  });
  it("irtiwa: official connection excludes", () => {
    expect(evaluateEligibility("irtiwa", { ...base, waterConnection: "رسمية", permanentResidence: "نعم", propertyDispute: "لا" }).verdict).toBe("not_eligible");
  });
  it("shifa surgery needs medical report", () => {
    const s = { ...base, headNid: "1", village: "x", operationType: "عملية مياه بيضاء", medicalContraindication: "لا", hasHealthInsurance: "لا" };
    expect(evaluateEligibility("shifa", s).verdict).toBe("incomplete");
    expect(evaluateEligibility("shifa", { ...s, hasMedicalReport: "نعم" }).verdict).toBe("eligible");
  });
});
