"use client";

import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { formatInr } from "@/lib/utils";

type AvailabilityResult = {
  id: string;
  number: string;
  title: string;
  category: string;
  ready: boolean;
  cleaningStatus: string;
  price?: { totalAmountInr: number; tokenAmountInr: number; matchedSlab: string | null };
};

export function AvailabilitySearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AvailabilityResult[]>([]);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    setResults([]);
    const checkInLocal = String(formData.get("checkInAt") ?? "");
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tool: "searchAvailableStudios",
        args: {
          checkInAt: checkInLocal ? new Date(checkInLocal).toISOString() : "",
          durationHours: Number(formData.get("durationHours") ?? 24),
          guestCount: Number(formData.get("guestCount") ?? 2),
          preferBalcony: formData.get("preferBalcony") === "on",
          preferJacuzzi: formData.get("preferJacuzzi") === "on",
          preferPremium: formData.get("preferPremium") === "on",
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || data.success === false) {
      setError(data.error ?? data.output?.error ?? "Availability search failed.");
      return;
    }
    setResults(Array.isArray(data.output) ? data.output : []);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form action={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Check-in</Label>
            <Input name="checkInAt" type="datetime-local" required />
          </div>
          <div>
            <Label>Duration hours</Label>
            <Input name="durationHours" type="number" min={1} defaultValue={24} required />
          </div>
          <div>
            <Label>Guests</Label>
            <Input name="guestCount" type="number" min={1} defaultValue={2} required />
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input name="preferBalcony" type="checkbox" /> Balcony
            </label>
            <label className="flex items-center gap-2">
              <input name="preferJacuzzi" type="checkbox" /> Jacuzzi
            </label>
            <label className="flex items-center gap-2">
              <input name="preferPremium" type="checkbox" /> Premium
            </label>
          </div>
          {error ? <p className="sm:col-span-2 lg:col-span-4 text-sm text-rose-500">{error}</p> : null}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search availability"}
            </Button>
          </div>
        </form>
      </Card>

      {results.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((studio) => (
            <Card key={studio.id} className="p-4">
              <p className="font-display text-lg text-ink-950">
                {studio.number} · {studio.title}
              </p>
              <p className="mt-1 text-sm text-ink-700/70">
                {studio.category.replaceAll("_", " ")} · {studio.cleaningStatus.replaceAll("_", " ")}
              </p>
              <p className="mt-3 text-sm font-medium text-ink-950">
                {formatInr(studio.price?.totalAmountInr ?? 0)} total · token {formatInr(studio.price?.tokenAmountInr ?? 0)}
              </p>
              <p className="mt-1 text-xs text-ink-700/60">{studio.ready ? "Ready for guest arrival" : "Requires readiness check"}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
