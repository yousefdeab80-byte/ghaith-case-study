import { describe, expect, it } from "vitest";
import { normalizeDigits, normalizePhone, parseNid, isValidPhone } from "./nid";

const today = new Date(Date.UTC(2026, 9, 22));

describe("parseNid", () => {
  it("reads birth date, governorate, gender", () => {
    const info = parseNid("28801151203451", today);
    expect(info).toMatchObject({ valid: true, birthDate: "1988-01-15", governorate: "الدقهلية", gender: "ذكر", age: 38 });
  });
  it("handles 2000s and Arabic digits", () => {
    const info = parseNid("٣٠١٠٢٠٣٢١٠١٢٢٥", today);
    expect(info).toMatchObject({ valid: true, birthDate: "2001-02-03", governorate: "الجيزة", gender: "أنثى" });
  });
  it("rejects wrong length and bad dates", () => {
    expect(parseNid("123", today).valid).toBe(false);
    expect(parseNid("28813151203451", today).valid).toBe(false);
    expect(parseNid("", today).error).toBe("فارغ");
  });
  it("strips excel decimals", () => {
    expect(normalizeDigits("28801151203451.0")).toBe("28801151203451");
  });
});

describe("phones", () => {
  it("normalizes and validates", () => {
    expect(normalizePhone("1012345678")).toBe("01012345678");
    expect(normalizePhone("+20 101 234 5678")).toBe("01012345678");
    expect(isValidPhone("01012345678")).toBe(true);
    expect(isValidPhone("0101234567")).toBe(false);
  });
});
