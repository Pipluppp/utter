import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";
import { Input, Label, TextField } from "react-aria-components";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { GridArt } from "../components/ui/GridArt";
import { Message } from "../components/ui/Message";
import { forgotPassword, getTurnstileSiteKey, isAuthConfigured } from "../lib/auth";

export function ForgotPasswordPage() {
  const configured = isAuthConfigured();
  const turnstileSiteKey = getTurnstileSiteKey();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "success"; message: string }
  >({ type: "idle" });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const busy = status.type === "loading";
  const submitted = status.type === "success";
  const canSubmit =
    configured && !busy && !submitted && email.trim().length > 0 && captchaToken !== null;

  async function onSubmit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Email is required." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const result = await forgotPassword({ captchaToken, email: normalizedEmail });
      setStatus({ type: "success", message: result.detail });
    } catch (error) {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Request failed.",
      });
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <div className="flex min-h-full w-full bg-background">
      <div className="relative flex w-full flex-col justify-between overflow-y-auto px-6 py-8 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div>
            <h1 className="font-pixel text-2xl uppercase tracking-[2px]">Forgot password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send a recovery link.
            </p>
          </div>

          {!configured ? (
            <div className="mt-6">
              <Message variant="info">Auth isn't configured. Set VITE_TURNSTILE_SITE_KEY.</Message>
            </div>
          ) : null}

          {status.type === "error" ? (
            <div className="mt-6">
              <Message variant="error">{status.message}</Message>
            </div>
          ) : null}
          {status.type === "success" ? (
            <div className="mt-6">
              <Message variant="success">{status.message}</Message>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <TextField
              value={email}
              onChange={setEmail}
              type="email"
              isDisabled={!configured || busy || submitted}
              autoFocus
            >
              <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </TextField>

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

            <Button type="submit" block isDisabled={!canSubmit} isPending={busy}>
              Send recovery link
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              to="/auth"
              className="text-foreground underline underline-offset-4 hover:opacity-70"
            >
              Back to sign in
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-faint">
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
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
