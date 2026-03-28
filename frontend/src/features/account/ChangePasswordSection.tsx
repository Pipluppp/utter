import { useState } from "react";
import { FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { Button } from "../../components/atoms/Button";
import { updatePassword } from "../../lib/auth";
import { inputStyles } from "../../lib/styles/input";
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
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  if (!hasEmailIdentity(identities)) {
    return (
      <AccountNotice tone="neutral">
        Your account uses Google sign-in and does not have a password. Password changes are not
        available for OAuth-only accounts.
      </AccountNotice>
    );
  }

  const busy = status.type === "loading";

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
    setServerErrors({});

    try {
      const result = await updatePassword({ password });
      setStatus({ type: "success", message: result.detail });
      setPassword("");
      setConfirmPassword("");
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
        <AccountNotice tone="success">{status.message}</AccountNotice>
      ) : null}

      <AccountPanel
        kicker="Security"
        title="Change password"
        description="Update the password for your account. 8+ characters, uppercase, number, special character."
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
            onChange={(value) => {
              setPassword(value);
              if (status.type === "success") setStatus({ type: "idle" });
            }}
            type="password"
            validate={(v) => (v.length > 0 ? validatePassword(v) : null)}
            isDisabled={busy}
          >
            <Label className="mb-2 block label-style">New password</Label>
            <Input
              placeholder="8+ chars, uppercase, number, special"
              autoComplete="new-password"
              className={inputStyles()}
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
            isDisabled={busy}
          >
            <Label className="mb-2 block label-style">Confirm password</Label>
            <Input
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className={inputStyles()}
            />
            <div className="min-h-[20px]">
              <FieldError className="block text-xs text-red-500" />
            </div>
          </TextField>

          <Button type="submit" size="sm" isDisabled={!canSubmit} isPending={busy}>
            Change password
          </Button>
        </Form>
      </AccountPanel>
    </div>
  );
}
