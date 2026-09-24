import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatApproxUsd,
  hasApproxUsdConversion,
  formatVintage,
  primaryGrapeLabel,
  formatGrapeBreakdown,
} from "./format";

describe("formatPrice", () => {
  it("formats USD with a dollar sign", () => {
    expect(formatPrice(79.99, "USD")).toBe("$79.99");
  });

  it("formats EUR with a euro sign", () => {
    expect(formatPrice(45, "EUR")).toBe("€45.00");
  });

  it("formats GBP with a pound sign", () => {
    expect(formatPrice(30, "GBP")).toBe("£30.00");
  });

  it("falls back to a code prefix for an unrecognized currency", () => {
    expect(formatPrice(100, "XYZ")).toBe("XYZ 100.00");
  });

  it("formats NZD with an NZ dollar sign", () => {
    expect(formatPrice(45, "NZD")).toBe("NZ$45.00");
  });

  it("defaults to a dollar sign when currency is null", () => {
    expect(formatPrice(20, null)).toBe("$20.00");
  });

  it("returns 'Price unavailable' when price is null", () => {
    expect(formatPrice(null, "USD")).toBe("Price unavailable");
  });
});

describe("formatApproxUsd", () => {
  it("formats an approximate USD value", () => {
    expect(formatApproxUsd(48.6)).toBe("≈ $48.60 USD");
  });

  it("returns an empty string when null", () => {
    expect(formatApproxUsd(null)).toBe("");
  });
});

describe("hasApproxUsdConversion", () => {
  it("is true for a recognized non-USD currency with a value", () => {
    expect(hasApproxUsdConversion("EUR", 48.6)).toBe(true);
  });

  it("is false for USD", () => {
    expect(hasApproxUsdConversion("USD", 50)).toBe(false);
  });

  it("is false for an unrecognized currency", () => {
    expect(hasApproxUsdConversion("XYZ", 50)).toBe(false);
  });

  it("is false when currency is null", () => {
    expect(hasApproxUsdConversion(null, 50)).toBe(false);
  });

  it("is false when price_usd_approx is null", () => {
    expect(hasApproxUsdConversion("EUR", null)).toBe(false);
  });

  it("is true for NZD with a value", () => {
    expect(hasApproxUsdConversion("NZD", 27.45)).toBe(true);
  });
});

describe("formatVintage", () => {
  it("returns NV for null", () => {
    expect(formatVintage(null)).toBe("NV");
  });

  it("returns the year as a string", () => {
    expect(formatVintage(2022)).toBe("2022");
  });
});

describe("primaryGrapeLabel", () => {
  it("returns 'Blend unknown' for no grapes", () => {
    expect(primaryGrapeLabel([])).toBe("Blend unknown");
  });

  it("returns the single grape's name", () => {
    expect(primaryGrapeLabel([{ name: "Chardonnay", percentage: null }])).toBe("Chardonnay");
  });

  it("returns 'Blend' for multiple grapes", () => {
    expect(
      primaryGrapeLabel([
        { name: "Cabernet Sauvignon", percentage: 60 },
        { name: "Merlot", percentage: 40 },
      ])
    ).toBe("Blend");
  });
});

describe("formatGrapeBreakdown", () => {
  it("returns 'Not specified' for an empty list", () => {
    expect(formatGrapeBreakdown([])).toBe("Not specified");
  });

  it("returns the bare name when percentage is null", () => {
    expect(formatGrapeBreakdown([{ name: "Chardonnay", percentage: null }])).toBe("Chardonnay");
  });

  it("includes the percentage in parentheses when present", () => {
    expect(formatGrapeBreakdown([{ name: "Chardonnay", percentage: 100 }])).toBe("Chardonnay (100%)");
  });

  it("joins a multi-grape blend with commas", () => {
    expect(
      formatGrapeBreakdown([
        { name: "Cabernet Sauvignon", percentage: 80 },
        { name: "Merlot", percentage: 20 },
      ])
    ).toBe("Cabernet Sauvignon (80%), Merlot (20%)");
  });
});
