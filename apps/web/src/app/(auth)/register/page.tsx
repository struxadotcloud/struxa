"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@struxa/ui/components/button";
import { Alert, AlertDescription } from "@struxa/ui/components/alert";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { authClient } from "@/lib/auth-client";

const emailPattern = /\S+@\S+\.\S+/;

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const normalizedEmail = email.trim();
  const emailError = !normalizedEmail
    ? "Email is required."
    : emailPattern.test(normalizedEmail)
      ? null
      : "Enter a valid email address.";
  const passwordError = password.length >= 8 ? null : "Password must be at least 8 characters.";
  const showEmailError = Boolean(emailError && (hasSubmitted || touchedEmail));
  const showPasswordError = Boolean(passwordError && (hasSubmitted || touchedPassword));
  const isDisabled = Boolean(emailError || passwordError || isSubmitting);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);
    if (emailError || passwordError) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setIsSubmitting(true);
    const { error: signUpError } = await authClient.signUp.email({
      email: normalizedEmail,
      password,
      name: displayName.trim() || normalizedEmail,
    });
    if (signUpError) {
      setIsSubmitting(false);
      setError(signUpError.message ?? "Unable to create account.");
      return;
    }
    const { error: signInError } = await authClient.signIn.email({
      email: normalizedEmail,
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Account created but sign in failed. Please log in.");
      return;
    }
    router.push("/");
  };

  return (
    <AuthShell title="Create an account" subtitle="Register to get started.">
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        {error ? (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name (optional)</Label>
          <Input
            id="displayName"
            name="displayName"
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Alex"
            type="text"
            value={displayName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            aria-invalid={showEmailError || undefined}
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouchedEmail(true)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
          {showEmailError ? <p className="text-xs text-rose-500">{emailError}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            aria-invalid={showPasswordError || undefined}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouchedPassword(true)}
            placeholder="Create a password"
            type="password"
            value={password}
          />
          {showPasswordError ? <p className="text-xs text-rose-500">{passwordError}</p> : null}
        </div>
        <Button className="w-full" type="submit" disabled={isDisabled}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a
          className="font-medium text-foreground transition-colors hover:text-foreground/80"
          href="/login"
        >
          Sign in
        </a>
      </p>
    </AuthShell>
  );
}
