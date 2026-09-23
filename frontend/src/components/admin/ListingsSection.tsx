import { useState } from "react";
import type { WineDetail, RetailerListing } from "../../types/wine";
import { createListing, updateListing, deleteListing } from "../../services/adminApi";
import { getWine, ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

const SESSION_EXPIRED_MESSAGE = "Session expired — please refresh the page and log in again.";

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401) {
    clearAdminKey();
    return SESSION_EXPIRED_MESSAGE;
  }
  return err instanceof ApiError ? err.message : fallback;
}

interface ListingEdits {
  price: string;
  currency: string;
  availability: string;
  product_url: string;
}

export function ListingsSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [newListing, setNewListing] = useState({
    retailer: "",
    price: "",
    currency: "",
    availability: "",
    product_url: "",
  });

  async function refresh() {
    const fresh = await getWine(wine.id);
    onUpdated(fresh);
  }

  async function handleSaveListing(listing: RetailerListing, edits: ListingEdits) {
    setError(null);
    try {
      await updateListing(wine.id, listing.id, {
        price: edits.price === "" ? null : Number(edits.price),
        currency: edits.currency === "" ? null : edits.currency,
        availability: edits.availability === "" ? null : edits.availability,
        product_url: edits.product_url === "" ? null : edits.product_url,
      });
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to save listing"));
    }
  }

  async function handleDeleteListing(listingId: number) {
    setError(null);
    try {
      await deleteListing(wine.id, listingId);
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to delete listing"));
    }
  }

  async function handleAddListing() {
    setError(null);
    try {
      await createListing(wine.id, {
        retailer: newListing.retailer,
        price: newListing.price === "" ? null : Number(newListing.price),
        currency: newListing.currency === "" ? null : newListing.currency,
        availability: newListing.availability === "" ? null : newListing.availability,
        product_url: newListing.product_url === "" ? null : newListing.product_url,
      });
      setNewListing({ retailer: "", price: "", currency: "", availability: "", product_url: "" });
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to add listing"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Listings</h2>
      {wine.listings.map((listing) => (
        <ListingRow key={listing.id} listing={listing} onSave={handleSaveListing} onDelete={handleDeleteListing} />
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Retailer
          <input
            aria-label="New listing retailer"
            value={newListing.retailer}
            onChange={(e) => setNewListing((prev) => ({ ...prev, retailer: e.target.value }))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </label>
        <button
          type="button"
          onClick={handleAddListing}
          disabled={newListing.retailer === ""}
          className="bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
        >
          Add listing
        </button>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

function ListingRow({
  listing,
  onSave,
  onDelete,
}: {
  listing: RetailerListing;
  onSave: (listing: RetailerListing, edits: ListingEdits) => void;
  onDelete: (listingId: number) => void;
}) {
  const [edits, setEdits] = useState<ListingEdits>({
    price: listing.price === null ? "" : String(listing.price),
    currency: listing.currency ?? "",
    availability: listing.availability ?? "",
    product_url: listing.product_url ?? "",
  });

  return (
    <div className="flex gap-2 items-end flex-wrap border-b border-surface-border pb-2">
      <span className="text-sm text-ink-muted min-w-[8rem]">{listing.retailer}</span>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Price
        <input
          aria-label={`${listing.retailer} price`}
          type="number"
          value={edits.price}
          onChange={(e) => setEdits((prev) => ({ ...prev, price: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Currency
        <input
          aria-label={`${listing.retailer} currency`}
          value={edits.currency}
          onChange={(e) => setEdits((prev) => ({ ...prev, currency: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-20"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Availability
        <input
          aria-label={`${listing.retailer} availability`}
          value={edits.availability}
          onChange={(e) => setEdits((prev) => ({ ...prev, availability: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted flex-1 min-w-[10rem]">
        Product URL
        <input
          aria-label={`${listing.retailer} product URL`}
          value={edits.product_url}
          onChange={(e) => setEdits((prev) => ({ ...prev, product_url: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        />
      </label>
      <button type="button" onClick={() => onSave(listing, edits)} className="bg-accent text-surface text-sm px-3 py-1 rounded">
        Save
      </button>
      <button type="button" onClick={() => onDelete(listing.id)} className="text-sm text-red-500 px-3 py-1">
        Delete
      </button>
    </div>
  );
}
