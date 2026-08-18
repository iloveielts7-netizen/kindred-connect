import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to Wynse — private one-to-one" },
      {
        name: "description",
        content: "Create a Wynse account or sign in to open your private rooms.",
      },
      { property: "og:title", content: "Sign in to Wynse" },
      { property: "og:description", content: "Create an account and connect with one person." },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(40).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/rooms" });
  }, [session, navigate]);

  const isSignUp = mode === "signup";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSignUp && !ageOk) {
      toast.error("Please confirm you are 13 years of age or older.");
      return;
    }
    const parsed = credentials.safeParse({
      email,
      password,
      displayName: isSignUp ? displayName : undefined,
    });
    if (!parsed.success) {
      toast.error(
        isSignUp ? "Must be at least 8 characters" : "Something went wrong. Please try again.",
      );
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/rooms`,
            data: { display_name: displayName.trim(), age_confirmed: true },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Something went wrong.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/rooms" });
  }

  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5 safe-t">
        <Link to="/" aria-label="Wynse home">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        <div className="panel rise p-6">
          <h1 className="text-2xl">{isSignUp ? "Create your Wynse account" : "Welcome Back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp
              ? "Enter your details to start safe exchanges"
              : "Sign in to access your Wynse account"}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {isSignUp ? (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12"
                  required
                  maxLength={40}
                />
                <p className="text-xs text-muted-foreground">How you will appear to others</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                required
                minLength={8}
              />
              {isSignUp ? (
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              ) : null}
            </div>

            {isSignUp ? (
              <label className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
                <Checkbox
                  checked={ageOk}
                  onCheckedChange={(value) => setAgeOk(value === true)}
                  aria-label="I confirm I am 13 years of age or older"
                  className="mt-0.5"
                />
                <span>I confirm I am 13 years of age or older</span>
              </label>
            ) : null}

            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            OR
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="secondary" className="h-12 w-full text-base" onClick={google}>
            Continue with Google
          </Button>

          <button
            type="button"
            className="mt-6 w-full text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => setMode(isSignUp ? "signin" : "signup")}
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>{" "}
          ·{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
        </p>
      </main>
    </div>
  );
}
