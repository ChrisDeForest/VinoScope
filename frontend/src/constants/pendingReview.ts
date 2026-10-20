// TEMPORARY: wines whose bottle photos were just fixed and are waiting for a visual check.
// Explore's "Pending" toggle shows only these. Empty the list (or delete this file and the toggle
// in ExplorePage) once the photos are signed off.
export const PENDING_IMAGE_SLUGS: readonly string[] = [];

const PENDING_IMAGE_URLS = new Set(PENDING_IMAGE_SLUGS.map((slug) => `/wines/${slug}.webp`));

export function isPendingReview(imageUrl: string | null): boolean {
  return imageUrl !== null && PENDING_IMAGE_URLS.has(imageUrl);
}
