import { useState } from "react";
import { FieldError, Input, Label, TextField } from "react-aria-components";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
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

  const busy = status.type === "loading";
  const succeeded = status.type === "success";

  const passwordError = password.length > 0 ? validatePassword(password) : null;
  const mismatchError =
    confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match." : null;

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

    try {
      const result = await updatePassword({ password });
      setStatus({ type: "success", message: result.detail });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update password.",
      });
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <div className="space-y-5">
      {status.type === "error" ? (
        <AccountNotice tone="error">{status.message}</AccountNotice>
      ) : null}
      {status.type === "success" ? (
        <AccountNotice tone="success">
          {status.message}{" "}
          <Link to="/account" className="underline underline-offset-4 hover:opacity-70">
            Go to profile
          </Link>
        </AccountNotice>
      ) : null}

      <AccountPanel
        kicker="Security"
        title="Set a new password"
        description="Choose a new password for your account. Must be at least 6 characters."
      >
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <TextField
            value={password}
            onChange={setPassword}
            type="password"
            isInvalid={!!passwordError}
            isDisabled={busy || succeeded}
            autoFocus
          >
            <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              New password
            </Label>
            <Input
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            isDisabled={busy || succeeded}
          >
            <Label className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Confirm password
            </Label>
            <Input
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated placeholder:text-faint focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {mismatchError ? (
              <FieldError className="text-sm text-red-500">{mismatchError}</FieldError>
            ) : null}
          </TextField>

          <Button type="submit" size="sm" isDisabled={!canSubmit} isPending={busy}>
            Update password
          </Button>
        </form>
      </AccountPanel>
    </div>
  );
}
