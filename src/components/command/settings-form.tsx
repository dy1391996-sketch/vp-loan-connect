"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui/primitives";

export function SettingForm({ initialKey = "", initialValue = "{}" }: { initialKey?: string; initialValue?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    let value: unknown;
    try {
      value = JSON.parse(String(formData.get("value") ?? "{}"));
    } catch {
      setLoading(false);
      setError("Value must be valid JSON.");
      return;
    }

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: String(formData.get("key") ?? ""), value }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save setting.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form action={submit} className="space-y-4">
        <div>
          <Label>Key</Label>
          <Input name="key" defaultValue={initialKey} required />
        </div>
        <div>
          <Label>JSON value</Label>
          <Textarea name="value" rows={5} defaultValue={initialValue} required />
        </div>
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save setting"}
        </Button>
      </form>
    </Card>
  );
}
