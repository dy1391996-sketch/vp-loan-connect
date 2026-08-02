"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label, Select } from "@/components/ui/primitives";

export function TeamForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? "") || undefined,
        role: String(formData.get("role") ?? "READ_ONLY"),
        password: String(formData.get("password") ?? ""),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create team member.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <form action={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input name="name" required />
        </div>
        <div>
          <Label>Email</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label>Phone</Label>
          <Input name="phone" />
        </div>
        <div>
          <Label>Role</Label>
          <Select name="role" defaultValue="READ_ONLY">
            {["OWNER", "BOOKING_MANAGER", "SOCIAL_MEDIA_MANAGER", "HOUSEKEEPING_MANAGER", "READ_ONLY"].map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Temporary password</Label>
          <Input name="password" type="password" minLength={12} required />
        </div>
        {error ? <p className="sm:col-span-2 text-sm text-rose-500">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create team member"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
