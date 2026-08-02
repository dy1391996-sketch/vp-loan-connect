"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label, Select } from "@/components/ui/primitives";

export function LeadStageSelect({ leadId, stage }: { leadId: string; stage: string }) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [error, setError] = useState("");

  async function update(next: string) {
    setValue(next);
    setError("");
    const response = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: next }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setValue(stage);
      setError(data.error ?? "Could not update lead stage.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Label>Lead stage</Label>
      <Select value={value} onChange={(event) => update(event.target.value)}>
        {[
          "NEW_ENQUIRY",
          "QUALIFICATION_PENDING",
          "AVAILABILITY_SHARED",
          "PRICE_SHARED",
          "PHOTOS_SHARED",
          "PAYMENT_LINK_SENT",
          "TOKEN_PENDING",
          "CONFIRMED",
          "CHECKED_IN",
          "CHECKED_OUT",
          "REVIEW_REQUESTED",
          "REPEAT_LEAD",
          "LOST",
          "SPAM",
        ].map((item) => (
          <option key={item} value={item}>
            {item.replaceAll("_", " ")}
          </option>
        ))}
      </Select>
      {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
