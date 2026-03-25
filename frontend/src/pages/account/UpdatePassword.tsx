import { useState } from "react";
import { FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { Button } from "../../components/ui/Button";
import { AppLink } from "../../components/ui/Link";
import { updatePassword } from "../../lib/auth";
import { validatePassword } from "../../lib/validation";
import { AccountNotice, AccountPanel } from "./accountUi";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const busy = status.type === "loading";
  const succeeded = status.type === "success";

  const canSubmit =
    !busy &&
    !succeeded &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    validatePassword(password) === null &&
    password === confirmPassword;

  async function onSubmit() {
    const pwError = validatePassword(password);
    if (pwError) {
      setStatus({ type: "error", message: pwError });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setStatus({ type: "loading" });
    setServerErrors({});

    try {
      const result = await updatePassword({ password });
      setStatus({ type: "success", message: result.detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password.";
      const lowerMessage = message.toLowerCase();

      if (
        lowerMessage.includes("password") ||
        lowerMessage.includes("characters") ||
        lowerMessage.includes("uppercase") ||
        lowerMessage.includes("digit") ||
        lowerMessage.includes("special character")
      ) {
        setServerErrors({ password: message });
      } else {
        setStatus({ type: "error", message });
      }
    }
  }

  return (
    <div className="space-y-5">
      {status.type === "error" ? (
        <AccountNotice tone="error">{status.message}</AccountNotice>
      ) : null}
      {status.type === "success" ? (
        <AccountNotice tone="success">
          {status.message}{" "}
          <AppLink href="/account" className="underline underline-offset-4 hover:opacity-70">
            Go to profile
          </AppLink>
        </AccountNotice>
      ) : null}

      <AccountPanel
        kicker="Security"
        title="Set a new password"
        description="Choose a new password for your account. 8+ characters, uppercase, number, special character."
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          validationBehavior="aria"
          validationErrors={serverErrors}
          className="max-w-sm space-y-4"
        >
          <TextField
            name="password"
            value={password}
            onChange={setPassword}
            type="password"
            validate={(v) => (v.length > 0 ? validatePassword(v) : null)}
            isDisabled={busy || succeeded}
            autoFocus
          >
            <Label className="mb-2 block label-style">New password</Label>
            <Input
              placeholder="8+ chars, uppercase, number, special"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="min-h-[20px]">
              <FieldError className="block text-xs text-red-500" />
            </div>
          </TextField>

          <TextField
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            validate={(v) => (v.length > 0 && v !== password ? "Passwords do not match." : null)}
            isDisabled={busy || succeeded}
          >
            <Label className="mb-2 block label-style">Confirm password</Label>
            <Input
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <div className="min-h-[20px]">
              <FieldError className="block text-xs text-red-500" />
            </div>
          </TextField>

          <Button type="submit" size="sm" isDisabled={!canSubmit} isPending={busy}>
            Update password
          </Button>
        </Form>
      </AccountPanel>
    </div>
  );
}
