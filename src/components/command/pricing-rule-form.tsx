"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";

export function PricingRuleForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const payload = {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "WEEKDAY_SLAB"),
      dayType: String(formData.get("dayType") ?? "ANY"),
      minHours: formData.get("minHours") ? Number(formData.get("minHours")) : undefined,
      maxHours: formData.get("maxHours") ? Number(formData.get("maxHours")) : undefined,
      amountInr: Number(formData.get("amountInr") ?? 0),
      priority: Number(formData.get("priority") ?? 100),
      active: formData.get("active") === "on",
      approved: formData.get("approved") === "on",
      couponCode: String(formData.get("couponCode") ?? "") || undefined,
    };
    const response = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create pricing rule.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form action={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Label>Name</Label>
          <Input name="name" required />
        </div>
        <div>
          <Label>Type</Label>
          <Select name="type" defaultValue="WEEKDAY_SLAB">
            {[
              "WEEKDAY_SLAB",
              "WEEKEND_SLAB",
              "HOURLY",
              "SPECIAL_DATE",
              "HOLIDAY",
              "OCCUPANCY",
              "LAST_MINUTE",
              "RETURNING_CUSTOMER",
              "LONG_STAY",
              "COUPON",
              "MANUAL_OVERRIDE",
              "PREMIUM_SURCHARGE",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Day type</Label>
          <Select name="dayType" defaultValue="ANY">
            {["ANY", "WEEKDAY", "WEEKEND"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Min hours</Label>
          <Input name="minHours" type="number" min={1} />
        </div>
        <div>
          <Label>Max hours</Label>
          <Input name="maxHours" type="number" min={1} />
        </div>
        <div>
          <Label>Amount INR</Label>
          <Input name="amountInr" type="number" min={0} required />
        </div>
        <div>
          <Label>Priority</Label>
          <Input name="priority" type="number" defaultValue={100} />
        </div>
        <div>
          <Label>Coupon code</Label>
          <Input name="couponCode" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" defaultChecked /> Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="approved" type="checkbox" defaultChecked /> Approved
        </label>
        {error ? <p className="sm:col-span-2 lg:col-span-4 text-sm text-rose-500">{error}</p> : null}
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create pricing rule"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
