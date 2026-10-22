// Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set at build time (frontend/.env.production).
const MEASUREMENT_ID: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID || undefined;
const GTAG_URL_PREFIX = "https://www.googletagmanager.com/gtag/js?id=";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// The few Trusted Types shapes used here (TypeScript's DOM lib in this project doesn't ship them)
type TrustedScriptURL = { readonly __trustedScriptURL: unique symbol };
interface ScriptURLPolicy {
  createScriptURL(input: string): TrustedScriptURL;
}
interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL(input: string): string }): ScriptURLPolicy;
}

let gaPolicy: ScriptURLPolicy | undefined;

// The production CSP requires Trusted Types, so a script URL has to come from a named policy
// (listed in the CSP's `trusted-types`). This one only lets the gtag loader through.
export function trustedGtagURL(url: string): TrustedScriptURL | string {
  if (!url.startsWith(GTAG_URL_PREFIX)) throw new TypeError(`Refusing script URL: ${url}`);
  const tt = (window as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
  if (!tt) return url;
  gaPolicy ??= tt.createPolicy("google-analytics", {
    createScriptURL: (input: string) => {
      if (!input.startsWith(GTAG_URL_PREFIX)) throw new TypeError(`Refusing script URL: ${input}`);
      return input;
    },
  });
  return gaPolicy.createScriptURL(url);
}

export function initAnalytics(measurementId: string | undefined = MEASUREMENT_ID): void {
  if (!measurementId || window.gtag) return;

  const dataLayer = (window.dataLayer ??= []);
  const gtag: (...args: unknown[]) => void = function gtag() {
    // gtag.js expects the real `arguments` object, not an array
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  window.gtag = gtag;
  gtag("js", new Date());
  // Page views are sent per route by trackPageview, not automatically on load
  gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  (script as unknown as { src: TrustedScriptURL | string }).src = trustedGtagURL(`${GTAG_URL_PREFIX}${measurementId}`);
  document.head.appendChild(script);
}

export type EventParams = Record<string, string | number>;

// A custom GA event (search, add_to_compare, ...). window.gtag only exists once initAnalytics
// has run with a measurement id, so this does nothing in development or tests.
export function trackEvent(name: string, params: EventParams = {}): void {
  window.gtag?.("event", name, params);
}

/** A multi-choice answer as one event value: "red,white", or "any" when nothing was picked. */
export function eventList(value: string | string[] | undefined): string {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return values.length > 0 ? values.join(",") : "any";
}

/** Only the price bounds that were set, so an open budget sends neither. */
export function priceParams(prices: { min_price?: number; max_price?: number }): EventParams {
  const params: EventParams = {};
  if (prices.min_price !== undefined) params.min_price = prices.min_price;
  if (prices.max_price !== undefined) params.max_price = prices.max_price;
  return params;
}

export function trackPageview(path: string, measurementId: string | undefined = MEASUREMENT_ID): void {
  if (!measurementId || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  });
}
