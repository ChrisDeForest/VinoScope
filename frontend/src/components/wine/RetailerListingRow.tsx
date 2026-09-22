import type { RetailerListing } from "../../types/wine";
import { formatPrice } from "../../utils/format";

export function RetailerListingRow({ listing }: { listing: RetailerListing }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2 last:border-b-0">
      <div>
        <p className="text-sm text-ink">{listing.retailer}</p>
        <p className="text-xs text-ink-muted">{formatPrice(listing.price)}</p>
      </div>
      {listing.product_url ? (
        <a
          href={listing.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:underline"
        >
          View Retailer
        </a>
      ) : null}
    </div>
  );
}
