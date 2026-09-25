import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useScrolledPast } from "../../hooks/useScrolledPast";

// Applied to <html> only while on the home route, where the header is fixed
// and can otherwise obscure a scrolled-to or focused element's top edge.
const HOME_SCROLL_PADDING_CLASS = "home-scroll-padding";

export function PageShell({ children }: { children: ReactNode }) {
  const isHome = useLocation().pathname === "/";
  // HeroPour renders a #hero-end sentinel right after the hero; once it has
  // scrolled past the viewport top the home header switches from overlay to
  // solid. PageShell mounts once for the whole session (it wraps <Routes> in
  // App), so this must re-subscribe whenever `isHome` changes — otherwise the
  // observer keeps watching a detached sentinel after navigating away from
  // and back to "/". Passing `isHome` as `enabled` also resets the state to
  // false while off the home route.
  const scrolledPast = useScrolledPast("hero-end", isHome);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(HOME_SCROLL_PADDING_CLASS, isHome);
    return () => root.classList.remove(HOME_SCROLL_PADDING_CLASS);
  }, [isHome]);

  return (
    <div className="relative min-h-screen flex flex-col bg-surface text-ink">
      {isHome && (
        <a
          href="#all-features"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded focus:bg-cellar-bg focus:px-4 focus:py-2 focus:text-cellar-ink"
        >
          Skip to all features
        </a>
      )}
      <Header overlay={isHome && !scrolledPast} fixed={isHome} />
      <main className={isHome ? "flex-1 w-full" : "flex-1 max-w-6xl w-full mx-auto px-4 py-8"}>{children}</main>
      <Footer />
    </div>
  );
}
