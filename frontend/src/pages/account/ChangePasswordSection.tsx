import { useState } from "react";
import { FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { Button } from "../../components/ui/Button";
import { updatePassword } from "../../lib/auth";
import { validatePassword } from "../../lib/validation";
import { AccountNotice, AccountPanel } from "./accountUi";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function hasEmailIdentity(identities: Array<{ provider: string }>): boolean {
  return identities.some((identity) => identity.provider === "email");
}

export function ChangePasswordSection({ identities }: { identities: Array<{ provider: string }> }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  if (!hasEmailIdentity(identities)) {
    return (
      <AccountNotice tone="neutral">
        Your account uses Google sign-in and does not have a password. Password changes are not
        available for OAuth-only accounts.
      </AccountNotice>
    );
  }

  const busy = status.type === "loading";

  const passwordError = password.length > 0 ? validatePassword(password) : null;
  const mismatchError =
    confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match." : null;

  const canSubmit =
    !busy &&
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

    try {
      const result = await updatePassword({ password });
      setStatus({ type: "success", message: result.detail });
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update password.",
      });
    }
  }

  return (
    <div className="space-y-5">
      {status.type === "error" ? (
        <AccountNotice tone="error">{status.message}</AccountNotice>
      ) : null}
      {status.type === "success" ? (
        <AccountNotice tone="success">{status.message}</AccountNotice>
      ) : null}

      <AccountPanel
        kicker="Security"
        title="Change password"
        description="Update the password for your account. Must be at least 6 characters."
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
          validationBehavior="aria"
          className="max-w-sm space-y-4"
        >
          <TextField
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (status.type === "success") setStatus({ type: "idle" });
            }}
            type="password"
            isInvalid={!!passwordError}
            isDisabled={busy}
          >
            <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              New password
            </Label>
            <Input
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {passwordError ? (
              <FieldError className="text-sm text-red-500">{passwordError}</FieldError>
            ) : null}
          </TextField>

          <TextField
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            isInvalid={!!mismatchError}
            isDisabled={busy}
          >
            <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Confirm password
            </Label>
            <Input
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint transition-colors hover:border-border-strong focus:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {mismatchError ? (
              <FieldError className="text-sm text-red-500">{mismatchError}</FieldError>
            ) : null}
          </TextField>

          <Button type="submit" size="sm" isDisabled={!canSubmit} isPending={busy}>
            Change password
          </Button>
        </Form>
      </AccountPanel>
    </div>
  );
}
