export function termCardId(id: string): string {
  return `term-${id}`;
}

export function termHeadingId(id: string): string {
  return `term-${id}-title`;
}

// Built by hand so spaces encode as %20, matching the rest of the Learn links.
export function exploreHref(params: { type?: string; country?: string }): string {
  const query = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join("&");
  return `/explore?${query}`;
}
