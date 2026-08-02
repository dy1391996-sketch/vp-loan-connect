"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";

type Option = { id: string; label: string };

export function BookingForm({ customers, studios }: { customers: Option[]; studios: Option[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const checkInLocal = String(formData.get("checkInAt") ?? "");
    const payload = {
      customerId: String(formData.get("customerId") ?? ""),
      studioId: String(formData.get("studioId") ?? ""),
      checkInAt: checkInLocal ? new Date(checkInLocal).toISOString() : "",
      durationHours: Number(formData.get("durationHours") ?? 24),
      guestCount: Number(formData.get("guestCount") ?? 2),
      couponCode: String(formData.get("couponCode") ?? "") || undefined,
      createHold: formData.get("createHold") === "on",
    };

    const response = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create booking.");
      return;
    }
    router.push(`/bookings/${data.booking?.id ?? data.id}`);
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form action={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Customer</Label>
          <Select name="customerId" required>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Studio</Label>
          <Select name="studioId" required>
            <option value="">Select studio</option>
            {studios.map((studio) => (
              <option key={studio.id} value={studio.id}>
                {studio.label}
              </option>
            ))}
          </Select>
        </div>
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
        <div>
          <Label>Coupon</Label>
          <Input name="couponCode" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="createHold" type="checkbox" defaultChecked /> Create temporary hold
        </label>
        {error ? <p className="sm:col-span-2 lg:col-span-3 text-sm text-rose-500">{error}</p> : null}
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create booking draft"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
