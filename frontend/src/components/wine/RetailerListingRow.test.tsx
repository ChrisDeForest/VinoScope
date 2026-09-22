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
        listing={{ retailer: "Local Shop", price: 50, currency: "USD", product_url: null, availability: null }}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
