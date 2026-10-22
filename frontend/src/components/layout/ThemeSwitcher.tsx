import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { getStoredTheme, setStoredTheme, THEME_OPTIONS, type Theme, type ThemeSwatch } from "../../theme/useTheme";

// cellar-muted is a CSS-variable hex color, so Tailwind's /opacity modifier
// can't apply to it directly, and browsers without color-mix (Safari < 16.2,
// Chrome < 111) would otherwise drop the border color declaration entirely.
// Using the plain color outright sidesteps both problems; full opacity vs.
// the originally intended 40% is a negligible visual difference here.
const OVERLAY_BORDER = "border-cellar-muted";

/** Overlapping dots in a theme's own colors; the background dot gets a ring so it shows on any surface. */
function SwatchDots({ swatch, dots, size }: { swatch: ThemeSwatch; dots: (keyof ThemeSwatch)[]; size: number }) {
  return (
    <span aria-hidden="true" className="flex shrink-0">
      {dots.map((dot, index) => (
        <span
          key={dot}
          className="rounded-full border"
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -size / 3,
            backgroundColor: swatch[dot],
            borderColor: index === 0 ? swatch.muted : swatch.surface,
          }}
        />
      ))}
    </span>
  );
}

export function ThemeSwitcher({ variant = "default" }: { variant?: "default" | "overlay" }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const listId = `${id}-themes`;
  const optionId = (index: number) => `${id}-theme-${index}`;
  const current = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openList() {
    setActive(Math.max(0, THEME_OPTIONS.findIndex((option) => option.value === theme)));
    setOpen(true);
  }

  function choose(next: Theme) {
    setStoredTheme(next);
    setTheme(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    const last = THEME_OPTIONS.length - 1;
    if (event.key === "ArrowDown") setActive((index) => Math.min(last, index + 1));
    else if (event.key === "ArrowUp") setActive((index) => Math.max(0, index - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Enter" || event.key === " ") choose(THEME_OPTIONS[active].value);
    else if (event.key === "Escape") {
      // Stop here so the header's mobile menu (which also closes on Escape) stays open.
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
  }

  const triggerClass =
    variant === "overlay"
      ? `bg-black/30 border ${OVERLAY_BORDER} text-cellar-ink focus-visible:outline-cellar-ink`
      : "bg-surface-raised border border-surface-border text-ink focus-visible:outline-accent";

  return (
    <div ref={rootRef} className="relative text-sm">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Theme"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={`flex h-8 items-center gap-2 rounded px-2.5 whitespace-nowrap focus-visible:outline focus-visible:outline-2 ${triggerClass}`}
      >
        <SwatchDots swatch={current.swatch} dots={["surface", "accent"]} size={12} />
        <span>{current.label}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Theme"
          className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-xl"
        >
          {THEME_OPTIONS.map((option, index) => {
            const selected = option.value === theme;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-ink ${index === active ? "bg-surface" : ""}`}
              >
                <SwatchDots swatch={option.swatch} dots={["surface", "accent", "ink"]} size={18} />
                <span className="flex-1">{option.label}</span>
                {selected ? (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
