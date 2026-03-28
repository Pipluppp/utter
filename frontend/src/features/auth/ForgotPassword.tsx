import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef, useState } from "react";
import { FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { Button } from "../../components/atoms/Button";
import { AppLink } from "../../components/atoms/Link";
import { Message } from "../../components/atoms/Message";
import { GridArt } from "../../components/molecules/GridArt";
import { forgotPassword, getTurnstileSiteKey, isAuthConfigured } from "../../lib/auth";
import { inputStyles } from "../../lib/styles/input";
import { validateEmail } from "../../lib/validation";

export function ForgotPasswordPage() {
  const configured = isAuthConfigured();
  const turnstileSiteKey = getTurnstileSiteKey();

  const [email, setEmail] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
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
  const canSubmit = configured && !busy && !submitted && captchaToken !== null;

  async function onSubmit() {
    const normalizedEmail = email.trim();

    setServerErrors({});
    setStatus({ type: "loading" });

    try {
      const result = await forgotPassword({ captchaToken, email: normalizedEmail });
      setStatus({ type: "success", message: result.detail });
    } catch (error) {
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      const message = error instanceof Error ? error.message : "Request failed.";
      setServerErrors({ email: message });
      setStatus({
        type: "error",
        message,
      });
    }
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

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
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
              isDisabled={!configured || busy || submitted}
              autoFocus
            >
              <Label className="mb-2 block label-style">Email</Label>
              <Input placeholder="you@example.com" autoComplete="email" className={inputStyles()} />
              <div className="min-h-[20px]">
                <FieldError className="block text-xs text-red-500" />
              </div>
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
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <AppLink
              href="/auth"
              className="text-foreground underline underline-offset-4 data-[hovered]:opacity-70 data-[pressed]:opacity-70"
            >
              Back to sign in
            </AppLink>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-faint">
          <div className="flex gap-4">
            <AppLink
              href="/terms"
              className="data-[hovered]:text-foreground data-[pressed]:text-foreground"
            >
              Terms
            </AppLink>
            <AppLink
              href="/privacy"
              className="data-[hovered]:text-foreground data-[pressed]:text-foreground"
            >
              Privacy
            </AppLink>
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
