import { describe, it, expect, afterEach, vi } from "vitest";
import { initAnalytics, trackEvent, trackPageview, trustedGtagURL } from "./analytics";

const ID = "G-TEST123";

function gtagScripts() {
  return Array.from(document.head.querySelectorAll("script")).filter((script) =>
    script.src.startsWith("https://www.googletagmanager.com/gtag/js")
  );
}

afterEach(() => {
  gtagScripts().forEach((script) => script.remove());
  delete (window as Partial<Window>).gtag;
  delete (window as Partial<Window>).dataLayer;
});

describe("initAnalytics", () => {
  it("does nothing without a measurement id", () => {
    initAnalytics(undefined);
    expect(window.gtag).toBeUndefined();
    expect(gtagScripts()).toHaveLength(0);
  });

  it("loads gtag once and turns off its automatic page view", () => {
    initAnalytics(ID);
    initAnalytics(ID);
    expect(gtagScripts().map((script) => script.src)).toEqual([`https://www.googletagmanager.com/gtag/js?id=${ID}`]);
    expect(gtagScripts()[0].async).toBe(true);
    const calls = (window.dataLayer ?? []).map((args) => Array.from(args as ArrayLike<unknown>));
    expect(calls).toContainEqual(["config", ID, { send_page_view: false }]);
  });
});

describe("trackPageview", () => {
  it("sends a page_view with the full location", () => {
    initAnalytics(ID);
    trackPageview("/explore?q=malbec", ID);
    const dataLayer = window.dataLayer ?? [];
    const last = Array.from(dataLayer[dataLayer.length - 1] as ArrayLike<unknown>);
    expect(last).toEqual([
      "event",
      "page_view",
      { page_location: `${window.location.origin}/explore?q=malbec`, page_title: document.title },
    ]);
  });

  it("is a no-op before gtag is loaded or without an id", () => {
    expect(() => trackPageview("/", ID)).not.toThrow();
    initAnalytics(ID);
    const before = window.dataLayer?.length ?? 0;
    trackPageview("/", undefined);
    expect(window.dataLayer).toHaveLength(before);
  });
});

describe("trackEvent", () => {
  it("sends a named event with its parameters once gtag is loaded", () => {
    initAnalytics(ID);
    trackEvent("add_to_compare", { wine_id: 7 });
    const dataLayer = window.dataLayer ?? [];
    expect(Array.from(dataLayer[dataLayer.length - 1] as ArrayLike<unknown>)).toEqual(["event", "add_to_compare", { wine_id: 7 }]);
  });

  it("is a no-op when analytics is off", () => {
    expect(() => trackEvent("theme_change", { theme: "charcoal-gold" })).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("trustedGtagURL", () => {
  it("accepts the gtag loader URL", () => {
    expect(String(trustedGtagURL(`https://www.googletagmanager.com/gtag/js?id=${ID}`))).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${ID}`
    );
  });

  it("refuses any other script URL", () => {
    expect(() => trustedGtagURL("https://evil.example/gtag/js?id=x")).toThrow(TypeError);
    expect(() => trustedGtagURL("https://www.googletagmanager.com/other.js")).toThrow(TypeError);
  });

  it("goes through a Trusted Types policy when the browser has them", () => {
    const createScriptURL = vi.fn((url: string) => url);
    const createPolicy = vi.fn((_name: string, rules: { createScriptURL: (url: string) => string }) => ({
      createScriptURL: (url: string) => createScriptURL(rules.createScriptURL(url)),
    }));
    vi.stubGlobal("trustedTypes", { createPolicy });
    try {
      trustedGtagURL(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
      expect(createPolicy).toHaveBeenCalledWith("google-analytics", expect.anything());
      expect(createScriptURL).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
