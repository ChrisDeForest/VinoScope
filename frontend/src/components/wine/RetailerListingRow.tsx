import type { RetailerListing } from "../../types/wine";
import { formatPrice, formatApproxUsd, hasApproxUsdConversion } from "../../utils/format";

export function RetailerListingRow({ listing }: { listing: RetailerListing }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2 last:border-b-0">
      <div>
        <p className="text-sm text-ink">{listing.retailer}</p>
        <p className="text-xs text-ink-muted">{formatPrice(listing.price, listing.currency)}</p>
        {hasApproxUsdConversion(listing.currency, listing.price_usd_approx) ? (
          <p className="text-xs text-ink-muted">{formatApproxUsd(listing.price_usd_approx)}</p>
        ) : null}
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
