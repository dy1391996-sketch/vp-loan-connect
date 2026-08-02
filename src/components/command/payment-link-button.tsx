"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function PaymentLinkButton({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function createLink() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/payments/create-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not generate payment link.");
      return;
    }
    setLink(data.paymentLinkUrl ?? "");
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={createLink} disabled={loading}>
        {loading ? "Generating..." : "Generate payment link"}
      </Button>
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
      {link ? (
        <a className="block break-all text-sm text-copper-600 hover:text-copper-500" href={link} target="_blank" rel="noreferrer">
          {link}
        </a>
      ) : null}
    </div>
  );
}
