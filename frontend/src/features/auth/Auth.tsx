import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { useAuthState } from "../../app/auth/AuthStateProvider";
import { getSafeReturnTo } from "../../app/navigation";
import { Button } from "../../components/atoms/Button";
import { AppLink } from "../../components/atoms/Link";
import { Message } from "../../components/atoms/Message";
import { Separator } from "../../components/atoms/Separator";
import { GridArt } from "../../components/molecules/GridArt";
import {
  getTurnstileSiteKey,
  isAuthConfigured,
  signInWithPassword,
  signUpWithPassword,
} from "../../lib/auth";
import { cn } from "../../lib/cn";
import { input } from "../../lib/recipes/input";
import { validateEmail, validatePassword } from "../../lib/validation";

const authRoute = getRouteApi("/_auth/auth");

type PasswordIntent = "sign_in" | "sign_up";

export function AuthPage() {
  const { returnTo: rawReturnTo, error: rawError, intent: initialIntent } = authRoute.useSearch();
  const authState = useAuthState();

  const configured = isAuthConfigured();
  const turnstileSiteKey = getTurnstileSiteKey();
  const returnTo = (rawReturnTo ?? "").trim();
  const callbackError = (rawError ?? "").trim();
  const safeReturnTo = useMemo(() => getSafeReturnTo(returnTo), [returnTo]);

  const [intent, setIntent] = useState<PasswordIntent>(initialIntent);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading"; label: string }
    | { type: "error"; message: string }
    | { type: "ok"; message: string }
  >({ type: "idle" });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (!callbackError) return;
    setStatus({ type: "error", message: callbackError });
  }, [callbackError]);

  async function onPasswordSubmit() {
    const normalizedEmail = email.trim();
    setServerErrors({});

    setStatus({
      type: "loading",
      label: intent === "sign_in" ? "Signing in..." : "Creating account...",
    });

    try {
      if (intent === "sign_in") {
        await signInWithPassword({
          captchaToken,
          email: normalizedEmail,
          password,
        });
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        setStatus({ type: "ok", message: "Signed in." });
        await authState.refresh();
        return;
      }

      const result = await signUpWithPassword({
        captchaToken,
        email: normalizedEmail,
        password,
        returnTo: safeReturnTo,
      });
      turnstileRef.current?.reset();
      setCaptchaToken(null);

      if (result.signed_in) {
        setStatus({ type: "ok", message: "Account created." });
        await authState.refresh();
        return;
      }

      setStatus({
        type: "ok",
        message: "Account created. If email confirmation is enabled, check your inbox.",
      });
    } catch (error) {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      const message = error instanceof Error ? error.message : "Authentication failed.";
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("password") ||
        lowerMessage.includes("characters") ||
        lowerMessage.includes("uppercase") ||
        lowerMessage.includes("digit") ||
        lowerMessage.includes("special character")
      ) {
        setServerErrors({ password: message });
      } else if (
        lowerMessage.includes("email") ||
        lowerMessage.includes("user not found") ||
        lowerMessage.includes("already registered")
      ) {
        setServerErrors({ email: message });
      } else {
        setStatus({ type: "error", message });
      }
    }
  }

  const busy = status.type === "loading";

  return (
    <div className="flex w-full flex-1 bg-background">
      <div className="relative flex w-full flex-col justify-between overflow-y-auto px-6 py-4 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-4">
          <div>
            <h1 className="font-pixel text-2xl uppercase tracking-[2px]">
              {intent === "sign_in" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {intent === "sign_in"
                ? "Welcome back. Sign in to continue."
                : "Get started with Utter."}
            </p>
          </div>

          {!configured ? (
            <div className="mt-6">
              <Message variant="info">Auth isn't configured. Set VITE_TURNSTILE_SITE_KEY.</Message>
            </div>
          ) : null}

          <a
            href={`/api/auth/oauth/google${safeReturnTo !== "/" ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : ""}`}
            className={cn(
              "mt-8 flex w-full items-center justify-center gap-3 border border-border px-4 py-2.5 text-sm font-medium press-scale-sm-y hover:bg-subtle",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </a>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">or</span>
            </div>
          </div>

          {status.type === "error" ? (
            <div className="mt-4">
              <Message variant="error">{status.message}</Message>
            </div>
          ) : null}
          {status.type === "ok" ? (
            <div className="mt-4">
              <Message variant="success">{status.message}</Message>
            </div>
          ) : null}

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void onPasswordSubmit();
            }}
            validationBehavior="aria"
            validationErrors={serverErrors}
            className="mt-6 space-y-5"
          >
            <TextField
              name="email"
              value={email}
              onChange={setEmail}
              type="email"
              validate={(v) => (v.length > 0 ? validateEmail(v) : null)}
              isDisabled={!configured || busy}
              autoFocus
            >
              <Label className="mb-2 block label-style">Email</Label>
              <Input placeholder="you@example.com" autoComplete="email" className={input()} />
              <div className="min-h-[20px]">
                <FieldError className="block text-xs text-red-500" />
              </div>
            </TextField>

            <TextField
              name="password"
              value={password}
              onChange={setPassword}
              type="password"
              isDisabled={!configured || busy}
              {...(intent === "sign_in"
                ? { isRequired: true }
                : { validate: (v: string) => (v.length > 0 ? validatePassword(v) : null) })}
            >
              <Label className="mb-2 block label-style">Password</Label>
              <Input
                placeholder={
                  intent === "sign_in"
                    ? "Enter your password"
                    : "8+ chars, uppercase, number, special"
                }
                autoComplete={intent === "sign_in" ? "current-password" : "new-password"}
                className={input()}
              />
              <div className="min-h-[20px]">
                <FieldError className="block text-xs text-red-500" />
              </div>
            </TextField>

            {intent === "sign_in" ? (
              <div className="text-right">
                <AppLink
                  href="/auth/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </AppLink>
              </div>
            ) : null}

            {configured ? (
              <Turnstile
                ref={turnstileRef}
                className="w-full"
                siteKey={turnstileSiteKey}
                options={{ theme: "dark", size: "flexible", refreshExpired: "auto" }}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
              />
            ) : null}

            <Button
              type="submit"
              block
              isDisabled={!configured || busy || !captchaToken}
              isPending={busy}
            >
              {intent === "sign_in" ? "Sign in" : "Create account"}
            </Button>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {intent === "sign_in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIntent("sign_up")}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIntent("sign_in")}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-faint">
          <div className="flex gap-4">
            <AppLink href="/terms" className="hover:text-foreground">
              Terms
            </AppLink>
            <AppLink href="/privacy" className="hover:text-foreground">
              Privacy
            </AppLink>
          </div>
          {returnTo ? (
            <span className="text-faint">
              Redirecting to <span className="text-muted-foreground">{safeReturnTo}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden border-l border-border bg-subtle lg:block lg:w-1/2">
        <div className="relative h-full w-full overflow-hidden">
          <GridArt />
          <div className="absolute bottom-12 left-12 right-12">
            <p className="font-pixel text-sm uppercase tracking-[3px] text-foreground/30">
              Clone voices. Design new ones. Generate speech.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
