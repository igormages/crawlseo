"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

type Mode = "login" | "register";

export function LoginForm({
  googleEnabled,
  registrationOpen,
}: {
  googleEnabled: boolean;
  registrationOpen: boolean;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "").trim();
    const activeMode = registrationOpen ? mode : "login";

    startTransition(async () => {
      if (activeMode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Registration failed");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          activeMode === "register"
            ? "Account created but sign-in failed. Try signing in."
            : "Invalid email or password"
        );
        return;
      }

      window.location.href = "/dashboard";
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3">
        {registrationOpen && mode === "register" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Name
            </label>
            <input
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              className={inputClassName}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClassName}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              registrationOpen && mode === "register"
                ? "new-password"
                : "current-password"
            }
            placeholder="At least 8 characters"
            className={inputClassName}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : registrationOpen && mode === "register"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      {registrationOpen && (
        <p className="text-center text-atom-caption text-muted-foreground">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      )}

      {googleEnabled && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Continue with Google
          </Button>
          <p className="text-center text-atom-caption text-muted-foreground">
            Google is required later to sync Search Console data.
          </p>
        </>
      )}
    </div>
  );
}
