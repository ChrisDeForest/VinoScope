import { useEffect } from "react";

// Title (and optionally noindex) for the lifetime of a page; restored on leave.
// A null title leaves the tab title alone (e.g. while a nested 404 page sets its own).
export function usePageMeta({ title, noindex = false }: { title: string | null; noindex?: boolean }) {
  useEffect(() => {
    if (title === null) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    if (!noindex) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [noindex]);
}
