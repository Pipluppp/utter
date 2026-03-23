import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
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
        <AccountNotice tone="success">{status.message}</AccountNotice>
      ) : null}

      <AccountPanel
        kicker="Security"
        title="Change password"
        description="Update the password for your account. Must be at least 6 characters."
      >
        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="change-new-password">New password</Label>
            <Input
              id="change-new-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (status.type === "success") setStatus({ type: "idle" });
              }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              disabled={busy}
            />
            {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-confirm-password">Confirm password</Label>
            <Input
              id="change-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              disabled={busy}
            />
            {mismatchError ? <p className="text-sm text-red-500">{mismatchError}</p> : null}
          </div>

          <Button type="submit" size="sm" disabled={!canSubmit} loading={busy}>
            Change password
          </Button>
        </form>
      </AccountPanel>
    </div>
  );
}
