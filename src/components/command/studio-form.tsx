"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";

type StudioFormValues = {
  id?: string;
  number?: string;
  title?: string;
  property?: string;
  building?: string | null;
  floor?: number | null;
  category?: string;
  maxGuests?: number;
  weekdayPriceInr?: number | null;
  weekendPriceInr?: number | null;
  hourlyPriceInr?: number | null;
  active?: boolean;
  isPremium?: boolean;
  hasBalcony?: boolean;
  hasJacuzzi?: boolean;
};

export function StudioForm({ studio }: { studio?: StudioFormValues }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const payload = {
      number: String(formData.get("number") ?? ""),
      title: String(formData.get("title") ?? ""),
      property: String(formData.get("property") ?? "Gaur City Center"),
      building: String(formData.get("building") ?? "") || undefined,
      floor: formData.get("floor") ? Number(formData.get("floor")) : undefined,
      category: String(formData.get("category") ?? "STANDARD"),
      maxGuests: Number(formData.get("maxGuests") ?? 2),
      weekdayPriceInr: formData.get("weekdayPriceInr") ? Number(formData.get("weekdayPriceInr")) : undefined,
      weekendPriceInr: formData.get("weekendPriceInr") ? Number(formData.get("weekendPriceInr")) : undefined,
      hourlyPriceInr: formData.get("hourlyPriceInr") ? Number(formData.get("hourlyPriceInr")) : undefined,
      active: formData.get("active") === "on",
      isPremium: formData.get("isPremium") === "on",
      hasBalcony: formData.get("hasBalcony") === "on",
      hasJacuzzi: formData.get("hasJacuzzi") === "on",
    };

    const response = await fetch(studio?.id ? `/api/admin/studios/${studio.id}` : "/api/admin/studios", {
      method: studio?.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save studio.");
      return;
    }
    router.refresh();
    if (!studio?.id && data.id) router.push(`/studios/${data.id}`);
  }

  return (
    <Card className="p-4">
      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Studio number</Label>
          <Input name="number" defaultValue={studio?.number ?? ""} required />
        </div>
        <div>
          <Label>Title</Label>
          <Input name="title" defaultValue={studio?.title ?? ""} required />
        </div>
        <div>
          <Label>Property</Label>
          <Input name="property" defaultValue={studio?.property ?? "Gaur City Center"} required />
        </div>
        <div>
          <Label>Building</Label>
          <Input name="building" defaultValue={studio?.building ?? ""} />
        </div>
        <div>
          <Label>Floor</Label>
          <Input name="floor" type="number" defaultValue={studio?.floor ?? ""} />
        </div>
        <div>
          <Label>Category</Label>
          <Select name="category" defaultValue={studio?.category ?? "STANDARD"}>
            {["STANDARD", "PREMIUM", "BALCONY", "JACUZZI", "PREMIUM_VIEW"].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Max guests</Label>
          <Input name="maxGuests" type="number" min={1} defaultValue={studio?.maxGuests ?? 2} required />
        </div>
        <div>
          <Label>Hourly price</Label>
          <Input name="hourlyPriceInr" type="number" min={0} defaultValue={studio?.hourlyPriceInr ?? ""} />
        </div>
        <div>
          <Label>Weekday 24h price</Label>
          <Input name="weekdayPriceInr" type="number" min={0} defaultValue={studio?.weekdayPriceInr ?? ""} />
        </div>
        <div>
          <Label>Weekend 24h price</Label>
          <Input name="weekendPriceInr" type="number" min={0} defaultValue={studio?.weekendPriceInr ?? ""} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" defaultChecked={studio?.active ?? true} /> Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="isPremium" type="checkbox" defaultChecked={studio?.isPremium ?? false} /> Premium
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="hasBalcony" type="checkbox" defaultChecked={studio?.hasBalcony ?? false} /> Balcony
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="hasJacuzzi" type="checkbox" defaultChecked={studio?.hasJacuzzi ?? false} /> Jacuzzi
        </label>
        {error ? <p className="sm:col-span-2 text-sm text-rose-500">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : studio?.id ? "Update studio" : "Create studio"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
