import { NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

export function Header({ overlay = false }: { overlay?: boolean }) {
  // Overlay mode sits on the home page's always-dark hero, so it uses the
  // theme-independent cellar colors instead of the theme's ink.
  const headerClass = overlay ? "absolute inset-x-0 top-0 z-20" : "border-b border-surface-border";
  const brandClass = overlay ? "text-cellar-ink" : "text-ink";
  const idleLinkClass = overlay ? "text-cellar-muted hover:text-cellar-ink" : "text-ink-muted hover:text-ink";

  return (
    <header className={headerClass}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <NavLink to="/" className={`font-serif text-lg tracking-wide ${brandClass}`}>
          VinoScope
        </NavLink>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-accent" : idleLinkClass)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <NavLink
            to="/admin"
            className={({ isActive }) => `text-sm ${isActive ? "text-accent" : idleLinkClass}`}
          >
            Admin
          </NavLink>
        </div>
      </div>
    </header>
  );
}
