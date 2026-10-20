import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ComboBoxOption {
  value: string;
  label: string;
  /** Options sharing a group are listed under its heading, in the order the groups first appear. */
  group?: string;
}

/** Case- and accent-insensitive, so "rhone" finds "Rhône". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Scrolls `list` just enough to show `option`, without moving any other scroller. */
function keepInView(list: HTMLElement, option: HTMLElement) {
  const listBox = list.getBoundingClientRect();
  const optionBox = option.getBoundingClientRect();
  if (optionBox.top < listBox.top) list.scrollTop -= listBox.top - optionBox.top;
  else if (optionBox.bottom > listBox.bottom) list.scrollTop += optionBox.bottom - listBox.bottom;
}

/**
 * A themed dropdown that always opens below its field (a native `<select>` flips upward near the
 * bottom of the screen) and, when `searchable`, filters its options as you type.
 */
export function ComboBox({
  id,
  label,
  value,
  options,
  onChange,
  searchable = true,
  disabled = false,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  options: ComboBoxOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const selected = options.find((option) => option.value === value);
  const shown = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return options;
    return options.filter((option) => normalize(option.label).includes(needle) || (option.group !== undefined && normalize(option.group).includes(needle)));
  }, [options, query]);

  useEffect(() => {
    const list = listRef.current;
    const option = list && document.getElementById(optionId(active));
    if (list && option) keepInView(list, option);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, shown]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
    setQuery("");
  }, [disabled]);

  useEffect(() => {
    // Bring the whole list into view (scrolling the drawer if needed) instead of flipping it upward.
    if (open) listRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [open]);

  function openList() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(option: ComboBoxOption) {
    onChange(option.value);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) return openList();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => Math.min(Math.max(current + step, 0), Math.max(shown.length - 1, 0)));
        return;
      }
      case "Enter":
        event.preventDefault();
        if (!open) return openList();
        if (shown[active]) choose(shown[active]);
        return;
      case " ":
        if (searchable) return;
        event.preventDefault();
        if (open) close();
        else openList();
        return;
      case "Escape":
        if (!open) return;
        // preventDefault tells the surrounding dialog this Escape only closed the list.
        event.preventDefault();
        close();
        return;
      case "Tab":
        if (open) close();
        return;
    }
  }

  const items: ReactNode[] = [];
  let index = 0;
  for (let start = 0; start < shown.length; ) {
    const group = shown[start].group;
    let end = start;
    while (end < shown.length && shown[end].group === group) end++;
    const rows = shown.slice(start, end).map((option) => {
      const position = index++;
      const isSelected = option.value === value;
      return (
        <li
          key={`${option.group ?? ""}:${option.value}`}
          id={optionId(position)}
          role="option"
          aria-selected={isSelected}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(position)}
          onClick={() => choose(option)}
          className={`cursor-pointer px-3 py-1.5 text-sm ${position === active ? "bg-surface-border" : ""} ${isSelected ? "font-semibold text-accent" : "text-ink"}`}
        >
          {option.label}
        </li>
      );
    });
    if (group === undefined) {
      items.push(...rows);
    } else {
      const headingId = `${id}-group-${start}`;
      items.push(
        <li key={`group:${group}`} role="presentation">
          <div id={headingId} className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {group}
          </div>
          <ul role="group" aria-labelledby={headingId}>
            {rows}
          </ul>
        </li>
      );
    }
    start = end;
  }

  return (
    <div className={`relative flex min-w-0 flex-col gap-1 text-sm text-ink-muted ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete={searchable ? "list" : "none"}
          aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
          autoComplete="off"
          readOnly={!searchable}
          disabled={disabled}
          value={open && searchable ? query : selected?.label ?? value}
          placeholder={selected?.label ?? value}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          // Opened on press rather than click: a click on the label is forwarded to this field, and
          // would otherwise reopen the list that the same press just closed by moving focus.
          onMouseDown={() => (open && !searchable ? close() : !open && openList())}
          onKeyDown={handleKeyDown}
          onBlur={close}
          className={`w-full min-w-0 rounded border border-surface-border bg-surface-raised py-1 pl-2 pr-8 text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${searchable ? "" : "cursor-pointer"}`}
        />
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-accent transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded border border-surface-border bg-surface-raised py-1 shadow-lg"
        >
          {items.length > 0 ? items : <li className="px-3 py-1.5 text-sm text-ink-muted">No matches</li>}
        </ul>
      ) : null}
    </div>
  );
}
