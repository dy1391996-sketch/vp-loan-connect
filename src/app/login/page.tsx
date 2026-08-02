import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm text-ink-700">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
