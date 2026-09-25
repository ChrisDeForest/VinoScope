import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

const MOBILE_MENU_ID = "mobile-menu";

export function Header({ overlay = false, fixed = false }: { overlay?: boolean; fixed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The header only goes transparent-over-the-hero when it's both fixed (on
  // the home page), still positioned over the hero (not scrolled past), and
  // the mobile menu isn't open — an open panel over the hero has no backing
  // of its own, so it's treated like "scrolled past" and rendered solid.
  const isOverlay = fixed && overlay && !menuOpen;
  const headerClass = !fixed
    ? "border-b border-surface-border"
    : isOverlay
      ? "fixed inset-x-0 top-0 z-20 motion-safe:transition-colors"
      : "fixed inset-x-0 top-0 z-20 bg-surface backdrop-blur border-b border-surface-border motion-safe:transition-colors";
  const brandClass = isOverlay ? "text-cellar-ink motion-safe:transition-colors" : "text-ink motion-safe:transition-colors";
  const idleLinkClass = isOverlay
    ? "text-cellar-muted hover:text-cellar-ink motion-safe:transition-colors"
    : "text-ink-muted hover:text-ink motion-safe:transition-colors";
  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "text-accent" : idleLinkClass);
  const menuButtonRingClass = isOverlay ? "focus-visible:outline-cellar-ink" : "focus-visible:outline-accent";

  // Close on route change, wherever it came from (nav link, back/forward, etc).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close if the viewport crosses into the desktop layout while the panel is
  // open, so it can't be left open (and no longer toggleable, since the
  // trigger button is `md:hidden`) after a resize or orientation change.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 768px)");
    function handleChange(event: MediaQueryListEvent | { matches: boolean }) {
      if (event.matches) setMenuOpen(false);
    }
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Disclosure pattern: if focus was inside the panel, return it to the
      // toggle button instead of letting it fall back to <body>.
      const shouldRefocus = panelRef.current?.contains(document.activeElement) ?? false;
      setMenuOpen(false);
      if (shouldRefocus) buttonRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={headerClass}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/" className={`font-serif text-lg tracking-wide ${brandClass}`}>
          VinoScope
        </NavLink>

        <button
          ref={buttonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={MOBILE_MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
          className={`md:hidden inline-flex items-center justify-center rounded p-2 ${idleLinkClass} focus-visible:outline focus-visible:outline-2 ${menuButtonRingClass}`}
        >
          <span className="sr-only">Menu</span>
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="hidden md:flex items-center gap-4 flex-wrap">
          <nav className="flex items-center gap-4 text-sm flex-wrap">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeSwitcher variant={isOverlay ? "overlay" : "default"} />
            <NavLink to="/admin" className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}>
              Admin
            </NavLink>
          </div>
        </div>
      </div>

      <div ref={panelRef} id={MOBILE_MENU_ID} hidden={!menuOpen} className="md:hidden px-4 pb-4 bg-surface">
        <nav className="flex flex-col gap-3 text-sm">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} onClick={closeMenu} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 pt-3">
          <ThemeSwitcher variant={isOverlay ? "overlay" : "default"} />
          <NavLink
            to="/admin"
            onClick={closeMenu}
            className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}
          >
            Admin
          </NavLink>
        </div>
      </div>
    </header>
  );
}
