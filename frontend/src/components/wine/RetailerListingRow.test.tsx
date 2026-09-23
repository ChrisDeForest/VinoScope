import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RetailerListingRow } from "./RetailerListingRow";

describe("RetailerListingRow", () => {
  it("renders the retailer name, price, and an outbound link", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Total Wine",
          price: 79.99,
          currency: "USD",
          price_usd_approx: 79.99,
          product_url: "https://totalwine.com/product",
          availability: "In Stock",
        }}
      />
    );
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
    expect(screen.getByText("$79.99")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View Retailer" });
    expect(link).toHaveAttribute("href", "https://totalwine.com/product");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the link when product_url is null", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Local Shop",
          price: 50,
          currency: "USD",
          price_usd_approx: 50,
          product_url: null,
          availability: null,
        }}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an approx-USD conversion line for a non-USD listing", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Euro Wines",
          price: 50,
          currency: "EUR",
          price_usd_approx: 54.0,
          product_url: null,
          availability: null,
        }}
      />
    );
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });

  it("does not show a conversion line for a USD listing", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Total Wine",
          price: 79.99,
          currency: "USD",
          price_usd_approx: 79.99,
          product_url: null,
          availability: null,
        }}
      />
    );
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
});
